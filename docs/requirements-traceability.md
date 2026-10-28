# Requirements Traceability — Golden Hour (PS-04)

Status values: **missing** (not built), **partial**, **implemented**, **deferred**.
Source: **P** = pitch-confirmed, **R** = blueprint recommendation.
Repository is greenfield as of Phase 0, so every item starts as *missing*.

## Must Have

| ID | Requirement | Src | Priority | Phase | Status |
| --- | --- | --- | --- | --- | --- |
| M1 | Hospital/staff login with backend role authorization | P | Must | 3 | implemented (Phase 3) |
| M2 | Admin-controlled hospital/facility verification | P | Must | 3–4 | implemented (Phase 3) |
| M3 | Hospital-created blood request (group, units, facility, urgency, deadline, safe patient ref, idempotency key) | P | Must | 4 | implemented (Phase 4) |
| M4 | Request verification separate from creation | P | Must | 4 | implemented (Phase 4) — separate verifier by default |
| M5 | Public "Is this real?" checker with minimal disclosure | P | Must | 4 | implemented (Phase 4) |
| M6 | Donor profile: consent, blood group, coarse location, availability, last donation date, cooldown | P | Must | 5 | implemented (Phase 5) |
| M7 | Matching: compatibility, 90-day rest period, availability, skip recently contacted, ETA ranking | P | Must | 5 | implemented (Phase 5) — ETA simulated + labelled until Phase 7 |
| M8 | Donor accept/decline with atomic single-claim assignment | R | Must | 5 | implemented (Phase 5) — transaction + partial unique indexes |
| M9 | Request timeline (requested → verified → alerted → accepted → en route → arrived → fulfilled → closed) and hospital-confirmed fulfillment | P | Must | 4–6 | implemented (Phases 4–5): alerted → accepted → en route → arrived → donated → hospital-confirmed fulfilment |
| M10 | Duplicate protection: idempotency, one active request per patient, similarity flag, human review | P | Must | 4 | implemented (Phase 4) |
| M11 | Audit events for critical/admin actions | P | Must | 4–10 | partial — auth, facility and account decisions audited |
| M12 | Dashboards for hospital, donor, admin/coordinator | R | Must | 6 | implemented (Phase 6) — hospital dashboard, donor home, admin overview/requests/audit/reports, coordinator list; freshness indicators |
| M13 | Manual fallback when route/weather/SMS provider is down | P | Must | 7, 9 | missing |
| M14 | Synthetic seed data and automated happy-path/failure tests | R | Must | 2–11 | descoped by user (D-26): no tests or demo scripts |
| M15 | "Demo/simulated" labels on simulated provider results | R | Must | 7, 9, 12 | missing |

## Should Have

| ID | Requirement | Src | Phase | Status |
| --- | --- | --- | --- | --- |
| S1 | Leaflet map (hospitals, coarse donor markers, ambulance-accessible point) | P | 7 | missing |
| S2 | Road ETA with timeout, cache, freshness label; labelled straight-line fallback | P | 7 | missing |
| S3 | Rain/weather delay as configurable band | P | 7 | missing |
| S4 | Configurable escalation ladder (0 / 5 / 10 / 15 min) | P | 10 | missing |
| S5 | SMS adapter with test mode and delivery-state tracking | P | 9 | missing |
| S6 | Hospital ↔ hospital / blood-bank stock request and transfer timeline | P | 8 | missing |
| S7 | Road closure reports with author, time, confidence, expiry, verification | P | 7 | missing |
| S8 | Family lead stays pending until hospital confirms | P | 8 | missing |
| S9 | No-show/decline → next-best donor; strike/review | P | 5, 10 | implemented (Phase 5) — next batch after decline/withdraw/no-show; 3 strikes → admin review |
| S10 | Demo scenario reset (dev/demo only) | R | 12 | descoped by user (no demo scripts) |
| S11 | Provider/queue health view | R | 9–10 | partial — admin overview (Phase 6); provider/queue health in Phase 9 |

## Abuse controls (pitch-confirmed)

| ID | Requirement | Phase | Status |
| --- | --- | --- | --- |
| A1 | Rate limits on login, public checker, leads, webhooks | 3, 10 | partial — login (10 / 15 min per IP+email) |
| A2 | Cooldowns and one active request per patient | 4–5 | implemented — unique active-request index, 90-day rest period, contact cooldown |
| A3 | Strikes, account pause/review | 10 | partial — pause/suspend; no-show strikes + automatic review flag + admin review UI |
| A4 | Suspicious-request reports | 4, 10 | implemented — public intake (Phase 4) + admin review queue (Phase 6) |
| A5 | Audit trail | 4–10 | partial — all transitions audited; admin audit viewer (Phase 6) |

## Could Have / future (pitch marks several as planned)

| ID | Requirement | Src | Status |
| --- | --- | --- | --- |
| C1 | Inbound YES/NO SMS webhook | P | deferred |
| C2 | Missed-call availability | R | deferred |
| C3 | Multilingual SMS (verified translations only) | P (future) | deferred |
| C4 | Relay transport with multi-leg handover | P (future) | deferred |
| C5 | Offline queue for coordinator road reports | R | deferred |
| C6 | "What if?" scenario simulator | R | deferred |
| C7 | QR code for public verification URL | R | deferred |
| C8 | AI-assisted intake (draft only, hospital confirms) | P (future) | deferred |
| C9 | WhatsApp channel | P (future) | deferred |
| C10 | Live blood-bank stock integration | P (future) | deferred |
| C11 | 108 ambulance integration | P (future) | deferred — needs formal authorization |
| C12 | Village anchors / verified local coordinators | P (future) | deferred — needs partnership onboarding |

## Won't Have (first MVP)

AI deciding urgency or eligibility; autonomous ambulance dispatch; unverified road closures shown as authoritative; public donor directory; auto-rejecting duplicates by score; real patient/donor data; microservices/Kubernetes; zero-signal operation claims.
