import React, { useMemo } from 'react';
import { GPSCoordinate } from '../../types';
import { MapPin } from 'lucide-react';

interface RouteThumbnailProps {
  coordinates?: GPSCoordinate[] | null;
  className?: string;
  strokeWidth?: number;
}

export const RouteThumbnail: React.FC<RouteThumbnailProps> = ({
  coordinates,
  className = 'h-24 w-full rounded-xl',
  strokeWidth = 3,
}) => {
  const { pathData, startPoint, endPoint, hasRoute } = useMemo(() => {
    if (!coordinates || coordinates.length < 2) {
      return { pathData: '', startPoint: null, endPoint: null, hasRoute: false };
    }

    // Downsample if huge array to ensure ultra fast SVG rendering
    const points = coordinates.length > 300
      ? coordinates.filter((_, idx) => idx % Math.ceil(coordinates.length / 300) === 0 || idx === coordinates.length - 1)
      : coordinates;

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    for (const pt of points) {
      if (pt.latitude < minLat) minLat = pt.latitude;
      if (pt.latitude > maxLat) maxLat = pt.latitude;
      if (pt.longitude < minLng) minLng = pt.longitude;
      if (pt.longitude > maxLng) maxLng = pt.longitude;
    }

    const latSpan = maxLat - minLat;
    const lngSpan = maxLng - minLng;

    // Guard against identical coordinates / stationary run
    if (latSpan < 0.00001 && lngSpan < 0.00001) {
      return { pathData: '', startPoint: null, endPoint: null, hasRoute: false };
    }

    // SVG coordinate space
    const width = 300;
    const height = 150;
    const padding = 20;
    const drawWidth = width - padding * 2;
    const drawHeight = height - padding * 2;

    // Aspect ratio preservation with lat correction for projection
    const midLat = (minLat + maxLat) / 2;
    const cosLat = Math.cos((midLat * Math.PI) / 180);
    const aspectY = latSpan;
    const aspectX = lngSpan * cosLat;

    let scaleX = drawWidth / (aspectX || 1);
    let scaleY = drawHeight / (aspectY || 1);
    const scale = Math.min(scaleX, scaleY);

    const offsetX = padding + (drawWidth - (aspectX || 1) * scale) / 2;
    const offsetY = padding + (drawHeight - (aspectY || 1) * scale) / 2;

    const projected = points.map((p) => {
      const x = offsetX + ((p.longitude - minLng) * cosLat) * scale;
      const y = offsetY + (maxLat - p.latitude) * scale; // Invert latitude for SVG
      return [x, y];
    });

    if (projected.length === 0) {
      return { pathData: '', startPoint: null, endPoint: null, hasRoute: false };
    }

    // Build SVG path
    let d = `M ${projected[0][0].toFixed(1)} ${projected[0][1].toFixed(1)}`;
    for (let i = 1; i < projected.length; i++) {
      d += ` L ${projected[i][0].toFixed(1)} ${projected[i][1].toFixed(1)}`;
    }

    return {
      pathData: d,
      startPoint: projected[0],
      endPoint: projected[projected.length - 1],
      hasRoute: true,
    };
  }, [coordinates]);

  if (!hasRoute) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900/60 border border-dashed border-slate-200 dark:border-slate-800/80 text-slate-400 dark:text-slate-500 overflow-hidden select-none ${className}`}
      >
        <MapPin size={18} className="opacity-40 mb-1" />
        <span className="text-[10px] font-medium tracking-wide">No GPS Route</span>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-slate-900/90 dark:bg-slate-950 border border-slate-800/80 shadow-inner flex items-center justify-center ${className}`}
    >
      {/* Subtle grid pattern background */}
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)',
          backgroundSize: '16px 16px',
        }}
      />

      <svg
        viewBox="0 0 300 150"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full p-1 drop-shadow-[0_2px_8px_rgba(16,185,129,0.35)]"
      >
        <defs>
          <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="50%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer subtle glow line */}
        <path
          d={pathData}
          fill="none"
          stroke="#10B981"
          strokeWidth={strokeWidth + 2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.25}
        />

        {/* Main route path */}
        <path
          d={pathData}
          fill="none"
          stroke="url(#routeGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
        />

        {/* Start Point Marker (Emerald green) */}
        {startPoint && (
          <g>
            <circle
              cx={startPoint[0]}
              cy={startPoint[1]}
              r={5}
              fill="#10B981"
              stroke="#ffffff"
              strokeWidth={1.5}
            />
            <circle
              cx={startPoint[0]}
              cy={startPoint[1]}
              r={2}
              fill="#ffffff"
            />
          </g>
        )}

        {/* Finish Point Marker (Rose red) */}
        {endPoint && (
          <g>
            <circle
              cx={endPoint[0]}
              cy={endPoint[1]}
              r={5.5}
              fill="#F43F5E"
              stroke="#ffffff"
              strokeWidth={1.5}
            />
            <circle
              cx={endPoint[0]}
              cy={endPoint[1]}
              r={2}
              fill="#ffffff"
            />
          </g>
        )}
      </svg>
    </div>
  );
};
