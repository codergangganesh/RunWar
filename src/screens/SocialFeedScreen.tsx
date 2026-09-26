import React, { useState, useEffect } from 'react';
import {
  Flame, MessageSquare, Share2, Trophy, MapPin, Shield, Zap, Send,
  User, Award, Navigation, Plus, CheckCircle2, Download, ChevronLeft, RefreshCw, Lock, Globe, Users, X, Filter, Check,
  MoreVertical, Calendar, Clock, Timer, Trash2, Edit2, Flag, AlertTriangle,
  ChevronDown, ChevronUp, Camera, Image, Sparkles, Swords, TrendingUp, Radio
} from 'lucide-react';
import {
  socialService,
  FeedPost,
  FeedComment,
  LeaderboardEntry,
  TerritoryZone,
  ReactionType,
  KmSplit,
  AthleteProfileData,
  isUUID,
} from '../services/socialService';
import { UserProfile, Workout } from '../types';
import { gpxExporter } from '../services/gpxExporter';
import { formatDistance, formatDuration, formatPaceRaw } from '../utils/formatters';
import { authService, normalizeUserId } from '../services/authService';

interface SocialFeedScreenProps {
  profile: UserProfile | null;
  userWorkouts: Workout[];
  onSelectWorkout?: (workout: Workout) => void;
  onBack?: () => void;
}

type SocialTab = 'feed' | 'leaderboard' | 'territories';

/**
 * Micro GPS Route Map / Thumbnail Component
 * Renders an SVG polyline preview of the run's GPS coordinates (like Strava or Nike Run Club).
 */
const RouteThumbnail: React.FC<{
  coordinates?: any[];
  distanceKm?: number;
  className?: string;
}> = ({ coordinates = [], distanceKm = 5, className = '' }) => {
  let points: [number, number][] = [];

  if (coordinates && coordinates.length >= 2) {
    const lats = coordinates.map((c: any) => Number(c.latitude || c.lat || 0)).filter((n) => !isNaN(n) && n !== 0);
    const lngs = coordinates.map((c: any) => Number(c.longitude || c.lng || c.lon || 0)).filter((n) => !isNaN(n) && n !== 0);

    if (lats.length >= 2 && lngs.length >= 2) {
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      const latSpan = Math.max(0.0008, maxLat - minLat);
      const lngSpan = Math.max(0.0008, maxLng - minLng);

      const padX = 36;
      const padY = 24;
      const w = 320 - padX * 2;
      const h = 130 - padY * 2;

      points = coordinates.map((c: any) => {
        const lat = Number(c.latitude || c.lat || 0);
        const lng = Number(c.longitude || c.lng || c.lon || 0);
        const x = padX + ((lng - minLng) / lngSpan) * w;
        const y = padY + (1 - (lat - minLat) / latSpan) * h;
        return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
      });
    }
  }

  // Smooth parametric organic circuit fallback if GPS coordinates are empty
  if (points.length < 2) {
    const numPoints = 18;
    const cx = 160;
    const cy = 65;
    const rx = 105;
    const ry = 40;
    for (let i = 0; i <= numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const rMod = 1 + 0.16 * Math.sin(angle * 3) + 0.12 * Math.cos(angle * 2);
      const x = cx + Math.cos(angle) * rx * rMod;
      const y = cy + Math.sin(angle) * ry * rMod;
      points.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
    }
  }

  const pathData = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt[0]} ${pt[1]}` : `${acc} L ${pt[0]} ${pt[1]}`;
  }, '');

  const startPt = points[0];
  const endPt = points[points.length - 1];
  const uniqueId = React.useId().replace(/:/g, '_');

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border border-emerald-500/25 shadow-inner ${className}`}>
      {/* Background topographic grid pattern */}
      <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={`grid_${uniqueId}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="white" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#grid_${uniqueId})`} />
      </svg>

      {/* Polyline Route SVG */}
      <svg viewBox="0 0 320 130" className="w-full h-28 sm:h-32 drop-shadow-md">
        <defs>
          <linearGradient id={`routeGrad_${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>

        {/* Ambient glow under the polyline */}
        <path
          d={pathData}
          fill="none"
          stroke="#10b981"
          strokeWidth="6"
          opacity="0.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Crisp foreground polyline */}
        <path
          d={pathData}
          fill="none"
          stroke={`url(#routeGrad_${uniqueId})`}
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Start Point Pin */}
        <circle cx={startPt[0]} cy={startPt[1]} r="4.5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
        {/* Finish Point Pin */}
        <circle cx={endPt[0]} cy={endPt[1]} r="4.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
      </svg>

      {/* GPS Verified HUD Chip */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-mono font-bold text-emerald-400 border border-emerald-500/30">
        <Radio size={10} className="animate-pulse text-emerald-400" />
        <span>GPS POLYLINE</span>
      </div>

      {/* Start / Finish Legend Chip */}
      <div className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-mono text-slate-300 border border-white/10">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        <span>Start</span>
        <span className="text-white/40">•</span>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
        <span>Finish</span>
      </div>
    </div>
  );
};

