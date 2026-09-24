import {
  GPSCoordinate,
  GPSSignalStatus,
  LiveWorkoutState,
  NetworkSyncStatus,
  SplitToastInfo,
  WorkoutEngineState,
  WorkoutPointRecord,
  WorkoutSplit,
  WorkoutType,
} from '../types';
import { calculateCalories, calculateHaversineDistance, calculateSplits } from '../utils/calculations';
import { LocationValidator } from './locationValidator';
import { PaceCalculator } from './paceCalculator';
import { GPSSmoother } from './gpsSmoother';
import { syncQueue } from './syncQueue';
import { audioCoach } from './audioCoach';
import { mediaSessionManager } from './mediaSessionManager';
import { workoutLogger } from '../utils/workoutLogger';

type StateListener = (state: LiveWorkoutState) => void;

const BACKUP_STORAGE_KEY = 'runwar_active_workout_backup';

export class WorkoutEngine {
  private state: LiveWorkoutState = this.createInitialState();
  private listeners: StateListener[] = [];
  private watchId: number | null = null;
  private workerTimer: Worker | null = null;
  private fallbackInterval: any = null;
  private wakeLock: any = null;

  // Configuration
  private userId: string = 'guest_user';
  private userWeightKg: number = 70;
  private autoPauseEnabled: boolean = true;
  private autoPauseThresholdSec: number = 10;
  private stationaryCounterSec: number = 0;
  private lastRecordedKm: number = 0;
  private isFirstPointAfterResume: boolean = false;
  private distanceUnit: 'km' | 'mi' = 'km';
  private gpsSmoother = new GPSSmoother();
  private distanceAnchor: GPSCoordinate | null = null;

  // Batched points buffer for syncQueue
  private pointBuffer: WorkoutPointRecord[] = [];
  private readonly BATCH_FLUSH_SIZE = 15;

  // Simulation mode
  public isSimulationMode: boolean = false;
  private simInterval: any = null;
  private simAngle: number = 0;
  private simBaseLat: number = 37.7749;
  private simBaseLng: number = -122.4194;

  constructor() {
    this.initNetworkListeners();
    this.initVisibilityListener();
  }

