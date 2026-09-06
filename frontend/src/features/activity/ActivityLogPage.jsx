import React, { useState } from 'react';
import { X } from 'lucide-react';
import * as activityLogsApi from '../../api/activityLogs';
import { useInfiniteList } from '../../hooks/useInfiniteList';
import { useInvalidationSubscription } from '../../context/CacheContext';
import { ActivityLogTableRow, ActivityLogCard } from './ActivityLogRow';

// activityFormatters.js's contact-lookup helpers accept a `contacts` list
// as a fallback path for logs written before the backend started storing
// shop_name directly on the log (see backend-node/CLAUDE.md). Every new
// log already carries its own shop_name, so there's no longer a reason to
// eagerly fetch contacts on every Activity Log page load just to guess at
// it — passing an empty list here simply lets old logs fall through to
// their existing N/A/"Meeting Contact" display, same as an unmatched
// lookup already did.
const NO_CONTACTS = [];

export function ActivityLogPage() {
  const [filterDate, setFilterDate] = useState('');

  const { items: logs, isLoading, isLoadingMore, hasMore, sentinelRef, reset } = useInfiniteList(
    ({ skip, limit }, signal) =>
      activityLogsApi.getActivityLogs(
        { skip, limit, ...(filterDate ? { from_date: filterDate, to_date: filterDate } : {}) },
        { signal }
      ),
    { pageSize: 20, params: { filterDate } }
  );
  useInvalidationSubscription('activityLogs', reset);

  return (
    <div>
      <div className="flex flex-row justify-between items-center gap-3 mt-2 mb-4 lg:mb-6">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">Activity Log</h2>
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-xs sm:text-sm"
          />
          {filterDate && (
            <button
              onClick={() => setFilterDate('')}
              title="Clear date filter"
              className="text-gray-400 hover:text-gray-600 min-w-8 min-h-8 flex items-center justify-center"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {logs.length === 0 && !isLoading ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-sm sm:text-base">No activity logs yet</p>
            <p className="text-sm mt-2">
              Actions like creating contacts, updating statuses, and scheduling follow-ups will
              appear here
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <div className="lg:hidden divide-y">
              {logs.map((log) => (
                <ActivityLogCard key={log.id} log={log} contacts={NO_CONTACTS} />
              ))}
            </div>

            {/* Tablet/desktop: table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date &amp; Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shop Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact/Target</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {logs.map((log) => (
                    <ActivityLogTableRow key={log.id} log={log} contacts={NO_CONTACTS} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* IntersectionObserver sentinel — replaces the old duplicated
            window.scroll listener (previously registered TWICE in this
            component, double-firing onLoadMore per scroll event). */}
        <div ref={sentinelRef} />

        {isLoadingMore && (
          <div className="text-center py-4">
            <div className="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-white bg-indigo-500">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Loading more activity logs...
            </div>
          </div>
        )}

        {!hasMore && logs.length > 0 && (
          <div className="text-center py-4 text-gray-500">No more activity logs to load</div>
        )}
      </div>
    </div>
  );
}
