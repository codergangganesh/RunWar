import { insforge } from '../lib/insforge';
import { Alarm, AlarmType, AlarmRecurrence } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Extracts local date parts (year, month 0-indexed, day, hour 0-23, minute) for a Date in a timezone.
 */
export function getLocalDateParts(date: Date, tz: string) {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const partMap: Record<string, string> = {};
    for (const p of parts) partMap[p.type] = p.value;
    return {
      year: parseInt(partMap.year, 10),
      month: parseInt(partMap.month, 10) - 1,
      day: parseInt(partMap.day, 10),
      hour: parseInt(partMap.hour === '24' ? '0' : partMap.hour, 10),
      minute: parseInt(partMap.minute, 10),
    };
  } catch {
    return {
      year: date.getFullYear(),
      month: date.getMonth(),
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
    };
  }
}

/**
 * Given local (year, month 0-indexed, day, hours, minutes) in IANA timezone tz,
 * returns the EXACT corresponding UTC Date.
 */
export function buildDateInTimezone(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  tz: string,
): Date {
  try {
    const targetUtc = new Date(Date.UTC(year, month, day, hours, minutes, 0));
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(targetUtc);
    const partMap: Record<string, string> = {};
    for (const p of parts) partMap[p.type] = p.value;
    const tzHour = parseInt(partMap.hour === '24' ? '0' : partMap.hour, 10);
    const tzMin = parseInt(partMap.minute, 10);
    const tzDay = parseInt(partMap.day, 10);
    const asTzUtc = Date.UTC(parseInt(partMap.year, 10), parseInt(partMap.month, 10) - 1, tzDay, tzHour, tzMin, 0);
    const offsetMs = asTzUtc - targetUtc.getTime();
    return new Date(targetUtc.getTime() - offsetMs);
  } catch {
    return new Date(year, month, day, hours, minutes, 0);
  }
}

/**
 * Returns the day of the week (0=Sun, 6=Sat) in the given timezone.
 */
export function getWeekdayInTimezone(date: Date, tz: string): number {
  try {
    const str = date.toLocaleDateString('en-US', { timeZone: tz, weekday: 'short' });
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(str);
  } catch {
    return date.getDay();
  }
}

/**
 * Calculates the next UTC Date when this alarm should fire.
 * If the scheduled time is still in the future for today, triggers today.
 * Otherwise triggers tomorrow (daily) or next matching weekday.
 */
export function calculateNextTrigger(
  scheduledTime: string,
  timezone: string,
  recurrence: AlarmRecurrence,
  recurrenceDays: number[] | null,
  scheduledDate: string | null,
): Date | null {
  const [hours, minutes] = scheduledTime.split(':').map(Number);
  const now = new Date();
  const tz = timezone || getUserTimezone();
  const localToday = getLocalDateParts(now, tz);

  if (recurrence === 'once') {
    if (!scheduledDate) return null;
    const [y, mo, d] = scheduledDate.split('-').map(Number);
    const target = buildDateInTimezone(y, mo - 1, d, hours, minutes, tz);
    return target.getTime() > now.getTime() - 30000 ? target : null;
  }

  if (recurrence === 'daily') {
    const todayTarget = buildDateInTimezone(
      localToday.year,
      localToday.month,
      localToday.day,
      hours,
      minutes,
      tz,
    );
    // If target is in the future (or within the current minute), trigger today!
    if (todayTarget.getTime() - now.getTime() > -30000) {
      return todayTarget;
    }
    // Otherwise next occurrence is tomorrow
    const tomorrowLocal = new Date(todayTarget.getTime() + 24 * 60 * 60 * 1000);
    const tomParts = getLocalDateParts(tomorrowLocal, tz);
    return buildDateInTimezone(
      tomParts.year,
      tomParts.month,
      tomParts.day,
      hours,
      minutes,
      tz,
    );
  }

  if (recurrence === 'weekly' || recurrence === 'custom') {
    const days = recurrenceDays && recurrenceDays.length > 0 ? recurrenceDays : [1];
    return findNextWeekday(now, days, hours, minutes, tz);
  }

  return null;
}

