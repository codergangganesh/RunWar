import React from 'react';
import { Radio } from 'lucide-react';

interface RouteThumbnailProps {
  coordinates?: any[];
  distanceKm?: number;
  className?: string;
}

/**
 * Micro GPS Route Map / Thumbnail Component
 * Renders an SVG polyline preview of the run's GPS coordinates (like Strava or Nike Run Club).
 */
export const RouteThumbnail: React.FC<RouteThumbnailProps> = ({
  coordinates = [],
  distanceKm = 5,
  className = '',
}) => {
  let points: [number, number][] = [];

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

      const padX = 36;
      const padY = 24;
      const w = 320 - padX * 2;
      const h = 130 - padY * 2;

      points = coordinates.map((c: any) => {
        const lat = Number(c.latitude || c.lat || 0);
        const lng = Number(c.longitude || c.lng || c.lon || 0);
        const x = padX + ((lng - minLng) / lngSpan) * w;
        const y = padY + (1 - (lat - minLat) / latSpan) * h;
        return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
      });
    }
  }

  // Smooth parametric organic circuit fallback if GPS coordinates are empty
  if (points.length < 2) {
    const numPoints = 18;
    const cx = 160;
    const cy = 65;
    const rx = 105;
    const ry = 40;
    for (let i = 0; i <= numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const rMod = 1 + 0.16 * Math.sin(angle * 3) + 0.12 * Math.cos(angle * 2);
      const x = cx + Math.cos(angle) * rx * rMod;
      const y = cy + Math.sin(angle) * ry * rMod;
      points.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
    }
  }

  const pathData = points.reduce((acc, pt, idx) => {
    return idx === 0 ? `M ${pt[0]} ${pt[1]}` : `${acc} L ${pt[0]} ${pt[1]}`;
  }, '');

  const startPt = points[0];
  const endPt = points[points.length - 1];
  const uniqueId = React.useId().replace(/:/g, '_');

  return (
    <div className={`relative overflow-hidden rounded-2xl route-map-container bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border border-emerald-500/25 dark:border-white/10 shadow-inner ${className}`}>
      {/* Background topographic grid pattern */}
      <svg className="absolute inset-0 w-full h-full map-grid-pattern opacity-30 dark:opacity-10 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id={`grid_${uniqueId}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#059669" className="stroke-[#059669] dark:stroke-white" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#grid_${uniqueId})`} />
      </svg>

      {/* Polyline Route SVG */}
      <svg viewBox="0 0 320 130" className="w-full h-28 sm:h-32 drop-shadow-md">
        <defs>
          <linearGradient id={`routeGrad_${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="50%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>

        {/* Ambient glow under the polyline */}
        <path
          d={pathData}
          fill="none"
          stroke="#10b981"
          strokeWidth="6"
          className="opacity-25 dark:opacity-30"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Crisp foreground polyline */}
        <path
          d={pathData}
          fill="none"
          stroke={`url(#routeGrad_${uniqueId})`}
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Start Point Pin */}
        <circle cx={startPt[0]} cy={startPt[1]} r="5" fill="#10b981" stroke="#ffffff" strokeWidth="1.5" />
        {/* Finish Point Pin */}
        <circle cx={endPt[0]} cy={endPt[1]} r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
      </svg>

      {/* GPS Verified HUD Chip */}
      <div className="map-hud-badge absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/95 dark:bg-black/60 backdrop-blur-sm border border-emerald-200 dark:border-white/10 shadow-xs text-[9px] font-bold text-emerald-800 dark:text-emerald-300">
        <Radio
          size={10}
          strokeWidth={2.5}
          className="animate-pulse text-emerald-600 dark:text-emerald-400"
        />

        {distanceKm > 0 && (
          <span className="font-mono text-emerald-700 dark:text-emerald-400 border-l border-emerald-200 dark:border-white/20 pl-1.5 font-bold">
            {distanceKm.toFixed(2)} km
          </span>
        )}
      </div>

      {/* Start / Finish Legend Chip */}
      <div className="map-hud-badge absolute bottom-2 right-2 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/95 dark:bg-black/60 backdrop-blur-sm text-[8px] font-mono font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 shadow-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-xs"></span>
        <span>Start</span>
        <span className="text-slate-400 dark:text-white/30">•</span>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-xs"></span>
        <span>Finish</span>
      </div>
    </div>
  );
};
