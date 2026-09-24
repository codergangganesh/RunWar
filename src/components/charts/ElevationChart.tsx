import React, { useState, useMemo, useRef, useCallback } from 'react';
import { DistanceUnit, GPSCoordinate } from '../../types';
import { calculateHaversineDistance } from '../../utils/calculations';
import { formatDistance } from '../../utils/formatters';
import { Mountain, X, Info } from 'lucide-react';

interface ElevationChartProps {
  coordinates: GPSCoordinate[];
  elevationGain?: number | null;
  elevationLoss?: number | null;
  distanceUnit?: DistanceUnit;
  className?: string;
}

export const ElevationChart: React.FC<ElevationChartProps> = ({
  coordinates,
  elevationGain,
  elevationLoss,
  distanceUnit = 'km',
  className = 'w-full',
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // Filter valid points and compute cumulative distance
  const pointsData = useMemo(() => {
    if (!coordinates || coordinates.length === 0) return [];
    const valid = coordinates.filter((c) => c.altitude != null);
    if (valid.length < 2) return [];

    let cumDist = 0;
    return valid.map((pt, i) => {
      if (i > 0) {
        const prev = valid[i - 1];
        const dist =
          pt.distanceFromPrevious ??
          calculateHaversineDistance(
            prev.latitude,
            prev.longitude,
            pt.latitude,
            pt.longitude
          );
        cumDist += dist;
      }
      return {
        altitude: Number(pt.altitude),
        distanceMeters: cumDist,
        timestamp: pt.timestamp,
        originalIndex: i,
      };
    });
  }, [coordinates]);

  if (pointsData.length < 2) {
    return (
      <div
        className={`rounded-3xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 p-6 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs shadow-sm ${className}`}
      >
        <Mountain size={20} className="mb-1 text-slate-400 opacity-60" />
        <span>No elevation data recorded for this workout</span>
      </div>
    );
  }

  const altitudes = pointsData.map((p) => p.altitude);
  const minAlt = Math.min(...altitudes);
  const maxAlt = Math.max(...altitudes);
  const startAlt = pointsData[0].altitude;
  const finishAlt = pointsData[pointsData.length - 1].altitude;
  const altRange = Math.max(5, maxAlt - minAlt);
  const totalDistanceMeters = pointsData[pointsData.length - 1].distanceMeters;

  // Sample points for smooth rendering while preserving accuracy
  const sampleCount = Math.min(80, Math.max(20, pointsData.length));
  const step = Math.max(1, (pointsData.length - 1) / (sampleCount - 1));

  const sampledPoints = useMemo(() => {
    const pts: {
      x: number;
      y: number;
      alt: number;
      dist: number;
      dataIndex: number;
    }[] = [];

    for (let i = 0; i < sampleCount; i++) {
      const idx = Math.min(pointsData.length - 1, Math.round(i * step));
      const pt = pointsData[idx];
      const x = totalDistanceMeters > 0 ? (pt.distanceMeters / totalDistanceMeters) * 100 : (i / (sampleCount - 1)) * 100;
      // 10% margin top, 15% margin bottom
      const y = 92 - ((pt.altitude - minAlt) / altRange) * 76;
      pts.push({ x, y, alt: pt.altitude, dist: pt.distanceMeters, dataIndex: idx });
    }
    return pts;
  }, [pointsData, sampleCount, step, totalDistanceMeters, minAlt, altRange]);

  // Construct SVG Path
  const pathD = useMemo(() => {
    if (sampledPoints.length === 0) return '';
    return sampledPoints.reduce((acc, pt, idx) => {
      return `${acc} ${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(2)} ${pt.y.toFixed(2)}`;
    }, '');
  }, [sampledPoints]);

  const areaD = `${pathD} L 100 100 L 0 100 Z`;

  // Determine selected point
  const selectedPoint = useMemo(() => {
    if (selectedIndex === null || selectedIndex < 0 || selectedIndex >= pointsData.length) {
      return null;
    }
    const pt = pointsData[selectedIndex];
    const x = totalDistanceMeters > 0 ? (pt.distanceMeters / totalDistanceMeters) * 100 : 0;
    const y = 92 - ((pt.altitude - minAlt) / altRange) * 76;
    const diffFromStart = pt.altitude - startAlt;
    const progressPct = totalDistanceMeters > 0 ? Math.round((pt.distanceMeters / totalDistanceMeters) * 100) : 0;

    return {
      ...pt,
      x,
      y,
      diffFromStart,
      progressPct,
    };
  }, [selectedIndex, pointsData, totalDistanceMeters, minAlt, altRange, startAlt]);

  // Interaction handler for click/touch/scrub
  const handleInteract = useCallback(
    (clientX: number) => {
      if (!svgRef.current || totalDistanceMeters <= 0) return;
      const rect = svgRef.current.getBoundingClientRect();
      const relativeX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const ratio = relativeX / rect.width;
      const targetDist = ratio * totalDistanceMeters;

      // Find nearest point
      let closestIdx = 0;
      let minDiff = Infinity;
      for (let i = 0; i < pointsData.length; i++) {
        const diff = Math.abs(pointsData[i].distanceMeters - targetDist);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = i;
        }
      }
      setSelectedIndex(closestIdx);
    },
    [pointsData, totalDistanceMeters]
  );

  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    setIsInteracting(true);
    handleInteract(e.clientX);
  };

  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    handleInteract(e.clientX);
  };

  const onTouchStart = (e: React.TouchEvent<SVGSVGElement>) => {
    setIsInteracting(true);
    if (e.touches.length > 0) {
      handleInteract(e.touches[0].clientX);
    }
  };

  const onTouchMove = (e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length > 0) {
      handleInteract(e.touches[0].clientX);
    }
  };

  const onTouchEnd = () => {
    setIsInteracting(false);
  };

  return (
    <div
      className={`rounded-3xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-3 select-none ${className}`}
    >
      {/* Header with Title and Summary Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <Mountain size={15} />
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Elevation Profile
          </h3>
        </div>

        {/* Min / Max pill OR Hover Data */}
        {selectedPoint ? (
          <div className="flex items-center gap-2 text-[11px] font-mono font-bold animate-fade-in text-slate-700 dark:text-slate-200">
            <span>{formatDistance(selectedPoint.distanceMeters, distanceUnit)} {distanceUnit}</span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="text-sky-600 dark:text-sky-400">{Math.round(selectedPoint.altitude)}m</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl">
            <span className="text-sky-600 dark:text-sky-400">Min: {Math.round(minAlt)}m</span>
            <span className="text-slate-400 dark:text-slate-600">•</span>
            <span className="text-sky-600 dark:text-sky-400">Max: {Math.round(maxAlt)}m</span>
          </div>
        )}
      </div>



      {/* SVG Elevation Chart Area */}
      <div 
        className="relative h-28 w-full touch-none cursor-crosshair mt-4"
        onMouseLeave={() => { setIsInteracting(false); setSelectedIndex(null); }}
      >
        <svg
          ref={svgRef}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full overflow-visible"
          onClick={(e) => handleInteract(e.clientX)}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={() => setIsInteracting(false)}
          onMouseLeave={() => { setIsInteracting(false); setSelectedIndex(null); }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <defs>
            {/* Elevation Gradient Fill */}
            <linearGradient id="elevationAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.45" />
              <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
            </linearGradient>

            {/* Glowing drop-shadow for line */}
            <filter id="elevationGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#0284c7" floodOpacity="0.5" />
            </filter>
          </defs>

          {/* Background Grid Guidelines */}
          <line
            x1="0"
            y1="20"
            x2="100"
            y2="20"
            stroke="currentColor"
            className="text-slate-100 dark:text-slate-800/80"
            strokeDasharray="2 2"
            strokeWidth="0.5"
          />
          <line
            x1="0"
            y1="56"
            x2="100"
            y2="56"
            stroke="currentColor"
            className="text-slate-100 dark:text-slate-800/80"
            strokeDasharray="2 2"
            strokeWidth="0.5"
          />
          <line
            x1="0"
            y1="92"
            x2="100"
            y2="92"
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-800"
            strokeWidth="0.8"
          />

          {/* Area Fill under Curve */}
          <path d={areaD} fill="url(#elevationAreaGradient)" />

          {/* Main Curve Line */}
          <path
            d={pathD}
            fill="none"
            stroke="#0284c7"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="dark:stroke-sky-400"
            filter="url(#elevationGlow)"
          />

          {/* Interactive Scrubber & Cursor Marker when point is selected */}
          {selectedPoint && (
            <g className="animate-fade-in pointer-events-none">
              {/* Vertical Guide Line */}
              <line
                x1={selectedPoint.x}
                y1="10"
                x2={selectedPoint.x}
                y2="95"
                stroke="#0284c7"
                strokeWidth="1.2"
                strokeDasharray="2 2"
                className="dark:stroke-sky-300"
              />

              {/* Outer Pulse Halo */}
              <circle
                cx={selectedPoint.x}
                cy={selectedPoint.y}
                r="4.5"
                fill="#38bdf8"
                fillOpacity="0.35"
                className="animate-ping"
              />

              {/* Center Target Dot */}
              <circle
                cx={selectedPoint.x}
                cy={selectedPoint.y}
                r="3"
                fill="#0284c7"
                stroke="#ffffff"
                strokeWidth="1"
                className="dark:fill-sky-400"
              />
            </g>
          )}
        </svg>
      </div>

      {/* Bottom Axis Labels */}
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
        <span>
          0.0 {distanceUnit} (Start: {Math.round(startAlt)}m)
        </span>
        <span className="hidden sm:inline text-slate-400 dark:text-slate-500">
          {(totalDistanceMeters / 2000).toFixed(1)} {distanceUnit}
        </span>
        <span>
          {formatDistance(totalDistanceMeters, distanceUnit)} {distanceUnit} (Finish: {Math.round(finishAlt)}m)
        </span>
      </div>
    </div>
  );
};
