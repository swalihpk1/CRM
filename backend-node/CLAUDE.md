# backend-node — project instructions

This is a Node.js/Express port of `../backend/server.py` (FastAPI + motor).
The port's entire reason to exist is **byte-for-byte behavioral parity** with
that Python file — same routes, same request/response shapes, same status
codes, same error message strings, same bugs-that-look-like-bugs-but-aren't.
The React frontend (`../frontend/src/App.js`) calls this API and was
deliberately never touched; it cannot tell which backend it's talking to.

**Before changing any route handler, read the corresponding section of
`../backend/server.py` first.** It is the source of truth, not this codebase.
If the two ever disagree on behavior (not architecture — behavior), that's a
bug in the port unless a comment in the Node code explicitly says otherwise.

## Do not "fix" these — they are intentional parity, not bugs

- `GET/PUT/PUT .../status/DELETE /meetings/:id` are scoped to
  `{id, user_id: req.user.id}` **even for admins** — an admin can list all
  meetings but can't fetch/edit/delete one they don't own by id. Only
  `GET /meetings` (list) is role-scoped normally. This asymmetry is real in
  the Python source.
- `/followups/by-date`, `/paginated`, `/completed` **silently drop** any
  followup whose contact was deleted. `/followups/upcoming` does the
  opposite — it embeds `contact: null` and still includes the followup, and
  its `overdue` array is **uncapped** while `upcoming` is capped to 20.
- `PUT /meetings/:id` does not set `updated_at` (no such field on the model)
  and returns `{message: "..."}`, not the updated document.
- `GET /contacts` search: if the search string contains digits, it does a
  full-table scan comparing normalized phone digits and **returns early**
  with an `$in` query if any match — the text `$or` fallback (regex across
  ~30 hardcoded `data.*` field-name case variants) never runs in that case.
- `$regex` search input is **not escaped** — a malformed regex (e.g. `(`)
  intentionally 500s on both backends. Escaping it would be a behavior
  change, not a fix.
- The productivity `fresh_calls` metric is a heuristic: it counts
  `activity_logs` rows where `action == "Updated contact"` and `details`
  matches `/assigned_staff/i`. This only works because `PUT /contacts`
  logs `Fields: ${Object.keys(updateData).join(', ')}`, which contains the
  literal substring `assigned_staff` when the auto-assign-on-status-change
  logic fires. **If you ever change that log string's format, this metric
  silently breaks.**
- `/test-search` is intentionally unauthenticated. `/contacts/debug-data`
  has no admin gate. Both are kept for parity, not because they're good API
  design.
- The JWT secret has a hardcoded fallback
  (`your-secret-key-change-in-production`, in `src/config/env.js`) that must
  stay identical to the Python source's fallback. This means a token issued
  by the Python backend is valid here and vice versa — that's deliberate,
  not a security oversight to "fix" by generating a random one.
- Every error response body is `{"detail": "..."}`, never `{"error": ...}`
  or similar — the frontend reads `err.response?.data?.detail` and even
  does substring matching on specific messages (e.g.
  `detail?.includes('already exists')` for the duplicate-contact-phone
  error). Changing an error message string is a frontend-breaking change.
- No unique index on `contacts.phone` — the Excel import path synthesizes
  phones like `contact_7` from a per-run row counter that resets every
  import, so a unique index would start throwing on the second import of a
  phone-less file. This is deliberate; see `src/config/db.js`.
