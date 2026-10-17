import { Redis } from "@upstash/redis";
import { randomUUID } from "node:crypto";

// Vercel's Upstash integration may name these either way.
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN,
});

const PEOPLE = "bgc:people";         // hash: personId -> {name, color, createdAt}
const PLACEMENTS = "bgc:placements"; // hash: "raterId__targetId" -> {rater, target, x, y, updatedAt, history}
const MAX_PEOPLE = 60;
const MAX_HISTORY = 40;

const clamp = (v) => Math.max(-1, Math.min(1, Number(v)));
const round = (v) => Math.round(v * 1000) / 1000;
const parse = (v) => (typeof v === "string" ? safeJson(v) : v);
function safeJson(s) { try { return JSON.parse(s); } catch { return null; } }

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!process.env.UPSTASH_REDIS_REST_URL && !process.env.KV_REST_API_URL) {
    return res.status(500).json({ error: "Storage isn't connected. Add Upstash Redis to this Vercel project and redeploy." });
  }

  try {
    if (req.method === "GET") {
      const [people, placements] = await Promise.all([redis.hgetall(PEOPLE), redis.hgetall(PLACEMENTS)]);
      return res.status(200).json({ people: people || {}, placements: placements || {} });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = typeof req.body === "string" ? safeJson(req.body) || {} : req.body || {};

    if (body.action === "addPerson") {
      const name = String(body.name || "").trim().replace(/\s+/g, " ").slice(0, 40);
      if (!name) return res.status(400).json({ error: "Enter a name first." });
      const color = /^#[0-9a-f]{6}$/i.test(body.color || "") ? body.color : "#777777";
      const count = await redis.hlen(PEOPLE);
      if (count >= MAX_PEOPLE) return res.status(400).json({ error: "The map is full." });
      const id = randomUUID().replace(/-/g, "").slice(0, 20);
      const person = { name, color, createdAt: Date.now() };
      await redis.hset(PEOPLE, { [id]: person });
      return res.status(200).json({ id, person });
    }

    if (body.action === "savePlacement") {
      const rater = String(body.rater || "");
      const target = String(body.target || "");
      const x = clamp(body.x), y = clamp(body.y);
      if (!rater || !target || Number.isNaN(x) || Number.isNaN(y)) {
        return res.status(400).json({ error: "Missing placement details." });
      }
      const [raterExists, targetExists] = await Promise.all([redis.hexists(PEOPLE, rater), redis.hexists(PEOPLE, target)]);
      if (!raterExists || !targetExists) return res.status(400).json({ error: "That person isn't on the map anymore." });

      const key = `${rater}__${target}`;
      const prev = parse(await redis.hget(PLACEMENTS, key));
      const now = Date.now();
      const history = (prev && Array.isArray(prev.history) ? prev.history : [])
        .concat({ x: round(x), y: round(y), t: now })
        .slice(-MAX_HISTORY);
      const placement = { rater, target, x: round(x), y: round(y), updatedAt: now, history };
      await redis.hset(PLACEMENTS, { [key]: placement });
      return res.status(200).json({ placement });
    }

    return res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Storage error. Try again in a moment." });
  }
}
