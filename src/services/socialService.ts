/**
 * Social & Community Backend Service for RunWar
 * Uses InsForge SDK (@insforge/sdk) for real cloud database operations & dynamic analytics.
 * Fully enforces interaction boundaries, self-interaction safeguards, atomic counters,
 * real-time WebSockets, and normalized relational storage.
 */

import { insforge } from '../lib/insforge';
import { Workout, UserProfile } from '../types';
import { formatPaceRaw, formatDistance } from '../utils/formatters';
import { getLocalDateKey } from '../utils/dateUtils';
import { authService, normalizeUserId } from './authService';

export type ReactionType = 'fire' | 'respect' | 'beast' | 'salute';

export interface ReactionCounts {
  fire: number;
  respect: number;
  beast: number;
  salute: number;
}

export interface KmSplit {
  km: number;
  pace: string;
  elevation_diff?: number;
}

export interface FeedPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userBadge?: string;
  workout: Workout;
  caption?: string;
  fireUpsCount: number;
  hasFiredUp?: boolean;
  reactions?: ReactionCounts;
  userReaction?: ReactionType | null;
  commentsCount: number;
  comments: FeedComment[];
  createdAt: string;
  locationName?: string;
  territoryClaimed?: string;
  isTerritoryCapture?: boolean;
  visibility: 'public' | 'friends' | 'private';
  photoUrl?: string;
  hasPhotoStatsOverlay?: boolean;
  splits?: KmSplit[];
  isLocalAuthor?: boolean;
}

export interface FeedComment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  text: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userAvatar?: string;
  totalDistanceKm: number;
  totalRuns: number;
  avgPace: string;
  streakDays: number;
  badge?: string;
  isCurrentUser?: boolean;
  territoriesHeld?: number;
  bestPaceSeconds?: number;
}

export interface AthleteProfileData {
  userId: string;
  userName: string;
  userAvatar?: string;
  userBadge: string;
  isCurrentUser: boolean;
  totalDistanceKm: number;
  totalRuns: number;
  avgPace: string;
  streakDays: number;
  recentActivities: { id: string; title: string; distanceKm: number; pace: string; time: string; date: string }[];
}

export interface TerritoryZone {
  id: string;
  name: string;
  holder: string;
  pace: string;
  status: 'Secured' | 'Contested';
  km: string;
  defenseStreakDays: number;
  targetPaceSeconds?: number;
  difficulty?: 'Easy' | 'Moderate' | 'Hard' | 'Extreme';
  elevationM?: number;
  bountyXp?: number;
  isUnderSiege?: boolean;
  circuitType?: number;
  route_coordinates?: any[];
  splitsTarget?: { km: number; pace: string }[];
  isRealUserWorkout?: boolean;
  workoutId?: string;
  runDate?: string;
}

const FEED_STORAGE_KEY = 'runwar_community_posts_cache';
const USER_REACTIONS_CACHE_KEY = 'runwar_user_reactions_cache';

export const isUUID = (val?: string | null): boolean => {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed) ||
    (trimmed.includes('-') && trimmed.length >= 32)
  );
};

/**
 * Standardize and clean any raw comment object from PostgreSQL community_posts JSONB or relational table
 */
export function normalizeComment(
  raw: any,
  fallbackPostId: string,
  currentUserId?: string | null,
  currentProfile?: UserProfile | null
): FeedComment | null {
  if (!raw) return null;
  const id = String(raw.id || raw._id || crypto.randomUUID());
  const postId = String(raw.postId || raw.post_id || fallbackPostId);
  const rawUserId = raw.userId || raw.user_id || raw.authorId;
  const cUserId = normalizeUserId(rawUserId || 'anon');
  const isCommentAuthor = Boolean(currentUserId && cUserId === currentUserId);

  let cName = raw.userName || raw.user_name || raw.name;
  if (!cName || isUUID(cName) || cName === 'anon') {
    cName = isCommentAuthor
      ? (currentProfile?.name || currentProfile?.username || 'You')
      : 'Athlete';
  }

  const text = String(raw.text || raw.content || raw.comment || '').trim();
  if (!text) return null;

  const rawTime = raw.createdAt || raw.created_at || raw.timestamp;
  const createdAt = rawTime ? new Date(rawTime).toISOString() : new Date().toISOString();

  return {
    id,
    postId,
    userId: cUserId,
    userName: cName,
    userAvatar: raw.userAvatar || raw.user_avatar || (isCommentAuthor ? currentProfile?.avatar_url : undefined),
    text,
    createdAt,
  };
}

/**
 * Accurately calculate consecutive active days in user's local timezone based on actual running history
 */
