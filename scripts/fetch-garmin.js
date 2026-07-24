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
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    startOfWeek.setHours(0, 0, 0, 0);

    let totalTime = 0;
    let totalDistance = 0;
    const volume = {};
    activities.forEach(activity => {
        if (new Date(activity.start_date) < startOfWeek) return;
        const type = activity.type;
        if (!volume[type]) volume[type] = { distance: 0, time: 0, count: 0 };
        volume[type].distance += activity.distance;
        volume[type].time += activity.moving_time;
        volume[type].count += 1;
        totalDistance += activity.distance;
        totalTime += activity.moving_time;
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

    return { types: volume, totalDistance: (totalDistance / 1000).toFixed(2) };
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

// Pure transform — exported for testing.
function buildFitnessData(rawActivities, profile) {
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
            total_elevation_gain: a.total_elevation_gain
        })),
        weeklyVolume: weekly.types,
        weeklyTotalDistance: weekly.totalDistance,
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

async function main() {
    if (!EMAIL || !PASSWORD) {
        console.error('Missing GARMIN_EMAIL / GARMIN_PASSWORD environment variables.');
        process.exit(1);
    }
    try {
        const client = new GarminConnect({ username: EMAIL, password: PASSWORD });
        console.log('Logging into Garmin Connect...');
        await client.login();

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

        const data = buildFitnessData(raw, profile);
        fs.writeFileSync(path.join(__dirname, '../src/_data/fitness.json'), JSON.stringify(data, null, 2));
        console.log(`✅ Wrote src/_data/fitness.json (${data.recentActivities.length} recent, ${raw.length} total activities).`);
    } catch (err) {
        console.error('\n❌ Garmin fetch failed:', err && err.message);
        console.error('Likely causes: wrong GARMIN_EMAIL/GARMIN_PASSWORD; MFA enabled on the');
        console.error('account (Garmin login via this library does not support MFA); or Garmin');
        console.error('changed their login flow (try `npm update garmin-connect`).');
        process.exit(1);
    }
}

module.exports = { buildFitnessData, mapType, normalize };
if (require.main === module) main();
