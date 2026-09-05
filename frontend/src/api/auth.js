import apiClient from '../lib/apiClient';

export function login({ email, password }) {
  return apiClient.post('/auth/login', { email, password }).then((r) => r.data);
}

export function signup({ email, password }) {
  return apiClient.post('/auth/signup', { email, password }).then((r) => r.data);
}

export function getMe(options = {}) {
  return apiClient.get('/auth/me', options).then((r) => r.data);
}
