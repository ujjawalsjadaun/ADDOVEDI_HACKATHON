# Golden Hour: complete walkthrough

A guided tour of **everything the project does**, for explaining it to someone seeing it for the first time (a judge, a mentor, a teammate). It is organised as one story in ten acts, with extras at the end.

- Short version (about 6 minutes): [DEMO.md](DEMO.md). This file is the full tour (about 25 minutes if you do every act).
- Pitch promises versus what is built: [docs/pitch-vs-reality.md](docs/pitch-vs-reality.md).
- All people, facilities and phone numbers are fictional. SMS is **simulated** unless Twilio is configured: texts appear in *Admin → Notifications* and reach no phone.

---

## 0. The idea in three sentences

In the hill districts of Arunachal Pradesh the nearest donor on the map is not the nearest on the road, many villages have no data coverage, and forwarded blood requests can't be trusted. Golden Hour lets only **verified hospitals** raise requests, alerts **donors who can actually arrive in time** (ranked by road travel time, by app or SMS), and keeps a **public "Is this real?" check** so old or fake forwards stop working. Every decision is audited.

## 1. The picture to draw on a whiteboard

```
   FAMILY (web or SMS)                      HOSPITAL                         ADMIN
   asks, confirms number  ───────────►  staff raise / confirm        watches, escalates,
         ▲                              2nd person VERIFIES          suspends, audits
         │ status texts                          │
         │                                       ▼
         │                      ┌──── MATCHING ENGINE ────┐
         │                      │ eligibility + rest      │
         │                      │ road time + rain + roads│     VILLAGE COORDINATOR
         │                      │ can they beat deadline? │  ◄── relays alerts, vouches,
         │                      └───────────┬─────────────┘      marks roads, arranges
         │                                  ▼                    last-mile transport
         │                  ALERT: app + SMS "Reply YES K7P2"
         │                                  │
         │                        DONOR accepts (app / SMS / call)
         │                                  ▼
         └────────────  en route → arrived → HOSPITAL confirms donation
                                            ▼
                         last unit confirmed → request CLOSES itself
                                            ▼
                  public check now says "closed"  +  audit record

   Nobody accepts?  5 min widen search → 10 min tell hospital + text admin → 15 min admin calls nearby hospitals
```

## 2. Before you start

1. `npm run seed -w server` (safe to repeat).
2. Optional, to see escalation in a minute: `ESCALATION_STEPS_MIN=0,1,2,3` in `server/.env`.
3. While rehearsing set `REPEAT_REQUEST_WINDOW_MIN=0` (otherwise a second request for the same patient reference within an hour of a fulfilled one is refused, by design).
4. Optional live data: `ROUTING_PROVIDER=openrouteservice` + `ORS_API_KEY`, `WEATHER_PROVIDER=open-meteo`. Without them travel times say *simulated*.
5. `npm run dev` → http://localhost:5173. Use separate browser profiles for different people.

**Everyone's password is `DemoPass#2026!`.**

| Person | Login | Role |
| --- | --- | --- |
| Admin | `admin@demo.test` | oversees everything |
| Asha | `staff.a@demo.test` | hospital staff at Siang Hills District Hospital (cannot verify) |
| Vikram | `verifier.a@demo.test` | verifier at the same hospital |
| Bina | `verifier.b@demo.test` | verifier at Ridge Community Health Centre |
| Chimi | `coord@demo.test` | village coordinator for *Mebo village* |
| Donors | `donor1`…`donor7@demo.test` | `donor1` Pasighat town, `donor2` Mebo village (opted in to relay), `donor3` near Ridge, `donor5` resting after a recent donation, `donor6` last donation unknown, `donor7` not yet verified |

Facilities: Siang Hills District Hospital (verified), Ridge Community Health Centre (verified), Upper Valley Blood Bank (pending).

---

## Act 1. Trust: "Is this real?" (the public)  ·  2 min

**Show:** Home page → **Is this real?** → enter the sample request code printed by the seed (or any `GH-…` code).

**Say:** "Anyone holding a forwarded message can check it. They see status, hospital and blood group. No patient, no donor, no phone number."

