import React, { useState, useEffect, useRef } from 'react';
import { tetherService } from '../../services/tetherService';
import { TetherSession, TetherVoiceClip } from '../../types/tether';
import { Mic, Volume2, Radio } from 'lucide-react';

interface TetherWalkieTalkieProps {
  session: TetherSession;
  className?: string;
}

export const TetherWalkieTalkie: React.FC<TetherWalkieTalkieProps> = ({ session, className = '' }) => {
  const [isPressing, setIsPressing] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [incomingClip, setIncomingClip] = useState<TetherVoiceClip | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const partnerName = session.peer?.name || session.host.name || 'Buddy';
  const partnerFirstName = partnerName.split(' ')[0];

  // Listen for incoming voice clips
  useEffect(() => {
    const unsubscribe = tetherService.onVoiceClip((clip) => {
      setIncomingClip(clip);
      // Automatically clear after clip duration + 2s buffer
      const clearTimer = setTimeout(() => {
        setIncomingClip(null);
      }, (clip.durationSec + 2) * 1000);
      return () => clearTimeout(clearTimer);
    });
    return () => unsubscribe();
  }, []);

  // Handle pointer down (press to talk)
  const handlePointerDown = async (e: React.PointerEvent) => {
    e.preventDefault();
    if (isPressing) return;
    setPermissionError(null);

    const started = await tetherService.startVoiceRecording();
    if (started) {
      setIsPressing(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 6) {
            // Auto stop at 6 seconds maximum
            handlePointerUp();
            return 6;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      setPermissionError('Microphone not accessible. Tap to retry.');
    }
  };

  // Handle pointer up (release to send)
  const handlePointerUp = async () => {
    if (!isPressing) return;
    setIsPressing(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    await tetherService.stopVoiceRecording();
    setRecordingSeconds(0);
  };

  return (
    <div className={`relative flex flex-col items-center gap-1.5 select-none ${className}`}>
      {/* Incoming Audio Transmission Banner */}
      {incomingClip && (
        <div className="absolute -top-9 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-slate-900/95 text-emerald-400 border border-emerald-500/40 text-[11px] font-bold shadow-lg flex items-center gap-1.5 whitespace-nowrap animate-bounce z-30">
          <Volume2 size={12} className="animate-pulse text-emerald-400" />
          <span>📻 {incomingClip.senderName} speaking...</span>
          <div className="flex items-center gap-0.5">
            <span className="w-1 h-2.5 bg-emerald-400 animate-pulse rounded-full" />
            <span className="w-1 h-3.5 bg-emerald-400 animate-pulse delay-75 rounded-full" />
            <span className="w-1 h-2 bg-emerald-400 animate-pulse delay-150 rounded-full" />
          </div>
        </div>
      )}

      {/* Permission or Status Error Banner */}
      {permissionError && (
        <div className="text-[10px] font-semibold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-lg border border-rose-500/20">
          {permissionError}
        </div>
      )}

      {/* Compact Simple Push-to-Talk (PTT) Pill */}
      <div className="relative">
        {isPressing && (
          <div className="absolute -inset-1 rounded-full bg-rose-500/30 animate-ping pointer-events-none" />
        )}

        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
          className={`relative px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full flex items-center gap-2 text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer touch-none ${
            isPressing
              ? 'bg-rose-600 text-white ring-2 ring-rose-400/50 shadow-rose-600/40'
              : 'bg-emerald-600/90 hover:bg-emerald-500 text-white shadow-emerald-600/20 border border-emerald-400/40 backdrop-blur-sm'
          }`}
          aria-label="Hold to speak to partner"
        >
          {isPressing ? (
            <Radio size={13} className="animate-spin text-white" />
          ) : (
            <Mic size={13} className="text-white" />
          )}

          <span>
            {isPressing ? `Transmitting (${recordingSeconds}s)...` : `Hold to Talk (${partnerFirstName})`}
          </span>
        </button>
      </div>
    </div>
  );
};
