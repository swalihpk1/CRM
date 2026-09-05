import React from 'react';

const FILTERS = [
  { key: 'today', label: '📅 Today' },
  { key: 'tomorrow', label: '📅 Tomorrow' },
  { key: 'this_week', label: '📅 This Week' },
  { key: 'next_week', label: '📅 Next Week' },
];

export function DateFilterBar({ dateFilter, customDate, onSetFilter, onSetCustomDate }) {
  return (
    <div className="space-y-3 mb-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => onSetFilter(f.key)}
            className={`px-4 py-2 rounded-lg transition font-medium min-h-11 ${
              dateFilter === f.key && !customDate
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Or select a specific date:</label>
        <input
          type="date"
          value={customDate}
          onChange={(e) => onSetCustomDate(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base"
        />
        {customDate && (
          <button
            onClick={() => onSetCustomDate('')}
            className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition text-sm min-h-11"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
