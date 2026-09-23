import React, { useState, useRef, useEffect, useMemo } from 'react';
import { DistanceUnit, Workout } from '../../types';
import { formatDistance } from '../../utils/formatters';
import { MapPin, ChevronDown, Check } from 'lucide-react';

export type TimeframeOption = 'this_week' | 'last_week' | 'last_7_days' | 'this_month';

interface WeeklyBarChartProps {
  dayNames: string[];
  dailyDistanceMeters: number[];
  dailyRunCounts?: number[];
  distanceUnit?: DistanceUnit;
  workouts?: Workout[];
  className?: string;
}

const TIMEFRAMES: { id: TimeframeOption; label: string; title: string }[] = [
  { id: 'this_week', label: 'This Week', title: "This Week’s Activity" },
  { id: 'last_week', label: 'Last Week', title: "Last Week’s Activity" },
  { id: 'last_7_days', label: 'Last 7 Days', title: "Past 7 Days Activity" },
  { id: 'this_month', label: 'This Month', title: "This Month’s Activity" },
];

/**
 * Generates a smooth cubic Bezier spline with baseline clamping
 */
function generateSmoothSpline(
  points: { x: number; y: number; dist: number }[],
  bottomY: number,
  topY: number
): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

  let path = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 >= points.length ? points.length - 1 : i + 2];

    // Flat line along the baseline if both points have 0 distance
    if (p1.dist === 0 && p2.dist === 0) {
      path += ` L ${p2.x.toFixed(1)},${bottomY.toFixed(1)}`;
      continue;
    }

    let cp1x = p1.x + (p2.x - p0.x) / 5.2;
    let cp1y = p1.y + (p2.y - p0.y) / 5.2;

    let cp2x = p2.x - (p3.x - p1.x) / 5.2;
    let cp2y = p2.y - (p3.y - p1.y) / 5.2;

    // Clamp control points strictly so curve never dips below 0 or above top
    cp1y = Math.min(bottomY, Math.max(topY, cp1y));
    cp2y = Math.min(bottomY, Math.max(topY, cp2y));

    if (p1.dist === 0) cp1y = Math.min(cp1y, bottomY);
    if (p2.dist === 0) cp2y = Math.min(cp2y, bottomY);

    path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }

  return path;
}

