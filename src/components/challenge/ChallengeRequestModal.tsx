import React, { useState } from 'react';
import { X, Trophy, MapPin, Clock, Check, XCircle, UserCircle, Loader2, ChevronRight } from 'lucide-react';
import { Challenge } from '../../types';
import { challengeService } from '../../services/challengeService';
import { formatDuration } from '../../utils/formatters';

interface Props {
  isOpen: boolean;
  challenge: Challenge | null;
  currentUserId: string;
  onAccepted: (challenge: Challenge) => void;
  onRejected: () => void;
  onClose: () => void;
}

export const ChallengeRequestModal: React.FC<Props> = ({
  isOpen, challenge, currentUserId, onAccepted, onRejected, onClose
}) => {
  const [loading, setLoading] = useState<'accept' | 'reject' | null>(null);
  const [error, setError] = useState('');

  if (!isOpen || !challenge) return null;

  const creator = challenge.creator_profile;
  const dist = challenge.target_distance_meters;
  const distKm = (dist / 1000).toFixed(1);
  const distMi = (dist / 1609.34).toFixed(2);

  const creatorDisplayName = creator?.name || 'A runner';
  const creatorUsername = (creator as any)?.username;

  const handleAccept = async () => {
    setLoading('accept');
    setError('');
    try {
      const updated = await challengeService.acceptChallenge(challenge.id, currentUserId);
      onAccepted(updated);
    } catch (e: any) {
      setError(e?.message || 'Failed to accept challenge.');
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    setLoading('reject');
    setError('');
    try {
      await challengeService.rejectChallenge(challenge.id, currentUserId);
      onRejected();
    } catch (e: any) {
      setError(e?.message || 'Failed to reject challenge.');
    } finally {
      setLoading(null);
    }
  };

  const expiresAt = new Date(challenge.start_window_end);
  const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  return (
    <div className="fixed inset-0 z-[99999] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-lg bg-white dark:bg-[#0f0f1a] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-t-3xl shadow-2xl animate-slide-up overflow-hidden"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header bar */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-600/20 dark:to-teal-700/20" />
          <div className="relative px-6 pt-6 pb-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Incoming Challenge</div>
              <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 dark:text-white/40 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Challenger avatar */}
            <div className="flex items-center gap-4 mb-5">
              <div className="relative">
                {(creator as any)?.avatar_url ? (
                  <img src={(creator as any).avatar_url} alt={creatorDisplayName} className="w-16 h-16 rounded-2xl object-cover ring-2 ring-emerald-500/40" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 flex items-center justify-center ring-2 ring-emerald-500/20">
                    <UserCircle size={36} className="text-slate-400 dark:text-white/40" />
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/30">
                  <Trophy size={12} className="text-white" />
                </div>
              </div>
              <div>
                <div className="text-slate-900 dark:text-white font-bold text-lg leading-tight">{creatorDisplayName}</div>
                {creatorUsername && <div className="text-slate-500 dark:text-white/50 text-sm">@{creatorUsername}</div>}
                <div className="text-emerald-600 dark:text-emerald-400/90 text-xs font-semibold mt-1">is challenging you! 🔥</div>
              </div>
            </div>

            {/* Challenge title */}
            <h2 className="text-slate-900 dark:text-white font-black text-2xl mb-1">{challenge.title}</h2>
            <p className="text-slate-600 dark:text-white/50 text-sm">Race to {distKm} KM before they do</p>
          </div>
        </div>

        {/* Stats */}
        <div className="px-6 py-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 dark:bg-white/[0.05] border border-slate-200/80 dark:border-transparent rounded-2xl p-3 text-center">
              <div className="text-emerald-600 dark:text-emerald-400 font-black text-xl">{distKm}</div>
              <div className="text-slate-500 dark:text-white/40 text-xs mt-0.5">KM</div>
            </div>
            <div className="bg-slate-50 dark:bg-white/[0.05] border border-slate-200/80 dark:border-transparent rounded-2xl p-3 text-center">
              <div className="text-slate-900 dark:text-white font-black text-xl capitalize">{challenge.challenge_type.replace('_', ' ')}</div>
              <div className="text-slate-500 dark:text-white/40 text-xs mt-0.5">Type</div>
            </div>
            <div className="bg-slate-50 dark:bg-white/[0.05] border border-slate-200/80 dark:border-transparent rounded-2xl p-3 text-center">
              <div className={`font-black text-xl ${daysLeft <= 1 ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{daysLeft}d</div>
              <div className="text-slate-500 dark:text-white/40 text-xs mt-0.5">To Accept</div>
            </div>
          </div>

          {/* Rules */}
          <div className="mt-4 space-y-2">
            {[
              { icon: <MapPin size={14} />, text: `First to run ${distKm} KM wins` },
              { icon: <Clock size={14} />, text: 'Both runners start independently' },
              { icon: <Trophy size={14} />, text: 'Live progress is tracked in real-time' },
            ].map((rule, i) => (
              <div key={i} className="flex items-center gap-2 text-slate-600 dark:text-white/50 text-xs">
                <span className="text-emerald-500 dark:text-emerald-400/80">{rule.icon}</span>
                {rule.text}
              </div>
            ))}
          </div>

          {error && <p className="text-rose-500 dark:text-rose-400 text-sm mt-3">{error}</p>}

          {/* CTA buttons */}
          <div className="mt-5 flex gap-3 pb-2">
            <button
              onClick={handleReject}
              disabled={!!loading}
              className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/60 text-sm font-semibold hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:border-rose-300 dark:hover:border-rose-500/30 hover:text-rose-600 dark:hover:text-rose-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading === 'reject' ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
              Decline
            </button>
            <button
              onClick={handleAccept}
              disabled={!!loading}
              className="flex-[2] py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-base shadow-lg shadow-emerald-500/30 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading === 'accept' ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
              {loading === 'accept' ? 'Accepting…' : "Accept Challenge!"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

