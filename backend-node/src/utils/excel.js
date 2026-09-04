const XLSX = require('xlsx');

// Case-sensitive exact-match sentinel list — mirrors pandas'
// `df.replace([...], pd.NA)` / `df.replace([...], None)` calls, which are
// exact string matches, NOT case-insensitive. Do not conflate with the
// separate, case-insensitive per-value check used later in the import loop.
const EMPTY_SENTINELS = ['', ' ', 'N/A', 'n/a', 'NA', 'na', 'NULL', 'null', 'None', 'none'];

/**
 * Reads a workbook buffer into { columns: string[], rows: object[] } where
 * each row is a plain object keyed by (cleaned) column name, all values
 * coerced to strings (or '' if blank) — matching pandas'
 * `read_excel(..., dtype=str, na_filter=False, header=0)`.
 *
 * Only the first sheet is read (workbook.SheetNames[0]), matching pandas'
 * default `read_excel` behavior (sheet 0).
 *
 * `nrows`, if given, slices to that many DATA rows (header excluded) BEFORE
 * any cleanup that inspects data presence — matching Python's `nrows=5` in
 * the preview route limiting what pandas ever saw.
 */
function readWorkbook(buffer, { nrows } = {}) {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // header:1 -> array-of-arrays, raw:false -> formatted strings, defval:''
  const aoa = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: true,
  });

  if (aoa.length === 0) {
    return { columns: [], rows: [] };
  }

  const headerRow = aoa[0];
  let dataRows = aoa.slice(1);

  // pandas/openpyxl never materializes rows past the sheet's last populated
  // row — a fully-blank row at the END of the data is simply absent from
  // what pandas reads (confirmed by diff-testing against the real Python
  // backend). A blank row in the MIDDLE is kept (it's within the populated
  // range). Trim only TRAILING fully-blank rows to match.
  while (
    dataRows.length > 0 &&
    dataRows[dataRows.length - 1].every((cell) => cell === undefined || cell === null || String(cell).trim() === '')
  ) {
    dataRows.pop();
  }

  if (typeof nrows === 'number') {
    dataRows = dataRows.slice(0, nrows);
  }

  // Build initial column names, synthesizing "Unnamed: N" for blank headers
  // (matching what pandas produces for headerless columns) then .strip().
  let columns = headerRow.map((h, i) => {
    const raw = h === undefined || h === null ? '' : String(h);
    const trimmed = raw.trim();
    return trimmed === '' ? `Unnamed: ${i}` : trimmed;
  });

  // Convert array-of-arrays rows into column-keyed row objects.
  let rows = dataRows.map((rowArr) => {
    const obj = {};
    columns.forEach((col, i) => {
      const cell = rowArr[i];
      obj[col] = cell === undefined || cell === null ? '' : String(cell);
    });
    return obj;
  });

  return { columns, rows };
}

/**
 * Renames any column starting with "Unnamed:" to "Column_{i+1}" (1-indexed
 * on position) IF that column has any non-blank trimmed value across the
 * given rows; otherwise the "Unnamed:" name is kept as-is.
 * Returns new { columns, rows } with keys renamed accordingly.
 */
function renameUnnamed(columns, rows) {
  const renameMap = {};
  const newColumns = columns.map((col, i) => {
    if (String(col).startsWith('Unnamed:')) {
      const hasData = rows.some((r) => {
        const v = r[col];
        return v !== undefined && v !== null && String(v).trim() !== '';
      });
      if (hasData) {
        const newName = `Column_${i + 1}`;
        renameMap[col] = newName;
        return newName;
      }
      return col;
    }
    return col;
  });

  if (Object.keys(renameMap).length === 0) {
    return { columns: newColumns, rows };
  }

  const newRows = rows.map((r) => {
    const newRow = {};
    for (const col of columns) {
      const key = renameMap[col] || col;
      newRow[key] = r[col];
    }
    return newRow;
  });

  return { columns: newColumns, rows: newRows };
}

/**
 * Drops columns that are empty (blank/whitespace) in every row.
 * Mirrors pandas' `dropna(axis=1, how='all')` + `.loc[:, (df != '').any(axis=0)]`.
 */
function dropEmptyColumns(columns, rows) {
  const keepColumns = columns.filter((col) => {
    return rows.some((r) => {
      const v = r[col];
      return v !== undefined && v !== null && String(v).trim() !== '';
    });
  });

  const newRows = rows.map((r) => {
    const newRow = {};
    for (const col of keepColumns) {
      newRow[col] = r[col];
    }
    return newRow;
  });

  return { columns: keepColumns, rows: newRows };
}

/**
 * Replaces sentinel empty-ish values (exact, case-sensitive match) with
 * `null` throughout every row. Mirrors pandas' `df.replace([...], pd.NA)`
 * (import path) / `df.replace([...], None)` (preview path) — both use the
 * same sentinel list, just a different replacement target representation.
 */
function replaceSentinels(rows) {
  return rows.map((r) => {
    const newRow = {};
    for (const [k, v] of Object.entries(r)) {
      newRow[k] = EMPTY_SENTINELS.includes(v) ? null : v;
    }
    return newRow;
  });
}

/** Full column-cleanup pipeline shared by import and preview routes. */
function cleanColumns(columns, rows) {
  let result = renameUnnamed(columns, rows);
  result = dropEmptyColumns(result.columns, result.rows);
  return result;
}

module.exports = {
  EMPTY_SENTINELS,
  readWorkbook,
  renameUnnamed,
  dropEmptyColumns,
  replaceSentinels,
  cleanColumns,
};
