import React, { useState } from 'react';
import { UserProfile } from '../types';
import { insforge } from '../lib/insforge';
import { ShieldCheck, Lock, MapPin, Database, Trash2, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';

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

      // Clear local caches — use the correct localStorage keys
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
    <div className="p-4 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="pt-1">
        <h2 className="font-display text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Privacy & Data Protection
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Transparent location handling and data sovereignty
        </p>
      </div>

      {clearedMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>All workout routes and history have been completely deleted.</span>
        </div>
      )}

      {/* Privacy Guarantees */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Our Privacy Commitment</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">You have complete ownership of your fitness data.</p>
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-slate-200/80 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-start gap-2.5">
            <MapPin size={16} className="text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900 dark:text-white">Active Workout Only: </span>
              GPS coordinates are tracked strictly when you hit "Start Run" and immediately cease when you press "Finish" or "Discard".
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Lock size={16} className="text-sky-500 dark:text-sky-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900 dark:text-white">Zero Third-Party Tracking: </span>
              Your location coordinates and personal metrics are never sold or shared with advertising networks.
            </div>
          </div>

          <div className="flex items-start gap-2.5">
            <Database size={16} className="text-lime-500 dark:text-lime-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-900 dark:text-white">Secure InsForge Cloud: </span>
              Data is protected with PostgreSQL Row Level Security (RLS), ensuring only you can read and write your workouts.
            </div>
          </div>
        </div>
      </div>

      {/* Data Controls */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-xl space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          DATA MANAGEMENT
        </h3>

        <button
          onClick={() => setShowClearConfirm(true)}
          className="w-full p-3.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-500 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <Trash2 size={16} />
          <span>Delete All Workout History</span>
        </button>

        <button
          onClick={onSignOut}
          className="w-full p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold text-xs flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <span>Sign Out from Account</span>
        </button>
      </div>

      {/* Clear Data Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-rose-500 dark:text-rose-400">
              <AlertTriangle size={24} />
              <h3 className="text-base font-black text-slate-900 dark:text-white">Delete All Workouts?</h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              This action cannot be undone. All your routes, splits, pace history, and records will be deleted from InsForge database.
            </p>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleClearAllData}
                disabled={clearing}
                className="w-full py-3 px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow-lg transition-all"
              >
                {clearing ? 'Deleting All Data...' : 'Yes, Delete Everything'}
              </button>

              <button
                onClick={() => setShowClearConfirm(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs"
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
