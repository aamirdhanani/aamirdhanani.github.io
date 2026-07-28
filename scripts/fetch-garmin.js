// Fetches activity data from Garmin Connect (unofficial API) and writes it to
// src/_data/fitness.json in the shape the Fitness page expects.
//
// NOTE: Garmin has no official personal API. This uses the community
// `garmin-connect` package, which logs in with your Garmin email + password
// (GitHub secrets GARMIN_EMAIL / GARMIN_PASSWORD). It can break when Garmin
// changes their login flow, and it will NOT work if MFA is enabled on the
// account. If it fails, the error printed below names the likely cause.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GarminConnect } = require('garmin-connect');

const EMAIL = process.env.GARMIN_EMAIL;
const PASSWORD = process.env.GARMIN_PASSWORD;
const MAX_ACTIVITIES = 1500; // how far back to pull for lifetime totals + heatmap

// ---- Garmin typeKey -> the display types the Fitness page + CSS classes use ----
function mapType(typeKey) {
    const k = (typeKey || '').toLowerCase();
    if (k.includes('run')) return 'Run';
    if (k.includes('cycl') || k.includes('bik') || k === 'virtual_ride') return 'Ride';
    if (k.includes('swim')) return 'Swim';
    if (k.includes('strength') || k.includes('weight')) return 'WeightTraining';
    if (k.includes('hik')) return 'Hike';
    if (k.includes('walk')) return 'Walk';
    return k.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Other';
}

// Normalize a raw Garmin activity into the {type, distance(m), moving_time(s),
// start_date, ...} shape the ported calc helpers expect.
function normalize(a) {
    const localIso = (a.startTimeLocal || a.startTimeGMT || '').replace(' ', 'T');
    return {
        id: a.activityId,
        name: a.activityName || mapType(a.activityType && a.activityType.typeKey),
        type: mapType(a.activityType && a.activityType.typeKey),
        distance: Number(a.distance) || 0,
        moving_time: Number(a.movingDuration || a.duration) || 0,
        start_date: localIso,
        total_elevation_gain: Math.round(Number(a.elevationGain) || 0)
    };
}

const ACTIVITY_URL = 'https://connectapi.garmin.com/activity-service/activity/';

// Turn a Garmin GPS polyline ([{lat,lon},...]) into a compact, ready-to-draw
// SVG path normalized into a fixed 100x70 viewBox (centered, aspect-preserved).
// Uses an equirectangular projection with cos(lat) longitude compression so the
// route isn't horizontally squished. Returns {d, sx, sy, ex, ey} (start/end dot
// coords) or null when there aren't enough GPS points (e.g. indoor workouts).
function buildRoutePath(polyline, W = 100, H = 70, pad = 7) {
    if (!Array.isArray(polyline) || polyline.length < 2) return null;
    // Downsample to keep the path small while preserving the route's shape.
    const target = 200;
    const step = Math.max(1, Math.floor(polyline.length / target));
    const pts = [];
    for (let i = 0; i < polyline.length; i += step) {
        const p = polyline[i];
        if (p && p.lat != null && p.lon != null) pts.push([p.lat, p.lon]);
    }
    const last = polyline[polyline.length - 1];
    if (last && last.lat != null && last.lon != null) pts.push([last.lat, last.lon]);
    if (pts.length < 2) return null;

    const lats = pts.map(p => p[0]), lons = pts.map(p => p[1]);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const kx = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180) || 1; // lon compression
    const xs = pts.map(p => (p[1] - minLon) * kx);   // east -> right
    const ys = pts.map(p => (maxLat - p[0]));         // north -> up (SVG y is flipped)
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const spanX = (Math.max(...xs) - minX) || 1e-6;
    const spanY = (Math.max(...ys) - minY) || 1e-6;
    const scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY);
    const offX = (W - spanX * scale) / 2 - minX * scale;
    const offY = (H - spanY * scale) / 2 - minY * scale;
    const px = i => +(xs[i] * scale + offX).toFixed(1);
    const py = i => +(ys[i] * scale + offY).toFixed(1);

    const d = pts.map((_, i) => (i === 0 ? 'M' : 'L') + px(i) + ' ' + py(i)).join(' ');
    return { d, sx: px(0), sy: py(0), ex: px(pts.length - 1), ey: py(pts.length - 1) };
}

// Fetch the GPS track for each given activity id and build its route path.
// One extra API call per id (only the handful of recent activities), each
// failure is non-fatal — that activity just renders without a map.
async function fetchActivityRoutes(client, ids) {
    const routes = {};
    for (const id of ids) {
        try {
            const det = await client.get(ACTIVITY_URL + id + '/details',
                { params: { maxChartSize: 0, maxPolylineSize: 2000 } });
            routes[id] = buildRoutePath(det && det.geoPolylineDTO && det.geoPolylineDTO.polyline);
        } catch (e) {
            console.warn(`Could not fetch route for activity ${id} (non-fatal):`, e.message);
            routes[id] = null;
        }
    }
    return routes;
}