**Also show:** try a made-up code (neutral "not found" answer, no hint whether it exists), and the **Report this** option on the checker (goes to the admin's *Reports* tab).

**Behind the scenes:** public, rate-limited, minimal data; codes are unguessable (40-bit).

## Act 2. The hospital raises a request  ·  2 min

**Sign in as `staff.a`.** *Requests → New request.*

**Show:** blood group O+, 2 units, deadline in ~2 hours, **Reason for blood: Trauma**.
Point at **Calculated urgency**: trauma and delivery are suggested as *critical* whatever the deadline; a planned transfusion is never suggested above *urgent*. The hospital confirms the urgency later.

**Say:** "Only a verified facility can do this. The patient reference is stored as a one-way hash, never in the clear."

**Try the safeguards (30 seconds):** submit the same patient reference again → refused (one active request per patient); raise a similar one → flagged *possible duplicate*, a verifier must decide. After a request for that patient is *fulfilled*, a new one is refused for an hour (the repeat window).

## Act 3. A second person verifies  ·  1 min

**Sign in as `verifier.a`** (the person who raised it cannot verify it). Open the request → **Verify request**, confirm the urgency.

**Say:** "No donor is contacted before this. A different, authorised person confirms the need."

**Also available:** **Reject**, **Cancel request**, **Resolve duplicate review**. An admin can **Place under review**, which pauses verification, alerts and escalation and makes the public check say "under review".

## Act 4. The matching engine  ·  3 min

On the request page open **Matching volunteers → Show ranked candidates**.

**Show and say, in this order:**
1. **"Can anyone get here in time?"** card: counts of eligible donors by road-time band and how many arrive before the deadline. "Counts only; no names or places, so we never reveal where donors live." (This is the *reachability* feature; it is a summary, not a map.)
2. **Ranked list**, each donor with a travel-time badge showing minutes and the **source** (live, cached, simulated, rough, unknown). "Ranked by road time, not straight-line distance."
3. A note if some donors are **held back because they would arrive after the deadline**: "Only donors who can beat the deadline are alerted first; the others join only if the search widens."
4. Who is *not* in the list and why: `donor5` (donated 30 days ago, rest period is 90), `donor7` (not verified), `donor6` (last donation unknown, goes on a *manual review* list and is never auto-alerted).

**Optional, 1 minute each:**
- **Rain:** set `SIMULATED_RAIN_MM_PER_HOUR=10`, restart, reload → minutes grow ~35% and a rain warning shows.
- **Blocked road:** as `coord@demo.test` open *Map & roads* → **Report road condition** between a donor and the hospital. Once it counts, that donor's time becomes *unknown* and they drop in the ranking ("unknown is never counted as reachable").

## Act 5. The alert, by app and by SMS  ·  3 min

**Sign in as `admin`** → *Notifications*.

**Show:** one SMS per alerted donor, with the hospital, blood group, deadline, the **request code**, a check link and **"Reply YES K7P2 / NO K7P2"**. The banner says SMS is simulated. Status words are honest: *sent* means the provider accepted it, never *delivered*.

**Now be the donor on a basic phone.** In *Simulate a donor's SMS reply* enter phone `+919000010001` and text `YES <code from the SMS>` → **Apply reply**.

**Say:** "This is the exact path a real text takes. One donor per slot is enforced by the database; a second YES, a full request or a busy donor are all handled." Try the same reply twice (same answer), `NO`, and a wrong word (polite hint).

**Also here:** **Simulate missed call** with a donor's phone → marks them *available today* (no data balance needed). Check the audit log afterwards.

**Escalation if nobody answers** (fast demo with `0,1,2,3`): *Admin → Escalations* shows the ladder: widen the search, tell the hospital to use its own blood bank, text the admin, admin calls nearby hospitals. The admin gets a text at steps 2 and 3.

## Act 6. The donor's side  ·  2 min

**Sign in as `donor1`.** *Alerts & donations*.

**Show:** the alert card (hospital, deadline, travel badge, "respond before…"), then if you did not use SMS: **I Can Donate (Accept)** / **Cannot Make It**. After accepting: the hospital's address and phone appear (revealed only now), a **map of the trip** (the donor's own rounded position, the hospital, a dashed straight line "not the road"), then **I'm On My Way** and **I Have Arrived at Facility**.

