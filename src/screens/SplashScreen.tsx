import React, { useEffect } from 'react';
import { Flame } from 'lucide-react';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 1200);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between p-8 bg-slate-950 text-white select-none overflow-hidden animate-fade-in">
      {/* Dynamic Background Image with Depth & Cinematic Vignette */}
      <div
        className="absolute inset-0 bg-cover bg-center z-0 scale-105 transition-transform duration-1000 ease-out"
        style={{
          backgroundImage: `url('/images/splash_bg.jpg')`,
          backgroundPosition: 'center 35%',
        }}
      >
        {/* Subtle cinematic gradient overlays that keep the background image vivid and punchy */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/30 to-slate-950/85" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(2,6,23,0.75)_100%)]" />
      </div>

      {/* Top Brand Pill */}
      <div className="relative z-10 w-full flex justify-between items-center px-2">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/60 border border-emerald-500/20 backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-[#00d09c] animate-pulse" />
          <span className="text-[11px] font-semibold tracking-wider text-emerald-400 uppercase">GPS Active</span>
        </div>
        <span className="text-[11px] font-mono text-slate-400 bg-slate-900/60 border border-slate-800/80 px-2.5 py-1 rounded-full shadow-sm backdrop-blur-md">
          v1.0.0
        </span>
      </div>

      {/* Centered Brand Emblem & Typography in Glassmorphic Card */}
      <div className="relative z-10 flex flex-col items-center gap-4 text-center px-6 py-6 rounded-3xl bg-slate-950/50 border border-white/10 backdrop-blur-md shadow-2xl shadow-black/80 max-w-sm w-full">
        {/* Animated Brand Emblem */}
        <div className="relative">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-slate-900/90 border border-emerald-500/40 p-2 shadow-[0_0_40px_rgba(0,208,156,0.35)] animate-scale-in backdrop-blur-xl">
            <img
              src="/logo.png"
              alt="RunWar Logo"
              className="w-full h-full object-contain rounded-2xl"
            />
          </div>
          <div className="absolute -bottom-2 -right-2 p-1.5 rounded-full bg-[#00d09c] text-slate-950 shadow-lg shadow-[#00d09c]/40 animate-bounce">
            <Flame size={16} fill="currentColor" />
          </div>
        </div>

        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight text-white mt-2 drop-shadow-md">
            RUN<span className="text-[#00d09c]">WAR</span>
          </h1>
          <p className="text-xs text-slate-300 font-medium tracking-wide mt-1 drop-shadow-sm">
            Precision GPS Jogging & Running Companion
          </p>
        </div>
      </div>

      {/* Bottom Loading Indicator */}
      <div className="relative z-10 flex flex-col items-center gap-2 pb-2">
        <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-[#00d09c] rounded-full animate-spin shadow-[0_0_15px_rgba(0,208,156,0.5)]" />
        <span className="text-[11px] text-slate-300 font-medium tracking-wide drop-shadow-sm">Loading Experience...</span>
      </div>
    </div>
  );
};
