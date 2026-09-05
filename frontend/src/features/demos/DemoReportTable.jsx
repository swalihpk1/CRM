import React from 'react';

export function DemoReportTable({ rows, loading }) {
  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        <p className="mt-2 text-gray-600">Loading report data...</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>No demo data found for the selected date range.</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: stacked cards */}
      <div className="lg:hidden divide-y">
        {rows.map((row, index) => (
          <div key={index} className="p-4">
            <div className="text-sm font-medium text-gray-900 mb-2">{row.period}</div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                Given: {row.given}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Watched: {row.watched}
              </span>
              <span className="text-sm font-medium text-gray-900">
                {(row.conversion * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Tablet/desktop: table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Demos Given</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Demos Watched</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Conversion Rate</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.map((row, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{row.period}</td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                    {row.given}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {row.watched}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="flex items-center justify-center">
                    <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2 max-w-20">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${Math.min(row.conversion * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {(row.conversion * 100).toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
