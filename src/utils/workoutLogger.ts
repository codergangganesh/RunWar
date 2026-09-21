export type WorkoutLogEvent =
  | 'WORKOUT_STARTED'
  | 'GPS_ACQUIRED'
  | 'GPS_LOST'
  | 'GPS_RECOVERED'
  | 'LOCATION_REJECTED'
  | 'WORKOUT_PAUSED'
  | 'WORKOUT_RESUMED'
  | 'AUTO_PAUSED'
  | 'AUTO_RESUMED'
  | 'SYNC_BATCH_QUEUED'
  | 'SYNC_STARTED'
  | 'SYNC_SUCCESS'
  | 'SYNC_FAILED'
  | 'WORKOUT_COMPLETED'
  | 'RECOVERY_DETECTED'
  | 'STATE_TRANSITION';

export interface StructuredLogEntry {
  timestamp: string;
  event: WorkoutLogEvent;
  workoutId?: string;
  details?: Record<string, any>;
  level: 'info' | 'warn' | 'error';
}

class WorkoutLogger {
  private logBuffer: StructuredLogEntry[] = [];
  private readonly maxBufferSize = 200;

  public log(event: WorkoutLogEvent, level: 'info' | 'warn' | 'error' = 'info', details?: Record<string, any>, workoutId?: string) {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      event,
      workoutId,
      details,
      level,
    };

    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // In development or when warnings/errors occur, output structured telemetry (avoid raw coord logging)
    const logPrefix = `[RunWar::${event}]`;
    if (level === 'error') {
      console.error(logPrefix, details || '');
    } else if (level === 'warn') {
      console.warn(logPrefix, details || '');
    } else {
      console.log(logPrefix, details ? JSON.stringify(details) : '');
    }
  }

  public getRecentLogs(): StructuredLogEntry[] {
    return [...this.logBuffer];
  }

  public clear() {
    this.logBuffer = [];
  }
}

export const workoutLogger = new WorkoutLogger();
