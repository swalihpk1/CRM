/**
 * Date helpers that reproduce Python's `datetime.now(timezone.utc).isoformat()`
 * format EXACTLY: microsecond precision + "+00:00" suffix, e.g.
 *   2026-09-04T10:23:45.123456+00:00
 * NOT JS's default `toISOString()` format (milliseconds + "Z"). This matters
 * because every follow-up date-range filter does $gte/$lte STRING comparison
 * against these values — a mismatched format silently breaks range queries.
 */

function toPythonIso(date) {
  // date.toISOString() -> "2026-09-04T10:23:45.123Z"
  const iso = date.toISOString(); // ms precision, trailing Z
  const withoutZ = iso.slice(0, -1); // strip trailing Z
  const [main, ms] = withoutZ.split('.');
  const microseconds = (ms || '000').padEnd(6, '0');
  return `${main}.${microseconds}+00:00`;
}

function nowIso() {
  return toPythonIso(new Date());
}

function isoAtBoundary(date, hours, minutes, seconds, micros) {
  const d = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    hours,
    minutes,
    seconds,
    0
  ));
  const iso = d.toISOString(); // "...T00:00:00.000Z"
  const withoutZ = iso.slice(0, -1);
  const [main] = withoutZ.split('.');
  const microStr = String(micros).padStart(6, '0');
  return `${main}.${microStr}+00:00`;
}

function dayStart(date) {
  return isoAtBoundary(date, 0, 0, 0, 0);
}

function dayEnd(date) {
  return isoAtBoundary(date, 23, 59, 59, 999999);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Builds {start, end} ISO string bounds for the shared date_filter parameter
 * used across /followups/by-date, /followups/paginated, /followups/completed.
 * Returns {start: null, end: null} for 'all' or any unrecognized filter — no
 * range is applied in that case, matching Python.
 */
function buildDateRange(dateFilter, customDate) {
  const now = new Date();

  if (dateFilter === 'custom' && customDate) {
    try {
      const parsed = new Date(String(customDate).replace('Z', '+00:00'));
      if (isNaN(parsed.getTime())) {
        // Python: bare `except: pass` -> silently no date filter applied.
        return { start: null, end: null };
      }
      return { start: dayStart(parsed), end: dayEnd(parsed) };
    } catch (e) {
      return { start: null, end: null };
    }
  }

  if (dateFilter === 'today') {
    return { start: dayStart(now), end: dayEnd(now) };
  }

  if (dateFilter === 'tomorrow') {
    const tomorrow = addDays(now, 1);
    return { start: dayStart(tomorrow), end: dayEnd(tomorrow) };
  }

  if (dateFilter === 'this_week') {
    return { start: dayStart(now), end: dayEnd(addDays(now, 7)) };
  }

  if (dateFilter === 'next_week') {
    return { start: dayStart(addDays(now, 7)), end: dayEnd(addDays(now, 14)) };
  }

  // 'all' or unrecognized -> no date filter
  return { start: null, end: null };
}

/**
 * Strict-ish ISO 8601 parse to roughly match Python's `datetime.fromisoformat`
 * strictness (which rejects many loosely-formatted strings JS's `Date`
 * constructor would otherwise accept).
 */
function parseIsoStrict(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.replace('Z', '+00:00');
  const isoPattern = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?)?([+-]\d{2}:\d{2})?$/;
  if (!isoPattern.test(normalized)) return null;
  const d = new Date(normalized);
  if (isNaN(d.getTime())) return null;
  return d;
}

module.exports = {
  nowIso,
  toPythonIso,
  dayStart,
  dayEnd,
  addDays,
  buildDateRange,
  parseIsoStrict,
};
