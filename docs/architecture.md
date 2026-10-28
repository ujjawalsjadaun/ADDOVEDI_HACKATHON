# Architecture — Golden Hour (PS-04)

**Phase:** 1 · **Status:** frozen for implementation (changes go through [decision-log.md](decision-log.md))

Related: [state-machines.md](state-machines.md) · [data-model.md](data-model.md) · [api-contracts.md](api-contracts.md) · [security.md](security.md)

## 1. Shape

A modular monolith: one React client, one Express API, one MongoDB (Atlas replica set), and in-process background workers. External services sit behind adapters with a simulated implementation that is the default.

```mermaid
flowchart LR
  subgraph Clients
    Public[Public checker / family lead]
    Hospital[Hospital portal]
    Donor[Donor portal]
    Ops[Admin / coordinator portal]
  end
  UI[client: React + TS + Vite + Tailwind]
  API[server: Express + TS<br/>auth · RBAC · Zod validation]
  DB[(MongoDB Atlas<br/>replica set)]
  Workers[workers: outbox sender ·<br/>escalation ladder · expiry]
  Match[matching + assignment]
  Routing[RoutingProvider]
  Weather[WeatherProvider]
  Sms[SmsProvider]
  Clients --> UI --> API
  API -- Socket.IO events --> UI
  API --> DB
  API --> Match --> Routing
  Match --> Weather
  Workers --> DB
  Workers --> Sms
```

REST is authoritative. Socket.IO only signals "something changed"; clients refetch.

## 2. Repository layout (npm workspaces)

```
/
├─ package.json            workspaces: shared, server, client
├─ shared/                 @golden-hour/shared — enums, Zod schemas, DTO types used by both sides
│  └─ src/{enums,schemas,dto}/
├─ server/
│  ├─ src/
│  │  ├─ server.ts         process entry: config → db → http + socket → workers
│  │  ├─ app.ts            Express app factory (testable without listening)
│  │  ├─ config/env.ts     Zod-validated environment; fails fast
│  │  ├─ lib/              errors, http envelope, logger, db/transactions, ids, crypto
│  │  ├─ middleware/       requestId, auth, requireRole, rateLimit, validate, errorHandler
│  │  ├─ modules/
│  │  │  ├─ auth/  users/  hospitals/  donors/
│  │  │  ├─ requests/      create · verify · duplicate review · transitions · public checker
│  │  │  ├─ matching/      filters · ranking · alert batches
│  │  │  ├─ assignments/   atomic claim · lifecycle
│  │  │  ├─ escalation/    ladder evaluation
│  │  │  ├─ notifications/ outbox · templates · webhooks
│  │  │  ├─ geo/           road reports · ETA endpoint · access points
│  │  │  ├─ leads/  transport/  transfers/
│  │  │  ├─ audit/
│  │  │  └─ dev/           demo reset + simulated SMS inbox (never mounted in production)
│  │  ├─ providers/        routing/, weather/, sms/ — interface + simulated + real impls
│  │  ├─ realtime/         Socket.IO auth + room policy + emit helpers
│  │  ├─ workers/          outboxWorker, escalationWorker, expiryWorker
│  │  └─ scripts/          seed.ts, ensure-indexes.ts
│  └─ test/                unit/, integration/, concurrency/ (Vitest + Supertest + mongodb-memory-server replset)
├─ client/
│  └─ src/
│     ├─ main.tsx          React entry
│     ├─ index.css         Tailwind + design tokens + component classes
│     ├─ app/              router, query client, route guards, NotFoundPage
│     ├─ features/<area>/  one folder per area: home, public-checker, auth, hospital, donor,
│     │                    coordinator, admin, maps, notifications
│     ├─ components/
│     │  ├─ layout/        AppLayout, header/footer pieces (ApiStatus, OfflineBanner)
│     │  └─ ui/            reusable primitives + Loading/Empty/Error/Unauthorized states, ComingSoon
│     └─ lib/
│        ├─ api/           fetch client (envelope + error normalisation)
│        ├─ hooks/         generic hooks (useOnlineStatus, …)
│        └─ realtime/      Socket.IO client (Phase 9)
└─ docs/
```

### Folder rules

These keep the structure predictable as phases add code:

