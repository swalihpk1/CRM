import React, { useEffect, useState } from 'react';
import { Phone, Pencil, Check, X, Trash2, CalendarPlus, Video, ChevronDown, ChevronUp } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { toast } from '../ui/sonner';
import { useConfirm } from '../../hooks/useConfirm';
import { useMeetingScheduler } from '../../context/MeetingSchedulerContext';
import { useInvalidate } from '../../context/CacheContext';
import * as notesApi from '../../api/notes';
import * as demosApi from '../../api/demos';
import * as followupsApi from '../../api/followups';
import * as contactsApi from '../../api/contacts';
import * as activityLogsApi from '../../api/activityLogs';
import { format12Hour, readContactField } from '../../lib/formatters';
import { formatAction, getRowStyling } from '../../features/activity/activityFormatters';

const STATUSES = [
  { value: 'None', label: 'None', badge: 'bg-gray-100 text-gray-700 border-gray-200' },
  { value: 'Not Attending', label: 'Not Attending', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'Follow-up', label: 'Follow-up', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { value: 'Interested', label: 'Interested', badge: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'Not Interested', label: 'Not Interested', badge: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'Irrelevant', label: 'Irrelevant', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'Logged In', label: 'Logged In', badge: 'bg-teal-50 text-teal-700 border-teal-200' },
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
    customer_name: contact.customer_name || '',
    shop_name: readContactField(contact, 'shop_name') || '',
    address: data.address || data.Address || '',
    city: data.city || data.City || '',
    state: data.state || data.State || '',
    category: data.category || data.Category || '',
  };
}

function waHref(phone) {
  return `https://wa.me/${String(phone).replace(/[^\d]/g, '')}`;
}

/** Tinted border/badge for a follow-up's state, matching the rest of the app's
 * completed=green / overdue=red / pending=amber scheme. */
function followupStatusMeta(followup) {
  if (followup.status === 'completed') {
    return { border: 'border-l-4 border-green-400 bg-green-50', badge: 'bg-green-100 text-green-700', label: 'Completed' };
  }
  const isOverdue = new Date(followup.follow_up_date) < new Date();
  if (isOverdue) {
    return { border: 'border-l-4 border-red-400 bg-red-50', badge: 'bg-red-100 text-red-700', label: 'Overdue' };
  }
  return { border: 'border-l-4 border-amber-400 bg-amber-50', badge: 'bg-amber-100 text-amber-700', label: 'Pending' };
}

/** Small uppercase section label used consistently above every section. */
function SectionHeading({ children, action }) {
  return (
    <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{children}</h3>
      {action}
    </div>
  );
}

