import React, { useEffect, useState } from 'react';
import { toast } from '../../components/ui/sonner';
import * as meetingsApi from '../../api/meetings';
import { useMutation } from '../../hooks/useMutation';

export function RescheduleModal({ meeting, onClose }) {
  const [date, setDate] = useState(meeting?.date || '');
  const [time, setTime] = useState(meeting?.time || '');

  useEffect(() => {
    setDate(meeting?.date || '');
    setTime(meeting?.time || '');
  }, [meeting]);

  const { mutate: updateMeeting, isPending } = useMutation(
    (patch) => meetingsApi.updateMeeting(meeting.id, patch),
    {
      invalidates: ['meetings', 'activityLogs'],
      successMessage: 'Meeting rescheduled successfully!',
      onSuccess: onClose,
    }
  );

  if (!meeting) return null;

  const handleSubmit = () => {
    if (!date) {
      toast.error('Please select a new date');
      return;
    }
    updateMeeting({ date, time: time || null });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center sm:p-4 z-[100]">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-md w-full">
        <div className="border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-base sm:text-xl font-bold text-gray-800">Reschedule Meeting</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl min-w-11 min-h-11 flex items-center justify-center"
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-gray-700 mb-2">{meeting.title}</h3>
            <p className="text-sm text-gray-600">
              Current: {meeting.date} {meeting.time && `at ${meeting.time}`}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Date *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-base"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-3 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-base"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="flex-1 bg-indigo-600 text-white py-3 sm:py-2 rounded-lg hover:bg-indigo-700 transition font-semibold min-h-11 disabled:opacity-60"
            >
              {isPending ? 'Rescheduling…' : 'Reschedule Meeting'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-gray-500 text-white py-3 sm:py-2 rounded-lg hover:bg-gray-600 transition font-semibold min-h-11"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
