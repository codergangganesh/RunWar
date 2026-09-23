import React, { useState, useEffect } from 'react';
import { UserProfile, HealthConnectionState, Workout } from '../types';
import { healthService } from '../services/health/healthService';
import { takeoutImporter } from '../services/health/takeoutImporter';
import {
  CheckCircle2,
  RefreshCw,
  Unlink,
  Link2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  UploadCloud,
  FileUp,
} from 'lucide-react';

interface ConnectedHealthScreenProps {
  profile: UserProfile | null;
  onRefreshWorkouts?: () => Promise<void>;
  onBack?: () => void;
}

export const ConnectedHealthScreen: React.FC<ConnectedHealthScreenProps> = ({
  profile,
  onRefreshWorkouts,
}) => {
  const [healthState, setHealthState] = useState<HealthConnectionState>(() =>
    healthService.getPrimaryConnectionState()
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
    count?: number;
  } | null>(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  useEffect(() => {
    // Subscribe to live health state and progress updates
    const unsubscribe = healthService.subscribe((state) => {
      setHealthState(state);
      setIsSyncing(state.status === 'syncing');
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    setSyncFeedback(null);
    try {
      const result = await healthService.connect('google_health');
      const updated = healthService.getPrimaryConnectionState();
      setHealthState(updated);

      if (result.success) {
        setSyncFeedback({
          type: 'success',
          message: 'Connected to Google Health / Fit successfully!',
        });
        const targetUserId = profile?.user_id || 'guest_user';
        handleSyncWorkouts(targetUserId);
      } else {
        setSyncFeedback({
          type: 'error',
          message: result.error || 'Connection failed. Please check your Google account permissions.',
        });
      }
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: err?.message || 'Failed to authenticate with Google.',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await healthService.disconnect('google_health');
      setHealthState(healthService.getPrimaryConnectionState());
      setShowDisconnectConfirm(false);
      setSyncFeedback({
        type: 'success',
        message: 'Disconnected from Google Health / Fit.',
      });
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: err?.message || 'Failed to disconnect.',
      });
    }
  };

  const handleSyncWorkouts = async (userId: string) => {
    if (isSyncing || healthService.isSyncing()) return;
    setIsSyncing(true);
    setSyncFeedback(null);

    try {
      const result = await healthService.sync(userId, 'google_health');
      const updated = healthService.getPrimaryConnectionState();
      setHealthState(updated);

      if (result.success) {
        if (result.importedCount > 0) {
          setSyncFeedback({
            type: 'success',
            message: `Successfully imported ${result.importedCount} new ${
              result.importedCount === 1 ? 'workout' : 'workouts'
            }!`,
            count: result.importedCount,
          });
        } else {
          setSyncFeedback({
            type: 'success',
            message: 'All workouts are already up to date.',
            count: 0,
          });
        }
        if (onRefreshWorkouts) {
          await onRefreshWorkouts();
        }
      } else {
        setSyncFeedback({
          type: 'error',
          message: result.error || 'Failed to sync workouts from Google Health.',
        });
      }
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: err?.message || 'Sync operation failed.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const processUploadedFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsUploadingFiles(true);
    setSyncFeedback(null);

    try {
      const targetUserId = profile?.user_id || 'guest_user';
      const allParsedWorkouts: Workout[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const text = await file.text();
          const parsed = takeoutImporter.parseFile(text, file.name, targetUserId);
          if (parsed && parsed.length > 0) {
            allParsedWorkouts.push(...parsed);
          }
        } catch (fileErr) {
          console.warn(`Could not parse ${file.name}:`, fileErr);
        }
      }

      if (allParsedWorkouts.length > 0) {
        const result = await takeoutImporter.importWorkouts(targetUserId, allParsedWorkouts);
        if (result.success) {
          const totalDistKm = (
            allParsedWorkouts.reduce((acc, w) => acc + (w.distance_meters || 0), 0) / 1000
          ).toFixed(2);
          setSyncFeedback({
            type: 'success',
            message: `Successfully imported ${result.importedCount} workout${
              result.importedCount === 1 ? '' : 's'
            } (${totalDistKm} km total)!`,
            count: result.importedCount,
          });
          if (onRefreshWorkouts) {
            await onRefreshWorkouts();
          }
        } else {
          setSyncFeedback({
            type: 'error',
            message: result.error || 'Failed to save imported workouts.',
          });
        }
      } else {
        setSyncFeedback({
          type: 'error',
          message:
            'No valid workouts could be extracted. Please ensure you uploaded valid .tcx, .gpx, or .json workout files.',
        });
      }
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: err?.message || 'Error processing uploaded files.',
      });
    } finally {
      setIsUploadingFiles(false);
    }
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      processUploadedFiles(event.target.files);
      event.target.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUploadedFiles(e.dataTransfer.files);
    }
  };

  const faqs = [
    {
      q: 'How does Google Health sync your workout data with RUNWAR?',
      a: 'When you connect your Google account, RUNWAR connects to Google Fitness APIs to query your recorded runs, walks, distances, GPS track coordinates, pace splits, and calories. Everything is imported directly into your RUNWAR account and immediately updates your weekly activity charts, personal records, and workout history.',
    },
    {
      q: 'Will my RUNWAR native GPS workouts get duplicated?',
      a: 'No. RUNWAR includes automatic deduplication logic. If an activity matches an existing RUNWAR GPS session within a ±2 minute window or shares the same external ID, it is automatically merged and skipped to prevent duplicate stats.',
    },
    {
      q: 'What permissions are requested?',
      a: 'We only request read-only access to fitness activity sessions, GPS location coordinates, and aggregate metrics. RUNWAR never edits or deletes your external fitness data.',
    },
    {
      q: 'Can I disconnect at any time?',
      a: 'Yes, you can disconnect whenever you wish. Previously imported workouts will remain securely in your RUNWAR workout history unless you choose to delete them.',
    },
  ];

  return (
    <div className="p-4 sm:p-5 space-y-6 animate-fade-in max-w-xl md:max-w-2xl mx-auto select-none">
      {/* Feedback Toast */}
      {syncFeedback && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-xs animate-scale-in ${
            syncFeedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-900 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {syncFeedback.type === 'success' ? (
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle size={16} className="text-rose-600 dark:text-rose-400 shrink-0" />
            )}
            <span>{syncFeedback.message}</span>
          </div>
          <button
            onClick={() => setSyncFeedback(null)}
            className="text-[11px] font-bold underline shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1. Provider Identity Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Google Official Logo */}
          <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-xs shrink-0">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg sm:text-xl font-black text-slate-950 dark:text-white">
                Google Health / Fit
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Direct Cloud Sync via Google Fitness REST API
            </p>
          </div>
        </div>

        <span
          className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
            healthState.status === 'syncing' || isSyncing
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 animate-pulse'
              : healthState.status === 'error'
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
              : healthState.isConnected
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
          }`}
        >
          {healthState.status === 'syncing' || isSyncing
            ? 'Syncing...'
            : healthState.status === 'error'
            ? 'Sync Paused'
            : healthState.isConnected
            ? 'Connected'
            : 'Not Connected'}
        </span>
      </div>

      {/* 2. Primary Connection & Sync Actions */}
      {healthState.isConnected ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs py-2.5 border-y border-slate-200 dark:border-slate-800">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                Connected Account
              </span>
              <span className="font-bold text-slate-950 dark:text-white">
                {healthState.accountEmail || 'Google Account Linked'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                {isSyncing || healthState.status === 'syncing' ? 'Syncing Progress' : 'Workouts Synced'}
              </span>
              <span className="font-display font-black text-emerald-600 dark:text-emerald-400 text-sm">
                {(isSyncing || healthState.status === 'syncing') &&
                healthState.syncProgress &&
                healthState.syncProgress.total > 0
                  ? `${healthState.syncProgress.current} / ${healthState.syncProgress.total}`
                  : `${healthState.syncedCount} workouts`}
              </span>
            </div>
          </div>

          {/* Real-Time Syncing Progress Indicator */}
          {(isSyncing || healthState.status === 'syncing') && (
            <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/20 space-y-2 animate-fade-in">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <RefreshCw size={13} className="animate-spin text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="font-bold text-slate-900 dark:text-white truncate">
                    {healthState.syncProgress?.currentTitle || 'Processing workout sessions...'}
                  </span>
                </div>
                {healthState.syncProgress && healthState.syncProgress.total > 0 && (
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-[11px] shrink-0 ml-2">
                    {Math.round((healthState.syncProgress.current / healthState.syncProgress.total) * 100)}%
                  </span>
                )}
              </div>

              {healthState.syncProgress && healthState.syncProgress.total > 0 && (
                <div className="w-full h-1.5 bg-emerald-200/50 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(5, (healthState.syncProgress.current / healthState.syncProgress.total) * 100)
                      )}%`,
                    }}
                  />
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                <span>
                  {healthState.syncProgress?.newlySynced !== undefined
                    ? `${healthState.syncProgress.newlySynced} newly imported`
                    : 'Fetching activities...'}
                </span>
                <span>{healthState.syncedCount} total in RUNWAR</span>
              </div>
            </div>
          )}

          {/* Sync Error / Paused Alert */}
          {healthState.status === 'error' && !isSyncing && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-900 dark:text-amber-300 text-xs flex items-center justify-between gap-2 animate-scale-in">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle size={15} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <span className="font-bold block">Sync Paused</span>
                  <span className="text-[11px] text-amber-800 dark:text-amber-200/80 truncate block">
                    {healthState.syncedCount} workouts synced so far. {healthState.errorMessage || ''}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  const targetUserId = profile?.user_id || 'guest_user';
                  handleSyncWorkouts(targetUserId);
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] shrink-0 transition-all cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {healthState.lastSyncAt && healthState.status !== 'syncing' && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Last Synchronized:</span>
              <span className="font-mono font-medium text-slate-900 dark:text-slate-200">
                {new Date(healthState.lastSyncAt).toLocaleString()}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => {
                const targetUserId = profile?.user_id || 'guest_user';
                handleSyncWorkouts(targetUserId);
              }}
              disabled={isSyncing || healthState.status === 'syncing'}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white dark:text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={15} className={isSyncing || healthState.status === 'syncing' ? 'animate-spin' : ''} />
              <span>
                {isSyncing || healthState.status === 'syncing'
                  ? healthState.syncProgress && healthState.syncProgress.total > 0
                    ? `Syncing (${healthState.syncProgress.current}/${healthState.syncProgress.total})...`
                    : 'Syncing Workouts...'
                  : 'Sync Workouts Now'}
              </span>
            </button>

            <button
              onClick={() => setShowDisconnectConfirm(true)}
              disabled={isSyncing || healthState.status === 'syncing'}
              className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              title="Disconnect Google Health"
            >
              <Unlink size={16} />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleConnectGoogle}
          disabled={isConnecting}
          className="w-full py-3.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white dark:text-slate-950 font-bold text-sm flex items-center justify-center gap-2.5 shadow-md shadow-emerald-500/25 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
        >
          {isConnecting ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <Link2 size={16} />
          )}
          <span>{isConnecting ? 'Connecting with Google...' : 'Connect Google Health'}</span>
        </button>
      )}

      {/* Disconnect Confirmation Alert */}
      {showDisconnectConfirm && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 space-y-2 animate-scale-in text-xs">
          <div className="font-bold text-rose-950 dark:text-rose-300 flex items-center gap-1.5">
            <AlertCircle size={15} className="text-rose-600 dark:text-rose-400" />
            <span>Are you sure you want to disconnect?</span>
          </div>
          <p className="text-rose-900/80 dark:text-rose-200/80 text-[11px]">
            Disconnecting stops future automated imports. Your previously imported workouts will remain safely saved in RUNWAR.
          </p>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => setShowDisconnectConfirm(false)}
              className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleDisconnect}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm cursor-pointer"
            >
              Confirm Disconnect
            </button>
          </div>
        </div>
      )}

      {/* 2.5 Upload Supported Workout Files Card */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-2xl border transition-all duration-200 p-4 space-y-3.5 ${
          isDragging
            ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-500 border-dashed scale-[1.01]'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <UploadCloud size={18} />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-950 dark:text-white">
                Upload Workout Files
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Import activities from supported files
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              .TCX
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              .GPX
            </span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              .JSON
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Upload fitness tracks from Garmin, Polar, Strava, Coros, or export archives with full GPS routes, distance, pace splits, and vitals.
        </p>

        {/* Drag & Drop / File Select Button Area */}
        <label className="border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/70 bg-slate-50/60 dark:bg-slate-950/40 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10 rounded-xl p-4 flex flex-col items-center justify-center gap-2 text-center cursor-pointer transition-all group">
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-emerald-500 group-hover:text-white flex items-center justify-center transition-all shadow-xs">
            {isUploadingFiles ? (
              <RefreshCw size={18} className="animate-spin text-emerald-500 group-hover:text-white" />
            ) : (
              <FileUp size={18} />
            )}
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-white block group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              {isUploadingFiles ? 'Parsing & Importing Workouts...' : 'Choose files or drag & drop here'}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Select one or multiple .tcx, .gpx, or .json workout files
            </span>
          </div>
          <input
            type="file"
            multiple
            accept=".tcx,.gpx,.json"
            onChange={handleFileInputChange}
            disabled={isUploadingFiles}
            className="hidden"
          />
        </label>
      </div>

      {/* 3. How Google Health Sync Works */}
      <div className="space-y-3 pt-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
          How Google Health Sync Works
        </h3>

        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          RUNWAR connects with Google Fitness to seamlessly import your historical and new fitness sessions in three straightforward steps:
        </p>

        <div className="space-y-3 pt-1">
          <div className="flex items-start gap-3 text-xs">
            <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
              1
            </span>
            <div>
              <strong className="text-slate-950 dark:text-white block font-bold">
                Authorize Google Account Access:
              </strong>
              <span className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed block mt-0.5">
                Sign in with your Google account to grant secure read-only permission for fitness activities, location routes, and vitals.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3 text-xs">
            <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
              2
            </span>
            <div>
              <strong className="text-slate-950 dark:text-white block font-bold">
                Automatic Data Fetching & Deduplication:
              </strong>
              <span className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed block mt-0.5">
                RUNWAR queries completed outdoor runs, jogs, and walks, while automatically filtering out any overlapping runs tracked natively in RUNWAR.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3 text-xs">
            <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
              3
            </span>
            <div>
              <strong className="text-slate-950 dark:text-white block font-bold">
                Unified Progress Across All Screens:
              </strong>
              <span className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed block mt-0.5">
                All imported runs immediately flow into your Home weekly charts, Workout History, and Analytics screens with full metrics and maps.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. What Data is Imported */}
      <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
          What Data is Imported
        </h3>

        <div className="space-y-3 text-xs">
          <div>
            <strong className="text-slate-950 dark:text-white block font-bold">
              Activities, Distances & Durations
            </strong>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mt-0.5">
              Outdoor runs, walks, jogs, total distance in km/mi, elapsed time, and moving duration.
            </p>
          </div>

          <div>
            <strong className="text-slate-950 dark:text-white block font-bold">
              GPS Route Points & Pace Splits
            </strong>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mt-0.5">
              Full GPS coordinate routes, interactive map polylines, elevations, and per-km splits.
            </p>
          </div>

          <div>
            <strong className="text-slate-950 dark:text-white block font-bold">
              Active Energy & Calories
            </strong>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mt-0.5">
              Total active calories burned calculated from speed, distance, and activity intensity.
            </p>
          </div>

          <div>
            <strong className="text-slate-950 dark:text-white block font-bold">
              Heart Rate Vitals
            </strong>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed mt-0.5">
              Average heart rate (BPM) recorded by compatible fitness trackers and smartwatches.
            </p>
          </div>
        </div>
      </div>

      {/* 5. Security & Privacy Guarantees */}
      <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
          Security & Privacy Guarantees
        </h3>

        <ul className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
          <li>
            • <strong className="text-slate-900 dark:text-slate-200">Read-Only Access:</strong> RUNWAR never modifies or deletes external account data.
          </li>
          <li>
            • <strong className="text-slate-900 dark:text-slate-200">No Duplicate Runs:</strong> RUNWAR native GPS runs are preserved without double-counting.
          </li>
          <li>
            • <strong className="text-slate-900 dark:text-slate-200">Private Cloud Storage:</strong> Imported workouts are encrypted and stored in your private database.
          </li>
        </ul>
      </div>

      {/* 6. Frequently Asked Questions */}
      <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
          Frequently Asked Questions
        </h3>

        <div className="space-y-2">
          {faqs.map((faq, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div
                key={index}
                className="border-b border-slate-100 dark:border-slate-800/80 pb-2"
              >
                <button
                  onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                  className="w-full py-1 text-left flex items-center justify-between text-xs font-bold text-slate-900 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
                {isOpen && (
                  <div className="pt-1.5 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
