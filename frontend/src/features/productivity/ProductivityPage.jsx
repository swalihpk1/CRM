import React, { useState } from 'react';
import { toast } from '../../components/ui/sonner';
import * as productivityApi from '../../api/productivity';
import { useQuery } from '../../hooks/useQuery';
import { useDateRange } from './useDateRange';
import { StaffTable } from './StaffTable';
import { MetricDetailsModal } from './MetricDetailsModal';

const RANGE_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
];

export function ProductivityPage() {
  const { preset, setPreset, customStart, setCustomStart, customEnd, setCustomEnd, getRange } =
    useDateRange('today');

  const { start, end } = getRange();

  // Errors are surfaced via useQuery's own onError, not a local .catch()
  // here — a .catch() attached directly to the fetch promise runs on EVERY
  // rejection, including a canceled/superseded request (e.g. React's dev
  // double-mount aborting the first of two mounts, or a fast date-range
  // change aborting the previous request), and would toast an error even
  // though a fresh request is already succeeding right after. useQuery
  // already distinguishes "canceled" from "real failure" before calling
  // onError, so only genuine failures reach the toast.
  const { data: staffData = [], isLoading } = useQuery(
    (signal) => productivityApi.getStaffSummary({ start_date: start, end_date: end }, { signal }),
    [start, end],
    { onError: () => toast.error('Failed to load productivity data') }
  );

  const [detailsTarget, setDetailsTarget] = useState(null); // { userId, userName, metric }
  const { data: detailsData, isLoading: detailsLoading } = useQuery(
    (signal) => {
      if (!detailsTarget) return Promise.resolve([]);
      return productivityApi
        .getStaffDetails(
          {
            user_id: detailsTarget.userId,
            metric_type: detailsTarget.metric,
            start_date: start,
            end_date: end,
          },
          { signal }
        )
        .then((res) => res.data);
    },
    [detailsTarget, start, end],
    { enabled: !!detailsTarget }
  );

  const handleMetricClick = (userId, userName, metric) => {
    setDetailsTarget({ userId, userName, metric });
  };

  return (
    <div>
      <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 mb-4 lg:mb-6">Staff Productivity</h2>

      <div className="mb-4">
        <div className="flex flex-wrap gap-1.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setPreset(opt.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition min-h-8 ${
                preset === opt.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => setPreset('custom')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition min-h-8 ${
              preset === 'custom' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Custom
          </button>
        </div>

        {preset === 'custom' && (
          <div className="flex flex-wrap gap-3 items-end mt-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="inline-flex items-center">
            <svg className="animate-spin h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="ml-3 text-sm text-gray-600">Loading productivity data...</span>
          </div>
        </div>
      ) : (
        <StaffTable staffData={staffData} onMetricClick={handleMetricClick} />
      )}

      {detailsTarget && (
        <MetricDetailsModal
          staffName={detailsTarget.userName}
          metric={detailsTarget.metric}
          data={detailsData ?? []}
          loading={detailsLoading}
          onClose={() => setDetailsTarget(null)}
        />
      )}
    </div>
  );
}
