# Release Go / No-Go Checklist

Based on the blueprint's final checklist (Part I2). Tick each item by **inspecting the running system or the code**, and note anything unchecked. Automated tests were out of scope for this project (D-26), so every item below is a manual check. A "no" on any **Safety** item is a no-go for a public demo.

## Safety and authorization

- [ ] Only staff of an admin-verified facility can raise a request (try with a pending facility: refused).
- [ ] A request cannot reach any donor before a verifier verifies it (check **Admin → Notifications** and the donor's alerts right after creating one: nothing).
- [ ] The creator cannot verify their own request (`REQUIRE_SEPARATE_VERIFIER=true`).
- [ ] A family lead from `/help` creates no request and no alert until a hospital confirms it.
- [ ] Facility staff cannot open another facility's request (`404`).
- [ ] The public checker (`/check`) shows no patient, donor or contact details; unknown codes read "not found".
- [ ] Donor acceptance, arrival, donation, transport or stock receipt never closes a request — only the hospital's **Confirm fulfilled** does.
- [ ] A donor with an unknown last-donation date is listed for manual review and not alerted.
- [ ] Every sensitive action appears in **Admin → Audit log** with actor and reason.

## Correctness and reliability

- [ ] Submitting the new-request form twice quickly (or retrying after a network error) creates one request.
- [ ] A second request for the same patient at the same facility is refused; a similar one is flagged for duplicate review, not auto-rejected.
- [ ] Two donors accepting the last slot at once: exactly one succeeds, the other sees "enough donors have accepted".
- [ ] A request left alone escalates (≈5 / 10 / 15 min) and appears under **Admin → Escalations**; each step appears once.
- [ ] A request past its deadline closes as expired and travelling donors get the "no longer needed" message.
- [ ] Every travel time shows its source (live / cached / simulated / unknown) and weather note; a verified blocked road makes it "unknown".
- [ ] With the database stopped, `/api/health/ready` returns `503`, the footer says so, and no action reports success.
- [ ] Turning the network off shows the offline banner; reconnecting refreshes the data.

## Security and privacy

- [ ] No secrets in Git (`git log -p -- server/.env` finds nothing; `.env` is ignored) or in the built client (`grep -r "mongodb" client/dist` finds nothing).
- [ ] `NODE_ENV=production`, HTTPS, `TRUST_PROXY=true` behind a proxy, `CLIENT_ORIGIN` and `PUBLIC_APP_URL` are `https://`.
- [ ] `SESSION_SECRET` and `PATIENT_REF_SECRET` are different and not the example values.
- [ ] Login is rate-limited (the 11th wrong attempt in 15 minutes is refused).
- [ ] All data is fictional; no real patient or donor details in the database or screenshots.

## Demo operations

- [ ] Atlas (replica set) is used, not a standalone MongoDB.
- [ ] `npm ci && npm run build && npm start` works from a clean checkout; README steps match.
- [ ] Demo data is loaded with `npm run seed -w server` (development/demo database only — it refuses production), or set up by hand: one administrator, one verified facility, one verifier + one other staff member, a coordinator and 3+ verified donors with locations.
- [ ] The demo database is **not** the one used for anything real; the shared demo password is not reused elsewhere.
- [ ] Banners make clear what is simulated (SMS, and travel times/weather unless live providers are configured).
- [ ] The presenter knows the limitations below and says them out loud.

## Limitations to state in the demo

Synthetic data; simulated SMS (nothing is sent to phones, no delivery receipts, no SMS replies); travel times simulated unless live routing is configured; no zero-signal operation; not an official dispatch service and not a medical eligibility check; single-instance workers; no MFA or password reset; no clinical, legal or partner approval. See [security-review.md](security-review.md).
