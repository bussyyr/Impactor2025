const API_BASE = "";

export async function runImpact(body) {
    const r = await fetch(`${API_BASE}/api/impact/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    return r.json();
}

export async function sumPop({ lat, lng, radiiKm, year = 2020 }) {
    const r = await fetch(`${API_BASE}/api/pop/sum`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, radiiKm, year })
    });
    return r.json();
}

export async function getSentry() {
    const r = await fetch(`${API_BASE}/api/sentry`);
    return r.json();
}

// ekle:
export async function getNeoFeed({ start, end }) {
    const qs = new URLSearchParams();
    if (start) qs.set("start", start);
    if (end) qs.set("end", end);
    const r = await fetch(`/api/neo/feed?${qs.toString()}`);
    return r.json(); // {items:[{id,name,date,diameterM,speedKms,hazardous}]}
}

export async function getNeoById(id) {
    const r = await fetch(`/api/neo/lookup/${id}`);
    return r.json(); // {id,name,diameterM,speedKms}
}

