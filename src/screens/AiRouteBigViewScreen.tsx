import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  ArrowLeft,
  Navigation,
  RotateCcw,
  LocateFixed,
  MapPin,
  TrendingUp,
  Clock,
  Trees,
  Zap,
  Waves,
  Building2,
  Mountain,
  ChevronUp,
  ChevronDown,
  X,
  Route,
  Compass,
} from 'lucide-react';
import {
  aiRouteService,
  GeneratedAiRoute,
  SceneryType,
  LoopDirection,
  TurnCue,
} from '../services/aiRouteService';
import { courseService } from '../services/courseService';
import { gpsEngine } from '../services/gpsEngine';
import { CourseRoute, UserProfile } from '../types';
import { formatDuration } from '../utils/formatters';

const createRunnerIcon = () =>
  L.divIcon({
    className: 'user-location-marker',
    html: `<div class="user-marker-pulse"></div><div class="user-marker-dot"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

const createStartFinishIcon = () =>
  L.divIcon({
    className: 'ai-route-start-pin',
    html: `<div class="px-2.5 py-1 rounded-full bg-orange-600 border-2 border-white text-white text-[10px] font-black shadow-xl flex items-center gap-1 whitespace-nowrap"><span>🏁</span><span>START/FINISH</span></div>`,
    iconSize: [96, 26],
    iconAnchor: [48, 26],
  });

const createWaypointIcon = (number: number) =>
  L.divIcon({
    className: 'ai-route-wp-pin',
    html: `<div class="w-6 h-6 rounded-full bg-indigo-600 border-2 border-white text-white text-[10px] font-black flex items-center justify-center shadow-lg">${number}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

interface MapControllerProps {
  center: [number, number];
  boundsPoints: [number, number][];
  recenterTrigger: number;
}

function MapController({ center, boundsPoints, recenterTrigger }: MapControllerProps) {
  const map = useMap();
  const isFirstRender = useRef(true);

  // Invalidate map size on initial mount and when layout transitions
  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [map]);

  // Fit bounds whenever boundsPoints change or on recenter trigger
  useEffect(() => {
    if (boundsPoints.length >= 2) {
      try {
        const bounds = L.latLngBounds(boundsPoints);
        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 16,
          animate: !isFirstRender.current,
        });
        isFirstRender.current = false;
      } catch { }
    } else if (center[0] !== 0 && center[1] !== 0) {
      map.setView(center, Math.max(map.getZoom() || 15, 15), {
        animate: !isFirstRender.current,
      });
      isFirstRender.current = false;
    }
  }, [boundsPoints, center, map, recenterTrigger]);

  return null;
}

function ZoomControls() {
  const map = useMap();
  return (
    <div className="absolute bottom-24 left-3 sm:left-4 z-[400] flex flex-col gap-1.5 pointer-events-auto">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          map.zoomIn();
        }}
        className="w-9 h-9 rounded-xl bg-slate-900/90 text-white border border-slate-700 hover:bg-slate-800 hover:text-emerald-400 active:scale-95 flex items-center justify-center font-bold text-base backdrop-blur-md cursor-pointer transition-all shadow-lg"
        title="Zoom In"
        aria-label="Zoom In"
      >
        +
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          map.zoomOut();
        }}
        className="w-9 h-9 rounded-xl bg-slate-900/90 text-white border border-slate-700 hover:bg-slate-800 hover:text-emerald-400 active:scale-95 flex items-center justify-center font-bold text-base backdrop-blur-md cursor-pointer transition-all shadow-lg"
        title="Zoom Out"
        aria-label="Zoom Out"
      >
        −
      </button>
    </div>
  );
}

export interface AiRouteBigViewScreenProps {
  isOpen: boolean;
  onBack: () => void;
  onCloseAll: () => void;
  initialRoute: GeneratedAiRoute | null;
  initialDistanceKm?: number;
  initialScenery?: SceneryType;
  initialDirection?: LoopDirection;
  currentLat?: number | null;
  currentLng?: number | null;
  profile?: UserProfile | null;
  onRouteActivated?: (course: CourseRoute) => void;
  onDistanceChange?: (d: number) => void;
  onSceneryChange?: (s: SceneryType) => void;
  onDirectionChange?: (d: LoopDirection) => void;
  onRouteChange?: (route: GeneratedAiRoute) => void;
}

