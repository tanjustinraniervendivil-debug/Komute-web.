# Komute Web

A website version of the Komute Android app (Version 14): pick Point A and Point B,
press **Find routes**, and Komute AI writes commute options and beginner guidelines.

Same screens, colors, text and flow as the app: Plan, AI commute plan, Saved, Guide.
Light and dark mode follow the visitor's device.

## Run it

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env`, then fill in:
   - `NOMINATIM_USER_AGENT` — replace `your_email@example.com` with a real contact email
   - `GEMINI_API_KEY` — your Gemini key (without it the site works, but AI plans show an error)
3. In this folder run:

   ```
   npm start
   ```

4. Open http://localhost:8080

`http://localhost:8080/health` shows whether the key was picked up (`aiConfigured: true`).

## What is in the folder

| Path | Purpose |
| --- | --- |
| `public/index.html`, `styles.css`, `app.js` | The whole website (plain HTML, CSS, JavaScript; no build step) |
| `public/config.js` | Set `KOMUTE_API_BASE_URL` only if the site and API are on different domains |
| `server.mjs` | Node server: serves `public/` and the API (`/api/places`, `/api/reverse`, `/api/commute-plan`) |
| `.env.example` | Settings template (never upload your real `.env`) |

The Gemini key and the hidden planning prompt stay on the server; the browser only
sends the two endpoints, their coordinates and the New Commuter Mode setting.

## Putting it online

Host the whole folder on any Node host (Render, Railway, Fly.io, a VPS) with
`npm start` as the start command, and add the `.env` values as environment variables.
Set `TRUST_PROXY=true` if the host puts a proxy in front of the app, so the
per-visitor rate limit uses the real visitor address.

Use **https**: browsers only allow the live-location feature on secure pages
(http://localhost is the exception).

The site needs the public internet for the map library (unpkg), map tiles
(OpenFreeMap), place search (Nominatim) and Gemini.

## Differences from the Android app

- Location comes from the browser (it asks permission when you press **Allow**, or
  automatically if already granted) instead of Android's fused location.
- Address lookup for the blue dot and map pins goes through a new `/api/reverse`
  endpoint (Nominatim) instead of Android's Geocoder.
- Visitors are limited per hour (`PLAN_LIMIT_PER_HOUR`, `PLACE_LIMIT_PER_HOUR`) so a
  public site cannot drain your Gemini quota.
- The app's Navigation and Route-card screens are not included: Version 14 never
  reaches them (Find routes goes straight to the AI plan), and the offline demo
  routes were replaced by the AI plan.

AI output is guidance, not live navigation. Always verify signs, stops, fares and
schedules before boarding.