export const SocialFeedScreen: React.FC<SocialFeedScreenProps> = ({
  profile,
  userWorkouts = [],
  onSelectWorkout,
  onBack,
}) => {
  const [tab, setTab] = useState<SocialTab>('feed');
  const [posts, setPosts] = useState<FeedPost[]>(() => socialService.getFeedPosts());

  // Leaderboard Filtering & Categorization State
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'all'>('week');
  const [leaderboardCategory, setLeaderboardCategory] = useState<'distance' | 'pace' | 'territories'>('distance');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() =>
    socialService.calculateLeaderboard(userWorkouts, profile, timeframe, leaderboardCategory)
  );

  const [territories, setTerritories] = useState<TerritoryZone[]>(() =>
    socialService.calculateTerritories(userWorkouts, profile)
  );

  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});
  const [expandedComments, setExpandedComments] = useState<{ [postId: string]: boolean }>({});
  const [expandedSplits, setExpandedSplits] = useState<{ [postId: string]: boolean }>({});
  const [activePostMenu, setActivePostMenu] = useState<string | null>(null);

  // Modals & Sheets State
  const [selectedAthlete, setSelectedAthlete] = useState<AthleteProfileData | null>(null);
  const [challengeModalSector, setChallengeModalSector] = useState<{
    name: string;
    commander: string;
    pace: string;
    km: string;
    streak: number;
    difficulty?: string;
    elevationM?: number;
  } | null>(null);

  // Full Edit Post State with all creation options
  const [editingPost, setEditingPost] = useState<FeedPost | null>(null);
  const [editSelectedWorkout, setEditSelectedWorkout] = useState<Workout | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [editVisibility, setEditVisibility] = useState<'public' | 'friends' | 'private'>('public');
  const [editPhotoUrl, setEditPhotoUrl] = useState<string>('');
  const [editBurnStats, setEditBurnStats] = useState<boolean>(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [deletingPost, setDeletingPost] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [reportToast, setReportToast] = useState<string | null>(null);

  // Create Post Modal State with Photo & Stats Overlay
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedWorkoutToShare, setSelectedWorkoutToShare] = useState<Workout | null>(null);
  const [shareCaption, setShareCaption] = useState('');
  const [shareVisibility, setShareVisibility] = useState<'public' | 'friends' | 'private'>('public');
  const [sharePhotoUrl, setSharePhotoUrl] = useState<string>('');
  const [shareBurnStats, setShareBurnStats] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);
  const [feedFilter, setFeedFilter] = useState<'all' | 'public' | 'friends' | 'private'>('all');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showTimeframeMenu, setShowTimeframeMenu] = useState(false);

  // Sync real cloud feed and calculations on mount and when workouts / filters change
  useEffect(() => {
    let isMounted = true;

    const loadCloudData = async () => {
      try {
        const [cloudPosts, cloudLeaderboard] = await Promise.all([
          socialService.getFeedPostsAsync(profile),
          socialService.getLeaderboardAsync(userWorkouts, profile, timeframe, leaderboardCategory),
        ]);
        if (isMounted) {
          setPosts(cloudPosts);
          setLeaderboard(cloudLeaderboard);
        }
      } catch (err) {
        console.warn('Error fetching live social data:', err);
      }
    };

    loadCloudData();

    // Recalculate leaderboard & territories immediately from cache while cloud fetch runs
    setLeaderboard(socialService.calculateLeaderboard(userWorkouts, profile, timeframe, leaderboardCategory));
    setTerritories(socialService.calculateTerritories(userWorkouts, profile));

    // Subscribe to live realtime feed changes
    const unsubscribe = socialService.subscribeToFeed(() => {
      if (isMounted) {
        socialService.getFeedPostsAsync(profile).then((updated) => {
          if (isMounted) setPosts(updated);
        });
        socialService.getLeaderboardAsync(userWorkouts, profile, timeframe, leaderboardCategory).then((updatedLb) => {
          if (isMounted) setLeaderboard(updatedLb);
        });
      }
    });

    return () => {
      isMounted = false;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [profile, userWorkouts, timeframe, leaderboardCategory]);

  const toggleComments = (postId: string) => {
    setExpandedComments((prev: Record<string, boolean>) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  // Field extraction helper for workout objects
  const getWorkoutMetrics = (w: any) => {
    const distMeters = Number(w?.distance_meters ?? w?.distanceMeters ?? 0);
    const durSeconds = Number(w?.duration_seconds ?? w?.durationSeconds ?? w?.duration ?? 0);

    let paceSecPerKm = Number(w?.average_pace ?? w?.avgPace ?? w?.averagePace ?? 0);
    if ((!paceSecPerKm || paceSecPerKm <= 0) && distMeters > 0 && durSeconds > 0) {
      paceSecPerKm = durSeconds / (distMeters / 1000);
    }

    const title = w?.title || `${(w?.type || 'run').toUpperCase()} Workout`;
    const startedAt = w?.started_at || w?.startTime || w?.created_at || new Date().toISOString();

    return {
      distMeters,
      durSeconds,
      paceSecPerKm,
      title,
      startedAt,
      distFormatted: formatDistance(distMeters, 'km', 2),
      durFormatted: formatDuration(durSeconds),
      paceFormatted: formatPaceRaw(paceSecPerKm, 'min_km'),
    };
  };

  // Compact relative timestamp for comments
  const formatCommentTime = (isoString?: string): string => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = Math.max(0, now.getTime() - date.getTime());
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'now';
      if (diffMins < 60) return `${diffMins}m`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h`;
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // Multi-Reaction Handler with Self-Interaction Guard
  const handleReaction = async (postId: string, reactionType: ReactionType) => {
    const targetPost = posts.find((p) => p.id === postId);
    if (!targetPost || socialService.isPostAuthor(targetPost, profile)) {
      return;
    }
    const updated = await socialService.toggleReaction(postId, reactionType, profile);
    setPosts(updated);
  };

  // Add Comment with Self-Interaction Guard
  const handleAddComment = async (postId: string) => {
    const text = commentInputs[postId];
    if (!text || !text.trim()) return;

    const targetPost = posts.find((p) => p.id === postId);
    if (targetPost && socialService.isPostAuthor(targetPost, profile)) {
      return;
    }

    const updated = await socialService.addComment(postId, text, profile);
    setPosts(updated);
    setCommentInputs({ ...commentInputs, [postId]: '' });
    setExpandedComments((prev: Record<string, boolean>) => ({ ...prev, [postId]: true }));
  };

  // Delete Comment (Moderation)
  const handleDeleteComment = async (commentId: string, postId: string) => {
    const updated = await socialService.deleteComment(commentId, postId, profile);
    setPosts(updated);
  };

  // Save Full Edited Post to Cloud DB & Cache
  const handleSaveEditPost = async () => {
    if (!editingPost) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const updated = await socialService.updatePost(
        editingPost,
        {
          caption: editCaption,
          visibility: editVisibility,
          workout: editSelectedWorkout,
          photoUrl: editPhotoUrl,
          hasPhotoStatsOverlay: editBurnStats,
        },
        profile
      );

      if (updated) {
        setPosts((prev) => prev.map((p) => (p.id === editingPost.id ? updated : p)));
        const audienceName =
          editVisibility === 'friends'
            ? 'Squad (Friends)'
            : editVisibility === 'private'
            ? 'Private (Only Me)'
            : 'Global';
        setReportToast(`Post updated — audience set to ${audienceName}`);
        setTimeout(() => setReportToast(null), 2000);

        // If the current filter hides this post, reset to 'all' so it remains visible
        if (
          feedFilter !== 'all' &&
          ((feedFilter === 'public' && editVisibility !== 'public') ||
            (feedFilter === 'friends' && editVisibility !== 'friends') ||
            (feedFilter === 'private' && editVisibility !== 'private'))
        ) {
          setFeedFilter('all');
        }

        setEditingPost(null);

        // Refresh live leaderboard in background
        socialService.getLeaderboardAsync(userWorkouts, profile, timeframe, leaderboardCategory).then((updatedLb) => {
          setLeaderboard(updatedLb);
        });
      } else {
        setEditError('Failed to save changes. You may not be authorized to edit this post.');
      }
    } catch (err: any) {
      console.error('Error saving post edits:', err);
      setEditError(err?.message || 'Failed to update post.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Confirm Post Deletion
  const handleConfirmDeletePost = async () => {
    if (!postToDelete) return;
    setDeletingPost(true);
    try {
      const ok = await socialService.deletePost(postToDelete, profile);
      if (ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postToDelete));
        setPostToDelete(null);
      }
    } finally {
      setDeletingPost(false);
    }
  };

  // Report Post
  const handleReportPost = (_postId: string) => {
    setReportToast('Post flagged for community review');
    setTimeout(() => setReportToast(null), 2000);
  };

  // Helper to extract clean initials (never raw UUID characters or numbers)
  const getInitials = (name?: string) => {
    if (!name) return 'R';
    const clean = name.replace(/^@/, '').trim();
    if (!clean || isUUID(clean)) return 'R';
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

  // Helper to format clean athlete display names across feed & profile
  const formatDisplayName = (name?: string | null, userId?: string | null): string => {
    const isMe = socialService.isPostAuthor({ userId: userId || undefined }, profile);
    if (isMe) {
      return profile?.name || profile?.username || 'You';
    }
    if (!name || isUUID(name)) {
      return 'War Runner';
    }
    return name.replace(/^@/, '');
  };

  // Open Athlete Profile modal with rich context (never raw UUIDs)
  const handleOpenAthleteProfile = (
    target: {
      userId?: string;
      userName?: string;
      userAvatar?: string;
      userBadge?: string;
      totalDistanceKm?: number;
      totalRuns?: number;
      avgPace?: string;
      streakDays?: number;
      isCurrentUser?: boolean;
    } | string
  ) => {
    const athleteData = socialService.getAthleteProfile(target, profile, userWorkouts);
    setSelectedAthlete(athleteData);
  };

  // Open Territory Challenge modal
  const handleOpenChallenge = (sectorName: string, commanderName: string) => {
    const cleanSector = sectorName.replace(/^Captured\s+/i, '');
    const matchingZone = territories.find(
      (t) => t.name.toLowerCase().includes(cleanSector.toLowerCase()) || cleanSector.toLowerCase().includes(t.name.toLowerCase())
    ) || {
      id: 'tz_challenge',
      name: cleanSector,
      holder: commanderName,
      pace: '4:35 /km',
      status: 'Contested' as const,
      km: '3.2 km',
      defenseStreakDays: 14,
      targetPaceSeconds: 275,
      difficulty: 'Moderate' as const,
      elevationM: 48,
    };

    setChallengeModalSector({
      name: matchingZone.name,
      commander: matchingZone.holder,
      pace: matchingZone.pace,
      km: matchingZone.km,
      streak: matchingZone.defenseStreakDays,
      difficulty: matchingZone.difficulty,
      elevationM: matchingZone.elevationM,
    });
  };

  // Launch Challenge Run from modal
  const handleLaunchChallenge = () => {
    if (!challengeModalSector) return;
    const sectorName = challengeModalSector.name;
    const paceTarget = challengeModalSector.pace;
    setChallengeModalSector(null);

    setReportToast(`Sector queued — beat ${paceTarget} to claim ${sectorName}`);
    setTimeout(() => setReportToast(null), 2000);

    if (onSelectWorkout && userWorkouts.length > 0) {
      onSelectWorkout(userWorkouts[0]);
    }
  };

  // Refresh feed and leaderboard from InsForge Cloud DB
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [cloudPosts, cloudLeaderboard] = await Promise.all([
        socialService.getFeedPostsAsync(profile),
        socialService.getLeaderboardAsync(userWorkouts, profile, timeframe, leaderboardCategory),
      ]);
      setPosts(cloudPosts);
      setLeaderboard(cloudLeaderboard);
      setTerritories(socialService.calculateTerritories(userWorkouts, profile));
    } catch (err) {
      console.warn('Failed to refresh social feed & leaderboard:', err);
    } finally {
      setTimeout(() => setRefreshing(false), 300);
    }
  };

  // Publish workout post with photo & stats overlay to cloud
  const handlePublishPost = async () => {
    if (!selectedWorkoutToShare && !shareCaption.trim() && !sharePhotoUrl) return;
    setSubmittingPost(true);
    setShareError(null);
    try {
      const newPost = await socialService.shareWorkout(
        selectedWorkoutToShare,
        profile,
        shareCaption,
        shareVisibility,
        sharePhotoUrl || undefined,
        shareBurnStats
      );
      setPosts([newPost, ...posts]);
      setShowShareModal(false);
      setSelectedWorkoutToShare(null);
      setShareCaption('');
      setSharePhotoUrl('');

      // If active filter would hide newly published post, reset filter to 'all'
      if (
        feedFilter !== 'all' &&
        ((feedFilter === 'public' && shareVisibility !== 'public') ||
          (feedFilter === 'friends' && shareVisibility !== 'friends') ||
          (feedFilter === 'private' && shareVisibility !== 'private'))
      ) {
        setFeedFilter('all');
      }

      // Refresh live leaderboard in background
      socialService.getLeaderboardAsync(userWorkouts, profile, timeframe, leaderboardCategory).then((updatedLb) => {
        setLeaderboard(updatedLb);
      });
    } catch (err: any) {
      console.error('Failed to publish community post:', err);
      setShareError(err?.message || 'Failed to publish post. Please try again.');
    } finally {
      setSubmittingPost(false);
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
              handleOpenAthleteProfile({ userName: username });
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

  // Filter posts based on privacy rules & active audience filter
  const visiblePosts = posts.filter((post) => {
    const isOwner = socialService.isPostAuthor(post, profile);
    if (post.visibility === 'private' && !isOwner) {
      return false;
    }
    if (feedFilter === 'public') {
      return post.visibility === 'public' || !post.visibility;
    }
    if (feedFilter === 'friends') {
      return post.visibility === 'friends';
    }
    if (feedFilter === 'private') {
      return post.visibility === 'private' && isOwner;
    }
    return true;
  });

  // Filter leaderboard based on active audience filter
  const visibleLeaderboard = leaderboard.filter((entry) => {
    if (feedFilter === 'private') {
      const myId = normalizeUserId(profile?.id || (profile as any)?.user_id);
      return normalizeUserId(entry.userId) === myId;
    }
    return true;
  });

  // Filter territories based on active audience filter
  const visibleTerritories = territories.filter((zone) => {
    if (feedFilter === 'private') {
      const myName = (profile?.name || '').toLowerCase();
      return zone.holder.toLowerCase().includes(myName);
    }
    return true;
  });

  // Calculate Rival Gap Tracker for Leaderboard
  const myId = normalizeUserId(profile?.id || (profile as any)?.user_id || 'guest_user');
  const myLeaderboardIndex = visibleLeaderboard.findIndex((e) => e.isCurrentUser || (e.userId && normalizeUserId(e.userId) === myId));
  const myEntry = myLeaderboardIndex >= 0 ? visibleLeaderboard[myLeaderboardIndex] : null;
  const runnerAhead = myLeaderboardIndex > 0 ? visibleLeaderboard[myLeaderboardIndex - 1] : null;

  return (
    <div className="min-h-full bg-slate-50/80 dark:bg-[#080810] text-slate-900 dark:text-white flex flex-col font-sans">
      {/* Header */}
      <div className="px-4 sm:px-5 pt-safe pt-4 pb-3.5 flex items-center gap-3 border-b border-slate-200/80 dark:border-white/[0.07] bg-white/90 dark:bg-slate-950/70 backdrop-blur-md sticky top-0 z-30">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-white/60 transition-colors"
            aria-label="Back"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/25 shrink-0">
            <Flame size={16} className="text-white fill-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-slate-900 dark:text-white font-bold text-base sm:text-lg leading-tight truncate">Social Feed</h1>
            <p className="text-slate-500 dark:text-white/40 text-xs truncate">War Zone Community</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-white/40 transition-colors cursor-pointer"
          disabled={refreshing}
          title="Refresh Feed"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={() => {
            setShareError(null);
            setShowShareModal(true);
          }}
          className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-500/30 hover:opacity-90 active:scale-[0.97] transition-all cursor-pointer shrink-0"
        >
          <Plus size={16} />
          Post
        </button>
      </div>

      {/* Global Toast Notification — Top Center Minimal */}
      {reportToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[99999] animate-slide-down">
          <div className="bg-slate-900 dark:bg-slate-800 text-white px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-[13px] font-medium whitespace-nowrap">
            <Check size={14} className="text-emerald-400 shrink-0" />
            <span>{reportToast}</span>
          </div>
        </div>
      )}

      {/* Tabs Bar & Global Filter Bar — Screen-Fit Layout (No Horizontal Scrolling) */}
      <div className="px-3 sm:px-5 py-2.5 bg-white/70 dark:bg-slate-950/40 border-b border-slate-200/60 dark:border-white/[0.05]">
        <div className="flex items-center gap-2 w-full">
          {/* 3 Tabs — Screen-Fit Grid without icons for spacious padding */}
          <div className="grid grid-cols-3 gap-1.5 flex-1 min-w-0">
            {/* Tab 1: Activity Feed */}
            <button
              onClick={() => setTab('feed')}
              className={`flex items-center justify-center gap-1 px-2 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-semibold transition-all cursor-pointer min-w-0 ${tab === 'feed'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                : 'bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/70 hover:border-emerald-400'
                }`}
            >
              <span className="truncate">Feed</span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${tab === 'feed'
                  ? 'bg-emerald-200 text-emerald-950'
                  : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                  }`}
              >
                {visiblePosts.length}
              </span>
            </button>

            {/* Tab 2: Leaderboard */}
            <button
              onClick={() => setTab('leaderboard')}
              className={`flex items-center justify-center gap-1 px-2 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-semibold transition-all cursor-pointer min-w-0 ${tab === 'leaderboard'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                : 'bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/70 hover:border-emerald-400'
                }`}
            >
              <span className="truncate">Leaderboard</span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${tab === 'leaderboard'
                  ? 'bg-emerald-200 text-emerald-950'
                  : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                  }`}
              >
                {visibleLeaderboard.length}
              </span>
            </button>

            {/* Tab 3: Territories */}
            <button
              onClick={() => setTab('territories')}
              className={`flex items-center justify-center gap-1 px-2 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-semibold transition-all cursor-pointer min-w-0 ${tab === 'territories'
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                : 'bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/70 hover:border-emerald-400'
                }`}
            >
              <span className="truncate">Territories</span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${tab === 'territories'
                  ? 'bg-emerald-200 text-emerald-950'
                  : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                  }`}
              >
                {visibleTerritories.length}
              </span>
            </button>
          </div>

          {/* Filter Option — Always Visible Across ALL Selected Tabs */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className={`flex items-center gap-1.5 px-3 py-2 sm:py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${feedFilter !== 'all'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold'
                : 'bg-white dark:bg-white/[0.06] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-emerald-400'
                }`}
              title={`Filter: ${feedFilter}`}
            >
              <Filter size={13} className={feedFilter !== 'all' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'} />
              <span className="hidden sm:inline capitalize text-xs">
                {feedFilter === 'all' ? 'Filter' : feedFilter}
              </span>
              {feedFilter !== 'all' && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              )}
            </button>

            {showFilterMenu && (
              <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl z-30 py-1.5 text-xs animate-in fade-in zoom-in-95">
                {(['all', 'public', 'friends', 'private'] as const).map((filterOpt) => (
                  <button
                    key={filterOpt}
                    type="button"
                    onClick={() => {
                      setFeedFilter(filterOpt);
                      setShowFilterMenu(false);
                    }}
                    className={`w-full px-3.5 py-2 text-left flex items-center justify-between hover:bg-slate-100 dark:hover:bg-white/[0.06] capitalize cursor-pointer ${feedFilter === filterOpt
                      ? 'text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/5'
                      : 'text-slate-700 dark:text-slate-300'
                      }`}
                  >
                    <span>
                      {filterOpt === 'all'
                        ? 'All'
                        : filterOpt === 'public'
                          ? 'Global'
                          : filterOpt === 'friends'
                            ? 'Squad'
                            : 'Only Me (Private)'}
                    </span>
                    {feedFilter === filterOpt && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 px-4 sm:px-5 py-4 max-w-xl mx-auto w-full space-y-4">
        {/* Active Filter Notification Banner */}
        {feedFilter !== 'all' && (
          <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-2xl text-xs text-emerald-700 dark:text-emerald-300">
            <span className="flex items-center gap-1.5 font-medium">
              <Filter size={12} className="text-emerald-500" />
              Showing: <strong>{feedFilter === 'public' ? 'Global' : feedFilter === 'friends' ? 'Squad' : 'Only Me (Private)'}</strong>
            </span>
            <button
              type="button"
              onClick={() => setFeedFilter('all')}
              className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Clear Filter
            </button>
          </div>
        )}

        {/* TAB 1: SOCIAL FEED */}
        {tab === 'feed' && (
          <div className="space-y-4">
            {visiblePosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div>
                  <h3 className="text-slate-800 dark:text-white font-bold text-base">
                    {feedFilter === 'private'
                      ? 'No Private Posts Yet'
                      : feedFilter === 'friends'
                        ? 'No Squad Posts Yet'
                        : 'No Community Posts Yet'}
                  </h3>
                  <p className="text-slate-500 dark:text-white/40 text-xs mt-1 max-w-xs">
                    {feedFilter === 'private'
                      ? "Workouts published with 'Private' audience will be archived here strictly for your eyes only."
                      : feedFilter === 'friends'
                        ? "Workouts published with 'Squad' audience will appear here for your teammates and club."
                        : 'Be the first athlete to publish a workout on the network!'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShareError(null);
                    setShowShareModal(true);
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-xs shadow-md shadow-emerald-500/20 hover:opacity-90 cursor-pointer"
                >
                  Create a Post
                </button>
              </div>
            ) : (
              visiblePosts.map((post) => {
                const metrics = getWorkoutMetrics(post.workout);
                const isPostOwner = socialService.isPostAuthor(post, profile);
                const canReact = !isPostOwner;
                const isCommentsExpanded = Boolean(expandedComments[post.id]);
                const commentCount = post.commentsCount ?? (post.comments ? post.comments.length : 0);

                const workoutType = (post.workout?.type || 'jog').toLowerCase();
                const sessionTitle = post.workout?.title && !post.workout.title.toLowerCase().includes('workout')
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
                    key={post.id}
                    className={`bg-white dark:bg-white/[0.04] rounded-[28px] p-5 sm:p-6 shadow-sm space-y-4 backdrop-blur-md transition-all ${post.isTerritoryCapture || post.territoryClaimed
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
                          onClick={() => handleOpenChallenge(post.territoryClaimed || 'Central Sector Loop', post.userName)}
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
                          onClick={() => handleOpenAthleteProfile({
                            userId: post.userId,
                            userName: post.userName,
                            userAvatar: post.userAvatar,
                            userBadge: post.userBadge,
                          })}
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
                              onClick={() => handleOpenAthleteProfile({
                                userId: post.userId,
                                userName: post.userName,
                                userAvatar: post.userAvatar,
                                userBadge: post.userBadge,
                              })}
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

                              <span className={`flex items-center gap-1 font-semibold shrink-0 ${
                                post.visibility === 'private'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : post.visibility === 'friends'
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }`}>
                                <MapPin size={12} className="shrink-0" />
                                {post.visibility === 'private'
                                  ? 'Private Sector'
                                  : post.visibility === 'friends'
                                  ? 'Squad Sector'
                                  : (post.locationName && post.locationName !== 'Private Sector' && post.locationName !== 'Squad Sector' ? post.locationName : 'Global Sector')}
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
                          onClick={() => setActivePostMenu(activePostMenu === post.id ? null : post.id)}
                          title="Options"
                          className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all cursor-pointer"
                        >
                          <MoreVertical size={18} />
                        </button>
                        {activePostMenu === post.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl z-20 py-1.5 text-xs font-semibold">
                            {isPostOwner ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPost(post);
                                    setEditSelectedWorkout(
                                      post.workout && !post.workout.id?.startsWith('w_post_') && Number(post.workout.distance_meters || 0) > 0
                                        ? post.workout
                                        : null
                                    );
                                    setEditCaption(post.caption || '');
                                    setEditVisibility(post.visibility || 'public');
                                    setEditPhotoUrl(post.photoUrl || '');
                                    setEditBurnStats(Boolean(post.hasPhotoStatsOverlay));
                                    setEditError(null);
                                    setActivePostMenu(null);
                                  }}
                                  className="w-full px-3.5 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-800 dark:text-white cursor-pointer"
                                >
                                  <Edit2 size={14} className="text-emerald-500" /> Edit Post
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPostToDelete(post.id);
                                    setActivePostMenu(null);
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
                                  handleReportPost(post.id);
                                  setActivePostMenu(null);
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
                                setActivePostMenu(null);
                              }}
                              className="w-full px-3.5 py-2 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-800 dark:text-white cursor-pointer"
                            >
                              <Download size={14} className="text-emerald-600" /> Export GPX File
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (navigator.share) {
                                  navigator.share({
                                    title: 'RunWar Workout',
                                    text: `${post.userName} ran ${metrics.distFormatted} km on RunWar!`,
                                    url: window.location.href,
                                  }).catch(() => { });
                                }
                                setActivePostMenu(null);
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

                    {/* PHOTO ATTACHMENT WITH STATS OVERLAY */}
                    {post.photoUrl && (
                      <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 group shadow-md">
                        <img
                          src={post.photoUrl}
                          alt="Run selfie"
                          className="w-full h-56 sm:h-64 object-cover group-hover:scale-[1.02] transition-transform duration-500"
                        />
                        {post.hasPhotoStatsOverlay && (
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-3.5 sm:p-4 text-white">
                            <div className="flex items-end justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <div className="w-5 h-5 rounded-md bg-emerald-500 flex items-center justify-center shadow-xs">
                                    <Flame size={12} className="text-white fill-white" />
                                  </div>
                                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                                    RUNWAR STATS STAMP
                                  </span>
                                </div>
                                <div className="text-2xl sm:text-3xl font-black font-mono tracking-tight leading-none text-white drop-shadow-md">
                                  {metrics.distFormatted} <span className="text-sm font-bold text-emerald-400">KM</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 text-right">
                                <div>
                                  <div className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">Pace</div>
                                  <div className="text-xs sm:text-sm font-black font-mono text-white">{metrics.paceFormatted} /km</div>
                                </div>
                                <div className="w-px h-6 bg-white/20" />
                                <div>
                                  <div className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">Duration</div>
                                  <div className="text-xs sm:text-sm font-black font-mono text-white">{metrics.durFormatted}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* MICRO GPS ROUTE MAP / THUMBNAIL */}
                    <RouteThumbnail
                      coordinates={post.workout?.route_coordinates}
                      distanceKm={metrics.distMeters / 1000}
                    />

                    {/* Workout Performance Card (Mint/Teal Inner Container) */}
                    <div
                      onClick={() => onSelectWorkout && onSelectWorkout(post.workout)}
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

                    {/* KM SPLITS & ELEVATION ACCORDION */}
                    {post.splits && post.splits.length > 0 && (
                      <div className="border border-slate-200/80 dark:border-white/[0.08] rounded-2xl overflow-hidden bg-slate-50/60 dark:bg-white/[0.02]">
                        <button
                          type="button"
                          onClick={() => setExpandedSplits((prev) => ({ ...prev, [post.id]: !prev[post.id] }))}
                          className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-white/[0.05] transition-all cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <Zap size={14} className="text-amber-500" />
                            <span>View Km Splits & Elevation ({post.splits.length} km)</span>
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                            <span>{expandedSplits[post.id] ? 'Hide' : 'Expand'}</span>
                            {expandedSplits[post.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </span>
                        </button>

                        {expandedSplits[post.id] && (
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
                                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold ${s.elevation_diff >= 0
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
                        {/* Reaction Picker with 4 Emojis (Fire Up 🔥, Respect ⚡, Beast 🐺, Salute 🫡) */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {reactions.map((r) => {
                            const count = post.reactions
                              ? post.reactions[r.type] || 0
                              : (r.type === 'fire' ? post.fireUpsCount : 0);
                            const isActive =
                              post.userReaction === r.type ||
                              (!post.userReaction && r.type === 'fire' && post.hasFiredUp);

                            return (
                              <button
                                key={r.type}
                                type="button"
                                disabled={!canReact}
                                onClick={() => handleReaction(post.id, r.type)}
                                title={!canReact ? 'You cannot react to your own workout' : r.label}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${!canReact
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
                            onClick={() => toggleComments(post.id)}
                            className={`flex items-center gap-1.5 font-semibold transition-all text-xs sm:text-sm cursor-pointer ${isCommentsExpanded
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
                            onClick={() => {
                              if (navigator.share) {
                                navigator.share({
                                  title: 'RunWar Workout',
                                  text: `${post.userName} ran ${metrics.distFormatted} km on RunWar!`,
                                  url: window.location.href,
                                }).catch(() => { });
                              }
                            }}
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
                                  {/* Clickable comment author avatar */}
                                  <div
                                    onClick={() => handleOpenAthleteProfile({
                                      userId: c.userId,
                                      userName: c.userName,
                                      userAvatar: c.userAvatar,
                                    })}
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
                                        onClick={() => handleOpenAthleteProfile({
                                          userId: c.userId,
                                          userName: c.userName,
                                          userAvatar: c.userAvatar,
                                        })}
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
                                            onClick={() => handleDeleteComment(c.id, post.id)}
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
                        {!isPostOwner && (
                          <div className="space-y-1.5 pt-0.5">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={commentInputs[post.id] || ''}
                                onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                                placeholder="Write a comment or tag @runner..."
                                className="flex-1 bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-emerald-500 transition-all"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddComment(post.id)}
                                disabled={!commentInputs[post.id]?.trim()}
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
                                    const current = commentInputs[post.id] || '';
                                    setCommentInputs({
                                      ...commentInputs,
                                      [post.id]: current ? `${current} ${tag}` : tag,
                                    });
                                  }}
                                  className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-white/10 shrink-0 cursor-pointer"
                                >
                                  {tag}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: GLOBAL LEADERBOARD & RIVAL GAP TRACKER */}
        {tab === 'leaderboard' && (
          <div className="space-y-3 pt-1">
            {/* Header Card */}


            {/* LEADERBOARD CATEGORIES & TIMEFRAME FILTER ROW */}
            <div className="flex items-center gap-2 relative">
              {/* Category Switcher Pill Container */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-white/[0.04] rounded-2xl border border-slate-200/80 dark:border-white/[0.06] flex-1 min-w-0">
                {[
                  { id: 'distance', label: 'Distance' },
                  { id: 'pace', label: 'Pace' },
                  { id: 'territories', label: 'Territories' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setLeaderboardCategory(cat.id as any)}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${leaderboardCategory === cat.id
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white'
                      }`}
                  >

                    <span className="truncate">{cat.label}</span>
                  </button>
                ))}
              </div>

              {/* Timeframe Filter Dropdown Button with Filter Icon */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setShowTimeframeMenu(!showTimeframeMenu)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${timeframe !== 'all'
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                    : 'bg-white dark:bg-white/[0.04] border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-white/70 hover:border-emerald-400'
                    }`}
                  title="Filter Timeframe"
                >
                  <Filter size={13} className={timeframe !== 'all' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'} />
                  <span className="truncate">
                    {timeframe === 'week' ? 'Week' : timeframe === 'month' ? 'Month' : 'All'}
                  </span>
                  <ChevronDown size={12} className={`text-slate-400 transition-transform ${showTimeframeMenu ? 'rotate-180' : ''}`} />
                </button>

                {showTimeframeMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setShowTimeframeMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-xl z-40 py-1.5 text-xs animate-in fade-in zoom-in-95">
                      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Timeframe
                      </div>
                      {[
                        { id: 'week', label: 'This Week' },
                        { id: 'month', label: 'This Month' },
                        { id: 'all', label: 'All Time' },
                      ].map((tf) => (
                        <button
                          key={tf.id}
                          type="button"
                          onClick={() => {
                            setTimeframe(tf.id as any);
                            setShowTimeframeMenu(false);
                          }}
                          className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer ${timeframe === tf.id
                            ? 'text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/5'
                            : 'text-slate-700 dark:text-slate-300'
                            }`}
                        >
                          <span>{tf.label}</span>
                          {timeframe === tf.id && <Check size={14} className="text-emerald-500" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* RIVAL GAP TRACKER CARD */}

            {/* LEADERBOARD LIST */}
            <div className="space-y-2">
              {visibleLeaderboard.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 dark:text-white/40">
                  No leaderboard runners found for "{feedFilter}" filter.
                </div>
              ) : (
                visibleLeaderboard.map((entry) => (
                  <div
                    key={entry.userId}
                    onClick={() => handleOpenAthleteProfile({
                      userId: entry.userId,
                      userName: formatDisplayName(entry.userName, entry.userId),
                      userAvatar: entry.userAvatar,
                      userBadge: entry.badge,
                      totalDistanceKm: entry.totalDistanceKm,
                      totalRuns: entry.totalRuns,
                      avgPace: entry.avgPace,
                      streakDays: entry.streakDays,
                      isCurrentUser: entry.isCurrentUser,
                    })}
                    className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between gap-3 transition-all cursor-pointer hover:border-emerald-400 ${entry.rank === 1
                      ? 'bg-amber-500/10 border-amber-500/40 shadow-sm'
                      : 'bg-white dark:bg-white/[0.04] border-slate-200/80 dark:border-white/[0.08]'
                      }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${entry.rank === 1
                          ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                          : entry.rank === 2
                            ? 'bg-slate-300 text-slate-900 font-bold'
                            : entry.rank === 3
                              ? 'bg-amber-700 text-white font-bold'
                              : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/60'
                          }`}
                      >
                        {entry.rank}
                      </div>

                      <div className="relative shrink-0">
                        {entry.userAvatar ? (
                          <img
                            src={entry.userAvatar}
                            alt={entry.userName}
                            className="w-10 h-10 rounded-full object-cover border border-emerald-500/30"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold flex items-center justify-center border border-emerald-500/30 text-xs">
                            {getInitials(entry.userName)}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                          <span>{formatDisplayName(entry.userName, entry.userId)}</span>
                          {entry.badge && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">
                              {entry.badge}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-white/40 flex items-center gap-2 mt-0.5">
                          <span>{entry.totalRuns} runs</span>
                          <span>•</span>
                          <span>Pace {entry.avgPace}</span>
                          {entry.territoriesHeld !== undefined && entry.territoriesHeld > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                {entry.territoriesHeld} zone(s)
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-black text-sm sm:text-base text-slate-900 dark:text-white font-mono">
                        {leaderboardCategory === 'pace'
                          ? entry.avgPace
                          : leaderboardCategory === 'territories'
                            ? `${entry.territoriesHeld || 0} zones`
                            : `${entry.totalDistanceKm} km`}
                      </div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        {entry.streakDays}d streak 🔥
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: TERRITORY WARFARE & DIRECT CONTEST */}
        {tab === 'territories' && (
          <div className="space-y-3 pt-1">


            <div className="space-y-2.5">
              {visibleTerritories.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 dark:text-white/40">
                  No territories found for "{feedFilter}" filter.
                </div>
              ) : (
                visibleTerritories.map((zone) => (
                  <div
                    key={zone.id}
                    className="bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 space-y-3 hover:border-emerald-400/50 transition-all shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                            {zone.name}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${zone.status === 'Contested'
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40'
                              }`}
                          >
                            {zone.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-white/40 mt-1 truncate">
                          Commander:{' '}
                          <span
                            onClick={() => handleOpenAthleteProfile({ userName: zone.holder })}
                            className="text-slate-800 dark:text-slate-200 font-semibold cursor-pointer hover:underline"
                          >
                            {zone.holder}
                          </span>{' '}
                          ({zone.pace})
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-black">
                          {zone.km}
                        </span>
                        {zone.elevationM && (
                          <div className="text-[10px] text-slate-400">+{zone.elevationM}m Elev</div>
                        )}
                      </div>
                    </div>

                    {/* Zone Defense Streak & Direct Contest Action */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/[0.05]">
                      <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold">
                        <Shield size={13} className="text-amber-500" />
                        <span>{zone.defenseStreakDays}-Day Defense Streak 🔥</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenChallenge(zone.name, zone.holder)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-90 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                      >
                        <Swords size={12} />
                        <span>Contest Sector</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ATHLETE QUICK PROFILE MODAL BOTTOM SHEET */}
      {selectedAthlete && (
        <div
          className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4 select-none animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedAthlete(null);
          }}
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSelectedAthlete(null)}
          />

          <div className="relative z-10 w-full max-w-md bg-white dark:bg-[#0f0f1a] text-slate-900 dark:text-white border-t sm:border border-slate-200 dark:border-white/10 rounded-t-[32px] sm:rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 max-h-[90dvh] overflow-y-auto animate-slide-up">
            {/* Grab Handle */}
            <div className="flex flex-col items-center sm:hidden -mt-1 pb-1 cursor-grab">
              <div className="w-12 h-1 rounded-full bg-slate-300 dark:bg-white/20" />
            </div>

            {/* Profile Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3.5">
                {selectedAthlete.userAvatar ? (
                  <img
                    src={selectedAthlete.userAvatar}
                    alt={selectedAthlete.userName}
                    className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500 shadow-md"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-2xl flex items-center justify-center border-2 border-emerald-500 shadow-md">
                    {getInitials(selectedAthlete.userName)}
                  </div>
                )}
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-white flex items-center gap-1.5">
                    {selectedAthlete.userName}
                    {selectedAthlete.isCurrentUser && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        You
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      {selectedAthlete.userBadge}
                    </span>
                    <span className="text-xs text-amber-500 font-semibold">
                      🔥 {selectedAthlete.streakDays}d Streak
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAthlete(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Essential Stats */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.06] text-center">
              <div>
                <div className="text-base font-black font-mono text-slate-900 dark:text-white">
                  {selectedAthlete.totalDistanceKm}
                </div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Km</div>
              </div>
              <div>
                <div className="text-base font-black font-mono text-slate-900 dark:text-white">
                  {selectedAthlete.totalRuns}
                </div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Runs</div>
              </div>
              <div>
                <div className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {selectedAthlete.avgPace}
                </div>
                <div className="text-[10px] text-slate-400 uppercase font-semibold">Avg Pace</div>
              </div>
            </div>

            {/* Recent Activities (only shown if athlete has recorded runs) */}
            {selectedAthlete.recentActivities && selectedAthlete.recentActivities.length > 0 && (
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <Navigation size={13} className="text-emerald-500" />
                  <span>Recent War Runs</span>
                </div>
                <div className="space-y-1.5">
                  {selectedAthlete.recentActivities.map((act) => (
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
              {selectedAthlete.isCurrentUser ? (
                <button
                  type="button"
                  onClick={() => setSelectedAthlete(null)}
                  className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-800 dark:text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Close
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAthlete(null);
                      setReportToast(`Cheer sent to ${selectedAthlete.userName}`);
                      setTimeout(() => setReportToast(null), 2000);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold hover:bg-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Zap size={14} />
                    <span>Cheer Athlete</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const targetSector = 'Central Sector Loop';
                      const name = selectedAthlete.userName;
                      setSelectedAthlete(null);
                      handleOpenChallenge(targetSector, name);
                    }}
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
      )}

      {/* TERRITORY CHALLENGE MODAL */}
      {challengeModalSector && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setChallengeModalSector(null);
          }}
        >
          <div className="w-full max-w-sm bg-white dark:bg-[#0f0f1a] border border-slate-200 dark:border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 text-center animate-slide-up">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto shadow-md">
              <Swords size={28} />
            </div>

            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                TERRITORY CONTEST CHALLENGE
              </div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white mt-0.5">
                {challengeModalSector.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-white/50 mt-1">
                Held by Commander <strong>{challengeModalSector.commander}</strong> ({challengeModalSector.streak}d streak)
              </p>
            </div>

            {/* Target Criteria */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 space-y-2 text-left">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Segment Distance:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {challengeModalSector.km}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Commander Pace:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                  {challengeModalSector.pace}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/60 dark:border-white/[0.06]">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Pace Target to Win:</span>
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                  &lt; {challengeModalSector.pace}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setChallengeModalSector(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLaunchChallenge}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold hover:opacity-90 transition-all shadow-md shadow-emerald-500/25 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Zap size={14} />
                <span>Launch Run</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL EDIT POST BOTTOM SHEET DRAWER WITH ALL OPTIONS */}
      {editingPost && (
        <div
          className="fixed inset-0 z-[99999] flex items-end justify-center select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditingPost(null);
            }
          }}
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setEditingPost(null)}
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
                  <Edit2 size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-slate-900 dark:text-white font-bold text-base sm:text-lg leading-tight">
                    Edit Post
                  </h2>
                  <p className="text-slate-500 dark:text-white/40 text-xs">
                    Update workout, photo, audience, or caption
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingPost(null)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 dark:text-white/50 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Error Banner */}
            {editError && (
              <div className="mx-5 sm:mx-6 mt-3 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            {/* Form Body */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4 no-scrollbar">
              {/* Select / Change / Detach Workout */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Navigation size={13} className="text-emerald-500" />
                    Attached Workout {editSelectedWorkout ? '(Attached)' : '(None)'}
                  </label>
                  {editSelectedWorkout && (
                    <button
                      type="button"
                      onClick={() => setEditSelectedWorkout(null)}
                      className="text-[11px] text-red-500 hover:underline font-semibold"
                    >
                      Detach Workout
                    </button>
                  )}
                </div>

                <div className="max-h-40 overflow-y-auto space-y-2 pr-1 no-scrollbar">
                  {userWorkouts.length === 0 ? (
                    <div className="p-3.5 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] text-center">
                      <p className="text-xs text-slate-500 dark:text-white/40">No recorded workouts yet</p>
                    </div>
                  ) : (
                    userWorkouts.slice(0, 10).map((w) => {
                      const m = getWorkoutMetrics(w);
                      const isSelected = editSelectedWorkout?.id === w.id;
                      return (
                        <div
                          key={w.id}
                          onClick={() => setEditSelectedWorkout(isSelected ? null : w)}
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

              {/* Photo Attachment & Stats Overlay Option */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Camera size={13} className="text-emerald-500" />
                    Attach Photo / Selfie:
                  </span>
                  {editPhotoUrl && (
                    <button
                      type="button"
                      onClick={() => setEditPhotoUrl('')}
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
                      onClick={() => setEditPhotoUrl(preset.url)}
                      className={`relative rounded-xl overflow-hidden h-14 border transition-all cursor-pointer ${
                        editPhotoUrl === preset.url
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
                {editPhotoUrl && (
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editBurnStats}
                      onChange={(e) => setEditBurnStats(e.target.checked)}
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
                    onClick={() => setEditVisibility('public')}
                    className={`py-2 px-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      editVisibility === 'public'
                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-500/25 ring-2 ring-emerald-500/20'
                        : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 hover:border-slate-300'
                    }`}
                  >
                    <Globe size={14} /> Global
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditVisibility('friends')}
                    className={`py-2 px-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      editVisibility === 'friends'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/25 ring-2 ring-blue-500/20'
                        : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 hover:border-slate-300'
                    }`}
                  >
                    <Users size={14} /> Squad
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditVisibility('private')}
                    className={`py-2 px-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      editVisibility === 'private'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm shadow-amber-500/25 ring-2 ring-amber-500/20'
                        : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 hover:border-slate-300'
                    }`}
                  >
                    <Lock size={14} /> Private
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {editVisibility === 'public' && '🌐 Visible to everyone across the global community feed & leaderboards.'}
                  {editVisibility === 'friends' && '👥 Visible only to your squad members & friends in the Squad feed.'}
                  {editVisibility === 'private' && '🔒 Private to you only. Hidden from all other community feeds.'}
                </p>
              </div>

              {/* Caption / War Cry */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  War Cry / Caption:
                </label>
                <textarea
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  placeholder="Update your caption, motivation, or thoughts..."
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
                      onClick={() => setEditCaption((prev: string) => (prev ? `${prev} ${chip}` : chip))}
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
                onClick={() => setEditingPost(null)}
                className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingEdit}
                onClick={handleSaveEditPost}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold disabled:opacity-50 hover:opacity-90 active:scale-[0.98] transition-all shadow-md shadow-emerald-500/25 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {savingEdit ? (
                  <RefreshCw size={15} className="animate-spin" />
                ) : (
                  <>
                    <Check size={15} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE POST CONFIRMATION MODAL */}
      {postToDelete && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-[#0f0f1a] border border-slate-200 dark:border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Delete Post?</h3>
              <p className="text-xs text-slate-500 dark:text-white/50 mt-1">
                Are you sure you want to delete this workout post? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPostToDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingPost}
                onClick={handleConfirmDeletePost}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md shadow-red-600/30 disabled:opacity-50"
              >
                {deletingPost ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE POST BOTTOM SHEET DRAWER WITH PHOTO & STATS OVERLAY */}
      {showShareModal && (
        <div
          className="fixed inset-0 z-[99999] flex items-end justify-center select-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowShareModal(false);
            }
          }}
        >
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowShareModal(false)}
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
                onClick={() => setShowShareModal(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 dark:text-white/50 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Error Banner */}
            {shareError && (
              <div className="mx-5 sm:mx-6 mt-3 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                <span>{shareError}</span>
              </div>
            )}

            {/* Form Body */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4 no-scrollbar">
              {/* Select Workout to Attach */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Navigation size={13} className="text-emerald-500" />
                    Attach Workout {selectedWorkoutToShare ? '(Selected)' : '(Optional)'}
                  </label>
                  {selectedWorkoutToShare && (
                    <button
                      type="button"
                      onClick={() => setSelectedWorkoutToShare(null)}
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
                      const isSelected = selectedWorkoutToShare?.id === w.id;
                      return (
                        <div
                          key={w.id}
                          onClick={() => setSelectedWorkoutToShare(isSelected ? null : w)}
                          className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between text-xs ${isSelected
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
                  {sharePhotoUrl && (
                    <button
                      type="button"
                      onClick={() => setSharePhotoUrl('')}
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
                      onClick={() => setSharePhotoUrl(preset.url)}
                      className={`relative rounded-xl overflow-hidden h-14 border transition-all cursor-pointer ${sharePhotoUrl === preset.url
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
                {sharePhotoUrl && (
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shareBurnStats}
                      onChange={(e) => setShareBurnStats(e.target.checked)}
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
                    onClick={() => setShareVisibility('public')}
                    className={`py-2 px-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      shareVisibility === 'public'
                        ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-500/25 ring-2 ring-emerald-500/20'
                        : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 hover:border-slate-300'
                    }`}
                  >
                    <Globe size={14} /> Global
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareVisibility('friends')}
                    className={`py-2 px-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      shareVisibility === 'friends'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/25 ring-2 ring-blue-500/20'
                        : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 hover:border-slate-300'
                    }`}
                  >
                    <Users size={14} /> Squad
                  </button>
                  <button
                    type="button"
                    onClick={() => setShareVisibility('private')}
                    className={`py-2 px-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                      shareVisibility === 'private'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm shadow-amber-500/25 ring-2 ring-amber-500/20'
                        : 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 hover:border-slate-300'
                    }`}
                  >
                    <Lock size={14} /> Private
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {shareVisibility === 'public' && '🌐 Visible to everyone across the global community feed & leaderboards.'}
                  {shareVisibility === 'friends' && '👥 Visible only to your squad members & friends in the Squad feed.'}
                  {shareVisibility === 'private' && '🔒 Private to you only. Hidden from all other community feeds.'}
                </p>
              </div>

              {/* Caption / War Cry with quick @mention chips */}
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  War Cry / Caption:
                </label>
                <textarea
                  value={shareCaption}
                  onChange={(e) => setShareCaption(e.target.value)}
                  placeholder={
                    selectedWorkoutToShare
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
                      onClick={() => setShareCaption((prev: string) => (prev ? `${prev} ${chip}` : chip))}
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
                onClick={() => setShowShareModal(false)}
                className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingPost || (!selectedWorkoutToShare && !shareCaption.trim() && !sharePhotoUrl)}
                onClick={handlePublishPost}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold disabled:opacity-50 hover:opacity-90 active:scale-[0.98] transition-all shadow-md shadow-emerald-500/25 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {submittingPost ? (
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
      )}
    </div>
  );
};
