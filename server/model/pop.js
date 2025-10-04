// server/model/pop.js
import fetch from "node-fetch";

// Yıla göre doğrudan tek bantlı 1km katmanı (UN-adjusted global)
const WORLDPOP_BY_YEAR = {
    2020: "https://worldpop.arcgis.com/arcgis/rest/services/WorldPop_Population_2020_1km/ImageServer/getSamples",
    2019: "https://worldpop.arcgis.com/arcgis/rest/services/WorldPop_Population_2019_1km/ImageServer/getSamples",
    2018: "https://worldpop.arcgis.com/arcgis/rest/services/WorldPop_Population_2018_1km/ImageServer/getSamples",
    2017: "https://worldpop.arcgis.com/arcgis/rest/services/WorldPop_Population_2017_1km/ImageServer/getSamples",
    2016: "https://worldpop.arcgis.com/arcgis/rest/services/WorldPop_Population_2016_1km/ImageServer/getSamples",
    2015: "https://worldpop.arcgis.com/arcgis/rest/services/WorldPop_Population_2015_1km/ImageServer/getSamples"
};

// km <-> derece dönüşümü
function kmToDegLat(km) { return km / 111.32; }
function kmToDegLng(km, lat) { return km / (111.32 * Math.cos(lat * Math.PI/180) || 1); }

// Daire içi multipoint ızgara
function buildDiskGridPoints({ lat, lng, radiusKm, grid = 21 }) {
    const half = (grid - 1) / 2;
    const points = [];
    for (let iy = -half; iy <= half; iy++) {
        for (let ix = -half; ix <= half; ix++) {
            const fx = ix / half, fy = iy / half;
            const r = Math.hypot(fx, fy);
            if (r <= 1) {
                const dKm = r * radiusKm;
                const dLat = kmToDegLat(dKm * fy);
                const dLng = kmToDegLng(dKm * fx, lat);
                points.push([lng + dLng, lat + dLat]); // [x=lng, y=lat]
            }
        }
    }
    return { points, spatialReference: { wkid: 4326 } };
}

// getSamples çağrısı (tek bantlı katman: renderingRule yok)
async function getSamplesMean({ url, geometry }) {
    // batch’le
    const pts = geometry.points;
    const batchSize = 180;
    const values = [];

    for (let i = 0; i < pts.length; i += batchSize) {
        const part = { points: pts.slice(i, i + batchSize), spatialReference: geometry.spatialReference };
        const params = new URLSearchParams({
            f: "json",
            outFields: "*",
            geometry: JSON.stringify(part),
            geometryType: "esriGeometryMultipoint",
            returnGeometry: "false",
            interpolateValues: "true"
        });
        const res = await fetch(`${url}?${params.toString()}`);
        if (!res.ok) continue;
        const js = await res.json();
        const samples = js?.samples || [];
        for (const s of samples) {
            // tüm olası alan adlarını dene
            const v =
                s?.value ?? s?.Value ??
                s?.attributes?.Value ?? s?.attributes?.value ??
                s?.attributes?.PixelValue ?? s?.attributes?.Pixelvalue ??
                s?.attributes?.PixelVal ?? s?.attributes?.PIXEL_VALUE;
            if (typeof v === "number" && isFinite(v)) values.push(v);
        }
    }

    if (!values.length) return null;
    const mean = values.reduce((a,b)=>a+b,0) / values.length;
    return mean; // kişi/km²
}

async function samplePopulation({ lat, lng, radiusKm, year }) {
    const url = WORLDPOP_BY_YEAR[year] || WORLDPOP_BY_YEAR[2020];
    const geometry = buildDiskGridPoints({ lat, lng, radiusKm, grid: 21 });

    // 1) yılın kendi katmanından oku
    let mean = await getSamplesMean({ url, geometry });

    // 2) Hâlâ boşsa ızgarayı sıklaştır (25x25)
    if (mean == null) {
        const geometry2 = buildDiskGridPoints({ lat, lng, radiusKm, grid: 25 });
        mean = await getSamplesMean({ url, geometry: geometry2 });
    }

    if (mean == null) return 0;
    const areaKm2 = Math.PI * radiusKm * radiusKm;
    return mean * areaKm2; // toplam kişi ≈ ortalama yoğunluk * alan
}

export async function sumPopulation({ lat, lng, radiiKm, year = 2020 }) {
    const byRadius = [];
    for (const r of radiiKm) {
        let pop = 0;
        try {
            pop = await samplePopulation({ lat, lng, radiusKm: r, year });
        } catch (_) {}
        byRadius.push({ r, pop: Math.round(pop) });
    }

    const severeR = Math.min(...radiiKm);
    const severePop = byRadius.find(x => x.r === severeR)?.pop || 0;
    const deathsEstimate = Math.round(severePop * 0.35);

    return { byRadius, deathsEstimate };
}
