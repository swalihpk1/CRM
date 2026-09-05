import React from 'react';

export const STATUSES = [
  'None',
  'Called',
  'Not Attending',
  'Follow-up',
  'Interested',
  'Not Interested',
  'Irrelevant',
  'Logged In',
];

export function ContactsToolbar({ searchQuery, onSearchChange, statusFilter, onStatusChange }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-4 mb-4 lg:mb-6 flex flex-col sm:flex-row gap-4">
      <input
        type="text"
        placeholder="Search contacts..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="flex-1 px-4 py-3 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-base"
      />
      <select
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value)}
        className="px-4 py-3 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white text-base min-w-0 sm:min-w-[150px]"
      >
        <option value="">All Statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </div>
  );
}

export function BulkActionsBar({ count, onUpdateStatus, onDelete, onClear }) {
  if (count === 0) return null;

  return (
    <div className="bg-indigo-50 border-l-4 border-indigo-400 p-4 mb-4 rounded-lg">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <span className="text-indigo-800 font-medium text-sm lg:text-base">
          {count} contact{count !== 1 ? 's' : ''} selected
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <select
            onChange={(e) => {
              if (e.target.value) {
                onUpdateStatus(e.target.value);
                e.target.value = '';
              }
            }}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 bg-white flex-1 sm:flex-none min-w-0 min-h-9"
          >
            <option value="">Update Status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            onClick={onDelete}
            className="px-3 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition min-h-9"
          >
            Delete Selected
          </button>
          <button
            onClick={onClear}
            className="px-3 py-2 bg-gray-500 text-white text-sm rounded-md hover:bg-gray-600 transition min-h-9"
          >
            Clear Selection
          </button>
        </div>
      </div>
    </div>
  );
}
