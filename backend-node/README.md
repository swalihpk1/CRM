# SmartCRM Backend — Node.js / Express

Node.js + Express port of the original FastAPI/MongoDB backend in
[`../backend`](../backend). Same MongoDB database, same `/api/*` route paths,
methods, request/response shapes, and error message strings — the React
frontend requires **no changes** to work against this server.

## Why this exists alongside `../backend`

The Python backend (`../backend/server.py`) still holds several actively-used
one-off maintenance scripts (`backfill_assigned_staff.py`, `update_user_role.py`,
etc.) that have no Node equivalent, so it was left untouched. This directory
is a full, independent reimplementation you can run side-by-side with the
Python server against the same database to compare behavior before cutting
over.

## Setup

```bash
cd backend-node
npm install
cp ../backend/.env .env   # already done — every variable name is reused as-is
npm run dev                # nodemon, auto-restart
# or
npm start                  # plain node
```

Required env vars (same names as the Python `.env`): `MONGO_URL`, `DB_NAME`,
`JWT_SECRET`, `JWT_ALGORITHM` (read but not actually used — see below),
`CORS_ORIGINS`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `HOST`,
`PORT`.

## Deployment

[`../vercel.json`](../vercel.json) only rewrites `/api/*` to an external host
(`http://www.crm.bookiebuddy.in/api/*`) — no Vercel Function is involved, and
this port does not touch that file. To go live, this server just needs to be
deployed at whatever host that rewrite points to; that deployment step itself
is out of scope here.

## The one intentional behavioral deviation

The Python entrypoint hardcoded `uvicorn` to `0.0.0.0:8000` and **ignored**
the `HOST`/`PORT` env vars present in `.env`. This server **honors**
`HOST`/`PORT` (defaulting to the same `0.0.0.0`/`8000`), since that's clearly
the env file's intent. Every other route, status code, error message, and
data shape is deliberately preserved exactly — including some odd-looking
behaviors (self-scoped meeting lookups even for admins, followups whose
contact was deleted being silently dropped from some list endpoints but not
others, an unauthenticated `/test-search` debug route, a hardcoded JWT
fallback secret). See the code comments in each route file for why each one
was kept as-is rather than "fixed."

## Notes on the JWT secret

`JWT_SECRET` falls back to the same hardcoded literal string the Python
backend used if the env var is unset. This is intentional: since the JWT
payload shape (`{user_id, email, exp}`), algorithm (`HS256`), and secret all
match, **tokens issued by the old Python backend remain valid against this
server** — users stay logged in across a cutover with no forced re-login.

## Verification

See the plan's verification section for the full manual test checklist. The
short version: run this server on a different port than the Python one
(e.g. `PORT=8001`), point them at the same MongoDB, and diff responses
route-by-route — including with the existing `../backend_test.py` /
`../backend_edge_test.py` scripts re-pointed at this server's port.
