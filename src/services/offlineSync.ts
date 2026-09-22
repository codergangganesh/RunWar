import { Workout } from '../types';
import { syncQueue } from './syncQueue';
import { workoutService } from './workoutService';

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
  queueWorkout(workout: Omit<Workout, 'id' | 'created_at'> & { id?: string }) {
    syncQueue.queueCompletedWorkout(workout);
  },

  /**
   * Sync any pending offline workouts to cloud
   */
  async syncPendingWorkouts(): Promise<void> {
    await syncQueue.processAllQueues();
  },

  /**
   * Initialize auto-sync listeners
   */
  initSyncListener() {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => {
      this.syncPendingWorkouts();
    });
  },
};
