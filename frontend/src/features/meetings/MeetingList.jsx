import React, { useState } from 'react';
import { MeetingCard } from './MeetingCard';

const TABS = [
  { key: 'upcoming', label: '📅 Upcoming', activeClass: 'border-green-500 text-green-600 bg-green-50' },
  { key: 'completed', label: '✅ Completed', activeClass: 'border-blue-500 text-blue-600 bg-blue-50' },
  { key: 'cancelled', label: '❌ Cancelled', activeClass: 'border-red-500 text-red-600 bg-red-50' },
];

export function MeetingList({ meetings, onNewMeeting, onComplete, onCancel, onReschedule, onDelete }) {
  const [activeTab, setActiveTab] = useState('upcoming');

  const upcoming = meetings.filter((m) => m.status === 'scheduled');
  const completed = meetings.filter((m) => m.status === 'completed');
  const cancelled = meetings.filter((m) => m.status === 'cancelled');
  const counts = { upcoming: upcoming.length, completed: completed.length, cancelled: cancelled.length };
  const byTab = { upcoming, completed, cancelled };
  const current = byTab[activeTab];

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="flex min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-h-11 ${
                activeTab === tab.key
                  ? tab.activeClass
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label} ({counts[tab.key]})
            </button>
          ))}
        </nav>
      </div>

      <div className="p-4 sm:p-6">
        {current.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">{activeTab === 'cancelled' ? '❌' : activeTab === 'completed' ? '✅' : '📅'}</div>
            <h3 className="text-base font-semibold text-gray-700 mb-2">
              No {activeTab === 'upcoming' ? 'Upcoming' : activeTab === 'completed' ? 'Completed' : 'Cancelled'} Meetings
            </h3>
            {activeTab === 'upcoming' && (
              <>
                <p className="text-gray-500 mb-4">Schedule your next meeting to get started</p>
                <button
                  onClick={onNewMeeting}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold min-h-11"
                >
                  + Schedule Meeting
                </button>
              </>
            )}
            {activeTab !== 'upcoming' && (
              <p className="text-gray-500">
                {activeTab === 'completed' ? 'Completed' : 'Cancelled'} meetings will appear here
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {current.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                onComplete={() => onComplete(meeting.id)}
                onCancel={() => onCancel(meeting.id)}
                onReschedule={() => onReschedule(meeting)}
                onDelete={() => onDelete(meeting.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
