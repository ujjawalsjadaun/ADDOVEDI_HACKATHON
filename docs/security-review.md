# Code Review and Hardening — Phase 11

**Scope:** whole repository read against `docs/security.md`, `docs/state-machines.md` and the blueprint's invariants. This is an engineering review by the authors, **not** a security certification. Per project decision D-26 no automated tests were written, so none of the items below has been verified at runtime; each fix is covered only by typecheck, lint and build.

## Fixed in this phase

| # | Severity | Finding | Fix |
| --- | --- | --- | --- |
| 1 | High | An administrator's "under review" pause could be bypassed: the slot-refill path after a donor withdrawal or hospital no-show called `alertNextBatch` directly and skipped the transition rules. | `alertNextBatch` itself now refuses when `request.review` is set, so manual, escalation and refill paths all honour the pause. |
| 2 | Medium | A crash between claiming an `Idempotency-Key` and finishing the handler left the key `in_progress` for 24 h, blocking the user's retry (`409`). | Unfinished claims older than 2 minutes are released (compare-and-delete on `updatedAt`) and the call re-runs once. |
| 3 | Medium | Escalation and expiry workers ran queries while the database was down, logging an error every 15–60 s. | Both skip quietly while disconnected and resume on reconnect. |
| 4 | Medium | No process-level handling: a stray rejected promise was silent; an uncaught exception left the process half-alive. | `unhandledRejection` is logged; `uncaughtException` logs fatally and shuts down cleanly. |
| 5 | Low | Authenticated API responses had no cache headers, so a shared proxy or browser could cache private data. | `Cache-Control: no-store` on every `/api` response. |

## Checked and found consistent

- **Authorization:** every non-public router is mounted behind `requireRole` or a per-route guard; facility scoping answers `404` for other facilities' ids; donors can only read/act on their own alerts and assignments; coordinators see donor contact only after claiming a transport task.
- **Privacy:** `patientRefHash` is never serialised; donor coordinates are never returned to anyone but the donor (rounded); the public checker returns status, facility, district, blood group and deadline only; SMS templates contain no patient data; audit entries hold no phones, passwords or MRNs.
- **Concurrency:** donor slot claim, one-active-request-per-patient, one-open-pickup-per-assignment, escalation steps and outbox `eventId` are enforced by unique/partial indexes in addition to application checks.
- **State machines:** transitions are version-checked; fulfilment is hospital-only and never implied by acceptance, arrival, donation, transport or stock receipt.

## Known limitations (accepted, documented)

| Item | Why it stays |
| --- | --- |
| Rate limits, Socket.IO rooms and workers are in-process (single instance). | Hackathon scope; scaling needs Redis (D-16). |
| On a standalone MongoDB, `withTransaction` falls back to non-transactional writes (D-65). | Convenience for local development; use Atlas for the demo. |
| Donors who already accepted can still be alerted or accept while a request is under review (only *new* alerts pause). | An administrator's pause should not cancel a possibly real donor in transit; cancel/reject remain available. |
| "Near the route" for road closures is a 2 km corridor around a straight line (D-49). | Cheap and explainable; real road geometry needs the routing provider. |
| No MFA, no password-reset flow, no email/phone verification for donors or family leads (D-18). | Out of scope for the MVP; a real launch needs them. |
| Behind a reverse proxy, `TRUST_PROXY=true` must be set or all visitors share one rate-limit bucket. | Documented in the README and architecture env table. |
| No real SMS provider: no delivery receipts and no inbound YES/NO (D-60). | No credentials; deferred. |
| No dependency fix for the low-severity `esbuild` advisory via `tsup` (D-19). | Affects only esbuild's dev server, which is not used. |
| No automated tests, load tests or penetration test. | Project decision D-26. |

## Before any real use

Independent security review; clinical review of the blood-group rule, rest period and urgency rules (D-08, D-09); partner and legal review of consent wording and data retention; a real SMS provider with signed webhooks; MFA and password reset; a replica-set database with backups; and a decision on who operates escalations around the clock.
