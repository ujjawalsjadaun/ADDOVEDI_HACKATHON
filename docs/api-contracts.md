# API Contracts — Golden Hour (PS-04)

**Phase:** 1 · Base path `/api`. JSON only. Zod schemas for every body/query live in `shared/src/schemas` and are used by both the server (validation) and the client (types + form validation).

## 1. Conventions

**Success envelope**

```json
{ "data": { }, "meta": { "requestId": "c0a8…" } }
```

Lists add `meta.page`, `meta.limit`, `meta.total`. Query: `?page=1&limit=20` (max 100).

**Error envelope**

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "This request has already changed. Refresh and try again.",
    "fields": { },
    "requestId": "c0a8…",
    "current": { "status": "closed", "version": 7 }
  }
}
```

`current` appears only on `409` and only to callers allowed to see the resource. No stack traces outside `development`.

| HTTP | `code` | When |
| --- | --- | --- |
| 400 | `BAD_REQUEST` | malformed JSON, missing `Idempotency-Key` |
| 401 | `UNAUTHENTICATED` | no/expired session |
| 403 | `FORBIDDEN` | wrong role, wrong facility, suspended account, unverified facility |
| 404 | `NOT_FOUND` | also used instead of 403 when revealing existence would leak (cross-facility IDs) |
| 409 | `CONFLICT` | stale `expectedVersion` |
| 409 | `INVALID_TRANSITION` | action not legal from current state |
| 409 | `ACTIVE_REQUEST_EXISTS` | unique active-patient index hit; `fields.existingRequestId` (same facility only) |
| 409 | `SLOTS_FILLED` | accept after all slots taken |
| 409 | `DONOR_BUSY` | donor already has an active assignment |
| 409 | `DUPLICATE_REVIEW_PENDING` | verify attempted while review pending |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | mutation without `Content-Type: application/json` (CSRF defence, security.md §2) |
| 422 | `VALIDATION_FAILED` | field errors in `fields` |
| 422 | `IDEMPOTENCY_KEY_REUSED` | same key, different body |
| 422 | `SELF_VERIFICATION_NOT_ALLOWED` | creator verifying own request with `REQUIRE_SEPARATE_VERIFIER` |
| 429 | `RATE_LIMITED` | `Retry-After` header set |
| 503 | `SERVICE_UNAVAILABLE` | DB down — mutation not saved |

**Headers**
- `X-Request-Id` — returned on every response (generated if absent).
- `Idempotency-Key` — **required** on `POST /requests`, `POST /family-leads`, `POST /stock-transfers`; UUID v4 from the client, reused on retry. `POST /alerts/:id/respond` is naturally idempotent instead: repeating the same answer returns the original result (decision D-38).
- Mutations of existing resources take `expectedVersion` in the body.

**Auth:** session cookie `gh_session` (HttpOnly, SameSite=Lax, Secure in production). See security.md.

## 2. Endpoints

Role key: **PUB** public · **ADM** admin · **HS** hospital staff · **HV** hospital staff with `canVerifyRequests` · **DON** donor · **CO** coordinator · **SYS** provider webhook. "Own facility" means `user.facilityId === resource.facilityId`.

### Health
| Method & path | Role | Notes |
| --- | --- | --- |
| `GET /health/live` | PUB | `{ status: 'ok' }` — process only |
| `GET /health/ready` | PUB | `200`/`503` `{ status: 'ready'|'degraded', db: 'up'|'down', demoMode, providers: { routing, weather, sms: 'simulated'|'up'|'down'|'unchecked' } }` — no secrets. `unchecked` = real provider configured but no probe yet |

### Auth
| Method & path | Role | Body → Response |
| --- | --- | --- |
| `POST /auth/login` | PUB (rate-limited) | `{ email, password }` → `{ user: SafeUser }` + cookie. Generic `401` on any failure. |
| `POST /auth/logout` | anyone | idempotent `200 { loggedOut: true }`; clears cookie; when signed in, `tokenVersion += 1` (signs out every session of that user) |
| `GET /auth/me` | any authed | `{ user: SafeUser, facility?: FacilitySummary }` |
| `POST /auth/register-donor` | PUB, 5/h/IP | `{ name, email, password, phone, bloodGroup, consent: { contact: true, location } }` → `201 MeResponse` and signs the donor in; profile starts `unverified` with last donation **unknown** |

`SafeUser = { id, name, email, role, facilityId?, canVerifyRequests, status }`.

### Admin
| Method & path | Role | Notes |
| --- | --- | --- |
| `GET /admin/hospitals?verificationStatus=` | ADM | list |
| `POST /admin/hospitals` | ADM | create facility (`pending`) |
| `POST /admin/hospitals/:id/verification` | ADM | `{ decision: verified|rejected|suspended, reason }` |
| `GET /admin/users?role=&status=&facilityId=` | ADM | paginated `UserAdmin[]` (phone masked) |
| `POST /admin/users` | ADM | `{ name, email, password, role: hospital_staff|coordinator|admin, phone?, facilityId?, canVerifyRequests }` — staff require `facilityId`; only staff may have `canVerifyRequests`. `409 CONFLICT` on duplicate email. No public sign-up for these roles; the first admin comes from `npm run create-admin -w server` |
| `POST /admin/users/:id/status` | ADM | `{ status: active|paused|suspended, reason }`; pause/suspend bumps `tokenVersion` (signs the user out everywhere); an admin cannot change their own status |
| `POST /admin/donors/:userId/verification` | ADM | `{ decision: verified|unverified, reason }` |
| `POST /admin/donors/:userId/review` | ADM | `{ decision: ok|under_review, reason }` (strikes) |
| `GET /admin/audit?resourceType=&resourceId=&action=&from=&to=` | ADM | paginated |
| `GET /admin/escalations?open=true` | ADM | escalation queue |
| `GET /admin/suspicious-reports` | ADM | |
| `GET /admin/overview` | ADM | counts: pending facilities, overdue verifications, open escalations, failed notifications |

### Hospitals (public-safe)
| `GET /hospitals?district=` | PUB | verified facilities only: `{ id, name, facilityType, district, location }` |

### Blood requests
| Method & path | Role | Body / response |
| --- | --- | --- |
| `POST /requests` | HS, own verified facility | `CreateRequest = { bloodGroup, acceptCompatibleGroups, unitsRequested, deadlineAt, patientRef, patientLabel?, clinicalNote? }` → `201 { request: RequestDetail, possibleDuplicate: boolean }`. Creates `open` / verification `pending`. **No alerts.** |
| `GET /requests?status=&verificationStatus=` | HS (own facility), ADM (all), CO (verified, non-closed, summary only) | `RequestSummary[]` |
| `GET /requests/:id` | HS own facility, ADM; CO summary | `RequestDetail` incl. timeline |
| `POST /requests/:id/verify` | HV own facility | `{ expectedVersion, urgencyConfirmed }` → starts matching + step 0 alerts |
| `POST /requests/:id/reject` | HV own facility, ADM | `{ expectedVersion, reason }` |
| `POST /requests/:id/duplicate-review` | HV own facility, ADM | `{ expectedVersion, decision: distinct|duplicate, duplicateOfRequestId?, reason }` |
| `GET /requests/:id/candidates` | HS own facility, ADM | `CandidatePreview { ranked, manualReview, alreadyAlerted, cooldownRelaxed }` (see §3) — read-only |
| `POST /requests/:id/alerts/next-batch` | HS own facility, ADM | `{ expectedVersion, reason }` → `RequestDetail` — manual widen; same code path used after withdrawal/no-show and by escalation (Phase 10) |
| `POST /requests/:id/fulfill` | HS own facility | `{ expectedVersion, unitsReceived, note? }` → `closed/fulfilled` |
| `POST /requests/:id/cancel` | HS own facility, ADM | `{ expectedVersion, reason }` |

`RequestDetail = { id, publicCode, facility: FacilitySummary, bloodGroup, acceptCompatibleGroups, unitsRequested, slotsFilled, urgency, urgencySuggested, urgencyConfirmed, deadlineAt, patientLabel, clinicalNote, verificationStatus, requestStatus, duplicateReview { status, candidates[], decidedBy, decidedAt, reason }, duplicateOfRequestId, closure, verification, verifiedAt, createdBy, version, createdAt, timeline: TimelineEvent[], allowedActions: RequestAction[] }` — never contains `patientRefHash`. Exact types: `shared/src/dto/request.ts`. Assignments are added in Phase 5.

Implementation notes (Phase 4):
- `allowedActions` (`verify | reject | review_duplicate | cancel | fulfill`) is computed by the same rule function that guards each mutation (`requests/request.transitions.ts`), so the UI only offers what the server will accept.
- `POST /requests` requires `Idempotency-Key` (16–64 chars of `A-Za-z0-9_-`). A replay with the same key and body returns the original status (`201`) with the request's **current** state and header `Idempotent-Replayed: true`; the same key with a different body → `422 IDEMPOTENCY_KEY_REUSED`; a still-running original → `409 CONFLICT`. If creation fails, the key is released so the corrected request can be resent.
- `deadlineAt` must be between 5 minutes and 72 hours ahead.
- `ACTIVE_REQUEST_EXISTS` returns `fields.existingRequestId` and `fields.existingPublicCode` (same facility only).
- Verify re-runs the duplicate check; if a new similar request appeared, the request is flagged and the call returns `409 DUPLICATE_REVIEW_PENDING`.
- Until Phase 5, verification moves the request to `awaiting_donor` without creating alerts.

### Donors
| Method & path | Role | Notes |
| --- | --- | --- |
| `GET /donors/me` | DON | own profile (anchor shown as label only) |
| `PUT /donors/me` | DON | `{ bloodGroup, lastDonationOn: "YYYY-MM-DD" | null (= never donated), anchor: {lat,lng,label} | null, consent: { contact, location } }` — server rounds anchor to ~1 km; location consent off clears it; a changed blood group resets verification |
| `POST /donors/me/last-donation-unknown` | DON | marks last donation unknown → manual-review list only |
| `POST /donors/me/availability` | DON | `{ availability }` — also refreshes the 30-day staleness clock |
| `GET /donors/me/alerts?response=pending` | DON | own alerts: `{ id, publicCode, facility, bloodGroup, deadlineAt, eta, response, expiresAt }` — no patient data |
| `GET /donors/me/assignments` | DON | own assignments; facility address + hospital registered phone revealed after accept |

### Alerts and assignments
| Method & path | Role | Notes |
| --- | --- | --- |
| `POST /alerts/:id/respond` | DON (alert owner) | `{ decision: accept|decline }` + `Idempotency-Key` → `{ alert, assignment? }`; `409 SLOTS_FILLED` / `DONOR_BUSY` / `INVALID_TRANSITION` |
| `POST /assignments/:id/status` | DON (owner) | `{ expectedVersion, status: en_route|arrived|withdrawn, reason? }` → `DonorAssignmentView`; withdrawal (reason required) frees the slot and alerts the next batch |
| `POST /assignments/:id/confirm-arrival` | HS own facility | `{ expectedVersion }` → `RequestDetail` |
| `POST /assignments/:id/donated` | HS own facility | `{ expectedVersion }` → `RequestDetail`; updates the donor's last donation date; does **not** fulfil the request |
| `POST /assignments/:id/no-show` | HS own facility | `{ expectedVersion, reason, needStillExists: boolean }` → `RequestDetail`; records a strike; frees the slot; alerts the next batch when `needStillExists` |

`AssignmentForHospital = { id, slot, status, donor: { name, phoneMasked→full after accept, anchorLabel }, eta, acceptedAt, enRouteAt, arrivedAt, arrivedBy, version }`.

### Public checker and reports
| Method & path | Role | Notes |
| --- | --- | --- |
| `GET /public/requests/:code` | PUB, 30/min/IP | `PublicRequestStatus` (below). Unknown/malformed code → `200 { status: 'not_found' }` (same shape, same timing) |
| `POST /public/reports` | PUB, 10/h/IP | `{ publicCode, category, note? }` → `202` |

```ts
type PublicRequestStatus =
  | { status: 'not_found' }
  | { status: 'pending_verification' | 'verified_active' | 'under_review'
            | 'closed_fulfilled' | 'closed_cancelled' | 'closed_expired' | 'rejected';
      code: string; facilityName: string; district: string; bloodGroup: string;
      deadlineAt?: string; updatedAt: string };
