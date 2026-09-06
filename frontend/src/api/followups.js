import apiClient from '../lib/apiClient';

export function getUpcomingFollowups(options = {}) {
  return apiClient.get('/followups/upcoming', options).then((r) => r.data);
}

// Every follow-up ever scheduled against one contact (pending, overdue, and
// completed), regardless of who created it — used by ContactDetailModal's
// follow-up history list. Backend-node-only `contact_id` param, see
// backend-node/CLAUDE.md.
export function getFollowupsForContact(contactId, options = {}) {
  return apiClient
    .get('/followups', { ...options, params: { contact_id: contactId } })
    .then((r) => r.data);
}

// Both endpoints filter by an explicit from_date/to_date range only — no
// filter keyword ('today', 'last_week', etc.) is ever sent to the backend.
// The caller resolves any quick-filter label to concrete dates itself
// (see FollowUpsPage's rangeForFilter) before calling these.
export function getPaginatedFollowups(
  { skip = 0, limit = 20, from_date, to_date, status, created_by } = {},
  options = {}
) {
  const params = { skip, limit };
  if (from_date) params.from_date = from_date;
  if (to_date) params.to_date = to_date;
  if (status) params.status = status;
  if (created_by) params.created_by = created_by;
  return apiClient.get('/followups/paginated', { ...options, params }).then((r) => r.data);
}

export function getCompletedFollowups(
  { skip, limit, from_date, to_date, created_by } = {},
  options = {}
) {
  const params = {};
  if (skip !== undefined) params.skip = skip;
  if (limit !== undefined) params.limit = limit;
  if (from_date) params.from_date = from_date;
  if (to_date) params.to_date = to_date;
  if (created_by) params.created_by = created_by;
  return apiClient.get('/followups/completed', { ...options, params }).then((r) => r.data);
}

export function getFollowupsByDate(date_filter, options = {}) {
  return apiClient
    .get('/followups/by-date', { ...options, params: { date_filter } })
    .then((r) => r.data);
}

export function createFollowup({ contact_id, follow_up_date, notes }) {
  return apiClient.post('/followups', { contact_id, follow_up_date, notes }).then((r) => r.data);
}

export function completeFollowup(id) {
  return apiClient.put(`/followups/${id}/complete`).then((r) => r.data);
}

export function updateFollowup(id, patch) {
  return apiClient.put(`/followups/${id}`, patch).then((r) => r.data);
}

export function deleteFollowup(id) {
  return apiClient.delete(`/followups/${id}`).then((r) => r.data);
}
