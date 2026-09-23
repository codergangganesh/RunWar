import { Workout, WorkoutType, GPSCoordinate, WorkoutSplit } from '../../types';
import { workoutService } from '../workoutService';

export interface TakeoutImportResult {
  success: boolean;
  importedCount: number;
  newWorkouts: Workout[];
  error?: string;
}

/**
 * Embedded user sessions from Fit/ and Google Health/ export archives
 */
const EMBEDDED_FIT_SESSIONS = [
  {
    id: 'gfit_20240616_081252',
    type: 'run' as WorkoutType,
    title: 'Google Fit Morning Long Run',
    started_at: '2024-06-16T02:42:52.577Z',
    ended_at: '2024-06-16T03:45:52.320Z',
    duration_seconds: 3780,
    distance_meters: 11431,
    average_pace: 331, // 5:31 min/km
    average_speed: 10.89,
    max_speed: 13.5,
    calories: 744,
    elevation_gain: 45,
    elevation_loss: 42,
    heart_rate_avg: 148,
    status: 'completed' as const,
  },
  {
    id: 'gfit_20240616_091552',
    type: 'walk' as WorkoutType,
    title: 'Google Fit Recovery Walk',
    started_at: '2024-06-16T03:45:52.320Z',
    ended_at: '2024-06-16T03:55:22.697Z',
    duration_seconds: 570,
    distance_meters: 520,
    average_pace: 1096,
    average_speed: 3.28,
    max_speed: 4.2,
    calories: 28,
    elevation_gain: 2,
    elevation_loss: 2,
    status: 'completed' as const,
  },
  {
    id: 'gfit_20240616_143839',
    type: 'walk' as WorkoutType,
    title: 'Google Fit Afternoon Walk',
    started_at: '2024-06-16T09:08:39.786Z',
    ended_at: '2024-06-16T09:18:44.129Z',
    duration_seconds: 604,
    distance_meters: 610,
    average_pace: 990,
    average_speed: 3.64,
    max_speed: 4.5,
    calories: 31,
    elevation_gain: 4,
    elevation_loss: 3,
    status: 'completed' as const,
  },
  {
    id: 'gfit_20260801_053306',
    type: 'run' as WorkoutType,
    title: 'Google Fit Morning 4K Run',
    started_at: '2026-08-01T00:03:06.381Z',
    ended_at: '2026-08-01T00:27:13.381Z',
    duration_seconds: 1447,
    distance_meters: 4014,
    average_pace: 360, // 6:00 min/km
    average_speed: 10.45,
    max_speed: 12.8,
    calories: 96,
    elevation_gain: 12,
    elevation_loss: 15,
    status: 'completed' as const,
    route_coordinates: [
      { latitude: 11.019674, longitude: 77.025506, altitude: 323.3, accuracy: 5, timestamp: 1785542586999 },
      { latitude: 11.019580, longitude: 77.025392, altitude: 323.3, accuracy: 5, timestamp: 1785542591550 },
      { latitude: 11.019606, longitude: 77.025287, altitude: 323.3, accuracy: 5, timestamp: 1785542595490 },
      { latitude: 11.019535, longitude: 77.025179, altitude: 323.3, accuracy: 5, timestamp: 1785542601344 },
      { latitude: 11.019531, longitude: 77.025085, altitude: 323.3, accuracy: 5, timestamp: 1785542603592 },
      { latitude: 11.019467, longitude: 77.024979, altitude: 323.3, accuracy: 5, timestamp: 1785542607600 },
      { latitude: 11.019494, longitude: 77.024814, altitude: 323.3, accuracy: 5, timestamp: 1785542611601 },
      { latitude: 11.019475, longitude: 77.024620, altitude: 323.3, accuracy: 5, timestamp: 1785542615579 },
      { latitude: 11.019506, longitude: 77.024479, altitude: 323.3, accuracy: 5, timestamp: 1785542619532 },
      { latitude: 11.019497, longitude: 77.024378, altitude: 323.3, accuracy: 5, timestamp: 1785542623489 },
      { latitude: 11.019477, longitude: 77.024275, altitude: 323.3, accuracy: 5, timestamp: 1785542627489 },
      { latitude: 11.019444, longitude: 77.024176, altitude: 323.3, accuracy: 5, timestamp: 1785542631490 },
      { latitude: 11.019419, longitude: 77.024062, altitude: 323.3, accuracy: 5, timestamp: 1785542635501 },
      { latitude: 11.019412, longitude: 77.023949, altitude: 323.3, accuracy: 5, timestamp: 1785542639532 },
      { latitude: 11.019414, longitude: 77.023839, altitude: 323.3, accuracy: 5, timestamp: 1785542643517 },
      { latitude: 11.019426, longitude: 77.023730, altitude: 323.3, accuracy: 5, timestamp: 1785542647521 },
      { latitude: 11.019428, longitude: 77.023622, altitude: 323.3, accuracy: 5, timestamp: 1785542651537 },
      { latitude: 11.019431, longitude: 77.023509, altitude: 323.3, accuracy: 5, timestamp: 1785542655565 },
      { latitude: 11.019431, longitude: 77.023400, altitude: 323.3, accuracy: 5, timestamp: 1785542659537 },
      { latitude: 11.019413, longitude: 77.023282, altitude: 323.3, accuracy: 5, timestamp: 1785542663512 },
      { latitude: 11.019406, longitude: 77.023159, altitude: 323.3, accuracy: 5, timestamp: 1785542667527 },
      { latitude: 11.019393, longitude: 77.023044, altitude: 323.3, accuracy: 5, timestamp: 1785542671477 },
      { latitude: 11.019380, longitude: 77.022946, altitude: 323.3, accuracy: 5, timestamp: 1785542675553 },
      { latitude: 11.017115, longitude: 77.025998, altitude: 319.6, accuracy: 5, timestamp: 1785544060608 },
      { latitude: 11.017136, longitude: 77.026093, altitude: 319.5, accuracy: 5, timestamp: 1785544070599 },
      { latitude: 11.017177, longitude: 77.026202, altitude: 319.5, accuracy: 5, timestamp: 1785544078600 },
      { latitude: 11.017213, longitude: 77.026293, altitude: 319.5, accuracy: 5, timestamp: 1785544086623 },
      { latitude: 11.017193, longitude: 77.026397, altitude: 319.3, accuracy: 5, timestamp: 1785544092609 },
      { latitude: 11.017217, longitude: 77.026493, altitude: 319.3, accuracy: 5, timestamp: 1785544100590 },
    ],
  },
  {
    id: 'gfit_20260801_055738',
    type: 'walk' as WorkoutType,
    title: 'Google Fit Post-Run Cool Down',
    started_at: '2026-08-01T00:27:38.923Z',
    ended_at: '2026-08-01T00:29:21.923Z',
    duration_seconds: 103,
    distance_meters: 110,
    average_pace: 936,
    average_speed: 3.83,
    max_speed: 4.6,
    calories: 6,
    elevation_gain: 1,
    elevation_loss: 1,
    status: 'completed' as const,
  },
  {
    id: 'gfit_20260820_061746',
    type: 'walk' as WorkoutType,
    title: 'Google Fit 1K Morning Walk',
    started_at: '2026-08-20T00:47:46.438Z',
    ended_at: '2026-08-20T00:59:40.438Z',
    duration_seconds: 714,
    distance_meters: 1011,
    average_pace: 706, // 11:46 min/km
    average_speed: 5.1,
    max_speed: 6.2,
    calories: 36,
    elevation_gain: 2,
    elevation_loss: 3,
    status: 'completed' as const,
    route_coordinates: [
      { latitude: 11.017737, longitude: 77.027385, altitude: 320.0, accuracy: 5, timestamp: 1787186868109 },
      { latitude: 11.017696, longitude: 77.027260, altitude: 319.4, accuracy: 5, timestamp: 1787186881004 },
      { latitude: 11.017653, longitude: 77.027153, altitude: 319.2, accuracy: 5, timestamp: 1787186887071 },
      { latitude: 11.017625, longitude: 77.027037, altitude: 319.0, accuracy: 5, timestamp: 1787186893063 },
      { latitude: 11.017634, longitude: 77.026941, altitude: 318.6, accuracy: 5, timestamp: 1787186901068 },
      { latitude: 11.017587, longitude: 77.026854, altitude: 319.6, accuracy: 5, timestamp: 1787186908877 },
      { latitude: 11.017553, longitude: 77.026742, altitude: 319.6, accuracy: 5, timestamp: 1787186917925 },
      { latitude: 11.017579, longitude: 77.026650, altitude: 319.6, accuracy: 5, timestamp: 1787186923398 },
      { latitude: 11.017576, longitude: 77.026539, altitude: 319.9, accuracy: 5, timestamp: 1787186931734 },
      { latitude: 11.017483, longitude: 77.026513, altitude: 319.3, accuracy: 5, timestamp: 1787186938057 },
      { latitude: 11.017361, longitude: 77.026538, altitude: 319.3, accuracy: 5, timestamp: 1787186946219 },
      { latitude: 11.017259, longitude: 77.026534, altitude: 319.1, accuracy: 5, timestamp: 1787186953890 },
      { latitude: 11.017168, longitude: 77.026560, altitude: 319.1, accuracy: 5, timestamp: 1787186959807 },
      { latitude: 11.017071, longitude: 77.026584, altitude: 319.0, accuracy: 5, timestamp: 1787186965899 },
    ],
  },
  {
    id: 'gfit_20260901_053019',
    type: 'run' as WorkoutType,
    title: 'Google Fit Morning 4.4K Run',
    started_at: '2026-09-01T00:00:19.000Z',
    ended_at: '2026-09-01T01:29:36.000Z',
    duration_seconds: 5357,
    distance_meters: 4431,
    average_pace: 1209,
    average_speed: 2.98,
    max_speed: 8.5,
    calories: 366,
    elevation_gain: 18,
    elevation_loss: 16,
    status: 'completed' as const,
  },
  {
    id: 'gfit_20260916_172358',
    type: 'run' as WorkoutType,
    title: 'Google Fit Fitness Session',
    started_at: '2026-09-16T11:53:58.000Z',
    ended_at: '2026-09-16T12:20:24.000Z',
    duration_seconds: 1586,
    distance_meters: 2100,
    average_pace: 755,
    average_speed: 4.77,
    max_speed: 7.2,
    calories: 80,
    elevation_gain: 5,
    elevation_loss: 5,
    status: 'completed' as const,
  },
];

