import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as followupsApi from '../../api/followups';
import * as usersApi from '../../api/users';
import { useAuth } from '../../context/useAuth';
import { useInfiniteList } from '../../hooks/useInfiniteList';
import { useQuery } from '../../hooks/useQuery';
import { useMutation } from '../../hooks/useMutation';
import { useConfirm } from '../../hooks/useConfirm';
import { useInvalidationSubscription } from '../../context/CacheContext';
import { StatsGrid } from '../../components/StatsGrid';
import { DateFilterBar } from './DateFilterBar';
import { FollowupList } from './FollowupList';
import { CompleteFollowupModal } from './CompleteFollowupModal';

const PAGE_SIZE = 15;

const FILTER_LABELS = {
  yesterday: 'yesterday',
  today: 'today',
  tomorrow: 'tomorrow',
  last_week: 'the last week',
  last_month: 'the last month',
};

// Local YYYY-MM-DD (not toISOString, which shifts to UTC and can land on
// the wrong day depending on the viewer's timezone).
function toDateOnly(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Every quick filter is resolved to an explicit {from, to} date range
// entirely in the browser — the backend is never told "yesterday" or
// "last_week", only the two concrete dates, so it stays a plain range
// filter with no named-keyword logic to keep in sync.
function rangeForFilter(key) {
  const now = new Date();
  switch (key) {
    case 'yesterday': {
      const d = addDays(now, -1);
      return [toDateOnly(d), toDateOnly(d)];
    }
    case 'today':
      return [toDateOnly(now), toDateOnly(now)];
    case 'tomorrow': {
      const d = addDays(now, 1);
      return [toDateOnly(d), toDateOnly(d)];
    }
    case 'last_week':
      return [toDateOnly(addDays(now, -7)), toDateOnly(now)];
    case 'last_month':
      return [toDateOnly(addDays(now, -30)), toDateOnly(now)];
    default:
      return [toDateOnly(now), toDateOnly(now)];
  }
}

export function FollowUpsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'pending';
  const dateFilter = searchParams.get('filter') || 'today';
  const isCustom = dateFilter === 'custom_range';
  const [fromDate, toDate] = isCustom
    ? [searchParams.get('from') || '', searchParams.get('to') || '']
    : rangeForFilter(dateFilter);
  const staffFilter = searchParams.get('staff') || '';
  const [completingFollowup, setCompletingFollowup] = useState(null);
  const confirm = useConfirm();
  // Counts from whichever tab was fetched last — each tab's response
  // carries its own accurate total_count regardless of pagination, so
  // switching tabs updates the relevant numbers without ever calling the
  // other tab's endpoint.
  const [pendingMeta, setPendingMeta] = useState({ overdue_count: 0, pending_count: 0 });
  const [completedMeta, setCompletedMeta] = useState({ total_count: 0 });

  // Admin-only "created by" filter — the staff dropdown itself is only
  // fetched for admins (staff users are already scoped to their own
  // follow-ups server-side, so the filter wouldn't do anything for them).
  const { data: staffList = [] } = useQuery(
    (signal) => usersApi.getUsers({ signal }),
    [],
    { enabled: isAdmin }
  );

  const setStaffFilter = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('staff', value);
    else next.delete('staff');
    setSearchParams(next, { replace: true });
  };

  const setActiveTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next, { replace: true });
  };

  const setDateFilter = (filter) => {
    const next = new URLSearchParams(searchParams);
    next.set('filter', filter);
    if (filter !== 'custom_range') {
      next.delete('from');
      next.delete('to');
    }
    setSearchParams(next, { replace: true });
  };

  const setCustomRange = (from, to) => {
    const next = new URLSearchParams(searchParams);
    next.set('filter', 'custom_range');
    if (from) next.set('from', from);
    else next.delete('from');
    if (to) next.set('to', to);
    else next.delete('to');
    setSearchParams(next, { replace: true });
  };

  const hasRange = Boolean(fromDate && toDate);
  const dateParams = hasRange ? { from_date: fromDate, to_date: toDate } : {};
  // created_by only ever has an effect for admins (see backend-node's
  // /followups/paginated and /followups/completed) — sending it as a
  // staff user is harmless since the backend ignores it for non-admins.
  const staffParams = isAdmin && staffFilter ? { created_by: staffFilter } : {};

  // Only the active tab's endpoint is ever called — switching tabs is what
  // triggers that tab's own fetch, rather than always fetching both
  // pending and completed together on every filter change. Within the
  // Pending tab, Overdue and Pending are two independently-paginated
  // sub-lists (each its own request) rather than one combined list —
  // otherwise a large overdue count would bury pending items many pages
  // deep before they ever became visible.
  const overdueList = useInfiniteList(
    ({ skip, limit }, signal) =>
      followupsApi
        .getPaginatedFollowups({ skip, limit, ...dateParams, ...staffParams, status: 'overdue' }, { signal })
        .then((res) => {
          setPendingMeta((prev) => ({ ...prev, overdue_count: res.total_count ?? 0 }));
          return res.followups || [];
        }),
    { pageSize: PAGE_SIZE, params: { fromDate, toDate, staffFilter }, enabled: activeTab === 'pending' }
  );

  const pendingOnlyList = useInfiniteList(
    ({ skip, limit }, signal) =>
      followupsApi
        .getPaginatedFollowups({ skip, limit, ...dateParams, ...staffParams, status: 'pending' }, { signal })
        .then((res) => {
          setPendingMeta((prev) => ({ ...prev, pending_count: res.total_count ?? 0 }));
          return res.followups || [];
        }),
    { pageSize: PAGE_SIZE, params: { fromDate, toDate, staffFilter }, enabled: activeTab === 'pending' }
  );

  const completedList = useInfiniteList(
    ({ skip, limit }, signal) =>
      followupsApi
        .getCompletedFollowups({ skip, limit, ...dateParams, ...staffParams }, { signal })
        .then((res) => {
          setCompletedMeta({ total_count: res.total_count ?? 0 });
          return res.followups || [];
        }),
    { pageSize: PAGE_SIZE, params: { fromDate, toDate, staffFilter }, enabled: activeTab === 'completed' }
  );

  const resetAllLists = () => {
    overdueList.reset();
    pendingOnlyList.reset();
    completedList.reset();
  };

  useInvalidationSubscription(['followups.list', 'followups.upcoming'], resetAllLists);

  const { mutate: editFollowup } = useMutation(
    ({ id, patch }) => followupsApi.updateFollowup(id, patch),
    {
      // Deliberately does NOT invalidate 'followups.list'/'followups.upcoming'
      // — this page subscribes resetAllLists to both of those (see
      // useInvalidationSubscription below), and invalidating them here would
      // immediately undo the in-place patch below, collapsing the whole
      // section and scrolling the page back to the top on every save. Only
      // activityLogs needs invalidating (the edit is logged there).
      invalidates: ['activityLogs'],
      successMessage: 'Follow-up updated successfully!',
      // PUT /followups/:id never recomputes status (only the paginated
      // list endpoints lazily flip pending->overdue on read), so editing
      // date/notes can't move an item between the Overdue/Pending groups
      // as a direct result of this call — patch it in place in whichever
      // sub-list it's currently in instead of resetting all three.
      onSuccess: (updated) => {
        const patch = { follow_up_date: updated.follow_up_date, notes: updated.notes };
        overdueList.updateItem(updated.id, patch);
        pendingOnlyList.updateItem(updated.id, patch);
        completedList.updateItem(updated.id, patch);
      },
    }
  );

  const { mutate: deleteFollowupMutation } = useMutation(followupsApi.deleteFollowup, {
    invalidates: ['followups.upcoming', 'activityLogs'],
    successMessage: 'Follow-up deleted',
    onSuccess: resetAllLists,
  });

  const handleEditFollowup = (followup, patch) => {
    editFollowup({ id: followup.id, patch });
  };

  const handleDeleteFollowup = async (followup) => {
    const ok = await confirm({
      title: 'Delete this follow-up?',
      description: 'This cannot be undone.',
      destructive: true,
      confirmLabel: 'Delete',
    });
    if (ok) deleteFollowupMutation(followup.id);
  };

  const pendingTotal = pendingMeta.overdue_count + pendingMeta.pending_count;
  const statistics = {
    total: activeTab === 'pending' ? pendingTotal : completedMeta.total_count,
    completed: completedMeta.total_count,
    pending: pendingMeta.pending_count,
    overdue: pendingMeta.overdue_count,
  };

  const fmtDate = (value) =>
    new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const dateLabel = isCustom
    ? `${fmtDate(fromDate)} – ${fmtDate(toDate)}`
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
          isCustom={isCustom}
          fromDate={fromDate}
          toDate={toDate}
          onSetFilter={setDateFilter}
          onSetCustomRange={setCustomRange}
        />

        {isAdmin && staffList.length > 0 && (
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-1">Filter by staff</label>
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">All staff</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.email}
                </option>
              ))}
            </select>
          </div>
        )}

        <StatsGrid
          items={[
            { key: 'total', label: 'Total Follow-ups', value: statistics.total, colorClass: 'text-gray-800' },
            { key: 'completed', label: 'Completed', value: statistics.completed, colorClass: 'text-green-600' },
            { key: 'pending', label: 'Pending', value: statistics.pending, colorClass: 'text-yellow-600' },
            { key: 'overdue', label: 'Overdue', value: statistics.overdue, colorClass: 'text-red-600' },
          ]}
          columnsSm={4}
          columnsLg={4}
        />
      </div>

      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex-1 px-4 sm:px-6 py-3 text-sm sm:text-base font-semibold transition min-h-11 ${
              activeTab === 'pending' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Pending ({pendingTotal})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 px-4 sm:px-6 py-3 text-sm sm:text-base font-semibold transition min-h-11 ${
              activeTab === 'completed' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Completed ({completedMeta.total_count})
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'pending' ? (
            <div className="space-y-8">
              <div>
                <h3 className="text-sm font-semibold text-red-700 mb-3">
                  Overdue ({pendingMeta.overdue_count})
                </h3>
                <FollowupList
                  followups={overdueList.items}
                  loading={overdueList.isLoading}
                  emptyLabel={`No overdue follow-ups for ${dateLabel}`}
                  onOpenContact={openContact}
                  onComplete={setCompletingFollowup}
                  onEdit={handleEditFollowup}
                  onDelete={handleDeleteFollowup}
                />
                <div ref={overdueList.sentinelRef} />
                {overdueList.isLoadingMore && (
                  <div className="text-center py-4 text-gray-500 text-sm">Loading more…</div>
                )}
                {!overdueList.isLoading && !overdueList.hasMore && overdueList.items.length > 0 && (
                  <div className="text-center py-3 text-gray-400 text-sm">No more overdue follow-ups</div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-yellow-700 mb-3 pt-4 border-t border-gray-100">
                  Pending ({pendingMeta.pending_count})
                </h3>
                <FollowupList
                  followups={pendingOnlyList.items}
                  loading={pendingOnlyList.isLoading}
                  emptyLabel={`No pending follow-ups for ${dateLabel}`}
                  onOpenContact={openContact}
                  onComplete={setCompletingFollowup}
                  onEdit={handleEditFollowup}
                  onDelete={handleDeleteFollowup}
                />
                <div ref={pendingOnlyList.sentinelRef} />
                {pendingOnlyList.isLoadingMore && (
                  <div className="text-center py-4 text-gray-500 text-sm">Loading more…</div>
                )}
                {!pendingOnlyList.isLoading && !pendingOnlyList.hasMore && pendingOnlyList.items.length > 0 && (
                  <div className="text-center py-3 text-gray-400 text-sm">No more pending follow-ups</div>
                )}
              </div>
            </div>
          ) : (
            <>
              <FollowupList
                followups={completedList.items}
                loading={completedList.isLoading}
                emptyLabel={`No completed follow-ups for ${dateLabel}`}
                onOpenContact={openContact}
                onComplete={setCompletingFollowup}
              />

              <div ref={completedList.sentinelRef} />

              {completedList.isLoadingMore && (
                <div className="text-center py-4 text-gray-500 text-sm">Loading more…</div>
              )}
              {!completedList.isLoading && !completedList.hasMore && completedList.items.length > 0 && (
                <div className="text-center py-4 text-gray-400 text-sm">No more follow-ups to load</div>
              )}
            </>
          )}
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
