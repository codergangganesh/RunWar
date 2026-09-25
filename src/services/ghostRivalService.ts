import { GhostRivalConfig, GhostRivalProgress, GPSCoordinate, Workout } from '../types';
import { audioCoach } from './audioCoach';
import { soundEffects } from './soundEffects';

const ACTIVE_GHOST_KEY = 'runwar_active_ghost';
const GHOST_ALERT_COOLDOWN_MS = 30000; // 30s minimum between voice announcements

export const PRESET_GHOST_PACERS: GhostRivalConfig[] = [
  {
    id: 'ghost_4_00',
    name: 'Sub-20:00 5K Pacer (4:00/km)',
    type: 'target_pace',
    targetPaceSecondsPerKm: 240, // 4:00 /km
  },
  {
    id: 'ghost_4_30',
    name: 'Sub-22:30 5K Pacer (4:30/km)',
    type: 'target_pace',
    targetPaceSecondsPerKm: 270, // 4:30 /km
  },
  {
    id: 'ghost_5_00',
    name: 'Sub-25:00 5K Pacer (5:00/km)',
    type: 'target_pace',
    targetPaceSecondsPerKm: 300, // 5:00 /km
  },
  {
    id: 'ghost_5_30',
    name: 'Sub-27:30 5K Pacer (5:30/km)',
    type: 'target_pace',
    targetPaceSecondsPerKm: 330, // 5:30 /km
  },
  {
    id: 'ghost_6_00',
    name: 'Sub-30:00 5K Pacer (6:00/km)',
    type: 'target_pace',
    targetPaceSecondsPerKm: 360, // 6:00 /km
  },
  {
    id: 'ghost_6_30',
    name: 'Aerobic Cruise Pacer (6:30/km)',
    type: 'target_pace',
    targetPaceSecondsPerKm: 390, // 6:30 /km
  },
  {
    id: 'ghost_7_00',
    name: 'Recovery Jog Pacer (7:00/km)',
    type: 'target_pace',
    targetPaceSecondsPerKm: 420, // 7:00 /km
  },
];

type GhostListener = (ghost: GhostRivalConfig | null) => void;

class GhostRivalService {
  private activeGhost: GhostRivalConfig | null = null;
  private listeners: GhostListener[] = [];

  // Audio voice alert state tracking
  private lastAlertTime: number = 0;
  private wasRunnerAhead: boolean | null = null;
  private lastAnnouncedDistanceKm: number = 0;

  constructor() {
    this.loadActiveGhost();
  }

  private loadActiveGhost() {
    try {
      const raw = localStorage.getItem(ACTIVE_GHOST_KEY);
      if (raw) {
        this.activeGhost = JSON.parse(raw);
      }
    } catch {
      this.activeGhost = null;
    }
  }

