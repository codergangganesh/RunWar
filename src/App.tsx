import React, { useState, useEffect, useCallback } from 'react';
import { AppShell, ActiveTab } from './components/layout/AppShell';
import { SplashScreen } from './screens/SplashScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { AuthScreen } from './screens/AuthScreen';
import { ProfileSetupScreen } from './screens/ProfileSetupScreen';
import { HomeScreen } from './screens/HomeScreen';
import { ActiveRunScreen } from './screens/ActiveRunScreen';
import { WorkoutSummaryScreen } from './screens/WorkoutSummaryScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { WorkoutDetailScreen } from './screens/WorkoutDetailScreen';
import { InsightsScreen } from './screens/InsightsScreen';
import { CalendarScreen } from './screens/CalendarScreen';
import { GoalsScreen } from './screens/GoalsScreen';
import { AchievementsScreen } from './screens/AchievementsScreen';
import { PersonalRecordsScreen } from './screens/PersonalRecordsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { PrivacyScreen } from './screens/PrivacyScreen';
import { ConnectedHealthScreen } from './screens/ConnectedHealthScreen';
import { DailyActivityScreen } from './screens/DailyActivityScreen';
import { RecoveryModal } from './components/ui/RecoveryModal';
import { PWAInstallBanner } from './components/ui/PWAInstallBanner';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

import { insforge } from './lib/insforge';
import { authService } from './services/authService';
import { firebaseAuthService } from './services/firebaseAuthService';
import { workoutService, normalizeWorkout, isStravaWorkout } from './services/workoutService';
import { goalsService } from './services/goalsService';
import { achievementsService } from './services/achievementsService';
import { recordsService } from './services/recordsService';
import { offlineSync } from './services/offlineSync';
import { gpsEngine } from './services/gpsEngine';
import { toDeterministicUUID } from './utils/uuid';
import {
  Achievement,
  Goal,
  LiveWorkoutState,
  PersonalRecord,
  UserAchievement,
  UserProfile,
  UserSettings,
  Workout,
  WorkoutType,
} from './types';

type ScreenState =
  | 'splash'
  | 'welcome'
  | 'onboarding'
  | 'auth'
  | 'profile_setup'
  | 'main'
  | 'active_run'
  | 'workout_summary'
  | 'workout_detail'
  | 'privacy'
  | 'connected_health';

