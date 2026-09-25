import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Circle, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { CourseNavProgress, CourseRoute, GPSCoordinate } from '../../types';
import { Compass, Layers, LocateFixed, Navigation } from 'lucide-react';
import { calculateSplits, getRouteDistanceMilestones } from '../../utils/calculations';
import { formatDistance, formatDuration, formatPace } from '../../utils/formatters';

// Custom runner icon
const createRunnerIcon = () => {
  return L.divIcon({
    className: 'user-location-marker',
    html: `<div class="user-marker-pulse"></div><div class="user-marker-dot"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const createStartPinIcon = () => {
  return L.divIcon({
    className: 'start-pin-marker',
    html: `<div class="w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white text-[10px] font-bold shadow-lg">S</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

const createCourseStartPinIcon = () => {
  return L.divIcon({
    className: 'course-start-pin-marker',
    html: `<div class="px-1.5 py-0.5 rounded-full bg-cyan-600 border border-white text-white text-[9px] font-black shadow-lg flex items-center gap-0.5 whitespace-nowrap"><span>🚩</span><span>START</span></div>`,
    iconSize: [50, 20],
    iconAnchor: [25, 20],
  });
};

const createCourseFinishPinIcon = () => {
  return L.divIcon({
    className: 'course-finish-pin-marker',
    html: `<div class="px-1.5 py-0.5 rounded-full bg-purple-600 border border-white text-white text-[9px] font-black shadow-lg flex items-center gap-0.5 whitespace-nowrap"><span>🏁</span><span>FINISH</span></div>`,
    iconSize: [50, 20],
    iconAnchor: [25, 20],
  });
};

const createCourseWaypointIcon = (name: string) => {
  return L.divIcon({
    className: 'course-waypoint-marker',
    html: `<div class="px-1 py-0.5 rounded bg-cyan-700/90 border border-cyan-300 text-white text-[8px] font-bold shadow whitespace-nowrap max-w-[80px] truncate">${name}</div>`,
    iconSize: [40, 16],
    iconAnchor: [20, 16],
  });
};

const createKilometerMarkerIcon = (kilometer: number) => L.divIcon({
  className: 'distance-milestone-marker',
  html: `<div class="flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-white bg-emerald-700 px-1 text-[10px] font-black text-white shadow-lg">${kilometer}</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

interface MapControllerProps {
  center: [number, number];
  followUser: boolean;
  recenterTrigger: number;
  onUserPan: () => void;
}

function MapController({ center, followUser, recenterTrigger, onUserPan }: MapControllerProps) {
  const map = useMap();
  const isProgrammaticMoveRef = useRef(false);

  // Recenter trigger effect: smooth flyTo when user clicks recenter
  useEffect(() => {
    if (recenterTrigger > 0 && center[0] !== 0 && center[1] !== 0) {
      isProgrammaticMoveRef.current = true;
      map.flyTo(center, Math.max(map.getZoom() || 16, 16), {
        animate: true,
        duration: 0.6,
      });
      const timer = setTimeout(() => {
        isProgrammaticMoveRef.current = false;
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [recenterTrigger, center, map]);

  // Continuous tracking effect when followUser is active
  useEffect(() => {
    map.invalidateSize();
    if (followUser && center[0] !== 0 && center[1] !== 0) {
      if (!isProgrammaticMoveRef.current) {
        map.setView(center, map.getZoom() || 16, { animate: true });
      }
    }
  }, [center, followUser, map]);

  // Detect user dragging / scrolling the map to release auto-follow
  useEffect(() => {
    const handleUserInteraction = () => {
      if (!isProgrammaticMoveRef.current) {
        onUserPan();
      }
    };

    map.on('dragstart', handleUserInteraction);

    const container = map.getContainer();
    container.addEventListener('wheel', handleUserInteraction, { passive: true });

    return () => {
      map.off('dragstart', handleUserInteraction);
      container.removeEventListener('wheel', handleUserInteraction);
    };
  }, [map, onUserPan]);

  // ResizeObserver on the container to dynamically re-adjust whenever size changes
  useEffect(() => {
    const container = map.getContainer();
    if (!container) return;

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        map.invalidateSize();
      });
    });
    ro.observe(container);

    // Listen for CSS transitions completing (e.g. split/map view toggle)
    const handleTransitionEnd = () => {
      requestAnimationFrame(() => {
        map.invalidateSize();
      });
    };
    container.addEventListener('transitionend', handleTransitionEnd);

    const t1 = setTimeout(() => map.invalidateSize(), 50);
    const t2 = setTimeout(() => map.invalidateSize(), 200);
    const t3 = setTimeout(() => map.invalidateSize(), 600);

    return () => {
      ro.disconnect();
      container.removeEventListener('transitionend', handleTransitionEnd);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [map]);

  return null;
}

interface LiveWorkoutMapProps {
  coordinates: GPSCoordinate[];
  currentLocation?: GPSCoordinate | null;
  isTracking: boolean;
  gpsAccuracy?: number | null;
  className?: string;
  course?: CourseRoute | null;
  courseProgress?: CourseNavProgress | null;
  distanceUnit?: 'km' | 'mi';
  children?: React.ReactNode;
}

export const LiveWorkoutMap: React.FC<LiveWorkoutMapProps> = ({
  coordinates,
  currentLocation,
  isTracking,
  gpsAccuracy,
  className = 'h-full w-full',
  course,
  courseProgress,
  distanceUnit = 'km',
  children,
}) => {
  const [followUser, setFollowUser] = useState(true);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [mapStyle, setMapStyle] = useState<'outdoor' | 'dark' | 'satellite'>('outdoor');
  const activeCoord = currentLocation || (coordinates.length > 0 ? coordinates[coordinates.length - 1] : null);
  const startCoord = coordinates.length > 0 ? coordinates[0] : null;
  const currentCenter: [number, number] | null = activeCoord
    ? [activeCoord.latitude, activeCoord.longitude]
    : null;

  const handleUserPan = useCallback(() => {
    setFollowUser(false);
  }, []);

  const handleRecenter = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setFollowUser(true);
    setRecenterTrigger((prev) => prev + 1);
  }, []);

  const polylinePositions: [number, number][] = coordinates.map((c) => [c.latitude, c.longitude]);
  const kilometerMilestones = useMemo(
    () => getRouteDistanceMilestones(coordinates),
    [coordinates]
  );
  const kilometerSplits = useMemo(() => calculateSplits(coordinates), [coordinates]);

  // Course Route polyline coordinates
  const coursePositions: [number, number][] = useMemo(() => {
    return course?.points && course.points.length > 0
      ? course.points.map((p) => [p.latitude, p.longitude] as [number, number])
      : [];
  }, [course]);

  const courseStartCoord = course?.points && course.points.length > 0 ? course.points[0] : null;
  const courseFinishCoord = course?.points && course.points.length > 1 ? course.points[course.points.length - 1] : null;


  // Open-source and public map layers with their correct provider attribution.
  const tileLayers = {
    outdoor: {
      url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors, tiles style by Humanitarian OpenStreetMap Team hosted by OpenStreetMap France',
      subdomains: 'abc',
      maxNativeZoom: 19,
    },
    dark: {
      url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
      subdomains: 'abc',
      maxNativeZoom: 19,
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri',
      subdomains: 'abc',
      maxNativeZoom: 19,
    },
  };
  const activeTileLayer = tileLayers[mapStyle];

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-emerald-50 dark:bg-slate-900 border border-emerald-200/80 dark:border-slate-800 ${mapStyle === 'dark' ? 'dark-map-tiles' : ''} ${className}`}>
      {currentCenter ? (
        <MapContainer
          center={currentCenter}
          zoom={16}
          scrollWheelZoom={true}
          zoomControl={false}
          className="h-full w-full z-0"
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution={activeTileLayer.attribution}
            url={activeTileLayer.url}
            subdomains={activeTileLayer.subdomains}
            maxNativeZoom={activeTileLayer.maxNativeZoom || 19}
            maxZoom={19}
          />

          <MapController
            center={currentCenter}
            followUser={followUser}
            recenterTrigger={recenterTrigger}
            onUserPan={handleUserPan}
          />

          {/* Planned Course Polyline Guide (High-contrast cyan & teal dashed) */}
          {coursePositions.length > 1 && (
            <>
              {/* Soft glow underlay */}
              <Polyline
                positions={coursePositions}
                pathOptions={{
                  color: '#06b6d4',
                  weight: 8,
                  opacity: 0.35,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
              {/* High-visibility dashed navigational track */}
              <Polyline
                positions={coursePositions}
                pathOptions={{
                  color: '#0891b2',
                  weight: 4,
                  dashArray: '6, 8',
                  opacity: 0.95,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            </>
          )}


          {/* Course Start & Finish Markers */}
          {courseStartCoord && (
            <Marker position={[courseStartCoord.latitude, courseStartCoord.longitude]} icon={createCourseStartPinIcon()} />
          )}
          {courseFinishCoord && (
            <Marker position={[courseFinishCoord.latitude, courseFinishCoord.longitude]} icon={createCourseFinishPinIcon()} />
          )}

          {/* Course Waypoints */}
          {course?.waypoints?.map((w, idx) => (
            <Marker key={idx} position={[w.latitude, w.longitude]} icon={createCourseWaypointIcon(w.name)}>
              <Popup closeButton={false}>
                <div className="text-center text-slate-800 text-xs font-bold">
                  {w.name}
                  {w.description && <p className="text-[10px] text-slate-500 font-normal">{w.description}</p>}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Runner Actual Workout Start Pin */}
          {startCoord && (
            <Marker position={[startCoord.latitude, startCoord.longitude]} icon={createStartPinIcon()} />
          )}

          {/* Active Runner Route Polyline (High visibility athletic green) */}
          {polylinePositions.length > 1 && (
            <>
              <Polyline
                positions={polylinePositions}
                pathOptions={{
                  color: '#10b981',
                  weight: 8,
                  opacity: 0.4,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
              <Polyline
                positions={polylinePositions}
                pathOptions={{
                  color: '#059669',
                  weight: 4,
                  opacity: 1.0,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
            </>
          )}

          {/* Completed-kilometre markers, placed at the interpolated route position. */}
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
                    <p className="text-[11px] text-slate-500">{split ? formatPace(split.pace) : 'Split pending'}</p>
                    {split?.speed_kmh != null && <p className="mt-1 text-[10px] font-semibold text-slate-400">{split.speed_kmh.toFixed(1)} km/h</p>}
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Accuracy Circle */}
          {activeCoord && gpsAccuracy && gpsAccuracy < 100 && (
            <Circle
              center={[activeCoord.latitude, activeCoord.longitude]}
              radius={gpsAccuracy}
              pathOptions={{
                fillColor: '#10b981',
                fillOpacity: 0.12,
                color: '#10b981',
                opacity: 0.3,
                weight: 1,
              }}
            />
          )}

          {/* Current Runner Marker */}
          {activeCoord && (
            <Marker
              position={[activeCoord.latitude, activeCoord.longitude]}
              icon={createRunnerIcon()}
              zIndexOffset={1000}
            />
          )}
        </MapContainer>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-emerald-50/95 px-6 text-center dark:bg-slate-900/95">
          <Compass size={24} className="animate-spin text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-bold text-emerald-900 dark:text-slate-200">Locating you…</p>
          <p className="text-xs text-emerald-800/70 dark:text-slate-400">The map will appear when an accurate GPS position is available.</p>
        </div>
      )}

      {/* Floating Active Course Indicator on Map */}
      {course && (
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-cyan-500/40 text-white shadow-lg animate-fade-in max-w-[220px] sm:max-w-xs">
          <div className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
            <Navigation size={13} className="text-cyan-400 animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black text-cyan-300 truncate">{course.name}</p>
            <p className="text-[10px] text-slate-300 font-medium">
              {courseProgress
                ? `${formatDistance(courseProgress.distanceRemainingMeters, distanceUnit)} left (${courseProgress.percentCompleted}%)`
                : `${formatDistance(course.totalDistanceMeters, distanceUnit)}`}
            </p>
          </div>
        </div>
      )}

      {/* Map floating controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
        {/* Map style toggle */}
        <button
          onClick={() => {
            const next = mapStyle === 'outdoor' ? 'dark' : mapStyle === 'dark' ? 'satellite' : 'outdoor';
            setMapStyle(next);
          }}
          className="p-2 sm:p-2.5 rounded-xl bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-md border border-slate-700/80 text-white hover:text-emerald-400 shadow-md active:scale-95 transition-all cursor-pointer"
          title="Toggle map style"
          aria-label="Toggle map style"
        >
          <Layers size={16} />
        </button>

        {/* Recenter Button - identical to History Details section */}
        <button
          onClick={handleRecenter}
          className="p-2 sm:p-2.5 rounded-xl bg-slate-900/90 dark:bg-slate-900/95 backdrop-blur-md border border-slate-700/80 text-white hover:text-emerald-400 shadow-md active:scale-95 transition-all cursor-pointer"
          title="Recenter Map"
          aria-label="Recenter Map"
        >
          <LocateFixed size={16} />
        </button>
      </div>

      {/* GPS Accuracy Status Tag */}
      {activeCoord && (
        <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 dark:bg-slate-900/85 backdrop-blur-md border border-emerald-200 dark:border-slate-700/60 text-[11px] font-bold text-emerald-950 dark:text-slate-300 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>GPS {gpsAccuracy ? `±${Math.round(gpsAccuracy)}m` : 'Active'}</span>
        </div>
      )}

      {/* Children (e.g. Floating overlay HUD in full map mode) */}
      {children}
    </div>
  );
};

