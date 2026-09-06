# frontend — project instructions

React 19 CRA app (via `@craco/craco`, not raw `react-scripts`) + Tailwind
CSS + shadcn/ui (Radix primitives) + `react-router-dom` v7. Talks to
`backend-node` (never `backend/`, the old Python service — see
`../backend-node/CLAUDE.md`) via `REACT_APP_BACKEND_URL` + `/api`.

This app was **fully restructured** from a single 5,696-line `App.js` (no
routing, no file splitting, ~20 components inline, 6 `window.*` globals
for cross-component signaling, `alert()`/`window.confirm()` everywhere) into
the feature-folder + layer-folder structure described below. If you're
looking for "how did the old version do X," check git history around the
restructure commits — don't assume old patterns are still how things work.

## Directory structure

```
src/
├── App.js                # ~30 lines: providers + RouterProvider + Toaster
├── index.js
├── lib/                  # cross-cutting, non-React
│   ├── apiClient.js       # single axios instance + interceptors
│   ├── tokenStore.js       # single source of truth for the auth token
│   ├── formatters.js       # format12Hour, readContactField, getContactName, etc.
│   └── utils.js            # cn() — shadcn's classname helper, untouched
├── api/                  # one module per backend resource, thin wrappers
│   ├── auth.js  contacts.js  notes.js  followups.js  meetings.js
│   ├── demos.js  activityLogs.js  productivity.js  users.js
├── hooks/
│   ├── useQuery.js          # fetch-on-mount/deps-change, abortable
│   ├── useInfiniteList.js   # IntersectionObserver-based pagination
│   ├── useMutation.js       # pending/error + toast + CacheContext invalidation
│   ├── useDebouncedValue.js
│   └── useConfirm.js        # promise-based window.confirm replacement
├── context/
│   ├── AuthContext.jsx + useAuth.js
│   ├── CacheContext.jsx           # invalidation pub/sub bus
│   ├── ConfirmProvider.jsx        # hosts the single ConfirmDialog instance
│   └── MeetingSchedulerContext.jsx
├── components/
│   ├── ui/                        # shadcn primitives — do not hand-edit generated bits
│   ├── ConfirmDialog.jsx
│   ├── StatsGrid.jsx
│   └── contacts/
│       ├── ContactDetailModal.jsx   # shared across 4 features, see below
│       └── ContactFormModal.jsx
├── layouts/
│   ├── AppLayout.jsx    # sidebar/mobile-nav + <Outlet/> + the 2 layout-level modals
│   └── Sidebar.jsx
├── routes/
│   ├── index.jsx         # createBrowserRouter tree, React.lazy per admin/occasional page
│   ├── ProtectedRoute.jsx  AdminRoute.jsx
└── features/              # one folder per routed page
    ├── auth/  dashboard/  contacts/  followups/  meetings/
    ├── import/  demos/  activity/  productivity/  users/
```

Routed top-level page components are named `*Page.jsx`.

## Data-fetching layer — no React Query, and don't add it casually

Three hand-rolled hooks cover the app's ~10 fetch-on-mount cases, few
infinite lists, and ~15 mutations (~150 lines total). This was a
deliberate choice over `@tanstack/react-query`:

- RQ's caching would serve stale data on remount for what is live
  phone-call-tracking data — a just-completed follow-up briefly showing as
  pending is a real operational problem here, not a cosmetic one.
- Its default `refetchOnWindowFocus`/`refetchOnMount` *add* fetches,
  working against the goal of "fetch only what the active view needs."
- There are no automated frontend tests, so an opaque cache layer makes
  "did this change break something?" much harder to reason about.

If you're tempted to reach for RQ: the `api/*.js` functions are already
valid `queryFn`s, so the swap would be mechanical later if optimistic
updates spread much further — but that's a deliberate future call, not
something to slip in incidentally.

### `useQuery(fetcher, deps, options)`

