import React, { useState, useEffect } from 'react';
import {
  Radio,
  Copy,
  Check,
  Power,
  Heart,
  Clock,
  RotateCcw,
  X,
} from 'lucide-react';
import { beaconService, LiveBeacon, BeaconDuration } from '../../services/beaconService';
import { UserProfile } from '../../types';

interface LiveBeaconModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile?: UserProfile | null;
  currentLat?: number;
  currentLng?: number;
  workoutType?: string;
  isWatchdogEnabled?: boolean;
  onToggleWatchdog?: (enabled: boolean) => void;
  onTriggerTestWatchdog?: () => void;
  onBeaconChange?: (beacon: LiveBeacon | null) => void;
}

export const LiveBeaconModal: React.FC<LiveBeaconModalProps> = ({
  isOpen,
  onClose,
  profile,
  currentLat,
  currentLng,
  workoutType = 'run',
  isWatchdogEnabled,
  onToggleWatchdog,
  onTriggerTestWatchdog,
  onBeaconChange,
}) => {
  const [activeBeacon, setActiveBeacon] = useState<LiveBeacon | null>(() => beaconService.getActiveSession());
  const [selectedDuration, setSelectedDuration] = useState<BeaconDuration>('until_ended');
  const [isStarting, setIsStarting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const session = beaconService.getActiveSession();
      setActiveBeacon(session);

      if (session) {
        // Fetch latest server stats (including spectator cheers) immediately
        beaconService.getBeaconByCode(session.beacon_code).then((fresh) => {
          if (fresh) setActiveBeacon(fresh);
        }).catch(() => {});

        // Poll every 3 seconds while modal is open to see new cheers live
        const interval = setInterval(() => {
          beaconService.getBeaconByCode(session.beacon_code).then((fresh) => {
            if (fresh) setActiveBeacon(fresh);
          }).catch(() => {});
        }, 3000);

        return () => clearInterval(interval);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartBeacon = async () => {
    setIsStarting(true);
    setErrorMessage(null);
    try {
      const runnerName = profile?.name || profile?.username || 'War Runner';
      const beacon = await beaconService.startBeacon({
        userId: profile?.id || profile?.user_id || null,
        runnerName: runnerName,
        runnerAvatar: profile?.avatar_url || null,
        workoutType: workoutType,
        initialLat: currentLat,
        initialLng: currentLng,
        durationLimit: selectedDuration,
      });
      setActiveBeacon(beacon);
      onBeaconChange?.(beacon);
    } catch (err: any) {
      setErrorMessage('Failed to initialize beacon broadcast. Please check connection.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopBeacon = async () => {
    await beaconService.stopBeacon();
    setActiveBeacon(null);
    onBeaconChange?.(null);
  };

  const shareUrl = activeBeacon ? beaconService.getShareableUrl(activeBeacon.beacon_code) : '';

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard?.writeText(shareUrl).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };



  const getRemainingTimeText = (expiresAt?: string | null) => {
    if (!expiresAt) return null;
    const diffMs = new Date(expiresAt).getTime() - Date.now();
    if (diffMs <= 0) return 'Expired';
    const mins = Math.ceil(diffMs / (60 * 1000));
    if (mins < 60) return `${mins}m left`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hours}h ${remMins}m left` : `${hours}h left`;
  };

  const isSessionExpired = Boolean(
    activeBeacon?.expires_at && Date.now() > new Date(activeBeacon.expires_at).getTime()
  );

  return (
    <div className="fixed inset-0 z-[9990] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border-t sm:border border-slate-800 sm:rounded-3xl rounded-t-3xl p-5 shadow-2xl flex flex-col max-h-[90dvh] overflow-y-auto">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-500 to-lime-400 flex items-center justify-center text-slate-950 font-black shadow-lg">
              <Radio size={20} className={activeBeacon ? 'animate-pulse' : ''} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white uppercase tracking-wider">
                  Live Run Beacon
                </h2>
                {activeBeacon && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    isSessionExpired
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isSessionExpired ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'}`} />
                    {isSessionExpired ? 'Time Exceeded' : 'Active'}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                {activeBeacon ? (
                  <>
                    <span>Code: <span className="font-mono text-slate-300 font-semibold">{activeBeacon.beacon_code}</span></span>
                    {activeBeacon.expires_at && (
                      <span className={`font-medium ${isSessionExpired ? 'text-amber-400' : 'text-emerald-400'}`}>
                        • {getRemainingTimeText(activeBeacon.expires_at)}
                      </span>
                    )}
                  </>
                ) : (
                  'Zero-Install Spectator Link'
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 mb-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-medium">
            {errorMessage}
          </div>
        )}

        {/* State 1: Active Beacon */}
        {activeBeacon ? (
          <div className="flex flex-col gap-4">
            {isSessionExpired && (
              <div className="p-3 rounded-2xl bg-amber-950/60 border border-amber-800 text-amber-300 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-amber-400 shrink-0" />
                  <span>Sharing period expired. Spectator link is locked.</span>
                </div>
                <button
                  onClick={handleStopBeacon}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] shrink-0 active:scale-95 cursor-pointer"
                >
                  New Session
                </button>
              </div>
            )}

            {/* Spectator Web Link Box */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Spectator Web Link
              </label>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/80 border border-slate-700">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  className="bg-transparent text-xs text-slate-200 flex-1 outline-none truncate font-mono select-all px-1"
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
                    isCopied
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                  }`}
                >
                  {isCopied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{isCopied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Fan Cheers Badge */}
            <div className="p-3 rounded-2xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Heart size={18} className="text-pink-400" fill="currentColor" />
                <span className="text-xs font-semibold text-slate-300">
                  Spectator Cheers Received:
                </span>
              </div>
              <span className="text-sm font-black text-pink-400">
                {activeBeacon.cheers_count || 0}
              </span>
            </div>

            {/* Stop Beacon Button */}
            <div className="pt-2">
              <button
                onClick={handleStopBeacon}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/80 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <Power size={14} />
                <span>Stop Beacon Broadcast</span>
              </button>
            </div>
          </div>
        ) : (
          /* State 2: Inactive Beacon */
          <div className="flex flex-col gap-4">
            <div className="text-center py-3">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-lg">
                <Radio size={32} />
              </div>
              <h3 className="text-base font-bold text-white mb-1">
                Share Live Progress with Friends
              </h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                Generate a secure spectator web link for family or race supporters. They can watch your moving GPS pin, pace, and live metrics in real-time without logging in.
              </p>
            </div>

            {/* Sharing Duration Setting */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock size={13} className="text-emerald-400" />
                <span>Sharing Duration</span>
              </label>

              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { value: '15m', label: '15m' },
                  { value: '30m', label: '30m' },
                  { value: '1h', label: '1h' },
                  { value: '2h', label: '2h' },
                  { value: 'until_ended', label: 'Until End' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedDuration(opt.value as BeaconDuration)}
                    className={`py-2 px-1 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                      selectedDuration === opt.value
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500">
                {selectedDuration === 'until_ended'
                  ? 'Spectator link stays active until you stop or complete your run.'
                  : `Link automatically locks and hides live location after ${
                      selectedDuration === '15m'
                        ? '15 minutes'
                        : selectedDuration === '30m'
                        ? '30 minutes'
                        : selectedDuration === '1h'
                        ? '1 hour'
                        : '2 hours'
                    }.`}
              </p>
            </div>


            <button
              onClick={handleStartBeacon}
              disabled={isStarting}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-lime-400 hover:from-emerald-400 hover:to-lime-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer"
            >
              <Radio size={16} className={isStarting ? 'animate-spin' : ''} />
              <span>{isStarting ? 'Initializing Cloud Beacon...' : 'Start Live Beacon Broadcast'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
