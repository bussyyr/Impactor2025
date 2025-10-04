// server/model/pop_geonames.js
import fetch from "node-fetch";

const USERNAME = process.env.GEONAMES_USER || "";
const BASE = "https://api.geonames.org/citiesJSON";

function kmToDegLat(km) { return km / 111.32; }
function kmToDegLng(km, lat) { const d = 111.32 * Math.cos((lat * Math.PI)/180); return km / (d || 1); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function haversineKm(aLat,aLon,bLat,bLon){const r=Math.PI/180,R=6371;const dLat=(bLat-aLat)*r,dLon=(bLon-aLon)*r;const s=Math.sin(dLat/2)**2+Math.cos(aLat*r)*Math.cos(bLat*r)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(s)));}

function makeBbox({ lat, lng, radiusKm }) {
    const dLat = kmToDegLat(radiusKm);
    const dLng = kmToDegLng(radiusKm, lat);
    const north = clamp(lat + dLat, -90, 90);
    const south = clamp(lat - dLat, -90, 90);
    let east = lng + dLng;
    let west = lng - dLng;
    if (east > 180) east -= 360;
    if (west < -180) west += 360;
    return { north: +north.toFixed(4), south: +south.toFixed(4), east: +east.toFixed(4), west: +west.toFixed(4) };
}

async function fetchCitiesBBox({ north, south, east, west, maxRows=1000, username }) {
    const params = new URLSearchParams({ north, south, east, west, maxRows, lang:"en", username });
    const url = `${BASE}?${params.toString()}`;
    let text="";
    try {
        const res = await fetch(url);
        text = await res.text();
        if (!res.ok) throw new Error(`GeoNames HTTP ${res.status}: ${text.slice(0,180)}`);
    } catch (e) {
        console.warn("GeoNames fetch failed:", e.message);
        return [];
    }
    let js;
    try { js = JSON.parse(text); } catch {
        console.warn("GeoNames JSON parse failed:", text.slice(0,120));
        return [];
    }
    if (js.status) {
        console.warn("GeoNames status:", js.status); // {message, value}
        return [];
    }
    const arr = Array.isArray(js?.geonames) ? js.geonames : [];
    return arr.map(c => ({
        lat: Number(c.lat),
        lon: Number(c.lng ?? c.lon ?? c.longitude),
        population: Number(c.population ?? 0)
    })).filter(c => isFinite(c.lat) && isFinite(c.lon) && c.population > 0);
}

async function fetchCitiesForMaxRadius({ lat, lng, maxRadiusKm }) {
    const bbox = makeBbox({ lat, lng, radiusKm: maxRadiusKm });
    let cities = [];
    if (USERNAME) {
        cities = await fetchCitiesBBox({ ...bbox, username: USERNAME });
    }
    // Teşhis için, kullanıcı adı yok/çalışmıyorsa DEMO ile deneriz (kota düşük olabilir)
    if (cities.length === 0 && !USERNAME) {
        console.warn("GeoNames username missing — trying DEMO for diagnostics.");
        cities = await fetchCitiesBBox({ ...bbox, username: "demo" });
    }
    // distance hesapla
    return cities.map(c => ({ ...c, distanceKm: haversineKm(lat, lng, c.lat, c.lon) }));
}

export async function sumPopulationGeoNames({ lat, lng, radiiKm }) {
    const maxR = Math.max(...radiiKm);
    const cities = await fetchCitiesForMaxRadius({ lat, lng, maxRadiusKm: maxR });

    const byRadius = radiiKm.map(r => {
        const sum = cities.reduce((acc, c) => acc + (c.distanceKm <= r ? c.population : 0), 0);
        return { r, pop: Math.round(sum) };
    });

    const severeR = Math.min(...radiiKm);
    const severePop = byRadius.find(x => x.r === severeR)?.pop || 0;
    const deathsEstimate = Math.round(severePop * 0.35);
    return { byRadius, deathsEstimate };
}