| Where | Rule |
| --- | --- |
| `shared/src/` | Only things both sides need: enums, API types, Zod request schemas. No Node or browser APIs. |
| `server/src/modules/<feature>/` | One folder per business feature. Files are named `<feature>.<role>.ts`: `.model.ts` (Mongoose schema), `.service.ts` (business rules, transactions), `.routes.ts` (HTTP wiring: auth, validation, response only), `.dto.ts` (allow-listed serializers), `.policy.ts` (permission checks) when needed. |
| `server/src/middleware/` | Cross-cutting Express middleware only (auth, rate limit, validation, errors). |
| `server/src/lib/` | Framework-level helpers with no business rules (db, errors, http, logger, crypto). |
| `server/src/providers/<kind>/` | `<kind>.provider.ts` interface + one file per implementation (`simulated.ts`, `openMeteo.ts`, …). |
| `server/src/scripts/` | Operator CLI commands run with `npm run <script> -w server` (e.g. `create-admin`). |
| `client/src/features/<area>/` | Pages (`*Page.tsx`), area-only components, and the area's API hooks (`api.ts`). An area never imports another area's internals; move shared pieces to `components/` or `lib/`. |
| `client/src/components/` | Reusable, area-agnostic UI only. |
| Naming | React components `PascalCase.tsx`; everything else `camelCase.ts`; folders `kebab-case`. |

Route handlers never set status fields directly; they call a service which goes through the transition table.

## 3. Core flow (thin vertical slice)

```mermaid
sequenceDiagram
  participant H as Hospital staff
  participant V as Hospital verifier
  participant API
  participant W as Workers
  participant D as Donor
  participant P as Public checker
  H->>API: POST /requests (Idempotency-Key)
  API-->>H: 201 open / verification pending, publicCode
  V->>API: POST /requests/:id/verify (expectedVersion)
  API->>API: re-run duplicate check, rank candidates
  API->>API: tx: status=awaiting_donor, alerts + outbox rows, audit
  W->>D: SMS / in-app alert (simulated by default)
  D->>API: POST /alerts/:id/respond {accept}
  API->>API: tx: conditional slot claim → assignment, audit
  D->>API: assignment en_route → arrived
  H->>API: POST /assignments/:id/donated
  H->>API: POST /requests/:id/fulfill
  API-->>P: GET /public/requests/:code → closed · fulfilled
```

## 4. Transactions and atomicity

Atlas (dev/demo) and `mongodb-memory-server` in replica-set mode (tests) both support multi-document transactions. All critical mutations run inside `withTransaction()` (helper in `lib/db`) and write, in the same transaction:

1. the business document change (conditional on expected state/version),
2. the `auditLogs` record,
3. any `notificationOutbox` rows.

If any step fails, nothing is committed and the client gets an error — an action is never acknowledged without its audit record. Invariants that can be expressed as unique/partial indexes are *also* enforced by index, so correctness does not depend on application-level "find then insert".

## 5. Provider adapters

All live in `server/src/providers/`, selected by environment variable, default `simulated`.

```ts
interface RoutingProvider {
  getEta(from: LatLng, to: LatLng, opts: { timeoutMs: number }): Promise<EtaResult>;
}
type EtaResult =
  | { status: 'ok'; minutes: number; distanceKm: number; source: string;
      calculatedAt: Date; quality: 'live' | 'cached' | 'simulated' }
  | { status: 'rough_estimate'; minutes: number; distanceKm: number; source: 'straight_line';
      calculatedAt: Date; quality: 'rough_estimate' }        // never shown as road ETA
  | { status: 'unavailable'; reason: string; calculatedAt: Date };  // → manualReviewRequired

interface WeatherProvider {
  getConditions(at: LatLng, opts: { timeoutMs: number }): Promise<WeatherResult>;
}
type WeatherResult =
  | { status: 'ok'; rainMmPerHour: number; source: string; observedAt: Date;
      quality: 'live' | 'cached' | 'simulated' }
  | { status: 'unavailable'; reason: string };

interface SmsProvider {
  send(msg: { to: string; body: string; idempotencyKey: string }): Promise<SmsSendResult>;
  verifyWebhook(req: RawRequest): boolean;
}
type SmsSendResult =
  | { status: 'accepted'; providerMessageId: string }      // accepted ≠ delivered
  | { status: 'failed'; errorCode: string; permanent: boolean };
```

| Provider | `simulated` implementation | Real option (optional, later) |
| --- | --- | --- |
| Routing | Deterministic: haversine × hill winding factor (default 1.8) ÷ configured hill speed (default 25 km/h), plus applied road reports. Labelled **simulated**. | OpenRouteService (key) |
| Weather | Deterministic fixture per demo scenario. Labelled **simulated**. | Open-Meteo (keyless) |
| SMS | Writes to a dev inbox collection visible on an admin "Simulated SMS" screen. Never contacts a phone. | Provider adapter behind explicit opt-in |

Every provider call has a timeout (default 4 s) and results are cached (`routeCache`, TTL configurable). Cached results keep their original `calculatedAt`, so the UI can show their age.

## 6. ETA and weather adjustment

