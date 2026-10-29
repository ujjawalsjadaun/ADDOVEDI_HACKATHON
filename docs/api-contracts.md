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
| `GET /admin/audit?action=&resourceType=&resourceId=&facilityId=&result=&from=&to=` | ADM | paginated `AuditEntryView[]`, newest first; `action` is a prefix match (e.g. `request.`) |
| `GET /admin/escalations?open=true|false` | ADM | `AdminEscalationItem[]`: requests at escalation step ≥ 1 (open ones by default), most escalated first, each with its ladder events (`step`, `outcome`, `at`, `detail`) |
| `GET /admin/suspicious-reports?status=open|reviewed` | ADM | paginated `SuspiciousReportView[]` incl. matched request and same-source count (24 h, keyed IP hash) |
| `POST /admin/suspicious-reports/:id/review` | ADM | `{ reason }` → marks reviewed, audited as `report.reviewed` |
| `GET /admin/overview` | ADM | `AdminOverview`: counts (pending facilities, unverified donors, donors under review, overdue verifications, active requests, requests without responders, open reports, failed logins 24 h) + lists of overdue verifications and requests without responders |

### Dashboards (read models; never change state)
| Method & path | Role | Notes |
| --- | --- | --- |
| `GET /dashboard/hospital` | HS | `HospitalDashboard` for the user's facility: counts, `needsAction` (with reasons), `donorsInProgress` |
| `GET /dashboard/coordinator` | CO, ADM | `CoordinatorRequestView[]` — active **verified** requests; facility, blood group, urgency, units, deadline, donors travelling. No patient label/note, no donor identity |

All dashboard payloads carry `generatedAt`; the UI shows the age of every live view and warns when it is stale or offline.

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
| `POST /requests/:id/alerts/next-batch` | HS own facility, ADM | `{ expectedVersion, reason }` → `RequestDetail` — manual widen; same code path used after withdrawal/no-show and by the escalation worker. Refused while the request is under review |
| `POST /requests/:id/review-flag` | ADM | `{ expectedVersion, flagged: boolean, reason }` → `RequestDetail`. Places a request under review / clears it (see state-machines.md §5.1). `allowedActions` includes `flag_review` / `clear_review` for admins only |
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

### Family leads (Phase 8)
| Method & path | Role | Notes |
| --- | --- | --- |
| `POST /family-leads` | PUB, 5/h/IP and 3/h per phone | `{ hospitalId (verified), contactName, contactPhone, bloodGroup?, note? }` + `Idempotency-Key` → `202 FamilyLeadReceipt { reference: 'L-XXXXXX', status: 'pending', facilityName }`. Never creates a request or alert |
| `GET /family-leads?status=pending|confirmed|rejected|expired` | HS own facility | `FamilyLeadView[]` (pending leads expire after 24 h; computed on read) |
| `POST /family-leads/:id/confirm` | HS own facility | `{ request: CreateRequest }` → `201 RequestDetail`. Request creation and lead → `confirmed` happen in **one transaction**; the request is `open` and still needs verification |
| `POST /family-leads/:id/reject` | HS own facility | `{ reason }` |

### Geo / road (Phase 7)
| Method & path | Role | Notes |
| --- | --- | --- |
| `GET /geo/map` | HS, CO, ADM | `MapData`: verified facilities (location, vehicle access point, active request count), road reports, provider labels (`simulated` or live), closure corridor. **Never** donor locations |
| `GET /road-reports` | HS, CO, ADM | current reports + those expired within 24 h (`isStale: true`); dismissed hidden. Each has `affectsEta` and `allowedActions` |
| `POST /road-reports` | HS, CO, ADM (30/h/user) | `{ location, label, condition: open|blocked|restricted|unknown, note?, confidence: low|medium|high, expiresInHours: 1–72 }` → `201 RoadReportView` |
| `POST /road-reports/:id/verification` | CO, ADM | `{ decision: verified|dismissed, reason }`; a coordinator cannot verify their own report |
| `POST /hospitals/:id/access-point` | HS own facility, CO, ADM | `{ location: {lat,lng} | null, note? }` — `null` clears it |

