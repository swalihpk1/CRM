# SmartCRM — Project Analysis

_Generated: 2026-09-04_

A single-tenant CRM for a sales/telecalling team: contact management, call
logging, follow-ups, meetings, demo tracking, and staff productivity
reporting. Built as a classic **FastAPI + MongoDB backend** with a
**React (CRA + shadcn/ui) frontend**, originally scaffolded by the "emergent"
platform (see `.emergent/emergent.yml`) and now deployed via Vercel.

---

## 1. Repository Layout

```
CRM/
├── backend/
│   ├── server.py                     # Entire API — 2,080 lines, one file
│   ├── requirements.txt              # Python deps (FastAPI, motor, pandas, etc.)
│   ├── .env                          # Mongo URI, JWT secret, SMTP, CORS (not committed — see §6)
│   ├── clean_import_function.py      # Standalone copy of the import-contacts route (dead code?)
│   ├── list_users.py                 # One-off script: dump all users
│   ├── update_user_role.py           # One-off script: set a single user's role
│   ├── update_all_roles.py           # One-off script: bulk role update
│   ├── update_assigned_staff_to_names.py  # One-off migration: email → display name
│   ├── backfill_assigned_staff.py    # One-off migration: backfill assigned_staff field
│   ├── venv/, venv38/, .venv/        # THREE separate virtualenvs checked into the tree
│   └── __pycache__/
├── frontend/
│   ├── src/
│   │   ├── App.js                    # Entire app — 5,696 lines, one file, ~20 components
│   │   ├── App.css, index.css, index.js
│   │   ├── components/ui/            # shadcn/ui primitives (46 files, Radix-based)
│   │   ├── hooks/use-toast.js
│   │   └── lib/utils.js
│   ├── craco.config.js               # CRA override (path aliases, webpack tweaks)
│   ├── tailwind.config.js, postcss.config.js, components.json
│   ├── package.json / package-lock.json
│   └── .env                          # REACT_APP_BACKEND_URL, GENERATE_SOURCEMAP
├── clean_import.py                   # Root-level duplicate of backend/clean_import_function.py
├── backend_test.py, backend_edge_test.py  # Ad-hoc Python test scripts (root, not in backend/)
├── test_result.md                    # "Emergent platform" testing-agent log (yaml-in-md protocol)
├── tests/__init__.py                 # Empty placeholder package
├── vercel.json                       # Deploy config (CRA framework + /api proxy rewrite)
└── README.md                         # One line: "# Here are your Instructions"
```

**Observation:** there is no root `package.json`/monorepo tool — `backend/`
and `frontend/` are independent projects glued together only by
`vercel.json`'s rewrite rule and the `.env` URLs.

---

## 2. Backend (`backend/server.py`)

### Stack
- **FastAPI** 0.110 + **Starlette**, served by **uvicorn**
- **MongoDB** via **motor** (async driver), database name from `DB_NAME`
- **JWT** auth (`PyJWT`), 24h expiry, `bcrypt` password hashing
- **APScheduler** — background job every 5 minutes to check/notify overdue follow-ups
- **aiosmtplib** — optional email notifications for follow-ups
- **pandas + openpyxl/xlrd** — Excel import/preview of contacts

### Architecture
Everything lives in **one 2,080-line file**: Pydantic models, auth helpers,
~45 route handlers, the scheduler job, and app startup/shutdown — no
routers/services/repository split, no `models.py`/`routes/` package.

### Data Models (Pydantic, all `extra="ignore"`)
`User`, `Contact` (with a free-form `data: Dict[str, Any]` bag for
dynamically-imported Excel columns), `Note`, `FollowUp`, `Meeting`,
`ActivityLog`, `Demo` — each with a matching `*Create`/`*Update` variant.
IDs are UUID4 strings (not Mongo `ObjectId`), timestamps are ISO-8601
strings in UTC.

### Auth & Authorization
- `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me`
- Role model: `staff` vs `admin` (`get_admin_user`, `get_staff_or_admin`
  dependencies gate routes)
- Bearer JWT via `HTTPBearer`; secret falls back to a **hardcoded default**
  (`'your-secret-key-change-in-production'`) if `JWT_SECRET` is unset — see §6.

