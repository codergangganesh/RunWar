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
  }

  /**
   * Flush point batches for a confirmed saved workout
   */
  public async flushWorkoutPoints(workoutId: string) {
    if (!navigator.onLine) return;
    const batches = this.getPointBatches().filter((b) => b.workoutId === workoutId);
    for (const batch of batches) {
      await this.processPointBatch(batch.batchId);
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

      // If parent workout record doesn't exist yet, keep PENDING without incrementing failure count
      if (err?.message?.includes('foreign key constraint') || err?.code === '23503') {
        if (idx !== -1) {
          currentBatches[idx].status = 'PENDING';
          this.savePointBatches(currentBatches);
        }
        return;
      }

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
        const w = item.workout;
        let targetUserId = w.user_id;
        if (!targetUserId || targetUserId === 'guest_user' || targetUserId === 'usr_guest_demo') {
          try {
            const { data: authData } = await insforge.auth.getCurrentUser();
            const authUser = (authData as any)?.user || authData;
            if (authUser?.id) {
              targetUserId = authUser.id;
            }
          } catch {}
        }

        if (!targetUserId || targetUserId === 'guest_user' || targetUserId === 'usr_guest_demo') {
          // User is currently a guest or offline without session - preserve in queue
          remaining.push(item);
          continue;
        }

        const dbPayload = {
          id: w.id,
          user_id: targetUserId,
          type: w.type,
          title: w.title,
          notes: w.notes || null,
          started_at: w.started_at,
          ended_at: w.ended_at,
          duration_seconds: w.duration_seconds,
          moving_duration_seconds: w.moving_duration_seconds || w.duration_seconds,
          paused_duration_seconds: w.paused_duration_seconds || 0,
          distance_meters: w.distance_meters,
          average_pace: w.average_pace,
          average_speed: w.average_speed,
          max_speed: w.max_speed || 0,
          calories: w.calories || 0,
          elevation_gain: w.elevation_gain || 0,
          elevation_loss: w.elevation_loss || 0,
          status: w.status || 'completed',
          route_coordinates: Array.isArray(w.route_coordinates) ? w.route_coordinates : [],
          splits: Array.isArray(w.splits) ? w.splits : [],
        };

        const { error } = await insforge.database
          .from('workouts')
          .upsert([dbPayload], { onConflict: 'id' });

        if (error) throw error;

        // Sync splits if present
        if (Array.isArray(w.splits) && w.splits.length > 0) {
          const splitsPayload = w.splits.map((s: any) => ({
            workout_id: w.id,
            user_id: targetUserId,
            split_number: s.split_number,
            distance_meters: s.distance_meters,
            duration_seconds: s.duration_seconds,
            pace: s.pace,
          }));
          try {
            await insforge.database.from('workout_splits').insert(splitsPayload);
          } catch {}
        }

        // Flush queued point batches for this confirmed workout
        await this.flushWorkoutPoints(w.id);

        syncedAny = true;
        workoutLogger.log('SYNC_SUCCESS', 'info', {
          type: 'completed_workout',
          title: item.workout.title,
          workoutId: w.id,
        }, w.id);
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
