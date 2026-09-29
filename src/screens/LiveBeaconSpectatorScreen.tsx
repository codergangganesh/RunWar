import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { beaconService, LiveBeacon } from '../services/beaconService';
import { formatDistance, formatDuration, formatPaceRaw, formatSpeed } from '../utils/formatters';
import {
  Heart,
  LocateFixed,
  Radio,
  Share2,
  Check,
  ChevronLeft,
  RefreshCw,
  Clock,
} from 'lucide-react';

// Custom pulsing runner marker for spectator map
const createSpectatorRunnerIcon = () => {
  return L.divIcon({
    className: 'spectator-runner-marker',
    html: `
      <div class="relative flex items-center justify-center w-8 h-8">
        <div class="absolute w-8 h-8 rounded-full bg-emerald-400 opacity-75 animate-ping"></div>
        <div class="relative w-5 h-5 rounded-full bg-emerald-500 border-2 border-white shadow-xl flex items-center justify-center text-[10px] text-white font-black">
          🏃
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

const createStartPinIcon = () => {
  return L.divIcon({
    className: 'spectator-start-marker',
    html: `<div class="w-6 h-6 rounded-full bg-emerald-600 border-2 border-white flex items-center justify-center text-white text-[10px] font-black shadow-lg">S</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

function AutoFollowController({
  center,
  followUser,
  onUserPan,
}: {
  center: [number, number];
  followUser: boolean;
  onUserPan: () => void;
}) {
  const map = useMap();
  const isAutoMoveRef = useRef(false);

  useEffect(() => {
    if (!followUser) return;
    isAutoMoveRef.current = true;
    map.flyTo(center, Math.max(map.getZoom(), 16), { duration: 1.2 });
    const timer = setTimeout(() => {
      isAutoMoveRef.current = false;
    }, 1300);
    return () => clearTimeout(timer);
  }, [center, followUser, map]);

  useEffect(() => {
    const handleDrag = () => {
      if (!isAutoMoveRef.current) {
        onUserPan();
      }
    };
    map.on('dragstart', handleDrag);
    return () => {
      map.off('dragstart', handleDrag);
    };
  }, [map, onUserPan]);

  return null;
}

interface LiveBeaconSpectatorScreenProps {
  beaconCode: string;
  onBackToApp?: () => void;
}

export const LiveBeaconSpectatorScreen: React.FC<LiveBeaconSpectatorScreenProps> = ({
  beaconCode,
  onBackToApp,
}) => {
  const [beacon, setBeacon] = useState<LiveBeacon | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [followRunner, setFollowRunner] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [isCheering, setIsCheering] = useState(false);
  const [hasCheered, setHasCheered] = useState<boolean>(() => {
    try {
      return localStorage.getItem(`runwar_spectator_cheered_${beaconCode}`) === 'true';
    } catch {
      return false;
    }
  });
  const [localCheers, setLocalCheers] = useState(0);
  const [isTimeExceeded, setIsTimeExceeded] = useState(false);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchBeaconData = useCallback(async () => {
    try {
      const data = await beaconService.getBeaconByCode(beaconCode);
      if (data) {
        // Server-enforced Expiration Check
        const isExpired = Boolean(
          data.is_expired ||
          (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) ||
          (data.status === 'completed' && Boolean(data.expires_at))
        );

        if (isExpired) {
          setIsTimeExceeded(true);
          setBeacon((prev) => (prev ? { ...prev, status: 'completed', route_coordinates: [] } : data));
          if (pollTimerRef.current) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
          }
          return;
        }

        setBeacon(data);
        setLocalCheers((prev) => Math.max(prev, data.cheers_count || 0));
        setErrorMessage(null);
      } else {
        if (!beacon) {
          setErrorMessage('Live Run Beacon session not found or has expired.');
        }
      }
    } catch {
      if (!beacon) {
        setErrorMessage('Unable to connect to live stream. Checking connection...');
      }
    } finally {
      setIsLoading(false);
    }
  }, [beaconCode, beacon]);

  useEffect(() => {
    fetchBeaconData();
    // Poll updates every 4 seconds for real-time tracking
    pollTimerRef.current = setInterval(fetchBeaconData, 4000);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchBeaconData]);

  const handleSendCheer = async () => {
    if (isTimeExceeded) return;
    setIsCheering(true);
    setHasCheered(true);
    setLocalCheers((prev) => prev + 1);

    try {
      localStorage.setItem(`runwar_spectator_cheered_${beaconCode}`, 'true');
    } catch {}

    try {
      const updated = await beaconService.sendCheer(beaconCode);
      if (updated > 0) {
        setLocalCheers((prev) => Math.max(prev, updated));
      }
    } catch {
      // Ignored
    }

    setTimeout(() => setIsCheering(false), 500);
  };

  const handleCopyLink = () => {
    const url = beaconService.getShareableUrl(beaconCode);
    navigator.clipboard?.writeText(url).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2200);
    });
  };

  // Center coordinates fallback
  const runnerCoords: [number, number] = [
    beacon?.current_lat || 37.7749,
    beacon?.current_lng || -122.4194,
  ];

  const polylineCoords: [number, number][] = (isTimeExceeded ? [] : (beacon?.route_coordinates || [])).map((pt) => [
    pt.latitude,
    pt.longitude,
  ]);

  const startCoord: [number, number] | null =
    polylineCoords.length > 0 ? polylineCoords[0] : null;

  // Speed in km/h derived from current distance and elapsed time
  const speedKmh =
    beacon && beacon.elapsed_seconds > 0
      ? (beacon.total_distance_meters / 1000) / (beacon.elapsed_seconds / 3600)
      : 0;

  return (
    <div className="h-[100dvh] w-full bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none font-sans relative">
      {/* Top Header Card */}
      <header className="shrink-0 z-30 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800 px-4 py-2.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          {onBackToApp && (
            <button
              onClick={onBackToApp}
              className="p-1.5 -ml-1 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Return to App"
            >
              <ChevronLeft size={20} />
            </button>
          )}

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-lime-400 flex items-center justify-center text-slate-950 font-black shadow-md">
              <Radio size={18} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black tracking-wider text-emerald-400 uppercase">
                  Live Run Beacon
                </span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <h1 className="text-sm font-bold text-white truncate max-w-[180px] sm:max-w-[240px]">
                {beacon?.runner_name || 'Runner Spectator Hub'}
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Share Link Button */}
          <button
            onClick={handleCopyLink}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
            title="Share Spectator Link"
          >
            {isCopied ? <Check size={15} className="text-emerald-400" /> : <Share2 size={15} />}
            <span className="hidden sm:inline">{isCopied ? 'Copied' : 'Share'}</span>
          </button>
        </div>
      </header>


      {/* Interactive Map Section */}
      <div className="flex-1 w-full h-full relative">
        {isLoading ? (
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-3 z-20">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium text-slate-400">Connecting to runner's live GPS beacon...</p>
          </div>
        ) : errorMessage ? (
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="w-14 h-14 rounded-2xl bg-rose-950/60 border border-rose-800/80 flex items-center justify-center text-rose-400 mb-3">
              <Radio size={28} />
            </div>
            <h2 className="text-lg font-bold text-white mb-1">Beacon Not Found</h2>
            <p className="text-xs text-slate-400 max-w-sm mb-4">{errorMessage}</p>
            <button
              onClick={fetchBeaconData}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-transform active:scale-95"
            >
              <RefreshCw size={14} /> Retry Connection
            </button>
          </div>
        ) : (
          <MapContainer
            center={runnerCoords}
            zoom={16}
            className="w-full h-full"
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <AutoFollowController
              center={runnerCoords}
              followUser={followRunner}
              onUserPan={() => setFollowRunner(false)}
            />

            {/* Breadcrumb Route Polyline */}
            {polylineCoords.length > 1 && (
              <Polyline
                positions={polylineCoords}
                pathOptions={{
                  color: '#10b981',
                  weight: 5,
                  opacity: 0.85,
                  lineJoin: 'round',
                  lineCap: 'round',
                }}
              />
            )}

            {/* Start Pin */}
            {startCoord && (
              <Marker position={startCoord} icon={createStartPinIcon()} />
            )}

            {/* Active Moving Runner Pin */}
            {beacon?.current_lat && beacon?.current_lng && (
              <Marker
                position={[beacon.current_lat, beacon.current_lng]}
                icon={createSpectatorRunnerIcon()}
              />
            )}
          </MapContainer>
        )}

        {/* Map Floating Controls */}
        <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
          <button
            onClick={() => setFollowRunner(true)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg border transition-all ${
              followRunner
                ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
            title="Auto Follow Runner"
          >
            <LocateFixed size={20} className={followRunner ? 'animate-pulse' : ''} />
          </button>
        </div>

        {/* Floating Status Pill */}
        <div className="absolute top-3 left-3 z-[1000]">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700 shadow-md">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                beacon?.status === 'active'
                  ? 'bg-emerald-400 animate-pulse'
                  : beacon?.status === 'paused'
                  ? 'bg-amber-400'
                  : 'bg-emerald-500'
              }`}
            />
            <span className="text-[11px] font-bold text-slate-200 capitalize">
              {beacon?.status || 'Live'}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Live Metrics & Cheer HUD */}
      <footer className="shrink-0 z-30 bg-slate-900/95 backdrop-blur-2xl border-t border-slate-800 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="max-w-md mx-auto flex flex-col gap-2.5">
          {/* Key Running Metrics Grid (Distance, Pace, Time, Speed) */}
          <div className="grid grid-cols-4 gap-2 text-center">
            {/* Distance */}
            <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                Distance
              </span>
              <span className="text-base sm:text-lg font-black text-white tracking-tight">
                {formatDistance(beacon?.total_distance_meters || 0, 'km')}
              </span>
              <span className="text-[9px] text-slate-400 block -mt-0.5">km</span>
            </div>

            {/* Current Pace */}
            <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                Pace
              </span>
              <span className="text-base sm:text-lg font-black text-emerald-400 tracking-tight font-mono">
                {formatPaceRaw(beacon?.current_pace || 0, 'min_km')}
              </span>
              <span className="text-[9px] text-slate-400 block -mt-0.5">/km</span>
            </div>

            {/* Time */}
            <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                Time
              </span>
              <span className="text-base sm:text-lg font-black text-white tracking-tight font-mono">
                {formatDuration(beacon?.elapsed_seconds || 0)}
              </span>
              <span className="text-[9px] text-slate-400 block -mt-0.5">elapsed</span>
            </div>

            {/* Speed */}
            <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/60">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                Speed
              </span>
              <span className="text-base sm:text-lg font-black text-slate-200 tracking-tight font-mono">
                {formatSpeed(speedKmh, 'km')}
              </span>
              <span className="text-[9px] text-slate-400 block -mt-0.5">km/h</span>
            </div>
          </div>

          {/* Cheer / Action Bar - Minimal & Athletic */}
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span
                className={`w-2 h-2 rounded-full ${
                  beacon?.status === 'active'
                    ? 'bg-emerald-400 animate-pulse'
                    : beacon?.status === 'paused'
                    ? 'bg-amber-400'
                    : 'bg-emerald-500'
                }`}
              />
              <span className="font-semibold text-slate-300 capitalize text-xs">
                {beacon?.status || 'Active'}
              </span>
            </div>

            <button
              onClick={handleSendCheer}
              disabled={isTimeExceeded}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-40 ${
                hasCheered
                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/40 shadow-sm'
                  : 'bg-slate-800/90 hover:bg-slate-800 text-slate-300 border border-slate-700/70'
              }`}
              title={hasCheered ? 'You cheered this run!' : 'Send a cheer to the runner'}
            >
              <Heart
                size={14}
                className={
                  hasCheered
                    ? `fill-rose-500 text-rose-500 transition-transform ${isCheering ? 'scale-125' : 'scale-100'}`
                    : `text-rose-400 fill-rose-500/20 transition-transform ${isCheering ? 'scale-125' : 'scale-100'}`
                }
              />
              <span>{hasCheered ? 'Cheered' : 'Cheer'}</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
                  hasCheered
                    ? 'bg-rose-950/70 text-rose-300 border border-rose-500/30'
                    : 'bg-slate-900/80 text-slate-300'
                }`}
              >
                {localCheers}
              </span>
            </button>
          </div>
        </div>
      </footer>

      {/* Sharing Time Exceeded Modal Overlay */}
      {isTimeExceeded && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg">
              <Clock size={32} />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-black text-white uppercase tracking-wider">
                Sharing Time Exceeded
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                The runner's shared live location is no longer available because the sharing period has expired.
              </p>
              <p className="text-[11px] text-slate-500">
                For security and privacy, live GPS coordinates, active route traces, and live metrics have been locked.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  if (onBackToApp) {
                    onBackToApp();
                  } else {
                    window.location.href = '/';
                  }
                }}
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider transition-all active:scale-95 cursor-pointer shadow-lg shadow-emerald-500/20"
              >
                Go to RunWar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
