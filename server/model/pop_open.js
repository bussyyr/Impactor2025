// server/model/pop_open.js
import fetch from "node-fetch";

// ---- Ayarlar ----
const GEONAMES_USER = process.env.GEONAMES_USER || ""; // varsa kullanılır
const GEONAMES_BASE = "http://api.geonames.org/citiesJSON";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const MAX_ROWS_GEONAMES = 1000;   // GeoNames free için üst sınır
const OVERPASS_SLEEP_MS = 1200;   // rate limit nazikliği

// ---- Yardımcılar ----
function kmToDegLat(km) { return km / 111.32; }
function kmToDegLng(km, lat) {
    const denom = 111.32 * Math.cos((lat * Math.PI) / 180);
    return km / (denom || 1);
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function haversineKm(aLat, aLon, bLat, bLon) {
    const toRad = d => d * Math.PI / 180;
    const R = 6371;
    const dLat = toRad(bLat - aLat);
    const dLon = toRad(bLon - aLon);
    const s1 = Math.sin(dLat/2)**2 +
        Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon/2)**2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s1)));
}
function makeBbox({ lat, lng, radiusKm }) {
    const dLat = kmToDegLat(radiusKm);
    const dLng = kmToDegLng(radiusKm, lat);
    const north = clamp(lat + dLat, -90, 90);
    const south = clamp(lat - dLat, -90, 90);
    let east = lng + dLng;
    let west = lng - dLng;
    if (east > 180) east -= 360;
    if (west < -180) west += 360;
    return {
        north: +north.toFixed(4),
        south: +south.toFixed(4),
        east:  +east.toFixed(4),
        west:  +west.toFixed(4)
    };
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---- 1) GeoNames: citiesJSON (bbox) ----
async function fetchCitiesFromGeoNames({ lat, lng, maxRadiusKm }) {
    if (!GEONAMES_USER) return [];

    const bbox = makeBbox({ lat, lng, radiusKm: maxRadiusKm });
    const params = new URLSearchParams({
        north: String(bbox.north),
        south: String(bbox.south),
        east:  String(bbox.east),
        west:  String(bbox.west),
        maxRows: String(MAX_ROWS_GEONAMES),
        lang: "en",
        username: GEONAMES_USER
    });
    const url = `${GEONAMES_BASE}?${params.toString()}`;

    let text = "";
    try {
        const res = await fetch(url);
        text = await res.text();
        if (!res.ok) {
            console.warn("GeoNames HTTP", res.status, text.slice(0,120));
            return [];
        }
    } catch (e) {
        console.warn("GeoNames fetch fail:", e.message);
        return [];
    }

    let js;
    try { js = JSON.parse(text); } catch {
        console.warn("GeoNames JSON fail:", text.slice(0,120));
        return [];
    }
    if (js.status) {
        console.warn("GeoNames status:", js.status); // {message,value}
        return [];
    }

    const arr = Array.isArray(js?.geonames) ? js.geonames : [];
    const out = arr
        .map(c => ({
            lat: Number(c.lat),
            lon: Number(c.lng ?? c.lon ?? c.longitude),
            population: Number(c.population ?? 0)
        }))
        .filter(c => isFinite(c.lat) && isFinite(c.lon) && c.population > 0)
        .map(c => ({ ...c, distanceKm: haversineKm(lat, lng, c.lat, c.lon) }));

    return out;
}

// ---- 2) OSM Overpass: around(maxRadiusKm) ----
// place=city|town|village + population tag'ı olan nodelar (bazı yerlerde relation/way de var ama basitlik için node yeterli)
function buildOverpassQuery({ lat, lng, maxRadiusKm }) {
    const R = Math.round(maxRadiusKm * 1000);
    // not: out tags; limit çok yüksek olmadan bırakıyoruz (global rate limit nazikliği)
    return `
    [out:json][timeout:25];
    (
      node(around:${R},${lat},${lng})[place=city][population];
      node(around:${R},${lat},${lng})[place=town][population];
      node(around:${R},${lat},${lng})[place=village][population];
    );
    out tags center 2000;
  `.trim();
}

async function fetchCitiesFromOverpass({ lat, lng, maxRadiusKm }) {
    const data = new URLSearchParams({ data: buildOverpassQuery({ lat, lng, maxRadiusKm }) });
    let text = "";
    try {
        const res = await fetch(OVERPASS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
            body: data.toString()
        });
        text = await res.text();
        if (!res.ok) {
            console.warn("Overpass HTTP", res.status, text.slice(0,120));
            return [];
        }
    } catch (e) {
        console.warn("Overpass fetch fail:", e.message);
        return [];
    }

    let js;
    try { js = JSON.parse(text); } catch {
        console.warn("Overpass JSON fail:", text.slice(0,120));
        return [];
    }

    const els = Array.isArray(js?.elements) ? js.elements : [];
    const nodes = els.filter(e => e.type === "node" && e.tags && e.tags.population);
    const out = [];
    for (const n of nodes) {
        const pop = Number(String(n.tags.population).replace(/[, ]+/g, ""));
        if (!Number.isFinite(pop) || pop <= 0) continue;
        const latN = Number(n.lat ?? n.center?.lat);
        const lonN = Number(n.lon ?? n.center?.lon);
        if (!isFinite(latN) || !isFinite(lonN)) continue;
        out.push({
            lat: latN,
            lon: lonN,
            population: pop,
            distanceKm: haversineKm(lat, lng, latN, lonN)
        });
    }
    return out;
}

// ---- Ana API ----
export async function sumPopulationOpen({ lat, lng, radiiKm }) {
    const maxR = Math.max(...radiiKm);

    // 1) GeoNames dene
    let cities = await fetchCitiesFromGeoNames({ lat, lng, maxRadiusKm: maxR });

    // 2) Boşsa Overpass'e düş
    if (cities.length === 0) {
        await sleep(OVERPASS_SLEEP_MS);
        cities = await fetchCitiesFromOverpass({ lat, lng, maxRadiusKm: maxR });
    }

    // 3) Hâlâ boşsa sıfırlarla dön
    if (cities.length === 0) {
        return {
            byRadius: radiiKm.map(r => ({ r, pop: 0 })),
            deathsEstimate: 0
        };
    }

    // 4) Küçük yarıçapları lokalde topla
    const byRadius = radiiKm.map(r => {
        const sum = cities.reduce((acc, c) => acc + (c.distanceKm <= r ? c.population : 0), 0);
        return { r, pop: Math.round(sum) };
    });

    const severeR = Math.min(...radiiKm);
    const severePop = byRadius.find(x => x.r === severeR)?.pop || 0;
    const deathsEstimate = Math.round(severePop * 0.35);

    return { byRadius, deathsEstimate };
}
