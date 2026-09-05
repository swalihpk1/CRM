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

export function DemoReportsPage() {
  const [dateRange, setDateRange] = useState({ start: daysAgoIso(30), end: todayIso() });
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
    setDateRange({ start: daysAgoIso(days), end: todayIso() });
  };

  return (
    <div>
      <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 mb-6">🎬 Demo Reports</h2>

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

      <div className="bg-white rounded-xl shadow-md p-4 sm:p-6 mb-8">
        <div className="flex flex-col sm:flex-row flex-wrap gap-4 sm:items-end">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setQuickRange(7)}
              className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm min-h-9"
            >
              Last 7 days
            </button>
            <button
              onClick={() => setQuickRange(30)}
              className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm min-h-9"
            >
              Last 30 days
            </button>
            <button
              onClick={() => setQuickRange(90)}
              className="px-3 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-sm min-h-9"
            >
              Last 90 days
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-base"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg text-base"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Group By</label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-base"
              >
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <h3 className="text-sm sm:text-base font-semibold text-gray-800">Demo Activity Report</h3>
        </div>
        <DemoReportTable rows={reportData} loading={isLoading} />
      </div>
    </div>
  );
}
