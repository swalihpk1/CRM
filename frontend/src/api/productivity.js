import apiClient from '../lib/apiClient';

export function getStaffSummary({ start_date, end_date }, options = {}) {
  return apiClient
    .get('/productivity/staff-summary', { ...options, params: { start_date, end_date } })
    .then((r) => r.data);
}

export function getStaffDetails(
  { user_id, metric_type, start_date, end_date },
  options = {}
) {
  return apiClient
    .get('/productivity/staff-details', {
      ...options,
      params: { user_id, metric_type, start_date, end_date },
    })
    .then((r) => r.data);
}
