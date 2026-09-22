import { GPSCoordinate, WorkoutSplit, WorkoutType } from '../types';

/**
 * Calculate distance in meters between two GPS coordinates using Haversine formula
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Calculate pace in seconds per kilometer
 */
export function calculatePace(distanceMeters: number, durationSeconds: number): number {
  if (distanceMeters <= 0 || durationSeconds <= 0) return 0;
  const km = distanceMeters / 1000;
  return durationSeconds / km;
}

/**
 * Calculate speed in km/h
 */
export function calculateSpeed(distanceMeters: number, durationSeconds: number): number {
  if (durationSeconds <= 0 || distanceMeters <= 0) return 0;
  const hours = durationSeconds / 3600;
  const km = distanceMeters / 1000;
  return km / hours;
}

/**
 * Estimate calories burned based on MET formula
 * Calories = MET * weight_kg * (duration_sec / 3600)
 */
export function calculateCalories(
  weightKg: number = 70, // Default 70kg fallback
  durationSeconds: number,
  speedKmh: number,
  type: WorkoutType = 'run'
): number {
  if (durationSeconds <= 0) return 0;

  let met = 7.0; // Moderate jog default

  if (type === 'walk') {
    if (speedKmh < 4.0) met = 2.8;
    else if (speedKmh < 5.5) met = 3.5;
    else met = 4.5;
  } else if (type === 'jog') {
    if (speedKmh < 7.0) met = 6.0;
    else if (speedKmh < 8.5) met = 7.5;
    else met = 8.5;
  } else {
    // Run
    if (speedKmh < 8.0) met = 8.0;
    else if (speedKmh < 9.6) met = 9.8;
    else if (speedKmh < 11.2) met = 11.0;
    else if (speedKmh < 12.8) met = 11.8;
    else if (speedKmh < 14.5) met = 12.8;
    else met = 14.5;
  }

  const hours = durationSeconds / 3600;
  const calories = met * weightKg * hours;
  return Math.round(calories);
}

/**
 * Filter GPS noise, drift, duplicate points, and impossible jumps
 */
export function isValidGPSPoint(
  newPoint: GPSCoordinate,
  prevPoint: GPSCoordinate | null
): boolean {
  // Reject points with poor accuracy (> 35 meters)
  if (newPoint.accuracy && newPoint.accuracy > 35) {
    return false;
  }

  if (!prevPoint) return true;

  const timeDeltaSec = (newPoint.timestamp - prevPoint.timestamp) / 1000;
  if (timeDeltaSec <= 0.1) return false; // Duplicate or near-duplicate timestamp

  const distance = calculateHaversineDistance(
    prevPoint.latitude,
    prevPoint.longitude,
    newPoint.latitude,
    newPoint.longitude
  );

  // If moved < 0.5 meter in 1 sec, treat as stationary GPS jitter
  if (distance < 0.5 && timeDeltaSec < 2) {
    return false;
  }

  const speedKmh = (distance / 1000) / (timeDeltaSec / 3600);

  // Reject impossible running speed (> 35 km/h, world record sprint is ~44 km/h)
  if (speedKmh > 35) {
    return false;
  }

  return true;
}

/**
 * Automatically compute kilometer/mile splits from recorded GPS coordinates
 */
