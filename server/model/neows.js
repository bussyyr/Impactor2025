// server/model/neows.js
import fetch from "node-fetch";

const API = "https://api.nasa.gov/neo/rest/v1";

export async function neowsFeed({ start, end, apiKey }) {
    const url = `${API}/feed?start_date=${start}&end_date=${end}&api_key=${apiKey}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`NeoWs feed ${r.status}`);
    const js = await r.json();
    // normalize: düz bir liste döndür
    const list = [];
    for (const [date, arr] of Object.entries(js.near_earth_objects || {})) {
        for (const o of arr) {
            // en yakın yaklaşımı al
            const ca = (o.close_approach_data || [])[0];
            const relVelKms = ca ? parseFloat(ca.relative_velocity.kilometers_per_second) : undefined;
            // çapı (meter) ortalaması
            const est = o.estimated_diameter?.meters;
            const dMin = est?.estimated_diameter_min;
            const dMax = est?.estimated_diameter_max;
            const dMean = dMin && dMax ? (dMin + dMax) / 2 : undefined;

            list.push({
                id: o.id,
                name: o.name,
                date,
                diameterM: dMean ? Math.round(dMean) : undefined,
                speedKms: relVelKms ? Math.round(relVelKms) : undefined,
                hazardous: !!o.is_potentially_hazardous_asteroid
            });
        }
    }
    // tarihi yakın olana ve bilgisi tam olana öncelik ver
    return list.filter(x => x.diameterM && x.speedKms);
}

export async function neowsLookup({ asteroidId, apiKey }) {
    const url = `${API}/neo/${asteroidId}?api_key=${apiKey}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`NeoWs lookup ${r.status}`);
    const o = await r.json();

    const est = o.estimated_diameter?.meters;
    const dMin = est?.estimated_diameter_min;
    const dMax = est?.estimated_diameter_max;
    const dMean = dMin && dMax ? (dMin + dMax) / 2 : undefined;

    // feed’deki gibi normalize et
    let speedKms;
    const ca = (o.close_approach_data || [])[0];
    if (ca?.relative_velocity?.kilometers_per_second) {
        speedKms = Math.round(parseFloat(ca.relative_velocity.kilometers_per_second));
    }

    return {
        id: o.id, name: o.name,
        diameterM: dMean ? Math.round(dMean) : undefined,
        speedKms: speedKms
    };
}
