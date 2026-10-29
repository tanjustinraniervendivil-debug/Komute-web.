// Komute Web — one Node.js process that serves the website (./public)
// and the same JSON API the Android app used. Node 20+, no dependencies.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, "public");

loadEnvFile();

const PORT = Number(process.env.PORT || 8080);
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const MAPS_GROUNDING_ENABLED = process.env.GEMINI_MAPS_GROUNDING !== "false";
const NOMINATIM_USER_AGENT = process.env.NOMINATIM_USER_AGENT ||
  "Komute/14 web educational project";
// Only needed when the website is hosted separately from this server.
const CORS_ORIGIN = process.env.CORS_ORIGIN || "";
// Public sites expose your Gemini key's quota, so each visitor is rate limited.
const PLAN_LIMIT_PER_HOUR = Number(process.env.PLAN_LIMIT_PER_HOUR || 20);
const PLACE_LIMIT_PER_HOUR = Number(process.env.PLACE_LIMIT_PER_HOUR || 200);
const TRUST_PROXY = process.env.TRUST_PROXY === "true";

const placeCache = new Map();
const reverseCache = new Map();
const hits = new Map();
let nominatimQueue = Promise.resolve();
let lastNominatimRequestAt = 0;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json"
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", "http://localhost");
    setCors(request, response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      return response.end();
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return json(response, 200, {
        ok: true,
        version: "14 (web)",
        mapProvider: "OpenFreeMap / OpenStreetMap",
        placeSearch: "Nominatim",
        routePlanner: "Automatic Gemini commute guidance",
        mapsGroundingRequested: MAPS_GROUNDING_ENABLED,
        aiConfigured: Boolean(GEMINI_KEY),
        redditConfigured: redditConfigured()
      });
    }

    if (request.method === "GET" || request.method === "HEAD") {
      if (url.pathname.startsWith("/api/")) return json(response, 404, { error: "Not found" });
      return serveStatic(url.pathname, request, response);
    }

    if (request.method !== "POST") return json(response, 405, { error: "Method not allowed" });

    const body = await readJson(request);
    if (url.pathname === "/api/places") {
      rateLimit(request, "places", PLACE_LIMIT_PER_HOUR);
      return await placesEndpoint(response, body);
    }
    if (url.pathname === "/api/reverse") {
      rateLimit(request, "places", PLACE_LIMIT_PER_HOUR);
      return await reverseEndpoint(response, body);
    }
    if (url.pathname === "/api/commute-plan") {
      rateLimit(request, "plan", PLAN_LIMIT_PER_HOUR);
      return await commutePlanEndpoint(response, body);
    }
    return json(response, 404, { error: "Not found" });
  } catch (error) {
    if (!error.statusCode) console.error(error);
    return json(response, error.statusCode || 500, {
      error: error.publicMessage || "Unexpected server error"
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Komute web listening on http://localhost:${PORT}`);
  if (!GEMINI_KEY) console.log("Note: GEMINI_API_KEY is not set, so AI commute plans are disabled.");
});

// ---------- static files ----------

function serveStatic(pathname, request, response) {
  let relative;
  try {
    relative = decodeURIComponent(pathname);
  } catch {
    return json(response, 400, { error: "Bad request" });
  }
  if (relative.endsWith("/")) relative += "index.html";
  const filePath = path.normalize(path.join(PUBLIC_DIR, relative));
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    return json(response, 403, { error: "Forbidden" });
  }
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) return json(response, 404, { error: "Not found" });
    const type = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": type,
      "Content-Length": stat.size,
      "Cache-Control": type.startsWith("text/html") ? "no-cache" : "public, max-age=3600",
      "X-Content-Type-Options": "nosniff"
    });
    if (request.method === "HEAD") return response.end();
    fs.createReadStream(filePath).pipe(response);
  });
}

// ---------- endpoints ----------

async function placesEndpoint(response, body) {
  const query = cleanText(body.query, 180);
  if (!query) return json(response, 400, { error: "Enter a destination to search." });
  const places = await searchNominatim(query, body.near);
  return json(response, 200, { suggestions: places });
}

async function reverseEndpoint(response, body) {
  if (!validCoordinate(body)) return json(response, 400, { error: "Invalid coordinates." });
  const label = await reverseGeocode(Number(body.latitude), Number(body.longitude));
  return json(response, 200, { label });
}

