import React, { useState, useEffect } from 'react';
import { UserProfile, DistanceUnit, PaceUnit, WeightUnit, WorkoutType } from '../types';
import { authService } from '../services/authService';
import { Check, Flame, Ruler, Weight, Activity, Sparkles, User, Target, ArrowRight, Shield } from 'lucide-react';

interface ProfileSetupScreenProps {
  userId: string;
  initialName?: string;
  initialEmail?: string;
  onComplete: (profile: UserProfile) => void;
}

export const ProfileSetupScreen: React.FC<ProfileSetupScreenProps> = ({
  userId,
  initialName = 'Runner',
  initialEmail = '',
  onComplete,
}) => {
  const [name, setName] = useState(initialName);
  const [age, setAge] = useState<number>(26);
  const [gender, setGender] = useState<string>('unspecified');
  const [height, setHeight] = useState<number>(175);
  const [weight, setWeight] = useState<number>(70);
  const [unitSystem, setUnitSystem] = useState<'metric' | 'imperial'>('metric');
  const [fitnessGoal, setFitnessGoal] = useState<string>('5k_run');
  const [workoutType, setWorkoutType] = useState<WorkoutType>('run');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialName && (!name || name === 'Runner')) {
      setName(initialName);
    }
  }, [initialName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const distanceUnit: DistanceUnit = unitSystem === 'imperial' ? 'mi' : 'km';
      const paceUnit: PaceUnit = unitSystem === 'imperial' ? 'min_mi' : 'min_km';
      const weightUnit: WeightUnit = unitSystem === 'imperial' ? 'lb' : 'kg';

      const profile = await authService.updateProfile(userId, {
        name: name.trim() || 'Runner',
        email: initialEmail,
        age,
        gender,
        height,
        weight,
        distance_unit: distanceUnit,
        pace_unit: paceUnit,
        weight_unit: weightUnit,
        fitness_goal: fitnessGoal,
        typical_workout_type: workoutType,
      });

      onComplete(profile);
    } catch (err) {
      console.error('Error saving profile setup:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#e8f3f0] flex flex-col justify-between items-center select-none relative overflow-x-hidden font-sans">
      <div className="w-full max-w-xl md:max-w-2xl flex flex-col flex-1 min-h-screen justify-between relative">
        
        {/* Upper Hero Area with Scenic Mountain Runner Background */}
        <div className="relative pt-3 px-5 sm:px-6 pb-8 min-h-[220px] sm:min-h-[250px] flex flex-col justify-between overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center z-0 scale-105"
            style={{
              backgroundImage: `url('/images/runner_hero_bg.jpg')`,
              backgroundPosition: 'right 20% center',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[#eef7f5]/95 via-[#eef7f5]/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#eef7f5] via-transparent to-transparent" />
          </div>

          {/* Top Brand Header Bar */}
          <div className="relative z-10 flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white shadow-sm border border-emerald-500/30 p-1 flex items-center justify-center">
                <img
                  src="/logo.png"
                  alt="RunWar Logo"
                  className="w-full h-full rounded-full object-contain"
                />
              </div>
              <span className="font-display font-black text-sm text-slate-950">RUNWAR</span>
            </div>

            <div className="text-[11px] font-bold text-slate-700 bg-white/90 border border-slate-200 px-3 py-1 rounded-full shadow-sm">
              Step 2 of 2
            </div>
          </div>

          {/* Headline */}
          <div className="relative z-10 mt-4 mb-1">
            <h1 className="font-display text-2xl sm:text-3xl font-black text-slate-950 leading-tight tracking-tight">
              Personalize your<br />running <span className="text-[#00d09c]">profile.</span>
            </h1>
            <p className="text-xs text-slate-600 font-medium mt-1">
              Set your measurements for precise calorie & pace metrics.
            </p>
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
                <linearGradient id="profMntFar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d09c" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="#00d09c" stopOpacity="0.03" />
                </linearGradient>
                <linearGradient id="profMntMid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d09c" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#00d09c" stopOpacity="0.06" />
                </linearGradient>
                <linearGradient id="profMntNear" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d09c" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#00d09c" stopOpacity="0.08" />
                </linearGradient>
                <linearGradient id="profPathGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00d09c" stopOpacity="0.10" />
                  <stop offset="100%" stopColor="#00d09c" stopOpacity="0.30" />
                </linearGradient>
                <linearGradient id="profFadeTop" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                  <stop offset="60%" stopColor="#ffffff" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </linearGradient>
              </defs>

              <path d="M-30,140 Q60,65 170,105 T380,75 T530,120 L530,280 L-30,280 Z" fill="url(#profMntFar)" />
              <path d="M-30,165 Q80,105 190,145 T410,110 T530,155 L530,280 L-30,280 Z" fill="url(#profMntMid)" />
              <path d="M-30,195 Q90,155 180,180 T370,160 T530,195 L530,280 L-30,280 Z" fill="url(#profMntNear)" />

              <g fill="#00d09c" opacity="0.30">
                <polygon points="35,160 43,178 27,178" /><polygon points="35,170 45,190 25,190" /><polygon points="35,182 47,204 23,204" /><rect x="33" y="204" width="4" height="6" />
                <polygon points="65,150 73,168 57,168" /><polygon points="65,160 75,180 55,180" /><polygon points="65,172 78,194 52,194" /><rect x="63" y="194" width="4" height="6" />
                <polygon points="95,165 102,180 88,180" /><polygon points="95,175 104,192 86,192" /><rect x="93" y="192" width="4" height="6" />
                <polygon points="460,155 467,172 453,172" /><polygon points="460,166 469,184 451,184" /><polygon points="460,178 472,198 448,198" /><rect x="458" y="198" width="4" height="6" />
                <polygon points="430,165 437,180 423,180" /><polygon points="430,175 439,192 421,192" /><rect x="428" y="192" width="4" height="6" />
              </g>

              <path d="M245,150 C240,178 215,215 130,280 L370,280 C290,230 270,185 255,150 Z" fill="url(#profPathGrad)" />

              <g transform="translate(195, 155) scale(0.7)" fill="#00d09c" opacity="0.45">
                <circle cx="20" cy="8" r="4.5" />
                <path d="M17,14 C17,12 23,12 23,14 L24,28 L16,28 Z" />
                <path d="M17,15 L10,22 L13,26" stroke="#00d09c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M23,15 L29,20 L27,24" stroke="#00d09c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M18,27 L11,36 L15,44" stroke="#00d09c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <path d="M22,27 L28,34 L33,31" stroke="#00d09c" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </g>

              <g transform="translate(370, 75) rotate(-8)" opacity="0.4">
                <text x="0" y="0" fontFamily="serif" fontStyle="italic" fontWeight="bold" fontSize="16" fill="#00d09c" textAnchor="middle">
                  Stronger Every Day
                </text>
                <path d="M-50,8 Q0,2 50,8" stroke="#00d09c" strokeWidth="2" strokeLinecap="round" fill="none" />
              </g>

              <rect x="0" y="0" width="500" height="140" fill="url(#profFadeTop)" />
            </svg>
          </div>

          <form onSubmit={handleSubmit} className="w-full max-w-md md:max-w-lg mx-auto relative z-10 flex flex-col gap-3.5">
            <div className="mb-1">
              <h2 className="font-display text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Profile Details
              </h2>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Display Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#00d09c] focus:bg-white shadow-sm transition-all"
                />
              </div>
            </div>

            {/* Unit System Toggle */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Units System
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setUnitSystem('metric')}
                  className={`py-3 px-3 rounded-2xl text-xs font-black transition-all ${
                    unitSystem === 'metric'
                      ? 'bg-[#00d09c] text-slate-950 shadow-md shadow-[#00d09c]/25'
                      : 'bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Metric (km, kg)
                </button>
                <button
                  type="button"
                  onClick={() => setUnitSystem('imperial')}
                  className={`py-3 px-3 rounded-2xl text-xs font-black transition-all ${
                    unitSystem === 'imperial'
                      ? 'bg-[#00d09c] text-slate-950 shadow-md shadow-[#00d09c]/25'
                      : 'bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Imperial (mi, lb)
                </button>
              </div>
            </div>

            {/* Height & Weight Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1">
                  <Ruler size={13} className="text-emerald-600" />
                  <span>Height ({unitSystem === 'imperial' ? 'in' : 'cm'})</span>
                </label>
                <input
                  type="number"
                  min={50}
                  max={250}
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#00d09c] focus:bg-white shadow-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1">
                  <Weight size={13} className="text-emerald-600" />
                  <span>Weight ({unitSystem === 'imperial' ? 'lb' : 'kg'})</span>
                </label>
                <input
                  type="number"
                  min={30}
                  max={300}
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#00d09c] focus:bg-white shadow-sm transition-all"
                />
              </div>
            </div>

            {/* Primary Fitness Goal */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1">
                <Target size={13} className="text-emerald-600" />
                <span>Primary Goal</span>
              </label>
              <select
                value={fitnessGoal}
                onChange={(e) => setFitnessGoal(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-[#00d09c] focus:bg-white shadow-sm transition-all"
              >
                <option value="5k_run">5K Milestone</option>
                <option value="10k_run">10K Race Training</option>
                <option value="half_marathon">Half Marathon</option>
                <option value="weight_loss">Weight & Calorie Burn</option>
                <option value="daily_habit">Daily Consistency & Streak</option>
              </select>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-4 px-6 rounded-2xl bg-[#00d09c] hover:bg-[#00ba8b] active:scale-[0.98] disabled:opacity-50 text-slate-950 font-black text-base shadow-lg shadow-[#00d09c]/25 flex items-center justify-center gap-2 transition-all"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Complete Setup</span>
                  <Check size={18} strokeWidth={2.5} />
                </>
              )}
            </button>

            {/* Security Badge */}
            <div className="pt-1 flex items-center justify-center gap-1 text-[11px] text-slate-500">
              <Shield size={13} className="text-emerald-600" />
              <span>Your data is secure and private.</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
