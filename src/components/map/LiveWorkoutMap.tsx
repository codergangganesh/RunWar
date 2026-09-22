import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Circle, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { GPSCoordinate } from '../../types';
import { Compass, Layers, Navigation } from 'lucide-react';
import { calculateSplits, getRouteDistanceMilestones } from '../../utils/calculations';
import { formatDuration, formatPace } from '../../utils/formatters';

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

const createKilometerMarkerIcon = (kilometer: number) => L.divIcon({
  className: 'distance-milestone-marker',
  html: `<div class="flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-white bg-emerald-700 px-1 text-[10px] font-black text-white shadow-lg">${kilometer}</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

interface MapControllerProps {
  center: [number, number];
  followUser: boolean;
}

function MapController({ center, followUser }: MapControllerProps) {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    if (followUser && center[0] !== 0 && center[1] !== 0) {
      map.setView(center, map.getZoom() || 16, { animate: true });
    }
  }, [center, followUser, map]);

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
  children?: React.ReactNode;
}

export const LiveWorkoutMap: React.FC<LiveWorkoutMapProps> = ({
  coordinates,
  currentLocation,
  isTracking,
  gpsAccuracy,
  className = 'h-full w-full',
  children,
}) => {
  const [followUser, setFollowUser] = useState(true);
  const [mapStyle, setMapStyle] = useState<'outdoor' | 'dark' | 'satellite'>('outdoor');
  const activeCoord = currentLocation || (coordinates.length > 0 ? coordinates[coordinates.length - 1] : null);
  const startCoord = coordinates.length > 0 ? coordinates[0] : null;
  const currentCenter: [number, number] | null = activeCoord
    ? [activeCoord.latitude, activeCoord.longitude]
    : null;

  const polylinePositions: [number, number][] = coordinates.map((c) => [c.latitude, c.longitude]);
  const kilometerMilestones = useMemo(
    () => getRouteDistanceMilestones(coordinates),
    [coordinates]
  );
  const kilometerSplits = useMemo(() => calculateSplits(coordinates), [coordinates]);

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
      // This URL has no {s} token; Leaflet ignores the value for this provider.
      subdomains: 'abc',
      maxNativeZoom: 19,
    },
  };
  const activeTileLayer = tileLayers[mapStyle];

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-emerald-50 dark:bg-slate-900 border border-emerald-200/80 dark:border-slate-800 ${mapStyle === 'dark' ? 'dark-map-tiles' : ''} ${className}`}>
      {currentCenter ? <MapContainer
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

        <MapController center={currentCenter} followUser={followUser} />

        {/* Start Pin */}
        {startCoord && (
          <Marker position={[startCoord.latitude, startCoord.longitude]} icon={createStartPinIcon()} />
        )}

        {/* Route Polyline (High visibility athletic green) */}
        {polylinePositions.length > 1 && (
          <>
            {/* Shadow glow */}
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
            {/* Primary line */}
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
      </MapContainer> : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-emerald-50/95 px-6 text-center dark:bg-slate-900/95">
          <Compass size={24} className="animate-spin text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm font-bold text-emerald-900 dark:text-slate-200">Locating you…</p>
          <p className="text-xs text-emerald-800/70 dark:text-slate-400">The map will appear when an accurate GPS position is available.</p>
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
          className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/80 backdrop-blur-md border border-emerald-200 dark:border-slate-700/60 text-emerald-900 dark:text-slate-300 hover:text-emerald-950 dark:hover:text-white shadow-md active:scale-95 transition-all"
          title="Toggle map style"
        >
          <Layers size={18} />
        </button>

        {/* Recenter & Follow Toggle */}
        <button
          onClick={() => setFollowUser(!followUser)}
          className={`p-2.5 rounded-xl backdrop-blur-md border shadow-md active:scale-95 transition-all ${
            followUser
              ? 'bg-emerald-500 border-emerald-400 text-white shadow-sm'
              : 'bg-white/90 dark:bg-slate-900/80 border-emerald-200 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
          }`}
          title={followUser ? 'Follow runner: ON' : 'Follow runner: OFF'}
        >
          <Navigation size={18} className={followUser ? 'text-white' : ''} />
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
