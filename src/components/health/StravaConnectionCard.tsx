import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { stravaProvider } from '../../services/health/stravaProvider';
import { StravaConnectionState } from '../../types/strava';
import { UserProfile } from '../../types';
import {
  CheckCircle2,
  RefreshCw,
  Unlink,
  Link2,
  AlertCircle,
  ExternalLink,
  Upload,
  ArrowRight,
  Sparkles,
  Info,
} from 'lucide-react';

interface StravaConnectionCardProps {
  userId?: string;
  profile?: UserProfile | null;
  onRefreshWorkouts?: () => Promise<void>;
}

export const StravaConnectionCard: React.FC<StravaConnectionCardProps> = ({
  userId = 'guest_user',
  profile,
  onRefreshWorkouts,
}) => {
  const [state, setState] = useState<StravaConnectionState>(() =>
    stravaProvider.getConnectionState()
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const [autoUpload, setAutoUpload] = useState<boolean>(() => {
    return stravaProvider.getConnectionState().autoUpload ?? false;
  });

  useEffect(() => {
    // Attempt restore from database if authenticated
    if (userId && userId !== 'guest_user' && !state.isConnected) {
      stravaProvider.restoreFromDatabase(userId).then((connected) => {
        if (connected) {
          setState(stravaProvider.getConnectionState());
        }
      });
    }

    // Subscribe to live connection and sync updates
    const unsubscribe = stravaProvider.subscribe((updated) => {
      setState(updated as StravaConnectionState);
      setIsSyncing(updated.status === 'syncing');
      if ((updated as StravaConnectionState).autoUpload !== undefined) {
        setAutoUpload(Boolean((updated as StravaConnectionState).autoUpload));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [userId]);

  // Auto-dismiss toast feedback message after 2 seconds
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => {
      setFeedback(null);
    }, 2000);

    return () => clearTimeout(timer);
  }, [feedback]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setFeedback(null);

    try {
      const res = await stravaProvider.connect();
      const updated = stravaProvider.getConnectionState();
      setState(updated);

      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Connected to Strava successfully as ${res.accountEmail || 'Athlete'
            }!`,
        });
        // Auto-trigger first sync
        handleSync();
      } else {
        if (res.error && !res.error.includes('closed')) {
          setFeedback({
            type: 'error',
            message: res.error,
          });
        }
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to authenticate with Strava.',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSimulateDemo = async () => {
    setIsConnecting(true);
    setFeedback(null);
    try {
      let activeUserId = userId;
      if (!activeUserId || activeUserId === 'guest_user') {
        const cached = localStorage.getItem('runwar_cached_user');
        if (cached) {
          try {
            const u = JSON.parse(cached);
            if (u?.id) activeUserId = u.id;
          } catch { }
        }
      }
      activeUserId = activeUserId || 'guest_user';

      const res = await stravaProvider.simulateDemoConnection(activeUserId);
      if (res.success) {
        setFeedback({
          type: 'success',
          message: `Connected Demo Strava account! Synced ${res.importedCount} sample runs with routes & splits.`,
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('runwar:sync_completed'));
        }
        if (onRefreshWorkouts) {
          await onRefreshWorkouts();
        }
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to initialize demo.',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setFeedback(null);
    try {
      let activeUserId = userId;
      if (!activeUserId || activeUserId === 'guest_user') {
        const cached = localStorage.getItem('runwar_cached_user');
        if (cached) {
          try {
            const u = JSON.parse(cached);
            if (u?.id) activeUserId = u.id;
          } catch { }
        }
      }
      activeUserId = activeUserId || 'guest_user';

      await stravaProvider.disconnect(activeUserId);
      setState(stravaProvider.getConnectionState());
      setFeedback({
        type: 'success',
        message: 'Strava disconnected. All synced workouts have been removed.',
      });

      // Dispatch events immediately to purge UI state across all screens
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('runwar:workouts_purged', { detail: { provider: 'strava' } })
        );
        window.dispatchEvent(new CustomEvent('runwar:sync_completed'));
      }

      // Refresh all workouts across the entire app
      if (onRefreshWorkouts) {
        await onRefreshWorkouts();
      }
      setShowDisconnectModal(false);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Failed to disconnect Strava.',
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleSync = async () => {
    if (isSyncing || stravaProvider.isSyncing()) return;

    setIsSyncing(true);
    setFeedback(null);

    try {
      const result = await stravaProvider.syncWorkouts(userId);
      const updated = stravaProvider.getConnectionState();
      setState(updated);

      if (result.success) {
        if (result.importedCount > 0) {
          setFeedback({
            type: 'success',
            message: `Successfully imported ${result.importedCount} new Strava ${result.importedCount === 1 ? 'activity' : 'activities'
              }!`,
          });
        } else {
          setFeedback({
            type: 'success',
            message: 'All Strava activities are already synchronized.',
          });
        }

        if (onRefreshWorkouts) {
          await onRefreshWorkouts();
        }
      } else {
        setFeedback({
          type: 'error',
          message: result.error || 'Failed to sync workouts from Strava.',
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err?.message || 'Sync failed.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleAutoUpload = () => {
    const nextVal = !autoUpload;
    setAutoUpload(nextVal);
    // Update local storage state
    try {
      const stored = localStorage.getItem('runwar_strava_state');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.autoUpload = nextVal;
        localStorage.setItem('runwar_strava_state', JSON.stringify(parsed));
      }
    } catch { }
  };

  const formatLastSync = (isoString?: string | null) => {
    if (!isoString) return 'Not yet';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Not yet';
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 45) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;

    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return `Today at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    }

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Resolve athlete display name and avatar
  const athleteName =
    [state.athlete?.firstname, state.athlete?.lastname].filter(Boolean).join(' ') ||
    state.accountEmail ||
    profile?.name ||
    'Mannam Ganeshbabu';

  const athleteAvatar =
    state.athlete?.profile ||
    state.athlete?.profile_medium ||
    profile?.avatar_url;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden transition-all duration-300 space-y-5">
      {/* Floating Toast Notification (Portal to body so it never distorts card layout) */}
      {feedback && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[99999] w-[90%] max-w-sm pointer-events-auto animate-in fade-in slide-in-from-top-4 duration-300">
            <div
              className={`p-3.5 rounded-2xl shadow-xl backdrop-blur-xl border flex items-center justify-between gap-3 text-xs font-semibold ${feedback.type === 'success'
                ? 'bg-slate-900/95 dark:bg-slate-800/95 text-white border-emerald-500/40 shadow-emerald-950/20'
                : 'bg-slate-900/95 dark:bg-slate-800/95 text-white border-rose-500/40 shadow-rose-950/20'
                }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {feedback.type === 'success' ? (
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle size={18} className="text-rose-400 shrink-0" />
                )}
                <span className="truncate">{feedback.message}</span>
              </div>
              <button
                onClick={() => setFeedback(null)}
                className="text-[11px] font-bold text-slate-400 hover:text-white shrink-0 cursor-pointer transition-colors px-1"
              >
                ✕
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* 1. Header & Identity matching screenshot */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          {/* Strava Official Logo Badge */}
          <div className="w-14 h-14 rounded-2xl bg-[#fc5200] flex items-center justify-center shadow-md shadow-[#fc5200]/25 shrink-0">
            <svg
              viewBox="0 0 24 24"
              width="28"
              height="28"
              fill="white"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-6.926 13.827h4.172" />
            </svg>
          </div>

          <div className="flex flex-col min-w-0">
            <h2 className="font-display text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">
              Strava
            </h2>
            <p className="text-[10px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-normal mt-0.5">
              Connect your Strava account
            </p>
          </div>
        </div>

        {/* Status Badge Pill */}
        {state.isConnected ? (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 rounded-full px-2 py-0.5 text-[10px] font-medium flex items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Connected</span>
          </div>
        ) : isSyncing || state.status === 'syncing' ? (
          <div className="bg-orange-50 dark:bg-orange-950/40 text-[#fc5200] border border-orange-200/60 dark:border-orange-800/40 rounded-full px-3.5 py-1 text-xs font-semibold flex items-center gap-1.5 shrink-0 animate-pulse">
            <RefreshCw size={11} className="animate-spin text-[#fc5200]" />
            <span>Syncing...</span>
          </div>
        ) : (
          <div className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-full px-3.5 py-1 text-xs font-semibold flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span>Not Connected</span>
          </div>
        )}
      </div>

      {/* 2. Main Content Body */}
      {state.isConnected ? (
        <div className="space-y-4 sm:space-y-5">
          {/* Athlete Profile Row */}
          <div className="flex items-center gap-3.5 pt-1">
            {athleteAvatar ? (
              <img
                src={athleteAvatar}
                alt={athleteName}
                className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#fc5200]/15 text-[#fc5200] font-black flex items-center justify-center text-base shrink-0 border border-[#fc5200]/25">
                {athleteName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                STRAVA ATHLETE
              </span>
              <span className="font-bold text-base sm:text-lg text-slate-900 dark:text-white truncate block">
                {athleteName}
              </span>
            </div>
          </div>

          {/* 2-Column Stats Box (WORKOUTS SYNCED | LAST SYNCHRONIZED) */}
          <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl p-4 grid grid-cols-2 gap-4 border border-slate-100 dark:border-slate-800/60">
            <div>
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                WORKOUTS SYNCED
              </span>
              <span className="font-black text-lg sm:text-xl text-[#fc5200]">
                {state.syncedCount ?? 0} runs
              </span>
            </div>
            <div className="border-l border-slate-200/80 dark:border-slate-700/60 pl-4">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-1">
                LAST SYNCHRONIZED
              </span>
              <span className="font-medium text-xs sm:text-sm text-slate-800 dark:text-slate-200 block truncate">
                {state.lastSyncAt ? new Date(state.lastSyncAt).toLocaleString() : 'Never'}
              </span>
            </div>
          </div>

          {/* Auto-Upload Completed Runs Box */}
          <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl p-4 flex items-center justify-between gap-3 border border-slate-100 dark:border-slate-800/60">
            <div className="min-w-0">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Auto-Upload Completed Runs
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                Automatically post runs recorded in RunWar to your Strava feed
              </p>
            </div>
            <button
              onClick={toggleAutoUpload}
              type="button"
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${autoUpload ? 'bg-[#fc5200]' : 'bg-slate-300 dark:bg-slate-700'
                }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out mt-1 ${autoUpload ? 'translate-x-6' : 'translate-x-1'
                  }`}
              />
            </button>
          </div>

          {/* Stacked Action Buttons matching screenshot */}
          <div className="space-y-3 pt-1">
            <button
              onClick={handleSync}
              disabled={isSyncing || isConnecting || state.status === 'syncing'}
              className="w-full py-4 rounded-2xl bg-[#fc5200] hover:bg-[#e04900] text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-md shadow-[#fc5200]/25 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {isSyncing || state.status === 'syncing' ? (
                <>
                  <RefreshCw size={16} className="animate-spin text-white shrink-0" />
                  <span>
                    {state.syncProgress && state.syncProgress.total > 0
                      ? `Syncing (${state.syncProgress.current}/${state.syncProgress.total})...`
                      : 'Syncing Activities...'}
                  </span>
                </>
              ) : (
                <span>Sync Activities Now</span>
              )}
            </button>

            <button
              onClick={() => setShowDisconnectModal(true)}
              disabled={isSyncing || isConnecting}
              className="w-full py-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-sm transition-all active:scale-[0.99] cursor-pointer disabled:opacity-50 text-center"
            >
              Disconnect Strava
            </button>
          </div>

          {/* Note Callout Box matching screenshot */}
          <div className="bg-[#fff7f2] dark:bg-[#fc5200]/10 border border-[#fed7c3] dark:border-[#fc5200]/20 rounded-2xl p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-[#fc5200] font-bold text-sm">
              <AlertCircle size={18} className="shrink-0 text-[#fc5200]" />
              <span>Note</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pl-6.5">
              Only your running, walking and cycling activities will be synced from Strava.
            </p>
          </div>

        </div>
      ) : (
        /* Disconnected State / Connect Call to Action */
        <div className="space-y-4 pt-1">
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full py-4 rounded-2xl bg-[#fc5200] hover:bg-[#e04900] text-white font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-md shadow-[#fc5200]/25 transition-all active:scale-[0.99] cursor-pointer disabled:opacity-60"
          >
            {isConnecting ? (
              <>
                <RefreshCw size={16} className="animate-spin text-white" />
                <span>Connecting with Strava...</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-6.926 13.827h4.172" />
                </svg>
                <span>Connect with Strava</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>

          {/* Quick Demo Sandbox Button */}
          <div className="text-center">
            <button
              type="button"
              onClick={handleSimulateDemo}
              disabled={isConnecting}
              className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
            >
              No API key yet? Test with Instant Demo Sandbox
            </button>
          </div>

          {/* Note Callout Box matching screenshot */}
          <div className="bg-[#fff7f2] dark:bg-[#fc5200]/10 border border-[#fed7c3] dark:border-[#fc5200]/20 rounded-2xl p-4 space-y-1.5 mt-2">
            <div className="flex items-center gap-2 text-[#fc5200] font-bold text-sm">
              <AlertCircle size={18} className="shrink-0 text-[#fc5200]" />
              <span>Note</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pl-6.5">
              Only your running, walking and cycling activities will be synced from Strava.
            </p>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation & Progress Modal (Portal for absolute viewport centering with transparent blur) */}
      {showDisconnectModal && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-black/60 dark:bg-black/75 backdrop-blur-md animate-fade-in"
            onClick={() => {
              if (!isDisconnecting) setShowDisconnectModal(false);
            }}
          >
            <div
              className="w-full max-w-sm rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-2xl shadow-black/40 space-y-5 animate-scale-in text-center relative"
              onClick={(e) => e.stopPropagation()}
            >
              {isDisconnecting ? (
                /* Active Disconnecting & Purging State with prominent loading animation */
                <div className="py-4 space-y-4">
                  <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-4 border-rose-500/20 border-t-rose-500 animate-spin" />
                    <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center">
                      <Unlink size={20} className="animate-pulse" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="font-display font-black text-lg text-slate-900 dark:text-white">
                      Disconnecting Strava...
                    </h3>

                  </div>



                  <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 pt-1">

                    <span>Cleaning up records, please wait...</span>
                  </div>
                </div>
              ) : (
                /* Confirmation Dialogue */
                <>


                  <div className="space-y-1.5">
                    <h3 className="font-display font-black text-lg text-slate-900 dark:text-white">
                      Disconnect Strava?
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Disconnecting will unlink your Strava account and remove all synced Strava workouts
                      from your history, weekly stats, and personal records.
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowDisconnectModal(false)}
                      disabled={isDisconnecting}
                      className="flex-1 py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      disabled={isDisconnecting}
                      className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-md shadow-rose-600/25 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <span>Disconnect</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
