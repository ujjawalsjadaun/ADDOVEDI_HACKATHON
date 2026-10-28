# Golden Hour — PS-04

Hospital-led, location-aware blood-request coordination for hill districts. Verified requests reach the most reachable compatible donors, ranked by road travel time rather than straight-line distance, with fallbacks for weak connectivity.

> **Status:** Phase 3 — sign-in, server-side roles and facility scoping, admin management of facilities and staff accounts. Blood-request workflows are not built yet.
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
│  │  ├─ modules/     one folder per feature: health, auth, users, hospitals, admin, audit (+ models.ts registry)
│  │  ├─ scripts/     operator commands (create-admin, db:indexes)
│  │  ├─ types/       Express type augmentation
│  │  ├─ app.ts       Express app factory
│  │  └─ server.ts    process entry
│  └─ .env.example
├─ client/            React web app
│  └─ src/
│     ├─ app/         router, route guard (RequireRole), query client, not-found page
│     ├─ features/    one folder per area: home, auth, public-checker, hospital, donor, coordinator, admin
│     ├─ components/  layout/ (shell, status footer, offline banner) and ui/ (states, form fields, badges)
│     └─ lib/         api/ (fetch client) and hooks/
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

### Create the first administrator

There is no public sign-up for administrators or hospital staff. Create the first admin once, after `server/.env` is filled in:

```bash
npm run create-admin -w server     # asks for name, email and password (hidden)
```

Then run the app (below), sign in at http://localhost:5173/login, and:

1. **Admin → Facilities** — add hospitals/blood banks and verify them (every decision needs a reason and is audited).
2. **Admin → Staff accounts** — create hospital staff for a facility (tick *Can verify blood requests* for verifiers) and coordinators.

Use fictional names, phone numbers and facilities only.

## Run

```bash
npm run dev        # API on http://localhost:4000 and web app on http://localhost:5173
```

The Vite dev server proxies `/api` to the API, so the browser sees one origin and the session cookie just works. The footer shows live server status; if the database is unreachable the API still starts, reports `degraded` on `/api/health/ready`, and retries the connection every 15 s.

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

Full contracts: [docs/api-contracts.md](docs/api-contracts.md).

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

- Blood requests, donors, matching and alerts are not built yet — the Hospital area shows facility status only; Donor and Coordinator areas are placeholders.
- Donor self-registration arrives with donor profiles in Phase 5.
- Rate limits are kept in memory, so they reset when the API restarts and are per-process.
- Automated tests are out of scope from Phase 3 (decision D-26); each phase is verified manually.
- `npm audit` reports one low-severity esbuild advisory (GHSA-g7r4-m6w7-qqqr) via `tsup`. It affects esbuild's own `serve` mode, which tsup does not use (D-19).
