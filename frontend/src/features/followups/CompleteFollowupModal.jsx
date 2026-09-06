import React, { useState } from 'react';
import { X, Phone, Check } from 'lucide-react';
import * as followupsApi from '../../api/followups';
import * as contactsApi from '../../api/contacts';
import * as notesApi from '../../api/notes';
import { useMutation } from '../../hooks/useMutation';
import { format12Hour, getContactName, getContactPhone } from '../../lib/formatters';

// Same status taxonomy/colors used everywhere else (ContactDetailModal,
// ContactsToolbar) — '' means "leave the contact's status unchanged".
const CALL_OUTCOMES = [
  { value: '', label: 'No status change' },
  { value: 'Not Attending', label: 'Not Attending', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'Follow-up', label: 'Follow-up', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { value: 'Interested', label: 'Interested', badge: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'Not Interested', label: 'Not Interested', badge: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'Irrelevant', label: 'Irrelevant', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'Logged In', label: 'Logged In', badge: 'bg-teal-50 text-teal-700 border-teal-200' },
];

/** Small uppercase section label used consistently across every modal. */
function SectionHeading({ children }) {
  return (
    <div className="mb-3 pb-2 border-b border-gray-100">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{children}</h3>
    </div>
  );
}

/**
 * The 4-step sequential mutation (complete → update contact status →
 * add note → optionally schedule next follow-up) is composed into one
 * function and driven by a single useMutation, rather than 4 separate
 * awaited axios calls with manual window.refresh* calls after.
 */
async function completeFollowupWorkflow({
  followup,
  callStatus,
  completionNotes,
  scheduleNext,
  nextFollowupDate,
  nextFollowupNotes,
}) {
  await followupsApi.completeFollowup(followup.id);

  if (callStatus) {
    await contactsApi.updateContact(followup.contact_id, { status: callStatus });
  }

  if (completionNotes.trim() || callStatus) {
    const noteContent = callStatus
      ? `Follow-up completed - Status: ${callStatus}${
          completionNotes.trim() ? `. Notes: ${completionNotes}` : ''
        }`
      : `Follow-up completed: ${completionNotes}`;
    await notesApi.createNote({ contact_id: followup.contact_id, content: noteContent });
  }

  if (scheduleNext && nextFollowupDate) {
    await followupsApi.createFollowup({
      contact_id: followup.contact_id,
      follow_up_date: new Date(nextFollowupDate).toISOString(),
      notes: nextFollowupNotes || 'Next follow-up scheduled',
    });
  }
}

export function CompleteFollowupModal({ followup, onClose }) {
  const [callStatus, setCallStatus] = useState(followup.contact?.status || '');
  const [completionNotes, setCompletionNotes] = useState('');
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextFollowupDate, setNextFollowupDate] = useState('');
  const [nextFollowupNotes, setNextFollowupNotes] = useState('');

  const statusMeta = CALL_OUTCOMES.find((s) => s.value === callStatus) || CALL_OUTCOMES[0];

  const { mutate: complete, isPending } = useMutation(completeFollowupWorkflow, {
    invalidates: ['followups.upcoming', 'followups.list', 'activityLogs', 'contacts.count'],
    successMessage: 'Follow-up completed successfully!',
    errorMessage: 'Failed to complete follow-up',
    onSuccess: onClose,
  });

  const handleSubmit = () => {
    complete({
      followup,
      callStatus,
      completionNotes,
      scheduleNext,
      nextFollowupDate,
      nextFollowupNotes,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center sm:p-4 z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-md w-full max-h-[92vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b px-4 sm:px-6 py-4 flex justify-between items-center z-10">
          <h2 className="text-base sm:text-xl font-bold text-gray-800">Complete Follow-up</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 min-w-11 min-h-11 flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {/* Contact summary */}
          <div>
            <SectionHeading>Follow-up</SectionHeading>
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
              <p className="font-semibold text-sm text-gray-800">{getContactName(followup)}</p>
              <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
                <Phone size={12} /> {getContactPhone(followup)}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">Due: {format12Hour(followup.follow_up_date)}</p>
              {followup.notes && (
                <p className="text-xs text-gray-500 mt-1 italic">"{followup.notes}"</p>
              )}
            </div>
          </div>

          {/* Outcome */}
          <div>
            <SectionHeading>Call Outcome</SectionHeading>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Status</label>
                <select
                  value={callStatus}
                  onChange={(e) => setCallStatus(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg text-sm font-medium ${statusMeta.badge || 'border-gray-300 bg-white'}`}
                >
                  {CALL_OUTCOMES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Additional Notes (Optional)</label>
                <textarea
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Any additional details about the call..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base resize-y"
                  rows="3"
                />
              </div>
            </div>
          </div>

          {/* Next follow-up */}
          <div>
            <SectionHeading>Next Follow-up</SectionHeading>
            <label className="flex items-center gap-2 min-h-9 mb-2">
              <input
                type="checkbox"
                checked={scheduleNext}
                onChange={(e) => setScheduleNext(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-gray-700">Schedule a next follow-up</span>
            </label>

            {scheduleNext && (
              <div className="space-y-3 p-3 border border-amber-200 rounded-lg bg-amber-50">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date &amp; Time</label>
                  <input
                    type="datetime-local"
                    value={nextFollowupDate}
                    onChange={(e) => setNextFollowupDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base bg-white"
                    required={scheduleNext}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Notes (Optional)</label>
                  <input
                    type="text"
                    value={nextFollowupNotes}
                    onChange={(e) => setNextFollowupNotes(e.target.value)}
                    placeholder="Purpose of next follow-up..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base bg-white"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm min-h-9"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending || (scheduleNext && !nextFollowupDate)}
              className="ml-auto px-4 py-2 border border-green-200 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition font-medium text-sm min-h-9 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check size={14} /> {isPending ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
