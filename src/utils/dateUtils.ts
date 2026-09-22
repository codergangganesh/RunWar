/**
 * Timezone-aware date and time utility functions
 * Ensures workouts completed in user's local timezone are accurately aggregated
 */

/**
 * Returns YYYY-MM-DD representing the date in the user's local timezone
 */
export function getLocalDateKey(date: Date | string | number): string {
  const d = typeof date === 'object' ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks if two dates fall on the same calendar day in local time
 */
export function isSameLocalDate(
  d1: Date | string | number,
  d2: Date | string | number = new Date()
): boolean {
  const date1 = typeof d1 === 'object' ? d1 : new Date(d1);
  const date2 = typeof d2 === 'object' ? d2 : new Date(d2);
  if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return false;
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Returns a Date set to the start of the local day (00:00:00.000)
 */
export function getStartOfLocalDate(date: Date | string | number = new Date()): Date {
  const d = typeof date === 'object' ? new Date(date.getTime()) : new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Returns a Date set to the end of the local day (23:59:59.999)
 */
export function getEndOfLocalDate(date: Date | string | number = new Date()): Date {
  const d = typeof date === 'object' ? new Date(date.getTime()) : new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Returns a Date set to Monday 00:00:00.000 of the local week
 */
export function getStartOfLocalWeek(date: Date | string | number = new Date()): Date {
  const d = typeof date === 'object' ? new Date(date.getTime()) : new Date(date);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Formats time in local timezone (e.g. "07:15 AM", "2:30 PM")
 */
export function formatLocalTime(date: Date | string | number): string {
  const d = typeof date === 'object' ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Formats full date in local timezone (e.g. "Tuesday, September 22, 2026")
 */
export function formatLocalDateFull(date: Date | string | number): string {
  const d = typeof date === 'object' ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString([], {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
