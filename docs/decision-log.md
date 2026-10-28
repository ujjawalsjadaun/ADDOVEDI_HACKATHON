# Decision Log — Golden Hour (PS-04)

Each entry: decision, why, and whether it needs review by a domain partner before any real use. "Clinical review" items are configurable and must be confirmed by a hospital/blood-bank partner; the defaults are engineering placeholders, not medical advice.

| ID | Date | Decision | Why | Review needed |
| --- | --- | --- | --- | --- |
| D-01 | 2026-10-29 | Greenfield npm-workspaces monorepo: `shared`, `server`, `client`. | Empty repo; npm is the only package manager installed; shared Zod schemas keep API contracts in sync. | — |
| D-02 | 2026-10-29 | MongoDB Atlas free tier for dev/demo; `mongodb-memory-server` replica set for tests. All critical mutations use transactions. | No local MongoDB/Docker. Atlas is a replica set, so transactions are available (resolves blueprint A8). | — |
| D-03 | 2026-10-29 | Commits go directly to `main`, one or more per phase at a passing gate; the user runs commits. | User decision. | — |
| D-04 | 2026-10-29 | Request status uses a single terminal `closed` with mandatory `closure.reason` (`fulfilled`, `cancelled`, `rejected`, `expired`, `duplicate`) instead of separate `fulfilled`/`cancelled`/… states followed by `closed`. | The blueprint's `Fulfilled → Closed` step carries no extra information; one terminal state with a reason enforces "closure requires a reason" structurally. | — |
| D-05 | 2026-10-29 | Public code stored in plain form (unique), 40-bit random, rate-limited. | It travels in SMS/forwards, so it is a lookup handle, not a bearer secret; hashing would prevent re-displaying it to the hospital. Reveals only public-safe status. | — |
| D-06 | 2026-10-29 | `en_route` / `arrived` live on **assignments**, not on the request. Request has `awaiting_donor` / `donors_assigned`. | A request may need several units = several donors with independent progress. | — |
| D-07 | 2026-10-29 | One role per user account (+ `canVerifyRequests` flag for hospital staff). | Simplest correct RBAC for the MVP. | — |
| D-08 | 2026-10-29 | Blood-group rule: **exact match by default**; hospital can tick `acceptCompatibleGroups` per request to use the standard ABO/Rh red-cell compatibility table. | Puts the clinical choice with the hospital, per request. | **Clinical review** |
| D-09 | 2026-10-29 | Donation rest period `DONATION_REST_DAYS = 90` (pitch). Unknown last-donation date → excluded from automatic alerts, listed for manual review. | Pitch-confirmed value; never assume eligibility. | **Clinical review** |
| D-10 | 2026-10-29 | One donor = one unit = one slot. `unitsRequested` 1–6. | Makes the concurrency invariant enforceable with a partial unique index per slot. | Partner review |
| D-11 | 2026-10-29 | `REQUIRE_SEPARATE_VERIFIER=true` by default (creator cannot verify own request). Seed data provides a separate verifier account. | Stronger "verified request" guarantee; can be turned off for single-staff facilities. | Partner review |
| D-12 | 2026-10-29 | Escalation ladder `0,5,10,15` minutes (pitch defaults), configurable; idempotent via unique `escalationEvents(requestId, step)`. | Pitch-confirmed. | Partner review |
| D-13 | 2026-10-29 | All providers (routing, weather, SMS) default to `simulated` and are labelled in the UI. Simulated routing = haversine × 1.8 winding ÷ 25 km/h. | No credentials; honest demo. Real ORS/Open-Meteo optional in Phase 7. | — |
| D-14 | 2026-10-29 | Weather is a 3-band delay (0 / +15 % / +35 %), not a calibrated model. | Transparent and conservative; blueprint D7. | — |
| D-15 | 2026-10-29 | Session = HttpOnly cookie JWT with `tokenVersion` revocation; CSRF mitigated by SameSite=Lax + JSON-only mutations + strict CORS. | No localStorage tokens (D9); no extra session store needed. | — |
| D-16 | 2026-10-29 | Workers run in-process on intervals with leases/unique keys; no Redis. | No Redis available; blueprint D8 allows it with documented limitation. | — |
| D-17 | 2026-10-29 | 3 no-show strikes in 180 days → donor placed under admin review (not banned). | Pitch mentions strikes/review; avoids automatic punishment. | Partner review |
| D-18 | 2026-10-29 | Family-lead OTP verification deferred; lead stays `pending` and can never alert donors regardless. | Safety boundary holds without OTP; saves time. | — |

## Open questions (non-blocking; defaults above apply)

1. Should a hospital be able to confirm fulfillment with fewer units than requested (partial)? Default: yes, `unitsReceived` recorded.
2. Should coordinators see request summaries for logistics? Default: summary only (code, facility, blood group, status, deadline).
