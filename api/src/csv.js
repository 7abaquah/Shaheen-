// CSV export helpers: RFC 4180 quoting, UTF-8 BOM for Excel (Arabic), and
// spreadsheet formula-injection protection.

export const UTF8_BOM = '﻿';

// Cells starting with these characters may be interpreted as formulas by
// Excel / LibreOffice / Google Sheets. Tab and CR are included per OWASP.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

export function csvCell(value) {
  if (value === null || value === undefined) return '""';
  let s = typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);
  if (FORMULA_PREFIX.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** columns: [{ key, header }]. Returns the full CSV text including the BOM. */
export function toCsv(columns, rows) {
  const lines = [columns.map((c) => csvCell(c.header)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => csvCell(row[c.key])).join(','));
  return UTF8_BOM + lines.join('\r\n') + '\r\n';
}
