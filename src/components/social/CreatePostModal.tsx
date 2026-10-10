import React from 'react';
import {
  X,
  AlertTriangle,
  Navigation,
  CheckCircle2,
  Camera,
  Globe,
  Users,
  Lock,
  RefreshCw,
  Flame,
} from 'lucide-react';
import { Workout } from '../../types';

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  userWorkouts: Workout[];
  selectedWorkout: Workout | null;
  onSelectWorkout: (workout: Workout | null) => void;
  caption: string;
  onCaptionChange: (caption: string) => void;
  photoUrl: string;
  onPhotoUrlChange: (url: string) => void;
  burnStats: boolean;
  onBurnStatsChange: (burn: boolean) => void;
  visibility: 'public' | 'friends' | 'private';
  onVisibilityChange: (visibility: 'public' | 'friends' | 'private') => void;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: () => void;
  getWorkoutMetrics: (w: any) => any;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  onClose,
  userWorkouts,
  selectedWorkout,
  onSelectWorkout,
  caption,
  onCaptionChange,
  photoUrl,
  onPhotoUrlChange,
  burnStats,
  onBurnStatsChange,
  visibility,
  onVisibilityChange,
  isSubmitting,
  error,
  onSubmit,
  getWorkoutMetrics,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-end justify-center select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-[#0f0f1a] text-slate-900 dark:text-white border-t border-x border-slate-200 dark:border-white/10 rounded-t-[32px] sm:rounded-t-[36px] shadow-[0_-12px_45px_rgba(0,0,0,0.4)] dark:shadow-[0_-12px_50px_rgba(0,0,0,0.9)] flex flex-col max-h-[92dvh] animate-slide-up overflow-hidden">
        {/* Grab Handle */}
        <div className="flex flex-col items-center pt-3 pb-1 cursor-grab">
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-white/20 hover:bg-slate-400 dark:hover:bg-white/30 transition-colors" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 pt-2 pb-3.5 border-b border-slate-200/80 dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
              <Flame size={18} className="text-white fill-white" />
            </div>
            <div>
              <h2 className="text-slate-900 dark:text-white font-bold text-base sm:text-lg leading-tight">
                Create Post
              </h2>
              <p className="text-slate-500 dark:text-white/40 text-xs">
                Share your workout with the War Zone community
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 dark:text-white/50 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-5 sm:mx-6 mt-3 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4 no-scrollbar">
          {/* Select Workout to Attach */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Navigation size={13} className="text-emerald-500" />
                Attach Workout {selectedWorkout ? '(Selected)' : '(Optional)'}
              </label>
              {selectedWorkout && (
                <button
                  type="button"
                  onClick={() => onSelectWorkout(null)}
                  className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                >
                  Clear Selection
                </button>
              )}
            </div>

            <div className="max-h-40 overflow-y-auto space-y-2 pr-1 no-scrollbar">
              {userWorkouts.length === 0 ? (
                <div className="p-3.5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] text-center">
                  <p className="text-xs text-slate-500 dark:text-white/40">No recorded workouts yet</p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                    You can still share a general war cry or motivational update!
                  </p>
                </div>
              ) : (
                userWorkouts.slice(0, 10).map((w) => {
                  const m = getWorkoutMetrics(w);
                  const isSelected = selectedWorkout?.id === w.id;
                  return (
                    <div
                      key={w.id}
                      onClick={() => onSelectWorkout(isSelected ? null : w)}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between text-xs ${
                        isSelected
                          ? 'bg-emerald-500/15 border-emerald-500 text-slate-900 dark:text-white font-bold shadow-xs'
                          : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-bold text-slate-900 dark:text-white truncate">{m.title}</div>
                        <div className="text-[10px] text-slate-500 dark:text-white/40 mt-0.5 flex items-center gap-2">
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                            {m.distFormatted} km
                          </span>
                          <span>•</span>
                          <span>{m.durFormatted}</span>
                          <span>•</span>
                          <span>{m.paceFormatted} /km</span>
                        </div>
                      </div>
                      {isSelected ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                          <CheckCircle2 size={16} />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full border border-slate-300 dark:border-white/20 shrink-0" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* PHOTO ATTACHMENT WITH STATS OVERLAY OPTION */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5">
                <Camera size={13} className="text-emerald-500" />
                Attach Photo / Selfie:
              </span>
              {photoUrl && (
                <button
                  type="button"
                  onClick={() => onPhotoUrlChange('')}
                  className="text-[11px] text-red-500 hover:underline"
                >
                  Remove Photo
                </button>
              )}
            </label>

            {/* Preset Photo Selector */}
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[
                { label: 'Sunrise', url: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=800&q=80' },
                { label: 'Bay', url: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=800&q=80' },
                { label: 'Trail', url: 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?auto=format&fit=crop&w=800&q=80' },
                { label: 'Night', url: 'https://images.unsplash.com/photo-1513593771513-7b58b6c4af38?auto=format&fit=crop&w=800&q=80' },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onPhotoUrlChange(preset.url)}
                  className={`relative rounded-xl overflow-hidden h-14 border transition-all cursor-pointer ${
                    photoUrl === preset.url
                      ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                      : 'border-slate-200 dark:border-white/10 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-bold text-center py-0.5">
                    {preset.label}
                  </span>
                </button>
              ))}
            </div>

            {/* Burn Stats Overlay Toggle */}
            {photoUrl && (
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 cursor-pointer">
                <input
                  type="checkbox"
                  checked={burnStats}
                  onChange={(e) => onBurnStatsChange(e.target.checked)}
                  className="accent-emerald-500 w-4 h-4 rounded"
                />
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  🔥 Burn Stats Overlay on Photo (Distance, Pace & Watermark)
                </span>
              </label>
            )}
          </div>

          {/* Post Visibility Selector */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
              Post Audience:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onVisibilityChange('public')}
                className={`py-2 px-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                  visibility === 'public'
                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-500/25 ring-2 ring-emerald-500/20'
                    : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 hover:border-slate-300'
                }`}
              >
                <Globe size={14} /> Global
              </button>
              <button
                type="button"
                onClick={() => onVisibilityChange('friends')}
                className={`py-2 px-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                  visibility === 'friends'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/25 ring-2 ring-blue-500/20'
                    : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 hover:border-slate-300'
                }`}
              >
                <Users size={14} /> Squad
              </button>
              <button
                type="button"
                onClick={() => onVisibilityChange('private')}
                className={`py-2 px-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                  visibility === 'private'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm shadow-amber-500/25 ring-2 ring-amber-500/20'
                    : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 hover:border-slate-300'
                }`}
              >
                <Lock size={14} /> Private
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              {visibility === 'public' && '🌐 Visible to everyone across the global community feed & leaderboards.'}
              {visibility === 'friends' && '👥 Visible only to your squad members & friends in the Squad feed.'}
              {visibility === 'private' && '🔒 Private to you only. Hidden from all other community feeds.'}
            </p>
          </div>

          {/* Caption / War Cry with quick @mention chips */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
              War Cry / Caption:
            </label>
            <textarea
              value={caption}
              onChange={(e) => onCaptionChange(e.target.value)}
              placeholder={
                selectedWorkout
                  ? 'What did you conquer today? Tag squad runners with @AlexRivers...'
                  : 'Write your message, goals, or motivation...'
              }
              rows={3}
              className="w-full bg-slate-50 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 rounded-2xl p-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-emerald-500 resize-none transition-all"
            />

            {/* Quick Inspiration Chips */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[
                '🔥 Crushed it!',
                '⚡ New Personal Best',
                '🏃 Early Morning Run',
                '🌧️ Rain or Shine',
                '@AlexRivers',
                '@SarahChen',
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => onCaptionChange(caption ? `${caption} ${chip}` : chip)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/30 transition-all font-medium cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Action Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-black/20 flex gap-3 pb-safe pb-5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting || (!selectedWorkout && !caption.trim() && !photoUrl)}
            onClick={onSubmit}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold disabled:opacity-50 hover:opacity-90 active:scale-[0.98] transition-all shadow-md shadow-emerald-500/25 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {isSubmitting ? (
              <RefreshCw size={15} className="animate-spin" />
            ) : (
              <>
                <Flame size={15} className="fill-white" />
                <span>Publish Post</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
