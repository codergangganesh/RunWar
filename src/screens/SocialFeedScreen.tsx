import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Flame,
  ChevronLeft,
  RefreshCw,
  Plus,
  Filter,
  Check,
} from 'lucide-react';
import {
  socialService,
  FeedPost,
  LeaderboardEntry,
  TerritoryZone,
  ReactionType,
  AthleteProfileData,
  isUUID,
} from '../services/socialService';
import { UserProfile, Workout } from '../types';
import { formatDistance, formatDuration, formatPaceRaw } from '../utils/formatters';
import { normalizeUserId } from '../services/authService';

// Modular decomposed social components
import { FeedSkeletonCard } from '../components/social/SocialSkeletons';
import { FeedPostCard } from '../components/social/FeedPostCard';
import { TerritoryMapCard } from '../components/social/TerritoryMapCard';
import { LeaderboardView } from '../components/social/LeaderboardView';
import { AthleteProfileModal } from '../components/social/AthleteProfileModal';
import { TerritoryChallengeModal } from '../components/social/TerritoryChallengeModal';
import { CreatePostModal } from '../components/social/CreatePostModal';
import { EditPostModal } from '../components/social/EditPostModal';
import { DeletePostModal } from '../components/social/DeletePostModal';

interface SocialFeedScreenProps {
  profile: UserProfile | null;
  userWorkouts: Workout[];
  onSelectWorkout?: (workout: Workout) => void;
  onSelectPost?: (post: FeedPost) => void;
  onBack?: () => void;
}

type SocialTab = 'feed' | 'leaderboard' | 'territories';

