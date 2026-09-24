import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { GPSCoordinate } from '../../types';
import { Maximize2, Minimize2, Play, Pause, RotateCcw, X, LocateFixed } from 'lucide-react';
import { calculateSplits, getRouteDistanceMilestones, calculateHaversineDistance } from '../../utils/calculations';
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

const createKilometerMarkerIcon = (kilometer: number) =>
  L.divIcon({
    className: 'distance-milestone-marker',
    html: `<div class="flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-white bg-emerald-700 px-1 text-[10px] font-black text-white shadow-lg">${kilometer}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

/**
 * Controller to manage map sizing, bounds fitting, and view stabilization.
 * Prevents zero/unmeasured container dimensions from causing Leaflet NaN zoom corruption.
 */
function MapController({
  coordinates,
  isFullscreen,
  recenterTrigger,
}: {
  coordinates: GPSCoordinate[];
  isFullscreen?: boolean;
  recenterTrigger?: number;
}) {
  const map = useMap();

  const fitBoundsSafely = useCallback(() => {
    if (!coordinates || coordinates.length === 0) return false;
    const container = map.getContainer();
    if (!container) return false;

    // Invalidate size first so Leaflet recalculates pixel boundaries
    map.invalidateSize();

    const size = map.getSize();
    // Guard: Never invoke fitBounds if container has 0 or negligible dimensions
    if (!size || size.x <= 20 || size.y <= 20) {
      return false;
    }

    try {
      const bounds = L.latLngBounds(coordinates.map((c) => [c.latitude, c.longitude]));
      if (!bounds.isValid()) return false;

      // Safe padding that cannot exceed container dimensions
      const maxPadX = Math.floor(size.x / 4);
      const maxPadY = Math.floor(size.y / 4);
      const targetPad = isFullscreen ? 50 : 35;
      const padX = Math.max(10, Math.min(targetPad, maxPadX));
      const padY = Math.max(10, Math.min(targetPad, maxPadY));

      map.fitBounds(bounds, {
        padding: [padX, padY],
        maxZoom: 16,
        animate: false,
      });
      return true;
    } catch {
      return false;
    }
  }, [coordinates, isFullscreen, map]);

  // Initial and reactive bounds fitting with RAF and progressive retry timers
  useEffect(() => {
    fitBoundsSafely();

    const rafId = requestAnimationFrame(() => {
      fitBoundsSafely();
    });
    const t1 = setTimeout(fitBoundsSafely, 50);
    const t2 = setTimeout(fitBoundsSafely, 150);
    const t3 = setTimeout(fitBoundsSafely, 350);
    const t4 = setTimeout(fitBoundsSafely, 600);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [fitBoundsSafely, recenterTrigger]);

  // ResizeObserver on the container to dynamically re-adjust whenever size changes
  useEffect(() => {
    const container = map.getContainer();
    if (!container) return;

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        fitBoundsSafely();
      });
    });
    ro.observe(container);

    return () => {
      ro.disconnect();
    };
  }, [map, fitBoundsSafely]);

  return null;
}

interface PlaybackControlProps {
  isPlaying: boolean;
  playbackIndex: number;
  playbackSpeed: 1 | 2 | 4;
  totalPoints: number;
  onTogglePlay: () => void;
  onReset: () => void;
  onCycleSpeed: () => void;
  className?: string;
}

/**
 * Redesigned Route Playback Control:
 * Sleek, ultra-compact, and minimal floating pill with micro-interactions.
 */
const PlaybackControl: React.FC<PlaybackControlProps> = ({
  isPlaying,
  playbackIndex,
  playbackSpeed,
  totalPoints,
  onTogglePlay,
  onReset,
  onCycleSpeed,
  className = 'top-2.5 left-2.5',
}) => {
  const progressPercent = Math.round((playbackIndex / Math.max(totalPoints - 1, 1)) * 100);
  const isActive = isPlaying || playbackIndex > 0;

  return (
    <div
      className={`absolute ${className} z-[10] flex items-center gap-1.5 p-1 px-1.5 rounded-full bg-slate-950/80 dark:bg-slate-950/90 backdrop-blur-md border border-white/15 shadow-md text-white select-none transition-all duration-200`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Play / Pause Circular Mini Button */}
      <button
        onClick={onTogglePlay}
        className="w-5 h-5 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-90 text-slate-950 flex items-center justify-center transition-transform shadow-xs shrink-0 cursor-pointer"
        title={isPlaying ? 'Pause route animation' : 'Play route animation'}
        aria-label={isPlaying ? 'Pause Route' : 'Play Route'}
      >
        {isPlaying ? (
          <Pause size={9} className="fill-slate-950" />
        ) : (
          <Play size={9} className="fill-slate-950 translate-x-[0.5px]" />
        )}
      </button>

      {/* Idle State: Minimal "Play" text */}
      {!isActive ? (
        <button
          onClick={onTogglePlay}
          className="text-[10px] font-semibold text-slate-200 hover:text-white pr-1 transition-colors cursor-pointer"
        >
          Play
        </button>
      ) : (
        /* Active State: Minimal Speed + Progress % + Reset icon */
        <div className="flex items-center gap-1.5 pr-0.5">
          {/* Speed Toggle Badge */}
          <button
            onClick={onCycleSpeed}
            className="px-1.5 py-0.2 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white font-mono font-bold text-[9px] border border-white/10 active:scale-90 transition-all cursor-pointer"
            title="Cycle Speed (1x, 2x, 4x)"
          >
            {playbackSpeed}x
          </button>

          {/* Progress % */}
          <span className="text-[9px] font-mono font-bold text-emerald-400 min-w-[22px] text-center">
            {progressPercent}%
          </span>

          {/* Reset button */}
          <button
            onClick={onReset}
            className="p-0.5 rounded-full hover:bg-white/15 text-slate-400 hover:text-white active:scale-90 transition-all shrink-0 cursor-pointer"
            title="Reset to start"
            aria-label="Reset Route"
          >
            <RotateCcw size={9} />
          </button>
        </div>
      )}
    </div>
  );
};

interface MapInnerContentProps {
  coordinates: GPSCoordinate[];
  polylinePositions: [number, number][];
  playedPolylinePositions: [number, number][];
  startCoord: GPSCoordinate;
  endCoord: GPSCoordinate;
  currentCoord: GPSCoordinate;
  isPlaying: boolean;
  playbackIndex: number;
  kilometerMilestones: ReturnType<typeof getRouteDistanceMilestones>;
  kilometerSplits: ReturnType<typeof calculateSplits>;
  isFullscreen: boolean;
  recenterTrigger?: number;
}

const MapInnerContent: React.FC<MapInnerContentProps> = ({
  coordinates,
  polylinePositions,
  playedPolylinePositions,
  startCoord,
  endCoord,
  currentCoord,
  isPlaying,
  playbackIndex,
  kilometerMilestones,
  kilometerSplits,
  isFullscreen,
  recenterTrigger,
}) => {
  return (
    <>
      <TileLayer
        url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"
        subdomains="abc"
        maxNativeZoom={19}
        maxZoom={19}
      />

      <MapController coordinates={coordinates} isFullscreen={isFullscreen} recenterTrigger={recenterTrigger} />

      {/* Outer athletic glow polyline */}
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

      {/* Completed-kilometre markers with splits detail popup */}
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
                {split?.speed_kmh != null && (
                  <p className="mt-1 text-[10px] font-semibold text-slate-400">{split.speed_kmh.toFixed(1)} km/h</p>
                )}
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
    </>
  );
};

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
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const playbackIntervalRef = useRef<any>(null);

  // Keyboard shortcut listener to close fullscreen on Escape
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

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
  }, [isPlaying, playbackSpeed, coordinates?.length]);

  const totalDistanceMeters = useMemo(() => {
    if (!coordinates || coordinates.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < coordinates.length; i++) {
      total +=
        coordinates[i].distanceFromPrevious ??
        calculateHaversineDistance(
          coordinates[i - 1].latitude,
          coordinates[i - 1].longitude,
          coordinates[i].latitude,
          coordinates[i].longitude
        );
    }
    return Math.round(total);
  }, [coordinates]);

  if (!coordinates || coordinates.length === 0) {
    return (
      <div
        className={`rounded-2xl bg-emerald-50/50 dark:bg-slate-900/60 border border-emerald-200/80 dark:border-slate-800 flex flex-col items-center justify-center text-slate-400 text-xs p-6 ${className}`}
      >
        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-slate-800 text-emerald-600 flex items-center justify-center mb-1">
          📍
        </div>
        <span>GPS route coordinates unavailable</span>
      </div>
    );
  }

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

  const handleFullscreenClick = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (onToggleFullscreen) {
      onToggleFullscreen();
    } else {
      setIsFullscreen((prev) => !prev);
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
    <>
      {/* Inline Normal Map View */}
      <div
        className={`relative overflow-hidden rounded-2xl bg-emerald-50/30 dark:bg-slate-950 border border-emerald-200/80 dark:border-slate-800 shadow-sm ${className}`}
      >
        <MapContainer
          key="inline-route-map"
          center={center}
          zoom={15}
          scrollWheelZoom={interactive}
          dragging={interactive}
          touchZoom={interactive}
          doubleClickZoom={interactive}
          zoomControl={false}
          attributionControl={false}
          className="h-full w-full z-0"
          style={{ height: '100%', width: '100%' }}
        >
          <MapInnerContent
            coordinates={coordinates}
            polylinePositions={polylinePositions}
            playedPolylinePositions={playedPolylinePositions}
            startCoord={startCoord}
            endCoord={endCoord}
            currentCoord={currentCoord}
            isPlaying={isPlaying}
            playbackIndex={playbackIndex}
            kilometerMilestones={kilometerMilestones}
            kilometerSplits={kilometerSplits}
            isFullscreen={false}
            recenterTrigger={recenterTrigger}
          />
        </MapContainer>

        {/* Floating Minimal GPS Route Playback Pill */}
        {showPlaybackControl && coordinates.length > 5 && (
          <PlaybackControl
            isPlaying={isPlaying}
            playbackIndex={playbackIndex}
            playbackSpeed={playbackSpeed}
            totalPoints={coordinates.length}
            onTogglePlay={handleTogglePlay}
            onReset={handleResetPlayback}
            onCycleSpeed={handleCycleSpeed}
            className="top-2.5 left-2.5"
          />
        )}

        {/* Map Controls */}
        <div className="absolute bottom-2.5 right-2.5 z-[10] flex items-center gap-1.5">
          {/* Recenter Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setRecenterTrigger((prev) => prev + 1);
            }}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-md border border-slate-700/80 text-white hover:text-emerald-400 shadow-md active:scale-95 transition-all cursor-pointer"
            title="Recenter Map"
            aria-label="Recenter Map"
          >
            <LocateFixed size={15} />
          </button>

          {/* Fullscreen Expand Button */}
          <button
            onClick={handleFullscreenClick}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-md border border-slate-700/80 text-white hover:text-emerald-400 shadow-md active:scale-95 transition-all cursor-pointer"
            title="Expand Fullscreen Map"
            aria-label="Expand Fullscreen Map"
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </div>

      {/* Fullscreen Modal View via React Portal */}
      {isFullscreen &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] bg-slate-950/85 backdrop-blur-md flex flex-col p-2 sm:p-4 md:p-6 select-none"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsFullscreen(false);
            }}
          >
            <div className="relative w-full h-full rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-900 border border-slate-700/80 shadow-2xl flex flex-col">
              {/* Fullscreen Header Bar */}
              <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 bg-slate-900/95 border-b border-slate-800 z-10 shrink-0">
                <div>
                  <div className="text-xs sm:text-sm font-bold text-white">GPS Route Map</div>
                  <div className="text-[10px] sm:text-[11px] text-slate-400 font-medium">
                    {formatDistance(totalDistanceMeters, 'km')} km • {coordinates.length} GPS points
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFullscreen(false);
                    }}
                    className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 active:scale-95 transition-all cursor-pointer"
                    title="Close Fullscreen Map"
                    aria-label="Close Fullscreen Map"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Fullscreen Map Body with guaranteed flex dimensions */}
              <div className="relative flex-1 min-h-0 w-full overflow-hidden">
                <MapContainer
                  key="fullscreen-route-map"
                  center={center}
                  zoom={15}
                  scrollWheelZoom={true}
                  dragging={true}
                  touchZoom={true}
                  doubleClickZoom={true}
                  zoomControl={false}
                  attributionControl={false}
                  className="absolute inset-0 h-full w-full z-0"
                  style={{ height: '100%', width: '100%' }}
                >
                  <MapInnerContent
                    coordinates={coordinates}
                    polylinePositions={polylinePositions}
                    playedPolylinePositions={playedPolylinePositions}
                    startCoord={startCoord}
                    endCoord={endCoord}
                    currentCoord={currentCoord}
                    isPlaying={isPlaying}
                    playbackIndex={playbackIndex}
                    kilometerMilestones={kilometerMilestones}
                    kilometerSplits={kilometerSplits}
                    isFullscreen={true}
                    recenterTrigger={recenterTrigger}
                  />
                </MapContainer>

                {/* Floating Minimal GPS Route Playback Pill in Fullscreen */}
                {showPlaybackControl && coordinates.length > 5 && (
                  <PlaybackControl
                    isPlaying={isPlaying}
                    playbackIndex={playbackIndex}
                    playbackSpeed={playbackSpeed}
                    totalPoints={coordinates.length}
                    onTogglePlay={handleTogglePlay}
                    onReset={handleResetPlayback}
                    onCycleSpeed={handleCycleSpeed}
                    className="top-3 left-3"
                  />
                )}

                {/* Fullscreen Bottom Buttons */}
                <div className="absolute bottom-3 right-3 z-[10] flex items-center gap-2">
                  {/* Recenter Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRecenterTrigger((prev) => prev + 1);
                    }}
                    className="p-2 rounded-xl bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-md border border-slate-700/80 text-white hover:text-emerald-400 shadow-md active:scale-95 transition-all cursor-pointer"
                    title="Recenter Map"
                    aria-label="Recenter Map"
                  >
                    <LocateFixed size={16} />
                  </button>

                  {/* Bottom Right Minimize Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFullscreen(false);
                    }}
                    className="p-2 rounded-xl bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-md border border-slate-700/80 text-white hover:text-emerald-400 shadow-md active:scale-95 transition-all cursor-pointer"
                    title="Exit Fullscreen"
                    aria-label="Exit Fullscreen"
                  >
                    <Minimize2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