`fetcher` is `(signal) => Promise<data>`. Returns
`{data, error, isLoading, refetch}`. Aborts the in-flight request via
`AbortController` on deps-change/unmount, and ignores a superseded
response via a monotonic request id — this guards against two real races:
rapid param changes (e.g. clicking date-filter buttons quickly) letting a
slower earlier response land last, and React 18/19 StrictMode's dev
double-invoke of effects.

`options.enabled` gates fetching. `options.onError`/`onSuccess` fire only
for a *genuine* result — a canceled/aborted request never reaches them.

**Cancellation-detection gotcha (a real bug, fixed once already — don't
reintroduce it):** `apiClient.js`'s response interceptor normalizes every
rejected request into a plain `{status, detail, isNetworkError, code,
isCanceled, cause}` object — NOT the raw axios error. `useQuery` and
`useInfiniteList` must check `err.isCanceled` (or `err.code ===
'ERR_CANCELED'`/`err.name === 'CanceledError'` as a fallback) — checking
`err.cause.code` or `err.name` against what would have been the *original*
axios error silently never matches once wrapped, since axios sets
`code`/`name` directly on its own error object, not nested. When this
check is broken, every canceled request (most commonly React's dev-mode
double-mount aborting the first of two runs, but also just a fast
route/filter change) surfaces as a real user-facing error toast even
though a fresh request is already succeeding right behind it — this is
exactly what caused a spurious "Failed to load productivity data" toast
on the Productivity page. **Never attach a raw `.catch(err => { toast...;
throw err })` directly to a fetch promise passed into `useQuery`** — it
fires on every rejection, including cancellations, before `useQuery` gets
a chance to filter them out. Use `options.onError` instead.

**Stale-closure-in-deps gotcha (also a real bug, also already fixed once):**
any value computed fresh on every render (e.g. `new Date()`) and fed into
a `useQuery`/`useInfiniteList` deps array will look "changed" on every
render even though nothing the user did actually changed it — this
aborts and refires the request in a tight loop, visible in the Network
tab as a chain of `(canceled)` requests. `features/productivity/
useDateRange.js`'s `getRange()` had exactly this bug (computed
`end = new Date()` unmemoized on every call) before it was wrapped in
`useMemo(() => ..., [preset, customStart, customEnd])`. If a hook computes
a range/derived value from `Date.now()`/`new Date()` and feeds it into a
query's deps, it MUST be memoized on the actual user-controlled inputs,
never left to recompute per-render.

### `useInfiniteList(fetchPage, {pageSize, params})`

Returns `{items, isLoading, hasMore, sentinelRef, reset, updateItem}`.
Uses an `IntersectionObserver` on a sentinel div — deliberately not a
`window.scroll` listener, since the app's real scroll containers are
nested `overflow-auto` divs, not the window. `updateItem(id, patch)`
patches one item in place without a full list reset — used by mutations
that need to reflect an edit instantly without losing scroll position
(see the CacheContext gotcha below for why this matters).

### `useMutation(mutationFn, options)`

Wraps a write with pending/error state, a success/error toast, and scoped
`CacheContext` invalidation (`options.invalidates`, a key or array of
keys). Replaces the old copy-pasted
`try { await axios... } catch { alert(...) }` + manual
`fetchX()`/`window.refreshX()` cascade pattern.

## CacheContext — invalidation pub/sub, not a cache

`context/CacheContext.jsx` is a ~60-line `Map<key, Set<callback>>`.
`invalidate(...keys)` calls every subscriber's callback for those keys;
`useInvalidationSubscription(keys, callback)` subscribes a component's own
refetch while mounted. It replaced 6 `window.*` globals
(`window.refreshFollowups`, `refreshActivityLogs`, `refreshMeetings`, plus
the meeting-scheduler handoff globals now in `MeetingSchedulerContext`).

**The actual fetch-reduction mechanism**: a view that isn't mounted has no
subscriber for its key, so invalidating it after some mutation elsewhere
is a no-op — no network request happens. E.g. logging a call calls
`invalidate('activityLogs')`, which only triggers a refetch if
`ActivityLogPage` (or `ContactDetailModal`'s own Activity panel — see
below) actually has a live subscription right now.