### Route Groups (`/api` prefix)
| Area | Endpoints |
|---|---|
| Auth | signup, login, me |
| Users (admin-only) | list, create, update role, delete |
| Contacts | import (Excel), preview (Excel), list (paginated/search/filter), count, get/create/update/delete, log a call, `debug-data`, `test-search` (no auth) |
| Notes | create, list-by-contact |
| Follow-ups | create, list, upcoming, by-date, paginated, completed, mark complete |
| Meetings | create, list, get, update, update status, delete |
| Demos | create, mark watched, list-by-contact, report, summary |
| Activity log | list |
| Productivity | staff-summary, staff-details |

### Notable Implementation Details
- **Contact import** is dynamic: client uploads an Excel file + a JSON
  `column_mapping` (CRM field → spreadsheet column), so the schema of
  imported data is user-defined at runtime. There is also a `/contacts/preview`
  endpoint to dry-run the mapping before commit.
- **Phone normalization** (`normalize_phone`) is used for de-duplication.
- **Activity logging** (`log_activity`) is written to on most mutating routes
  for an audit trail (`activity-logs` endpoint).
- **Follow-up scheduler**: `check_followup_alerts()` runs every 5 min via
  APScheduler and emails staff about due/overdue follow-ups.
- **`GET /api/test-search`** is explicitly unauthenticated — looks like a
  debug leftover (see §6).
- No MongoDB indexes are created anywhere (`create_index` not found) despite
  filtering/searching contacts by phone, status, assigned staff, etc.

---

## 3. Frontend (`frontend/src`)

### Stack
- **React 19** on **Create React App**, built/overridden via **CRACO**
  (path aliases, likely `@/` → `src/`)
- **Tailwind CSS** + **shadcn/ui** (Radix UI primitives) — 46 pre-generated
  UI components in `components/ui/`
- **react-hook-form** + **zod** for forms/validation
- **axios** for API calls, **date-fns** for dates, **sonner** for toasts
- **react-router-dom** is a dependency but **not actually used for routing**
  — the whole app is one component tree gated by auth state (see below)

### Architecture
`App.js` is a **single 5,696-line file** holding ~20 components with no
routing library usage:
- `AuthContext` / `AuthProvider` / `useAuth()` — token stored presumably in
  localStorage, exposes `user`, `loading`
- `AuthPage` — login/signup screen
- `Dashboard` — the app "shell" once logged in; almost certainly manages an
  internal `activeView` state and switches between the view components below
  rather than using `<Routes>`
- View components (tab/page equivalents): `DashboardView`, `ContactsView`,
  `FollowUpsView`, `MeetingsView`, `ImportView`, `DemoReportsView`,
  `ActivityLogView`, `ProductivityView`, `UsersView`
- Modals: `ContactDetailModal`, `GlobalMeetingModal`, `ContactFormModal`,
  `UserFormModal`, `RoleChangeModal`
- `App()` renders `AuthPage` or `Dashboard` based on auth state;
  `AppWrapper()` wraps `App` in `AuthProvider` and is the default export

### API Communication
`BACKEND_URL = process.env.REACT_APP_BACKEND_URL` → `API = ${BACKEND_URL}/api`.
In production, `vercel.json` rewrites `/api/*` to
`http://www.crm.bookiebuddy.in/api/*` — **note the rewrite target is
plain `http://`, not `https://`** (see §6).

---

## 4. Root-Level Scripts & Testing Artifacts

- `backend_test.py` / `backend_edge_test.py` — large ad-hoc test scripts at
  repo root (not inside `backend/`, not using a `tests/` convention, no
  pytest config visible tying them together)
- `clean_import.py` (root) and `backend/clean_import_function.py` — appear
  to be **the same "cleaned" version of the contacts-import route**, kept as
  loose files rather than merged into `server.py` or deleted
- `test_result.md` — a YAML-in-Markdown log used by the original "emergent"
  scaffolding platform's main-agent/testing-agent protocol; not a hand-written
  doc, mostly template boilerplate plus historical entries
- `tests/__init__.py` — empty, no actual test modules
- `.emergent/emergent.yml` — records the base image and job id this project
  was generated from

This all points to a project that was **AI/no-code scaffolded** (emergent.sh)
and then hand-modified, with a fair amount of scaffolding residue never
cleaned up.

