import { CoursePoint, CourseRoute, CourseWaypoint } from '../types';
import { calculateHaversineDistance } from '../utils/calculations';

/**
 * Robust GPX 1.0/1.1 and TCX parser converting XML track files into CourseRoute structures
 */
export class GPXParser {
  /**
   * Parse a GPX XML string into a CourseRoute
   */
  public static parseGPX(gpxContent: string, fileName: string = 'Imported Route'): CourseRoute {
    if (!gpxContent || typeof gpxContent !== 'string') {
      throw new Error('Invalid or empty GPX file content.');
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(gpxContent, 'application/xml');

    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      throw new Error('Failed to parse XML: ' + (parserError.textContent?.slice(0, 100) || 'Malformed XML'));
    }

    // 1. Extract Route / Course Name
    let courseName = '';
    const trkName = doc.querySelector('trk > name');
    const metaName = doc.querySelector('metadata > name');
    const rteName = doc.querySelector('rte > name');

    if (trkName?.textContent?.trim()) {
      courseName = trkName.textContent.trim();
    } else if (metaName?.textContent?.trim()) {
      courseName = metaName.textContent.trim();
    } else if (rteName?.textContent?.trim()) {
      courseName = rteName.textContent.trim();
    } else {
      courseName = fileName.replace(/\.(gpx|xml|tcx)$/i, '').replace(/[_-]/g, ' ') || 'GPX Course';
    }

    // 2. Extract Description if available
    const descEl = doc.querySelector('trk > desc') || doc.querySelector('metadata > desc');
    const description = descEl?.textContent?.trim() || undefined;

    // 3. Extract Track Points (<trkpt> or fallback <rtept>)
    let ptElements = Array.from(doc.querySelectorAll('trkpt'));
    if (ptElements.length === 0) {
      ptElements = Array.from(doc.querySelectorAll('rtept'));
    }

    if (ptElements.length < 2) {
      throw new Error('GPX file does not contain sufficient track coordinates (minimum 2 points required).');
    }

    const points: CoursePoint[] = [];
    let totalDist = 0;
    let elevationGain = 0;
    let elevationLoss = 0;
    let prevEle: number | null = null;

    for (let i = 0; i < ptElements.length; i++) {
      const el = ptElements[i];
      const latStr = el.getAttribute('lat');
      const lonStr = el.getAttribute('lon');

      if (!latStr || !lonStr) continue;

      const lat = parseFloat(latStr);
      const lon = parseFloat(lonStr);

      if (isNaN(lat) || isNaN(lon)) continue;

      const eleEl = el.querySelector('ele');
      let ele: number | null = null;
      if (eleEl?.textContent) {
        const parsedEle = parseFloat(eleEl.textContent);
        if (!isNaN(parsedEle)) ele = Math.round(parsedEle * 10) / 10;
      }

      if (points.length > 0) {
        const prevPt = points[points.length - 1];
        const segDist = calculateHaversineDistance(prevPt.latitude, prevPt.longitude, lat, lon);
        
        // Filter out extreme GPS teleport spikes (e.g. > 50km jump in single point)
        if (segDist > 0.5 && segDist < 25000) {
          totalDist += segDist;

          // Compute elevation delta
          if (ele !== null && prevEle !== null) {
            const eleDiff = ele - prevEle;
            // Only count if diff > 0.8m to prevent noisy sensor fluctuations
            if (eleDiff > 0.8) {
              elevationGain += eleDiff;
            } else if (eleDiff < -0.8) {
              elevationLoss += Math.abs(eleDiff);
            }
          }
        }
      }

      if (ele !== null) {
        prevEle = ele;
      }

      points.push({
        latitude: lat,
        longitude: lon,
        altitude: ele,
        distanceFromStartMeters: Math.round(totalDist),
      });
    }

    if (points.length < 2) {
      throw new Error('Could not extract valid GPS coordinates from the GPX track.');
    }

    // 4. Extract Waypoints (<wpt>)
    const wptElements = Array.from(doc.querySelectorAll('wpt'));
    const waypoints: CourseWaypoint[] = [];

    for (const wpt of wptElements) {
      const latStr = wpt.getAttribute('lat');
      const lonStr = wpt.getAttribute('lon');
      if (!latStr || !lonStr) continue;

      const lat = parseFloat(latStr);
      const lon = parseFloat(lonStr);
      if (isNaN(lat) || isNaN(lon)) continue;

      const name = wpt.querySelector('name')?.textContent?.trim() || 'Waypoint';
      const desc = wpt.querySelector('desc')?.textContent?.trim();
      const type = wpt.querySelector('type')?.textContent?.trim() || wpt.querySelector('sym')?.textContent?.trim();

      waypoints.push({
        name,
        latitude: lat,
        longitude: lon,
        type,
        description: desc,
      });
    }

    const courseId = 'course_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    return {
      id: courseId,
      name: courseName,
      description,
      totalDistanceMeters: Math.round(totalDist),
      elevationGainMeters: Math.round(elevationGain),
      elevationLossMeters: Math.round(elevationLoss),
      points,
      waypoints: waypoints.length > 0 ? waypoints : undefined,
      createdAt: new Date().toISOString(),
      source: 'imported_gpx',
      originalFileName: fileName,
    };
  }

  /**
   * Parse a Garmin Training Center XML (TCX) string into a CourseRoute
   */
  public static parseTCX(tcxContent: string, fileName: string = 'Imported TCX Course'): CourseRoute {
    if (!tcxContent || typeof tcxContent !== 'string') {
      throw new Error('Invalid or empty TCX file content.');
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(tcxContent, 'application/xml');

    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      throw new Error('Failed to parse TCX XML: ' + (parserError.textContent?.slice(0, 100) || 'Malformed TCX'));
    }

    let courseName = '';
    const nameEl = doc.querySelector('Course > Name') || doc.querySelector('Activity > Id');
    if (nameEl?.textContent?.trim()) {
      courseName = nameEl.textContent.trim();
    } else {
      courseName = fileName.replace(/\.(tcx|xml)$/i, '').replace(/[_-]/g, ' ') || 'TCX Course';
    }

    const trackpointEls = Array.from(doc.querySelectorAll('Trackpoint'));
    if (trackpointEls.length < 2) {
      throw new Error('TCX file contains insufficient trackpoints.');
    }

    const points: CoursePoint[] = [];
    let totalDist = 0;
    let elevationGain = 0;
    let elevationLoss = 0;
    let prevEle: number | null = null;

    for (const el of trackpointEls) {
      const latEl = el.querySelector('Position > LatitudeDegrees');
      const lonEl = el.querySelector('Position > LongitudeDegrees');
      if (!latEl || !lonEl) continue;

      const lat = parseFloat(latEl.textContent || '');
      const lon = parseFloat(lonEl.textContent || '');
      if (isNaN(lat) || isNaN(lon)) continue;

      const altEl = el.querySelector('AltitudeMeters');
      let ele: number | null = null;
      if (altEl?.textContent) {
        const parsed = parseFloat(altEl.textContent);
        if (!isNaN(parsed)) ele = parsed;
      }

      if (points.length > 0) {
        const prevPt = points[points.length - 1];
        const segDist = calculateHaversineDistance(prevPt.latitude, prevPt.longitude, lat, lon);
        if (segDist > 0.5 && segDist < 25000) {
          totalDist += segDist;

          if (ele !== null && prevEle !== null) {
            const diff = ele - prevEle;
            if (diff > 0.8) elevationGain += diff;
            else if (diff < -0.8) elevationLoss += Math.abs(diff);
          }
        }
      }

      if (ele !== null) prevEle = ele;

      points.push({
        latitude: lat,
        longitude: lon,
        altitude: ele,
        distanceFromStartMeters: Math.round(totalDist),
      });
    }

    if (points.length < 2) {
      throw new Error('No valid trackpoints found in the TCX file.');
    }

    return {
      id: 'course_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      name: courseName,
      totalDistanceMeters: Math.round(totalDist),
      elevationGainMeters: Math.round(elevationGain),
      elevationLossMeters: Math.round(elevationLoss),
      points,
      createdAt: new Date().toISOString(),
      source: 'imported_gpx',
      originalFileName: fileName,
    };
  }

  /**
   * Auto-detect file format and parse
   */
  public static async parseFile(file: File): Promise<CourseRoute> {
    const text = await file.text();
    const isTcx = file.name.toLowerCase().endsWith('.tcx') || text.includes('<TrainingCenterDatabase');
    if (isTcx) {
      return this.parseTCX(text, file.name);
    }
    return this.parseGPX(text, file.name);
  }
}
