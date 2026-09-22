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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between p-8 bg-slate-950 text-white select-none animate-fade-in">
      <div className="w-full flex justify-end">
        <span className="text-[11px] font-mono text-slate-400">v1.0.0</span>
      </div>

      <div className="flex flex-col items-center gap-4 text-center">
        {/* Animated Brand Emblem */}
        <div className="relative">
          <div className="w-28 h-28 rounded-3xl bg-slate-900/90 border border-slate-800 p-2 shadow-glow-brand animate-scale-in">
            <img
              src="/logo.png"
              alt="RunWar Logo"
              className="w-full h-full object-contain rounded-2xl"
            />
          </div>
          <div className="absolute -bottom-2 -right-2 p-1.5 rounded-full bg-emerald-500 text-slate-950 shadow-md">
            <Flame size={16} fill="currentColor" />
          </div>
        </div>

        <div>
          <h1 className="font-display text-3xl font-black tracking-tight text-white mt-3">
            RUN<span className="text-emerald-400">WAR</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium tracking-wide mt-1">
            Precision GPS Jogging & Running Companion
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="w-6 h-6 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin" />
        <span className="text-[11px] text-slate-400 font-medium">Powered by InsForge Cloud</span>
      </div>
    </div>
  );
};
