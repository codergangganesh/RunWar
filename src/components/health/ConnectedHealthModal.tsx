import React, { useState } from 'react';
import { healthService } from '../../services/health/healthService';
import { HealthConnectionState } from '../../types';
import {
  X,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Activity,
  MapPin,
  Lock,
  Flame,
  AlertCircle,
  Unlink,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

interface ConnectedHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSyncComplete?: () => void;
}

export const ConnectedHealthModal: React.FC<ConnectedHealthModalProps> = ({
  isOpen,
  onClose,
  userId,
  onSyncComplete,
}) => {
  const [connectionState, setConnectionState] = useState<HealthConnectionState>(() =>
    healthService.getPrimaryConnectionState()
  );
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  if (!isOpen) return null;

  const handleConnect = async () => {
    setIsConnecting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const result = await healthService.connect('google_health');
      if (result.success) {
        setConnectionState(healthService.getPrimaryConnectionState());
        setSuccessMsg('Successfully connected to Google Health!');

        // Trigger initial sync automatically
        handleSync();
      } else {
        setErrorMsg(result.error || 'Connection failed. Please try again.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during connection.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await healthService.sync(userId, 'google_health');
      setConnectionState(healthService.getPrimaryConnectionState());

      if (res.success) {
        if (res.importedCount > 0) {
          setSuccessMsg(`Successfully imported ${res.importedCount} new ${res.importedCount === 1 ? 'workout' : 'workouts'}!`);
        } else if (res.skippedCount > 0) {
          setSuccessMsg('Your health workouts are already up to date!');
        } else {
          setSuccessMsg('Health sync complete. No new workouts found.');
        }
        if (onSyncComplete) onSyncComplete();
      } else {
        setErrorMsg(res.error || 'Failed to sync health data.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Sync encountered an issue.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await healthService.disconnect('google_health');
      setConnectionState(healthService.getPrimaryConnectionState());
      setShowDisconnectConfirm(false);
      setSuccessMsg('Google Health disconnected.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to disconnect.');
    }
  };

  const formatLastSync = (isoString: string | null) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    const now = new Date();
    const diffMins = Math.round((now.getTime() - date.getTime()) / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Activity size={18} />
            </div>
            <div>
              <h3 className="font-display text-base font-black text-slate-900 dark:text-white leading-tight">
                Connected Health
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Google Health & Fit Data Sync
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Toast Messages */}
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 animate-fade-in">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2 animate-fade-in">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Provider Card */}
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {/* Google Multi-color Icon */}
                <div className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-sm shrink-0">
                  <svg viewBox="0 0 24 24" width="22" height="22">
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
                  <div className="font-bold text-sm text-slate-900 dark:text-white">
                    Google Health & Fit
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {connectionState.accountEmail || 'Running & Walking Sessions'}
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div
                className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
                  connectionState.isConnected
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-slate-200/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    connectionState.isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                  }`}
                />
                <span>{connectionState.isConnected ? 'Connected' : 'Not Connected'}</span>
              </div>
            </div>

            {/* Sync Metadata (If Connected) */}
            {connectionState.isConnected && (
              <div className="mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Last Synced:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {formatLastSync(connectionState.lastSyncAt)}
                </span>
              </div>
            )}
          </div>

          {/* Explanation & Transparency Section */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 px-1">
              Data Permissions & Privacy
            </h4>

            <div className="rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800/60 p-3.5 space-y-2.5 text-xs">
              <div className="flex items-start gap-2.5">
                <ShieldCheck size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">Minimal Access Only</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    RUNWAR only reads running/walking exercise sessions, distances, pace, and GPS routes.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Lock size={16} className="text-sky-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">User Controlled & Revocable</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    You can disconnect or revoke access at any time. Your native GPS runs remain independent.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Disconnect Confirmation Alert */}
          {showDisconnectConfirm && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 space-y-3 animate-fade-in">
              <div>
                <div className="font-bold text-xs text-rose-600 dark:text-rose-400">
                  Disconnect Google Health?
                </div>
                <div className="text-[11px] text-rose-700/80 dark:text-slate-400 mt-0.5">
                  RUNWAR will stop importing new workouts. Your existing RUNWAR and previously imported runs will remain safe.
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Yes, Disconnect
                </button>
                <button
                  type="button"
                  onClick={() => setShowDisconnectConfirm(false)}
                  className="py-2 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
          {connectionState.isConnected ? (
            <div className="flex flex-col gap-2">
              {/* Sync Now Button */}
              <button
                type="button"
                onClick={handleSync}
                disabled={isSyncing}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#00d09c] hover:bg-[#00ba8b] disabled:opacity-50 text-slate-950 font-black text-xs shadow-md shadow-[#00d09c]/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
                <span>{isSyncing ? 'Syncing Health Data...' : 'Sync Activities Now'}</span>
              </button>

              {/* Disconnect Trigger */}
              {!showDisconnectConfirm && (
                <button
                  type="button"
                  onClick={() => setShowDisconnectConfirm(true)}
                  className="w-full py-2.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Unlink size={13} />
                  <span>Disconnect Health Provider</span>
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#00d09c] hover:bg-[#00ba8b] disabled:opacity-50 text-slate-950 font-black text-xs shadow-md shadow-[#00d09c]/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isConnecting ? (
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Connect Google Health</span>
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
