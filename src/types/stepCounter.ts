/**
 * Step Counter Types & Interfaces for RunWar
 * Defines sensor states, tracking modes, cadence, and baseline metrics.
 */

export type StepTrackingMode =
  | 'native_sensor'             // Authoritative hardware step sensor via native bridge (Capacitor/Cordova)
  | 'device_motion'              // Web DeviceMotionEvent with gravity low-pass filtering and peak detection
  | 'cadence_stride_fallback'    // Speed & height-calibrated algorithmic fallback (when sensors unavailable)
  | 'simulated';                 // Test / demo simulation mode

export type StepSensorAvailability =
  | 'checking'
  | 'available'
  | 'permission_denied'
  | 'unsupported'
  | 'sensor_missing';

export interface StepCounterState {
  /** Steps tracked strictly during the current active workout session */
  sessionSteps: number;
  /** Cumulative steps recorded for today (00:00 to 23:59) */
  dailySteps: number;
  /** Current instantaneous cadence in steps per minute (SPM) */
  currentCadence: number;
  /** Average cadence across the active moving duration */
  averageCadence: number;
  /** Whether step counter is actively listening and counting */
  isTracking: boolean;
  /** Whether the device has a usable step counting capability */
  isAvailable: boolean;
  /** The active step tracking mechanism currently serving data */
  mode: StepTrackingMode;
  /** Granular sensor availability status */
  availability: StepSensorAvailability;
  /** Whether required motion/activity permissions were granted */
  permissionGranted: boolean;
  /** Human-readable status or diagnostic error message if any */
  error: string | null;
}

export interface StepCounterOptions {
  /** Runner's height in centimeters for stride length calibration */
  userHeightCm?: number;
  /** Accelerometer peak-detection sensitivity threshold */
  sensitivity?: 'low' | 'normal' | 'high';
  /** Allow fallback to DeviceMotionEvent or GPS cadence if native sensor missing */
  enableWebFallback?: boolean;
}

export interface StepCheckpoint {
  workoutId: string;
  baselineDeviceSteps: number;
  sessionSteps: number;
  pausedStepsDelta: number;
  lastUpdated: number;
}
