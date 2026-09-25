import { CourseNavProgress, CoursePoint, CourseRoute, GPSCoordinate, Workout } from '../types';
import { calculateHaversineDistance } from '../utils/calculations';
import { audioCoach } from './audioCoach';
import { soundEffects } from './soundEffects';

const SAVED_COURSES_KEY = 'runwar_saved_courses';
const ACTIVE_COURSE_KEY = 'runwar_active_course';
const OFF_COURSE_THRESHOLD_METERS = 40; // 40 meters drift triggers off-course alert
const ALERT_COOLDOWN_MS = 35000; // 35 seconds between repetitive off-course audio warnings

// Pre-packaged curated courses for quick demonstration, goal tracking, and testing (15 diverse routes)
const PRESET_COURSES: CourseRoute[] = [
  {
    id: 'preset_downtown_mile_1_6k',
    name: 'Downtown Metro Mile 1.6K',
    description: 'Flat, fast urban 1-mile stretch past architectural landmarks and wide sidewalks. Great for sprint benchmarking.',
    totalDistanceMeters: 1609,
    elevationGainMeters: 6,
    elevationLossMeters: 6,
    createdAt: '2026-01-01T00:00:00.000Z',
    source: 'preset',
    points: [
      { latitude: 37.7891, longitude: -122.4012, altitude: 8, distanceFromStartMeters: 0 },
      { latitude: 37.7915, longitude: -122.3985, altitude: 9, distanceFromStartMeters: 400 },
      { latitude: 37.7942, longitude: -122.3951, altitude: 11, distanceFromStartMeters: 805 },
      { latitude: 37.7968, longitude: -122.3921, altitude: 10, distanceFromStartMeters: 1200 },
      { latitude: 37.7995, longitude: -122.3892, altitude: 8, distanceFromStartMeters: 1609 },
    ],
  },
  {
    id: 'preset_olympic_perimeter_1_2k',
    name: 'Olympic Track Perimeter 1.2K',
    description: 'High-cadence perimeter loop ideal for stride cadence drills, sprint reps, and HIIT intervals.',
    totalDistanceMeters: 1200,
    elevationGainMeters: 4,
    elevationLossMeters: 4,
    createdAt: '2026-01-01T00:00:00.000Z',
    source: 'preset',
    points: [
      { latitude: 37.7651, longitude: -122.4182, altitude: 15, distanceFromStartMeters: 0 },
      { latitude: 37.7668, longitude: -122.4165, altitude: 16, distanceFromStartMeters: 300 },
      { latitude: 37.7652, longitude: -122.4141, altitude: 15, distanceFromStartMeters: 600 },
      { latitude: 37.7635, longitude: -122.4158, altitude: 14, distanceFromStartMeters: 900 },
      { latitude: 37.7651, longitude: -122.4182, altitude: 15, distanceFromStartMeters: 1200 },
    ],
  },
  {
    id: 'preset_sunrise_park_2k',
    name: 'Sunrise Park Loop 2K',
    description: 'Smooth park circuit through manicured gardens, ideal for warmups or easy recovery jogs.',
    totalDistanceMeters: 2000,
    elevationGainMeters: 10,
    elevationLossMeters: 10,
    createdAt: '2026-01-01T00:00:00.000Z',
    source: 'preset',
    points: [
      { latitude: 37.7698, longitude: -122.4468, altitude: 32, distanceFromStartMeters: 0 },
      { latitude: 37.7719, longitude: -122.4435, altitude: 35, distanceFromStartMeters: 500 },
      { latitude: 37.7738, longitude: -122.4402, altitude: 38, distanceFromStartMeters: 1000 },
      { latitude: 37.7715, longitude: -122.4438, altitude: 34, distanceFromStartMeters: 1500 },
      { latitude: 37.7698, longitude: -122.4468, altitude: 32, distanceFromStartMeters: 2000 },
    ],
  },
  {
    id: 'preset_greenway_tempo_3k',
    name: 'Riverside Greenway 3.2K',
    description: 'Fast-paced, dedicated tree-lined pedestrian trail ideal for tempo efforts.',
    totalDistanceMeters: 3200,
    elevationGainMeters: 15,
    elevationLossMeters: 15,
    createdAt: '2026-01-01T00:00:00.000Z',
    source: 'preset',
    points: [
      { latitude: 37.7682, longitude: -122.4285, altitude: 24, distanceFromStartMeters: 0 },
      { latitude: 37.7705, longitude: -122.4258, altitude: 26, distanceFromStartMeters: 380 },
      { latitude: 37.7738, longitude: -122.4221, altitude: 28, distanceFromStartMeters: 920 },
      { latitude: 37.7772, longitude: -122.4184, altitude: 31, distanceFromStartMeters: 1500 },
      { latitude: 37.7808, longitude: -122.4149, altitude: 30, distanceFromStartMeters: 2110 },
      { latitude: 37.7842, longitude: -122.4112, altitude: 27, distanceFromStartMeters: 2700 },
      { latitude: 37.7871, longitude: -122.4081, altitude: 25, distanceFromStartMeters: 3200 },
    ],
  },
  {
    id: 'preset_midnight_lantern_3_5k',
    name: 'Midtown Lantern Loop 3.5K',
    description: 'Well-illuminated evening circuit featuring smooth plazas and illuminated public fountains.',
    totalDistanceMeters: 3500,
    elevationGainMeters: 18,
    elevationLossMeters: 18,
    createdAt: '2026-01-01T00:00:00.000Z',
    source: 'preset',
    points: [
      { latitude: 37.7831, longitude: -122.4085, altitude: 22, distanceFromStartMeters: 0 },
      { latitude: 37.7858, longitude: -122.4052, altitude: 24, distanceFromStartMeters: 700 },
      { latitude: 37.7889, longitude: -122.4019, altitude: 28, distanceFromStartMeters: 1400 },
      { latitude: 37.7865, longitude: -122.4042, altitude: 25, distanceFromStartMeters: 2200 },
      { latitude: 37.7842, longitude: -122.4069, altitude: 23, distanceFromStartMeters: 2900 },
      { latitude: 37.7831, longitude: -122.4085, altitude: 22, distanceFromStartMeters: 3500 },
    ],
  },
  {
    id: 'preset_lakefront_promenade_4k',
    name: 'Lakefront Promenade 4K',
    description: 'Wide open waterfront pavement with gentle breezes, zero traffic intersections, and continuous straightaways.',
    totalDistanceMeters: 4000,
    elevationGainMeters: 12,
    elevationLossMeters: 12,
    createdAt: '2026-01-01T00:00:00.000Z',
    source: 'preset',
    points: [
      { latitude: 37.7952, longitude: -122.3935, altitude: 6, distanceFromStartMeters: 0 },
      { latitude: 37.7981, longitude: -122.3908, altitude: 6, distanceFromStartMeters: 800 },
      { latitude: 37.8015, longitude: -122.3882, altitude: 7, distanceFromStartMeters: 1600 },
      { latitude: 37.8048, longitude: -122.3855, altitude: 6, distanceFromStartMeters: 2400 },
      { latitude: 37.8015, longitude: -122.3882, altitude: 7, distanceFromStartMeters: 3200 },
      { latitude: 37.7952, longitude: -122.3935, altitude: 6, distanceFromStartMeters: 4000 },
    ],
  },
  {
    id: 'preset_coastal_loop_5k',
    name: 'Oceanview Marina 5K',
    description: 'Breezy coastal loop with gentle flat terrain and scenic panoramic water views.',
    totalDistanceMeters: 5020,
    elevationGainMeters: 28,
    elevationLossMeters: 28,
    createdAt: '2026-01-01T00:00:00.000Z',
    source: 'preset',
    points: [
      { latitude: 37.7749, longitude: -122.4194, altitude: 12, distanceFromStartMeters: 0 },
      { latitude: 37.7765, longitude: -122.4172, altitude: 14, distanceFromStartMeters: 260 },
      { latitude: 37.7788, longitude: -122.4145, altitude: 18, distanceFromStartMeters: 620 },
      { latitude: 37.7812, longitude: -122.4118, altitude: 22, distanceFromStartMeters: 1040 },
      { latitude: 37.7845, longitude: -122.4082, altitude: 25, distanceFromStartMeters: 1580 },
      { latitude: 37.7876, longitude: -122.4051, altitude: 21, distanceFromStartMeters: 2100 },
      { latitude: 37.7895, longitude: -122.4019, altitude: 16, distanceFromStartMeters: 2550 },
      { latitude: 37.7871, longitude: -122.4042, altitude: 18, distanceFromStartMeters: 3120 },
      { latitude: 37.7834, longitude: -122.4095, altitude: 22, distanceFromStartMeters: 3750 },
      { latitude: 37.7798, longitude: -122.4138, altitude: 19, distanceFromStartMeters: 4320 },
      { latitude: 37.7761, longitude: -122.4179, altitude: 15, distanceFromStartMeters: 4790 },
      { latitude: 37.7749, longitude: -122.4194, altitude: 12, distanceFromStartMeters: 5020 },
    ],
  },
  {
    id: 'preset_sunset_blvd_5k',
    name: 'Sunset Boulevard 5K Classic',
    description: 'Popular avenue course with generous lighting, wide lanes, and smooth tarmac under the twilight sky.',
    totalDistanceMeters: 5000,
    elevationGainMeters: 22,
    elevationLossMeters: 22,
    createdAt: '2026-01-01T00:00:00.000Z',
    source: 'preset',
    points: [
      { latitude: 37.7612, longitude: -122.4354, altitude: 48, distanceFromStartMeters: 0 },
      { latitude: 37.7638, longitude: -122.4318, altitude: 51, distanceFromStartMeters: 750 },
      { latitude: 37.7669, longitude: -122.4275, altitude: 55, distanceFromStartMeters: 1600 },
      { latitude: 37.7702, longitude: -122.4231, altitude: 58, distanceFromStartMeters: 2500 },
      { latitude: 37.7669, longitude: -122.4275, altitude: 55, distanceFromStartMeters: 3400 },
      { latitude: 37.7638, longitude: -122.4318, altitude: 51, distanceFromStartMeters: 4250 },
      { latitude: 37.7612, longitude: -122.4354, altitude: 48, distanceFromStartMeters: 5000 },
    ],
  },
  {
    id: 'preset_emerald_forest_6k',
    name: 'Emerald Forest Trail 6.5K',
    description: 'Shaded dirt path with soft ground cushioning, gentle curves, and winding nature switchbacks.',
    totalDistanceMeters: 6500,
    elevationGainMeters: 75,
    elevationLossMeters: 75,
    createdAt: '2026-01-01T00:00:00.000Z',
    source: 'preset',
    points: [
      { latitude: 37.7712, longitude: -122.4568, altitude: 62, distanceFromStartMeters: 0 },
      { latitude: 37.7745, longitude: -122.4529, altitude: 78, distanceFromStartMeters: 1100 },
      { latitude: 37.7782, longitude: -122.4491, altitude: 95, distanceFromStartMeters: 2200 },
      { latitude: 37.7818, longitude: -122.4452, altitude: 110, distanceFromStartMeters: 3250 },
      { latitude: 37.7782, longitude: -122.4491, altitude: 95, distanceFromStartMeters: 4300 },
      { latitude: 37.7745, longitude: -122.4529, altitude: 78, distanceFromStartMeters: 5400 },
      { latitude: 37.7712, longitude: -122.4568, altitude: 62, distanceFromStartMeters: 6500 },
    ],
  },
  {
    id: 'preset_canyon_creek_7_5k',
    name: 'Canyon Creek Out & Back 7.5K',
    description: 'Gradual canyon gradient following a babbling stream bed with steady aerobic resistance on the ascent.',
    totalDistanceMeters: 7500,
    elevationGainMeters: 115,
    elevationLossMeters: 115,
    createdAt: '2026-01-01T00:00:00.000Z',
    source: 'preset',
    points: [
      { latitude: 37.7592, longitude: -122.4485, altitude: 55, distanceFromStartMeters: 0 },
      { latitude: 37.7628, longitude: -122.4442, altitude: 78, distanceFromStartMeters: 1250 },
      { latitude: 37.7669, longitude: -122.4398, altitude: 108, distanceFromStartMeters: 2500 },
      { latitude: 37.7712, longitude: -122.4351, altitude: 142, distanceFromStartMeters: 3750 },
      { latitude: 37.7669, longitude: -122.4398, altitude: 108, distanceFromStartMeters: 5000 },
      { latitude: 37.7628, longitude: -122.4442, altitude: 78, distanceFromStartMeters: 6250 },
      { latitude: 37.7592, longitude: -122.4485, altitude: 55, distanceFromStartMeters: 7500 },
    ],
  },
  {
    id: 'preset_summit_trail_8k',
    name: 'Pine Hill Vista 8K Challenge',
    description: 'Undulating woodland course with moderate hill climbs to test aerobic threshold.',
    totalDistanceMeters: 8150,
    elevationGainMeters: 142,
    elevationLossMeters: 140,
    createdAt: '2026-01-01T00:00:00.000Z',
    source: 'preset',
    points: [
      { latitude: 37.7551, longitude: -122.4412, altitude: 45, distanceFromStartMeters: 0 },
      { latitude: 37.7582, longitude: -122.4385, altitude: 68, distanceFromStartMeters: 840 },
      { latitude: 37.7619, longitude: -122.4351, altitude: 94, distanceFromStartMeters: 1720 },
      { latitude: 37.7658, longitude: -122.4312, altitude: 125, distanceFromStartMeters: 2680 },
      { latitude: 37.7692, longitude: -122.4278, altitude: 152, distanceFromStartMeters: 3600 },
      { latitude: 37.7725, longitude: -122.4241, altitude: 165, distanceFromStartMeters: 4520 },
      { latitude: 37.7691, longitude: -122.4279, altitude: 140, distanceFromStartMeters: 5490 },
      { latitude: 37.7645, longitude: -122.4328, altitude: 108, distanceFromStartMeters: 6410 },
      { latitude: 37.7598, longitude: -122.4372, altitude: 72, distanceFromStartMeters: 7300 },
      { latitude: 37.7551, longitude: -122.4412, altitude: 45, distanceFromStartMeters: 8150 },
    ],
  },
  {
    id: 'preset_harbor_bridge_9k',
    name: 'Harbor Bridge & Pier 9K',
    description: 'Cross-bay adventure with an iconic pedestrian bridge ascent and brisk maritime air throughout.',
    totalDistanceMeters: 9000,
    elevationGainMeters: 85,
    elevationLossMeters: 85,
    createdAt: '2026-01-01T00:00:00.000Z',
    source: 'preset',
    points: [
      { latitude: 37.7912, longitude: -122.3921, altitude: 10, distanceFromStartMeters: 0 },
      { latitude: 37.7955, longitude: -122.3875, altitude: 28, distanceFromStartMeters: 1500 },
      { latitude: 37.8002, longitude: -122.3821, altitude: 55, distanceFromStartMeters: 3000 },
      { latitude: 37.8049, longitude: -122.3768, altitude: 62, distanceFromStartMeters: 4500 },
      { latitude: 37.8002, longitude: -122.3821, altitude: 55, distanceFromStartMeters: 6000 },
      { latitude: 37.7955, longitude: -122.3875, altitude: 28, distanceFromStartMeters: 7500 },
      { latitude: 37.7912, longitude: -122.3921, altitude: 10, distanceFromStartMeters: 9000 },
    ],
  },
  {
    id: 'preset_golden_ridge_10k',
    name: 'Golden Ridge 10K Endurance',
    description: 'Premier 10-kilometer milestone circuit featuring scenic lookouts and rolling aerobic topography.',
    totalDistanceMeters: 10000,
    elevationGainMeters: 120,
    elevationLossMeters: 120,
    createdAt: '2026-01-01T00:00:00.000Z',
    source: 'preset',
    points: [
      { latitude: 37.7618, longitude: -122.4495, altitude: 52, distanceFromStartMeters: 0 },
      { latitude: 37.7655, longitude: -122.4452, altitude: 75, distanceFromStartMeters: 1500 },
      { latitude: 37.7702, longitude: -122.4398, altitude: 98, distanceFromStartMeters: 3000 },
      { latitude: 37.7758, longitude: -122.4345, altitude: 125, distanceFromStartMeters: 5000 },
      { latitude: 37.7715, longitude: -122.4392, altitude: 102, distanceFromStartMeters: 6800 },
      { latitude: 37.7668, longitude: -122.4445, altitude: 80, distanceFromStartMeters: 8400 },
      { latitude: 37.7618, longitude: -122.4495, altitude: 52, distanceFromStartMeters: 10000 },
    ],
  },
  {
    id: 'preset_foothill_overlook_12k',
    name: 'Foothill Overlook 12K',
    description: 'Substantial aerobic endurance route connecting two mountain foothill spurs with sweeping valley views.',
    totalDistanceMeters: 12000,
    elevationGainMeters: 185,
    elevationLossMeters: 185,
    createdAt: '2026-01-01T00:00:00.000Z',
    source: 'preset',
    points: [
      { latitude: 37.7482, longitude: -122.4552, altitude: 65, distanceFromStartMeters: 0 },
      { latitude: 37.7538, longitude: -122.4498, altitude: 98, distanceFromStartMeters: 2000 },
      { latitude: 37.7599, longitude: -122.4435, altitude: 142, distanceFromStartMeters: 4000 },
      { latitude: 37.7668, longitude: -122.4368, altitude: 195, distanceFromStartMeters: 6000 },
      { latitude: 37.7608, longitude: -122.4429, altitude: 150, distanceFromStartMeters: 8000 },
      { latitude: 37.7545, longitude: -122.4491, altitude: 105, distanceFromStartMeters: 10000 },
      { latitude: 37.7482, longitude: -122.4552, altitude: 65, distanceFromStartMeters: 12000 },
    ],
  },
  {
    id: 'preset_grand_valley_half_marathon_21k',
    name: 'Grand Valley Half-Marathon 21.1K',
    description: 'Full 13.1-mile official half-marathon course spanning valley trails, riverside paths, and scenic bridges.',
    totalDistanceMeters: 21097,
    elevationGainMeters: 240,
    elevationLossMeters: 240,
    createdAt: '2026-01-01T00:00:00.000Z',
    source: 'preset',
    points: [
      { latitude: 37.7425, longitude: -122.4612, altitude: 55, distanceFromStartMeters: 0 },
      { latitude: 37.7495, longitude: -122.4538, altitude: 82, distanceFromStartMeters: 3000 },
      { latitude: 37.7578, longitude: -122.4455, altitude: 120, distanceFromStartMeters: 6500 },
      { latitude: 37.7675, longitude: -122.4352, altitude: 175, distanceFromStartMeters: 10500 },
      { latitude: 37.7768, longitude: -122.4248, altitude: 215, distanceFromStartMeters: 14000 },
      { latitude: 37.7682, longitude: -122.4345, altitude: 160, distanceFromStartMeters: 17500 },
      { latitude: 37.7425, longitude: -122.4612, altitude: 55, distanceFromStartMeters: 21097 },
    ],
  },
];

