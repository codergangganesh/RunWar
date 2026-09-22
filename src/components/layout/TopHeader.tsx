import React from 'react';
import { ArrowLeft, Wifi, WifiOff, Sparkles, Smartphone, Maximize2, Flame, Sun, Moon, RefreshCw, CloudCheck } from 'lucide-react';
import { UserProfile } from '../../types';

interface TopHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  profile?: UserProfile | null;
  onOpenProfile?: () => void;
  isOnline?: boolean;
  isSyncing?: boolean;
  onSync?: () => void;
  isDeviceFrame?: boolean;
  onToggleFrame?: () => void;
  streakCount?: number;
  theme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  title,
  showBack = false,
  onBack,
  profile,
  onOpenProfile,
  isOnline = true,
  isSyncing = false,
  onSync,
  isDeviceFrame = false,
  onToggleFrame,
  streakCount = 0,
  theme = 'dark',
  onToggleTheme,
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-3.5 py-2.5 bg-white/95 dark:bg-slate-950/85 backdrop-blur-lg border-b border-emerald-100 dark:border-slate-900 select-none shadow-sm dark:shadow-none">
      <div className="flex items-center gap-2.5">
        {showBack ? (
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-emerald-50 dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 text-emerald-950 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-white active:scale-90 transition-all"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="RunWar Logo"
              className="w-8 h-8 rounded-full object-contain shadow-glow-brand bg-white dark:bg-slate-900 border border-emerald-200 dark:border-slate-800"
            />
            <span className="font-display font-extrabold text-lg tracking-tight text-emerald-950 dark:text-white">
              RUN<span className="text-emerald-500 dark:text-emerald-400">WAR</span>
            </span>
          </div>
        )}

        {title && showBack && (
          <h1 className="font-display font-bold text-base text-emerald-950 dark:text-white tracking-tight truncate max-w-[150px]">
            {title}
          </h1>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {/* Streak Option - Perfect Circle (No Blinking) */}
        <div
          className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-600 dark:text-amber-400 flex items-center justify-center gap-0.5 shadow-sm shrink-0"
          title={`${streakCount} Day Streak`}
        >
          <Flame size={12} fill="currentColor" className="text-amber-500 dark:text-amber-400 shrink-0" />
          <span className="font-mono text-[10px] font-black text-amber-600 dark:text-amber-300 leading-none">{streakCount}</span>
        </div>

        {/* Dark / Light Mode Toggle in Nav Bar */}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className="w-7 h-7 rounded-full bg-emerald-50 dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 text-emerald-900 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-white active:scale-90 transition-all flex items-center justify-center shrink-0"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle dark/light theme"
          >
            {theme === 'dark' ? (
              <Sun size={14} className="text-amber-400" />
            ) : (
              <Moon size={14} className="text-emerald-700" />
            )}
          </button>
        )}

        {/* Device Frame preview toggle for desktop previewers */}
        {onToggleFrame && (
          <button
            onClick={onToggleFrame}
            className="hidden sm:flex w-7 h-7 rounded-full bg-emerald-50 dark:bg-slate-900 border border-emerald-200 dark:border-slate-800 text-emerald-800 dark:text-slate-400 hover:text-emerald-950 dark:hover:text-white items-center justify-center transition-all shrink-0"
            title={isDeviceFrame ? 'Switch to full view' : 'Switch to mobile device frame'}
          >
            {isDeviceFrame ? <Maximize2 size={13} /> : <Smartphone size={13} />}
          </button>
        )}

        {/* Network & Cloud Sync Status Button */}
        <button
          onClick={onSync}
          disabled={!isOnline || isSyncing}
          className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all ${
            isSyncing
              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 animate-pulse'
              : isOnline
              ? 'bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 active:scale-90 cursor-pointer'
              : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 opacity-80'
          }`}
          title={isSyncing ? 'Syncing with InsForge Cloud...' : isOnline ? 'Connected to InsForge Cloud (Click to refresh)' : 'Offline (Changes will sync when online)'}
          aria-label="Cloud sync status"
        >
          {isSyncing ? (
            <RefreshCw size={13} className="animate-spin text-emerald-500" />
          ) : isOnline ? (
            <Wifi size={13} />
          ) : (
            <WifiOff size={13} />
          )}
        </button>

        {/* Profile Avatar button */}
        {profile && (
          <button
            onClick={onOpenProfile}
            className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-slate-800 border-2 border-emerald-300 dark:border-slate-750 overflow-hidden flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold text-xs hover:border-emerald-500 active:scale-95 transition-all shadow-sm shrink-0"
          >
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[11px]">{profile.name.charAt(0).toUpperCase()}</span>
            )}
          </button>
        )}
      </div>
    </header>
  );
};