  public subscribe(listener: GhostListener): () => void {
    this.listeners.push(listener);
    listener(this.activeGhost);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l(this.activeGhost));
  }

  public getActiveGhost(): GhostRivalConfig | null {
    return this.activeGhost;
  }

  public setActiveGhost(ghost: GhostRivalConfig | null) {
    this.activeGhost = ghost;
    this.wasRunnerAhead = null;
    this.lastAnnouncedDistanceKm = 0;
    try {
      if (ghost) {
        localStorage.setItem(ACTIVE_GHOST_KEY, JSON.stringify(ghost));
      } else {
        localStorage.removeItem(ACTIVE_GHOST_KEY);
      }
    } catch {}
    this.notify();
  }

  /**
   * Create a Ghost Rival from a previous user workout
   */
  public createGhostFromWorkout(workout: Workout): GhostRivalConfig {
    const pace = workout.average_pace || 360;
    const dateFormatted = new Date(workout.started_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });

    const ghost: GhostRivalConfig = {
      id: `ghost_pr_${workout.id}`,
      name: `PR: ${workout.title || `${workout.type.toUpperCase()}`} (${dateFormatted})`,
      type: 'previous_workout',
      targetPaceSecondsPerKm: pace,
      targetDistanceMeters: workout.distance_meters,
      previousWorkoutId: workout.id,
      previousWorkoutTitle: workout.title || `${workout.type} workout`,
      previousWorkoutDate: workout.started_at,
      previousCoordinates: workout.route_coordinates || [],
    };

    return ghost;
  }

  /**
   * Real-time calculation of Ghost position and Runner delta
   */
  public calculateProgress(
    config: GhostRivalConfig,
    elapsedSeconds: number,
    runnerDistanceMeters: number,
    currentCoords: GPSCoordinate[] = []
  ): GhostRivalProgress {
    let ghostDistanceMeters = 0;
    const ghostPace = config.targetPaceSecondsPerKm || 300;
    const ghostSpeedMps = 1000 / Math.max(1, ghostPace);

    if (config.type === 'previous_workout' && config.previousCoordinates && config.previousCoordinates.length > 1) {
      // Replay against previous workout points
      const pts = config.previousCoordinates;
      const startMs = pts[0].timestamp;
      const targetElapsedMs = elapsedSeconds * 1000;

      // Find segment matching current elapsed time
      let matchingIdx = 0;
      for (let i = 0; i < pts.length; i++) {
        const offset = pts[i].timestamp - startMs;
        if (offset <= targetElapsedMs) {
          matchingIdx = i;
        } else {
          break;
        }
      }

      // Sum distances up to matchingIdx
      let cumDist = 0;
      for (let i = 1; i <= matchingIdx; i++) {
        cumDist += pts[i].distanceFromPrevious || 0;
      }
      ghostDistanceMeters = Math.round(cumDist);
    } else {
      // Steady Target Pace
      ghostDistanceMeters = Math.round(elapsedSeconds * ghostSpeedMps);
    }

    if (config.targetDistanceMeters && config.targetDistanceMeters > 0) {
      ghostDistanceMeters = Math.min(ghostDistanceMeters, config.targetDistanceMeters);
    }

    const deltaMeters = Math.round(runnerDistanceMeters - ghostDistanceMeters);
    const isRunnerAhead = deltaMeters >= 0;
    const deltaSeconds = ghostSpeedMps > 0 ? Math.round(Math.abs(deltaMeters) / ghostSpeedMps) : 0;

    // Calculate Ghost Coordinate along route (for Leaflet Map)
    let ghostCoordinate: GPSCoordinate | null = null;
    if (config.type === 'previous_workout' && config.previousCoordinates && config.previousCoordinates.length > 0) {
      const pts = config.previousCoordinates;
      const targetElapsedMs = elapsedSeconds * 1000;
      const startMs = pts[0].timestamp;
      let closestPt = pts[0];
      for (let i = 0; i < pts.length; i++) {
        if (pts[i].timestamp - startMs <= targetElapsedMs) {
          closestPt = pts[i];
        } else {
          break;
        }
      }
      ghostCoordinate = closestPt;
    } else if (currentCoords.length > 0) {
      // Interpolate along the user's active breadcrumb coordinates
      if (deltaMeters <= 0) {
        // Ghost is ahead: use runner's current or slightly ahead location
        const latest = currentCoords[currentCoords.length - 1];
        ghostCoordinate = latest;
      } else {
        // Ghost is behind runner: find the point along currentCoords matching ghostDistanceMeters
        let cum = 0;
        let matchedCoord = currentCoords[0];
        for (let i = 1; i < currentCoords.length; i++) {
          cum += currentCoords[i].distanceFromPrevious || 0;
          if (cum >= ghostDistanceMeters) {
            matchedCoord = currentCoords[i];
            break;
          }
        }
        ghostCoordinate = matchedCoord;
      }
    }

    const percentCompleted = config.targetDistanceMeters
      ? Math.min(100, Math.round((runnerDistanceMeters / config.targetDistanceMeters) * 100))
      : undefined;

    const progress: GhostRivalProgress = {
      config,
      ghostDistanceMeters,
      runnerDistanceMeters: Math.round(runnerDistanceMeters),
      deltaMeters,
      deltaSeconds,
      isRunnerAhead,
      ghostPaceSecondsPerKm: ghostPace,
      ghostCoordinate,
      percentCompleted,
    };

    // Voice cues trigger
    this.handleVoiceAlerts(progress, elapsedSeconds);

    return progress;
  }

  /**
   * Audio commentary during race
   */
  private handleVoiceAlerts(progress: GhostRivalProgress, elapsedSeconds: number) {
    if (elapsedSeconds < 15) return; // Wait 15s after run start before alerts
    const now = Date.now();

    // 1. Overtook ghost (gained lead)
    if (this.wasRunnerAhead === false && progress.isRunnerAhead && progress.deltaMeters > 5) {
      if (now - this.lastAlertTime > GHOST_ALERT_COOLDOWN_MS) {
        this.lastAlertTime = now;
        soundEffects.playMilestone();
        audioCoach.speak(`You passed your ghost rival! You are ${progress.deltaMeters} meters ahead. Keep pushing!`, { withChime: true });
      }
    }

    // 2. Ghost passed runner (lost lead)
    if (this.wasRunnerAhead === true && !progress.isRunnerAhead && progress.deltaMeters < -10) {
      if (now - this.lastAlertTime > GHOST_ALERT_COOLDOWN_MS) {
        this.lastAlertTime = now;
        const behind = Math.abs(progress.deltaMeters);
        audioCoach.speak(`Ghost rival just passed you. You are ${behind} meters behind. Pick up the pace!`, { withChime: true });
      }
    }

    this.wasRunnerAhead = progress.isRunnerAhead;
  }
}

export const ghostRivalService = new GhostRivalService();
