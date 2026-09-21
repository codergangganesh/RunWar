import React, { useState } from 'react';
import { Compass, TrendingUp, Award, ShieldCheck, ArrowRight, ArrowLeft, Check, Shield } from 'lucide-react';

interface OnboardingScreenProps {
  onComplete: () => void;
  onSkip: () => void;
}

const slides = [
  {
    id: 1,
    icon: Compass,
    title: 'Track Every Run',
    subtitle: 'REAL-TIME GPS MAPPING',
    description:
      'Pinpoint your position outdoors with high-precision GPS, noise filtering, live pace tracking, and auto-pause when you stop at traffic lights.',
  },
  {
    id: 2,
    icon: TrendingUp,
    title: 'Understand Your Progress',
    subtitle: 'COMPREHENSIVE ANALYTICS',
    description:
      'Analyze your performance with automated kilometer splits, elevation profiles, pace variance curves, and accurate MET calorie estimation.',
  },
  {
    id: 3,
    icon: Award,
    title: 'Build Consistency',
    subtitle: 'STREAKS & MILESTONES',
    description:
      'Set weekly distance goals, maintain active running streaks, crush personal records (1k, 5k, 10k), and unlock fitness badges.',
  },
  {
    id: 4,
    icon: ShieldCheck,
    title: 'Your Data, Your Control',
    subtitle: 'PRIVACY & OFFLINE-FIRST',
    description:
      'GPS location is tracked only during active workouts. Full export to GPX/CSV, offline sync queue, and instant data deletion at any time.',
  },
];

const HERO_IMAGES = [
  '/images/runner_hero_1.jpg',
  '/images/runner_hero_2.jpg',
  '/images/runner_hero_3.jpg',
  '/images/runner_hero_4.jpg',
  '/images/runner_hero_5.jpg',
];

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  onComplete,
  onSkip,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentSlide = slides[currentIndex];
  const isLast = currentIndex === slides.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#e8f3f0] flex flex-col justify-between items-center select-none relative overflow-x-hidden font-sans">
      <div className="w-full max-w-xl md:max-w-2xl flex flex-col flex-1 min-h-screen justify-between relative">
        
        {/* Upper Hero Area with Scenic Mountain Runner Background */}
        <div className="relative pt-3 px-5 sm:px-6 pb-8 min-h-[300px] sm:min-h-[340px] flex flex-col justify-between overflow-hidden">
          {/* 5 Cross-Fading Hero Background Images */}
          {HERO_IMAGES.map((imgSrc, idx) => (
            <div
              key={imgSrc}
              className={`absolute inset-0 bg-cover bg-center z-0 transition-opacity duration-700 ease-in-out ${
                idx === currentIndex % HERO_IMAGES.length ? 'opacity-100 scale-105' : 'opacity-0 scale-100'
              }`}
              style={{
                backgroundImage: `url('${imgSrc}')`,
                backgroundPosition: 'right 20% center',
                transition: 'opacity 0.7s ease-in-out, transform 2s ease-out',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#eef7f5]/95 via-[#eef7f5]/80 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#eef7f5] via-transparent to-transparent" />
            </div>
          ))}

          {/* Top Brand Header Bar & Navigation */}
          <div className="relative z-10 pt-2 sm:pt-4">
            <div className="flex items-center justify-between">
              {currentIndex > 0 ? (
                <button
                  onClick={handlePrev}
                  className="p-2.5 rounded-2xl bg-white/90 border border-slate-200 text-slate-700 hover:text-black shadow-sm active:scale-95 transition-all"
                >
                  <ArrowLeft size={16} />
                </button>
              ) : (
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-full bg-white shadow-md border border-emerald-500/30 p-1 flex items-center justify-center">
                    <img
                      src="/logo.png"
                      alt="RunWar Logo"
                      className="w-full h-full rounded-full object-contain"
                    />
                  </div>
                  <div>
                    <div className="font-display font-black text-base text-slate-950 leading-none">
                      RUNWAR
                    </div>
                    <div className="text-[10px] font-medium text-slate-600 tracking-tight">
                      Run. Track. Improve.
                    </div>
                  </div>
                </div>
              )}

              {!isLast && (
                <button
                  onClick={onSkip}
                  className="text-xs font-bold text-slate-600 hover:text-slate-950 py-1.5 px-4 rounded-full bg-white/90 border border-slate-200 shadow-sm active:scale-95 transition-all"
                >
                  Skip
                </button>
              )}
            </div>
          </div>

          {/* Feature Subtitle, Headline & Step Dots Indicator */}
          <div className="relative z-10 mt-6 mb-2">
            <div className="max-w-[320px] sm:max-w-sm">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#00d09c] mb-1 block">
                {currentSlide.subtitle}
              </span>
              <h1 className="font-display text-2xl sm:text-3xl font-black text-slate-950 leading-[1.15] tracking-tight">
                {currentSlide.title}
              </h1>

              {/* 4 Step Dots Slider Indicator */}
              <div className="flex items-center gap-1.5 mt-3">
                {slides.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === currentIndex
                        ? 'w-6 bg-[#00d09c]'
                        : 'w-2 bg-slate-300 hover:bg-slate-400'
                    }`}
                    aria-label={`Slide ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Sheet Dark Card */}
        <div className="w-full bg-[#09151f] rounded-t-[36px] shadow-2xl px-6 sm:px-8 pt-7 pb-8 z-20 flex-1 flex flex-col justify-between border-t border-slate-800/80 relative">
          
          <div className="absolute inset-x-0 bottom-0 h-32 opacity-15 pointer-events-none overflow-hidden">
            <svg className="w-full h-full text-emerald-500 fill-current" viewBox="0 0 400 120" preserveAspectRatio="none">
              <path d="M0,40 C120,90 280,10 400,60 L400,120 L0,120 Z" />
            </svg>
          </div>

          <div className="w-full max-w-md md:max-w-lg mx-auto relative z-10 flex flex-col justify-between flex-1">
            <div className="pt-1">
              <h2 className="font-display text-2xl sm:text-3xl font-black text-white tracking-tight">
                {currentSlide.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                {currentSlide.description}
              </p>
            </div>

            {/* Bottom Arranged Primary Action Button & Security Badge */}
            <div className="mt-8 mb-2 flex flex-col gap-4">
              <button
                onClick={handleNext}
                className="w-full py-4 px-6 rounded-2xl bg-[#00d09c] hover:bg-[#00ba8b] active:scale-[0.98] text-slate-950 font-black text-base shadow-lg shadow-[#00d09c]/25 flex items-center justify-center gap-2 transition-all"
              >
                {isLast ? (
                  <>
                    <span>Get Started</span>
                    <Check size={18} strokeWidth={2.5} />
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight size={18} strokeWidth={2.5} />
                  </>
                )}
              </button>

              {/* Bottom Security Badge & Script Watermark */}
              <div className="pt-1 flex flex-col items-center gap-1 text-center">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Shield size={13} className="text-emerald-400" />
                  <span>Your data is secure and private.</span>
                </div>

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