**Real gotcha — a race that caused a visible bug once (the "follow-up
edit scrolled the whole page back to top" bug):** invalidating a key that
some *other* part of the same page also subscribes to can trigger a
competing full-reset that overwrites an intended in-place `updateItem()`
patch. `FollowUpsPage.jsx`'s `editFollowup` mutation originally had
`invalidates: ['followups.upcoming', 'followups.list', 'activityLogs']`,
which raced against `useInvalidationSubscription(['followups.list',
'followups.upcoming'], resetAllLists)` on the same page — every save
triggered both the intended `updateItem()` patch AND a full list reset,
and the reset usually won, collapsing pagination state and jumping scroll
position. Fixed by trimming `editFollowup`'s `invalidates` to just
`['activityLogs']` (the one key nothing on that page's own local state
depends on for a full reset). **When wiring up a new mutation's
`invalidates` list, check whether anything on the SAME page subscribes to
the same key with a full-reset callback — if so, and you have a
more-targeted `updateItem()` patch available instead, don't also
invalidate the full-reset key.**

**Modal-local state is NOT a CacheContext subscriber by default.**
`ContactDetailModal.jsx`'s expandable "Activity" and "Follow-ups" history
panels keep their own local `useState` (`activityLogs`, `followupHistory`)
populated by a lazy fetch on first expand — `invalidate('activityLogs')`
only refreshes the standalone Activity Log *page*, not this modal's local
copy, since the modal never subscribed. Every mutation inside the modal
that logs activity (notes, status, edits, demos, follow-ups, calls) must
ALSO explicitly call the modal's own `refreshActivity()` /
`refreshFollowupHistory()` helpers (each a no-op if that section isn't
currently expanded) — this is not automatic and must be repeated for any
new mutation added to that modal.

Known resource keys (informal, not enforced by types): `contacts`,
`contacts.count`, `followups.upcoming`, `followups.list`, `meetings`,
`activityLogs`, `demos.contact:<id>`, `users`, `productivity`.

## Auth

`lib/tokenStore.js` is a plain module (not React context) holding the
token — it has to be a module, not context, because `apiClient.js`'s
axios interceptors run outside the React tree. Never read
`localStorage.getItem('token')` directly anywhere else; always go through
`tokenStore`.

`context/AuthContext.jsx` subscribes to `tokenStore` so a 401 detected by
the axios interceptor (from ANY api call, not just auth-related ones)
correctly flips the app to logged-out. **Real bug fixed once, don't
reintroduce:** `fetchUser()`'s catch block must only clear `user` state on
`err.status === 401` — NOT on every error. The old behavior force-logged-out
users on a transient network blip, since the catch caught everything
unconditionally.

`lib/apiClient.js`'s response interceptor only clears the token store on a
genuine 401 from a non-auth endpoint (`AUTH_ENDPOINTS` excludes
`/auth/login`/`/auth/signup`, since a 401 from those IS the expected
"bad credentials" response, not a "your session expired" signal).

## Shared ContactDetailModal — addressed by URL, not prop-drilled

`components/contacts/ContactDetailModal.jsx` is mounted **once**, inside
`layouts/AppLayout.jsx`, driven by a `?contact=<id>` search param — not
duplicated inline per-feature as the old `App.js` did (contacts table,
follow-ups, meetings, and activity log all used to each mount their own
copy). `AppLayout` resolves the id via `GET /contacts/:contact_id` if the
contact isn't already known from a loaded list. To open it from anywhere,
just set the `contact` search param; to close it, delete the param
(`replace: true` so it doesn't spam browser history).

The modal has two independent lazily-loaded expandable sections beyond
its always-visible Contact Info/Notes/Demo areas:
- **Activity** — this contact's full activity history, via
  `GET /activity-logs?target=<phone>` (backend-node-only `target` param).
- **Follow-ups** — every follow-up ever scheduled against this contact
  (pending/overdue/completed, most-recent-first), via
  `GET /followups?contact_id=<id>` (backend-node-only `contact_id` param,
  bypasses normal per-staff scoping so it shows the full history
  regardless of who created each one).

Both need their own `refresh*()` call wired into any mutation that logs
activity for this contact — see the CacheContext section above.

## MeetingSchedulerContext — replaces 3 of the old 6 `window.*` globals

`openMeetingScheduler(contacts)` opens the single `NewMeetingModal`
(mounted once in `AppLayout`) with a preselected contact list — replaces
`window.scheduleMeetingFromContact`, `window.openNewMeetingModal` (existed
only because the old `MeetingsView` had a second, separate new-meeting
modal — now merged into one `NewMeetingModal`), and
`window.pendingMeetingContact` (a timing-dependent 200ms-`setTimeout`
cross-route handoff hack, superseded by the modal being available
immediately regardless of route).

## Routing

`createBrowserRouter` (data-router API). `/login` is public; everything
else sits behind `ProtectedRoute` (redirects to `/login` if unauthenticated)
→ `AppLayout` → the actual page. `import`, `productivity`, and `users` are
additionally wrapped in `AdminRoute`, which makes the old inline
`user?.role === 'admin' &&` guards **un-bypassable by URL**, not just
hidden from the sidebar — a non-admin hitting `/productivity` directly
gets redirected, not a broken page.

Admin/occasional-use pages (`ContactsPage`, `FollowUpsPage`,
`MeetingsPage`, `ImportPage`, `DemoReportsPage`, `ActivityLogPage`,
`ProductivityPage`, `UsersPage`) are `React.lazy` + `Suspense`-wrapped —
`DashboardPage` (the landing route for every login) stays eagerly
imported.

**URL-state pattern, used pervasively**: filters/tabs/date-ranges live in
`useSearchParams`, not local state — e.g. contacts' `search`/`status`,
follow-ups' tab/filter/date, meetings' tab/filter/date. This makes them
shareable and back-button-friendly. Debounce any search input feeding a
URL param (`useDebouncedValue`, ~300ms) so typing doesn't flood browser
history or fire a request per keystroke.

## Design system (established across every page — match it on new work)

- Compact pill quick-filters: `px-2.5 py-1 rounded-md text-xs font-medium`;
  active = `bg-indigo-600 text-white`, inactive =
  `bg-gray-100 text-gray-600 hover:bg-gray-200`.
- `SectionHeading` pattern: `text-xs font-semibold uppercase tracking-wide
  text-gray-500` + `border-b border-gray-100` under it.
- Soft-tinted `ActionButton`-style buttons with `tone` variants
  (`default`/`positive`/`danger`/`info`/`warning`) — **never** a solid
  primary-color fill for a secondary action.
- Cards: `shadow-sm border border-gray-200` — not `shadow-md`.
- No emoji anywhere in the UI. Use `lucide-react` for generic icons;
  `react-icons`'s `FaWhatsapp` specifically for the real WhatsApp brand
  mark (not a custom SVG).
- Responsive breakpoint for every table/card toggle is `lg:` (1024px),
  **not** `sm:` (640px) — tablets must get the card layout, not a
  horizontally-scrolled desktop table. This was a real bug fixed across 5
  files early in the restructure (tablets were incorrectly getting desktop
  tables at `sm:`).
- Activity Log color scheme (exact, don't freelance new colors for new
  action types — extend the existing switch instead):
  Updates → blue, Creation/Scheduled/Assigned → green,
  Demo-related → orange, Delete/Cancel → red. Implemented as a
  comprehensive `switch` in `features/activity/activityFormatters.js`'s
  `getRowStyling()`; `formatAction()` in the same file maps raw backend
  `action` strings to their user-facing labels.
- Modals: `fixed inset-0` overlay, `items-end sm:items-center` so mobile
  gets a bottom sheet (`rounded-t-2xl`) and desktop gets a centered dialog
  (`rounded-2xl`) from the same markup — see `ContactDetailModal.jsx` for
  the reference implementation.
- Toasts via `sonner` (`components/ui/sonner.jsx`, mounted once in
  `App.js` as `<Toaster position="top-right" richColors />`) — not the
  older reducer-based `use-toast.js`/`toaster.jsx` shadcn scaffolding
  (retired, don't resurrect). `sonner.jsx` hardcodes `theme="light"`
  since the app has no dark mode and no `next-themes` `ThemeProvider` is
  mounted.
- Confirms via `useConfirm()` (a promise: `const ok = await confirm({...});
  if (!ok) return;`) — not `window.confirm`. Resolves `false` on
  outside-click/Escape so a dismissed dialog never leaks a forever-pending
  promise.

## Contact `data` field aliasing — read via the shared helpers, not raw keys

Contact `data` is a free-form bag populated from user-driven Excel column
mappings at import time, so the same logical field (shop name, customer
name) can land under several different literal keys depending on how a
given spreadsheet's columns were named/mapped
(`shop_name`/`Shop_Name`/`Shop Name`/`shop`/`Shop`, etc.). Always read
through `lib/formatters.js`'s `readContactField(contact, field)` /
`getShopName(contact)` (or the equivalent inline alias list in
`ContactDetailModal.jsx`'s `readPhone2()`/`editStateFrom()`) — never
assume `contact.data.shop_name` is the only place the value could be.

## Build / dev commands

- `npm start` → `craco start` (dev server, currently run at
  `http://192.168.1.2:8000` backend per `.env`'s `REACT_APP_BACKEND_URL` —
  check `.env` before assuming localhost).
- `npm run build` → `craco build`. **When rebuilding to verify a change
  while the user's own `npm start` may be running concurrently**, only
  clear `node_modules/.cache/default-production`, never the whole
  `node_modules/.cache` directory — clearing the whole thing corrupts the
  dev server's separate `default-development` cache out from under a
  running `npm start` (`ENOENT ... default-development/0.pack` is the
  symptom). Always `CI=true npm run build` so a warning never gets
  treated as an interactive prompt.
- No automated frontend test suite exists yet (`npm test` is CRA's default
  Jest/RTL harness with a `Testing.md`-less scaffold; nothing meaningful
  is actually asserted). Verification for real changes has been: minting a
  JWT directly (see `../backend-node/CLAUDE.md`'s testing section),
  curling the API, and/or a temporary `playwright-core` install
  (`npm install --no-save`, always `npm uninstall` after) driving system
  Chrome headless against the dev build, screenshotted and reviewed.

## Removed platform scaffolding — do not re-add

This project was originally scaffolded by the "emergent.sh" AI/no-code
platform (see `../PROJECT_ANALYSIS.md` for the historical record). All of
the following were platform artifacts, unrelated to this CRM's actual
functionality, and have been removed:

- `public/index.html` no longer loads the `rrweb`/`rrweb-recorder`
  session-recording scripts, the "Made with Emergent" badge `<a>` tag, or
  the PostHog analytics snippet (which was hardcoded to Emergent's own
  PostHog project key — it was sending session data to Emergent's
  analytics account, not this project's). If you ever see any of these
  reappear (e.g. from a stale deployed build, or a future platform
  re-scaffold), remove them again — they are never wanted here.
- `../.emergent/emergent.yml` (build-job metadata) and
  `../test_result.md` (Emergent's own agent-testing log format,
  describing the old Python-only backend) were deleted from the repo
  root — nothing in the build or CI referenced either.
- A stray `../.gitconfig` file at the repo root (NOT `.git/config`) had
  `github@emergent.sh` / `emergent-agent-e1` as a `[user]` identity — this
  was never actually wired into git (no `include.path`, and real commits
  already use a different email entirely), so it was dead weight, not a
  live credential. Deleted.
- If the "Made with Emergent" badge is ever visibly reappearing on the
  **deployed** site after this cleanup, it means the deployed build
  predates this change (Vercel hasn't rebuilt from the latest commit yet),
  not that the source regressed — check `git log -- frontend/public/
  index.html` and confirm the fix is actually deployed before assuming
  it's back.

## Git / commit workflow

See the root `CLAUDE.md`: never run `git commit` or `git push` without the
user explicitly confirming first, even if a commit message was already
approved earlier in the conversation.
