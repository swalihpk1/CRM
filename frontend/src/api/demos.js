import apiClient from '../lib/apiClient';

export function getDemosByContact(contactId, options = {}) {
  return apiClient.get(`/contacts/${contactId}/demos`, options).then((r) => r.data);
}

export function createDemo({ contact_id, notes }) {
  return apiClient.post('/demos', { contact_id, notes }).then((r) => r.data);
}

export function markDemoWatched(id, watchedAt) {
  return apiClient
    .put(`/demos/${id}/watched`, watchedAt ? { watched_at: watchedAt } : {})
    .then((r) => r.data);
}

// Previously built with an unencoded template literal
// (`/demos/report?start=${startDate}&end=${endDate}...`), which does not
// URL-encode the ISO date strings' `+` / `:` characters. Using axios's
// `params` object encodes them correctly.
export function getDemoReport({ start, end, group_by = 'day' }, options = {}) {
  return apiClient
    .get('/demos/report', { ...options, params: { start, end, group_by } })
    .then((r) => r.data);
}

export function getDemoSummary({ start, end }, options = {}) {
  return apiClient
    .get('/demos/summary', { ...options, params: { start, end } })
    .then((r) => r.data);
}
