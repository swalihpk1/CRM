import React from 'react';
import {
  formatIndianDate,
  formatAction,
  getShopNameFromLog,
  formatTarget,
  getRowStyling,
} from './activityFormatters';

export function ActivityLogTableRow({ log, contacts }) {
  return (
    <tr className={getRowStyling(log.action)}>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">
        {formatIndianDate(log.timestamp)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
        <div className="flex items-center">
          <div className="w-2 h-2 bg-indigo-500 rounded-full mr-2" />
          {log.user_email.split('@')[0]}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">
        {formatAction(log)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
        {getShopNameFromLog(log, contacts)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
        {formatTarget(log, contacts)}
      </td>
    </tr>
  );
}

export function ActivityLogCard({ log, contacts }) {
  return (
    <div className={`p-4 ${getRowStyling(log.action)}`}>
      <div className="flex justify-between items-start gap-2">
        <span className="text-sm font-medium text-gray-800">{formatAction(log)}</span>
        <span className="text-xs text-gray-500 font-mono shrink-0">
          {formatIndianDate(log.timestamp)}
        </span>
      </div>
      <div className="mt-2 flex items-center text-xs text-gray-700">
        <div className="w-2 h-2 bg-indigo-500 rounded-full mr-2" />
        {log.user_email.split('@')[0]}
      </div>
      <div className="mt-2 text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
        <span>🏪 {getShopNameFromLog(log, contacts)}</span>
        <span>{formatTarget(log, contacts)}</span>
      </div>
    </div>
  );
}