function formatPace(time, distance, type) {
    if (!distance) return '';
    if (type === 'Run') {
        const paceMinPerKm = (time / 60) / (distance / 1000);
        const mins = Math.floor(paceMinPerKm);
        const secs = Math.floor((paceMinPerKm - mins) * 60);
        return `${mins}:${secs.toString().padStart(2, '0')} /km`;
    } else if (type === 'Ride') {
        return `${((distance / 1000) / (time / 3600)).toFixed(1)} km/h`;
    }
    return '';
}

function calculateWeeklyVolume(activities) {
    // Rolling last-7-days window rather than calendar-week-to-date: the latter
    // is empty (and the whole summary reads broken) for the first days after a
    // week rolls over. A trailing window is both robust and the more meaningful
    // "recent training load" glance.
    const windowStart = Date.now() - 7 * 24 * 60 * 60 * 1000;

    let totalTime = 0;
    let totalDistance = 0;
    let totalCount = 0;
    const volume = {};
    activities.forEach(activity => {
        if (new Date(activity.start_date).getTime() < windowStart) return;
        const type = activity.type;
        if (!volume[type]) volume[type] = { distance: 0, time: 0, count: 0 };
        volume[type].distance += activity.distance;
        volume[type].time += activity.moving_time;
        volume[type].count += 1;
        totalDistance += activity.distance;
        totalTime += activity.moving_time;
        totalCount += 1;
    });

    const cardioTypes = ['Run', 'Ride', 'Swim', 'Hike', 'Walk'];
    Object.keys(volume).forEach(type => {
        const v = volume[type];
        v.distanceKm = (v.distance / 1000).toFixed(2);
        const hours = Math.floor(v.time / 3600);
        const minutes = Math.floor((v.time % 3600) / 60);
        v.formattedTime = `${hours}h ${minutes}m`;
        v.percentage = totalTime > 0 ? (v.time / totalTime * 100).toFixed(0) : 0;
        v.isCardio = cardioTypes.includes(type);
        v.avgPace = v.isCardio ? formatPace(v.time, v.distance, type) : '';
    });

    return { types: volume, totalDistance: (totalDistance / 1000).toFixed(2), count: totalCount };
}

function generateHeatmapData(activities) {
    const counts = {};
    activities.forEach(a => {
        const dateStr = (a.start_date || '').split('T')[0];
        if (dateStr) counts[dateStr] = (counts[dateStr] || 0) + 1;
    });
    const calendar = [];
    const now = new Date();
    for (let i = 364; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        calendar.push({
            date: dateStr,
            count: counts[dateStr] || 0,
            intensity: Math.min((counts[dateStr] || 0), 4)
        });
    }
    return calendar;
}

function aggregate(activities, keep) {
    const cat = t => (t === 'Run' ? 'run' : t === 'Ride' ? 'ride' : t === 'Swim' ? 'swim' : null);
    const totals = {
        run: { count: 0, distance: 0, moving_time: 0 },
        ride: { count: 0, distance: 0, moving_time: 0 },
        swim: { count: 0, distance: 0, moving_time: 0 }
    };
    activities.forEach(a => {
        if (!keep(a)) return;
        const c = cat(a.type);
        if (!c) return;
        totals[c].count += 1;
        totals[c].distance += a.distance;
        totals[c].moving_time += a.moving_time;
    });
    return totals;
}

function processStats(t) {
    if (!t) return null;
    return {
        count: t.count,
        distance: (t.distance / 1000).toFixed(0),
        time: Math.floor(t.moving_time / 3600)
    };
}

// Pure transform — exported for testing. `routes` maps activityId -> SVG route
// path object (or null); attached to each recent activity for the map cards.
function buildFitnessData(rawActivities, profile, routes = {}) {
    const activities = rawActivities
        .map(normalize)
        .sort((x, y) => new Date(y.start_date) - new Date(x.start_date));

    const weekly = calculateWeeklyVolume(activities);
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    const ytd = aggregate(activities, a => new Date(a.start_date) >= yearStart);
    const all = aggregate(activities, () => true);

    const fullName = (profile && (profile.fullName || profile.displayName || profile.userName)) || '';
    const [firstname, ...rest] = fullName.split(' ');

    return {
        lastUpdated: new Date().toISOString(),
        source: 'garmin',
        athlete: {
            firstname: firstname || '',
            lastname: rest.join(' '),
            profile: (profile && (profile.profileImageUrlLarge || profile.profileImageUrlMedium)) || ''
        },
        recentActivities: activities.slice(0, 6).map(a => ({
            id: a.id,
            name: a.name,
            type: a.type,
            distance: (a.distance / 1000).toFixed(2),
            movingTime: a.moving_time,
            pace: formatPace(a.moving_time, a.distance, a.type),
            startDate: a.start_date,
            total_elevation_gain: a.total_elevation_gain,
            route: routes[a.id] || null
        })),
        weeklyVolume: weekly.types,
        weeklyTotalDistance: weekly.totalDistance,
        weeklyCount: weekly.count,
        heatmap: generateHeatmapData(activities),
        ytdStats: { run: processStats(ytd.run), ride: processStats(ytd.ride), swim: processStats(ytd.swim) },
        allTimeStats: { run: processStats(all.run), ride: processStats(all.ride), swim: processStats(all.swim) }
    };
}

