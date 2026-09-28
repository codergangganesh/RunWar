import React from 'react';

interface StepProgressRingProps {
  steps: number;
  goal: number;
  size?: number;
  strokeWidth?: number;
  onClick?: () => void;
  onEditGoal?: () => void;
}

export const StepProgressRing: React.FC<StepProgressRingProps> = ({
  steps,
  goal,
  size = 180,
  strokeWidth = 18,
  onClick,
  onEditGoal,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = Math.min(1, Math.max(0, goal > 0 ? steps / goal : 0));
  const strokeDashoffset = circumference - progressRatio * circumference;

  return (
    <div
      onClick={onClick}
      className="relative flex items-center justify-center cursor-pointer select-none group transition-transform active:scale-95"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        viewBox={`0 0 ${size} ${size}`}
      >
        <defs>
          <linearGradient id="stepRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00F5D4" />
            <stop offset="100%" stopColor="#00BFA5" />
          </linearGradient>
          <filter id="ringGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Background Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-emerald-100/80 dark:text-[#162E2B] transition-colors duration-300"
        />

        {/* Progress Arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="url(#stepRingGradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
          style={{ filter: 'drop-shadow(0 0 6px rgba(0, 245, 212, 0.4))' }}
        />
      </svg>

      {/* Center Label Content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <span className="text-xs font-semibold text-emerald-800/80 dark:text-slate-300/90 tracking-wide">Steps</span>
        <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight my-0.5 font-display">
          {steps.toLocaleString()}
        </span>
        {onEditGoal ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEditGoal();
            }}
            className="pointer-events-auto flex items-center justify-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors cursor-pointer group/goal active:scale-95 px-2 py-0.5 rounded-full hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            title="Edit daily step goal"
          >
            <span>of {goal.toLocaleString()}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-70 group-hover/goal:opacity-100 group-hover/goal:scale-110 transition-all text-emerald-500"
            >
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </button>
        ) : (
          <span className="text-[11px] font-medium text-emerald-700/80 dark:text-slate-400">
            of {goal.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
};