Every ETA (`EtaSnapshot`) now carries `warnings: string[]` (e.g. unconfirmed closure near the route, weather unavailable, rough straight-line guess) and a real `weatherAdjustment` band.

### Transport (Phase 8)
| Method & path | Role | Notes |
| --- | --- | --- |
| `POST /transport-tasks` | HS own facility, CO, ADM | `{ requestId (verified, not closed), kind: donor_pickup|unit_transfer, assignmentId? (required for donor_pickup; must be active on the request), pickup: {label, location?}, dropoff: {label, location?}, note? }`. One open pickup per assignment |
| `GET /transport-tasks?scope=open|mine|facility|all&requestId=` | HS (own facility), CO (open + own), ADM | `TransportTaskView[]`. Donor name/phone only for facility staff, admins and the coordinator who took the task |
| `POST /transport-tasks/:id/status` | per action | `{ expectedVersion, action: claim|picked_up|handed_over|complete|fail|cancel, note? }` — claim: coordinator; picked_up/handed_over: assignee; complete: receiving facility staff; fail: assignee/facility/admin (note); cancel: facility/admin (note) |

### Stock transfers (Phase 8)
| Method & path | Role | Notes |
| --- | --- | --- |
| `POST /stock-transfers` | HS of a verified facility | `{ respondingFacilityId (verified, other), bloodGroup, units, relatedRequestId? (own facility), note? }` + `Idempotency-Key` → `201 StockTransferView` |
| `GET /stock-transfers?direction=incoming|outgoing` | HS | own facility's side |
| `POST /stock-transfers/:id/status` | HS of the acting side | `{ expectedVersion, action: offer (offeredUnits ≤ units) | decline (note) | dispatch | receive | cancel (note) }` — responding side offers/declines/dispatches; requesting side receives/cancels. Receiving never closes a blood request |

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

Implemented in Phase 9 as a **single event** `change` with payload `RealtimeEvent { topic, id?, at }` (`shared/src/dto/notifications.ts`). It never carries data; clients invalidate the matching queries and refetch over REST.

| Topic | Rooms | Emitted after |
| --- | --- | --- |
| `request` | `facility:<id>`, `role:admin`, `role:coordinator` | any request transition, alert batch, assignment change, transport change, SMS status change |
| `alert` | `user:<donorId>` | donor alerted, own assignment changed, request closed |
| `transport` | `facility:<id>`, `role:coordinator`, `role:admin` | transport task created/changed |
| `transfer` | both facilities | stock transfer created/changed |
| `lead` | `facility:<id>` | family lead submitted/decided |
| `map` | `role:hospital_staff`, `role:coordinator`, `role:admin` | road report or access point changed |
| `notification` | `role:admin` | outbox message status changed |

### Admin notifications (Phase 9)
| Method & path | Role | Notes |
| --- | --- | --- |
| `GET /admin/notifications?status=` | ADM | paginated `NotificationView[]` incl. rendered body, masked number, attempts, last error |
| `GET /admin/notifications/health` | ADM | `NotificationQueueHealth`: provider (simulated?), counts by status, oldest queued |
| `POST /admin/notifications/:id/retry` | ADM | `{ reason }` — re-queues a **failed** message; audited (`notification.retried`) |

### SMS replies (pitch gap: low-signal donors answer by SMS)
| Method & path | Role | Notes |
| --- | --- | --- |
| `POST /sms/inbound` | provider (`x-sms-secret`) | `{ from, body }` → `SmsReplyResult { outcome, replyText }`. 404 when `INBOUND_SMS_SECRET` is unset or wrong. Rate-limited (120/min/IP) |
| `POST /admin/sms/simulate-reply` | ADM | Same body/result; same code path; audited (`admin.sms_reply_simulated`). For demos without a real provider |

Reply grammar: `YES|Y|NO|N` plus an optional 4-character code from the alert SMS. The sender is matched by registered phone; the answer is applied through `acceptAlert` / `declineAlert`, so all app rules (busy donor, filled slots, expiry, idempotent repeat) apply unchanged. Several open alerts and no code → `needs_code`. Audited as `donor.sms_reply` (phone masked).

