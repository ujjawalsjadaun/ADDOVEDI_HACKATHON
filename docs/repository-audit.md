# Repository Audit — Golden Hour (PS-04)

**Phase:** 0 — Repository inspection
**Date:** 2026-10-28
**Source of requirements:** *Golden Hour — Engineering Blueprint and Claude Prompts* (blueprint) and the *Golden Hour — PS-04 Pitch* deck it summarises.

## 1. Current state (evidence)

| Check | Command | Result |
| --- | --- | --- |
| Working directory contents | `ls -la`, `find . -maxdepth 3` | Empty. No source, manifests, lockfiles, env files, tests or deploy config. |
| Git repository | environment check | Not a git repository before this phase. |
| Git | `git --version` | 2.52.0.windows.1 |
| Git identity | `git config --global user.name` | Configured (name + email present) |
| Node.js | `node --version` | v24.19.0 |
| npm | `npm --version` | 9.7.2 (older than the npm bundled with Node 24; works, upgrade optional) |
| pnpm / yarn | `--version` | Not installed |
| MongoDB server / shell | `mongod --version`, `mongosh --version` | Not installed |
| Docker | `docker --version` | Not installed |
| GitHub CLI | `gh --version` | Not installed |
| OS | environment | Windows 11, project path is inside OneDrive |

**Conclusion:** This is a greenfield project. Blueprint assumption A1 ("existing repo wins") has nothing to preserve, so the blueprint's proposed layout (Part D2/D3) becomes the actual layout rather than a guess.

## 2. Baseline

- No tests, lint, typecheck or build exist yet — there are no baseline failures to record.
- No user changes to preserve.

## 3. Proposed stack (blueprint-aligned, to be frozen in Phase 1)

| Concern | Choice | Reason |
| --- | --- | --- |
| Repo shape | npm workspaces monorepo: `client/`, `server/`, `docs/` | npm is the only package manager installed; one install, one lockfile |
| Frontend | React + TypeScript + Vite + Tailwind CSS | Named in blueprint D1 |
| Backend | Node + Express + TypeScript | Named in blueprint D1/D3 |
| Database | MongoDB via Mongoose | Named in blueprint D4 |
| Validation | Zod (shared schemas where practical) | Server-side schema validation (D9) |
| Realtime | Socket.IO | Named in blueprint D8 |
| Maps | Leaflet + OpenStreetMap tiles | Named in blueprint; no key needed |
| Routing ETA | Adapter; simulated by default, real provider optional | A5, D7 |
| Weather | Adapter; Open-Meteo (keyless) or simulated | D7 |
| SMS | Adapter; simulated by default | A4, D8 |
| Tests | Vitest + Supertest + `mongodb-memory-server` (replica-set mode) | Runs without a local MongoDB install; replica set enables transaction tests |

## 4. Risks and blockers found in Phase 0

| # | Finding | Impact | Proposed handling |
| --- | --- | --- | --- |
| R1 | No local MongoDB and no Docker | Cannot run a dev database locally as-is | Use MongoDB Atlas free tier for dev/demo (it is a replica set, so transactions work — resolves A8). Use `mongodb-memory-server` in replica-set mode for automated tests. |
| R2 | No `gh` CLI | Cannot create the GitHub repo from the terminal | User creates an empty GitHub repo and supplies the remote URL; pushes use plain `git push`. |
| R3 | Project lives in a OneDrive-synced folder | OneDrive syncing `node_modules` is slow and can lock files during installs | Acceptable for now; consider excluding the folder from OneDrive sync or moving the repo outside OneDrive. |
| R4 | npm 9.7.2 with Node 24 | Minor; workspaces are supported | Optional: `npm install -g npm@latest`. |
| R5 | No SMS / routing provider credentials | Real integrations unverifiable | Simulated adapters by default and clearly labelled (A5, J3). |

## 5. Commit strategy

One or more commits per phase, each at a passing gate (blueprint J1 step 9):

1. `chore: phase 0 repository audit and requirements traceability`
2. `docs: phase 1 architecture, contracts and state machines`
3. `feat: phase 2 app shell and validated config`
4. … one stable commit (or small series) per later phase.

Commit messages follow Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`). Each push happens only after that phase's verification step passes.

## 6. Decisions (confirmed by user, 2026-10-29)

1. **GitHub remote:** user will create an empty repository and supply the URL; until then commits stay local.
2. **Database:** MongoDB Atlas free tier for development and demo (replica set, so transactions are available). Connection string lives only in the git-ignored `server/.env`. Automated tests use `mongodb-memory-server` in replica-set mode.
3. **Branching:** commit directly to `main`, one or more commits per phase, each at a passing gate.
