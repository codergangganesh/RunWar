import React from 'react';
import { GPSCoordinate } from '../../types';

interface ElevationChartProps {
  coordinates: GPSCoordinate[];
  className?: string;
}

export const ElevationChart: React.FC<ElevationChartProps> = ({
  coordinates,
  className = 'h-36 w-full',
}) => {
  const pointsWithAlt = coordinates.filter((c) => c.altitude != null);

  if (pointsWithAlt.length < 2) {
    return (
      <div className={`rounded-2xl bg-slate-900/50 border border-slate-800/80 p-6 flex items-center justify-center text-slate-500 text-xs ${className}`}>
        No elevation data recorded
      </div>
    );
  }

  const altitudes = pointsWithAlt.map((c) => c.altitude as number);
  const minAlt = Math.min(...altitudes);
  const maxAlt = Math.max(...altitudes);
  const altRange = Math.max(5, maxAlt - minAlt);

  // Sample ~40 points to draw clean SVG path
  const step = Math.max(1, Math.floor(pointsWithAlt.length / 40));
  const sampledPoints = pointsWithAlt.filter((_, i) => i % step === 0);

  const svgPoints = sampledPoints.map((pt, idx) => {
    const x = (idx / (sampledPoints.length - 1)) * 100;
    const alt = pt.altitude as number;
    const y = 100 - ((alt - minAlt) / altRange) * 80 - 10; // Margin top/bottom
    return { x, y, alt };
  });

  const pathD = svgPoints.reduce((acc, pt, idx) => {
    return `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
  }, '');

  const areaD = `${pathD} L 100 100 L 0 100 Z`;

  return (
    <div className={`rounded-2xl bg-slate-900/90 border border-slate-800 p-4 shadow-lg flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          Elevation Profile
        </h3>
        <span className="text-[11px] text-sky-400 font-medium">
          Min: {Math.round(minAlt)}m · Max: {Math.round(maxAlt)}m
        </span>
      </div>

      <div className="relative h-20 w-full">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="elevationGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <path d={areaD} fill="url(#elevationGrad)" />

          {/* Top curve */}
          <path
            d={pathD}
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
        <span>Start</span>
        <span>Finish</span>
      </div>
    </div>
  );
};
