import React, { useEffect, useState } from 'react';
import { toast } from '../ui/sonner';
import { useConfirm } from '../../hooks/useConfirm';
import { useMeetingScheduler } from '../../context/MeetingSchedulerContext';
import { useInvalidate } from '../../context/CacheContext';
import * as notesApi from '../../api/notes';
import * as demosApi from '../../api/demos';
import * as followupsApi from '../../api/followups';
import * as contactsApi from '../../api/contacts';
import { format12Hour, readContactField } from '../../lib/formatters';

const STATUSES = [
  { value: 'None', label: '🔘 None - No action taken', badge: 'bg-gray-50 text-gray-700' },
  { value: 'Called', label: '📞 Called - Contact established', badge: 'bg-blue-50 text-blue-800' },
  { value: 'Not Attending', label: '⏸️ Not Attending - Unavailable/Busy', badge: 'bg-orange-50 text-orange-800' },
  { value: 'Follow-up', label: '⏰ Follow-up - Needs reconnection', badge: 'bg-yellow-50 text-yellow-800' },
  { value: 'Interested', label: '✅ Interested - Positive response', badge: 'bg-green-50 text-green-800' },
  { value: 'Not Interested', label: '❌ Not Interested - Declined', badge: 'bg-red-50 text-red-800' },
  { value: 'Irrelevant', label: '🚫 Irrelevant - Wrong target', badge: 'bg-purple-50 text-purple-800' },
  { value: 'Logged In', label: '🎯 Logged In - Purchased & Active', badge: 'bg-teal-50 text-teal-800' },
];

function readPhone2(contact) {
  const data = contact?.data || {};
  return data.phone2 || data.Phone2 || data['Phone 2'] || data.alternate_phone || data.secondary_phone || '';
}

function editStateFrom(contact) {
  const data = contact?.data || {};
  return {
    phone: contact.phone,
    phone2: readPhone2(contact),
    shop_name: readContactField(contact, 'shop_name') || '',
    address: data.address || data.Address || '',
    city: data.city || data.City || '',
    state: data.state || data.State || '',
    category: data.category || data.Category || '',
  };
}

/**
 * Shared across 4 features (contacts table, follow-ups, meetings, activity
 * log) — mounted once at the layout level, driven by the `?contact=<id>`
 * URL param (see layouts/AppLayout.jsx), rather than duplicated inline in
 * each feature as the old App.js did 3 times.
 */
