import apiClient from '../lib/apiClient';

export function getUpcomingFollowups(options = {}) {
  return apiClient.get('/followups/upcoming', options).then((r) => r.data);
}

export function getPaginatedFollowups(
  { skip = 0, limit = 20, date_filter = 'all', custom_date } = {},
  options = {}
) {
  const params = { skip, limit, date_filter };
  if (custom_date) params.custom_date = custom_date;
  return apiClient.get('/followups/paginated', { ...options, params }).then((r) => r.data);
}

export function getCompletedFollowups(
  { date_filter = 'today', custom_date } = {},
  options = {}
) {
  const params = { date_filter };
  if (custom_date) params.custom_date = custom_date;
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
