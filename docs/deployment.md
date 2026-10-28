# Deployment Guide

Golden Hour is a **demo / pilot-preparation build**: synthetic data, simulated SMS, no clinical or legal approval (see [security-review.md](security-review.md)). This guide gets one instance running safely on the internet for a demonstration. It is not a production-readiness statement.

## Recommended shape: one host, one origin

The API serves the built web app (`CLIENT_DIST_DIR`), so the page, `/api` and the WebSocket share one origin. That makes the session cookie work without cross-site settings and avoids CORS surprises.

```
Browser ──HTTPS──► Node host (Express API + built web app + Socket.IO + workers) ──► MongoDB Atlas
```

Any host that runs a long-lived Node process and supports WebSockets works (Render, Railway, Fly.io, a VM). **Avoid serverless/functions hosting and "sleeping" free tiers** for the real demo: the outbox, escalation and expiry workers and Socket.IO live inside the API process, and a sleeping process pauses them (queued SMS and escalations resume on wake, but nothing runs while asleep).

Run exactly **one instance**. Rate limits, WebSocket rooms and workers are in-process.

## 1. Database (MongoDB Atlas)

1. Create a free **M0** cluster (Atlas is a replica set, so transactions work — the standalone fallback in `withTransaction` weakens atomicity).
2. Database Access → create a user with read/write on one database.
3. Network Access → allow your host's outbound IP (or `0.0.0.0/0` for a short demo only, with a strong password).
4. Copy the `mongodb+srv://…/golden-hour?retryWrites=true&w=majority` string.

Indexes are created automatically when the API connects, or manually with `npm run db:indexes -w server`.

## 2. Environment variables (set in the host's dashboard, never in Git)

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Atlas string from step 1 |
| `SESSION_SECRET` | random, 32+ chars |
| `PATIENT_REF_SECRET` | a **different** random value, 32+ chars (the API refuses to start if equal) |
| `CLIENT_ORIGIN` | `https://your-domain` (must be `https://` in production) |
| `PUBLIC_APP_URL` | `https://your-domain` (used in SMS links; `https://` required) |
| `TRUST_PROXY` | `true` behind the host's load balancer — otherwise all visitors share one rate-limit bucket |
| `CLIENT_DIST_DIR` | `../client/dist` |
| `DEMO_MODE` | leave `false` (the API refuses `true` in production) |
| `PORT` | usually injected by the host |

Optional: `ROUTING_PROVIDER=openrouteservice` + `ORS_API_KEY`, `WEATHER_PROVIDER=open-meteo`. Everything else has a documented default ([architecture.md §9](architecture.md#9-configuration-environment-variables)). Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

The API validates all of this at startup and prints the **names** of missing or invalid variables, never their values.

## 3. Build and start

| Step | Command |
| --- | --- |
| Install | `npm ci` |
| Build | `npm run build` (bundles `server/dist` and `client/dist`) |
| Start | `npm start` (runs `node server/dist/server.js` with the server folder as working directory) |

Health checks: `GET /api/health/live` (process) and `GET /api/health/ready` (database; `503` while degraded).

## 4. First administrator

There is no public admin sign-up. Open a shell on the host (or run locally against the same `MONGODB_URI`) and run:

```bash
npm run create-admin -w server
```

Then sign in at `https://your-domain/login` and follow the README: add and verify a facility, create staff (one verifier and one other staff member, because a creator cannot verify their own request by default), register donors and verify them.

## 5. Proxy and WebSocket notes

- Terminate HTTPS at the host. The session cookie is `Secure` in production.
- The proxy must pass WebSocket upgrades on `/socket.io`. If it does not, the app still works: the footer shows "Live updates interrupted" and pages refresh every 15–60 s.
- Idle timeouts on proxies can drop sockets; the client reconnects and refetches automatically.

## 6. Split hosting (only if you must)

If the web app is on a static host and the API elsewhere, they must be on the **same site** (e.g. `app.example.org` and `api.example.org`) because the session cookie is `SameSite=Lax`. Build the client with `VITE_API_BASE_URL=https://api.example.org/api` and `VITE_SOCKET_URL=https://api.example.org`, set `CLIENT_ORIGIN` to the web origin, and add an SPA fallback (`/* → /index.html`) on the static host. Different registrable domains will **not** work without changing the cookie policy.

## 7. Rollback and disable

| Need | Action |
| --- | --- |
| Roll back a release | Redeploy the previous Git commit; the data model changes are additive (indexes are only added). |
| Stop all donor alerts immediately | Stop the process, or in **Admin → Requests** place active requests under review (pauses new alerts), and cancel them if needed. |
| Stop SMS | SMS is simulated and never leaves the system; nothing to disable. |
| Lock out a user | **Admin → Staff accounts** → suspend (sessions end immediately). |

## 8. Known deployment limitations

Single instance only; workers pause if the host sleeps; free Atlas tier has no backups; no MFA or password reset; OpenStreetMap public tile servers are for light use only; the optional routing and weather providers need outbound internet.
