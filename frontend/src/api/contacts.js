import apiClient from '../lib/apiClient';

export function getContacts({ skip = 0, limit = 20, search, status } = {}, options = {}) {
  const params = { skip, limit };
  if (search) params.search = search;
  if (status) params.status = status;
  return apiClient.get('/contacts', { ...options, params }).then((r) => r.data);
}

export function getContactsCount(options = {}) {
  return apiClient.get('/contacts/count', options).then((r) => r.data);
}

export function getContact(id, options = {}) {
  return apiClient.get(`/contacts/${id}`, options).then((r) => r.data);
}

export function createContact(data) {
  return apiClient.post('/contacts', data).then((r) => r.data);
}

export function updateContact(id, patch) {
  return apiClient.put(`/contacts/${id}`, patch).then((r) => r.data);
}

export function deleteContact(id) {
  return apiClient.delete(`/contacts/${id}`).then((r) => r.data);
}

// Deletes multiple contacts. Uses Promise.allSettled (not Promise.all, as
// the previous implementation did) so one failure doesn't discard the
// results of the others — callers can report "deleted 8 of 10" instead of
// an opaque "failed to delete some contacts".
export async function deleteContacts(ids) {
  const results = await Promise.allSettled(ids.map((id) => deleteContact(id)));
  const succeeded = [];
  const failed = [];
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      succeeded.push(ids[i]);
    } else {
      failed.push({ id: ids[i], error: result.reason });
    }
  });
  return { succeeded, failed };
}

export function logCall(id) {
  return apiClient.post(`/contacts/${id}/call`).then((r) => r.data);
}

export function previewImport(file) {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient.post('/contacts/preview', formData).then((r) => r.data);
}

export function importContacts(file, columnMapping) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('column_mapping', JSON.stringify(columnMapping));
  return apiClient.post('/contacts/import', formData).then((r) => r.data);
}
