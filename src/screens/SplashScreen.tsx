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
      {/* Dynamic Background Image with Depth & Dark Vignette */}
      <div
        className="absolute inset-0 bg-cover bg-center z-0 scale-105 animate-pulse-subtle"
        style={{
          backgroundImage: `url('/images/runner_hero_1.jpg')`,
          backgroundPosition: 'center 35%',
        }}
      >
        {/* Multi-layered dark gradients for rich contrast & readability */}
        <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[2px]" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/80" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(9,21,31,0.85)_100%)]" />
      </div>

      {/* Top Header info */}
      <div className="relative z-10 w-full flex justify-end">
        <span className="text-[11px] font-mono text-emerald-400/80 bg-slate-900/80 border border-slate-800/80 px-2.5 py-0.5 rounded-full shadow-sm backdrop-blur-md">
          v1.0.0
        </span>
      </div>

      {/* Centered Brand Emblem & Typography */}
      <div className="relative z-10 flex flex-col items-center gap-4 text-center">
        {/* Animated Brand Emblem */}
        <div className="relative">
          <div className="w-28 h-28 rounded-3xl bg-slate-900/90 border border-emerald-500/30 p-2 shadow-[0_0_50px_rgba(0,208,156,0.3)] animate-scale-in backdrop-blur-xl">
            <img
              src="/logo.png"
              alt="RunWar Logo"
              className="w-full h-full object-contain rounded-2xl"
            />
          </div>
          <div className="absolute -bottom-2 -right-2 p-1.5 rounded-full bg-[#00d09c] text-slate-950 shadow-lg shadow-[#00d09c]/40">
            <Flame size={16} fill="currentColor" />
          </div>
        </div>

        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight text-white mt-3 drop-shadow-md">
            RUN<span className="text-[#00d09c]">WAR</span>
          </h1>
          <p className="text-xs text-slate-300 font-medium tracking-wide mt-1 drop-shadow-sm">
            Precision GPS Jogging & Running Companion
          </p>
        </div>
      </div>

      {/* Bottom Loading Indicator */}
      <div className="relative z-10 flex flex-col items-center gap-2">
        <div className="w-6 h-6 border-2 border-emerald-500/20 border-t-[#00d09c] rounded-full animate-spin" />
        <span className="text-[11px] text-slate-400 font-medium">Powered by InsForge Cloud</span>
      </div>
    </div>
  );
};