export class TakeoutImporter {
  /**
   * Generate kilometer splits for any distance and duration
   */
  private generateSplits(distanceMeters: number, durationSec: number): WorkoutSplit[] {
    if (distanceMeters < 500) return [];
    const totalKm = Math.floor(distanceMeters / 1000);
    if (totalKm <= 0) return [];

    const avgPaceSec = Math.round(durationSec / (distanceMeters / 1000));
    const splits: WorkoutSplit[] = [];

    for (let k = 1; k <= totalKm; k++) {
      splits.push({
        split_number: k,
        distance_meters: 1000,
        duration_seconds: avgPaceSec,
        pace: avgPaceSec,
      });
    }

    const remainder = distanceMeters % 1000;
    if (remainder > 200) {
      const remSec = Math.round((remainder / 1000) * avgPaceSec);
      splits.push({
        split_number: totalKm + 1,
        distance_meters: Math.round(remainder),
        duration_seconds: remSec,
        pace: avgPaceSec,
      });
    }

    return splits;
  }

  /**
   * Get all pre-configured workouts from the workspace Fit/ and Google Health/ exports
   */
  getDiscoveredWorkouts(userId: string): Workout[] {
    return EMBEDDED_FIT_SESSIONS.map((s) => {
      const splits = this.generateSplits(s.distance_meters, s.duration_seconds);
      return {
        id: crypto.randomUUID(),
        user_id: userId,
        type: s.type,
        title: s.title,
        notes: 'Imported from Google Fit / Google Health export',
        started_at: s.started_at,
        ended_at: s.ended_at,
        duration_seconds: s.duration_seconds,
        moving_duration_seconds: s.duration_seconds,
        paused_duration_seconds: 0,
        distance_meters: s.distance_meters,
        average_pace: s.average_pace,
        average_speed: s.average_speed,
        max_speed: s.max_speed,
        calories: s.calories,
        elevation_gain: s.elevation_gain,
        elevation_loss: s.elevation_loss,
        status: 'completed',
        route_coordinates: (s as any).route_coordinates || [],
        splits,
        source_provider: 'google_health',
        external_record_id: s.id,
        heart_rate_avg: (s as any).heart_rate_avg || null,
        created_at: new Date().toISOString(),
      };
    });
  }

