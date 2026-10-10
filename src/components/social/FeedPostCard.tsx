import React from 'react';
import {
  Swords,
  Check,
  Lock,
  Users,
  Globe,
  MapPin,
  MoreVertical,
  Edit2,
  Trash2,
  Flag,
  Download,
  Eye,
  Share2,
  Map,
  Calendar,
  Clock,
  Timer,
  ChevronUp,
  ChevronDown,
  MessageSquare,
  Send,
} from 'lucide-react';
import { FeedPost, ReactionType, socialService } from '../../services/socialService';
import { UserProfile, Workout } from '../../types';
import { gpxExporter } from '../../services/gpxExporter';
import { RouteThumbnail } from './RouteThumbnail';

interface FeedPostCardProps {
  post: FeedPost;
  profile: UserProfile | null;
  isCommentsExpanded: boolean;
  commentCount: number;
  commentInput: string;
  isMapExpanded: boolean;
  isSplitsExpanded: boolean;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onToggleComments: () => void;
  onToggleMap: () => void;
  onToggleSplits: () => void;
  onCommentInputChange: (text: string) => void;
  onReaction: (postId: string, reaction: ReactionType) => void;
  onAddComment: (postId: string) => void;
  onDeleteComment: (commentId: string, postId: string) => void;
  onSharePostClick: (post: FeedPost) => void;
  onOpenAthleteProfile: (target: any) => void;
  onOpenChallenge: (sector: string, commander: string) => void;
  onEditPost: (post: FeedPost) => void;
  onDeletePost: (postId: string) => void;
  onReportPost: (postId: string) => void;
  onSelectWorkout?: (workout: Workout) => void;
  onSelectPost?: (post: FeedPost) => void;
  formatDisplayName: (name?: string | null, userId?: string | null) => string;
  formatCommentTime: (isoString?: string) => string;
  renderWithMentions: (text?: string) => React.ReactNode;
  getWorkoutMetrics: (w: any) => any;
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

export const FeedPostCard: React.FC<FeedPostCardProps> = ({
  post,
  profile,
  isCommentsExpanded,
  commentCount,
  commentInput,
  isMapExpanded,
  isSplitsExpanded,
  isMenuOpen,
  onToggleMenu,
  onToggleComments,
  onToggleMap,
  onToggleSplits,
  onCommentInputChange,
  onReaction,
  onAddComment,
  onDeleteComment,
  onSharePostClick,
  onOpenAthleteProfile,
  onOpenChallenge,
  onEditPost,
  onDeletePost,
  onReportPost,
  onSelectWorkout,
  onSelectPost,
  formatDisplayName,
  formatCommentTime,
  renderWithMentions,
  getWorkoutMetrics,
}) => {
  const metrics = getWorkoutMetrics(post.workout);
  const isPostOwner = socialService.isPostAuthor(post, profile);
  const canReact = !isPostOwner;

  const workoutType = (post.workout?.type || 'jog').toLowerCase();
  const sessionTitle =
    post.workout?.title && !post.workout.title.toLowerCase().includes('workout')
      ? post.workout.title
      : `${workoutType.toUpperCase()} SESSION`;

  const formattedDate = new Date(metrics.startedAt || post.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const reactions: { type: ReactionType; icon: string; label: string; activeColor: string }[] = [
    { type: 'fire', icon: '🔥', label: 'Fire Up', activeColor: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 border-amber-300' },
    { type: 'respect', icon: '⚡', label: 'Respect', activeColor: 'bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-300 border-blue-300' },
    { type: 'beast', icon: '🐺', label: 'Beast', activeColor: 'bg-purple-100 text-purple-900 dark:bg-purple-500/20 dark:text-purple-300 border-purple-300' },
    { type: 'salute', icon: '🫡', label: 'Salute', activeColor: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-300' },
  ];

  return (
    <div
      className={`bg-white dark:bg-white/[0.04] rounded-[28px] p-5 sm:p-6 shadow-sm space-y-4 backdrop-blur-md transition-all ${
        post.isTerritoryCapture || post.territoryClaimed
          ? 'border-2 border-amber-500/40 shadow-amber-500/5'
          : 'border border-slate-100 dark:border-white/[0.08] hover:border-slate-200 dark:hover:border-white/15'
      }`}
    >
      {/* SECTOR CAPTURED TOP BANNER if Territory Claimed */}
      {post.territoryClaimed && (
        <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-emerald-500/15 border border-amber-500/40 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between gap-2 shadow-xs">
          <div className="min-w-0 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
              🛡️
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <span>SECTOR CAPTURED</span>
                <span>•</span>
                <span className="text-emerald-600 dark:text-emerald-400">SECURED</span>
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                {post.territoryClaimed}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChallenge(post.territoryClaimed || 'Central Sector Loop', post.userName)}
            className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shrink-0 flex items-center gap-1 shadow-sm transition-all cursor-pointer"
          >
            <Swords size={13} />
            <span>Contest Sector</span>
          </button>
        </div>
      )}

      {/* User Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3.5 min-w-0">
          {/* Interactive Avatar opening Athlete Profile */}
          <div
            onClick={() =>
              onOpenAthleteProfile({
                userId: post.userId,
                userName: post.userName,
                userAvatar: post.userAvatar,
                userBadge: post.userBadge,
              })
            }
            className="relative shrink-0 cursor-pointer group"
          >
            {post.userAvatar ? (
              <img
                src={post.userAvatar}
                alt={post.userName}
                className="w-12 h-12 rounded-full object-cover border-2 border-emerald-400 shrink-0 group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center border-2 border-emerald-400 text-white font-bold text-sm shrink-0 group-hover:scale-105 transition-transform shadow-xs">
                {getInitials(post.userName)}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center">
              <Check size={9} className="text-white stroke-[3]" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 min-w-0">
              {/* Interactive Name */}
              <div
                onClick={() =>
                  onOpenAthleteProfile({
                    userId: post.userId,
                    userName: post.userName,
                    userAvatar: post.userAvatar,
                    userBadge: post.userBadge,
                  })
                }
                className="flex items-center gap-1.5 min-w-0 shrink-0 cursor-pointer group"
              >
                <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate group-hover:text-emerald-500 transition-colors">
                  {formatDisplayName(post.userName, post.userId)}
                </span>
              </div>

              <span className="hidden sm:inline text-slate-400 shrink-0">•</span>

              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-slate-500 dark:text-white/40 whitespace-nowrap overflow-x-auto no-scrollbar">
                {/* Audience Pill Badge */}
                {post.visibility === 'private' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
                    <Lock size={10} /> Private
                  </span>
                ) : post.visibility === 'friends' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 shrink-0">
                    <Users size={10} /> Squad
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0">
                    <Globe size={10} /> Global
                  </span>
                )}

                <span
                  className={`flex items-center gap-1 font-semibold shrink-0 ${
                    post.visibility === 'private'
                      ? 'text-amber-600 dark:text-amber-400'
                      : post.visibility === 'friends'
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  <MapPin size={12} className="shrink-0" />
                  {post.visibility === 'private'
                    ? 'Private Sector'
                    : post.visibility === 'friends'
                      ? 'Squad Sector'
                      : post.locationName && post.locationName !== 'Private Sector' && post.locationName !== 'Squad Sector'
                        ? post.locationName
                        : 'Global Sector'}
                </span>

                <span className="shrink-0 text-slate-700 dark:text-slate-300 font-medium">
                  {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3-Dots Options Button */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={onToggleMenu}
            title="Options"
            className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all cursor-pointer"
          >
            <MoreVertical size={18} />
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl z-20 py-1.5 text-xs font-semibold">
              {isPostOwner ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onEditPost(post);
                    }}
                    className="w-full px-3.5 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-800 dark:text-white cursor-pointer"
                  >
                    <Edit2 size={14} className="text-emerald-500" /> Edit Post
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDeletePost(post.id);
                    }}
                    className="w-full px-3.5 py-2 text-left flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 cursor-pointer"
                  >
                    <Trash2 size={14} className="text-red-500" /> Delete Post
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onReportPost(post.id);
                  }}
                  className="w-full px-3.5 py-2 text-left flex items-center gap-2 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-700 dark:text-amber-300 cursor-pointer"
                >
                  <Flag size={14} className="text-amber-500" /> Report Post
                </button>
              )}

              <div className="my-1 border-t border-slate-100 dark:border-white/[0.06]" />

              <button
                type="button"
                onClick={() => {
                  gpxExporter.downloadGPX(post.workout);
                  onToggleMenu();
                }}
                className="w-full px-3.5 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-800 dark:text-white cursor-pointer"
              >
                <Download size={14} className="text-emerald-600" /> Export GPX File
              </button>
              <button
                type="button"
                onClick={() => {
                  onToggleMenu();
                  if (onSelectPost) onSelectPost(post);
                }}
                className="w-full px-3.5 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer"
              >
                <Eye size={15} strokeWidth={2.2} className="text-emerald-600 dark:text-[#00d09c]" />
                <span className="font-bold text-black dark:text-white">View Sharable Card</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onSharePostClick(post);
                  onToggleMenu();
                }}
                className="w-full px-3.5 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-800 dark:text-white cursor-pointer"
              >
                <Share2 size={14} className="text-blue-600" /> Share Link
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Post Caption with Clickable @mentions */}
      {post.caption && (
        <p className="text-sm sm:text-base text-slate-900 dark:text-white font-medium leading-relaxed my-0.5">
          {renderWithMentions(post.caption)}
        </p>
      )}

      {/* PHOTO ATTACHMENT WITH STATS OVERLAY + MAP ICON */}
      {post.photoUrl && (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 group shadow-md">
          <img
            src={post.photoUrl}
            alt="Run selfie"
            className="w-full h-56 sm:h-64 object-cover group-hover:scale-[1.02] transition-transform duration-500"
          />
          {post.hasPhotoStatsOverlay && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/90 to-transparent p-3.5 sm:p-4 text-white">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 drop-shadow-sm">
                      RUNWAR STATS STAMP
                    </span>
                  </div>
                  <div
                    className="text-2xl sm:text-3xl font-black font-mono tracking-tight leading-none text-white drop-shadow-lg stats-overlay-white"
                    style={{ color: '#ffffff' }}
                  >
                    {metrics.distFormatted}{' '}
                    <span className="text-sm font-bold text-white drop-shadow-sm stats-overlay-white" style={{ color: '#ffffff' }}>
                      KM
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white font-semibold drop-shadow-sm stats-overlay-white" style={{ color: '#ffffff' }}>
                      Pace
                    </div>
                    <div className="text-xs sm:text-sm font-black font-mono text-white drop-shadow-md stats-overlay-white" style={{ color: '#ffffff' }}>
                      {metrics.paceFormatted} /km
                    </div>
                  </div>
                  <div className="w-px h-6 bg-white/40" />
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-white font-semibold drop-shadow-sm stats-overlay-white" style={{ color: '#ffffff' }}>
                      Duration
                    </div>
                    <div className="text-xs sm:text-sm font-black font-mono text-white drop-shadow-md stats-overlay-white" style={{ color: '#ffffff' }}>
                      {metrics.durFormatted}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Map Toggle Icon inside Photo (top-right) */}
          {post.workout?.route_coordinates && post.workout.route_coordinates.length >= 2 && (
            <button
              type="button"
              onClick={onToggleMap}
              className={`absolute top-2.5 right-2.5 p-2 rounded-xl border backdrop-blur-md transition-all cursor-pointer z-10 ${
                isMapExpanded
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-md'
                  : 'bg-black/50 border-white/20 text-white/90 hover:bg-black/70'
              }`}
              title={isMapExpanded ? 'Hide Route Map' : 'View Route Map'}
              aria-label="Toggle route map"
            >
              <Map size={16} />
            </button>
          )}
        </div>
      )}

      {/* ROUTE MAP: Hidden by default, toggled via map icon */}
      {isMapExpanded && (
        <div className="animate-fade-in">
          <RouteThumbnail
            coordinates={post.workout?.route_coordinates}
            distanceKm={metrics.distMeters / 1000}
          />
        </div>
      )}

      {/* Workout Performance Card — ONLY when NO photo is attached */}
      {!post.photoUrl && (
        <>
          {post.workout?.route_coordinates && post.workout.route_coordinates.length >= 2 && (
            <div className="flex justify-end -mb-1">
              <button
                type="button"
                onClick={onToggleMap}
                className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                  isMapExpanded
                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                    : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10'
                }`}
                title={isMapExpanded ? 'Hide Route Map' : 'View Route Map'}
                aria-label="Toggle route map"
              >
                <Map size={16} />
              </button>
            </div>
          )}

          <div
            onClick={() => {
              if (onSelectPost) onSelectPost(post);
              else if (onSelectWorkout && post.workout) onSelectWorkout(post.workout);
            }}
            className="bg-[#f2faf7] dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-500/20 rounded-2xl p-4 sm:p-5 space-y-3.5 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-500/40 transition-all"
          >
            {/* Inner Header: Type & Date */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-800 dark:text-emerald-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="17" cy="4" r="2" />
                  <path d="M15 8l-3 4-3-2-4 3" />
                  <path d="M12 12l2 4 4 1" />
                  <path d="M9 14l-2 5" />
                </svg>
                <span className="text-xs sm:text-sm font-black tracking-wide text-emerald-900 dark:text-emerald-200 uppercase">
                  {sessionTitle}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                <Calendar size={14} className="text-emerald-800 dark:text-emerald-400 shrink-0" />
                <span>{formattedDate}</span>
              </div>
            </div>

            {/* Main Metrics Grid */}
            <div className="grid grid-cols-3 divide-x divide-emerald-200/60 dark:divide-white/[0.08] pt-3.5 border-t border-emerald-200/50 dark:border-white/[0.06]">
              {/* Metric 1: Distance */}
              <div className="flex items-center gap-2 sm:gap-3 justify-center sm:justify-start px-1 sm:px-3">
                <MapPin size={17} />
                <div>
                  <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight">
                    {metrics.distFormatted}
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                    km distance
                  </div>
                </div>
              </div>

              {/* Metric 2: Average Pace */}
              <div className="flex items-center gap-2 sm:gap-3 justify-center sm:justify-start px-1 sm:px-3">
                <Clock size={17} />
                <div>
                  <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight">
                    {metrics.paceFormatted}
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                    avg pace /km
                  </div>
                </div>
              </div>

              {/* Metric 3: Time */}
              <div className="flex items-center gap-2 sm:gap-3 justify-center sm:justify-start px-1 sm:px-3">
                <Timer size={17} />
                <div>
                  <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight">
                    {metrics.durFormatted}
                  </div>
                  <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                    duration
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* KM SPLITS & ELEVATION ACCORDION */}
      {post.splits && post.splits.length > 0 && (
        <div className="border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden bg-slate-50/60 dark:bg-white/[0.02]">
          <button
            type="button"
            onClick={onToggleSplits}
            className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-white/[0.05] transition-all cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <span>View Km Splits & Elevation ({post.splits.length} km)</span>
            </span>
            <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
              <span>{isSplitsExpanded ? 'Hide' : 'Expand'}</span>
              {isSplitsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </button>

          {isSplitsExpanded && (
            <div className="px-3.5 pb-3 pt-1 space-y-1.5 border-t border-slate-200/60 dark:border-white/[0.05] text-xs">
              {post.splits.map((s) => (
                <div
                  key={s.km}
                  className="flex items-center justify-between py-1.5 px-2.5 rounded-xl bg-white/80 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04]"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-[11px] text-slate-500 dark:text-white/40 w-10">
                      KM {s.km}
                    </span>
                    <span className="font-mono font-black text-slate-800 dark:text-slate-200">
                      {s.pace} /km
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.elevation_diff !== undefined && (
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold ${
                          s.elevation_diff >= 0
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        }`}
                      >
                        {s.elevation_diff >= 0 ? `+${s.elevation_diff}m ↗` : `${s.elevation_diff}m ↘`}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MULTI-REACTIONS & SOCIAL INTERACTIONS BAR */}
      <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] space-y-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {reactions.map((r) => {
              const count = post.reactions
                ? post.reactions[r.type] || 0
                : r.type === 'fire'
                  ? post.fireUpsCount
                  : 0;
              const isActive =
                post.userReaction === r.type ||
                (!post.userReaction && r.type === 'fire' && post.hasFiredUp);

              return (
                <button
                  key={r.type}
                  type="button"
                  disabled={!canReact}
                  onClick={() => onReaction(post.id, r.type)}
                  title={!canReact ? 'You cannot react to your own workout' : r.label}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    !canReact
                      ? 'opacity-60 cursor-not-allowed bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 text-slate-400'
                      : isActive
                        ? `${r.activeColor} shadow-xs scale-105`
                        : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20'
                  }`}
                >
                  <span>{r.icon}</span>
                  <span className="font-mono text-[11px]">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Comments & Share Buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleComments}
              className={`flex items-center gap-1.5 font-semibold transition-all text-xs sm:text-sm cursor-pointer ${
                isCommentsExpanded
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <MessageSquare size={16} className={isCommentsExpanded ? 'text-emerald-500' : ''} />
              <span>{commentCount}</span>
            </button>

            <div className="h-4 w-px bg-slate-200 dark:bg-white/10" />

            <button
              type="button"
              onClick={() => onSharePostClick(post)}
              className="flex items-center gap-1 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold transition-all text-xs cursor-pointer"
            >
              <Share2 size={15} />
              <span>Share</span>
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Comments Section with Clickable @mentions */}
      {isCommentsExpanded && (
        <div className="pt-2 border-t border-slate-200/60 dark:border-white/[0.06] space-y-2">
          {/* Comments List */}
          {post.comments && post.comments.length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {post.comments.map((c) => {
                const canModerate = socialService.canModerateComment(post, c, profile);
                return (
                  <div
                    key={c.id}
                    className="group flex items-start gap-2 bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/[0.04] rounded-xl px-2.5 py-1.5 text-xs"
                  >
                    <div
                      onClick={() =>
                        onOpenAthleteProfile({
                          userId: c.userId,
                          userName: c.userName,
                          userAvatar: c.userAvatar,
                        })
                      }
                      className="cursor-pointer shrink-0 mt-0.5"
                    >
                      {c.userAvatar ? (
                        <img
                          src={c.userAvatar}
                          alt={c.userName}
                          className="w-5 h-5 rounded-full object-cover border border-emerald-500/30"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold text-[9px] flex items-center justify-center">
                          {getInitials(c.userName)}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 leading-tight">
                        <span
                          onClick={() =>
                            onOpenAthleteProfile({
                              userId: c.userId,
                              userName: c.userName,
                              userAvatar: c.userAvatar,
                            })
                          }
                          className="font-semibold text-slate-900 dark:text-white truncate text-[11px] cursor-pointer hover:underline"
                        >
                          {formatDisplayName(c.userName, c.userId)}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400 dark:text-white/30 shrink-0 font-mono">
                            {formatCommentTime(c.createdAt)}
                          </span>
                          {canModerate && (
                            <button
                              type="button"
                              onClick={() => onDeleteComment(c.id, post.id)}
                              title="Delete comment"
                              className="opacity-0 group-hover:opacity-100 hover:text-red-500 text-slate-400 p-0.5 rounded transition-all cursor-pointer"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 text-xs mt-0.5 break-words leading-snug">
                        {renderWithMentions(c.text)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-2 text-center text-xs text-slate-400 dark:text-white/40 italic">
              {isPostOwner ? 'No comments yet on your post.' : 'No comments yet. Be the first to leave one!'}
            </div>
          )}

          {/* Add Comment Input & Quick Mention Chips */}
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={commentInput}
                onChange={(e) => onCommentInputChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onAddComment(post.id)}
                placeholder={isPostOwner ? 'Reply to comments or tag @runner...' : 'Write a comment or tag @runner...'}
                className="flex-1 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-emerald-500 transition-all"
              />
              <button
                type="button"
                onClick={() => onAddComment(post.id)}
                disabled={!commentInput?.trim()}
                className="p-1.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0 shadow-xs cursor-pointer"
                title="Post comment"
              >
                <Send size={13} />
              </button>
            </div>

            {/* Quick Squad Mention Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              <span className="text-[10px] text-slate-400 shrink-0 font-medium">Tag:</span>
              {['@AlexRivers', '@SarahChen', '@MarcusVance'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    onCommentInputChange(commentInput ? `${commentInput} ${tag}` : tag);
                  }}
                  className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-white/10 shrink-0 cursor-pointer"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
