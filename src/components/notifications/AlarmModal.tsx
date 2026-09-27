import React, { useState, useEffect } from 'react';
import { Alarm, AlarmType, AlarmRecurrence } from '../../types';
import {
  alarmService,
  ALARM_LABELS,
  ALARM_DEFAULT_MESSAGES,
  getTriggerCountdownInfo,
  getUserTimezone,
} from '../../services/alarmService';
import { BottomSheet } from '../ui/BottomSheet';
import { Clock, Loader2, Check, Bell, BellOff, AlertTriangle } from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ALARM_TYPE_ITEMS: { type: AlarmType; emoji: string; label: string; defaultTitle: string }[] = [
  { type: 'morning_run', emoji: '🌅', label: 'Morning Run', defaultTitle: 'Morning Run' },
  { type: 'evening_run', emoji: '🌆', label: 'Evening Run', defaultTitle: 'Evening Run' },
  { type: 'workout', emoji: '🏃', label: 'Workout', defaultTitle: 'Workout' },
  { type: 'stretch', emoji: '🧘', label: 'Stretch', defaultTitle: 'Stretch Routine' },
  { type: 'hydration', emoji: '💧', label: 'Hydration', defaultTitle: 'Hydration' },
  { type: 'custom', emoji: '⏰', label: 'Custom', defaultTitle: 'Running Reminder' },
];

interface AlarmModalProps {
  isOpen?: boolean;
  userId: string;
  editAlarm?: Alarm | null;
  onSave: (alarm: Alarm) => void;
  onClose: () => void;
  isPushEnabled: boolean;
}

function formatPreviewTime(timeStr: string): string {
  try {
    const [h, m] = timeStr.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  } catch {
    return timeStr;
  }
}

