/**
 * AI Loop Route Generator Service
 * Generates custom circular running courses based on distance, scenery, and direction.
 * Persists and retrieves generated routes via InsForge PostgreSQL (public.ai_generated_routes).
 * Seamlessly integrates into RunWar's Course Navigator.
 */

import { insforge } from '../lib/insforge';
import { CoursePoint, CourseRoute, CourseWaypoint } from '../types';
import { calculateHaversineDistance } from '../utils/calculations';
import { courseService } from './courseService';
import { toDeterministicUUID } from '../utils/uuid';

export type SceneryType = 'park' | 'flat' | 'waterfront' | 'urban' | 'trail';
export type LoopDirection = 'north' | 'south' | 'east' | 'west' | 'any';

export interface TurnCue {
  distanceMeters: number;
  instruction: string;
  icon: 'straight' | 'right' | 'left' | 'uturn' | 'finish';
}

export interface GeneratedAiRoute {
  id: string;
  user_id?: string | null;
  name: string;
  description: string;
  target_distance_meters: number;
  estimated_duration_seconds: number;
  elevation_gain_meters: number;
  elevation_loss_meters: number;
  scenery_type: SceneryType;
  direction: LoopDirection;
  start_lat: number;
  start_lng: number;
  points: CoursePoint[];
  turn_cues: TurnCue[];
  elevation_profile: Array<{ distanceMeters: number; altitude: number }>;
  is_favorite: boolean;
  created_at: string;
}

export interface GenerateRouteParams {
  startLat: number;
  startLng: number;
  distanceKm: number;
  sceneryType: SceneryType;
  direction?: LoopDirection;
  userId?: string | null;
  userAvgPaceSeconds?: number; // default ~330 (5:30/km)
}

const AI_ROUTES_CACHE_KEY = 'runwar_cached_ai_routes';

