import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { LocateFixed } from 'lucide-react';
import { CoursePoint } from '../../types';
import { TurnCue } from '../../services/aiRouteService';

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
    html: `<div class="px-2 py-0.5 rounded-full bg-orange-600 border border-white text-white text-[9px] font-black shadow-lg flex items-center gap-0.5 whitespace-nowrap"><span>🏁</span><span>START/FINISH</span></div>`,
    iconSize: [84, 22],
    iconAnchor: [42, 22],
  });

const createWaypointIcon = (number: number) =>
  L.divIcon({
    className: 'ai-route-wp-pin',
    html: `<div class="w-5 h-5 rounded-full bg-indigo-600 border-2 border-white text-white text-[9px] font-black flex items-center justify-center shadow-md">${number}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });

interface MapControllerProps {
  center: [number, number];
  boundsPoints: [number, number][];
  recenterTrigger: number;
}

function MapController({ center, boundsPoints, recenterTrigger }: MapControllerProps) {
  const map = useMap();
  const isFirstRender = useRef(true);

  // Invalidate map size on initial mount and when drawer animation finishes
  useEffect(() => {
    const timer1 = setTimeout(() => map.invalidateSize(), 100);
    const timer2 = setTimeout(() => map.invalidateSize(), 400);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [map]);

  // Fit bounds whenever the route points change or on recenter trigger
  useEffect(() => {
    if (boundsPoints.length >= 2) {
      try {
        const bounds = L.latLngBounds(boundsPoints);
        map.fitBounds(bounds, {
          padding: [35, 35],
          maxZoom: 16,
          animate: !isFirstRender.current,
        });
        isFirstRender.current = false;
      } catch {}
    } else if (center[0] !== 0 && center[1] !== 0) {
      map.setView(center, Math.max(map.getZoom() || 15, 15), { animate: !isFirstRender.current });
      isFirstRender.current = false;
    }
  }, [boundsPoints, center, map, recenterTrigger]);

  return null;
}

export interface AiRoutePreviewMapProps {
  points?: CoursePoint[];
  turnCues?: TurnCue[];
  userLat?: number | null;
  userLng?: number | null;
  height?: string;
  className?: string;
}

export const AiRoutePreviewMap: React.FC<AiRoutePreviewMapProps> = ({
  points = [],
  turnCues = [],
  userLat,
  userLng,
  height = '240px',
  className = '',
}) => {
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  const latLngs: [number, number][] = useMemo(
    () => points.map((p) => [p.latitude, p.longitude]),
    [points]
  );

  // User location coordinate fallback to start of route or default city
  const userCoord: [number, number] | null = useMemo(() => {
    if (userLat && userLng) return [userLat, userLng];
    return null;
  }, [userLat, userLng]);

  const defaultCenter: [number, number] = useMemo(() => {
    if (userCoord) return userCoord;
    if (latLngs.length > 0) return latLngs[0];
    return [37.7749, -122.4194];
  }, [userCoord, latLngs]);

  // Combined bounds points including the user location and the loop
  const allBoundsPoints: [number, number][] = useMemo(() => {
    const list = [...latLngs];
    if (userCoord) list.push(userCoord);
    return list;
  }, [latLngs, userCoord]);

  // Map waypoint cues to coordinates
  const waypointMarkers = useMemo(() => {
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
  }, [points, turnCues]);

  const handleRecenter = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecenterTrigger((prev) => prev + 1);
  };

  return (
    <div
      style={{ height }}
      className={`w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 relative shadow-inner select-none bg-slate-900 ${className}`}
    >
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

        {/* Closed Loop Route Polyline (Vibrant Orange Track matching Active Running screen) */}
        {latLngs.length > 1 && (
          <>
            {/* Orange soft glow underlay */}
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
            {/* High-visibility orange circuit line */}
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

        {/* Start / Finish Origin Pin */}
        {latLngs.length > 0 && (
          <Marker position={latLngs[0]} icon={createStartFinishIcon()} />
        )}

        {/* Real-time User Current Location Marker */}
        {userCoord && (
          <Marker position={userCoord} icon={createRunnerIcon()} />
        )}

        {/* Turn Cue Waypoints */}
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
      </MapContainer>

      {/* Floating Recenter Button */}
      <button
        onClick={handleRecenter}
        className="absolute bottom-2.5 right-2.5 z-[400] p-2 rounded-xl bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 shadow-md backdrop-blur-md border border-slate-200 dark:border-slate-800 hover:text-emerald-500 active:scale-95 transition-all cursor-pointer"
        title="Recenter Map"
        aria-label="Recenter Map"
      >
        <LocateFixed size={16} />
      </button>

      {/* Floating Origin Pill */}
      <div className="absolute top-2.5 left-2.5 z-[400] px-2.5 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-slate-800 text-white text-[10px] font-black flex items-center gap-1.5 shadow-md pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="tracking-wide">ORIGIN: YOUR LOCATION</span>
      </div>
    </div>
  );
};
