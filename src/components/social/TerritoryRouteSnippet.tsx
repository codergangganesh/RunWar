import React from 'react';
import { Navigation, Radio, TrendingUp } from 'lucide-react';

interface TerritoryRouteSnippetProps {
  circuitType?: number;
  status?: 'Secured' | 'Contested';
  isUnderSiege?: boolean;
  distanceKm: string | number;
  elevationM?: number;
  difficulty?: string;
  coordinates?: any[];
  className?: string;
}

/**
 * Interactive Vector Sector Route Map for Territory Zones
 * Renders distinct circuit paths, start/finish beacons, elevation badges, and siege status
 */
export const TerritoryRouteSnippet: React.FC<TerritoryRouteSnippetProps> = ({
  circuitType = 1,
  status = 'Contested',
  isUnderSiege = false,
  distanceKm,
  elevationM,
  difficulty = 'Moderate',
  coordinates,
  className = '',
}) => {
  const uniqueId = React.useId().replace(/:/g, '_');

  // Generate distinct circuit geometry depending on whether real GPS points exist or fallback circuit geometry
  let points: [number, number][] = [];
  let isRealGPS = false;

  if (coordinates && coordinates.length >= 2) {
    const lats = coordinates.map((c: any) => Number(c.latitude || c.lat || 0)).filter((n) => !isNaN(n) && n !== 0);
    const lngs = coordinates.map((c: any) => Number(c.longitude || c.lng || c.lon || 0)).filter((n) => !isNaN(n) && n !== 0);

    if (lats.length >= 2 && lngs.length >= 2) {
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      const latSpan = Math.max(0.0008, maxLat - minLat);
      const lngSpan = Math.max(0.0008, maxLng - minLng);

      const padX = 35;
      const padY = 25;
      const w = 330 - padX * 2;
      const h = 135 - padY * 2;

      points = coordinates.map((c: any) => {
        const lat = Number(c.latitude || c.lat || 0);
        const lng = Number(c.longitude || c.lng || c.lon || 0);
        const x = padX + ((lng - minLng) / lngSpan) * w;
        const y = padY + (1 - (lat - minLat) / latSpan) * h;
        return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
      });
      isRealGPS = points.length >= 2;
    }
  }

  // Fallback to geometric circuit templates if coordinates are empty
  if (points.length < 2) {
    if (circuitType === 1) {
      points = [
        [50, 85], [75, 45], [120, 30], [180, 25], [235, 40], [270, 75],
        [250, 105], [190, 110], [130, 105], [80, 100], [50, 85]
      ];
    } else if (circuitType === 2) {
      points = [
        [35, 95], [70, 70], [115, 80], [165, 50], [215, 65], [260, 35], [295, 45]
      ];
    } else if (circuitType === 3) {
      points = [
        [35, 110], [75, 90], [55, 65], [110, 50], [145, 80], [190, 45],
        [225, 70], [260, 30], [295, 20]
      ];
    } else {
      points = [
        [40, 35], [90, 50], [140, 95], [195, 105], [245, 60], [290, 70]
      ];
    }
  }

  const pathData = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt[0]} ${pt[1]}` : `${acc} L ${pt[0]} ${pt[1]}`;
  }, '');

  const startPt = points[0];
  const endPt = points[points.length - 1];
  const glowColor = isUnderSiege ? '#ef4444' : status === 'Contested' ? '#f59e0b' : '#10b981';

  return (
    <div className={`relative overflow-hidden rounded-2xl route-map-container bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border ${
      isUnderSiege ? 'border-amber-500/40 shadow-inner' : 'border-emerald-500/25 dark:border-white/10 shadow-inner'
    } ${className}`}>
      {/* Background Topographic Grid */}
      <svg className="absolute inset-0 w-full h-full map-grid-pattern opacity-30 dark:opacity-10 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={`t_grid_${uniqueId}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#059669" className="stroke-[#059669] dark:stroke-white" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#t_grid_${uniqueId})`} />
      </svg>

      {/* Main Route SVG */}
      <svg viewBox="0 0 330 135" className="w-full h-28 sm:h-32 drop-shadow-md">
        <defs>
          <linearGradient id={`t_grad_${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={isUnderSiege ? '#f59e0b' : '#10b981'} />
            <stop offset="60%" stopColor={isUnderSiege ? '#ef4444' : '#06b6d4'} />
            <stop offset="100%" stopColor={isUnderSiege ? '#dc2626' : '#3b82f6'} />
          </linearGradient>
        </defs>

        {/* Ambient Path Glow */}
        <path
          d={pathData}
          fill="none"
          stroke={glowColor}
          strokeWidth="6"
          className="opacity-20 dark:opacity-30"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Crisp Foreground Route */}
        <path
          d={pathData}
          fill="none"
          stroke={`url(#t_grad_${uniqueId})`}
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Start Pin */}
        <circle cx={startPt[0]} cy={startPt[1]} r="6" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
        <circle cx={startPt[0]} cy={startPt[1]} r="2.5" fill="#ffffff" />

        {/* End Pin */}
        <circle cx={endPt[0]} cy={endPt[1]} r="6" fill={isUnderSiege ? '#ef4444' : '#06b6d4'} stroke="#ffffff" strokeWidth="1.5" />
        <circle cx={endPt[0]} cy={endPt[1]} r="2.5" fill="#ffffff" />
      </svg>

      {/* Embedded Tactical HUD Badges */}
      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 pointer-events-none">
        <div className="map-hud-badge px-2 py-0.5 rounded-full bg-white/95 dark:bg-black/60 backdrop-blur-md border border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-800 dark:text-white flex items-center gap-1 shadow-xs">
          <Navigation size={10} className="text-emerald-600 dark:text-emerald-400" />
          <span>{typeof distanceKm === 'number' ? `${distanceKm} km` : distanceKm}</span>
        </div>
        {isRealGPS && (
          <div className="px-2 py-0.5 rounded-full bg-emerald-500/15 dark:bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 dark:border-emerald-400/40 text-[9px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
            <Radio size={9} className="text-emerald-600 dark:text-emerald-400 animate-pulse" />
            <span>GPS Track</span>
          </div>
        )}
        {elevationM !== undefined && elevationM > 0 && (
          <div className="map-hud-badge px-2 py-0.5 rounded-full bg-white/95 dark:bg-black/60 backdrop-blur-md border border-slate-200 dark:border-white/10 text-[10px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1 shadow-xs">
            <TrendingUp size={10} className="text-cyan-600 dark:text-cyan-400" />
            <span>+{elevationM}m</span>
          </div>
        )}
      </div>

      <div className="absolute top-2.5 right-2.5 pointer-events-none">
        <div className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md border shadow-xs ${
          difficulty === 'Extreme'
            ? 'bg-purple-500/15 dark:bg-purple-500/30 text-purple-700 dark:text-purple-300 border-purple-400/40'
            : difficulty === 'Hard'
              ? 'bg-amber-500/15 dark:bg-amber-500/30 text-amber-700 dark:text-amber-300 border-amber-400/40'
              : 'bg-emerald-500/15 dark:bg-emerald-500/30 text-emerald-800 dark:text-emerald-300 border-emerald-400/40'
        }`}>
          {difficulty}
        </div>
      </div>

      {/* Start / Finish Legend Chip */}
      <div className="map-hud-badge absolute bottom-2 right-2 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/95 dark:bg-black/60 backdrop-blur-md text-[9px] font-mono font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 shadow-xs pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-xs"></span>
        <span>Start</span>
        <span className="text-slate-400 dark:text-white/40">•</span>
        <span className={`w-1.5 h-1.5 rounded-full ${isUnderSiege ? 'bg-red-500' : 'bg-cyan-500'} shadow-xs`}></span>
        <span>Finish</span>
      </div>
    </div>
  );
};
