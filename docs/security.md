# Security, Privacy and Abuse Controls — Golden Hour (PS-04)

**Phase:** 1 · Engineering baseline for a hackathon demo with synthetic data. This is not a legal, clinical or compliance approval.

## 1. Roles and permissions (server-enforced)

| Capability | PUB | DON | HS | HV (HS + `canVerifyRequests`) | CO | ADM |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| Public checker / suspicious report | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Submit family lead | ✓ | ✓ | – | – | – | – |
| Register as donor | ✓ | – | – | – | – | – |
| Manage own donor profile, availability, consent | – | ✓ | – | – | – | – |
| See / answer own alerts, update own assignment | – | ✓ | – | – | – | – |
| Create request (own verified facility) | – | – | ✓ | ✓ | – | – |
| Verify / reject / resolve duplicate (own facility) | – | – | – | ✓ | – | reject/dup only |
| Fulfil, cancel, confirm arrival/donation, no-show (own facility) | – | – | ✓ | ✓ | – | cancel only |
| See candidates and assigned donor contact (own facility) | – | – | ✓ | ✓ | – | ✓ |
| Confirm / reject family leads (own facility) | – | – | ✓ | ✓ | – | – |
| Stock transfers (own facility side) | – | – | ✓ | ✓ | – | – |
| Road reports create | – | – | ✓ | ✓ | ✓ | ✓ |
| Road reports verify, access points, transport tasks | – | – | – | – | ✓ | ✓ |
| Verify facilities, provision staff, suspend users, review strikes | – | – | – | – | – | ✓ |
| Audit log, escalation queue, provider health | – | – | own facility audit | own facility audit | – | ✓ |

Rules:
- Authorization is checked in middleware (`requireRole`) **and** in the service (`assertFacilityScope`, `assertOwner`). Hiding UI is never the control.
- Cross-facility IDs return `404`, not `403`, so IDs can't be probed.
- Users with `status ≠ active` are rejected on every request (status loaded per request). Staff of a facility that is not `verified` cannot create or verify requests.
- Admins cannot create or verify requests on behalf of a hospital — the pitch's authority boundary.
- Public sign-up exists only for donors. Hospital staff, coordinators and admins are provisioned by an admin (seed script provisions the first admin).

## 2. Sessions

- Login → JWT signed with `SESSION_SECRET` (HS256), claims `{ sub, tv: tokenVersion }`, `exp = SESSION_TTL_HOURS`.
- Stored only in cookie `gh_session`: `HttpOnly`, `SameSite=Lax`, `Secure` in production, `Path=/`. Nothing in `localStorage`.
- Every request reloads the user; `tv` must equal `user.tokenVersion`. Logout, suspension and password change increment it → all sessions invalid.
- CSRF: state-changing routes require `Content-Type: application/json` (rejects simple form posts) and CORS allows only `CLIENT_ORIGIN` with credentials. Combined with `SameSite=Lax` this blocks cross-site writes.
- Passwords: bcrypt cost 12; minimum 10 characters; generic login error; constant-ish timing by hashing a dummy on unknown email.

## 3. HTTP hardening

`helmet` defaults; `express.json({ limit: '50kb' })`; CORS allow-list; `trust proxy` only when `TRUST_PROXY=true`; `X-Request-Id` correlation; central error handler that hides internals in production; request timeout 15 s.

## 4. Rate limits

In-memory store (single-process MVP; documented limitation).

| Route | Limit | Key |
| --- | --- | --- |
| `POST /auth/login` | 10 / 15 min | IP + email |
| `POST /auth/register-donor` | 5 / h | IP |
| `GET /public/requests/:code` | 30 / min | IP |
| `POST /public/reports` | 10 / h | IP |
| `POST /family-leads` | 5 / h | IP, and 3 / h per phone |
| `POST /requests` | 30 / h | user |
| Webhooks | 300 / min | IP |

Repeated login failures are audited (`auth.login_failed`, email hashed) and surfaced on the admin overview.

## 5. Privacy and data minimization

| Data | Who can see it |
| --- | --- |
| Raw patient MRN | Nobody after submit — only an HMAC is stored (`patientRefHash`) |
| `patientLabel`, `clinicalNote` | Staff of the owning facility, admin |
| Donor phone | Owner; hospital staff of a facility **only after that donor accepted** its request; admin |
| Donor anchor coordinates | Nobody via API (used server-side for routing). Hospitals see `anchorLabel` + ETA |
| Donor name | Owner, owning hospital in candidates/assignments, admin |
| Facility name/district/location | Public (institutions) |
| Public checker | status, facility name, district, blood group, deadline, updated time |
| SMS body | public code, facility name, blood group, deadline, response link — no patient data |
| Audit logs | IDs, actions, reasons, minimal diffs. No passwords, tokens, phones, MRNs, codes |
| Logs (stdout) | No bodies; phone numbers masked (`+91******1234`) |

DTOs are allow-list serializers (`toRequestDetail`, `toPublicStatus`, …). Mongoose documents are never sent directly.

Demo data is fully synthetic: names from a fixed fictional list, phones in a reserved test range (`+91 90000 0xxxx`), fictional facilities in a fictional "Siang Hills" district.

## 6. Abuse controls (pitch-confirmed)

| Control | Rule |
| --- | --- |
| Official requests | Only staff of an admin-verified facility |
| Request verification | Separate action by a verifier; by default a **different person** from the creator |
| One active request per patient | Partial unique index `{ facilityId, patientRefHash }` where `isActive` |
| Duplicate submissions | `Idempotency-Key`; similarity flag → human review blocks verification |
| Similarity rule | same facility, same blood group, overlapping deadline window (±6 h), created within 6 h, different patient hash → `duplicateReview.pending` with candidate IDs |
| Contact fairness | Donor not alerted twice for one request; cooldown `CONTACT_COOLDOWN_HOURS` across requests |
| No-show strike | Hospital marks no-show with reason → strike. **3 strikes in 180 days → `reviewStatus = under_review`** (excluded from alerts) and admin notified. Admin decides; never automatic ban; ETA lateness alone is never a strike. |
| Suspicious request report | Public form; admin queue; repeated reports on one code raise its `under_review` public state only by admin action |
| Account pause/review | Admin `paused`/`suspended` with reason; audited; sessions revoked |
| Audit | Every transition, admin decision and denied sensitive action |

## 7. Public code

`GH-` + 8 Crockford base32 chars from `crypto.randomBytes` (40 bits ≈ 1.1 × 10¹² values). Not sequential, not the Mongo `_id`, rate-limited, and only ever reveals public-safe status. The code appears in SMS and forwards, so it is not a secret; it is stored in plain form with a unique index (decision D-05).

## 8. Secrets

- Only in `server/.env` (git-ignored). `.env.example` has placeholders.
- No server secret is ever given a `VITE_` prefix.
- Zod config validation prints missing variable **names** only.

## 9. AI and automation boundaries

No AI component in the MVP. Urgency suggestion is a deterministic rule (`critical` < 2 h to deadline, `urgent` < 6 h, else `standard`) and is never applied without the verifier confirming `urgencyConfirmed`.
