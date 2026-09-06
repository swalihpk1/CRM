import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from '../../components/ui/sonner';
import * as meetingsApi from '../../api/meetings';
import { useMutation } from '../../hooks/useMutation';
import { useContactSearch } from '../contacts/useContactSearch';
import { getShopName } from '../../lib/formatters';

/** Small uppercase section label used consistently across every section. */
function SectionHeading({ children }) {
  return (
    <div className="mb-3 pb-2 border-b border-gray-100">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{children}</h3>
    </div>
  );
}

/**
 * Merged replacement for the old GlobalMeetingModal (used from
 * ContactDetailModal/ContactsView via window.scheduleMeetingFromContact)
 * AND MeetingsView's own inline "New Meeting Modal" (which referenced
 * meetingDuration/meetingType/meetingStatus/handleCreateMeeting — none of
 * which were ever declared anywhere in the file; that form was dead code
 * that would have thrown a ReferenceError the moment it rendered with
 * real data, since it was never actually reachable/tested end-to-end).
 * Only GlobalMeetingModal's implementation was real; this is that
 * implementation, mounted once at the layout level (see
 * layouts/AppLayout.jsx + context/MeetingSchedulerContext.jsx) instead of
 * being duplicated in two places.
 */
export function NewMeetingModal({ open, preselectedContacts = [], onClose }) {
  const [title, setTitle] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedContacts, setSelectedContacts] = useState(preselectedContacts);

  const { query, setQuery, results, enabled: searching } = useContactSearch();

  useEffect(() => {
    if (open) {
      setSelectedContacts(preselectedContacts);
    }
  }, [open, preselectedContacts]);

  const resetForm = () => {
    setTitle('');
    setDateTime('');
    setLocation('');
    setNotes('');
    setSelectedContacts([]);
    setQuery('');
  };

  const { mutate: createMeeting, isPending } = useMutation(meetingsApi.createMeeting, {
    invalidates: ['meetings', 'activityLogs'],
    successMessage: 'Meeting scheduled successfully!',
    onSuccess: () => {
      resetForm();
      onClose();
    },
  });

  const toggleContact = (contact) => {
    setSelectedContacts((prev) =>
      prev.some((c) => c.id === contact.id)
        ? prev.filter((c) => c.id !== contact.id)
        : [...prev, contact]
    );
  };

  const handleSave = () => {
    if (!title || !dateTime || selectedContacts.length === 0) {
      toast.error('Please fill in all required fields and select at least one contact.');
      return;
    }

    const [date, time] = dateTime.split('T');

    createMeeting({
      title,
      date,
      time: time || '',
      location,
      notes,
      attendees: selectedContacts.map((contact) => ({
        id: contact.id,
        name: getShopName(contact, contact.phone),
        phone: contact.phone,
      })),
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center sm:p-4 z-[100]">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] sm:max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-4 flex justify-between items-center z-10">
          <h2 className="text-base sm:text-xl font-bold text-gray-800">Schedule New Meeting</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 min-w-11 min-h-11 flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {/* Meeting Details */}
          <div>
            <SectionHeading>Meeting Details</SectionHeading>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Meeting Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1 font-medium text-base"
                  placeholder="e.g., Product Demo, Contract Discussion"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Date &amp; Time *</label>
                <input
                  type="datetime-local"
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1 font-medium text-base"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1 font-medium text-base"
                  placeholder="e.g., Office, Zoom link, etc."
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg mt-1 font-medium text-base resize-y"
                  rows="3"
                  placeholder="Meeting agenda, things to prepare, etc."
                />
              </div>
            </div>
          </div>

          {/* Attendees */}
          <div>
            <SectionHeading>Attendees *</SectionHeading>

            {selectedContacts.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2">Selected</p>
                <div className="flex flex-wrap gap-2">
                  {selectedContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="inline-flex items-center bg-indigo-50 border border-indigo-200 rounded-full px-3 py-1.5"
                    >
                      <span className="text-sm text-indigo-800">
                        {getShopName(contact, contact.phone)}
                      </span>
                      <button
                        onClick={() => toggleContact(contact)}
                        className="ml-2 text-indigo-600 hover:text-indigo-800 min-w-6 min-h-6"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search contacts by name, shop, or phone…"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base"
              />
            </div>

            {searching && results.length > 0 && (
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                {results.map((contact) => {
                  const isSelected = selectedContacts.some((c) => c.id === contact.id);
                  const shopName = getShopName(contact);
                  const contactName = contact.data?.name || contact.data?.Name;

                  return (
                    <div
                      key={contact.id}
                      onClick={() => toggleContact(contact)}
                      className={`p-3 cursor-pointer min-h-11 ${
                        isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="mr-3 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                        />
                        <div>
                          {shopName && <p className="font-medium text-gray-800 text-sm">{shopName}</p>}
                          {contactName && <p className="text-sm text-gray-600">{contactName}</p>}
                          <p className="text-sm text-gray-600">{contact.phone}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {searching && results.length === 0 && (
              <div className="text-center py-4 text-gray-500 text-sm">
                No contacts found matching "{query}"
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
            <button
              onClick={handleClose}
              className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm min-h-9"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="ml-auto px-4 py-2 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition font-medium text-sm min-h-9 disabled:opacity-60"
            >
              {isPending ? 'Scheduling…' : 'Schedule Meeting'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
