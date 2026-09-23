import React, { useState } from 'react';
import { UserProfile } from '../types';
import { insforge } from '../lib/insforge';
import { workoutService } from '../services/workoutService';
import { Trash2, AlertTriangle, CheckCircle2, LogOut } from 'lucide-react';

interface PrivacyScreenProps {
  profile: UserProfile | null;
  onDataCleared: () => void;
  onSignOut: () => void;
}

export const PrivacyScreen: React.FC<PrivacyScreenProps> = ({
  profile,
  onDataCleared,
  onSignOut,
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearedMsg, setClearedMsg] = useState(false);

  const handleClearAllData = async () => {
    if (!profile) return;
    setClearing(true);

    try {
      // Delete user's workouts from InsForge
      await insforge.database
        .from('workouts')
        .delete()
        .eq('user_id', profile.user_id);

      // Clear local caches
      workoutService.clearUserCache(profile.user_id);
      localStorage.removeItem('runwar_cached_workouts');
      localStorage.removeItem('runwar_active_workout_backup');
      localStorage.removeItem('runwar_point_batches_queue');
      localStorage.removeItem('runwar_offline_workouts_queue');

      setShowClearConfirm(false);
      setClearedMsg(true);
      onDataCleared();
      setTimeout(() => setClearedMsg(false), 3000);
    } catch (err) {
      console.error('Error clearing data:', err);
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="p-4 sm:p-5 space-y-6 animate-fade-in max-w-xl md:max-w-2xl mx-auto select-none">
      {/* Feedback Toast */}
      {clearedMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-300 text-xs flex items-center gap-2 animate-scale-in">
          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>All workout routes and history have been permanently deleted.</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="font-display text-xl sm:text-2xl font-black text-slate-950 dark:text-white tracking-tight">
          Privacy & Data Protection
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Transparent location handling and complete data sovereignty
        </p>
      </div>

      {/* Privacy Commitments */}
      <div className="space-y-3.5 pt-2 border-t border-slate-200 dark:border-slate-800">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
          Our Privacy Commitment
        </h3>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          RUNWAR is built with privacy-by-design. You maintain 100% ownership and control over your running routes, location logs, and fitness metrics.
        </p>

        <div className="space-y-3.5 pt-1 text-xs">
          <div>
            <strong className="text-slate-950 dark:text-white block font-bold">
              Active Workout Tracking Only
            </strong>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mt-0.5">
              GPS coordinates are recorded strictly when you start a workout session, and tracking stops immediately the moment you finish or discard the run.
            </p>
          </div>

          <div>
            <strong className="text-slate-950 dark:text-white block font-bold">
              Zero Third-Party Ad Tracking
            </strong>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mt-0.5">
              Your precise location tracks, paces, and personal health metrics are never shared, sold, or accessible to third-party advertising networks.
            </p>
          </div>

          <div>
            <strong className="text-slate-950 dark:text-white block font-bold">
              Encrypted InsForge Cloud Storage
            </strong>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mt-0.5">
              All fitness records are secured in PostgreSQL with Row Level Security (RLS) policies, ensuring only your authenticated account has permission to read and write your data.
            </p>
          </div>
        </div>
      </div>

      {/* Data Management & Actions */}
      <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
          Data Management
        </h3>

        <div className="space-y-2.5 pt-1">
          <button
            onClick={() => setShowClearConfirm(true)}
            className="w-full py-3 px-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
          >
            <Trash2 size={15} />
            <span>Delete All Workout History</span>
          </button>

          <button
            onClick={onSignOut}
            className="w-full py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
          >
            <LogOut size={15} />
            <span>Sign Out from Account</span>
          </button>
        </div>
      </div>

      {/* Clear Data Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-500 dark:text-rose-400">
              <AlertTriangle size={20} />
              <h3 className="text-base font-black text-slate-900 dark:text-white">Delete All Workouts?</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              This action cannot be undone. All your GPS routes, splits, pace history, and personal records will be permanently removed from your database.
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleClearAllData}
                disabled={clearing}
                className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                {clearing ? 'Deleting All Data...' : 'Yes, Delete Everything'}
              </button>

              <button
                onClick={() => setShowClearConfirm(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
