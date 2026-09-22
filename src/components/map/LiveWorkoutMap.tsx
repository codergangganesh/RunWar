import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { GPSCoordinate } from '../../types';
import { Compass, Eye, Layers, Navigation } from 'lucide-react';

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
  isTracking: boolean;
  gpsAccuracy?: number | null;
  className?: string;
  children?: React.ReactNode;
}

export const LiveWorkoutMap: React.FC<LiveWorkoutMapProps> = ({
  coordinates,
  isTracking,
  gpsAccuracy,
  className = 'h-full w-full',
  children,
}) => {
  const [followUser, setFollowUser] = useState(true);
  const [mapStyle, setMapStyle] = useState<'outdoor' | 'dark' | 'satellite'>('outdoor');
  const [mapReady, setMapReady] = useState(false);

  // Default to San Francisco if no coordinates yet
  const lastCoord = coordinates.length > 0 ? coordinates[coordinates.length - 1] : null;
  const startCoord = coordinates.length > 0 ? coordinates[0] : null;
  const currentCenter: [number, number] = lastCoord
    ? [lastCoord.latitude, lastCoord.longitude]
    : [37.7749, -122.4194];

  const polylinePositions: [number, number][] = coordinates.map((c) => [c.latitude, c.longitude]);

  // High-reliability athletic tile layers (100% free, zero watermark artifacts)
  const tileLayers = {
    outdoor: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    streets: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-emerald-50 dark:bg-slate-900 border border-emerald-200/80 dark:border-slate-800 ${className}`}>
      <MapContainer
        center={currentCenter}
        zoom={16}
        scrollWheelZoom={true}
        zoomControl={false}
        whenReady={() => setMapReady(true)}
        className="h-full w-full z-0"
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url={tileLayers[mapStyle]}
          subdomains="abcd"
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

        {/* Accuracy Circle */}
        {lastCoord && gpsAccuracy && gpsAccuracy < 100 && (
          <Circle
            center={[lastCoord.latitude, lastCoord.longitude]}
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
        {lastCoord && (
          <Marker
            position={[lastCoord.latitude, lastCoord.longitude]}
            icon={createRunnerIcon()}
            zIndexOffset={1000}
          />
        )}
      </MapContainer>

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
      {lastCoord && (
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
