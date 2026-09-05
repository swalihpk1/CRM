import apiClient from '../lib/apiClient';

export function getActivityLogs({ skip = 0, limit = 20 } = {}, options = {}) {
  return apiClient
    .get('/activity-logs', { ...options, params: { skip, limit } })
    .then((r) => r.data);
}
