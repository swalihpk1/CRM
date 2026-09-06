import React, { useState } from 'react';
import { Calendar, Check, X as XIcon, CalendarPlus } from 'lucide-react';
import { MeetingCard } from './MeetingCard';

const TABS = [
  { key: 'upcoming', label: 'Upcoming', icon: Calendar, activeClass: 'border-indigo-600 text-indigo-600' },
  { key: 'completed', label: 'Completed', icon: Check, activeClass: 'border-green-600 text-green-600' },
  { key: 'cancelled', label: 'Cancelled', icon: XIcon, activeClass: 'border-red-600 text-red-600' },
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
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 px-4 sm:px-6 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap min-h-11 flex items-center justify-center gap-1.5 ${
                  activeTab === tab.key ? tab.activeClass : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                <Icon size={14} /> {tab.label} ({counts[tab.key]})
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 sm:p-6">
        {current.length === 0 ? (
          <div className="text-center py-8">
            <CalendarPlus size={32} className="mx-auto mb-2 text-gray-300" />
            <h3 className="text-sm font-semibold text-gray-700 mb-1">
              No {activeTab === 'upcoming' ? 'Upcoming' : activeTab === 'completed' ? 'Completed' : 'Cancelled'} Meetings
            </h3>
            {activeTab === 'upcoming' && (
              <>
                <p className="text-gray-500 text-sm mb-3">Schedule your next meeting to get started</p>
                <button
                  onClick={onNewMeeting}
                  className="px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-100 transition font-medium text-sm min-h-9"
                >
                  + Schedule Meeting
                </button>
              </>
            )}
            {activeTab !== 'upcoming' && (
              <p className="text-gray-500 text-sm">
                {activeTab === 'completed' ? 'Completed' : 'Cancelled'} meetings will appear here
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
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
