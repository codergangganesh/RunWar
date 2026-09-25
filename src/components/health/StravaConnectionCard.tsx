import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { stravaProvider } from '../../services/health/stravaProvider';
import { StravaConnectionState } from '../../types/strava';
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
} from 'lucide-react';

interface StravaConnectionCardProps {
  userId?: string;
  onRefreshWorkouts?: () => Promise<void>;
}

export const StravaConnectionCard: React.FC<StravaConnectionCardProps> = ({
  userId = 'guest_user',
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

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm relative overflow-hidden transition-all duration-300">
      {/* Top Brand Accent Line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#fc5200] via-[#ff7332] to-[#fc5200]" />

      {/* Sync / Action Notification Toast */}
      {feedback && (
        <div
          className={`mb-4 p-3 rounded-2xl text-xs font-semibold flex items-center justify-between gap-2 border transition-all animate-fade-in ${feedback.type === 'success'
            ? 'bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40'
            : 'bg-rose-50/80 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800/40'
            }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {feedback.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span className="truncate">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-[11px] font-bold underline shrink-0 cursor-pointer hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1. Header & Identity */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          {/* Strava Official Logo Badge */}
          <div className="w-12 h-12 rounded-2xl bg-[#fc5200] flex items-center justify-center shadow-md shadow-[#fc5200]/20 shrink-0">
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="white"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-6.926 13.827h4.172" />
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg sm:text-xl font-black text-slate-950 dark:text-white">
                Strava
              </h2>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <span
          className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1 ${state.status === 'syncing' || isSyncing
            ? 'bg-[#fc5200]/15 text-[#fc5200] border border-[#fc5200]/30 animate-pulse'
            : state.status === 'error'
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
              : state.isConnected
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
            }`}
        >
          {state.status === 'syncing' || isSyncing ? (
            <>
              <RefreshCw size={11} className="animate-spin" />
              <span>Syncing...</span>
            </>
          ) : state.status === 'error' ? (
            <>
              <AlertCircle size={11} />
              <span>Needs Re-auth</span>
            </>
          ) : state.isConnected ? (
            <>
              <CheckCircle2 size={11} />
              <span>Connected</span>
            </>
          ) : (
            <span>Not Connected</span>
          )}
        </span>
      </div>

      {/* 2. Main Content Body */}
      {state.isConnected ? (
        <div className="space-y-4">
          {/* Athlete Profile & Workout Count Strip */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {state.athlete?.profile ? (
                <img
                  src={state.athlete.profile}
                  alt={state.accountEmail || 'Strava Athlete'}
                  className="w-10 h-10 rounded-full object-cover border-2 border-[#fc5200] shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#fc5200]/20 text-[#fc5200] font-black flex items-center justify-center text-sm shrink-0 border border-[#fc5200]/30">
                  {state.accountEmail ? state.accountEmail[0].toUpperCase() : 'S'}
                </div>
              )}
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block">
                  Strava Athlete
                </span>
                <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate block">
                  {state.accountEmail || 'Connected Athlete'}
                </span>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block">
                Workouts Synced
              </span>
              <span className="font-display font-black text-[#fc5200] text-sm sm:text-base">
                {state.syncedCount} runs
              </span>
            </div>
          </div>

          {/* Sync Progress Indicator if active */}
          {(isSyncing || state.status === 'syncing') && (
            <div className="p-3 rounded-2xl bg-[#fc5200]/10 border border-[#fc5200]/20 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <RefreshCw size={13} className="animate-spin text-[#fc5200] shrink-0" />
                  <span className="font-bold text-slate-900 dark:text-white truncate">
                    {state.syncProgress?.currentTitle || 'Importing Strava activities...'}
                  </span>
                </div>
                {state.syncProgress && state.syncProgress.total > 0 && (
                  <span className="font-mono font-bold text-[#fc5200] text-[11px] shrink-0 ml-2">
                    {Math.round((state.syncProgress.current / state.syncProgress.total) * 100)}%
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Last Sync Timestamp */}
          {state.lastSyncAt && state.status !== 'syncing' && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between px-1">
              <span>Last Synchronized:</span>
              <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                {new Date(state.lastSyncAt).toLocaleString()}
              </span>
            </div>
          )}

          {/* Two-Way Sync Feature Toggle */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white">
                <Upload size={14} className="text-[#fc5200]" />
                <span>Auto-Upload Completed Runs</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Automatically post runs recorded in RunWar to your Strava feed
              </p>
            </div>
            <button
              onClick={toggleAutoUpload}
              type="button"
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${autoUpload ? 'bg-[#fc5200]' : 'bg-slate-300 dark:bg-slate-700'
                }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${autoUpload ? 'translate-x-5' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>

          {/* Action Buttons (Sync & Disconnect) */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSync}
              disabled={isSyncing || isConnecting}
              className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                size={14}
                className={isSyncing ? 'animate-spin text-[#fc5200]' : 'text-slate-600 dark:text-slate-400'}
              />
              <span>{isSyncing ? 'Syncing...' : 'Sync Activities Now'}</span>
            </button>

            <button
              onClick={() => setShowDisconnectModal(true)}
              className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-all cursor-pointer"
              title="Disconnect Strava"
            >
              <Unlink size={16} />
            </button>
          </div>
        </div>
      ) : (
        /* Disconnected State / Connect Call to Action */
        <div className="space-y-4">




          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full py-3.5 px-4 rounded-xl bg-[#fc5200] hover:bg-[#e04900] text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-md shadow-[#fc5200]/25 transition-all active:scale-98 cursor-pointer disabled:opacity-60"
          >
            {isConnecting ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Connecting with Strava...</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" width="18" height="18" fill="white">
                  <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-6.926 13.827h4.172" />
                </svg>
                <span>Connect with Strava</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>

          {/* Quick Demo Sandbox Button for testing without an API key */}
          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={handleSimulateDemo}
              disabled={isConnecting}
              className="text-[11px] font-bold text-slate-500 hover:text-[#fc5200] dark:text-slate-400 dark:hover:text-[#fc5200] inline-flex items-center gap-1.5 transition-colors cursor-pointer py-1.5 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95"
            >

              <span>No API key yet? Test with Instant Demo Sandbox</span>
            </button>
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
