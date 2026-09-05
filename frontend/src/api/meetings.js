import apiClient from '../lib/apiClient';

export function getMeetings(options = {}) {
  return apiClient.get('/meetings', options).then((r) => r.data);
}

export function getMeeting(id, options = {}) {
  return apiClient.get(`/meetings/${id}`, options).then((r) => r.data);
}

export function createMeeting(data) {
  return apiClient.post('/meetings', data).then((r) => r.data);
}

export function updateMeeting(id, patch) {
  return apiClient.put(`/meetings/${id}`, patch).then((r) => r.data);
}

export function updateMeetingStatus(id, status) {
  return apiClient.put(`/meetings/${id}/status`, { status }).then((r) => r.data);
}

export function deleteMeeting(id) {
  return apiClient.delete(`/meetings/${id}`).then((r) => r.data);
}