**Also show:** **This looks fake — report it** on an alert; **My profile** (consent switches for contact, location and village relay; location is truncated to ~1 km; availability toggle; blood group change forces re-verification).

**Say:** "The donor controls consent. Contacts are shared with the hospital only after they accept."

## Act 7. The bedside: confirm, donate, close  ·  2 min

**Back to `staff.a`**, request page → assignments panel:
1. **Confirm arrival** (the donor's own "arrived" is only a report).
2. **Donation completed** for each donor.

**Say:** "Only the hospital confirms a donation. When it confirms the last requested unit, the request **closes itself**: pending alerts cancel, travelling donors get a 'no longer needed' text, the family (if any) is told. If fewer units arrive, press **Confirm fulfilled** with the real number."

**Show the other branches:** **Did not arrive** records a no-show and a strike for the donor, frees the slot and (if still needed) alerts the next donors; a donor can **withdraw** with a reason. If an accepted donor misses their own estimated arrival time plus 30 minutes, the system releases the slot automatically, records the strike and alerts the next donors.

**Finish by reopening the public check:** it now says closed. "Stale forwards stop working." Open the **Timeline** at the bottom of the request: every step with who and when.

## Act 8. The family and the village  ·  4 min

**A family without the app (public):** *Ask for blood*. Fill the form; pick a hospital and note the line *"No data? Send an SMS instead: BLOOD O- Siang-HDH P1234"*. After submitting, a **Confirm your phone number** box appears.

**By SMS (simulator):** phone `+919000020001`, text `BLOOD O- Siang-HDH P1234` → a 6-digit code appears in *Notifications*; reply with just the code to confirm the number.

**Show in Notifications:** (a) the code text to the family, (b) a text to the **hospital's registered number** ("a family has asked… open the console"). "The hospital is asked on its own number, not the family's."

**Hospital side (`staff.a`):** *Family leads*: the lead shows **Number confirmed by SMS code**. **Confirm** (raises an official request, still needing verification) or **Reject**. The family gets status texts at each step: confirmed (with the nearest **ambulance point**), donors alerted, donor accepted, on the way, arrived, closed. "Texts go only to a number the family confirmed, and carry no patient or donor details."

**The village coordinator (`coord@demo.test`):**
- **Vouch for a family:** enter the reference the family gave them and how they know them. The hospital sees "Vouched by coordinator…" beside the lead (a signal; the hospital still decides).
- **Village relay:** shows open alerts for donors in *Mebo village* who opted in (`donor2`): name, number and the SMS reply code, to pass on by voice. **I told the donor** records it. "The coordinator cannot answer for the donor."
- **Map & roads:** report road conditions (blocked/restricted/open) that feed travel times.
- **Active requests** and **Transport** (next act).

## Act 9. Moving people and blood  ·  3 min

**Transport (`staff.a` → request page → Request transport):**
- **Pick up a donor** from their village. Tick **Relay** and name a handover point (e.g. across a river): two linked legs, two coordinators. Leg 2 stays locked until leg 1 is handed over; a failed first leg cancels the second.
- **Coordinator** (`coord`): *Transport* → claim → picked up → handed over; hospital staff confirm received. The task shows the facility's **nearest ambulance point**.
- Transport never changes the request's or the donor's status.

**Nearest ambulance point:** *Map & roads → Set vehicle access point* → click a spot → **Suggest nearest drivable road** → **Use this point** → save. It shows the distance, road name and source, labelled "estimated from map data, not a survey". (Needs internet; otherwise place the point by hand.)

**Hospital network (`staff.a`, then `verifier.b` for the other facility) → Stock transfers:**
- **Request stock** from another facility; the other side **Offers units / Declines**, then **Dispatched → Received**, all on one timeline.
- **Surplus units nearby → Share our surplus:** a facility shares spare units with an expiry window; others click **Request** (this creates a normal transfer the owner answers). "Less waste: surplus becomes visible."
- Receiving stock never closes a blood request by itself.

## Act 10. The admin's view: accountability  ·  3 min

**Sign in as `admin`.**
- **Overview:** facilities to verify, donors to verify, suspicious reports, overdue verifications, requests with no responders, escalations, queued/failed SMS.
- **Facilities:** add and verify a facility (every decision needs a reason). **Record false-request strike**: three strikes suspend the facility automatically (it can then no longer raise requests). The fake-request button also appears on a request's page.
- **Staff accounts:** create hospital staff/verifiers/coordinators (a coordinator gets a *village served*); **Pause / Suspend** (signs them out everywhere); **Record strike** on a coordinator (three pause the account).
- **Donors:** verify, review, see strikes (three missed donations within 180 days place a donor under review; nobody is banned automatically).
- **Reports:** suspicious-request reports from the public and from donors (donor reporters are anonymous to admins).
- **Requests / Escalations:** every request with its escalation history; place under review.
- **Notifications:** the whole SMS outbox with retry on failures; the two simulators.
- **Audit log:** every request, accept, cancel, decision and strike with who, when and why.

**Say:** "Role checks are enforced on the server, not just hidden in the screens. Every sensitive action needs a reason and is logged."

---

## Behind the scenes: talking points

- **Rules, not magic:** eligibility (blood group exact or compatible, 90-day rest, availability fresh within 30 days, 24-hour contact cooldown), deadline-aware ranking, alerts in batches of three that expire in five minutes, widening on a timer.
- **Race-safe:** two donors can never claim the same unit; the database enforces it. Repeated clicks and retried requests are safe (idempotency keys).
- **Honest uncertainty:** every travel time shows its source; unknown stays unknown; simulated is labelled simulated; "sent" is never "delivered".
- **Privacy:** donor location is rounded to ~1 km and visible only to the donor; hospitals get a donor's number only after acceptance (the village relay needs the donor's own opt-in); the public check shows no private data.
- **Fail-safe:** if routing is down, a clearly labelled rough estimate is used; if SMS fails it is retried with back-off and visible to the admin; critical cases escalate to humans.
- **One server:** Express API + React app on one host; Socket.IO for live updates with polling fallback.

