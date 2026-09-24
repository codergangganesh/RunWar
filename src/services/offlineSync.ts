import { Workout } from '../types';
import { syncQueue } from './syncQueue';
import { workoutService } from './workoutService';
import { authService } from './authService';

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
      return Boolean(
        parsed &&
        parsed.workoutId &&
        (parsed.engineState === 'ACTIVE' || parsed.engineState === 'PAUSED' || parsed.status === 'tracking' || parsed.status === 'paused')
      );
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
    try {
      const user = authService.getCachedUser();
      if (user?.id && user.id !== 'guest_user') {
        await workoutService.syncPendingWorkouts(user.id);
      }
    } catch (e) {
      console.warn('Error syncing pending workouts in offlineSync:', e);
    }
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
