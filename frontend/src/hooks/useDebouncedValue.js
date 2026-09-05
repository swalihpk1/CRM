import { useEffect, useState } from 'react';

/**
 * Returns `value`, updated only after it has stopped changing for
 * `delayMs`. Used to debounce the contacts search input — previously every
 * keystroke triggered an immediate refetch via a useEffect keyed on the
 * raw search state.
 */
export function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
