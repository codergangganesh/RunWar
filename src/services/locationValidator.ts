import { GPSCoordinate } from '../types';
import { calculateHaversineDistance } from '../utils/calculations';
import { workoutLogger } from '../utils/workoutLogger';

export interface ValidationResult {
  isValid: boolean;
  rejectReason?: string;
  distanceFromPrevMeters: number;
  calculatedSpeedKmh: number;
  altitudeDeltaMeters: number;
}

export class LocationValidator {
  private static readonly MAX_ALLOWED_ACCURACY_METERS = 35; // Maximum radius of uncertainty
  private static readonly MAX_RUNNING_SPEED_KMH = 32; // ~1:52 min/km (elite sprint limit)
  private static readonly MIN_DISPLACEMENT_METERS = 0.6; // Stationary jitter threshold
  private static readonly MAX_ALTITUDE_DELTA_METERS_PER_SEC = 5.0; // Realistic elevation change

  /**
   * Validate incoming raw GPS point against previous validated point
   */
  public static validate(
    current: GPSCoordinate,
    previous: GPSCoordinate | null,
    workoutId?: string
  ): ValidationResult {
    // 1. Accuracy Check
    if (current.accuracy != null && current.accuracy > this.MAX_ALLOWED_ACCURACY_METERS) {
      workoutLogger.log('LOCATION_REJECTED', 'warn', {
        reason: 'accuracy_too_low',
        accuracy: current.accuracy,
      }, workoutId);

      return {
        isValid: false,
        rejectReason: `Accuracy ${current.accuracy.toFixed(1)}m exceeds threshold ${this.MAX_ALLOWED_ACCURACY_METERS}m`,
        distanceFromPrevMeters: 0,
        calculatedSpeedKmh: 0,
        altitudeDeltaMeters: 0,
      };
    }

    // If first point, validate coordinates are within geographic boundaries
    if (!previous) {
      const isValidCoords =
        current.latitude >= -90 &&
        current.latitude <= 90 &&
        current.longitude >= -180 &&
        current.longitude <= 180;

      return {
        isValid: isValidCoords,
        rejectReason: isValidCoords ? undefined : 'Invalid latitude/longitude range',
        distanceFromPrevMeters: 0,
        calculatedSpeedKmh: 0,
        altitudeDeltaMeters: 0,
      };
    }

    // 2. Timestamp & Duplicate Gate
    const timeDeltaSec = (current.timestamp - previous.timestamp) / 1000;
    if (timeDeltaSec <= 0.15) {
      return {
        isValid: false,
        rejectReason: 'Duplicate or near-duplicate timestamp (dt <= 0.15s)',
        distanceFromPrevMeters: 0,
        calculatedSpeedKmh: 0,
        altitudeDeltaMeters: 0,
      };
    }

    // 3. Distance Computation
    const distMeters = calculateHaversineDistance(
      previous.latitude,
      previous.longitude,
      current.latitude,
      current.longitude
    );

    // 4. Stationary GPS Jitter / Drift Suppression
    // When standing still, GPS floats around 0.5-2m. Accept the point for map marker
    // updates, but report zero distance to prevent fake distance accumulation.
    if (distMeters < this.MIN_DISPLACEMENT_METERS && timeDeltaSec < 2.0) {
      return {
        isValid: true,
        distanceFromPrevMeters: 0, // Zero distance — marker updates without adding fake meters
        calculatedSpeedKmh: 0,
        altitudeDeltaMeters: 0,
      };
    }

    // 5. Dynamic Speed / Teleport Jump Gate
    const calculatedSpeedKmh = (distMeters / 1000) / (timeDeltaSec / 3600);

    // If speed exceeds human running capability (e.g. car drive, subway teleport, GPS multi-path bounce)
    if (calculatedSpeedKmh > this.MAX_RUNNING_SPEED_KMH) {
      workoutLogger.log('LOCATION_REJECTED', 'warn', {
        reason: 'speed_spike',
        calculatedSpeedKmh: Number(calculatedSpeedKmh.toFixed(1)),
        distMeters: Number(distMeters.toFixed(1)),
        timeDeltaSec: Number(timeDeltaSec.toFixed(1)),
      }, workoutId);

      return {
        isValid: false,
        rejectReason: `Speed ${calculatedSpeedKmh.toFixed(1)} km/h exceeds human threshold ${this.MAX_RUNNING_SPEED_KMH} km/h`,
        distanceFromPrevMeters: 0,
        calculatedSpeedKmh,
        altitudeDeltaMeters: 0,
      };
    }

    // 6. Altitude Delta Sanity Check
    let altitudeDelta = 0;
    if (previous.altitude != null && current.altitude != null) {
      const altDiff = current.altitude - previous.altitude;
      const altRate = Math.abs(altDiff) / timeDeltaSec;

      if (altRate <= this.MAX_ALTITUDE_DELTA_METERS_PER_SEC) {
        altitudeDelta = altDiff;
      }
    }

    return {
      isValid: true,
      distanceFromPrevMeters: distMeters,
      calculatedSpeedKmh,
      altitudeDeltaMeters: altitudeDelta,
    };
  }
}
