import React, { useEffect, useMemo, useState, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { GPSCoordinate } from '../../types';
import { Maximize2, Minimize2, Play, Pause, RotateCcw, FastForward } from 'lucide-react';
import { calculateSplits, getRouteDistanceMilestones } from '../../utils/calculations';
import { formatDistance, formatDuration, formatPace } from '../../utils/formatters';

interface StaticRouteMapProps {
  coordinates: GPSCoordinate[];
  className?: string;
  interactive?: boolean;
  onToggleFullscreen?: () => void;
  showPlaybackControl?: boolean;
}

const createRunnerMarkerIcon = () => {
  return L.divIcon({
    className: 'runner-playback-marker',
    html: `<div class="relative flex items-center justify-center"><div class="absolute w-8 h-8 rounded-full bg-emerald-400/40 animate-ping"></div><div class="relative w-6 h-6 rounded-full bg-emerald-500 border-2 border-white shadow-xl flex items-center justify-center text-white text-[10px]">🏃</div></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const createStartBadgeIcon = () => {
  return L.divIcon({
    className: 'start-badge-marker',
    html: `<div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold shadow-lg border-2 border-white select-none"><span class="w-2 h-2 rounded-full bg-white animate-pulse"></span><span>Start</span></div>`,
    iconSize: [60, 24],
    iconAnchor: [30, 12],
  });
};

const createFinishBadgeIcon = () => {
  return L.divIcon({
    className: 'finish-badge-marker',
    html: `<div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold shadow-lg border-2 border-white select-none"><span class="w-2 h-2 rounded-full bg-white"></span><span>Finish</span></div>`,
    iconSize: [64, 24],
    iconAnchor: [32, 12],
  });
};

const createKilometerMarkerIcon = (kilometer: number) => L.divIcon({
  className: 'distance-milestone-marker',
  html: `<div class="flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-white bg-emerald-700 px-1 text-[10px] font-black text-white shadow-lg">${kilometer}</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function FitBounds({ coordinates }: { coordinates: GPSCoordinate[] }) {
  const map = useMap();

  useEffect(() => {
    if (coordinates.length > 0) {
      const bounds = L.latLngBounds(coordinates.map((c) => [c.latitude, c.longitude]));
      map.fitBounds(bounds, { padding: [35, 35], maxZoom: 16 });
    }
  }, [coordinates, map]);

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);
    return () => clearTimeout(timer);
  }, [map]);

  return null;
}

export const StaticRouteMap: React.FC<StaticRouteMapProps> = ({
  coordinates,
  className = 'h-52 w-full',
  interactive = false,
  onToggleFullscreen,
  showPlaybackControl = true,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4>(1);
  const playbackIntervalRef = useRef<any>(null);

  if (!coordinates || coordinates.length === 0) {
    return (
      <div className={`rounded-2xl bg-emerald-50/50 dark:bg-slate-900/60 border border-emerald-200/80 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400 text-xs p-6 ${className}`}>
        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-slate-800 text-emerald-600 flex items-center justify-center mb-1">
          📍
        </div>
        <span>GPS route coordinates unavailable</span>
      </div>
    );
  }

  // Playback timer animation
  useEffect(() => {
    if (isPlaying) {
      const step = coordinates.length > 500 ? Math.ceil(coordinates.length / 300) : 1;
      const intervalMs = Math.max(25, Math.round(100 / playbackSpeed));
      playbackIntervalRef.current = setInterval(() => {
        setPlaybackIndex((prev) => {
          const next = prev + step;
          if (next >= coordinates.length - 1) {
            setIsPlaying(false);
            return coordinates.length - 1;
          }
          return next;
        });
      }, intervalMs);
    } else {
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    }
    return () => {
      if (playbackIntervalRef.current) clearInterval(playbackIntervalRef.current);
    };
  }, [isPlaying, playbackSpeed, coordinates.length]);

  const startCoord = coordinates[0];
  const endCoord = coordinates[coordinates.length - 1];
  const currentCoord = coordinates[Math.min(playbackIndex, coordinates.length - 1)] || startCoord;
  const polylinePositions: [number, number][] = coordinates.map((c) => [c.latitude, c.longitude]);
  const playedPolylinePositions: [number, number][] = coordinates
    .slice(0, playbackIndex + 1)
    .map((c) => [c.latitude, c.longitude]);

  const kilometerMilestones = useMemo(
    () => getRouteDistanceMilestones(coordinates),
    [coordinates]
  );
  const kilometerSplits = useMemo(() => calculateSplits(coordinates), [coordinates]);
  const center: [number, number] = [startCoord.latitude, startCoord.longitude];

  const handleFullscreenClick = () => {
    if (onToggleFullscreen) {
      onToggleFullscreen();
    } else {
      setIsFullscreen(!isFullscreen);
    }
  };

  const handleTogglePlay = () => {
    if (playbackIndex >= coordinates.length - 1) {
      setPlaybackIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleResetPlayback = () => {
    setIsPlaying(false);
    setPlaybackIndex(0);
  };

  const handleCycleSpeed = () => {
    setPlaybackSpeed((prev) => (prev === 1 ? 2 : prev === 2 ? 4 : 1));
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-emerald-50/30 dark:bg-slate-950 border border-emerald-200/80 dark:border-slate-800 shadow-sm ${
        isFullscreen ? 'fixed inset-4 z-50 shadow-2xl h-auto' : className
      }`}
    >
      <MapContainer
        center={center}
        zoom={15}
        scrollWheelZoom={interactive || isFullscreen}
        dragging={interactive || isFullscreen}
        touchZoom={interactive || isFullscreen}
        doubleClickZoom={interactive || isFullscreen}
        zoomControl={false}
        attributionControl={false}
        className="h-full w-full z-0"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
          subdomains="abc"
          maxZoom={19}
        />

        <FitBounds coordinates={coordinates} />

        {/* Outer athletic glow */}
        <Polyline
          positions={polylinePositions}
          pathOptions={{
            color: '#10b981',
            weight: 7,
            opacity: 0.3,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />

        {/* Base Solid route line */}
        <Polyline
          positions={polylinePositions}
          pathOptions={{
            color: '#059669',
            weight: 4,
            opacity: 0.75,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />

        {/* Animated Active Played Trail */}
        {playedPolylinePositions.length > 1 && (
          <Polyline
            positions={playedPolylinePositions}
            pathOptions={{
              color: '#34d399',
              weight: 5,
              opacity: 1.0,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        )}

        {/* Completed-kilometre markers */}
        {kilometerMilestones.map((milestone, index) => {
          const split = kilometerSplits[index];
          const kilometer = milestone.distanceMeters / 1000;

          return (
            <Marker
              key={milestone.distanceMeters}
              position={[milestone.coordinate.latitude, milestone.coordinate.longitude]}
              icon={createKilometerMarkerIcon(kilometer)}
              zIndexOffset={500}
            >
              <Popup closeButton={false} offset={[0, -12]}>
                <div className="min-w-32 text-center text-slate-800">
                  <p className="text-xs font-black text-emerald-700">Kilometer {kilometer}</p>
                  <p className="mt-1 text-sm font-bold">{split ? formatDuration(split.duration_seconds) : '--:--'}</p>
                  <p className="text-[11px] text-slate-500">{split ? formatPace(split.pace) : 'Split unavailable'}</p>
                  {split?.speed_kmh != null && <p className="mt-1 text-[10px] font-semibold text-slate-400">{split.speed_kmh.toFixed(1)} km/h</p>}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Start Pin Badge */}
        <Marker position={[startCoord.latitude, startCoord.longitude]} icon={createStartBadgeIcon()} />

        {/* Finish Pin Badge */}
        {coordinates.length > 1 && (
          <Marker position={[endCoord.latitude, endCoord.longitude]} icon={createFinishBadgeIcon()} />
        )}

        {/* Live Runner Playback Dot */}
        {(isPlaying || playbackIndex > 0) && (
          <Marker
            position={[currentCoord.latitude, currentCoord.longitude]}
            icon={createRunnerMarkerIcon()}
            zIndexOffset={1000}
          />
        )}
      </MapContainer>

      {/* Floating GPS Route Playback Control Bar */}
      {showPlaybackControl && coordinates.length > 5 && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-emerald-200/80 dark:border-slate-800 shadow-md">
          {/* Play / Pause */}
          <button
            onClick={handleTogglePlay}
            className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 active:scale-90 transition-all shadow-xs"
            title={isPlaying ? 'Pause Route Playback' : 'Play GPS Route'}
            aria-label="Toggle Play Route"
          >
            {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="translate-x-0.5" />}
          </button>

          {/* Reset */}
          <button
            onClick={handleResetPlayback}
            className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center hover:bg-slate-200 active:scale-90 transition-all"
            title="Reset Playback"
            aria-label="Reset Route Playback"
          >
            <RotateCcw size={12} />
          </button>

          {/* Speed Toggle */}
          <button
            onClick={handleCycleSpeed}
            className="px-2 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[10px] hover:bg-slate-200 active:scale-90 transition-all"
            title="Cycle Playback Speed"
          >
            {playbackSpeed}x
          </button>

          {/* Progress % */}
          <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 px-1">
            {Math.round((playbackIndex / (coordinates.length - 1)) * 100)}%
          </span>
        </div>
      )}

      {/* Fullscreen Toggle Button */}
      <button
        onClick={handleFullscreenClick}
        className="absolute bottom-3 right-3 z-10 p-2 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-emerald-200/80 dark:border-slate-700/80 text-emerald-900 dark:text-slate-300 hover:text-emerald-950 dark:hover:text-white shadow-md active:scale-95 transition-all"
        title={isFullscreen ? 'Exit Fullscreen Map' : 'Expand Fullscreen Map'}
        aria-label="Toggle Fullscreen Map"
      >
        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>
    </div>
  );
};
