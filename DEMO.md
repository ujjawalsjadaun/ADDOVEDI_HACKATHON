# Golden Hour: demo script

All people, facilities and phone numbers are fictional. Every account uses the password `DemoPass#2026!`.
SMS is **simulated** unless you configured Twilio: messages appear in *Admin → Notifications* and reach no phone.

## Before you start
1. `npm run seed -w server` (safe to repeat).
2. Optional, for a faster escalation demo, put `ESCALATION_STEPS_MIN=0,1,2,3` in `server/.env` (default is `0,5,10,15`). While rehearsing, also set `REPEAT_REQUEST_WINDOW_MIN=0`: otherwise raising a second request for the same patient reference within an hour of a fulfilled one is refused (by design).
3. Optional, for live road times: `ROUTING_PROVIDER=openrouteservice`, `ORS_API_KEY=…`, `WEATHER_PROVIDER=open-meteo`. Without them travel times say *simulated*.
4. `npm run dev`, open http://localhost:5173. Use separate browser profiles (or private windows) for different roles.

## Rehearsal gotchas (found by running the flows)
These are all deliberate protections, but they surprise you the second time through:
- **"Possible duplicate" on a second request.** Any new request with the same blood group as another still-active request at the same hospital (within a few hours) is held until a verifier presses **Resolve duplicate review** and picks *separate need*. The seed leaves an O+ sample request open, so your first O+ request will need this extra click. Say: "a person decides, the system never silently drops a request."
- **Donors are used up.** A donor alerted in the last 24 hours is skipped for the first batch of the next request, and a donor who donated is resting for 90 days. For repeat rehearsals use a different blood group each time, or set `CONTACT_COOLDOWN_HOURS=1` and `DONATION_REST_DAYS=1` in `server/.env`, or reset the database and re-seed.
- **Rate limits.** Sign-up allows 5 per hour and sign-in is limited per account; after many rehearsal sign-ins you get "Too many attempts". Restarting the server clears them.
- **A blocked road stays blocked.** A road report you add during the demo makes nearby donors' travel times *unknown* until it expires or you dismiss it (*Map & roads*), and an *unknown* time is never auto-released as a no-show.
- **Family texts only go to confirmed numbers.** If the family skips the code step, the status texts show as *failed: PHONE_NOT_CONFIRMED* in Notifications. That is the safeguard working.
- **Ambulance-point lookup needs internet.** Without it you get a polite "place the point by hand" message.

## The main story (about 6 minutes)
| # | Who | Do | Say |
| --- | --- | --- | --- |
| 1 | Public | Home → **Check a request code** with the sample code the seed printed (or `GH-…` from step 2) | "Anyone can check a forwarded request. It shows status, facility and blood group, nothing private." |
| 2 | `staff.a@demo.test` | **New request**: O+, 2 units, *Reason: Trauma*, deadline in ~2 h | "Only a verified facility can raise one. Trauma is suggested as critical; the hospital confirms." |
| 3 | `verifier.a@demo.test` | Open the request → **Verify**, confirm urgency | "A second person verifies. No donor is contacted before this." |
| 4 | same | **Matching volunteers → Show ranked candidates** | "Ranked by road travel time, not distance. Each estimate shows its source. The card counts who can arrive before the deadline." |
| 5 | `admin@demo.test` | **Notifications** | "Each donor got an SMS with the code and *Reply YES K7P2*. In this demo SMS is simulated." |
| 6 | admin | In *Simulate a donor's SMS reply*: phone `+919000010001`, text `YES <code from the SMS>` → **Apply reply** | "This is the same path a real reply takes: one donor per slot, enforced by the database." |
| 7 | `donor1@demo.test` | Donor home → **On my way**, then **I have arrived** | "The donor's own report." |
| 8 | `staff.a` | Request page → confirm arrival → **Donated** for each donor | "Only the hospital confirms a donation. When it confirms the last requested unit, the request closes itself." (If fewer units arrive, press **Confirm fulfilled** with the real number.) |
| 9 | Public | Check the code again | "The forward now says closed, so stale requests stop working." |

## Side stories (pick what the audience cares about)
- **Nobody accepts:** with step 2 settings above, wait a minute: the ladder shows widening, admin alerted, then administrators step in (*Admin → Escalations*).
- **Rain:** `SIMULATED_RAIN_MM_PER_HOUR=10`, restart, reload candidates: minutes grow and a rain warning shows.
- **Blocked road:** `coord@demo.test` → *Map & roads* → report a blocked road between a donor and the hospital; once it counts, that donor's time becomes *unknown* and they drop in the ranking.
- **Ambulance point:** *Map & roads* → click a spot → **Suggest nearest drivable road** → **Use this point** → save. It is an estimate from map data (needs internet; otherwise place the point by hand).
- **Family by SMS:** *Admin → Notifications → Simulate*: phone `+919000020001`, text `BLOOD O- Siang-HDH P1234` → a 6-digit code appears in the outbox → reply with it → staff (`staff.a`) see the lead as *Number confirmed* → confirm it → the family gets status texts.
- **Missed call:** same simulator, **Simulate missed call** for a donor phone: marks them available today.
- **Village relay:** `coord@demo.test` (serves *Mebo village*) → *Village relay* shows `donor2`'s open alert to pass on by voice. Only donors who ticked "a village coordinator may pass alerts on to me" on their profile appear (the seed ticks it for `donor2`).
- **Relay transport:** on a request with an accepted donor → **Request transport** → tick *Relay* → two coordinators, leg 2 locked until leg 1 is handed over.
- **Surplus units:** *Hospital → Stock transfers → Share our surplus*.
- **Misuse:** admin request page → *This request is fake* records a strike; three strikes suspend the facility. Admin → Staff accounts → *Record strike* does the same for a coordinator (three pause the account). A donor can tap *This looks fake* on an alert.
- **Deadline:** a donor estimated to arrive after the deadline is not in the first batch; the candidate list says how many are held back until the search widens.
- **Family on its own number:** a new family request also texts the facility's registered number; at escalation steps 2 and 3 the admin is texted (see *Admin → Notifications*).
- **Donor map:** after `donor1` accepts, their page shows a map of the trip.

## What is real and what is not (say this out loud)
- Real: the workflow, rules, audit trail, ranking logic, role checks.
- Simulated unless configured: SMS (Twilio optional), travel times (OpenRouteService optional), weather (Open-Meteo optional).
- Data: donors, patients and phone numbers are fictional. Facility locations from `data/osm-arunachal-health.csv` are real OpenStreetMap data.
- Not built: multilingual SMS, WhatsApp bot, AI intake, 108 link, e-RaktKosh integration (all marked future in the pitch), a dedicated low-data mode.
- Never run end to end by the author at the time of writing: walk this script once before presenting.