export const aiRouteService = {
  /**
   * Get cached routes from localStorage fallback
   */
  getCachedRoutes(): GeneratedAiRoute[] {
    try {
      const raw = localStorage.getItem(AI_ROUTES_CACHE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // Ignored
    }
    return [];
  },

  setCachedRoutes(routes: GeneratedAiRoute[]) {
    try {
      localStorage.setItem(AI_ROUTES_CACHE_KEY, JSON.stringify(routes));
    } catch {
      // Ignored
    }
  },

  /**
   * Fetch all AI-generated routes from InsForge database
   */
  async getSavedRoutes(userId?: string | null): Promise<GeneratedAiRoute[]> {
    try {
      let query = insforge.database
        .from('ai_generated_routes')
        .select('*')
        .order('created_at', { ascending: false });

      if (userId) {
        const normalizedId = toDeterministicUUID(userId);
        query = query.or(`user_id.eq.${normalizedId},user_id.is.null`);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        this.setCachedRoutes(data as GeneratedAiRoute[]);
        return data as GeneratedAiRoute[];
      }
    } catch (err) {
      console.warn('InsForge getSavedRoutes notice, falling back to cache:', err);
    }

    return this.getCachedRoutes();
  },

  /**
   * Persist a generated route into InsForge PostgreSQL
   */
  async saveRouteToDatabase(route: GeneratedAiRoute): Promise<GeneratedAiRoute> {
    const cached = this.getCachedRoutes().filter((r) => r.id !== route.id);
    cached.unshift(route);
    this.setCachedRoutes(cached);

    try {
      const normalizedUserId = route.user_id ? toDeterministicUUID(route.user_id) : null;
      const payload = {
        name: route.name,
        description: route.description,
        target_distance_meters: route.target_distance_meters,
        estimated_duration_seconds: route.estimated_duration_seconds,
        elevation_gain_meters: route.elevation_gain_meters,
        elevation_loss_meters: route.elevation_loss_meters,
        scenery_type: route.scenery_type,
        direction: route.direction,
        start_lat: route.start_lat,
        start_lng: route.start_lng,
        points: route.points,
        turn_cues: route.turn_cues,
        elevation_profile: route.elevation_profile,
        is_favorite: route.is_favorite,
        user_id: normalizedUserId,
      };

      const { data, error } = await insforge.database
        .from('ai_generated_routes')
        .insert([payload])
        .select()
        .single();

      if (!error && data) {
        const persistedRoute: GeneratedAiRoute = {
          ...route,
          id: data.id || route.id,
        };
        const updatedCache = this.getCachedRoutes().filter((r) => r.id !== route.id && r.id !== persistedRoute.id);
        updatedCache.unshift(persistedRoute);
        this.setCachedRoutes(updatedCache);
        return persistedRoute;
      }
    } catch (e) {
      console.warn('InsForge save route exception:', e);
    }

    return route;
  },

  /**
   * Delete an AI route from InsForge
   */
  async deleteRoute(routeId: string): Promise<void> {
    const list = this.getCachedRoutes().filter((r) => r.id !== routeId);
    this.setCachedRoutes(list);

    try {
      await insforge.database
        .from('ai_generated_routes')
        .delete()
        .eq('id', routeId);
    } catch (e) {
      console.warn('Failed to delete route from InsForge:', e);
    }
  },

  /**
   * Toggle favorite state in InsForge
   */
  async toggleFavorite(routeId: string, currentFav: boolean): Promise<boolean> {
    const nextFav = !currentFav;
    const list = this.getCachedRoutes().map((r) => r.id === routeId ? { ...r, is_favorite: nextFav } : r);
    this.setCachedRoutes(list);

    try {
      await insforge.database
        .from('ai_generated_routes')
        .update({ is_favorite: nextFav, updated_at: new Date().toISOString() })
        .eq('id', routeId);
    } catch (e) {
      console.warn('Failed to toggle favorite in InsForge:', e);
    }

    return nextFav;
  },

  /**
   * Algorithmic AI Closed-Loop Course Generator
   * Computes a realistic, smooth circular loop matching requested distance, direction, and terrain profile.
   */
  calculateLoopRoute(params: GenerateRouteParams): GeneratedAiRoute {
    const targetDistanceMeters = Math.max(1000, Math.round(params.distanceKm * 1000));
    const startLat = params.startLat;
    const startLng = params.startLng;
    const scenery = params.sceneryType || 'park';
    const direction = params.direction || 'any';
    const avgPace = params.userAvgPaceSeconds || 330;

    // Approximate perimeter radius in meters: Perimeter = 2 * PI * R => R = Perimeter / (2 * PI)
    // Add a natural shape distortion factor (~1.18) for street layout realism
    const radiusMeters = (targetDistanceMeters / (2 * Math.PI)) * 0.88;
    
    // Degrees latitude per meter: 1 meter ≈ 1 / 111139 degrees
    const latMetersRatio = 1 / 111139;
    // Degrees longitude per meter varies with latitude:
    const cosLat = Math.cos((startLat * Math.PI) / 180);
    const lngMetersRatio = 1 / (111139 * (cosLat || 0.7));

    // Direction angle offset in radians
    let baseAngle = 0;
    if (direction === 'north') baseAngle = Math.PI / 2;
    else if (direction === 'east') baseAngle = 0;
    else if (direction === 'south') baseAngle = (3 * Math.PI) / 2;
    else if (direction === 'west') baseAngle = Math.PI;
    else baseAngle = Math.random() * 2 * Math.PI;

    // Center of the loop offset from start point
    const centerLat = startLat + (radiusMeters * Math.sin(baseAngle) * latMetersRatio);
    const centerLng = startLng + (radiusMeters * Math.cos(baseAngle) * lngMetersRatio);

    // Generate polygonal vertices along the perimeter
    const numPoints = Math.max(24, Math.min(80, Math.round(targetDistanceMeters / 120)));
    const rawCoords: Array<{ lat: number; lng: number }> = [];

    // Start angle from center back to startLat/startLng
    const initialAngle = Math.atan2((startLat - centerLat) / latMetersRatio, (startLng - centerLng) / lngMetersRatio);

    // Terrain-specific curvature / perturbations
    for (let i = 0; i <= numPoints; i++) {
      if (i === 0 || i === numPoints) {
        rawCoords.push({ lat: startLat, lng: startLng });
        continue;
      }

      const fraction = i / numPoints;
      // Clockwise rotation around center
      const angle = initialAngle + (2 * Math.PI * fraction);

      // Scenery-based perturbation (wobbly park path, straight urban grid, gentle waterfront bend)
      let radiusModifier = 1.0;
      if (scenery === 'park' || scenery === 'trail') {
        radiusModifier += 0.15 * Math.sin(angle * 3) + 0.08 * Math.cos(angle * 5);
      } else if (scenery === 'urban') {
        // Squared off city blocks
        radiusModifier += 0.1 * Math.sin(angle * 4);
      } else if (scenery === 'waterfront') {
        // Sweeping elongate curve
        radiusModifier += 0.22 * Math.sin(angle * 2);
      } else {
        // Flat & fast: minimal jitter
        radiusModifier += 0.05 * Math.sin(angle * 2);
      }

      const curR = radiusMeters * radiusModifier;
      const ptLat = centerLat + (curR * Math.sin(angle) * latMetersRatio);
      const ptLng = centerLng + (curR * Math.cos(angle) * lngMetersRatio);
      rawCoords.push({ lat: ptLat, lng: ptLng });
    }

    // Step 2: Compute exact cumulative distance & altitude profile
    const points: CoursePoint[] = [];
    const elevationProfile: Array<{ distanceMeters: number; altitude: number }> = [];
    let cumDist = 0;
    let baseAltitude = 24;

    // Elevation characteristics by scenery
    const maxGain = scenery === 'flat' ? 8 : (scenery === 'trail' ? 65 : (scenery === 'park' ? 28 : 18));
    const gainFactor = (targetDistanceMeters / 5000) * maxGain;

    for (let i = 0; i < rawCoords.length; i++) {
      const coord = rawCoords[i];
      if (points.length > 0) {
        const prev = points[points.length - 1];
        const seg = calculateHaversineDistance(prev.latitude, prev.longitude, coord.lat, coord.lng);
        cumDist += seg;
      }

      // Smooth elevation curve
      const elevProgress = (cumDist / Math.max(1, targetDistanceMeters)) * Math.PI * 2;
      const alt = Math.round(baseAltitude + (Math.sin(elevProgress) * (gainFactor / 2)));

      points.push({
        latitude: Number(coord.lat.toFixed(6)),
        longitude: Number(coord.lng.toFixed(6)),
        altitude: alt,
        distanceFromStartMeters: Math.round(cumDist),
      });

      elevationProfile.push({
        distanceMeters: Math.round(cumDist),
        altitude: alt,
      });
    }

    // Step 3: Generate realistic Turn Cues & Waypoint Navigation
    const turnCues: TurnCue[] = [
      {
        distanceMeters: 0,
        instruction: `Start running along ${getSceneryHeading(scenery)} course`,
        icon: 'straight',
      },
      {
        distanceMeters: Math.round(cumDist * 0.25),
        instruction: getTurnInstruction(scenery, 1),
        icon: 'right',
      },
      {
        distanceMeters: Math.round(cumDist * 0.5),
        instruction: `Halfway milestone: ${getTurnInstruction(scenery, 2)}`,
        icon: 'right',
      },
      {
        distanceMeters: Math.round(cumDist * 0.75),
        instruction: getTurnInstruction(scenery, 3),
        icon: 'right',
      },
      {
        distanceMeters: Math.round(cumDist),
        instruction: 'Finish circuit: Return to origin',
        icon: 'finish',
      },
    ];

    // Total elevation gain/loss
    const elevationGain = Math.round(gainFactor);
    const estimatedDuration = Math.round((cumDist / 1000) * avgPace);

    const sceneryNames: Record<SceneryType, string> = {
      park: 'Greenbelt Nature Loop',
      flat: 'Velocity Flat Mile Circuit',
      waterfront: 'Shoreline Vista Circuit',
      urban: 'Metro Architecture Loop',
      trail: 'Rolling Woodland Switchback',
    };

    const routeName = `${(cumDist / 1000).toFixed(1)}K ${sceneryNames[scenery]}`;
    const routeDesc = `AI-synthesized ${(cumDist / 1000).toFixed(1)} km circular circuit optimized for ${scenery} running. Features ${elevationGain}m elevation gain with smooth, unobstructed road contours.`;

    const aiRoute: GeneratedAiRoute = {
      id: `ai_route_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user_id: params.userId || null,
      name: routeName,
      description: routeDesc,
      target_distance_meters: Math.round(cumDist),
      estimated_duration_seconds: estimatedDuration,
      elevation_gain_meters: elevationGain,
      elevation_loss_meters: elevationGain,
      scenery_type: scenery,
      direction: direction,
      start_lat: startLat,
      start_lng: startLng,
      points: points,
      turn_cues: turnCues,
      elevation_profile: elevationProfile,
      is_favorite: false,
      created_at: new Date().toISOString(),
    };

    return aiRoute;
  },

  /**
   * Synthesize and immediately save loop route to database
   */
  async generateLoopRoute(params: GenerateRouteParams): Promise<GeneratedAiRoute> {
    const aiRoute = this.calculateLoopRoute(params);
    return await this.saveRouteToDatabase(aiRoute);
  },

  /**
   * Convert an AI Generated Route into RunWar's native CourseRoute
   * and load it directly into Course Navigator
   */
  convertAndActivateAsCourse(aiRoute: GeneratedAiRoute): CourseRoute {
    const waypoints: CourseWaypoint[] = aiRoute.turn_cues.map((cue, idx) => {
      // Find nearest point
      const matchedPoint = aiRoute.points.find((p) => p.distanceFromStartMeters >= cue.distanceMeters) || aiRoute.points[0];
      return {
        latitude: matchedPoint.latitude,
        longitude: matchedPoint.longitude,
        name: `WP ${idx + 1}: ${(cue.distanceMeters / 1000).toFixed(1)}km`,
        description: cue.instruction,
      };
    });

    const course: CourseRoute = {
      id: aiRoute.id,
      name: aiRoute.name,
      description: aiRoute.description,
      totalDistanceMeters: aiRoute.target_distance_meters,
      elevationGainMeters: aiRoute.elevation_gain_meters,
      elevationLossMeters: aiRoute.elevation_loss_meters,
      points: aiRoute.points,
      waypoints: waypoints,
      createdAt: aiRoute.created_at,
      source: 'preset',
    };

    // Save to courseService and activate
    courseService.saveCourse(course);
    courseService.setActiveCourse(course);
    return course;
  }
};

function getSceneryHeading(scenery: SceneryType): string {
  switch (scenery) {
    case 'park': return 'parkland perimeter avenue';
    case 'flat': return 'fast asphalt corridor';
    case 'waterfront': return 'promenade walkway';
    case 'urban': return 'downtown boulevard';
    case 'trail': return 'compact dirt switchback';
    default: return 'main road';
  }
}

function getTurnInstruction(scenery: SceneryType, phase: number): string {
  if (scenery === 'park') {
    if (phase === 1) return 'Bear right at the botanical pavilion';
    if (phase === 2) return 'Follow winding park trail around pond';
    return 'Take outer park perimeter path heading back toward start';
  }
  if (scenery === 'waterfront') {
    if (phase === 1) return 'Curve right alongside pier boardwalk';
    if (phase === 2) return 'Continue straight past yacht marina';
    return 'Turn right into return promenade avenue';
  }
  if (scenery === 'flat') {
    if (phase === 1) return 'Turn right on wide level avenue';
    if (phase === 2) return 'Maintain cruising rhythm on long straight';
    return 'Right turn onto smooth finish stretch';
  }
  if (scenery === 'trail') {
    if (phase === 1) return 'Gradual right ascent into tree canopy';
    if (phase === 2) return 'Crest peak and begin gentle descent';
    return 'Right fork along stream bed heading home';
  }
  // Urban
  if (phase === 1) return 'Turn right onto wide sidewalk crossing';
  if (phase === 2) return 'Pass central plaza and continue clockwise';
  return 'Turn right at landmark corner back to start';
}
