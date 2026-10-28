# Data Model — Golden Hour (PS-04)

**Phase:** 1 · MongoDB via Mongoose. All collections have `createdAt`/`updatedAt` (Mongoose timestamps), stored in UTC and displayed in `Asia/Kolkata`. Coordinates are GeoJSON `Point` (`[lng, lat]` order).

Indexes are declared in schemas (`autoIndex` is off) and created by `ensureIndexes()` — automatically after the API connects, and on demand with `npm run db:indexes -w server`. Every model must be registered in `server/src/modules/models.ts`. Index creation is idempotent and additive; nothing drops indexes.

## users

| Field | Type | Notes |
| --- | --- | --- |
| `email` | string | lowercased, trimmed; **unique** |
| `passwordHash` | string | bcrypt (cost 12); `select: false` |
| `name` | string | display name |
| `phone` | string? | E.164; masked in every DTO except to the owner |
| `role` | enum | `admin` \| `hospital_staff` \| `donor` \| `coordinator` |
| `facilityId` | ObjectId? | required for `hospital_staff` |
| `canVerifyRequests` | boolean | hospital verifier capability (default `false`) |
| `status` | enum | `active` \| `paused` \| `suspended` |
| `tokenVersion` | number | incremented on logout-all / suspend / password change → old sessions invalid |
| `lastLoginAt` | Date? | |

Indexes: `{ email: 1 }` unique; `{ role: 1, status: 1 }`; `{ facilityId: 1 }`.

One role per user keeps RBAC simple for the MVP (a person who is staff and donor uses two accounts) — see decision D-07.

## hospitals

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | public |
| `facilityType` | enum | `hospital` \| `blood_bank` \| `hospital_with_blood_bank` |
| `district` | string | public |
| `address` | string | public |
| `location` | Point | public (institutions only) |
| `ambulanceAccessPoint` | `{ location: Point, note, reportedBy, reportedAt }`? | nearest vehicle-accessible point, labelled as reported |
| `registeredPhone` | string | staff/admin only |
| `verificationStatus` | enum | `pending` \| `verified` \| `rejected` \| `suspended` |
| `verification` | `{ by, at, reason }` | last decision |

Indexes: `{ verificationStatus: 1 }`; `{ location: '2dsphere' }`.

## donorProfiles

| Field | Type | Notes |
| --- | --- | --- |
| `userId` | ObjectId | **unique** |
| `bloodGroup` | enum | `A+ A- B+ B- AB+ AB- O+ O-` |
| `consent` | `{ contact: boolean, location: boolean, at: Date, version: string }` | both required `true` to be alerted |
| `availability` | enum | `available` \| `unavailable` |
| `availabilityUpdatedAt` | Date | stale after 30 days → treated as unknown (shown, not alerted) |
| `lastDonationAt` | Date \| null | `null` + `lastDonationKnown: false` = **unknown** → manual review only; `null` + `lastDonationKnown: true` = **never donated** |
| `lastDonationKnown` | boolean | |
| `anchorLocation` | Point | routing origin, rounded to 0.01° (~1 km) at write time; never returned in any API |
| `anchorLabel` | string | e.g. village/locality name, shown to hospital |
| `verificationStatus` | enum | `unverified` \| `verified` (admin/hospital marks verified) |
| `lastAlertedAt` | Date? | for contact cooldown |
| `strikes` | `[{ at, requestId, reason }]` | bounded (kept ≤ 10, older trimmed) |
| `reviewStatus` | enum | `ok` \| `under_review` (paused from alerts) |

Indexes: `{ userId: 1 }` unique; `{ bloodGroup: 1, availability: 1, verificationStatus: 1, reviewStatus: 1 }`; `{ anchorLocation: '2dsphere' }`.

## bloodRequests