async function fetchAllActivities(client) {
    const all = [];
    const pageSize = 100;
    for (let start = 0; start < MAX_ACTIVITIES; start += pageSize) {
        const batch = await client.getActivities(start, pageSize);
        if (!batch || batch.length === 0) break;
        all.push(...batch);
        if (batch.length < pageSize) break;
    }
    return all;
}

async function authenticate(client) {
    // Preferred (CI): restore a saved session token. A fresh email/password login
    // from a datacenter IP (GitHub Actions) is frequently blocked by Garmin's
    // Cloudflare, so we log in once locally, export the token, and reuse it here.
    if (process.env.GARMIN_TOKEN) {
        console.log('Restoring Garmin session from GARMIN_TOKEN...');
        const t = JSON.parse(Buffer.from(process.env.GARMIN_TOKEN, 'base64').toString('utf8'));
        client.loadToken(t.oauth1, t.oauth2);
        return;
    }
    if (EMAIL && PASSWORD) {
        console.log('Logging into Garmin Connect with email/password...');
        await client.login();
        return;
    }
    throw new Error('No GARMIN_TOKEN, and no GARMIN_EMAIL/GARMIN_PASSWORD provided.');
}

async function main() {
    const client = new GarminConnect({ username: EMAIL, password: PASSWORD });

    // One-off: `node scripts/fetch-garmin.js --export-token` logs in with the
    // password and writes a base64 session token to .garmin-token.txt, whose
    // contents go into the GARMIN_TOKEN GitHub secret for CI.
    if (process.argv.includes('--export-token')) {
        if (!EMAIL || !PASSWORD) {
            console.error('--export-token needs GARMIN_EMAIL / GARMIN_PASSWORD in your .env.');
            process.exit(1);
        }
        try {
            await client.login();
            const b64 = Buffer.from(JSON.stringify(client.exportToken())).toString('base64');
            fs.writeFileSync(path.join(__dirname, '..', '.garmin-token.txt'), b64 + '\n');
            console.log('✅ Wrote .garmin-token.txt — put its contents in the GARMIN_TOKEN secret. Do NOT commit it.');
        } catch (err) {
            console.error('Token export failed:', err && err.message);
            process.exit(1);
        }
        return;
    }

    try {
        await authenticate(client);

        let profile = null;
        try { profile = await client.getUserProfile(); }
        catch (e) { console.warn('Could not fetch profile (non-fatal):', e.message); }

        console.log('Fetching activities...');
        const raw = await fetchAllActivities(client);
        console.log(`Fetched ${raw.length} activities.`);
        if (raw.length === 0) {
            console.error('No activities returned — refusing to overwrite fitness.json with empty data.');
            process.exit(1);
        }

        // Fetch GPS route tracks only for the handful of activities that will
        // actually be shown as recent-activity cards.
        const recentIds = raw
            .map(normalize)
            .sort((x, y) => new Date(y.start_date) - new Date(x.start_date))
            .slice(0, 6)
            .map(a => a.id);
        console.log('Fetching route tracks for recent activities...');
        const routes = await fetchActivityRoutes(client, recentIds);
        const withRoutes = Object.values(routes).filter(Boolean).length;

        const data = buildFitnessData(raw, profile, routes);
        fs.writeFileSync(path.join(__dirname, '../src/_data/fitness.json'), JSON.stringify(data, null, 2));
        console.log(`✅ Wrote src/_data/fitness.json (${data.recentActivities.length} recent, ${withRoutes} with route maps, ${raw.length} total activities).`);
    } catch (err) {
        console.error('\n❌ Garmin fetch failed:', err && err.message);
        console.error('In CI this is usually the datacenter IP being blocked on a fresh login —');
        console.error('use a GARMIN_TOKEN secret (regenerate locally with `--export-token`).');
        console.error('Other causes: wrong credentials, MFA enabled, or an expired token.');
        process.exit(1);
    }
}

module.exports = { buildFitnessData, mapType, normalize };
if (require.main === module) main();