- The full-table duplicate-phone scan (`existingNormalized` set, built by
  fetching every contact's `phone` field and normalizing in JS) is O(n) on
  purpose — it compares *normalized* phone digits, so `+91 98765 43210`
  correctly matches a stored `9876543210`. An indexed equality lookup on
  the raw `phone` field would miss that and silently start admitting
  duplicates. Don't "optimize" this without also adding a stored, indexed
  `normalized_phone` field plus a backfill migration.

## Timestamp format — this one WILL bite you

`src/utils/dates.js` has `nowIso()`, which reproduces Python's
`datetime.now(timezone.utc).isoformat()` format exactly:
`2026-09-04T10:23:45.123456+00:00` (microsecond precision, `+00:00` suffix)
— **not** JS's default `toISOString()` format
(`2026-09-04T10:23:45.123Z`, millisecond precision, `Z` suffix).

Every date-range filter in this codebase (`follow_up_date`, `created_at`,
`given_at`, `timestamp` ranges) does **string comparison** (`$gte`/`$lte`)
against these values, not real date comparison. Always generate timestamps
via `nowIso()` / `toPythonIso()` from `utils/dates.js`. Never use
`new Date().toISOString()` directly anywhere a value might be written to
Mongo or compared against a stored timestamp — the format mismatch breaks
range queries silently (a `Z`-suffixed string still sorts *close* to a
`+00:00`-suffixed one, so the bug won't jump out in casual testing, only in
edge cases near a boundary).

## response_model whitelisting — `utils/serialize.js`

FastAPI's `response_model=X` strips fields not declared on the Pydantic
model and serializes a missing `Optional[...] = None` as JSON `null`, not
an omitted key. `utils/serialize.js` has one picker per model
(`pickContact`, `pickFollowUp`, etc.) that does the same.

**Only apply a picker on a route that had `response_model` in the Python
source.** Routes that returned raw dicts (`/followups/upcoming`, `/by-date`,
`/paginated`, `/completed`, `/productivity/*`, `/contacts/debug-data`) must
pass Mongo docs through unpicked (minus `_id`). Applying a picker there, or
forgetting to apply one on a route that needs it, silently changes the
response shape without erroring — it will not be caught by a type checker,
only by comparing actual JSON against the Python backend.

## Excel import/preview — the two real bugs found so far

`utils/excel.js` reimplements pandas' `read_excel(..., dtype=str,
na_filter=False, header=0)` pipeline using the `xlsx` (SheetJS) package.
Two divergences were found and fixed by differential-testing against the
real Python backend — if you touch this file, re-run that kind of test
before trusting it:

1. **Trailing blank rows.** pandas/openpyxl never materializes a row past
   the sheet's actual last-populated row — a fully-blank row at the *end*
   of the data is simply absent from what pandas reads. A blank row in the
   *middle* is kept (openpyxl reads through the populated range). SheetJS's
   `sheet_to_json(..., blankrows:true)` keeps trailing blanks too, so
   `readWorkbook()` explicitly pops trailing all-blank rows before
   returning. Don't remove that trim.
2. **Sentinel value case-sensitivity.** There are TWO separate "this value
   means empty" rules in the pipeline, and they're intentionally different:
   `EMPTY_SENTINELS` in `excel.js` (`["", " ", "N/A", "n/a", "NA", "na",
   "NULL", "null", "None", "none"]`) is a **case-sensitive exact match**,
   used at the dataframe-cleanup stage. `NAN_LIKE` in `routes/contacts.js`
   (`["nan","none","null","na","n/a"]`) is **case-insensitive**, used later
   inside the per-row import loop when building `contact_data`. Don't merge
   these into one list — they really are different rules in the Python
   source.

## Email validation — must match Pydantic's `EmailStr`, not just RFC-ish regex

`routes/auth.js`'s `isValidEmail()` rejects emails whose TLD is in
`RESERVED_TLDS` (`test`, `local`, `localhost`, `invalid`, `onion`) — this
was a real gap found via differential testing: Pydantic's `EmailStr`
(via `email-validator`) rejects these as IANA special-use domains, but a
naive `x@y.z` regex does not. Confirmed cases: `a@b.test` is rejected,
`a@example.com` and `a@b.example` are **not** rejected (the reserved check
is against the final label only, not any substring). If you touch email
validation, re-verify against the Python backend with
`python -c "from pydantic import BaseModel, EmailStr; ..."` rather than
assuming — this space has non-obvious rules.

## Verified-safe patterns for testing changes

This backend shares a **live production MongoDB** with real users and ~3,200
real contacts (see `../backend/.env` / `backend-node/.env` — same
`MONGO_URL`). Never run destructive or bulk-write test code against it
without cleanup. The safe pattern used during the initial port validation:

1. Run both backends side by side (Python on one port, this one on
   another) against the same Mongo URL.
2. Create a **throwaway staff user** via the admin token (`POST /users`)
   for auth-flow testing — delete it when done (`DELETE /users/:id`).
   Do NOT use `POST /auth/signup` for test accounts — it's locked once any
   real user exists, by design.
3. For write-path tests (contacts, followups, meetings, demos), use
   **backend-specific unique identifiers** (e.g. a timestamp-derived phone
   number prefixed differently per backend) so importing/creating the "same"
   test fixture into both backends doesn't have one backend's write show up
   as a duplicate/conflict for the other — they share one database. This
   was the root cause of a false-positive "bug" during the initial port
   testing (see git history) — it was a test-harness collision, not a real
   product defect.
4. Always verify cleanup by re-checking `GET /contacts/count` and the
   admin's `GET /users` list return to their pre-test baseline before
   ending the session.

## Git / commit workflow

See the root `../CLAUDE.md`: never run `git commit` or `git push` without
the user explicitly confirming first, even if a commit message was already
approved earlier in the conversation.