| Field | Type | Notes |
| --- | --- | --- |
| `publicCode` | string | `GH-XXXX-XXXX` Crockford base32 from CSPRNG (40 bits); **unique** |
| `facilityId` | ObjectId | |
| `createdBy` | ObjectId | |
| `bloodGroup` | enum | patient's group |
| `acceptCompatibleGroups` | boolean | hospital's choice; default `false` (exact match only) |
| `unitsRequested` | int 1–6 | one donor = one unit = one slot |
| `slotsFilled` | int | active assignments; `0 ≤ slotsFilled ≤ unitsRequested` |
| `urgencySuggested` | enum | `critical` \| `urgent` \| `standard` (rule-based from deadline) |
| `urgencyConfirmed` | enum? | set by verifier; required to verify |
| `deadlineAt` | Date | must be in the future at creation |
| `patientRefHash` | string | HMAC-SHA256(`PATIENT_REF_SECRET`, facilityId + normalized MRN); raw MRN never stored |
| `patientLabel` | string? | optional short non-identifying label for staff (e.g. "Ward 3 bed 12"); staff only |
| `clinicalNote` | string? | ≤ 280 chars, staff only, never in alerts |
| `verificationStatus` | enum | `pending` \| `verified` \| `rejected` \| `expired` |
| `verification` | `{ by, at, reason }`? | |
| `requestStatus` | enum | `open` \| `awaiting_donor` \| `donors_assigned` \| `closed` |
| `isActive` | boolean | `true` until closed; drives the active-request unique index |
| `duplicateReview` | `{ status: none\|pending\|distinct\|duplicate, candidates: ObjectId[], by, at, reason }` | |
| `duplicateOfRequestId` | ObjectId? | |
| `closure` | `{ reason, by, at, note, unitsReceived }`? | required when `closed` |
| `alertBatches` | int | donor alert batches sent (verification sends batch 0); contact cooldown relaxed from the second batch |
| `escalationStep` | int | last executed escalation-ladder step (Phase 10) |
| `verifiedAt` | Date? | ladder anchor |
| `version` | int | optimistic concurrency; every transition increments |

Indexes:
- `{ publicCode: 1 }` unique
- `{ facilityId: 1, patientRefHash: 1 }` unique, partial `{ isActive: true }` → **one active request per patient per facility**, race-safe
- `{ facilityId: 1, requestStatus: 1, createdAt: -1 }`
- `{ requestStatus: 1, deadlineAt: 1 }` (expiry worker)
- `{ verificationStatus: 1, createdAt: 1 }` (overdue verification)

## requestAlerts

| Field | Type | Notes |
| --- | --- | --- |
| `requestId`, `donorUserId`, `facilityId` | ObjectId | |
| `batch` | int | alert batch number |
| `rank` | int | position in ranking at alert time |
| `eta` | `{ minutes, quality, source, calculatedAt, weatherAdjustment }`? | snapshot shown to donor/hospital |
| `channels` | `['in_app','sms']` | |
| `deliveryStatus` | enum | `queued` \| `sent` \| `delivered` \| `failed` \| `unknown` (best across channels) |
| `response` | enum | `pending` \| `accepted` \| `declined` \| `expired` \| `cancelled` |
| `respondedAt`, `expiresAt` | Date | |
| `responseToken` | string | random, for future SMS YES/NO correlation |

Indexes: `{ requestId: 1, donorUserId: 1 }` **unique** (a donor is alerted at most once per request); `{ donorUserId: 1, response: 1, createdAt: -1 }`; `{ response: 1, expiresAt: 1 }`.

## assignments

| Field | Type | Notes |
| --- | --- | --- |
| `requestId`, `donorUserId`, `alertId`, `facilityId` | ObjectId | |
| `slot` | int | 0-based, `< unitsRequested` |
| `status` | enum | `accepted` \| `en_route` \| `arrived` \| `donated` \| `withdrawn` \| `no_show` \| `cancelled` |
| `isActive` | boolean | `true` for `accepted`/`en_route`/`arrived` — the donor is committed |
| `holdsSlot` | boolean | `isActive` or `donated` — the slot is used (a donated unit keeps its slot) |
| `acceptedAt`, `enRouteAt`, `arrivedAt`, `donatedAt`, `endedAt` | Date? | |
| `arrivedBy` | enum? | `donor_reported` \| `hospital_confirmed` |
| `endReason` | string? | required for withdrawn/no_show/cancelled |
| `eta` | snapshot | as in alerts |
| `version` | int | |

Indexes:
- `{ requestId: 1, slot: 1 }` unique, partial `{ holdsSlot: true }` → one donor per slot
- `{ donorUserId: 1 }` unique, partial `{ isActive: true }` → one active assignment per donor
- `{ requestId: 1, donorUserId: 1 }` unique → same donor cannot be assigned twice to one request

The slot claim runs in a transaction: conditional `$inc slotsFilled` on the request (`slotsFilled < unitsRequested`, status `awaiting_donor`), conditional update of the alert (`response: pending`), insert assignment with `slot = previous slotsFilled`. Released slots are reused: the claim picks the lowest free slot number computed inside the transaction; the partial unique index is the backstop.

## notificationOutbox

| Field | Type | Notes |
| --- | --- | --- |
| `eventId` | string | **unique** idempotency key, e.g. `alert:<alertId>:sms` |
| `type` | string | template id, e.g. `donor_alert`, `request_closed`, `escalation_admin` |
| `channel` | enum | `sms` \| `in_app` |
| `recipientUserId` | ObjectId | phone resolved at send time (not copied into outbox) |
| `vars` | object | template variables only — public code, facility name, blood group, deadline; **no patient data** |
| `status` | enum | `pending` \| `sending` \| `sent` \| `delivered` \| `failed` \| `unknown` |
| `attempts`, `nextAttemptAt`, `lockedUntil`, `lastError`, `providerMessageId` | | |

