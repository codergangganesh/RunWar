import React, { useEffect } from 'react';
import { Flame, MapPin } from 'lucide-react';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 1400);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between items-center bg-[#e8f3f0] select-none overflow-hidden font-sans animate-fade-in">
      <div className="w-full max-w-xl md:max-w-2xl flex flex-col flex-1 h-full justify-between relative">
        {/* Top Scenic Runner Hero Area */}
        <div className="relative pt-4 px-6 pb-6 min-h-[340px] sm:min-h-[380px] flex flex-col justify-between overflow-hidden">
          {/* Scenic Runner Background Image */}
          <div
            className="absolute inset-0 bg-cover bg-center z-0 scale-105 transition-transform duration-1000 ease-out"
            style={{
              backgroundImage: `url('/images/runner_hero_1.jpg')`,
              backgroundPosition: 'right 20% center',
            }}
          >
            {/* Luminous left gradient to ensure text readability */}
            <div className="absolute inset-0 bg-gradient-to-r from-[#eef7f5]/95 via-[#eef7f5]/75 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#eef7f5] via-transparent to-transparent" />
          </div>

          {/* Top Status Indicators */}


          {/* Slogan & Headline */}
          <div className="relative z-10 mt-6 mb-2">
            <h1 className="font-display text-2xl sm:text-3xl font-black text-slate-950 leading-[1.15] tracking-tight">
              Run Freely<br />
              Track Precisely<br />
              <span className="text-[#00d09c]">Live Healthier.</span>
            </h1>

            <p className="text-xs text-slate-600 font-medium mt-2 leading-relaxed max-w-[260px]">
              Your ultimate GPS jogging and running companion.
            </p>

            {/* Slider Dots Indicator */}
            <div className="flex items-center gap-1.5 mt-3">
              <span className="w-2 h-1.5 rounded-full bg-slate-300" />
              <span className="w-2 h-1.5 rounded-full bg-slate-300" />
              <span className="w-6 h-1.5 rounded-full bg-[#00d09c]" />
            </div>
          </div>
        </div>

        {/* Bottom Curved Mint/White Card */}
        <div className="w-full bg-[#f2faf7] rounded-t-[36px] shadow-2xl px-6 sm:px-8 pt-7 pb-6 z-20 flex-1 flex flex-col justify-between items-center border-t border-emerald-100 relative overflow-hidden">
          {/* Subtle Decorative Wave at Bottom */}
          <div className="absolute inset-x-0 bottom-0 h-28 opacity-25 pointer-events-none overflow-hidden">
            <svg className="w-full h-full text-emerald-400 fill-current" viewBox="0 0 400 120" preserveAspectRatio="none">
              <path d="M0,40 C120,90 280,10 400,60 L400,120 L0,120 Z" />
            </svg>
          </div>

          {/* Centered Brand Emblem & Typography */}
          <div className="relative z-10 flex flex-col items-center gap-3 text-center mt-2">
            {/* Brand Emblem */}
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white border border-emerald-100 shadow-xl p-2 flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="RunWar Logo"
                  className="w-full h-full object-contain rounded-2xl"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <div className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 shadow-sm">
                <Flame size={14} fill="currentColor" />
              </div>
            </div>

            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-slate-950 mt-1">
                RUN<span className="text-[#00d09c]">WAR</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium tracking-wide mt-0.5">
                Precision GPS Jogging & Running Companion
              </p>
            </div>
          </div>

          {/* Loading Indicator */}
          <div className="relative z-10 flex flex-col items-center gap-2 my-auto pt-2">
            <div className="w-7 h-7 border-3 border-emerald-500/20 border-t-[#00d09c] rounded-full animate-spin shadow-sm" />
            <span className="text-[12px] text-slate-500 font-medium tracking-wide">
              Loading Experience...
            </span>
          </div>

          {/* Bottom Watermark */}
          <div className="relative z-10 w-full flex justify-end pr-2">
            <div className="transform rotate-[-6deg] flex flex-col items-end opacity-70">
              <span className="font-serif italic font-bold text-slate-500 text-xs">
                Every Run
              </span>
              <span className="font-serif italic font-bold text-slate-600 text-xs flex flex-col items-center">
                Counts
                <svg className="w-14 h-1.5 text-[#00d09c] mt-0.5" viewBox="0 0 70 8" fill="none">
                  <path d="M2 5.5C20 1.5 50 1.5 68 5.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
