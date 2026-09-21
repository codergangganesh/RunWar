import { Workout } from '../types';
import { formatDuration, formatPace, formatDistance, formatSpeed } from './formatters';

/**
 * Generate standard GPX XML format for GPS devices and fitness platforms (Strava, Garmin, etc.)
 */
export function generateGPX(workout: Workout): string {
  const dateStr = workout.started_at || new Date().toISOString();
  const name = workout.title || `${workout.type.toUpperCase()} - ${new Date(dateStr).toLocaleDateString()}`;

  const trackPointsXml = workout.route_coordinates
    .map((pt) => {
      const timeIso = new Date(pt.timestamp).toISOString();
      const eleXml = pt.altitude != null ? `\n        <ele>${pt.altitude.toFixed(1)}</ele>` : '';
      return `      <trkpt lat="${pt.latitude}" lon="${pt.longitude}">${eleXml}
        <time>${timeIso}</time>
        ${pt.speed != null ? `<speed>${pt.speed.toFixed(2)}</speed>` : ''}
      </trkpt>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RunWar Fitness App - https://insforge.dev"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
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
      case '\'':
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}
