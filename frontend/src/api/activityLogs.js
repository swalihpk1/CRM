import apiClient from '../lib/apiClient';

export function getActivityLogs({ skip = 0, limit = 20, from_date, to_date, target } = {}, options = {}) {
  const params = { skip, limit };
  if (from_date) params.from_date = from_date;
  if (to_date) params.to_date = to_date;
  if (target) params.target = target;
  return apiClient.get('/activity-logs', { ...options, params }).then((r) => r.data);
}
