import { useState } from 'react';

// Pure date-range computation extracted from the old ProductivityView,
// reusable by any view needing the same today/yesterday/this_week/
// this_month/custom preset logic (e.g. could be shared with DemoReports
// later — kept feature-local for now since only Productivity uses this
// exact preset set today).
export function useDateRange(initial = 'today') {
  const [preset, setPreset] = useState(initial);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const getRange = () => {
    const now = new Date();
    let start;
    let end;

    if (preset === 'today') {
      start = new Date(now.setHours(0, 0, 0, 0));
      end = new Date(now.setHours(23, 59, 59, 999));
    } else if (preset === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      start = new Date(yesterday.setHours(0, 0, 0, 0));
      end = new Date(yesterday.setHours(23, 59, 59, 999));
    } else if (preset === 'this_week') {
      const firstDay = now.getDate() - now.getDay();
      start = new Date(now.setDate(firstDay));
      start.setHours(0, 0, 0, 0);
      end = new Date();
    } else if (preset === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date();
    } else if (preset === 'custom') {
      start = customStart ? new Date(customStart) : new Date();
      end = customEnd ? new Date(customEnd) : new Date();
      end.setHours(23, 59, 59, 999);
    } else {
      start = new Date();
      end = new Date();
    }

    return { start: start.toISOString(), end: end.toISOString() };
  };

  return { preset, setPreset, customStart, setCustomStart, customEnd, setCustomEnd, getRange };
}