export const AiRouteBigViewScreen: React.FC<AiRouteBigViewScreenProps> = ({
  isOpen,
  onBack,
  onCloseAll,
  initialRoute,
  initialDistanceKm = 5.0,
  initialScenery = 'park',
  initialDirection = 'any',
  currentLat,
  currentLng,
  profile,
  onRouteActivated,
  onDistanceChange,
  onSceneryChange,
  onDirectionChange,
  onRouteChange,
}) => {
  const [distanceKm, setDistanceKm] = useState<number>(initialDistanceKm);
  const [scenery, setScenery] = useState<SceneryType>(initialScenery);
  const [direction, setDirection] = useState<LoopDirection>(initialDirection);
  const [currentRoute, setCurrentRoute] = useState<GeneratedAiRoute | null>(initialRoute);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [showWaypoints, setShowWaypoints] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  // Sync state when props change
  useEffect(() => {
    if (initialRoute) setCurrentRoute(initialRoute);
    if (initialDistanceKm) setDistanceKm(initialDistanceKm);
    if (initialScenery) setScenery(initialScenery);
    if (initialDirection) setDirection(initialDirection);
  }, [initialRoute, initialDistanceKm, initialScenery, initialDirection]);

  // Recalculate route loop
  const recalculateLoop = useCallback(
    (targetDist: number, targetScenery: SceneryType, targetDir: LoopDirection) => {
      const lat = currentLat || currentRoute?.start_lat || 37.7749;
      const lng = currentLng || currentRoute?.start_lng || -122.4194;
      const newRoute = aiRouteService.calculateLoopRoute({
        startLat: lat,
        startLng: lng,
        distanceKm: targetDist,
        sceneryType: targetScenery,
        direction: targetDir,
        userId: profile?.id || profile?.user_id || null,
      });
      setCurrentRoute(newRoute);
      if (onRouteChange) onRouteChange(newRoute);
    },
    [currentLat, currentLng, currentRoute?.start_lat, currentRoute?.start_lng, profile, onRouteChange]
  );

  const handleSelectDistance = (d: number) => {
    setDistanceKm(d);
    if (onDistanceChange) onDistanceChange(d);
    recalculateLoop(d, scenery, direction);
  };

  const handleShuffle = () => {
    recalculateLoop(distanceKm, scenery, direction);
  };

  const handleRecenter = () => {
    setRecenterTrigger((prev) => prev + 1);
  };

  const handleActivate = async () => {
    if (!currentRoute || isActivating) return;
    setIsActivating(true);
    try {
      let saved = currentRoute;
      try {
        saved = await aiRouteService.saveRouteToDatabase(currentRoute);
      } catch (err) {
        console.warn('Notice saving route:', err);
      }
      const course = aiRouteService.convertAndActivateAsCourse(saved);
      if (onRouteActivated) {
        onRouteActivated(course);
      }
      onCloseAll();
    } finally {
      setIsActivating(false);
    }
  };

  const DISTANCE_PRESETS = [3.0, 5.0, 8.0, 10.0, 15.0, 21.1];

  const SCENERY_ITEMS: Array<{ type: SceneryType; label: string; icon: React.ReactNode }> = [
    { type: 'park', label: 'Parklands', icon: <Trees size={13} className="text-emerald-400" /> },
    { type: 'flat', label: 'Flat & Fast', icon: <Zap size={13} className="text-amber-400" /> },
    { type: 'waterfront', label: 'Waterfront', icon: <Waves size={13} className="text-cyan-400" /> },
    { type: 'urban', label: 'City Blocks', icon: <Building2 size={13} className="text-slate-300" /> },
    { type: 'trail', label: 'Trail', icon: <Mountain size={13} className="text-emerald-500" /> },
  ];

  const latLngs: [number, number][] = useMemo(
    () => (currentRoute?.points || []).map((p) => [p.latitude, p.longitude]),
    [currentRoute?.points]
  );

  const userCoord: [number, number] | null = useMemo(() => {
    if (currentLat && currentLng) return [currentLat, currentLng];
    if (currentRoute?.start_lat && currentRoute?.start_lng) {
      return [currentRoute.start_lat, currentRoute.start_lng];
    }
    return null;
  }, [currentLat, currentLng, currentRoute?.start_lat, currentRoute?.start_lng]);

  const defaultCenter: [number, number] = useMemo(() => {
    if (userCoord) return userCoord;
    if (latLngs.length > 0) return latLngs[0];
    return [37.7749, -122.4194];
  }, [userCoord, latLngs]);

  const allBoundsPoints: [number, number][] = useMemo(() => {
    const list = [...latLngs];
    if (userCoord) list.push(userCoord);
    return list;
  }, [latLngs, userCoord]);

  const waypointMarkers = useMemo(() => {
    const turnCues = currentRoute?.turn_cues || [];
    const points = currentRoute?.points || [];
    return turnCues
      .filter((cue) => cue.distanceMeters > 0 && cue.icon !== 'finish')
      .map((cue, idx) => {
        const matched =
          points.find((p) => p.distanceFromStartMeters >= cue.distanceMeters) ||
          points[Math.min(points.length - 1, (idx + 1) * Math.floor(points.length / 4))];
        if (!matched) return null;
        return {
          coord: [matched.latitude, matched.longitude] as [number, number],
          instruction: cue.instruction,
          distanceMeters: cue.distanceMeters,
          number: idx + 1,
        };
      })
      .filter(Boolean) as Array<{
        coord: [number, number];
        instruction: string;
        distanceMeters: number;
        number: number;
      }>;
  }, [currentRoute?.points, currentRoute?.turn_cues]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100002] w-screen h-screen bg-slate-950 flex flex-col select-none overflow-hidden animate-fade-in font-sans">
      {/* Top Floating Glass Navigation Header */}
      <header className="relative z-[1010] px-4 py-3 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800 flex items-center justify-between shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm border border-slate-700/60"
            title="Return to Loop Generator settings"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-black text-white leading-tight">
                {currentRoute ? currentRoute.name : `${distanceKm.toFixed(1)}K Loop Route`}
              </h1>

            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Real-time GPS Origin Loop</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleShuffle}
            className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 active:scale-95 transition-all cursor-pointer shadow-sm"
            title="Generate alternative loop route"
            aria-label="Reroll route"
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={handleRecenter}
            className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-emerald-400 border border-slate-700/60 active:scale-95 transition-all cursor-pointer shadow-sm"
            title="Recenter Map on Loop"
            aria-label="Recenter map"
          >
            <LocateFixed size={16} />
          </button>
          <button
            onClick={onCloseAll}
            className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/60 active:scale-95 transition-all cursor-pointer shadow-sm"
            title="Close view"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Edge-to-Edge Interactive Map Section */}
      <main className="relative flex-1 w-full h-full overflow-hidden bg-slate-900">
        <MapContainer
          center={defaultCenter}
          zoom={14}
          className="w-full h-full"
          zoomControl={false}
          attributionControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapController
            center={defaultCenter}
            boundsPoints={allBoundsPoints}
            recenterTrigger={recenterTrigger}
          />

          {/* Closed Loop Route Polyline with Soft Orange Glow */}
          {latLngs.length > 1 && (
            <>
              <Polyline
                positions={latLngs}
                pathOptions={{
                  color: '#ea580c',
                  weight: 8,
                  opacity: 0.35,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
              <Polyline
                positions={latLngs}
                pathOptions={{
                  color: '#f97316',
                  weight: 4.5,
                  opacity: 1.0,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            </>
          )}

          {/* Start/Finish Pin */}
          {latLngs.length > 0 && (
            <Marker position={latLngs[0]} icon={createStartFinishIcon()} />
          )}

          {/* Live Runner Location Pin */}
          {userCoord && (
            <Marker position={userCoord} icon={createRunnerIcon()} />
          )}

          {/* Turn Waypoint Pins */}
          {waypointMarkers.map((wp) => (
            <Marker
              key={`wp_${wp.number}`}
              position={wp.coord}
              icon={createWaypointIcon(wp.number)}
            >
              <Popup className="ai-wp-popup">
                <div className="text-[11px] font-sans font-semibold p-1">
                  <span className="font-bold text-indigo-600 block">
                    Waypoint {wp.number} ({(wp.distanceMeters / 1000).toFixed(1)} km)
                  </span>
                  <span>{wp.instruction}</span>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* In-Map Interactive Zoom Buttons */}
          <ZoomControls />
        </MapContainer>

        {/* Floating Origin Pill at top-left of map */}
        <div className="absolute top-3 left-3 z-[400] px-3 py-1.5 rounded-full bg-slate-950/85 backdrop-blur-md border border-slate-800 text-white text-[11px] font-black flex items-center gap-2 shadow-lg pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="tracking-wide">START & FINISH LOCATION</span>
        </div>

        {/* Floating Recenter Pin at bottom-right */}
        <button
          onClick={handleRecenter}
          className="absolute bottom-24 right-3 sm:right-4 z-[400] p-2.5 rounded-xl bg-slate-900/90 text-white border border-slate-700 hover:bg-slate-800 hover:text-emerald-400 active:scale-95 shadow-lg backdrop-blur-md transition-all cursor-pointer"
          title="Recenter Map"
        >
          <LocateFixed size={18} />
        </button>
      </main>

      {/* Floating Bottom Navigation & Controls HUD */}
      <footer className="relative z-[1010] p-3 sm:p-4 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 flex flex-col gap-2.5 max-w-2xl w-full mx-auto shrink-0 shadow-2xl">
        {/* Quick Distance Presets */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar flex-1">
            {DISTANCE_PRESETS.map((d) => (
              <button
                key={d}
                onClick={() => handleSelectDistance(d)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${distanceKm === d
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
              >
                {d === 21.1 ? '21K' : `${d}K`}
              </button>
            ))}
          </div>

          <button
            onClick={handleShuffle}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white active:scale-95 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700/50 shrink-0"
            title="Generate alternative loop"
          >
            <RotateCcw size={13} />
            <span>Reroll</span>
          </button>
        </div>

        {/* Live Metrics Grid */}
        {currentRoute && (
          <div className="px-3.5 py-2 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">
                  Distance
                </span>
                <span className="text-sm font-black text-white font-mono">
                  {(currentRoute.target_distance_meters / 1000).toFixed(2)} km
                </span>
              </div>
              <div className="w-px h-6 bg-slate-800" />
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">
                  Elevation
                </span>
                <span className="text-sm font-black text-emerald-400 font-mono">
                  +{currentRoute.elevation_gain_meters}m
                </span>
              </div>
              <div className="w-px h-6 bg-slate-800" />
              <div>
                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block">
                  Est. Time
                </span>
                <span className="text-sm font-black text-white font-mono">
                  {formatDuration(currentRoute.estimated_duration_seconds)}
                </span>
              </div>
            </div>

            {/* Scenery Badge & Waypoints toggle */}
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded-xl bg-slate-800 text-emerald-400 font-bold text-[10px] capitalize border border-slate-700">
                {scenery}
              </span>
              {currentRoute.turn_cues && currentRoute.turn_cues.length > 0 && (
                <button
                  onClick={() => setShowWaypoints(!showWaypoints)}
                  className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] flex items-center gap-1 transition-all cursor-pointer"
                  title="View turn by turn waypoints"
                >
                  <span>{currentRoute.turn_cues.length} Turns</span>
                  {showWaypoints ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Collapsible Waypoints Drawer */}
        {showWaypoints && currentRoute?.turn_cues && (
          <div className="max-h-36 overflow-y-auto px-3 py-2 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col gap-1.5 text-[11px] animate-fade-in">
            {currentRoute.turn_cues.map((cue, idx) => (
              <div key={idx} className="flex items-start gap-2 text-slate-300">
                <span className="font-mono text-emerald-400 font-bold shrink-0">
                  {(cue.distanceMeters / 1000).toFixed(1)} km:
                </span>
                <span>{cue.instruction}</span>
              </div>
            ))}
          </div>
        )}

        {/* Primary Hero CTA Button */}
        <button
          onClick={handleActivate}
          disabled={!currentRoute || isActivating}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
        >
          <Navigation size={16} />
          <span>
            {isActivating
              ? 'Activating Route...'
              : `Navigate This Loop (${distanceKm.toFixed(1)}K)`}
          </span>
        </button>
      </footer>
    </div>,
    document.body
  );
};
