import React, { useEffect, useRef, useState } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, UserCircle, Zap, Flag } from 'lucide-react';
import { LiveChallengeProgress, Challenge } from '../../types';
import { formatDuration, formatPace } from '../../utils/formatters';

interface Props {
  challenge: Challenge;
  progress: LiveChallengeProgress;
  onRefresh?: () => void;
  distanceUnit?: 'km' | 'mi';
}

export const ChallengeHUD: React.FC<Props> = ({ challenge, progress, onRefresh, distanceUnit = 'km' }) => {
  const [pulse, setPulse] = useState(false);
  const prevDelta = useRef(progress.deltaMeters);

  useEffect(() => {
    if (progress.deltaMeters !== prevDelta.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 600);
      prevDelta.current = progress.deltaMeters;
      return () => clearTimeout(t);
    }
  }, [progress.deltaMeters]);

  const opponent = challenge.opponent_profile;
  const opponentName = opponent?.name || 'Opponent';

  const isAhead = progress.isUserAhead;
  const delta = Math.abs(progress.deltaMeters);
  const deltaKm = (delta / 1000).toFixed(2);
  const deltaStr = delta < 100 ? `${Math.round(delta)}m` : `${deltaKm} km`;

  const myPct = Math.min(100, progress.progressPercent);
  const oppPct = Math.min(100, progress.opponentProgressPercent);

  const StatusIcon = isAhead ? TrendingUp : (progress.deltaMeters === 0 ? Minus : TrendingDown);
  const statusColor = isAhead ? 'text-green-400' : (progress.deltaMeters === 0 ? 'text-white/60' : 'text-rose-400');
  const statusLabel = isAhead ? `+${deltaStr} ahead` : (progress.deltaMeters === 0 ? 'Tied!' : `${deltaStr} behind`);

  if (progress.myCompleted || progress.opponentCompleted) {
    return (
      <div className="bg-white/95 dark:bg-black/75 backdrop-blur-xl rounded-3xl border border-slate-200/90 dark:border-white/10 p-4 shadow-xl text-slate-900 dark:text-white">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={16} className="text-amber-500 dark:text-yellow-400" />
          <span className="font-bold text-sm text-slate-900 dark:text-white">Challenge Result</span>
        </div>
        {progress.myCompleted ? (
          <div className="text-center py-2">
            <div className={`text-2xl font-black flex items-center justify-center gap-2 ${progress.completionRank === 1 ? 'text-amber-500 dark:text-yellow-400' : 'text-slate-700 dark:text-white/70'}`}>
              <Trophy size={24} className="text-amber-500" />
              <span>{progress.completionRank === 1 ? 'Winner!' : 'Completed'}</span>
            </div>
            <div className="text-slate-500 dark:text-white/50 text-xs mt-1">
              {progress.completionRank === 1 ? 'You crossed the finish line first!' : 'Great effort — you finished!'}
            </div>
          </div>
        ) : (
          <div className="text-center py-2">
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-2">
              <Flag size={24} className="text-emerald-500" />
              <span>Opponent Finished</span>
            </div>
            <div className="text-slate-500 dark:text-white/50 text-xs mt-1">Keep going — complete your challenge!</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white/95 dark:bg-black/75 backdrop-blur-xl rounded-3xl border shadow-xl transition-all duration-300 text-slate-900 dark:text-white ${
      pulse ? 'border-emerald-500/50 shadow-emerald-500/20' : 'border-slate-200/90 dark:border-white/10'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-slate-100 dark:border-white/[0.07]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xs">
            <Trophy size={12} className="text-white" />
          </div>
          <span className="text-slate-800 dark:text-white/80 text-xs font-bold tracking-wider">LIVE RACE</span>
        </div>
        <div className={`flex items-center gap-1 text-xs font-bold ${statusColor}`}>
          <StatusIcon size={13} />
          {statusLabel}
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* YOU */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-slate-800 dark:text-white text-xs font-semibold">You</span>
            </div>
            <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold font-mono">
              {distanceUnit === 'mi'
                ? `${(progress.myDistanceMeters / 1609.34).toFixed(2)} mi`
                : `${(progress.myDistanceMeters / 1000).toFixed(2)} km`}
            </span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${myPct}%` }}
            />
          </div>
          <div className="text-right text-slate-400 dark:text-white/30 text-xs mt-0.5 font-mono">{myPct.toFixed(0)}%</div>
        </div>

        {/* OPPONENT */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400" />
              <span className="text-slate-700 dark:text-white/70 text-xs font-semibold">{opponentName}</span>
              {!(progress.opponentDistanceMeters > 0) && (
                <span className="text-slate-400 dark:text-white/30 text-xs">(not started)</span>
              )}
            </div>
            <span className="text-blue-600 dark:text-blue-400 text-xs font-bold font-mono">
              {distanceUnit === 'mi'
                ? `${(progress.opponentDistanceMeters / 1609.34).toFixed(2)} mi`
                : `${(progress.opponentDistanceMeters / 1000).toFixed(2)} km`}
            </span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${oppPct}%` }}
            />
          </div>
          <div className="text-right text-slate-400 dark:text-white/30 text-xs mt-0.5 font-mono">{oppPct.toFixed(0)}%</div>
        </div>

        {/* Bottom stats */}
        <div className="flex gap-3 pt-1">
          <div className="flex-1 text-center">
            <div className="text-slate-400 dark:text-white/40 text-xs">Your Pace</div>
            <div className="text-slate-900 dark:text-white font-bold text-sm font-mono">
              {progress.myPaceSecondsPerKm > 0 ? formatPace(progress.myPaceSecondsPerKm) : '--:--'}
            </div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-slate-400 dark:text-white/40 text-xs">Target</div>
            <div className="text-emerald-600 dark:text-emerald-400 font-bold text-sm font-mono">
              {distanceUnit === 'mi'
                ? `${(progress.targetDistanceMeters / 1609.34).toFixed(2)} mi`
                : `${(progress.targetDistanceMeters / 1000).toFixed(1)} km`}
            </div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-slate-400 dark:text-white/40 text-xs">Opp Pace</div>
            <div className="text-blue-600 dark:text-blue-400 font-bold text-sm font-mono">
              {progress.opponentPaceSecondsPerKm > 0 ? formatPace(progress.opponentPaceSecondsPerKm) : '--:--'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