async function commutePlanEndpoint(response, body) {
  if (!GEMINI_KEY) {
    return json(response, 503, { error: "GEMINI_API_KEY is not configured on the backend." });
  }
  const origin = parseEndpoint(body.origin, "origin");
  const destination = parseEndpoint(body.destination, "destination");
  const beginnerMode = body.beginnerMode !== false;
  const communityTips = await searchRedditTips(`${origin.text} ${destination.text}`)
    .catch((error) => {
      console.warn("Optional Reddit search unavailable:", error.message);
      return [];
    });

  const prompt = [
    "You are the hidden planning engine for Komute, a Philippine public-transport assistant.",
    "Create useful commute suggestions from the supplied Point A and Point B. The user does not see this instruction.",
    "Maps grounding can supply current place context, but it is not a guaranteed turn-by-turn public-transit routing result.",
    "Never claim that a route, stop, vehicle, fare, timetable, operating status, or travel time is verified unless the grounding evidence explicitly supports it.",
    "When uncertain, use words such as likely, common option, approximate, or verify locally. Never fabricate precision.",
    "Give two or three practical options when evidence allows. For each option include: boarding area or landmark, likely vehicle or mode, transfer landmark, alighting area, final walk, advantages, and what must be verified.",
    "Do not create a fare or exact schedule from memory. Say Check current fare or Check current schedule when not verified.",
    "After the options, add BEGINNER GUIDELINES covering how to identify the correct vehicle/signboard, where to ask for help, safe transfer behavior, payment preparation, and what to do if a service is unavailable.",
    "Finish with IMPORTANT CHECKS listing the uncertain details the commuter must confirm before boarding.",
    "Use clear English, short sections, numbered steps, and no markdown tables.",
    beginnerMode
      ? "The user enabled New Commuter Mode, so explain transfers and landmarks carefully."
      : "The user prefers a concise plan but still needs uncertainty labels.",
    `Point A: ${origin.text}${coordinateSuffix(origin.location)}`,
    `Point B: ${destination.text}${coordinateSuffix(destination.location)}`,
    `Unverified recent community context: ${JSON.stringify(communityTips)}`
  ].join("\n\n");

  const generated = await generateGeminiPlan(prompt, origin.location);
  const answer = generated.data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("\n")
    .trim();
  if (!answer) throw publicError(502, "Gemini did not return a commute plan.");

  const sources = extractMapsSources(generated.data);
  return json(response, 200, {
    plan: answer,
    model: GEMINI_MODEL,
    usedMapsGrounding: sources.length > 0,
    sources
  });
}

// ---------- Gemini ----------

async function generateGeminiPlan(prompt, originLocation) {
  let generated = await callGemini(prompt, originLocation, MAPS_GROUNDING_ENABLED);
  if (!generated.response.ok && MAPS_GROUNDING_ENABLED &&
      [400, 403].includes(generated.response.status)) {
    console.warn("Gemini Maps grounding unavailable; retrying without it.");
    generated = await callGemini(prompt, originLocation, false);
  }
  if (!generated.response.ok) {
    throw upstreamError("Gemini", generated.data, generated.response.status);
  }
  return generated;
}

async function callGemini(prompt, originLocation, useMapsGrounding) {
  const requestBody = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.15, maxOutputTokens: 1400 }
  };
  if (useMapsGrounding) {
    requestBody.tools = [{ googleMaps: {} }];
    if (validCoordinate(originLocation)) {
      requestBody.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: Number(originLocation.latitude),
            longitude: Number(originLocation.longitude)
          }
        }
      };
    }
  }
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
      body: JSON.stringify(requestBody)
    }
  );
  return { response, data: await safeJson(response) };
}

function extractMapsSources(data) {
  const chunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const unique = new Map();
  for (const chunk of chunks) {
    const uri = chunk.maps?.uri;
    if (uri && /^https?:\/\//i.test(uri)) {
      unique.set(uri, {
        title: cleanText(chunk.maps.title, 160) || "Google Maps source",
        url: uri
      });
    }
  }
  return [...unique.values()].slice(0, 8);
}

function parseEndpoint(endpoint, name) {
  const text = cleanText(endpoint?.text, 240);
  if (!text) throw publicError(400, `Select or enter a valid ${name}.`);
  return {
    text,
    location: validCoordinate(endpoint?.location) ? {
      latitude: Number(endpoint.location.latitude),
      longitude: Number(endpoint.location.longitude)
    } : null
  };
}

function coordinateSuffix(location) {
  return validCoordinate(location)
    ? ` (${Number(location.latitude).toFixed(6)}, ${Number(location.longitude).toFixed(6)})`
    : "";
}

// ---------- Nominatim (search + reverse), cached and limited to 1 req/s ----------

async function searchNominatim(query, near) {
  const nearKey = validCoordinate(near)
    ? `${Number(near.latitude).toFixed(2)},${Number(near.longitude).toFixed(2)}`
    : "none";
  const cacheKey = `${query.toLowerCase()}|${nearKey}`;
  const cached = placeCache.get(cacheKey);
  if (cached && Date.now() - cached.savedAt < 10 * 60 * 1000) return cached.value;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "ph");
  url.searchParams.set("limit", "5");
  if (validCoordinate(near)) {
    const latitude = Number(near.latitude);
    const longitude = Number(near.longitude);
    url.searchParams.set(
      "viewbox",
      `${longitude - 0.5},${latitude + 0.5},${longitude + 0.5},${latitude - 0.5}`
    );
    url.searchParams.set("bounded", "0");
  }

  const data = await throttledNominatimFetch(url);
  const places = (Array.isArray(data) ? data : []).map((place) => ({
    id: String(place.place_id),
    label: cleanText(place.display_name, 240),
    location: {
      latitude: Number(place.lat),
      longitude: Number(place.lon)
    }
  })).filter((place) => validCoordinate(place.location) && place.label);

  remember(placeCache, cacheKey, places);
  return places;
}