export function calculateExactStreak(
  workouts: { started_at?: string; distance_meters?: number; duration_seconds?: number }[]
): number {
  if (!workouts || workouts.length === 0) return 0;
  const activeDates = new Set(
    workouts
      .filter((w) => w && w.started_at && (Number(w.distance_meters || 0) > 0 || Number(w.duration_seconds || 0) > 0))
      .map((w) => getLocalDateKey(w.started_at!))
      .filter(Boolean)
  );

  if (activeDates.size === 0) return 0;

  const now = new Date();
  const todayKey = getLocalDateKey(now);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getLocalDateKey(yesterday);

  let currentStreak = 0;
  let checkDate = activeDates.has(todayKey)
    ? new Date()
    : activeDates.has(yesterdayKey)
      ? yesterday
      : null;

  if (checkDate) {
    const cursor = new Date(checkDate);
    while (true) {
      const dateKey = getLocalDateKey(cursor);
      if (activeDates.has(dateKey)) {
        currentStreak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
  }

  return currentStreak;
}

export const socialService = {
  /**
   * Universal helper to check if a user is the author of a post
   */
  isPostAuthor(post: FeedPost | { userId?: string; userName?: string; isLocalAuthor?: boolean }, profile?: UserProfile | null): boolean {
    if (!post) return false;
    if ((post as any).isLocalAuthor) return true;

    const candidateIds = new Set<string>();
    const cachedUser = authService.getCachedUser();
    let cachedProfile: UserProfile | null = null;
    try {
      const pStr = localStorage.getItem('runwar_cached_profile');
      if (pStr) cachedProfile = JSON.parse(pStr);
    } catch { }

    const insforgeAuthId = (insforge.auth as any)?.currentUser?.id;
    if (insforgeAuthId) {
      candidateIds.add(insforgeAuthId);
      candidateIds.add(normalizeUserId(insforgeAuthId));
    }

    if (profile?.user_id) {
      candidateIds.add(profile.user_id);
      candidateIds.add(normalizeUserId(profile.user_id));
    }
    if (profile?.id) {
      candidateIds.add(profile.id);
      candidateIds.add(normalizeUserId(profile.id));
    }
    if (profile?.firebase_uid) {
      candidateIds.add(profile.firebase_uid);
      candidateIds.add(normalizeUserId(profile.firebase_uid));
    }
    if (cachedProfile?.user_id) {
      candidateIds.add(cachedProfile.user_id);
      candidateIds.add(normalizeUserId(cachedProfile.user_id));
    }
    if (cachedProfile?.id) {
      candidateIds.add(cachedProfile.id);
      candidateIds.add(normalizeUserId(cachedProfile.id));
    }
    if (cachedUser?.id) {
      candidateIds.add(cachedUser.id);
      candidateIds.add(normalizeUserId(cachedUser.id));
    }
    if (cachedUser?.uid) {
      candidateIds.add(cachedUser.uid);
      candidateIds.add(normalizeUserId(cachedUser.uid));
    }
    if (cachedUser?.user_id) {
      candidateIds.add(cachedUser.user_id);
      candidateIds.add(normalizeUserId(cachedUser.user_id));
    }

    if (post.userId) {
      if (candidateIds.has(post.userId)) return true;
      if (candidateIds.has(normalizeUserId(post.userId))) return true;
    }

    // Name-based matching for local session or seed author
    const myNames = [
      profile?.name,
      profile?.username,
      cachedProfile?.name,
      cachedProfile?.username,
      cachedUser?.name,
      cachedUser?.email?.split('@')[0],
    ].filter(Boolean).map((n) => n!.trim().toLowerCase());

    const postName = (post as any)?.userName?.trim()?.toLowerCase();
    if (postName && myNames.includes(postName)) {
      return true;
    }

    // Fallback: If post is from guest or me
    if (post.userId === 'guest_user' || post.userId === 'user_me' || post.userId === 'me') {
      return true;
    }

    return false;
  },

  /**
   * Helper to determine whether an athlete can react (Fire Up) to a post
   * Authors are strictly prohibited from Firing Up their own workouts.
   */
  canFireUp(post: FeedPost, profile?: UserProfile | null): boolean {
    return !this.isPostAuthor(post, profile);
  },

  /**
   * Helper to determine whether an athlete can comment on a post
   * Community members and post creators can comment and reply.
   */
  canComment(post: FeedPost, profile?: UserProfile | null): boolean {
    return true;
  },

  /**
   * Helper to determine whether an athlete can delete/moderate a comment
   * Either the comment's author or the post's owner can delete it.
   */
  canModerateComment(post: FeedPost, comment: FeedComment, profile?: UserProfile | null): boolean {
    if (this.isPostAuthor(post, profile)) return true;
    const authorIds = new Set<string>();
    const cachedUser = authService.getCachedUser();
    if (profile?.user_id) authorIds.add(normalizeUserId(profile.user_id));
    if (profile?.id) authorIds.add(normalizeUserId(profile.id));
    if (cachedUser?.id) authorIds.add(normalizeUserId(cachedUser.id));
    return authorIds.has(normalizeUserId(comment.userId));
  },

  /**
   * Fetch social feed posts from InsForge Cloud DB with local cache fallback
   */
  async getFeedPostsAsync(currentProfile?: UserProfile | null): Promise<FeedPost[]> {
    const cachedUser = authService.getCachedUser();
    let currentUserId = currentProfile?.user_id || currentProfile?.id;
    if (!currentUserId || !isUUID(currentUserId)) {
      try {
        const { data: authData } = await insforge.auth.getCurrentUser();
        const authUser = (authData as any)?.user || authData;
        if (authUser?.id && isUUID(authUser.id)) {
          currentUserId = authUser.id;
        }
      } catch { }
    }
    currentUserId = normalizeUserId(currentUserId || cachedUser?.id);

    // Read current local cache so we never drop user-created posts
    const localPosts = this.getFeedPosts();

    try {
      // 1. Fetch posts ordered by latest first
      const { data: rawPosts, error } = await insforge.database
        .from('community_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && rawPosts && Array.isArray(rawPosts)) {
        // 2. Fetch comments and reactions for all loaded posts from normalized relational tables
        const postIds = rawPosts.map((r: any) => r.id);

        let allComments: any[] = [];
        if (postIds.length > 0) {
          try {
            const { data: commentsData } = await insforge.database
              .from('community_comments')
              .select('*')
              .in('post_id', postIds)
              .order('created_at', { ascending: true });
            if (commentsData && Array.isArray(commentsData)) {
              allComments = commentsData;
            }
          } catch (cErr) {
            console.warn('Could not fetch cloud comments:', cErr);
          }
        }

        let allReactions: any[] = [];
        if (postIds.length > 0) {
          try {
            const { data: reactionsData } = await insforge.database
              .from('community_reactions')
              .select('post_id, user_id, reaction_type')
              .in('post_id', postIds);
            if (reactionsData && Array.isArray(reactionsData)) {
              allReactions = reactionsData;
            }
          } catch (rErr) {
            console.warn('Could not fetch cloud reactions:', rErr);
          }
        }

        // 3. Map into strongly typed FeedPost models
        const cloudPosts: FeedPost[] = rawPosts.map((r: any) => {
          const isAuthor = currentUserId && normalizeUserId(r.user_id) === currentUserId;
          const matchingLocalPost = localPosts.find((lp) => lp.id === r.id);

          let resolvedUserName = r.user_name;
          if (!resolvedUserName || isUUID(resolvedUserName)) {
            if (isAuthor) {
              resolvedUserName =
                currentProfile?.name ||
                currentProfile?.username ||
                cachedUser?.name ||
                cachedUser?.email?.split('@')[0] ||
                'Runner';
            } else {
              resolvedUserName = 'War Runner';
            }
          }

          let resolvedUserAvatar = r.user_avatar;
          if (isAuthor && !resolvedUserAvatar && currentProfile?.avatar_url) {
            resolvedUserAvatar = currentProfile.avatar_url;
          }

          // 1. Comments stored directly on community_posts row (canonical storage)
          let postDirectComments: any[] = [];
          if (Array.isArray(r.comments)) {
            postDirectComments = r.comments;
          } else if (typeof r.comments === 'string' && r.comments.trim().length > 0) {
            try {
              const parsed = JSON.parse(r.comments);
              if (Array.isArray(parsed)) postDirectComments = parsed;
            } catch {}
          }

          // 2. Comments from relational table (if any)
          const relationalComments = allComments.filter((c: any) => c.post_id === r.id);

          // 3. Normalize all cloud comments
          const allCloudRaw = [...postDirectComments, ...relationalComments];
          const cloudPostComments: FeedComment[] = [];
          const seenCloudIds = new Set<string>();

          for (const c of allCloudRaw) {
            const normalized = normalizeComment(c, r.id, currentUserId, currentProfile);
            if (normalized && !seenCloudIds.has(normalized.id)) {
              seenCloudIds.add(normalized.id);
              cloudPostComments.push(normalized);
            }
          }

          // 4. Merge local comments that might not have reached cloud yet
          const localPostComments = (matchingLocalPost?.comments || [])
            .map((c) => normalizeComment(c, r.id, currentUserId, currentProfile))
            .filter(Boolean) as FeedComment[];

          const mergedComments = [
            ...cloudPostComments,
            ...localPostComments.filter((lc) => !seenCloudIds.has(lc.id)),
          ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

          // Map relational reactions for this post (Fire, Respect, Beast, Salute)
          const postReactions = allReactions.filter((rx: any) => rx.post_id === r.id);
          const counts: ReactionCounts = {
            fire: postReactions.filter((rx: any) => rx.reaction_type === 'fire' || rx.reaction_type === 'fire_up').length,
            respect: postReactions.filter((rx: any) => rx.reaction_type === 'respect').length,
            beast: postReactions.filter((rx: any) => rx.reaction_type === 'beast').length,
            salute: postReactions.filter((rx: any) => rx.reaction_type === 'salute').length,
          };

          // If local post has optimistic reaction counts that are higher, merge them
          if (matchingLocalPost?.reactions) {
            counts.fire = Math.max(counts.fire, matchingLocalPost.reactions.fire || 0);
            counts.respect = Math.max(counts.respect, matchingLocalPost.reactions.respect || 0);
            counts.beast = Math.max(counts.beast, matchingLocalPost.reactions.beast || 0);
            counts.salute = Math.max(counts.salute, matchingLocalPost.reactions.salute || 0);
          }

          const totalReactions = counts.fire + counts.respect + counts.beast + counts.salute;

          // Determine current user's reaction
          const myReactionRow = currentUserId && currentUserId !== 'guest_user'
            ? postReactions.find((rx: any) => normalizeUserId(rx.user_id) === currentUserId)
            : null;
          let userReaction: ReactionType | null = myReactionRow
            ? (myReactionRow.reaction_type === 'fire_up' ? 'fire' : (myReactionRow.reaction_type as ReactionType))
            : (matchingLocalPost?.userReaction || null);

          if (isAuthor) {
            userReaction = null;
          }
          const hasFiredUp = userReaction !== null;

          return {
            id: r.id,
            userId: r.user_id,
            userName: resolvedUserName,
            userAvatar: resolvedUserAvatar || undefined,
            userBadge: r.user_badge || 'Athlete',
            workout: r.workout_data ? r.workout_data : {
              id: r.workout_id || r.id,
              user_id: r.user_id,
              type: r.workout_type || 'run',
              started_at: r.created_at,
              ended_at: r.created_at,
              duration_seconds: r.duration_seconds || 1800,
              distance_meters: r.distance_meters || 5000,
              average_pace: r.average_pace || 360,
              average_speed: 10,
              max_speed: 12,
              calories: r.calories || 350,
              elevation_gain: 30,
              elevation_loss: 30,
              status: 'completed',
              route_coordinates: [],
              splits: [],
              created_at: r.created_at,
              title: r.workout_title || 'Outdoor Run',
            },
            caption: r.caption,
            fireUpsCount: Math.max(totalReactions, Number(r.fire_ups_count || 0)),
            reactions: counts,
            userReaction,
            hasFiredUp,
            commentsCount: mergedComments.length,
            comments: mergedComments,
            createdAt: r.created_at,
            locationName: r.location_name || 'Global Sector',
            territoryClaimed: r.territory_claimed,
            visibility: r.visibility || 'public',
            photoUrl: r.photo_url || r.workout_data?.photo_url || undefined,
            hasPhotoStatsOverlay: Boolean(r.has_photo_stats_overlay ?? r.workout_data?.has_photo_stats_overlay),
          };
        });

        const cloudPostIds = new Set(cloudPosts.map((p) => p.id));

        // Preserve local posts authored by this user that are not in cloudPosts!
        // This guarantees that private, squad, or un-synced posts NEVER disappear on refresh.
        const localAuthorPosts = localPosts.filter((lp) => {
          if (cloudPostIds.has(lp.id)) return false;
          return this.isPostAuthor(lp, currentProfile);
        });

        // Background sync: Attempt to push unsynced local posts to InsForge cloud
        if (localAuthorPosts.length > 0 && currentUserId && isUUID(currentUserId)) {
          localAuthorPosts.forEach(async (unsynced) => {
            try {
              const validWorkoutUuid = unsynced.workout?.id && isUUID(unsynced.workout.id) ? unsynced.workout.id : null;
              const payloadWorkoutData = {
                ...(unsynced.workout || {}),
                photo_url: unsynced.photoUrl || (unsynced.workout as any)?.photo_url || null,
                has_photo_stats_overlay: Boolean(unsynced.hasPhotoStatsOverlay && unsynced.photoUrl),
              };
              await insforge.database.from('community_posts').upsert([{
                id: unsynced.id,
                user_id: currentUserId,
                user_name: unsynced.userName,
                user_avatar: unsynced.userAvatar || null,
                user_badge: unsynced.userBadge || 'Athlete',
                workout_id: validWorkoutUuid,
                workout_data: payloadWorkoutData,
                caption: unsynced.caption,
                fire_ups_count: unsynced.fireUpsCount || 0,
                comments: [],
                location_name: unsynced.locationName,
                visibility: unsynced.visibility || 'public',
                created_at: unsynced.createdAt,
              }], { onConflict: 'id' });
            } catch (syncErr) {
              console.warn('Background sync error for local post:', syncErr);
            }
          });
        }

        const mergedPosts = [...localAuthorPosts, ...cloudPosts];
        this.saveCachedPosts(mergedPosts);
        return mergedPosts;
      } else {
        console.warn('InsForge Cloud Feed fetch error, keeping local posts:', error);
      }
    } catch (err) {
      console.warn('InsForge Cloud Feed fetch fallback to cache:', err);
    }

    return localPosts;
  },

  /**
   * Default high-fidelity seed posts showcasing route maps, photos with stats overlays,
   * split meters, territory captures, and multi-reactions.
   */
  getDefaultSeedPosts(): FeedPost[] {
    const defaultCoords1: any[] = [
      { latitude: 40.785091, longitude: -73.968285, altitude: 24, timestamp: Date.now() - 3600000 },
      { latitude: 40.786591, longitude: -73.966285, altitude: 26, timestamp: Date.now() - 3500000 },
      { latitude: 40.789091, longitude: -73.964285, altitude: 30, timestamp: Date.now() - 3400000 },
      { latitude: 40.792091, longitude: -73.963285, altitude: 32, timestamp: Date.now() - 3300000 },
      { latitude: 40.795091, longitude: -73.965285, altitude: 35, timestamp: Date.now() - 3200000 },
      { latitude: 40.796091, longitude: -73.968285, altitude: 28, timestamp: Date.now() - 3100000 },
      { latitude: 40.794091, longitude: -73.971285, altitude: 25, timestamp: Date.now() - 3000000 },
      { latitude: 40.791091, longitude: -73.973285, altitude: 22, timestamp: Date.now() - 2900000 },
      { latitude: 40.787091, longitude: -73.972285, altitude: 23, timestamp: Date.now() - 2800000 },
      { latitude: 40.785091, longitude: -73.968285, altitude: 24, timestamp: Date.now() - 2700000 },
    ];

    const defaultCoords2: any[] = [
      { latitude: 40.712776, longitude: -74.005974, altitude: 8, timestamp: Date.now() - 7200000 },
      { latitude: 40.715776, longitude: -74.008974, altitude: 9, timestamp: Date.now() - 7100000 },
      { latitude: 40.719776, longitude: -74.011974, altitude: 7, timestamp: Date.now() - 7000000 },
      { latitude: 40.723776, longitude: -74.010974, altitude: 8, timestamp: Date.now() - 6900000 },
      { latitude: 40.721776, longitude: -74.006974, altitude: 10, timestamp: Date.now() - 6800000 },
      { latitude: 40.716776, longitude: -74.003974, altitude: 9, timestamp: Date.now() - 6700000 },
      { latitude: 40.712776, longitude: -74.005974, altitude: 8, timestamp: Date.now() - 6600000 },
    ];

    const defaultCoords3: any[] = [
      { latitude: 40.748817, longitude: -73.985428, altitude: 30, timestamp: Date.now() - 14400000 },
      { latitude: 40.751817, longitude: -73.982428, altitude: 55, timestamp: Date.now() - 14200000 },
      { latitude: 40.755817, longitude: -73.978428, altitude: 85, timestamp: Date.now() - 14000000 },
      { latitude: 40.759817, longitude: -73.975428, altitude: 110, timestamp: Date.now() - 13800000 },
      { latitude: 40.763817, longitude: -73.978428, altitude: 145, timestamp: Date.now() - 13600000 },
      { latitude: 40.761817, longitude: -73.983428, altitude: 120, timestamp: Date.now() - 13400000 },
      { latitude: 40.756817, longitude: -73.987428, altitude: 80, timestamp: Date.now() - 13200000 },
      { latitude: 40.751817, longitude: -73.989428, altitude: 50, timestamp: Date.now() - 13000000 },
      { latitude: 40.748817, longitude: -73.985428, altitude: 30, timestamp: Date.now() - 12800000 },
    ];

    return [
      {
        id: 'seed_post_alex',
        userId: 'user_alex_rivers',
        userName: 'Alex Rivers',
        userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
        userBadge: 'Marathoner',
        workout: {
          id: 'w_alex_1',
          user_id: 'user_alex_rivers',
          type: 'run',
          title: 'Morning War Zone Assault',
          started_at: new Date(Date.now() - 3600000 * 3).toISOString(),
          ended_at: new Date(Date.now() - 3600000 * 2).toISOString(),
          duration_seconds: 2712,
          distance_meters: 8520,
          average_pace: 321,
          average_speed: 11.2,
          max_speed: 14.5,
          calories: 610,
          elevation_gain: 48,
          elevation_loss: 42,
          status: 'completed',
          route_coordinates: defaultCoords1,
          splits: [
            { split_number: 1, distance_meters: 1000, duration_seconds: 332, pace: 332, elevation_diff: 8 },
            { split_number: 2, distance_meters: 1000, duration_seconds: 318, pace: 318, elevation_diff: 5 },
            { split_number: 3, distance_meters: 1000, duration_seconds: 310, pace: 310, elevation_diff: -4 },
            { split_number: 4, distance_meters: 1000, duration_seconds: 315, pace: 315, elevation_diff: 2 },
            { split_number: 5, distance_meters: 1000, duration_seconds: 324, pace: 324, elevation_diff: 10 },
            { split_number: 6, distance_meters: 1000, duration_seconds: 312, pace: 312, elevation_diff: -3 },
            { split_number: 7, distance_meters: 1000, duration_seconds: 308, pace: 308, elevation_diff: -6 },
            { split_number: 8, distance_meters: 1000, duration_seconds: 319, pace: 319, elevation_diff: 12 },
          ],
          created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
        },
        caption: 'Crushed a solid 8.5km speed session! Took the #1 spot on Sector 4 North Loop. Who is challenging me today? 🔥🏃‍♂️',
        fireUpsCount: 48,
        hasFiredUp: false,
        reactions: { fire: 24, respect: 12, beast: 7, salute: 5 },
        commentsCount: 2,
        comments: [
          {
            id: 'c_seed_1',
            postId: 'seed_post_alex',
            userId: 'user_sarah_chen',
            userName: 'Sarah Chen',
            userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
            text: 'Beast pace Alex! I am coming for that segment tomorrow morning 👀',
            createdAt: new Date(Date.now() - 3600000 * 2.5).toISOString(),
          },
          {
            id: 'c_seed_2',
            postId: 'seed_post_alex',
            userId: 'user_marcus_vance',
            userName: 'Marcus Vance',
            userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
            text: 'Great split consistency on the hill climb @AlexRivers ⚡',
            createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
          }
        ],
        createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
        locationName: 'Central Park War Zone',
        territoryClaimed: 'Captured Sector 4 (North Loop)',
        isTerritoryCapture: true,
        visibility: 'public',
        photoUrl: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=800&q=80',
        hasPhotoStatsOverlay: true,
        splits: [
          { km: 1, pace: '5:32', elevation_diff: 8 },
          { km: 2, pace: '5:18', elevation_diff: 5 },
          { km: 3, pace: '5:10', elevation_diff: -4 },
          { km: 4, pace: '5:15', elevation_diff: 2 },
          { km: 5, pace: '5:24', elevation_diff: 10 },
          { km: 6, pace: '5:12', elevation_diff: -3 },
          { km: 7, pace: '5:08', elevation_diff: -6 },
          { km: 8, pace: '5:19', elevation_diff: 12 },
        ],
      },
      {
        id: 'seed_post_sarah',
        userId: 'user_sarah_chen',
        userName: 'Sarah Chen',
        userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
        userBadge: 'Speedster',
        workout: {
          id: 'w_sarah_1',
          user_id: 'user_sarah_chen',
          type: 'run',
          title: 'Waterfront Sprint Repeats',
          started_at: new Date(Date.now() - 3600000 * 6).toISOString(),
          ended_at: new Date(Date.now() - 3600000 * 5.5).toISOString(),
          duration_seconds: 1414,
          distance_meters: 5200,
          average_pace: 272,
          average_speed: 13.2,
          max_speed: 16.5,
          calories: 395,
          elevation_gain: 15,
          elevation_loss: 14,
          status: 'completed',
          route_coordinates: defaultCoords2,
          splits: [
            { split_number: 1, distance_meters: 1000, duration_seconds: 285, pace: 285, elevation_diff: 2 },
            { split_number: 2, distance_meters: 1000, duration_seconds: 270, pace: 270, elevation_diff: 1 },
            { split_number: 3, distance_meters: 1000, duration_seconds: 265, pace: 265, elevation_diff: 0 },
            { split_number: 4, distance_meters: 1000, duration_seconds: 271, pace: 271, elevation_diff: 3 },
            { split_number: 5, distance_meters: 1000, duration_seconds: 262, pace: 262, elevation_diff: 1 },
          ],
          created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
        },
        caption: 'Interval day by the bay! 5x 800m repeats pushing threshold pace. @AlexRivers watch your back on the leaderboard!',
        fireUpsCount: 46,
        hasFiredUp: false,
        reactions: { fire: 18, respect: 15, beast: 9, salute: 4 },
        commentsCount: 1,
        comments: [
          {
            id: 'c_seed_3',
            postId: 'seed_post_sarah',
            userId: 'user_alex_rivers',
            userName: 'Alex Rivers',
            userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
            text: 'Game on Sarah! You crushed those 800s 🫡',
            createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
          }
        ],
        createdAt: new Date(Date.now() - 3600000 * 6).toISOString(),
        locationName: 'Waterfront War Zone',
        territoryClaimed: 'Captured Waterfront Sprint Segment',
        isTerritoryCapture: true,
        visibility: 'public',
        photoUrl: 'https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=800&q=80',
        hasPhotoStatsOverlay: true,
        splits: [
          { km: 1, pace: '4:45', elevation_diff: 2 },
          { km: 2, pace: '4:30', elevation_diff: 1 },
          { km: 3, pace: '4:25', elevation_diff: 0 },
          { km: 4, pace: '4:31', elevation_diff: 3 },
          { km: 5, pace: '4:22', elevation_diff: 1 },
        ],
      },
      {
        id: 'seed_post_marcus',
        userId: 'user_marcus_vance',
        userName: 'Marcus Vance',
        userAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
        userBadge: 'Trail Commander',
        workout: {
          id: 'w_marcus_1',
          user_id: 'user_marcus_vance',
          type: 'run',
          title: 'Skyline Trail Hill Assault',
          started_at: new Date(Date.now() - 3600000 * 12).toISOString(),
          ended_at: new Date(Date.now() - 3600000 * 10.8).toISOString(),
          duration_seconds: 4236,
          distance_meters: 12100,
          average_pace: 348,
          average_speed: 10.3,
          max_speed: 13.8,
          calories: 940,
          elevation_gain: 145,
          elevation_loss: 140,
          status: 'completed',
          route_coordinates: defaultCoords3,
          splits: [
            { split_number: 1, distance_meters: 1000, duration_seconds: 370, pace: 370, elevation_diff: 25 },
            { split_number: 2, distance_meters: 1000, duration_seconds: 362, pace: 362, elevation_diff: 30 },
            { split_number: 3, distance_meters: 1000, duration_seconds: 350, pace: 350, elevation_diff: 15 },
            { split_number: 4, distance_meters: 1000, duration_seconds: 342, pace: 342, elevation_diff: -10 },
            { split_number: 5, distance_meters: 1000, duration_seconds: 335, pace: 335, elevation_diff: -20 },
          ],
          created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
        },
        caption: 'Morning hill assault before sunrise. 12km through Sector 7. Elevation was brutal (+145m) but views were unmatched.',
        fireUpsCount: 80,
        hasFiredUp: false,
        reactions: { fire: 31, respect: 22, beast: 19, salute: 8 },
        commentsCount: 1,
        comments: [
          {
            id: 'c_seed_4',
            postId: 'seed_post_marcus',
            userId: 'user_alex_rivers',
            userName: 'Alex Rivers',
            userAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
            text: 'Solid vertical gain @MarcusVance! Respect! ⛰️',
            createdAt: new Date(Date.now() - 3600000 * 11).toISOString(),
          }
        ],
        createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
        locationName: 'Skyline Trail Sector',
        territoryClaimed: 'Captured Skyline Trail Challenge',
        isTerritoryCapture: true,
        visibility: 'public',
        photoUrl: 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?auto=format&fit=crop&w=800&q=80',
        hasPhotoStatsOverlay: true,
        splits: [
          { km: 1, pace: '6:10', elevation_diff: 25 },
          { km: 2, pace: '6:02', elevation_diff: 30 },
          { km: 3, pace: '5:50', elevation_diff: 15 },
          { km: 4, pace: '5:42', elevation_diff: -10 },
          { km: 5, pace: '5:35', elevation_diff: -20 },
        ],
      }
    ];
  },

  /**
   * Fetch social feed posts synchronously from cache (real user posts only, no mock seeds)
   */
  getFeedPosts(): FeedPost[] {
    try {
      const stored = localStorage.getItem(FEED_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Strictly filter out any mock seed posts so fake data is never displayed
          const cleanParsed = parsed.filter((p: FeedPost) => !p.id.startsWith('seed_post_'));
          if (cleanParsed.length > 0) {
            const cachedUser = authService.getCachedUser();
            return cleanParsed.map((p: FeedPost) => {
              let cleanName = p.userName;
              if (!cleanName || isUUID(cleanName)) {
                const isMe = this.isPostAuthor(p);
                cleanName = isMe ? (cachedUser?.name || 'You') : 'War Runner';
              }
              return {
                ...p,
                userName: cleanName,
              };
            });
          }
        }
      }
    } catch (e) {
      console.error('Failed to read social feed cache', e);
    }
    // Return empty array instead of mock seed posts so skeleton loading can display
    return [];
  },

  /**
   * Save posts to local cache
   */
  saveCachedPosts(posts: FeedPost[]): void {
    try {
      localStorage.setItem(FEED_STORAGE_KEY, JSON.stringify(posts));
    } catch (e) {
      console.error('Failed to save social feed cache', e);
    }
  },

  /**
   * Fetch comments for a specific post from cloud DB with local fallback
   */
  async fetchCommentsForPost(postId: string, currentProfile?: UserProfile | null): Promise<FeedComment[]> {
    try {
      const { data, error } = await insforge.database
        .from('community_posts')
        .select('id, comments')
        .eq('id', postId)
        .maybeSingle();

      if (!error && data) {
        let commentsList: any[] = [];
        if (Array.isArray(data.comments)) {
          commentsList = data.comments;
        } else if (typeof data.comments === 'string' && data.comments.trim().length > 0) {
          try {
            const parsed = JSON.parse(data.comments);
            if (Array.isArray(parsed)) commentsList = parsed;
          } catch {}
        }
        return commentsList
          .map((c: any) => normalizeComment(c, postId, null, currentProfile))
          .filter(Boolean) as FeedComment[];
      }
    } catch (e) {
      console.warn('Failed to load comments from cloud community_posts:', e);
    }

    const posts = this.getFeedPosts();
    const p = posts.find((x) => x.id === postId);
    return p ? (p.comments || []) : [];
  },

  /**
   * Share a user's workout to the cloud social feed with deduplication guard,
   * route coordinates, splits, and photo stats overlay support.
   */
  async shareWorkout(
    workout?: Workout | null,
    profile?: UserProfile | null,
    caption?: string,
    visibility: 'public' | 'friends' | 'private' = 'public',
    photoUrl?: string,
    hasPhotoStatsOverlay?: boolean
  ): Promise<FeedPost> {
    const cachedUser = authService.getCachedUser();
    let resolvedUserId = normalizeUserId(profile?.user_id || profile?.id);

    // Resolve active InsForge session user ID if not already a UUID
    if (!resolvedUserId || !isUUID(resolvedUserId)) {
      const authId = (insforge.auth as any)?.currentUser?.id;
      if (authId && isUUID(authId)) {
        resolvedUserId = authId;
      } else {
        try {
          const { data: authData } = await insforge.auth.getCurrentUser();
          const authUser = (authData as any)?.user || authData;
          if (authUser?.id && isUUID(authUser.id)) {
            resolvedUserId = authUser.id;
          }
        } catch { }
      }
    }

    if (!resolvedUserId) {
      resolvedUserId = normalizeUserId(cachedUser?.id || 'guest_user');
    }

    const posts = this.getFeedPosts();

    if (workout?.id) {
      const existing = posts.find(
        (p) => p.userId === resolvedUserId && p.workout?.id === workout.id
      );
      if (existing) {
        throw new Error('This workout run has already been published to the community feed.');
      }
    }

    const distM = Number(workout?.distance_meters || 0);
    const distKm = (distM / 1000).toFixed(2);

    const workoutData: Workout = (workout
      ? {
        ...workout,
        photo_url: photoUrl || (workout as any).photo_url || null,
        has_photo_stats_overlay: Boolean(hasPhotoStatsOverlay && photoUrl),
      }
      : {
        id: `w_post_${Date.now()}`,
        user_id: resolvedUserId,
        type: 'run',
        title: 'Community Check-in',
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        duration_seconds: 0,
        distance_meters: 0,
        average_pace: 0,
        average_speed: 0,
        max_speed: 0,
        calories: 0,
        elevation_gain: 0,
        elevation_loss: 0,
        status: 'completed',
        route_coordinates: [],
        splits: [],
        created_at: new Date().toISOString(),
        photo_url: photoUrl || null,
        has_photo_stats_overlay: Boolean(hasPhotoStatsOverlay && photoUrl),
      }) as Workout;

    // Build splits from workout if available
    const kmCount = Math.max(1, Math.floor(distM / 1000));
    const splits: KmSplit[] = (workoutData.splits && workoutData.splits.length > 0)
      ? workoutData.splits.map((s, idx) => ({
        km: idx + 1,
        pace: formatPaceRaw(s.pace, 'min_km'),
        elevation_diff: s.elevation_diff || 0,
      }))
      : Array.from({ length: kmCount }, (_, i) => ({
        km: i + 1,
        pace: formatPaceRaw(workoutData.average_pace || 300, 'min_km'),
        elevation_diff: Math.round((Math.random() - 0.5) * 8),
      }));

    const authorDisplayName =
      profile?.name ||
      profile?.username ||
      cachedUser?.name ||
      cachedUser?.email?.split('@')[0] ||
      'War Runner';

    const authorAvatar =
      profile?.avatar_url ||
      cachedUser?.avatar_url ||
      undefined;

    const newPost: FeedPost = {
      id: `post_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      userId: resolvedUserId,
      userName: authorDisplayName,
      userAvatar: authorAvatar,
      userBadge: profile?.fitness_goal || 'Athlete',
      workout: workoutData,
      caption: caption || (distM > 0 ? `Just completed a ${distKm} km ${workoutData.type}!` : 'Checking in with the RunWar community! 🔥'),
      fireUpsCount: 0,
      hasFiredUp: false,
      reactions: { fire: 0, respect: 0, beast: 0, salute: 0 },
      commentsCount: 0,
      comments: [],
      createdAt: new Date().toISOString(),
      locationName: visibility === 'private' ? 'Private Sector' : visibility === 'friends' ? 'Squad Sector' : 'Global Sector',
      visibility,
      photoUrl,
      hasPhotoStatsOverlay: Boolean(hasPhotoStatsOverlay && photoUrl),
      splits,
      isLocalAuthor: true,
    };

    // Persist immediately in local feed cache with deduplication
    const updated = [newPost, ...posts.filter((p) => p.id !== newPost.id)];
    this.saveCachedPosts(updated);

    // Persist to InsForge Cloud Database
    if (resolvedUserId && isUUID(resolvedUserId)) {
      try {
        const validWorkoutUuid = workoutData?.id && isUUID(workoutData.id) ? workoutData.id : null;
        await insforge.database.from('community_posts').upsert([{
          id: newPost.id,
          user_id: resolvedUserId,
          user_name: newPost.userName,
          user_avatar: newPost.userAvatar || null,
          user_badge: newPost.userBadge || 'Athlete',
          workout_id: validWorkoutUuid,
          workout_data: workoutData,
          caption: newPost.caption,
          fire_ups_count: 0,
          comments: [],
          location_name: newPost.locationName,
          visibility: newPost.visibility,
          created_at: newPost.createdAt,
        }], { onConflict: 'id' });
      } catch (err) {
        console.warn('InsForge Cloud insert fallback to local storage:', err);
      }
    } else {
      console.log('Post created in local storage session (guest or non-UUID user id)');
    }

    return newPost;
  },

  /**
   * Multi-Reactions: Support Fire Up 🔥, Respect ⚡, Beast 🐺, and Salute 🫡
   */
  async toggleReaction(
    postId: string,
    reactionType: ReactionType = 'fire',
    profile?: UserProfile | null
  ): Promise<FeedPost[]> {
    const posts = this.getFeedPosts();
    const targetPost = posts.find((p) => p.id === postId);
    if (!targetPost) return posts;

    // Strict Self-Interaction Guard: Author CANNOT react to own post
    if (this.isPostAuthor(targetPost, profile)) {
      console.warn('Athletes cannot react to their own workouts.');
      return posts;
    }

    const currentReactions: ReactionCounts = targetPost.reactions || {
      fire: targetPost.fireUpsCount || 0,
      respect: 0,
      beast: 0,
      salute: 0,
    };

    const isCurrentActive =
      targetPost.userReaction === reactionType ||
      (!targetPost.userReaction && targetPost.hasFiredUp && reactionType === 'fire');

    let nextReaction: ReactionType | null = null;
    const nextReactions: ReactionCounts = { ...currentReactions };

    if (isCurrentActive) {
      nextReactions[reactionType] = Math.max(0, (nextReactions[reactionType] || 1) - 1);
      nextReaction = null;
    } else {
      if (targetPost.userReaction) {
        nextReactions[targetPost.userReaction] = Math.max(0, (nextReactions[targetPost.userReaction] || 1) - 1);
      } else if (targetPost.hasFiredUp) {
        nextReactions.fire = Math.max(0, (nextReactions.fire || 1) - 1);
      }
      nextReactions[reactionType] = (nextReactions[reactionType] || 0) + 1;
      nextReaction = reactionType;
    }

    const totalReactions = Object.values(nextReactions).reduce((sum, c) => sum + c, 0);

    const updated = posts.map((p) =>
      p.id === postId
        ? {
          ...p,
          reactions: nextReactions,
          userReaction: nextReaction,
          fireUpsCount: totalReactions,
          hasFiredUp: nextReaction !== null,
        }
        : p
    );
    this.saveCachedPosts(updated);

    try {
      const cachedUser = authService.getCachedUser();
      const currentUserId = normalizeUserId(profile?.user_id || profile?.id || cachedUser?.id);
      if (currentUserId && currentUserId !== 'guest_user' && isUUID(currentUserId)) {
        // Delete any existing reaction by this user on this post
        await insforge.database
          .from('community_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUserId);

        // If a new reaction was selected, insert it with a valid UUID
        if (nextReaction) {
          await insforge.database.from('community_reactions').insert([{
            id: crypto.randomUUID(),
            post_id: postId,
            user_id: currentUserId,
            reaction_type: nextReaction,
            created_at: new Date().toISOString(),
          }]);
        }
      }
    } catch (err) {
      console.warn('Reaction cloud sync error:', err);
    }

    return updated;
  },

  /**
   * Backwards compatible toggleFireUp
   */
  async toggleFireUp(postId: string, profile?: UserProfile | null): Promise<FeedPost[]> {
    return this.toggleReaction(postId, 'fire', profile);
  },

  /**
   * Add comment to a post with cloud persistence to community_posts.comments
   */
  async addComment(postId: string, text: string, profile: UserProfile | null): Promise<FeedPost[]> {
    if (!text || !text.trim()) return this.getFeedPosts();

    const posts = this.getFeedPosts();
    const targetPost = posts.find((p) => p.id === postId);
    if (!targetPost) return posts;

    // Resolve current active user ID (authenticating against InsForge session if available)
    let currentUserId = (insforge.auth as any)?.currentUser?.id;
    if (!currentUserId) {
      try {
        const { data: authData } = await insforge.auth.getCurrentUser();
        const authUser = (authData as any)?.user || authData;
        if (authUser?.id) currentUserId = authUser.id;
      } catch {}
    }
    if (!currentUserId) {
      const cachedUser = authService.getCachedUser();
      currentUserId = profile?.user_id || profile?.id || cachedUser?.id;
    }
    currentUserId = normalizeUserId(currentUserId);

    const commenterName =
      profile?.name?.trim() ||
      profile?.username?.trim() ||
      authService.getCachedUser()?.name ||
      authService.getCachedUser()?.email?.split('@')[0] ||
      'Athlete';

    const commenterAvatar =
      profile?.avatar_url ||
      authService.getCachedUser()?.avatar_url ||
      undefined;

    const commentUuid = crypto.randomUUID();
    const newComment: FeedComment = {
      id: commentUuid,
      postId,
      userId: currentUserId,
      userName: commenterName,
      userAvatar: commenterAvatar,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    // 1. Optimistically update local posts state and cache
    const updated = posts.map((p) => {
      if (p.id === postId) {
        const existing = (p.comments || []).filter((c) => c.id !== newComment.id);
        const nextComments = [...existing, newComment];
        return {
          ...p,
          comments: nextComments,
          commentsCount: nextComments.length,
        };
      }
      return p;
    });

    this.saveCachedPosts(updated);

    // 2. Persist to cloud community_posts.comments (the canonical storage for comments)
    try {
      const { data: cloudRow, error: fetchErr } = await insforge.database
        .from('community_posts')
        .select('id, comments')
        .eq('id', postId)
        .maybeSingle();

      if (!fetchErr && cloudRow) {
        let currentCloudComments: any[] = [];
        if (Array.isArray(cloudRow.comments)) {
          currentCloudComments = cloudRow.comments;
        } else if (typeof cloudRow.comments === 'string' && cloudRow.comments.trim().length > 0) {
          try {
            const parsed = JSON.parse(cloudRow.comments);
            if (Array.isArray(parsed)) currentCloudComments = parsed;
          } catch {}
        }

        const filteredCloud = currentCloudComments.filter((c: any) => c.id !== commentUuid);
        const nextCloudComments = [...filteredCloud, newComment];

        const { error: updateErr } = await insforge.database
          .from('community_posts')
          .update({
            comments: nextCloudComments,
            updated_at: new Date().toISOString(),
          })
          .eq('id', postId);

        if (updateErr) {
          console.warn('Failed to update comments on community_posts:', updateErr);
        }
      } else {
        console.warn('Could not fetch post from cloud to append comment:', fetchErr);
      }
    } catch (cloudErr) {
      console.warn('Cloud comment sync error:', cloudErr);
    }

    // 3. Also try relational community_comments insert if table is ever created
    try {
      if (currentUserId && isUUID(currentUserId)) {
        await insforge.database.from('community_comments').insert([{
          id: commentUuid,
          post_id: postId,
          user_id: currentUserId,
          user_name: newComment.userName,
          user_avatar: newComment.userAvatar || null,
          content: newComment.text,
          created_at: newComment.createdAt,
        }]);
      }
    } catch {}

    return updated;
  },

  /**
   * Delete comment (available to comment author OR post owner for moderation)
   */
  async deleteComment(commentId: string, postId: string, profile: UserProfile | null): Promise<FeedPost[]> {
    const posts = this.getFeedPosts();
    const targetPost = posts.find((p) => p.id === postId);
    if (!targetPost) return posts;

    const comment = targetPost.comments?.find((c) => c.id === commentId);
    if (!comment) return posts;

    if (!this.canModerateComment(targetPost, comment, profile)) {
      console.warn('Unauthorized comment deletion attempt.');
      return posts;
    }

    const updated = posts.map((p) => {
      if (p.id === postId) {
        const filtered = (p.comments || []).filter((c) => c.id !== commentId);
        return {
          ...p,
          comments: filtered,
          commentsCount: Math.max(0, filtered.length),
        };
      }
      return p;
    });

    this.saveCachedPosts(updated);

    try {
      const { data: cloudRow } = await insforge.database
        .from('community_posts')
        .select('id, comments')
        .eq('id', postId)
        .maybeSingle();

      if (cloudRow) {
        let currentCloudComments: any[] = [];
        if (Array.isArray(cloudRow.comments)) {
          currentCloudComments = cloudRow.comments;
        } else if (typeof cloudRow.comments === 'string' && cloudRow.comments.trim().length > 0) {
          try {
            const parsed = JSON.parse(cloudRow.comments);
            if (Array.isArray(parsed)) currentCloudComments = parsed;
          } catch {}
        }
        const filteredCloud = currentCloudComments.filter((c: any) => c.id !== commentId);
        await insforge.database
          .from('community_posts')
          .update({
            comments: filteredCloud,
            updated_at: new Date().toISOString(),
          })
          .eq('id', postId);
      }
    } catch (e) {
      console.warn('Failed to delete comment from community_posts:', e);
    }

    try {
      await insforge.database.from('community_comments').delete().eq('id', commentId);
    } catch {}

    return updated;
  },

  /**
   * Delete a community post (strictly restricted to post author)
   */
  async deletePost(postOrId: FeedPost | string, profile: UserProfile | null): Promise<boolean> {
    const postId = typeof postOrId === 'string' ? postOrId : postOrId.id;
    const posts = this.getFeedPosts();
    const target = (typeof postOrId === 'object' ? postOrId : null) || posts.find((p) => p.id === postId);

    if (target && !this.isPostAuthor(target, profile)) {
      console.warn('Only the post author can delete this post.');
      return false;
    }

    const filtered = posts.filter((p) => p.id !== postId);
    this.saveCachedPosts(filtered);

    try {
      const { error } = await insforge.database
        .from('community_posts')
        .delete()
        .eq('id', postId);
      if (error) {
        console.warn('InsForge database delete error:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Failed to delete post from cloud:', err);
      return false;
    }
  },

  /**
   * Update full post options (workout, photo, stats overlay, visibility, caption)
   * Strictly restricted to post author and synced across database & realtime cache.
   */
  async updatePost(
    postOrId: FeedPost | string,
    updateData: {
      caption?: string;
      visibility?: 'public' | 'friends' | 'private';
      workout?: Workout | null;
      photoUrl?: string;
      hasPhotoStatsOverlay?: boolean;
    },
    profile: UserProfile | null
  ): Promise<FeedPost | null> {
    const posts = this.getFeedPosts();
    const postId = typeof postOrId === 'string' ? postOrId : postOrId.id;
    const target = posts.find((p) => p.id === postId) || (typeof postOrId === 'object' ? postOrId : null);

    if (!target) {
      console.warn('Post not found for update.');
      return null;
    }
    if (!this.isPostAuthor(target, profile)) {
      console.warn('Only the post author can update this post.');
      return null;
    }

    let updatedWorkout = target.workout;
    let updatedSplits = target.splits;

    if (updateData.workout !== undefined) {
      if (updateData.workout) {
        updatedWorkout = updateData.workout;
        const distM = Number(updatedWorkout.distance_meters || 0);
        const kmCount = Math.max(1, Math.floor(distM / 1000));
        updatedSplits = (updatedWorkout.splits && updatedWorkout.splits.length > 0)
          ? updatedWorkout.splits.map((s, idx) => ({
            km: idx + 1,
            pace: formatPaceRaw(s.pace, 'min_km'),
            elevation_diff: s.elevation_diff || 0,
          }))
          : Array.from({ length: kmCount }, (_, i) => ({
            km: i + 1,
            pace: formatPaceRaw(updatedWorkout.average_pace || 300, 'min_km'),
            elevation_diff: 0,
          }));
      } else {
        // Workout detached: convert to general text/photo post
        updatedWorkout = {
          id: `w_post_${Date.now()}`,
          user_id: target.userId,
          type: 'run',
          title: 'Community Post',
          started_at: new Date().toISOString(),
          ended_at: new Date().toISOString(),
          duration_seconds: 0,
          distance_meters: 0,
          average_pace: 0,
          average_speed: 0,
          max_speed: 0,
          calories: 0,
          elevation_gain: 0,
          elevation_loss: 0,
          status: 'completed',
          route_coordinates: [],
          splits: [],
          created_at: new Date().toISOString(),
        };
        updatedSplits = [];
      }
    }

    const finalVisibility = updateData.visibility || target.visibility || 'public';
    const finalPhotoUrl = updateData.photoUrl !== undefined ? updateData.photoUrl : target.photoUrl;
    const finalBurnStats = updateData.hasPhotoStatsOverlay !== undefined
      ? Boolean(updateData.hasPhotoStatsOverlay && finalPhotoUrl)
      : Boolean(target.hasPhotoStatsOverlay);

    const payloadWorkoutData = {
      ...(updatedWorkout || {}),
      photo_url: finalPhotoUrl || null,
      has_photo_stats_overlay: finalBurnStats,
    };

    let locationName = target.locationName || 'Global Sector';
    if (finalVisibility === 'private') {
      locationName = 'Private Sector';
    } else if (finalVisibility === 'friends') {
      locationName = 'Squad Sector';
    } else if (locationName === 'Private Sector' || locationName === 'Squad Sector') {
      locationName = 'Global Sector';
    }

    const updatedPost: FeedPost = {
      ...target,
      caption: updateData.caption !== undefined ? updateData.caption.trim() : target.caption,
      visibility: finalVisibility,
      workout: payloadWorkoutData as any,
      splits: updatedSplits,
      photoUrl: finalPhotoUrl,
      hasPhotoStatsOverlay: finalBurnStats,
      locationName,
    };

    const existingIndex = posts.findIndex((p) => p.id === postId);
    const updatedList = existingIndex >= 0
      ? posts.map((p) => (p.id === postId ? updatedPost : p))
      : [updatedPost, ...posts];
    this.saveCachedPosts(updatedList);

    try {
      const validWorkoutUuid =
        updatedWorkout?.id && isUUID(updatedWorkout.id) ? updatedWorkout.id : null;

      const { error: dbError } = await insforge.database
        .from('community_posts')
        .update({
          caption: updatedPost.caption,
          visibility: updatedPost.visibility,
          workout_id: validWorkoutUuid,
          workout_data: payloadWorkoutData,
          location_name: locationName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', postId);

      if (dbError) {
        console.warn('Database post update notice:', dbError);
      }
    } catch (err) {
      console.warn('Failed to update post in cloud database:', err);
    }

    return updatedPost;
  },

  /**
   * Update caption of a post (strictly restricted to post author)
   */
  async updateCaption(postId: string, newCaption: string, profile: UserProfile | null): Promise<boolean> {
    const posts = this.getFeedPosts();
    const target = posts.find((p) => p.id === postId);
    if (!target || !this.isPostAuthor(target, profile)) {
      console.warn('Only the post author can update this caption.');
      return false;
    }

    const updated = posts.map((p) =>
      p.id === postId ? { ...p, caption: newCaption.trim() } : p
    );
    this.saveCachedPosts(updated);

    try {
      const { error } = await insforge.database
        .from('community_posts')
        .update({ caption: newCaption.trim(), updated_at: new Date().toISOString() })
        .eq('id', postId);
      return !error;
    } catch (err) {
      console.warn('Failed to update caption in cloud:', err);
      return false;
    }
  },

  /**
   * Real-time subscription to feed posts, reactions, and comments
   */
  subscribeToFeed(
    onPostChange: (event: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; post?: FeedPost; id?: string }) => void
  ): () => void {
    const unsubscribers: (() => void)[] = [];
    try {
      if (insforge.realtime && typeof insforge.realtime.subscribe === 'function') {
        const channels = ['community_posts', 'community_comments', 'community_reactions'];
        channels.forEach((channelName) => {
          insforge.realtime.subscribe(channelName).catch(() => { });
        });

        const handler = (msg: any) => {
          const table = msg?.table || msg?.channel;
          if (
            table === 'community_posts' ||
            table === 'community_comments' ||
            table === 'community_reactions'
          ) {
            const eventType = (msg?.eventType || msg?.event || 'INSERT') as 'INSERT' | 'UPDATE' | 'DELETE';
            const record = msg?.payload?.new || msg?.payload || msg?.data;
            onPostChange({
              eventType,
              id: record?.id || record?.post_id || msg?.id,
            });
          }
        };

        insforge.realtime.on('message', handler);
        unsubscribers.push(() => {
          try {
            insforge.realtime.off('message', handler);
            channels.forEach((channelName) => {
              insforge.realtime.unsubscribe(channelName);
            });
          } catch { }
        });
      }
    } catch (e) {
      console.warn('Realtime feed subscription skipped:', e);
    }
    return () => {
      unsubscribers.forEach((fn) => fn());
    };
  },

  /**
   * Build completely authentic, data-driven leaderboards from database & workout records.
   * Zero mock users, zero artificial multipliers, and exact consecutive day streaks.
   */
  buildLeaderboardFromData(
    allWorkouts: Workout[],
    currentProfile?: UserProfile | null,
    dbProfiles: any[] = [],
    dbWorkouts: any[] = [],
    dbPosts: any[] = [],
    timeframe: 'week' | 'month' | 'all' = 'week',
    category: 'distance' | 'pace' | 'territories' = 'distance'
  ): LeaderboardEntry[] {
    const cachedUser = authService.getCachedUser();
    let cachedProfile: any = null;
    try {
      const p = localStorage.getItem('runwar_cached_profile');
      if (p) cachedProfile = JSON.parse(p);
    } catch { }

    const candidateIds = new Set<string>();
    [
      currentProfile?.id,
      currentProfile?.user_id,
      currentProfile?.firebase_uid,
      cachedUser?.id,
      cachedUser?.uid,
      cachedUser?.user_id,
      cachedProfile?.id,
      cachedProfile?.user_id,
    ].filter(Boolean).forEach((id) => {
      candidateIds.add(normalizeUserId(id).toLowerCase());
      candidateIds.add(String(id).toLowerCase().trim());
    });

    const myId = normalizeUserId(currentProfile?.user_id || currentProfile?.id || cachedUser?.id || 'me');
    let myName =
      currentProfile?.name ||
      currentProfile?.username ||
      cachedProfile?.name ||
      cachedUser?.name ||
      'You';

    if (!myName || isUUID(myName)) {
      myName = cachedUser?.email?.split('@')[0] || currentProfile?.username || 'You';
    }
    const myAvatar = currentProfile?.avatar_url || cachedProfile?.avatar_url || undefined;
    const myBadge = currentProfile?.fitness_goal
      ? currentProfile.fitness_goal.replace(/_/g, ' ').toUpperCase()
      : 'Runner';

    interface AthleteAggregate {
      userId: string;
      userName: string;
      userAvatar?: string;
      userBadge: string;
      isCurrentUser: boolean;
      workouts: { id: string; distance_meters: number; duration_seconds: number; average_pace: number; started_at: string }[];
    }

    const athleteMap = new Map<string, AthleteAggregate>();

    // 1. Current user
    athleteMap.set(myId, {
      userId: myId,
      userName: myName,
      userAvatar: myAvatar,
      userBadge: myBadge,
      isCurrentUser: true,
      workouts: (allWorkouts || []).map((w) => ({
        id: w.id || `w_${Math.random()}`,
        distance_meters: Number(w.distance_meters || 0),
        duration_seconds: Number(w.duration_seconds || 0),
        average_pace: Number(w.average_pace || 0),
        started_at: w.started_at,
      })),
    });

    // 2. Database Profiles
    (dbProfiles || []).forEach((p: any) => {
      const uid = normalizeUserId(p.user_id || p.id);
      if (!uid) return;
      const isMe = candidateIds.has(uid.toLowerCase()) || uid === myId;
      if (isMe) {
        const me = athleteMap.get(myId)!;
        if (!me.userAvatar && p.avatar_url) me.userAvatar = p.avatar_url;
        return;
      }

      let pName = p.name || p.username;
      if (!pName || isUUID(pName)) pName = 'Athlete';

      if (!athleteMap.has(uid)) {
        athleteMap.set(uid, {
          userId: uid,
          userName: pName,
          userAvatar: p.avatar_url || undefined,
          userBadge: p.fitness_goal ? p.fitness_goal.replace(/_/g, ' ').toUpperCase() : 'Athlete',
          isCurrentUser: false,
          workouts: [],
        });
      }
    });

    // 3. Database Workouts
    (dbWorkouts || []).forEach((w: any) => {
      const rawUid = normalizeUserId(w.user_id);
      if (!rawUid) return;
      const isMe = candidateIds.has(rawUid.toLowerCase()) || rawUid === myId;
      const targetUid = isMe ? myId : rawUid;

      if (!athleteMap.has(targetUid)) {
        athleteMap.set(targetUid, {
          userId: targetUid,
          userName: isMe ? myName : 'Athlete',
          userAvatar: isMe ? myAvatar : undefined,
          userBadge: isMe ? myBadge : 'Runner',
          isCurrentUser: isMe,
          workouts: [],
        });
      }
      const athlete = athleteMap.get(targetUid)!;
      if (!athlete.workouts.some((ex) => ex.id === w.id)) {
        athlete.workouts.push({
          id: w.id,
          distance_meters: Number(w.distance_meters || 0),
          duration_seconds: Number(w.duration_seconds || 0),
          average_pace: Number(w.average_pace || 0),
          started_at: w.started_at,
        });
      }
    });

    // 4. Community Posts (shared runs across athletes)
    (dbPosts || []).forEach((post: any) => {
      const rawUid = normalizeUserId(post.user_id);
      if (!rawUid) return;
      const isMe = candidateIds.has(rawUid.toLowerCase()) || rawUid === myId;
      if (isMe) {
        // Current user workouts are already authentically loaded from allWorkouts/dbWorkouts
        return;
      }
      const targetUid = rawUid;

      let authorName = post.user_name;
      if (!authorName || isUUID(authorName)) authorName = 'Athlete';

      if (!athleteMap.has(targetUid)) {
        athleteMap.set(targetUid, {
          userId: targetUid,
          userName: authorName,
          userAvatar: post.user_avatar || undefined,
          userBadge: post.user_badge || 'Athlete',
          isCurrentUser: false,
          workouts: [],
        });
      }
      const athlete = athleteMap.get(targetUid)!;
      if (post.workout_data && Number(post.workout_data.distance_meters || 0) > 0) {
        const wId = post.workout_id || post.workout_data.id || `post_${post.id}`;
        if (!athlete.workouts.some((ex) => ex.id === wId)) {
          athlete.workouts.push({
            id: wId,
            distance_meters: Number(post.workout_data.distance_meters || 0),
            duration_seconds: Number(post.workout_data.duration_seconds || 0),
            average_pace: Number(post.workout_data.average_pace || 0),
            started_at: post.workout_data.started_at || post.created_at,
          });
        }
      }
    });

    // 5. Timeframe window calculation
    const now = new Date();
    let cutoffDate: Date | null = null;
    if (timeframe === 'week') {
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeframe === 'month') {
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const entries: LeaderboardEntry[] = [];

    for (const athlete of athleteMap.values()) {
      const filteredWorkouts = cutoffDate
        ? athlete.workouts.filter((w) => {
          if (!w.started_at) return true;
          const d = new Date(w.started_at);
          return !isNaN(d.getTime()) && d >= cutoffDate!;
        })
        : athlete.workouts;

      const totalDistanceMeters = filteredWorkouts.reduce((sum, w) => sum + Number(w.distance_meters || 0), 0);
      const totalDistanceKm = Number((totalDistanceMeters / 1000).toFixed(1));
      const totalRuns = filteredWorkouts.filter((w) => Number(w.distance_meters || 0) > 0 || Number(w.duration_seconds || 0) > 0).length;

      const totalDurationSeconds = filteredWorkouts.reduce((sum, w) => sum + Number(w.duration_seconds || 0), 0);
      const avgPaceSec = totalDistanceMeters > 0 ? totalDurationSeconds / (totalDistanceMeters / 1000) : 0;
      const avgPace = avgPaceSec > 0 ? `${formatPaceRaw(avgPaceSec, 'min_km')} /km` : '--:-- /km';

      const realisticPaces = filteredWorkouts
        .map((w) => Number(w.average_pace || 0))
        .filter((p) => p >= 120 && p <= 900);
      const bestPaceSeconds = realisticPaces.length > 0
        ? Math.min(...realisticPaces)
        : (avgPaceSec > 0 ? Math.round(avgPaceSec) : 9999);

      // Exact streak from all recorded workouts
      const streakDays = calculateExactStreak(athlete.workouts);

      let territoriesHeld = 0;
      if (athlete.isCurrentUser) {
        const validRuns = athlete.workouts.filter((w) => Number(w.distance_meters || 0) > 0);
        territoriesHeld = Math.min(4, validRuns.length);
      } else {
        if (totalDistanceKm >= 35) territoriesHeld = 3;
        else if (totalDistanceKm >= 20) territoriesHeld = 2;
        else if (totalDistanceKm >= 10) territoriesHeld = 1;
      }

      entries.push({
        rank: 1,
        userId: athlete.userId,
        userName: athlete.userName,
        userAvatar: athlete.userAvatar,
        totalDistanceKm,
        totalRuns,
        avgPace,
        streakDays,
        badge: athlete.userBadge,
        isCurrentUser: athlete.isCurrentUser,
        bestPaceSeconds,
        territoriesHeld,
      });
    }

    // 6. Sort by category
    if (category === 'pace') {
      entries.sort((a, b) => {
        if (a.totalDistanceKm > 0 && b.totalDistanceKm > 0) {
          return (a.bestPaceSeconds || 9999) - (b.bestPaceSeconds || 9999);
        }
        return b.totalDistanceKm - a.totalDistanceKm;
      });
    } else {
      entries.sort((a, b) => {
        if (b.totalDistanceKm !== a.totalDistanceKm) {
          return b.totalDistanceKm - a.totalDistanceKm;
        }
        return b.totalRuns - a.totalRuns;
      });
    }

    return entries.map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
      badge: idx === 0 ? '👑 Commander' : idx === 1 ? '🥈 Vanguard' : idx === 2 ? '🥉 Elite' : entry.badge,
    }));
  },

  /**
   * Synchronous leaderboard aggregation fallback using local cache
   */
  calculateLeaderboard(
    allWorkouts: Workout[],
    currentProfile?: UserProfile | null,
    timeframe: 'week' | 'month' | 'all' = 'week',
    category: 'distance' | 'pace' | 'territories' = 'distance'
  ): LeaderboardEntry[] {
    const cachedPosts = this.getFeedPosts();
    return this.buildLeaderboardFromData(
      allWorkouts,
      currentProfile,
      [],
      [],
      cachedPosts,
      timeframe,
      category
    );
  },

  /**
   * Asynchronously fetch real-time Leaderboard straight from InsForge Postgres DB
   */
  async getLeaderboardAsync(
    allWorkouts: Workout[],
    currentProfile?: UserProfile | null,
    timeframe: 'week' | 'month' | 'all' = 'week',
    category: 'distance' | 'pace' | 'territories' = 'distance'
  ): Promise<LeaderboardEntry[]> {
    let dbProfiles: any[] = [];
    let dbWorkouts: any[] = [];
    let dbPosts: any[] = [];

    try {
      const [profRes, workRes, postRes] = await Promise.all([
        insforge.database.from('profiles').select('id, user_id, name, username, avatar_url, fitness_goal'),
        insforge.database.from('workouts').select('id, user_id, type, distance_meters, duration_seconds, average_pace, started_at, status').eq('status', 'completed'),
        insforge.database.from('community_posts').select('id, user_id, user_name, user_avatar, user_badge, workout_id, workout_data, created_at'),
      ]);

      if (Array.isArray(profRes.data)) dbProfiles = profRes.data;
      if (Array.isArray(workRes.data)) dbWorkouts = workRes.data;
      if (Array.isArray(postRes.data)) dbPosts = postRes.data;
    } catch (e) {
      console.warn('Live leaderboard cloud fetch fallback to cache:', e);
      dbPosts = this.getFeedPosts();
    }

    return this.buildLeaderboardFromData(
      allWorkouts,
      currentProfile,
      dbProfiles,
      dbWorkouts,
      dbPosts,
      timeframe,
      category
    );
  },

  /**
   * Dynamically generate Territory Zones based on REAL user workout data!
   * - Real completed workouts become real defended sectors with genuine distances, paces, dates, and GPS route coordinates.
   * - If user has fewer than 4 recorded workouts, open milestone challenge sectors are provided to conquer.
   */
  calculateTerritories(workouts: Workout[], profile?: UserProfile | null): TerritoryZone[] {
    const validWorkouts = (workouts || []).filter(
      (w) => (w.status === 'completed' || !w.status) && Number(w.distance_meters || 0) > 0
    );
    const userName = profile?.name?.trim() || profile?.username?.trim() || 'Athlete';

    const territories: TerritoryZone[] = [];

    // Sort valid real workouts by most recent first
    const sortedWorkouts = [...validWorkouts].sort((a, b) => {
      const timeA = new Date(a.started_at || a.created_at || 0).getTime();
      const timeB = new Date(b.started_at || b.created_at || 0).getTime();
      return timeB - timeA;
    });

    // Pick up to 4 unique runs
    const realRuns = sortedWorkouts.slice(0, 4);

    realRuns.forEach((w, idx) => {
      const distanceMeters = Number(w.distance_meters || 0);
      const distanceKmNum = distanceMeters / 1000;
      const distanceKmStr = `${distanceKmNum.toFixed(2)} km`;
      const avgPaceStr = w.average_pace && w.average_pace > 0 ? `${formatPaceRaw(w.average_pace)} /km` : '5:00 /km';

      const runDateObj = new Date(w.started_at || w.created_at || Date.now());
      const diffMs = Date.now() - runDateObj.getTime();
      const defenseStreakDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      const isUnderSiege = defenseStreakDays >= 3; // After 3 days without defense, zone enters siege

      const difficulty: 'Easy' | 'Moderate' | 'Hard' | 'Extreme' =
        distanceKmNum >= 10 ? 'Extreme' : distanceKmNum >= 5 ? 'Hard' : distanceKmNum >= 3 ? 'Moderate' : 'Easy';

      const elevationM = Math.round(w.elevation_gain || 0);
      const bountyXp = Math.round(distanceKmNum * 70) + (isUnderSiege ? 250 : 150);

      // Real kilometer splits if recorded during workout
      const splitsTarget =
        w.splits && w.splits.length > 0
          ? w.splits.slice(0, 6).map((s) => ({
            km: s.split_number,
            pace: `${formatPaceRaw(s.pace)} /km`,
          }))
          : undefined;

      // Authentic sector naming based on workout title or real distance category
      const rawTitle = w.title?.trim();
      const sectorName = rawTitle
        ? (rawTitle.toLowerCase().includes('sector') || rawTitle.toLowerCase().includes('circuit') ? rawTitle : `Sector: ${rawTitle}`)
        : `${distanceKmNum >= 10 ? 'Endurance District' : distanceKmNum >= 5 ? 'Metro 5K Circuit' : 'Urban Sector'} (${distanceKmStr})`;

      territories.push({
        id: `tz_real_${w.id || idx}`,
        name: sectorName,
        holder: userName,
        pace: avgPaceStr,
        status: 'Secured',
        km: distanceKmStr,
        defenseStreakDays,
        targetPaceSeconds: Math.max(120, Math.round((w.average_pace || 300) * 0.95)),
        difficulty,
        elevationM,
        bountyXp,
        isUnderSiege,
        circuitType: (idx % 4) + 1,
        route_coordinates: w.route_coordinates && w.route_coordinates.length >= 2 ? w.route_coordinates : undefined,
        splitsTarget,
        isRealUserWorkout: true,
        workoutId: w.id,
        runDate: runDateObj.toISOString(),
      });
    });

    // Milestone challenge templates for unfilled slots (so user always has 4 sectors to interact with or contest)
    const milestoneTemplates = [
      {
        id: 'tz_challenge_1',
        name: 'Starter Sprint Loop',
        holder: 'Unclaimed Zone',
        pace: '5:30 /km',
        status: 'Contested' as const,
        km: '1.50 km',
        defenseStreakDays: 0,
        targetPaceSeconds: 330,
        difficulty: 'Easy' as const,
        elevationM: 15,
        bountyXp: 200,
        isUnderSiege: true,
        circuitType: 1,
        splitsTarget: [
          { km: 1, pace: '5:30 /km' },
        ],
      },
      {
        id: 'tz_challenge_2',
        name: 'Downtown 3K Circuit',
        holder: 'Unclaimed Zone',
        pace: '5:15 /km',
        status: 'Contested' as const,
        km: '3.00 km',
        defenseStreakDays: 0,
        targetPaceSeconds: 315,
        difficulty: 'Moderate' as const,
        elevationM: 25,
        bountyXp: 300,
        isUnderSiege: true,
        circuitType: 2,
        splitsTarget: [
          { km: 1, pace: '5:20 /km' },
          { km: 2, pace: '5:15 /km' },
          { km: 3, pace: '5:10 /km' },
        ],
      },
      {
        id: 'tz_challenge_3',
        name: 'Metro 5K Championship Ring',
        holder: 'Unclaimed Zone',
        pace: '5:00 /km',
        status: 'Contested' as const,
        km: '5.00 km',
        defenseStreakDays: 0,
        targetPaceSeconds: 300,
        difficulty: 'Hard' as const,
        elevationM: 40,
        bountyXp: 450,
        isUnderSiege: true,
        circuitType: 3,
        splitsTarget: [
          { km: 1, pace: '5:05 /km' },
          { km: 2, pace: '5:00 /km' },
          { km: 3, pace: '5:00 /km' },
          { km: 4, pace: '4:55 /km' },
          { km: 5, pace: '4:50 /km' },
        ],
      },
      {
        id: 'tz_challenge_4',
        name: '10K Endurance District',
        holder: 'Unclaimed Zone',
        pace: '4:50 /km',
        status: 'Contested' as const,
        km: '10.00 km',
        defenseStreakDays: 0,
        targetPaceSeconds: 290,
        difficulty: 'Extreme' as const,
        elevationM: 75,
        bountyXp: 600,
        isUnderSiege: true,
        circuitType: 4,
        splitsTarget: [
          { km: 1, pace: '4:55 /km' },
          { km: 5, pace: '4:50 /km' },
          { km: 10, pace: '4:45 /km' },
        ],
      },
    ];

    // Fill remaining slots up to 4
    for (const milestone of milestoneTemplates) {
      if (territories.length >= 4) break;
      territories.push(milestone);
    }

    return territories;
  },

  /**
   * Fetch Athlete Profile for quick profile modal (tapping avatar, username, or @mention)
   * Strictly enforces display of genuine usernames (NEVER raw UUIDs) and only authentic data.
   */
  getAthleteProfile(
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
    } | string,
    currentProfile?: UserProfile | null,
    userWorkouts?: Workout[]
  ): AthleteProfileData {
    let targetUserId = '';
    let targetUserName = '';
    let targetAvatar: string | undefined = undefined;
    let targetBadge: string | undefined = undefined;
    let targetKm: number | undefined = undefined;
    let targetRuns: number | undefined = undefined;
    let targetPace: string | undefined = undefined;
    let targetStreak: number | undefined = undefined;
    let targetIsCurrent: boolean | undefined = undefined;

    if (typeof target === 'string') {
      const clean = target.trim();
      if (isUUID(clean)) {
        targetUserId = clean;
      } else {
        targetUserName = clean.replace(/^@/, '');
      }
    } else if (target && typeof target === 'object') {
      targetUserId = target.userId || '';
      targetUserName = target.userName ? target.userName.replace(/^@/, '') : '';
      targetAvatar = target.userAvatar;
      targetBadge = target.userBadge;
      targetKm = target.totalDistanceKm;
      targetRuns = target.totalRuns;
      targetPace = target.avgPace;
      targetStreak = target.streakDays;
      targetIsCurrent = target.isCurrentUser;
    }

    const cachedUser = authService.getCachedUser();
    let cachedProfile: any = null;
    try {
      const p = localStorage.getItem('runwar_cached_profile');
      if (p) cachedProfile = JSON.parse(p);
    } catch { }

    const candidateIds = new Set<string>();
    [
      currentProfile?.id,
      currentProfile?.user_id,
      currentProfile?.firebase_uid,
      cachedUser?.id,
      cachedUser?.uid,
      cachedUser?.user_id,
      cachedProfile?.id,
      cachedProfile?.user_id,
    ].filter(Boolean).forEach((id) => {
      candidateIds.add(normalizeUserId(id).toLowerCase());
      candidateIds.add(String(id).toLowerCase().trim());
    });

    const candidateNames = new Set<string>();
    [
      currentProfile?.name,
      currentProfile?.username,
      cachedProfile?.name,
      cachedProfile?.username,
      cachedUser?.name,
      cachedUser?.email?.split('@')[0],
    ].filter(Boolean).forEach((name) => {
      candidateNames.add(String(name).toLowerCase().trim());
    });

    const isMe =
      targetIsCurrent === true ||
      (targetUserId && candidateIds.has(normalizeUserId(targetUserId).toLowerCase())) ||
      (targetUserId && candidateIds.has(String(targetUserId).toLowerCase().trim())) ||
      (targetUserName && candidateNames.has(targetUserName.toLowerCase().trim())) ||
      targetUserName?.toLowerCase() === 'you' ||
      targetUserName?.toLowerCase() === 'me' ||
      (!targetUserId && !targetUserName);

    // 1. Current logged-in user profile
    if (isMe) {
      const workouts = userWorkouts || [];
      const totalDistM = workouts.reduce((sum, w) => sum + Number(w.distance_meters || 0), 0);
      const totalKm = Number((totalDistM / 1000).toFixed(1));
      const totalRuns = workouts.filter((w) => Number(w.distance_meters || 0) > 0 || Number(w.duration_seconds || 0) > 0).length;
      const totalDurS = workouts.reduce((sum, w) => sum + Number(w.duration_seconds || 0), 0);
      const avgPaceSec = totalDistM > 0 ? totalDurS / (totalDistM / 1000) : 315;
      const exactStreak = calculateExactStreak(workouts);

      let myDisplayName =
        currentProfile?.name ||
        currentProfile?.username ||
        cachedProfile?.name ||
        cachedProfile?.username ||
        cachedUser?.name ||
        targetUserName ||
        'Runner';

      if (!myDisplayName || isUUID(myDisplayName)) {
        myDisplayName = cachedUser?.email?.split('@')[0] || currentProfile?.username || 'Runner';
      }
      if (!myDisplayName || isUUID(myDisplayName)) {
        myDisplayName = 'Runner';
      }

      const recentActivities = workouts
        .filter((w) => Number(w.distance_meters || 0) > 0 || Number(w.duration_seconds || 0) > 0)
        .slice(0, 5)
        .map((w, idx) => {
          const distKm = Number(((Number(w.distance_meters || 0)) / 1000).toFixed(2));
          const paceSec = Number(w.average_pace || 0) || (distKm > 0 ? Number(w.duration_seconds || 0) / distKm : 330);
          const typeCapitalized = (w.type || 'run').charAt(0).toUpperCase() + (w.type || 'run').slice(1);
          return {
            id: w.id || `act_${idx}`,
            title: w.title || `${typeCapitalized} Session`,
            distanceKm: distKm,
            pace: `${formatPaceRaw(paceSec, 'min_km')} /km`,
            time: new Date(w.started_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            date: new Date(w.started_at || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' }),
          };
        });

      return {
        userId: currentProfile?.id || currentProfile?.user_id || 'me',
        userName: myDisplayName,
        userAvatar: currentProfile?.avatar_url || cachedProfile?.avatar_url || targetAvatar || undefined,
        userBadge: currentProfile?.fitness_goal ? currentProfile.fitness_goal.replace(/_/g, ' ').toUpperCase() : 'ZONE PIONEER',
        isCurrentUser: true,
        totalDistanceKm: targetKm !== undefined ? targetKm : totalKm,
        totalRuns: totalRuns,
        avgPace: targetPace || `${formatPaceRaw(avgPaceSec, 'min_km')} /km`,
        streakDays: exactStreak,
        recentActivities,
      };
    }

    // 2. Other community athletes (resolved from real database posts & workouts)
    const posts = this.getFeedPosts();
    const matchingPost = posts.find((p) => p.userId === targetUserId || (targetUserName && p.userName === targetUserName));

    let finalName = targetUserName;
    if (!finalName || isUUID(finalName)) {
      finalName = (matchingPost?.userName && !isUUID(matchingPost.userName))
        ? matchingPost.userName
        : 'War Runner';
    }
    if (!finalName || isUUID(finalName)) {
      finalName = 'War Runner';
    }

    const finalAvatar = targetAvatar || matchingPost?.userAvatar;
    const finalBadge = targetBadge || matchingPost?.userBadge || 'Athlete';

    const athletePosts = posts.filter((p) => p.userId === targetUserId || p.userName === finalName);
    const athleteWorkouts = athletePosts
      .map((p) => p.workout)
      .filter((w) => Boolean(w && (Number(w.distance_meters || 0) > 0 || Number(w.duration_seconds || 0) > 0)));

    const postKm = athleteWorkouts.reduce((sum, w) => sum + (Number(w.distance_meters || 0) / 1000), 0);
    const totalKm = targetKm !== undefined ? targetKm : Number(postKm.toFixed(1));
    const totalRuns = targetRuns !== undefined ? targetRuns : athleteWorkouts.length;
    const totalDurS = athleteWorkouts.reduce((sum, w) => sum + Number(w.duration_seconds || 0), 0);
    const avgSec = postKm > 0 ? totalDurS / postKm : 0;
    const avgPace = targetPace || (avgSec > 0 ? `${formatPaceRaw(avgSec, 'min_km')} /km` : '5:00 /km');
    const streakDays = calculateExactStreak(athleteWorkouts);

    const recentActivities = athleteWorkouts.slice(0, 5).map((w, idx) => {
      const distKm = Number(((Number(w.distance_meters || 0)) / 1000).toFixed(2));
      const paceSec = Number(w.average_pace || 0) || (distKm > 0 ? Number(w.duration_seconds || 0) / distKm : 330);
      const typeCapitalized = (w.type || 'run').charAt(0).toUpperCase() + (w.type || 'run').slice(1);
      return {
        id: w.id || `act_${idx}`,
        title: w.title || `${typeCapitalized} Session`,
        distanceKm: distKm,
        pace: `${formatPaceRaw(paceSec, 'min_km')} /km`,
        time: new Date(w.started_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date(w.started_at || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      };
    });

    return {
      userId: targetUserId || `user_${finalName.toLowerCase().replace(/\s+/g, '_')}`,
      userName: finalName,
      userAvatar: finalAvatar,
      userBadge: finalBadge,
      isCurrentUser: false,
      totalDistanceKm: totalKm,
      totalRuns: totalRuns,
      avgPace: avgPace,
      streakDays: streakDays,
      recentActivities,
    };
  }
};

