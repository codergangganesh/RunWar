import { DailyActivityMetrics, HourlyActivityBucket, DayStepSummary } from '../../types/dailyActivity';
import { UserProfile, Workout } from '../../types';
import { workoutService } from '../workoutService';
import { healthService } from './healthService';
import { toDeterministicUUID } from '../../utils/uuid';
import { googleHealthProvider, FN_DATA } from './googleHealthProvider';

const GOOGLE_FIT_AUTH_STORAGE_KEY = 'runwar_google_fit_token';

class DailyActivityService {
  /**
   * Get cached daily metrics for synchronous first-frame rendering
   */
  getCachedDailyMetrics(userId: string): DailyActivityMetrics | null {
    if (!userId) return null;
    try {
      const raw = localStorage.getItem(`runwar_daily_activity_${userId}`);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {}
    return null;
  }

  /**
   * Fetch today's comprehensive daily activity metrics from Google Health / Fit API,
   * database workouts, and profile settings.
   */
  async getTodayMetrics(
    userId: string,
    workouts: Workout[] = [],
    profile: UserProfile | null = null
  ): Promise<DailyActivityMetrics> {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();
    const todayEndMs = Date.now();

    // 1. Calculate workout-derived metrics from RUNWAR database
    const todayWorkouts = workouts.filter((w) => {
      const started = new Date(w.started_at).getTime();
      return started >= todayStartMs && started <= todayEndMs;
    });

    const runDistanceMeters = todayWorkouts.reduce(
      (sum, w) => sum + (w.distance_meters || 0),
      0
    );
    const runDistanceKm = Number((runDistanceMeters / 1000).toFixed(2));
    const workoutCalories = todayWorkouts.reduce(
      (sum, w) => sum + (w.calories || 0),
      0
    );

    // Calculate exercise days this week (Monday through Sunday)
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // Mon = 0, Sun = 6
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek);
    monday.setHours(0, 0, 0, 0);
    const mondayMs = monday.getTime();

    const weekWorkouts = workouts.filter((w) => new Date(w.started_at).getTime() >= mondayMs);
    const activeDaysSet = new Set(
      weekWorkouts.map((w) => new Date(w.started_at).toISOString().split('T')[0])
    );
    const exerciseDaysThisWeek = activeDaysSet.size;

    // Initialize 24 hourly buckets
    const hourlyBuckets: HourlyActivityBucket[] = Array.from({ length: 24 }, (_, h) => {
      const displayHour = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
      return {
        hour: h,
        label: displayHour,
        steps: 0,
        isActive: false,
      };
    });

    // Base defaults strictly from recorded workouts or zero
    let totalSteps = 0;
    let totalDistanceMeters = runDistanceMeters;
    let totalCalories = workoutCalories;
    let activeMinutes = todayWorkouts.reduce(
      (sum, w) => sum + Math.round((w.duration_seconds || 0) / 60),
      0
    );
    let hourlyActiveHours = 0;
    let floorsClimbed = 0;
    let sleepMinutes: number | null = null;
    let heartRateAvg: number | null = null;
    let restingHeartRate: number | null = null;
    let source: DailyActivityMetrics['source'] = todayWorkouts.length > 0 ? 'local_estimate' : 'device_pedometer';

    // 2. Fetch 7-Day History from Workouts DB as baseline (pure recorded workout data)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyHistory: DayStepSummary[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      const dStart = new Date(d);
      dStart.setHours(0, 0, 0, 0);
      const dEnd = new Date(d);
      dEnd.setHours(23, 59, 59, 999);

      const dWorkouts = workouts.filter((w) => {
        const t = new Date(w.started_at).getTime();
        return t >= dStart.getTime() && t <= dEnd.getTime();
      });
      const dDist = dWorkouts.reduce((sum, w) => sum + (w.distance_meters || 0), 0);
      const dCal = dWorkouts.reduce((sum, w) => sum + (w.calories || 0), 0);

      weeklyHistory.push({
        date: dStr,
        dayName: dayNames[d.getDay()],
        steps: 0,
        distanceKm: Number((dDist / 1000).toFixed(2)),
        calories: dCal,
        isCompleted: dWorkouts.length > 0,
      });
    }

