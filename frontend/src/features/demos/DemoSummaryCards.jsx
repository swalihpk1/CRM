import React from 'react';

export function DemoSummaryCards({ summary }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-8">
      <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-orange-500">
        <h3 className="text-gray-600 text-xs font-medium mb-2">Demos Given</h3>
        <p className="text-xl sm:text-2xl lg:text-4xl font-bold text-gray-800">{summary.given}</p>
      </div>
      <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
        <h3 className="text-gray-600 text-xs font-medium mb-2">Demos Watched</h3>
        <p className="text-xl sm:text-2xl lg:text-4xl font-bold text-gray-800">{summary.watched}</p>
      </div>
      <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
        <h3 className="text-gray-600 text-xs font-medium mb-2">Conversion Rate</h3>
        <p className="text-xl sm:text-2xl lg:text-4xl font-bold text-gray-800">
          {(summary.conversion * 100).toFixed(1)}%
        </p>
      </div>
    </div>
  );
}
