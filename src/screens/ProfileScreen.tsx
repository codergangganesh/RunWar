import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, UserSettings, Workout } from '../types';
import { authService } from '../services/authService';
import { downloadFile, generateWorkoutsCSV } from '../utils/exportGenerators';
import { formatDistance, formatDuration } from '../utils/formatters';
import {
  User,
  Settings,
  Flame,
  Footprints,
  Timer,
  Trophy,
  Target,
  Award,
  Calendar,
  Download,
  Shield,
  LogOut,
  Moon,
  Volume2,
  Pause,
  ChevronRight,
  Sparkles,
  Trash2,
  Check,
  Camera,
  Loader2,
  Image as ImageIcon,
  Activity,
} from 'lucide-react';
import { healthService } from '../services/health/healthService';

interface ProfileScreenProps {
  profile: UserProfile | null;
  settings: UserSettings | null;
  workouts: Workout[];
  onNavigate: (screen: any) => void;
  onSignOut: () => void;
  onUpdateProfile: (updated: UserProfile) => void;
  onUpdateSettings: (updated: UserSettings) => void;
  onRefreshWorkouts?: () => Promise<void>;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  profile,
  settings,
  workouts,
  onNavigate,
  onSignOut,
  onUpdateProfile,
  onUpdateSettings,
  onRefreshWorkouts,
}) => {
  const [editingProfile, setEditingProfile] = useState(false);
  const [healthState, setHealthState] = useState(() => healthService.getPrimaryConnectionState());

  useEffect(() => {
    setHealthState(healthService.getPrimaryConnectionState());
  }, []);
  const [name, setName] = useState(profile?.name || 'Runner');
  const [weight, setWeight] = useState(profile?.weight || 70);
  const [height, setHeight] = useState(profile?.height || 175);
  const [unitSystem, setUnitSystem] = useState(profile?.distance_unit === 'mi' ? 'imperial' : 'metric');
  const [autoPause, setAutoPause] = useState(settings?.auto_pause ?? true);
  const [audioCoaching, setAudioCoaching] = useState(settings?.audio_coaching ?? true);
  const [audioFrequency, setAudioFrequency] = useState(settings?.audio_frequency || '1km');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Career Statistics
  const lifetimeDistanceMeters = workouts.reduce((sum, w) => sum + (w.distance_meters || 0), 0);
  const lifetimeDurationSec = workouts.reduce((sum, w) => sum + (w.duration_seconds || 0), 0);
  const lifetimeWorkouts = workouts.length;
  const longestRunMeters = workouts.reduce((max, w) => Math.max(max, w.distance_meters || 0), 0);

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Image must be under 5MB.');
      return;
    }

    setIsUploadingAvatar(true);
    setAvatarError(null);

    try {
      const { profile: updatedProf } = await authService.uploadAvatar(profile.user_id, file);
      onUpdateProfile(updatedProf);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err: any) {
      console.error('Error uploading avatar to InsForge:', err);
      setAvatarError(err.message || 'Failed to upload image. Please try again.');
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveProfileAndSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    try {
      const distUnit = unitSystem === 'imperial' ? 'mi' : 'km';
      const paceUnit = unitSystem === 'imperial' ? 'min_mi' : 'min_km';
      const weightUnit = unitSystem === 'imperial' ? 'lb' : 'kg';

      const updatedProf = await authService.updateProfile(profile.user_id, {
        name: name.trim(),
        weight,
        height,
        distance_unit: distUnit,
        pace_unit: paceUnit,
        weight_unit: weightUnit,
      });

      const updatedSet = await authService.updateSettings(profile.user_id, {
        auto_pause: autoPause,
        audio_coaching: audioCoaching,
        audio_frequency: audioFrequency,
        distance_unit: distUnit,
        pace_unit: paceUnit,
        weight_unit: weightUnit,
      });

      onUpdateProfile(updatedProf);
      onUpdateSettings(updatedSet);
      setSavedSuccess(true);
      setEditingProfile(false);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error('Error saving settings:', err);
    }
  };

  const handleExportAll = () => {
    const csv = generateWorkoutsCSV(workouts);
    downloadFile(csv, `runwar_all_workouts_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
  };

  const distanceUnit = profile?.distance_unit || 'km';

  return (
    <div className="p-4 space-y-5 animate-fade-in">
      {/* Hidden File Input for Avatar Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        onChange={handleAvatarFileChange}
        className="hidden"
      />

      {/* User Header Profile Card */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 p-5 shadow-md dark:shadow-xl space-y-4 relative overflow-hidden">
        <div className="flex items-center gap-3.5">
          {/* Avatar with Camera Overlay */}
          <div className="relative group">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 to-lime-400 p-0.5 shadow-md shadow-emerald-500/30 dark:shadow-glow-brand shrink-0 block relative overflow-hidden active:scale-95 transition-all"
              title="Change Profile Photo"
            >
              <div className="w-full h-full rounded-[22px] bg-emerald-50 dark:bg-slate-950 overflow-hidden flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-display font-black text-2xl">
                {isUploadingAvatar ? (
                  <Loader2 size={24} className="animate-spin text-emerald-500 dark:text-emerald-400" />
                ) : profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{profile?.name ? profile.name.charAt(0).toUpperCase() : 'R'}</span>
                )}
              </div>
            </button>

            {/* Camera Badge */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white dark:text-slate-950 flex items-center justify-center shadow-md border-2 border-white dark:border-slate-950 hover:bg-emerald-600 active:scale-90 transition-all"
              title="Upload new profile picture"
            >
              <Camera size={12} />
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="font-display text-xl font-black text-emerald-950 dark:text-white truncate">
              {profile?.name || 'Runner'}
            </h2>
            <p className="text-xs text-emerald-800/80 dark:text-slate-400 truncate">
              {profile?.email || 'runner@insforge.app'}
            </p>
            <span className="inline-block mt-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/20">
              RunWar Athlete
            </span>
          </div>

          <button
            onClick={() => setEditingProfile(!editingProfile)}
            className="p-2.5 rounded-xl bg-emerald-50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 text-emerald-900 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-white active:scale-95 transition-all text-xs font-bold"
          >
            {editingProfile ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {avatarError && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
            {avatarError}
          </div>
        )}

        {savedSuccess && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
            <Check size={16} />
            <span>Profile and photo updated successfully!</span>
          </div>
        )}

        {/* Lifetime Statistics Strip */}
        <div className="grid grid-cols-4 gap-2 pt-3 border-t border-emerald-100 dark:border-slate-800/80 text-center">
          <div>
            <div className="text-[9px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Total Dist</div>
            <div className="font-display text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatDistance(lifetimeDistanceMeters, distanceUnit)}
            </div>
            <div className="text-[9px] text-emerald-700/80 dark:text-slate-500 uppercase">{distanceUnit}</div>
          </div>

          <div>
            <div className="text-[9px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Workouts</div>
            <div className="font-display text-base font-black text-emerald-950 dark:text-white mt-0.5">
              {lifetimeWorkouts}
            </div>
            <div className="text-[9px] text-emerald-700/80 dark:text-slate-500">runs</div>
          </div>

          <div>
            <div className="text-[9px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Total Time</div>
            <div className="font-mono text-base font-bold text-emerald-900 dark:text-slate-200 mt-0.5">
              {Math.floor(lifetimeDurationSec / 3600)}h
            </div>
            <div className="text-[9px] text-emerald-700/80 dark:text-slate-500">duration</div>
          </div>

          <div>
            <div className="text-[9px] uppercase font-bold text-emerald-800/80 dark:text-slate-400">Longest</div>
            <div className="font-display text-base font-black text-sky-600 dark:text-sky-400 mt-0.5">
              {formatDistance(longestRunMeters, distanceUnit)}
            </div>
            <div className="text-[9px] text-emerald-700/80 dark:text-slate-500 uppercase">{distanceUnit}</div>
          </div>
        </div>
      </div>

      {/* Edit Profile & Settings Form */}
      {editingProfile ? (
        <form onSubmit={handleSaveProfileAndSettings} className="rounded-3xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 p-5 space-y-4 shadow-md dark:shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-950 dark:text-slate-300">
              Edit Athlete Settings
            </h3>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-500/20 active:scale-95 transition-all"
            >
              {isUploadingAvatar ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Camera size={13} />
              )}
              <span>{isUploadingAvatar ? 'Uploading...' : 'Change Photo'}</span>
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-slate-400 mb-1">
              Display Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-emerald-50/50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 text-emerald-950 dark:text-white text-sm focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-slate-400 mb-1">
              Units System
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setUnitSystem('metric')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  unitSystem === 'metric'
                    ? 'bg-emerald-500 text-white dark:text-slate-950 shadow-sm'
                    : 'bg-emerald-50/50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 text-emerald-800 dark:text-slate-400'
                }`}
              >
                Metric (km, min/km)
              </button>
              <button
                type="button"
                onClick={() => setUnitSystem('imperial')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${
                  unitSystem === 'imperial'
                    ? 'bg-emerald-500 text-white dark:text-slate-950 shadow-sm'
                    : 'bg-emerald-50/50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 text-emerald-800 dark:text-slate-400'
                }`}
              >
                Imperial (mi, min/mi)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-slate-400 mb-1">
                Body Weight ({unitSystem === 'imperial' ? 'lb' : 'kg'})
              </label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-emerald-50/50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 text-emerald-950 dark:text-white text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-slate-400 mb-1">
                Height ({unitSystem === 'imperial' ? 'in' : 'cm'})
              </label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-emerald-50/50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 text-emerald-950 dark:text-white text-sm font-mono"
              />
            </div>
          </div>

          {/* Workout Auto Pause Toggle */}
          <div className="flex items-center justify-between py-2 border-t border-emerald-100 dark:border-slate-800/80">
            <div>
              <div className="text-xs font-bold text-emerald-950 dark:text-white">Auto-Pause</div>
              <div className="text-[11px] text-emerald-700/80 dark:text-slate-400">Pause when stationary for 10s</div>
            </div>
            <input
              type="checkbox"
              checked={autoPause}
              onChange={(e) => setAutoPause(e.target.checked)}
              className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
            />
          </div>

          {/* Audio Coaching Toggle & Frequency */}
          <div className="space-y-2 py-2 border-t border-emerald-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-emerald-950 dark:text-white">Audio Voice Coaching</div>
                <div className="text-[11px] text-emerald-700/80 dark:text-slate-400">Spoken distance and split updates</div>
              </div>
              <input
                type="checkbox"
                checked={audioCoaching}
                onChange={(e) => setAudioCoaching(e.target.checked)}
                className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            {audioCoaching && (
              <select
                value={audioFrequency}
                onChange={(e: any) => setAudioFrequency(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-emerald-50/50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 text-emerald-950 dark:text-white text-xs font-medium focus:outline-none focus:border-emerald-500"
              >
                <option value="1km">Announce Every 1 km / 1 mi</option>
                <option value="0.5km">Announce Every 0.5 km</option>
                <option value="5min">Announce Every 5 Minutes</option>
              </select>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white dark:text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/30 dark:shadow-glow-brand"
          >
            Save Changes
          </button>
        </form>
      ) : (
        /* Fast Navigation Hub */
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-slate-400 px-1">
            FITNESS HUB
          </h3>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => onNavigate('goals')}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-500/50 flex flex-col justify-between text-left active:scale-98 transition-all shadow-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2">
                <Target size={18} />
              </div>
              <span className="text-xs font-bold text-emerald-950 dark:text-white">Goals & Streaks</span>
              <span className="text-[10px] text-emerald-700/80 dark:text-slate-400">Targets & consistency</span>
            </button>

            <button
              onClick={() => onNavigate('achievements')}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-500/50 flex flex-col justify-between text-left active:scale-98 transition-all shadow-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2">
                <Award size={18} />
              </div>
              <span className="text-xs font-bold text-emerald-950 dark:text-white">Achievements</span>
              <span className="text-[10px] text-emerald-700/80 dark:text-slate-400">Milestones & badges</span>
            </button>

            <button
              onClick={() => onNavigate('records')}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-500/50 flex flex-col justify-between text-left active:scale-98 transition-all shadow-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-2">
                <Trophy size={18} />
              </div>
              <span className="text-xs font-bold text-emerald-950 dark:text-white">Personal Records</span>
              <span className="text-[10px] text-emerald-700/80 dark:text-slate-400">1k, 5k, 10k bests</span>
            </button>

            <button
              onClick={() => onNavigate('calendar')}
              className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-500/50 flex flex-col justify-between text-left active:scale-98 transition-all shadow-sm"
            >
              <div className="w-9 h-9 rounded-xl bg-lime-50 dark:bg-lime-500/10 text-lime-600 dark:text-lime-400 flex items-center justify-center mb-2">
                <Calendar size={18} />
              </div>
              <span className="text-xs font-bold text-emerald-950 dark:text-white">Calendar</span>
              <span className="text-[10px] text-emerald-700/80 dark:text-slate-400">Monthly activity grid</span>
            </button>
          </div>
        </div>
      )}

      {/* Connected Health Providers */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 p-4 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-slate-400">
            CONNECTED HEALTH
          </h3>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
            Health Data Sync
          </span>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('connected_health')}
          className="w-full p-3 rounded-2xl bg-emerald-50/50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-slate-700 text-left flex items-center justify-between active:scale-98 transition-all cursor-pointer"
        >
          <div className="flex items-center gap-3">
            {/* Google Multi-Color Icon */}
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-xs shrink-0">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </div>

            <div>
              <div className="text-xs font-bold text-emerald-950 dark:text-white flex items-center gap-1.5">
                <span>Google Health / Fit</span>
                {healthState.isConnected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </div>
              <div className="text-[10px] text-emerald-700/80 dark:text-slate-400">
                {healthState.isConnected
                  ? `Connected • ${healthState.accountEmail || 'Syncing workouts'}`
                  : 'Import workouts and fitness metrics'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                healthState.isConnected
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-slate-200/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
              }`}
            >
              {healthState.isConnected ? 'Manage' : 'Connect'}
            </span>
            <ChevronRight size={14} className="text-emerald-700/60 dark:text-slate-500" />
          </div>
        </button>
      </div>

      {/* Account & Data Management Actions */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 p-4 space-y-2 shadow-sm">
        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-slate-400 mb-2">
          DATA & PRIVACY
        </h3>

        <button
          onClick={handleExportAll}
          className="w-full p-3 rounded-2xl bg-emerald-50/50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-slate-700 text-emerald-900 dark:text-slate-300 hover:text-emerald-950 dark:hover:text-white flex items-center justify-between text-xs font-semibold active:scale-98 transition-all"
        >
          <div className="flex items-center gap-2.5">
            <Download size={16} className="text-emerald-600 dark:text-emerald-400" />
            <span>Export All Workouts (CSV)</span>
          </div>
          <ChevronRight size={16} className="text-emerald-700/60 dark:text-slate-500" />
        </button>

        <button
          onClick={() => onNavigate('privacy')}
          className="w-full p-3 rounded-2xl bg-emerald-50/50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-slate-700 text-emerald-900 dark:text-slate-300 hover:text-emerald-950 dark:hover:text-white flex items-center justify-between text-xs font-semibold active:scale-98 transition-all"
        >
          <div className="flex items-center gap-2.5">
            <Shield size={16} className="text-sky-600 dark:text-sky-400" />
            <span>Privacy Dashboard & Permissions</span>
          </div>
          <ChevronRight size={16} className="text-emerald-700/60 dark:text-slate-500" />
        </button>

        <button
          onClick={onSignOut}
          className="w-full p-3 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-between text-xs font-bold active:scale-98 transition-all mt-2"
        >
          <div className="flex items-center gap-2.5">
            <LogOut size={16} />
            <span>Sign Out</span>
          </div>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
