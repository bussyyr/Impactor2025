import express from "express";
import { LRUCache } from "lru-cache";
import fetch from "node-fetch";
import { computeImpactRadii } from "./model/impact.js";
import { sumPopulation } from "./model/pop.js";
import cors from "cors";
import { neowsFeed, neowsLookup } from "./model/neows.js";
import { sumPopulationGeoNames } from "./model/pop_geonames.js";
import { sumPopulationOpen } from "./model/pop_open.js";

const app = express();
app.use(express.json());

app.get("/api/neo/feed", async (req, res) => {
    try {
        const start = req.query.start || new Date().toISOString().slice(0,10);
        // 7 güne kadar
        const end = req.query.end || start;
        const data = await neowsFeed({ start, end, apiKey: process.env.NASA_KEY });
        res.json({ items: data });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "neows_feed_failed" });
    }
});

app.get("/api/neo/lookup/:id", async (req, res) => {
    try {
        const item = await neowsLookup({ asteroidId: req.params.id, apiKey: process.env.NASA_KEY });
        res.json(item);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "neows_lookup_failed" });
    }
});

const PORT = process.env.PORT || 8787;
const cache = new LRUCache({ max: 100, ttl: 1000 * 60 * 60 * 6 });

app.use(cors({
    origin: "http://localhost:3000",
    methods: ["GET","POST","OPTIONS"],
    allowedHeaders: ["Content-Type"]
}));
app.options("*", cors());

app.get("/api/health", (_, res) => res.json({ ok: true }));

app.get("/api/sentry", async (req, res) => {
    const key = "sentry:summary";
    if (cache.has(key)) return res.json(cache.get(key));
    const r = await fetch("https://ssd-api.jpl.nasa.gov/sentry.api?all=1&removed=0");
    const js = await r.json();
    cache.set(key, js);
    res.json(js);
});

app.get("/api/neo/:id", async (req, res) => {
    const url = `https://api.nasa.gov/neo/rest/v1/neo/${req.params.id}?api_key=${process.env.NASA_KEY}`;
    const r = await fetch(url);
    res.json(await r.json());
});

app.post("/api/impact/run", (req, res) => {
    const out = computeImpactRadii(req.body); // {severeKm, majorKm, lightKm, energyMt}
    res.json(out);
});

app.post("/api/pop/sum", async (req, res, next) => {
    try {
        const { lat, lng, radiiKm } = req.body;
        const out = await sumPopulationOpen({ lat, lng, radiiKm });
        res.json(out);
    } catch (e) { next(e); }
});

console.log("GEONAMES_USER present?", !!process.env.GEONAMES_USER, process.env.GEONAMES_USER);

app.listen(PORT, () => console.log(`API on :${PORT}`));

