import React from 'react';

const MAPPING_FIELDS = [
  { key: 'phone', label: 'Phone Column (Optional)' },
  { key: 'phone2', label: 'Phone 2 Column (Optional)' },
  { key: 'customer_name', label: 'Customer Name Column (Optional)' },
  { key: 'shop_name', label: 'Shop Name Column' },
  { key: 'address', label: 'Address Column' },
  { key: 'city', label: 'City Column' },
  { key: 'state', label: 'State Column' },
  { key: 'status', label: 'Status Column' },
  { key: 'category', label: 'Category Column' },
];

// Column-mapping selects, factored into one config-driven list rather than
// 9 copy-pasted <select> blocks.
export function ImportPreviewTable({ columns, mapping, onMappingChange }) {
  return (
    <div className="mb-6">
      <h3 className="text-sm sm:text-base font-semibold mb-4">Map Excel Columns to CRM Fields</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {MAPPING_FIELDS.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
            <select
              value={mapping[field.key] || ''}
              onChange={(e) => onMappingChange({ ...mapping, [field.key]: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg text-base"
            >
              <option value="">Select column...</option>
              {columns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}
