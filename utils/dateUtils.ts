/**
 * Timezone-aware date utilities
 * Ensures consistent date calculations using local timezone
 */

/**
 * Get the current date as a YYYY-MM-DD string in local timezone
 * This avoids timezone issues that occur with toISOString()
 */
export function getLocalDateString(date?: Date): string {
  const d = date || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date as a YYYY-MM-DD string in local timezone
 */
export function getTodayString(): string {
  return getLocalDateString();
}

/**
 * Parse a YYYY-MM-DD string and return a Date object in local timezone
 * Avoids timezone conversion issues
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Compare two date strings (YYYY-MM-DD) in local timezone
 * Returns: -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export function compareLocalDates(date1: string, date2: string): number {
  const d1 = parseLocalDate(date1);
  const d2 = parseLocalDate(date2);
  return d1 < d2 ? -1 : d1 > d2 ? 1 : 0;
}

/**
 * Format an ISO date/time or YYYY-MM-DD string into a readable local string.
 * If only a date is provided, it omits the time portion.
 */
export function formatDateTime(iso: string): string {
  if (!iso) return '';
  const hasTime = iso.includes('T');
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const options: Intl.DateTimeFormatOptions = hasTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' };
  return Intl.DateTimeFormat(undefined, options).format(date);
}

/**
 * Compact formatter for tight UI spaces.
 * - With time: M/D, h:mm (24h/12h per locale)
 * - Date only: M/D
 */
export function formatDateTimeCompact(iso: string): string {
  if (!iso) return '';
  const hasTime = iso.includes('T');
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const options: Intl.DateTimeFormatOptions = hasTime
    ? { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { month: 'numeric', day: 'numeric' };
  return Intl.DateTimeFormat(undefined, options).format(date);
}

/**
 * Get the previous day's date as YYYY-MM-DD string
 */
export function getPreviousDay(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  date.setDate(date.getDate() - 1);
  return getLocalDateString(date);
}





