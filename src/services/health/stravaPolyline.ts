import { GPSCoordinate } from '../../types';

/**
 * Decode an encoded polyline string (Google Encoded Polyline Algorithm Format)
 * into an array of [latitude, longitude] pairs.
 */
export function decodePolyline(encoded: string): [number, number][] {
  if (!encoded || typeof encoded !== 'string') return [];

  const points: [number, number][] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

/**
 * Convert decoded coordinates into RunWar GPSCoordinate objects
 * with synthetic timestamps spread evenly over workout duration.
 */
export function polylineToGPSCoordinates(
  polyline: string | null | undefined,
  startedAtIso: string,
  durationSeconds: number,
  averageSpeedKmh: number = 0
): GPSCoordinate[] {
  if (!polyline) return [];

  const rawPoints = decodePolyline(polyline);
  if (rawPoints.length === 0) return [];

  const startTime = new Date(startedAtIso).getTime() || Date.now();
  const timeStepMs = rawPoints.length > 1 ? (durationSeconds * 1000) / (rawPoints.length - 1) : 0;
  const defaultSpeedMs = averageSpeedKmh > 0 ? (averageSpeedKmh * 1000) / 3600 : 2.5;

  return rawPoints.map(([latitude, longitude], idx) => ({
    latitude,
    longitude,
    altitude: null,
    accuracy: 5,
    speed: defaultSpeedMs,
    timestamp: startTime + idx * timeStepMs,
  }));
}
