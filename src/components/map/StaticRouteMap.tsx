import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { GPSCoordinate } from '../../types';

interface StaticRouteMapProps {
  coordinates: GPSCoordinate[];
  className?: string;
  interactive?: boolean;
}

const createPinIcon = (label: string, bg: string) => {
  return L.divIcon({
    className: 'custom-pin-marker',
    html: `<div class="w-6 h-6 rounded-full ${bg} border-2 border-white flex items-center justify-center text-white text-[10px] font-bold shadow-md">${label}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

function FitBounds({ coordinates }: { coordinates: GPSCoordinate[] }) {
  const map = useMap();

  useEffect(() => {
    if (coordinates.length > 0) {
      const bounds = L.latLngBounds(coordinates.map((c) => [c.latitude, c.longitude]));
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
    }
  }, [coordinates, map]);

  return null;
}

export const StaticRouteMap: React.FC<StaticRouteMapProps> = ({
  coordinates,
  className = 'h-52 w-full',
  interactive = false,
}) => {
  if (!coordinates || coordinates.length === 0) {
    return (
      <div className={`rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-center text-slate-500 text-xs ${className}`}>
        No GPS route recorded
      </div>
    );
  }

  const startCoord = coordinates[0];
  const endCoord = coordinates[coordinates.length - 1];
  const polylinePositions: [number, number][] = coordinates.map((c) => [c.latitude, c.longitude]);
  const center: [number, number] = [startCoord.latitude, startCoord.longitude];

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-slate-950 border border-slate-800/80 shadow-inner ${className}`}>
      <MapContainer
        center={center}
        zoom={15}
        scrollWheelZoom={interactive}
        dragging={interactive}
        touchZoom={interactive}
        doubleClickZoom={interactive}
        zoomControl={false}
        attributionControl={false}
        className="h-full w-full z-0"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        <FitBounds coordinates={coordinates} />

        {/* Outer glow */}
        <Polyline
          positions={polylinePositions}
          pathOptions={{
            color: '#10b981',
            weight: 6,
            opacity: 0.35,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />

        {/* Solid route line */}
        <Polyline
          positions={polylinePositions}
          pathOptions={{
            color: '#34d399',
            weight: 3.5,
            opacity: 1.0,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />

        {/* Start Pin */}
        <Marker position={[startCoord.latitude, startCoord.longitude]} icon={createPinIcon('S', 'bg-emerald-500')} />

        {/* Finish Pin */}
        {coordinates.length > 1 && (
          <Marker position={[endCoord.latitude, endCoord.longitude]} icon={createPinIcon('F', 'bg-rose-500')} />
        )}
      </MapContainer>
    </div>
  );
};
