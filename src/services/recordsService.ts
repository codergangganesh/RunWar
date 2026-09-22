import { insforge } from '../lib/insforge';
import { PersonalRecord, Workout } from '../types';

const PR_CACHE_KEY = 'runwar_cached_prs';

const isGuest = (userId: string) => !userId || userId === 'guest_user' || userId === 'usr_guest_demo';

function getLocalPRs(): PersonalRecord[] {
  try {
    const raw = localStorage.getItem(PR_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalPRs(records: PersonalRecord[]) {
  try {
    localStorage.setItem(PR_CACHE_KEY, JSON.stringify(records));
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
      return getLocalPRs();
    }

    try {
      const { data, error } = await insforge.database
        .from('personal_records')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      const records = (data as PersonalRecord[]) || [];
      saveLocalPRs(records);
      return records;
    } catch (err) {
      console.warn('Failed to fetch PRs from cloud, using cache:', err);
      return getLocalPRs();
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

      // 1. Longest Distance
      const currentLongest = prMap.get('longest_distance');
      if (!currentLongest || workout.distance_meters > currentLongest.value) {
        const pr = await this.upsertRecord(userId, 'longest_distance', workout.distance_meters, workout.id);
        if (pr) newBrokenPRs.push(pr);
      }

      // 2. Longest Duration
      const currentDuration = prMap.get('longest_duration');
      if (!currentDuration || workout.duration_seconds > currentDuration.value) {
        const pr = await this.upsertRecord(userId, 'longest_duration', workout.duration_seconds, workout.id);
        if (pr) newBrokenPRs.push(pr);
      }

      // 3. Fastest 1K (from splits or single 1k+ workout)
      if (workout.distance_meters >= 1000) {
        const best1kSplitPace = workout.splits.length > 0
          ? Math.min(...workout.splits.filter((s) => s.distance_meters >= 800).map((s) => s.pace))
          : workout.average_pace;

        if (best1kSplitPace > 0) {
          const currentFastest1k = prMap.get('fastest_1k');
          if (!currentFastest1k || best1kSplitPace < currentFastest1k.value) {
            const pr = await this.upsertRecord(userId, 'fastest_1k', best1kSplitPace, workout.id);
            if (pr) newBrokenPRs.push(pr);
          }
        }
      }

      // 4. Fastest 5K
      if (workout.distance_meters >= 5000) {
        const currentFastest5k = prMap.get('fastest_5k');
        if (!currentFastest5k || workout.average_pace < currentFastest5k.value) {
          const pr = await this.upsertRecord(userId, 'fastest_5k', workout.average_pace, workout.id);
          if (pr) newBrokenPRs.push(pr);
        }
      }

      // 5. Fastest 10K
      if (workout.distance_meters >= 10000) {
        const currentFastest10k = prMap.get('fastest_10k');
        if (!currentFastest10k || workout.average_pace < currentFastest10k.value) {
          const pr = await this.upsertRecord(userId, 'fastest_10k', workout.average_pace, workout.id);
          if (pr) newBrokenPRs.push(pr);
        }
      }

      return newBrokenPRs;
    } catch (err) {
      console.warn('Error checking personal records:', err);
      return [];
    }
  },

  async upsertRecord(
    userId: string,
    recordType: PersonalRecord['record_type'],
    value: number,
    workoutId: string
  ): Promise<PersonalRecord | null> {
    const recordPayload: PersonalRecord = {
      id: crypto.randomUUID ? crypto.randomUUID() : `pr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      user_id: userId,
      record_type: recordType,
      value: Math.round(value),
      workout_id: workoutId,
      achieved_at: new Date().toISOString(),
    };

    if (isGuest(userId)) {
      const local = getLocalPRs();
      const existingIdx = local.findIndex((p) => p.record_type === recordType);
      if (existingIdx >= 0) {
        local[existingIdx] = recordPayload;
      } else {
        local.push(recordPayload);
      }
      saveLocalPRs(local);
      return recordPayload;
    }

    try {
      const payload = {
        user_id: userId,
        record_type: recordType,
        value: Math.round(value),
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

      // Update local cache
      const local = getLocalPRs();
      const existingIdx = local.findIndex((p) => p.record_type === recordType);
      if (existingIdx >= 0) {
        local[existingIdx] = res;
      } else {
        local.push(res);
      }
      saveLocalPRs(local);

      return res;
    } catch (e) {
      console.warn(`Error upserting PR ${recordType}:`, e);
      // Fallback to local
      const local = getLocalPRs();
      const existingIdx = local.findIndex((p) => p.record_type === recordType);
      if (existingIdx >= 0) {
        local[existingIdx] = recordPayload;
      } else {
        local.push(recordPayload);
      }
      saveLocalPRs(local);
      return recordPayload;
    }
  },
};

