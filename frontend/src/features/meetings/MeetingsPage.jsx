import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X, CalendarPlus } from 'lucide-react';
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
  { key: 'all', label: 'All' },
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
  const [showCustomDate, setShowCustomDate] = useState(false);
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
      <div className="flex flex-row justify-between items-center gap-3 mt-2 mb-4 lg:mb-6">
        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">Meetings</h2>
        <button
          onClick={() => openMeetingScheduler([])}
          className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold text-xs sm:text-sm shrink-0 touch-manipulation"
        >
          + Schedule Meeting
        </button>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search meetings by title, location, notes, or attendees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-base"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-2 py-2 text-gray-400 hover:text-gray-600 transition min-w-9 min-h-9"
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="mb-4">
        <div className="flex flex-wrap gap-1.5">
          {DATE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setDateFilter(f.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition min-h-8 ${
                dateFilter === f.key && !customDate
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            onClick={() => setShowCustomDate((v) => !v)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition min-h-8 ${
              customDate ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Custom
          </button>
        </div>

        {showCustomDate && (
          <div className="flex items-center gap-2 mt-2">
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm"
            />
            {customDate && (
              <button
                onClick={() => setCustomDate('')}
                className="text-gray-400 hover:text-gray-600 min-w-8 min-h-8 flex items-center justify-center"
                title="Clear custom date"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-600 text-sm">Loading meetings...</div>
      ) : meetings.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <CalendarPlus size={40} className="mx-auto mb-3 text-gray-300" />
          <h3 className="text-sm sm:text-base font-semibold text-gray-700 mb-1">No Meetings Scheduled</h3>
          <p className="text-gray-500 text-sm mb-4">Schedule your first meeting to get started</p>
          <button
            onClick={() => openMeetingScheduler([])}
            className="px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-100 transition font-medium text-sm min-h-9"
          >
            + Schedule Meeting
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-6 text-center">
          <CalendarPlus size={32} className="mx-auto mb-2 text-gray-300" />
          <h3 className="text-sm font-semibold text-gray-700 mb-1">No Meetings Found</h3>
          <p className="text-gray-500 text-sm">
            {searchQuery
              ? `No meetings match "${searchQuery}"`
              : 'No meetings scheduled for the selected date filter'}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="mt-3 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm min-h-8"
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
