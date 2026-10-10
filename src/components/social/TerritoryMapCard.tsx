import React from 'react';
import { User, Timer, Navigation, Map } from 'lucide-react';
import { TerritoryZone } from '../../services/socialService';
import { TerritoryRouteSnippet } from './TerritoryRouteSnippet';

interface TerritoryMapCardProps {
  zone: TerritoryZone;
  isMapExpanded: boolean;
  onToggleMap: () => void;
  onOpenAthleteProfile: (target: { userName: string }) => void;
  onOpenChallenge: (sectorName: string, commanderName: string) => void;
}

export const TerritoryMapCard: React.FC<TerritoryMapCardProps> = ({
  zone,
  isMapExpanded,
  onToggleMap,
  onOpenAthleteProfile,
  onOpenChallenge,
}) => {
  return (
    <div className="bg-white dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 sm:p-5 space-y-3.5 transition-all shadow-xs">
      {/* Row 1: Sector Name, Distance, Status Badge & Map Icon */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white truncate leading-tight">
            {zone.name}
          </h3>
          <span className="font-mono text-xs font-semibold text-slate-400 dark:text-white/40 shrink-0 whitespace-nowrap">
            {zone.km}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
              zone.status === 'Secured'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/10'
            }`}
          >
            {zone.status}
          </span>

          <button
            type="button"
            onClick={onToggleMap}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isMapExpanded
                ? 'bg-emerald-500 text-white border-emerald-500 shadow-xs'
                : 'bg-slate-100 dark:bg-white/[0.06] border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title={isMapExpanded ? 'Hide Route Map' : 'View Route Map'}
            aria-label="Toggle map view"
          >
            <Map size={16} />
          </button>
        </div>
      </div>

      {/* Row 2: Commander + Pace side-by-side */}
      <div className="flex items-center gap-0">
        {/* Commander Column */}
        <div className="flex items-center gap-2.5 pr-4 border-r border-slate-200/60 dark:border-white/[0.08]">
          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
            <User size={16} />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 dark:text-white/40 font-medium leading-none">Commander</div>
            <span
              onClick={() => onOpenAthleteProfile({ userName: zone.holder })}
              className="text-sm font-bold text-slate-900 dark:text-white cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors leading-tight"
            >
              {zone.holder}
            </span>
          </div>
        </div>

        {/* Pace Column */}
        <div className="flex items-center gap-2.5 pl-4">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
            <Timer size={16} />
          </div>
          <div>
            <span className="text-lg font-black font-mono text-emerald-500 leading-none">
              {zone.pace.replace(' /km', '').replace('/km', '')}
            </span>
            <div className="text-[10px] text-slate-400 dark:text-white/40 font-medium leading-none">/km</div>
          </div>
        </div>
      </div>

      {/* ROUTE MAP: HIDDEN BY DEFAULT, SHOWN ONLY WHEN MAP ICON CLICKED */}
      {isMapExpanded && (
        <div className="animate-fade-in">
          <TerritoryRouteSnippet
            circuitType={zone.circuitType}
            status={zone.status}
            isUnderSiege={zone.isUnderSiege}
            distanceKm={zone.km}
            elevationM={zone.elevationM}
            difficulty={zone.difficulty}
            coordinates={zone.route_coordinates}
          />
        </div>
      )}

      {/* Row 3: Target Pace + Contest Button */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-white/[0.06]">
        <div className="flex items-center gap-2 text-slate-400 dark:text-white/40">
          <Navigation size={14} className="text-slate-400 dark:text-white/30" />
          <span className="text-xs font-medium">
            Target: beat {zone.pace}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onOpenChallenge(zone.name, zone.holder)}
          className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
        >
          <span>Contest</span>
        </button>
      </div>
    </div>
  );
};
