import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, UserSettings, Workout, GearItem, PersonalRecord, PocketUnlockMode, Goal } from '../types';
import { authService } from '../services/authService';
import { challengeService } from '../services/challengeService';
import { gearService } from '../services/gearService';
import { goalsService } from '../services/goalsService';
import { DEFAULT_ACHIEVEMENTS } from '../services/achievementsService';
import { downloadFile, generateWorkoutsCSV } from '../utils/exportGenerators';
import { formatDistance, formatDuration, formatPace } from '../utils/formatters';
import { BottomSheet } from '../components/ui/BottomSheet';
import { optimizeImage } from '../utils/imageOptimizer';
import { useUsernameCheck } from '../hooks/useUsernameCheck';
import {
  User,
  Settings,
  Flame,
  Footprints,
  Timer,
  Trophy,
  Award,
  Target,
  Play,
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
  Lock,
  Image as ImageIcon,
  X,
  Activity,
  Star,
  Plus,
  Pencil,
  ShieldCheck,
  CheckCircle2,
  Mountain,
  Zap,
  Sliders,
  RefreshCw,
} from 'lucide-react';
import { healthService } from '../services/health/healthService';
import { AudioCoachModal } from '../components/workout/AudioCoachModal';
import { audioCoach } from '../services/audioCoach';

