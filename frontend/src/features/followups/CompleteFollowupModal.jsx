import React, { useState } from 'react';
import * as followupsApi from '../../api/followups';
import * as contactsApi from '../../api/contacts';
import * as notesApi from '../../api/notes';
import { useMutation } from '../../hooks/useMutation';
import { format12Hour, getContactName, getContactPhone } from '../../lib/formatters';

const CALL_OUTCOMES = [
  { value: '', label: 'Select call outcome...' },
  { value: 'Not Attending', label: '⏸️ Not Attending - Unavailable/Busy' },
  { value: 'Interested', label: '✅ Interested - Positive response' },
  { value: 'Not Interested', label: '❌ Not Interested - Declined' },
  { value: 'Follow-up', label: '⏰ Follow-up - Needs reconnection' },
  { value: 'Logged In', label: '🎯 Logged In - Purchased & Active' },
  { value: 'Irrelevant', label: '🚫 Irrelevant - Wrong target' },
];

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
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-base sm:text-xl font-bold text-gray-800">Complete Follow-up</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl min-w-11 min-h-11 flex items-center justify-center"
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="font-semibold text-gray-800">{getContactName(followup)}</p>
            <p className="text-sm text-gray-600">📞 {getContactPhone(followup)}</p>
            <p className="text-sm text-gray-600">Due: {format12Hour(followup.follow_up_date)}</p>
            {followup.notes && <p className="text-sm text-gray-500 mt-1 italic">"{followup.notes}"</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Call Outcome Status</label>
            <select
              value={callStatus}
              onChange={(e) => setCallStatus(e.target.value)}
              className="w-full px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-base"
            >
              {CALL_OUTCOMES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Call Notes (Optional)
            </label>
            <textarea
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              placeholder="Any additional details about the call..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-base"
              rows="3"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 min-h-9">
              <input
                type="checkbox"
                checked={scheduleNext}
                onChange={(e) => setScheduleNext(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-gray-700">Schedule Next Follow-up</span>
            </label>
          </div>

          {scheduleNext && (
            <div className="space-y-3 ml-2 sm:ml-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Next Follow-up Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={nextFollowupDate}
                  onChange={(e) => setNextFollowupDate(e.target.value)}
                  className="w-full px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-base"
                  required={scheduleNext}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Next Follow-up Notes (Optional)
                </label>
                <input
                  type="text"
                  value={nextFollowupNotes}
                  onChange={(e) => setNextFollowupNotes(e.target.value)}
                  placeholder="Purpose of next follow-up..."
                  className="w-full px-3 py-3 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-base"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 sm:py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition font-semibold min-h-11"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isPending || (scheduleNext && !nextFollowupDate)}
              className="flex-1 px-4 py-3 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition font-semibold min-h-11"
            >
              {isPending ? 'Saving…' : '✓ Confirm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
