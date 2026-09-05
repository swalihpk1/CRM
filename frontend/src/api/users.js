import apiClient from '../lib/apiClient';

export function getUsers(options = {}) {
  return apiClient.get('/users', options).then((r) => r.data);
}

export function createUser(data) {
  return apiClient.post('/users', data).then((r) => r.data);
}

export function updateUserRole(id, role) {
  return apiClient.put(`/users/${id}/role`, { role }).then((r) => r.data);
}

export function deleteUser(id) {
  return apiClient.delete(`/users/${id}`).then((r) => r.data);
}
