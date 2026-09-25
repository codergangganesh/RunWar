import { CourseRoute, Workout } from '../types';
import { formatDuration, formatPace, formatDistance, formatSpeed } from './formatters';

/**
 * Generate standard GPX 1.1 XML format for a CourseRoute
 */
export function generateCourseGPX(course: CourseRoute): string {
  const dateStr = course.createdAt || new Date().toISOString();
  const name = course.name || 'RunWar Course';

  const trackPointsXml = (course.points || [])
    .map((pt) => {
      const eleXml = pt.altitude != null ? `\n        <ele>${Number(pt.altitude).toFixed(1)}</ele>` : '';
      return `      <trkpt lat="${pt.latitude}" lon="${pt.longitude}">${eleXml}
      </trkpt>`;
    })
    .join('\n');

  const waypointsXml = (course.waypoints || [])
    .map((w) => {
      return `  <wpt lat="${w.latitude}" lon="${w.longitude}">
    <name>${escapeXml(w.name)}</name>${w.description ? `\n    <desc>${escapeXml(w.description)}</desc>` : ''}
  </wpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RunWar Fitness App - https://runwar.app"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(name)}</name>
    <time>${dateStr}</time>
  </metadata>
${waypointsXml}
  <trk>
    <name>${escapeXml(name)}</name>
    <type>RUN</type>
    <trkseg>
${trackPointsXml}
    </trkseg>
  </trk>
</gpx>`;
}

/**
 * Generate standard GPX 1.1 XML format with Garmin TrackPoint Extensions
 * Supported by Strava, Garmin Connect, Nike Run Club, Apple Health, Relive, Komoot.
 */
export function generateGPX(workout: Workout): string {
  const dateStr = workout.started_at || new Date().toISOString();
  const name = workout.title || `${workout.type.toUpperCase()} - ${new Date(dateStr).toLocaleDateString()}`;

  const trackPointsXml = (workout.route_coordinates || [])
    .map((pt) => {
      const timeIso = new Date(pt.timestamp).toISOString();
      const eleXml = pt.altitude != null ? `\n        <ele>${Number(pt.altitude).toFixed(1)}</ele>` : '';
      const speedExtXml =
        pt.speed != null
          ? `\n        <extensions>\n          <gpxtpx:TrackPointExtension>\n            <gpxtpx:speed>${Number(pt.speed).toFixed(2)}</gpxtpx:speed>\n          </gpxtpx:TrackPointExtension>\n        </extensions>`
          : '';

      return `      <trkpt lat="${pt.latitude}" lon="${pt.longitude}">${eleXml}
        <time>${timeIso}</time>${speedExtXml}
      </trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RunWar Fitness App - https://runwar.app"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"
  xmlns:gpxx="http://www.garmin.com/xmlschemas/GpxExtensions/v3"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd http://www.garmin.com/xmlschemas/TrackPointExtension/v1 http://www.garmin.com/xmlschemas/TrackPointExtensionv1.xsd">
  <metadata>
    <name>${escapeXml(name)}</name>
    <time>${dateStr}</time>
  </metadata>
  <trk>
    <name>${escapeXml(name)}</name>
    <type>${workout.type.toUpperCase()}</type>
    <trkseg>
${trackPointsXml}
    </trkseg>
  </trk>
</gpx>`;
}

/**
 * Generate Garmin Training Center XML (TCX) format
 * Supported by Garmin Connect, Strava, Polar Flow, TrainingPeaks.
 */
export function generateTCX(workout: Workout): string {
  const dateStr = workout.started_at || new Date().toISOString();
  const sport = workout.type === 'run' ? 'Running' : workout.type === 'walk' ? 'Walking' : 'Running';

  const trackpointsXml = (workout.route_coordinates || [])
    .map((pt) => {
      const timeIso = new Date(pt.timestamp).toISOString();
      const altXml = pt.altitude != null ? `\n            <AltitudeMeters>${Number(pt.altitude).toFixed(1)}</AltitudeMeters>` : '';
      return `          <Trackpoint>
            <Time>${timeIso}</Time>
            <Position>
              <LatitudeDegrees>${pt.latitude}</LatitudeDegrees>
              <LongitudeDegrees>${pt.longitude}</LongitudeDegrees>
            </Position>${altXml}
          </Trackpoint>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">
  <Activities>
    <Activity Sport="${sport}">
      <Id>${dateStr}</Id>
      <Lap StartTime="${dateStr}">
        <TotalTimeSeconds>${workout.duration_seconds}</TotalTimeSeconds>
        <DistanceMeters>${workout.distance_meters}</DistanceMeters>
        <MaximumSpeed>${workout.max_speed ? (workout.max_speed / 3.6).toFixed(2) : '0.00'}</MaximumSpeed>
        <Calories>${workout.calories}</Calories>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>
${trackpointsXml}
        </Track>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;
}

/**
 * Generate CSV export for a list of workouts
 */
export function generateWorkoutsCSV(workouts: Workout[]): string {
  const headers = [
    'Workout ID',
    'Date',
    'Type',
    'Title',
    'Distance (km)',
    'Duration (MM:SS)',
    'Duration (seconds)',
    'Average Pace (min/km)',
    'Average Speed (km/h)',
    'Max Speed (km/h)',
    'Calories (kcal)',
    'Elevation Gain (m)',
    'Elevation Loss (m)',
    'Notes',
  ];

  const rows = workouts.map((w) => [
    w.id,
    w.started_at,
    w.type,
    `"${(w.title || '').replace(/"/g, '""')}"`,
    (w.distance_meters / 1000).toFixed(2),
    formatDuration(w.duration_seconds),
    w.duration_seconds,
    formatPace(w.average_pace),
    w.average_speed.toFixed(1),
    (w.max_speed || 0).toFixed(1),
    w.calories,
    w.elevation_gain || 0,
    w.elevation_loss || 0,
    `"${(w.notes || '').replace(/"/g, '""')}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

/**
 * Download a file in the browser
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}
