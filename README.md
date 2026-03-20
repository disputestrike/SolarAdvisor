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
3. Set all env vars from `.env.example` in Railway dashboard
4. Run migration: paste `migrate.sql` into Railway MySQL console
5. Seed admin: `node scripts/seed-admin.mjs admin@yourdomain.com "Password123!"`
6. Railway auto-deploys on push to `main`

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
