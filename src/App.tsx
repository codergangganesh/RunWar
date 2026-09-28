import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { PasswordScreen } from './screens/PasswordScreen';
import { BugReportScreen } from './screens/BugReportScreen';
import { AdminBugReportsScreen } from './screens/AdminBugReportsScreen';
import { ConnectedHealthScreen } from './screens/ConnectedHealthScreen';
import { DailyActivityScreen } from './screens/DailyActivityScreen';
import { StepHistoryScreen } from './screens/StepHistoryScreen';
import { ChallengesScreen } from './screens/ChallengesScreen';
import { SocialFeedScreen } from './screens/SocialFeedScreen';
import { PostDetailScreen } from './screens/PostDetailScreen';
import { FeedPost, getPostIdFromUrl } from './services/socialService';
import { RecoveryModal } from './components/ui/RecoveryModal';
import { PWAInstallBanner } from './components/ui/PWAInstallBanner';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { BottomSheet } from './components/ui/BottomSheet';
import { NotificationCenter } from './components/notifications/NotificationCenter';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { useNotifications } from './hooks/useNotifications';
import { notificationService } from './services/notificationService';
import { Bell } from 'lucide-react';

import { insforge } from './lib/insforge';
import { authService } from './services/authService';
import { firebaseAuthService } from './services/firebaseAuthService';
import { workoutService, normalizeWorkout, isStravaWorkout } from './services/workoutService';
import { goalsService } from './services/goalsService';
import { achievementsService } from './services/achievementsService';
import { recordsService } from './services/recordsService';
import { offlineSync } from './services/offlineSync';
import { gpsEngine } from './services/gpsEngine';
import { challengeService } from './services/challengeService';
import { toDeterministicUUID } from './utils/uuid';
import {
  Achievement,
  AppState,
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
  | 'password'
  | 'connected_health'
  | 'post_detail'
  | 'notifications'
  | 'report_bug'
  | 'admin_bug_reports';

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
    } catch { }
    return null;
  })();

  // Navigation & Screen States
  const initialPostIdFromUrl = getPostIdFromUrl();
  const [activePostId, setActivePostId] = useState<string | null>(initialPostIdFromUrl);
  const [activePost, setActivePost] = useState<FeedPost | null>(null);

  const [screen, setScreen] = useState<ScreenState>(() => {
    if (initialActiveWorkout) {
      return 'active_run';
    }
    if (initialPostIdFromUrl) {
      return 'post_detail';
    }
    return 'splash';
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>('home');

  // User & Settings (Synchronously load cached session on frame 0)
  const [currentUser, setCurrentUser] = useState<any>(() => authService.getCachedUser());
  const [appState, setAppState] = useState<AppState>('INITIALIZING');
  const [authStatusText, setAuthStatusText] = useState<string>('Checking your account...');
  const [profileErrorMessage, setProfileErrorMessage] = useState<string | null>(null);
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

  // Notification State & Handlers
  const {
    notifications,
    unreadCount,
    isLoading: isNotifsLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
  } = useNotifications(currentUser?.id || null);

  const handleNotificationNavigation = useCallback((url: string) => {
    if (!url) return;
    if (url.startsWith('/workout') || url.startsWith('/history')) {
      setScreen('main');
      setActiveTab('history');
    } else if (url.includes('tab=goals') || url.startsWith('/goals')) {
      setScreen('main');
      setActiveTab('goals');
    } else if (url.includes('tab=challenges') || url.startsWith('/challenges')) {
      setScreen('main');
      setActiveTab('challenges');
    } else if (url.includes('tab=achievements') || url.startsWith('/profile/achievements') || url.startsWith('/achievements')) {
      setScreen('main');
      setActiveTab('achievements');
    } else if (url.includes('tab=social') || url.startsWith('/social')) {
      setScreen('main');
      setActiveTab('social');
    } else if (url.includes('tab=profile') || url.startsWith('/profile')) {
      setScreen('main');
      setActiveTab('profile');
    } else if (url.includes('tab=activity') || url.startsWith('/activity')) {
      setScreen('main');
      setActiveTab('activity');
    } else {
      setScreen('main');
      setActiveTab('home');
    }
  }, []);

  const handleStartRunRef = useRef<((type?: WorkoutType) => void) | null>(null);
  const isResolvingProfileRef = useRef(false);

  useEffect(() => {
    // Check if opened via notification click with ?action=start_run
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'start_run') {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      setTimeout(() => {
        handleStartRunRef.current?.('run');
      }, 600);
    }
  }, []);

  useEffect(() => {
    const handleSwMessage = (event: MessageEvent) => {
      if (
        event.data?.type === 'RUNWAR_NOTIFICATION_CLICK' ||
        event.data?.type === 'NOTIFICATION_CLICK'
      ) {
        const { url, notificationId, action } = event.data;
        if (notificationId) {
          notificationService.markAsRead(notificationId).catch(() => { });
        }
        if (action === 'start_run') {
          setScreen('main');
          setActiveTab('home');
          setTimeout(() => {
            handleStartRunRef.current?.('run');
          }, 150);
        } else if (url) {
          handleNotificationNavigation(url);
          if (url.includes('action=start_run')) {
            setTimeout(() => {
              handleStartRunRef.current?.('run');
            }, 150);
          }
        }
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSwMessage);
      };
    }
  }, [handleNotificationNavigation]);

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

  // Recovery modal state & Targeted Invite Link Errors
  const [recoveredWorkoutBackup, setRecoveredWorkoutBackup] = useState<LiveWorkoutState | null>(null);
  const [targetedInviteError, setTargetedInviteError] = useState<{ errorMessage: string; targetUsername?: string } | null>(null);

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

  const handleRefreshHistory = useCallback(async () => {
    const activeId = currentUser?.id || authService.getCachedUser()?.id || 'guest_user';
    await loadAppData(activeId, true);
  }, [currentUser?.id, loadAppData]);

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

  // Centralized resolution gate for session, profile verification, and data preloading
  const resolveUserSessionAndProfile = useCallback(
    async (authenticatedUser: any, isNewUserHint = false) => {
      if (!authenticatedUser || !authenticatedUser.id || authenticatedUser.id === 'guest_user') {
        setAppState('UNAUTHENTICATED');
        const currentPostId = getPostIdFromUrl();
        if (currentPostId) {
          setActivePostId(currentPostId);
          setScreen('post_detail');
        } else {
          setScreen((prev) => (prev === 'splash' ? 'welcome' : prev));
        }
        return;
      }

      if (isResolvingProfileRef.current) {
        console.log('[RunWar Auth] resolveUserSessionAndProfile already in progress, skipping concurrent run');
        return;
      }
      isResolvingProfileRef.current = true;

      setAppState('PROFILE_CHECKING');
      setAuthStatusText('Setting things up...');
      setProfileErrorMessage(null);

      try {
        let userProfile: UserProfile | null = null;
        try {
          userProfile = authenticatedUser.firebase_uid
            ? await authService.getProfileByFirebaseUid(authenticatedUser.firebase_uid)
            : await authService.getProfile(authenticatedUser.id);
        } catch (fetchErr: any) {
          console.error('[RunWar Auth] Failed to fetch profile from cloud:', fetchErr);
          setProfileErrorMessage(fetchErr?.message || "We couldn't load your profile. Please check your connection.");
          setAppState('PROFILE_ERROR');
          return;
        }

        // If newly registered user with no profile record in DB yet, create initial profile row
        if (!userProfile) {
          try {
            await authService.createInitialProfile(
              authenticatedUser.id,
              authenticatedUser.name || authenticatedUser.email?.split('@')[0] || 'Runner',
              authenticatedUser.email || ''
            );
            userProfile = await authService.getProfile(authenticatedUser.id);
          } catch (createErr) {
            console.warn('[RunWar Auth] Notice creating initial profile record:', createErr);
          }
        }

        if (userProfile) {
          setProfile(userProfile);
        }

        // Evaluate profile completion strictly using database flag (and fallbacks)
        const isSetupDone = !isNewUserHint && authService.isProfileSetupComplete(authenticatedUser.id, userProfile);

        const currentPostId = getPostIdFromUrl();

        if (currentPostId) {
          setActivePostId(currentPostId);
          setScreen('post_detail');
          setAppState(isSetupDone ? 'READY' : 'PROFILE_INCOMPLETE');
          return;
        }

        if (!isSetupDone) {
          setAppState('PROFILE_INCOMPLETE');
          setScreen('profile_setup');
          return;
        }

        // Existing user with completed profile: preload user application data BEFORE entering READY / Home
        setAuthStatusText('Loading workouts...');
        workoutService.syncPendingWorkouts(authenticatedUser.id).catch(() => { });
        await loadAppData(authenticatedUser.id, true);

        setAppState('READY');
        setScreen((prev) => (prev === 'splash' || prev === 'welcome' || prev === 'auth' || prev === 'onboarding' ? 'main' : prev));

        // Handle challenge invite deep-link token if present
        const params = new URLSearchParams(window.location.search);
        const inviteToken = params.get('invite');
        if (inviteToken && authenticatedUser.id) {
          challengeService.claimInvitationToken(inviteToken, authenticatedUser.id)
            .then((res) => {
              if (res.success && res.challenge) {
                window.history.replaceState({}, '', window.location.pathname);
                setActiveTab('challenges');
              } else if (res.error) {
                setTargetedInviteError({
                  errorMessage: res.error,
                  targetUsername: res.targetUsername,
                });
                window.history.replaceState({}, '', window.location.pathname);
              }
            })
            .catch(() => { });
        }
      } catch (err: any) {
        console.error('[RunWar Auth] Error resolving session & profile:', err);
        setProfileErrorMessage(err?.message || "We couldn't load your profile. Please check your connection.");
        setAppState('PROFILE_ERROR');
      } finally {
        isResolvingProfileRef.current = false;
      }
    },
    [loadAppData]
  );

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

    const handleWorkoutDeletedEvent = (event: any) => {
      const deletedId = event?.detail?.workoutId;
      if (!deletedId) return;
      setWorkouts((prev) => prev.filter((w) => w.id !== deletedId));
    };

    window.addEventListener('runwar:sync_completed', handleSyncCompleted);
    window.addEventListener('runwar:workouts_purged', handleWorkoutsPurged);
    window.addEventListener('runwar:workout_synced', handleWorkoutSynced);
    window.addEventListener('runwar:workout_deleted', handleWorkoutDeletedEvent);

    const initAuth = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const hasOAuthCode =
          urlParams.has('insforge_code') ||
          urlParams.has('code') ||
          hashParams.has('insforge_code') ||
          hashParams.has('code');
        const hasError =
          urlParams.has('error') ||
          urlParams.has('error_description') ||
          hashParams.has('error') ||
          hashParams.has('error_description');
        const isOAuthPending =
          hasOAuthCode ||
          hasError ||
          localStorage.getItem('runwar_oauth_in_progress') === 'true';

        console.log('[RunWar Auth] initAuth started. URL:', window.location.href, {
          hasOAuthCode,
          hasError,
          isOAuthPending,
        });

        if (isOAuthPending) {
          setAppState('INITIALIZING');
          setAuthStatusText('Signing in with Google...');
        }

        let user: any = null;

        // 1. Explicitly process OAuth callback if returning from Google OAuth
        if (isOAuthPending) {
          console.log('[RunWar Auth] Handling OAuth redirect callback...');
          const callbackResult = await authService.handleOAuthCallback();
          if (callbackResult.success && callbackResult.user) {
            console.log('[RunWar Auth] OAuth callback authenticated user:', callbackResult.user.id);
            user = callbackResult.user;
          } else if (callbackResult.error) {
            console.error('[RunWar Auth] OAuth callback failed with error:', callbackResult.error);
          }
        }

        // 2. If no user from OAuth callback, check current active InsForge session
        if (!user) {
          user = await authService.getCurrentUser();
          console.log('[RunWar Auth] getCurrentUser result:', user ? { id: user.id, email: user.email } : null);
        }

        // 3. If not in InsForge, check if Firebase user is logged in (phone OTP)
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
          await resolveUserSessionAndProfile(user);
        } else {
          // No active session found from OAuth, InsForge, or Firebase
          const cached = authService.getCachedUser();
          const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
          const isRealCachedUser = Boolean(cached?.id && cached.id !== 'guest_user' && cached.id !== 'usr_guest_demo');

          // Preserve cached user ONLY if device is offline and user was previously authenticated
          if (isRealCachedUser && isOffline) {
            setCurrentUser(cached);
            await resolveUserSessionAndProfile(cached);
          } else {
            // Online and user account is deleted/unauthorized or guest placeholder: purge stale ghost session!
            setCurrentUser(null);
            setProfile(null);
            authService.clearCachedUser(false);
            setAppState('UNAUTHENTICATED');
            const currentPostId = getPostIdFromUrl();
            if (currentPostId) {
              setActivePostId(currentPostId);
              setScreen('post_detail');
            } else {
              setScreen((prev) => (prev === 'splash' ? 'welcome' : prev));
            }
          }
        }
      } catch (e) {
        console.warn('Auth check error:', e);
        const currentPostId = getPostIdFromUrl();
        if (currentPostId) {
          setActivePostId(currentPostId);
          setScreen('post_detail');
          setAppState('UNAUTHENTICATED');
        } else {
          const cached = authService.getCachedUser();
          const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
          const isRealCachedUser = Boolean(cached?.id && cached.id !== 'guest_user' && cached.id !== 'usr_guest_demo');
          if (isRealCachedUser && isOffline) {
            setCurrentUser(cached);
            await resolveUserSessionAndProfile(cached);
          } else {
            setCurrentUser(null);
            setProfile(null);
            authService.clearCachedUser(false);
            setAppState('UNAUTHENTICATED');
            setScreen((prev) => (prev === 'splash' ? 'welcome' : prev));
          }
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
      console.log('[RunWar Auth] onAuthStateChange event:', event, 'Current screen:', screen);
      if (event === 'signedIn') {
        // If user is already authenticated, appState is READY, and not currently resolving, skip redundant reload loop
        const activeUserId = currentUser?.id || authService.getCachedUser()?.id;
        if (activeUserId && activeUserId !== 'guest_user' && appState === 'READY' && !isResolvingProfileRef.current) {
          return;
        }
        if (isResolvingProfileRef.current) {
          console.log('[RunWar Auth] onAuthStateChange signedIn skipped: profile resolution already active');
          return;
        }
        const user = await authService.getCurrentUser();
        console.log('[RunWar Auth] onAuthStateChange signedIn user:', user ? { id: user.id, email: user.email } : null);
        if (user) {
          setCurrentUser(user);
          authService.setCachedUser(user);
          await resolveUserSessionAndProfile(user);
        }
      } else if (event === 'signedOut') {
        const isOAuthPending =
          localStorage.getItem('runwar_oauth_in_progress') === 'true' ||
          window.location.search.includes('insforge_code') ||
          window.location.search.includes('code');

        if (isOAuthPending) {
          console.log('[RunWar Auth] onAuthStateChange signedOut ignored during OAuth redirect');
          return;
        }

        setCurrentUser(null);
        setProfile(null);
        setWorkouts([]);
        authService.clearCachedUser(false);
        setAppState('UNAUTHENTICATED');
        const currentPostId = getPostIdFromUrl();
        if (currentPostId) {
          setActivePostId(currentPostId);
          setScreen('post_detail');
        } else {
          setScreen('welcome');
        }
      }
    });

    // Real-time Session Watcher: Detect account deletion without requiring a page refresh
    let lastCheckTime = 0;
    const checkActiveSession = async () => {
      const now = Date.now();
      if (now - lastCheckTime < 5000) return; // Throttle to max once per 5 seconds
      lastCheckTime = now;

      // Do not interrupt OAuth redirect or ongoing profile resolution
      if (
        localStorage.getItem('runwar_oauth_in_progress') === 'true' ||
        window.location.search.includes('insforge_code') ||
        window.location.search.includes('code') ||
        isResolvingProfileRef.current
      ) {
        return;
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      const cached = authService.getCachedUser();
      if (!cached || cached.id === 'guest_user') return;

      try {
        const user = await authService.getCurrentUser();
        if (!user) {
          console.log('[RunWar Auth] Account deleted in cloud; routing to welcome screen without refresh.');
          setCurrentUser(null);
          setProfile(null);
          setWorkouts([]);
          authService.clearCachedUser(false);
          setAppState('UNAUTHENTICATED');
          setScreen('welcome');
        }
      } catch {
        // Ignored for offline or network issues
      }
    };

    const handleSessionExpired = () => {
      if (
        localStorage.getItem('runwar_oauth_in_progress') === 'true' ||
        window.location.search.includes('insforge_code') ||
        window.location.search.includes('code') ||
        isResolvingProfileRef.current
      ) {
        return;
      }
      setCurrentUser(null);
      setProfile(null);
      setWorkouts([]);
      setAppState('UNAUTHENTICATED');
      setScreen('welcome');
    };

    window.addEventListener('runwar:session_expired', handleSessionExpired);

    return () => {
      if (typeof unsubFirebase === 'function') unsubFirebase();
      if (typeof unsubscribe === 'function') unsubscribe();
      window.removeEventListener('runwar:session_expired', handleSessionExpired);
      window.removeEventListener('runwar:sync_completed', handleSyncCompleted);
      window.removeEventListener('runwar:workouts_purged', handleWorkoutsPurged);
      window.removeEventListener('runwar:workout_synced', handleWorkoutSynced);
      window.removeEventListener('runwar:workout_deleted', handleWorkoutDeletedEvent);
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

  // Handle splash completion (controlled by AppState FSM)
  const handleSplashFinish = () => { };

  // Handle URL navigation params after authentication resolves
  useEffect(() => {
    if (isAuthInitializing || appState !== 'READY') return;
    const postParam = getPostIdFromUrl();
    if (postParam) {
      setActivePostId(postParam);
      setScreen('post_detail');
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const targetScreen = params.get('screen') as ScreenState | null;
    const targetTab = params.get('tab') as ActiveTab | null;
    if (targetScreen === 'connected_health' || targetScreen === 'privacy' || targetScreen === 'password') {
      setScreen(targetScreen);
    } else if (targetTab) {
      setActiveTab(targetTab);
    }
  }, [isAuthInitializing, appState]);

  // Support browser Back/Forward navigation with deep linked posts
  useEffect(() => {
    const handlePopState = () => {
      const postParam = getPostIdFromUrl();
      if (postParam) {
        setActivePostId(postParam);
        setScreen('post_detail');
      } else if (screen === 'post_detail') {
        const cached = authService.getCachedUser();
        if (cached) {
          setScreen('main');
          setActiveTab('social');
        } else {
          setScreen('welcome');
        }
        setActivePostId(null);
        setActivePost(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [screen]);

  // Open and close dedicated post detail view
  const handleOpenPostDetail = (targetPost: FeedPost | string) => {
    if (typeof targetPost === 'string') {
      setActivePostId(targetPost);
      setActivePost(null);
    } else {
      setActivePost(targetPost);
      setActivePostId(targetPost.id);
    }
    setScreen('post_detail');
    const targetId = typeof targetPost === 'string' ? targetPost : targetPost.id;
    const newUrl = `${window.location.pathname}?post=${encodeURIComponent(targetId)}`;
    window.history.pushState({ postId: targetId }, '', newUrl);
  };

  const handleClosePostDetail = () => {
    setActivePostId(null);
    setActivePost(null);
    window.history.replaceState({}, '', window.location.pathname);

    const cached = authService.getCachedUser();
    if (currentUser || cached) {
      setScreen('main');
      setActiveTab('social');
    } else {
      setScreen('welcome');
    }
  };

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
      daily_step_goal: 10000,
      profile_completed: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setProfile(guestProfile);
    await loadAppData(guestUser.id);
    setAppState('READY');
    setScreen('main');
  };

  // Auth success
  const handleAuthSuccess = async (user: any, isNewUser = false) => {
    setCurrentUser(user);
    authService.setCachedUser(user);
    await resolveUserSessionAndProfile(user, isNewUser);
  };

  // Profile setup completion
  const handleProfileSetupComplete = async (completedProfile: UserProfile) => {
    const activeUserId = completedProfile.user_id || currentUser?.id;
    if (activeUserId) {
      localStorage.setItem(`runwar_profile_setup_done_${activeUserId}`, 'true');
    }
    setProfile(completedProfile);
    if (activeUserId) {
      setAuthStatusText('Preparing your dashboard...');
      await loadAppData(activeUserId, true);
    }
    setAppState('READY');
    setScreen('main');
    setActiveTab('home');

    // Handle challenge deep link token if present
    const params = new URLSearchParams(window.location.search);
    const inviteToken = params.get('invite');
    if (inviteToken && activeUserId) {
      challengeService.claimInvitationToken(inviteToken, activeUserId)
        .then((res) => {
          if (res.success && res.challenge) {
            window.history.replaceState({}, '', window.location.pathname);
            setActiveTab('challenges');
          } else if (res.error) {
            setTargetedInviteError({
              errorMessage: res.error,
              targetUsername: res.targetUsername,
            });
            window.history.replaceState({}, '', window.location.pathname);
          }
        })
        .catch(() => { });
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
  handleStartRunRef.current = handleStartRun;

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
    // 1. Immediately reflect in memory and UI (0ms delay, no page refresh needed)
    setWorkouts((prev) => prev.filter((w) => w.id !== workoutId));
    setSelectedWorkout(null);
    setScreen('main');
    setActiveTab('history');

    // 2. Silently update statistics in the background
    const activeId = currentUser?.id || authService.getCachedUser()?.id;
    if (activeId) {
      workoutService.getTodayStats(activeId).then(setTodayStats).catch(() => { });
      workoutService.getWeeklyStats(activeId).then(setWeeklyStats).catch(() => { });
      recordsService.getPersonalRecords(activeId).then(setRecords).catch(() => { });
    }
  };

  // Sign out
  const handleSignOut = async () => {
    await authService.signOut();
    setCurrentUser(null);
    setProfile(null);
    setWorkouts([]);
    setAppState('UNAUTHENTICATED');
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

  // Render current active screen with strict FSM gating
  const renderScreen = () => {
    // 1. Initializing or checking profile => always Splash, NEVER Home
    if (appState === 'INITIALIZING' || appState === 'PROFILE_CHECKING') {
      return <SplashScreen statusText={authStatusText} />;
    }

    // 2. Profile fetch failure => Controlled error screen with Try Again & Sign Out
    if (appState === 'PROFILE_ERROR') {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#e8f3f0] p-6 font-sans">
          <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl border border-emerald-100 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-5 shadow-sm">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2">We couldn't load your profile</h2>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              {profileErrorMessage || 'Please check your internet connection and try again.'}
            </p>
            <div className="flex flex-col w-full gap-3">
              <button
                type="button"
                onClick={() => {
                  const userToRetry = currentUser || authService.getCachedUser();
                  resolveUserSessionAndProfile(userToRetry);
                }}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#00d09c] hover:bg-[#00ba8b] text-slate-950 font-black text-sm shadow-md shadow-[#00d09c]/25 active:scale-95 transition-all cursor-pointer"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full py-3 px-6 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      );
    }

    // 3. Authenticated but profile is incomplete => Profile Setup Screen ONLY
    if (appState === 'PROFILE_INCOMPLETE' || screen === 'profile_setup') {
      const activeUserId =
        (currentUser?.id && currentUser.id !== 'guest_user' ? currentUser.id : null) ||
        (profile?.user_id && profile.user_id !== 'guest_user' ? profile.user_id : null) ||
        (authService.getCachedUser()?.id && authService.getCachedUser()?.id !== 'guest_user' ? authService.getCachedUser()?.id : null);

      if (!activeUserId) {
        return <SplashScreen statusText="Setting up your profile..." />;
      }

      return (
        <ProfileSetupScreen
          userId={activeUserId}
          initialProfile={profile}
          initialName={currentUser?.name || currentUser?.profile?.name || currentUser?.user_metadata?.name || profile?.name || ''}
          initialEmail={currentUser?.email || profile?.email || ''}
          onBack={handleSignOut}
          onComplete={handleProfileSetupComplete}
        />
      );
    }

    // 4. Unauthenticated => Welcome, Onboarding, or Auth
    if (appState === 'UNAUTHENTICATED') {
      switch (screen) {
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

        case 'post_detail':
          return (
            <PostDetailScreen
              postId={activePostId}
              initialPost={activePost}
              profile={profile}
              onBack={handleClosePostDetail}
              onOpenProfile={() => setScreen('auth')}
              onSelectWorkout={(workout) => {
                setSelectedWorkout(workout);
                setScreen('workout_detail');
              }}
              onOpenAuth={() => setScreen('auth')}
            />
          );

        case 'welcome':
        default:
          return (
            <WelcomeScreen
              onStartOnboarding={() => setScreen('onboarding')}
              onLogin={() => setScreen('auth')}
              onGuestAccess={handleGuestAccess}
            />
          );
      }
    }

    // 5. READY => Render authenticated application screens
    switch (screen) {
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
              onNavigatePassword={() => setScreen('password')}
            />
          </AppShell>
        );

      case 'password':
        return (
          <AppShell
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            profile={profile}
            headerTitle="Password"
            showBack={true}
            onBack={() => setScreen('privacy')}
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
            <PasswordScreen
              currentUser={currentUser}
              profile={profile}
              onProfileUpdated={(updated) => setProfile(updated)}
              onBack={() => setScreen('privacy')}
            />
          </AppShell>
        );

      case 'report_bug':
        return (
          <AppShell
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            profile={profile}
            headerTitle="Report a Bug"
            showBack={true}
            onBack={() => {
              setActiveTab('profile');
              setScreen('main');
            }}
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
            <BugReportScreen
              currentUser={currentUser}
              profile={profile}
              reportedFrom={activeTab ? `Tab: ${activeTab}` : 'Profile'}
              onBack={() => {
                setActiveTab('profile');
                setScreen('main');
              }}
            />
          </AppShell>
        );

      case 'admin_bug_reports':
        return (
          <AppShell
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            profile={profile}
            headerTitle="Admin Bug Reports"
            showBack={true}
            onBack={() => {
              setActiveTab('profile');
              setScreen('main');
            }}
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
            <AdminBugReportsScreen
              currentUser={currentUser}
              profile={profile}
              onBack={() => {
                setActiveTab('profile');
                setScreen('main');
              }}
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

      case 'post_detail':
        return (
          <PostDetailScreen
            postId={activePostId}
            initialPost={activePost}
            profile={profile}
            onBack={handleClosePostDetail}
            onOpenProfile={(_athlete) => {
              if (currentUser) {
                setActiveTab('social');
                setScreen('main');
              } else {
                setScreen('auth');
              }
            }}
            onSelectWorkout={(workout) => {
              setSelectedWorkout(workout);
              setScreen('workout_detail');
            }}
            onOpenAuth={() => setScreen('auth')}
          />
        );

      case 'notifications':
        return (
          <NotificationsScreen
            userId={currentUser?.id || null}
            notifications={notifications}
            unreadCount={unreadCount}
            isLoading={isNotifsLoading}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
            onDelete={deleteNotification}
            onDeleteAll={deleteAllNotifications}
            onNavigate={(url) => {
              setScreen('main');
              handleNotificationNavigation(url);
            }}
            onBack={() => setScreen('main')}
          />
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
            onOpenNotifications={() => setScreen('notifications')}
            notificationUnreadCount={unreadCount}
            hideTopHeader={activeTab === 'activity' || activeTab === 'steps_history'}
            headerTitle={
              activeTab === 'home' || activeTab === 'activity' || activeTab === 'steps_history'
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
                            : activeTab === 'challenges'
                              ? 'Running Challenges'
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
                onViewChallenges={() => setActiveTab('challenges')}
                onViewSocialFeed={() => setActiveTab('social')}
                onViewReminders={() => setActiveTab('profile')}
                onViewActivity={() => setActiveTab('activity')}
                onSelectWorkout={handleSelectWorkout}
              />
            )}

            {activeTab === 'activity' && (
              <DailyActivityScreen
                profile={profile}
                workouts={workouts}
                onStartRun={handleStartRun}
                onViewHistory={() => setActiveTab('history')}
                onViewStepHistory={() => setActiveTab('steps_history')}
                onViewInsights={() => setActiveTab('insights')}
                onOpenProfile={() => setActiveTab('profile')}
              />
            )}

            {activeTab === 'steps_history' && (
              <StepHistoryScreen
                workouts={workouts}
                profile={profile}
                onBack={() => setActiveTab('activity')}
                onStartRun={handleStartRun}
              />
            )}

            {activeTab === 'history' && (
              <HistoryScreen
                workouts={workouts}
                profile={profile}
                isLoading={isDataLoading}
                error={dataError}
                onRefresh={handleRefreshHistory}
                onSelectWorkout={handleSelectWorkout}
                onStartRun={() => handleStartRun('run')}
                onDeleteWorkout={handleWorkoutDeleted}
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

            {activeTab === 'challenges' && (
              <ChallengesScreen
                currentUser={profile || ({ user_id: currentUser?.id || 'guest_user', name: currentUser?.email?.split('@')[0] || 'Runner', id: currentUser?.id || 'guest_user' } as UserProfile)}
                onStartRun={(challenge) => {
                  // Store challenge ID so ActiveRunScreen can pick it up
                  sessionStorage.setItem('runwar_active_challenge_id', challenge.id);
                  handleStartRun('run');
                }}
                onBack={() => setActiveTab('home')}
              />
            )}

            {activeTab === 'social' && (
              <SocialFeedScreen
                profile={profile}
                userWorkouts={workouts}
                onSelectWorkout={handleSelectWorkout}
                onSelectPost={handleOpenPostDetail}
                onBack={() => setActiveTab('home')}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileScreen
                profile={profile}
                settings={settings}
                workouts={workouts}
                records={records}
                goals={goals}
                onRefreshGoals={() => {
                  if (currentUser) {
                    loadAppData(currentUser.id, true);
                  }
                }}
                onNavigate={(destination) => {
                  if (destination === 'privacy') setScreen('privacy');
                  else if (destination === 'password') setScreen('password');
                  else if (destination === 'connected_health') setScreen('connected_health');
                  else if (destination === 'report_bug') setScreen('report_bug');
                  else if (destination === 'admin_bug_reports') setScreen('admin_bug_reports');
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

      {/* Targeted Username Challenge Invite Modal */}
      {targetedInviteError && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--surface-color, #1e293b)',
            border: '1px solid var(--border-color, #334155)',
            borderRadius: '24px',
            padding: '28px 24px',
            maxWidth: '420px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
            color: '#f8fafc',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
              fontSize: '28px'
            }}>
              🔒
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 10px 0', color: '#f8fafc' }}>
              Private Challenge Access
            </h3>
            <p style={{ fontSize: '0.925rem', color: '#94a3b8', lineHeight: '1.5', margin: '0 0 24px 0' }}>
              {targetedInviteError.errorMessage}
            </p>
            <button
              onClick={() => setTargetedInviteError(null)}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '14px',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.35)',
                transition: 'transform 0.15s ease'
              }}
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </ErrorBoundary>
  );
};
