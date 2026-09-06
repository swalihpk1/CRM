import React, { useState } from 'react';
import { Phone, Clock, Check, User, Pencil, Trash2, X } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { format12Hour, getContactName, getContactPhone, getFollowupCreatedBy } from '../../lib/formatters';

function waHref(phone) {
  return `https://wa.me/${String(phone).replace(/[^\d]/g, '')}`;
}

// datetime-local wants "YYYY-MM-DDTHH:mm" in local time — follow_up_date
// is stored as an ISO string, so this strips the seconds/offset for the
// input without shifting the displayed time to UTC.
function toDatetimeLocalValue(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function FollowupCard({ followup, onOpenContact, onComplete, onEdit, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editDate, setEditDate] = useState(() => toDatetimeLocalValue(followup.follow_up_date));
  const [editNotes, setEditNotes] = useState(followup.notes || '');

  const isOverdue = followup.status === 'overdue';
  const isCompleted = followup.status === 'completed';
  const cardTone = isCompleted
    ? 'bg-green-50 border-green-200'
    : isOverdue
    ? 'bg-red-50 border-red-200'
    : 'bg-blue-50 border-blue-200';
  const timeTone = isCompleted ? 'text-green-600' : isOverdue ? 'text-red-600' : 'text-indigo-600';
  const phone = getContactPhone(followup);
  const createdBy = getFollowupCreatedBy(followup);
  const canEdit = Boolean(onEdit) && !isCompleted;

  const startEdit = (e) => {
    e.stopPropagation();
    setEditDate(toDatetimeLocalValue(followup.follow_up_date));
    setEditNotes(followup.notes || '');
    setIsEditing(true);
  };

  const cancelEdit = (e) => {
    e.stopPropagation();
    setIsEditing(false);
  };

  const saveEdit = (e) => {
    e.stopPropagation();
    if (!editDate) return;
    onEdit(followup, {
      follow_up_date: new Date(editDate).toISOString(),
      notes: editNotes,
    });
    setIsEditing(false);
  };

  return (
    <div
      className={`${cardTone} border rounded-lg p-3 ${isEditing ? '' : 'cursor-pointer hover:shadow-sm'} transition`}
      onClick={isEditing ? undefined : () => onOpenContact(followup)}
    >
      <div className="flex justify-between items-start gap-2">
        <p className="font-semibold text-sm text-gray-800 truncate flex-1 min-w-0">{getContactName(followup)}</p>

        {canEdit && !isEditing && (
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={startEdit}
              title="Edit"
              className="w-6 h-6 flex items-center justify-center bg-white border border-gray-200 text-gray-500 rounded hover:bg-gray-50"
            >
              <Pencil size={11} />
            </button>
            <button
              onClick={() => onDelete(followup)}
              title="Delete"
              className="w-6 h-6 flex items-center justify-center bg-white border border-red-200 text-red-500 rounded hover:bg-red-50"
            >
              <Trash2 size={11} />
            </button>
          </div>
        )}
        {isEditing && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={saveEdit}
              disabled={!editDate}
              title="Save"
              className="w-6 h-6 flex items-center justify-center bg-green-50 border border-green-200 text-green-700 rounded hover:bg-green-100 disabled:opacity-50"
            >
              <Check size={11} />
            </button>
            <button
              onClick={cancelEdit}
              title="Cancel"
              className="w-6 h-6 flex items-center justify-center bg-white border border-gray-200 text-gray-500 rounded hover:bg-gray-50"
            >
              <X size={11} />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mt-0.5">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-600 flex items-center gap-1">
            <Phone size={12} /> {phone}
          </p>

          {isEditing ? (
            <div className="mt-1.5 space-y-1.5" onClick={(e) => e.stopPropagation()}>
              <input
                type="datetime-local"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white"
              />
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Notes"
                rows={2}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs bg-white resize-y"
              />
            </div>
          ) : (
            <>
              <p className={`text-xs font-medium mt-0.5 flex items-center gap-1 ${timeTone}`}>
                <Clock size={12} />
                {isCompleted ? 'Completed:' : isOverdue ? 'Overdue:' : 'Scheduled:'}{' '}
                {format12Hour(followup.follow_up_date)}
              </p>
              {createdBy && (
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                  <User size={12} /> Created by {createdBy}
                </p>
              )}
              {followup.notes && (
                <p className="text-xs text-gray-700 mt-1.5 italic bg-white bg-opacity-50 p-1.5 rounded">
                  "{followup.notes}"
                </p>
              )}
            </>
          )}
        </div>

        {!isEditing && !isCompleted && (
          <div className="grid grid-cols-3 gap-1.5 w-full sm:w-auto sm:flex shrink-0">
            <a
              href={`tel:${phone}`}
              className="min-h-8 px-2 flex items-center justify-center gap-1 bg-white border border-gray-200 text-indigo-600 rounded-lg hover:bg-gray-50 text-xs font-semibold whitespace-nowrap"
              title="Call"
              onClick={(e) => e.stopPropagation()}
            >
              <Phone size={14} /> Call
            </a>
            <a
              href={waHref(phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-8 px-2 flex items-center justify-center gap-1 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-xs font-semibold whitespace-nowrap"
              title="WhatsApp"
              onClick={(e) => e.stopPropagation()}
            >
              <FaWhatsapp size={14} color="#25D366" /> WA
            </a>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onComplete(followup);
              }}
              className="px-2 sm:px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-semibold whitespace-nowrap flex items-center justify-center gap-1 min-h-8"
            >
              <Check size={13} /> Complete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
