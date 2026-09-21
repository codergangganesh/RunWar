import { Workout } from '../types';
import { workoutService } from './workoutService';

const OFFLINE_QUEUE_KEY = 'runwar_offline_queue';
const ACTIVE_BACKUP_KEY = 'runwar_active_workout_backup';

export const offlineSync = {
  /**
   * Check if an unsaved active workout exists from a previous crash or closed tab
   */
  hasActiveWorkoutBackup(): boolean {
    const backup = localStorage.getItem(ACTIVE_BACKUP_KEY);
    if (!backup) return false;
    try {
      const parsed = JSON.parse(backup);
      return Boolean(parsed && parsed.coordinates && parsed.coordinates.length > 2 && parsed.distanceMeters > 50);
    } catch {
      return false;
    }
  },

  getActiveWorkoutBackup() {
    try {
      const data = localStorage.getItem(ACTIVE_BACKUP_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  clearActiveWorkoutBackup() {
    localStorage.removeItem(ACTIVE_BACKUP_KEY);
  },

  /**
   * Queue a workout to be uploaded when back online
   */
  queueWorkout(workout: Omit<Workout, 'id' | 'created_at'>) {
    const queue = this.getQueue();
    queue.push(workout);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  },

  getQueue(): Array<Omit<Workout, 'id' | 'created_at'>> {
    try {
      const data = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  /**
   * Sync any pending offline workouts to InsForge cloud
   */
  async syncPendingWorkouts(): Promise<number> {
    if (!navigator.onLine) return 0;
    const queue = this.getQueue();
    if (queue.length === 0) return 0;

    let syncedCount = 0;
    const remainingQueue: Array<Omit<Workout, 'id' | 'created_at'>> = [];

    for (const item of queue) {
      try {
        await workoutService.saveWorkout(item);
        syncedCount++;
      } catch (err) {
        console.warn('Failed to sync offline workout, keeping in queue:', err);
        remainingQueue.push(item);
      }
    }

    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remainingQueue));
    return syncedCount;
  },

  /**
   * Initialize auto-sync listeners
   */
  initSyncListener() {
    window.addEventListener('online', () => {
      console.log('Internet connectivity restored, syncing pending workouts...');
      this.syncPendingWorkouts();
    });
  },
};
