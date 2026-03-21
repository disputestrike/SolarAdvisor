# ☀ SolarAdvisor

**Full-stack solar lead generation and management platform.**

Captures, scores, and routes solar leads through a 5-step conversion funnel with real-time estimates, $0-down financing options, SMS/email drip sequences, partner webhook delivery, and a full admin dashboard.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Database | MySQL (Railway plugin) |
| ORM | Drizzle ORM + raw mysql2 helpers |
| SMS | Twilio |
| Email | Nodemailer (SMTP) |
| Auth | JWT + bcrypt |
| Validation | Zod v3 |
| Tests | Jest + ts-jest (113 tests) |
| Deploy | Railway (Nixpacks) |

---

## Quick Start (Local)

```bash
git clone https://github.com/disputestrike/SolarAdvisor.git
cd SolarAdvisor
npm install
cp .env.example .env.local   # fill in MySQL credentials
mysql -h localhost -P 3306 -u root -p solaradvisor < migrate.sql
node scripts/seed-admin.mjs
npm run dev
```

Open http://localhost:3000

---

## Deploy to Railway

1. New Project → Add MySQL plugin
2. New Service → Deploy from GitHub → `disputestrike/SolarAdvisor`
3. **Link MySQL to the web service** so Railway injects `DATABASE_URL` / `MYSQL_URL` (or set `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` manually). The app reads **`DATABASE_URL`** / **`MYSQL_URL`** first, then split variables.
4. **Database migrations (MySQL)**  
   - On each deploy, **`scripts/start-standalone.cjs` runs `migrate.sql` automatically** when any DB env var is present (unless `SKIP_DB_MIGRATE=1`). Uses `CREATE TABLE IF NOT EXISTS`, so it is safe to repeat.  
   - **Manual / troubleshooting:** `npm run db:migrate` or paste `migrate.sql` into Railway → MySQL → **Query**.  
   - **Existing database** missing address columns: run **`migrate_lead_address_utility.sql`** once so `POST /api/leads` does not 500 (“Unknown column”).
5. Set remaining env vars from `.env.example` (including `NEXT_PUBLIC_GOOGLE_MAPS_KEY` for Places + satellite). **`npm run start`** uses `scripts/start-standalone.cjs`, which forces **`HOSTNAME=0.0.0.0`** because Railway sets `HOSTNAME` to the container ID and Next would otherwise bind only there (healthchecks then fail). **`next.config.js`** sets **`images.unoptimized: true`** so standalone builds do not require the native **`sharp`** binary (keeps `npm ci` + Railway Nixpacks reliable).
6. Seed admin: `node scripts/seed-admin.mjs admin@yourdomain.com "Password123!"`
7. Railway auto-deploys on push to `main` (no separate “push to Railway” step if GitHub integration is connected)

**Troubleshooting — `npm ci` / “Missing: sharp from lock file”:**  
That error is from a **deploy that still had `sharp` in `package.json` without a matching `package-lock.json`**. Current `main` **does not** depend on `sharp` (see `images.unoptimized` in `next.config.js`). In Railway → **Deployments**, open the latest build and confirm the commit is **`b2d0c3e` or newer** (or **Redeploy** from the latest `main`). Old failed rows in the history will still show the old log.

---

## Funnel Flow

```
Homepage → ZIP → Qualify → Estimate → Contact → Thank You
                                ↓
                     Lead Score (0–100 pts)
                                ↓
               hot (≥75) | medium (45-74) | cold (<45)
                                ↓
              SMS + Email + Partner Webhook + Drip Sequence
```

### Scoring Model

| Factor | Points |
|---|---|
| Homeowner | +30 (gating factor) |
| Bill ≥ $300/mo | +30 |
| Bill $200–299 | +25 |
| Bill $150–199 | +20 |
| Bill $100–149 | +12 |
| Roof: medium/low pitch | +20 |
| No shading | +10 |
| Decision maker | +15 |
| Premium incentive state | +10 |

Lead value: Hot=$150 · Medium=$75 · Cold=$25

---

## API Reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/leads` | — | Submit lead |
| GET | `/api/leads?email=` | — | Duplicate check |
| GET | `/api/leads/zip?zip=` | — | ZIP lookup |
| GET | `/api/admin/leads` | Cookie | Lead list + stats |
| PATCH | `/api/admin/leads` | Cookie | Update lead |
| POST | `/api/admin/auth` | — | Login |
| DELETE | `/api/admin/auth` | Cookie | Logout |
| GET | `/api/health` | — | Health probe |

---

## Tests

```bash
npm test                                              # 113 unit tests
npm run test:coverage                                 # + coverage report
node tests/load-chaos.mjs http://localhost:3000       # load + chaos
node tests/load-chaos.mjs https://your-app.railway.app
```

---

## Admin

- URL: `/admin`
- Default: `admin@solaradvisor.com` / `Admin@Solar2024!`
- **Change password immediately after first login**

---

## Integration Points

| System | Role |
|---|---|
| Apex AI (virtual call center) | Receives hot leads via webhook |
| Omni AI (ad platform) | Retargeting on medium/cold leads |
| Florida Sales Academy | Human closers work scored lead packets |

Webhook payload is HMAC-SHA256 signed. Set `PARTNER_WEBHOOK_URL` + `PARTNER_WEBHOOK_SECRET`.

---

© DisputeStrike / SunWave Gov LLC — Proprietary

---

## New Features (v1.1)

### AI Photo-Realistic Images
Powered by **Google Vertex AI Imagen** (primary) with **Hugging Face SDXL** fallback. Generates photo-realistic images of homes with solar panels, happy homeowners, and aerial views — all specific to the solar context.

- Route: `GET /api/images?type=hero_home_panels`
- Types: `hero_family`, `hero_home_panels`, `roof_overlay`, `savings_couple`, `installer_working`, `neighborhood_solar`, `testimonial_home`
- Falls back to high-quality CSS/SVG scenes when API keys not configured

**Setup:**
```
GOOGLE_CLOUD_PROJECT_ID=your-project
GOOGLE_CLOUD_ACCESS_TOKEN=ya29.xxx   # gcloud auth print-access-token
# OR
HUGGING_FACE_TOKEN=hf_xxx            # free at huggingface.co
```

### Satellite Roof Overlay
Uses **Google Maps Static API** + **Google Solar API** to fetch real satellite imagery of any US address and overlay an animated solar panel layout.

- Route: `GET /api/satellite?zip=78701&panels=20`
- Returns: satellite image URL, roof area (m²), annual sunshine hours, panel layout SVG
- Falls back to illustrated aerial view when no Google key configured
- Interactive demo on homepage — any ZIP, adjustable panel count

**Setup:** Add `NEXT_PUBLIC_GOOGLE_MAPS_KEY` (enable Maps Static API + Solar API in Google Cloud Console)

### Live Chat + Instant Quote Widget
Floating chat widget on all pages. Powered by **Claude Haiku** for streaming AI responses. Falls back to a rule-based instant quote engine (no API key required).

- Route: `POST /api/chat` (streaming)
- Calculates instant savings quotes from just a monthly bill number
- Quick-question chips, streaming responses, unread badge, proactive bubble after 8s
- Full conversation history context

**Setup:** Add `ANTHROPIC_API_KEY` for AI responses, or works immediately with built-in rule engine.
