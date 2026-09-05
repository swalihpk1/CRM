import React, { useState } from 'react';
import { toast } from '../../components/ui/sonner';
import * as productivityApi from '../../api/productivity';
import { useQuery } from '../../hooks/useQuery';
import { useDateRange } from './useDateRange';
import { StaffTable } from './StaffTable';
import { MetricDetailsModal } from './MetricDetailsModal';

const RANGE_OPTIONS = [
  { key: 'today', label: '📅 Today' },
  { key: 'yesterday', label: '📅 Yesterday' },
  { key: 'this_week', label: '📅 This Week' },
  { key: 'this_month', label: '📅 This Month' },
  { key: 'custom', label: '📅 Custom Range' },
];

export function ProductivityPage() {
  const { preset, setPreset, customStart, setCustomStart, customEnd, setCustomEnd, getRange } =
    useDateRange('today');

  const { start, end } = getRange();

  const { data: staffData = [], isLoading } = useQuery(
    (signal) =>
      productivityApi
        .getStaffSummary({ start_date: start, end_date: end }, { signal })
        .catch((err) => {
          toast.error('Failed to load productivity data');
          throw err;
        }),
    [start, end]
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">Staff Productivity</h2>
      </div>

      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setPreset(opt.key)}
                className={`px-4 py-2 rounded-lg transition font-medium min-h-11 ${
                  preset === opt.key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="flex flex-wrap gap-3 items-center">
              <div>
                <label className="text-sm font-medium text-gray-700 mr-2">From:</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-11 text-base"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mr-2">To:</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 min-h-11 text-base"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <div className="inline-flex items-center">
            <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="ml-3 text-lg text-gray-600">Loading productivity data...</span>
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
