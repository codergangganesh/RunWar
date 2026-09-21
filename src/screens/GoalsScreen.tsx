import React, { useState } from 'react';
import { Goal, UserProfile } from '../types';
import { goalsService } from '../services/goalsService';
import { BottomSheet } from '../components/ui/BottomSheet';
import { Target, Plus, CheckCircle2, Pause, Play, Trash2, Trophy, Flame } from 'lucide-react';

interface GoalsScreenProps {
  goals: Goal[];
  profile: UserProfile | null;
  onRefresh: () => void;
}

export const GoalsScreen: React.FC<GoalsScreenProps> = ({ goals, profile, onRefresh }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [goalType, setGoalType] = useState<Goal['goal_type']>('weekly_distance');
  const [targetValue, setTargetValue] = useState<number>(20);
  const [period, setPeriod] = useState<Goal['period']>('weekly');
  const [loading, setLoading] = useState(false);

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);

    try {
      await goalsService.createGoal({
        user_id: profile.user_id,
        goal_type: goalType,
        target_value: targetValue,
        period,
        status: 'active',
      });
      setShowCreateModal(false);
      onRefresh();
    } catch (err) {
      console.error('Error creating goal:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (goal: Goal) => {
    const nextStatus = goal.status === 'active' ? 'paused' : 'active';
    await goalsService.updateGoalStatus(goal.id, nextStatus);
    onRefresh();
  };

  const handleDelete = async (goalId: string) => {
    await goalsService.deleteGoal(goalId);
    onRefresh();
  };

  return (
    <div className="p-4 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h2 className="font-display text-2xl font-black text-emerald-950 dark:text-white tracking-tight">
            Fitness Goals
          </h2>
          <p className="text-xs text-emerald-800/80 dark:text-slate-400 mt-0.5">
            Set targets to keep your training consistent
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="py-2 px-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white dark:text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/30 dark:shadow-glow-brand flex items-center gap-1.5 transition-all"
        >
          <Plus size={16} />
          <span>New Goal</span>
        </button>
      </div>

      {/* Goals List */}
      <div className="space-y-3">
        {goals.length === 0 ? (
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 p-8 text-center space-y-3 animate-scale-in shadow-md">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Target size={24} />
            </div>
            <h3 className="text-base font-bold text-emerald-950 dark:text-white">No active goals yet</h3>
            <p className="text-xs text-emerald-800/80 dark:text-slate-400 max-w-xs mx-auto">
              Create a weekly or monthly target (e.g. 20 km this week) to track your consistency.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="py-2.5 px-5 rounded-xl bg-emerald-500 text-white dark:text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/30 dark:shadow-glow-brand active:scale-95 transition-all"
            >
              Create Your First Goal
            </button>
          </div>
        ) : (
          goals.map((goal) => {
            const isCompleted = goal.current_value >= goal.target_value;
            const pct = Math.min(100, Math.round((goal.current_value / goal.target_value) * 100));

            return (
              <div
                key={goal.id}
                className={`rounded-3xl border p-5 shadow-md dark:shadow-xl space-y-3 transition-all ${
                  isCompleted
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-500/40 shadow-sm dark:shadow-glow-brand'
                    : goal.status === 'paused'
                    ? 'bg-emerald-50/40 dark:bg-slate-900/50 border-emerald-100 dark:border-slate-800/80 opacity-70'
                    : 'bg-white dark:bg-slate-900 border-emerald-100 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-500 text-white dark:text-slate-950 font-black shadow-sm'
                          : 'bg-emerald-50 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {isCompleted ? <Trophy size={20} /> : <Target size={20} />}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-emerald-950 dark:text-white capitalize">
                        {goal.period} {goal.goal_type.replace('_', ' ')}
                      </h4>
                      <span className="text-[11px] text-emerald-700/80 dark:text-slate-400">
                        {goal.status === 'paused' ? 'Paused' : isCompleted ? 'Completed! 🏆' : 'Active'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleStatus(goal)}
                      className="p-2 rounded-xl text-emerald-700 dark:text-slate-400 hover:text-emerald-950 dark:hover:text-white active:scale-90"
                      title={goal.status === 'active' ? 'Pause goal' : 'Resume goal'}
                    >
                      {goal.status === 'active' ? <Pause size={15} /> : <Play size={15} />}
                    </button>
                    <button
                      onClick={() => handleDelete(goal.id)}
                      className="p-2 rounded-xl text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 active:scale-90"
                      title="Delete goal"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-emerald-950 dark:text-slate-200">
                      {goal.current_value} / {goal.target_value}{' '}
                      {goal.goal_type.includes('distance') ? 'km' : goal.goal_type.includes('duration') ? 'min' : 'runs'}
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{pct}%</span>
                  </div>

                  <div className="h-3 w-full rounded-full bg-emerald-100 dark:bg-slate-950 overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full rounded-full transition-all duration-500 ${
                        isCompleted
                          ? 'bg-gradient-to-r from-emerald-400 to-lime-400'
                          : 'bg-gradient-to-r from-emerald-500 to-lime-500'
                      }`}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Smooth Bottom Sheet for Creating Goal */}
      <BottomSheet
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Fitness Goal"
        icon={<Target size={18} />}
      >
        <form onSubmit={handleCreateGoal} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-slate-400 mb-1">
              Goal Type
            </label>
            <select
              value={goalType}
              onChange={(e: any) => {
                setGoalType(e.target.value);
                if (e.target.value === 'weekly_distance') {
                  setTargetValue(20);
                  setPeriod('weekly');
                } else if (e.target.value === 'monthly_distance') {
                  setTargetValue(80);
                  setPeriod('monthly');
                } else if (e.target.value === 'workout_count') {
                  setTargetValue(4);
                  setPeriod('weekly');
                } else if (e.target.value === 'single_run') {
                  setTargetValue(5);
                  setPeriod('weekly');
                }
              }}
              className="w-full px-3.5 py-3 rounded-2xl bg-emerald-50/50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 text-emerald-950 dark:text-white text-xs font-medium focus:outline-none focus:border-emerald-500"
            >
              <option value="weekly_distance">Weekly Distance (km)</option>
              <option value="monthly_distance">Monthly Distance (km)</option>
              <option value="workout_count">Workouts per Week</option>
              <option value="single_run">Single Run Target (km)</option>
              <option value="duration">Weekly Duration (minutes)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-slate-400 mb-1">
              Target Value
            </label>
            <input
              type="number"
              min={1}
              max={1000}
              required
              value={targetValue}
              onChange={(e) => setTargetValue(Number(e.target.value))}
              className="w-full px-3.5 py-3 rounded-2xl bg-emerald-50/50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 text-emerald-950 dark:text-white text-sm focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white dark:text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/30 dark:shadow-glow-brand transition-all active:scale-95"
            >
              {loading ? 'Saving Goal...' : 'Save & Track Goal'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="w-full py-2.5 text-emerald-700 dark:text-slate-400 hover:text-emerald-950 dark:hover:text-white text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      </BottomSheet>
    </div>
  );
};
