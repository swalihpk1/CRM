import React from 'react';

const STATUS_STYLES = {
  scheduled: { bg: 'bg-gray-50', badge: 'bg-green-100 text-green-800', badgeLabel: '✓ Scheduled' },
  completed: { bg: 'bg-blue-50', badge: 'bg-blue-100 text-blue-800', badgeLabel: '✓ Completed' },
  cancelled: {
    bg: 'bg-red-50',
    badge: 'bg-red-100 text-red-800',
    badgeLabel: '✗ Cancelled',
    strike: true,
  },
};

export function MeetingCard({ meeting, onComplete, onCancel, onReschedule, onDelete }) {
  const style = STATUS_STYLES[meeting.status] || STATUS_STYLES.scheduled;
  const titleClass = style.strike
    ? 'text-sm sm:text-base font-semibold text-gray-600 line-through'
    : meeting.status === 'completed'
    ? 'text-sm sm:text-base font-semibold text-gray-700'
    : 'text-sm sm:text-base font-semibold text-indigo-700';

  return (
    <div className={`${style.bg} rounded-lg p-4`}>
      <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <h3 className={titleClass}>{meeting.title}</h3>
          <div
            className={`flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-600 ${
              style.strike ? 'line-through' : ''
            }`}
          >
            <span>
              📅 {meeting.date} {meeting.time && `at ${meeting.time}`}
            </span>
            {meeting.location && <span>📍 {meeting.location}</span>}
          </div>
          {meeting.notes && (
            <p
              className={`text-gray-600 text-sm mt-1 italic ${style.strike ? 'line-through' : ''}`}
            >
              "{meeting.notes}"
            </p>
          )}
        </div>
        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${style.badge}`}>
          {style.badgeLabel}
        </span>
      </div>

      {meeting.attendees && meeting.attendees.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex flex-wrap gap-1">
            {meeting.attendees.map((attendee) => (
              <span
                key={attendee.id}
                className={`inline-flex items-center bg-indigo-50 text-indigo-700 rounded px-2 py-1 text-xs ${
                  style.strike ? 'line-through' : ''
                }`}
              >
                {attendee.name} ({attendee.phone})
              </span>
            ))}
          </div>
        </div>
      )}

      {meeting.status === 'scheduled' && (
        <div className="mt-3 flex gap-2 flex-wrap">
          <button
            onClick={onComplete}
            className="px-3 py-2 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition min-h-9"
          >
            ✓ Complete
          </button>
          <button
            onClick={onReschedule}
            className="px-3 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition min-h-9"
          >
            📅 Reschedule
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-2 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 transition min-h-9"
          >
            ⏸️ Cancel
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-2 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition min-h-9"
          >
            🗑️ Delete
          </button>
        </div>
      )}

      {meeting.status !== 'scheduled' && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={onDelete}
            className="px-3 py-2 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition min-h-9"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