export const App: React.FC = () => {
  // Check if there is an active running session from a browser refresh
  const initialActiveWorkout = (() => {
    try {
      const backupRaw = localStorage.getItem('runwar_active_workout_backup');
      if (backupRaw) {
        const parsed = JSON.parse(backupRaw);
        if (
          parsed &&
          parsed.workoutId &&
          (parsed.engineState === 'ACTIVE' || parsed.engineState === 'PAUSED' || parsed.status === 'tracking' || parsed.status === 'paused')
        ) {
          return parsed as LiveWorkoutState;
        }
      }
    } catch {}
    return null;
  })();

  // Navigation & Screen States
  const [screen, setScreen] = useState<ScreenState>(() => {
    if (initialActiveWorkout) {
      return 'active_run';
    }
    return 'splash';
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');

  // User & Settings (Synchronously load cached session on frame 0)
  const [currentUser, setCurrentUser] = useState<any>(() => authService.getCachedUser());
  const [isAuthInitializing, setIsAuthInitializing] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const cached = localStorage.getItem('runwar_cached_profile');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [settings, setSettings] = useState<UserSettings | null>(null);

  // Loading & error states
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Core Data
  const [workouts, setWorkouts] = useState<Workout[]>(() => {
    try {
      const cached = authService.getCachedUser();
      return workoutService.getCachedWorkouts(cached?.id).map(normalizeWorkout);
    } catch {
      return [];
    }
  });
  const [todayStats, setTodayStats] = useState({
    totalDistanceMeters: 0,
    totalDurationSeconds: 0,
    totalCalories: 0,
    workoutCount: 0,
    avgPace: 0,
    streak: { currentStreak: 0, longestStreak: 0 },
    todayWorkouts: [] as Workout[],
  });
  const [weeklyStats, setWeeklyStats] = useState({
    totalDistanceMeters: 0,
    totalDurationSeconds: 0,
    totalCalories: 0,
    workoutCount: 0,
    avgPace: 0,
    dayNames: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    dailyDistance: [0, 0, 0, 0, 0, 0, 0],
    dailyRunCounts: [0, 0, 0, 0, 0, 0, 0],
    longestRunMeters: 0,
  });
  const [goals, setGoals] = useState<Goal[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [records, setRecords] = useState<PersonalRecord[]>([]);

  // Active workout & selection
  const [activeWorkoutType, setActiveWorkoutType] = useState<WorkoutType>(() => {
    return initialActiveWorkout ? initialActiveWorkout.type : 'run';
  });
  const [finishedWorkoutState, setFinishedWorkoutState] = useState<LiveWorkoutState | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);

  // Recovery modal state
  const [recoveredWorkoutBackup, setRecoveredWorkoutBackup] = useState<LiveWorkoutState | null>(null);

  // Immediate synchronous session restoration on frame 0 if recovering from reload
  useEffect(() => {
    if (initialActiveWorkout) {
      const shouldResume = initialActiveWorkout.status === 'tracking' || initialActiveWorkout.engineState === 'ACTIVE';
      gpsEngine.restoreWorkout(initialActiveWorkout, shouldResume);
    }
  }, []);

  // Fetch all app data with optional background/silent mode
  const loadAppData = useCallback(async (userId: string, silent = false) => {
    if (!silent) setIsDataLoading(true);
    setDataError(null);

    try {
      const [
        userProfile,
        userSettings,
        userWorkouts,
        today,
        weekly,
        userGoals,
        allAch,
        userAch,
        userPrs,
      ] = await Promise.all([
        authService.getProfile(userId),
        authService.getSettings(userId),
        workoutService.getWorkouts(userId, 'all', 'newest', 100),
        workoutService.getTodayStats(userId),
        workoutService.getWeeklyStats(userId),
        goalsService.getGoals(userId),
        achievementsService.getAllAchievements(),
        achievementsService.getUserAchievements(userId),
        recordsService.getPersonalRecords(userId),
      ]);

      if (userProfile) setProfile(userProfile);
      if (userSettings) setSettings(userSettings);
      setWorkouts(userWorkouts);
      setTodayStats(today);
      setWeeklyStats(weekly);
      setGoals(userGoals);
      setAchievements(allAch);
      setUserAchievements(userAch);
      setRecords(userPrs);
    } catch (err: any) {
      console.warn('Error loading app data:', err);
      setDataError("Couldn't load your latest workouts.");
    } finally {
      if (!silent) setIsDataLoading(false);
    }
  }, []);

  // Theme State: Dark / Light Mode
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('runwar_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark';
  });

  const handleToggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('runwar_theme', nextTheme);
    if (nextTheme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
    if (profile?.user_id) {
      authService.updateSettings(profile.user_id, { theme: nextTheme }).catch(() => { });
    }
  };

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  // Initial authentication check & recovery detection
  useEffect(() => {
    offlineSync.initSyncListener();

    const handleSyncCompleted = () => {
      const activeId = currentUser?.id || authService.getCachedUser()?.id || 'guest_user';
      loadAppData(activeId, true);
    };

    const handleWorkoutsPurged = (event: any) => {
      const provider = event?.detail?.provider || 'strava';
      setWorkouts((prev) =>
        prev.filter((w) => {
          if (provider === 'strava' && isStravaWorkout(w)) return false;
          if (w.source_provider === provider) return false;
          return true;
        })
      );
      const activeId = currentUser?.id || authService.getCachedUser()?.id || 'guest_user';
      loadAppData(activeId, true);
    };

    const handleWorkoutSynced = (event: any) => {
      const newWorkout = event?.detail;
      if (!newWorkout) return;
      setWorkouts((prev) => {
        if (
          prev.some(
            (w) =>
              w.id === newWorkout.id ||
              (w.source_provider &&
                w.external_record_id &&
                w.source_provider === newWorkout.source_provider &&
                w.external_record_id === newWorkout.external_record_id)
          )
        ) {
          return prev;
        }
        return [newWorkout, ...prev];
      });
    };

    window.addEventListener('runwar:sync_completed', handleSyncCompleted);
    window.addEventListener('runwar:workouts_purged', handleWorkoutsPurged);
    window.addEventListener('runwar:workout_synced', handleWorkoutSynced);

    const initAuth = async () => {
      try {
        // 1. Check if InsForge session exists
        let user = await authService.getCurrentUser();

        // 2. If not in InsForge, check if Firebase user is logged in
        if (!user) {
          const fbUser = firebaseAuthService.getFirebaseUser();
          if (fbUser) {
            const token = await firebaseAuthService.getIdToken();
            if (token && typeof (insforge as any).setAccessToken === 'function') {
              (insforge as any).setAccessToken(token);
            }
            const normalizedFbId = toDeterministicUUID(fbUser.uid);
            let fbProfile = await authService.getProfile(normalizedFbId);
            if (!fbProfile) {
              fbProfile = await authService.createProfileFromPhone(
                fbUser.uid,
                fbUser.phoneNumber || ''
              );
            }
            user = {
              id: normalizedFbId,
              firebase_uid: fbUser.uid,
              phone_number: fbUser.phoneNumber,
              email: fbUser.email,
              name: fbProfile?.name || 'Runner',
            };
            authService.setCachedUser(user);
          }
        }

        if (user) {
          setCurrentUser(user);
          authService.setCachedUser(user);
          let userProfile = user.firebase_uid
            ? await authService.getProfileByFirebaseUid(user.firebase_uid)
            : await authService.getProfile(user.id);

          if (!userProfile) {
            await authService.createInitialProfile(
              user.id,
              user.name || user.email?.split('@')[0] || 'Runner',
              user.email || ''
            );
            userProfile = await authService.getProfile(user.id);
          }
          if (userProfile) setProfile(userProfile);
          workoutService.syncPendingWorkouts(user.id).catch(() => {});
          await loadAppData(user.id, true);
          // If we are currently on splash or welcome, immediately route to main home screen
          setScreen((prev) => (prev === 'splash' || prev === 'welcome' ? 'main' : prev));
        } else {
          // Check local cached session user
          const cached = authService.getCachedUser();
          if (cached?.id) {
            setCurrentUser(cached);
            let userProfile = cached.firebase_uid
              ? await authService.getProfileByFirebaseUid(cached.firebase_uid)
              : await authService.getProfile(cached.id);
            if (userProfile) setProfile(userProfile);
            await loadAppData(cached.id, true);
            setScreen((prev) => (prev === 'splash' || prev === 'welcome' ? 'main' : prev));
          } else {
            setCurrentUser(null);
            authService.clearCachedUser();
            setScreen((prev) => (prev === 'splash' ? 'welcome' : prev));
          }
        }
      } catch (e) {
        console.warn('Auth check error:', e);
        const cached = authService.getCachedUser();
        if (cached?.id) {
          setCurrentUser(cached);
          setScreen((prev) => (prev === 'splash' || prev === 'welcome' ? 'main' : prev));
        } else {
          setScreen((prev) => (prev === 'splash' ? 'welcome' : prev));
        }
      } finally {
        setIsAuthInitializing(false);
      }

      // Check if crash recovery exists and user is not already in active run
      if (offlineSync.hasActiveWorkoutBackup() && screen !== 'active_run' && !initialActiveWorkout) {
        const backup = offlineSync.getActiveWorkoutBackup();
        if (backup) {
          setRecoveredWorkoutBackup(backup);
        }
      }
    };

    initAuth();

    // Listen for Firebase Auth state changes
    const unsubFirebase = firebaseAuthService.onAuthStateChanged(async (fbUser) => {
      if (fbUser) {
        const token = await firebaseAuthService.getIdToken();
        if (token && typeof (insforge as any).setAccessToken === 'function') {
          (insforge as any).setAccessToken(token);
        }
      }
    });

    // Listen for InsForge auth state changes (e.g. Google OAuth redirect callback completion)
    const unsubscribe = insforge.auth.onAuthStateChange(async (event) => {
      if (event === 'signedIn') {
        const user = await authService.getCurrentUser();
        if (user) {
          setCurrentUser(user);
          authService.setCachedUser(user);
          let userProfile = await authService.getProfile(user.id);
          const isSetupDone = localStorage.getItem(`runwar_profile_setup_done_${user.id}`);
          if (!userProfile || !isSetupDone) {
            setScreen('profile_setup');
          } else {
            setProfile(userProfile);
            workoutService.syncPendingWorkouts(user.id).catch(() => {});
            await loadAppData(user.id);
            setScreen('main');
          }
        }
      } else if (event === 'signedOut') {
        setCurrentUser(null);
        setProfile(null);
        authService.clearCachedUser();
        setScreen('welcome');
      }
    });

    return () => {
      if (typeof unsubFirebase === 'function') unsubFirebase();
      if (typeof unsubscribe === 'function') unsubscribe();
      window.removeEventListener('runwar:sync_completed', handleSyncCompleted);
      window.removeEventListener('runwar:workouts_purged', handleWorkoutsPurged);
      window.removeEventListener('runwar:workout_synced', handleWorkoutSynced);
    };
  }, [loadAppData]);

  // Realtime subscription: sync workout changes across devices in real time
  useEffect(() => {
    const activeUserId = currentUser?.id || profile?.user_id;
    if (!activeUserId) return;

    const unsubscribeRealtime = workoutService.subscribeToUserWorkouts(
      activeUserId,
      ({ eventType, workout, id }) => {
        if (eventType === 'INSERT' && workout) {
          const normalized = normalizeWorkout(workout);
          setWorkouts((prev) => {
            if (
              prev.some(
                (w) =>
                  w.id === normalized.id ||
                  (w.source_provider &&
                    w.external_record_id &&
                    w.source_provider === normalized.source_provider &&
                    w.external_record_id === normalized.external_record_id)
              )
            ) {
              return prev;
            }
            return [normalized, ...prev];
          });
          loadAppData(activeUserId, true);
        } else if (eventType === 'UPDATE' && workout) {
          const normalized = normalizeWorkout(workout);
          setWorkouts((prev) => prev.map((w) => (w.id === normalized.id ? normalized : w)));
          loadAppData(activeUserId, true);
        } else if (eventType === 'DELETE' && id) {
          setWorkouts((prev) => prev.filter((w) => w.id !== id));
          loadAppData(activeUserId, true);
        }
      }
    );

    return () => {
      if (typeof unsubscribeRealtime === 'function') {
        unsubscribeRealtime();
      }
    };
  }, [currentUser?.id, profile?.user_id, loadAppData]);

  // Handle splash completion and URL route preservation (e.g. returning from Google Health OAuth)
  const handleSplashFinish = () => {
    const cached = authService.getCachedUser();
    if (currentUser || cached) {
      const params = new URLSearchParams(window.location.search);
      const targetScreen = params.get('screen') as ScreenState | null;
      const targetTab = params.get('tab') as ActiveTab | null;
      if (targetScreen === 'connected_health' || targetScreen === 'privacy') {
        setScreen(targetScreen);
      } else {
        setScreen((prev) => (prev === 'active_run' ? 'active_run' : 'main'));
        if (targetTab) setActiveTab(targetTab);
      }
    } else if (!isAuthInitializing) {
      setScreen((prev) => (prev === 'active_run' ? 'active_run' : 'welcome'));
    }
  };

  // Handle URL navigation params after authentication resolves
  useEffect(() => {
    if (isAuthInitializing) return;
    const params = new URLSearchParams(window.location.search);
    const targetScreen = params.get('screen') as ScreenState | null;
    const targetTab = params.get('tab') as ActiveTab | null;
    if (targetScreen === 'connected_health' || targetScreen === 'privacy') {
      setScreen(targetScreen);
    } else if (targetTab) {
      setActiveTab(targetTab);
    }
  }, [isAuthInitializing]);

  // Handle PWA manifest shortcut ?start=run
  useEffect(() => {
    if (isAuthInitializing || screen !== 'main') return;
    const params = new URLSearchParams(window.location.search);
    const startParam = params.get('start');
    if (startParam === 'run' || startParam === 'jog' || startParam === 'walk') {
      const workoutType = startParam as WorkoutType;
      // Clear the URL parameter to prevent re-triggering on refresh
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
      handleStartRun(workoutType);
    }
  }, [isAuthInitializing, screen]);

  // Demo / Guest mode for immediate testing
  const handleGuestAccess = async () => {
    const guestUser = { id: 'usr_guest_demo', email: 'guest.runner@insforge.app' };
    setCurrentUser(guestUser);
    authService.setCachedUser(guestUser);

    const guestProfile: UserProfile = {
      id: guestUser.id,
      user_id: guestUser.id,
      name: 'Demo Runner',
      email: guestUser.email,
      age: 27,
      gender: 'unspecified',
      height: 178,
      weight: 72,
      distance_unit: 'km',
      pace_unit: 'min_km',
      weight_unit: 'kg',
      fitness_goal: '5k_run',
      typical_workout_type: 'run',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setProfile(guestProfile);
    await loadAppData(guestUser.id);
    setScreen('main');
  };

  // Auth success
  const handleAuthSuccess = async (user: any, isNewUser = false) => {
    setCurrentUser(user);
    authService.setCachedUser(user);
    const prof = user.firebase_uid
      ? await authService.getProfileByFirebaseUid(user.firebase_uid)
      : await authService.getProfile(user.id);
    const isSetupDone = localStorage.getItem(`runwar_profile_setup_done_${user.id}`);

    if (isNewUser || !prof || !isSetupDone) {
      if (prof) setProfile(prof);
      setScreen('profile_setup');
    } else {
      setProfile(prof);
      await loadAppData(user.id);
      setScreen('main');
    }
  };

  // Start a new workout
  const handleStartRun = (type: WorkoutType = 'run') => {
    gpsEngine.reset();
    offlineSync.clearActiveWorkoutBackup();
    setRecoveredWorkoutBackup(null);
    setActiveWorkoutType(type);
    setScreen('active_run');
  };

  // Finish an active workout
  const handleFinishWorkout = (finalState: LiveWorkoutState) => {
    setFinishedWorkoutState(finalState);
    setScreen('workout_summary');
  };

  // When summary saves workout -> immediately refresh store
  const handleWorkoutSaved = async (newWorkout: Workout) => {
    if (currentUser?.id) {
      await loadAppData(currentUser.id, true);
    }
  };

  // Summary complete
  const handleSummaryDone = () => {
    gpsEngine.reset();
    offlineSync.clearActiveWorkoutBackup();
    setRecoveredWorkoutBackup(null);
    setFinishedWorkoutState(null);
    setScreen('main');
    setActiveTab('home');
    if (currentUser?.id) {
      loadAppData(currentUser.id, true);
    }
  };

  // Select workout for details
  const handleSelectWorkout = (workout: Workout) => {
    setSelectedWorkout(workout);
    setScreen('workout_detail');
  };

  // Workout deleted
  const handleWorkoutDeleted = async (workoutId: string) => {
    if (currentUser?.id) {
      await loadAppData(currentUser.id, true);
    }
    setSelectedWorkout(null);
    setScreen('main');
    setActiveTab('history');
  };

  // Sign out
  const handleSignOut = async () => {
    await authService.signOut();
    setCurrentUser(null);
    setProfile(null);
    setWorkouts([]);
    setScreen('welcome');
  };

  // Tab switcher with fresh data fetch when entering History or Home
  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (screen !== 'main') {
      setScreen('main');
    }
    const activeId = currentUser?.id || authService.getCachedUser()?.id;
    if ((tab === 'history' || tab === 'home') && activeId) {
      loadAppData(activeId, true);
    }
  };

  // Recovery actions
  const handleResumeRecovered = () => {
    if (recoveredWorkoutBackup) {
      gpsEngine.restoreWorkout(recoveredWorkoutBackup);
      setActiveWorkoutType(recoveredWorkoutBackup.type);
      setRecoveredWorkoutBackup(null);
      setScreen('active_run');
    }
  };

  const handleFinishRecovered = () => {
    if (recoveredWorkoutBackup) {
      setFinishedWorkoutState(recoveredWorkoutBackup);
      offlineSync.clearActiveWorkoutBackup();
      setRecoveredWorkoutBackup(null);
      setScreen('workout_summary');
    }
  };

  const handleDiscardRecovered = () => {
    offlineSync.clearActiveWorkoutBackup();
    setRecoveredWorkoutBackup(null);
  };

  // Render current active screen
  const renderScreen = () => {
    switch (screen) {
      case 'splash':
        return <SplashScreen onFinish={handleSplashFinish} />;

      case 'welcome':
        return (
          <WelcomeScreen
            onStartOnboarding={() => setScreen('onboarding')}
            onLogin={() => setScreen('auth')}
            onGuestAccess={handleGuestAccess}
          />
        );

      case 'onboarding':
        return (
          <OnboardingScreen
            onComplete={() => {
              localStorage.setItem('runwar_onboarding_done', 'true');
              setScreen('auth');
            }}
            onSkip={() => {
              localStorage.setItem('runwar_onboarding_done', 'true');
              setScreen('auth');
            }}
          />
        );

      case 'auth':
        return (
          <AuthScreen
            initialMode="signin"
            onAuthSuccess={handleAuthSuccess}
            onGuestAccess={handleGuestAccess}
          />
        );

      case 'profile_setup':
        return (
          <ProfileSetupScreen
            userId={currentUser?.id || authService.getCachedUser()?.id || 'guest_user'}
            initialName={currentUser?.name || currentUser?.profile?.name || currentUser?.user_metadata?.name || ''}
            initialEmail={currentUser?.email || ''}
            onBack={() => setScreen('auth')}
            onComplete={async (prof) => {
              const activeUserId = prof.user_id || currentUser?.id;
              if (activeUserId) {
                localStorage.setItem(`runwar_profile_setup_done_${activeUserId}`, 'true');
              }
              setProfile(prof);
              if (currentUser?.id) {
                await loadAppData(currentUser.id);
              }
              setScreen('main');
            }}
          />
        );

      case 'active_run':
        return (
          <ActiveRunScreen
            workoutType={activeWorkoutType}
            profile={profile}
            settings={settings}
            onFinishWorkout={handleFinishWorkout}
            onDiscardWorkout={() => setScreen('main')}
          />
        );

      case 'workout_summary':
        if (!finishedWorkoutState) return null;
        return (
          <AppShell
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            profile={profile}
            hideTopHeader={true}
            streakCount={todayStats.streak.currentStreak}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          >
            <WorkoutSummaryScreen
              workoutState={finishedWorkoutState}
              profile={profile}
              onSaved={handleWorkoutSaved}
              onDone={handleSummaryDone}
              onDoAnotherWorkout={() => {
                const type = finishedWorkoutState.type;
                setFinishedWorkoutState(null);
                handleStartRun(type);
              }}
              onViewDetails={(workout) => {
                setFinishedWorkoutState(null);
                handleSelectWorkout(workout);
              }}
            />
          </AppShell>
        );

      case 'workout_detail':
        if (!selectedWorkout) return null;
        return (
          <AppShell
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            profile={profile}
            headerTitle="Workout Details"
            showBack={true}
            onBack={() => setScreen('main')}
            streakCount={todayStats.streak.currentStreak}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          >
            <WorkoutDetailScreen
              workout={selectedWorkout}
              profile={profile}
              onBack={() => setScreen('main')}
              onDeleted={handleWorkoutDeleted}
            />
          </AppShell>
        );

      case 'privacy':
        return (
          <AppShell
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            profile={profile}
            headerTitle="Privacy & Data"
            showBack={true}
            onBack={() => setScreen('main')}
            streakCount={todayStats.streak.currentStreak}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            isSyncing={isDataLoading}
            onSync={() => {
              if (currentUser?.id) {
                loadAppData(currentUser.id, false);
              }
            }}
          >
            <PrivacyScreen
              profile={profile}
              onDataCleared={() => {
                if (currentUser) loadAppData(currentUser.id);
              }}
              onSignOut={handleSignOut}
            />
          </AppShell>
        );

      case 'connected_health':
        return (
          <AppShell
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            profile={profile}
            hideTopHeader={true}
            streakCount={todayStats.streak.currentStreak}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            isSyncing={isDataLoading}
            onSync={() => {
              if (currentUser?.id) {
                loadAppData(currentUser.id, false);
              }
            }}
          >
            <ConnectedHealthScreen
              profile={profile}
              onRefreshWorkouts={() => {
                const uid = currentUser?.id || profile?.user_id || authService.getCachedUser()?.id || 'guest_user';
                return loadAppData(uid, false);
              }}
              onBack={() => setScreen('main')}
            />
          </AppShell>
        );

      case 'main':
      default:
        return (
          <AppShell
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            profile={profile}
            onQuickStartRun={() => handleStartRun('run')}
            showBack={activeTab !== 'home'}
            onBack={() => setActiveTab('home')}
            streakCount={todayStats.streak.currentStreak}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            isSyncing={isDataLoading}
            onSync={() => {
              if (currentUser?.id) {
                loadAppData(currentUser.id, false);
              }
            }}
            hideTopHeader={activeTab === 'activity'}
            headerTitle={
              activeTab === 'home' || activeTab === 'activity'
                ? undefined
                : activeTab === 'history'
                  ? 'Workout History'
                  : activeTab === 'insights'
                    ? 'Analytics'
                    : activeTab === 'goals'
                      ? 'Fitness Goals'
                      : activeTab === 'achievements'
                        ? 'Achievements'
                        : activeTab === 'records'
                          ? 'Personal Records'
                          : activeTab === 'calendar'
                            ? 'Activity Calendar'
                            : 'Athlete Profile'
            }
          >
            {activeTab === 'home' && (
              <HomeScreen
                profile={profile}
                isLoading={isDataLoading}
                todayStats={todayStats}
                weeklyStats={weeklyStats}
                workouts={workouts}
                activeGoals={goals.filter((g) => g.status === 'active')}
                onStartRun={handleStartRun}
                onViewHistory={() => setActiveTab('history')}
                onViewGoals={() => setActiveTab('goals')}
                onSelectWorkout={handleSelectWorkout}
              />
            )}

            {activeTab === 'activity' && (
              <DailyActivityScreen
                profile={profile}
                workouts={workouts}
                onStartRun={handleStartRun}
                onViewHistory={() => setActiveTab('history')}
                onViewInsights={() => setActiveTab('insights')}
                onOpenProfile={() => setActiveTab('profile')}
              />
            )}

            {activeTab === 'history' && (
              <HistoryScreen
                workouts={workouts}
                profile={profile}
                isLoading={isDataLoading}
                error={dataError}
                onRefresh={async () => {
                  const activeId = currentUser?.id || authService.getCachedUser()?.id || 'guest_user';
                  await loadAppData(activeId);
                }}
                onSelectWorkout={handleSelectWorkout}
                onStartRun={() => handleStartRun('run')}
              />
            )}

            {activeTab === 'insights' && (
              <InsightsScreen workouts={workouts} profile={profile} />
            )}

            {activeTab === 'calendar' && (
              <CalendarScreen
                workouts={workouts}
                profile={profile}
                onSelectWorkout={handleSelectWorkout}
              />
            )}

            {activeTab === 'goals' && (
              <GoalsScreen
                goals={goals}
                profile={profile}
                onRefresh={() => {
                  if (currentUser) loadAppData(currentUser.id);
                }}
              />
            )}

            {activeTab === 'achievements' && (
              <AchievementsScreen
                achievements={achievements}
                userAchievements={userAchievements}
                workouts={workouts}
                profile={profile}
                onUpdateProfile={(updated) => setProfile(updated)}
              />
            )}

            {activeTab === 'records' && (
              <PersonalRecordsScreen
                records={records}
                workouts={workouts}
                profile={profile}
                onSelectWorkout={handleSelectWorkout}
                onRefreshRecords={async () => {
                  const activeId = currentUser?.id || authService.getCachedUser()?.id;
                  if (activeId) {
                    const freshRecords = await recordsService.getPersonalRecords(activeId);
                    setRecords(freshRecords);
                  }
                }}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileScreen
                profile={profile}
                settings={settings}
                workouts={workouts}
                records={records}
                onNavigate={(destination) => {
                  if (destination === 'privacy') setScreen('privacy');
                  else if (destination === 'connected_health') setScreen('connected_health');
                  else setActiveTab(destination);
                }}
                onSignOut={handleSignOut}
                onUpdateProfile={(updated) => setProfile(updated)}
                onUpdateSettings={(updated) => setSettings(updated)}
                onRefreshWorkouts={() => (currentUser ? loadAppData(currentUser.id, true) : Promise.resolve())}
              />
            )}
          </AppShell>
        );
    }
  };

  return (
    <ErrorBoundary>
      {renderScreen()}

      {/* PWA Add to Home Screen Banner */}
      {screen !== 'active_run' && screen !== 'splash' && <PWAInstallBanner />}

      {/* Unsaved Workout Recovery Modal */}
      {recoveredWorkoutBackup && screen !== 'active_run' && (
        <RecoveryModal
          backup={recoveredWorkoutBackup}
          onResume={handleResumeRecovered}
          onFinish={handleFinishRecovered}
          onDiscard={handleDiscardRecovered}
        />
      )}
    </ErrorBoundary>
  );
};
