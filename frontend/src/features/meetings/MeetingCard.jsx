import React from 'react';
import { Calendar, MapPin, Check, CalendarClock, Ban, Trash2 } from 'lucide-react';

const STATUS_STYLES = {
  scheduled: { bg: 'bg-blue-50 border-blue-200', badge: 'bg-green-50 text-green-700 border-green-200', badgeLabel: 'Scheduled' },
  completed: { bg: 'bg-green-50 border-green-200', badge: 'bg-blue-50 text-blue-700 border-blue-200', badgeLabel: 'Completed' },
  cancelled: {
    bg: 'bg-red-50 border-red-200',
    badge: 'bg-red-50 text-red-700 border-red-200',
    badgeLabel: 'Cancelled',
    strike: true,
  },
};

/** Neutral, soft-tinted action button matching the app-wide standard. */
function ActionButton({ onClick, tone = 'default', children, className: extraClassName }) {
  const toneClass =
    tone === 'danger'
      ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
      : tone === 'positive'
      ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
      : tone === 'info'
      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
      : tone === 'warning'
      ? 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100'
      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50';
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1.5 border rounded-lg text-xs font-semibold whitespace-nowrap flex items-center justify-center gap-1 min-h-8 transition ${toneClass} ${extraClassName || ''}`}
    >
      {children}
    </button>
  );
}

export function MeetingCard({ meeting, onComplete, onCancel, onReschedule, onDelete }) {
  const style = STATUS_STYLES[meeting.status] || STATUS_STYLES.scheduled;
  const titleClass = style.strike
    ? 'text-sm font-semibold text-gray-600 line-through'
    : meeting.status === 'completed'
    ? 'text-sm font-semibold text-gray-700'
    : 'text-sm font-semibold text-indigo-700';

  return (
    <div className={`${style.bg} border rounded-lg p-3`}>
      <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
        <div className="flex-1 min-w-0">
          <h3 className={`${titleClass} truncate`}>{meeting.title}</h3>
          <div
            className={`flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-xs text-gray-600 ${
              style.strike ? 'line-through' : ''
            }`}
          >
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {meeting.date} {meeting.time && `at ${meeting.time}`}
            </span>
            {meeting.location && (
              <span className="flex items-center gap-1">
                <MapPin size={12} /> {meeting.location}
              </span>
            )}
          </div>
          {meeting.notes && (
            <p className={`text-gray-700 text-xs mt-1.5 italic bg-white bg-opacity-50 p-1.5 rounded ${style.strike ? 'line-through' : ''}`}>
              "{meeting.notes}"
            </p>
          )}
        </div>
        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium border shrink-0 ${style.badge}`}>
          {style.badgeLabel}
        </span>
      </div>

      {meeting.attendees && meeting.attendees.length > 0 && (
        <div className="mt-2 pt-2 border-t border-white border-opacity-60">
          <div className="flex flex-wrap gap-1">
            {meeting.attendees.map((attendee) => (
              <span
                key={attendee.id}
                className={`inline-flex items-center bg-white border border-gray-200 text-gray-700 rounded px-2 py-0.5 text-xs ${
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
        <div className="mt-2.5 flex gap-1.5 flex-wrap">
          <ActionButton onClick={onComplete} tone="positive">
            <Check size={13} /> Complete
          </ActionButton>
          <ActionButton onClick={onReschedule} tone="info">
            <CalendarClock size={13} /> Reschedule
          </ActionButton>
          <ActionButton onClick={onCancel} tone="warning">
            <Ban size={13} /> Cancel
          </ActionButton>
          <ActionButton onClick={onDelete} tone="danger" className="ml-auto">
            <Trash2 size={13} /> Delete
          </ActionButton>
        </div>
      )}

      {meeting.status !== 'scheduled' && (
        <div className="mt-2.5 flex gap-1.5">
          <ActionButton onClick={onDelete} tone="danger">
            <Trash2 size={13} /> Delete
          </ActionButton>
        </div>
      )}
    </div>
  );
}
