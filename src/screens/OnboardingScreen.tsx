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

        {/* Bottom Sheet Card with Scenic Landscape Watermark */}
        <div className="w-full bg-white rounded-t-[36px] shadow-2xl px-6 sm:px-8 pt-7 pb-8 z-20 flex-1 flex flex-col justify-between border-t border-emerald-100/80 relative overflow-hidden">
          {/* Scenic Mountain & Runner Landscape Watermark Background */}
          <div className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden">
            <svg
              className="w-full h-full object-cover"
              viewBox="0 0 500 280"
              preserveAspectRatio="xMidYMid slice"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="onbMntFar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d09c" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="#00d09c" stopOpacity="0.03" />
                </linearGradient>
                <linearGradient id="onbMntMid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d09c" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#00d09c" stopOpacity="0.06" />
                </linearGradient>
                <linearGradient id="onbMntNear" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d09c" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#00d09c" stopOpacity="0.08" />
                </linearGradient>
                <linearGradient id="onbPathGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d09c" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="#00d09c" stopOpacity="0.30" />
                </linearGradient>
                <linearGradient id="onbFadeTop" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                  <stop offset="60%" stopColor="#ffffff" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Distant Mountain Peak Layer */}
              <path
                d="M-30,140 Q60,65 170,105 T380,75 T530,120 L530,280 L-30,280 Z"
                fill="url(#onbMntFar)"
              />

              {/* Midground Mountain Ridge Layer */}
              <path
                d="M-30,165 Q80,105 190,145 T410,110 T530,155 L530,280 L-30,280 Z"
                fill="url(#onbMntMid)"
              />

              {/* Foreground Rolling Hills */}
              <path
                d="M-30,195 Q90,155 180,180 T370,160 T530,195 L530,280 L-30,280 Z"
                fill="url(#onbMntNear)"
              />

              {/* Pine Tree Clusters on Left Ridge */}
              <g fill="#00d09c" opacity="0.30">
                <polygon points="35,160 43,178 27,178" />
                <polygon points="35,170 45,190 25,190" />
                <polygon points="35,182 47,204 23,204" />
                <rect x="33" y="204" width="4" height="6" />

                <polygon points="65,150 73,168 57,168" />
                <polygon points="65,160 75,180 55,180" />
                <polygon points="65,172 78,194 52,194" />
                <rect x="63" y="194" width="4" height="6" />

                <polygon points="95,165 102,180 88,180" />
                <polygon points="95,175 104,192 86,192" />
                <rect x="93" y="192" width="4" height="6" />
              </g>

              {/* Pine Tree Clusters on Right Ridge */}
              <g fill="#00d09c" opacity="0.30">
                <polygon points="460,155 467,172 453,172" />
                <polygon points="460,166 469,184 451,184" />
                <polygon points="460,178 472,198 448,198" />
                <rect x="458" y="198" width="4" height="6" />

                <polygon points="430,165 437,180 423,180" />
                <polygon points="430,175 439,192 421,192" />
                <rect x="428" y="192" width="4" height="6" />
              </g>

              {/* Winding Scenic Road */}
              <path
                d="M245,150 C240,178 215,215 130,280 L370,280 C290,230 270,185 255,150 Z"
                fill="url(#onbPathGrad)"
              />

              {/* Runner Silhouette Mid-Stride */}
              <g transform="translate(195, 155) scale(0.7)" fill="#00d09c" opacity="0.45">
                <circle cx="20" cy="8" r="4.5" />
                <path d="M17,14 C17,12 23,12 23,14 L24,28 L16,28 Z" />
                <path d="M17,15 L10,22 L13,26" stroke="#00d09c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M23,15 L29,20 L27,24" stroke="#00d09c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M18,27 L11,36 L15,44" stroke="#00d09c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M22,27 L28,34 L33,31" stroke="#00d09c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </g>

              {/* Script Slogan in Watermark Background */}
              <g transform="translate(370, 75) rotate(-8)" opacity="0.4">
                <text
                  x="0"
                  y="0"
                  fontFamily="serif"
                  fontStyle="italic"
                  fontWeight="bold"
                  fontSize="16"
                  fill="#00d09c"
                  textAnchor="middle"
                >
                  Stronger Every Day
                </text>
                <path
                  d="M-50,8 Q0,2 50,8"
                  stroke="#00d09c"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>

              {/* Atmospheric Mist Top Blend */}
              <rect x="0" y="0" width="500" height="140" fill="url(#onbFadeTop)" />
            </svg>
          </div>

          <div className="w-full max-w-md md:max-w-lg mx-auto relative z-10 flex flex-col justify-between flex-1">
            <div className="pt-1">
              <h2 className="font-display text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {currentSlide.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
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
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Shield size={13} className="text-emerald-600" />
                  <span>Your data is secure and private.</span>
                </div>

                <div className="w-full flex justify-end pr-2 pt-1 opacity-70">
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
