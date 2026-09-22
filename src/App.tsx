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
import { RecoveryModal } from './components/ui/RecoveryModal';

import { insforge } from './lib/insforge';
import { authService } from './services/authService';
import { workoutService } from './services/workoutService';
import { goalsService } from './services/goalsService';
import { achievementsService } from './services/achievementsService';
import { recordsService } from './services/recordsService';
import { offlineSync } from './services/offlineSync';
import { gpsEngine } from './services/gpsEngine';
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
  | 'privacy';

export const App: React.FC = () => {
  // Navigation & Screen States
  const [screen, setScreen] = useState<ScreenState>('splash');
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');

  // User & Settings
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);

  // Loading & error states
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Core Data
  const [workouts, setWorkouts] = useState<Workout[]>([]);
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
    longestRunMeters: 0,
  });
  const [goals, setGoals] = useState<Goal[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [records, setRecords] = useState<PersonalRecord[]>([]);

  // Active workout & selection
  const [activeWorkoutType, setActiveWorkoutType] = useState<WorkoutType>('run');
  const [finishedWorkoutState, setFinishedWorkoutState] = useState<LiveWorkoutState | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);

  // Recovery modal state
  const [recoveredWorkoutBackup, setRecoveredWorkoutBackup] = useState<LiveWorkoutState | null>(null);

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
      authService.updateSettings(profile.user_id, { theme: nextTheme }).catch(() => {});
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
      if (currentUser?.id) {
        loadAppData(currentUser.id, true);
      }
    };

    window.addEventListener('runwar:sync_completed', handleSyncCompleted);

    const initAuth = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (user) {
          setCurrentUser(user);
          let userProfile = await authService.getProfile(user.id);
          if (!userProfile) {
            await authService.createInitialProfile(
              user.id,
              user.name || user.email?.split('@')[0] || 'Runner',
              user.email || ''
            );
            userProfile = await authService.getProfile(user.id);
          }
          if (userProfile) setProfile(userProfile);
          await loadAppData(user.id);
        }
      } catch (e) {
        console.warn('Auth check error:', e);
      }

      // Check if crash recovery exists
      if (offlineSync.hasActiveWorkoutBackup()) {
        const backup = offlineSync.getActiveWorkoutBackup();
        if (backup) {
          setRecoveredWorkoutBackup(backup);
        }
      }
    };

    initAuth();

    // Listen for auth state changes (e.g. Google OAuth redirect callback completion)
    const unsubscribe = insforge.auth.onAuthStateChange(async (event) => {
      if (event === 'signedIn') {
        const user = await authService.getCurrentUser();
        if (user) {
          setCurrentUser(user);
          let userProfile = await authService.getProfile(user.id);
          if (!userProfile) {
            await authService.createInitialProfile(
              user.id,
              user.name || user.email?.split('@')[0] || 'Runner',
              user.email || ''
            );
            userProfile = await authService.getProfile(user.id);
          }
          if (userProfile) setProfile(userProfile);
          await loadAppData(user.id);
          setScreen('main');
        }
      } else if (event === 'signedOut') {
        setCurrentUser(null);
        setProfile(null);
        setScreen('welcome');
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      window.removeEventListener('runwar:sync_completed', handleSyncCompleted);
    };
  }, [loadAppData]);

  // Handle splash completion
  const handleSplashFinish = () => {
    if (currentUser) {
      setScreen('main');
    } else {
      setScreen('welcome');
    }
  };

  // Demo / Guest mode for immediate testing
  const handleGuestAccess = async () => {
    const guestUser = { id: 'usr_guest_demo', email: 'guest.runner@insforge.app' };
    setCurrentUser(guestUser);

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
  const handleAuthSuccess = async (user: any) => {
    setCurrentUser(user);
    const prof = await authService.getProfile(user.id);
    if (!prof) {
      setScreen('profile_setup');
    } else {
      setProfile(prof);
      await loadAppData(user.id);
      setScreen('main');
    }
  };

  // Start a new workout
  const handleStartRun = (type: WorkoutType = 'run') => {
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
    if ((tab === 'history' || tab === 'home') && currentUser?.id) {
      loadAppData(currentUser.id, true);
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
            userId={currentUser?.id || 'guest_user'}
            initialName={currentUser?.name || currentUser?.profile?.name || ''}
            initialEmail={currentUser?.email || ''}
            onComplete={(prof) => {
              setProfile(prof);
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
            headerTitle={
              activeTab === 'home'
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
                activeGoals={goals.filter((g) => g.status === 'active')}
                onStartRun={handleStartRun}
                onViewHistory={() => setActiveTab('history')}
                onViewGoals={() => setActiveTab('goals')}
                onSelectWorkout={handleSelectWorkout}
              />
            )}

            {activeTab === 'history' && (
              <HistoryScreen
                workouts={workouts}
                profile={profile}
                isLoading={isDataLoading}
                error={dataError}
                onRefresh={() => currentUser?.id ? loadAppData(currentUser.id) : Promise.resolve()}
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
              />
            )}

            {activeTab === 'records' && (
              <PersonalRecordsScreen
                records={records}
                workouts={workouts}
                profile={profile}
                onSelectWorkout={handleSelectWorkout}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileScreen
                profile={profile}
                settings={settings}
                workouts={workouts}
                onNavigate={(destination) => {
                  if (destination === 'privacy') setScreen('privacy');
                  else setActiveTab(destination);
                }}
                onSignOut={handleSignOut}
                onUpdateProfile={(updated) => setProfile(updated)}
                onUpdateSettings={(updated) => setSettings(updated)}
              />
            )}
          </AppShell>
        );
    }
  };

  return (
    <>
      {renderScreen()}

      {/* Unsaved Workout Recovery Modal */}
      {recoveredWorkoutBackup && screen !== 'active_run' && (
        <RecoveryModal
          backup={recoveredWorkoutBackup}
          onResume={handleResumeRecovered}
          onFinish={handleFinishRecovered}
          onDiscard={handleDiscardRecovered}
        />
      )}
    </>
  );
};