/** Neutral, non-primary-color icon button used across the action bar. */
function ActionButton({ onClick, href, title, children, tone = 'default', className: extraClassName, ...rest }) {
  const toneClass =
    tone === 'danger'
      ? 'text-red-600 border-red-200 hover:bg-red-50'
      : tone === 'positive'
      ? 'text-green-700 border-green-200 hover:bg-green-50'
      : 'text-gray-700 border-gray-200 hover:bg-gray-50';
  const className = `inline-flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm font-medium transition min-h-9 ${toneClass} ${extraClassName || ''}`;
  if (href) {
    return (
      <a href={href} onClick={onClick} title={title} className={className} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <button onClick={onClick} title={title} className={className} {...rest}>
      {children}
    </button>
  );
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
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteContent, setEditingNoteContent] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpNotes, setFollowUpNotes] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [demos, setDemos] = useState([]);
  const [editedContact, setEditedContact] = useState(() => editStateFrom(contact));
  const [savingEdit, setSavingEdit] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [activityLogs, setActivityLogs] = useState(null);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [showFollowupHistory, setShowFollowupHistory] = useState(false);
  const [followupHistory, setFollowupHistory] = useState(null);
  const [loadingFollowupHistory, setLoadingFollowupHistory] = useState(false);

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
    setShowActivity(false);
    setActivityLogs(null);
    setShowFollowupHistory(false);
    setFollowupHistory(null);
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
      refreshActivity();
    } catch (err) {
      toast.error('Failed to mark demo as given');
    }
  };

  const handleMarkDemoWatched = async (demoId) => {
    try {
      await demosApi.markDemoWatched(demoId, new Date().toISOString());
      await refetchDemos();
      invalidate('activityLogs');
      refreshActivity();
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
      refreshActivity();
    } catch (err) {
      toast.error('Failed to add note');
      setNotes((prev) => prev.filter((n) => n.id !== tempId));
    }
  };

  const startEditNote = (note) => {
    setEditingNoteId(note.id);
    setEditingNoteContent(note.content);
  };

  const cancelEditNote = () => {
    setEditingNoteId(null);
    setEditingNoteContent('');
  };

  const handleSaveNoteEdit = async (noteId) => {
    if (!editingNoteContent.trim()) return;
    try {
      const updated = await notesApi.updateNote(noteId, editingNoteContent);
      setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)));
      invalidate('activityLogs');
      refreshActivity();
      setEditingNoteId(null);
      setEditingNoteContent('');
      toast.success('Note updated');
    } catch (err) {
      toast.error('Failed to update note');
    }
  };

  const handleDeleteNote = async (noteId) => {
    const ok = await confirm({
      title: 'Delete this note?',
      description: 'This cannot be undone.',
      destructive: true,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    const prevNotes = notes;
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    try {
      await notesApi.deleteNote(noteId);
      invalidate('activityLogs');
      refreshActivity();
      toast.success('Note deleted');
    } catch (err) {
      toast.error('Failed to delete note');
      setNotes(prevNotes);
    }
  };

  // Re-fetches this contact's activity feed. Called both when the section
  // is first expanded (lazy load) and after any mutation made from inside
  // this modal that logs activity (notes, status, edits, demos,
  // follow-ups, calls) — otherwise an already-expanded Activity section
  // would keep showing stale data until the modal was closed and reopened,
  // since invalidate('activityLogs') only refreshes the standalone
  // Activity Log *page*, not this modal's own local copy.
  const refreshActivity = async () => {
    if (!showActivity) return;
    try {
      const logs = await activityLogsApi.getActivityLogs({ target: contact.phone, limit: 50 });
      setActivityLogs(logs);
    } catch (err) {
      // Silent — the section still shows its last-known-good state, and
      // toggling it closed/open again will retry the fetch.
    }
  };

  const toggleActivity = async () => {
    const next = !showActivity;
    setShowActivity(next);
    if (next && activityLogs === null) {
      setLoadingActivity(true);
      try {
        const logs = await activityLogsApi.getActivityLogs({ target: contact.phone, limit: 50 });
        setActivityLogs(logs);
      } catch (err) {
        toast.error('Failed to load activity');
        setActivityLogs([]);
      } finally {
        setLoadingActivity(false);
      }
    }
  };

  // Re-fetches this contact's full follow-up history (pending, overdue, and
  // completed, most-recent-first). Called both when the section is first
  // expanded and after scheduling a new follow-up from this modal, for the
  // same reason as refreshActivity() above — this section's local state has
  // no subscription to any CacheContext invalidation.
  const refreshFollowupHistory = async () => {
    if (!showFollowupHistory) return;
    try {
      const list = await followupsApi.getFollowupsForContact(contact.id);
      setFollowupHistory(list);
    } catch (err) {
      // Silent — the section still shows its last-known-good state, and
      // toggling it closed/open again will retry the fetch.
    }
  };

  const toggleFollowupHistory = async () => {
    const next = !showFollowupHistory;
    setShowFollowupHistory(next);
    if (next && followupHistory === null) {
      setLoadingFollowupHistory(true);
      try {
        const list = await followupsApi.getFollowupsForContact(contact.id);
        setFollowupHistory(list);
      } catch (err) {
        toast.error('Failed to load follow-ups');
        setFollowupHistory([]);
      } finally {
        setLoadingFollowupHistory(false);
      }
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
      setShowFollowUp(false);
      invalidate('followups.upcoming', 'followups.list', 'activityLogs');
      refreshActivity();
      refreshFollowupHistory();
    } catch (err) {
      toast.error('Failed to create follow-up');
    }
  };

  const handleSaveEdit = async () => {
    setSavingEdit(true);
    try {
      const updates = {
        phone: editedContact.phone,
        customer_name: editedContact.customer_name || undefined,
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
      invalidate('contacts', 'contacts.count', 'activityLogs');
      refreshActivity();
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
      invalidate('contacts', 'contacts.count', 'activityLogs');
      refreshActivity();
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
        refreshActivity();
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
        {/* Header: title + status badge (top-right) + close */}
        <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-4 flex justify-between items-center gap-3 z-10">
          <h2 className="text-base sm:text-xl font-bold text-gray-800 truncate">Contact Details</h2>
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={contact.status}
              onChange={(e) => handleUpdateStatus(e.target.value)}
              className={`px-2.5 py-1.5 border rounded-full text-xs font-semibold ${statusMeta.badge}`}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl min-w-11 min-h-11 flex items-center justify-center"
            >
              &times;
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {/* Action bar: primary actions up top, Edit/Delete moved to the bottom */}
          <div className="flex flex-wrap gap-2">
            <ActionButton
              onClick={() => openMeetingScheduler([contact])}
              title="Schedule a meeting"
              className="bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
            >
              <CalendarPlus size={14} /> Schedule Meeting
            </ActionButton>
            <ActionButton
              onClick={() => setShowFollowUp((v) => !v)}
              title="Schedule a follow-up"
              className="bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
            >
              <CalendarPlus size={14} /> Schedule Follow-up
            </ActionButton>
            {demos.length === 0 && (
              <ActionButton
                onClick={handleMarkDemoGiven}
                title="Mark demo as given"
                className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
              >
                <Video size={14} /> Mark Demo Given
              </ActionButton>
            )}
          </div>

          {showFollowUp && (
            <div className="p-4 border border-amber-200 rounded-lg bg-amber-50">
              <SectionHeading>Schedule Follow-up</SectionHeading>
              <div className="space-y-3">
                <input
                  type="datetime-local"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-base bg-white"
                />
                <textarea
                  value={followUpNotes}
                  onChange={(e) => setFollowUpNotes(e.target.value)}
                  placeholder="Follow-up notes (optional)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg text-base bg-white"
                  rows="3"
                />
                <div className="flex gap-2">
                  <ActionButton
                    onClick={handleCreateFollowUp}
                    className="flex-1 justify-center bg-amber-600 border-amber-600 text-white hover:bg-amber-700"
                  >
                    Create Follow-up
                  </ActionButton>
                  <ActionButton onClick={() => setShowFollowUp(false)}>Cancel</ActionButton>
                </div>
              </div>
            </div>
          )}

          {/* Contact Info */}
          <div>
            <SectionHeading>Contact Information</SectionHeading>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs text-gray-500">Shop Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedContact.shop_name}
                    onChange={(e) => setEditedContact({ ...editedContact, shop_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1 font-medium text-base"
                    placeholder="shop name"
                  />
                ) : (
                  <p className="text-sm font-medium text-gray-900">{editStateFrom(contact).shop_name || '-'}</p>
                )}
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-500">Customer Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedContact.customer_name}
                    onChange={(e) => setEditedContact({ ...editedContact, customer_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1 font-medium text-base"
                    placeholder="customer name"
                  />
                ) : (
                  <p className="text-sm font-medium text-gray-900">{editStateFrom(contact).customer_name || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500">Phone</label>
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
                    <p className="text-sm font-medium text-gray-900">{contact.phone}</p>
                    <a
                      href={`tel:${contact.phone}`}
                      onClick={handleLogCall}
                      className="text-gray-500 hover:text-gray-700 min-w-8 min-h-8 flex items-center justify-center"
                      title="Call"
                    >
                      <Phone size={14} />
                    </a>
                    <a
                      href={waHref(contact.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-8 min-h-8 flex items-center justify-center"
                      title="WhatsApp"
                    >
                      <FaWhatsapp size={14} color="#25D366" />
                    </a>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500">Phone 2</label>
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
                    <p className="text-sm font-medium text-gray-900">{phone2 || '-'}</p>
                    {phone2 && (
                      <>
                        <a
                          href={`tel:${phone2}`}
                          onClick={handleLogCall}
                          className="text-gray-500 hover:text-gray-700 min-w-8 min-h-8 flex items-center justify-center"
                          title="Call Phone 2"
                        >
                          <Phone size={14} />
                        </a>
                        <a
                          href={waHref(phone2)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-w-8 min-h-8 flex items-center justify-center"
                          title="WhatsApp"
                        >
                          <FaWhatsapp size={14} color="#25D366" />
                        </a>
                      </>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500">Address</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedContact.address}
                    onChange={(e) => setEditedContact({ ...editedContact, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1 font-medium text-base"
                    placeholder="address"
                  />
                ) : (
                  <p className="text-sm font-medium text-gray-900">{editStateFrom(contact).address || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500">City</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedContact.city}
                    onChange={(e) => setEditedContact({ ...editedContact, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1 font-medium text-base"
                    placeholder="city"
                  />
                ) : (
                  <p className="text-sm font-medium text-gray-900">{editStateFrom(contact).city || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500">State</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedContact.state}
                    onChange={(e) => setEditedContact({ ...editedContact, state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1 font-medium text-base"
                    placeholder="state"
                  />
                ) : (
                  <p className="text-sm font-medium text-gray-900">{editStateFrom(contact).state || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500">Category</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedContact.category}
                    onChange={(e) => setEditedContact({ ...editedContact, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1 font-medium text-base"
                    placeholder="category"
                  />
                ) : (
                  <p className="text-sm font-medium text-gray-900">{editStateFrom(contact).category || '-'}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500">Last Call</label>
                <p className="text-sm font-medium text-gray-900">
                  {contact.last_call_at ? format12Hour(contact.last_call_at) : 'Never'}
                </p>
              </div>
              <div>
                <label className="text-xs text-gray-500">Assigned Staff</label>
                <p className={`text-sm font-medium ${contact.assigned_staff ? 'text-gray-900' : 'text-gray-400'}`}>
                  {contact.assigned_staff || 'Unassigned'}
                </p>
              </div>
            </div>
          </div>

          {/* Demo Section */}
          <div className="p-4 rounded-lg bg-orange-50/60 border border-orange-100">
            <SectionHeading>Demo Status</SectionHeading>
            {demos.length === 0 ? (
              <p className="text-sm text-gray-500">No demo recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {demos.slice(0, 1).map((demo) => (
                  <div
                    key={demo.id}
                    className="p-3 rounded-lg border border-gray-200 bg-white"
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div>
                        <div className="font-medium text-sm text-gray-800">
                          {demo.watched ? 'Demo Completed' : 'Demo Given — Pending Watch'}
                        </div>
                        <div className="text-gray-500 text-xs mt-1">Given: {format12Hour(demo.given_at)}</div>
                        {demo.watched && demo.watched_at && (
                          <div className="text-gray-500 text-xs">Watched: {format12Hour(demo.watched_at)}</div>
                        )}
                      </div>
                      {!demo.watched && (
                        <ActionButton
                          onClick={() => handleMarkDemoWatched(demo.id)}
                          title="Mark demo watched"
                          className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                        >
                          Mark Watched
                        </ActionButton>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Follow-up History — expandable, lazily fetched on first open.
              Lists every follow-up ever scheduled against this contact
              (pending, overdue, and completed), most-recent-first. */}
          <div>
            <button
              onClick={toggleFollowupHistory}
              className="w-full flex items-center justify-between mb-3 pb-2 border-b border-gray-100 text-left"
            >
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Follow-ups</h3>
              {showFollowupHistory ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </button>
            {showFollowupHistory && (
              <div className="space-y-1.5">
                {loadingFollowupHistory ? (
                  <p className="text-sm text-gray-500">Loading follow-ups…</p>
                ) : followupHistory && followupHistory.length > 0 ? (
                  followupHistory.map((f) => {
                    const meta = followupStatusMeta(f);
                    const dateLabel = f.status === 'completed' && f.completed_at ? f.completed_at : f.follow_up_date;
                    return (
                      <div key={f.id} className={`p-2.5 rounded-lg ${meta.border}`}>
                        <div className="flex justify-between items-start gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${meta.badge}`}>
                            {meta.label}
                          </span>
                          <span className="text-xs text-gray-400 shrink-0">{format12Hour(dateLabel)}</span>
                        </div>
                        {f.notes && <p className="text-xs text-gray-700 mt-1">{f.notes}</p>}
                        <p className="text-xs text-gray-500 mt-0.5">
                          Created by {f.user_email?.split('@')[0] || 'Unknown'}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-gray-500">No follow-ups scheduled yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Notes Section */}
          <div>
            <SectionHeading>Notes &amp; Feedback</SectionHeading>
            <div className="space-y-2 mb-3">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-base resize-y"
              />
              <ActionButton
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                className={`w-full justify-center ${
                  newNote.trim()
                    ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed hover:bg-gray-100'
                }`}
              >
                Add Note
              </ActionButton>
            </div>
            <div className="space-y-2">
              {notes.map((note) => (
                <div key={note.id} className="bg-gray-100 border border-gray-200 p-3 rounded-lg">
                  {editingNoteId === note.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingNoteContent}
                        onChange={(e) => setEditingNoteContent(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white resize-y"
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleSaveNoteEdit(note.id)}
                          disabled={!editingNoteContent.trim()}
                          className="px-2.5 py-1 bg-green-50 border border-green-200 text-green-700 rounded-lg hover:bg-green-100 text-xs font-medium flex items-center gap-1 min-h-7 disabled:opacity-50"
                        >
                          <Check size={12} /> Save
                        </button>
                        <button
                          onClick={cancelEditNote}
                          className="px-2.5 py-1 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-xs font-medium flex items-center gap-1 min-h-7"
                        >
                          <X size={12} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-start gap-2">
                        <p className="text-sm text-gray-700 flex-1 min-w-0">{note.content}</p>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => startEditNote(note)}
                            title="Edit note"
                            className="w-6 h-6 flex items-center justify-center bg-white border border-gray-200 text-gray-500 rounded hover:bg-gray-50"
                          >
                            <Pencil size={11} />
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            title="Delete note"
                            className="w-6 h-6 flex items-center justify-center bg-white border border-red-200 text-red-500 rounded hover:bg-red-50"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{format12Hour(note.created_at)}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Activity Section — expandable, lazily fetched on first open */}
          <div>
            <button
              onClick={toggleActivity}
              className="w-full flex items-center justify-between mb-3 pb-2 border-b border-gray-100 text-left"
            >
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Activity</h3>
              {showActivity ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
            </button>
            {showActivity && (
              <div className="space-y-1.5">
                {loadingActivity ? (
                  <p className="text-sm text-gray-500">Loading activity…</p>
                ) : activityLogs && activityLogs.length > 0 ? (
                  activityLogs.map((log) => (
                    <div key={log.id} className={`p-2.5 rounded-lg border-l-4 ${getRowStyling(log.action)}`}>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs font-medium text-gray-800">{formatAction(log)}</span>
                        <span className="text-xs text-gray-400 shrink-0">{format12Hour(log.timestamp)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{log.user_email?.split('@')[0]}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No activity recorded yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Danger zone: Edit / Delete, moved out of the primary action bar */}
          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
            {!isEditing ? (
              <ActionButton onClick={() => setIsEditing(true)} title="Edit contact details">
                <Pencil size={14} /> Edit
              </ActionButton>
            ) : (
              <>
                <ActionButton onClick={handleSaveEdit} disabled={savingEdit} tone="positive" title="Save changes">
                  <Check size={14} /> Save
                </ActionButton>
                <ActionButton onClick={handleCancelEdit} title="Cancel editing">
                  <X size={14} /> Cancel
                </ActionButton>
              </>
            )}
            <ActionButton onClick={handleDelete} tone="danger" title="Delete contact" className="ml-auto">
              <Trash2 size={14} /> Delete
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
