# Verification report: request flows run end to end

Run on 2026-10-29 against the real server (Node, Express, Mongoose) and a throwaway in-memory MongoDB replica set (transactions on), seeded with the fictional demo data. Providers were forced to *simulated*, so no SMS, routing or weather call left the machine. The author's Atlas database was not touched. Driven through the real HTTP API with a separate cookie jar per signed-in person (admin, hospital staff, verifiers at two facilities, coordinator, donors); the driver scripts were throwaway and are not part of the repository.

## Result
**No application defect was found.** Every failure during the run traced to the test driver (wrong response shape, bodiless POST, page size over the 100 limit, reused donors still in cooldown) or to a deliberate protection, not to the code. The browser UI was **not** exercised (no browser was driven); only the API, the workers and the single-host serving of the built web app were.

## What was exercised and held
| Flow | Checked |
| --- | --- |
| Lifecycle | raise (trauma, critical suggested), duplicate review, verify, ranked alerts to the right three donors, accept x2, slots 2/2, third donor refused (409), en route, arrived, hospital confirms arrival, donated x2, request **closes itself** as fulfilled with 2 units, public check shows closed, audit entries present (42 checks) |
| SMS | reply codes distinct per donor; `YES <code>` accepts through the app path; repeat YES harmless; wrong code, unknown sender, nonsense text handled; missed call refreshes availability; audit entries |
| Decline / widen | three declines, then "alert more donors" alerts the next batch with the cooldown relaxed; declined donors are not re-alerted |
| Cancel / reject | cancel with an accepted donor releases them and queues the "no longer needed" SMS; reject closes as rejected; both visible on the public check |
| No-show / withdraw | hospital "did not arrive" frees the slot, records a strike, alerts the next donors; donor withdrawal frees the slot and cannot be resumed |
| Guard rails | same patient twice gives 409; different patient same group is allowed but flagged; an Idempotency-Key replays the same request; a missing key is refused; a deadline under 5 min is refused; admin cannot raise a request; another facility sees 404; signed-out sees 401; admin review pauses verification and shows "under review" publicly |
| Family | web lead, number code, hospital's **registered** number texted (no family details), wrong and unknown codes give the same generic error, vouch identical for known and unknown references, hospital confirm (once only), verify, alert, accept, arrive, donate; the family receives confirmed / alerted / accepted / on the way / arrived / closed texts, all sent, none containing donor or patient details; SMS-started lead, code by SMS, rejection text without the reason |
| Transport | ambulance point saved and shown on the task; relay creates two legs; leg 2 refused until leg 1 is handed over; receiving coordinator completes leg 1; request and donor status unchanged; leg 1 failure cancels the unstarted leg 2 |
| Hospital network | surplus offered, seen by the other facility (not as its own), cannot be withdrawn by the other facility; stock transfer requested, offered, dispatched, received; coordinators refused |
| Misuse | public report and donor one-tap report (repeat is a no-op, reporter not exposed); 3 facility strikes suspend it automatically, a suspended facility cannot raise requests, admin can reinstate; 3 coordinator strikes pause the account and sign it out everywhere; strikes refused for non-coordinators |
| Village relay | coordinator sees only the donor who opted in (name and number), not the one who did not; "I told the donor" recorded; coordinator cannot answer for a donor (403) |
| Background workers | escalation reached step 3 on schedule and texted the admin at steps 2 and 3 (no patient detail); the expiry worker closed an overdue request as *expired*; the missed-ETA worker released an accepted donor after ETA plus grace, recorded a strike, freed the slot and alerted the next donors |
| Roads | a verified blocked road near the hospital makes the ETA *unknown* (never guessed); dismissing it restores known ETAs |
| Serving | the built web app and its client-side routes load from the API server; unknown API paths return a JSON 404; CSP, nosniff and frame headers present |

## Behaviour that surprises a first-time user (documented in DEMO.md)
Duplicate review on a second same-group request; the 24-hour contact cooldown and 90-day rest exhausting demo donors; sign-up and sign-in rate limits; a blocked road making nearby times unknown (which also stops automatic no-show release); family texts refused for unconfirmed numbers.

## Not verified
- The browser UI itself (layout, forms, maps, the donor trip map) and WebSocket live updates.
- Real SMS (Twilio), real routing (OpenRouteService) and real weather (Open-Meteo): all were simulated.
- The nearest-road suggestion: the public map service was unreachable from the test machine, so only its clean "not reachable" response was seen.
- Anything against the author's Atlas database, and the facility CSV import.