export const AlarmModal: React.FC<AlarmModalProps> = ({
  isOpen = true,
  userId,
  editAlarm,
  onSave,
  onClose,
  isPushEnabled,
}) => {
  const [alarmType, setAlarmType] = useState<AlarmType>(editAlarm?.alarm_type || 'morning_run');
  const [title, setTitle] = useState(editAlarm?.title || 'Morning Run');
  const [message, setMessage] = useState(editAlarm?.message || ALARM_DEFAULT_MESSAGES.morning_run);
  const [time, setTime] = useState(editAlarm?.scheduled_time?.slice(0, 5) || '06:00');
  const [recurrence, setRecurrence] = useState<AlarmRecurrence>(editAlarm?.recurrence || 'daily');
  const [days, setDays] = useState<number[]>(editAlarm?.recurrence_days || [1, 3, 5]);
  const [scheduledDate, setScheduledDate] = useState(
    editAlarm?.scheduled_date || new Date().toISOString().split('T')[0]
  );
  const [enabled, setEnabled] = useState(editAlarm?.enabled !== false);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state whenever sheet opens or edit target changes
  useEffect(() => {
    if (isOpen) {
      if (editAlarm) {
        setAlarmType(editAlarm.alarm_type);
        setTitle(editAlarm.title);
        setMessage(editAlarm.message || ALARM_DEFAULT_MESSAGES[editAlarm.alarm_type]);
        setTime(editAlarm.scheduled_time?.slice(0, 5) || '06:00');
        setRecurrence(editAlarm.recurrence || 'daily');
        setDays(editAlarm.recurrence_days || [1, 3, 5]);
        setScheduledDate(editAlarm.scheduled_date || new Date().toISOString().split('T')[0]);
        setEnabled(editAlarm.enabled !== false);
      } else {
        setAlarmType('morning_run');
        setTitle('Morning Run');
        setMessage(ALARM_DEFAULT_MESSAGES.morning_run);
        setTime('06:00');
        setRecurrence('daily');
        setDays([1, 3, 5]);
        setScheduledDate(new Date().toISOString().split('T')[0]);
        setEnabled(true);
      }
      setIsSaving(false);
      setSuccess(false);
      setError(null);
    }
  }, [isOpen, editAlarm]);

  const handleTypeChange = (t: AlarmType) => {
    setAlarmType(t);
    const item = ALARM_TYPE_ITEMS.find((i) => i.type === t);
    setTitle(item ? item.defaultTitle : ALARM_LABELS[t].replace(/^\S+\s/, ''));
    setMessage(ALARM_DEFAULT_MESSAGES[t]);
  };

  const toggleDay = (d: number) => {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]
    );
  };

  // Compute live trigger preview
  const countdownInfo = getTriggerCountdownInfo(
    time,
    getUserTimezone(),
    recurrence,
    days,
    recurrence === 'once' ? scheduledDate : undefined,
  );

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) { setError('Please enter a title'); return; }
    if (recurrence === 'once' && !scheduledDate) { setError('Please select a date'); return; }
    if ((recurrence === 'weekly' || recurrence === 'custom') && days.length === 0) {
      setError('Please select at least one day for weekly recurrence'); return;
    }

    setIsSaving(true);
    setError(null);
    try {
      let saved: Alarm;
      const data = {
        title: title.trim(),
        message: message.trim() || ALARM_DEFAULT_MESSAGES[alarmType],
        alarm_type: alarmType,
        scheduled_time: time,
        recurrence,
        recurrence_days: (recurrence === 'weekly' || recurrence === 'custom') ? days : undefined,
        scheduled_date: recurrence === 'once' ? scheduledDate : undefined,
        enabled,
      };

      if (editAlarm) {
        saved = await alarmService.updateAlarm(editAlarm.id, data);
      } else {
        saved = await alarmService.createAlarm(userId, data);
      }

      setSuccess(true);
      setTimeout(() => {
        onSave(saved);
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err?.message || 'Failed to save alarm');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={editAlarm ? 'Edit Running Alarm' : 'New Running Alarm'}
      icon={<Clock size={18} className="text-emerald-500" />}
    >
      <form onSubmit={handleSave} className="space-y-4 text-left">
        {/* Reminder Type (Minimal & Compact) */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
            Reminder Type
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {ALARM_TYPE_ITEMS.map((item) => {
              const isSelected = alarmType === item.type;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => handleTypeChange(item.type)}
                  className={`py-2 px-2 rounded-xl border text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer ${isSelected
                    ? 'bg-emerald-500 text-white border-emerald-500 font-bold shadow-xs shadow-emerald-500/25'
                    : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200/90 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-slate-700 font-medium'
                    }`}
                >
                  <span className="text-sm shrink-0 leading-none">{item.emoji}</span>
                  <span className="truncate text-[11px] tracking-tight">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
            Title
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="e.g. Morning 5km Run"
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-all font-medium"
          />
        </div>

        {/* Message */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
            Notification Message <span className="text-slate-400 font-normal lowercase">(optional)</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="Notification message..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-all resize-none font-medium"
          />
        </div>

        {/* Scheduled Time */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Time
            </label>
            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {formatPreviewTime(time)}
            </span>
          </div>

          <input
            type="time"
            required
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-all font-mono"
          />

          {/* Trigger schedule preview */}
          <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full shrink-0 ${countdownInfo.isToday ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
              Next scheduled: <strong className="font-bold text-slate-900 dark:text-white">{countdownInfo.label}</strong>
            </span>
          </div>
        </div>

        {/* Repeat Mode */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
            Repeat
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(['daily', 'weekly', 'once', 'custom'] as AlarmRecurrence[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRecurrence(r)}
                className={`py-2 px-1 rounded-xl text-xs font-bold capitalize transition-all active:scale-95 cursor-pointer ${recurrence === r
                  ? 'bg-emerald-500 text-white shadow-2xs shadow-emerald-500/20'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Day selector for weekly / custom */}
        {(recurrence === 'weekly' || recurrence === 'custom') && (
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Select Days
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {DAYS.map((day, idx) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(idx)}
                  className={`w-9 h-9 rounded-xl text-xs font-bold transition-all active:scale-90 cursor-pointer ${days.includes(idx)
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                >
                  {day.slice(0, 2)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date for once */}
        {recurrence === 'once' && (
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Date
            </label>
            <input
              type="date"
              required
              value={scheduledDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 transition-all"
            />
          </div>
        )}

        {/* Enable toggle */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            {enabled ? (
              <Bell size={16} className="text-emerald-500" />
            ) : (
              <BellOff size={16} className="text-slate-400" />
            )}
            <div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                Enable Reminder
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {enabled ? 'Alarm will trigger on schedule' : 'Paused — will not trigger'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEnabled((v) => !v)}
            className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${enabled ? 'left-[22px]' : 'left-0.5'
                }`}
            />
          </button>
        </div>

        {/* Push notification status notice */}
        {!isPushEnabled && (
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
            <AlertTriangle size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300 font-medium">
              Enable Notification To Trigger Your Alarms and Reminders
            </p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className={`w-full py-3.5 px-4 rounded-2xl font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 ${success
              ? 'bg-emerald-600 text-white shadow-emerald-500/30'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/25'
              }`}
          >
            {isSaving && <Loader2 size={15} className="animate-spin" />}
            {success && <Check size={15} />}
            <span>
              {success
                ? 'Saved!'
                : isSaving
                  ? 'Saving Reminder...'
                  : editAlarm
                    ? 'Update Reminder'
                    : 'Save Reminder'}
            </span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </form>
    </BottomSheet>
  );
};
