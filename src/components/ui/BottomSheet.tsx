import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  children,
}) => {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isAnimating, setIsAnimating] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setDragOffsetY(0);
      // Let DOM render with translateY(100%) before sliding up
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsRendered(false);
        setDragOffsetY(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    if (deltaY > 0) {
      setDragOffsetY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (dragOffsetY > 80) {
      onClose();
    } else {
      setDragOffsetY(0);
    }
    touchStartY.current = null;
  };

  if (!isRendered) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-end justify-center select-none overflow-hidden touch-none overscroll-none animate-fade-in">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-sm transition-opacity duration-300 ease-out ${isAnimating ? 'opacity-100' : 'opacity-0'
          }`}
      />

      {/* Sheet Content Panel - Pure Smooth Slide Up from Bottom */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform: dragOffsetY > 0 ? `translateY(${dragOffsetY}px)` : undefined,
          transition: dragOffsetY > 0 ? 'none' : 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        className={`relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 border-t border-x border-emerald-100 dark:border-slate-800 rounded-t-[32px] shadow-[0_-12px_40px_rgba(0,0,0,0.35)] dark:shadow-[0_-12px_40px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col max-h-[88dvh] will-change-transform ${isAnimating && dragOffsetY === 0 ? 'translate-y-0' : 'translate-y-full'
          }`}
      >
        {/* Top Handle / Grab Bar */}
        <div className="flex flex-col items-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none">
          <div className="w-12 h-1.5 rounded-full bg-emerald-200 dark:bg-slate-700 hover:bg-emerald-300 dark:hover:bg-slate-600 transition-colors" />
        </div>

        {/* Sheet Header */}
        {title && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-emerald-100/80 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              {icon && <span className="text-emerald-600 dark:text-emerald-400">{icon}</span>}
              <h3 className="text-base font-black text-emerald-950 dark:text-white tracking-tight leading-none">{title}</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-emerald-50 dark:bg-slate-800 text-emerald-800 dark:text-slate-400 hover:text-emerald-950 dark:hover:text-white active:scale-90 transition-all"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 pb-8 overscroll-contain">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
