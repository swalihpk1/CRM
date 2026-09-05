import React from 'react';

const METRIC_BUTTONS = [
  { key: 'fresh_calls', metric: 'calls', label: 'Fresh Calls', color: 'text-blue-600 hover:text-blue-800' },
  { key: 'followups_created', metric: 'followups', label: 'Follow-ups Created', color: 'text-green-600 hover:text-green-800' },
  { key: 'demos_given', metric: 'demos', label: 'Demos Given', color: 'text-orange-600 hover:text-orange-800' },
  { key: 'meetings_created', metric: 'meetings', label: 'Meetings', color: 'text-purple-600 hover:text-purple-800' },
];

export function StaffTable({ staffData, onMetricClick }) {
  if (staffData.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-12 text-center text-gray-500">
        No productivity data available for the selected period.
      </div>
    );
  }

  return (
    <>
      {/* Mobile: stacked cards */}
      <div className="sm:hidden space-y-3">
        {staffData.map((staff) => (
          <div key={staff.user_id} className="bg-white rounded-xl shadow-md p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-sm font-medium text-gray-900">{staff.user_name}</p>
                <p className="text-xs text-gray-500">{staff.user_email}</p>
              </div>
              <span
                className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full ${
                  staff.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                }`}
              >
                {staff.role === 'admin' ? '👑 Admin' : '👤 Staff'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center">
              {METRIC_BUTTONS.map((btn) => (
                <button
                  key={btn.key}
                  onClick={() => onMetricClick(staff.user_id, staff.user_name, btn.metric)}
                  className={`p-2 rounded-lg bg-gray-50 ${btn.color}`}
                >
                  <div className="text-base font-semibold">{staff[btn.key]}</div>
                  <div className="text-xs text-gray-500">{btn.label}</div>
                </button>
              ))}
              <div className="p-2 rounded-lg bg-gray-50 col-span-2">
                <div className="text-base font-semibold text-teal-600">{staff.followups_completed}</div>
                <div className="text-xs text-gray-500">Follow-ups Completed</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tablet/desktop: table */}
      <div className="hidden sm:block bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Member</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Fresh Calls</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Follow-ups Created</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Follow-ups Completed</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Demos Given</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Demos Watched</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Meetings</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {staffData.map((staff) => (
                <tr key={staff.user_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{staff.user_name}</div>
                    <div className="text-xs text-gray-500">{staff.user_email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        staff.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {staff.role === 'admin' ? '👑 Admin' : '👤 Staff'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => onMetricClick(staff.user_id, staff.user_name, 'calls')}
                      className="text-lg font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {staff.fresh_calls}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => onMetricClick(staff.user_id, staff.user_name, 'followups')}
                      className="text-lg font-semibold text-green-600 hover:text-green-800 hover:underline"
                    >
                      {staff.followups_created}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="text-lg font-semibold text-teal-600">{staff.followups_completed}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => onMetricClick(staff.user_id, staff.user_name, 'demos')}
                      className="text-lg font-semibold text-orange-600 hover:text-orange-800 hover:underline"
                    >
                      {staff.demos_given}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className="text-lg font-semibold text-indigo-600">{staff.demos_watched}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => onMetricClick(staff.user_id, staff.user_name, 'meetings')}
                      className="text-lg font-semibold text-purple-600 hover:text-purple-800 hover:underline"
                    >
                      {staff.meetings_created}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
