import { DistanceUnit, PaceUnit } from '../types';

/**
 * Format duration in seconds to MM:SS or HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format pace in seconds/km to "M:SS /km" or "M:SS /mi"
 */
export function formatPace(paceSecPerKm: number, unit: PaceUnit = 'min_km'): string {
  if (!paceSecPerKm || paceSecPerKm <= 0 || !isFinite(paceSecPerKm) || paceSecPerKm > 3600) {
    return '--:--';
  }

  let paceSec = paceSecPerKm;
  if (unit === 'min_mi') {
    paceSec = paceSecPerKm * 1.60934;
  }

  const mins = Math.floor(paceSec / 60);
  const secs = Math.floor(paceSec % 60);
  const suffix = unit === 'min_mi' ? '/mi' : '/km';

  return `${mins}:${secs.toString().padStart(2, '0')} ${suffix}`;
}

/**
 * Format pace raw without unit suffix for large HUD displays
 */
export function formatPaceRaw(paceSecPerKm: number, unit: PaceUnit = 'min_km'): string {
  if (!paceSecPerKm || paceSecPerKm <= 0 || !isFinite(paceSecPerKm) || paceSecPerKm > 3600) {
    return '--:--';
  }
  let paceSec = paceSecPerKm;
  if (unit === 'min_mi') {
    paceSec = paceSecPerKm * 1.60934;
  }
  const mins = Math.floor(paceSec / 60);
  const secs = Math.floor(paceSec % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format distance in meters to km or mi
 */
export function formatDistance(meters: number, unit: DistanceUnit = 'km', decimals: number = 2): string {
  if (isNaN(meters) || meters < 0) return '0.00';
  if (unit === 'mi') {
    const miles = meters / 1609.34;
    return miles.toFixed(decimals);
  }
  const km = meters / 1000;
  return km.toFixed(decimals);
}

/**
 * Format speed in km/h to current unit
 */
export function formatSpeed(speedKmh: number, unit: DistanceUnit = 'km'): string {
  if (isNaN(speedKmh) || speedKmh < 0) return '0.0';
  if (unit === 'mi') {
    const mph = speedKmh * 0.621371;
    return mph.toFixed(1);
  }
  return speedKmh.toFixed(1);
}

/**
 * Format date nicely (e.g. "Today at 7:30 AM", "Mon, Sep 21")
 */
export function formatWorkoutDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) {
      return `Today, ${timeStr}`;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${timeStr}`;
    }

    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  } catch (e) {
    return dateString;
  }
}
