import React, { useEffect, useState } from 'react';
import { wakeLockService } from '../../services/wakeLockService';
import { WakeLockStatus } from '../../types';
import { Smartphone, CheckCircle2, Info } from 'lucide-react';
import { BottomSheet } from '../ui/BottomSheet';

interface WakeLockIndicatorProps {
  compact?: boolean;
  iconOnly?: boolean;
}

export const WakeLockIndicator: React.FC<WakeLockIndicatorProps> = ({
  compact = false,
  iconOnly = false,
}) => {
  const [status, setStatus] = useState<WakeLockStatus>(wakeLockService.getStatus());
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    const unsubscribe = wakeLockService.subscribe((newStatus) => {
      setStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  const renderModal = () => (
    <BottomSheet
      isOpen={showInfo}
      onClose={() => setShowInfo(false)}
      title="Screen Wake Lock"
      icon={<Smartphone size={18} />}
    >
      <div className="space-y-4">
        {/* Status indicator bar */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-slate-950/70 border border-emerald-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${status.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
            />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                {status.isActive ? 'Screen Kept Awake' : 'Standby / Sleep Allowed'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                {status.isActive
                  ? 'Display will not dim or sleep during workout'
                  : 'Display follows your phone screen sleep timer'}
              </div>
            </div>
          </div>
        </div>

        {/* Feature benefits */}
        <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
            <span>
              <strong>Glanceable metrics:</strong> See your pace, heart rate, and splits at any instant without tapping to unlock.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
            <span>
              <strong>Unthrottled GPS:</strong> Mobile browsers throttle background geolocation when the screen turns off. Wake Lock keeps high-precision tracking active.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Info size={15} className="text-sky-500 shrink-0 mt-0.5" />
            <span>
              <strong>Auto-reengages:</strong> If you switch apps or receive a phone call, RunWar automatically re-engages the lock when you return.
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="pt-2 flex gap-2.5">
          <button
            type="button"
            onClick={async () => {
              if (status.isActive) {
                await wakeLockService.releaseLock();
              } else {
                await wakeLockService.requestLock();
              }
            }}
            className={`flex-1 py-3 px-3 rounded-2xl font-bold text-xs transition-all active:scale-95 cursor-pointer ${status.isActive
                ? 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md'
              }`}
          >
            {status.isActive ? 'Allow Screen Sleep' : 'Force Screen Awake'}
          </button>
          <button
            type="button"
            onClick={() => setShowInfo(false)}
            className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-md shadow-emerald-600/25"
          >
            Got It
          </button>
        </div>
      </div>
    </BottomSheet>
  );

  if (iconOnly) {
    return (
      <>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowInfo(true);
          }}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all select-none active:scale-95 cursor-pointer flex items-center justify-center"
          title={status.isActive ? 'Screen Awake: Active (Screen stays on - click for info)' : 'Screen Awake: Standby (Click to enable)'}
          aria-label="Screen Wake Lock Status"
        >
          <Smartphone
            size={14}
            className={status.isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}
          />
        </button>
        {renderModal()}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowInfo(true);
        }}
        className={`inline-flex items-center gap-1.5 rounded-full font-bold select-none cursor-pointer transition-all active:scale-95 ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
          } ${status.isActive
            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/80 shadow-xs'
            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/80'
          }`}
        title={status.isActive ? 'Screen Wake Lock Active (Click for info)' : 'Screen Wake Lock Inactive (Click to manage)'}
      >
        <span
          className={`h-2 w-2 rounded-full ${status.isActive ? 'bg-emerald-500' : 'bg-amber-500'}`}
        />
        <Smartphone size={compact ? 11 : 13} className="shrink-0" />
        <span>{status.isActive ? 'SCREEN AWAKE' : 'SLEEP ON'}</span>
      </button>
      {renderModal()}
    </>
  );
};
