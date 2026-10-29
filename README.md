# Golden Hour — PS-04

Hospital-led, location-aware blood-request coordination for hill districts. Verified requests reach the most reachable compatible donors, ranked by road travel time rather than straight-line distance, with fallbacks for weak connectivity.

> **Status:** Phase 12 (release preparation: deployment guide, release checklist, production safeguards) — end-to-end flow (raise → verify → alert ranked donors in-app and by **simulated SMS** → race-safe accept → en route / arrived → donation → hospital-confirmed fulfilment), role dashboards, map and road reports, family leads, transport tasks, stock transfers, live updates over Socket.IO, and **automatic escalation (5/10/15 min), request expiry and an admin "under review" flag**. Travel times use live routing (optional) or a labelled simulation. No real SMS is ever sent.
> All donor, patient and facility data in this project is synthetic. This is not an official dispatch service and makes no medical eligibility decisions.

## Stack

| Workspace | What | Tech |
| --- | --- | --- |
| `shared/` | Enums, API envelope types, Zod schemas used by both sides | TypeScript, Zod 4 |
| `server/` | REST API, workers | Node ≥ 20.19, Express 5, Mongoose 8, Pino |
| `client/` | Web app | React 18, React Router 7, TanStack Query, Tailwind CSS 4, Vite 6 |

Auth: HttpOnly session cookie (signed JWT with server-side revocation), bcrypt password hashing, per-IP+email login rate limit.

## Project structure

```
.
├─ shared/            @golden-hour/shared — enums, Zod schemas and API types used by server and client
│  └─ src/            enums.ts, api.ts, schemas/, dto/
├─ server/            Express API
│  ├─ src/
│  │  ├─ config/      validated environment (env.ts)
│  │  ├─ lib/         db, transactions, indexes, errors, http envelope, validation, logger, geo, crypto
│  │  ├─ middleware/  request id, JSON-only, authenticate, authorize, rate limit, error handler
│  │  ├─ modules/     one folder per feature: health, auth, users, hospitals, admin, audit,
│  │  │               requests, idempotency, public-checker, donors, matching, alerts,
│  │  │               assignments, dashboard, roads, geo, leads, transport, transfers,
│  │  │               notifications (+ models.ts registry)
│  │  ├─ providers/   external-service adapters: routing (simulated, OpenRouteService + cache),
│  │  │               weather (simulated, Open-Meteo), sms (simulated)
│  │  ├─ realtime/    Socket.IO server (cookie auth, server-assigned rooms) + post-commit emitter
│  │  ├─ workers/     outbox (SMS with leases and retries), escalation (ladder steps), expiry
│  │  ├─ scripts/     operator commands (create-admin, db:indexes)
│  │  ├─ types/       Express type augmentation
│  │  ├─ app.ts       Express app factory
│  │  └─ server.ts    process entry
│  └─ .env.example
├─ client/            React web app
│  └─ src/
│     ├─ app/         router, route guard (RequireRole), query client, not-found page
│     ├─ features/    one folder per area: home, auth, public-checker, family-lead, hospital, donor,
│     │               coordinator, admin — plus cross-role requests/, roads/, transport/
│     ├─ components/  layout/ (shell, sub-nav, status footer, offline banner), map/ (Leaflet view),
│     │               ui/ (states, forms, badges, stat cards, data-freshness, ETA)
│     └─ lib/         api/ (fetch client, query strings), realtime/ (Socket.IO provider), hooks/,
│                     format, labels, idempotency
└─ docs/              architecture, contracts, state machines, security, decisions
```

