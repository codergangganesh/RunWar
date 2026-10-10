import React from 'react';
import { X, Navigation, Zap, Swords } from 'lucide-react';
import { AthleteProfileData } from '../../services/socialService';

interface AthleteProfileModalProps {
  athlete: AthleteProfileData | null;
  onClose: () => void;
  onCheer: (athleteName: string) => void;
  onChallenge: (sector: string, commanderName: string) => void;
}

const getInitials = (name?: string) => {
  if (!name) return 'R';
  const clean = name.replace(/^@/, '').trim();
  const letters = clean.replace(/[^a-zA-Z]/g, '');
  if (!letters) return 'R';
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const p1 = parts[0].replace(/[^a-zA-Z]/g, '')[0];
    const p2 = parts[1].replace(/[^a-zA-Z]/g, '')[0];
    if (p1 && p2) return `${p1}${p2}`.toUpperCase();
  }
  return letters[0].toUpperCase();
};

export const AthleteProfileModal: React.FC<AthleteProfileModalProps> = ({
  athlete,
  onClose,
  onCheer,
  onChallenge,
}) => {
  if (!athlete) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4 select-none animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#0f0f1a] text-slate-900 dark:text-white border-t sm:border border-slate-200 dark:border-white/10 rounded-t-[32px] sm:rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 max-h-[90dvh] overflow-y-auto animate-slide-up">
        {/* Grab Handle */}
        <div className="flex flex-col items-center sm:hidden -mt-1 pb-1 cursor-grab">
          <div className="w-12 h-1 rounded-full bg-slate-300 dark:bg-white/20" />
        </div>

        {/* Profile Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            {athlete.userAvatar ? (
              <img
                src={athlete.userAvatar}
                alt={athlete.userName}
                className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500 shadow-md"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-2xl flex items-center justify-center border-2 border-emerald-500 shadow-md">
                {getInitials(athlete.userName)}
              </div>
            )}
            <div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-1.5">
                {athlete.userName}
                {athlete.isCurrentUser && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    You
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {athlete.userBadge}
                </span>
                <span className="text-xs text-amber-500 font-semibold">
                  🔥 {athlete.streakDays}d Streak
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Essential Stats */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.06] text-center">
          <div>
            <div className="text-base font-black font-mono text-slate-900 dark:text-white">
              {athlete.totalDistanceKm}
            </div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Km</div>
          </div>
          <div>
            <div className="text-base font-black font-mono text-slate-900 dark:text-white">
              {athlete.totalRuns}
            </div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Runs</div>
          </div>
          <div>
            <div className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
              {athlete.avgPace}
            </div>
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Avg Pace</div>
          </div>
        </div>

        {/* Recent Activities (only shown if athlete has recorded runs) */}
        {athlete.recentActivities && athlete.recentActivities.length > 0 && (
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Navigation size={13} className="text-emerald-500" />
              <span>Recent War Runs</span>
            </div>
            <div className="space-y-1.5">
              {athlete.recentActivities.map((act) => (
                <div
                  key={act.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.05] text-xs"
                >
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{act.title}</div>
                    <div className="text-[10px] text-slate-400">{act.date} • {act.time}</div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="font-bold text-slate-900 dark:text-white">{act.distanceKm} km</div>
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400">{act.pace}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="pt-2">
          {athlete.isCurrentUser ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-800 dark:text-white text-xs font-bold transition-all cursor-pointer"
            >
              Close
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onCheer(athlete.userName)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Zap size={14} />
                <span>Cheer Athlete</span>
              </button>
              <button
                type="button"
                onClick={() => onChallenge('Central Sector Loop', athlete.userName)}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold hover:opacity-90 transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5"
              >
                <Swords size={14} />
                <span>Challenge Zone</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
