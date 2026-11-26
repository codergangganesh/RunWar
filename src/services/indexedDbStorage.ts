/**
 * RunWar Native IndexedDB Storage Layer
 * Provides high-capacity (hundreds of Gigabytes, up to 80% disk space) offline storage
 * for full workout traces and GPS coordinates without ever hitting browser localStorage quota limits.
 */

import { Workout, GPSCoordinate } from '../types';

const DB_NAME = 'runwar_offline_db';
const DB_VERSION = 2;
const WORKOUTS_STORE = 'workouts_full';
const LIVE_TRACES_STORE = 'live_traces';

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
        if (!db.objectStoreNames.contains(LIVE_TRACES_STORE)) {
          db.createObjectStore(LIVE_TRACES_STORE, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };

      request.onblocked = () => {
        dbPromise = null;
        reject(new Error('IndexedDB upgrade blocked'));
      };
    } catch (err) {
      dbPromise = null;
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
        store.put(workout);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
      });
    } catch (err) {
      console.warn('IndexedDB saveWorkout notice:', err);
    }
  },

  /**
   * Batch save full workouts with high-frequency GPS into IndexedDB.
   * If incoming record is a lightweight summary without route_coordinates,
   * preserves previously cached route_coordinates so detailed traces are never erased.
   */
  async saveWorkoutsBatch(workouts: Workout[]): Promise<void> {
    if (!workouts || workouts.length === 0) return;
    try {
      const db = await getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(WORKOUTS_STORE, 'readwrite');
        const store = tx.objectStore(WORKOUTS_STORE);

        workouts.forEach((w) => {
          if (!w.route_coordinates || w.route_coordinates.length === 0) {
            const getReq = store.get(w.id);
            getReq.onsuccess = () => {
              const existing = getReq.result as Workout | undefined;
              if (existing && existing.route_coordinates && existing.route_coordinates.length > 0) {
                store.put({
                  ...w,
                  route_coordinates: existing.route_coordinates,
                });
              } else {
                store.put(w);
              }
            };
            getReq.onerror = () => {
              store.put(w);
            };
          } else {
            store.put(w);
          }
        });

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('IndexedDB batch transaction aborted'));
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
          let results = ((req.result as Workout[]) || []).filter(
            (w) => !String(w.id || '').startsWith('live_trace_') && w.user_id !== 'active_session'
          );
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
        store.delete(workoutId);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('IndexedDB delete aborted'));
      });
    } catch (err) {
      console.warn('IndexedDB delete notice:', err);
    }
  },

  /**
   * Clear all stored workouts for a user from IndexedDB
   */
  async clearUserWorkouts(userId?: string): Promise<void> {
    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(WORKOUTS_STORE, 'readwrite');
        const store = tx.objectStore(WORKOUTS_STORE);
        const req = store.getAllKeys();
        req.onsuccess = async () => {
          if (!userId) {
            store.clear();
            return;
          }
          const cursorReq = store.openCursor();
          cursorReq.onsuccess = (ev) => {
            const cursor = (ev.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (cursor) {
              const val = cursor.value as any;
              if (val?.user_id === userId || String(cursor.key).startsWith('live_trace_')) {
                cursor.delete();
              }
              cursor.continue();
            }
          };
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // Non-blocking fallback
    }
  },

  /**
   * Save live workout GPS coordinates trace asynchronously in dedicated store
   */
  async saveLiveWorkoutTrace(workoutId: string, coordinates: GPSCoordinate[]): Promise<void> {
    try {
      const db = await getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(LIVE_TRACES_STORE, 'readwrite');
        const store = tx.objectStore(LIVE_TRACES_STORE);
        store.put({
          id: `live_trace_${workoutId}`,
          route_coordinates: coordinates,
          created_at: new Date().toISOString(),
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // Non-blocking fallback
    }
  },

  /**
   * Fetch live workout GPS coordinates trace for crash recovery
   */
  async getLiveWorkoutTrace(workoutId: string): Promise<GPSCoordinate[] | null> {
    try {
      const db = await getDb();
      const trace = await new Promise<GPSCoordinate[] | null>((resolve) => {
        const tx = db.transaction(LIVE_TRACES_STORE, 'readonly');
        const store = tx.objectStore(LIVE_TRACES_STORE);
        const req = store.get(`live_trace_${workoutId}`);
        req.onsuccess = () => resolve(req.result?.route_coordinates || null);
        req.onerror = () => resolve(null);
      });
      if (trace && trace.length > 0) return trace;

      // Fallback check in WORKOUTS_STORE for pre-v2 crash backups
      return new Promise((resolve) => {
        const tx = db.transaction(WORKOUTS_STORE, 'readonly');
        const store = tx.objectStore(WORKOUTS_STORE);
        const req = store.get(`live_trace_${workoutId}`);
        req.onsuccess = () => resolve(req.result?.route_coordinates || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  },

  /**
   * Clean up live trace backup once workout is finished or discarded
   */
  async clearLiveWorkoutTrace(workoutId: string): Promise<void> {
    try {
      const db = await getDb();
      const storeNames = db.objectStoreNames.contains(WORKOUTS_STORE)
        ? [LIVE_TRACES_STORE, WORKOUTS_STORE]
        : [LIVE_TRACES_STORE];
      return new Promise((resolve) => {
        const tx = db.transaction(storeNames, 'readwrite');
        tx.objectStore(LIVE_TRACES_STORE).delete(`live_trace_${workoutId}`);
        if (storeNames.includes(WORKOUTS_STORE)) {
          tx.objectStore(WORKOUTS_STORE).delete(`live_trace_${workoutId}`);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // Non-blocking fallback
    }
  },
};
