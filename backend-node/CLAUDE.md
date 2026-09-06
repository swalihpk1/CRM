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

**Explicit, deliberate exception:** by user instruction, `../backend/`
(the old Python backend) is never to be modified going forward, even to
keep parity. New frontend-driven functionality that requires backend
support is added ONLY here, in `backend-node/`, and is allowed to diverge
from `server.py`. First instance: `/followups/paginated` and
`/followups/completed` no longer accept/use `date_filter`/`custom_date` at
all — the frontend (`FollowUpsPage.jsx`'s `rangeForFilter()`) resolves
every quick filter (today/yesterday/last_week/etc.) to concrete dates
itself and always sends only `from_date`/`to_date`. `utils/dates.js`'s
`buildDateRange()` checks `fromDate`/`toDate` FIRST, independent of
`dateFilter` — a plain range works without also passing a filter keyword.
This does not exist in `../backend/server.py` and must not be backported
there. `/followups/by-date` is untouched and still keyword-driven
(`today`/`tomorrow`/`this_week`/`next_week`/`all`), matching Python
exactly, since nothing has migrated it off keywords yet.

Second instance: `/followups/completed` also gained optional `skip`/`limit`
query params (paged the same way `/followups/paginated` already was) —
Python always returns the full unpaginated list here. Passing neither
param preserves the exact original (unpaginated) behavior; the frontend's
`FollowupList`/`FollowUpsPage` always passes both now, 15 at a time. Both
`/followups/paginated` and `/followups/completed` also gained
`total_count` (and `/paginated` an `overdue_count`) in their JSON response
— extra fields Python's response shape doesn't have, added so the
frontend's stat cards can show accurate totals without fetching every
page. Since Pydantic's `response_model` isn't a concept here and neither
route uses a `pickX` serializer (see the response_model section below —
these routes return raw dicts even on the Python side), adding fields is
safe; it wouldn't be if a picker were involved.

Third instance: `/followups/paginated` also gained an optional `status`
query param (`'pending'` or `'overdue'`) that narrows the query to just
that status; omitting it keeps the original combined `{$in:['pending',
'overdue']}` behavior exactly. Added because the frontend now renders the
Pending tab as two independently-paginated sections — "Overdue" and
"Pending" — each hitting this endpoint with its own `status` value, since
sorting overdue-group-first in one combined list buried pending items
hundreds of items deep when overdue counts are large.

Fourth instance: `/followups/paginated` and `/followups/completed` also
gained an admin-only `created_by` query param (a `user_id`) that filters
the list down to follow-ups scheduled by that one staff member. It's
silently ignored for non-admins — they're already forced to their own
`user_id` by the existing role check, so `created_by` only ever applies in
the `else if` branch reached solely by admins. Lets an admin filter the
Follow-ups page by which staff member created each follow-up.

Fifth instance: `PUT /followups/:followup_id` and
`DELETE /followups/:followup_id` are entirely new routes — the Python
source has no generic edit/delete for a follow-up, only
`PUT .../complete` (which itself has no ownership check at all — anyone
authenticated can complete anyone's follow-up). These two new routes are
scoped to creator-or-admin (403 for anyone else, 404 if the id doesn't
exist) — confirmed as the intended access level even though it's stricter
than the existing Complete route's "anyone" policy on the same resource.
`PUT` accepts `follow_up_date`/`notes`; a request with neither is a 400.
Both log activity the same way the other followup mutations do.

Sixth instance: `GET /activity-logs` gained optional `from_date`/`to_date`
query params (a backend-node-only addition) so the Activity Log page can
filter to a specific date or range. Omitting both preserves the original
unfiltered-by-date behavior exactly. Uses `dayStart`/`dayEnd` from
`utils/dates.js`, not a raw `new Date().toISOString()`, since `timestamp`
is stored in the `+00:00`-suffixed microsecond-precision format and a
mismatched format would silently miss boundary rows.

Seventh instance: `PUT /followups/:followup_id/complete` now also sets a
new `completed_at` field (via `nowIso()`) alongside `status: 'completed'`
— the original model only ever recorded THAT a follow-up was completed,
never when. `/productivity/staff-summary`'s "Follow-ups Completed" count
was changed to filter by `completed_at` instead of `created_at`, per
explicit user correction: counting by `created_at` meant a follow-up
created last month but completed today would never appear in today's
"Completed" count, even though the completion itself happened today.
Confirmed intent: the column should reflect when the follow-up was
actually completed. Caveat: `completed_at` only exists on follow-ups
completed after this change shipped — there is no historical backfill, so
completions from before this fix will undercount in whatever period they
'should' count toward. The "Follow-ups Created" count and the
`staff-details` `followups` drill-down correctly keep filtering by
`created_at` — only the "Completed" summary count changed.

Eighth instance: two new admin-only routes on users, both backend-node-
only, not in the Python source: `PUT /users/:user_id` (edits `role` via
the newer Edit User modal — functionally the same guard/behavior as the
older `PUT /users/:user_id/role`, which is untouched and still works
standalone) and `PUT /users/:user_id/reset-password` (admin sets a new
password directly for that user, no email/reset-link flow — confirmed as
the intended UX for this admin-only screen). Both log activity. (A `name`
field was tried and explicitly reverted per user instruction — the user
model has no name field; users are identified by email only.)

Ninth instance: `PUT /notes/:note_id` and `DELETE /notes/:note_id` are
entirely new routes, not in the Python source (which has no generic
edit/delete for a note) — same creator-or-admin authorization pattern as
the equivalent follow-up routes (403 for anyone else, 404 if the id
doesn't exist). Both log activity ('Updated note'/'Deleted note').

Tenth instance: `GET /activity-logs` gained an optional `target` query
param (a backend-node-only addition) that scopes the log to one contact
by phone number — `target` is consistently set to the contact's phone
across contacts/notes/followups logging (verified across every
`logActivity` call site), so filtering by it correctly scopes a contact's
full activity history. Used by ContactDetailModal's new expandable
"Activity" section. Omitting it preserves the original unfiltered
behavior exactly.

Eleventh instance: `PUT /contacts/:contact_id`'s activity-log `details`
string, when `status` is one of the changed fields, now reads
`"...Status changed to: <new status>"` instead of the old generic
`"...Fields: status, data"` listing. Backend-node-only — the Python
source never included the new value at all. The frontend
(`activityFormatters.js`'s `formatAction`/`formatDetails`) regex-matches
`Status changed to:\s*([^,]+)` to show "Status Updated to X" in both the
standalone Activity Log page and ContactDetailModal's Activity panel; the
old generic "Fields: ..." string is still produced (and still parses,
falling back to "Status Updated"/"Contact status changed") for any
edit that changes other fields but not status, so no historical logs are
broken by this format change.

Twelfth instance: `GET /followups` gained an optional `contact_id` query
param (a backend-node-only addition) that, when present, returns every
follow-up ever scheduled against that contact regardless of who created
it (bypassing the normal non-admin `user_id` scoping) and sorted
most-recent-first (`completed_at` for completed follow-ups, else
`follow_up_date`) instead of the original ascending `follow_up_date`
sort — omitting `contact_id` preserves the exact original behavior.
`pickFollowUp()` also gained a `completed_at` field on every response
(additive only — every other field is unchanged, so this does not break
any consumer treating the old field set as exhaustive). Used by
ContactDetailModal's new per-contact follow-up history list.

Thirteenth instance: `PUT /contacts/:contact_id`, when it triggers the
"auto-assign an unassigned contact" logic, now ALSO logs a dedicated
`'Assigned contact'` activity entry (target = contact phone, details
`"...Assigned to: <staff>"`) in addition to the existing `'Updated
contact'` log — backend-node-only, no Python equivalent. The Productivity
"Fresh Calls" metric (`GET /productivity/staff-summary` and
`GET /productivity/staff-details?metric_type=calls`) now counts/lists this
action directly instead of regex-matching the literal substring
`assigned_staff` inside `'Updated contact'`'s free-text `details` string.
That regex approach broke silently (always counted 0) the moment the
Eleventh instance above changed `details` to say `"Status changed to: X"`
for the common case of a status change happening alongside the
assignment — a dedicated action string doesn't have this fragility.

Fourteenth instance: `GET /productivity/staff-details` gained a new
`metric_type=followups_completed` option (backend-node-only) — like the
existing `followups` type but filtered/sorted by `completed_at` instead
of `created_at`, matching the summary count's semantics (see Seventh
instance). Used to make the Productivity page's "Follow-ups Completed"
count clickable, consistent with the other three metric columns.

## Do not "fix" these — they are intentional parity, not bugs

- **CHANGED from Python parity, by user instruction:** `GET/PUT/PUT
  .../status/DELETE /meetings/:id` were originally scoped to `{id,
  user_id: req.user.id}` even for admins (an admin could list all meetings
  via `GET /meetings` but couldn't fetch/edit/delete one they didn't own
  by id) — that asymmetry is real in the Python source. It was
  **deliberately widened here**: an admin (`req.user.role === 'admin'`)
  now queries by `{id}` alone on all 4 of these routes, matching how
  `GET /meetings` (list) already worked for admins. Non-admins are
  unchanged — still scoped to their own `user_id`. Do NOT backport this
  widening to `../backend/server.py` (see the explicit exception at the
  top of this file) and do NOT revert it here thinking it's restoring
  parity — the asymmetry was reported as a bug (admins got a silent 404
  deleting a meeting created by another staff member) and the fix was
  confirmed intentional.
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
- The productivity `fresh_calls` metric counts dedicated `'Assigned
  contact'` activity-log rows (see Thirteenth instance above) — it used to
  be a regex heuristic against `'Updated contact'`'s free-text `details`
  string (matching the literal substring `assigned_staff`), which broke
  silently (always 0) once the Eleventh instance changed that details
  string's format for status changes. Superseded; kept here only as a
  historical note in case old activity-log rows from before the Thirteenth
  instance are ever queried — those older rows never got an `'Assigned
  contact'` entry and are simply invisible to the current metric (no
  backfill was done).
  **Deliberate widening (by user instruction, diverges from Python):** the
  auto-assign trigger in `PUT /contacts/:contact_id` was widened from
  "status changes from None" to "any edit of a currently-unassigned
  contact" (any field — phone, customer_name, data, status). Confirmed
  intent: "any unassigned contact edit by a user is expected to increase
  the fresh calls count" — i.e. Fresh Calls still means first-touch, just
  triggered by any edit rather than only a status change. The condition
  that keeps this from becoming "every edit forever" is unchanged: it only
  fires `if (!contact.assigned_staff)` — once a contact has an
  assigned_staff, later edits by other users never silently reassign it.
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
