require('dotenv').config();
const fs = require('fs');
const path = require('path');

const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.STRAVA_REFRESH_TOKEN;

async function getAccessToken() {
    console.log('Refreshing access token...');
    // Use form-urlencoded query params — the most universally accepted method for
    // Strava's token endpoint (avoids any JSON content-type ambiguity).
    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: REFRESH_TOKEN,
        grant_type: 'refresh_token',
    });

    const response = await fetch(`https://www.strava.com/oauth/token?${params.toString()}`, {
        method: 'POST',
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.errors || !data.access_token) {
        console.error(`\n❌ Strava rejected the token refresh (HTTP ${response.status}).`);
        console.error('Response:', JSON.stringify(data, null, 2));
        console.error('\nThis almost always means the GitHub secret STRAVA_REFRESH_TOKEN is');
        console.error('invalid/expired, or the app was disconnected on Strava. Re-authorize the');
        console.error('app and update STRAVA_REFRESH_TOKEN (and STRAVA_CLIENT_ID/SECRET) in');
        console.error('the repo: Settings → Secrets and variables → Actions.\n');
        process.exit(1);
    }

    // Strava may rotate the refresh token. If it changed, surface it loudly so the
    // secret can be updated (a workflow can't rewrite its own secret without a PAT).
    if (data.refresh_token && data.refresh_token !== REFRESH_TOKEN) {
        console.warn('\n⚠️  Strava returned a NEW refresh token.');
        console.warn('   Update the STRAVA_REFRESH_TOKEN secret to this value to avoid future failures:');
        console.warn(`   ${data.refresh_token}\n`);
    }

    console.log('✅ Access token acquired.');
    return data.access_token;
}

async function fetchRecentActivities(accessToken) {
    console.log('Fetching recent activities...');
    const response = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=10', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json();
    if (data.errors || data.message) {
        console.error('Error fetching activities:', data);
        process.exit(1);
    }
    return data;
}

async function fetchHeatmapActivities(accessToken) {
    console.log('Fetching activities for heatmap...');
    const after = Math.floor(new Date(new Date().setFullYear(new Date().getFullYear() - 1)).getTime() / 1000);
    let allActivities = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page < 5) {
        const response = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100&page=${page}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await response.json();
        if (!data || data.length === 0) hasMore = false;
        else {
            allActivities = allActivities.concat(data);
            page++;
        }
    }
    return allActivities;
}

async function fetchStats(accessToken, athleteId) {
    console.log('Fetching athlete stats...');
    const response = await fetch(`https://www.strava.com/api/v3/athletes/${athleteId}/stats`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    return await response.json();
}

async function fetchAthlete(accessToken) {
    console.log('Fetching athlete info...');
    const response = await fetch('https://www.strava.com/api/v3/athlete', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    return await response.json();
}

function calculateWeeklyVolume(activities) {
    const now = new Date();
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    startOfWeek.setHours(0, 0, 0, 0);

    let totalDistance = 0;
    let totalTime = 0;
    const volume = {};
    activities.forEach(activity => {
        const date = new Date(activity.start_date);
        if (date >= startOfWeek) {
            const type = activity.type;
            if (!volume[type]) {
                volume[type] = { distance: 0, time: 0, count: 0 };
            }
            volume[type].distance += activity.distance;
            volume[type].time += activity.moving_time;
            volume[type].count += 1;
            totalDistance += activity.distance;
            totalTime += activity.moving_time;
        }
    });

    Object.keys(volume).forEach(type => {
        volume[type].distanceKm = (volume[type].distance / 1000).toFixed(2);
        const hours = Math.floor(volume[type].time / 3600);
        const minutes = Math.floor((volume[type].time % 3600) / 60);
        volume[type].formattedTime = `${hours}h ${minutes}m`;
        volume[type].percentage = totalTime > 0 ? (volume[type].time / totalTime * 100).toFixed(0) : 0;

        // Define which activities are 'cardio' (have a meaningful pace/speed)
        const cardioTypes = ['Run', 'Ride', 'Swim', 'Hike', 'Walk'];
        volume[type].isCardio = cardioTypes.includes(type);
        volume[type].avgPace = volume[type].isCardio ? formatPace(volume[type].time, volume[type].distance, type) : '';
    });

    return { types: volume, totalDistance: (totalDistance / 1000).toFixed(2) };
}

function generateHeatmapData(activities) {
    const counts = {};
    activities.forEach(activity => {
        const dateStr = activity.start_date.split('T')[0];
        counts[dateStr] = (counts[dateStr] || 0) + 1;
    });

    // Generate last 365 days
    const calendar = [];
    const now = new Date();
    for (let i = 364; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        calendar.push({
            date: dateStr,
            count: counts[dateStr] || 0,
            intensity: Math.min((counts[dateStr] || 0), 4) // cap at 4 for styling
        });
    }
    return calendar;
}

async function main() {
    if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
        console.error('Missing environment variables.');
        process.exit(1);
    }

    try {
        const accessToken = await getAccessToken();
        const athlete = await fetchAthlete(accessToken);
        const recentActivities = await fetchRecentActivities(accessToken);
        const heatmapActivities = await fetchHeatmapActivities(accessToken);
        const stats = await fetchStats(accessToken, athlete.id);
        const weeklyVolume = calculateWeeklyVolume(recentActivities);

        const data = {
            lastUpdated: new Date().toISOString(),
            athlete: {
                firstname: athlete.firstname,
                lastname: athlete.lastname,
                profile: athlete.profile
            },
            recentActivities: recentActivities.slice(0, 6).map(a => ({
                id: a.id,
                name: a.name,
                type: a.type,
                distance: (a.distance / 1000).toFixed(2),
                movingTime: a.moving_time,
                pace: formatPace(a.moving_time, a.distance, a.type),
                startDate: a.start_date,
                total_elevation_gain: a.total_elevation_gain
            })),
            weeklyVolume: weeklyVolume.types,
            weeklyTotalDistance: weeklyVolume.totalDistance,
            heatmap: generateHeatmapData(heatmapActivities),
            ytdStats: {
                run: processStats(stats.ytd_run_totals),
                ride: processStats(stats.ytd_ride_totals),
                swim: processStats(stats.ytd_swim_totals)
            },
            allTimeStats: {
                run: processStats(stats.all_run_totals),
                ride: processStats(stats.all_ride_totals),
                swim: processStats(stats.all_swim_totals)
            }
        };

        fs.writeFileSync(path.join(__dirname, '../src/_data/strava.json'), JSON.stringify(data, null, 2));
        console.log('Successfully updated heatmap and stats.');

    } catch (error) {
        console.error('Error fetching Strava data:', error);
        process.exit(1);
    }
}

function processStats(totals) {
    if (!totals) return null;
    return {
        count: totals.count,
        distance: (totals.distance / 1000).toFixed(0),
        time: Math.floor(totals.moving_time / 3600)
    };
}

function formatPace(time, distance, type) {
    if (distance === 0) return '0:00';
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

main();
