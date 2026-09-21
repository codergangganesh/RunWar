import { GPSCoordinate } from '../types';

export class PaceCalculator {
  private static readonly ROLLING_WINDOW_SECONDS = 15; // 15-second sliding window for current pace
  private static readonly MIN_MOVING_SPEED_KMH = 1.0; // Under 1 km/h is considered stationary/stopped

  /**
   * Calculate smooth current pace (in seconds per km) from rolling window of coordinates
   */
  public static calculateRollingPace(
    coordinates: GPSCoordinate[],
    currentSpeedKmh: number
  ): number {
    // If the athlete is currently stationary/stopped, report 0 (displays as stopped / --:--)
    if (currentSpeedKmh < this.MIN_MOVING_SPEED_KMH || coordinates.length < 2) {
      return 0;
    }

    const latestPoint = coordinates[coordinates.length - 1];
    const cutoffTime = latestPoint.timestamp - this.ROLLING_WINDOW_SECONDS * 1000;

    let windowDistanceMeters = 0;
    let windowStartTime = latestPoint.timestamp;

    for (let i = coordinates.length - 1; i >= 1; i--) {
      const pt = coordinates[i];
      if (pt.timestamp < cutoffTime) break;

      windowDistanceMeters += pt.distanceFromPrevious || 0;
      windowStartTime = pt.timestamp;
    }

    const windowDurationSec = Math.max(1, (latestPoint.timestamp - windowStartTime) / 1000);

    // If we have at least 5 meters in the window, calculate pace
    if (windowDistanceMeters >= 5 && windowDurationSec > 0) {
      const km = windowDistanceMeters / 1000;
      const paceSec = windowDurationSec / km;

      // Bound between 1:30 min/km (90 sec) and 20:00 min/km (1200 sec)
      if (paceSec >= 90 && paceSec <= 1200) {
        return Math.round(paceSec);
      }
    }

    // Fallback: derive directly from current speed
    if (currentSpeedKmh > 0) {
      return Math.round(3600 / currentSpeedKmh);
    }

    return 0;
  }

  /**
   * Calculate cumulative average pace from valid moving time & distance
   */
  public static calculateAveragePace(distanceMeters: number, movingTimeSeconds: number): number {
    if (distanceMeters <= 10 || movingTimeSeconds <= 1) return 0;
    const km = distanceMeters / 1000;
    return Math.round(movingTimeSeconds / km);
  }

  /**
   * Calculate cumulative average speed in km/h
   */
  public static calculateAverageSpeed(distanceMeters: number, movingTimeSeconds: number): number {
    if (distanceMeters <= 10 || movingTimeSeconds <= 1) return 0;
    const hours = movingTimeSeconds / 3600;
    const km = distanceMeters / 1000;
    return Number((km / hours).toFixed(2));
  }
}
