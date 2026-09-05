import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as followupsApi from '../../api/followups';
import { useQuery } from '../../hooks/useQuery';
import { useInvalidationSubscription } from '../../context/CacheContext';
import { DateFilterBar } from './DateFilterBar';
import { FollowupList } from './FollowupList';
import { CompleteFollowupModal } from './CompleteFollowupModal';

const FILTER_LABELS = {
  today: 'today',
  tomorrow: 'tomorrow',
  this_week: 'this week',
  next_week: 'next week',
};

export function FollowUpsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'pending';
  const dateFilter = searchParams.get('filter') || 'today';
  const customDate = searchParams.get('date') || '';
  const [completingFollowup, setCompletingFollowup] = useState(null);

  const setActiveTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const setDateFilter = (filter) => {
    const next = new URLSearchParams(searchParams);
    next.set('filter', filter);
    next.delete('date');
    setSearchParams(next, { replace: true });
  };

  const setCustomDate = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('date', value);
    else next.delete('date');
    setSearchParams(next, { replace: true });
  };

  const filterToUse = customDate ? 'custom' : dateFilter;

  // Fetches BOTH pending and completed follow-ups for the active date
  // filter via Promise.all — mirrors the same 2-call pattern the old code
  // used, just centralized in one query instead of a hand-rolled
  // fetchFilteredFollowups() with a manually-attached auth header.
  const { data, isLoading, refetch } = useQuery(
    (signal) => {
      const params = { date_filter: filterToUse, skip: 0, limit: 100 };
      if (customDate) params.custom_date = customDate;
      return Promise.all([
        followupsApi.getPaginatedFollowups(params, { signal }),
        followupsApi.getCompletedFollowups(params, { signal }),
      ]).then(([pendingRes, completedRes]) => ({
        pending: pendingRes.followups || [],
        completed: completedRes.followups || [],
      }));
    },
    [filterToUse, customDate]
  );
  useInvalidationSubscription(['followups.list', 'followups.upcoming'], refetch);

  const pending = data?.pending ?? [];
  const completed = data?.completed ?? [];
  const overdueCount = pending.filter((f) => f.status === 'overdue').length;
  const statistics = {
    total: pending.length + completed.length,
    completed: completed.length,
    pending: pending.length,
    overdue: overdueCount,
  };

  const displayFollowups = activeTab === 'pending' ? pending : completed;

  const dateLabel = customDate
    ? new Date(customDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : FILTER_LABELS[dateFilter] || dateFilter;

  const openContact = (followup) => {
    if (followup.contact) navigate(`?${searchParams.toString()}&contact=${followup.contact.id}`);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 mb-4">Follow-ups Management</h2>

        <DateFilterBar
          dateFilter={dateFilter}
          customDate={customDate}
          onSetFilter={setDateFilter}
          onSetCustomDate={setCustomDate}
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
            <p className="text-xs text-gray-600 font-medium">Total Follow-ups</p>
            <p className="text-xl sm:text-2xl font-bold text-gray-800">{statistics.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-green-500">
            <p className="text-xs text-gray-600 font-medium">Completed</p>
            <p className="text-xl sm:text-2xl font-bold text-green-600">{statistics.completed}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-yellow-500">
            <p className="text-xs text-gray-600 font-medium">Pending</p>
            <p className="text-xl sm:text-2xl font-bold text-yellow-600">{statistics.pending}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-red-500">
            <p className="text-xs text-gray-600 font-medium">Overdue</p>
            <p className="text-xl sm:text-2xl font-bold text-red-600">{statistics.overdue}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 px-4 sm:px-6 py-3 text-sm sm:text-base font-semibold transition min-h-11 ${
              activeTab === 'pending' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            ⏰ Pending ({statistics.pending})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 px-4 sm:px-6 py-3 text-sm sm:text-base font-semibold transition min-h-11 ${
              activeTab === 'completed' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            ✅ Completed ({statistics.completed})
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <FollowupList
            followups={displayFollowups}
            loading={isLoading}
            emptyLabel={
              activeTab === 'pending'
                ? `No pending follow-ups for ${dateLabel}`
                : `No completed follow-ups for ${dateLabel}`
            }
            onOpenContact={openContact}
            onComplete={setCompletingFollowup}
          />
        </div>
      </div>

      {completingFollowup && (
        <CompleteFollowupModal
          followup={completingFollowup}
          onClose={() => setCompletingFollowup(null)}
        />
      )}
    </div>
  );
}