## What is real and what is not (say it out loud)

- **Real:** the workflow, the rules, the role checks, the audit trail, the ranking logic, the data model.
- **Simulated unless configured:** SMS (Twilio adapter and webhooks are written but untested live), travel times (OpenRouteService optional), weather (Open-Meteo optional).
- **Data:** donors, patients and phone numbers are fictional. The 44 facilities in `data/osm-arunachal-health.csv` are real OpenStreetMap data (import with `npm run import:directory`; they come in *pending*).
- **Not built:** multilingual SMS, a dedicated low-data mode, WhatsApp bot, AI-assisted intake, 108 ambulance link, e-RaktKosh stock integration, hotspot analytics, voice requests. All are marked future in the pitch except the first two, which are planned.
- **Never run end to end by the author at the time of writing.** Walk this script once before presenting.

## If something goes wrong on stage

| Symptom | Do |
| --- | --- |
| No donors in the ranked list | Check the request is verified and the donors are `donor1`–`donor4`; re-run the seed. |
| Travel badges say "simulated" | Expected without an OpenRouteService key; say so. |
| Suggest nearest road fails | The map service is unreachable; place the point by hand. |
| Raising a second request is refused | The repeat window; set `REPEAT_REQUEST_WINDOW_MIN=0`. |
| Village relay is empty | Only opted-in donors in the coordinator's village show; `donor2` has an open alert only while one is pending. |
| Escalation seems slow | Defaults are 5/10/15 minutes; use `ESCALATION_STEPS_MIN=0,1,2,3`. The worker checks every 15 seconds. |
| Verify is refused with "resolve the possible-duplicate review" | A second same-blood-group request at the same hospital needs **Resolve duplicate review** first. This is by design. |
| No donor alerted on a repeat run | Donors alerted in the last 24 h are skipped, and donors who donated rest for 90 days. Use another blood group, or lower `CONTACT_COOLDOWN_HOURS` / `DONATION_REST_DAYS`. |
| "Too many attempts" | Sign-up (5/hour) and sign-in rate limits; restart the server to clear them. |
| Family status texts show "failed" | The family never confirmed the code, so the number is not texted (PHONE_NOT_CONFIRMED). |
| Donor's travel time shows *unknown* | A blocked road is reported near the route; dismiss the road report. |