type CourseListener = (course: CourseRoute | null) => void;

class CourseService {
  private activeCourse: CourseRoute | null = null;
  private listeners: CourseListener[] = [];

  // Audio alert rate-limiting & state trackers
  private lastOffCourseAlertTime: number = 0;
  private wasOffCourse: boolean = false;
  private announcedHalfway: boolean = false;
  private announcedFinalKm: boolean = false;
  private announcedFinished: boolean = false;

  constructor() {
    this.loadActiveCourse();
  }

  private loadActiveCourse() {
    try {
      const raw = localStorage.getItem(ACTIVE_COURSE_KEY);
      if (raw) {
        this.activeCourse = JSON.parse(raw);
      }
    } catch {
      this.activeCourse = null;
    }
  }

  public subscribe(listener: CourseListener): () => void {
    this.listeners.push(listener);
    listener(this.activeCourse);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l(this.activeCourse));
  }

  public getActiveCourse(): CourseRoute | null {
    return this.activeCourse;
  }

  public setActiveCourse(course: CourseRoute | null) {
    this.activeCourse = course;
    this.resetNavigationAnnouncements();
    try {
      if (course) {
        localStorage.setItem(ACTIVE_COURSE_KEY, JSON.stringify(course));
      } else {
        localStorage.removeItem(ACTIVE_COURSE_KEY);
      }
    } catch {}
    this.notify();
  }

  public resetNavigationAnnouncements() {
    this.lastOffCourseAlertTime = 0;
    this.wasOffCourse = false;
    this.announcedHalfway = false;
    this.announcedFinalKm = false;
    this.announcedFinished = false;
  }

  /**
   * Get all user saved courses from cache combined with presets
   */
  public getSavedCourses(): CourseRoute[] {
    let saved: CourseRoute[] = [];
    try {
      const raw = localStorage.getItem(SAVED_COURSES_KEY);
      if (raw) {
        saved = JSON.parse(raw);
      }
    } catch {}

    const userSaved = saved.filter((c) => c.source !== 'preset');
    return [...userSaved, ...PRESET_COURSES];
  }

  /**
   * Persist a new course to local storage
   */
  public saveCourse(course: CourseRoute): CourseRoute {
    const list = this.getSavedCourses().filter((c) => c.id !== course.id && c.source !== 'preset');
    list.unshift(course);
    try {
      localStorage.setItem(SAVED_COURSES_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to persist course to localStorage:', e);
    }
    return course;
  }

  /**
   * Delete a course by ID
   */
  public deleteCourse(courseId: string) {
    let list = this.getSavedCourses().filter((c) => c.id !== courseId && c.source !== 'preset');
    try {
      localStorage.setItem(SAVED_COURSES_KEY, JSON.stringify(list));
    } catch {}
    if (this.activeCourse?.id === courseId) {
      this.setActiveCourse(null);
    }
  }

  /**
   * Convert an existing completed Workout into a reusable CourseRoute
   */
  public createCourseFromWorkout(workout: Workout, customName?: string): CourseRoute {
    if (!workout.route_coordinates || workout.route_coordinates.length < 2) {
      throw new Error('Workout does not contain enough GPS points to form a course.');
    }

    const points: CoursePoint[] = [];
    let cumDist = 0;

    for (let i = 0; i < workout.route_coordinates.length; i++) {
      const pt = workout.route_coordinates[i];
      if (points.length > 0) {
        const prev = points[points.length - 1];
        const seg = calculateHaversineDistance(prev.latitude, prev.longitude, pt.latitude, pt.longitude);
        cumDist += seg;
      }

      points.push({
        latitude: pt.latitude,
        longitude: pt.longitude,
        altitude: pt.altitude,
        distanceFromStartMeters: Math.round(cumDist),
      });
    }

    const courseName =
      customName?.trim() ||
      workout.title ||
      `${workout.type.toUpperCase()} Route (${(workout.distance_meters / 1000).toFixed(1)}km)`;

    const course: CourseRoute = {
      id: 'course_run_' + workout.id,
      name: courseName,
      description: `Course created from ${workout.type} workout on ${new Date(workout.started_at).toLocaleDateString()}`,
      totalDistanceMeters: Math.round(cumDist),
      elevationGainMeters: Math.round(workout.elevation_gain || 0),
      elevationLossMeters: Math.round(workout.elevation_loss || 0),
      points,
      createdAt: new Date().toISOString(),
      source: 'saved_workout',
    };

    return this.saveCourse(course);
  }

  /**
   * Calculate cross-track error and navigation progress for current runner GPS position
   */
  public calculateProgress(
    course: CourseRoute,
    currentCoord: GPSCoordinate,
    distanceRunMeters: number = 0
  ): CourseNavProgress {
    const points = course.points;
    if (points.length === 0) {
      return {
        courseId: course.id,
        courseName: course.name,
        totalDistanceMeters: course.totalDistanceMeters,
        distanceRemainingMeters: course.totalDistanceMeters,
        percentCompleted: 0,
        offCourseDistanceMeters: 0,
        isOffCourse: false,
        closestPointIndex: 0,
        nearestCoursePoint: { latitude: currentCoord.latitude, longitude: currentCoord.longitude, distanceFromStartMeters: 0 },
      };
    }

    // 1. Find the closest point and closest segment to current coordinate
    let minDistance = Infinity;
    let closestIndex = 0;

    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      const dist = calculateHaversineDistance(currentCoord.latitude, currentCoord.longitude, pt.latitude, pt.longitude);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = i;
      }
    }

    // 2. Cross-track refinement between segments
    let offCourseDist = minDistance;
    if (points.length > 1) {
      const startIdx = Math.max(0, closestIndex - 3);
      const endIdx = Math.min(points.length - 1, closestIndex + 3);

      for (let i = startIdx; i < endIdx; i++) {
        const segDist = this.distanceToSegment(currentCoord, points[i], points[i + 1]);
        if (segDist < offCourseDist) {
          offCourseDist = segDist;
        }
      }
    }

    const nearestCoursePoint = points[closestIndex];
    const isOffCourse = offCourseDist > OFF_COURSE_THRESHOLD_METERS;

    // Determine actual progress on the course:
    // When a course is selected and user hasn't run yet, distanceRunMeters is 0.
    // The progress bar remains empty (0%) until the runner starts jogging or running.
    let effectiveProgressMeters = Math.max(0, distanceRunMeters);

    // If runner is genuinely on the course track (within 50m of course route):
    // allow matching along the course waypoints as well, but do not leap forward if runner just started
    if (!isOffCourse && offCourseDist <= 50 && distanceRunMeters > 50) {
      effectiveProgressMeters = Math.max(effectiveProgressMeters, nearestCoursePoint.distanceFromStartMeters);
    }

    const distanceRemainingMeters = Math.max(0, course.totalDistanceMeters - effectiveProgressMeters);
    const percentCompleted = course.totalDistanceMeters > 0
      ? Math.min(100, Math.max(0, Math.round((effectiveProgressMeters / course.totalDistanceMeters) * 100)))
      : 0;

    // 3. Audio Coaching Navigation Alerts (only alert for realistic local deviations when active)
    if (offCourseDist <= 300 && distanceRunMeters > 50) {
      this.handleNavigationVoiceAlerts(isOffCourse, offCourseDist, percentCompleted, distanceRemainingMeters);
    }

    return {
      courseId: course.id,
      courseName: course.name,
      totalDistanceMeters: course.totalDistanceMeters,
      distanceRemainingMeters: Math.round(distanceRemainingMeters),
      percentCompleted,
      offCourseDistanceMeters: Math.round(offCourseDist),
      isOffCourse,
      closestPointIndex: closestIndex,
      nearestCoursePoint,
    };
  }

  /**
   * Intelligent audio voice cues with rate-limiting to prevent repetitive spam
   */
  private handleNavigationVoiceAlerts(
    isOffCourse: boolean,
    offCourseMeters: number,
    percentCompleted: number,
    remainingMeters: number
  ) {
    const now = Date.now();

    // 1. Off-course alert trigger
    if (isOffCourse) {
      if (!this.wasOffCourse || now - this.lastOffCourseAlertTime > ALERT_COOLDOWN_MS) {
        this.lastOffCourseAlertTime = now;
        this.wasOffCourse = true;
        const distRounded = Math.round(offCourseMeters);
        audioCoach.speak(`Off route alert. You are ${distRounded} meters off course.`, { withChime: true });
      }
    } else {
      // 2. Returned on route
      if (this.wasOffCourse && offCourseMeters < 25) {
        this.wasOffCourse = false;
        soundEffects.playResume();
        audioCoach.speak('Back on course.');
      }
    }

    // 3. Halfway milestone
    if (!this.announcedHalfway && percentCompleted >= 50 && percentCompleted < 60) {
      this.announcedHalfway = true;
      audioCoach.speak('Course halfway point reached. Keep pushing!');
    }

    // 4. Final 500m
    if (!this.announcedFinalKm && remainingMeters <= 500 && remainingMeters > 50) {
      this.announcedFinalKm = true;
      audioCoach.speak('Final 500 meters remaining on course. Strong finish!');
    }

    // 5. Course Complete
    if (!this.announcedFinished && percentCompleted >= 98 && remainingMeters < 30) {
      this.announcedFinished = true;
      audioCoach.speak('Course completed! Outstanding pacing!', { withChime: true });
    }
  }

  /**
   * Distance in meters from point P to line segment AB
   */
  private distanceToSegment(p: GPSCoordinate, a: CoursePoint, b: CoursePoint): number {
    const latP = p.latitude;
    const lonP = p.longitude;
    const latA = a.latitude;
    const lonA = a.longitude;
    const latB = b.latitude;
    const lonB = b.longitude;

    const dx = latB - latA;
    const dy = lonB - lonA;

    if (dx === 0 && dy === 0) {
      return calculateHaversineDistance(latP, lonP, latA, lonA);
    }

    // Projection factor t
    const t = Math.max(0, Math.min(1, ((latP - latA) * dx + (lonP - lonA) * dy) / (dx * dx + dy * dy)));
    const projLat = latA + t * dx;
    const projLon = lonA + t * dy;

    return calculateHaversineDistance(latP, lonP, projLat, projLon);
  }
}

export const courseService = new CourseService();
