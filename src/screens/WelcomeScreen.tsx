import React, { useState, useEffect } from 'react';
import { ArrowRight, Shield } from 'lucide-react';

interface WelcomeScreenProps {
  onStartOnboarding: () => void;
  onLogin: () => void;
  onGuestAccess: () => void;
}

const HERO_IMAGES = [
  '/images/runner_hero_1.jpg',
  '/images/runner_hero_2.jpg',
  '/images/runner_hero_3.jpg',
  '/images/runner_hero_4.jpg',
  '/images/runner_hero_5.jpg',
];

const HERO_SLOGANS = [
  { headline: 'Track every mile', highlight: 'fitness goals.', sub: 'High-accuracy outdoor GPS tracking, real-time pace splits, voice coaching, and cloud analytics.' },
  { headline: 'Run city streets', highlight: 'daily streaks.', sub: 'Build unbreakable running momentum with daily distance streaks and personal milestones.' },
  { headline: 'Conquer any trail', highlight: 'personal bests.', sub: 'Master hill climbs and elevation gains with accurate barometric and GPS gradient analytics.' },
  { headline: 'Sunset jogging', highlight: 'heart health.', sub: 'Elevate your endurance, cardio stamina, and metabolic calorie burn with every stride.' },
  { headline: 'Sprint to victory', highlight: 'speed records.', sub: 'Unlock 1K, 5K, and 10K sprint achievements with instant split pace telemetry.' },
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onStartOnboarding,
  onLogin,
  onGuestAccess,
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Automatic smooth 5-image cycle
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 3800);
    return () => clearInterval(timer);
  }, []);

  const currentSlogan = HERO_SLOGANS[currentImageIndex] || HERO_SLOGANS[0];

  return (
    <div className="min-h-screen w-full bg-[#e8f3f0] flex flex-col justify-between items-center select-none relative overflow-x-hidden font-sans">
      <div className="w-full max-w-xl md:max-w-2xl flex flex-col flex-1 min-h-screen justify-between relative">
        
        {/* Upper Hero Area with 5 Auto-Cycling Background Images */}
        <div className="relative pt-3 px-5 sm:px-6 pb-8 min-h-[340px] sm:min-h-[380px] flex flex-col justify-between overflow-hidden">
          
          {/* 5 Cross-Fading Hero Background Images */}
          {HERO_IMAGES.map((imgSrc, idx) => (
            <div
              key={imgSrc}
              className={`absolute inset-0 bg-cover bg-center z-0 transition-opacity duration-1000 ease-in-out ${
                idx === currentImageIndex ? 'opacity-100 scale-105' : 'opacity-0 scale-100'
              }`}
              style={{
                backgroundImage: `url('${imgSrc}')`,
                backgroundPosition: 'right 20% center',
                transition: 'opacity 1s ease-in-out, transform 4s ease-out',
              }}
            >
              {/* Luminous left gradient to ensure text readability */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#eef7f5]/95 via-[#eef7f5]/75 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#eef7f5] via-transparent to-transparent" />
            </div>
          ))}

          {/* RunWar Branding Header */}
          <div className="relative z-10 pt-2 sm:pt-4">
            {/* RunWar Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-white shadow-md border border-emerald-500/30 p-1 flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="RunWar Logo"
                  className="w-full h-full rounded-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <div>
                <div className="font-display font-black text-lg sm:text-xl tracking-tight text-slate-950 leading-none">
                  RUNWAR
                </div>
                <div className="text-[10px] font-medium text-slate-600 tracking-tight">
                  Run. Track. Improve.
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Headline & 5-Step Dots Indicator */}
          <div className="relative z-10 mt-6 mb-2 flex items-end justify-between">
            <div className="max-w-[280px] sm:max-w-xs">
              <h1 className="font-display text-2xl sm:text-3xl font-black text-slate-950 leading-[1.15] tracking-tight transition-all duration-500">
                {currentSlogan.headline}<br />
                and conquer your<br />
                <span className="text-[#00d09c]">{currentSlogan.highlight}</span>
              </h1>

              <p className="text-xs text-slate-600 font-medium mt-2 leading-relaxed min-h-[36px] transition-opacity duration-500">
                {currentSlogan.sub}
              </p>

              {/* 5 Step Dots Slider Indicator */}
              <div className="flex items-center gap-1.5 mt-3">
                {HERO_IMAGES.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`h-1.5 rounded-full transition-all duration-500 ${
                      idx === currentImageIndex
                        ? 'w-6 bg-[#00d09c]'
                        : 'w-2 bg-slate-300 hover:bg-slate-400'
                    }`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>
            </div>

            {/* Script Slogan Tag */}
            <div className="hidden xs:flex flex-col items-end transform -rotate-6 mr-1 mb-6">
              <span className="font-serif italic font-bold text-slate-700 text-sm tracking-wide">
                A Healthier
              </span>
              <span className="font-serif italic font-bold text-slate-800 text-sm tracking-wide flex flex-col items-center">
                Happier You
                <svg className="w-16 h-2 text-[#00d09c] mt-0.5" viewBox="0 0 70 8" fill="none">
                  <path d="M2 5.5C20 1.5 50 1.5 68 5.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Sheet Dark Card */}
        <div className="w-full bg-[#09151f] rounded-t-[36px] shadow-2xl px-6 sm:px-8 pt-7 pb-8 z-20 flex-1 flex flex-col justify-between border-t border-slate-800/80 relative">
          
          {/* Subtle wave background watermark */}
          <div className="absolute inset-x-0 bottom-0 h-32 opacity-15 pointer-events-none overflow-hidden">
            <svg className="w-full h-full text-emerald-500 fill-current" viewBox="0 0 400 120" preserveAspectRatio="none">
              <path d="M0,40 C120,90 280,10 400,60 L400,120 L0,120 Z" />
            </svg>
          </div>

          <div className="w-full max-w-md md:max-w-lg mx-auto relative z-10 flex flex-col justify-between flex-1">
            {/* Header Content */}
            <div className="pt-1">
              <h2 className="font-display text-2xl sm:text-3xl font-black text-white tracking-tight">
                Let's Get You Started
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                Track your real-time jogging pace, conquer fitness goals, and crush personal records easily.
              </p>
            </div>

            {/* Bottom Arranged Primary Action Button & Security Badge */}
            <div className="mt-6 mb-2 flex flex-col gap-2.5">
              <button
                onClick={onStartOnboarding}
                className="w-full py-4 px-6 rounded-2xl bg-[#00d09c] hover:bg-[#00ba8b] active:scale-[0.98] text-slate-950 font-black text-base shadow-lg shadow-[#00d09c]/25 flex items-center justify-center gap-2 transition-all"
              >
                <span>Get Started</span>
                <ArrowRight size={18} strokeWidth={2.5} />
              </button>

              <button
                onClick={onLogin}
                className="w-full py-3.5 px-6 rounded-2xl bg-slate-900/80 hover:bg-slate-800 active:scale-[0.98] text-white border border-slate-700/80 font-bold text-sm flex items-center justify-center gap-2 transition-all"
              >
                <span>Already have an account? <strong className="text-[#00d09c]">Log In</strong></span>
              </button>

              {/* Bottom Security Badge & Script Watermark */}
              <div className="pt-2 flex flex-col items-center gap-1 text-center">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Shield size={13} className="text-emerald-400" />
                  <span>Your data is secure and private.</span>
                </div>

                {/* Watermark Script */}
                <div className="w-full flex justify-end pr-2 pt-1 opacity-60">
                  <span className="font-serif italic font-bold text-[#00d09c] text-xs">
                    Every Run Counts
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
