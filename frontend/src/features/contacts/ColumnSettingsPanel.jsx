import React from 'react';

export function ColumnSettingsPanel({ columns, onToggle, onReset }) {
  return (
    <div className="p-4 border-b bg-gray-50">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <h3 className="text-sm font-medium text-gray-700">Customize Columns</h3>
        <button onClick={onReset} className="text-xs text-indigo-600 hover:text-indigo-800 self-start sm:self-auto">
          Reset to Default
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
        {columns
          .filter((col) => col.draggable !== false)
          .map((column) => (
            <label key={column.id} className="flex items-center gap-2 text-sm min-h-9">
              <input
                type="checkbox"
                checked={column.visible}
                onChange={() => onToggle(column.id)}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <span className={column.visible ? 'text-gray-900' : 'text-gray-500'}>{column.label}</span>
            </label>
          ))}
      </div>
      <p className="text-xs text-gray-500 mt-2">💡 Tip: Drag column headers to reorder them (desktop)</p>
    </div>
  );
}
