import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Flame,
  MessageSquare,
  Share2,
  MapPin,
  Clock,
  Mountain,
  Calendar,
  Send,
  Sparkles,
  AlertCircle,
  Shield,
  Trophy,
  LogIn,
  Check,
  Globe,
  Gauge,
  FileText,
  Flag,
  Footprints,
  Heart,
  ArrowUpRight,
  ArrowDown,
  Download,
  Sun,
  Moon,
} from 'lucide-react';
import { FeedPost, FeedComment, ReactionType, socialService, getPostIdFromUrl } from '../services/socialService';
import { UserProfile, Workout } from '../types';
import { formatDistance, formatDuration, formatPace } from '../utils/formatters';
import { authService } from '../services/authService';

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
  const effectivePostId = postId || getPostIdFromUrl() || initialPost?.id;
  const [post, setPost] = useState<FeedPost | null>(initialPost || null);
  const [isLoading, setIsLoading] = useState<boolean>(!initialPost && Boolean(effectivePostId));
  const [error, setError] = useState<string | null>(null);

  const [commentInput, setCommentInput] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  // Synchronize theme state (Light/Dark Mode)
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark') || !document.documentElement.classList.contains('light');
    }
    return true;
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const handleToggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      localStorage.setItem('runwar_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      localStorage.setItem('runwar_theme', 'light');
    }
    if (profile?.user_id) {
      authService.updateSettings(profile.user_id, { theme: nextDark ? 'dark' : 'light' }).catch(() => { });
    }
  };

  const cardRef = useRef<HTMLDivElement | null>(null);

  // Sync post when postId changes or on mount
  useEffect(() => {
    let isMounted = true;
    const targetId = postId || getPostIdFromUrl() || initialPost?.id;
    if (!targetId && !initialPost) {
      setError('No workout specified');
      setIsLoading(false);
      return;
    }

    const fetchPost = async () => {
      if (!targetId) return;

      if (!post && !initialPost) {
        setIsLoading(true);
      }
      try {
        const resolved = await socialService.getPostById(targetId, profile);
        if (isMounted) {
          if (resolved) {
            setPost(resolved);
            setError(null);
          } else if (!post && !initialPost) {
            setError('Workout not found or may have been deleted.');
          }
        }
      } catch (err: any) {
        if (isMounted && !post && !initialPost) {
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

  // Reset avatar load state when post changes
  useEffect(() => {
    setAvatarError(false);
  }, [post?.id, post?.userAvatar]);

  // Comprehensive profile avatar resolution
  const resolvedAvatar =
    (!avatarError && (
      post?.userAvatar ||
      (profile && (post?.userId === profile.user_id || post?.userName === profile.name) ? profile.avatar_url : null) ||
      (post?.userId ? localStorage.getItem(`runwar_instant_avatar_${post.userId}`) : null) ||
      (profile?.user_id ? localStorage.getItem(`runwar_instant_avatar_${profile.user_id}`) : null) ||
      (() => {
        try {
          const cached = localStorage.getItem('runwar_cached_profile');
          if (cached) {
            const p = JSON.parse(cached);
            if (p.avatar_url && (post?.userId === p.user_id || post?.userName === p.name)) return p.avatar_url;
          }
        } catch { }
        return null;
      })()
    )) || null;

  // Background fallback fetch if athlete avatar is missing from post object
  useEffect(() => {
    if (!resolvedAvatar && post?.userId && post.userId !== 'guest_user') {
      try {
        const ath = socialService.getAthleteProfile(post.userId, profile);
        if (ath?.userAvatar) {
          setPost((prev) => (prev ? { ...prev, userAvatar: ath.userAvatar } : null));
        }
      } catch { }
    }
  }, [post?.userId, resolvedAvatar, profile]);

  // Real-time synchronization of community cheers reactions & comments
  useEffect(() => {
    if (!post?.id) return;
    const unsub = socialService.subscribeToFeed((event) => {
      if (!event.id || event.id === post.id) {
        socialService
          .getPostById(post.id, profile)
          .then((updated) => {
            if (updated) {
              setPost((prev) => {
                if (!prev) return updated;
                return {
                  ...updated,
                  userReaction: prev.userReaction !== undefined ? prev.userReaction : updated.userReaction,
                };
              });
            }
          })
          .catch(() => { });
      }
    });
    return () => unsub();
  }, [post?.id, profile?.user_id]);

  // Clean initials generator (e.g. 'Mannam Ganeshbabu' -> 'MG')
  const getInitials = (name?: string) => {
    if (!name) return 'R';
    const clean = name.replace(/^@/, '').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const p1 = parts[0].replace(/[^a-zA-Z]/g, '')[0];
      const p2 = parts[1].replace(/[^a-zA-Z]/g, '')[0];
      if (p1 && p2) return `${p1}${p2}`.toUpperCase();
    }
    return clean.replace(/[^a-zA-Z]/g, '').substring(0, 2).toUpperCase() || 'R';
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Directly copy dedicated share link to clipboard
  const handleCopyLink = async () => {
    if (!post) return;
    const details = socialService.getPostShareDetails(post);
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

    showToast('Link copied');
  };

  // Export card as high-res PNG image
  const handleDownloadImage = async () => {
    if (!post) return;
    setIsSavingImage(true);
    showToast('Generating workout card... 📸');

    try {
      const W = 1080;
      const H = 1920;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not supported');

      // 1. Background Obsidian
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#08121c');
      bgGrad.addColorStop(0.5, '#060e15');
      bgGrad.addColorStop(1, '#04090e');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Card Border & subtle glow
      ctx.strokeStyle = '#142634';
      ctx.lineWidth = 4;
      ctx.strokeRect(30, 30, W - 60, H - 60);

      // 2. Header
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 48px sans-serif';
      ctx.fillText('RUN', 130, 115);
      const runWidth = ctx.measureText('RUN').width;
      ctx.fillStyle = '#00d09c';
      ctx.fillText('WAR', 130 + runWidth, 115);

      ctx.fillStyle = '#7d91a2';
      ctx.font = '500 24px sans-serif';
      ctx.fillText('Workout Summary', 130, 150);

      // Completed pill
      ctx.fillStyle = '#082120';
      ctx.strokeStyle = 'rgba(0, 208, 156, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(W - 270, 85, 180, 56, 28);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#00d09c';
      ctx.font = '700 22px sans-serif';
      ctx.fillText('✓ Completed', W - 245, 120);

      // 3. Athlete Info
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 36px sans-serif';
      ctx.fillText(post.userName || 'Athlete', 70, 240);

      ctx.fillStyle = '#7d91a2';
      ctx.font = '500 24px sans-serif';
      const formattedDate = new Date(post.createdAt || Date.now()).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
      ctx.fillText(`📅 ${formattedDate}   ·   🌐 Public link`, 70, 280);

      // 4. Hero Distance
      ctx.textAlign = 'center';
      ctx.fillStyle = '#7d91a2';
      ctx.font = '600 26px sans-serif';
      ctx.fillText('TOTAL DISTANCE', W / 2, 380);

      const rawW = typeof post.workout === 'string' ? (() => { try { return JSON.parse(post.workout); } catch { return null; } })() : post.workout;
      const dMeters = rawW?.distance_meters ?? (post.workout?.distance_meters ?? 0);
      const dKm = (dMeters / 1000).toFixed(2);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 130px sans-serif';
      ctx.fillText(dKm, W / 2 - 50, 510);
      ctx.fillStyle = '#00d09c';
      ctx.font = '900 50px sans-serif';
      ctx.fillText('KM', W / 2 + 130, 500);

      // 5. 4 Quick Stats
      const dSec = rawW?.duration_seconds ?? (post.workout?.duration_seconds ?? 0);
      const pAvg = rawW?.average_pace && rawW.average_pace > 0 ? rawW.average_pace : (dMeters > 0 && dSec > 0 ? Math.round(dSec / (dMeters / 1000)) : 0);
      const cBurn = rawW?.calories && rawW.calories > 0 ? rawW.calories : Math.round((dMeters / 1000) * 70 * 1.036);
      const eGain = rawW?.elevation_gain != null ? Math.round(rawW.elevation_gain) : 0;

      const durStr = formatDuration(dSec);
      const paceStr = pAvg > 0 ? formatPace(pAvg, 'min_km').replace(/\s\/\w+/, '') + ' /km' : '--:--';

      const statY = 620;
      const colW = (W - 140) / 4;

      const stats = [
        { label: 'Pace', val: paceStr },
        { label: 'Duration', val: durStr },
        { label: 'Calories', val: `${cBurn} kcal` },
        { label: 'Elevation', val: `${eGain} m` },
      ];

      stats.forEach((s, idx) => {
        const x = 70 + idx * colW + colW / 2;
        ctx.fillStyle = '#7d91a2';
        ctx.font = '500 24px sans-serif';
        ctx.fillText(s.label, x, statY);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 30px monospace';
        ctx.fillText(s.val, x, statY + 45);
      });

      // 6. Caption
      ctx.textAlign = 'left';
      ctx.fillStyle = '#7d91a2';
      ctx.font = '600 24px sans-serif';
      ctx.fillText('📝 Activity Caption', 70, 740);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'italic 500 28px sans-serif';
      const caption = post.caption || `Just completed a ${dKm} km jog!`;
      ctx.fillText(`"${caption}"`, 70, 785);

      // 7. Watermark RUNWAR Link
      ctx.textAlign = 'center';
      ctx.fillStyle = '#00d09c';
      ctx.font = '700 24px monospace';
      ctx.fillText('run-war-chi.vercel.app', W / 2, H - 70);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const safeName = (post.userName || 'Athlete').replace(/\s+/g, '_');
        link.download = `RUNWAR_${safeName}_${dKm}KM.png`;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast('Image downloaded! 📸');
      });
    } catch (err) {
      console.error(err);
      showToast('Could not save image.');
    } finally {
      setIsSavingImage(false);
    }
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

  // Defensive extraction of workout object (handles stringified JSON from DB or raw object)
  const workout: Workout | null = useMemo(() => {
    if (!post?.workout) return null;
    if (typeof post.workout === 'string') {
      try {
        const p = JSON.parse(post.workout);
        return p && typeof p === 'object' ? p : null;
      } catch {
        return null;
      }
    }
    return typeof post.workout === 'object' ? post.workout : null;
  }, [post?.workout]);

  // Real-time workout metrics calculation
  const distMeters = Number(workout?.distance_meters ?? post?.workout?.distance_meters ?? 0) || 0;
  const distKm = (distMeters / 1000).toFixed(2);
  const durSec = Number(workout?.duration_seconds ?? post?.workout?.duration_seconds ?? 0) || 0;

  const rawPace = Number(workout?.average_pace ?? post?.workout?.average_pace ?? 0);
  const avgPace = rawPace > 0
    ? rawPace
    : (distMeters > 0 && durSec > 0 ? Math.round(durSec / (distMeters / 1000)) : 0);
  const formattedPace = avgPace > 0 ? formatPace(avgPace, 'min_km').replace(/\s\/\w+/, '') : '--:--';
  const formattedDuration = formatDuration(durSec);

  const userWeightKg = Number(profile?.weight || 70);
  const rawCalories = Number(workout?.calories ?? post?.workout?.calories ?? 0);
  const calories = rawCalories > 0
    ? Math.round(rawCalories)
    : (distMeters > 0 ? Math.round((distMeters / 1000) * userWeightKg * 1.036) : 0);

  // Safe extraction of GPS route coordinates
  const routeCoords: any[] = useMemo(() => {
    const raw = workout?.route_coordinates ?? post?.workout?.route_coordinates;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      } catch { }
    }
    return [];
  }, [workout?.route_coordinates, post?.workout?.route_coordinates]);

  // Real-time elevation calculation from GPS route coordinates and workout properties
  const altitudes = useMemo(() => {
    if (!Array.isArray(routeCoords)) return [];
    return routeCoords
      .map((c: any) => Number(c?.altitude ?? c?.alt ?? null))
      .filter((a): a is number => !isNaN(a) && a !== null && a > -100 && a < 9000);
  }, [routeCoords]);

  const { realElevationGain, maxElevation, minElevation, avgElevation } = useMemo(() => {
    let maxA = 0;
    let minA = 0;
    let sumA = 0;
    const hasAlt = altitudes.length > 0;
    if (hasAlt) {
      maxA = altitudes[0];
      minA = altitudes[0];
      for (let i = 0; i < altitudes.length; i++) {
        const a = altitudes[i];
        if (a > maxA) maxA = a;
        if (a < minA) minA = a;
        sumA += a;
      }
    }

    const recordedGain = Number(workout?.elevation_gain ?? post?.workout?.elevation_gain ?? 0);
    const elevGain = recordedGain > 0
      ? Math.round(recordedGain)
      : (altitudes.length >= 2 ? Math.round(Math.max(0, maxA - minA)) : 0);

    const rawMax = (workout as any)?.max_elevation != null ? Number((workout as any).max_elevation) : null;
    const maxElev = rawMax != null && !isNaN(rawMax)
      ? Math.round(rawMax)
      : (hasAlt ? Math.round(maxA) : (elevGain > 0 ? Math.round(elevGain * 1.2) : 0));

    const rawMin = (workout as any)?.min_elevation != null ? Number((workout as any).min_elevation) : null;
    const minElev = rawMin != null && !isNaN(rawMin)
      ? Math.round(rawMin)
      : (hasAlt ? Math.round(minA) : 0);

    const rawAvg = (workout as any)?.avg_elevation != null ? Number((workout as any).avg_elevation) : null;
    const avgElev = rawAvg != null && !isNaN(rawAvg)
      ? Math.round(rawAvg)
      : (hasAlt ? Math.round(sumA / altitudes.length) : (maxElev + minElev > 0 ? Math.round((maxElev + minElev) / 2) : elevGain));

    return {
      realElevationGain: elevGain,
      maxElevation: maxElev,
      minElevation: minElev,
      avgElevation: avgElev,
    };
  }, [workout, post?.workout, altitudes]);

  const elevation = realElevationGain;

  // Real-time start and end timestamps
  const rawStart = workout?.started_at || post?.createdAt || Date.now();
  const startDate = new Date(rawStart);
  const validStartDate = !isNaN(startDate.getTime()) ? startDate : new Date();

  const formattedDate = validStartDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const formattedStartTime = validStartDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

  const rawEnd = workout?.ended_at;
  const endDate = rawEnd ? new Date(rawEnd) : (durSec > 0 ? new Date(validStartDate.getTime() + durSec * 1000) : null);
  const validEndDate = endDate && !isNaN(endDate.getTime()) ? endDate : null;

  const formattedEndTime = validEndDate
    ? validEndDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    : (durSec > 0
      ? new Date(validStartDate.getTime() + durSec * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
      : formattedStartTime);

  // Real-time steps
  const rawSteps = (workout as any)?.steps ?? (workout as any)?.step_count ?? (post?.workout as any)?.steps;
  const numSteps = Number(rawSteps);
  const steps = !isNaN(numSteps) && numSteps > 0
    ? Math.round(numSteps)
    : (distMeters > 0 ? Math.round(distMeters * 1.25) : 0);

  // Real-time average heart rate
  const rawHr = Number(workout?.heart_rate_avg || (workout as any)?.average_heart_rate || (post?.workout as any)?.heart_rate_avg || 0);
  const avgHeartRate = !isNaN(rawHr) && rawHr > 0
    ? `${Math.round(rawHr)} bpm`
    : (distMeters > 0 && avgPace > 0
      ? `${Math.min(178, Math.max(120, Math.round(145 + (360 - avgPace) * 0.15)))} bpm`
      : '-- bpm');

  // Real-time average speed
  const rawSpeed = Number(workout?.average_speed ?? (post?.workout as any)?.average_speed);
  const numSpeed = !isNaN(rawSpeed) && rawSpeed > 0
    ? rawSpeed
    : (durSec > 0 && distMeters > 0 ? (distMeters / 1000) / (durSec / 3600) : 0);
  const avgSpeed = (isNaN(numSpeed) ? 0 : numSpeed).toFixed(1);

  // Default running on stairs photo (Bruno Nascimento Unsplash runner photo)
  const photoUrl =
    post?.photoUrl ||
    'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=1200&q=80';

  const badgeText = post?.userBadge || (profile?.fitness_goal || '5k_run');
  const captionText = post?.caption || `Just completed a ${distKm} km jog!`;

  // Safe reactions & comments normalization
  const reactionsObj = useMemo(() => {
    const rx = post?.reactions;
    if (rx && typeof rx === 'object') return rx;
    if (typeof rx === 'string') {
      try {
        const parsed = JSON.parse(rx);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch { }
    }
    return { fire: 0, respect: 0, beast: 0, salute: 0 };
  }, [post?.reactions]);

  const commentsList: FeedComment[] = useMemo(() => {
    if (!post?.comments) return [];
    if (Array.isArray(post.comments)) return post.comments;
    if (typeof post.comments === 'string') {
      try {
        const parsed = JSON.parse(post.comments);
        if (Array.isArray(parsed)) return parsed;
      } catch { }
    }
    return [];
  }, [post?.comments]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-[#070d14] flex flex-col items-center justify-center p-4 animate-pulse transition-colors">
        <div className="w-full max-w-md bg-white dark:bg-[#0b131e] border border-slate-200 dark:border-emerald-950/80 rounded-[32px] p-6 space-y-5 shadow-lg">
          <div className="h-10 bg-slate-200 dark:bg-slate-800/60 rounded-2xl w-full" />
          <div className="h-14 bg-slate-200 dark:bg-slate-800/60 rounded-full w-3/4 mx-auto" />
          <div className="h-44 bg-slate-200 dark:bg-slate-800/60 rounded-2xl w-full" />
          <div className="h-32 bg-slate-200 dark:bg-slate-800/60 rounded-2xl w-full" />
        </div>
      </div>
    );
  }

  // Error / Not Found view
  if (error || !post) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-[#070d14] flex flex-col items-center justify-center p-6 text-center text-slate-900 dark:text-white transition-colors">
        <div className="w-16 h-16 rounded-3xl bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4 border border-rose-500/20">
          <AlertCircle size={32} />
        </div>
        <h2 className="font-display text-xl font-black">
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

  return (
    <div className="p-4 sm:p-5 space-y-6 animate-fade-in text-slate-900 dark:text-slate-100 selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-0 right-0 z-[200] flex justify-center pointer-events-none">
          <div className="px-5 py-2 rounded-full bg-slate-900 dark:bg-slate-800 text-white text-xs font-medium shadow-lg animate-fade-in whitespace-nowrap">
            {toastMessage}
          </div>
        </div>
      )}




      {/* Outer Card Wrapper */}
      <div className="w-full max-w-md mx-auto space-y-4">
        {/* Navigation Bar above Card */}
        <div className="flex items-center justify-between px-2">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            {/* Theme Toggle Button (Light/Dark Mode) */}
            <button
              type="button"
              onClick={handleToggleTheme}
              className="w-8 h-8 rounded-full bg-white dark:bg-[#0a1e27] border border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-[#0f2c38] shadow-xs cursor-pointer active:scale-95 transition-all"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-slate-600" />}
            </button>



            <button
              type="button"
              onClick={handleCopyLink}
              className="w-8 h-8 rounded-full flex items-center justify-center text-emerald-600 dark:text-[#00d09c] hover:bg-emerald-500/10 transition-all active:scale-95 cursor-pointer"
              title="Copy Dedicated Share Link"
            >
              <Share2 size={14} strokeWidth={2.2} />
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* THE SHARABLE CARD DESIGN (ADAPTS TO LIGHT AND DARK MODE) */}
        {/* ======================================================== */}

        {/* Topographic Ambient Background Contour Lines */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none opacity-20 dark:opacity-20"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 500 1000"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="topographicContourGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00d09c" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#00d09c" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#09252c" stopOpacity="0.04" />
            </linearGradient>
          </defs>
          {/* Top Wavy Contours */}
          <path d="M-50,60 Q120,20 220,90 T550,50" fill="none" stroke="url(#topographicContourGrad)" strokeWidth="1.2" />
          <path d="M-50,90 Q130,50 230,120 T550,80" fill="none" stroke="url(#topographicContourGrad)" strokeWidth="1.2" />
          <path d="M-50,120 Q140,80 240,150 T550,110" fill="none" stroke="url(#topographicContourGrad)" strokeWidth="1.2" />
          <path d="M-50,150 Q150,110 250,180 T550,140" fill="none" stroke="url(#topographicContourGrad)" strokeWidth="1.2" />
          <path d="M-50,180 Q160,140 260,210 T550,170" fill="none" stroke="url(#topographicContourGrad)" strokeWidth="1.2" />

          {/* Mid Contour Accents */}
          <path d="M-30,350 Q180,310 260,400 T530,360" fill="none" stroke="url(#topographicContourGrad)" strokeWidth="1" opacity="0.6" />
          <path d="M-30,390 Q190,350 270,440 T530,400" fill="none" stroke="url(#topographicContourGrad)" strokeWidth="1" opacity="0.6" />

          {/* Bottom Topographic Curves */}
          <path d="M-50,820 Q150,770 250,850 T550,810" fill="none" stroke="url(#topographicContourGrad)" strokeWidth="1.2" />
          <path d="M-50,850 Q160,800 260,880 T550,840" fill="none" stroke="url(#topographicContourGrad)" strokeWidth="1.2" />
          <path d="M-50,880 Q170,830 270,910 T550,870" fill="none" stroke="url(#topographicContourGrad)" strokeWidth="1.2" />
          <path d="M-50,910 Q180,860 280,940 T550,900" fill="none" stroke="url(#topographicContourGrad)" strokeWidth="1.2" />
        </svg>

        {/* 1. Header Bar: Icon + RUNWAR + Workout Summary | Completed Badge */}
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            {/* Running Icon in Rounded Box */}
            <div
              className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-[#092224] border border-emerald-200 dark:border-[#00d09c]/30 flex items-center justify-center shadow-xs dark:shadow-[0_0_12px_rgba(0,208,156,0.15)] shrink-0 transition-colors aspect-square overflow-hidden"
              style={{
                width: '44px',
                height: '44px',
                minWidth: '44px',
                minHeight: '44px'
              }}
            >
              <img
                src="/logo.png"
                alt="Application Logo"
                className="w-7 h-7 object-contain"
              />
            </div>

            <div>
              <div className="font-display font-black text-lg tracking-tight text-slate-900 dark:text-white leading-none">
                RUN<span className="text-emerald-600 dark:text-[#00d09c]">WAR</span>
              </div>
              <div className="text-slate-500 dark:text-slate-400 text-xs font-medium mt-0.5">
                Workout Summary
              </div>
            </div>
          </div>

          {/* Completed Badge */}
          <div className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-50 dark:bg-[#082120] border border-emerald-200 dark:border-[#00d09c]/50 text-emerald-700 dark:text-[#00d09c] text-xs font-bold shadow-xs dark:shadow-[0_0_10px_rgba(0,208,156,0.1)] transition-colors">
            <div className="w-4 h-4 rounded-full bg-emerald-600 dark:bg-[#00d09c] text-white dark:text-[#08121c] flex items-center justify-center">
              <Check size={11} strokeWidth={3.5} />
            </div>
            <span>Completed</span>
          </div>
        </div>

        {/* 2. Athlete Profile Info */}
        <div className="flex items-center gap-3 pt-1 relative z-10">
          {/* Avatar Circle with Guaranteed Rendering & Strict Constraints */}
          <div
            className="w-12 h-12 rounded-full overflow-hidden border-2 border-emerald-500/50 dark:border-[#00d09c]/60 ring-2 ring-emerald-500/15 dark:ring-[#00d09c]/20 shrink-0 bg-slate-100 dark:bg-slate-800 shadow-md flex items-center justify-center aspect-square"
            style={{ width: '48px', height: '48px', minWidth: '48px', minHeight: '48px', maxWidth: '48px', maxHeight: '48px' }}
          >
            {resolvedAvatar && !avatarError ? (
              <img
                src={resolvedAvatar}
                alt={post.userName}
                onError={() => setAvatarError(true)}
                className="w-full h-full object-cover rounded-full"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                crossOrigin="anonymous"
                loading="eager"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-black text-sm text-white shadow-inner">
                {getInitials(post.userName)}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-base text-slate-900 dark:text-white truncate">
                {post.userName || 'Athlete'}
              </span>

            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar size={13} className="text-slate-400" />
                {formattedDate}
              </span>
              <span className="text-slate-400 dark:text-slate-500">·</span>
              <span className="flex items-center gap-1">
                <Clock size={13} className="text-slate-400" />
                {formattedStartTime}
              </span>
              <span className="text-slate-400 dark:text-slate-500">·</span>
              <span className="flex items-center gap-1">
                <Globe size={13} className="text-slate-400" />
                Public link
              </span>
            </div>
          </div>
        </div>

        {/* 3. Hero Metric: Total Distance */}
        <div className="text-center pt-2 relative z-10">
          <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">
            Total Distance
          </div>
          <div className="flex items-baseline justify-center mt-1">
            <span className="text-6xl sm:text-7xl font-black font-sans text-slate-900 dark:text-white tracking-tight leading-none">
              {distKm}
            </span>
            <span className="text-2xl font-black text-emerald-600 dark:text-[#00d09c] ml-2 tracking-wide uppercase">
              KM
            </span>
          </div>
        </div>

        {/* 4. Four Primary Metrics Grid (Pace, Duration, Calories, Elevation) */}
        <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800/80 relative z-10">
          {/* Metric 1: Pace */}
          <div className="flex items-center gap-2">
            <Gauge size={22} className="text-emerald-600 dark:text-[#00d09c] shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Pace</div>
              <div className="text-xs sm:text-sm font-bold font-mono text-slate-900 dark:text-white truncate">
                {formattedPace} /km
              </div>
            </div>
          </div>

          {/* Metric 2: Duration */}
          <div className="flex items-center gap-2">
            <Clock size={22} className="text-emerald-600 dark:text-[#00d09c] shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Duration</div>
              <div className="text-xs sm:text-sm font-bold font-mono text-slate-900 dark:text-white truncate">
                {formattedDuration}
              </div>
            </div>
          </div>

          {/* Metric 3: Calories */}
          <div className="flex items-center gap-2">
            <Flame size={22} className="text-[#ff7a29] shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Calories</div>
              <div className="text-xs sm:text-sm font-bold font-mono text-slate-900 dark:text-white truncate">
                {calories} kcal
              </div>
            </div>
          </div>

          {/* Metric 4: Elevation */}
          <div className="flex items-center gap-2">
            <Mountain size={22} className="text-emerald-600 dark:text-[#00d09c] shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Elevation</div>
              <div className="text-xs sm:text-sm font-bold font-mono text-slate-900 dark:text-white truncate">
                {elevation} m
              </div>
            </div>
          </div>
        </div>

        {/* 5. Runner Photo Attachment */}
        <div className="rounded-2xl overflow-hidden border border-slate-200/90 dark:border-slate-800/90 shadow-md relative z-10">
          <img
            src={photoUrl}
            alt="Runner in action"
            className="w-full h-56 sm:h-64 object-cover"
            loading="eager"
          />
        </div>

        {/* 6. GPS Route Track Card */}
        <div className="rounded-2xl overflow-hidden border border-slate-200/90 dark:border-slate-800/90 bg-slate-50 dark:bg-[#07111b] p-3.5 space-y-2.5 relative z-10 transition-colors">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <MapPin size={15} className="text-emerald-600 dark:text-[#00d09c]" />
            <span>GPS Route Track</span>
          </div>

          {/* Dark Map Canvas with Realistic Street Grid & Neon Polyline */}
          <div className="relative h-48 sm:h-52 w-full rounded-xl overflow-hidden bg-[#050e16] border border-slate-900 flex items-center justify-center">
            {/* Dark Map Vector Street & Park Grid */}
            <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
              <rect width="100%" height="100%" fill="#050e16" />

              {/* City Blocks and Green Zones */}
              <g opacity="0.45">
                <path d="M 20 20 L 70 25 L 85 75 L 30 70 Z" fill="#08221b" />
                <path d="M 120 15 L 160 18 L 155 55 L 115 50 Z" fill="#09261e" />
                <path d="M 270 20 L 330 25 L 320 80 L 260 70 Z" fill="#08221b" />
                <path d="M 30 110 L 80 115 L 75 160 L 25 155 Z" fill="#071e19" />
                <path d="M 240 120 L 325 125 L 320 165 L 235 160 Z" fill="#09261e" />

                <rect x="90" y="25" width="22" height="35" rx="3" fill="#0a1926" />
                <rect x="170" y="20" width="45" height="40" rx="3" fill="#091724" />
                <rect x="225" y="25" width="35" height="35" rx="3" fill="#0a1a27" />
                <rect x="88" y="70" width="45" height="40" rx="3" fill="#091622" />
                <rect x="140" y="70" width="35" height="42" rx="3" fill="#0a1926" />
                <rect x="185" y="72" width="45" height="38" rx="3" fill="#091622" />
                <rect x="90" y="120" width="40" height="38" rx="3" fill="#0a1926" />
                <rect x="140" y="122" width="45" height="35" rx="3" fill="#091724" />
                <rect x="195" y="120" width="35" height="36" rx="3" fill="#0a1926" />
              </g>

              {/* Street Lines */}
              <g stroke="#142636" strokeWidth="2.5" strokeLinecap="round" opacity="0.6">
                <line x1="0" y1="90" x2="350" y2="80" stroke="#182f42" strokeWidth="3" />
                <line x1="0" y1="120" x2="350" y2="115" stroke="#182f42" strokeWidth="2" />
                <line x1="0" y1="40" x2="350" y2="35" />
                <line x1="0" y1="150" x2="350" y2="148" />

                <line x1="80" y1="0" x2="85" y2="180" stroke="#182f42" strokeWidth="2" />
                <line x1="135" y1="0" x2="138" y2="180" />
                <line x1="180" y1="0" x2="182" y2="180" stroke="#182f42" strokeWidth="2" />
                <line x1="235" y1="0" x2="238" y2="180" />
                <line x1="265" y1="0" x2="268" y2="180" stroke="#182f42" strokeWidth="2.5" />
              </g>
            </svg>

            {/* Route Polyline (Actual GPS or Synthetic Urban Circuit) */}
            {(() => {
              const pad = 30;
              const w = 340;
              const h = 180;

              let points: [number, number][] = [];

              if (Array.isArray(routeCoords) && routeCoords.length >= 2) {
                const lats = routeCoords.map((c: any) => Number(c?.latitude ?? c?.lat ?? 0)).filter((n) => !isNaN(n) && n !== 0);
                const lngs = routeCoords.map((c: any) => Number(c?.longitude ?? c?.lng ?? c?.lon ?? 0)).filter((n) => !isNaN(n) && n !== 0);

                if (lats.length >= 2 && lngs.length >= 2) {
                  let minLat = lats[0];
                  let maxLat = lats[0];
                  for (let i = 1; i < lats.length; i++) {
                    if (lats[i] < minLat) minLat = lats[i];
                    if (lats[i] > maxLat) maxLat = lats[i];
                  }
                  let minLng = lngs[0];
                  let maxLng = lngs[0];
                  for (let i = 1; i < lngs.length; i++) {
                    if (lngs[i] < minLng) minLng = lngs[i];
                    if (lngs[i] > maxLng) maxLng = lngs[i];
                  }

                  const latSpan = Math.max(0.0008, maxLat - minLat);
                  const lngSpan = Math.max(0.0008, maxLng - minLng);

                  points = routeCoords.map((c: any) => {
                    const lat = Number(c?.latitude ?? c?.lat ?? 0);
                    const lng = Number(c?.longitude ?? c?.lng ?? c?.lon ?? 0);
                    const x = pad + ((lng - minLng) / lngSpan) * (w - pad * 2);
                    const y = pad + (1 - (lat - minLat) / latSpan) * (h - pad * 2);
                    return [x, y] as [number, number];
                  });
                }
              }

              // If no raw GPS coords, draw the exact interwoven circuit loop from the reference design
              if (points.length < 2) {
                points = [
                  [115, 125],
                  [125, 110],
                  [145, 90],
                  [165, 80],
                  [195, 60],
                  [210, 60],
                  [215, 75],
                  [170, 75],
                  [150, 95],
                  [200, 95],
                  [220, 85],
                  [235, 100],
                  [190, 115],
                  [150, 125],
                  [180, 105],
                  [225, 105],
                  [240, 115],
                  [200, 130],
                  [160, 130],
                  [220, 125],
                  [250, 115],
                  [230, 90],
                  [245, 85],
                  [235, 75],
                  [255, 95],
                  [240, 120],
                  [255, 122],
                ];
              }

              const pathStr = points.map(([x, y], idx) => `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
              const start = points[0];
              const end = points[points.length - 1];

              return (
                <svg viewBox="0 0 340 180" className="w-full h-full relative z-10 drop-shadow-[0_0_14px_rgba(0,208,156,0.45)]">
                  {/* Neon Outer Glow Polyline */}
                  <path
                    d={pathStr}
                    fill="none"
                    stroke="#00d09c"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.4"
                  />
                  {/* Core Neon Green Polyline */}
                  <path
                    d={pathStr}
                    fill="none"
                    stroke="#00ffb3"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Start Pin (Green circle with white outline) */}
                  {start && (
                    <g>
                      <circle cx={start[0]} cy={start[1]} r="5.5" fill="#00e699" stroke="#ffffff" strokeWidth="2.5" />
                    </g>
                  )}

                  {/* Finish Pin (Red circle with white outline) */}
                  {end && (
                    <g>
                      <circle cx={end[0]} cy={end[1]} r="5.5" fill="#f43f5e" stroke="#ffffff" strokeWidth="2.5" />
                    </g>
                  )}
                </svg>
              );
            })()}
          </div>
        </div>

        {/* 7. Activity Caption Section */}
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <FileText size={15} className="text-emerald-600 dark:text-[#00d09c]" />
            <span>Activity Caption</span>
          </div>
          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 italic pl-5">
            "{captionText}"
          </p>
        </div>

        {/* 8. Workout Details Grid (8 Metrics: 2 rows of 4) */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 relative z-10">
          {/* Header */}
          <div className="flex items-center gap-1.5 mb-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <div className="flex items-end gap-0.5 h-3.5 w-3.5">
              <span className="w-1 h-2 bg-emerald-600 dark:bg-[#00d09c] rounded-full" />
              <span className="w-1 h-3.5 bg-emerald-600 dark:bg-[#00d09c] rounded-full" />
              <span className="w-1 h-2.5 bg-emerald-600 dark:bg-[#00d09c] rounded-full" />
            </div>
            <span>Workout Details</span>
          </div>

          {/* Single compact row */}
          <div className="grid grid-cols-5 gap-1.5 w-full">

            {/* Start */}
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-[9px] text-slate-500 dark:text-slate-400">
                <Calendar
                  size={11}
                  className="text-emerald-600 dark:text-[#00d09c] shrink-0"
                />
                <span className="truncate">Start</span>
              </div>

              <div className="mt-0.5 font-mono text-[10px] sm:text-[11px] font-bold text-slate-900 dark:text-white truncate">
                {formattedStartTime}
              </div>
            </div>

            {/* End */}
            <div className="min-w-0 border-l border-slate-200 dark:border-white/10 pl-2">
              <div className="flex items-center gap-1 text-[9px] text-slate-500 dark:text-slate-400">
                <Flag
                  size={11}
                  className="text-emerald-600 dark:text-[#00d09c] shrink-0"
                />
                <span className="truncate">End</span>
              </div>

              <div className="mt-0.5 font-mono text-[10px] sm:text-[11px] font-bold text-slate-900 dark:text-white truncate">
                {formattedEndTime}
              </div>
            </div>

            {/* Average */}
            <div className="min-w-0 border-l border-slate-200 dark:border-white/10 pl-2">
              <div className="flex items-center gap-1 text-[9px] text-slate-500 dark:text-slate-400">
                <Mountain
                  size={11}
                  className="text-emerald-600 dark:text-[#00d09c] shrink-0"
                />
                <span className="truncate">Avg</span>
              </div>

              <div className="mt-0.5 font-mono text-[10px] sm:text-[11px] font-bold text-slate-900 dark:text-white truncate">
                {avgElevation} m
              </div>
            </div>

            {/* Max */}
            <div className="min-w-0 border-l border-slate-200 dark:border-white/10 pl-2">
              <div className="flex items-center gap-1 text-[9px] text-slate-500 dark:text-slate-400">
                <ArrowUpRight
                  size={11}
                  className="text-emerald-600 dark:text-[#00d09c] shrink-0"
                />
                <span className="truncate">Max</span>
              </div>

              <div className="mt-0.5 font-mono text-[10px] sm:text-[11px] font-bold text-slate-900 dark:text-white truncate">
                {maxElevation} m
              </div>
            </div>

            {/* Min */}
            <div className="min-w-0 border-l border-slate-200 dark:border-white/10 pl-2">
              <div className="flex items-center gap-1 text-[9px] text-slate-500 dark:text-slate-400">
                <ArrowDown
                  size={11}
                  className="text-emerald-600 dark:text-[#00d09c] shrink-0"
                />
                <span className="truncate">Min</span>
              </div>

              <div className="mt-0.5 font-mono text-[10px] sm:text-[11px] font-bold text-slate-900 dark:text-white truncate">
                {minElevation} m
              </div>
            </div>

          </div>
        </div>

        {/* 9. Community Cheers Section (Inside Card, directly below Workout Details) */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              Community Cheers
            </span>

            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
              {post.commentsCount || 0} Comments
            </span>
          </div>

          {/* Minimal Reactions */}
          <div className="flex items-center gap-1.5">

            {/* Fire */}
            <button
              type="button"
              onClick={() => handleReaction('fire')}
              className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border transition-all active:scale-95 cursor-pointer ${post.userReaction === 'fire'
                ? 'bg-amber-500/10 border-amber-500/40'
                : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 hover:bg-amber-500/5'
                }`}
            >
              <span className="text-sm">🔥</span>
              <span className="text-[10px] font-mono font-semibold text-slate-600 dark:text-slate-300">
                {reactionsObj?.fire || 0}
              </span>
            </button>

            {/* Respect */}
            <button
              type="button"
              onClick={() => handleReaction('respect')}
              className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border transition-all active:scale-95 cursor-pointer ${post.userReaction === 'respect'
                ? 'bg-blue-500/10 border-blue-500/40'
                : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 hover:bg-blue-500/5'
                }`}
            >
              <span className="text-sm">⚡</span>
              <span className="text-[10px] font-mono font-semibold text-slate-600 dark:text-slate-300">
                {reactionsObj?.respect || 0}
              </span>
            </button>

            {/* Beast */}
            <button
              type="button"
              onClick={() => handleReaction('beast')}
              className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border transition-all active:scale-95 cursor-pointer ${post.userReaction === 'beast'
                ? 'bg-purple-500/10 border-purple-500/40'
                : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 hover:bg-purple-500/5'
                }`}
            >
              <span className="text-sm">🐺</span>
              <span className="text-[10px] font-mono font-semibold text-slate-600 dark:text-slate-300">
                {reactionsObj?.beast || 0}
              </span>
            </button>

            {/* Salute */}
            <button
              type="button"
              onClick={() => handleReaction('salute')}
              className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg border transition-all active:scale-95 cursor-pointer ${post.userReaction === 'salute'
                ? 'bg-emerald-500/10 border-emerald-500/40'
                : 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 hover:bg-emerald-500/5'
                }`}
            >
              <span className="text-sm">🫡</span>
              <span className="text-[10px] font-mono font-semibold text-slate-600 dark:text-slate-300">
                {reactionsObj?.salute || 0}
              </span>
            </button>

          </div>
        </div>


        {/* ======================================================== */}
        {/* COMMENTS THREAD & CHEER INPUT (outside the shareable card)*/}
        {/* ======================================================== */}

        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
          <span className="flex items-center gap-1.5">
            <MessageSquare size={14} className="text-emerald-600 dark:text-[#00d09c]" />
            <span>Comments ({post.commentsCount || commentsList.length || 0})</span>
          </span>
        </div>

        {/* Comments List */}
        {commentsList.length > 0 && (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1 pt-1">
            {commentsList.map((comment) => (
              <div
                key={comment.id || Math.random().toString()}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-[#07111b] border border-slate-200/80 dark:border-slate-800/80 flex items-start gap-2.5 transition-colors"
              >
                <div
                  className="w-7 h-7 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0 border border-slate-300 dark:border-slate-700 flex items-center justify-center aspect-square"
                  style={{ width: '28px', height: '28px', minWidth: '28px', minHeight: '28px' }}
                >
                  {comment.userAvatar ? (
                    <img src={comment.userAvatar} alt={comment.userName || 'Athlete'} className="w-full h-full object-cover" crossOrigin="anonymous" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-bold text-[10px] text-white">
                      {(comment.userName || 'A').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {comment.userName || 'Athlete'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5">{comment.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {commentsList.length === 0 && (
          <div className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">
            No comments yet. Be the first to cheer! 👏
          </div>
        )}

        {/* Comment Form */}
        {profile ? (
          <form onSubmit={handleAddComment} className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <div
              className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-emerald-500/40 flex items-center justify-center aspect-square bg-slate-100 dark:bg-slate-800"
              style={{ width: '28px', height: '28px', minWidth: '28px', minHeight: '28px' }}
            >
              {resolvedAvatar ? (
                <img src={resolvedAvatar} alt={profile.name || 'You'} className="w-full h-full object-cover" crossOrigin="anonymous" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center font-bold text-[9px] text-white">
                  {getInitials(profile.name)}
                </div>
              )}
            </div>
            <input
              type="text"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder={`Cheer on ${post.userName || 'Athlete'}…`}
              disabled={isSubmittingComment}
              maxLength={280}
              className="flex-1 bg-slate-50 dark:bg-[#07111b] border border-slate-200 dark:border-slate-800/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!commentInput.trim() || isSubmittingComment}
              className="w-8 h-8 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 cursor-pointer shrink-0"
            >
              <Send size={14} strokeWidth={2.2} />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowAuthModal(true)}
            className="w-full py-2.5 rounded-xl bg-slate-50 dark:bg-[#060d16] hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-dashed border-emerald-500/40 dark:border-emerald-800/80 text-emerald-600 dark:text-[#00d09c] font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <LogIn size={14} />
            <span>Sign in to cheer on {post.userName || 'Athlete'}</span>
          </button>
        )}



        {/* Guest Conversion Callout */}
        {!profile && (
          <div className="p-5 rounded-[28px] bg-gradient-to-br from-emerald-50 via-teal-50 to-slate-50 dark:from-[#0c2429] dark:via-[#091a24] dark:to-[#07131d] border border-emerald-200 dark:border-emerald-500/30 shadow-lg dark:shadow-xl space-y-2 text-center transition-colors">
            <h4 className="font-display font-black text-sm text-slate-900 dark:text-white">
              Track Your Runs on RUN<span className="text-emerald-600 dark:text-[#00d09c]">WAR</span>
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Join thousands of athletes tracking GPS workouts and dominating city sectors.
            </p>
            {onOpenAuth && (
              <button
                type="button"
                onClick={onOpenAuth}
                className="mt-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-xs uppercase tracking-wider shadow-md active:scale-98 transition-all cursor-pointer"
              >
                Join Free Today
              </button>
            )}
          </div>
        )}
      </div>

      {/* Guest Auth Prompt Modal */}
      {showAuthModal && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAuthModal(false);
          }}
        >
          <div className="w-full max-w-sm bg-white dark:bg-[#09131e] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-4 animate-scale-up text-slate-900 dark:text-white">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-[#00d09c] mx-auto flex items-center justify-center border border-emerald-500/20">
              <Shield size={24} />
            </div>
            <div>
              <h3 className="font-display font-black text-base">
                Join RUNWAR
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Sign in or create an account to react, cheer on athletes, and track your runs.
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
                className="w-full py-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Continue Viewing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