async function reverseGeocode(latitude, longitude) {
  const cacheKey = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const cached = reverseCache.get(cacheKey);
  if (cached && Date.now() - cached.savedAt < 30 * 60 * 1000) return cached.value;

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("zoom", "18");
  const data = await throttledNominatimFetch(url);
  const parts = cleanText(data?.display_name, 400).split(",").map((part) => part.trim());
  const label = parts.filter(Boolean).slice(0, 4).join(", ") || null;
  remember(reverseCache, cacheKey, label);
  return label;
}

function remember(cache, key, value) {
  cache.set(key, { savedAt: Date.now(), value });
  if (cache.size > 200) cache.delete(cache.keys().next().value);
}

async function throttledNominatimFetch(url) {
  const task = nominatimQueue.then(async () => {
    const waitMs = Math.max(0, 1000 - (Date.now() - lastNominatimRequestAt));
    if (waitMs) await delay(waitMs);
    lastNominatimRequestAt = Date.now();
    const response = await fetch(url, {
      headers: {
        "User-Agent": NOMINATIM_USER_AGENT,
        "Accept": "application/json",
        "Accept-Language": "en"
      }
    });
    const data = await safeJson(response);
    if (!response.ok) throw upstreamError("OpenStreetMap place search", data, response.status);
    return data;
  });
  nominatimQueue = task.catch(() => undefined);
  return task;
}

// ---------- optional Reddit context ----------

async function searchRedditTips(query) {
  if (!redditConfigured()) return [];
  const tokenResponse = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": process.env.REDDIT_USER_AGENT
    },
    body: "grant_type=client_credentials"
  });
  const tokenData = await safeJson(tokenResponse);
  if (!tokenResponse.ok || !tokenData.access_token) throw new Error("Reddit OAuth failed");

  const url = new URL("https://oauth.reddit.com/r/HowToGetTherePH/search.json");
  url.searchParams.set("q", cleanText(query, 140));
  url.searchParams.set("restrict_sr", "1");
  url.searchParams.set("sort", "relevance");
  url.searchParams.set("t", "year");
  url.searchParams.set("limit", "5");
  const searchResponse = await fetch(url, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "User-Agent": process.env.REDDIT_USER_AGENT
    }
  });
  const data = await safeJson(searchResponse);
  if (!searchResponse.ok) throw new Error("Reddit search failed");
  return (data.data?.children || []).map(({ data: post }) => ({
    title: cleanText(post.title, 180),
    excerpt: cleanText(post.selftext, 260),
    url: `https://www.reddit.com${post.permalink}`,
    postedAt: new Date(Number(post.created_utc) * 1000).toISOString().slice(0, 10),
    status: "UNVERIFIED COMMUNITY CONTENT"
  }));
}

function redditConfigured() {
  return Boolean(
    process.env.REDDIT_CLIENT_ID &&
    process.env.REDDIT_CLIENT_SECRET &&
    process.env.REDDIT_USER_AGENT
  );
}

// ---------- helpers ----------

function rateLimit(request, bucket, perHour) {
  if (!perHour || perHour <= 0) return;
  let address = request.socket.remoteAddress || "unknown";
  if (TRUST_PROXY) {
    const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
    if (forwarded) address = forwarded;
  }
  const key = `${bucket}|${address}`;
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((time) => now - time < 3_600_000);
  if (recent.length >= perHour) {
    throw publicError(429, "Too many requests. Please wait a while and try again.");
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.delete(hits.keys().next().value);
}

function setCors(request, response) {
  if (!CORS_ORIGIN) return;
  response.setHeader("Access-Control-Allow-Origin", CORS_ORIGIN);
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Vary", "Origin");
}

function validCoordinate(value) {
  if (value === null || value === undefined) return false;
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  return value.latitude !== null && value.longitude !== null &&
    Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 &&
    Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

function cleanText(value, limit = 300) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

async function safeJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text || "{}");
  } catch {
    return { message: cleanText(text, 240) || `HTTP ${response.status}` };
  }
}

function upstreamError(service, data, status) {
  const detail = data?.error?.message || data?.message || `HTTP ${status}`;
  return publicError(502, `${service} error: ${cleanText(detail, 240)}`);
}

function publicError(statusCode, publicMessage) {
  const error = new Error(publicMessage);
  error.statusCode = statusCode;
  error.publicMessage = publicMessage;
  return error;
}

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 256 * 1024) throw publicError(413, "Request is too large.");
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text || "{}");
  } catch {
    throw publicError(400, "Invalid JSON request.");
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function loadEnvFile() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const equals = trimmed.indexOf("=");
    if (equals < 1) continue;
    const key = trimmed.slice(0, equals).trim();
    const value = trimmed.slice(equals + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}