```

Never included: patient label/notes, units filled, donor info, phone numbers, internal IDs. Wording in the UI: "not found — check the code or report it", never "fake".

### Family leads
| `POST /family-leads` | PUB, 5/h/IP | `{ contactName, contactPhone, hospitalId, bloodGroup?, note? }` + `Idempotency-Key` → `202 { leadId, status: 'pending' }` |
| `GET /family-leads?status=pending` | HS own facility | |
| `POST /family-leads/:id/confirm` | HS own facility | `{ request: CreateRequest }` → creates request (still needs verification) and links lead |
| `POST /family-leads/:id/reject` | HS own facility | `{ reason }` |

### Geo / road
| `GET /geo/eta?requestId=&donorUserId=` | HS own facility | `EtaResult` snapshot (no coordinates) |
| `GET /road-reports?bbox=` | HS, CO, ADM | with `isStale` |
| `POST /road-reports` | CO, ADM, HS | `{ location, label, condition, note?, confidence, expiresInHours }` |
| `POST /road-reports/:id/verification` | CO, ADM | `{ decision: verified|dismissed, reason }` |
| `POST /hospitals/:id/access-point` | HS own facility, CO | `{ location, note }` |

### Transport
| `POST /transport-tasks` | HS own facility, CO | `{ requestId, kind, pickup, dropoff, assigneeUserId? }` |
| `GET /transport-tasks?mine=true` | CO | |
| `POST /transport-tasks/:id/status` | CO assignee, HS own facility | `{ expectedVersion, status, note? }` |

### Stock transfers
| `POST /stock-transfers` | HS | `{ bloodGroup, units, relatedRequestId?, respondingFacilityId? }` + `Idempotency-Key` |
| `GET /stock-transfers?direction=incoming|outgoing` | HS | own facility |
| `POST /stock-transfers/:id/respond` | HS responding facility | `{ expectedVersion, decision: offer|decline, offeredUnits? }` |
| `POST /stock-transfers/:id/dispatch` | HS responding facility | `{ expectedVersion }` |
| `POST /stock-transfers/:id/received` | HS requesting facility | `{ expectedVersion }` |

### Webhooks (only when a real SMS provider is configured)
| `POST /webhooks/sms/status` | SYS, signature-verified | dedupe on `providerMessageId + status`; monotonic updates |
| `POST /webhooks/sms/inbound` | SYS, signature-verified | YES/NO → `responseToken`; deferred (Could Have) |

### Dev / demo (mounted only when `DEMO_MODE=true` and `NODE_ENV !== 'production'`)
| `POST /dev/reset` | ADM | wipe + reseed synthetic data |
| `GET /dev/sms-inbox` | ADM | simulated SMS log |
| `POST /dev/scenario` | ADM | `{ scenario: 'routing_outage'|'heavy_rain'|'landslide'|'no_response' }` toggles simulated providers |

## 3. Matching candidate shape

```ts
type Candidate = {
  donorUserId: string; name: string; anchorLabel: string; bloodGroup: string;
  eta: EtaSnapshot | null;            // null when unavailable
  etaQuality: 'live' | 'cached' | 'simulated' | 'rough_estimate' | 'unavailable';
  weatherAdjustment: 'none' | 'moderate' | 'heavy' | 'unavailable';
  beforeDeadline: boolean | null;     // null when ETA unknown
  manualReviewRequired: boolean;      // ETA unknown, or last donation unknown
  excludedReason?: 'last_donation_unknown';  // listed separately, never auto-alerted
  lastAlertedAt?: string;
  rank: number;
};
```

Hard filters (never relaxed automatically): consent contact + location, profile verified, `reviewStatus = ok`, account `active`, availability `available` and fresh, blood group rule, rest period ≥ `DONATION_REST_DAYS`, no active assignment, not alerted for this request already, not alerted within `CONTACT_COOLDOWN_HOURS` (cooldown relaxes at escalation step 1+, documented). Donors with unknown last donation appear in a separate "manual review" list.

Exact candidate pool: the 25 nearest eligible donors (straight line) get a routing call. ETA is `simulated` until Phase 7 and always labelled.

Ranking (stable): `beforeDeadline` desc → ETA quality (`live`/`cached`/`simulated` before `rough_estimate` before unknown) → effective minutes asc → `lastAlertedAt` asc (fairness) → `donorUserId` asc (tie-break).

## 4. Socket events (server → client)

| Event | Room | Payload |
| --- | --- | --- |
| `request.updated` | `facility:<id>`, `role:admin` | `{ id, version, requestStatus, verificationStatus }` |
| `alert.created` / `alert.updated` | `user:<donorId>`, `facility:<id>` | `{ id, requestId, response }` |
| `assignment.updated` | `user:<donorId>`, `facility:<id>` | `{ id, requestId, status, version }` |
| `escalation.raised` | `role:admin`, `facility:<id>` | `{ requestId, step }` |
| `notification.updated` | `role:admin` | `{ id, status }` |
| `roadReport.updated` | `role:coordinator`, `role:admin` | `{ id }` |
