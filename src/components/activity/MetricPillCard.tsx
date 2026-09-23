import React from 'react';

export type MetricPillVariant = 'teal' | 'purple' | 'slate' | 'cyan';

interface MetricPillCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  variant?: MetricPillVariant;
  compact?: boolean;
  onClick?: () => void;
  className?: string;
}

export const MetricPillCard: React.FC<MetricPillCardProps> = ({
  icon,
  label,
  value,
  subtitle,
  variant = 'teal',
  compact = false,
  onClick,
  className = '',
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'purple':
        return {
          container: 'bg-purple-50/90 hover:bg-purple-100/80 border-purple-200/80 dark:bg-[#3A1864] dark:hover:bg-[#461D78] dark:border-[#582696]/40',
          iconBg: 'bg-purple-100/90 text-purple-700 dark:bg-[#502488] dark:text-[#D8B4FE]',
          label: 'text-purple-800/80 dark:text-purple-200/80',
          value: 'text-purple-950 dark:text-white',
          subtitle: 'text-purple-700/80 dark:text-purple-300/80',
        };
      case 'slate':
        return {
          container: 'bg-slate-100/90 hover:bg-slate-200/80 border-slate-200 dark:bg-[#222630] dark:hover:bg-[#2A303D] dark:border-[#363C4D]/40',
          iconBg: 'bg-slate-200/90 text-slate-700 dark:bg-[#323947] dark:text-[#93C5FD]',
          label: 'text-slate-600 dark:text-slate-400',
          value: 'text-slate-900 dark:text-white',
          subtitle: 'text-slate-500 dark:text-slate-400',
        };
      case 'cyan':
        return {
          container: 'bg-cyan-50/90 hover:bg-cyan-100/80 border-cyan-200/80 dark:bg-[#063F3F] dark:hover:bg-[#094D4D] dark:border-[#0F6060]/40',
          iconBg: 'bg-cyan-100/90 text-cyan-700 dark:bg-[#0E5454] dark:text-[#22D3EE]',
          label: 'text-cyan-800/80 dark:text-cyan-200/80',
          value: 'text-cyan-950 dark:text-white',
          subtitle: 'text-cyan-700/80 dark:text-cyan-300/80',
        };
      case 'teal':
      default:
        return {
          container: 'bg-teal-50/90 hover:bg-teal-100/80 border-teal-200/80 dark:bg-[#003B36] dark:hover:bg-[#034A44] dark:border-[#005B54]/40',
          iconBg: 'bg-teal-100/90 text-teal-700 dark:bg-[#00544E] dark:text-[#00F5D4]',
          label: 'text-teal-800/80 dark:text-teal-200/80',
          value: 'text-teal-950 dark:text-white',
          subtitle: 'text-teal-700/80 dark:text-teal-300/80',
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div
      onClick={onClick}
      className={`relative flex items-center gap-2.5 sm:gap-3 ${
        compact ? 'py-2 px-2.5 rounded-2xl' : 'p-3 rounded-2xl'
      } border transition-all duration-200 select-none shadow-sm ${
        onClick ? 'cursor-pointer active:scale-95' : ''
      } ${styles.container} ${className}`}
    >
      {/* Icon Badge */}
      <div
        className={`${
          compact ? 'w-8 h-8 rounded-lg' : 'w-9 h-9 rounded-xl'
        } flex items-center justify-center shrink-0 shadow-inner ${styles.iconBg}`}
      >
        {icon}
      </div>

      {/* Label and Value */}
      <div className="flex-1 min-w-0 pr-0.5">
        <div className={`text-[10px] sm:text-[11px] font-medium truncate ${styles.label}`}>
          {label}
        </div>
        <div className="text-xs sm:text-sm font-bold tracking-tight truncate flex items-baseline gap-1">
          <span className={styles.value}>{value}</span>
          {subtitle && (
            <span className={`text-[10px] font-normal truncate ${styles.subtitle}`}>
              {subtitle}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
