import React, { useState, useEffect } from 'react';
import { Target, X, Check, Plus, Minus, Footprints, Sparkles } from 'lucide-react';

interface EditStepGoalModalProps {
  isOpen: boolean;
  currentGoal: number;
  todaySteps: number;
  onSave: (newGoal: number) => Promise<void> | void;
  onClose: () => void;
}

const PRESET_GOALS = [
  { value: 6000, label: '6,000', desc: 'Light' },
  { value: 8000, label: '8,000', desc: 'Moderate' },
  { value: 10000, label: '10,000', desc: 'Recommended' },
  { value: 12500, label: '12,500', desc: 'Active' },
  { value: 15000, label: '15,000', desc: 'Athlete' },
];

export const EditStepGoalModal: React.FC<EditStepGoalModalProps> = ({
  isOpen,
  currentGoal,
  todaySteps,
  onSave,
  onClose,
}) => {
  const [goal, setGoal] = useState<number>(currentGoal || 10000);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setGoal(currentGoal || 10000);
    }
  }, [isOpen, currentGoal]);

  if (!isOpen) return null;

  const handleIncrement = (amount: number) => {
    setGoal((prev) => Math.min(100000, Math.max(1000, prev + amount)));
  };

  const handleSave = async () => {
    if (goal < 1000 || goal > 100000) return;
    setIsSaving(true);
    try {
      await onSave(goal);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const progressPct = Math.min(100, Math.round((todaySteps / Math.max(1, goal)) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div 
        className="w-full max-w-sm bg-white dark:bg-[#181C22] border border-slate-200/90 dark:border-slate-800/90 rounded-3xl p-5 shadow-2xl space-y-4 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Target size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Daily Step Goal</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Set your daily activity target</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Number Display & Steppers */}
        <div className="bg-slate-50 dark:bg-[#121418] rounded-2xl p-4 border border-slate-100 dark:border-slate-800/60 text-center space-y-2">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Target Steps / Day
          </span>
          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() => handleIncrement(-500)}
              disabled={goal <= 1000}
              className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 hover:border-emerald-400 flex items-center justify-center active:scale-95 disabled:opacity-40 cursor-pointer shadow-xs"
            >
              <Minus size={16} />
            </button>

            <div className="flex-1">
              <input
                type="number"
                min={1000}
                max={100000}
                step={500}
                value={goal}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) setGoal(val);
                }}
                className="w-full text-center text-3xl font-black font-display text-slate-900 dark:text-white bg-transparent outline-none focus:ring-0"
              />
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {goal.toLocaleString()} steps
              </span>
            </div>

            <button
              type="button"
              onClick={() => handleIncrement(500)}
              disabled={goal >= 100000}
              className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 hover:border-emerald-400 flex items-center justify-center active:scale-95 disabled:opacity-40 cursor-pointer shadow-xs"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Presets Grid */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Quick Targets
          </span>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
            {PRESET_GOALS.map((preset) => {
              const isSelected = goal === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setGoal(preset.value)}
                  className={`py-2 px-1 rounded-xl text-center border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-500/30'
                      : 'bg-white dark:bg-[#15181E] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-400'
                  }`}
                >
                  <div className="text-[11px] font-extrabold">{preset.label}</div>
                  <div className={`text-[8px] ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                    {preset.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Progress Preview */}
        <div className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 text-xs text-emerald-900 dark:text-emerald-300 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="flex items-center gap-1">
              <Footprints size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span>Today's Progress:</span>
            </span>
            <span className="font-mono">{progressPct}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-emerald-200 dark:bg-emerald-900/60 overflow-hidden">
            <div
              style={{ width: `${progressPct}%` }}
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
            />
          </div>
          <p className="text-[10px] text-slate-600 dark:text-slate-400 text-center pt-0.5">
            {todaySteps >= goal
              ? '🎉 You have already surpassed this goal today!'
              : `${(goal - todaySteps).toLocaleString()} more steps to reach this target`}
          </p>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || goal < 1000}
            className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <Check size={14} />
            <span>{isSaving ? 'Saving...' : 'Set Goal'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