    // Helper to get Google Fit token safely
    // Reads from localStorage (persisted across reloads) matching googleHealthProvider.ts
    const getGoogleToken = (): string | null => {
      // 1. Try the provider (authoritative, already reads localStorage)
      const active = healthService.getGoogleAccessToken();
      if (active) return active;
      // 2. Direct localStorage fallback (same key as googleHealthProvider)
      try {
        const item = localStorage.getItem(GOOGLE_FIT_AUTH_STORAGE_KEY);
        if (!item) return null;
        if (item.startsWith('{')) {
          const parsed = JSON.parse(item);
          if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
            localStorage.removeItem(GOOGLE_FIT_AUTH_STORAGE_KEY);
            return null;
          }
          return parsed.token || null;
        }
        return item;
      } catch {
        return null;
      }
    };

    const googleToken = getGoogleToken();
    // Only require a valid token — don't gate on connectionState.isConnected which
    // can be stale after a page refresh even when authorization is still valid.
    const isGoogleConnected = Boolean(googleToken);

    // ─── 2.5 Query persistent Google Health data via InsForge Backend ───
    let backendFitLoaded = false;
    const activeUserId = googleHealthProvider.getUserId();
    const userEmail = googleHealthProvider.getUserEmail();
    const deviceId = localStorage.getItem('runwar_device_user_id') || undefined;

    try {
      const backendRes = await fetch(FN_DATA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: activeUserId,
          email: userEmail,
          device_id: deviceId,
          start_ms: todayStartMs,
          end_ms: todayEndMs,
        }),
      });

      if (backendRes.ok) {
        const bData = await backendRes.json();
        if (bData && (bData.steps > 0 || bData.calories > 0 || bData.hourlyBuckets || bData.source === 'google_health')) {
          backendFitLoaded = true;
          totalSteps = Math.max(totalSteps, Number(bData.steps) || 0);
          totalCalories = Math.max(totalCalories, Number(bData.calories) || 0);
          totalDistanceMeters = Math.max(totalDistanceMeters, Number(bData.distanceMeters) || 0);
          activeMinutes = Math.max(activeMinutes, Number(bData.activeMinutes) || 0);
          source = 'google_health';

          // Store freshly obtained/refreshed access token and email
          if (bData.access_token) {
            googleHealthProvider.setAccessTokenDirectly(bData.access_token, Number(bData.expires_in) || 3600);
          }
          if (bData.accountEmail) {
            googleHealthProvider.setConnectionStateDirectly({
              isConnected: true,
              status: 'connected',
              accountEmail: bData.accountEmail,
            });
          }

          if (Array.isArray(bData.hourlyBuckets) && bData.hourlyBuckets.length > 0) {
            let activeHoursCount = 0;
            bData.hourlyBuckets.forEach((b: any) => {
              if (hourlyBuckets[b.hour]) {
                hourlyBuckets[b.hour].steps = b.steps;
                hourlyBuckets[b.hour].isActive = Boolean(b.isActive);
                if (b.isActive) activeHoursCount++;
              }
            });
            if (activeHoursCount > 0) hourlyActiveHours = activeHoursCount;
          }
        }
      }
    } catch (e) {
      console.warn('[DailyActivity] Backend google-fit-data fetch error:', e);
    }

    let hrMin: number | null = null;
    let hrMax: number | null = null;

    if (!backendFitLoaded && googleToken && isGoogleConnected) {
      try {
        const nowMs = Date.now();

        // ─── A1. Whole-Day Aggregate (single 24h bucket) ───────────────────────
        // IMPORTANT: bucketByTime is REQUIRED by the Google Fit Aggregate API.
        // Omitting it causes a 400 error and no data is returned.
        const reqBodyTodayTotal = {
          aggregateBy: [
            { dataTypeName: 'com.google.step_count.delta' },
            { dataTypeName: 'com.google.calories.expended' },
            { dataTypeName: 'com.google.distance.delta' },
            { dataTypeName: 'com.google.active_minutes' },
          ],
          bucketByTime: { durationMillis: 86400000 }, // ← REQUIRED: 24-hour bucket
          startTimeMillis: todayStartMs,
          endTimeMillis: nowMs > todayStartMs ? nowMs : todayStartMs + 3600000,
        };

        const resTodayTotal = await fetch(
          'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${googleToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(reqBodyTodayTotal),
          }
        );

        let gTotalSteps = 0;
        let gTotalCalories = 0;
        let gTotalDistance = 0;
        let gTotalActiveMins = 0;

        if (resTodayTotal.ok) {
          const totalData = await resTodayTotal.json();

          for (const b of totalData.bucket || []) {
            for (const ds of b.dataset || []) {
              const dtId = (ds.dataSourceId || '').toLowerCase();
              for (const pt of ds.point || []) {
                const ptType = (pt.dataTypeName || '').toLowerCase();
                const matchStr = ptType || dtId;
                for (const val of pt.value || []) {
                  if (matchStr.includes('step_count')) {
                    const s = val.intVal != null ? val.intVal : (typeof val.fpVal === 'number' ? Math.round(val.fpVal) : 0);
                    gTotalSteps += s;
                  } else if (matchStr.includes('calories')) {
                    gTotalCalories += val.fpVal ?? val.intVal ?? 0;
                  } else if (matchStr.includes('distance')) {
                    gTotalDistance += val.fpVal ?? val.intVal ?? 0;
                  } else if (matchStr.includes('active_minutes') || matchStr.includes('heart_minutes') || matchStr.includes('move_minutes')) {
                    gTotalActiveMins += val.intVal != null ? val.intVal : Math.round(val.fpVal || 0);
                  }
                }
              }
            }
          }

          // Apply authoritative totals immediately
          if (gTotalSteps > 0) { totalSteps = gTotalSteps; source = 'google_health'; }
          if (gTotalCalories > 0) totalCalories = Math.round(gTotalCalories);
          if (gTotalDistance > 0) totalDistanceMeters = Math.max(totalDistanceMeters, Math.round(gTotalDistance));
          if (gTotalActiveMins > 0) activeMinutes = Math.max(activeMinutes, gTotalActiveMins);
          if (gTotalSteps > 0 || gTotalCalories > 0) source = 'google_health';
        } else {
          const errBody = await resTodayTotal.text().catch(() => '');
          console.error('[DailyActivity] ❌ Whole-day aggregate HTTP', resTodayTotal.status, ':', errBody.slice(0, 500));
        }

        // A2. Query Today's Hourly Breakdown (24 hourly buckets)
        const reqBodyTodayHourly = {
          aggregateBy: [
            { dataTypeName: 'com.google.step_count.delta' },
            { dataTypeName: 'com.google.calories.expended' },
            { dataTypeName: 'com.google.distance.delta' },
            { dataTypeName: 'com.google.active_minutes' },
          ],
          bucketByTime: { durationMillis: 3600000 }, // 1-hour duration
          startTimeMillis: todayStartMs,
          endTimeMillis: todayStartMs + 86400000,
        };

        const resTodayHourly = await fetch(
          'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${googleToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(reqBodyTodayHourly),
          }
        );

        if (resTodayHourly.ok) {
          const data = await resTodayHourly.json();
          let hourlyStepsSum = 0;
          let activeHoursCount = 0;

          const buckets = data.bucket || [];
          for (let idx = 0; idx < buckets.length; idx++) {
            const b = buckets[idx];
            const bucketHour = new Date(Number(b.startTimeMillis)).getHours();
            let bucketSteps = 0;

            for (const ds of b.dataset || []) {
              const dtId = (ds.dataSourceId || '').toLowerCase();
              for (const pt of ds.point || []) {
                const ptType = (pt.dataTypeName || dtId).toLowerCase();
                for (const val of pt.value || []) {
                  if (ptType.includes('step_count') || dtId.includes('step_count')) {
                    const s = val.intVal ?? (typeof val.fpVal === 'number' ? Math.round(val.fpVal) : 0);
                    bucketSteps += s;
                  }
                }
              }
            }

            if (hourlyBuckets[bucketHour]) {
              hourlyBuckets[bucketHour].steps = bucketSteps;
              hourlyBuckets[bucketHour].isActive = bucketSteps >= 250;
            }

            hourlyStepsSum += bucketSteps;
            if (bucketSteps >= 250) {
              activeHoursCount++;
            }
          }

          // Reconcile with hourly sum — prefer whichever is larger
          const finalGoogleSteps = Math.max(gTotalSteps, hourlyStepsSum);
          if (finalGoogleSteps > totalSteps) totalSteps = finalGoogleSteps;
          // Re-apply hourly-derived metrics (already set above from whole-day, keep max)
          if (gTotalDistance > 0) totalDistanceMeters = Math.max(totalDistanceMeters, Math.round(gTotalDistance));
          if (gTotalCalories > 0) totalCalories = Math.max(totalCalories, Math.round(gTotalCalories));
          if (gTotalActiveMins > 0) activeMinutes = Math.max(activeMinutes, gTotalActiveMins);
          if (activeHoursCount > 0) hourlyActiveHours = activeHoursCount;
          source = 'google_health';
        }

        // B. Query 7-Day History Daily Buckets from Google Fit
        const sevenDaysAgoStart = new Date();
        sevenDaysAgoStart.setDate(sevenDaysAgoStart.getDate() - 6);
        sevenDaysAgoStart.setHours(0, 0, 0, 0);

        const reqBodyWeek = {
          aggregateBy: [
            { dataTypeName: 'com.google.step_count.delta' },
            { dataTypeName: 'com.google.distance.delta' },
            { dataTypeName: 'com.google.calories.expended' },
          ],
          bucketByTime: { durationMillis: 86400000 }, // 24-hour daily buckets
          startTimeMillis: sevenDaysAgoStart.getTime(),
          endTimeMillis: todayStartMs + 86400000,
        };

        const resWeek = await fetch(
          'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${googleToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(reqBodyWeek),
          }
        );

        if (resWeek.ok) {
          const weekData = await resWeek.json();
          const wBuckets = weekData.bucket || [];
          for (let i = 0; i < wBuckets.length && i < weeklyHistory.length; i++) {
            const b = wBuckets[i];
            let daySteps = 0;
            let dayDist = 0;
            let dayCal = 0;

            for (const ds of b.dataset || []) {
              const dtName = ds.dataSourceId || '';
              for (const pt of ds.point || []) {
                for (const val of pt.value || []) {
                  if (dtName.includes('step_count')) daySteps += val.intVal || (typeof val.fpVal === 'number' ? Math.round(val.fpVal) : 0);
                  else if (dtName.includes('distance')) dayDist += val.fpVal || val.intVal || 0;
                  else if (dtName.includes('calories')) dayCal += val.fpVal || val.intVal || 0;
                }
              }
            }

            if (daySteps > 0) {
              weeklyHistory[i].steps = daySteps;
              weeklyHistory[i].distanceKm = Number((dayDist / 1000).toFixed(2));
              weeklyHistory[i].calories = Math.round(dayCal);
              weeklyHistory[i].isCompleted = daySteps >= 10000;
            }
          }
        }
      } catch (err) {
        console.warn('Could not fetch live Google Fit daily aggregate:', err);
      }
    }

    // Calculate time segment breakdowns
    let morningSteps = 0;
    let afternoonSteps = 0;
    let eveningSteps = 0;
    let nightSteps = 0;
    let peakHour: { hour: number; label: string; steps: number } | null = null;
    let maxStepsInBucket = 0;

    for (const b of hourlyBuckets) {
      if (b.hour >= 5 && b.hour < 12) {
        morningSteps += b.steps;
      } else if (b.hour >= 12 && b.hour < 17) {
        afternoonSteps += b.steps;
      } else if (b.hour >= 17 && b.hour < 22) {
        eveningSteps += b.steps;
      } else {
        nightSteps += b.steps;
      }

      if (b.steps > maxStepsInBucket) {
        maxStepsInBucket = b.steps;
        peakHour = { hour: b.hour, label: b.label, steps: b.steps };
      }
    }

    const weightKg = profile?.weight ? Number(profile.weight) : null;
    const distanceKm = Number((totalDistanceMeters / 1000).toFixed(2));

    const metrics: DailyActivityMetrics = {
      date: todayStr,
      steps: totalSteps,
      stepGoal: 10000,
      distanceMeters: totalDistanceMeters,
      distanceKm: distanceKm,
      caloriesBurned: totalCalories,
      calorieGoal: 2200,
      activeMinutes: activeMinutes,
      activeMinutesGoal: 60,
      exerciseDaysThisWeek: exerciseDaysThisWeek,
      targetExerciseDays: 5,
      sleepDurationMinutes: sleepMinutes,
      floorsClimbed: floorsClimbed,
      hourlyActiveHours: hourlyActiveHours,
      targetHourlyHours: 9,
      weightKg: weightKg,
      runDistanceMeters: runDistanceMeters,
      runDistanceKm: runDistanceKm,
      heartRateAvg: heartRateAvg,
      restingHeartRate: restingHeartRate,
      heartRateMin: hrMin,
      heartRateMax: hrMax,
      morningSteps,
      afternoonSteps,
      eveningSteps,
      nightSteps,
      peakHour,
      hourlyBuckets: hourlyBuckets,
      weeklyHistory: weeklyHistory,
      lastSyncedAt: new Date().toISOString(),
      source,
      isGoogleConnected: Boolean(googleToken) || source === 'google_health' || googleHealthProvider.getConnectionState().isConnected,
    };

    // Cache to local storage
    if (userId) {
      try {
        localStorage.setItem(`runwar_daily_activity_${userId}`, JSON.stringify(metrics));
      } catch {}
    }

    return metrics;
  }

  /**
   * Parse Fitbit / Google Health UserExercises CSV (e.g. UserExercises_2026-06-01.csv)
   * into full RUNWAR workout sessions and persist them.
   */
  async importUserExercisesCsv(
    csvText: string,
    userId: string
  ): Promise<{ success: boolean; importedCount: number; workouts: Workout[] }> {
    if (!csvText || !userId) {
      return { success: false, importedCount: 0, workouts: [] };
    }

    try {
      const lines = csvText.trim().split(/\r?\n/);
      if (lines.length < 2) {
        return { success: false, importedCount: 0, workouts: [] };
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const idxStart = headers.indexOf('exercise_start');
      const idxEnd = headers.indexOf('exercise_end');
      const idxActivity = headers.indexOf('activity_name');
      const idxDistMm = headers.indexOf('tracker_total_distance_mm');
      const idxManDistMm = headers.indexOf('manually_logged_total_distance_mm');
      const idxCal = headers.indexOf('tracker_total_calories');
      const idxManCal = headers.indexOf('manually_logged_total_calories');
      const idxSteps = headers.indexOf('tracker_total_steps');
      const idxAvgHr = headers.indexOf('tracker_avg_heart_rate');
      const idxExerciseId = headers.indexOf('exercise_id');

      const workouts: Workout[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',');

        const rawStart = cols[idxStart];
        const rawEnd = cols[idxEnd];
        if (!rawStart || !rawEnd) continue;

        const startTime = new Date(rawStart).toISOString();
        const endTime = new Date(rawEnd).toISOString();
        const durationSec = Math.max(
          60,
          Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000)
        );

        const activityName = cols[idxActivity]?.trim() || 'Outdoor Run';
        const type = activityName.toLowerCase().includes('walk')
          ? 'walk'
          : activityName.toLowerCase().includes('jog')
            ? 'jog'
            : 'run';

        const distMm = parseFloat(cols[idxDistMm]) || parseFloat(cols[idxManDistMm]) || 0;
        let distanceMeters = Math.round(distMm / 1000);

        const steps = parseInt(cols[idxSteps] || '0', 10);
        if (distanceMeters <= 0 && steps > 0) {
          distanceMeters = Math.round(steps * 0.85);
        }
        if (distanceMeters <= 0) {
          const speedEst = type === 'run' ? 2.78 : type === 'jog' ? 2.08 : 1.39;
          distanceMeters = Math.round(durationSec * speedEst);
        }

        const cal = Math.round(
          parseFloat(cols[idxCal]) ||
            parseFloat(cols[idxManCal]) ||
            Math.max(25, durationSec * 0.12)
        );
        const avgHr = parseInt(cols[idxAvgHr] || '0', 10) || null;
        const rawExId = cols[idxExerciseId]?.trim() || `ex_${i}_${new Date(startTime).getTime()}`;
        const deterministicId = toDeterministicUUID(`${userId}_google_health_${rawExId}`);

        const avgSpeed = Number(((distanceMeters / 1000) / (durationSec / 3600)).toFixed(2));
        const avgPace = distanceMeters > 0 ? Math.round(durationSec / (distanceMeters / 1000)) : 0;

        workouts.push({
          id: deterministicId,
          user_id: userId,
          type,
          title: `Google Health ${activityName}`,
          notes: 'Imported from Google Health / Fitbit UserExercises',
          started_at: startTime,
          ended_at: endTime,
          duration_seconds: durationSec,
          moving_duration_seconds: durationSec,
          paused_duration_seconds: 0,
          distance_meters: distanceMeters,
          average_pace: avgPace,
          average_speed: avgSpeed,
          max_speed: Number((avgSpeed * 1.25).toFixed(2)),
          calories: cal,
          elevation_gain: 0,
          elevation_loss: 0,
          status: 'completed',
          route_coordinates: [],
          splits: [],
          heart_rate_avg: avgHr,
          source_provider: 'google_health',
          external_record_id: rawExId,
          created_at: new Date().toISOString(),
        });
      }

      const saveResult = await workoutService.saveImportedWorkouts(workouts);
      return {
        success: true,
        importedCount: saveResult.savedCount,
        workouts,
      };
    } catch (e: any) {
      console.error('Error importing UserExercises CSV:', e);
      return { success: false, importedCount: 0, workouts: [] };
    }
  }
}

export const dailyActivityService = new DailyActivityService();
