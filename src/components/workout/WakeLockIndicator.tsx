import React, { useEffect, useState } from 'react';
import { wakeLockService } from '../../services/wakeLockService';
import { WakeLockStatus } from '../../types';
import { Smartphone, CheckCircle2, Info, X } from 'lucide-react';

interface WakeLockIndicatorProps {
  compact?: boolean;
}

export const WakeLockIndicator: React.FC<WakeLockIndicatorProps> = ({ compact = false }) => {
  const [status, setStatus] = useState<WakeLockStatus>(wakeLockService.getStatus());
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    const unsubscribe = wakeLockService.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowInfo(true)}
        className={`flex items-center gap-1.5 transition-all select-none active:scale-95 cursor-pointer ${
          compact
            ? 'px-2 py-1 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
            : 'px-2.5 py-1.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-emerald-200 dark:border-slate-800 shadow-sm text-emerald-800 dark:text-slate-200'
        }`}
        title="Screen Wake Lock Status"
        aria-label="Screen Wake Lock Status"
      >
        <div className="relative flex items-center justify-center">
          <Smartphone size={13} className="text-emerald-600 dark:text-emerald-400" />
          {status.isActive && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-75" />
          )}
          <span
            className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
              status.isActive ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
        </div>
        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
          {status.isActive ? 'Screen Awake' : 'Standby'}
        </span>
      </button>

      {/* Wake Lock Info Modal */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    Screen Wake Lock
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        status.isActive ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      {status.isActive ? 'Active & Preventing Sleep' : 'Paused / Standby'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Keeps your display awake:</strong> Prevents your phone from locking while your workout is in progress.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Uninterrupted Web GPS:</strong> Browsers throttle geolocation when the screen turns off. Wake Lock keeps high-precision tracking active.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Info size={15} className="text-sky-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Auto-reacquires:</strong> If you switch apps or answer a call, RunWar automatically re-engages the lock when you return.
                </span>
              </div>
            </div>

            <div className="pt-1 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  if (status.isActive) {
                    await wakeLockService.releaseLock();
                  } else {
                    await wakeLockService.requestLock();
                  }
                }}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all active:scale-95 ${
                  status.isActive
                    ? 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md'
                }`}
              >
                {status.isActive ? 'Allow Screen Sleep (Save Battery)' : 'Force Keep Screen Awake'}
              </button>
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all active:scale-95"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