---

## 5. Deployment

- `vercel.json` sets `framework: create-react-app` and rewrites `/api/*` to
  an external backend host (`crm.bookiebuddy.in`) — so **Vercel hosts only
  the frontend**; the FastAPI backend is deployed/hosted elsewhere
  (the rewrite target, not Vercel functions).
- No `Procfile`, `Dockerfile`, or CI config found anywhere in the repo — the
  backend's actual deployment mechanism is undocumented in-repo.
- Recent git history (`Add various scripts for user and contact management`,
  `fix : in searching`, `optimized search query and added shop name to
  search`, `fix in vercel.json`) suggests active, incremental production
  maintenance rather than a stable release cadence.

---

## 6. Risks & Cleanup Opportunities

1. **Hardcoded JWT fallback secret** in `server.py` — if `JWT_SECRET` is ever
   unset in an environment, tokens become forgeable with a publicly-known
   default string.
2. **Unauthenticated debug endpoint** — `GET /api/test-search` has no
   `Depends(get_current_user)`; likely fine for local debugging but is live
   in the same file as production routes.
3. **`vercel.json` rewrite uses `http://`** for the backend proxy target,
   not `https://` — traffic between Vercel's edge and the backend is
   unencrypted.
4. **Three vendored Python virtualenvs** (`backend/venv`, `backend/venv38`,
   `backend/.venv`) committed under `backend/` — large, redundant, and a
   likely source of the "output too large" issue seen when listing this repo
   (hundreds of thousands of files). These should be `.gitignore`d/removed
   if not already ignored (worth double-checking `.gitignore` covers them —
   it currently does not appear to, based on `git status` showing clean with
   these present).
5. **No MongoDB indexes** defined despite several query-heavy endpoints
   (search by phone/status/assigned staff, pagination). At current data
   volume this may be fine; it will degrade as `contacts` grows.
6. **Duplicate/orphaned import logic** — `clean_import.py`,
   `backend/clean_import_function.py`, and the real
   `POST /api/contacts/import` in `server.py` — unclear which is
   authoritative; dead code risk.
7. **Both files are monoliths** — `server.py` (2,080 lines, ~45 routes, all
   models) and `App.js` (5,696 lines, ~20 components) have no internal
   module boundaries. This is the single biggest maintainability risk: any
   change requires navigating a huge single file, and merge conflicts will
   concentrate here.
8. **`react-router-dom` installed but unused** — routing is done via
   component state, not URL-based routes, so there's no deep-linking to a
   specific view (e.g. can't bookmark "Contacts" or "Follow-ups"), and
   browser back/forward doesn't work as a user would expect in a CRM.
9. **One-off migration scripts committed as permanent files** — `list_users.py`,
   `update_user_role.py`, `update_all_roles.py`,
   `update_assigned_staff_to_names.py`, `backfill_assigned_staff.py` all
   connect directly to Mongo and mutate data; several look like true one-time
   migrations (comments mention specific emails/values) that already ran and
   probably shouldn't be re-run or kept as if they were reusable tooling.
10. **`README.md` is a placeholder** (`# Here are your Instructions`) —
    no real setup/run instructions for either backend or frontend exist at
    the repo root; `frontend/README.md` is the default CRA readme.

---

## 7. Suggested Next Steps (not performed)

- Split `server.py` into `models.py`, `auth.py`, and per-resource routers
  (`routes/contacts.py`, `routes/followups.py`, etc.).
- Split `App.js` into one file per component/view, with `react-router-dom`
  actually driving navigation.
- Add `.gitignore` entries for `venv/`, `venv38/`, `.venv/`,
  `__pycache__/` if missing, and remove them from the tree.
- Add MongoDB indexes for `contacts.phone`, `contacts.status`,
  `contacts.assigned_staff_id`, `followups.follow_up_date`, etc.
- Remove or clearly mark the debug-only routes (`/test-search`,
  `/contacts/debug-data`) as dev-only, or delete them.
- Move one-off scripts into a `scripts/migrations/` folder with a note that
  they're historical and not meant to be re-run.
- Replace the JWT hardcoded fallback with a startup check that fails fast if
  `JWT_SECRET` is missing.
- Change the Vercel rewrite target to `https://`.
