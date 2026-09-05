import React from 'react';

const STATUSES = [
  'None',
  'Called',
  'Not Attending',
  'Follow-up',
  'Interested',
  'Not Interested',
  'Irrelevant',
  'Logged In',
];

const STATUS_COLORS = {
  None: { bg: 'bg-gray-50', border: 'border-l-gray-400', text: 'text-gray-700', count: 'text-gray-800' },
  Called: { bg: 'bg-blue-50', border: 'border-l-blue-500', text: 'text-blue-700', count: 'text-blue-800' },
  'Not Attending': { bg: 'bg-orange-50', border: 'border-l-orange-500', text: 'text-orange-700', count: 'text-orange-800' },
  'Follow-up': { bg: 'bg-yellow-50', border: 'border-l-yellow-500', text: 'text-yellow-700', count: 'text-yellow-800' },
  Interested: { bg: 'bg-green-50', border: 'border-l-green-500', text: 'text-green-700', count: 'text-green-800' },
  'Not Interested': { bg: 'bg-red-50', border: 'border-l-red-500', text: 'text-red-700', count: 'text-red-800' },
  Irrelevant: { bg: 'bg-purple-50', border: 'border-l-purple-500', text: 'text-purple-700', count: 'text-purple-800' },
  'Logged In': { bg: 'bg-teal-50', border: 'border-l-teal-600', text: 'text-teal-700', count: 'text-teal-800' },
};

export function StatsGrid({ stats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
      <div className="bg-white rounded-xl shadow-md p-4 lg:p-6 border-l-4 border-indigo-500">
        <h3 className="text-gray-600 text-xs font-medium mb-2">Total Contacts</h3>
        <p className="text-xl sm:text-2xl lg:text-4xl font-bold text-gray-800">{stats.total}</p>
      </div>

      {STATUSES.map((status) => {
        const colors = STATUS_COLORS[status] || STATUS_COLORS.None;
        return (
          <div key={status} className={`${colors.bg} rounded-xl shadow-md p-4 lg:p-6 border-l-4 ${colors.border}`}>
            <h3 className={`${colors.text} text-xs font-medium mb-2`}>{status}</h3>
            <p className={`text-xl sm:text-2xl lg:text-3xl font-bold ${colors.count}`}>{stats.by_status[status] || 0}</p>
          </div>
        );
      })}
    </div>
  );
}
