/**
 * RunWar Native IndexedDB Storage Layer
 * Provides high-capacity (hundreds of Gigabytes, up to 80% disk space) offline storage
 * for full workout traces and GPS coordinates without ever hitting browser localStorage quota limits.
 */

import { Workout } from '../types';

const DB_NAME = 'runwar_offline_db';
const DB_VERSION = 1;
const WORKOUTS_STORE = 'workouts_full';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB not supported in this environment'));
  }

  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(WORKOUTS_STORE)) {
          const store = db.createObjectStore(WORKOUTS_STORE, { keyPath: 'id' });
          store.createIndex('user_id', 'user_id', { unique: false });
          store.createIndex('started_at', 'started_at', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    } catch (err) {
      reject(err);
    }
  });

  return dbPromise;
}

export const indexedDbStorage = {
  /**
   * Save a single full workout with all GPS coordinates into IndexedDB
   */
  async saveWorkout(workout: Workout): Promise<void> {
    try {
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(WORKOUTS_STORE, 'readwrite');
        const store = tx.objectStore(WORKOUTS_STORE);
        const req = store.put(workout);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('IndexedDB saveWorkout notice:', err);
    }
  },

  /**
   * Batch save full workouts with high-frequency GPS into IndexedDB
   */
  async saveWorkoutsBatch(workouts: Workout[]): Promise<void> {
    if (!workouts || workouts.length === 0) return;
    try {
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(WORKOUTS_STORE, 'readwrite');
        const store = tx.objectStore(WORKOUTS_STORE);

        workouts.forEach((w) => {
          store.put(w);
        });

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.warn('IndexedDB saveWorkoutsBatch notice:', err);
    }
  },

  /**
   * Fetch full workout by ID including all high-res coordinates
   */
  async getWorkoutById(workoutId: string): Promise<Workout | null> {
    try {
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(WORKOUTS_STORE, 'readonly');
        const store = tx.objectStore(WORKOUTS_STORE);
        const req = store.get(workoutId);

        req.onsuccess = () => resolve((req.result as Workout) || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  },

  /**
   * Fetch all stored workouts for a user from IndexedDB
   */
  async getAllWorkouts(userId?: string): Promise<Workout[]> {
    try {
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(WORKOUTS_STORE, 'readonly');
        const store = tx.objectStore(WORKOUTS_STORE);
        const req = store.getAll();

        req.onsuccess = () => {
          let results = (req.result as Workout[]) || [];
          if (userId && userId !== 'guest_user') {
            results = results.filter((w) => w.user_id === userId);
          }
          resolve(results);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  },

  /**
   * Delete a workout from IndexedDB
   */
  async deleteWorkout(workoutId: string): Promise<void> {
    try {
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(WORKOUTS_STORE, 'readwrite');
        const store = tx.objectStore(WORKOUTS_STORE);
        const req = store.delete(workoutId);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('IndexedDB delete notice:', err);
    }
  },
};