function findNextWeekday(from: Date, days: number[], hours: number, minutes: number, tz: string): Date {
  const sortedDays = [...days].sort((a, b) => a - b);
  for (let i = 0; i <= 7; i++) {
    const candidate = new Date(from.getTime() + i * 24 * 60 * 60 * 1000);
    const localParts = getLocalDateParts(candidate, tz);
    const localWeekday = getWeekdayInTimezone(candidate, tz);
    if (sortedDays.includes(localWeekday)) {
      const target = buildDateInTimezone(
        localParts.year,
        localParts.month,
        localParts.day,
        hours,
        minutes,
        tz,
      );
      if (target.getTime() - from.getTime() > -30000) return target;
    }
  }
  const candidate = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
  const localParts = getLocalDateParts(candidate, tz);
  return buildDateInTimezone(
    localParts.year,
    localParts.month,
    localParts.day,
    hours,
    minutes,
    tz,
  );
}

/**
 * Calculates current local time + offsetMinutes and returns 'HH:MM' string.
 * Defaults to 2 minutes from right now so any new alarm is scheduled for TODAY.
 */
export function getDefaultTestTime(offsetMinutes: number = 2): string {
  const tz = getUserTimezone();
  const parts = getLocalDateParts(new Date(), tz);
  const targetTotalMin = parts.minute + offsetMinutes;
  const targetHour = (parts.hour + Math.floor(targetTotalMin / 60)) % 24;
  const finalMin = targetTotalMin % 60;
  return `${String(targetHour).padStart(2, '0')}:${String(finalMin).padStart(2, '0')}`;
}

/**
 * Returns human-friendly text for countdown to the next trigger
 */
export function getTriggerCountdownInfo(
  scheduledTime: string,
  timezone: string,
  recurrence: AlarmRecurrence,
  recurrenceDays?: number[] | null,
  scheduledDate?: string | null,
): {
  date: Date | null;
  label: string;
  diffMinutes: number;
  isToday: boolean;
  isTomorrow: boolean;
  timeStr: string;
  dayPrefix: string;
} {
  const nextDate = calculateNextTrigger(
    scheduledTime,
    timezone || getUserTimezone(),
    recurrence,
    recurrenceDays || null,
    scheduledDate || null,
  );

  if (!nextDate) {
    return {
      date: null,
      label: 'Past or not scheduled',
      diffMinutes: 0,
      isToday: false,
      isTomorrow: false,
      timeStr: scheduledTime,
      dayPrefix: '',
    };
  }

  const now = new Date();
  const diffMs = nextDate.getTime() - now.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / (60 * 1000)));

  const tz = timezone || getUserTimezone();
  const [h, m] = scheduledTime.split(':').map(Number);
  const h12 = h % 12 || 12;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const timeStr = `${h12}:${String(m).padStart(2, '0')} ${ampm}`;

  const nextParts = getLocalDateParts(nextDate, tz);
  const todayParts = getLocalDateParts(now, tz);
  const isToday =
    nextParts.year === todayParts.year &&
    nextParts.month === todayParts.month &&
    nextParts.day === todayParts.day;

  const isTomorrow =
    new Date(todayParts.year, todayParts.month, todayParts.day + 1).getDate() === nextParts.day;

  const dayPrefix = isToday
    ? 'Today'
    : isTomorrow
    ? 'Tomorrow'
    : nextDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: tz,
      });

  let countdownText = '';
  if (diffMinutes === 0) {
    countdownText = 'due now';
  } else if (diffMinutes < 60) {
    countdownText = `in ${diffMinutes} min${diffMinutes === 1 ? '' : 's'}`;
  } else {
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    countdownText = mins > 0 ? `in ${hours}h ${mins}m` : `in ${hours}h`;
  }

  return {
    date: nextDate,
    label: `${dayPrefix} at ${timeStr} (${countdownText})`,
    diffMinutes,
    isToday,
    isTomorrow,
    timeStr,
    dayPrefix,
  };
}

export const ALARM_LABELS: Record<AlarmType, string> = {
  morning_run: '🌅 Morning Run',
  evening_run: '🌆 Evening Run',
  stretch: '🧘 Stretch Reminder',
  hydration: '💧 Hydration Reminder',
  workout: '🏃 Workout Reminder',
  custom: '⏰ Custom Reminder',
};

export const ALARM_DEFAULT_MESSAGES: Record<AlarmType, string> = {
  morning_run: "Time for your morning run! Let's go! 🏃",
  evening_run: "Evening run time! Clear your head and run! 🌆",
  stretch: "Time to stretch! Keep your body flexible. 🧘",
  hydration: "Stay hydrated! Drink some water now. 💧",
  workout: "Your scheduled workout starts now. Get moving! 🏃",
  custom: "Your RunWar reminder. ⏰",
};

// ── Service ──────────────────────────────────────────────────────────────────