  private createInitialState(): LiveWorkoutState {
    return {
      workoutId: crypto.randomUUID(),
      engineState: 'IDLE',
      status: 'idle',
      type: 'run',
      startTime: null,
      elapsedTime: 0,
      movingTime: 0,
      pausedTime: 0,
      distanceMeters: 0,
      currentPace: 0,
      averagePace: 0,
      currentSpeed: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      calories: 0,
      elevationGain: 0,
      elevationLoss: 0,
      coordinates: [],
      splits: [],
      activeSplitToast: null,
      isAutoPaused: false,
      gpsAccuracy: null,
      gpsStatus: 'searching',
      networkStatus: typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline',
      lastPointTime: null,
      pointSequence: 0,
      pendingSyncPoints: 0,
    };
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.push(listener);
    listener({ ...this.state });
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    const copy: LiveWorkoutState = {
      ...this.state,
      coordinates: [...this.state.coordinates],
      splits: [...this.state.splits],
      pendingSyncPoints: syncQueue.getPendingPointsCount() + this.pointBuffer.length,
    };

    for (const listener of this.listeners) {
      listener(copy);
    }

    // Persist active snapshot for crash recovery
    if (this.state.engineState === 'ACTIVE' || this.state.engineState === 'PAUSED') {
      try {
        localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(copy));
      } catch (e) {
        // Ignore quota
      }
    }
  }

  public getState(): LiveWorkoutState {
    return { ...this.state };
  }

  public setConfig(userId: string, weightKg: number, autoPause: boolean, autoPauseThreshold: number, distanceUnit: 'km' | 'mi' = 'km') {
    this.userId = userId || 'guest_user';
    this.userWeightKg = weightKg || 70;
    this.autoPauseEnabled = autoPause;
    this.autoPauseThresholdSec = autoPauseThreshold || 10;
    this.distanceUnit = distanceUnit;
  }

  /**
   * Transition state machine with strict transition guards
   */
  public transitionTo(nextState: WorkoutEngineState): boolean {
    const current = this.state.engineState;

    const allowedTransitions: Record<WorkoutEngineState, WorkoutEngineState[]> = {
      IDLE: ['STARTING', 'RECOVERING'],
      STARTING: ['ACTIVE', 'FAILED', 'IDLE'],
      ACTIVE: ['PAUSED', 'FINISHING', 'FAILED'],
      PAUSED: ['RESUMING', 'ACTIVE', 'FINISHING', 'FAILED', 'IDLE'],
      RESUMING: ['ACTIVE', 'PAUSED', 'FAILED'],
      FINISHING: ['COMPLETED', 'SYNCING', 'FAILED'],
      COMPLETED: ['IDLE', 'STARTING'],
      FAILED: ['IDLE', 'RECOVERING', 'STARTING'],
      RECOVERING: ['ACTIVE', 'PAUSED', 'IDLE'],
      SYNCING: ['COMPLETED', 'FAILED'],
    };

    if (!allowedTransitions[current]?.includes(nextState)) {
      workoutLogger.log('STATE_TRANSITION', 'warn', {
        error: `Invalid transition from ${current} to ${nextState}`,
      }, this.state.workoutId);
      return false;
    }

    this.state.engineState = nextState;
    this.state.status =
      nextState === 'ACTIVE'
        ? 'tracking'
        : nextState === 'PAUSED'
        ? 'paused'
        : nextState === 'COMPLETED'
        ? 'finished'
        : nextState === 'STARTING'
        ? 'countdown'
        : 'idle';

    workoutLogger.log('STATE_TRANSITION', 'info', { from: current, to: nextState }, this.state.workoutId);
    this.notify();
    return true;
  }

  /**
   * Start a new active workout session
   */
  public async startWorkout(type: WorkoutType = 'run'): Promise<boolean> {
    if (this.state.engineState === 'COMPLETED' || this.state.engineState === 'FAILED') {
      this.reset();
    } else if (this.state.engineState !== 'IDLE' && this.state.engineState !== 'RECOVERING') {
      workoutLogger.log('WORKOUT_STARTED', 'warn', { error: 'Workout already in progress' });
      return false;
    }

    if (!this.transitionTo('STARTING')) return false;

    // Reset clean session
    this.state = {
      ...this.createInitialState(),
      workoutId: crypto.randomUUID(),
      type,
      startTime: Date.now(),
      engineState: 'ACTIVE',
      status: 'tracking',
    };

    this.stationaryCounterSec = 0;
    this.lastRecordedKm = 0;
    this.pointBuffer = [];
    this.resetGPSProcessing();

    workoutLogger.log('WORKOUT_STARTED', 'info', {
      workoutId: this.state.workoutId,
      type,
      userId: this.userId,
    }, this.state.workoutId);

    audioCoach.announceWorkoutStart(type);
    this.vibrate([100, 50, 100]);

    mediaSessionManager.startSession(
      type,
      () => this.resumeWorkout(),
      () => this.pauseWorkout(false)
    );

    this.acquireWakeLock();
    this.startBackgroundTimer();

    if (this.isSimulationMode) {
      this.startSimulation();
    } else {
      this.startGPSWatcher();
    }

    this.notify();
    return true;
  }

  /** Switch the active location source without resetting the current workout. */
  public setSimulationMode(enabled: boolean): void {
    if (this.isSimulationMode === enabled) return;

    this.isSimulationMode = enabled;
    this.resetGPSProcessing();

    if (this.state.engineState === 'ACTIVE' || this.state.engineState === 'PAUSED') {
      if (enabled) {
        this.stopGPSWatcher();
        this.startSimulation();
      } else {
        this.stopSimulation();
        this.startGPSWatcher();
      }
    }

    this.notify();
  }

  /**
   * Manual pause
   */
  public pauseWorkout(isAuto: boolean = false): boolean {
    if (this.state.engineState !== 'ACTIVE') return false;

    if (!this.transitionTo('PAUSED')) return false;

    this.state.isAutoPaused = isAuto;
    this.state.currentPace = 0; // Stopped pace

    if (isAuto) {
      workoutLogger.log('AUTO_PAUSED', 'info', { elapsedTime: this.state.elapsedTime }, this.state.workoutId);
      audioCoach.announceAutoPaused();
      this.vibrate([120, 60, 120]);
    } else {
      workoutLogger.log('WORKOUT_PAUSED', 'info', { elapsedTime: this.state.elapsedTime }, this.state.workoutId);
      audioCoach.announceWorkoutPaused();
      this.vibrate([200]);
    }

    mediaSessionManager.updateTelemetry(
      this.state.distanceMeters,
      this.state.elapsedTime,
      this.state.currentPace,
      this.state.calories,
      true
    );

    this.notify();
    return true;
  }

  /**
   * Manual or auto resume
   */
  public resumeWorkout(): boolean {
    if (this.state.engineState !== 'PAUSED') return false;

    if (!this.transitionTo('RESUMING')) return false;
    this.transitionTo('ACTIVE');

    this.state.isAutoPaused = false;
    this.stationaryCounterSec = 0;
    this.isFirstPointAfterResume = true;

    // Ensure timer and location watchers are active (critical when resuming recovered sessions)
    if (!this.workerTimer && !this.fallbackInterval) {
      this.startBackgroundTimer();
    }
    if (this.isSimulationMode) {
      if (!this.simInterval) this.startSimulation();
    } else {
      if (this.watchId === null) this.startGPSWatcher();
    }

    workoutLogger.log('WORKOUT_RESUMED', 'info', { elapsedTime: this.state.elapsedTime }, this.state.workoutId);
    audioCoach.announceWorkoutResumed();
    this.vibrate([100]);

    mediaSessionManager.updateTelemetry(
      this.state.distanceMeters,
      this.state.elapsedTime,
      this.state.currentPace,
      this.state.calories,
      false
    );

    this.acquireWakeLock();
    this.notify();
    return true;
  }

  /**
   * Reset engine cleanly to initial idle state
   */
  public reset(): void {
    this.stopBackgroundTimer();
    this.stopGPSWatcher();
    this.stopSimulation();
    this.releaseWakeLock();
    audioCoach.stop();
    mediaSessionManager.endSession();

    this.state = this.createInitialState();
    this.pointBuffer = [];
    this.stationaryCounterSec = 0;
    this.lastRecordedKm = 0;
    this.isFirstPointAfterResume = false;
    this.resetGPSProcessing();
    localStorage.removeItem(BACKUP_STORAGE_KEY);
    this.notify();
  }

  /**
   * Finish and complete active workout session
   */
  public finishWorkout(): LiveWorkoutState {
    this.transitionTo('FINISHING');

    this.stopBackgroundTimer();
    this.stopGPSWatcher();
    this.stopSimulation();
    this.releaseWakeLock();

    // Flush any remaining buffered points to sync queue
    this.flushPointBuffer();

    // Final calculation passes
    this.state.splits = calculateSplits(this.state.coordinates, this.distanceUnit === 'mi' ? 1609.34 : 1000);
    this.state.averagePace = PaceCalculator.calculateAveragePace(
      this.state.distanceMeters,
      this.state.movingTime || this.state.elapsedTime
    );
    this.state.averageSpeed = PaceCalculator.calculateAverageSpeed(
      this.state.distanceMeters,
      this.state.movingTime || this.state.elapsedTime
    );

    this.transitionTo('COMPLETED');

    workoutLogger.log('WORKOUT_COMPLETED', 'info', {
      workoutId: this.state.workoutId,
      totalDistance: this.state.distanceMeters,
      elapsedTime: this.state.elapsedTime,
      splitsCount: this.state.splits.length,
    }, this.state.workoutId);

    audioCoach.announceWorkoutFinished(this.state.distanceMeters, this.state.elapsedTime, this.distanceUnit);
    this.vibrate([150, 100, 150, 100, 300]);
    mediaSessionManager.endSession();

    localStorage.removeItem(BACKUP_STORAGE_KEY);
    this.notify();

    return { ...this.state };
  }

  /**
   * Discard active workout
   */
  public discardWorkout() {
    this.stopBackgroundTimer();
    this.stopGPSWatcher();
    this.stopSimulation();
    this.releaseWakeLock();
    audioCoach.stop();
    mediaSessionManager.endSession();

    this.state = this.createInitialState();
    this.pointBuffer = [];
    this.resetGPSProcessing();
    localStorage.removeItem(BACKUP_STORAGE_KEY);
    this.notify();
  }

  /**
   * Ingest raw GPS point from browser/device
   */
  public ingestRawGPS(raw: GeolocationPosition) {
    const { latitude, longitude, altitude, accuracy, speed } = raw.coords;
    const timestamp = raw.timestamp || Date.now();

    this.state.gpsAccuracy = accuracy;
    // Keep the visible status aligned with LocationValidator's 35 m acceptance limit.
    this.state.gpsStatus = accuracy <= 20 ? 'locked' : accuracy <= 35 ? 'weak' : 'searching';

    const rawPoint: GPSCoordinate = {
      latitude,
      longitude,
      altitude: altitude ?? null,
      accuracy,
      speed: speed ?? null,
      timestamp,
    };

    this.processCoordinate(rawPoint);
  }

  /**
   * Core Coordinate Pipeline (Validation → Distance → Pace → Buffer → Splits)
   */
  public processCoordinate(rawCoordinate: GPSCoordinate) {
    const smoothed = this.gpsSmoother.smooth(rawCoordinate);
    if (!smoothed) {
      // Keep the live marker responsive while GPS warms up, without recording a route yet.
      this.state.currentLocation = rawCoordinate;
      this.notify();
      return;
    }

    const coord = smoothed.coordinate;
    const coords = this.state.coordinates;
    const prevCoord = coords.length > 0 ? coords[coords.length - 1] : null;

    // 1. Run through Production Location Validator
    const validation = LocationValidator.validate(coord, prevCoord, this.state.workoutId);
    if (!validation.isValid) {
      this.notify();
      return;
    }

    coord.distanceFromPrevious = this.getNoiseAwareDistance(coord);
    this.state.currentLocation = coord;
    this.state.pointSequence += 1;
    coord.sequence_number = this.state.pointSequence;

    if (this.state.engineState === 'ACTIVE') {
      // 2. Aggregate Validated Distance (skip on first point after resume to prevent teleport spike)
      if (this.isFirstPointAfterResume) {
        this.isFirstPointAfterResume = false;
        // Accept the coordinate as baseline without adding distance
      } else {
        this.state.distanceMeters += coord.distanceFromPrevious;
      }

      // 3. Speed & Pace Calculation with Noise Smoothing
      let instSpeedKmh = 0;
      if (prevCoord && coord.distanceFromPrevious > 0) {
        const dtSec = Math.max(1, (coord.timestamp - prevCoord.timestamp) / 1000);
        instSpeedKmh = (coord.distanceFromPrevious / 1000) / (dtSec / 3600);
      } else if (coord.speed && coord.speed > 0) {
        instSpeedKmh = coord.speed * 3.6;
      }

      // Smooth instantaneous speed with moving average
      if (this.state.currentSpeed > 0) {
        this.state.currentSpeed = Number(((this.state.currentSpeed * 0.75) + (instSpeedKmh * 0.25)).toFixed(2));
      } else {
        this.state.currentSpeed = Number(instSpeedKmh.toFixed(2));
      }

      this.state.maxSpeed = Math.max(this.state.maxSpeed, this.state.currentSpeed);

      // Append coordinate to track
      coords.push(coord);

      // 4. Rolling Window Pace Calculation
      this.state.currentPace = PaceCalculator.calculateRollingPace(coords, this.state.currentSpeed);

      // 5. Elevation Accumulation
      if (validation.altitudeDeltaMeters > 0.5) {
        this.state.elevationGain += validation.altitudeDeltaMeters;
      } else if (validation.altitudeDeltaMeters < -0.5) {
        this.state.elevationLoss += Math.abs(validation.altitudeDeltaMeters);
      }

      // 6. Auto-Resume Detection if auto-paused
      if (this.state.isAutoPaused && this.state.currentSpeed >= 1.5) {
        this.resumeWorkout();
      }

      // 7. Update Live Splits & Kilometer Haptic Milestone Alerts
      this.state.splits = calculateSplits(coords, this.distanceUnit === 'mi' ? 1609.34 : 1000);
      const currentKm = Math.floor(this.state.distanceMeters / 1000);

      if (currentKm > this.lastRecordedKm && currentKm > 0) {
        this.lastRecordedKm = currentKm;
        const currentSplit = this.state.splits[this.state.splits.length - 1];
        const prevSplit = this.state.splits.length > 1 ? this.state.splits[this.state.splits.length - 2] : null;

        const splitPace = currentSplit ? currentSplit.pace : this.state.averagePace;
        const splitDuration = currentSplit ? currentSplit.duration_seconds : Math.round(this.state.elapsedTime / currentKm);
        const diffPaceSeconds = prevSplit ? (splitPace - prevSplit.pace) : 0;

        // Distinct vibration pattern upon completing each kilometer: [150, 80, 150, 80, 300]
        this.vibrate([150, 80, 150, 80, 300]);

        this.state.activeSplitToast = {
          kilometer: currentKm,
          splitPace,
          splitDuration,
          diffPaceSeconds,
          timestamp: Date.now(),
        };
      }

      // 8. Buffer for batched InsForge point sync
      const pointRecord: WorkoutPointRecord = {
        workout_id: this.state.workoutId,
        user_id: this.userId,
        latitude: coord.latitude,
        longitude: coord.longitude,
        altitude: coord.altitude ?? null,
        accuracy: coord.accuracy ?? null,
        speed: coord.speed ?? null,
        timestamp: new Date(coord.timestamp).toISOString(),
        sequence_number: coord.sequence_number || this.state.pointSequence,
      };

      this.pointBuffer.push(pointRecord);
      if (this.pointBuffer.length >= this.BATCH_FLUSH_SIZE) {
        this.flushPointBuffer();
      }

      // 9. Audio Coach Periodic Triggers
      const lastSplitPace = this.state.splits.length > 0
        ? this.state.splits[this.state.splits.length - 1].pace
        : this.state.averagePace;

      audioCoach.checkAndAnnounce(
        this.state.distanceMeters,
        this.state.elapsedTime,
        this.state.averagePace,
        lastSplitPace
      );

    this.state.lastPointTime = coord.timestamp;
    } else {
      // In IDLE or PAUSED, coordinate is tracked in this.state.currentLocation for marker positioning.
      // We do NOT push to coords so stationary jitter/drift doesn't corrupt the route polyline or splits.
    }

    this.notify();
  }

  /**
   * Only add distance after the smoothed position has moved beyond its likely
   * GPS noise radius. This avoids false distance while standing still, while
   * preserving normal walking and running movement over the next few samples.
   */
  private getNoiseAwareDistance(coord: GPSCoordinate): number {
    if (!this.distanceAnchor) {
      this.distanceAnchor = coord;
      return 0;
    }

    const distanceMeters = calculateHaversineDistance(
      this.distanceAnchor.latitude,
      this.distanceAnchor.longitude,
      coord.latitude,
      coord.longitude
    );
    const averageAccuracy = ((this.distanceAnchor.accuracy ?? 35) + (coord.accuracy ?? 35)) / 2;
    const noiseThresholdMeters = Math.max(2, Math.min(6, averageAccuracy * 0.24));

    if (distanceMeters < noiseThresholdMeters) {
      return 0;
    }

    this.distanceAnchor = coord;
    return distanceMeters;
  }

  private resetGPSProcessing(): void {
    this.gpsSmoother.reset();
    this.distanceAnchor = null;
  }

  private flushPointBuffer() {
    if (this.pointBuffer.length === 0) return;
    // Guest users skip cloud sync
    if (this.userId === 'guest_user' || this.userId === 'usr_guest_demo') {
      this.pointBuffer = [];
      return;
    }
    const batch = [...this.pointBuffer];
    this.pointBuffer = [];
    syncQueue.queuePointBatch(this.state.workoutId, this.userId, batch);
  }

  /**
   * Web Worker / Monotonic Background Timer
   * Ensures uninterrupted 1000ms ticks even when mobile browser background-throttles setInterval
   */
  private startBackgroundTimer() {
    this.stopBackgroundTimer();

    // Create inline Web Worker via Blob URL
    try {
      const workerCode = `
        let timer = null;
        self.onmessage = function(e) {
          if (e.data === 'start') {
            if (timer) clearInterval(timer);
            timer = setInterval(() => self.postMessage('tick'), 1000);
          } else if (e.data === 'stop') {
            if (timer) clearInterval(timer);
            timer = null;
          }
        };
      `;
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      this.workerTimer = new Worker(workerUrl);

      this.workerTimer.onmessage = () => {
        this.handleTimerTick();
      };

      this.workerTimer.postMessage('start');
    } catch (e) {
      // Fallback to standard setInterval if Web Worker is restricted
      this.fallbackInterval = setInterval(() => {
        this.handleTimerTick();
      }, 1000);
    }
  }

  private handleTimerTick() {
    if (this.state.engineState === 'ACTIVE') {
      this.state.elapsedTime += 1;

      // Moving vs Paused time separation
      if (this.state.currentSpeed >= 0.8) {
        this.state.movingTime += 1;
        this.stationaryCounterSec = 0;
      } else {
        // Stationary check for auto-pause
        if (this.autoPauseEnabled && this.state.distanceMeters > 20) {
          this.stationaryCounterSec += 1;
          if (this.stationaryCounterSec >= this.autoPauseThresholdSec) {
            this.pauseWorkout(true);
            return;
          }
        }
      }

      // Compute cumulative pace, speed, calories
      if (this.state.distanceMeters > 0) {
        this.state.averagePace = PaceCalculator.calculateAveragePace(
          this.state.distanceMeters,
          this.state.movingTime || this.state.elapsedTime
        );
        this.state.averageSpeed = PaceCalculator.calculateAverageSpeed(
          this.state.distanceMeters,
          this.state.movingTime || this.state.elapsedTime
        );
      }

      this.state.calories = calculateCalories(
        this.userWeightKg,
        this.state.movingTime || this.state.elapsedTime,
        this.state.averageSpeed || 8.5,
        this.state.type
      );

      mediaSessionManager.updateTelemetry(
        this.state.distanceMeters,
        this.state.elapsedTime,
        this.state.currentPace,
        this.state.calories,
        false
      );

      this.notify();
    } else if (this.state.engineState === 'PAUSED') {
      this.state.pausedTime += 1;
      this.notify();
    }
  }

  private stopBackgroundTimer() {
    if (this.workerTimer) {
      this.workerTimer.postMessage('stop');
      this.workerTimer.terminate();
      this.workerTimer = null;
    }
    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
    }
  }

  /**
   * Geolocation Native Watcher
   */
  private startGPSWatcher() {
    this.stopGPSWatcher();

    if (!('geolocation' in navigator)) {
      this.state.gpsStatus = 'denied';
      this.notify();
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    };

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => this.ingestRawGPS(pos),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          this.state.gpsStatus = 'denied';
        } else {
          this.state.gpsStatus = 'weak';
        }
        this.notify();
      },
      options
    );
  }

  private stopGPSWatcher() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  /**
   * Outdoor Continuous Route Simulator (For indoor testing without walking outside)
   */
  public startSimulation() {
    this.stopSimulation();
    this.state.gpsStatus = 'locked';
    this.state.gpsAccuracy = 3.5;

    // Get real current location as base if available
    if (navigator.geolocation && this.state.coordinates.length === 0) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.simBaseLat = pos.coords.latitude;
          this.simBaseLng = pos.coords.longitude;
        },
        () => {},
        { timeout: 2000 }
      );
    }

    this.simAngle = 0;
    let currentLat = this.simBaseLat;
    let currentLng = this.simBaseLng;
    let currentAlt = 30;

    this.simInterval = setInterval(() => {
      if (this.state.engineState === 'ACTIVE') {
        this.simAngle += 0.035;
        const radius = 0.003 + Math.sin(this.simAngle * 3) * 0.001;
        currentLat = this.simBaseLat + radius * Math.cos(this.simAngle);
        currentLng = this.simBaseLng + (radius * 1.25) * Math.sin(this.simAngle);
        currentAlt += (Math.random() - 0.49) * 0.6;

        const simSpeedMs = 2.8 + (Math.random() - 0.5) * 0.5; // ~10 km/h

        const simCoord: GPSCoordinate = {
          latitude: currentLat,
          longitude: currentLng,
          altitude: currentAlt,
          accuracy: 3.5 + Math.random() * 1.5,
          speed: simSpeedMs,
          timestamp: Date.now(),
        };

        this.processCoordinate(simCoord);
      }
    }, 1000);
  }

  public stopSimulation() {
    if (this.simInterval) {
      clearInterval(this.simInterval);
      this.simInterval = null;
    }
  }

  /**
   * Crash Recovery Capabilities
   */
  public hasRecoverableWorkout(): boolean {
    const raw = localStorage.getItem(BACKUP_STORAGE_KEY);
    if (!raw) return false;
    try {
      const parsed: LiveWorkoutState = JSON.parse(raw);
      return Boolean(
        parsed &&
        parsed.workoutId &&
        (parsed.engineState === 'ACTIVE' || parsed.engineState === 'PAUSED' || parsed.status === 'tracking' || parsed.status === 'paused')
      );
    } catch {
      return false;
    }
  }

  public getRecoverableWorkout(): LiveWorkoutState | null {
    try {
      const raw = localStorage.getItem(BACKUP_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public restoreWorkout(backup: LiveWorkoutState, autoResume?: boolean) {
    const shouldResume = autoResume ?? (backup.status === 'tracking' || backup.engineState === 'ACTIVE');
    this.state = {
      ...backup,
      activeSplitToast: null,
      engineState: shouldResume ? 'ACTIVE' : 'PAUSED',
      status: shouldResume ? 'tracking' : 'paused',
    };

    workoutLogger.log('RECOVERY_DETECTED', 'info', {
      workoutId: backup.workoutId,
      restoredDistance: backup.distanceMeters,
      restoredPoints: backup.coordinates.length,
      shouldResume,
    }, backup.workoutId);

    if (shouldResume) {
      this.acquireWakeLock();
      this.startBackgroundTimer();
      if (this.isSimulationMode) {
        this.startSimulation();
      } else {
        this.startGPSWatcher();
      }
    }

    this.notify();
  }

  public discardRecoverableWorkout() {
    localStorage.removeItem(BACKUP_STORAGE_KEY);
  }

  private async acquireWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        if (this.wakeLock && !this.wakeLock.released) {
          return;
        }
        this.wakeLock = await (navigator as any).wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => {
          // Re-acquire if screen wake lock was released unexpectedly while workout is still active
          if (this.state.engineState === 'ACTIVE' && typeof document !== 'undefined' && document.visibilityState === 'visible') {
            this.acquireWakeLock();
          }
        });
      }
    } catch (e) {
      // Ignore
    }
  }

  private releaseWakeLock() {
    try {
      if (this.wakeLock) {
        this.wakeLock.release();
        this.wakeLock = null;
      }
    } catch (e) {
      // Ignore
    }
  }

  private vibrate(pattern: number[]) {
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch (e) {
      // Ignore
    }
  }

  private initNetworkListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.state.networkStatus = 'online';
      this.notify();
    });

    window.addEventListener('offline', () => {
      this.state.networkStatus = 'offline';
      this.notify();
    });
  }

  private initVisibilityListener() {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (this.state.engineState === 'ACTIVE') {
          this.acquireWakeLock();
        }
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        if (this.state.engineState === 'ACTIVE') {
          this.acquireWakeLock();
        }
      });
    }
  }
}

export const workoutEngine = new WorkoutEngine();
