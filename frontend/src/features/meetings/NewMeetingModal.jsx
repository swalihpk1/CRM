import React, { useEffect, useState } from 'react';
import { toast } from '../../components/ui/sonner';
import * as meetingsApi from '../../api/meetings';
import { useMutation } from '../../hooks/useMutation';
import { useContactSearch } from '../contacts/useContactSearch';
import { getShopName } from '../../lib/formatters';

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
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
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
    setDate('');
    setTime('');
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
    if (!title || !date || selectedContacts.length === 0) {
      toast.error('Please fill in all required fields and select at least one contact.');
      return;
    }

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
            className="text-gray-500 hover:text-gray-700 text-2xl min-w-11 min-h-11 flex items-center justify-center"
          >
            &times;
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-3 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-base"
                placeholder="e.g., Product Demo, Contract Discussion"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-3 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-base"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-4 py-3 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-base"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-4 py-3 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-base"
                placeholder="e.g., Office, Zoom link, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-base"
                rows="3"
                placeholder="Meeting agenda, things to prepare, etc."
              />
            </div>
          </div>

          <div className="border-t pt-6">
            <h3 className="text-sm sm:text-base font-semibold mb-3">Attendees *</h3>

            {selectedContacts.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Selected:</h4>
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
                className="w-full px-4 py-3 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-base"
              />
            </div>

            {searching && results.length > 0 && (
              <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
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
                          {shopName && <p className="font-medium text-gray-800">{shopName}</p>}
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
              <div className="text-center py-4 text-gray-500">
                No contacts found matching "{query}"
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-3 sm:py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition font-semibold min-h-11"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 px-4 py-3 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold min-h-11 disabled:opacity-60"
            >
              {isPending ? 'Scheduling…' : 'Schedule Meeting'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
