import React from 'react';
import { WeatherSnapshot, DistanceUnit } from '../../types';
import { weatherService } from '../../services/weatherService';
import {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudSnow,
  Wind,
  Droplets,
  RefreshCw,
} from 'lucide-react';

interface WeatherBadgeProps {
  weather?: WeatherSnapshot | null;
  distanceUnit?: DistanceUnit;
  variant?: 'pill' | 'compact' | 'card' | 'embedded';
  className?: string;
  isRealtime?: boolean;
  isRefreshing?: boolean;
  onRefresh?: () => void | Promise<void>;
}

export const WeatherBadge: React.FC<WeatherBadgeProps> = ({
  weather,
  distanceUnit = 'km',
  variant = 'pill',
  className = '',
  isRealtime = true,
  isRefreshing = false,
  onRefresh,
}) => {
  if (!weather) {
    if (variant === 'embedded' || variant === 'card') {
      return (
        <div className={`rounded-2xl bg-emerald-50/40 dark:bg-slate-950/40 border border-emerald-100 dark:border-slate-800/80 p-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 select-none ${className}`}>
          <div className="flex items-center gap-2">
            <RefreshCw size={14} className="animate-spin text-emerald-500 shrink-0" />
            <span className="font-medium">Fetching real-time weather data...</span>
          </div>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Retry
            </button>
          )}
        </div>
      );
    }
    return null;
  }

  const renderIcon = (size: number = 14) => {
    switch (weather.icon) {
      case 'sun':
        return <Sun size={size} className="text-amber-500 animate-spin-slow shrink-0" />;
      case 'cloud-sun':
        return <CloudSun size={size} className="text-amber-400 shrink-0" />;
      case 'cloud':
        return <Cloud size={size} className="text-slate-400 shrink-0" />;
      case 'cloud-rain':
        return <CloudRain size={size} className="text-sky-500 shrink-0" />;
      case 'cloud-lightning':
        return <CloudLightning size={size} className="text-purple-400 shrink-0" />;
      case 'cloud-snow':
        return <CloudSnow size={size} className="text-cyan-300 shrink-0" />;
      default:
        return <Sun size={size} className="text-amber-500 shrink-0" />;
    }
  };

  const tempFormatted = weatherService.formatTemp(weather.temperature, distanceUnit);
  const feelsLikeFormatted = weatherService.formatTemp(
    weather.apparentTemperature ?? weather.temperature,
    distanceUnit
  );
  const windFormatted = weatherService.formatWind(weather.windSpeedKmh, distanceUnit);

  // Running comfort evaluation
  const getRunningComfortNotice = () => {
    const tempC = weather.temperature;
    if (weather.conditionText.toLowerCase().includes('rain')) {
      return { text: 'Wet road surface — watch cadence & traction', color: 'text-sky-600 dark:text-sky-400' };
    }
    if (weather.conditionText.toLowerCase().includes('snow')) {
      return { text: 'Freezing conditions — maintain steady footing', color: 'text-cyan-600 dark:text-cyan-400' };
    }
    if (tempC >= 12 && tempC <= 21 && weather.humidity < 70) {
      return { text: 'Optimal running weather for performance', color: 'text-emerald-600 dark:text-emerald-400' };
    }
    if (tempC > 27) {
      return { text: 'Warm conditions — increase hydration intake', color: 'text-amber-600 dark:text-amber-400' };
    }
    if (tempC < 6) {
      return { text: 'Chilly air — keep your warm-up extended', color: 'text-blue-600 dark:text-blue-400' };
    }
    if (weather.windSpeedKmh > 25) {
      return { text: 'Breezy winds — pace yourself against headwinds', color: 'text-teal-600 dark:text-teal-400' };
    }
    return { text: 'Good aerobic training conditions', color: 'text-emerald-600 dark:text-emerald-400' };
  };

  if (variant === 'compact') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 text-[11px] font-bold text-slate-800 dark:text-slate-200 select-none ${className}`}
        title={`${weather.conditionText}, Humidity ${weather.humidity}%, Wind ${windFormatted}`}
      >
        {renderIcon(13)}
        <span className="font-mono">{tempFormatted}</span>
      </div>
    );
  }

  if (variant === 'pill') {
    return (
      <div
        className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/95 dark:bg-slate-900/95 border border-emerald-200/90 dark:border-slate-800 shadow-sm text-xs font-medium text-slate-700 dark:text-slate-200 select-none ${className}`}
        title={`Weather: ${weather.conditionText}`}
      >
        <div className="flex items-center gap-1.5">
          {renderIcon(14)}
          <span className="font-bold text-slate-900 dark:text-white font-mono">{tempFormatted}</span>
        </div>
        <span className="text-slate-300 dark:text-slate-700">•</span>
        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 hidden sm:inline">
          {weather.conditionText}
        </span>
        <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-0.5">
            <Droplets size={11} className="text-sky-500" />
            <span>{weather.humidity}%</span>
          </span>
          <span className="flex items-center gap-0.5">
            <Wind size={11} className="text-teal-500" />
            <span>{windFormatted}</span>
          </span>
        </div>
      </div>
    );
  }

  // Full detailed card mode (used in Workout Summary & Workout Detail)
  const advice = getRunningComfortNotice();
  const isEmbedded = variant === 'embedded';

  return (
    <div
      className={
        isEmbedded
          ? `rounded-2xl bg-emerald-50/60 dark:bg-slate-950/60 border border-emerald-100/90 dark:border-slate-800/80 p-3 sm:p-3.5 space-y-2.5 select-none ${className}`
          : `rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 p-3.5 sm:p-4 shadow-sm space-y-2.5 select-none ${className}`
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-100/70 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center justify-center shrink-0">
            {renderIcon(18)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {isRealtime ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Realtime Weather
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-500/20 px-1.5 py-0.5 rounded-md">
                  Workout Weather
                </span>
              )}
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                {isRealtime
                  ? weatherService.formatObservationTime(weather.timestamp)
                  : 'Recorded during session'}
              </span>
            </div>
            <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5 truncate">
              <span className="truncate">{weather.conditionText}</span>
              <span className="text-slate-300 dark:text-slate-700 shrink-0">•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-mono text-sm shrink-0">{tempFormatted}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <span className="text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 block">
              Feels Like
            </span>
            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
              {feelsLikeFormatted}
            </span>
          </div>

          {isRealtime && onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="p-1.5 rounded-xl bg-white/80 hover:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-slate-600 hover:text-emerald-600 dark:text-slate-300 dark:hover:text-emerald-400 shadow-2xs transition-all active:scale-95 disabled:opacity-50"
              title="Refresh Realtime Weather"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-emerald-500' : ''} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/80 text-[11px]">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <Droplets size={14} className="text-sky-500 shrink-0" />
          <span>Humidity: <strong className="text-slate-900 dark:text-white font-mono">{weather.humidity}%</strong></span>
        </div>
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <Wind size={14} className="text-teal-500 shrink-0" />
          <span>Wind: <strong className="text-slate-900 dark:text-white font-mono">{windFormatted}</strong></span>
        </div>
      </div>

      {advice && (
        <div className="text-[11px] font-semibold bg-white/70 dark:bg-slate-900/60 rounded-xl px-2.5 py-1.5 border border-emerald-100/80 dark:border-slate-800/80 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className={advice.color}>{advice.text}</span>
        </div>
      )}
    </div>
  );
};
