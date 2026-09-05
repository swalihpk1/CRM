import React from 'react';

// Tailwind's JIT compiler only picks up class names it can see literally in
// source, so column counts must be a static lookup rather than a template
// string like `sm:grid-cols-${n}` (which Tailwind can't detect and would
// silently produce no styles).
const SM_COLS = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-4' };
const LG_COLS = { 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' };

/**
 * Space-saving stat grid — each stat is its own individually-shadowed,
 * rounded card (matching the standalone "Total Contacts" card style used
 * elsewhere), laid out in a tight gapped grid rather than one flat panel
 * with internal hairline dividers. Used by Dashboard, Follow-ups, and Demo
 * Reports so all three share one visual language for "here are some counts".
 *
 * `items`: [{ key, label, value, colorClass? }]
 * `columnsSm`/`columnsLg`: grid-cols count at sm:/lg: breakpoints (mobile
 * is always a fixed 2-column grid regardless).
 */
export function StatsGrid({ items, columnsSm = 3, columnsLg = 4 }) {
  const smClass = SM_COLS[columnsSm] || SM_COLS[3];
  const lgClass = LG_COLS[columnsLg] || LG_COLS[4];

  return (
    <div className={`grid grid-cols-2 ${smClass} ${lgClass} gap-3 sm:gap-4`}>
      {items.map((item) => (
        <div
          key={item.key}
          className="bg-white rounded-xl shadow-sm border border-gray-200 px-3 py-3 sm:px-4 sm:py-4"
        >
          <p className="text-xs text-gray-500 font-medium truncate">{item.label}</p>
          <p className={`text-lg sm:text-xl lg:text-2xl font-bold mt-0.5 ${item.colorClass || 'text-gray-800'}`}>
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