export function ContactDetailModal({ contact, onClose, onUpdated, onDeleted }) {
  const confirm = useConfirm();
  const { openMeetingScheduler } = useMeetingScheduler();
  const invalidate = useInvalidate();

  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [demos, setDemos] = useState([]);
  const [editedContact, setEditedContact] = useState(() => editStateFrom(contact));
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    notesApi
      .getNotesByContact(contact.id)
      .then((data) => !cancelled && setNotes(data))
      .catch((err) => console.error('Failed to fetch notes:', err));
    demosApi
      .getDemosByContact(contact.id)
      .then((data) => !cancelled && setDemos(data))
      .catch((err) => console.error('Failed to fetch demos:', err));
    setEditedContact(editStateFrom(contact));
    setIsEditing(false);
    return () => {
      cancelled = true;
    };
  }, [contact.id]);

  const refetchDemos = () => demosApi.getDemosByContact(contact.id).then(setDemos);

  const handleMarkDemoGiven = async () => {
    try {
      await demosApi.createDemo({ contact_id: contact.id });
      await refetchDemos();
      invalidate('activityLogs');
    } catch (err) {
      toast.error('Failed to mark demo as given');
    }
  };

  const handleMarkDemoWatched = async (demoId) => {
    try {
      await demosApi.markDemoWatched(demoId, new Date().toISOString());
      await refetchDemos();
      invalidate('activityLogs');
    } catch (err) {
      toast.error('Failed to mark demo as watched');
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    const content = newNote;
    const tempId = `temp-${Date.now()}`;
    const tempNote = { id: tempId, content, created_at: new Date().toISOString() };

    setNotes((prev) => [tempNote, ...prev]);
    setNewNote('');

    try {
      const saved = await notesApi.createNote({ contact_id: contact.id, content });
      setNotes((prev) => prev.map((n) => (n.id === tempId ? saved : n)));
      invalidate('activityLogs');
    } catch (err) {
      toast.error('Failed to add note');
      setNotes((prev) => prev.filter((n) => n.id !== tempId));
    }
  };

  const handleCreateFollowUp = async () => {
    if (!followUpDate) {
      toast.error('Please select a follow-up date');
      return;
    }
    try {
      await followupsApi.createFollowup({
        contact_id: contact.id,
        follow_up_date: new Date(followUpDate).toISOString(),
        notes: followUpNotes,
      });
      toast.success('Follow-up created successfully!');
      setFollowUpDate('');
      setFollowUpNotes('');
      invalidate('followups.upcoming', 'followups.list', 'activityLogs');
    } catch (err) {
      toast.error('Failed to create follow-up');
    }
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    try {
      const updates = {
        phone: editedContact.phone,
        data: {
          phone2: editedContact.phone2 || undefined,
          shop_name: editedContact.shop_name || undefined,
          address: editedContact.address || undefined,
          city: editedContact.city || undefined,
          state: editedContact.state || undefined,
          category: editedContact.category || undefined,
        },
      };
      const updated = await contactsApi.updateContact(contact.id, updates);
      onUpdated?.(updated);
      invalidate('contacts.count', 'activityLogs');
      setIsEditing(false);
      toast.success('Contact updated successfully!');
    } catch (err) {
      toast.error('Failed to update contact');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedContact(editStateFrom(contact));
    setIsEditing(false);
  };

  const handleUpdateStatus = async (status) => {
    try {
      const updated = await contactsApi.updateContact(contact.id, { status });
      onUpdated?.(updated);
      invalidate('contacts.count', 'activityLogs');
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleLogCall = async () => {
    setTimeout(async () => {
      const ok = await confirm({ title: 'Did you complete the call?' });
      if (!ok) return;
      try {
        await contactsApi.logCall(contact.id);
        invalidate('activityLogs');
      } catch (err) {
        toast.error('Failed to log call');
      }
    }, 1000);
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete this contact?',
      description: 'This cannot be undone.',
      destructive: true,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await contactsApi.deleteContact(contact.id);
      invalidate('contacts', 'contacts.count', 'activityLogs');
      onDeleted?.(contact.id);
      onClose();
    } catch (err) {
      toast.error('Failed to delete contact');
    }
  };

  const phone2 = readPhone2(contact);
  const statusMeta = STATUSES.find((s) => s.value === contact.status) || STATUSES[0];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center sm:p-4 z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] sm:max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-4 flex justify-between items-center z-10">
          <h2 className="text-base sm:text-xl font-bold text-gray-800">Contact Details</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl min-w-11 min-h-11 flex items-center justify-center"
          >
            &times;
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {/* Contact Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm sm:text-base font-semibold text-gray-800">Contact Information</h3>
              <div className="flex gap-2">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 transition min-h-9"
                  >
                    ✏️ Edit
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSaveEdit}
                      disabled={savingEdit}
                      className="px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition min-h-9 disabled:opacity-60"
                    >
                      ✅ Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-2 bg-gray-500 text-white text-sm rounded-md hover:bg-gray-600 transition min-h-9"
                    >
                      ✖️ Cancel
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-600">Phone</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedContact.phone}
                    onChange={(e) => setEditedContact({ ...editedContact, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1 font-medium text-base"
                    placeholder="Phone number"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{contact.phone}</p>
                    <a
                      href={`tel:${contact.phone}`}
                      onClick={handleLogCall}
                      className="text-indigo-600 hover:text-indigo-800 min-w-8 min-h-8 flex items-center justify-center"
                      title="Call"
                    >
                      📞
                    </a>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-600">Phone 2</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedContact.phone2}
                    onChange={(e) => setEditedContact({ ...editedContact, phone2: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1 font-medium text-base"
                    placeholder="Secondary phone number"
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{phone2 || '-'}</p>
                    {phone2 && (
                      <a
                        href={`tel:${phone2}`}
                        onClick={handleLogCall}
                        className="text-indigo-600 hover:text-indigo-800 min-w-8 min-h-8 flex items-center justify-center"
                        title="Call Phone 2"
                      >
                        📞
                      </a>
                    )}
                  </div>
                )}
              </div>
              {['shop_name', 'address', 'city', 'state', 'category'].map((field) => (
                <div key={field}>
                  <label className="text-xs text-gray-600 capitalize">
                    {field.replace('_', ' ')}
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editedContact[field]}
                      onChange={(e) => setEditedContact({ ...editedContact, [field]: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1 font-medium text-base"
                      placeholder={field.replace('_', ' ')}
                    />
                  ) : (
                    <p className="text-sm font-medium">{editStateFrom(contact)[field] || '-'}</p>
                  )}
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-600">Status</label>
                <select
                  value={contact.status}
                  onChange={(e) => handleUpdateStatus(e.target.value)}
                  className={`w-full px-3 py-2 border border-gray-300 rounded-lg mt-1 font-medium text-base ${statusMeta.badge}`}
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600">Last Call</label>
                <p className="text-sm font-medium">
                  {contact.last_call_at ? format12Hour(contact.last_call_at) : 'Never'}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-2">
              <a
                href={`tel:${contact.phone}`}
                onClick={handleLogCall}
                className="px-4 py-3 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-center min-h-11"
              >
                📞 Call Now
              </a>
              <button
                onClick={handleDelete}
                className="px-4 py-3 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 min-h-11"
              >
                Delete Contact
              </button>
              <button
                onClick={() => openMeetingScheduler([contact])}
                className="px-4 py-3 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors min-h-11"
                title="Schedule a meeting with this contact"
              >
                📅 Schedule Meeting
              </button>
            </div>
          </div>

          {/* Notes Section */}
          <div>
            <h3 className="text-sm sm:text-base font-semibold mb-3">Notes & Feedback</h3>
            <div className="space-y-2 mb-3">
              {notes.map((note) => (
                <div key={note.id} className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-700">{note.content}</p>
                  <p className="text-xs text-gray-500 mt-1">{format12Hour(note.created_at)}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                placeholder="Add a note..."
                className="flex-1 px-4 py-3 sm:py-2 border border-gray-300 rounded-lg text-base"
              />
              <button
                onClick={handleAddNote}
                className="px-6 py-3 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 min-h-11"
              >
                Add
              </button>
            </div>
          </div>

          {/* Demo Section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">🎬 Demo Status</h3>
              {demos.length === 0 ? (
                <button
                  onClick={handleMarkDemoGiven}
                  className="px-3 py-2 bg-orange-600 text-white text-sm rounded-md hover:bg-orange-700 min-h-9"
                >
                  Mark Given
                </button>
              ) : (
                <span className="px-3 py-2 bg-gray-300 text-gray-600 text-sm rounded-md cursor-not-allowed">
                  Demo Given
                </span>
              )}
            </div>

            {demos.length > 0 && (
              <div className="space-y-2">
                {demos.slice(0, 1).map((demo) => (
                  <div
                    key={demo.id}
                    className={`p-2 rounded text-xs ${
                      demo.watched
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-orange-50 border border-orange-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div>
                        <div
                          className={`font-medium ${demo.watched ? 'text-green-700' : 'text-orange-700'}`}
                        >
                          {demo.watched ? '✅ Demo Completed' : '📤 Demo Given - Pending Watch'}
                        </div>
                        <div className="text-gray-600 mt-1">Given: {format12Hour(demo.given_at)}</div>
                        {demo.watched && demo.watched_at && (
                          <div className="text-gray-600">Watched: {format12Hour(demo.watched_at)}</div>
                        )}
                      </div>
                      {!demo.watched && (
                        <button
                          onClick={() => handleMarkDemoWatched(demo.id)}
                          className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 min-h-8"
                        >
                          Mark Watched
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Follow-up Section */}
          <div>
            <h3 className="text-sm sm:text-base font-semibold mb-3">Schedule Follow-up</h3>
            <div className="space-y-3">
              <input
                type="datetime-local"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full px-4 py-3 sm:py-2 border border-gray-300 rounded-lg text-base"
              />
              <textarea
                value={followUpNotes}
                onChange={(e) => setFollowUpNotes(e.target.value)}
                placeholder="Follow-up notes (optional)"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-base"
                rows="3"
              />
              <button
                onClick={handleCreateFollowUp}
                className="w-full py-3 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 min-h-11"
              >
                Create Follow-up
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
