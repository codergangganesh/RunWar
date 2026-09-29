import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, CheckCircle, AlertTriangle, PhoneCall } from 'lucide-react';
import { beaconService } from '../../services/beaconService';

interface EmergencyWatchdogModalProps {
  isOpen: boolean;
  beaconCode?: string | null;
  onDismissSafe: () => void;
  onTriggerSos: () => void;
}

export const EmergencyWatchdogModal: React.FC<EmergencyWatchdogModalProps> = ({
  isOpen,
  beaconCode,
  onDismissSafe,
  onTriggerSos,
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState(30);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Play urgent alert sound and vibrate on mount
  useEffect(() => {
    if (!isOpen) {
      setSecondsRemaining(30);
      return;
    }

    // Trigger vibration pattern
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([400, 200, 400, 200, 600]);
      } catch {}
    }

    // Web Audio alert beep
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch {}

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Auto-trigger SOS when countdown reaches 0
          if (beaconCode) {
            beaconService.setEmergencyAlert(
              beaconCode,
              true,
              'Inactivity watchdog alert: Runner stopped moving for >3 minutes and did not respond to the safety check.'
            );
          }
          onTriggerSos();
          return 0;
        }

        // Periodic vibration every 5 seconds
        if (prev % 5 === 0 && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          try {
            navigator.vibrate([300, 150, 300]);
          } catch {}
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [isOpen, beaconCode, onTriggerSos]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-slate-900 border-2 border-rose-500 rounded-3xl p-6 shadow-[0_0_50px_rgba(244,63,94,0.35)] flex flex-col items-center text-center">
        {/* Pulsing Warning Icon */}
        <div className="relative mb-4">
          <div className="absolute inset-0 rounded-full bg-rose-500 animate-ping opacity-40"></div>
          <div className="relative w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center text-rose-400">
            <ShieldAlert size={36} />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-black text-white uppercase tracking-tight mb-1">
          Inactivity Detected
        </h2>
        <p className="text-xs text-rose-300 font-semibold mb-3">
          You have been stationary for over 3 minutes.
        </p>

        {/* Countdown Ring / Box */}
        <div className="w-full bg-rose-950/50 border border-rose-800/80 rounded-2xl py-3 px-4 mb-5 flex items-center justify-between">
          <span className="text-xs font-semibold text-rose-200">
            Auto-alerting spectators in:
          </span>
          <span className="text-2xl font-black text-rose-400 font-mono tracking-wider">
            {secondsRemaining}s
          </span>
        </div>

        {/* Main Safe Confirmation Button */}
        <button
          onClick={onDismissSafe}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-95 transition-all mb-3 cursor-pointer"
        >
          <CheckCircle size={20} />
          <span>I am Safe / Resume Run</span>
        </button>

        {/* Immediate SOS Button */}
        <button
          onClick={() => {
            if (beaconCode) {
              beaconService.setEmergencyAlert(beaconCode, true);
            }
            onTriggerSos();
          }}
          className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-rose-950 text-rose-400 hover:text-rose-300 border border-rose-900/60 font-bold text-xs uppercase tracking-wide flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
        >
          <PhoneCall size={16} />
          <span>Trigger Emergency SOS Now</span>
        </button>
      </div>
    </div>
  );
};
