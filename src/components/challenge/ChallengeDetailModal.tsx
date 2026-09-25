import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  Trophy,
  Calendar,
  Clock,
  MapPin,
  Zap,
  Timer,
  Share2,
  Check,
  UserCircle,
  Activity,
  Flag,
  Award,
  Layers,
  Sparkles,
  Gauge,
  Flame,
  Swords,
  CheckCircle2,
  Pencil,
} from 'lucide-react';
import { Challenge, ChallengeParticipant, GPSCoordinate } from '../../types';
import { formatDistance, formatDuration, formatPace } from '../../utils/formatters';
import { formatLocalDateFull, formatLocalTime } from '../../utils/dateUtils';
import { StaticRouteMap } from '../map/StaticRouteMap';

interface Props {
  isOpen: boolean;
  challenge: Challenge | null;
  currentUserId: string;
  distanceUnit?: 'km' | 'mi';
  onClose: () => void;
  onStartRun?: (c: Challenge) => void;
  onEdit?: (c: Challenge) => void;
}

export const ChallengeDetailModal: React.FC<Props> = ({
  isOpen,
  challenge,
  currentUserId,
  distanceUnit = 'km',
  onClose,
  onStartRun,
  onEdit,
}) => {
  const [copied, setCopied] = useState(false);

  // Compute hydrated participants list
  const participants = useMemo(() => {
    if (!challenge) return [];
    let list = challenge.all_participations || [];

    if (!list.length) {
      if (challenge.my_participation) list.push(challenge.my_participation);
      if (challenge.opponent_participation) list.push(challenge.opponent_participation);
    }

    const sorted = [...list].sort((a, b) => {
      if (a.status === 'completed' && b.status === 'completed') {
        return (a.completion_position || 99) - (b.completion_position || 99);
      }
      if (a.status === 'completed') return -1;
      if (b.status === 'completed') return 1;
      return (b.current_distance_meters || 0) - (a.current_distance_meters || 0);
    });

    return sorted;
  }, [challenge]);

  if (!isOpen || !challenge) return null;

  const distMeters = challenge.target_distance_meters;
  const distKm = (distMeters / 1000).toFixed(1);
  const isCreator = challenge.creator_id === currentUserId;
  const winnerId = challenge.winner_user_id;
  const isCompleted = challenge.status === 'completed';
  const isActive = challenge.status === 'active';
  const isPending = challenge.status === 'pending';

  const myPart = challenge.my_participation;

  const handleShare = () => {
    const url = window.location.origin + `/?invite=${challenge.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[99999] flex justify-end bg-black/70 backdrop-blur-md select-none"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Right-to-Left Side Drawer Panel (styled like History Detail screen) */}
      <div className="relative w-full max-w-2xl bg-slate-50 dark:bg-[#080810] text-slate-900 dark:text-white h-full shadow-2xl flex flex-col animate-slide-left overflow-hidden border-l border-slate-200 dark:border-white/10 z-10">
        {/* 1. Top Navigation Bar (History Screen Style) */}
        <div className="px-5 pt-safe pt-4 pb-3.5 flex items-center justify-between border-b border-slate-200/80 dark:border-white/[0.07] bg-white/90 dark:bg-slate-950/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              className="p-2 -ml-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-white/80 transition-colors cursor-pointer"
              title="Go back"
            >
              <ChevronLeft size={24} />
            </button>
            <div className="min-w-0">
              <h2 className="text-slate-900 dark:text-white font-black text-lg leading-tight truncate">
                Challenge Analysis
              </h2>
              <p className="text-slate-500 dark:text-white/40 text-xs truncate">
                {distKm} KM Target • {participants.length} Runner{participants.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">

            <button
              onClick={handleShare}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${copied
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/60 hover:bg-slate-200 dark:hover:bg-white/20'
                }`}
            >
              {copied ? <Check size={14} /> : <Share2 size={14} />}
              <span>{copied ? 'Copied' : ''}</span>
            </button>
          </div>
        </div>

        {/* 2. Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">

          {/* ── TOP HEADER CARD (Matching WorkoutDetailScreen History Style) ── */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-3">
            {/* Date & Activity Type Badge */}
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  <Calendar size={13} className="text-emerald-600 dark:text-emerald-400" />
                  <span>{formatLocalDateFull(challenge.start_window_start)}</span>
                </div>
                <h2 className="font-display text-2xl font-black text-slate-950 dark:text-white capitalize">
                  {challenge.title}
                </h2>
              </div>

              <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1 ${isCompleted
                ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30'
                : (isActive || challenge.status === 'accepted')
                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30'
                }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isCompleted ? 'bg-blue-500' : isActive ? 'bg-emerald-500 animate-pulse' : challenge.status === 'accepted' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span className="capitalize">{challenge.status}</span>
              </div>
            </div>

            {/* Start Window & Expiration Pill */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-300 bg-emerald-50/60 dark:bg-slate-950/60 px-3.5 py-2 rounded-xl border border-emerald-100/80 dark:border-slate-800/80 w-full">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Clock size={13} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Window: <strong className="text-slate-950 dark:text-white">{formatLocalTime(challenge.start_window_start)} – {formatLocalDateFull(challenge.start_window_end)}</strong></span>
                </div>
              </div>


            </div>

            {/* 4 Primary Metric Columns (Matching WorkoutDetailScreen) */}
            <div className="grid grid-cols-4 gap-1 pt-3 border-t border-slate-100 dark:border-slate-800/80 text-center">
              <div>
                <div className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">TARGET</div>
                <div className="font-display text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {distKm} KM
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">ATHLETES</div>
                <div className="font-mono text-base sm:text-lg font-bold text-slate-950 dark:text-white mt-0.5">
                  {participants.length}
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">TYPE</div>
                <div className="font-mono text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-200 mt-1 capitalize truncate">
                  {challenge.challenge_type.replace('_', ' ')}
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">WINNER</div>
                <div className="font-display text-xs sm:text-sm font-black text-amber-600 dark:text-yellow-400 mt-1 truncate">
                  {isCompleted && winnerId ? 'Decided' : isActive ? 'In Race' : 'Pending'}
                </div>
              </div>
            </div>
          </div>

          {/* ── GPS COURSE ROUTE MAP CARD (Matching History StaticRouteMap) ── */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-sm text-slate-950 dark:text-white">GPS Course Route</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">{distKm} KM Circuit</span>
            </div>

            {((challenge as any).route_coordinates?.length > 0 || (myPart as any)?.route_coordinates?.length > 0) ? (
              <div className="relative h-64 w-full rounded-2xl overflow-hidden border border-slate-200/80 dark:border-white/10 shadow-xs">
                <StaticRouteMap coordinates={(challenge as any).route_coordinates || (myPart as any)?.route_coordinates || []} interactive={true} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                <MapPin size={24} className="text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">GPS Course Route Map</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Route map will record live during your challenge run.</p>
              </div>
            )}
          </div>

          {/* ── EVERY PARTICIPANT'S HISTORY DETAIL CARD ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1 pt-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">

                <span>Runner Performance Details ({participants.length})</span>
              </h3>
            </div>

            {participants.map((part, index) => {
              const profile = part.profile;
              const isMe = part.user_id === currentUserId;
              const pName = isMe ? 'You' : (profile?.name || (profile?.username ? `@${profile.username}` : `Runner ${index + 1}`));
              const username = profile?.username ? `@${profile.username}` : '';
              const pDist = part.current_distance_meters || part.completion_distance_meters || 0;
              const pct = Math.min(100, (pDist / distMeters) * 100);

              const paceVal = part.current_pace || 0;
              const formattedPace = paceVal > 0 ? formatPace(paceVal) : '--:--';

              const durVal = part.current_duration_seconds || part.completion_duration_seconds || 0;
              const formattedDur = durVal > 0 ? formatDuration(durVal) : '00:00';

              const speedKmH = paceVal > 0 ? (3600 / paceVal).toFixed(1) : '0.0';
              const isWinner = challenge.winner_user_id === part.user_id || part.completion_position === 1;

              const splits = (part as any).splits || [];

              return (
                <div
                  key={part.id || part.user_id || index}
                  className={`rounded-3xl border p-4 sm:p-5 shadow-sm space-y-3 transition-all ${isMe
                    ? 'bg-gradient-to-br from-emerald-500/10 via-white to-teal-500/10 dark:from-emerald-500/15 dark:via-slate-900 dark:to-teal-500/15 border-emerald-500/40 shadow-md'
                    : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800'
                    }`}
                >
                  {/* Runner Card Top Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Rank Position Badge */}
                      <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-xs shadow-xs shrink-0 ${index === 0
                        ? 'bg-amber-500 text-white shadow-amber-500/30 font-black'
                        : index === 1
                          ? 'bg-slate-300 text-slate-900 dark:bg-slate-700 dark:text-white font-bold'
                          : index === 2
                            ? 'bg-amber-700 text-white font-bold'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300/60 dark:border-slate-700 font-bold'
                        }`}>
                        {`#${index + 1}`}
                      </div>

                      {/* Avatar & Names */}
                      <div className="flex items-center gap-2.5">
                        {profile?.avatar_url ? (
                          <img
                            src={profile.avatar_url}
                            alt={pName}
                            className="w-10 h-10 rounded-2xl object-cover ring-2 ring-slate-200 dark:ring-white/10"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-white/10 flex items-center justify-center text-slate-400 dark:text-white/40">
                            <UserCircle size={24} />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-sm font-black ${isMe ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-950 dark:text-white'}`}>
                              {pName}
                            </span>
                            {part.role === 'creator' && (
                              <span className="px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-white/50 text-[9px] font-bold">
                                Creator
                              </span>
                            )}
                          </div>
                          {username && <div className="text-slate-500 dark:text-slate-400 text-xs">{username}</div>}
                        </div>
                      </div>
                    </div>

                    {/* Status / Winner Badge */}
                    <div className="flex items-center gap-1.5">
                      {isWinner ? (
                        <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-600 dark:text-yellow-400 border border-amber-500/30 text-xs font-black flex items-center gap-1">
                          Winner
                        </span>
                      ) : (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${part.status === 'completed'
                          ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                          : part.status === 'active'
                            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                            : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/60 border-slate-200 dark:border-white/10'
                          }`}>
                          {part.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Distance Progress Bar */}
                  <div className="space-y-1 bg-slate-50/80 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400 font-semibold">
                        Progress: <strong className="text-slate-950 dark:text-white">{(pDist / 1000).toFixed(2)} / {distKm} KM</strong>
                      </span>
                      <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${isMe ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'
                          }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* 4 Metric Stat Columns (Identical to History WorkoutDetailScreen) */}
                  <div className="grid grid-cols-4 gap-1 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-center">
                    <div>
                      <div className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">DISTANCE</div>
                      <div className="font-display text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                        {(pDist / 1000).toFixed(2)} km
                      </div>
                    </div>

                    <div>
                      <div className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">TIME</div>
                      <div className="font-mono text-sm sm:text-base font-bold text-slate-950 dark:text-white mt-0.5">
                        {formattedDur}
                      </div>
                    </div>

                    <div>
                      <div className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">AVG PACE</div>
                      <div className="font-mono text-sm sm:text-base font-bold text-slate-900 dark:text-slate-200 mt-0.5">
                        {formattedPace}
                      </div>
                    </div>

                    <div>
                      <div className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400">AVG SPEED</div>
                      <div className="font-mono text-sm sm:text-base font-bold text-slate-900 dark:text-slate-200 mt-0.5">
                        {speedKmH} km/h
                      </div>
                    </div>
                  </div>

                  {/* Kilometer Splits Table (Matching SplitsTable in History) */}
                  {splits.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <span>Kilometer Splits</span>
                        </span>
                        <span className="text-[10px] text-slate-400">Pace / KM</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                        {splits.map((s: any) => (
                          <div key={s.km} className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-50/80 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/60">
                            <span className="font-semibold text-slate-600 dark:text-slate-400">KM {s.km}</span>
                            <div className="flex items-center gap-3 font-mono font-bold">
                              <span className="text-slate-900 dark:text-white">{s.formattedPace || formatPace(s.paceSeconds || 0)}</span>
                              <span className="text-[10px] text-slate-400 font-normal">{s.speedKmH || '0.0 km/h'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>

        {/* 3. Bottom Sticky Action Bar */}
        {myPart?.status !== 'active' && myPart?.status !== 'completed' && onStartRun && (
          <div className="p-4 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-t border-slate-200/80 dark:border-white/[0.08] shrink-0">
            <button
              onClick={() => {
                onClose();
                onStartRun(challenge);
              }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-base shadow-lg shadow-emerald-500/30 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Flag size={20} />
              <span>Start My Challenge Run Now</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
