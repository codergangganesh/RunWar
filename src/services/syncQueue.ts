import { insforge } from '../lib/insforge';
import { Workout, WorkoutPointRecord } from '../types';
import { workoutLogger } from '../utils/workoutLogger';

export interface QueuedPointBatch {
  batchId: string;
  workoutId: string;
  userId: string;
  points: WorkoutPointRecord[];
  status: 'PENDING' | 'UPLOADING' | 'SYNCED' | 'FAILED';
  retryCount: number;
  createdAt: number;
}

const POINT_BATCH_QUEUE_KEY = 'runwar_point_batches_queue';
const WORKOUT_QUEUE_KEY = 'runwar_offline_workouts_queue';

class SyncQueueManager {
  private isProcessing = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        workoutLogger.log('SYNC_STARTED', 'info', { reason: 'online_event' });
        this.processAllQueues();
      });
    }
  }

  /**
   * Queue a batch of GPS points for a workout session
   */
  public queuePointBatch(workoutId: string, userId: string, points: WorkoutPointRecord[]) {
    if (points.length === 0) return;

    const batches = this.getPointBatches();
    const newBatch: QueuedPointBatch = {
      batchId: crypto.randomUUID(),
      workoutId,
      userId,
      points,
      status: 'PENDING',
      retryCount: 0,
      createdAt: Date.now(),
    };

    batches.push(newBatch);
    this.savePointBatches(batches);
    workoutLogger.log('SYNC_BATCH_QUEUED', 'info', {
      batchId: newBatch.batchId,
      pointCount: points.length,
      workoutId,
    }, workoutId);

    // If online, immediately attempt background sync
    if (navigator.onLine) {
      this.processPointBatch(newBatch.batchId);
    }
  }

  /**
   * Queue an entire completed workout if saved while offline
   */
  public queueCompletedWorkout(workout: Omit<Workout, 'id' | 'created_at'> & { id?: string }) {
    const queue = this.getWorkoutQueue();
    // Avoid duplicate queue entries for the same workout ID
    const existingIndex = queue.findIndex((item) => item.workout.id === workout.id);
    if (existingIndex >= 0) {
      queue[existingIndex] = {
        workout,
        status: 'PENDING',
        retryCount: 0,
        createdAt: Date.now(),
      };
    } else {
      queue.push({
        workout,
        status: 'PENDING',
        retryCount: 0,
        createdAt: Date.now(),
      });
    }
    this.saveWorkoutQueue(queue);

    if (navigator.onLine) {
      this.processWorkoutQueue();
    }
  }

  /**
   * Process a single point batch
   */
  private async processPointBatch(batchId: string) {
    if (!navigator.onLine) return;

    const batches = this.getPointBatches();
    const batchIndex = batches.findIndex((b) => b.batchId === batchId);
    if (batchIndex === -1 || batches[batchIndex].status === 'UPLOADING') return;

    const batch = batches[batchIndex];
    batch.status = 'UPLOADING';
    this.savePointBatches(batches);

    try {
      const { error } = await insforge.database
        .from('workout_points')
        .insert(batch.points);

      if (error) throw error;

      // Successfully synced - remove batch from local queue
      const updatedBatches = this.getPointBatches().filter((b) => b.batchId !== batchId);
      this.savePointBatches(updatedBatches);

      workoutLogger.log('SYNC_SUCCESS', 'info', {
        batchId,
        pointCount: batch.points.length,
        workoutId: batch.workoutId,
      }, batch.workoutId);
    } catch (err: any) {
      const currentBatches = this.getPointBatches();
      const idx = currentBatches.findIndex((b) => b.batchId === batchId);
      if (idx !== -1) {
        currentBatches[idx].status = 'FAILED';
        currentBatches[idx].retryCount += 1;
        this.savePointBatches(currentBatches);
      }

      workoutLogger.log('SYNC_FAILED', 'warn', {
        batchId,
        error: err?.message || 'Network failure',
      }, batch.workoutId);
    }
  }

  /**
   * Process all pending queues
   */
  public async processAllQueues() {
    if (this.isProcessing || !navigator.onLine) return;
    this.isProcessing = true;

    try {
      // 1. Process point batches
      const batches = this.getPointBatches();
      for (const batch of batches) {
        if (batch.status === 'PENDING' || batch.status === 'FAILED') {
          await this.processPointBatch(batch.batchId);
        }
      }

      // 2. Process offline completed workouts
      await this.processWorkoutQueue();
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process offline completed workouts queue
   */
  public async processWorkoutQueue() {
    if (!navigator.onLine) return;

    const queue = this.getWorkoutQueue();
    if (queue.length === 0) return;

    const remaining: typeof queue = [];
    let syncedAny = false;

    for (const item of queue) {
      try {
        const { error } = await insforge.database
          .from('workouts')
          .upsert([item.workout], { onConflict: 'id' });

        if (error) throw error;

        syncedAny = true;
        workoutLogger.log('SYNC_SUCCESS', 'info', {
          type: 'completed_workout',
          title: item.workout.title,
        });
      } catch (err) {
        item.status = 'FAILED';
        item.retryCount += 1;
        remaining.push(item);
      }
    }

    this.saveWorkoutQueue(remaining);

    if (syncedAny && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('runwar:sync_completed'));
    }
  }

  public getPendingPointsCount(): number {
    const batches = this.getPointBatches();
    return batches.reduce((sum, b) => sum + b.points.length, 0);
  }

  public getPendingWorkoutsCount(): number {
    return this.getWorkoutQueue().length;
  }

  private getPointBatches(): QueuedPointBatch[] {
    try {
      const data = localStorage.getItem(POINT_BATCH_QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private savePointBatches(batches: QueuedPointBatch[]) {
    try {
      localStorage.setItem(POINT_BATCH_QUEUE_KEY, JSON.stringify(batches));
    } catch (e) {
      // Storage quota safety
    }
  }

  private getWorkoutQueue(): Array<{
    workout: any;
    status: 'PENDING' | 'UPLOADING' | 'SYNCED' | 'FAILED';
    retryCount: number;
    createdAt: number;
  }> {
    try {
      const data = localStorage.getItem(WORKOUT_QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private saveWorkoutQueue(queue: any[]) {
    try {
      localStorage.setItem(WORKOUT_QUEUE_KEY, JSON.stringify(queue));
    } catch (e) {
      // Storage quota safety
    }
  }
}

export const syncQueue = new SyncQueueManager();
