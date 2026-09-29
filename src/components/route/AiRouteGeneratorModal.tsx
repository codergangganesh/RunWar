import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Route,
  Navigation,
  Compass,
  Trees,
  Zap,
  Waves,
  Building2,
  Mountain,
  ChevronRight,
  Clock,
  TrendingUp,
  MapPin,
  Check,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import {
  aiRouteService,
  GeneratedAiRoute,
  SceneryType,
  LoopDirection,
} from '../../services/aiRouteService';
import { courseService } from '../../services/courseService';
import { gpsEngine } from '../../services/gpsEngine';
import { AiRoutePreviewMap } from './AiRoutePreviewMap';
import { UserProfile, CourseRoute } from '../../types';
import { formatDuration } from '../../utils/formatters';

interface AiRouteGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile?: UserProfile | null;
  currentLat?: number;
  currentLng?: number;
  onRouteActivated?: (course: CourseRoute) => void;
}

export const AiRouteGeneratorModal: React.FC<AiRouteGeneratorModalProps> = ({
  isOpen,
  onClose,
  profile,
  currentLat,
  currentLng,
  onRouteActivated,
}) => {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isAnimating, setIsAnimating] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const touchStartY = useRef<number | null>(null);

  const [activeTab, setActiveTab] = useState<'create' | 'saved'>('create');
  const [distanceKm, setDistanceKm] = useState<number>(5.0);
  const [scenery, setScenery] = useState<SceneryType>('park');
  const [direction, setDirection] = useState<LoopDirection>('any');
  const [currentRoute, setCurrentRoute] = useState<GeneratedAiRoute | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<GeneratedAiRoute[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);
  const [showTurnList, setShowTurnList] = useState(false);

  const [resolvedLat, setResolvedLat] = useState<number | null>(currentLat || null);
  const [resolvedLng, setResolvedLng] = useState<number | null>(currentLng || null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationSource, setLocationSource] = useState<'gps' | 'props' | 'fallback'>('props');

  // Real-time GPS location acquisition on open
  useEffect(() => {
    if (!isOpen) return;

    // 1. If explicit valid coordinates passed from parent, use them
    if (currentLat && currentLng && (currentLat !== 37.7749 || currentLng !== -122.4194)) {
      setResolvedLat(currentLat);
      setResolvedLng(currentLng);
      setLocationSource('props');
      return;
    }

    // 2. Check if running gpsEngine has a live location
    const engineLoc = gpsEngine.getState().currentLocation;
    if (engineLoc?.latitude && engineLoc?.longitude) {
      setResolvedLat(engineLoc.latitude);
      setResolvedLng(engineLoc.longitude);
      setLocationSource('gps');
      return;
    }

    // 3. Request high-accuracy real-time browser/device geolocation
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setResolvedLat(pos.coords.latitude);
          setResolvedLng(pos.coords.longitude);
          setLocationSource('gps');
          setIsLocating(false);
        },
        (err) => {
          console.warn('Live GPS acquisition notice, falling back:', err);
          setIsLocating(false);
          setResolvedLat((prev) => prev || currentLat || 37.7749);
          setResolvedLng((prev) => prev || currentLng || -122.4194);
          setLocationSource('fallback');
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 }
      );
    } else {
      setResolvedLat(currentLat || 37.7749);
      setResolvedLng(currentLng || -122.4194);
    }
  }, [isOpen, currentLat, currentLng]);

  // Synchronous route recalculation whenever distanceKm, scenery, direction, or location changes
  const updateRoutePreview = useCallback((
    targetDist: number = distanceKm,
    targetScenery: SceneryType = scenery,
    targetDir: LoopDirection = direction
  ) => {
    const lat = resolvedLat || currentLat || 37.7749;
    const lng = resolvedLng || currentLng || -122.4194;
    const calculated = aiRouteService.calculateLoopRoute({
      startLat: lat,
      startLng: lng,
      distanceKm: targetDist,
      sceneryType: targetScenery,
      direction: targetDir,
      userId: profile?.id || profile?.user_id || null,
    });
    setCurrentRoute(calculated);
  }, [distanceKm, scenery, direction, resolvedLat, resolvedLng, currentLat, currentLng, profile]);

  // Initial calculation once location is known or when modal opens
  useEffect(() => {
    if (isOpen) {
      updateRoutePreview();
    }
  }, [isOpen, resolvedLat, resolvedLng, updateRoutePreview]);

  // Bottom Sheet Slide-in/out controller
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setDragOffsetY(0);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
      loadSavedRoutes();
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsRendered(false);
        setDragOffsetY(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const loadSavedRoutes = async () => {
    setIsLoadingSaved(true);
    try {
      const routes = await aiRouteService.getSavedRoutes(profile?.id || profile?.user_id);
      setSavedRoutes(routes);
    } finally {
      setIsLoadingSaved(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    if (deltaY > 0) {
      setDragOffsetY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (dragOffsetY > 80) {
      onClose();
    } else {
      setDragOffsetY(0);
    }
    touchStartY.current = null;
  };

  if (!isRendered) return null;

  const handleSelectDistance = (d: number) => {
    setDistanceKm(d);
    updateRoutePreview(d, scenery, direction);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setDistanceKm(val);
    updateRoutePreview(val, scenery, direction);
  };

  const handleSelectScenery = (s: SceneryType) => {
    setScenery(s);
    updateRoutePreview(distanceKm, s, direction);
  };

  const handleSelectDirection = (d: LoopDirection) => {
    setDirection(d);
    updateRoutePreview(distanceKm, scenery, d);
  };

  const handleShuffle = () => {
    updateRoutePreview(distanceKm, scenery, direction);
  };

  const handleActivateRoute = async (route: GeneratedAiRoute) => {
    let persistedRoute = route;
    try {
      persistedRoute = await aiRouteService.saveRouteToDatabase(route);
    } catch (e) {
      console.warn('Notice saving route:', e);
    }
    const course = aiRouteService.convertAndActivateAsCourse(persistedRoute);
    if (onRouteActivated) {
      onRouteActivated(course);
    }
    onClose();
  };

  const handleDeleteSaved = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const deletedRoute = savedRoutes.find((r) => r.id === id);
    await aiRouteService.deleteRoute(id);
    courseService.deleteCourse(id);

    // If the deleted route is currently active on the running screen, clear it immediately
    const activeCourse = courseService.getActiveCourse();
    const engineActiveCourse = gpsEngine.getState().activeCourse;
    const isCurrentActive =
      activeCourse?.id === id ||
      engineActiveCourse?.id === id ||
      (deletedRoute && (
        activeCourse?.name === deletedRoute.name ||
        engineActiveCourse?.name === deletedRoute.name ||
        (activeCourse?.totalDistanceMeters === deletedRoute.target_distance_meters &&
          Math.abs((activeCourse?.points[0]?.latitude || 0) - deletedRoute.start_lat) < 0.001)
      ));

    if (isCurrentActive) {
      courseService.setActiveCourse(null);
      gpsEngine.setActiveCourse(null);
      if (onRouteActivated) {
        onRouteActivated(null as any);
      }
    }

    setSavedRoutes((prev) => prev.filter((r) => r.id !== id));
    if (currentRoute?.id === id) {
      updateRoutePreview();
    }
  };

  const DISTANCE_PRESETS = [3.0, 5.0, 8.0, 10.0, 15.0, 21.1];

  const SCENERY_OPTIONS: Array<{
    type: SceneryType;
    label: string;
    icon: React.ReactNode;
    desc: string;
  }> = [
    {
      type: 'park',
      label: 'Parklands',
      icon: <Trees size={16} className="text-emerald-500" />,
      desc: 'Tree-lined paths & gentle curves',
    },
    {
      type: 'flat',
      label: 'Flat & Fast',
      icon: <Zap size={16} className="text-amber-500" />,
      desc: 'Minimal elevation, straight rhythm',
    },
    {
      type: 'waterfront',
      label: 'Waterfront',
      icon: <Waves size={16} className="text-cyan-500" />,
      desc: 'Shoreline promenade & open views',
    },
    {
      type: 'urban',
      label: 'City Blocks',
      icon: <Building2 size={16} className="text-slate-400" />,
      desc: 'Downtown sidewalks & wide crossings',
    },
    {
      type: 'trail',
      label: 'Woodland Trail',
      icon: <Mountain size={16} className="text-emerald-600" />,
      desc: 'Rolling trail inclines & switchbacks',
    },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-end justify-center overflow-hidden animate-fade-in select-none">
      {/* Dark Blur Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-sm transition-opacity duration-300 ease-out cursor-pointer ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Bottom Sheet Container */}
      <div
        style={{
          transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
          transition: dragOffsetY > 0 ? 'none' : 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        className={`relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 border-t border-x border-emerald-100 dark:border-slate-800 rounded-t-[32px] shadow-[0_-12px_40px_rgba(0,0,0,0.35)] dark:shadow-[0_-12px_40px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[92dvh] will-change-transform ${
          isAnimating && dragOffsetY === 0 ? 'translate-y-0' : 'translate-y-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Handle / Grab Bar */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="flex flex-col items-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none select-none shrink-0"
        >
          <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600 transition-colors" />
        </div>

        {/* Header */}
        <div className="px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Route size={18} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                Loop Route Generator
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Live circular route from your current location
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-5 pt-2.5 pb-1 gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'create'
                ? 'bg-emerald-500 text-white dark:text-slate-950 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Create Loop
          </button>
          <button
            onClick={() => setActiveTab('saved')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'saved'
                ? 'bg-emerald-500 text-white dark:text-slate-950 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Saved Loops</span>
            <span className="px-1.5 py-0.2 bg-black/10 dark:bg-black/30 rounded-full text-[10px]">
              {savedRoutes.length}
            </span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 overscroll-contain">
          {activeTab === 'create' && (
            <div className="space-y-3.5">
              {/* Live Map Preview Section with Current Location & Orange Loop */}
              <div className="relative rounded-2xl overflow-hidden shadow-sm border border-slate-200 dark:border-slate-800">
                <AiRoutePreviewMap
                  points={currentRoute?.points || []}
                  turnCues={currentRoute?.turn_cues || []}
                  userLat={resolvedLat || currentLat}
                  userLng={resolvedLng || currentLng}
                  height="235px"
                />
              </div>

              {/* Metrics & Reroll HUD */}
              {currentRoute && (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block">Distance</span>
                      <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                        {(currentRoute.target_distance_meters / 1000).toFixed(2)} km
                      </span>
                    </div>
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block">Elevation</span>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                        +{currentRoute.elevation_gain_meters}m
                      </span>
                    </div>
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase block">Est. Time</span>
                      <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                        {formatDuration(currentRoute.estimated_duration_seconds)}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleShuffle}
                    className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-emerald-500 active:scale-95 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                    title="Generate alternative loop around your location"
                  >
                    <RotateCcw size={13} />
                    <span>Shuffle</span>
                  </button>
                </div>
              )}

              {/* Real-time Location Indicator */}
              <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs">
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <MapPin size={13} className={isLocating ? 'animate-bounce text-amber-500' : 'text-emerald-500'} />
                  <span className="font-semibold text-[11px]">
                    {isLocating
                      ? 'Detecting real-time GPS location...'
                      : locationSource === 'gps'
                      ? 'Loop starts & finishes at your live GPS location'
                      : 'Starting location ready'}
                  </span>
                </div>
                {isLocating && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                )}
              </div>

              {/* Distance Selector */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Target Distance
                  </label>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {distanceKm.toFixed(1)} km
                  </span>
                </div>

                <div className="grid grid-cols-6 gap-1.5">
                  {DISTANCE_PRESETS.map((d) => (
                    <button
                      key={d}
                      onClick={() => handleSelectDistance(d)}
                      className={`py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        distanceKm === d
                          ? 'bg-emerald-500 text-white dark:text-slate-950 shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {d === 21.1 ? '21K' : `${d}K`}
                    </button>
                  ))}
                </div>

                <input
                  type="range"
                  min={1.0}
                  max={25.0}
                  step={0.5}
                  value={distanceKm}
                  onChange={handleSliderChange}
                  className="w-full accent-emerald-500 cursor-pointer mt-1"
                />
              </div>

              {/* Scenery & Terrain Profiles */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Route Terrain
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SCENERY_OPTIONS.map((opt) => (
                    <div
                      key={opt.type}
                      onClick={() => handleSelectScenery(opt.type)}
                      className={`p-2.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                        scenery === opt.type
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-500 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shrink-0">
                        {opt.icon}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">
                          {opt.label}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight block">
                          {opt.desc}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Direction Heading */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Loop Heading Direction
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {(['any', 'north', 'east', 'south', 'west'] as LoopDirection[]).map(
                    (dir) => (
                      <button
                        key={dir}
                        onClick={() => handleSelectDirection(dir)}
                        className={`py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                          direction === dir
                            ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {dir}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Turn Guidance Accordion */}
              {currentRoute && currentRoute.turn_cues && currentRoute.turn_cues.length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60 overflow-hidden">
                  <button
                    onClick={() => setShowTurnList(!showTurnList)}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <Route size={14} className="text-emerald-500" />
                      <span>Turn-by-Turn Waypoints ({currentRoute.turn_cues.length})</span>
                    </span>
                    <ChevronRight
                      size={16}
                      className={`transition-transform ${showTurnList ? 'rotate-90' : ''}`}
                    />
                  </button>

                  {showTurnList && (
                    <div className="px-3.5 pb-3 flex flex-col gap-2 border-t border-slate-200 dark:border-slate-700/40 pt-2 max-h-36 overflow-y-auto">
                      {currentRoute.turn_cues.map((cue, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-300"
                        >
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                            {(cue.distanceMeters / 1000).toFixed(1)} km:
                          </span>
                          <span>{cue.instruction}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Pinned Bottom CTA Action Button */}
              <div className="pt-2 sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
                <button
                  onClick={() => currentRoute && handleActivateRoute(currentRoute)}
                  disabled={!currentRoute}
                  className="w-full py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white dark:text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-98 transition-all cursor-pointer"
                >
                  <Navigation size={16} />
                  <span>Navigate This Loop ({distanceKm.toFixed(1)}K)</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'saved' && (
            <div className="space-y-2.5">
              {isLoadingSaved ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <div className="w-7 h-7 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs">Loading saved routes...</span>
                </div>
              ) : savedRoutes.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Route size={32} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    No saved loop routes yet.
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Generate a course in the "Create Loop" tab to save it here.
                  </p>
                </div>
              ) : (
                savedRoutes.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => {
                      setCurrentRoute(r);
                      setDistanceKm(r.target_distance_meters / 1000);
                      setScenery(r.scenery_type);
                      setDirection(r.direction);
                      setActiveTab('create');
                    }}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/60 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 flex items-center justify-center text-emerald-500">
                        <Route size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">
                          {r.name}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                          <span>{(r.target_distance_meters / 1000).toFixed(1)} km</span>
                          <span>•</span>
                          <span>+{r.elevation_gain_meters}m elev</span>
                          <span>•</span>
                          <span className="capitalize">{r.scenery_type}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => handleDeleteSaved(r.id, e)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        title="Delete Route"
                      >
                        <Trash2 size={15} />
                      </button>
                      <ChevronRight size={16} className="text-slate-400" />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