export const SocialFeedScreen: React.FC<SocialFeedScreenProps> = ({
  profile,
  userWorkouts = [],
  onSelectWorkout,
  onSelectPost,
  onBack,
}) => {
  const [tab, setTab] = useState<SocialTab>('feed');
  const [posts, setPosts] = useState<FeedPost[]>(() => socialService.getFeedPosts());
  const [isLoadingFeed, setIsLoadingFeed] = useState<boolean>(true);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState<boolean>(true);

  // Leaderboard Filtering & Categorization State
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'all'>('week');
  const [leaderboardCategory, setLeaderboardCategory] = useState<'distance' | 'pace' | 'territories'>('distance');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() =>
    socialService.calculateLeaderboard(userWorkouts, profile, timeframe, leaderboardCategory)
  );

  const [territories, setTerritories] = useState<TerritoryZone[]>(() =>
    socialService.calculateTerritories(userWorkouts, profile)
  );
  const [expandedMapZoneIds, setExpandedMapZoneIds] = useState<{ [zoneId: string]: boolean }>({});

  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});
  const [expandedComments, setExpandedComments] = useState<{ [postId: string]: boolean }>({});
  const [expandedSplits, setExpandedSplits] = useState<{ [postId: string]: boolean }>({});
  const [expandedPostMaps, setExpandedPostMaps] = useState<{ [postId: string]: boolean }>({});
  const [activePostMenu, setActivePostMenu] = useState<string | null>(null);

  // Modals & Sheets State
  const [selectedAthlete, setSelectedAthlete] = useState<AthleteProfileData | null>(null);
  const [challengeModalSector, setChallengeModalSector] = useState<any | null>(null);

  // Full Edit Post State
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

  // Create Post Modal State
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
      } finally {
        if (isMounted) {
          setIsLoadingFeed(false);
          setIsLoadingLeaderboard(false);
        }
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

  const toggleComments = async (postId: string) => {
    const isExpanding = !expandedComments[postId];
    setExpandedComments((prev: Record<string, boolean>) => ({
      ...prev,
      [postId]: isExpanding,
    }));

    if (isExpanding) {
      try {
        const freshComments = await socialService.fetchCommentsForPost(postId, profile);
        if (freshComments && Array.isArray(freshComments)) {
          setPosts((prevPosts) =>
            prevPosts.map((p) => {
              if (p.id === postId) {
                const freshIds = new Set(freshComments.map((c) => c.id));
                const merged = [
                  ...freshComments,
                  ...(p.comments || []).filter((c) => !freshIds.has(c.id)),
                ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                return {
                  ...p,
                  comments: merged,
                  commentsCount: merged.length,
                };
              }
              return p;
            })
          );
        }
      } catch (err) {
        console.warn('Could not refresh post comments:', err);
      }
    }
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

  // Add Comment Handler
  const handleAddComment = async (postId: string) => {
    const text = commentInputs[postId];
    if (!text || !text.trim()) return;

    const updated = await socialService.addComment(postId, text, profile);
    setPosts(updated);
    setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
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

        if (
          feedFilter !== 'all' &&
          ((feedFilter === 'public' && editVisibility !== 'public') ||
            (feedFilter === 'friends' && editVisibility !== 'friends') ||
            (feedFilter === 'private' && editVisibility !== 'private'))
        ) {
          setFeedFilter('all');
        }

        setEditingPost(null);

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
        setReportToast('Post deleted');
        setTimeout(() => setReportToast(null), 2000);

        socialService.getLeaderboardAsync(userWorkouts, profile, timeframe, leaderboardCategory).then((updatedLb) => {
          setLeaderboard(updatedLb);
        });
      } else {
        setReportToast('Failed to delete post');
        setTimeout(() => setReportToast(null), 2000);
      }
    } catch (err: any) {
      console.error('Failed to delete post:', err);
      setReportToast('Failed to delete post');
      setTimeout(() => setReportToast(null), 2000);
    } finally {
      setDeletingPost(false);
    }
  };

  // Report Post
  const handleReportPost = (_postId: string) => {
    setReportToast('Post flagged for community review');
    setTimeout(() => setReportToast(null), 2000);
  };

  // Share Post: Copy link to clipboard
  const handleSharePostClick = async (targetPost: FeedPost) => {
    const details = socialService.getPostShareDetails(targetPost);
    let copied = false;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(details.url);
        copied = true;
      } catch { }
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
        copied = true;
      } catch { }
    }

    setReportToast('Link copied to clipboard! 📋');
    setTimeout(() => setReportToast(null), 2500);
  };

  // Format clean athlete display names
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

  // Open Athlete Profile modal
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
      bountyXp: 350,
      isUnderSiege: true,
      circuitType: 1,
      splitsTarget: [
        { km: 1, pace: '4:40 /km' },
        { km: 2, pace: '4:35 /km' },
        { km: 3, pace: '4:30 /km' },
      ],
    };

    setChallengeModalSector({
      name: matchingZone.name,
      commander: matchingZone.holder,
      pace: matchingZone.pace,
      km: matchingZone.km,
      streak: matchingZone.defenseStreakDays,
      difficulty: matchingZone.difficulty,
      elevationM: matchingZone.elevationM,
      bountyXp: matchingZone.bountyXp || 350,
      isUnderSiege: matchingZone.isUnderSiege,
      circuitType: matchingZone.circuitType || 1,
      coordinates: matchingZone.route_coordinates,
      splitsTarget: matchingZone.splitsTarget,
      isRealUserWorkout: matchingZone.isRealUserWorkout,
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

  // Refresh feed and leaderboard
  const handleRefresh = async () => {
    setRefreshing(true);
    setIsLoadingLeaderboard(true);
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
      setIsLoadingLeaderboard(false);
      setTimeout(() => setRefreshing(false), 300);
    }
  };

  // Publish workout post
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
      setPosts((prev) => [newPost, ...prev.filter((p) => p.id !== newPost.id)]);
      setShowShareModal(false);
      setSelectedWorkoutToShare(null);
      setShareCaption('');
      setSharePhotoUrl('');

      const audienceLabel =
        shareVisibility === 'private'
          ? 'Only Me (Private)'
          : shareVisibility === 'friends'
            ? 'Squad'
            : 'Global';
      setReportToast(`Post published to ${audienceLabel}`);
      setTimeout(() => setReportToast(null), 2000);

      if (feedFilter !== 'all' && feedFilter !== shareVisibility) {
        setFeedFilter(shareVisibility);
      }

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

      {/* Global Toast — portal to body, top center */}
      {reportToast &&
        (() => {
          const isDark = document.documentElement.classList.contains('dark');
          return createPortal(
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 2147483647, display: 'flex', justifyContent: 'center', paddingTop: 16, pointerEvents: 'none' }}>
              <div style={{
                background: isDark ? '#1e293b' : '#0f172a',
                color: '#fff',
                padding: '10px 20px',
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: isDark ? '0 8px 30px rgba(0,0,0,0.5)' : '0 8px 30px rgba(0,0,0,0.2)',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)',
                pointerEvents: 'auto',
                animation: 'toastIn 0.25s ease-out',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                <span>{reportToast}</span>
              </div>
            </div>,
            document.body
          );
        })()}

      {/* Tabs Bar & Global Filter Bar */}
      <div className="px-3 sm:px-5 py-2.5 bg-white/70 dark:bg-slate-950/40 border-b border-slate-200/60 dark:border-white/[0.05]">
        <div className="flex items-center gap-2 w-full">
          {/* 3 Tabs */}
          <div className="grid grid-cols-3 gap-1.5 flex-1 min-w-0">
            {/* Tab 1: Activity Feed */}
            <button
              onClick={() => setTab('feed')}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-bold transition-all cursor-pointer min-w-0 ${
                tab === 'feed'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 ring-1 ring-emerald-500/30'
                  : 'bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/70 hover:border-emerald-400'
              }`}
            >
              <span className="truncate">Feed</span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                  tab === 'feed'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400'
                }`}
              >
                {visiblePosts.length}
              </span>
            </button>

            {/* Tab 2: Leaderboard */}
            <button
              onClick={() => setTab('leaderboard')}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-bold transition-all cursor-pointer min-w-0 ${
                tab === 'leaderboard'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 ring-1 ring-emerald-500/30'
                  : 'bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/70 hover:border-emerald-400'
              }`}
            >
              <span className="truncate">Rankings</span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                  tab === 'leaderboard'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400'
                }`}
              >
                {visibleLeaderboard.length}
              </span>
            </button>

            {/* Tab 3: Territories */}
            <button
              onClick={() => setTab('territories')}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-full text-[11px] sm:text-xs font-bold transition-all cursor-pointer min-w-0 ${
                tab === 'territories'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 ring-1 ring-emerald-500/30'
                  : 'bg-white dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/70 hover:border-emerald-400'
              }`}
            >
              <span className="truncate">Territories</span>
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${
                  tab === 'territories'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-400'
                }`}
              >
                {visibleTerritories.length}
              </span>
            </button>
          </div>

          {/* Filter Option */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className={`flex items-center gap-1.5 px-3 py-2 sm:py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                feedFilter !== 'all'
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
                    className={`w-full px-3.5 py-2 text-left flex items-center justify-between hover:bg-slate-100 dark:hover:bg-white/[0.06] capitalize cursor-pointer ${
                      feedFilter === filterOpt
                        ? 'text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-500/5'
                        : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>{filterOpt === 'all' ? 'All (No Filter)' : filterOpt}</span>
                    {feedFilter === filterOpt && <Check size={14} className="text-emerald-500" />}
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
            {isLoadingFeed ? (
              <div className="space-y-4">
                <FeedSkeletonCard />
                <FeedSkeletonCard />
                <FeedSkeletonCard />
              </div>
            ) : visiblePosts.length === 0 ? (
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
              visiblePosts.map((post) => (
                <FeedPostCard
                  key={post.id}
                  post={post}
                  profile={profile}
                  isCommentsExpanded={Boolean(expandedComments[post.id])}
                  commentCount={post.commentsCount ?? (post.comments ? post.comments.length : 0)}
                  commentInput={commentInputs[post.id] || ''}
                  isMapExpanded={Boolean(expandedPostMaps[post.id])}
                  isSplitsExpanded={Boolean(expandedSplits[post.id])}
                  isMenuOpen={activePostMenu === post.id}
                  onToggleMenu={() => setActivePostMenu(activePostMenu === post.id ? null : post.id)}
                  onToggleComments={() => toggleComments(post.id)}
                  onToggleMap={() => setExpandedPostMaps((prev) => ({ ...prev, [post.id]: !prev[post.id] }))}
                  onToggleSplits={() => setExpandedSplits((prev) => ({ ...prev, [post.id]: !prev[post.id] }))}
                  onCommentInputChange={(text) => setCommentInputs({ ...commentInputs, [post.id]: text })}
                  onReaction={handleReaction}
                  onAddComment={handleAddComment}
                  onDeleteComment={handleDeleteComment}
                  onSharePostClick={handleSharePostClick}
                  onOpenAthleteProfile={handleOpenAthleteProfile}
                  onOpenChallenge={handleOpenChallenge}
                  onEditPost={(p) => {
                    setEditingPost(p);
                    setEditSelectedWorkout(
                      p.workout && !p.workout.id?.startsWith('w_post_') && Number(p.workout.distance_meters || 0) > 0
                        ? p.workout
                        : null
                    );
                    setEditCaption(p.caption || '');
                    setEditVisibility(p.visibility || 'public');
                    setEditPhotoUrl(p.photoUrl || '');
                    setEditBurnStats(Boolean(p.hasPhotoStatsOverlay));
                    setEditError(null);
                    setActivePostMenu(null);
                  }}
                  onDeletePost={(postId) => {
                    setPostToDelete(postId);
                    setActivePostMenu(null);
                  }}
                  onReportPost={handleReportPost}
                  onSelectWorkout={onSelectWorkout}
                  onSelectPost={onSelectPost}
                  formatDisplayName={formatDisplayName}
                  formatCommentTime={formatCommentTime}
                  renderWithMentions={renderWithMentions}
                  getWorkoutMetrics={getWorkoutMetrics}
                />
              ))
            )}
          </div>
        )}

        {/* TAB 2: GLOBAL LEADERBOARD */}
        {tab === 'leaderboard' && (
          <LeaderboardView
            leaderboard={visibleLeaderboard}
            isLoading={isLoadingLeaderboard}
            category={leaderboardCategory}
            timeframe={timeframe}
            showTimeframeMenu={showTimeframeMenu}
            feedFilter={feedFilter}
            onCategoryChange={setLeaderboardCategory}
            onToggleTimeframeMenu={() => setShowTimeframeMenu(!showTimeframeMenu)}
            onSelectTimeframe={(tf) => {
              setTimeframe(tf);
              setShowTimeframeMenu(false);
            }}
            onOpenAthleteProfile={handleOpenAthleteProfile}
            formatDisplayName={formatDisplayName}
          />
        )}

        {/* TAB 3: TERRITORIES */}
        {tab === 'territories' && (
          <div className="space-y-3 pt-1">
            <div className="space-y-3.5">
              {visibleTerritories.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 dark:text-white/40">
                  No territories found for "{feedFilter}" filter.
                </div>
              ) : (
                visibleTerritories.map((zone) => (
                  <TerritoryMapCard
                    key={zone.id}
                    zone={zone}
                    isMapExpanded={Boolean(expandedMapZoneIds[zone.id])}
                    onToggleMap={() =>
                      setExpandedMapZoneIds((prev) => ({ ...prev, [zone.id]: !prev[zone.id] }))
                    }
                    onOpenAthleteProfile={handleOpenAthleteProfile}
                    onOpenChallenge={handleOpenChallenge}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ATHLETE QUICK PROFILE MODAL BOTTOM SHEET */}
      <AthleteProfileModal
        athlete={selectedAthlete}
        onClose={() => setSelectedAthlete(null)}
        onCheer={(name) => {
          setSelectedAthlete(null);
          setReportToast(`Cheer sent to ${name}`);
          setTimeout(() => setReportToast(null), 2000);
        }}
        onChallenge={(sector, name) => {
          setSelectedAthlete(null);
          handleOpenChallenge(sector, name);
        }}
      />

      {/* TERRITORY CHALLENGE BOTTOM SHEET */}
      <TerritoryChallengeModal
        sector={challengeModalSector}
        onClose={() => setChallengeModalSector(null)}
        onLaunchChallenge={handleLaunchChallenge}
      />

      {/* FULL EDIT POST BOTTOM SHEET DRAWER */}
      <EditPostModal
        post={editingPost}
        onClose={() => setEditingPost(null)}
        userWorkouts={userWorkouts}
        selectedWorkout={editSelectedWorkout}
        onSelectWorkout={setEditSelectedWorkout}
        caption={editCaption}
        onCaptionChange={setEditCaption}
        photoUrl={editPhotoUrl}
        onPhotoUrlChange={setEditPhotoUrl}
        burnStats={editBurnStats}
        onBurnStatsChange={setEditBurnStats}
        visibility={editVisibility}
        onVisibilityChange={setEditVisibility}
        isSaving={savingEdit}
        error={editError}
        onSave={handleSaveEditPost}
        getWorkoutMetrics={getWorkoutMetrics}
      />

      {/* CREATE POST MODAL */}
      <CreatePostModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        userWorkouts={userWorkouts}
        selectedWorkout={selectedWorkoutToShare}
        onSelectWorkout={setSelectedWorkoutToShare}
        caption={shareCaption}
        onCaptionChange={setShareCaption}
        photoUrl={sharePhotoUrl}
        onPhotoUrlChange={setSharePhotoUrl}
        burnStats={shareBurnStats}
        onBurnStatsChange={setShareBurnStats}
        visibility={shareVisibility}
        onVisibilityChange={setShareVisibility}
        isSubmitting={submittingPost}
        error={shareError}
        onSubmit={handlePublishPost}
        getWorkoutMetrics={getWorkoutMetrics}
      />

      {/* DELETE POST CONFIRMATION MODAL */}
      <DeletePostModal
        isOpen={Boolean(postToDelete)}
        onClose={() => setPostToDelete(null)}
        onConfirm={handleConfirmDeletePost}
        isDeleting={deletingPost}
      />
    </div>
  );
};
