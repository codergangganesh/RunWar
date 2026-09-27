import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Flame,
  MessageSquare,
  Share2,
  MapPin,
  Clock,
  Timer,
  Zap,
  Mountain,
  Calendar,
  Send,
  Sparkles,
  AlertCircle,
  Shield,
  Trophy,
  LogIn,
  Copy,
  Check,
  Map as MapIcon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { FeedPost, ReactionType, socialService } from '../services/socialService';
import { UserProfile, Workout } from '../types';
import { formatDistance, formatDuration, formatPace } from '../utils/formatters';
import { formatLocalTime } from '../utils/dateUtils';

interface PostDetailScreenProps {
  postId?: string | null;
  initialPost?: FeedPost | null;
  profile?: UserProfile | null;
  onBack: () => void;
  onOpenProfile?: (athlete: { userId?: string; userName?: string; userAvatar?: string; userBadge?: string }) => void;
  onSelectWorkout?: (workout: Workout) => void;
  onOpenAuth?: () => void;
}

export const PostDetailScreen: React.FC<PostDetailScreenProps> = ({
  postId,
  initialPost,
  profile,
  onBack,
  onOpenProfile,
  onSelectWorkout,
  onOpenAuth,
}) => {
  const [post, setPost] = useState<FeedPost | null>(initialPost || null);
  const [isLoading, setIsLoading] = useState<boolean>(!initialPost && Boolean(postId));
  const [error, setError] = useState<string | null>(null);

  const [commentInput, setCommentInput] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showSplits, setShowSplits] = useState(true);
  const [showMap, setShowMap] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Sync post when postId changes or on mount
  useEffect(() => {
    let isMounted = true;
    if (!postId && !initialPost) {
      setError('No workout specified');
      setIsLoading(false);
      return;
    }

    const fetchPost = async () => {
      const targetId = postId || initialPost?.id;
      if (!targetId) return;

      if (!initialPost) {
        setIsLoading(true);
      }
      try {
        const resolved = await socialService.getPostById(targetId, profile);
        if (isMounted) {
          if (resolved) {
            setPost(resolved);
            setError(null);
          } else if (!initialPost) {
            setError('Workout not found or may have been deleted.');
          }
        }
      } catch (err: any) {
        if (isMounted && !initialPost) {
          setError(err?.message || 'Failed to load workout details.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchPost();
    return () => {
      isMounted = false;
    };
  }, [postId, initialPost?.id, profile?.user_id]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Multi-Reaction Handler with Self-Interaction & Guest Guard
  const handleReaction = async (reactionType: ReactionType) => {
    if (!post) return;

    if (!profile) {
      setShowAuthModal(true);
      return;
    }

    if (socialService.isPostAuthor(post, profile)) {
      showToast('Athletes cannot react to their own workouts.');
      return;
    }

    // Optimistic toggle
    const currentReactions = post.reactions || { fire: 0, respect: 0, beast: 0, salute: 0 };
    const isCurrentActive = post.userReaction === reactionType;
    let nextReaction: ReactionType | null = null;
    const nextCounts = { ...currentReactions };

    if (isCurrentActive) {
      nextCounts[reactionType] = Math.max(0, (nextCounts[reactionType] || 1) - 1);
      nextReaction = null;
    } else {
      if (post.userReaction) {
        nextCounts[post.userReaction] = Math.max(0, (nextCounts[post.userReaction] || 1) - 1);
      }
      nextCounts[reactionType] = (nextCounts[reactionType] || 0) + 1;
      nextReaction = reactionType;
    }

    const total = Object.values(nextCounts).reduce((a, b) => a + b, 0);

    setPost({
      ...post,
      reactions: nextCounts,
      userReaction: nextReaction,
      fireUpsCount: total,
      hasFiredUp: nextReaction !== null,
    });

    try {
      const updatedPosts = await socialService.toggleReaction(post.id, reactionType, profile);
      const updated = updatedPosts.find((p) => p.id === post.id);
      if (updated) setPost(updated);
    } catch {
      // Revert if failed
      setPost(post);
      showToast('Could not save reaction. Please try again.');
    }
  };

  // Add Comment Handler
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!post || !commentInput.trim()) return;

    if (!profile) {
      setShowAuthModal(true);
      return;
    }

    setIsSubmittingComment(true);
    try {
      const updatedPosts = await socialService.addComment(post.id, commentInput.trim(), profile);
      const updated = updatedPosts.find((p) => p.id === post.id);
      if (updated) {
        setPost(updated);
        setCommentInput('');
        showToast('Comment posted!');
      }
    } catch {
      showToast('Failed to post comment. Please try again.');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Render text with clickable @mentions
  const renderWithMentions = (text?: string) => {
    if (!text) return null;
    const parts = text.split(/(@[\w\d_]+)/g);
    return parts.map((part, index) => {
      if (part.startsWith('@')) {
        const username = part.slice(1);
        return (
          <button
            key={index}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenProfile) onOpenProfile({ userName: username });
            }}
            className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline bg-emerald-500/10 px-1 py-0.5 rounded cursor-pointer transition-colors"
          >
            {part}
          </button>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col p-4 animate-pulse space-y-4 max-w-xl mx-auto">
        <div className="h-12 bg-slate-200 dark:bg-slate-900 rounded-2xl w-full" />
        <div className="h-44 bg-slate-200 dark:bg-slate-900 rounded-3xl w-full" />
        <div className="h-64 bg-slate-200 dark:bg-slate-900 rounded-3xl w-full" />
        <div className="h-32 bg-slate-200 dark:bg-slate-900 rounded-3xl w-full" />
      </div>
    );
  }

  // Error / Not Found view
  if (error || !post) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="font-display text-xl font-black text-slate-900 dark:text-white">
          Workout Not Found
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xs leading-relaxed">
          {error || 'This workout link may have expired or been removed by the athlete.'}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-6 px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-md shadow-emerald-500/25 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span>Return to War Zone</span>
        </button>
      </div>
    );
  }

  const distanceKm = post.workout?.distance_meters ? (post.workout.distance_meters / 1000).toFixed(2) : '0.00';
  const paceUnit = profile?.pace_unit || 'min_km';
  const distUnit = profile?.distance_unit || 'km';
  const formattedPace = formatPace(post.workout?.average_pace || 360, paceUnit);
  const formattedDuration = formatDuration(post.workout?.duration_seconds || 1800);
  const calories = post.workout?.calories || 0;
  const elevation = post.workout?.elevation_gain || 0;
  const routeCoords = post.workout?.route_coordinates || [];
  const hasRoute = routeCoords.length >= 2;
  const hasSplits = Boolean(post.splits && post.splits.length > 0);
  const workoutType = post.workout?.type || 'run';

  const reactions = post.reactions || {
    fire: post.fireUpsCount || 0,
    respect: 0,
    beast: 0,
    salute: 0,
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col justify-between pb-12 transition-colors">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[150] px-4 py-2.5 rounded-2xl bg-slate-900/90 dark:bg-white/90 text-white dark:text-slate-900 text-xs font-bold shadow-xl backdrop-blur-md animate-fade-in border border-white/10 flex items-center gap-2">
          <Sparkles size={14} className="text-emerald-400 dark:text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="w-full max-w-xl mx-auto flex-1 flex flex-col">
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 px-4 py-3 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onBack}
              className="w-9 h-9 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center cursor-pointer shadow-xs"
              aria-label="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="RunWar"
                className="w-7 h-7 rounded-full object-contain bg-white dark:bg-slate-900 border border-emerald-300 dark:border-slate-700"
              />
              <div>
                <h1 className="font-display text-sm font-black tracking-tight text-slate-950 dark:text-white leading-none">
                  RUN<span className="text-emerald-500">WAR</span>
                </h1>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  Workout Card
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Share Button (Direct Copy) */}
            <button
              type="button"
              onClick={async () => {
                if (post) {
                  const details = socialService.getPostShareDetails(post);
                  let copied = false;
                  if (navigator.clipboard && navigator.clipboard.writeText) {
                    try {
                      await navigator.clipboard.writeText(details.url);
                      copied = true;
                    } catch {}
                  }
                  if (!copied && typeof document !== 'undefined') {
                    try {
                      const textarea = document.createElement('textarea');
                      textarea.value = details.url;
                      textarea.style.position = 'fixed';
                      textarea.style.opacity = '0';
                      document.body.appendChild(textarea);
                      textarea.select();
                      document.execCommand('copy');
                      document.body.removeChild(textarea);
                    } catch {}
                  }
                  showToast('Link copied to clipboard! 📋');
                }
              }}
              className="h-8 px-3 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1.5 border border-emerald-500/20 active:scale-95 transition-all cursor-pointer"
              title="Copy Workout Link"
            >
              <Share2 size={13} />
              <span>Copy Link</span>
            </button>

            {/* If unauthenticated visitor: Sign In / Join button */}
            {!profile && onOpenAuth && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="h-8 px-3 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs flex items-center gap-1.5 shadow-sm shadow-emerald-500/30 active:scale-95 transition-all cursor-pointer"
              >
                <LogIn size={13} />
                <span>Join RunWar</span>
              </button>
            )}
          </div>
        </header>

        {/* Content Body */}
        <main className="p-3.5 sm:p-4 space-y-3.5 animate-fade-in flex-1">
          {/* Athlete Profile & Sector Banner */}
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3">
            <div
              onClick={() => onOpenProfile && onOpenProfile({
                userId: post.userId,
                userName: post.userName,
                userAvatar: post.userAvatar,
                userBadge: post.userBadge,
              })}
              className="flex items-center gap-3 cursor-pointer group min-w-0"
            >
              <div className="w-12 h-12 rounded-2xl overflow-hidden bg-emerald-100 dark:bg-slate-800 border-2 border-emerald-400 dark:border-emerald-500/40 shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                {post.userAvatar ? (
                  <img src={post.userAvatar} alt={post.userName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-black text-sm text-emerald-800 dark:text-emerald-300">
                    {post.userName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-black text-sm sm:text-base text-slate-950 dark:text-white truncate group-hover:text-emerald-500 transition-colors">
                    {post.userName}
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                    {post.userBadge || 'Athlete'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} className="text-emerald-500" />
                    {formatLocalTime(post.createdAt)}
                  </span>
                  {post.locationName && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-0.5 truncate">
                        <MapPin size={11} className="text-emerald-500 shrink-0" />
                        <span className="truncate">{post.locationName}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Territory Capture Badge */}
            {post.isTerritoryCapture && post.territoryClaimed && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-black shrink-0">
                <Trophy size={14} className="text-amber-500 shrink-0" />
                <span className="hidden sm:inline">Territory Captured</span>
              </div>
            )}
          </div>

          {/* Workout Performance Hero Card */}
          <div
            onClick={() => onSelectWorkout && post.workout && onSelectWorkout(post.workout)}
            className="rounded-3xl bg-gradient-to-br from-white via-white to-emerald-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20 border border-emerald-200/70 dark:border-emerald-500/30 p-5 shadow-md space-y-4 hover:border-emerald-400 dark:hover:border-emerald-500/50 transition-all cursor-pointer"
          >
            {/* Card Header */}
            <div className="flex items-center justify-between border-b border-emerald-100 dark:border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {workoutType === 'run' ? '🏃' : workoutType === 'jog' ? '🚶' : '🚶‍♂️'}
                </span>
                <span className="font-display font-black text-sm uppercase tracking-wide text-slate-900 dark:text-white">
                  {post.workout?.title || `${workoutType.toUpperCase()} WORKOUT`}
                </span>
              </div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                COMPLETED
              </span>
            </div>

            {/* Large Hero Metric: Distance */}
            <div className="text-center py-1">
              <div className="text-[11px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                Total Distance
              </div>
              <div className="font-display font-black text-5xl sm:text-6xl text-slate-950 dark:text-white tracking-tight leading-none mt-1">
                {distanceKm}
                <span className="text-xl sm:text-2xl font-bold text-emerald-500 ml-1.5 uppercase">
                  {distUnit}
                </span>
              </div>
            </div>

            {/* Tri-Metric Grid */}
            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-emerald-100 dark:border-white/[0.08] text-center">
              {/* Pace */}
              <div className="p-2.5 rounded-2xl bg-emerald-50/60 dark:bg-slate-950/60 border border-emerald-100 dark:border-slate-800/80">
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                  <Clock size={12} className="text-emerald-500" />
                  <span>Avg Pace</span>
                </div>
                <div className="font-mono font-black text-base sm:text-lg text-slate-900 dark:text-white mt-0.5">
                  {formattedPace}
                </div>
                <div className="text-[9px] text-slate-400 font-medium">/{distUnit}</div>
              </div>

              {/* Time */}
              <div className="p-2.5 rounded-2xl bg-emerald-50/60 dark:bg-slate-950/60 border border-emerald-100 dark:border-slate-800/80">
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                  <Timer size={12} className="text-emerald-500" />
                  <span>Time</span>
                </div>
                <div className="font-mono font-black text-base sm:text-lg text-slate-900 dark:text-white mt-0.5">
                  {formattedDuration}
                </div>
                <div className="text-[9px] text-slate-400 font-medium">duration</div>
              </div>

              {/* Calories */}
              <div className="p-2.5 rounded-2xl bg-emerald-50/60 dark:bg-slate-950/60 border border-emerald-100 dark:border-slate-800/80">
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                  <Zap size={12} className="text-amber-500" />
                  <span>Burned</span>
                </div>
                <div className="font-mono font-black text-base sm:text-lg text-amber-500 mt-0.5">
                  {calories}
                </div>
                <div className="text-[9px] text-slate-400 font-medium">kcal</div>
              </div>
            </div>

            {elevation > 0 && (
              <div className="flex items-center justify-center gap-1 text-xs text-slate-500 dark:text-slate-400 pt-1">
                <Mountain size={13} className="text-emerald-500" />
                <span>Elevation Gain:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">+{elevation}m</span>
              </div>
            )}
          </div>

          {/* Photo Attachment with Stats Stamp */}
          {post.photoUrl && (
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md group">
              <img
                src={post.photoUrl}
                alt="Workout activity"
                className="w-full max-h-96 object-cover group-hover:scale-[1.01] transition-transform duration-500"
              />
              {post.hasPhotoStatsOverlay && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4 sm:p-5 text-white">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                        RUNWAR STATS STAMP
                      </div>
                      <div className="text-3xl font-black font-mono tracking-tight text-white drop-shadow-md">
                        {distanceKm} <span className="text-base font-bold">KM</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <div className="text-[10px] uppercase font-semibold text-white/70">PACE</div>
                        <div className="font-mono font-bold text-sm text-white">{formattedPace}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-semibold text-white/70">TIME</div>
                        <div className="font-mono font-bold text-sm text-white">{formattedDuration}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Route Map Preview */}
          {hasRoute && (
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <MapIcon size={14} />
                  </div>
                  <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    GPS Route Track
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMap(!showMap)}
                  className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5 hover:underline"
                >
                  <span>{showMap ? 'Hide' : 'Show'}</span>
                  {showMap ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {showMap && (
                <div className="rounded-2xl overflow-hidden bg-slate-950 p-2 border border-slate-800 relative">
                  {/* Custom Route SVG Canvas */}
                  {(() => {
                    const lats = routeCoords.map((c: any) => Number(c.latitude || c.lat || 0)).filter((n) => !isNaN(n) && n !== 0);
                    const lngs = routeCoords.map((c: any) => Number(c.longitude || c.lng || c.lon || 0)).filter((n) => !isNaN(n) && n !== 0);

                    if (lats.length < 2 || lngs.length < 2) return null;

                    const minLat = Math.min(...lats);
                    const maxLat = Math.max(...lats);
                    const minLng = Math.min(...lngs);
                    const maxLng = Math.max(...lngs);

                    const latSpan = Math.max(0.0008, maxLat - minLat);
                    const lngSpan = Math.max(0.0008, maxLng - minLng);

                    const pad = 24;
                    const w = 360 - pad * 2;
                    const h = 180 - pad * 2;

                    const points = routeCoords.map((c: any) => {
                      const lat = Number(c.latitude || c.lat || 0);
                      const lng = Number(c.longitude || c.lng || 0);
                      const x = pad + ((lng - minLng) / lngSpan) * w;
                      const y = pad + (1 - (lat - minLat) / latSpan) * h;
                      return [x, y] as [number, number];
                    });

                    const pathStr = points.map(([x, y], idx) => `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
                    const start = points[0];
                    const end = points[points.length - 1];

                    return (
                      <svg viewBox="0 0 360 180" className="w-full h-44 sm:h-52 drop-shadow-md">
                        {/* Route Shadow / Glow */}
                        <path
                          d={pathStr}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          opacity="0.3"
                        />
                        {/* Route Polyline */}
                        <path
                          d={pathStr}
                          fill="none"
                          stroke="#00d09c"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {/* Start Pin (Green) */}
                        {start && (
                          <circle cx={start[0]} cy={start[1]} r="5" fill="#22c55e" stroke="#ffffff" strokeWidth="2" />
                        )}
                        {/* End Pin (Red) */}
                        {end && (
                          <circle cx={end[0]} cy={end[1]} r="5.5" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
                        )}
                      </svg>
                    );
                  })()}

                  <div className="absolute bottom-3 left-3 flex items-center gap-2 text-[10px] text-white/80 font-mono bg-slate-900/80 px-2 py-1 rounded-lg backdrop-blur-xs">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Start
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Finish
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Caption with Clickable Mentions */}
          {post.caption && (
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Notes / Caption
              </span>
              <p className="text-sm sm:text-base text-slate-900 dark:text-white font-medium leading-relaxed">
                {renderWithMentions(post.caption)}
              </p>
            </div>
          )}

          {/* KM Splits Table */}
          {hasSplits && (
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Splits Breakdown ({post.splits?.length} km)
                </span>
                <button
                  type="button"
                  onClick={() => setShowSplits(!showSplits)}
                  className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5 hover:underline"
                >
                  <span>{showSplits ? 'Collapse' : 'Expand'}</span>
                  {showSplits ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {showSplits && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80 pt-1">
                  {post.splits?.map((split) => (
                    <div key={split.km} className="flex items-center justify-between py-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold flex items-center justify-center text-[11px]">
                          {split.km}
                        </span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          Kilometer {split.km}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {split.elevation_diff !== undefined && (
                          <span className="text-[11px] font-mono text-slate-400">
                            {split.elevation_diff >= 0 ? `+${split.elevation_diff}m` : `${split.elevation_diff}m`}
                          </span>
                        )}
                        <span className="font-mono font-black text-slate-900 dark:text-white">
                          {split.pace} /km
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Social Multi-Reactions Bar */}
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold px-0.5">
              <span>Community Kudos ({post.fireUpsCount})</span>
              <span>{post.commentsCount} {post.commentsCount === 1 ? 'Comment' : 'Comments'}</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {/* Fire Up 🔥 */}
              <button
                type="button"
                onClick={() => handleReaction('fire')}
                className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl border text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                  post.userReaction === 'fire'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-950/20'
                }`}
              >
                <span className="text-xl">🔥</span>
                <span className="text-[10px] mt-1">Fire Up</span>
                <span className="font-mono text-[11px] font-black">{reactions.fire}</span>
              </button>

              {/* Respect ⚡ */}
              <button
                type="button"
                onClick={() => handleReaction('respect')}
                className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl border text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                  post.userReaction === 'respect'
                    ? 'bg-blue-500/20 border-blue-500 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/20'
                }`}
              >
                <span className="text-xl">⚡</span>
                <span className="text-[10px] mt-1">Respect</span>
                <span className="font-mono text-[11px] font-black">{reactions.respect}</span>
              </button>

              {/* Beast 🐺 */}
              <button
                type="button"
                onClick={() => handleReaction('beast')}
                className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl border text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                  post.userReaction === 'beast'
                    ? 'bg-purple-500/20 border-purple-500 text-purple-600 dark:text-purple-400 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-950/20'
                }`}
              >
                <span className="text-xl">🐺</span>
                <span className="text-[10px] mt-1">Beast</span>
                <span className="font-mono text-[11px] font-black">{reactions.beast}</span>
              </button>

              {/* Salute 🫡 */}
              <button
                type="button"
                onClick={() => handleReaction('salute')}
                className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl border text-xs font-bold transition-all cursor-pointer active:scale-95 ${
                  post.userReaction === 'salute'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20'
                }`}
              >
                <span className="text-xl">🫡</span>
                <span className="text-[10px] mt-1">Salute</span>
                <span className="font-mono text-[11px] font-black">{reactions.salute}</span>
              </button>
            </div>
          </div>

          {/* Comments Thread Section */}
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-3.5">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} className="text-emerald-500" />
              <h3 className="font-display font-black text-xs uppercase tracking-wider text-slate-900 dark:text-white">
                Comments ({post.comments?.length || 0})
              </h3>
            </div>

            {/* Comments List */}
            {post.comments && post.comments.length > 0 ? (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {post.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/60 dark:border-slate-800/60 flex items-start gap-2.5"
                  >
                    <div
                      onClick={() => onOpenProfile && onOpenProfile({
                        userId: comment.userId,
                        userName: comment.userName,
                        userAvatar: comment.userAvatar,
                      })}
                      className="w-8 h-8 rounded-full overflow-hidden bg-emerald-100 dark:bg-slate-800 border border-emerald-300 dark:border-slate-700 shrink-0 cursor-pointer"
                    >
                      {comment.userAvatar ? (
                        <img src={comment.userAvatar} alt={comment.userName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-xs text-emerald-800 dark:text-emerald-300">
                          {comment.userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          onClick={() => onOpenProfile && onOpenProfile({
                            userId: comment.userId,
                            userName: comment.userName,
                            userAvatar: comment.userAvatar,
                          })}
                          className="font-bold text-xs text-slate-900 dark:text-white hover:text-emerald-500 cursor-pointer"
                        >
                          {comment.userName}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatLocalTime(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">
                        {renderWithMentions(comment.text)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                No cheers or comments yet. Be the first to congratulate {post.userName}!
              </div>
            )}

            {/* Comment Input */}
            {profile ? (
              <form onSubmit={handleAddComment} className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  placeholder={`Cheer on ${post.userName}...`}
                  className="flex-1 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-emerald-500 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!commentInput.trim() || isSubmittingComment}
                  className="h-9 px-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
                >
                  <Send size={13} />
                  <span>Send</span>
                </button>
              </form>
            ) : (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setShowAuthModal(true)}
                  className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-dashed border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <LogIn size={14} />
                  <span>Sign in to cheer on {post.userName}</span>
                </button>
              </div>
            )}
          </div>

          {/* Viral Conversion Bottom Banner for Visitors */}
          {!profile && (
            <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white shadow-xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-200">
                <Sparkles size={16} />
                <span>Track Your Own Runs On RunWar</span>
              </div>
              <h3 className="font-display font-black text-lg sm:text-xl leading-tight text-white">
                Ready to conquer territory and challenge runners worldwide?
              </h3>
              <p className="text-xs text-emerald-100/90 leading-relaxed">
                RunWar offers precision GPS route tracking, live Rival Ghost pacing, voice coaching, and global athlete leaderboards.
              </p>
              {onOpenAuth && (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="w-full py-3 rounded-2xl bg-white text-emerald-950 font-black text-xs uppercase tracking-wider shadow-lg hover:bg-emerald-50 active:scale-98 transition-all cursor-pointer"
                >
                  Get Started Free
                </button>
              )}
            </div>
          )}
        </main>
      </div>



      {/* Guest Auth Prompt Modal */}
      {showAuthModal && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAuthModal(false);
          }}
        >
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-4 animate-scale-up">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <Shield size={24} />
            </div>
            <div>
              <h3 className="font-display font-black text-base text-slate-950 dark:text-white">
                Join the War Zone
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Sign in or create a free account to react, comment on workouts, and track your own runs!
              </p>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => {
                  setShowAuthModal(false);
                  if (onOpenAuth) onOpenAuth();
                }}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs shadow-md shadow-emerald-500/25 active:scale-95 transition-all cursor-pointer"
              >
                Sign In / Create Account
              </button>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="w-full py-2 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 font-semibold text-xs transition-colors cursor-pointer"
              >
                Continue as Guest
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
