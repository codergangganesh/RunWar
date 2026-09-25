import React, { useState, useRef, useEffect } from 'react';
import { Trophy, Clock, Check, X, ChevronRight, UserCircle, Loader2, MapPin, Flag, MoreVertical, Pencil, Trash2, Share2 } from 'lucide-react';
import { Challenge, ChallengeStatus } from '../../types';
import { challengeService } from '../../services/challengeService';

interface Props {
  challenge: Challenge;
  currentUserId: string;
  onAccept?: (c: Challenge) => void;
  onReject?: () => void;
  onPress?: (c: Challenge) => void;
  onStartRun?: (c: Challenge) => void;
  onEdit?: (c: Challenge) => void;
  onDelete?: (c: Challenge) => void;
}

const STATUS_STYLES: Record<string, { label: string; dotClass: string; badgeClass: string }> = {
  pending: { label: 'Pending', dotClass: 'bg-amber-500', badgeClass: 'bg-amber-50 dark:bg-yellow-400/10 text-amber-700 dark:text-yellow-400 border-amber-200 dark:border-yellow-400/20' },
  accepted: { label: 'Accepted', dotClass: 'bg-emerald-500', badgeClass: 'bg-emerald-50 dark:bg-green-400/10 text-emerald-700 dark:text-green-400 border-emerald-200 dark:border-green-400/20' },
  active: { label: 'In Race', dotClass: 'bg-emerald-500 animate-pulse', badgeClass: 'bg-emerald-50 dark:bg-emerald-400/15 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-400/30' },
  completed: { label: 'Finished', dotClass: 'bg-blue-500', badgeClass: 'bg-blue-50 dark:bg-blue-400/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-400/20' },
  rejected: { label: 'Declined', dotClass: 'bg-rose-500', badgeClass: 'bg-rose-50 dark:bg-rose-400/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-400/20' },
  cancelled: { label: 'Cancelled', dotClass: 'bg-slate-400', badgeClass: 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/30 border-slate-200 dark:border-white/10' },
  expired: { label: 'Expired', dotClass: 'bg-slate-400', badgeClass: 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-white/30 border-slate-200 dark:border-white/10' },
};

export const ChallengeCard: React.FC<Props> = ({
  challenge, currentUserId, onAccept, onReject, onPress, onStartRun, onEdit, onDelete
}) => {
  const [loading, setLoading] = useState<'accept' | 'reject' | null>(null);
  const [error, setError] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const isCreator = challenge.creator_id === currentUserId;
  const myPart = challenge.my_participation;
  const oppPart = challenge.opponent_participation;
  const opponent = isCreator ? challenge.opponent_profile : challenge.creator_profile;
  const opponentName = opponent?.name || (isCreator ? 'Waiting for opponent' : 'Challenger');
  const dist = challenge.target_distance_meters;
  const distKm = (dist / 1000).toFixed(1);
  const statusInfo = STATUS_STYLES[challenge.status] || STATUS_STYLES.pending;

  const isPending = challenge.status === 'pending' && !isCreator && myPart?.status === 'pending';
  const isAccepted = challenge.status === 'accepted' || (challenge.status === 'pending' && isCreator);
  const isActive = challenge.status === 'active';
  const isCompleted = challenge.status === 'completed';

  const myProgress = myPart ? Math.min(100, ((myPart.current_distance_meters || 0) / dist) * 100) : 0;
  const oppProgress = oppPart ? Math.min(100, ((oppPart.current_distance_meters || 0) / dist) * 100) : 0;

  const winner = challenge.winner_user_id;
  const iWon = winner === currentUserId;

  const handleAccept = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading('accept');
    setError('');
    try {
      const updated = await challengeService.acceptChallenge(challenge.id, currentUserId);
      onAccept?.(updated);
    } catch (err: any) {
      setError(err?.message || 'Error accepting.');
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading('reject');
    try {
      await challengeService.rejectChallenge(challenge.id, currentUserId);
      onReject?.();
    } catch { }
    finally { setLoading(null); }
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const url = await challengeService.getShareableLinkForChallenge(challenge.id);
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            title: challenge.title,
            text: `🏃 Accept my ${(dist / 1000).toFixed(1)} KM challenge on RunWar!`,
            url: url,
          });
          setShareSuccess(true);
          setTimeout(() => setShareSuccess(false), 2500);
          return;
        } catch (err: any) {
          if (err.name === 'AbortError') return;
        }
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 2500);
      }
    } catch (err) {
      console.warn('Share challenge error:', err);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div
      onClick={() => onPress?.(challenge)}
      className="relative bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-white/[0.08] rounded-3xl overflow-visible active:scale-[0.98] transition-all cursor-pointer hover:border-slate-300 dark:hover:border-white/20 shadow-sm hover:shadow-md"
    >
      {/* Toast feedback banner */}
      {shareSuccess && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 dark:bg-slate-800/95 text-white text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-lg backdrop-blur-md flex items-center gap-1.5 border border-white/20 animate-fade-in pointer-events-none">
          <Check size={14} className="text-emerald-400" />
          <span>Challenge link copied!</span>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        {/* Opponent avatar */}
        <div className="relative shrink-0">
          {(opponent as any)?.avatar_url ? (
            <img src={(opponent as any).avatar_url} alt={opponentName} className="w-11 h-11 rounded-2xl object-cover ring-1 ring-slate-200 dark:ring-white/10" />
          ) : (
            <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-white/10 flex items-center justify-center">
              <UserCircle size={26} className="text-slate-400 dark:text-white/30" />
            </div>
          )}
          {isActive && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-[#0f0f1a] animate-pulse" />
          )}
        </div>

        {/* Title + opponent name */}
        <div className="flex-1 min-w-0">
          <div className="text-slate-900 dark:text-white font-semibold text-sm truncate">{challenge.title}</div>
          <div className="text-slate-500 dark:text-white/40 text-xs mt-0.5 truncate">
            {(challenge.all_participations || []).length > 2
              ? `Group Race (${(challenge.all_participations || []).length} Runners)`
              : `${isCreator ? 'vs ' : 'from '}${opponentName}${(opponent as any)?.username ? ` @${(opponent as any).username}` : ''}`}
          </div>
        </div>

        {/* Status badge */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold shrink-0 ${statusInfo.badgeClass}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
          {statusInfo.label}
        </div>

        {/* Three-Dot (⋮) Options Menu */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu((prev) => !prev);
            }}
            className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 dark:text-white/40 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
            title="Challenge options"
          >
            <MoreVertical size={18} />
          </button>

          {showMenu && (
            <div
              className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden text-xs py-1 animate-scale-up select-none"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={async () => {
                  setShowMenu(false);
                  await handleShare();
                }}
                disabled={isSharing}
                className="w-full px-3.5 py-2.5 flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-semibold cursor-pointer text-left"
              >
                <Share2 size={14} className="text-emerald-500 shrink-0" />
                <span>{isSharing ? 'Generating Link...' : 'Share Challenge'}</span>
              </button>

              {isCreator && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onEdit?.(challenge);
                    }}
                    className="w-full px-3.5 py-2.5 flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-semibold cursor-pointer text-left border-t border-slate-100 dark:border-slate-800/80"
                  >
                    <Pencil size={14} className="text-emerald-500 shrink-0" />
                    <span>Edit Challenge</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onDelete?.(challenge);
                    }}
                    className="w-full px-3.5 py-2.5 flex items-center gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 font-semibold cursor-pointer text-left border-t border-slate-100 dark:border-slate-800/80"
                  >
                    <Trash2 size={14} className="shrink-0" />
                    <span>Delete Challenge</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Distance + target */}
      <div className="px-4 pb-3.5">
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-white/40 mb-3">
          <span className="flex items-center gap-1 font-medium"><MapPin size={11} className="text-emerald-500" />{distKm} KM</span>
          <span className="flex items-center gap-1 font-medium capitalize"><Trophy size={11} className="text-amber-500" />{challenge.challenge_type.replace('_', ' ')}</span>
          {isCompleted && winner && (
            <span className={`flex items-center gap-1 font-bold ${iWon ? 'text-amber-600 dark:text-yellow-400' : 'text-slate-500 dark:text-white/40'}`}>
              <Trophy size={11} className="text-amber-500" />{iWon ? 'You won' : 'They won'}
            </span>
          )}
        </div>

        {/* Progress bars (show for active/completed) */}
        {(isActive || isCompleted || (isAccepted && myPart?.status === 'active')) && (
          <div className="space-y-2">
            {(challenge.all_participations || []).length > 2 ? (
              (challenge.all_participations || []).map((part) => {
                const isMe = part.user_id === currentUserId;
                const pName = isMe
                  ? 'You'
                  : (part.profile?.name || (part.profile?.username ? `@${part.profile.username}` : 'Runner'));
                const pPct = Math.min(100, ((part.current_distance_meters || 0) / dist) * 100);
                return (
                  <div key={part.id || part.user_id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={`font-medium flex items-center gap-1 ${isMe ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-600 dark:text-white/60'}`}>
                        {pName}
                      </span>
                      <span className={`font-bold font-mono ${isMe ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
                        {pPct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isMe ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`}
                        style={{ width: `${pPct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 dark:text-white/60 font-medium">You</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">{myProgress.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500" style={{ width: `${myProgress}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-500 dark:text-white/40 font-medium">{opponentName}</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold font-mono">{oppProgress.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${oppProgress}%` }} />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Pending: invitee actions */}
        {isPending && (
          <div className="mt-3">
            {error && <p className="text-rose-500 dark:text-rose-400 text-xs mb-2">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleReject}
                disabled={!!loading}
                className="flex-1 py-2 rounded-2xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/50 text-sm hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-300 dark:hover:border-rose-500/30 hover:text-rose-600 dark:hover:text-rose-400 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {loading === 'reject' ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                Decline
              </button>
              <button
                onClick={handleAccept}
                disabled={!!loading}
                className="flex-[2] py-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-bold shadow-md shadow-emerald-500/25 hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
              >
                {loading === 'accept' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {loading === 'accept' ? 'Accepting…' : 'Accept!'}
              </button>
            </div>
          </div>
        )}

        {/* Accepted: start run */}
        {(isAccepted || (challenge.status === 'pending' && isCreator)) && myPart?.status !== 'active' && myPart?.status !== 'completed' && onStartRun && (
          <button
            onClick={(e) => { e.stopPropagation(); onStartRun(challenge); }}
            className="mt-3 w-full py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-600/10 dark:from-emerald-500/20 dark:to-teal-600/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold text-sm hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
          >
            <Flag size={16} /> Start My Run
          </button>
        )}
      </div>
    </div>
  );
};

