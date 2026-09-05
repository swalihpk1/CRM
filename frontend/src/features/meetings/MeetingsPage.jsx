import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as meetingsApi from '../../api/meetings';
import { useQuery } from '../../hooks/useQuery';
import { useMutation } from '../../hooks/useMutation';
import { useConfirm } from '../../hooks/useConfirm';
import { useInvalidationSubscription } from '../../context/CacheContext';
import { useMeetingScheduler } from '../../context/MeetingSchedulerContext';
import { MeetingList } from './MeetingList';
import { RescheduleModal } from './RescheduleModal';
import { filterMeetingsByDate, filterMeetingsBySearch } from './useMeetingFilters';

const DATE_FILTERS = [
  { key: 'all', label: 'All Meetings' },
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'this-week', label: 'This Week' },
];

export function MeetingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const dateFilter = searchParams.get('filter') || 'all';
  const customDate = searchParams.get('date') || '';
  const [searchQuery, setSearchQuery] = useState('');
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const confirm = useConfirm();
  const { openMeetingScheduler } = useMeetingScheduler();

  // MeetingsPage now fetches its own data directly, rather than receiving
  // a `globalMeetings` prop that Dashboard eagerly fetched on every login
  // regardless of whether the user ever visited this route.
  const { data: meetings = [], isLoading, refetch } = useQuery(
    (signal) => meetingsApi.getMeetings({ signal }),
    []
  );
  useInvalidationSubscription('meetings', refetch);

  const setDateFilter = (key) => {
    const next = new URLSearchParams(searchParams);
    if (key === 'all') next.delete('filter');
    else next.set('filter', key);
    next.delete('date');
    setSearchParams(next, { replace: true });
  };

  const setCustomDate = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set('date', value);
      next.set('filter', 'custom');
    } else {
      next.delete('date');
      next.delete('filter');
    }
    setSearchParams(next, { replace: true });
  };

  const { mutate: updateStatus } = useMutation(
    ({ id, status }) => meetingsApi.updateMeetingStatus(id, status),
    {
      invalidates: ['meetings', 'activityLogs'],
      successMessage: (_, { status }) => `Meeting ${status} successfully!`,
    }
  );

  const { mutate: deleteMeeting } = useMutation(meetingsApi.deleteMeeting, {
    invalidates: ['meetings', 'activityLogs'],
    successMessage: 'Meeting deleted successfully!',
  });

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Delete this meeting?',
      description: 'This cannot be undone.',
      destructive: true,
      confirmLabel: 'Delete',
    });
    if (ok) deleteMeeting(id);
  };

  const dateFiltered = filterMeetingsByDate(meetings, dateFilter, customDate);
  const filtered = filterMeetingsBySearch(dateFiltered, searchQuery);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">Meetings</h2>
        <button
          onClick={() => openMeetingScheduler([])}
          className="px-6 py-3 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold min-h-11"
        >
          + Schedule Meeting
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-md p-4 mb-4">
        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder="Search meetings by title, location, notes, or attendees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-base"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-3 py-2 text-gray-500 hover:text-gray-700 transition min-w-11 min-h-11"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-md p-4 mb-6 flex flex-col sm:flex-row flex-wrap gap-4">
        <div className="flex gap-2 items-center flex-wrap">
          {DATE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setDateFilter(f.key)}
              className={`px-4 py-2 rounded-lg transition min-h-11 ${
                dateFilter === f.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center sm:ml-auto">
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
          {customDate && (
            <button
              onClick={() => setCustomDate('')}
              className="text-gray-500 hover:text-gray-700 min-w-11 min-h-11"
              title="Clear custom date"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-600">Loading meetings...</div>
      ) : meetings.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <div className="text-6xl mb-4">📅</div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-2">No Meetings Scheduled</h3>
          <p className="text-gray-500 mb-6">Schedule your first meeting to get started</p>
          <button
            onClick={() => openMeetingScheduler([])}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold min-h-11"
          >
            + Schedule Meeting
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-6 text-center">
          <div className="text-4xl mb-3">📅</div>
          <h3 className="text-base font-semibold text-gray-700 mb-2">No Meetings Found</h3>
          <p className="text-gray-500">
            {searchQuery
              ? `No meetings match "${searchQuery}"`
              : 'No meetings scheduled for the selected date filter'}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition min-h-11"
            >
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <MeetingList
          meetings={filtered}
          onNewMeeting={() => openMeetingScheduler([])}
          onComplete={(id) => updateStatus({ id, status: 'completed' })}
          onCancel={(id) => updateStatus({ id, status: 'cancelled' })}
          onReschedule={setRescheduleTarget}
          onDelete={handleDelete}
        />
      )}

      {rescheduleTarget && (
        <RescheduleModal meeting={rescheduleTarget} onClose={() => setRescheduleTarget(null)} />
      )}
    </div>
  );
}
