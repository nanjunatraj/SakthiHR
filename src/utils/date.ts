// Canonical date formatting for the whole app.
// Every user-facing date is rendered as dd/MMM/yyyy (e.g. 25/Jun/2026).

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Parse a value into a Date.
 * Date-only strings ("YYYY-MM-DD") are anchored to local midnight so the
 * displayed day never shifts due to the timezone offset.
 */
function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const d = new Date(dateOnly ? `${value}T00:00:00` : value);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format any date-like value as dd/MMM/yyyy (e.g. 25/Jun/2026).
 * Returns `fallback` for empty/invalid input.
 */
export function formatDate(
  value: string | number | Date | null | undefined,
  fallback = '—',
): string {
  const d = toDate(value);
  if (!d) return fallback;
  return `${String(d.getDate()).padStart(2, '0')}/${MONTHS[d.getMonth()]}/${d.getFullYear()}`;
}

/** Today's date as dd/MMM/yyyy. */
export function todayFormatted(): string {
  return formatDate(new Date());
}
