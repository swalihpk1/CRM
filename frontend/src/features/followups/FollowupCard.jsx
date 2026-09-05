import React from 'react';
import { format12Hour, getContactName, getContactPhone } from '../../lib/formatters';

export function FollowupCard({ followup, onOpenContact, onComplete }) {
  const isOverdue = followup.status === 'overdue';
  const isCompleted = followup.status === 'completed';
  const cardTone = isCompleted
    ? 'bg-green-50 border-green-200'
    : isOverdue
    ? 'bg-red-50 border-red-200'
    : 'bg-blue-50 border-blue-200';
  const timeTone = isCompleted ? 'text-green-600' : isOverdue ? 'text-red-600' : 'text-indigo-600';
  const phone = getContactPhone(followup);

  return (
    <div
      className={`${cardTone} border-2 rounded-lg p-4 cursor-pointer hover:shadow-md transition`}
      onClick={() => onOpenContact(followup)}
    >
      <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm sm:text-base text-gray-800">{getContactName(followup)}</p>
          <p className="text-sm text-gray-600 mt-1">📞 {phone}</p>
          {followup.contact?.assigned_staff && (
            <p className="text-sm text-indigo-600 mt-1 font-medium">
              👤 Staff: {followup.contact.assigned_staff}
            </p>
          )}
          <p className={`text-sm font-medium mt-1 ${timeTone}`}>
            ⏰ {isCompleted ? 'Completed:' : isOverdue ? 'Overdue:' : 'Scheduled:'}{' '}
            {format12Hour(followup.follow_up_date)}
          </p>
          {followup.notes && (
            <p className="text-sm text-gray-700 mt-2 italic bg-white bg-opacity-50 p-2 rounded">
              "{followup.notes}"
            </p>
          )}
        </div>
        {!isCompleted && (
          <div className="flex gap-2 w-full sm:w-auto">
            <a
              href={`tel:${phone}`}
              className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold whitespace-nowrap text-center min-h-11 flex items-center justify-center"
              title="Call Now"
              onClick={(e) => e.stopPropagation()}
            >
              📞 Call
            </a>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onComplete(followup);
              }}
              className="flex-1 sm:flex-none px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-semibold whitespace-nowrap min-h-11"
            >
              ✓ Complete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
