import React from 'react';
import { TetherSession, TetherTelemetry, TetherDelta } from '../../types/tether';
import { formatDistance, formatPace } from '../../utils/formatters';
import { DistanceUnit, PaceUnit } from '../../types';
import { Radio, Users, Zap, AlertTriangle } from 'lucide-react';

interface TetherHUDProps {
  session: TetherSession;
  peerTelemetry: TetherTelemetry | null;
  delta: TetherDelta | null;
  distanceUnit?: DistanceUnit;
  paceUnit?: PaceUnit;
  onOpenModal: () => void;
}

export const TetherHUD: React.FC<TetherHUDProps> = ({
  session,
  peerTelemetry,
  delta,
  distanceUnit = 'km',
  paceUnit = 'min_km',
  onOpenModal,
}) => {
  const peer = session.peer || { name: 'Running Partner', role: 'peer' as const, status: 'running' as const, userId: 'peer' };
  const absDeltaMeters = delta ? Math.abs(delta.deltaMeters) : 0;
  const isAhead = delta ? delta.deltaMeters > 0 : false;
  const isBehind = delta ? delta.deltaMeters < 0 : false;
  const isTied = !isAhead && !isBehind;

  // Determine tension styling
  let tensionBadgeBg = 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-400';
  let tensionStatusText = 'Side-by-Side';
  let bandStrokeColor = '#10b981'; // emerald-500

  if (delta?.tensionZone === 'red') {
    tensionBadgeBg = 'bg-rose-500/20 border-rose-500/40 text-rose-700 dark:text-rose-400 animate-pulse';
    tensionStatusText = isAhead ? 'Partner Dropping Behind' : 'Tether Stretched!';
    bandStrokeColor = '#f43f5e'; // rose-500
  } else if (delta?.tensionZone === 'amber') {
    tensionBadgeBg = 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-400';
    tensionStatusText = isAhead ? 'Pulling Ahead' : 'Partner Leading';
    bandStrokeColor = '#f59e0b'; // amber-500
  }

  // Calculate runner & partner position along the tether track (4% to 96%)
  const selfPosPct = isAhead ? Math.min(88, 50 + (absDeltaMeters / 120) * 38) : Math.max(12, 50 - (absDeltaMeters / 120) * 38);
  const peerPosPct = 100 - selfPosPct;

  return (
    <div className="shrink-0 w-full p-2.5 sm:p-3 rounded-2xl bg-gradient-to-r from-emerald-950/10 via-teal-950/5 to-cyan-950/10 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-cyan-950/40 border border-emerald-500/30 dark:border-emerald-500/40 shadow-sm animate-fade-in space-y-2 backdrop-blur-sm">
      {/* Top Row: Partner Info & Delta Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
            <Radio size={14} className="animate-pulse text-emerald-500" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-wider">
                VIRTUAL TETHER
              </span>
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full border flex items-center gap-0.5 ${tensionBadgeBg}`}>
                {delta?.tensionZone === 'red' && <AlertTriangle size={10} />}
                {isTied
                  ? 'Neck & Neck'
                  : `${isAhead ? '▲' : '▼'} ${absDeltaMeters}m ${isAhead ? 'Ahead' : 'Behind'}`}
              </span>
            </div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
              Tethered with {peer.name}
            </h4>
          </div>
        </div>

        {/* Right side: Partner Pace & Modal Trigger */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase block">
              Buddy Pace
            </span>
            <span className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">
              {peerTelemetry && peerTelemetry.currentPaceSec > 0
                ? formatPace(peerTelemetry.currentPaceSec, paceUnit)
                : '--:--'}
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenModal}
            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer"
            title="Tether Session Settings"
            aria-label="Tether Settings"
          >
            <Users size={14} />
          </button>
        </div>
      </div>

      {/* Visual Elastic Rubber Band Tension Track */}
      <div className="relative pt-1 pb-1">
        <div className="w-full h-2 rounded-full bg-slate-200/80 dark:bg-slate-800 relative overflow-visible">
          {/* Active Tension Segment */}
          <div
            className="absolute top-0 bottom-0 rounded-full transition-all duration-500"
            style={{
              left: `${Math.min(selfPosPct, peerPosPct)}%`,
              width: `${Math.max(4, Math.abs(selfPosPct - peerPosPct))}%`,
              backgroundColor: bandStrokeColor,
              boxShadow: `0 0 8px ${bandStrokeColor}66`,
            }}
          />

          {/* Self Runner Marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-300 z-10"
            style={{ left: `${selfPosPct}%` }}
            title="You"
          >
            <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold shadow-md shadow-emerald-500/40 ring-2 ring-white dark:ring-slate-900">
              🏃
            </div>
          </div>

          {/* Peer Runner Marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 transition-all duration-300 z-10"
            style={{ left: `${peerPosPct}%` }}
            title={peer.name}
          >
            <div className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-[10px] font-bold shadow-md shadow-teal-500/40 ring-2 ring-white dark:ring-slate-900">
              {peer.avatarUrl ? (
                <img src={peer.avatarUrl} alt={peer.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                '🤝'
              )}
            </div>
          </div>
        </div>

        {/* Status subtitle underneath track */}
        <div className="flex items-center justify-between text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-1">
          <span>You</span>
          <span className="font-semibold text-slate-700 dark:text-slate-300">{tensionStatusText}</span>
          <span>{peer.name.split(' ')[0]}</span>
        </div>
      </div>
    </div>
  );
};
