import React, { useEffect, useRef } from 'react';
import { Achievement } from '../../types';
import {
  Trophy,
  Award,
  Sparkles,
  Flame,
  Zap,
  Gauge,
  Footprints,
  Medal,
  Crown,
  Share2,
  CheckCircle2,
  X,
} from 'lucide-react';

interface AchievementCelebrationModalProps {
  achievements: Achievement[];
  isOpen: boolean;
  onClose: () => void;
}

export const AchievementCelebrationModal: React.FC<AchievementCelebrationModalProps> = ({
  achievements,
  isOpen,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Trophy': return Trophy;
      case 'Flame': return Flame;
      case 'Crown': return Crown;
      case 'Medal': return Medal;
      case 'Gauge': return Gauge;
      case 'Zap': return Zap;
      case 'Sparkles': return Sparkles;
      case 'Footprints':
      default:
        return Footprints;
    }
  };

  // Confetti Particle Physics Simulation
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#10b981', '#34d399', '#f59e0b', '#fbbf24', '#38bdf8', '#a855f7', '#ec4899', '#ffffff'];
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      rotation: number;
      rotationSpeed: number;
      opacity: number;
    }> = [];

    for (let i = 0; i < 90; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 150,
        y: canvas.height / 2 - 50 + (Math.random() - 0.5) * 80,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 0.8) * 14 - 3,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: 1,
      });
    }

    let animationFrameId: number;
    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.35; // gravity
        p.vx *= 0.98; // air drag
        p.rotation += p.rotationSpeed;
        p.opacity -= 0.007;

        if (p.opacity > 0) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.globalAlpha = Math.max(0, p.opacity);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }
      });

      if (particles.some((p) => p.opacity > 0)) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isOpen]);

  if (!isOpen || achievements.length === 0) return null;

  const currentAch = achievements[0];
  const Icon = getIcon(currentAch.icon);
  const xp = currentAch.xp || (currentAch.rarity === 'legendary' ? 500 : currentAch.rarity === 'epic' ? 250 : 100);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      {/* Confetti Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10 w-full h-full" />

      {/* Modal Card */}
      <div className="relative z-20 w-full max-w-sm rounded-[36px] bg-gradient-to-b from-slate-900 via-slate-900 to-emerald-950 border-2 border-emerald-400 p-6 text-center shadow-[0_20px_60px_rgba(16,185,129,0.35)] animate-scale-up space-y-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-slate-800/80 text-slate-300 hover:text-white border border-slate-700 active:scale-95 transition-all"
        >
          <X size={16} />
        </button>

        {/* Top Celebration Crown */}
        <div className="flex items-center justify-center gap-1.5 text-amber-400 font-black text-xs uppercase tracking-widest pt-2">
          <Sparkles size={16} className="animate-spin-slow" />
          <span>New Achievement Unlocked!</span>
          <Sparkles size={16} className="animate-spin-slow" />
        </div>

        {/* Holographic Glowing Medallion */}
        <div className="flex justify-center py-2">
          <div className="relative">
            <div className="absolute -inset-4 rounded-full bg-emerald-400/30 blur-2xl animate-pulse" />
            <div className="relative w-28 h-28 rounded-3xl bg-gradient-to-tr from-emerald-500 via-emerald-400 to-lime-300 p-0.5 shadow-[0_0_35px_rgba(16,185,129,0.5)] flex items-center justify-center">
              <div className="w-full h-full rounded-[22px] bg-slate-950 flex items-center justify-center text-emerald-400">
                <Icon size={54} className="animate-bounce-subtle" />
              </div>

              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center border-2 border-slate-950 shadow-md">
                <CheckCircle2 size={18} />
              </div>
            </div>
          </div>
        </div>

        {/* XP Badge */}
        <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 text-xs font-black tracking-wider">
          <Zap size={13} fill="currentColor" />
          <span>+{xp} XP EARNED</span>
        </div>

        {/* Title & Description */}
        <div>
          <h3 className="font-display text-2xl font-black text-white tracking-tight">
            {currentAch.name}
          </h3>
          <p className="text-xs text-slate-300 mt-1 max-w-xs mx-auto leading-relaxed">
            {currentAch.description}
          </p>
        </div>

        {/* Primary Claim Action Button */}
        <button
          onClick={onClose}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-lime-400 hover:from-emerald-400 hover:to-lime-300 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/30 active:scale-98 transition-all cursor-pointer"
        >
          Claim & Continue
        </button>
      </div>
    </div>
  );
};
