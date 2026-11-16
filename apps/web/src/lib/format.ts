/**
 * Shared display formatting — one place for dates and times so screens
 * never render raw ISO strings like 2026-11-15T00:00:00.000Z.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Format any date-ish value for display: "15 Nov 2026".
 * Date-only strings (YYYY-MM-DD) are rendered literally — never shifted
 * by timezone. Returns '—' for empty/unparseable input.
 */
export function formatDate(value?: string | Date | null): string {
  if (value == null || value === '') return '—';
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '—';
    return `${value.getDate()} ${MONTHS[value.getMonth()]} ${value.getFullYear()}`;
  }
  const s = String(value).trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (dateOnly) {
    const d = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
    if (isNaN(d.getTime())) return s.slice(0, 10);
    return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "15 Nov 2026, 14:32" — for timestamps where the time matters. */
export function formatDateTime(value?: string | Date | null): string {
  if (value == null || value === '') return '—';
  const d = value instanceof Date ? value : new Date(String(value));
  if (isNaN(d.getTime())) return formatDate(value);
  return `${formatDate(d)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
