# Pitch claims vs what is built

Honest status of each promise in the pitch deck. **"Built" means written, type-checked and linted. None of it has been run end to end by the author yet** — walk `DEMO.md` once before presenting.

Legend: ✅ built · ⚙️ built, needs configuration and a live test · ◐ built differently from the slide · ❌ not built

| Slide | Claim | Status | What is true |
| --- | --- | --- | --- |
| 8, 9, 19 | Request closes itself once filled | ✅ ◐ | Closes automatically when the **hospital confirms the last requested unit donated** (D-90). Acceptances alone never close it. Fewer units: staff close it by hand. |
| 9 | Hospital-only requests, code in every alert, "Is this real?" checker | ✅ | |
| 10 | Reachability map | ◐ | Counts by travel-time band and before/after deadline, not a map (donor homes are not plotted). |
| 10 | Only donors who can beat the deadline are alerted | ✅ | First batch excludes late arrivals; they join when the search widens. Unknown travel time is never excluded (D-87). |
| 10 | Weather-aware ETA | ⚙️ | Rain delay is real logic; weather is simulated unless Open-Meteo is configured. |
| 10 | Relay transport | ✅ | Two linked legs with a handover point. |
| 10, 22 | Nearest ambulance point | ✅ ⚙️ | Suggested from map data (OpenRouteService or OpenStreetMap), saved only on confirmation; reaches the family text and the transport task. Needs internet. |
| 11 | Eligibility, rest period, step-by-step alerts | ✅ | |
| 11, 18 | SMS YES/NO and missed-call availability | ⚙️ | Works against the simulator; Twilio webhooks are written but untested live. |
| 11, 13 | Village anchors relay alerts | ✅ | Opt-in per donor (D-88). |
| 12 | Timeline, no-show escalation, suggested urgency | ✅ | No-show after the donor's own ETA + 30 min, known ETAs only. |
| 12 | Multilingual SMS | ❌ | Planned. |
| 13 | Local coordinator: vouch, road status, transport, accountable | ✅ | Named and logged; strikes pause the account (D-89). |
| 13 | Hospital network, surplus units | ✅ | |
| 14 | Repeats within a window are blocked | ✅ | Refused for 60 min after a fulfilled request for the same patient (D-89); same active patient is always blocked. |
| 14 | Strikes, pause and review, one-tap report, audit | ✅ | |
| 15 | Family by SMS or web, number confirmation, hospital asked on its own number, status by SMS | ✅ ⚙️ | Hospital's registered number is texted (D-91). Real SMS needs Twilio. |
| 16 | Every case ends Closed with audit and SMS to the family | ✅ | |
| 17 | Contacts shared only after accepting | ✅ | Hospitals see a number only after acceptance; village relay needs the donor's own opt-in. |
| 18 | Escalation ladder, admin alerted | ✅ | Admins are also texted at steps 2 and 3 (simulated unless Twilio). |
| 18 | Fastest route, plain distance only as fallback | ✅ | Fallback is clearly labelled a rough guess. |
| 18 | Low-network mode | ◐ | SMS needs no data and pages are light, but there is no dedicated low-data mode. |
| 18 | AI-assisted intake | ❌ | Planned. |
| 20 | Donor web app with Leaflet | ✅ | Trip map after accepting (D-92). |
| 20 | Twilio, OpenRouteService, Open-Meteo | ⚙️ | Adapters exist; none tested with real keys. |
| 22 | WhatsApp bot, 108 link, e-RaktKosh, analytics, voice | ❌ | Future scope in the pitch itself. |
