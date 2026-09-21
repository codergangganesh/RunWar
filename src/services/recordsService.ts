import { insforge } from '../lib/insforge';
import { PersonalRecord, Workout } from '../types';

export const recordsService = {
  /**
   * Fetch all personal records for user
   */
  async getPersonalRecords(userId: string): Promise<PersonalRecord[]> {
    try {
      const { data, error } = await insforge.database
        .from('personal_records')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      return (data as PersonalRecord[]) || [];
    } catch (err) {
      console.warn('Failed to fetch PRs:', err);
      return [];
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
      return data as PersonalRecord;
    } catch (e) {
      console.warn(`Error upserting PR ${recordType}:`, e);
      return null;
    }
  },
};
