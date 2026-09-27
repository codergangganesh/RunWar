import React from 'react';
import { Alarm } from '../../types';
import {
  ALARM_LABELS,
  getTriggerCountdownInfo,
  getUserTimezone,
} from '../../services/alarmService';
import { Clock, Pencil, Trash2 } from 'lucide-react';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime(time: string): string {
  try {
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  } catch {
    return time;
  }
}

function formatRecurrence(alarm: Alarm): string {
  if (alarm.recurrence === 'once') {
    return alarm.scheduled_date ? `Once · ${alarm.scheduled_date}` : 'Once';
  }
  if (alarm.recurrence === 'daily') return 'Every day';
  if ((alarm.recurrence === 'weekly' || alarm.recurrence === 'custom') && alarm.recurrence_days) {
    return alarm.recurrence_days.map((d) => DAY_NAMES[d]).join(', ');
  }
  return alarm.recurrence;
}

interface AlarmCardProps {
  alarm: Alarm;
  onToggle: (alarm: Alarm, enabled: boolean) => void;
  onEdit: (alarm: Alarm) => void;
  onDelete: (alarm: Alarm) => void;
  isToggling?: boolean;
}

export const AlarmCard: React.FC<AlarmCardProps> = ({
  alarm,
  onToggle,
  onEdit,
  onDelete,
  isToggling,
}) => {
  const countdown = alarm.enabled
    ? getTriggerCountdownInfo(
        alarm.scheduled_time,
        alarm.timezone || getUserTimezone(),
        alarm.recurrence,
        alarm.recurrence_days,
        alarm.scheduled_date,
      )
    : null;

  return (
    <div
      className={`relative flex flex-col gap-2.5 p-3.5 rounded-2xl border transition-all ${
        alarm.enabled
          ? 'bg-white dark:bg-slate-900 border-emerald-100 dark:border-slate-800 shadow-sm'
          : 'bg-slate-50/50 dark:bg-slate-950/50 border-slate-100 dark:border-slate-800/50 opacity-80'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Type icon + formatted time */}
        <div className="flex flex-col items-center gap-1 shrink-0 w-14">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm ${
              alarm.enabled
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
            }`}
          >
            <Clock size={16} />
          </div>
          <span
            className={`text-[10px] font-black font-mono tracking-tight ${
              alarm.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
            }`}
          >
            {formatTime(alarm.scheduled_time)}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-bold truncate ${
              alarm.enabled ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-500'
            }`}
          >
            {alarm.title}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                alarm.enabled
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
              }`}
            >
              {ALARM_LABELS[alarm.alarm_type]?.split(' ').slice(1).join(' ') || alarm.alarm_type}
            </span>
            <span className="text-[10px] text-slate-400 truncate">{formatRecurrence(alarm)}</span>
          </div>
        </div>

        {/* Actions (Pushed to the right edge with clean separator & refined edge buttons) */}
        <div className="flex items-center gap-2 shrink-0 ml-auto pl-2 border-l border-slate-100 dark:border-slate-800/80">
          {/* Toggle */}
          <button
            type="button"
            onClick={() => !isToggling && onToggle(alarm, !alarm.enabled)}
            disabled={isToggling}
            className={`w-10 h-5.5 rounded-full transition-colors relative shrink-0 cursor-pointer ${
              alarm.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
            } ${isToggling ? 'opacity-50' : ''}`}
            aria-label={alarm.enabled ? 'Disable alarm' : 'Enable alarm'}
          >
            <span
              className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-all ${
                alarm.enabled ? 'left-[20px]' : 'left-0.5'
              }`}
            />
          </button>

          {/* Edit & Delete Action Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit(alarm)}
              className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-500/15 border border-slate-200/80 dark:border-slate-700/80 hover:border-emerald-300 dark:hover:border-emerald-500/40 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 active:scale-90 transition-all cursor-pointer shadow-2xs"
              aria-label="Edit alarm"
              title="Edit Reminder"
            >
              <Pencil size={11} />
            </button>

            <button
              type="button"
              onClick={() => onDelete(alarm)}
              className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-500/15 border border-slate-200/80 dark:border-slate-700/80 hover:border-rose-300 dark:hover:border-rose-500/40 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 active:scale-90 transition-all cursor-pointer shadow-2xs"
              aria-label="Delete alarm"
              title="Delete Reminder"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>
      </div>

      {/* Countdown and next trigger indicator bar */}
      {alarm.enabled && countdown && (
        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800/60 text-[10px]">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Next trigger:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {countdown.label}
            </span>
          </div>
          <span className="text-slate-400 font-mono text-[9px]">
            {alarm.timezone?.split('/').pop()?.replace('_', ' ') || 'Local'}
          </span>
        </div>
      )}
    </div>
  );
};
