# 🌍 Wanderworld

A joyful browser game where you roam a colorful interactive Earth, **step into real
countries** and fill a photo album with **50 real snapshots of the world**.

Built with React + Vite + TypeScript, Tailwind CSS, Zustand, globe.gl (three.js),
D3-geo, the Google Maps JavaScript API, and optional Supabase.

> ### 🆓 Free to run and free to deploy — no card, no paid keys
> Wanderworld is **fully playable with zero API keys and zero cost.** With no
> Google Maps key, "GO!" mode explores real landmark photographs from Wikimedia
> Commons instead of Street View — the globe, all three world maps, live country
> facts, the camera, and the photo album all work exactly the same. You can ship
> a public link on a free host (see [Deploying](#deploying-a-public-link)) without
> ever entering payment details. The Google Maps key is an **optional upgrade**
> you can add later to unlock walkable Street View.

---

## Quick start

```bash
npm install
cp .env.example .env    # then fill in your keys (all optional — see below)
npm run dev             # → http://localhost:5173
```

That's it. **The game is fully playable with an empty `.env`** — without a Google
Maps key, "GO!" mode gracefully falls back to exploring real landmark photos from
Wikimedia Commons instead of Street View.

### 🚶 Unlock the real walkable Street View (5 minutes, free)

The headline experience — steering your explorer through real Google Street View,
walking panorama-to-panorama like a travel game — needs one free API key:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create
   a project (or pick an existing one).
2. **APIs & Services → Enable APIs** → enable **Maps JavaScript API** and
   **Street View Static API**.
3. **APIs & Services → Credentials → Create credentials → API key**. Copy it.
4. Enable **Billing** on the project (Google requires a card, but gives a large
   free monthly quota — casual play stays well within it). Then, recommended:
   restrict the key to your domain (HTTP referrers) and to those two APIs.
5. Paste it into `.env`:
   ```
   VITE_GOOGLE_MAPS_API_KEY=your_key_here
   ```
6. Restart `npm run dev`. Now **GO!** drops you into live Street View: `W`/`S` walk,
   `A`/`D` turn, hold `R` to run, drag to look, `C` to photograph — with your
   explorer visible in third person, walking the real street.

Your explorer character, the album, filters, and the whole world map all work
with or without the key — the key only swaps the photo-fallback for the real
walkable Street View.

## How to play

1. **Sign in** with a nickname and pick one of 8 original Wanderworld explorers —
   full-body traveller figures you'll steer through the world in third person.
2. **Pick a country** in one of three world views (toggle in the header):
   - 🌍 **Globe** — rotatable/zoomable 3D Earth, every country tinted its own color
   - 🗺️ **Map** — flat D3 choropleth with labels and horizontal panning
   - ✨ **Astro** — a circular star-chart: countries as glowing constellations,
     one star per country, constellation lines between neighbors. Drag to spin the wheel!
3. **Read the country panel** — capital, flag, live population, live weather +
   current season, today's leaders, famous landmarks, native wildlife, signature
   dishes, and the national anthem. All fetched live (see Data sources).
4. **Hit GO!** to land inside the country in Google Street View (or photo mode).
5. **Take photos** 📸 with three camera styles — Modern HD, Vintage, Retro B&W.
6. **Collect 50 photos** → 🏆 *"You've seen the world!"* celebration.

### Controls

| Where | Keys |
|---|---|
| Globe / Map / Astro | `Z` zoom in · `X` zoom out · drag to rotate/pan/spin · click a country |
| Street View | `W`/`S` walk forward/back · `A`/`D` turn · hold `R` to run · drag mouse to look · `V` first/third person · `C` capture photo · `M` expand mini-map · `Esc` exit |
| Photo mode | `A`/`D` wander between landmarks · `C` capture · `V` view toggle · `Esc` exit |

## Environment variables

All secrets live in `.env` (never committed — see `.env.example`):

| Variable | Required? | What it unlocks |
|---|---|---|
| `VITE_GOOGLE_MAPS_API_KEY` | Optional | Live Street View + Google mini-map + Street View photo capture. Create a key in [Google Cloud Console](https://console.cloud.google.com/) with **billing enabled** and enable **Maps JavaScript API** and **Street View Static API**. Without it, GO! mode uses real Wikimedia landmark photos. |
| `VITE_SUPABASE_URL` | Optional | Shared "Explorers" list + photo leaderboard. |
| `VITE_SUPABASE_ANON_KEY` | Optional | (goes with the URL above) |

> 🔐 Restrict your Google Maps key to your deployed domain (HTTP referrer
> restriction) before sharing a public link.

### Supabase setup (optional, free tier)

Create a project at [supabase.com](https://supabase.com), then run this in the SQL editor:

```sql
create table explorers (
  id uuid primary key,
  nickname text not null,
  avatar_id text not null default 'fox',
  photos_count int not null default 0,
  countries_count int not null default 0,
  updated_at timestamptz not null default now()
);

alter table explorers enable row level security;
create policy "public read"  on explorers for select using (true);
create policy "public write" on explorers for insert with check (true);
create policy "public update" on explorers for update using (true);
```

Copy the project URL + anon key into `.env`. (This is a friendly nickname
leaderboard, not an auth system — don't store anything sensitive in it.)

## Data sources — 100% real, fetched live

Wanderworld never invents facts. Every field is fetched from a real source at
click time; anything missing shows **"Data unavailable"**.

| Data | Source |
|---|---|
| Country facts (capital, languages, currency, area, borders…) | [`world-countries`](https://www.npmjs.com/package/world-countries) — the open [mledoze/countries](https://github.com/mledoze/countries) dataset (ODbL), bundled at build time |
| Flags | [FlagCDN](https://flagcdn.com) (real flag imagery) |
| Live population, heads of state/government (P35/P6), anthem + capital coordinates | [Wikidata SPARQL](https://query.wikidata.org) |
| Weather right now | [Open-Meteo](https://open-meteo.com) (no key needed) |
| Season | Derived from today's date + hemisphere (capital latitude) |
| Country & wildlife descriptions | [Wikipedia REST summaries](https://en.wikipedia.org/api/rest_v1/) |
| Landmarks (with coordinates + photos) | Wikidata SPARQL + Wikimedia Commons |
| Endemic animals & plants, signature dishes/drinks | Wikidata SPARQL |
| National anthem recordings | Wikimedia Commons (free-licensed/public-domain) — otherwise we link out to the anthem's Wikipedia article |
| Street imagery | **Live Google Street View** — always labeled in-app as real Google imagery, © Google |

> **Why not REST Countries?** The original brief called for
> `restcountries.com/v3.1/all`, but REST Countries shut down its keyless
> v1–v4 endpoints in 2026 (v5 requires an account + API key). We use the same
> underlying open dataset (`mledoze/countries`) for static facts and Wikidata
> for the live fields, which keeps the app key-free and the data real.
> **In-demand jobs** per country had no reliable free live source, so per the
> "real data or omit" rule, that field is omitted.

### Politeness & resilience

- Wikidata responses are cached in `sessionStorage` (6h TTL), queries are
  deduplicated + concurrency-limited, and 429s honor `Retry-After`.
- Every panel section has its own loading skeleton and failure fallback.
- Photos are stored locally in IndexedDB; nothing is uploaded anywhere
  (Supabase only receives your nickname, avatar id and photo/country *counts*).

## Deploying a public link

The app is a static Vite build — any static host works.

### Vercel (recommended)

1. Push this repo to GitHub.
2. [vercel.com](https://vercel.com) → sign in with GitHub (free **Hobby** plan,
   no card) → **Add New → Project** → import the repo. Vercel auto-detects Vite
   (build `npm run build`, output `dist`) — accept.
3. **Environment variables are optional.** Leave them empty for a free public
   link that runs in Wikimedia photo mode. Later, if you want walkable Street
   View, add `VITE_GOOGLE_MAPS_API_KEY` under **Settings → Environment Variables**
   and redeploy.
4. **Deploy** → you get `https://your-project.vercel.app`. (If you add a Google
   Maps key later, restrict it to that domain under HTTP referrers.)

CLI alternative: `npm i -g vercel && vercel --prod`.

### Netlify

1. [netlify.com](https://netlify.com) → **Add new site → Import an existing project**.
2. Build command `npm run build`, publish directory `dist`.
3. Add the same environment variables under **Site configuration → Environment variables**, deploy.

(No SPA redirect rules are needed — the app has no client-side routes.)

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server with HMR |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Serve the production build locally |

## Honesty & licensing notes

- Street View is **real Google imagery of the real world**, labeled as such
  in-app — Wanderworld does not pretend it's a rendered game world.
- All explorer characters are **original Wanderworld figures** (hand-drawn,
  procedurally animated SVG — a real walk/run/photo gait, seen in third person).
  No Marvel/Disney/etc. characters — that's copyrighted material we can't use;
  if you want a specific branded character, we can add an original look-alike.
- The third-person character is a polished overlay on top of Street View's real
  photography. It walks *through* the scene as you move panorama to panorama; it
  isn't depth-composited behind real-world objects (Street View exposes no depth
  data for that), so treat it as your on-screen adventurer, not a physical actor
  in the photo.
- All sound effects are synthesized in the browser with WebAudio — no audio assets.
- Country dataset: ODbL (mledoze/countries). Landmark/wildlife/dish photos:
  Wikimedia Commons (various free licenses — each image links back to its source).

## Project structure

```
src/
  App.tsx                  app shell: header, view switcher, overlays
  store/gameStore.ts       Zustand store (player, photos, visited, UI state)
  lib/
    countries.ts           bundled country dataset + formatting
    worldGeo.ts            TopoJSON features + adjacency (shared by all maps)
    colors.ts              deterministic per-country tint
    wikidata.ts            SPARQL client (cache/throttle/retry) + queries
    wikipedia.ts           REST summary client
    weather.ts             Open-Meteo + season derivation
    googleMaps.ts          key-gated Maps loader + panorama finder
    capture.ts             canvas photo pipeline (filters, polaroid, IndexedDB)
    supabase.ts            env-guarded explorers client
    avatars.tsx            8 original explorer characters (portrait + animated walk)
    sfx.ts                 WebAudio sound effects
  components/
    Landing.tsx            nickname + avatar picker
    GlobeView.tsx          3D globe (globe.gl)
    FlatMapView.tsx        D3 choropleth
    AstroMapView.tsx       star-chart constellation map
    CountryPanel.tsx       live country detail panel + GO!
    StreetViewMode.tsx     Street View core + photo-mode fallback + HUD
    Album.tsx              polaroid album + progress
    ExplorersPanel.tsx     shared player list / leaderboard
    Celebration.tsx        50-photo confetti finale
```