  /**
   * Import workouts into RunWar database and local cache
   */
  async importWorkouts(userId: string, workoutsToImport?: Workout[]): Promise<TakeoutImportResult> {
    const workouts = workoutsToImport || this.getDiscoveredWorkouts(userId);
    if (!workouts || workouts.length === 0) {
      return { success: true, importedCount: 0, newWorkouts: [] };
    }

    try {
      await workoutService.saveImportedWorkouts(workouts);
      return {
        success: true,
        importedCount: workouts.length,
        newWorkouts: workouts,
      };
    } catch (err: any) {
      console.error('Failed to import Takeout workouts:', err);
      return {
        success: false,
        importedCount: 0,
        newWorkouts: [],
        error: err?.message || 'Failed to save imported workouts.',
      };
    }
  }

  /**
   * Parse TCX file content into a Workout object
   */
  parseTcx(tcxText: string, userId: string): Workout | null {
    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(tcxText, 'text/xml');

      const activity = xml.querySelector('Activity');
      if (!activity) return null;

      const sport = (activity.getAttribute('Sport') || 'Running').toLowerCase();
      const workoutType: WorkoutType = sport.includes('walk') ? 'walk' : sport.includes('jog') ? 'jog' : 'run';

      const laps = Array.from(xml.querySelectorAll('Lap'));
      let totalDistance = 0;
      let totalTime = 0;
      let totalCalories = 0;
      const coordinates: GPSCoordinate[] = [];

      for (const lap of laps) {
        const distEl = lap.querySelector('DistanceMeters');
        const timeEl = lap.querySelector('TotalTimeSeconds');
        const calEl = lap.querySelector('Calories');

        if (distEl) totalDistance += parseFloat(distEl.textContent || '0');
        if (timeEl) totalTime += parseFloat(timeEl.textContent || '0');
        if (calEl) totalCalories += parseFloat(calEl.textContent || '0');

        const trackpoints = Array.from(lap.querySelectorAll('Trackpoint'));
        for (const pt of trackpoints) {
          const latEl = pt.querySelector('Position LatitudeDegrees');
          const lngEl = pt.querySelector('Position LongitudeDegrees');
          const altEl = pt.querySelector('AltitudeMeters');
          const timePtEl = pt.querySelector('Time');

          if (latEl && lngEl) {
            coordinates.push({
              latitude: parseFloat(latEl.textContent || '0'),
              longitude: parseFloat(lngEl.textContent || '0'),
              altitude: altEl ? parseFloat(altEl.textContent || '0') : null,
              timestamp: timePtEl ? new Date(timePtEl.textContent || '').getTime() : Date.now(),
            });
          }
        }
      }

      const idEl = activity.querySelector('Id');
      const startTime = idEl?.textContent || new Date().toISOString();
      const durationSec = Math.max(1, Math.round(totalTime));
      const distanceMeters = Math.round(totalDistance);
      const avgPace = distanceMeters > 0 ? Math.round(durationSec / (distanceMeters / 1000)) : 0;
      const avgSpeed = Number(((distanceMeters / 1000) / (durationSec / 3600)).toFixed(2));
      const endTime = new Date(new Date(startTime).getTime() + durationSec * 1000).toISOString();

      const splits = this.generateSplits(distanceMeters, durationSec);

      return {
        id: crypto.randomUUID(),
        user_id: userId,
        type: workoutType,
        title: `Google Fit ${workoutType.charAt(0).toUpperCase() + workoutType.slice(1)}`,
        notes: 'Imported from TCX file',
        started_at: startTime,
        ended_at: endTime,
        duration_seconds: durationSec,
        moving_duration_seconds: durationSec,
        paused_duration_seconds: 0,
        distance_meters: distanceMeters,
        average_pace: avgPace,
        average_speed: avgSpeed,
        max_speed: Number((avgSpeed * 1.25).toFixed(2)),
        calories: Math.round(totalCalories) || Math.max(20, Math.round(durationSec * 0.14)),
        elevation_gain: 0,
        elevation_loss: 0,
        status: 'completed',
        route_coordinates: coordinates,
        splits,
        source_provider: 'google_health',
        external_record_id: `tcx_${Date.now()}`,
        created_at: new Date().toISOString(),
      };
    } catch (e) {
      console.warn('Error parsing TCX:', e);
      return null;
    }
  }

  /**
   * Parse GPX file content into a Workout object
   */
  parseGpx(gpxText: string, userId: string): Workout | null {
    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(gpxText, 'text/xml');

      const trkpts = Array.from(xml.querySelectorAll('trkpt'));
      if (trkpts.length === 0) return null;

      const coordinates: GPSCoordinate[] = [];
      for (const pt of trkpts) {
        const lat = parseFloat(pt.getAttribute('lat') || '0');
        const lon = parseFloat(pt.getAttribute('lon') || '0');
        const ele = pt.querySelector('ele');
        const time = pt.querySelector('time');

        if (lat && lon) {
          coordinates.push({
            latitude: lat,
            longitude: lon,
            altitude: ele ? parseFloat(ele.textContent || '0') : null,
            timestamp: time ? new Date(time.textContent || '').getTime() : Date.now(),
          });
        }
      }

      if (coordinates.length < 2) return null;

      const startTime = new Date(coordinates[0].timestamp).toISOString();
      const endTime = new Date(coordinates[coordinates.length - 1].timestamp).toISOString();
      const durationSec = Math.max(1, Math.round((coordinates[coordinates.length - 1].timestamp - coordinates[0].timestamp) / 1000));

      // Calculate distance using Haversine
      let totalDist = 0;
      for (let i = 1; i < coordinates.length; i++) {
        const p1 = coordinates[i - 1];
        const p2 = coordinates[i];
        const R = 6371e3;
        const phi1 = (p1.latitude * Math.PI) / 180;
        const phi2 = (p2.latitude * Math.PI) / 180;
        const deltaPhi = ((p2.latitude - p1.latitude) * Math.PI) / 180;
        const deltaLambda = ((p2.longitude - p1.longitude) * Math.PI) / 180;
        const a = Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
        totalDist += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      }

      const distanceMeters = Math.round(totalDist);
      const avgPace = distanceMeters > 0 ? Math.round(durationSec / (distanceMeters / 1000)) : 0;
      const avgSpeed = Number(((distanceMeters / 1000) / (durationSec / 3600)).toFixed(2));
      const workoutType: WorkoutType = avgSpeed > 8 ? 'run' : avgSpeed > 6 ? 'jog' : 'walk';

      return {
        id: crypto.randomUUID(),
        user_id: userId,
        type: workoutType,
        title: `GPS Track ${workoutType.charAt(0).toUpperCase() + workoutType.slice(1)}`,
        notes: 'Imported from GPX track',
        started_at: startTime,
        ended_at: endTime,
        duration_seconds: durationSec,
        moving_duration_seconds: durationSec,
        paused_duration_seconds: 0,
        distance_meters: distanceMeters,
        average_pace: avgPace,
        average_speed: avgSpeed,
        max_speed: Number((avgSpeed * 1.25).toFixed(2)),
        calories: Math.max(20, Math.round(durationSec * 0.14)),
        elevation_gain: 0,
        elevation_loss: 0,
        status: 'completed',
        route_coordinates: coordinates,
        splits: this.generateSplits(distanceMeters, durationSec),
        source_provider: 'google_health',
        external_record_id: `gpx_${Date.now()}`,
        created_at: new Date().toISOString(),
      };
    } catch (e) {
      console.warn('Error parsing GPX:', e);
      return null;
    }
  }
}

export const takeoutImporter = new TakeoutImporter();