export const WeeklyBarChart: React.FC<WeeklyBarChartProps> = ({
  dayNames: defaultDayNames,
  dailyDistanceMeters: defaultDailyDistance,
  dailyRunCounts: defaultDailyRunCounts = [0, 0, 0, 0, 0, 0, 0],
  distanceUnit = 'km',
  workouts = [],
  className = 'w-full',
}) => {
  const [selectedTimeframe, setSelectedTimeframe] = useState<TimeframeOption>('this_week');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Compute breakdown data dynamically based on the selected timeframe
  const computedData = useMemo(() => {
    const now = new Date();
    const standardDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    if (selectedTimeframe === 'this_week') {
      const dayOfWeek = (now.getDay() + 6) % 7; // 0=Mon, 6=Sun
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - dayOfWeek);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);

      const weekWorkouts = workouts.filter((w) => {
        const d = new Date(w.started_at);
        return d >= startOfWeek && d < endOfWeek;
      });

      const dists = [0, 0, 0, 0, 0, 0, 0];
      const counts = [0, 0, 0, 0, 0, 0, 0];

      weekWorkouts.forEach((w) => {
        const d = new Date(w.started_at);
        const idx = (d.getDay() + 6) % 7;
        dists[idx] += Number(w.distance_meters) || 0;
        counts[idx] += 1;
      });

      const finalDists = workouts.length > 0 ? dists : defaultDailyDistance;
      const finalCounts = workouts.length > 0 ? counts : defaultDailyRunCounts;

      return {
        title: "This Week’s Activity",
        dayNames: defaultDayNames.length === 7 ? defaultDayNames : standardDays,
        dailyDistanceMeters: finalDists,
        dailyRunCounts: finalCounts,
        activeDayIndex: dayOfWeek,
      };
    }

    if (selectedTimeframe === 'last_week') {
      const dayOfWeek = (now.getDay() + 6) % 7;
      const startOfThisWeek = new Date(now);
      startOfThisWeek.setDate(now.getDate() - dayOfWeek);
      startOfThisWeek.setHours(0, 0, 0, 0);

      const startOfLastWeek = new Date(startOfThisWeek);
      startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);

      const weekWorkouts = workouts.filter((w) => {
        const d = new Date(w.started_at);
        return d >= startOfLastWeek && d < startOfThisWeek;
      });

      const dists = [0, 0, 0, 0, 0, 0, 0];
      const counts = [0, 0, 0, 0, 0, 0, 0];

      weekWorkouts.forEach((w) => {
        const d = new Date(w.started_at);
        const idx = (d.getDay() + 6) % 7;
        dists[idx] += Number(w.distance_meters) || 0;
        counts[idx] += 1;
      });

      return {
        title: "Last Week’s Activity",
        dayNames: standardDays,
        dailyDistanceMeters: dists,
        dailyRunCounts: counts,
        activeDayIndex: -1,
      };
    }

    if (selectedTimeframe === 'last_7_days') {
      const rollingDays: string[] = [];
      const dists: number[] = [];
      const counts: number[] = [];
      const dayAbbr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        rollingDays.push(dayAbbr[d.getDay()]);

        const startOfDay = new Date(d);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(d);
        endOfDay.setHours(23, 59, 59, 999);

        const dayWorkouts = workouts.filter((w) => {
          const wd = new Date(w.started_at);
          return wd >= startOfDay && wd <= endOfDay;
        });

        const dayDist = dayWorkouts.reduce((sum, w) => sum + (Number(w.distance_meters) || 0), 0);
        dists.push(dayDist);
        counts.push(dayWorkouts.length);
      }

      return {
        title: "Past 7 Days Activity",
        dayNames: rollingDays,
        dailyDistanceMeters: dists,
        dailyRunCounts: counts,
        activeDayIndex: 6,
      };
    }

    if (selectedTimeframe === 'this_month') {
      const monthNames = ['W1', 'W2', 'W3', 'W4', 'W5'];
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const monthWorkouts = workouts.filter((w) => {
        const d = new Date(w.started_at);
        return d >= startOfMonth && d <= endOfMonth;
      });

      const dists = [0, 0, 0, 0, 0];
      const counts = [0, 0, 0, 0, 0];

      monthWorkouts.forEach((w) => {
        const d = new Date(w.started_at);
        const dateNum = d.getDate();
        const weekIdx = Math.min(4, Math.floor((dateNum - 1) / 7));
        dists[weekIdx] += Number(w.distance_meters) || 0;
        counts[weekIdx] += 1;
      });

      const currentWeekIdx = Math.min(4, Math.floor((now.getDate() - 1) / 7));

      return {
        title: "This Month’s Activity",
        dayNames: monthNames,
        dailyDistanceMeters: dists,
        dailyRunCounts: counts,
        activeDayIndex: currentWeekIdx,
      };
    }

    return {
      title: "This Week’s Activity",
      dayNames: defaultDayNames,
      dailyDistanceMeters: defaultDailyDistance,
      dailyRunCounts: defaultDailyRunCounts,
      activeDayIndex: (now.getDay() + 6) % 7,
    };
  }, [selectedTimeframe, workouts, defaultDayNames, defaultDailyDistance, defaultDailyRunCounts]);

  const { title, dayNames, dailyDistanceMeters, dailyRunCounts, activeDayIndex } = computedData;

  const totalMeters = dailyDistanceMeters.reduce((a, b) => a + b, 0);
  const totalRuns = dailyRunCounts.reduce((a, b) => a + b, 0);
  const activeDaysCount = dailyDistanceMeters.filter((m) => m > 0).length;

  // Convert daily meters to unit (km / mi)
  const unitConversion = distanceUnit === 'mi' ? 1609.34 : 1000;
  const dailyDistances = dailyDistanceMeters.map((m) => m / unitConversion);

  // 1. Calculate Left Y-Axis Scale (Distance)
  const maxDistRaw = Math.max(...dailyDistances, 0);
  let maxDistAxis = 5;
  let distStep = 1;

  if (maxDistRaw <= 2) {
    maxDistAxis = 2;
    distStep = 0.5;
  } else if (maxDistRaw <= 5) {
    maxDistAxis = 5;
    distStep = 1;
  } else if (maxDistRaw <= 10) {
    maxDistAxis = 10;
    distStep = 2;
  } else if (maxDistRaw <= 20) {
    maxDistAxis = 20;
    distStep = 4;
  } else if (maxDistRaw <= 50) {
    maxDistAxis = 50;
    distStep = 10;
  } else if (maxDistRaw <= 100) {
    maxDistAxis = 100;
    distStep = 20;
  } else {
    maxDistAxis = Math.ceil(maxDistRaw / 20) * 20;
    distStep = maxDistAxis / 5;
  }

  const distTicks: number[] = [];
  for (let val = 0; val <= maxDistAxis + 0.001; val += distStep) {
    distTicks.push(Number(val.toFixed(1)));
  }

  // 2. Calculate Right Y-Axis Scale (# Runs)
  const maxRunsRaw = Math.max(...dailyRunCounts, 0);
  let maxRunsAxis = 2.0;

  if (maxRunsRaw <= 2) {
    maxRunsAxis = 2.0;
  } else if (maxRunsRaw <= 4) {
    maxRunsAxis = 4.0;
  } else if (maxRunsRaw <= 8) {
    maxRunsAxis = 8.0;
  } else {
    maxRunsAxis = Math.ceil(maxRunsRaw / 2) * 2;
  }

  const numGridLines = distTicks.length - 1;
  const runsTicks: number[] = [];
  for (let i = 0; i <= numGridLines; i++) {
    const val = (i / numGridLines) * maxRunsAxis;
    runsTicks.push(Number(val.toFixed(1)));
  }

  // 3. SVG Coordinate Geometry
  const svgWidth = 520;
  const svgHeight = 220;
  const padding = { top: 22, right: 38, bottom: 34, left: 38 };
  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;
  const colWidth = plotWidth / (dayNames.length || 7);
  const barWidth = Math.min(32, colWidth * 0.52);
  const bottomY = padding.top + plotHeight;

  const getYDist = (val: number) => {
    return bottomY - (Math.min(val, maxDistAxis) / maxDistAxis) * plotHeight;
  };

  const points = dailyDistances.map((dist, idx) => {
    const x = padding.left + (idx + 0.5) * colWidth;
    const y = getYDist(dist);
    return {
      x,
      y,
      dist,
      runs: dailyRunCounts[idx] || 0,
      day: dayNames[idx] || `Day ${idx + 1}`,
      idx,
    };
  });

  const smoothSpline = points.length > 0 ? generateSmoothSpline(points, bottomY, padding.top) : '';
  const areaPath = points.length > 0
    ? `${smoothSpline} L ${points[points.length - 1].x.toFixed(1)},${bottomY.toFixed(1)} L ${points[0].x.toFixed(1)},${bottomY.toFixed(1)} Z`
    : '';

  // Identify peak point or hovered point for top floating pill badge
  const peakIndex = dailyDistances.indexOf(Math.max(...dailyDistances));
  const activeBadgeIndex = hoveredIndex !== null ? hoveredIndex : (dailyDistances[peakIndex] > 0 ? peakIndex : null);
  const activePoint = activeBadgeIndex !== null ? points[activeBadgeIndex] : null;

  const activeTimeframeLabel = TIMEFRAMES.find((t) => t.id === selectedTimeframe)?.label || 'This Week';

  return (
    <div
      className={`rounded-3xl bg-white dark:bg-[#09101d] text-slate-900 dark:text-white border border-emerald-100/90 dark:border-slate-800/90 p-4 sm:p-5 shadow-lg dark:shadow-2xl flex flex-col gap-3.5 transition-colors ${className}`}
    >
      {/* 1. Header: Icon + Title + Subtitle + Timeframe Selector Dropdown */}
      <div className="flex items-center justify-between relative z-30">
        <div className="flex items-center gap-3">
          {/* Green Runner Icon */}
          <div className="w-10 h-10 rounded-full bg-[#00d09c] flex items-center justify-center shadow-lg shadow-[#00d09c]/25 shrink-0">
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="currentColor"
              className="text-slate-950 font-black"
            >
              <path d="M13.49 5.48c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm-3.6 13.9l1-4.4 2.1 2v6h2v-7.5l-2.1-2 .6-3c1.3 1.5 3.3 2.5 5.5 2.5v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7-1.6 8.1-4.7-1-.4 2 6.4 1.4z" />
            </svg>
          </div>

          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
              {title}
            </h2>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {activeDaysCount} active {activeDaysCount === 1 ? 'day' : 'days'} &bull; {totalRuns} {totalRuns === 1 ? 'workout' : 'workouts'}
            </div>
          </div>
        </div>

        {/* Timeframe Dropdown Button & Popover */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#162032] border border-slate-200 dark:border-slate-700/70 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200/80 dark:hover:bg-[#1c2940] active:scale-95 transition-all cursor-pointer shadow-sm"
          >
            <span>{activeTimeframeLabel}</span>
            <ChevronDown
              size={14}
              className={`text-slate-500 dark:text-slate-400 transition-transform duration-200 ${
                isDropdownOpen ? 'rotate-180 text-slate-900 dark:text-white' : ''
              }`}
            />
          </button>

          {/* Interactive Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-40 rounded-2xl bg-white/95 dark:bg-[#111927]/95 border border-slate-200 dark:border-slate-700/80 shadow-2xl backdrop-blur-xl p-1.5 z-50 animate-scale-in">
              {TIMEFRAMES.map((tf) => {
                const isSelected = tf.id === selectedTimeframe;
                return (
                  <button
                    key={tf.id}
                    type="button"
                    onClick={() => {
                      setSelectedTimeframe(tf.id);
                      setIsDropdownOpen(false);
                      setHoveredIndex(null);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                      isSelected
                        ? 'bg-[#00d09c]/15 text-emerald-600 dark:text-[#00d09c]'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-950 dark:hover:text-white'
                    }`}
                  >
                    <span>{tf.label}</span>
                    {isSelected && <Check size={14} className="text-[#00d09c]" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 2. Top Metric Cards: Total Distance & Total Runs */}
      <div className="grid grid-cols-2 gap-3 relative z-10">
        {/* Total Distance Card */}
        <div className="rounded-2xl bg-slate-50 dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 p-3.5 flex items-center gap-3 shadow-sm">
          <div className="w-11 h-11 rounded-2xl bg-[#ff5500]/10 dark:bg-[#ff5500]/15 flex items-center justify-center shrink-0 border border-[#ff5500]/20">
            <MapPin size={20} className="text-[#ff5500]" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-none">Total Distance</div>
            <div className="font-display text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight truncate">
              {formatDistance(totalMeters, distanceUnit, 1)} {distanceUnit}
            </div>
          </div>
        </div>

        {/* Total Runs Card */}
        <div className="rounded-2xl bg-slate-50 dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800/80 p-3.5 flex items-center gap-3 shadow-sm">
          <div className="w-11 h-11 rounded-2xl bg-[#2563eb]/10 dark:bg-[#2563eb]/15 flex items-center justify-center shrink-0 border border-[#2563eb]/20">
            {/* Shoe Icon */}
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="#2563eb"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="dark:stroke-[#38bdf8]"
            >
              <path d="M3 18c0-1.7 1.3-3 3-3h12a3 3 0 0 1 3 3v1H3v-1z" />
              <path d="M6 15V9a3 3 0 0 1 3-3h3l4 4h3a2 2 0 0 1 2 2v3" />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-none">Total Runs</div>
            <div className="font-display text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 tracking-tight truncate">
              {totalRuns}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Nested Graph Area Box */}
      <div className="rounded-2xl bg-slate-50/70 dark:bg-[#09111f]/90 border border-slate-200/80 dark:border-slate-800/90 p-3.5 sm:p-4 flex flex-col justify-between relative z-10">
        {/* Axis Labels Header */}
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium px-1 mb-1">
          <span>Distance ({distanceUnit})</span>
          <span># Runs</span>
        </div>

        {/* SVG Canvas Area */}
        <div className="relative w-full overflow-hidden select-none">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto overflow-visible"
          >
            <defs>
              {/* Smooth Orange Spline Line Gradient */}
              <linearGradient id="chartOrangeLine" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ff7a00" />
                <stop offset="50%" stopColor="#ff4d00" />
                <stop offset="100%" stopColor="#ff6200" />
              </linearGradient>

              {/* Translucent Orange Area Glow */}
              <linearGradient id="chartOrangeArea" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ff5500" stopOpacity="0.32" />
                <stop offset="60%" stopColor="#ff5500" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#ff5500" stopOpacity="0.00" />
              </linearGradient>

              {/* Blue Bar Gradient */}
              <linearGradient id="chartBlueBar" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="1" />
                <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.85" />
              </linearGradient>

              {/* Floating Pill Filter Shadow */}
              <filter id="badgeShadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000000" floodOpacity="0.35" />
              </filter>
            </defs>

            {/* Horizontal Dashed Gridlines & Dual Y Ticks */}
            {distTicks.map((tickVal, idx) => {
              const y = getYDist(tickVal);
              const runVal = runsTicks[idx] ?? (idx / numGridLines) * maxRunsAxis;

              return (
                <g key={`grid-${idx}`}>
                  {/* Dashed Grid Line */}
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={padding.left + plotWidth}
                    y2={y}
                    className="stroke-slate-200/90 dark:stroke-slate-800"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />

                  {/* Left Distance Tick Number */}
                  <text
                    x={padding.left - 8}
                    y={y + 3.5}
                    textAnchor="end"
                    className="text-[11px] font-mono fill-slate-500 dark:fill-slate-400 font-semibold"
                  >
                    {tickVal}
                  </text>

                  {/* Right # Runs Tick Number */}
                  <text
                    x={padding.left + plotWidth + 8}
                    y={y + 3.5}
                    textAnchor="start"
                    className="text-[11px] font-mono fill-[#2563eb] dark:fill-[#3b82f6] font-bold"
                  >
                    {runVal.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* Solid Baseline Axis */}
            <line
              x1={padding.left}
              y1={bottomY}
              x2={padding.left + plotWidth}
              y2={bottomY}
              className="stroke-slate-300 dark:stroke-slate-700"
              strokeWidth="1.2"
            />

            {/* Layer 1: Solid Blue Pill Bars for # Runs */}
            {points.map((pt, idx) => {
              const runCount = pt.runs;
              if (runCount <= 0) return null;
              const barH = (runCount / maxRunsAxis) * plotHeight;
              const barY = bottomY - barH;

              return (
                <rect
                  key={`bar-${idx}`}
                  x={pt.x - barWidth / 2}
                  y={barY}
                  width={barWidth}
                  height={barH}
                  fill="url(#chartBlueBar)"
                  rx="5"
                  className="transition-all duration-300"
                />
              );
            })}

            {/* Layer 2: Distance Orange Glow Area Fill */}
            {areaPath && (
              <path
                d={areaPath}
                fill="url(#chartOrangeArea)"
                className="pointer-events-none"
              />
            )}

            {/* Layer 3: Smooth Orange Spline */}
            {smoothSpline && (
              <path
                d={smoothSpline}
                fill="none"
                stroke="url(#chartOrangeLine)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Layer 4: Orange Circular Point Markers */}
            {points.map((pt, idx) => {
              const isHovered = hoveredIndex === idx;

              return (
                <g key={`pt-${idx}`}>
                  {/* Outer Orange Ring with White Fill */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 6 : 4.5}
                    fill="#ffffff"
                    stroke="#ff5500"
                    strokeWidth="2.5"
                    className="transition-all duration-200"
                  />
                  {/* Center Dot */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="1.5"
                    fill="#ff5500"
                  />
                </g>
              );
            })}

            {/* Layer 5: Floating Orange Value Badge above Active/Peak Day */}
            {activePoint && activePoint.dist > 0 && (
              <g
                transform={`translate(${activePoint.x}, ${Math.max(padding.top + 4, activePoint.y - 20)})`}
                filter="url(#badgeShadow)"
                className="pointer-events-none transition-all duration-300"
              >
                {/* Pill Background */}
                <rect
                  x="-28"
                  y="-12"
                  width="56"
                  height="22"
                  rx="6"
                  fill="#ff6200"
                />
                {/* Text Value */}
                <text
                  x="0"
                  y="2.5"
                  textAnchor="middle"
                  className="text-[11px] font-black fill-white"
                >
                  {activePoint.dist.toFixed(1)} {distanceUnit}
                </text>
              </g>
            )}

            {/* Layer 6: X-Axis Days & Hover Zones */}
            {dayNames.map((day, idx) => {
              const x = padding.left + (idx + 0.5) * colWidth;
              const isToday = idx === activeDayIndex;
              const isHovered = hoveredIndex === idx;

              return (
                <g
                  key={`day-${day}-${idx}`}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => setHoveredIndex(idx)}
                >
                  {/* Hover Hit Box */}
                  <rect
                    x={padding.left + idx * colWidth}
                    y={padding.top}
                    width={colWidth}
                    height={plotHeight + 30}
                    fill="transparent"
                  />

                  {/* Day Label */}
                  <text
                    x={x}
                    y={bottomY + 16}
                    textAnchor="middle"
                    className={`text-[11px] font-bold transition-colors ${
                      isToday
                        ? 'fill-[#0284c7] dark:fill-[#38bdf8] font-black'
                        : isHovered
                        ? 'fill-slate-900 dark:fill-white'
                        : 'fill-slate-500 dark:fill-slate-400'
                    }`}
                  >
                    {day}
                  </text>

                  {/* Blue Indicator Dot under Active / Today */}
                  {isToday && (
                    <circle
                      cx={x}
                      cy={bottomY + 24}
                      r="2.5"
                      className="fill-[#0284c7] dark:fill-[#2563eb]"
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* 4. Bottom Legend matching screenshot */}
        <div className="flex items-center gap-6 mt-3 px-1 pt-1 border-t border-slate-200/80 dark:border-slate-800/40">
          {/* Distance (km) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              <span className="w-3 h-0.5 bg-[#ff5500]" />
              <span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-[#ff5500] -ml-1 -mr-1 z-10" />
              <span className="w-3 h-0.5 bg-[#ff5500]" />
            </div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Distance ({distanceUnit})
            </span>
          </div>

          {/* # Runs */}
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-[#2563eb]" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              # Runs
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
