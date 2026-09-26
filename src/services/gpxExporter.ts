/**
 * GPX Exporter Service for RunWar
 * Generates standard GPX XML files from workout data for export to Strava, Garmin, Nike Run Club, etc.
 */

import { Workout, GPSCoordinate } from '../types';

export const gpxExporter = {
  /**
   * Generates a standard GPX 1.1 XML string from a Workout object
   */
  generateGPX(workout: Workout): string {
    const route: GPSCoordinate[] = workout.route_coordinates || [];
    const startTimeIso = workout.started_at ? new Date(workout.started_at).toISOString() : new Date().toISOString();
    const workoutTitle = workout.title || `${workout.type.toUpperCase()} - RunWar`;

    let gpxXml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RunWar Fitness Platform - https://runwar.app" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(workoutTitle)}</name>
    <time>${startTimeIso}</time>
    <desc>Recorded with RunWar Web App. Total Distance: ${((workout.distance_meters || 0) / 1000).toFixed(2)} km, Duration: ${Math.floor((workout.duration_seconds || 0) / 60)}m ${(workout.duration_seconds || 0) % 60}s</desc>
  </metadata>
  <trk>
    <name>${escapeXml(workoutTitle)}</name>
    <type>${workout.type.toUpperCase()}</type>
    <trkseg>
`;

    if (route.length > 0) {
      let cumulativeTimeMs = workout.started_at ? new Date(workout.started_at).getTime() : Date.now();
      route.forEach((pt: GPSCoordinate, idx: number) => {
        const timeStr = pt.timestamp 
          ? new Date(pt.timestamp).toISOString() 
          : new Date(cumulativeTimeMs + idx * 3000).toISOString();

        const eleTag = pt.altitude !== undefined && pt.altitude !== null ? `\n        <ele>${pt.altitude.toFixed(1)}</ele>` : '';
        gpxXml += `      <trkpt lat="${pt.latitude}" lon="${pt.longitude}">${eleTag}
        <time>${timeStr}</time>
      </trkpt>\n`;
      });
    }

    gpxXml += `    </trkseg>
  </trk>
</gpx>`;

    return gpxXml;
  },

  /**
   * Triggers a browser download of the GPX file for the user
   */
  downloadGPX(workout: Workout) {
    const gpxString = this.generateGPX(workout);
    const blob = new Blob([gpxString], { type: 'application/gpx+xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const dateStr = workout.started_at ? new Date(workout.started_at).toISOString().split('T')[0] : 'workout';
    const safeTitle = (workout.title || 'workout').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `runwar_${dateStr}_${safeTitle}.gpx`;

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