`effectiveMinutes = baseMinutes × (1 + rainBand.pct)` where rain bands are configurable:

| Band | Rain (mm/h) | Default delay |
| --- | --- | --- |
| none | < 2.5 | 0 % |
| moderate | 2.5 – 7.6 | +15 % |
| heavy | > 7.6 | +35 % |

If weather is unavailable, the base ETA is used and the result carries `weatherAdjustment: 'unavailable'`. A blocked road report on the route makes the result `unavailable` with reason `reported_closure` unless a coordinator marks it stale or cleared.

## 7. Realtime (Socket.IO)

- Handshake authenticates with the same session cookie as REST; anonymous sockets are refused.
- Rooms are assigned by the **server** on connect: `user:<userId>`, `facility:<facilityId>` (hospital staff), `role:admin`, `role:coordinator`. Clients cannot join arbitrary rooms.
- Events carry only `{ type, id, version, status }`, e.g. `request.updated`, `alert.created`, `assignment.updated`, `notification.updated`. Clients refetch details through REST.
- On reconnect the client refetches every visible resource.

## 8. Workers

Run in the API process on intervals (simple, documented limitation: they stop if the host sleeps). Each tick is idempotent and safe to run concurrently on restart.

| Worker | Interval | Job |
| --- | --- | --- |
| `outboxWorker` | 3 s | Claim due `notificationOutbox` rows with a lease (`lockedUntil`), send via `SmsProvider`, record attempt; retry transient failures with capped exponential backoff + jitter (max 5 attempts); mark permanent failures `failed`. |
| `escalationWorker` | 15 s | For verified, open requests, run due ladder steps (see state-machines.md §5). Each step is a unique `escalationEvents` row — re-running is a no-op. |
| `expiryWorker` | 60 s | Expire alerts past response window; expire requests past deadline; mark unverified requests overdue; stale road reports. |

## 9. Configuration (environment variables)

Validated with Zod at startup in `server/src/config/env.ts`. Server refuses to start if a required value is missing. Exact names:

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NODE_ENV` | no | `development` | `development` \| `test` \| `production` |
| `PORT` | no | `4000` | API port |
| `MONGODB_URI` | yes | — | Atlas connection string (secret) |
| `SESSION_SECRET` | yes | — | ≥ 32 chars; signs session JWT (secret) |
| `PATIENT_REF_SECRET` | yes | — | ≥ 32 chars; HMAC key for patient reference hashes (secret) |
| `SESSION_TTL_HOURS` | no | `8` | Session lifetime |
| `CLIENT_ORIGIN` | no | `http://localhost:5173` | Allowed CORS origin(s), comma-separated |
| `TRUST_PROXY` | no | `false` | Set when behind a reverse proxy |
| `DEMO_MODE` | no | `false` | Enables `/api/dev/*`; forbidden when `NODE_ENV=production` |
| `ROUTING_PROVIDER` | no | `simulated` | `simulated` \| `openrouteservice` |
| `ORS_API_KEY` | if ORS | — | Routing key (secret) |
| `WEATHER_PROVIDER` | no | `simulated` | `simulated` \| `open-meteo` |
| `SMS_PROVIDER` | no | `simulated` | `simulated` only in MVP |
| `PROVIDER_TIMEOUT_MS` | no | `4000` | Per external call |
| `ROUTE_CACHE_TTL_MIN` | no | `30` | Route cache lifetime |
| `ESCALATION_STEPS_MIN` | no | `0,5,10,15` | Ladder offsets from verification |
| `ALERT_BATCH_SIZE` | no | `3` | Donors per alert batch |
| `ALERT_RESPONSE_WINDOW_MIN` | no | `5` | Alert expires if unanswered |
| `DONATION_REST_DAYS` | no | `90` | Minimum days since last donation |
| `CONTACT_COOLDOWN_HOURS` | no | `24` | Skip donors alerted more recently than this |
| `VERIFICATION_DEADLINE_MIN` | no | `30` | Unverified request is flagged overdue to admin |
| `REQUIRE_SEPARATE_VERIFIER` | no | `true` | Creator may not verify their own request |
| `LOG_LEVEL` | no | `info` | Logger level |

Client: `VITE_API_BASE_URL` (public, no secrets; default `/api` via Vite dev proxy).

## 10. Known limitations (by design)

- Workers are in-process; on hosts that sleep, escalation and SMS stop until the process wakes. Recovery on wake is idempotent.
- No real SMS, routing or weather integration is claimed as verified in the MVP; all simulated results are labelled in the UI.
- Not a dispatch service; no ambulance/108 integration; no clinical eligibility decisions.
- Zero-signal operation is impossible; SMS needs cellular coverage.