interface ProfileScreenProps {
  profile: UserProfile | null;
  settings: UserSettings | null;
  workouts: Workout[];
  records?: PersonalRecord[];
  goals?: Goal[];
  onRefreshGoals?: () => void;
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
  records = [],
  goals,
  onRefreshGoals,
  onNavigate,
  onSignOut,
  onUpdateProfile,
  onUpdateSettings,
  onRefreshWorkouts,
}) => {
  const [editingProfile, setEditingProfile] = useState(false);
  const [localGoals, setLocalGoals] = useState<Goal[]>(goals || []);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [goalFilter, setGoalFilter] = useState<'all' | 'active' | 'completed' | 'paused'>('all');
  const [showAllGoals, setShowAllGoals] = useState(false);
  const [newGoalType, setNewGoalType] = useState<Goal['goal_type']>('weekly_distance');
  const [newTargetValue, setNewTargetValue] = useState<number>(20);
  const [newPeriod, setNewPeriod] = useState<Goal['period']>('weekly');
  const [isSavingGoal, setIsSavingGoal] = useState(false);

  useEffect(() => {
    if (goals) {
      setLocalGoals(goals);
    } else if (profile?.user_id) {
      goalsService.getGoals(profile.user_id).then((res) => setLocalGoals(res));
    }
  }, [goals, profile?.user_id]);

  const handleOpenCreateGoal = () => {
    setEditingGoal(null);
    setNewGoalType('weekly_distance');
    setNewTargetValue(20);
    setNewPeriod('weekly');
    setShowGoalModal(true);
  };

  const handleStartEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setNewGoalType(goal.goal_type);
    setNewTargetValue(goal.target_value);
    setNewPeriod(goal.period);
    setShowGoalModal(true);
  };

  const handleApplyPreset = (type: Goal['goal_type'], target: number, period: Goal['period']) => {
    setEditingGoal(null);
    setNewGoalType(type);
    setNewTargetValue(target);
    setNewPeriod(period);
    setShowGoalModal(true);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setIsSavingGoal(true);
    try {
      if (editingGoal) {
        const updated = await goalsService.updateGoal(editingGoal.id, {
          goal_type: newGoalType,
          target_value: newTargetValue,
          period: newPeriod,
        });
        setLocalGoals((prev) =>
          prev.map((g) =>
            g.id === editingGoal.id
              ? updated || {
                ...g,
                goal_type: newGoalType,
                target_value: newTargetValue,
                period: newPeriod,
              }
              : g
          )
        );
      } else {
        const created = await goalsService.createGoal({
          user_id: profile.user_id,
          goal_type: newGoalType,
          target_value: newTargetValue,
          period: newPeriod,
          status: 'active',
        });
        setLocalGoals((prev) => [created, ...prev]);
      }
      setShowGoalModal(false);
      setEditingGoal(null);
      onRefreshGoals?.();
    } catch (err) {
      console.error('Error saving goal:', err);
    } finally {
      setIsSavingGoal(false);
    }
  };

  const handleCreateGoal = handleSaveGoal;

  const handleToggleGoalStatus = async (goal: Goal) => {
    const nextStatus = goal.status === 'active' ? 'paused' : 'active';
    await goalsService.updateGoalStatus(goal.id, nextStatus);
    setLocalGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, status: nextStatus } : g)));
    onRefreshGoals?.();
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!window.confirm('Are you sure you want to delete this goal?')) return;
    await goalsService.deleteGoal(goalId);
    setLocalGoals((prev) => prev.filter((g) => g.id !== goalId));
    onRefreshGoals?.();
  };

  const [healthState, setHealthState] = useState(() => healthService.getPrimaryConnectionState());

  useEffect(() => {
    setHealthState(healthService.getPrimaryConnectionState());
  }, []);
  const [name, setName] = useState(profile?.name || 'Runner');
  const [weight, setWeight] = useState(profile?.weight || 70);
  const [height, setHeight] = useState(profile?.height || 175);
  const [unitSystem, setUnitSystem] = useState(profile?.distance_unit === 'mi' ? 'imperial' : 'metric');
  
  // Real-time unique username availability check
  const usernameCheck = useUsernameCheck(profile?.username || '', profile?.user_id || '');
  const {
    usernameInput,
    setUsernameInput,
    status: usernameStatus,
    message: usernameMessage,
    suggestions: usernameSuggestions,
    isAvailable: isUsernameAvailable,
    isChecking: isUsernameChecking,
    isTaken: isUsernameTaken,
    isInvalid: isUsernameInvalid,
  } = usernameCheck;
  const [autoPause, setAutoPause] = useState(settings?.auto_pause ?? true);
  const [audioCoaching, setAudioCoaching] = useState(settings?.audio_coaching ?? true);
  const [audioFrequency, setAudioFrequency] = useState(settings?.audio_frequency || '1km');
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [pocketUnlockMode, setPocketUnlockMode] = useState<PocketUnlockMode>(() => {
    const cached = localStorage.getItem('runwar_pocket_unlock_mode') as PocketUnlockMode;
    if (cached === 'hold' || cached === 'swipe' || cached === 'both') return cached;
    return settings?.pocket_unlock_mode || 'both';
  });

  useEffect(() => {
    if (settings?.pocket_unlock_mode) {
      setPocketUnlockMode(settings.pocket_unlock_mode);
    }
  }, [settings?.pocket_unlock_mode]);

  const handleToggleHold = async (enable: boolean) => {
    let next: PocketUnlockMode;
    if (enable) {
      next = pocketUnlockMode === 'swipe' ? 'both' : 'hold';
    } else {
      next = 'swipe';
    }
    setPocketUnlockMode(next);
    try {
      localStorage.setItem('runwar_pocket_unlock_mode', next);
      if ('vibrate' in navigator) navigator.vibrate(25);
    } catch { }

    if (profile?.user_id) {
      try {
        const updated = await authService.updateSettings(profile.user_id, {
          pocket_unlock_mode: next,
        });
        onUpdateSettings(updated);
      } catch (err) {
        console.warn('Failed to update pocket unlock mode in cloud:', err);
        if (settings) {
          onUpdateSettings({ ...settings, pocket_unlock_mode: next });
        }
      }
    } else if (settings) {
      onUpdateSettings({ ...settings, pocket_unlock_mode: next });
    }
  };

  const handleToggleSwipe = async (enable: boolean) => {
    let next: PocketUnlockMode;
    if (enable) {
      next = pocketUnlockMode === 'hold' ? 'both' : 'swipe';
    } else {
      next = 'hold';
    }
    setPocketUnlockMode(next);
    try {
      localStorage.setItem('runwar_pocket_unlock_mode', next);
      if ('vibrate' in navigator) navigator.vibrate(25);
    } catch { }

    if (profile?.user_id) {
      try {
        const updated = await authService.updateSettings(profile.user_id, {
          pocket_unlock_mode: next,
        });
        onUpdateSettings(updated);
      } catch (err) {
        console.warn('Failed to update pocket unlock mode in cloud:', err);
        if (settings) {
          onUpdateSettings({ ...settings, pocket_unlock_mode: next });
        }
      }
    } else if (settings) {
      onUpdateSettings({ ...settings, pocket_unlock_mode: next });
    }
  };
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [saveProfileSuccess, setSaveProfileSuccess] = useState(false);
  const [saveProfileError, setSaveProfileError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Instant Avatar Cache for 0ms immediate loading
  const [instantAvatar, setInstantAvatar] = useState<string | null>(() => {
    if (profile?.user_id) {
      const cached = localStorage.getItem(`runwar_instant_avatar_${profile.user_id}`);
      if (cached) return cached;
    }
    return profile?.avatar_url || null;
  });

  useEffect(() => {
    if (profile?.avatar_url) {
      setInstantAvatar(profile.avatar_url);
      if (profile.user_id) {
        try {
          localStorage.setItem(`runwar_instant_avatar_${profile.user_id}`, profile.avatar_url);
        } catch { }
      }
    }
  }, [profile?.avatar_url, profile?.user_id]);

  // Gear & Shoe tracker state
  const [gearList, setGearList] = useState<GearItem[]>(() => {
    return profile?.user_id ? gearService.getCachedGear(profile.user_id) : [];
  });
  const [refreshingGearId, setRefreshingGearId] = useState<string | null>(null);
  const [showAddShoeModal, setShowAddShoeModal] = useState(false);
  const [newShoeBrand, setNewShoeBrand] = useState('Nike');
  const [newShoeModel, setNewShoeModel] = useState('');
  const [newShoeMaxDistanceKm, setNewShoeMaxDistanceKm] = useState(500);
  const [newShoeInitialDistanceKm, setNewShoeInitialDistanceKm] = useState(0);
  const [newShoeImageFile, setNewShoeImageFile] = useState<File | null>(null);
  const [newShoeImagePreview, setNewShoeImagePreview] = useState<string | null>(null);
  const [isSavingShoe, setIsSavingShoe] = useState(false);
  const shoeFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (profile?.user_id) {
      gearService.getGear(profile.user_id).then(setGearList);
    }
  }, [profile?.user_id]);

  const handleShoeImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    try {
      // Instantly optimize and compress to ~50KB WebP/JPEG for 0ms loading
      const { file: optimizedFile, dataUrl } = await optimizeImage(file, 512, 512, 0.85);
      setNewShoeImageFile(optimizedFile);
      setNewShoeImagePreview(dataUrl);
    } catch {
      setNewShoeImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewShoeImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddShoe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !newShoeModel.trim() || isSavingShoe) return;

    setIsSavingShoe(true);
    try {
      // 1. Instantly use the client-side dataUrl so the shoe displays with 0ms delay
      const instantImageUrl = newShoeImagePreview || null;
      const distanceFactor = distanceUnit === 'mi' ? 1609.344 : 1000;
      const initialMeters = Math.max(0, Math.round(Number(newShoeInitialDistanceKm || 0) * distanceFactor));
      const targetMeters = Math.max(10000, Math.round(Number(newShoeMaxDistanceKm || (distanceUnit === 'mi' ? 400 : 600)) * distanceFactor));

      const added = await gearService.addGear(profile.user_id, {
        name: `${newShoeBrand} ${newShoeModel.trim()}`,
        brand: newShoeBrand,
        model: newShoeModel.trim(),
        max_distance_meters: targetMeters,
        current_distance_meters: initialMeters,
        is_active: gearList.length === 0,
        image_url: instantImageUrl,
      });

      // Update UI immediately (0ms latency!)
      setGearList([added, ...gearList.filter((g) => g.id !== added.id)]);
      setShowAddShoeModal(false);
      setNewShoeModel('');
      setNewShoeMaxDistanceKm(distanceUnit === 'mi' ? 400 : 600);
      setNewShoeInitialDistanceKm(0);
      const fileToUpload = newShoeImageFile;
      setNewShoeImageFile(null);
      setNewShoeImagePreview(null);

      // 2. In background, upload tiny file to InsForge storage and update cloud URL
      if (fileToUpload && profile.user_id && profile.user_id !== 'guest_user') {
        gearService.uploadGearImage(profile.user_id, fileToUpload).then(async (cloudUrl) => {
          if (cloudUrl && cloudUrl !== instantImageUrl) {
            await gearService.updateGearImage(profile.user_id, added.id, cloudUrl);
            setGearList((prev) =>
              prev.map((g) => (g.id === added.id ? { ...g, image_url: cloudUrl } : g))
            );
          }
        }).catch((err) => {
          console.warn('Background shoe photo sync notice:', err);
        });
      }
    } catch (err) {
      console.error('Error adding shoe:', err);
    } finally {
      setIsSavingShoe(false);
    }
  };

  const handleSetActiveShoe = async (gearId: string) => {
    if (!profile) return;
    const updated = await gearService.setActiveGear(profile.user_id, gearId);
    setGearList(updated);
  };

  const handleDeleteShoe = async (gearId: string) => {
    if (!profile) return;
    if (!window.confirm('Are you sure you want to remove this shoe from your gear closet?')) return;
    const updated = await gearService.deleteGear(profile.user_id, gearId);
    setGearList(updated);
  };

  const handleSyncShoeWithWorkouts = async (gearId: string) => {
    if (!profile) return;
    try {
      const updated = await gearService.setGearDistance(profile.user_id, gearId, lifetimeDistanceMeters);
      setGearList(updated);
    } catch (e) {
      console.warn('Failed to sync shoe distance:', e);
    }
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Career Statistics
  const lifetimeDistanceMeters = workouts.reduce((sum, w) => sum + (w.distance_meters || 0), 0);
  const lifetimeDurationSec = workouts.reduce((sum, w) => sum + (w.duration_seconds || 0), 0);
  const lifetimeWorkouts = workouts.length;
  const longestRunMeters = workouts.reduce((max, w) => Math.max(max, w.distance_meters || 0), 0);

  const handleRefreshShoeDistance = async (gearId: string) => {
    if (!profile) return;
    setRefreshingGearId(gearId);
    try {
      if ('vibrate' in navigator) navigator.vibrate(25);

      // 1. Refresh global workouts data if callback available
      if (onRefreshWorkouts) {
        try {
          await onRefreshWorkouts();
        } catch { }
      }

      // 2. Fetch latest gear list from server/cache
      const latestGear = await gearService.getGear(profile.user_id);
      const target = latestGear.find((g) => g.id === gearId) || gearList.find((g) => g.id === gearId);
      if (!target) return;

      // 3. Compute real-time distance from user's workouts
      const shoeCreatedAt = target.created_at ? new Date(target.created_at).getTime() : 0;
      const workoutsSinceCreation = workouts.filter(
        (w) => !shoeCreatedAt || new Date(w.started_at).getTime() >= shoeCreatedAt - 60000
      );
      const distanceSinceCreation = workoutsSinceCreation.reduce((sum, w) => sum + (w.distance_meters || 0), 0);

      // Real distance is the maximum of:
      // - current stored distance on shoe
      // - workouts completed since shoe was created
      // - if active shoe or single shoe, total lifetime workout distance
      let realDistanceMeters = target.current_distance_meters || 0;
      if (latestGear.length === 1 || target.is_active) {
        realDistanceMeters = Math.max(realDistanceMeters, lifetimeDistanceMeters, distanceSinceCreation);
      } else {
        realDistanceMeters = Math.max(realDistanceMeters, distanceSinceCreation);
      }

      // 4. Update in database and local cache
      const updated = await gearService.setGearDistance(profile.user_id, gearId, realDistanceMeters);
      setGearList(updated);
    } catch (err) {
      console.warn('Failed to refresh shoe distance:', err);
    } finally {
      setTimeout(() => setRefreshingGearId(null), 450);
    }
  };

  // Pinned Trophy Case Badges
  const pinnedIds = profile?.pinned_achievements || ['first_run', '5k_club', 'speed_demon'];
  const pinnedBadges = DEFAULT_ACHIEVEMENTS.filter((a) => pinnedIds.includes(a.id)).slice(0, 3);

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    setAvatarError(null);

    try {
      // 1. Instantly compress and optimize client-side using Canvas (max 512x512, ~40-70KB)
      const { file: optimizedFile, dataUrl } = await optimizeImage(file, 512, 512, 0.85);

      // 2. Display instantly with ZERO latency!
      setInstantAvatar(dataUrl);
      if (profile.user_id) {
        try {
          localStorage.setItem(`runwar_instant_avatar_${profile.user_id}`, dataUrl);
        } catch { }
      }
      onUpdateProfile({ ...profile, avatar_url: dataUrl });

      // 3. Upload tiny ~40KB file to InsForge storage in background
      setIsUploadingAvatar(true);
      const { profile: updatedProf } = await authService.uploadAvatar(profile.user_id, optimizedFile);
      onUpdateProfile(updatedProf);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err: any) {
      console.error('Error uploading avatar to InsForge:', err);
      // Even if cloud sync has notice, local instant image continues working
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveProfileAndSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || isSavingProfile) return;

    setIsSavingProfile(true);
    setSaveProfileSuccess(false);
    setSaveProfileError(null);

    try {
      const distUnit = unitSystem === 'imperial' ? 'mi' : 'km';
      const paceUnit = unitSystem === 'imperial' ? 'min_mi' : 'min_km';
      const weightUnit = unitSystem === 'imperial' ? 'lb' : 'kg';

      // 1. Update username if modified and available
      const cleanInput = usernameInput.replace(/^@/, '').toLowerCase().trim();
      const currentClean = (profile.username || '').replace(/^@/, '').toLowerCase().trim();
      let newUsername = profile.username;

      if (cleanInput && cleanInput !== currentClean) {
        if (!isUsernameAvailable) {
          setIsSavingProfile(false);
          setSaveProfileError(usernameMessage || 'Username is not available.');
          return;
        }
        const usernameRes = await challengeService.setUsername(profile.user_id, cleanInput);
        if (usernameRes.error) {
          setIsSavingProfile(false);
          setSaveProfileError(usernameRes.error);
          return;
        }
        newUsername = cleanInput;
      }

      const updatedProf = await authService.updateProfile(profile.user_id, {
        name: name.trim(),
        username: newUsername,
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
        pocket_unlock_mode: pocketUnlockMode,
      });

      try {
        localStorage.setItem('runwar_pocket_unlock_mode', pocketUnlockMode);
      } catch { }

      onUpdateProfile(updatedProf);
      onUpdateSettings(updatedSet);

      // Show brief success checkmark animation on button
      setSaveProfileSuccess(true);
      try {
        if ('vibrate' in navigator) navigator.vibrate([30, 40, 30]);
      } catch { }

      // Keep success state visible for 600ms before closing edit mode
      setTimeout(() => {
        setIsSavingProfile(false);
        setSaveProfileSuccess(false);
        setEditingProfile(false);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }, 650);
    } catch (err: any) {
      console.error('Error saving settings:', err);
      setIsSavingProfile(false);
      setSaveProfileSuccess(false);
      setSaveProfileError(err?.message || 'Failed to save settings. Please try again.');
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
              <div className="w-full h-full rounded-[22px] bg-emerald-50 dark:bg-slate-950 overflow-hidden flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-display font-black text-2xl relative">
                {instantAvatar ? (
                  <img
                    src={instantAvatar}
                    alt={profile?.name || 'Athlete'}
                    className="w-full h-full object-cover"
                    loading="eager"
                    decoding="async"
                  />
                ) : (
                  <span>{profile?.name ? profile.name.charAt(0).toUpperCase() : 'R'}</span>
                )}
                {isUploadingAvatar && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center">
                    <Loader2 size={20} className="animate-spin text-white" />
                  </div>
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
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400 font-mono">
                @{profile?.username || 'runner'}
              </span>
              <span className="text-slate-300 dark:text-slate-700 text-xs">•</span>
              <p className="text-xs text-emerald-800/80 dark:text-slate-400 truncate">
                {profile?.email || 'runner@insforge.app'}
              </p>
            </div>
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

        {saveProfileError && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
            <X size={16} className="shrink-0" />
            <span>{saveProfileError}</span>
          </div>
        )}

        {savedSuccess && (
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2 animate-slide-up shadow-2xs">
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Settings and preferences updated successfully!</span>
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
        <form onSubmit={handleSaveProfileAndSettings} className="rounded-3xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 p-5 space-y-4 shadow-md dark:shadow-xl text-left">
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

          {/* Athlete Username Field with Live Availability Check (Locked if set) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-slate-400">
                Athlete Unique Username
              </label>
              {profile?.username && (
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                  <Lock size={10} /> Locked / Permanent
                </span>
              )}
            </div>
            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-sm font-bold text-emerald-600 dark:text-emerald-400 select-none">
                @
              </span>
              <input
                type="text"
                disabled={!!profile?.username}
                value={profile?.username || usernameInput}
                onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="e.g. ganesh_runner"
                maxLength={20}
                className={`w-full pl-8 pr-10 py-2.5 rounded-xl text-sm font-bold outline-none transition-all ${
                  profile?.username
                    ? 'bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed select-none'
                    : isUsernameTaken || isUsernameInvalid
                    ? 'border-rose-500 focus:border-rose-500 bg-rose-50/20 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400'
                    : usernameStatus === 'available'
                    ? 'border-emerald-500 focus:border-emerald-500 text-emerald-950 dark:text-white'
                    : 'border-emerald-200 dark:border-slate-800 text-emerald-950 dark:text-white focus:border-emerald-500'
                }`}
              />

              <div className="absolute right-3.5 flex items-center pointer-events-none">
                {profile?.username ? (
                  <Lock size={15} className="text-slate-400 dark:text-slate-600" />
                ) : isUsernameChecking ? (
                  <Loader2 size={16} className="animate-spin text-emerald-500" />
                ) : usernameStatus === 'available' ? (
                  <Check size={16} className="text-emerald-500 font-bold" />
                ) : (isUsernameTaken || isUsernameInvalid) ? (
                  <X size={16} className="text-rose-500 font-bold" />
                ) : null}
              </div>
            </div>

            {/* Status Feedback Message or Locked Explanation */}
            {profile?.username ? (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 mt-1">
                🔒 Your username is permanent and cannot be modified after creation.
              </p>
            ) : usernameMessage && (
              <p className={`text-[11px] font-semibold flex items-center gap-1 mt-1 ${
                isUsernameTaken || isUsernameInvalid
                  ? 'text-rose-500'
                  : usernameStatus === 'available'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-400'
              }`}>
                {isUsernameTaken && <span>⚠️ Username already taken</span>}
                {usernameStatus === 'available' && <span>✓ Username available</span>}
                {isUsernameInvalid && <span>❌ {usernameMessage}</span>}
              </p>
            )}

            {/* Smart Suggestions Pills */}
            {usernameSuggestions && usernameSuggestions.length > 0 && (
              <div className="mt-2 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Available Suggestions:</span>
                <div className="flex flex-wrap gap-1.5">
                  {usernameSuggestions.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => setUsernameInput(sug)}
                      className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-all cursor-pointer"
                    >
                      @{sug}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-slate-400 mb-1">
              Units System
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setUnitSystem('metric')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${unitSystem === 'metric'
                  ? 'bg-emerald-500 text-white dark:text-slate-950 shadow-sm'
                  : 'bg-emerald-50/50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 text-emerald-800 dark:text-slate-400'
                  }`}
              >
                Metric (km, min/km)
              </button>
              <button
                type="button"
                onClick={() => setUnitSystem('imperial')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${unitSystem === 'imperial'
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
              <div className="space-y-2 mt-2">
                <select
                  value={audioFrequency}
                  onChange={(e: any) => setAudioFrequency(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-emerald-50/50 dark:bg-slate-950 border border-emerald-200 dark:border-slate-800 text-emerald-950 dark:text-white text-xs font-medium focus:outline-none focus:border-emerald-500"
                >
                  <option value="1km">Announce Every 1 km / 1 mi</option>
                  <option value="0.5km">Announce Every 0.5 km</option>
                  <option value="5min">Announce Every 5 Minutes</option>
                </select>

                <button
                  type="button"
                  onClick={() => setShowAudioModal(true)}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-98"
                >
                  <Sliders size={13} />
                  <span>Customize Voice, Speed & Chimes</span>
                </button>
              </div>
            )}
          </div>

          {/* Pocket Safe Hold to Unlock Toggle */}
          <div className="flex items-center justify-between py-2 border-t border-emerald-100 dark:border-slate-800/80">
            <div>
              <div className="text-xs font-bold text-emerald-950 dark:text-white">Hold to Unlock (Pocket Safe)</div>
              <div className="text-[11px] text-emerald-700/80 dark:text-slate-400">
                Circular 1-second hold button to unlock screen
              </div>
            </div>
            <input
              type="checkbox"
              checked={pocketUnlockMode === 'hold' || pocketUnlockMode === 'both'}
              onChange={(e) => handleToggleHold(e.target.checked)}
              className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
            />
          </div>

          {/* Pocket Safe Swipe to Unlock Toggle */}
          <div className="flex items-center justify-between py-2 border-t border-emerald-100 dark:border-slate-800/80">
            <div>
              <div className="text-xs font-bold text-emerald-950 dark:text-white">Swipe to Unlock (Pocket Safe)</div>
              <div className="text-[11px] text-emerald-700/80 dark:text-slate-400">
                Horizontal slide slider to unlock screen
              </div>
            </div>
            <input
              type="checkbox"
              checked={pocketUnlockMode === 'swipe' || pocketUnlockMode === 'both'}
              onChange={(e) => handleToggleSwipe(e.target.checked)}
              className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
            />
          </div>

          {saveProfileError && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 animate-fade-in">
              <X size={15} className="shrink-0" />
              <span>{saveProfileError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSavingProfile}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs shadow-md transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer ${saveProfileSuccess
              ? 'bg-emerald-600 text-white shadow-emerald-600/30'
              : isSavingProfile
                ? 'bg-emerald-500/80 text-white cursor-wait opacity-90'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white dark:text-slate-950 shadow-emerald-500/30 dark:shadow-glow-brand'
              }`}
          >
            {isSavingProfile && !saveProfileSuccess && (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Updating Profile...</span>
              </>
            )}

            {saveProfileSuccess && (
              <>
                <CheckCircle2 size={16} className="text-white scale-110 animate-scale-in" />
                <span>Saved successfully!</span>
              </>
            )}

            {!isSavingProfile && !saveProfileSuccess && (
              <span>Save Changes</span>
            )}
          </button>
        </form>
      ) : (
        /* Fast Navigation Hub */
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-slate-400 px-1">
            FITNESS HUB
          </h3>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => onNavigate('goals')}
              className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-500/50 flex flex-col justify-between text-left active:scale-98 transition-all shadow-sm group"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                <Target size={17} />
              </div>
              <span className="text-xs font-bold text-emerald-950 dark:text-white truncate">Fitness Goals</span>
              <span className="text-[9px] text-emerald-700/80 dark:text-slate-400 truncate">Weekly targets</span>
            </button>

            <button
              onClick={() => onNavigate('achievements')}
              className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-500/50 flex flex-col justify-between text-left active:scale-98 transition-all shadow-sm group"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                <Award size={17} />
              </div>
              <span className="text-xs font-bold text-emerald-950 dark:text-white truncate">Achievements</span>
              <span className="text-[9px] text-emerald-700/80 dark:text-slate-400 truncate">Milestones & XP</span>
            </button>

            <button
              onClick={() => onNavigate('records')}
              className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-500/50 flex flex-col justify-between text-left active:scale-98 transition-all shadow-sm group"
            >
              <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-1.5 group-hover:scale-105 transition-transform">
                <Trophy size={17} />
              </div>
              <span className="text-xs font-bold text-emerald-950 dark:text-white truncate">PR Records</span>
              <span className="text-[9px] text-emerald-700/80 dark:text-slate-400 truncate">Fastest paces</span>
            </button>
          </div>
        </div>
      )}

      {/* Dedicated Fitness Goals Section */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 space-y-4 shadow-sm">
        {/* Header & Quick Actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Target size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white truncate">
                FITNESS GOALS
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {localGoals.length === 0
                  ? 'Track consistent weekly & monthly targets'
                  : `${localGoals.filter((g) => g.status === 'active').length} active · ${localGoals.filter((g) => g.current_value >= g.target_value).length} achieved`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onNavigate('goals')}
              className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer px-2 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
              title="Open full Goals Dashboard"
            >
              <span>Full View</span>
              <ChevronRight size={13} />
            </button>
            <button
              onClick={handleOpenCreateGoal}
              className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100/90 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-500/30 active:scale-95 transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <Plus size={13} />
              <span>Add Goal</span>
            </button>
          </div>
        </div>

        {/* Filter Chips Bar (Only shown if user has goals) */}
        {localGoals.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {(
              [
                { id: 'all', label: 'All', count: localGoals.length },
                { id: 'active', label: 'Active', count: localGoals.filter((g) => g.status === 'active' && g.current_value < g.target_value).length },
                { id: 'completed', label: 'Completed', count: localGoals.filter((g) => g.current_value >= g.target_value).length },
                { id: 'paused', label: 'Paused', count: localGoals.filter((g) => g.status === 'paused').length },
              ] as const
            ).map((filter) => (
              <button
                key={filter.id}
                onClick={() => setGoalFilter(filter.id)}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${goalFilter === filter.id
                  ? 'bg-emerald-500 text-white dark:text-slate-950 shadow-2xs'
                  : 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-800'
                  }`}
              >
                <span>{filter.label}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-full ${goalFilter === filter.id
                    ? 'bg-white/25 text-white dark:text-slate-950 font-black'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                >
                  {filter.count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Quick Presets Strip (When no goals) */}
        {localGoals.length === 0 && (
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50/70 via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/20 border border-emerald-100/80 dark:border-slate-800 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-2xs">
              <Target size={22} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">No fitness goals active yet</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-0.5">
                Set weekly mileage or workout frequency targets. Your runs will automatically track progress!
              </p>
            </div>

            <div className="pt-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                Quick Start Presets
              </div>
              <div className="grid grid-cols-2 gap-2 text-left">
                <button
                  type="button"
                  onClick={() => handleApplyPreset('weekly_distance', 20, 'weekly')}
                  className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200/70 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500/40 text-left transition-all active:scale-95 group shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-black">
                    <Footprints size={14} />
                    <span>20 {distanceUnit} / Week</span>
                  </div>
                  <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">Weekly volume target</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyPreset('workout_count', 3, 'weekly')}
                  className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200/70 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500/40 text-left transition-all active:scale-95 group shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-black">
                    <Flame size={14} />
                    <span>3 Runs / Week</span>
                  </div>
                  <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">Consistency routine</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyPreset('single_run', 5, 'weekly')}
                  className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200/70 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500/40 text-left transition-all active:scale-95 group shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400 text-xs font-black">
                    <Zap size={14} />
                    <span>5 {distanceUnit} Single Run</span>
                  </div>
                  <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">Single session target</div>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyPreset('monthly_distance', 50, 'monthly')}
                  className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200/70 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-500/40 text-left transition-all active:scale-95 group shadow-2xs cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 text-xs font-black">
                    <Trophy size={14} />
                    <span>50 {distanceUnit} / Month</span>
                  </div>
                  <div className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">Monthly mileage build</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Goals List (Filtered) */}
        {localGoals.length > 0 && (
          <div className="space-y-3">
            {(() => {
              const filtered = localGoals.filter((g) => {
                const isCompleted = g.current_value >= g.target_value;
                if (goalFilter === 'active') return g.status === 'active' && !isCompleted;
                if (goalFilter === 'completed') return isCompleted;
                if (goalFilter === 'paused') return g.status === 'paused';
                return true;
              });

              if (filtered.length === 0) {
                return (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400 py-6">
                    No {goalFilter} goals found.
                  </div>
                );
              }

              const visibleGoals = showAllGoals ? filtered : filtered.slice(0, 3);

              return (
                <>
                  {visibleGoals.map((goal) => {
                    const isCompleted = goal.current_value >= goal.target_value;
                    const pct = Math.min(100, Math.round((goal.current_value / goal.target_value) * 100));
                    const unitLabel = goal.goal_type.includes('distance')
                      ? distanceUnit
                      : goal.goal_type.includes('duration')
                        ? 'min'
                        : 'runs';

                    const remaining = Math.max(0, goal.target_value - goal.current_value);

                    const GoalIcon = isCompleted
                      ? Trophy
                      : goal.goal_type === 'workout_count'
                        ? Flame
                        : goal.goal_type === 'duration'
                          ? Timer
                          : goal.goal_type === 'single_run'
                            ? Zap
                            : Footprints;

                    return (
                      <div
                        key={goal.id}
                        className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${isCompleted
                          ? 'bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-500/40 shadow-2xs'
                          : goal.status === 'paused'
                            ? 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 opacity-60'
                            : 'bg-white dark:bg-slate-950 border-slate-200/90 dark:border-slate-800 shadow-2xs'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isCompleted
                                ? 'bg-emerald-500 text-white font-black shadow-sm shadow-emerald-500/30'
                                : goal.goal_type === 'workout_count'
                                  ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                  : goal.goal_type === 'duration'
                                    ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                    : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                }`}
                            >
                              <GoalIcon size={17} />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-xs font-black text-slate-900 dark:text-white capitalize truncate">
                                  {goal.period} {goal.goal_type.replace('_', ' ')}
                                </h4>
                                {isCompleted && (
                                  <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-300/50 dark:border-emerald-500/30 flex items-center gap-1">
                                    <span>Goal Achieved</span>

                                  </span>
                                )}
                                {goal.status === 'paused' && (
                                  <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/20 px-1.5 py-0.2 rounded-full border border-amber-200 dark:border-amber-500/30">
                                    Paused
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                Target: {goal.target_value} {unitLabel}
                                {!isCompleted && goal.status === 'active' && (
                                  <> · <span className="font-semibold text-emerald-600 dark:text-emerald-400">{remaining.toFixed(goal.goal_type.includes('distance') ? 1 : 0)} {unitLabel} to go</span></>
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleStartEditGoal(goal)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors active:scale-90 cursor-pointer"
                              title="Edit goal"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleToggleGoalStatus(goal)}
                              className={`p-1.5 rounded-lg transition-colors active:scale-90 cursor-pointer ${goal.status === 'active'
                                ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                                : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                                }`}
                              title={goal.status === 'active' ? 'Pause goal' : 'Resume goal'}
                            >
                              {goal.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                            </button>
                            <button
                              onClick={() => handleDeleteGoal(goal.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors active:scale-90 cursor-pointer"
                              title="Delete goal"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Progress Bar & Value */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-200 text-[11px]">
                              {goal.current_value} / {goal.target_value} {unitLabel}
                            </span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
                              {pct}%
                            </span>
                          </div>
                          <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
                            <div
                              style={{ width: `${pct}%` }}
                              className={`h-full rounded-full transition-all duration-500 ${isCompleted
                                ? 'bg-gradient-to-r from-emerald-400 via-emerald-500 to-lime-400 shadow-sm shadow-emerald-500/40'
                                : 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                                }`}
                            />
                          </div>

                          {/* Motivational feedback microcopy */}
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-0.5">
                            <span>
                              {isCompleted
                                ? '🎉 Target unlocked! Keep up the momentum!'
                                : pct >= 75
                                  ? '🔥 Almost across the finish line!'
                                  : pct >= 50
                                    ? '⚡ Over halfway there! Keep pushing!'
                                    : pct > 0
                                      ? '🏃 Making steady progress!'
                                      : '👟 Complete a workout to log progress'}
                            </span>
                            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">
                              {goal.period}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Toggle Show All / Show Fewer if more than 3 goals */}
                  {filtered.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setShowAllGoals(!showAllGoals)}
                      className="w-full py-2 rounded-xl bg-slate-100/70 hover:bg-slate-200/70 dark:bg-slate-800/60 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>{showAllGoals ? 'Show fewer goals' : `Show all ${filtered.length} goals`}</span>
                      <ChevronRight size={13} className={`transition-transform ${showAllGoals ? '-rotate-90' : 'rotate-90'}`} />
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Running Shoes & Gear Tracker */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 space-y-3.5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Footprints size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-200 truncate">
              RUNNING SHOES & GEAR
            </h3>
          </div>
          <button
            onClick={() => {
              if (gearList.length === 0 && lifetimeDistanceMeters > 0) {
                setNewShoeInitialDistanceKm(parseFloat(formatDistance(lifetimeDistanceMeters, distanceUnit)));
              }
              setShowAddShoeModal(true);
            }}
            className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100/80 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 px-2.5 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-500/30 active:scale-95 transition-all flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs"
          >
            <Plus size={12} />
            <span>Add Shoe</span>
          </button>
        </div>

        {gearList.length === 0 ? (
          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 text-center space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-2xs">
              <Footprints size={20} />
            </div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">No running shoes added yet.</p>
            <button
              onClick={() => {
                if (lifetimeDistanceMeters > 0) {
                  setNewShoeInitialDistanceKm(parseFloat(formatDistance(lifetimeDistanceMeters, distanceUnit)));
                }
                setShowAddShoeModal(true);
              }}
              className="mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-block cursor-pointer"
            >
              + Track your current pair of shoes
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {gearList.map((gear) => {
              const currentFormatted = formatDistance(gear.current_distance_meters, distanceUnit);
              const maxFormatted = formatDistance(gear.max_distance_meters, distanceUnit);
              const pct = Math.min(100, Math.round((gear.current_distance_meters / (gear.max_distance_meters || 1)) * 100));
              const isNearRetirement = pct >= 90;

              return (
                <div
                  key={gear.id}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all overflow-hidden ${gear.is_active
                    ? 'bg-emerald-50/90 dark:bg-emerald-950/25 border-2 border-emerald-400 dark:border-emerald-500/50 shadow-xs'
                    : 'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-xs'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Shoe Photo or Fallback Icon */}
                    <div className="w-14 h-14 min-w-[3.5rem] max-w-[3.5rem] min-h-[3.5rem] max-h-[3.5rem] sm:w-16 sm:h-16 sm:min-w-[4rem] sm:max-w-[4rem] sm:min-h-[4rem] sm:max-h-[4rem] rounded-2xl overflow-hidden shrink-0 border border-emerald-200/80 dark:border-slate-800 shadow-xs bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      {gear.image_url ? (
                        <img
                          src={gear.image_url}
                          alt={gear.name}
                          className="w-full h-full object-cover"
                          loading="eager"
                          decoding="async"
                        />
                      ) : (
                        <div className="w-full h-full text-emerald-700 dark:text-emerald-400 flex items-center justify-center bg-emerald-500/10">
                          <Footprints size={22} />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs font-black text-emerald-950 dark:text-white truncate">
                            {gear.name}
                          </span>
                          {gear.is_active && (
                            <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                              Active
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {!gear.is_active && (
                            <button
                              onClick={() => handleSetActiveShoe(gear.id)}
                              className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                            >
                              Set Active
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRefreshShoeDistance(gear.id)}
                            disabled={refreshingGearId === gear.id}
                            className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 p-1 rounded-lg transition-colors active:scale-95 disabled:opacity-50 cursor-pointer"
                            title="Recalculate real-time distance from workouts"
                            aria-label="Refresh real-time distance"
                          >
                            <RefreshCw
                              size={13}
                              className={refreshingGearId === gear.id ? 'animate-spin text-emerald-500' : ''}
                            />
                          </button>
                          <button
                            onClick={() => handleDeleteShoe(gear.id)}
                            className="text-slate-400 hover:text-rose-500 p-1 transition-colors active:scale-95 cursor-pointer"
                            title="Delete shoe"
                            aria-label="Delete shoe"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      <span className="text-[10px] text-emerald-700/80 dark:text-slate-400 block truncate mt-0.5">
                        {gear.brand} • {gear.model}
                      </span>

                      {/* Mileage progress */}
                      <div className="space-y-1.5 mt-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className={`font-bold text-slate-900 dark:text-white transition-opacity ${refreshingGearId === gear.id ? 'opacity-50 animate-pulse' : 'opacity-100'}`}>
                            {currentFormatted} <span className="text-slate-500 dark:text-slate-400 font-normal">/ {maxFormatted} {distanceUnit}</span>
                          </span>
                          <span className="font-mono font-black text-[11px] text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-300/80 dark:border-emerald-500/30">
                            {pct}%
                          </span>
                        </div>

                        {/* High-contrast bold progress bar for light & dark mode */}
                        <div className="h-3.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700/80 overflow-hidden shadow-inner p-0.5">
                          <div
                            style={{ width: `${pct > 0 ? Math.max(pct, 2.5) : 0}%` }}
                            className={`h-full rounded-full transition-all duration-500 ease-out shadow-sm ${isNearRetirement
                              ? 'bg-gradient-to-r from-amber-500 to-rose-500'
                              : 'bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400'
                              }`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {isNearRetirement && (
                    <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-2">
                      ⚠️ Shoe is near retirement target ({maxFormatted} {distanceUnit})!
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>



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
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${healthState.isConnected
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
          className="w-full p-3 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-between text-xs font-bold active:scale-98 transition-all mt-2 cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <LogOut size={16} />
            <span>Sign Out</span>
          </div>
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Add Shoe Bottom Sheet Modal */}
      {showAddShoeModal && (
        <BottomSheet
          isOpen={showAddShoeModal}
          onClose={() => setShowAddShoeModal(false)}
          title="Add Running Shoes"
          icon={<Footprints size={18} className="text-emerald-500" />}
        >
          <form onSubmit={handleAddShoe} className="space-y-3.5 text-left pb-4">
            {/* Shoe Photo Upload Field */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-emerald-950 dark:text-slate-300 mb-1.5">
                Shoe Photo (Optional)
              </label>
              <input
                type="file"
                ref={shoeFileInputRef}
                accept="image/*"
                onChange={handleShoeImageChange}
                className="hidden"
              />

              {newShoeImagePreview ? (
                <div className="relative w-full h-36 rounded-2xl overflow-hidden border border-emerald-200 dark:border-slate-800 bg-slate-950 shadow-inner">
                  <img
                    src={newShoeImagePreview}
                    alt="Shoe preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end justify-between p-2.5">
                    <button
                      type="button"
                      onClick={() => shoeFileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-white/95 hover:bg-white text-slate-900 text-xs font-bold shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
                    >
                      <Camera size={13} className="text-emerald-600" />
                      <span>Change Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewShoeImageFile(null);
                        setNewShoeImagePreview(null);
                        if (shoeFileInputRef.current) shoeFileInputRef.current.value = '';
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md active:scale-95 cursor-pointer flex items-center gap-1"
                    >
                      <X size={13} />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => shoeFileInputRef.current?.click()}
                  className="w-full p-4 rounded-2xl border-2 border-dashed border-emerald-300/80 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500/50 bg-emerald-50/40 dark:bg-slate-900/40 text-center transition-all flex flex-col items-center justify-center gap-1.5 group cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Camera size={18} />
                  </div>
                  <span className="text-xs font-bold text-emerald-950 dark:text-white">
                    Upload Shoe Image
                  </span>
                  <span className="text-[10px] text-emerald-700/80 dark:text-slate-400">
                    JPG, PNG or WebP (up to 5MB)
                  </span>
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-emerald-950 dark:text-slate-300 mb-1">
                Brand
              </label>
              <select
                value={newShoeBrand}
                onChange={(e) => setNewShoeBrand(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-emerald-50/50 dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 text-emerald-950 dark:text-white text-xs font-bold outline-none focus:border-emerald-500 cursor-pointer"
              >
                {[
                  'Nike',
                  'Asics',
                  'Campus',
                  'Hoka',
                  'Adidas',
                  'Saucony',
                  'Brooks',
                  'On Running',
                  'New Balance',
                  'Puma',
                  'Altra',
                  'Under Armour',
                  'Mizuno',
                  'Topo Athletic',
                ].map((b) => (
                  <option key={b} value={b} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {b}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-emerald-950 dark:text-slate-300 mb-1">
                Model Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Pegasus 40, Clifton 9, Gel-Nimbus 26"
                value={newShoeModel}
                onChange={(e) => setNewShoeModel(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-emerald-50/50 dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 text-emerald-950 dark:text-white text-xs outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold uppercase tracking-wider text-emerald-950 dark:text-slate-300">
                  Starting Mileage ({distanceUnit})
                </label>
                {lifetimeDistanceMeters > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      const distInUnit = parseFloat(formatDistance(lifetimeDistanceMeters, distanceUnit));
                      setNewShoeInitialDistanceKm(distInUnit);
                    }}
                    className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    Use Workouts Total ({formatDistance(lifetimeDistanceMeters, distanceUnit)} {distanceUnit})
                  </button>
                ) : (
                  <span className="text-[10px] text-emerald-700/80 dark:text-slate-400">
                    Enter 0 for brand new shoes
                  </span>
                )}
              </div>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder={lifetimeDistanceMeters > 0 ? `0 or click above for ${formatDistance(lifetimeDistanceMeters, distanceUnit)}` : '0 (Brand new shoes)'}
                value={newShoeInitialDistanceKm === 0 ? '' : newShoeInitialDistanceKm}
                onChange={(e) => setNewShoeInitialDistanceKm(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-emerald-50/50 dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 text-emerald-950 dark:text-white text-xs outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold uppercase tracking-wider text-emerald-950 dark:text-slate-300">
                  Retirement Target ({distanceUnit})
                </label>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  {distanceUnit === 'mi' ? 'Standard: 300 - 500 mi' : 'Standard: 500 - 800 km'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {(distanceUnit === 'mi' ? [300, 400, 500] : [400, 600, 800]).map((dist) => (
                  <button
                    key={dist}
                    type="button"
                    onClick={() => setNewShoeMaxDistanceKm(dist)}
                    className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${newShoeMaxDistanceKm === dist
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                      : 'bg-emerald-50/50 dark:bg-slate-900 border-emerald-200 dark:border-slate-800 text-emerald-900 dark:text-slate-300 hover:border-emerald-300'
                      }`}
                  >
                    {dist} {distanceUnit}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="50"
                step="10"
                placeholder={`Or enter custom target (${distanceUnit})`}
                value={newShoeMaxDistanceKm || ''}
                onChange={(e) => setNewShoeMaxDistanceKm(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2 rounded-xl bg-emerald-50/50 dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 text-emerald-950 dark:text-white text-xs outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSavingShoe || !newShoeModel.trim()}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-lime-400 text-slate-950 font-black text-xs shadow-md shadow-emerald-500/30 active:scale-98 transition-all cursor-pointer mt-2 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSavingShoe ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Saving Shoe to Closet...</span>
                </>
              ) : (
                <span>Add Shoe to Gear Closet</span>
              )}
            </button>
          </form>
        </BottomSheet>
      )}

      {/* Create / Edit Fitness Goal BottomSheet */}
      <BottomSheet
        isOpen={showGoalModal}
        onClose={() => {
          setShowGoalModal(false);
          setEditingGoal(null);
        }}
        title={editingGoal ? 'Edit Fitness Goal' : 'Create Fitness Goal'}
        icon={<Target size={18} />}
      >
        <form onSubmit={handleCreateGoal} className="space-y-4">
          {/* Quick Presets Grid */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              Popular Goal Templates
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: '5K Run', type: 'single_run' as const, val: 5, period: 'weekly' as const },
                { label: '10K Run', type: 'single_run' as const, val: 10, period: 'weekly' as const },
                { label: '20K / Wk', type: 'weekly_distance' as const, val: 20, period: 'weekly' as const },
                { label: '3x / Wk', type: 'workout_count' as const, val: 3, period: 'weekly' as const },
                { label: '50K / Mo', type: 'monthly_distance' as const, val: 50, period: 'monthly' as const },
                { label: '120 Min', type: 'duration' as const, val: 120, period: 'weekly' as const },
              ].map((preset) => {
                const isSelected =
                  newGoalType === preset.type &&
                  newTargetValue === preset.val &&
                  newPeriod === preset.period;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setNewGoalType(preset.type);
                      setNewTargetValue(preset.val);
                      setNewPeriod(preset.period);
                    }}
                    className={`py-2 px-1.5 rounded-xl text-[11px] font-bold text-center border transition-all cursor-pointer ${isSelected
                      ? 'bg-emerald-500 text-white dark:text-slate-950 border-emerald-500 shadow-2xs'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-300'
                      }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
              Goal Type
            </label>
            <select
              value={newGoalType}
              onChange={(e: any) => {
                const val = e.target.value;
                setNewGoalType(val);
                if (val === 'weekly_distance') {
                  setNewTargetValue(20);
                  setNewPeriod('weekly');
                } else if (val === 'monthly_distance') {
                  setNewTargetValue(80);
                  setNewPeriod('monthly');
                } else if (val === 'workout_count') {
                  setNewTargetValue(4);
                  setNewPeriod('weekly');
                } else if (val === 'single_run') {
                  setNewTargetValue(5);
                  setNewPeriod('weekly');
                } else if (val === 'duration') {
                  setNewTargetValue(120);
                  setNewPeriod('weekly');
                }
              }}
              className="w-full px-3.5 py-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:border-emerald-500"
            >
              <option value="weekly_distance">Weekly Distance ({distanceUnit})</option>
              <option value="monthly_distance">Monthly Distance ({distanceUnit})</option>
              <option value="workout_count">Workouts per Week</option>
              <option value="single_run">Single Run Target ({distanceUnit})</option>
              <option value="duration">Weekly Duration (minutes)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Target Value ({newGoalType.includes('distance') || newGoalType === 'single_run' ? distanceUnit : newGoalType === 'duration' ? 'min' : 'runs'})
              </label>
              <input
                type="number"
                min={1}
                max={1000}
                required
                value={newTargetValue}
                onChange={(e) => setNewTargetValue(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                Period
              </label>
              <select
                value={newPeriod}
                onChange={(e: any) => setNewPeriod(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:border-emerald-500"
              >
                <option value="weekly">Weekly Cycle</option>
                <option value="monthly">Monthly Cycle</option>
              </select>
            </div>
          </div>



          <div className="flex flex-col gap-2 pt-2">
            <button
              type="submit"
              disabled={isSavingGoal}
              className="w-full py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white dark:text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/30 dark:shadow-glow-brand transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSavingGoal ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>{editingGoal ? 'Updating Goal...' : 'Saving Goal...'}</span>
                </>
              ) : (
                <span>{editingGoal ? 'Update Goal' : 'Save & Start Tracking'}</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowGoalModal(false);
                setEditingGoal(null);
              }}
              className="w-full py-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      </BottomSheet>

      {/* Audio & Voice Coach Customization Modal */}
      <AudioCoachModal
        isOpen={showAudioModal}
        onClose={() => setShowAudioModal(false)}
        frequency={audioFrequency}
        onChangeFrequency={(f) => {
          setAudioFrequency(f);
          audioCoach.setConfig(audioCoaching, f);
        }}
        isMuted={!audioCoaching}
        onToggleMute={() => {
          const next = !audioCoaching;
          setAudioCoaching(next);
          audioCoach.setConfig(next, audioFrequency);
        }}
      />
    </div>
  );
};
