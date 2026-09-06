import React, { useState } from 'react';
import * as demosApi from '../../api/demos';
import { useQuery } from '../../hooks/useQuery';
import { StatsGrid } from '../../components/StatsGrid';
import { DemoReportTable } from './DemoReportTable';

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function daysAgoIso(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
}

const QUICK_RANGES = [
  { key: 7, label: 'Last 7 days' },
  { key: 30, label: 'Last 30 days' },
  { key: 90, label: 'Last 90 days' },
];

export function DemoReportsPage() {
  const [dateRange, setDateRange] = useState({ start: daysAgoIso(30), end: todayIso() });
  const [activeRange, setActiveRange] = useState(30);
  const [groupBy, setGroupBy] = useState('day');

  // useQuery aborts the in-flight request on rapid date/groupBy changes —
  // the old version had a real race here (Promise.all with no
  // cancellation), where a slower earlier response could overwrite a
  // faster later one if the user clicked quick-range buttons in
  // succession.
  const { data, isLoading } = useQuery(
    async (signal) => {
      const startDate = new Date(dateRange.start).toISOString();
      const endDate = new Date(dateRange.end + 'T23:59:59').toISOString();
      const [report, summary] = await Promise.all([
        demosApi.getDemoReport({ start: startDate, end: endDate, group_by: groupBy }, { signal }),
        demosApi.getDemoSummary({ start: startDate, end: endDate }, { signal }),
      ]);
      return { report, summary };
    },
    [dateRange.start, dateRange.end, groupBy]
  );

  const reportData = data?.report ?? [];
  const summary = data?.summary ?? { given: 0, watched: 0, conversion: 0 };

  const setQuickRange = (days) => {
    setActiveRange(days);
    setDateRange({ start: daysAgoIso(days), end: todayIso() });
  };

  const setCustomStart = (value) => {
    setActiveRange(null);
    setDateRange((prev) => ({ ...prev, start: value }));
  };

  const setCustomEnd = (value) => {
    setActiveRange(null);
    setDateRange((prev) => ({ ...prev, end: value }));
  };

  return (
    <div>
      <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 mb-4 lg:mb-6">Demo Reports</h2>

      <div className="mb-4">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setQuickRange(r.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition min-h-8 ${
                activeRange === r.key ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 lg:mb-8">
        <StatsGrid
          items={[
            { key: 'given', label: 'Demos Given', value: summary.given, colorClass: 'text-orange-600' },
            { key: 'watched', label: 'Demos Watched', value: summary.watched, colorClass: 'text-green-600' },
            {
              key: 'conversion',
              label: 'Conversion Rate',
              value: `${(summary.conversion * 100).toFixed(1)}%`,
              colorClass: 'text-blue-600',
            },
          ]}
          columnsSm={3}
          columnsLg={3}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-3 sm:items-end">
          <div className="min-w-0">
            <label className="block text-xs text-gray-500 mb-1 truncate">Start Date</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-full px-1.5 sm:px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs sm:text-sm"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-xs text-gray-500 mb-1 truncate">End Date</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-full px-1.5 sm:px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs sm:text-sm"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-xs text-gray-500 mb-1 truncate">Group By</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="w-full px-1.5 sm:px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs sm:text-sm bg-white"
            >
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Demo Activity Report</h3>
        </div>
        <DemoReportTable rows={reportData} loading={isLoading} />
      </div>
    </div>
  );
}