Folder rules (what goes where, file naming) are in [docs/architecture.md §2](docs/architecture.md#2-repository-layout-npm-workspaces).

## Setup

Prerequisites: Node.js 20.19+ (developed on 24.x) and npm.

```bash
npm install                          # installs all three workspaces
cp server/.env.example server/.env   # PowerShell: Copy-Item server/.env.example server/.env
```

Edit `server/.env`:

- `MONGODB_URI` — your MongoDB Atlas connection string (Atlas → Database → Connect → Drivers). Add a database name before the `?`, e.g. `…mongodb.net/golden-hour?retryWrites=true&w=majority`. In Atlas *Network Access*, allow your current IP.
- `SESSION_SECRET` and `PATIENT_REF_SECRET` — two **different** random values of 32+ characters:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```

`server/.env` is git-ignored. Never commit it or paste its values anywhere. Every variable is documented in [docs/architecture.md §9](docs/architecture.md#9-configuration-environment-variables).

Optional live providers (everything works without them, clearly labelled as simulated):

- **Road travel times:** get a free key at openrouteservice.org, then set `ROUTING_PROVIDER=openrouteservice` and `ORS_API_KEY=…`.
- **Weather:** set `WEATHER_PROVIDER=open-meteo` (no key). For a demo without internet, keep `simulated` and set `SIMULATED_RAIN_MM_PER_HOUR` (0 dry, 5 moderate, 10 heavy).

### Quick start: load fictional demo data

```bash
npm run seed -w server
```

Creates (only what is missing, so it is safe to re-run) a fictional "Siang Hills" district: two verified facilities and one pending one, an admin, hospital staff and verifiers, a coordinator, seven donors (alertable, never-donated, resting after a recent donation, last-donation-unknown, and one awaiting verification) and one pending sample request. Every account uses the password printed at the end (`DemoPass#2026!`); sign in as `admin@demo.test`, `staff.a@demo.test`, `verifier.a@demo.test`, `verifier.b@demo.test`, `coord@demo.test` or `donor1@demo.test`…`donor7@demo.test`.

Verification report (flows actually run): [docs/verification-report.md](docs/verification-report.md). Complete feature tour: [WALKTHROUGH.md](WALKTHROUGH.md). Pitch claims versus what is built: [docs/pitch-vs-reality.md](docs/pitch-vs-reality.md). Full click-by-click script: [DEMO.md](DEMO.md). Short version: sign in as `verifier.a@demo.test` and verify the sample request (it was raised by `staff.a`, so a different verifier is allowed) → `donor1`…`donor3` get alerts → sign in as a donor and accept → follow progress as the hospital. The command **refuses to run when `NODE_ENV=production`**, and nothing in it is real data — never reuse that password anywhere real.

### Import a real hospital directory (optional)

The pitch lists public datasets (data.gov.in *Hospital Directory* and *All India Health Centres Directory*). Download the CSV yourself, then:

```bash
npm run import:directory -w server -- path/to/directory.csv --dry-run     # preview
npm run import:directory -w server -- path/to/directory.csv               # Arunachal Pradesh by default
npm run import:directory -w server -- path/to/directory.csv --state "Assam"
```

Facilities are imported as **pending**: an administrator still verifies each one (Admin → Facilities). Rows without usable coordinates are skipped, and rows without a usable phone get the placeholder `+910000000000`, which is listed so the number can be corrected before verifying. The command needs columns for name, district, latitude and longitude (common header spellings are recognised). It is safe to re-run. Donors and patients are never imported: that data is not public, so use the seed command's fictional donors for demos.

### Create the first administrator (without demo data)

There is no public sign-up for administrators or hospital staff. Create the first admin once, after `server/.env` is filled in:

```bash
npm run create-admin -w server     # asks for name, email and password (hidden)
```

Then run the app (below), sign in at http://localhost:5173/login, and:

1. **Admin → Facilities** — add hospitals/blood banks and verify them (every decision needs a reason and is audited).
2. **Admin → Staff accounts** — create hospital staff for a facility (tick *Can verify blood requests* for verifiers) and coordinators.
3. Donors register at http://localhost:5173/register, then complete **My profile** (last donation date or "never", approximate location with consent). **Admin → Donors** verifies them.
4. Sign in as hospital staff → **New request**. A *different* verifier at the same facility verifies it — this alerts the first batch of matching donors.
5. Donors answer under **Alerts & donations**; the hospital follows progress on the request page and confirms arrival, donation and finally fulfilment.
6. Anyone can check the request code at http://localhost:5173/check.
7. Families can ask a hospital to call back at http://localhost:5173/help; staff handle it under **Family leads**. Coordinators take transport tasks under **Transport**; hospitals request stock from each other under **Stock transfers**.

Use fictional names, phone numbers and facilities only.

## Run

```bash
npm run dev        # API on http://localhost:4000 and web app on http://localhost:5173
```

The Vite dev server proxies `/api` to the API, so the browser sees one origin and the session cookie just works. The footer shows live server status; if the database is unreachable the API still starts, reports `degraded` on `/api/health/ready`, and retries the connection every 15 s.

### Run the production build locally (single host)

```bash
npm run build
# in server/.env add:  CLIENT_DIST_DIR=../client/dist
npm start          # API + built web app + live updates on http://localhost:4000
```

The API then serves the web app itself (one origin, no proxy). For internet deployment — Atlas, environment variables, HTTPS, WebSocket and rollback notes — see [docs/deployment.md](docs/deployment.md). In `NODE_ENV=production` the API refuses to start unless `CLIENT_ORIGIN` and `PUBLIC_APP_URL` are `https://`, the two secrets differ, and `DEMO_MODE` is off.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | API + web app with reload |
| `npm run typecheck` | `tsc` in every workspace |
| `npm run lint` | ESLint (flat config) across the repo |
| `npm run build` | server bundle (`server/dist`) and client bundle (`client/dist`) |
| `npm start` | runs the built API (`node server/dist/server.js`) |
| `npm run create-admin -w server` | creates an administrator account interactively |
| `npm run db:indexes -w server` | creates all database indexes (also done automatically when the API connects) |

## API overview (so far)

| Endpoint | Who |
| --- | --- |
| `GET /api/health/live`, `GET /api/health/ready` | anyone |
| `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | anyone / signed in |
| `GET /api/hospitals` | anyone — verified facilities only, no contact details |
| `/api/admin/hospitals` (list, create, get, `POST /:id/verification`) | admin |
| `/api/admin/users` (list, create, `POST /:id/status`) | admin |
| `POST /api/requests` (needs `Idempotency-Key`), `GET /api/requests`, `GET /api/requests/:id` | hospital staff (own facility); admin can list/read all |
| `POST /api/requests/:id/verify` · `reject` · `duplicate-review` · `cancel` · `fulfill` | per-action rules — see `allowedActions` on each request |
| `GET /api/requests/:id/candidates`, `POST /api/requests/:id/alerts/next-batch` | hospital staff (own facility), admin |
| `GET /api/public/requests/:code`, `POST /api/public/reports` | anyone (rate-limited) |
| `POST /api/auth/register-donor` | anyone (rate-limited) |
| `/api/donors/me` (profile, availability, last-donation-unknown, alerts, assignments) | donor |
| `POST /api/alerts/:id/respond` | donor (own alerts) |
| `POST /api/assignments/:id/status` · `confirm-arrival` · `donated` · `no-show` | donor (own) / hospital staff (own facility) |
| `/api/admin/donors` (list, `/:userId/verification`, `/:userId/review`) | admin |
| `GET /api/dashboard/hospital` | hospital staff |
| `GET /api/dashboard/coordinator` | coordinator, admin |
| `GET /api/admin/overview`, `GET /api/admin/audit`, `/api/admin/suspicious-reports` (list, `/:id/review`) | admin |
| `GET /api/geo/map`, `/api/road-reports` (list, create, `/:id/verification`) | hospital staff, coordinator, admin (verification: coordinator, admin) |
| `POST /api/hospitals/:id/access-point` | hospital staff (own facility), coordinator, admin |
| `POST /api/family-leads` | anyone (rate-limited, `Idempotency-Key`) |
| `/api/family-leads` (list, `/:id/confirm`, `/:id/reject`) | hospital staff (own facility) |
| `/api/transport-tasks` (list, create, `/:id/status`) | hospital staff, coordinator, admin (per-action rules) |
| `/api/stock-transfers` (list, create with `Idempotency-Key`, `/:id/status`) | hospital staff |
| `/api/admin/notifications` (list, `/health`, `/:id/retry`) | admin |
| `GET /api/admin/escalations`, `POST /api/requests/:id/review-flag` | admin |
| Socket.IO at `/socket.io` — event `change { topic, id }` | signed-in users (rooms assigned by the server) |

Full contracts: [docs/api-contracts.md](docs/api-contracts.md).

## Documentation

- [Deployment guide](docs/deployment.md)
- [Release go / no-go checklist](docs/release-checklist.md)
- [Code review and known limitations](docs/security-review.md)
- [Repository audit](docs/repository-audit.md)
- [Requirements traceability](docs/requirements-traceability.md)
- [Architecture](docs/architecture.md)
- [State machines](docs/state-machines.md)
- [Data model](docs/data-model.md)
- [API contracts](docs/api-contracts.md)
- [Security, privacy and abuse controls](docs/security.md)
- [Decision log](docs/decision-log.md)

## Known limitations (current phase)

- SMS is **simulated**: messages appear under **Admin → Notifications** (numbers masked) and are never sent to a phone. "Sent" means the provider accepted it; there is no delivery receipt, and YES/NO replies by SMS are not supported yet. Set `SIMULATED_SMS_FAILURE_RATE=0.3` to watch retries.
- The outbox worker and Socket.IO run inside the API process: if the host sleeps they pause (pending messages resume on wake), and one process only (no multi-instance scaling).
- Without an ORS key, travel times are a labelled **simulation** (straight line × 1.8 at 25 km/h). "Near the route" for road reports is a 2 km corridor around the straight line, not the real road.
- Map tiles come from openstreetmap.org (needs internet; respect the OSM tile usage policy for heavy use).
- Escalation (ladder steps from `ESCALATION_STEPS_MIN`, default 5/10/15 min after verification) widens the donor search, then advises the hospital and queues the request for administrators (**Admin → Escalations**). It never contacts outside parties automatically. Like the other workers it runs inside the API process and pauses if the host sleeps.
- Transactions: on a standalone local MongoDB the API falls back to non-transactional writes (atomic audit/outbox guarantees need a replica set such as Atlas); unique indexes still protect the key invariants.
- Family leads have no phone-number verification (OTP) yet; they stay pending and can never alert donors regardless. The family is not notified automatically when a lead is confirmed or rejected — staff call back.
- Transport is single-leg (no relay handovers); stock transfers have no live inventory feed.
- Requests past their deadline are closed as *expired* by the expiry worker (within about a minute), which also expires unanswered alerts and unanswered family leads and redacts contact details of decided leads after 30 days.
- Rate limits are kept in memory, so they reset when the API restarts and are per-process.
- Automated tests are out of scope from Phase 3 (decision D-26); each phase is verified manually.
- `npm audit` reports one low-severity esbuild advisory (GHSA-g7r4-m6w7-qqqr) via `tsup`. It affects esbuild's own `serve` mode, which tsup does not use (D-19).
