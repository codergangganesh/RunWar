import { insforge } from '../lib/insforge';
import { PersonalRecord, Workout } from '../types';
import { toDeterministicUUID } from '../utils/uuid';

const PR_CACHE_KEY_PREFIX = 'runwar_cached_prs_';

const isGuest = (userId: string) => !userId || userId === 'guest_user' || userId === 'usr_guest_demo';

function getCacheKey(userId: string): string {
  const scope = isGuest(userId) ? (userId || 'guest_user') : toDeterministicUUID(userId);
  return `${PR_CACHE_KEY_PREFIX}${scope}`;
}

function getLocalPRs(userId: string): PersonalRecord[] {
  try {
    const raw = localStorage.getItem(getCacheKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalPRs(userId: string, records: PersonalRecord[]) {
  try {
    localStorage.setItem(getCacheKey(userId), JSON.stringify(records));
  } catch (e) {
    console.warn('Failed to cache PRs:', e);
  }
}

export const recordsService = {
  /**
   * Fetch all personal records for user
   */
  async getPersonalRecords(userId: string): Promise<PersonalRecord[]> {
    if (isGuest(userId)) {
      return getLocalPRs(userId);
    }

    const normalizedId = toDeterministicUUID(userId);

    try {
      const { data, error } = await insforge.database
        .from('personal_records')
        .select('*')
        .eq('user_id', normalizedId);

      if (error) {
        if (error.message && error.message.trim().length > 0) {
          console.warn('Failed to fetch PRs from cloud, using cache:', error.message);
        }
        return getLocalPRs(normalizedId);
      }
      const records = (data as PersonalRecord[]) || [];
      saveLocalPRs(normalizedId, records);
      return records;
    } catch (err: any) {
      if (err?.message && err.message.trim().length > 0) {
        console.warn('Failed to fetch PRs from cloud, using cache:', err.message);
      }
      return getLocalPRs(normalizedId);
    }
  },

  /**
   * Evaluate if newly saved workout breaks any personal records
   */
  async checkPersonalRecords(userId: string, workout: Workout): Promise<PersonalRecord[]> {
    try {
      const existingPRs = await this.getPersonalRecords(userId);
      const prMap = new Map(existingPRs.map((pr) => [pr.record_type, pr]));
      const newBrokenPRs: PersonalRecord[] = [];
      const hasValidPace = typeof workout.average_pace === 'number' && workout.average_pace > 0 && isFinite(workout.average_pace);

      // 1. Longest Distance
      const currentLongest = prMap.get('longest_distance');
      if (workout.distance_meters > 0 && (!currentLongest || workout.distance_meters > currentLongest.value)) {
        const pr = await this.upsertRecord(userId, 'longest_distance', workout.distance_meters, workout.id);
        if (pr) newBrokenPRs.push(pr);
      }

      // 2. Longest Duration
      const currentDuration = prMap.get('longest_duration');
      if (workout.duration_seconds > 0 && (!currentDuration || workout.duration_seconds > currentDuration.value)) {
        const pr = await this.upsertRecord(userId, 'longest_duration', workout.duration_seconds, workout.id);
        if (pr) newBrokenPRs.push(pr);
      }

      // 3. Fastest 1K (from splits or single 1k+ workout)
      if (workout.distance_meters >= 1000) {
        const validSplitPaces = (workout.splits || [])
          .filter((s) => s.distance_meters >= 800 && s.pace > 0)
          .map((s) => s.pace);
        const best1kSplitPace = validSplitPaces.length > 0
          ? Math.min(...validSplitPaces)
          : (hasValidPace ? workout.average_pace : 0);

        if (best1kSplitPace > 0) {
          const currentFastest1k = prMap.get('fastest_1k');
          if (!currentFastest1k || currentFastest1k.value <= 0 || best1kSplitPace < currentFastest1k.value) {
            const pr = await this.upsertRecord(userId, 'fastest_1k', best1kSplitPace, workout.id);
            if (pr) newBrokenPRs.push(pr);
          }
        }
      }

      // 4. Fastest 1 Mile (1609m)
      if (workout.distance_meters >= 1609 && hasValidPace) {
        const currentFastestMile = prMap.get('fastest_1mi');
        if (!currentFastestMile || currentFastestMile.value <= 0 || workout.average_pace < currentFastestMile.value) {
          const pr = await this.upsertRecord(userId, 'fastest_1mi', workout.average_pace, workout.id);
          if (pr) newBrokenPRs.push(pr);
        }
      }

      // 5. Fastest 3K
      if (workout.distance_meters >= 3000 && hasValidPace) {
        const currentFastest3k = prMap.get('fastest_3k');
        if (!currentFastest3k || currentFastest3k.value <= 0 || workout.average_pace < currentFastest3k.value) {
          const pr = await this.upsertRecord(userId, 'fastest_3k', workout.average_pace, workout.id);
          if (pr) newBrokenPRs.push(pr);
        }
      }

      // 6. Fastest 5K
      if (workout.distance_meters >= 5000 && hasValidPace) {
        const currentFastest5k = prMap.get('fastest_5k');
        if (!currentFastest5k || currentFastest5k.value <= 0 || workout.average_pace < currentFastest5k.value) {
          const pr = await this.upsertRecord(userId, 'fastest_5k', workout.average_pace, workout.id);
          if (pr) newBrokenPRs.push(pr);
        }
      }

      // 7. Fastest 10K
      if (workout.distance_meters >= 10000 && hasValidPace) {
        const currentFastest10k = prMap.get('fastest_10k');
        if (!currentFastest10k || currentFastest10k.value <= 0 || workout.average_pace < currentFastest10k.value) {
          const pr = await this.upsertRecord(userId, 'fastest_10k', workout.average_pace, workout.id);
          if (pr) newBrokenPRs.push(pr);
        }
      }

      // 8. Fastest Half Marathon (21.1 km)
      if (workout.distance_meters >= 21097 && hasValidPace) {
        const currentHalf = prMap.get('fastest_half_marathon');
        if (!currentHalf || currentHalf.value <= 0 || workout.average_pace < currentHalf.value) {
          const pr = await this.upsertRecord(userId, 'fastest_half_marathon', workout.average_pace, workout.id);
          if (pr) newBrokenPRs.push(pr);
        }
      }

      // 9. Highest Elevation Gain
      if (workout.elevation_gain && workout.elevation_gain > 5) {
        const currentElev = prMap.get('highest_elevation');
        if (!currentElev || workout.elevation_gain > currentElev.value) {
          const pr = await this.upsertRecord(userId, 'highest_elevation', workout.elevation_gain, workout.id);
          if (pr) newBrokenPRs.push(pr);
        }
      }

      // 10. Most Calories Burned
      if (workout.calories && workout.calories > 50) {
        const currentCals = prMap.get('most_calories');
        if (!currentCals || workout.calories > currentCals.value) {
          const pr = await this.upsertRecord(userId, 'most_calories', workout.calories, workout.id);
          if (pr) newBrokenPRs.push(pr);
        }
      }

      // 11. Max Speed Record
      if (workout.max_speed && workout.max_speed > 5) {
        const currentSpeed = prMap.get('max_speed');
        if (!currentSpeed || workout.max_speed > currentSpeed.value) {
          const pr = await this.upsertRecord(userId, 'max_speed', workout.max_speed, workout.id);
          if (pr) newBrokenPRs.push(pr);
        }
      }

      return newBrokenPRs;
    } catch (err) {
      console.warn('Error checking personal records:', err);
      return [];
    }
  },

  /**
   * Scan and recalculate all personal records across user's complete workout history
   * Clears existing PRs first so workout deletions stay accurate.
   */
  async recalculateAllPRs(userId: string, workouts: Workout[]): Promise<PersonalRecord[]> {
    const guestMode = isGuest(userId);
    const dbUserId = guestMode ? userId : toDeterministicUUID(userId);

    saveLocalPRs(dbUserId, []);
    if (!guestMode) {
      try {
        await insforge.database.from('personal_records').delete().eq('user_id', dbUserId);
      } catch (err) {
        console.warn('Could not clear stale PRs before recalculation:', err);
      }
    }

    const completed = (workouts || []).filter((w) => w.status === 'completed' || !w.status);
    if (completed.length === 0) return [];

    // Compute winning PR per category in memory (single batch upsert instead of N writes)
    const bestByType = new Map<PersonalRecord['record_type'], { value: number; workout: Workout }>();
    const considerMax = (type: PersonalRecord['record_type'], val: number, w: Workout) => {
      const cur = bestByType.get(type);
      if (!cur || val > cur.value) bestByType.set(type, { value: val, workout: w });
    };
    const considerMinPace = (type: PersonalRecord['record_type'], pace: number, w: Workout) => {
      if (!(pace > 0 && isFinite(pace))) return;
      const cur = bestByType.get(type);
      if (!cur || pace < cur.value) bestByType.set(type, { value: pace, workout: w });
    };

    for (const w of completed) {
      if (w.distance_meters > 0) considerMax('longest_distance', w.distance_meters, w);
      if (w.duration_seconds > 0) considerMax('longest_duration', w.duration_seconds, w);
      if (w.elevation_gain && w.elevation_gain > 5) considerMax('highest_elevation', w.elevation_gain, w);
      if (w.calories && w.calories > 50) considerMax('most_calories', w.calories, w);
      if (w.max_speed && w.max_speed > 5) considerMax('max_speed', Number(w.max_speed.toFixed(2)), w);

      const pace = typeof w.average_pace === 'number' ? w.average_pace : 0;
      if (w.distance_meters >= 1000) {
        const validSplitPaces = (w.splits || [])
          .filter((s) => s.distance_meters >= 800 && s.pace > 0)
          .map((s) => s.pace);
        const best1k = validSplitPaces.length > 0 ? Math.min(...validSplitPaces) : pace;
        considerMinPace('fastest_1k', best1k, w);
      }
      if (w.distance_meters >= 1609) considerMinPace('fastest_1mi', pace, w);
      if (w.distance_meters >= 3000) considerMinPace('fastest_3k', pace, w);
      if (w.distance_meters >= 5000) considerMinPace('fastest_5k', pace, w);
      if (w.distance_meters >= 10000) considerMinPace('fastest_10k', pace, w);
      if (w.distance_meters >= 21097) considerMinPace('fastest_half_marathon', pace, w);
    }

    const payloads = Array.from(bestByType.entries()).map(([recordType, entry]) => ({
      user_id: dbUserId,
      record_type: recordType,
      value: recordType === 'max_speed' ? Number(entry.value.toFixed(2)) : Math.round(entry.value),
      workout_id: entry.workout.id,
      achieved_at: entry.workout.ended_at || entry.workout.started_at || new Date().toISOString(),
    }));

    if (payloads.length === 0) return [];

    if (guestMode) {
      const localRecords: PersonalRecord[] = payloads.map((p) => ({
        ...p,
        id: crypto.randomUUID ? crypto.randomUUID() : `pr_${p.record_type}_${Date.now()}`,
      }));
      saveLocalPRs(dbUserId, localRecords);
      return localRecords;
    }

    try {
      const { data, error } = await insforge.database
        .from('personal_records')
        .upsert(payloads, { onConflict: 'user_id,record_type' })
        .select();
      if (!error && data) {
        const records = data as PersonalRecord[];
        saveLocalPRs(dbUserId, records);
        return records;
      }
    } catch (err) {
      console.warn('Error batch upserting recalculated PRs:', err);
    }

    return this.getPersonalRecords(dbUserId);
  },

  async upsertRecord(
    userId: string,
    recordType: PersonalRecord['record_type'],
    value: number,
    workoutId: string
  ): Promise<PersonalRecord | null> {
    const guestMode = isGuest(userId);
    const dbUserId = guestMode ? userId : toDeterministicUUID(userId);
    const formattedValue = recordType === 'max_speed' ? Number(value.toFixed(2)) : Math.round(value);

    const recordPayload: PersonalRecord = {
      id: crypto.randomUUID ? crypto.randomUUID() : `pr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      user_id: dbUserId,
      record_type: recordType,
      value: formattedValue,
      workout_id: workoutId,
      achieved_at: new Date().toISOString(),
    };

    if (guestMode) {
      const local = getLocalPRs(dbUserId);
      const existingIdx = local.findIndex((p) => p.record_type === recordType);
      if (existingIdx >= 0) {
        local[existingIdx] = recordPayload;
      } else {
        local.push(recordPayload);
      }
      saveLocalPRs(dbUserId, local);
      return recordPayload;
    }

    try {
      const payload = {
        user_id: dbUserId,
        record_type: recordType,
        value: formattedValue,
        workout_id: workoutId,
        achieved_at: new Date().toISOString(),
      };

      const { data, error } = await insforge.database
        .from('personal_records')
        .upsert([payload], { onConflict: 'user_id,record_type' })
        .select()
        .single();

      if (error) throw error;
      const res = data as PersonalRecord;

      const local = getLocalPRs(dbUserId);
      const existingIdx = local.findIndex((p) => p.record_type === recordType);
      if (existingIdx >= 0) {
        local[existingIdx] = res;
      } else {
        local.push(res);
      }
      saveLocalPRs(dbUserId, local);

      return res;
    } catch (e) {
      console.warn(`Error upserting PR ${recordType}:`, e);
      const local = getLocalPRs(dbUserId);
      const existingIdx = local.findIndex((p) => p.record_type === recordType);
      if (existingIdx >= 0) {
        local[existingIdx] = recordPayload;
      } else {
        local.push(recordPayload);
      }
      saveLocalPRs(dbUserId, local);
      return recordPayload;
    }
  },
};
