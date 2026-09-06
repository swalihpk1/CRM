import apiClient from '../lib/apiClient';

export function getNotesByContact(contactId, options = {}) {
  return apiClient.get(`/notes/contact/${contactId}`, options).then((r) => r.data);
}

export function createNote({ contact_id, content }) {
  return apiClient.post('/notes', { contact_id, content }).then((r) => r.data);
}

export function updateNote(id, content) {
  return apiClient.put(`/notes/${id}`, { content }).then((r) => r.data);
}

export function deleteNote(id) {
  return apiClient.delete(`/notes/${id}`).then((r) => r.data);
}