export const alarmService = {
  async getAlarms(userId: string): Promise<Alarm[]> {
    try {
      const { data, error } = await insforge.database
        .from('alarms')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) {
        console.warn('[alarmService] getAlarms error:', error.message);
        return [];
      }
      return (data as Alarm[]) || [];
    } catch (err: any) {
      console.warn('[alarmService] getAlarms exception:', err?.message);
      return [];
    }
  },

  async createAlarm(
    userId: string,
    data: {
      title: string;
      message?: string;
      alarm_type: AlarmType;
      scheduled_time: string;
      recurrence: AlarmRecurrence;
      recurrence_days?: number[];
      scheduled_date?: string;
      enabled?: boolean;
    },
  ): Promise<Alarm> {
    const tz = getUserTimezone();
    const nextTrigger = calculateNextTrigger(
      data.scheduled_time,
      tz,
      data.recurrence,
      data.recurrence_days || null,
      data.scheduled_date || null,
    );

    const payload = {
      user_id: userId,
      title: data.title,
      message: data.message || ALARM_DEFAULT_MESSAGES[data.alarm_type] || '',
      alarm_type: data.alarm_type,
      scheduled_time: data.scheduled_time,
      timezone: tz,
      enabled: data.enabled !== false,
      recurrence: data.recurrence,
      recurrence_days: data.recurrence_days || null,
      scheduled_date: data.scheduled_date || null,
      next_trigger_at: nextTrigger ? nextTrigger.toISOString() : null,
      last_triggered_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: created, error } = await insforge.database
      .from('alarms')
      .insert([payload])
      .select()
      .single();

    if (error) throw new Error(error.message || 'Failed to create alarm');
    console.log('[alarmService] Created:', created.id, 'Next trigger:', nextTrigger?.toISOString());
    return created as Alarm;
  },

  async updateAlarm(
    alarmId: string,
    updates: Partial<{
      title: string;
      message: string;
      alarm_type: AlarmType;
      scheduled_time: string;
      recurrence: AlarmRecurrence;
      recurrence_days: number[];
      scheduled_date: string;
      enabled: boolean;
    }>,
  ): Promise<Alarm> {
    const { data: current } = await insforge.database
      .from('alarms')
      .select('*')
      .eq('id', alarmId)
      .single();

    const tz = (current as Alarm)?.timezone || getUserTimezone();
    const time = updates.scheduled_time || (current as Alarm)?.scheduled_time || '06:00';
    const recurrence = updates.recurrence || (current as Alarm)?.recurrence || 'daily';
    const days = updates.recurrence_days || (current as Alarm)?.recurrence_days || null;
    const date =
      updates.scheduled_date !== undefined
        ? updates.scheduled_date
        : (current as Alarm)?.scheduled_date || null;

    const nextTrigger = calculateNextTrigger(time, tz, recurrence, days, date);

    const payload: any = {
      ...updates,
      next_trigger_at: nextTrigger ? nextTrigger.toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error } = await insforge.database
      .from('alarms')
      .update(payload)
      .eq('id', alarmId)
      .select()
      .single();

    if (error) throw new Error(error.message || 'Failed to update alarm');
    console.log('[alarmService] Updated:', alarmId, 'Next trigger:', nextTrigger?.toISOString());
    return updated as Alarm;
  },

  async toggleAlarm(alarmOrId: Alarm | string, enabled: boolean): Promise<void> {
    let alarm: Alarm | null = null;
    let alarmId: string;

    if (typeof alarmOrId === 'string') {
      alarmId = alarmOrId;
      const { data } = await insforge.database.from('alarms').select('*').eq('id', alarmId).single();
      alarm = data as Alarm;
    } else {
      alarm = alarmOrId;
      alarmId = alarm.id;
    }

    let nextTrigger: Date | null = null;
    if (enabled && alarm) {
      nextTrigger = calculateNextTrigger(
        alarm.scheduled_time,
        alarm.timezone,
        alarm.recurrence,
        alarm.recurrence_days,
        alarm.scheduled_date,
      );
    }
    const { error } = await insforge.database
      .from('alarms')
      .update({
        enabled,
        next_trigger_at: enabled && nextTrigger ? nextTrigger.toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', alarmId);

    if (error) throw new Error(error.message || 'Failed to toggle alarm');
  },

  async deleteAlarm(alarmId: string): Promise<void> {
    const { error } = await insforge.database.from('alarms').delete().eq('id', alarmId);
    if (error) throw new Error(error.message || 'Failed to delete alarm');
    console.log('[alarmService] Deleted:', alarmId);
  },
};

