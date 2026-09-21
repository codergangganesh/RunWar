import React, { useState } from 'react';
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

        {/* Bottom Sheet Dark Card */}
        <div className="w-full bg-[#09151f] rounded-t-[36px] shadow-2xl px-6 sm:px-8 pt-7 pb-8 z-20 flex-1 flex flex-col justify-between border-t border-slate-800/80 relative">
          
          <div className="absolute inset-x-0 bottom-0 h-32 opacity-15 pointer-events-none overflow-hidden">
            <svg className="w-full h-full text-emerald-500 fill-current" viewBox="0 0 400 120" preserveAspectRatio="none">
              <path d="M0,40 C120,90 280,10 400,60 L400,120 L0,120 Z" />
            </svg>
          </div>

          <form onSubmit={handleSubmit} className="w-full max-w-md md:max-w-lg mx-auto relative z-10 flex flex-col gap-3.5">
            <div className="mb-1">
              <h2 className="font-display text-xl sm:text-2xl font-black text-white tracking-tight">
                Profile Details
              </h2>
            </div>

            {/* Display Name */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
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
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-[#112334]/80 border border-[#1b354e] text-white text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#00d09c] focus:bg-[#13283b] transition-all"
                />
              </div>
            </div>

            {/* Unit System Toggle */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Units System
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setUnitSystem('metric')}
                  className={`py-3 px-3 rounded-2xl text-xs font-black transition-all ${
                    unitSystem === 'metric'
                      ? 'bg-[#00d09c] text-slate-950 shadow-md shadow-[#00d09c]/25'
                      : 'bg-[#112334]/80 border border-[#1b354e] text-slate-400 hover:text-white'
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
                      : 'bg-[#112334]/80 border border-[#1b354e] text-slate-400 hover:text-white'
                  }`}
                >
                  Imperial (mi, lb)
                </button>
              </div>
            </div>

            {/* Height & Weight Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                  <Ruler size={13} className="text-[#00d09c]" />
                  <span>Height ({unitSystem === 'imperial' ? 'in' : 'cm'})</span>
                </label>
                <input
                  type="number"
                  min={50}
                  max={250}
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="w-full px-4 py-3.5 rounded-2xl bg-[#112334]/80 border border-[#1b354e] text-white text-sm focus:outline-none focus:border-[#00d09c] focus:bg-[#13283b] transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                  <Weight size={13} className="text-[#00d09c]" />
                  <span>Weight ({unitSystem === 'imperial' ? 'lb' : 'kg'})</span>
                </label>
                <input
                  type="number"
                  min={30}
                  max={300}
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="w-full px-4 py-3.5 rounded-2xl bg-[#112334]/80 border border-[#1b354e] text-white text-sm focus:outline-none focus:border-[#00d09c] focus:bg-[#13283b] transition-all"
                />
              </div>
            </div>

            {/* Primary Fitness Goal */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                <Target size={13} className="text-[#00d09c]" />
                <span>Primary Goal</span>
              </label>
              <select
                value={fitnessGoal}
                onChange={(e) => setFitnessGoal(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl bg-[#112334]/80 border border-[#1b354e] text-white text-sm focus:outline-none focus:border-[#00d09c] focus:bg-[#13283b] transition-all"
              >
                <option value="5k_run" className="bg-[#09151f] text-white">5K Milestone</option>
                <option value="10k_run" className="bg-[#09151f] text-white">10K Race Training</option>
                <option value="half_marathon" className="bg-[#09151f] text-white">Half Marathon</option>
                <option value="weight_loss" className="bg-[#09151f] text-white">Weight & Calorie Burn</option>
                <option value="daily_habit" className="bg-[#09151f] text-white">Daily Consistency & Streak</option>
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
            <div className="pt-1 flex items-center justify-center gap-1 text-[11px] text-slate-400">
              <Shield size={13} className="text-emerald-400" />
              <span>Your data is secure and private.</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
