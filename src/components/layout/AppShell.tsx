import React, { useState, useEffect } from 'react';
import { Home, History, TrendingUp, User, Play, Calendar, Target, Trophy } from 'lucide-react';
import { TopHeader } from './TopHeader';
import { UserProfile } from '../../types';

export type ActiveTab =
  | 'home'
  | 'activity'
  | 'history'
  | 'run'
  | 'insights'
  | 'profile'
  | 'goals'
  | 'achievements'
  | 'records'
  | 'calendar'
  | 'challenges';

interface AppShellProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  profile: UserProfile | null;
  children: React.ReactNode;
  isTrackingActive?: boolean;
  onQuickStartRun?: () => void;
  headerTitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  isSyncing?: boolean;
  onSync?: () => void;
  streakCount?: number;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
  hideTopHeader?: boolean;
}

export const AppShell: React.FC<AppShellProps> = ({
  activeTab,
  setActiveTab,
  profile,
  children,
  isTrackingActive = false,
  onQuickStartRun,
  headerTitle,
  showBack = false,
  onBack,
  isSyncing = false,
  onSync,
  streakCount = 0,
  theme = 'dark',
  onToggleTheme,
  hideTopHeader = false,
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isDeviceFrame, setIsDeviceFrame] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className={`h-[100dvh] max-h-[100dvh] w-full bg-emerald-50/40 dark:bg-slate-950 flex flex-col items-center justify-start overflow-hidden ${
      isDeviceFrame ? 'p-0 sm:p-6 bg-gradient-to-br from-emerald-50 via-emerald-100/50 to-emerald-50 dark:from-slate-950 dark:via-slate-900 dark:to-emerald-950/30' : ''
    }`}>
      {/* Main App Container */}
      <div
        className={`w-full flex flex-col h-full bg-emerald-50/20 dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-hidden relative ${
          isDeviceFrame
            ? 'max-w-[480px] sm:h-[900px] sm:rounded-[44px] sm:border-[8px] sm:border-emerald-200 dark:sm:border-slate-800 sm:shadow-[0_25px_60px_-15px_rgba(16,185,129,0.15)] dark:sm:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)]'
            : 'max-w-xl md:max-w-2xl lg:max-w-3xl border-x border-emerald-100 dark:border-slate-900 shadow-2xl'
        }`}
      >
        {/* Top Header */}
        {!hideTopHeader && (
          <TopHeader
            title={headerTitle}
            showBack={showBack}
            onBack={onBack}
            profile={profile}
            onOpenProfile={() => setActiveTab('profile')}
            isOnline={isOnline}
            isSyncing={isSyncing}
            onSync={onSync}
            isDeviceFrame={isDeviceFrame}
            onToggleFrame={() => setIsDeviceFrame(!isDeviceFrame)}
            streakCount={streakCount}
            theme={theme}
            onToggleTheme={onToggleTheme}
          />
        )}

        {/* Scrollable Screen Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative overscroll-contain pb-6">
          {children}
        </main>

        {/* Bottom Mobile Tab Navigation (Symmetrical Wings + Dead-Center Elevated RUN Play Button) */}
        {!isTrackingActive && (
          <nav className="shrink-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-2xl border-t border-emerald-100 dark:border-slate-900 px-2 sm:px-3 py-1.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] flex items-center justify-between relative select-none shadow-[0_-10px_25px_rgba(16,185,129,0.08)] dark:shadow-[0_-10px_25px_rgba(0,0,0,0.6)]">
            {/* Left Wing (3 items: Home, Calendar, Insights) */}
            <div className="flex-1 flex items-center justify-around pr-7 sm:pr-8">
              {/* Home Tab */}
              <button
                onClick={() => setActiveTab('home')}
                className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded-xl transition-all ${
                  activeTab === 'home'
                    ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-emerald-800 dark:hover:text-slate-200 font-medium'
                }`}
              >
                <Home size={18} className={activeTab === 'home' ? 'text-emerald-600 dark:text-emerald-400' : ''} />
                <span className="text-[9px] sm:text-[10px] tracking-tight">Home</span>
              </button>

              {/* Calendar Tab */}
              <button
                onClick={() => setActiveTab('calendar')}
                className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded-xl transition-all ${
                  activeTab === 'calendar'
                    ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-emerald-800 dark:hover:text-slate-200 font-medium'
                }`}
              >
                <Calendar size={18} className={activeTab === 'calendar' ? 'text-emerald-600 dark:text-emerald-400' : ''} />
                <span className="text-[9px] sm:text-[10px] tracking-tight">Calendar</span>
              </button>

              {/* Insights Tab */}
              <button
                onClick={() => setActiveTab('insights')}
                className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded-xl transition-all ${
                  activeTab === 'insights'
                    ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-emerald-800 dark:hover:text-slate-200 font-medium'
                }`}
              >
                <TrendingUp size={18} className={activeTab === 'insights' ? 'text-emerald-600 dark:text-emerald-400' : ''} />
                <span className="text-[9px] sm:text-[10px] tracking-tight">Insights</span>
              </button>
            </div>

            {/* Center Elevated RUN Primary Button (Higher elevation, mathematically centered at 50% screen width) */}
            <div className="absolute left-1/2 -translate-x-1/2 -top-6 sm:-top-7 flex flex-col items-center justify-center z-50 pointer-events-auto">
              <button
                onClick={() => {
                  if (onQuickStartRun) onQuickStartRun();
                  else setActiveTab('run');
                }}
                className="w-14 h-14 sm:w-15 sm:h-15 rounded-full bg-gradient-to-tr from-emerald-500 via-emerald-400 to-lime-300 border-4 border-white dark:border-slate-950 text-slate-950 flex items-center justify-center shadow-[0_6px_25px_rgba(16,185,129,0.6)] active:scale-90 hover:scale-110 hover:shadow-[0_8px_30px_rgba(16,185,129,0.75)] transition-all duration-200 group"
                aria-label="Start Run"
              >
                <Play
                  size={25}
                  fill="currentColor"
                  className="translate-x-0.5 text-slate-950 transition-transform group-hover:scale-110"
                />
              </button>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mt-1 drop-shadow-sm">
                RUN
              </span>
            </div>

            {/* Right Wing (3 items: Challenges, History, Profile) */}
            <div className="flex-1 flex items-center justify-around pl-7 sm:pl-8">
              {/* Challenges Tab */}
              <button
                onClick={() => setActiveTab('challenges')}
                className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded-xl transition-all ${
                  activeTab === 'challenges'
                    ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-emerald-800 dark:hover:text-slate-200 font-medium'
                }`}
              >
                <Trophy size={18} className={activeTab === 'challenges' ? 'text-emerald-600 dark:text-emerald-400' : ''} />
                <span className="text-[9px] sm:text-[10px] tracking-tight">Races</span>
              </button>

              {/* History Tab */}
              <button
                onClick={() => setActiveTab('history')}
                className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded-xl transition-all ${
                  activeTab === 'history'
                    ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-emerald-800 dark:hover:text-slate-200 font-medium'
                }`}
              >
                <History size={18} className={activeTab === 'history' ? 'text-emerald-600 dark:text-emerald-400' : ''} />
                <span className="text-[9px] sm:text-[10px] tracking-tight">History</span>
              </button>

              {/* Profile Tab */}
              <button
                onClick={() => setActiveTab('profile')}
                className={`flex flex-col items-center gap-0.5 py-1 px-1.5 rounded-xl transition-all ${
                  activeTab === 'profile'
                    ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-emerald-800 dark:hover:text-slate-200 font-medium'
                }`}
              >
                <User size={18} className={activeTab === 'profile' ? 'text-emerald-600 dark:text-emerald-400' : ''} />
                <span className="text-[9px] sm:text-[10px] tracking-tight">Profile</span>
              </button>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
};
