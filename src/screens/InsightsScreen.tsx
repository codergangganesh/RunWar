import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { UserProfile, Workout } from '../types';
import { formatDistance, formatDuration, formatPace } from '../utils/formatters';
import {
  Timer,
  Flame,
  Footprints,
  Gauge,
  BarChart2,
  Lightbulb,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  ChevronDown,
  Calendar,
  X,
  TrendingUp,
  Activity,
  Mountain,
  Trophy,
} from 'lucide-react';

interface InsightsScreenProps {
  workouts: Workout[];
  profile: UserProfile | null;
}

type TimeFilter = '7d' | '30d' | '3m' | '6m' | '1y' | 'all';
type MetricType = 'distance' | 'duration' | 'calories' | 'pace';

export const InsightsScreen: React.FC<InsightsScreenProps> = ({ workouts, profile }) => {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('30d');
  const [activeMetric, setActiveMetric] = useState<MetricType>('distance');
  const [isMetricDropdownOpen, setIsMetricDropdownOpen] = useState(false);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const distanceUnit = profile?.distance_unit || 'km';
  const paceUnit = profile?.pace_unit || 'min_km';

  const now = useMemo(() => new Date(), []);

  // Compute cutoff dates
  const { filterCutoff, prevCutoff, periodLabel, periodDays } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    let days = 30;
    let label = 'previous 30 days';

    switch (timeFilter) {
      case '7d':
        days = 7;
        start.setDate(end.getDate() - 7);
        label = 'previous 7 days';
        break;
      case '30d':
        days = 30;
        start.setDate(end.getDate() - 30);
        label = 'previous 30 days';
        break;
      case '3m':
        days = 90;
        start.setMonth(end.getMonth() - 3);
        label = 'previous 3 months';
        break;
      case '6m':
        days = 180;
        start.setMonth(end.getMonth() - 6);
        label = 'previous 6 months';
        break;
      case '1y':
        days = 365;
        start.setFullYear(end.getFullYear() - 1);
        label = 'previous 1 year';
        break;
      case 'all':
        days = 1825;
        start.setFullYear(2000);
        label = 'all previous';
        break;
    }

    const prev = new Date(start);
    const durationMs = end.getTime() - start.getTime();
    prev.setTime(start.getTime() - durationMs);

    return {
      filterCutoff: start,
      prevCutoff: prev,
      periodLabel: label,
      periodDays: days,
    };
  }, [timeFilter]);

  // Current period workouts
  const filteredWorkouts = useMemo(() => {
    return workouts.filter((w) => new Date(w.started_at) >= filterCutoff);
  }, [workouts, filterCutoff]);

  // Previous period workouts for comparison
  const prevPeriodWorkouts = useMemo(() => {
    return workouts.filter((w) => {
      const d = new Date(w.started_at);
      return d >= prevCutoff && d < filterCutoff;
    });
  }, [workouts, prevCutoff, filterCutoff]);

  // Aggregate stats
  const totalDistanceMeters = filteredWorkouts.reduce((sum, w) => sum + (w.distance_meters || 0), 0);
  const totalDurationSec = filteredWorkouts.reduce((sum, w) => sum + (w.duration_seconds || 0), 0);
  const totalCalories = filteredWorkouts.reduce((sum, w) => sum + (w.calories || 0), 0);
  const totalWorkouts = filteredWorkouts.length;
  const avgPace = totalDistanceMeters > 0 ? totalDurationSec / (totalDistanceMeters / 1000) : 0;

  // Previous period comparison
  const prevDistanceMeters = prevPeriodWorkouts.reduce((sum, w) => sum + (w.distance_meters || 0), 0);
  const diffDistanceMeters = totalDistanceMeters - prevDistanceMeters;
  const diffDistanceConverted = distanceUnit === 'mi' ? diffDistanceMeters / 1609.34 : diffDistanceMeters / 1000;
  const isPositiveDiff = diffDistanceConverted >= 0;

  // Best highlights
  const bestDistanceMeters = filteredWorkouts.reduce((max, w) => Math.max(max, w.distance_meters || 0), 0);
  const validPaces = filteredWorkouts.map((w) => w.average_pace).filter((p) => p && p > 60 && p < 1800);
  const bestPaceSec = validPaces.length > 0 ? Math.min(...validPaces) : 0;
  const mostCalories = filteredWorkouts.reduce((max, w) => Math.max(max, w.calories || 0), 0);
  const totalElevationGain = filteredWorkouts.reduce((sum, w) => sum + (w.elevation_gain || 0), 0);
  const longestDurationSec = filteredWorkouts.reduce((max, w) => Math.max(max, w.duration_seconds || 0), 0);

  // 7 Date ticks across the time window
  const chartTicks = useMemo(() => {
    const ticks: { date: Date; label: string; value: number }[] = [];
    const numPoints = 7;
    const intervalMs = (now.getTime() - filterCutoff.getTime()) / (numPoints - 1);

    for (let i = 0; i < numPoints; i++) {
      const t = new Date(filterCutoff.getTime() + i * intervalMs);
      const label = t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      ticks.push({ date: t, label, value: 0 });
    }

    // Populate metric values for each bucket
    if (filteredWorkouts.length > 0) {
      filteredWorkouts.forEach((w) => {
        const wDate = new Date(w.started_at).getTime();
        let closestIdx = 0;
        let minDiff = Infinity;
        ticks.forEach((tick, idx) => {
          const diff = Math.abs(tick.date.getTime() - wDate);
          if (diff < minDiff) {
            minDiff = diff;
            closestIdx = idx;
          }
        });

        let valToAdd = 0;
        if (activeMetric === 'distance') {
          valToAdd = distanceUnit === 'mi' ? (w.distance_meters || 0) / 1609.34 : (w.distance_meters || 0) / 1000;
        } else if (activeMetric === 'duration') {
          valToAdd = Math.round((w.duration_seconds || 0) / 60);
        } else if (activeMetric === 'calories') {
          valToAdd = w.calories || 0;
        } else if (activeMetric === 'pace') {
          valToAdd = w.average_pace || 0;
        }

        if (activeMetric === 'pace') {
          ticks[closestIdx].value = ticks[closestIdx].value > 0 ? (ticks[closestIdx].value + valToAdd) / 2 : valToAdd;
        } else {
          ticks[closestIdx].value += valToAdd;
        }
      });
    }

    return ticks;
  }, [filterCutoff, now, filteredWorkouts, activeMetric, distanceUnit]);

  // Chart Y-Axis Scale
  const maxMetricValue = useMemo(() => {
    const maxInTicks = Math.max(...chartTicks.map((t) => t.value), 0);
    if (activeMetric === 'distance') return Math.max(8, Math.ceil(maxInTicks * 1.25));
    if (activeMetric === 'duration') return Math.max(60, Math.ceil(maxInTicks * 1.25));
    if (activeMetric === 'calories') return Math.max(500, Math.ceil(maxInTicks * 1.25));
    if (activeMetric === 'pace') return Math.max(600, Math.ceil(maxInTicks * 1.25));
    return 8;
  }, [chartTicks, activeMetric]);

  const yAxisLabels = useMemo(() => {
    const steps = 4;
    const labels: number[] = [];
    for (let i = steps; i >= 0; i--) {
      labels.push(Math.round((maxMetricValue / steps) * i * 10) / 10);
    }
    return labels;
  }, [maxMetricValue]);

  const hasAnyData = chartTicks.some((t) => t.value > 0);

  // Metric dropdown options (Clean single-line labels)
  const metricOptions: { id: MetricType; label: string; unit: string }[] = [
    { id: 'distance', label: `Distance (${distanceUnit})`, unit: distanceUnit },
    { id: 'duration', label: 'Duration (min)', unit: 'min' },
    { id: 'calories', label: 'Calories (kcal)', unit: 'kcal' },
    { id: 'pace', label: `Pace (${paceUnit.replace('_', '/')})`, unit: paceUnit.replace('_', '/') },
  ];

  const currentMetricOption = metricOptions.find((m) => m.id === activeMetric) || metricOptions[0];

  // SVG Chart Dimensions
  const svgWidth = 520;
  const svgHeight = 260;
  const paddingLeft = 52;
  const paddingRight = 32;
  const paddingTop = 45;
  const paddingBottom = 34;

  const chartAreaWidth = svgWidth - paddingLeft - paddingRight;
  const chartAreaHeight = svgHeight - paddingTop - paddingBottom;
  const yBaseline = paddingTop + chartAreaHeight;

  // Compute SVG coordinates for each tick
  const chartPoints = useMemo(() => {
    return chartTicks.map((tick, idx) => {
      const x = paddingLeft + (idx / (chartTicks.length - 1)) * chartAreaWidth;
      const yFraction = hasAnyData ? Math.min(1, Math.max(0, tick.value / maxMetricValue)) : 0;
      const y = paddingTop + chartAreaHeight - yFraction * chartAreaHeight;
      return { x, y, tick, idx };
    });
  }, [chartTicks, maxMetricValue, chartAreaWidth, chartAreaHeight, hasAnyData]);

  // Active tooltip point (defaults to the latest point or selected point)
  const activeTooltipIndex = useMemo(() => {
    if (selectedPointIndex !== null && chartPoints[selectedPointIndex]) {
      return selectedPointIndex;
    }
    return chartPoints.length - 1;
  }, [selectedPointIndex, chartPoints]);

  const activePoint = chartPoints[activeTooltipIndex] || chartPoints[chartPoints.length - 1];

  // Generate smooth SVG path
  const svgPath = useMemo(() => {
    if (chartPoints.length === 0) return '';
    if (!hasAnyData) {
      return `M ${chartPoints[0].x} ${yBaseline} L ${chartPoints[chartPoints.length - 1].x} ${yBaseline}`;
    }

    let path = `M ${chartPoints[0].x} ${chartPoints[0].y}`;
    for (let i = 0; i < chartPoints.length - 1; i++) {
      const current = chartPoints[i];
      const next = chartPoints[i + 1];
      const controlX = (current.x + next.x) / 2;
      path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
    }
    return path;
  }, [chartPoints, hasAnyData, yBaseline]);

  const svgAreaPath = useMemo(() => {
    if (!hasAnyData || chartPoints.length === 0) return '';
    return `${svgPath} L ${chartPoints[chartPoints.length - 1].x} ${yBaseline} L ${chartPoints[0].x} ${yBaseline} Z`;
  }, [svgPath, hasAnyData, chartPoints, yBaseline]);

  return (
    <div className="p-4 space-y-4 max-w-xl md:max-w-2xl mx-auto animate-fade-in select-none">
      {/* 1. Header Section */}
      <div className="flex items-start justify-between pt-1">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            Analytics & Insights
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Track your fitness trends and progression
          </p>
        </div>

        {/* Sessions Logged Badge */}
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-[#e6f7f0] dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-800/40 shadow-sm shrink-0">
          <div className="w-7 h-7 rounded-xl bg-white/90 dark:bg-slate-900 flex items-center justify-center text-[#00b284]">
            <BarChart2 className="w-4 h-4 text-[#00b284]" />
          </div>
          <div className="flex flex-col">
            <span className="font-display font-black text-sm sm:text-base leading-none text-slate-900 dark:text-white">
              {filteredWorkouts.length}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-tight">
              sessions logged
            </span>
          </div>
        </div>
      </div>

      {/* 2. Time Filter Horizontal Pills */}
      <div className="grid grid-cols-6 gap-1.5 w-full">
        {(
          [
            { id: '7d', label: '7D' },
            { id: '30d', label: '30D' },
            { id: '3m', label: '3M' },
            { id: '6m', label: '6M' },
            { id: '1y', label: '1Y' },
            { id: 'all', label: 'All' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setTimeFilter(tab.id);
              setSelectedPointIndex(null);
            }}
            className={`py-2 px-1 rounded-full text-xs font-bold transition-all text-center ${
              timeFilter === tab.id
                ? 'bg-[#00d09c] text-white dark:text-slate-950 font-black shadow-sm shadow-[#00d09c]/30 scale-[1.02]'
                : 'bg-white dark:bg-slate-900 border border-emerald-100/90 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50/50 dark:hover:bg-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. Card 1: Total Distance Overview Card */}
      <div className="rounded-[28px] bg-white dark:bg-slate-900 border border-emerald-100/80 dark:border-slate-800 p-5 sm:p-6 shadow-sm dark:shadow-md space-y-4 relative overflow-hidden">
        {/* Card Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#dcf5eb] dark:bg-emerald-950/60 flex items-center justify-center text-[#00b284] shadow-sm">
              <Footprints className="w-5 h-5 text-[#00b284]" />
            </div>
            <div>
              <div className="font-display font-black text-sm sm:text-base text-slate-900 dark:text-white tracking-tight leading-none">
                Total Distance
              </div>
              <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase mt-0.5">
                ({distanceUnit.toUpperCase()})
              </div>
            </div>
          </div>

          {/* Period Comparison Pill */}
          {timeFilter !== 'all' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-[#e6f7f0] dark:bg-emerald-950/40 border border-emerald-200/50 dark:border-emerald-800/40 text-slate-900 dark:text-slate-100">
              <div className="text-[#00b284]">
                {isPositiveDiff ? (
                  <ArrowUpRight className="w-4 h-4 text-[#00b284]" />
                ) : (
                  <ArrowDownRight className="w-4 h-4 text-amber-500" />
                )}
              </div>
              <div className="flex flex-col text-right">
                <span className="font-bold text-xs leading-none">
                  {isPositiveDiff ? `+${diffDistanceConverted.toFixed(1)}` : diffDistanceConverted.toFixed(1)}{' '}
                  {distanceUnit}
                </span>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium leading-tight mt-0.5">
                  vs {periodLabel}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Big Metric Display */}
        <div className="flex items-baseline gap-2 pt-1">
          <span className="font-display font-black text-4xl sm:text-5xl text-slate-950 dark:text-white tracking-tight">
            {formatDistance(totalDistanceMeters, distanceUnit)}
          </span>
          <span className="text-[#00d09c] font-black text-lg sm:text-xl uppercase tracking-normal">
            {distanceUnit}
          </span>
        </div>

        {/* Secondary 4 Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-2 pt-4 border-t border-slate-100 dark:border-slate-800/80">
          {/* Time */}
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 text-[10px] font-semibold">
              <Timer className="w-3.5 h-3.5 text-[#00b284]" />
              <span>Time</span>
            </div>
            <div className="font-display font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
              {formatDuration(totalDurationSec)}
            </div>
          </div>

          {/* Avg Pace */}
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 text-[10px] font-semibold">
              <Gauge className="w-3.5 h-3.5 text-[#00b284]" />
              <span>Avg Pace</span>
            </div>
            <div className="font-display font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
              {totalDistanceMeters > 0 ? formatPace(avgPace, paceUnit) : `--:-- /${distanceUnit}`}
            </div>
          </div>

          {/* Calories */}
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 text-[10px] font-semibold">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>Calories</span>
            </div>
            <div className="font-display font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
              {totalCalories} kcal
            </div>
          </div>

          {/* Workouts */}
          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 text-[10px] font-semibold">
              <Footprints className="w-3.5 h-3.5 text-[#00b284]" />
              <span>Workouts</span>
            </div>
            <div className="font-display font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
              {totalWorkouts}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Card 2: Activity Progression Interactive Chart (Pixel-Perfect to Reference) */}
      <div className="rounded-[32px] bg-white dark:bg-[#0b1324] border border-emerald-100/80 dark:border-[#18233a] p-5 sm:p-6 shadow-sm dark:shadow-2xl space-y-5 relative overflow-hidden">
        {/* Chart Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-2xl bg-[#dcf5eb] dark:bg-[#0d2a24] border border-emerald-200/50 dark:border-[#14473d] flex items-center justify-center text-[#00d09c] shrink-0">
              <BarChart2 className="w-5 h-5 text-[#00d09c]" />
            </div>
            <div className="min-w-0 truncate">
              <div className="font-display font-black text-base sm:text-lg text-slate-900 dark:text-white tracking-tight leading-none truncate">
                Activity Progression
              </div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1 truncate">
                Total {activeMetric} over the last {periodDays} days
              </div>
            </div>
          </div>

          {/* Metric Selector Dropdown (Strict Single-Line No-Wrap) */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsMetricDropdownOpen(!isMetricDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-[#121c30] border border-slate-200/80 dark:border-[#1e2d4a] text-xs font-bold text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-[#16233c] transition-all whitespace-nowrap shadow-sm"
            >
              <span className="whitespace-nowrap">{currentMetricOption.label}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>

            {isMetricDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-[#0d172a] rounded-2xl shadow-2xl border border-slate-100 dark:border-[#1e2d4a] p-1.5 z-30 animate-fade-in">
                {metricOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setActiveMetric(opt.id);
                      setIsMetricDropdownOpen(false);
                      setSelectedPointIndex(null);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      activeMetric === opt.id
                        ? 'bg-[#00d09c] text-white font-black'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#142036]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Glowing SVG Chart */}
        <div className="relative w-full pt-2">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto overflow-visible select-none"
          >
            <defs>
              {/* Area Gradient Fill */}
              <linearGradient id="glowChartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00e5a3" stopOpacity="0.32" />
                <stop offset="60%" stopColor="#00e5a3" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#00e5a3" stopOpacity="0.00" />
              </linearGradient>

              {/* Vertical Column Gradient Fill */}
              <linearGradient id="colGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00e5a3" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#00e5a3" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Rotated Y-Axis Unit Label */}
            <text
              transform={`rotate(-90)`}
              x={-(paddingTop + chartAreaHeight / 2)}
              y="16"
              textAnchor="middle"
              fontSize="9.5"
              fontWeight="600"
              className="fill-slate-400 dark:fill-slate-500 uppercase tracking-wider"
            >
              {activeMetric} ({currentMetricOption.unit})
            </text>

            {/* Horizontal Grid Lines */}
            {yAxisLabels.map((lbl, idx) => {
              const y = paddingTop + (idx / (yAxisLabels.length - 1)) * chartAreaHeight;
              return (
                <g key={lbl}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={svgWidth - paddingRight}
                    y2={y}
                    stroke="currentColor"
                    className="text-slate-100 dark:text-[#18233a]"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={paddingLeft - 10}
                    y={y + 3.5}
                    textAnchor="end"
                    fontSize="9.5"
                    fontFamily="monospace"
                    className="fill-slate-400 dark:fill-slate-500 font-semibold"
                  >
                    {lbl}
                  </text>
                </g>
              );
            })}

            {/* Vertical Reference Grid Lines for each tick */}
            {chartPoints.map((pt) => (
              <line
                key={`vline-${pt.idx}`}
                x1={pt.x}
                y1={paddingTop}
                x2={pt.x}
                y2={yBaseline}
                stroke="currentColor"
                className="text-slate-100/80 dark:text-[#141e30]"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            ))}

            {/* Vertical Glow Columns under active data points */}
            {hasAnyData &&
              chartPoints.map((pt) => {
                if (pt.tick.value <= 0) return null;
                const colHeight = Math.max(0, yBaseline - pt.y);
                return (
                  <rect
                    key={`col-${pt.idx}`}
                    x={pt.x - 7}
                    y={pt.y}
                    width="14"
                    height={colHeight}
                    fill="url(#colGradient)"
                    rx="3"
                  />
                );
              })}

            {/* Filled Gradient Area Under Curve */}
            {hasAnyData && svgAreaPath && (
              <path d={svgAreaPath} fill="url(#glowChartGradient)" />
            )}

            {/* Main Smooth Connecting Neon Curve */}
            <path
              d={svgPath}
              fill="none"
              stroke="#00e5a3"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Vertical Highlight Line for the Active/Hovered Point */}
            {activePoint && (
              <line
                x1={activePoint.x}
                y1={activePoint.y}
                x2={activePoint.x}
                y2={yBaseline}
                stroke="#00e5a3"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
            )}

            {/* Milestone Dots */}
            {chartPoints.map((pt) => {
              const isActive = activePoint && activePoint.idx === pt.idx;
              return (
                <g key={pt.idx} className="cursor-pointer" onClick={() => setSelectedPointIndex(pt.idx)}>
                  {/* Glowing Outer Aura */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isActive ? 8 : 6}
                    fill="#00e5a3"
                    opacity={isActive ? 0.45 : 0.25}
                    className="transition-all"
                  />
                  {/* Solid White Center Dot with Emerald Ring */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isActive ? 4.5 : 3.5}
                    fill="#ffffff"
                    stroke="#00e5a3"
                    strokeWidth="2"
                    className="transition-all hover:scale-125"
                  />
                </g>
              );
            })}

            {/* Floating Speech-Bubble Tooltip on Active Point */}
            {activePoint && (
              <g transform={`translate(${activePoint.x}, ${activePoint.y - 14})`}>
                {/* Speech Bubble Pill Background */}
                <path
                  d="M -32 -26 L 32 -26 C 36 -26 38 -24 38 -20 L 38 -6 C 38 -2 36 0 32 0 L 4 0 L 0 5 L -4 0 L -32 0 C -36 0 -38 -2 -38 -6 L -38 -20 C -38 -24 -36 -26 -32 -26 Z"
                  fill="#00b284"
                  className="shadow-lg filter drop-shadow(0 4px 6px rgba(0,0,0,0.3))"
                />
                {/* Tooltip Value Text */}
                <text
                  x="0"
                  y="-11"
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="900"
                  fill="#ffffff"
                  fontFamily="sans-serif"
                >
                  {activePoint.tick.value.toFixed(1)} {currentMetricOption.unit}
                </text>
              </g>
            )}

            {/* X-Axis Date Labels */}
            {chartPoints.map((pt) => (
              <text
                key={pt.idx}
                x={pt.x}
                y={svgHeight - 10}
                textAnchor="middle"
                fontSize="9.5"
                className="fill-slate-400 dark:fill-slate-500 font-semibold"
              >
                {pt.tick.label}
              </text>
            ))}
          </svg>

          {/* Empty State Banner (When no workouts in range) */}
          {!hasAnyData && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
              <div className="w-10 h-10 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 flex items-center justify-center text-slate-400 mb-1.5 shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                <BarChart2 className="w-5 h-5 text-slate-400" />
              </div>
              <div className="font-display font-bold text-xs text-slate-700 dark:text-slate-300">
                No workouts logged
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                Complete a run to see your progress
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. Card 3: Insights Key Highlights Card */}
      <div className="rounded-[32px] bg-white dark:bg-[#0b1324] border border-emerald-100/80 dark:border-[#18233a] p-5 sm:p-6 shadow-sm dark:shadow-2xl space-y-4 relative overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Emerald Lightbulb Badge Container */}
            <div className="w-11 h-11 rounded-2xl bg-[#dcf5eb] dark:bg-[#0d2a24] border border-emerald-200/50 dark:border-[#14473d] flex items-center justify-center text-[#00d09c] shrink-0">
              <Lightbulb className="w-5 h-5 text-[#00d09c]" />
            </div>
            <div>
              <div className="font-display font-black text-base sm:text-lg text-slate-900 dark:text-white tracking-tight leading-none">
                Insights
              </div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                Trends and key takeaways
              </div>
            </div>
          </div>

          {/* View All Action */}
          <button
            type="button"
            onClick={() => setShowDetailsModal(true)}
            className="flex items-center gap-1 text-xs sm:text-sm font-bold text-[#00d09c] hover:underline transition-all"
          >
            <span>View All</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 4 Clean Left-Aligned Stat Cards in 4 Columns */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-3.5">
          {/* 1. Best Distance (Emerald Theme) */}
          <div className="bg-slate-50/90 dark:bg-[#080e1c] hover:bg-emerald-50/30 dark:hover:bg-[#0c162c] p-2 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-[#1a263d] flex flex-col items-start justify-between text-left transition-all min-h-[85px] sm:min-h-[120px]">
            {/* Icon Box */}
            <div className="w-6 h-6 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-emerald-100/80 dark:bg-[#0d2a24] flex items-center justify-center text-[#00d09c] shrink-0">
              <Footprints className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#00d09c]" />
            </div>
            {/* Label */}
            <div className="text-[9px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 leading-tight mt-1.5 sm:mt-2.5 mb-0.5 sm:mb-1 w-full tracking-tighter sm:tracking-normal">
              Best Distance
            </div>
            {/* Value */}
            <div className="font-display font-black text-slate-950 dark:text-white leading-none flex items-baseline gap-0.5 sm:gap-1">
              <span className="text-xs sm:text-base md:text-lg font-black tracking-tight">
                {bestDistanceMeters > 0 ? formatDistance(bestDistanceMeters, distanceUnit) : '0.00'}
              </span>
              <span className="text-[8px] sm:text-xs font-semibold text-slate-400 dark:text-slate-500 lowercase">
                {distanceUnit}
              </span>
            </div>
          </div>

          {/* 2. Best Pace (Cyan / Sky Theme) */}
          <div className="bg-slate-50/90 dark:bg-[#080e1c] hover:bg-sky-50/30 dark:hover:bg-[#0c162c] p-2 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-[#1a263d] flex flex-col items-start justify-between text-left transition-all min-h-[85px] sm:min-h-[120px]">
            {/* Icon Box */}
            <div className="w-6 h-6 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-sky-100/80 dark:bg-[#0f243e] flex items-center justify-center text-[#38bdf8] shrink-0">
              <Gauge className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-500 dark:text-[#38bdf8]" />
            </div>
            {/* Label */}
            <div className="text-[9px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 leading-tight mt-1.5 sm:mt-2.5 mb-0.5 sm:mb-1 w-full tracking-tighter sm:tracking-normal">
              Best Pace
            </div>
            {/* Value */}
            <div className="font-display font-black text-slate-950 dark:text-white leading-none flex items-baseline gap-0.5 sm:gap-1">
              <span className="text-xs sm:text-base md:text-lg font-black tracking-tight">
                {bestPaceSec > 0 ? formatPace(bestPaceSec, paceUnit).replace(/\s*\/\w+/, '') : '--:--'}
              </span>
              <span className="text-[8px] sm:text-xs font-semibold text-slate-400 dark:text-slate-500">
                /{distanceUnit}
              </span>
            </div>
          </div>

          {/* 3. Most Calories (Amber / Orange Theme) */}
          <div className="bg-slate-50/90 dark:bg-[#080e1c] hover:bg-amber-50/30 dark:hover:bg-[#0c162c] p-2 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-[#1a263d] flex flex-col items-start justify-between text-left transition-all min-h-[85px] sm:min-h-[120px]">
            {/* Icon Box */}
            <div className="w-6 h-6 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-amber-100/80 dark:bg-[#2a1b0e] flex items-center justify-center text-amber-500 dark:text-[#fb923c] shrink-0">
              <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 dark:text-[#fb923c]" />
            </div>
            {/* Label */}
            <div className="text-[9px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 leading-tight mt-1.5 sm:mt-2.5 mb-0.5 sm:mb-1 w-full tracking-tighter sm:tracking-normal">
              Most Calories
            </div>
            {/* Value */}
            <div className="font-display font-black text-slate-950 dark:text-white leading-none flex items-baseline gap-0.5 sm:gap-1">
              <span className="text-xs sm:text-base md:text-lg font-black tracking-tight">
                {mostCalories}
              </span>
              <span className="text-[8px] sm:text-xs font-semibold text-slate-400 dark:text-slate-500 lowercase">
                kcal
              </span>
            </div>
          </div>

          {/* 4. Total Workouts (Purple Theme) */}
          <div className="bg-slate-50/90 dark:bg-[#080e1c] hover:bg-purple-50/30 dark:hover:bg-[#0c162c] p-2 sm:p-4 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-[#1a263d] flex flex-col items-start justify-between text-left transition-all min-h-[85px] sm:min-h-[120px]">
            {/* Icon Box */}
            <div className="w-6 h-6 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-purple-100/80 dark:bg-[#221638] flex items-center justify-center text-purple-500 dark:text-[#a855f7] shrink-0">
              <BarChart2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-500 dark:text-[#a855f7]" />
            </div>
            {/* Label */}
            <div className="text-[9px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 leading-tight mt-1.5 sm:mt-2.5 mb-0.5 sm:mb-1 w-full tracking-tighter sm:tracking-normal">
              Total Workouts
            </div>
            {/* Value */}
            <div className="font-display font-black text-xs sm:text-base md:text-lg text-slate-950 dark:text-white leading-none tracking-tight">
              {totalWorkouts}
            </div>
          </div>
        </div>
      </div>

      {/* 6. Detailed Insights Modal (Centered in Viewport via Portal) */}
      {showDetailsModal &&
        createPortal(
          <div
            onClick={() => setShowDetailsModal(false)}
            className="fixed inset-0 z-[99999] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in select-none"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white dark:bg-[#0c1425] rounded-[32px] p-6 shadow-2xl border border-emerald-100 dark:border-[#1e2d4a] space-y-5 animate-scale-up mx-auto my-auto relative z-10 max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#18233a]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#dcf5eb] dark:bg-[#0d2a24] border border-emerald-200/50 dark:border-[#14473d] flex items-center justify-center text-[#00d09c] shrink-0">
                    <TrendingUp className="w-5 h-5 text-[#00d09c]" />
                  </div>
                  <div>
                    <h3 className="font-display font-black text-lg text-slate-950 dark:text-white leading-none">
                      Performance Deep Dive
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Comprehensive metrics for this period
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDetailsModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#152238] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Extended Stats */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#080e1c] border border-slate-100 dark:border-[#1a263d]">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <Activity className="w-4 h-4 text-[#00d09c]" />
                    <span>Average Workout Distance</span>
                  </div>
                  <span className="font-display font-black text-sm sm:text-base text-slate-950 dark:text-white">
                    {totalWorkouts > 0
                      ? `${formatDistance(totalDistanceMeters / totalWorkouts, distanceUnit)} ${distanceUnit}`
                      : `0.00 ${distanceUnit}`}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#080e1c] border border-slate-100 dark:border-[#1a263d]">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <Timer className="w-4 h-4 text-[#00d09c]" />
                    <span>Average Session Duration</span>
                  </div>
                  <span className="font-display font-black text-sm sm:text-base text-slate-950 dark:text-white">
                    {totalWorkouts > 0 ? formatDuration(Math.round(totalDurationSec / totalWorkouts)) : '00:00'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#080e1c] border border-slate-100 dark:border-[#1a263d]">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <Mountain className="w-4 h-4 text-emerald-500" />
                    <span>Total Elevation Gained</span>
                  </div>
                  <span className="font-display font-black text-sm sm:text-base text-slate-950 dark:text-white">
                    {Math.round(totalElevationGain)} m
                  </span>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#080e1c] border border-slate-100 dark:border-[#1a263d]">
                  <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <Flame className="w-4 h-4 text-amber-500" />
                    <span>Average Calorie Burn</span>
                  </div>
                  <span className="font-display font-black text-sm sm:text-base text-slate-950 dark:text-white">
                    {totalWorkouts > 0 ? Math.round(totalCalories / totalWorkouts) : 0} kcal
                  </span>
                </div>
              </div>

              {/* Done Action Button */}
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="w-full py-3.5 rounded-2xl bg-[#00d09c] hover:bg-[#00ba8b] text-slate-950 font-black text-sm shadow-md shadow-[#00d09c]/25 transition-all text-center cursor-pointer active:scale-[0.98]"
              >
                Done
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
