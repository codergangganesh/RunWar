import React from 'react';
import { ArrowLeft, Wifi, WifiOff, Smartphone, Maximize2, Flame, Sun, Moon, RefreshCw } from 'lucide-react';
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
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white/95 dark:bg-slate-950/90 backdrop-blur-lg border-b border-emerald-100/70 dark:border-slate-900 select-none shadow-sm dark:shadow-none transition-colors">
      {/* Left side: Back button or Logo + Title */}
      <div className="flex items-center gap-3">
        {showBack ? (
          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-90 transition-all flex items-center justify-center shadow-sm"
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
            <span className="font-display font-black text-lg tracking-tight text-slate-950 dark:text-white">
              RUN<span className="text-[#00d09c]">WAR</span>
            </span>
          </div>
        )}

        {title && showBack && (
          <h1 className="font-display font-black text-lg text-slate-950 dark:text-white tracking-tight truncate max-w-[170px]">
            {title}
          </h1>
        )}
      </div>

      {/* Right side icons */}
      <div className="flex items-center gap-2">
        {/* Streak Option */}
        <div
          className="h-8 px-2.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center gap-1 shadow-sm shrink-0"
          title={`${streakCount} Day Streak`}
        >
          <Flame size={13} fill="currentColor" className="text-amber-500 dark:text-amber-400 shrink-0" />
          <span className="font-mono text-xs font-black text-amber-600 dark:text-amber-300 leading-none">{streakCount}</span>
        </div>

        {/* Dark / Light Mode Toggle */}
        {onToggleTheme && (
          <button
            type="button"
            onClick={onToggleTheme}
            className="w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-white active:scale-90 transition-all flex items-center justify-center shrink-0 shadow-sm"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle dark/light theme"
          >
            {theme === 'dark' ? (
              <Sun size={15} className="text-amber-400" />
            ) : (
              <Moon size={15} className="text-slate-700" />
            )}
          </button>
        )}

        {/* Device Frame preview toggle for desktop previewers */}
        {onToggleFrame && (
          <button
            type="button"
            onClick={onToggleFrame}
            className="hidden sm:flex w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white items-center justify-center transition-all shrink-0 shadow-sm"
            title={isDeviceFrame ? 'Switch to full view' : 'Switch to mobile device frame'}
          >
            {isDeviceFrame ? <Maximize2 size={13} /> : <Smartphone size={13} />}
          </button>
        )}

        {/* Network & Cloud Sync Status Button */}
        <button
          type="button"
          onClick={onSync}
          disabled={!isOnline || isSyncing}
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all shadow-sm ${
            isSyncing
              ? 'bg-[#00d09c]/20 text-[#00b284] border border-[#00d09c] animate-pulse'
              : isOnline
              ? 'bg-[#00d09c] hover:bg-[#00ba8b] text-white border border-[#00d09c] active:scale-90 cursor-pointer'
              : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 opacity-80'
          }`}
          title={isSyncing ? 'Syncing with InsForge Cloud...' : isOnline ? 'Connected to InsForge Cloud (Click to refresh)' : 'Offline (Changes will sync when online)'}
          aria-label="Cloud sync status"
        >
          {isSyncing ? (
            <RefreshCw size={13} className="animate-spin text-white" />
          ) : isOnline ? (
            <Wifi size={14} className="text-white" />
          ) : (
            <WifiOff size={14} />
          )}
        </button>

        {/* Profile Avatar button */}
        {profile && (
          <button
            type="button"
            onClick={onOpenProfile}
            className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-slate-800 border-2 border-emerald-300 dark:border-slate-700 overflow-hidden flex items-center justify-center text-emerald-800 dark:text-emerald-400 font-bold text-xs hover:border-[#00d09c] active:scale-95 transition-all shadow-sm shrink-0"
            title="Athlete Profile"
          >
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-black">{profile.name.charAt(0).toUpperCase()}</span>
            )}
          </button>
        )}
      </div>
    </header>
  );
};