export function calculateSplits(
  coordinates: GPSCoordinate[],
  splitDistanceMeters: number = 1000
): WorkoutSplit[] {
  if (coordinates.length < 2) return [];

  const splits: WorkoutSplit[] = [];
  let currentSplitDistance = 0;
  let currentSplitStartTime = coordinates[0].timestamp;
  let splitIndex = 1;

  for (let i = 1; i < coordinates.length; i++) {
    const prev = coordinates[i - 1];
    const curr = coordinates[i];

    // Live workout points carry the filtered distance used by the tracker.
    // Older saved routes do not, so retain Haversine as a backward-compatible fallback.
    const dist = curr.distanceFromPrevious ?? calculateHaversineDistance(
      prev.latitude,
      prev.longitude,
      curr.latitude,
      curr.longitude
    );

    if (dist <= 0) continue;

    const timeDeltaSec = Math.max(0.001, (curr.timestamp - prev.timestamp) / 1000);
    currentSplitDistance += dist;

    while (currentSplitDistance >= splitDistanceMeters) {
      const overshoot = currentSplitDistance - splitDistanceMeters;
      const fractionInSplit = Math.max(0, Math.min(1, (dist - overshoot) / dist));
      const overshootTimeSec = timeDeltaSec * (1 - fractionInSplit);

      // Interpolated split end timestamp
      const splitEndTimestamp = curr.timestamp - overshootTimeSec * 1000;
      const splitDurationSec = Math.max(1, (splitEndTimestamp - currentSplitStartTime) / 1000);
      const pace = calculatePace(splitDistanceMeters, splitDurationSec);
      const speedKmh = calculateSpeed(splitDistanceMeters, splitDurationSec);

      splits.push({
        split_number: splitIndex,
        distance_meters: Math.round(splitDistanceMeters),
        duration_seconds: Math.round(splitDurationSec),
        pace: Math.round(pace),
        speed_kmh: Number(speedKmh.toFixed(1)),
      });

      splitIndex++;
      currentSplitDistance = overshoot;
      currentSplitStartTime = splitEndTimestamp;
    }
  }

  // Final partial split if remaining distance > 50 meters
  if (currentSplitDistance > 50) {
    const lastCoord = coordinates[coordinates.length - 1];
    const splitDurationSec = Math.max(1, (lastCoord.timestamp - currentSplitStartTime) / 1000);
    const pace = calculatePace(currentSplitDistance, splitDurationSec);
    const speedKmh = calculateSpeed(currentSplitDistance, splitDurationSec);

    splits.push({
      split_number: splitIndex,
      distance_meters: Math.round(currentSplitDistance),
      duration_seconds: Math.round(splitDurationSec),
      pace: Math.round(pace),
      speed_kmh: Number(speedKmh.toFixed(1)),
    });
  }

  return splits;
}

export interface RouteDistanceMilestone {
  distanceMeters: number;
  coordinate: GPSCoordinate;
}

/**
 * Locate every completed kilometre on a route. The location is interpolated
 * within the GPS segment so labels are placed at the actual milestone, rather
 * than only at the next recorded GPS sample.
 */
export function getRouteDistanceMilestones(
  coordinates: GPSCoordinate[],
  intervalMeters: number = 1000
): RouteDistanceMilestone[] {
  if (coordinates.length < 2 || intervalMeters <= 0) return [];

  const milestones: RouteDistanceMilestone[] = [];
  let cumulativeDistance = 0;
  let nextMilestone = intervalMeters;

  for (let i = 1; i < coordinates.length; i++) {
    const previous = coordinates[i - 1];
    const current = coordinates[i];
    const segmentDistance = current.distanceFromPrevious ?? calculateHaversineDistance(
      previous.latitude,
      previous.longitude,
      current.latitude,
      current.longitude
    );

    if (segmentDistance <= 0) continue;

    while (cumulativeDistance + segmentDistance >= nextMilestone) {
      const fraction = Math.max(0, Math.min(1, (nextMilestone - cumulativeDistance) / segmentDistance));
      milestones.push({
        distanceMeters: nextMilestone,
        coordinate: {
          ...current,
          latitude: previous.latitude + (current.latitude - previous.latitude) * fraction,
          longitude: previous.longitude + (current.longitude - previous.longitude) * fraction,
          timestamp: previous.timestamp + (current.timestamp - previous.timestamp) * fraction,
          distanceFromPrevious: 0,
        },
      });
      nextMilestone += intervalMeters;
    }

    cumulativeDistance += segmentDistance;
  }

  return milestones;
}
