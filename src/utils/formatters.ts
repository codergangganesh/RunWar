import { DistanceUnit, PaceUnit } from '../types';

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 */
export function formatDuration(seconds: number | string): string {
  const s = Math.round(Number(seconds) || 0);
  if (s < 0) return '00:00';
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format pace in seconds/km to "M:SS /km" or "M:SS /mi"
 */
export function formatPace(paceSecPerKm: number | string, unit: PaceUnit = 'min_km'): string {
  const paceNum = Number(paceSecPerKm) || 0;
  if (!paceNum || paceNum <= 0 || !isFinite(paceNum) || paceNum > 3600) {
    return '--:--';
  }

  let paceSec = paceNum;
  if (unit === 'min_mi') {
    paceSec = paceNum * 1.60934;
  }

  const mins = Math.floor(paceSec / 60);
  const secs = Math.floor(paceSec % 60);
  const suffix = unit === 'min_mi' ? '/mi' : '/km';

  return `${mins}:${secs.toString().padStart(2, '0')} ${suffix}`;
}

/**
 * Format pace raw without unit suffix for large HUD displays
 */
export function formatPaceRaw(paceSecPerKm: number | string, unit: PaceUnit = 'min_km'): string {
  const paceNum = Number(paceSecPerKm) || 0;
  if (!paceNum || paceNum <= 0 || !isFinite(paceNum) || paceNum > 3600) {
    return '--:--';
  }
  let paceSec = paceNum;
  if (unit === 'min_mi') {
    paceSec = paceNum * 1.60934;
  }
  const mins = Math.floor(paceSec / 60);
  const secs = Math.floor(paceSec % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format distance in meters to km or mi
 */
export function formatDistance(meters: number | string, unit: DistanceUnit = 'km', decimals: number = 2): string {
  const m = Number(meters) || 0;
  if (m < 0) return '0.00';
  if (unit === 'mi') {
    const miles = m / 1609.34;
    return miles.toFixed(decimals);
  }
  const km = m / 1000;
  return km.toFixed(decimals);
}

/**
 * Format speed in km/h to current unit
 */
export function formatSpeed(speedKmh: number | string, unit: DistanceUnit = 'km'): string {
  const s = Number(speedKmh) || 0;
  if (s < 0) return '0.0';
  if (unit === 'mi') {
    const mph = s * 0.621371;
    return mph.toFixed(1);
  }
  return s.toFixed(1);
}

/**
 * Format date nicely (e.g. "Today, 7:30 AM", "Yesterday, 6:15 PM", "Sep 21, 7:30 AM")
 */
export function formatWorkoutDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const now = new Date();
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return `Today, ${timeStr}`;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      d.getFullYear() === yesterday.getFullYear() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getDate() === yesterday.getDate();

    if (isYesterday) {
      return `Yesterday, ${timeStr}`;
    }

    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  } catch (e) {
    return dateString;
  }
}
