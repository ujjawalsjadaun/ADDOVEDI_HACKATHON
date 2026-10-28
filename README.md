# Golden Hour — PS-04

Hospital-led, location-aware blood-request coordination for hill districts. Verified requests reach the most reachable compatible donors, ranked by road travel time rather than straight-line distance, with fallbacks for weak connectivity.

> **Status:** Phase 2 — app shell, validated configuration and health endpoints. Emergency workflows are not built yet.
> All donor, patient and facility data in this project is synthetic. This is not an official dispatch service and makes no medical eligibility decisions.

## Stack

| Workspace | What | Tech |
| --- | --- | --- |
| `shared/` | Enums, API envelope types, Zod schemas used by both sides | TypeScript, Zod 4 |
| `server/` | REST API, workers | Node ≥ 20.19, Express 5, Mongoose 8, Pino |
| `client/` | Web app | React 18, React Router 7, TanStack Query, Tailwind CSS 4, Vite 6 |

Tests: Vitest 5, Supertest, Testing Library, `mongodb-memory-server` (single-node replica set, so transactions work as on Atlas).

## Project structure

```
.
├─ shared/            @golden-hour/shared — enums + API types used by server and client
│  └─ src/
├─ server/            Express API
│  ├─ src/
│  │  ├─ config/      validated environment (env.ts)
│  │  ├─ lib/         db, errors, http envelope, logger
│  │  ├─ middleware/  request id, JSON-only, error handler
│  │  ├─ modules/     one folder per feature (health/, then auth/, requests/, …)
│  │  ├─ app.ts       Express app factory
│  │  └─ server.ts    process entry
│  └─ .env.example
├─ client/            React web app
│  └─ src/
│     ├─ app/         router, query client, not-found page
│     ├─ features/    one folder per area: home, public-checker, hospital, donor, coordinator, admin
│     ├─ components/  layout/ (shell, status footer, offline banner) and ui/ (shared states)
│     └─ lib/         api/ (fetch client) and hooks/
└─ docs/              architecture, contracts, state machines, security, decisions
```

Folder rules (what goes where, file naming) are in [docs/architecture.md §2](docs/architecture.md#2-repository-layout-npm-workspaces).

## Setup

Prerequisites: Node.js 20.19+ (developed on 24.x) and npm. No local MongoDB is needed for tests.

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

## Run

```bash
npm run dev        # API on http://localhost:4000 and web app on http://localhost:5173
```

The Vite dev server proxies `/api` to the API, so the browser sees one origin. The footer shows live server status; if the database is unreachable the API still starts, reports `degraded` on `/api/health/ready`, and retries the connection every 15 s.

## Checks

| Command | What it does |
| --- | --- |
| `npm run typecheck` | `tsc` in every workspace |
| `npm run lint` | ESLint (flat config) across the repo |
| `npm test` | server unit + integration tests, client component tests |
| `npm run build` | server bundle (`server/dist`) and client bundle (`client/dist`) |
| `npm start` | runs the built API (`node server/dist/server.js`) |

The first `npm test` downloads a MongoDB binary for `mongodb-memory-server` (≈100 MB, cached afterwards).

## API health

- `GET /api/health/live` → `200 { data: { status: "ok" } }`
- `GET /api/health/ready` → `200` when the database answers, `503` with `status: "degraded"` when it does not. Also reports whether routing/weather/SMS are `simulated`.

## Documentation

- [Repository audit](docs/repository-audit.md)
- [Requirements traceability](docs/requirements-traceability.md)
- [Architecture](docs/architecture.md)
- [State machines](docs/state-machines.md)
- [Data model](docs/data-model.md)
- [API contracts](docs/api-contracts.md)
- [Security, privacy and abuse controls](docs/security.md)
- [Decision log](docs/decision-log.md)

## Known limitations (current phase)

- No authentication or emergency workflows yet — the Hospital, Donor, Coordinator and Admin areas are placeholders.
- `npm audit` reports one low-severity esbuild advisory (GHSA-g7r4-m6w7-qqqr) via `tsup`. It affects esbuild's own `serve` mode, which tsup does not use. Tracked in the decision log (D-19).
