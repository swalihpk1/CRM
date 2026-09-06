import React from 'react';

const FILTERS = [
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'last_week', label: 'Last Week' },
  { key: 'last_month', label: 'Last Month' },
];

/**
 * Compact quick-filter row + an inline "Custom" toggle. Selecting Custom
 * reveals a from/to date range right below the row instead of always
 * showing a single date input — keeps the default state to one small row.
 */
export function DateFilterBar({ dateFilter, isCustom, fromDate, toDate, onSetFilter, onSetCustomRange }) {
  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => onSetFilter(f.key)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition min-h-8 ${
              dateFilter === f.key && !isCustom
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={() => onSetFilter('custom_range')}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition min-h-8 ${
            isCustom ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Custom
        </button>
      </div>

      {isCustom && (
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => onSetCustomRange(e.target.value, toDate)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => onSetCustomRange(fromDate, e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}
