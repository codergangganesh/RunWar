import React from 'react';
import { TetherSession } from '../../types/tether';
import { DistanceUnit, PaceUnit } from '../../types';
import { formatDistance, formatDuration, formatPace } from '../../utils/formatters';
import { Radio, Users, Award, Zap, Heart } from 'lucide-react';

interface TetherSummaryCardProps {
  session: TetherSession;
  myDistanceMeters: number;
  myDurationSeconds: number;
  myPaceSec: number;
  peerDistanceMeters?: number;
  peerPaceSec?: number;
  distanceUnit?: DistanceUnit;
  paceUnit?: PaceUnit;
}

export const TetherSummaryCard: React.FC<TetherSummaryCardProps> = ({
  session,
  myDistanceMeters,
  myDurationSeconds,
  myPaceSec,
  peerDistanceMeters,
  peerPaceSec,
  distanceUnit = 'km',
  paceUnit = 'min_km',
}) => {
  const partner = session.peer || { name: 'Running Partner', role: 'peer' as const, status: 'running' as const, userId: 'peer' };
  const effectivePeerDistance = peerDistanceMeters || myDistanceMeters;
  const combinedDistance = myDistanceMeters + effectivePeerDistance;

  return (
    <div className="w-full p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-emerald-950/20 via-slate-900 to-teal-950/20 border border-emerald-500/30 shadow-xl space-y-4 animate-fade-in text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
            <Radio size={18} className="text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-black tracking-wider text-emerald-400">
                TETHERED RUN ACCOMPLISHED
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Duo
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-black text-white">
              Tethered with {partner.name}
            </h3>
          </div>
        </div>
        <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
          <Award size={20} />
        </div>
      </div>

      {/* Combined Milestone Banner */}
      <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
          <Zap size={14} className="text-amber-400" />
          <span>Combined Distance Run</span>
        </div>
        <span className="text-sm font-mono font-black text-emerald-400">
          {formatDistance(combinedDistance, distanceUnit, 2)} {distanceUnit}
        </span>
      </div>

      {/* Side-by-Side Dual Runner Comparison */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        {/* You */}
        <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center space-y-1">
          <span className="text-[10px] font-bold text-emerald-400 uppercase block">You</span>
          <div className="text-base font-mono font-black text-white">
            {formatDistance(myDistanceMeters, distanceUnit, 2)}
          </div>
          <span className="text-[11px] font-mono text-slate-400 block">
            {formatPace(myPaceSec, paceUnit)}
          </span>
        </div>

        {/* Partner */}
        <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center space-y-1">
          <span className="text-[10px] font-bold text-teal-400 uppercase block truncate">
            {partner.name}
          </span>
          <div className="text-base font-mono font-black text-white">
            {formatDistance(effectivePeerDistance, distanceUnit, 2)}
          </div>
          <span className="text-[11px] font-mono text-slate-400 block">
            {peerPaceSec ? formatPace(peerPaceSec, paceUnit) : formatPace(myPaceSec, paceUnit)}
          </span>
        </div>
      </div>

      {/* Teamwork Footer Tag */}
      <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400 pt-1">
        <Heart size={13} className="text-rose-500 fill-rose-500" />
        <span>Connected in real-time across the miles</span>
      </div>
    </div>
  );
};