Indexes: `{ eventId: 1 }` unique; `{ status: 1, nextAttemptAt: 1 }`; `{ providerMessageId: 1 }` sparse.

## simulatedSms (dev/demo only)

`{ to (masked), body, outboxEventId, createdAt }` — what the simulated provider "sent". TTL 7 days.

## escalationEvents

`{ requestId, step, outcome, detail, at }` — unique `{ requestId: 1, step: 1 }`.

## idempotencyKeys

`{ scope, actorKey, key, requestHash, status: in_progress|done, responseStatus, responseBody, expiresAt }`
Unique `{ scope: 1, actorKey: 1, key: 1 }`; TTL index on `expiresAt` (24 h). Same key with a different body → `422 IDEMPOTENCY_KEY_REUSED`.

## auditLogs (append-only)

| Field | Notes |
| --- | --- |
| `actor` | `{ type: user\|system, userId?, role? }` |
| `action` | dotted name, e.g. `request.verified`, `assignment.no_show`, `hospital.suspended`, `auth.login_failed` |
| `resourceType`, `resourceId` | |
| `facilityId` | for scoping hospital views |
| `result` | `success` \| `denied` \| `failed` |
| `reason` | free text where required |
| `changes` | minimal `{ field: [from, to] }` — never passwords, tokens, phones, MRNs, codes |
| `requestId` (correlation) | HTTP correlation id |
| `at` | |

Indexes: `{ resourceType: 1, resourceId: 1, at: 1 }`; `{ facilityId: 1, at: -1 }`; `{ action: 1, at: -1 }`. No update/delete code path exists.

## roadReports

`{ reporterId, reporterRole, location: Point, label, condition: open|blocked|restricted|unknown, note, confidence: low|medium|high, verificationStatus: unverified|verified|dismissed, verifiedBy, reportedAt, expiresAt }`
Indexes: `{ location: '2dsphere' }`, `{ expiresAt: 1 }` (not TTL — stale reports stay for history), `{ verificationStatus: 1, expiresAt: 1 }`.
Derived: `isStale = now ≥ expiresAt`; `affectsEta` = blocked ∧ ¬stale ∧ ¬dismissed ∧ (verified ∨ confidence high) — see architecture.md §6.

## hospitals.ambulanceAccessPoint

`{ location: Point, note, reportedBy, reportedAt } | null` — nearest point a vehicle can reach; a reported estimate.

## ETA snapshot (embedded in requestAlerts and assignments)

`{ minutes|null, distanceKm|null, quality: live|cached|simulated|rough_estimate|unavailable, source, calculatedAt, weatherAdjustment: none|moderate|heavy|unavailable, warnings: string[] }`

## routeCache

`{ key (rounded from→to), minutes, distanceKm, source, calculatedAt, expiresAt }` — unique `key`; TTL on `expiresAt`.

## familyLeads

`{ contactName, contactPhone, hospitalId, bloodGroup?, note (≤280), status: pending|confirmed|rejected|expired, linkedRequestId?, decidedBy, decidedAt, reason, expiresAt }`
Indexes: `{ hospitalId: 1, status: 1 }`; `{ contactPhone: 1, createdAt: -1 }` (rate limiting / duplicate leads).

## transportTasks

`{ requestId, assignmentId?, kind: donor_pickup|unit_transfer, pickup: {label, location}, dropoff: {label, location}, assigneeUserId (coordinator), status, statusHistory: [{status, by, at, note}] (bounded), version }`
Indexes: `{ assigneeUserId: 1, status: 1 }`; `{ requestId: 1 }`.

## stockTransfers

`{ requestingFacilityId, respondingFacilityId?, relatedRequestId?, bloodGroup, units, status: requested|offered|dispatched|received|declined|cancelled, offeredUnits, history: [{status, by, at, note}] (bounded), version }`
Indexes: `{ requestingFacilityId: 1, status: 1 }`; `{ respondingFacilityId: 1, status: 1 }`.

## suspiciousReports

`{ publicCode, category: fake_request|wrong_details|harassment|other, note (≤280), reporterIpHash, status: open|reviewed, reviewedBy, at }`

## Retention (demo defaults)

| Data | Retention |
| --- | --- |
| idempotency keys | 24 h (TTL) |
| simulated SMS | 7 days (TTL) |
| route cache | `ROUTE_CACHE_TTL_MIN` (TTL) |
| family leads | expire after 24 h; purge personal fields 30 days after decision (Phase 10) |
| audit logs | kept; contain no raw PII by construction |