### Hospital strikes
| Method & path | Role | Notes |
| --- | --- | --- |
| `POST /admin/hospitals/:id/strike` | ADM | `{ reason, requestId? }` → `HospitalAdmin` (with `strikes`). At `HOSPITAL_STRIKE_LIMIT` a verified facility is suspended in the same transaction. Audited `hospital.strike` |

### Donor report from an alert
| Method & path | Role | Notes |
| --- | --- | --- |
| `POST /alerts/:id/report` | DON (own alert) | `{ category, note? }` → `{ reported: true }`. Lands in the admin suspicious-reports queue; reporter stored only as a keyed hash of the user id (one report per donor per request, repeats are no-ops). 10 per 10 min per user |

### Family number confirmation and SMS updates
| Method & path | Role | Notes |
| --- | --- | --- |
| `POST /family-leads` | public | Receipt now has `phoneVerificationRequired: true`; a 6-digit code is texted (outbox type `family_phone_code`) to the number given |
| `POST /family-leads/verify-phone` | public | `{ reference, code }` → `{ verified: true }`. Generic error on any mismatch; 5 wrong tries kill the code; 20/h/IP |

`FamilyLeadView.phoneVerified` tells staff whether the number was confirmed. Status texts (`family_lead_update`: confirmed, rejected, closed) go **only** to confirmed numbers; otherwise the outbox row fails with `PHONE_NOT_CONFIRMED`. Updates never include the patient, blood group or clinical details — only facility name and public code.

### Missed call = "available today"
| Method & path | Role | Notes |
| --- | --- | --- |
| `POST /sms/missed-call` | provider (`x-sms-secret`) | `{ from }` → `SmsReplyResult` (`availability_refreshed`). Marks the registered donor available and refreshes `availabilityUpdatedAt` (availability older than 30 days stops matching). Never accepts an alert. 404 when `INBOUND_SMS_SECRET` is unset |
| `POST /admin/sms/simulate-missed-call` | ADM | Same body/result; audited `admin.missed_call_simulated`. Donor-side audit: `donor.missed_call_available` |

### Relay transport
`POST /transport-tasks` accepts `relayPoint: { label, location? }` for `donor_pickup`. It creates **two linked tasks** in one transaction: leg 1 (pickup → handover point, carries the donor's `assignmentId`) and leg 2 (handover point → dropoff). `TransportTaskView.relay = { leg, handoverPoint, otherLegStatus }`.
- Leg 2 can be claimed only after leg 1 is `handed_over`/`completed`.
- Leg 1 is confirmed received (`complete`) by the leg-2 coordinator or facility staff.
- If leg 1 fails or is cancelled, an unfinished leg 2 is cancelled automatically.
- Transport state still never changes request or assignment state.

### Coordinator vouching for a family
| Method & path | Role | Notes |
| --- | --- | --- |
| `POST /family-leads/vouch` | COO | `{ reference, note }` → `{ recorded: true }` — identical answer whether or not the reference exists (no probing). Stores `vouch { by, at, note }` on a pending lead; audited `lead.vouched`. 30/h/user. Staff see it as `FamilyLeadView.vouch` |

### Family by SMS, status texts, ambulance point (pitch slide 15)
`POST /sms/inbound` (and the admin simulator) now also understands families:
- `BLOOD <group> <hospital code> [patient id]` → a pending family lead, same as the web form (`family_request_received`). The hospital code is `HospitalPublic.smsCode`, derived from the facility name (`Siang Hills District Hospital` → `Siang-HDH`); unknown or ambiguous codes are rejected.
- A bare 6-digit code from the lead's number → number confirmed (`family_phone_confirmed`), with the same 5-attempt limit as the web page.

Status texts to a confirmed family number (`family_lead_update`): `confirmed` (with the facility's nearest ambulance point, if set), `alerted` (n donors), `donor_accepted` (k of n units), `donor_en_route`, `donor_arrived`, `closed`, `rejected`. They carry no patient, donor or blood-group detail.
