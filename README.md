# SmartCRM (Bookie Buddy)

A CRM for managing contacts, follow-ups, meetings, demos, and staff
productivity — Excel import with dynamic column mapping, JWT auth, activity
logging, and a browser-notification follow-up alert system.

## Stack

- **Frontend**: React 19 (CRA via `@craco/craco`), Tailwind CSS, shadcn/ui
  (Radix), `react-router-dom` v7. See [`frontend/CLAUDE.md`](frontend/CLAUDE.md)
  for the full architecture (data-fetching hooks, routing, the shared
  `ContactDetailModal`, design system conventions, and known gotchas).
- **Backend (live)**: `backend-node/` — Node.js/Express + MongoDB. This is
  what the frontend actually talks to. See
  [`backend-node/CLAUDE.md`](backend-node/CLAUDE.md) for the full route
  reference, every deliberate divergence from the original Python service,
  and non-obvious gotchas (timestamp formats, response-shape whitelisting,
  Excel import edge cases, email validation rules).
- **Backend (legacy, frozen)**: `backend/` — the original FastAPI/Python
  service `backend-node` was ported from. **Not modified going forward, by
  explicit project instruction** — kept only as the historical reference
  the Node port was built to match. If you're deciding where a backend
  change goes, it goes in `backend-node/`, never here.

Both backends point at the same MongoDB database — see each backend's
`.env` for `MONGO_URL`/`DB_NAME` (not committed; ask for the connection
string rather than assuming a local Mongo instance).

## Running locally

**Frontend:**
```bash
cd frontend
npm install
npm start        # craco start — dev server
npm run build    # craco build — production bundle
```
Set `REACT_APP_BACKEND_URL` in `frontend/.env` to wherever `backend-node`
is running (its API is mounted under `/api`, so the frontend calls
`${REACT_APP_BACKEND_URL}/api/...`).

**Backend (backend-node — the one to run):**
```bash
cd backend-node
npm install
npm run dev       # nodemon src/server.js
npm start         # node src/server.js
```
Needs a `.env` with `MONGO_URL`, `DB_NAME`, `JWT_ALGORITHM`,
`CORS_ORIGINS`, `HOST`/`PORT` (defaults to `8000`), and optionally SMTP
settings for email follow-up alerts.

## Deployment

Deployed via Vercel — see [`vercel.json`](vercel.json) for the `/api/*`
rewrite. When changing anything under `frontend/public/`, remember that a
change only takes effect on the live site after it's committed, pushed,
and Vercel rebuilds — a stale deployed build can look like a regression
that isn't actually present in the current source.

## Project history

This project was originally scaffolded on the "emergent.sh" AI/no-code
platform (see [`PROJECT_ANALYSIS.md`](PROJECT_ANALYSIS.md) for the full
history) and has since been substantially rebuilt: the backend was ported
from Python/FastAPI to Node/Express (`backend-node/`, with the Python
original frozen), and the frontend was restructured from a single
5,696-line file into the routed, feature-folder structure documented in
`frontend/CLAUDE.md`. Platform scaffolding left over from the original
Emergent setup (tracking scripts, a "Made with Emergent" badge, build-job
metadata files) has been removed from both the app and the repo — see
`frontend/CLAUDE.md`'s "Removed platform scaffolding" section if any of
it ever reappears.

## Contributing / working in this repo

- Read the relevant `CLAUDE.md` (`frontend/CLAUDE.md` or
  `backend-node/CLAUDE.md`) before making a non-trivial change in that
  half of the app — both document real bugs that were found and fixed
  once already, and the reasoning is easy to accidentally undo without
  that context.
- Never modify `backend/` (the frozen Python service).
- Never run `git commit` or `git push` without the user explicitly
  confirming first, even if a commit message was already prepared or
  approved earlier in conversation.
