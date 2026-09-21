import React, { useRef, useState, useEffect, useCallback } from 'react';
import { GPSCoordinate, Workout } from '../../types';
import { formatDistance, formatDuration, formatPace } from '../../utils/formatters';
import {
  X,
  Download,
  Share2,
  Copy,
  Check,
  Sparkles,
  Camera,
  Layers,
  Smartphone,
  Square,
  Image as ImageIcon,
} from 'lucide-react';

interface WorkoutShareModalProps {
  workout: Workout | {
    type: string;
    distance_meters: number;
    duration_seconds: number;
    average_pace: number;
    calories: number;
    elevation_gain: number;
    route_coordinates: GPSCoordinate[];
    started_at?: string;
    title?: string;
  };
  onClose: () => void;
}

type AspectRatio = 'story' | 'square';
type ThemeStyle = 'midnight' | 'cyber' | 'sunrise' | 'photo';

export const WorkoutShareModal: React.FC<WorkoutShareModalProps> = ({
  workout,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('story');
  const [theme, setTheme] = useState<ThemeStyle>('midnight');
  const [userBgImage, setUserBgImage] = useState<HTMLImageElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Normalize and draw GPS coordinates on canvas
  const drawRouteOnCanvas = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      coords: GPSCoordinate[],
      x: number,
      y: number,
      width: number,
      height: number,
      strokeColor: string = '#00d09c'
    ) => {
      if (!coords || coords.length < 2) {
        // Fallback placeholder route curve if no coordinates
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = strokeColor;
        ctx.shadowBlur = 16;
        ctx.moveTo(x + width * 0.2, y + height * 0.7);
        ctx.bezierCurveTo(
          x + width * 0.3,
          y + height * 0.2,
          x + width * 0.7,
          y + height * 0.8,
          x + width * 0.8,
          y + height * 0.3
        );
        ctx.stroke();
        ctx.restore();
        return;
      }

      const lats = coords.map((c) => c.latitude);
      const lngs = coords.map((c) => c.longitude);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);

      const latRange = maxLat - minLat || 0.001;
      const lngRange = maxLng - minLng || 0.001;

      // Scale to bounding box with padding
      const pad = 24;
      const drawW = width - pad * 2;
      const drawH = height - pad * 2;

      const points = coords.map((c) => {
        const px = x + pad + ((c.longitude - minLng) / lngRange) * drawW;
        // Invert Y since latitude increases northward
        const py = y + height - pad - ((c.latitude - minLat) / latRange) * drawH;
        return { x: px, y: py };
      });

      ctx.save();

      // Outer Glow Pass
      ctx.beginPath();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = 24;
      ctx.globalAlpha = 0.4;
      points.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      // Main Route Line
      ctx.globalAlpha = 1.0;
      ctx.beginPath();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 6;
      ctx.shadowBlur = 12;
      points.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      // Start Marker (Green Circle)
      const start = points[0];
      ctx.beginPath();
      ctx.fillStyle = '#10b981';
      ctx.arc(start.x, start.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Finish Marker (Red / Flag Circle)
      const end = points[points.length - 1];
      ctx.beginPath();
      ctx.fillStyle = '#ef4444';
      ctx.arc(end.x, end.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.restore();
    },
    []
  );

  // Render canvas card
  const renderCard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = aspectRatio === 'story' ? 1080 : 1080;
    const H = aspectRatio === 'story' ? 1920 : 1080;

    canvas.width = W;
    canvas.height = H;

    // 1. Draw Background
    if (theme === 'photo' && userBgImage) {
      // Draw uploaded background photo
      const imgRatio = userBgImage.width / userBgImage.height;
      const canvasRatio = W / H;
      let renderW = W;
      let renderH = H;
      let offsetX = 0;
      let offsetY = 0;

      if (imgRatio > canvasRatio) {
        renderW = H * imgRatio;
        offsetX = (W - renderW) / 2;
      } else {
        renderH = W / imgRatio;
        offsetY = (H - renderH) / 2;
      }

      ctx.drawImage(userBgImage, offsetX, offsetY, renderW, renderH);

      // Dark gradient overlay for readability
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, 'rgba(9, 21, 31, 0.7)');
      grad.addColorStop(0.5, 'rgba(9, 21, 31, 0.4)');
      grad.addColorStop(1, 'rgba(9, 21, 31, 0.9)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else if (theme === 'sunrise') {
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, '#0f2027');
      grad.addColorStop(0.4, '#203a43');
      grad.addColorStop(1, '#2c5364');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else if (theme === 'cyber') {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#020617');
      grad.addColorStop(0.5, '#0f172a');
      grad.addColorStop(1, '#020617');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else {
      // Midnight
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#09151f');
      grad.addColorStop(0.6, '#0d1e2b');
      grad.addColorStop(1, '#050c12');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // 2. Header: Logo & Branding
    const topPadding = aspectRatio === 'story' ? 140 : 100;

    // RunWar Badge
    ctx.save();
    ctx.font = '900 48px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('RUNWAR', 100, topPadding);

    ctx.font = '600 24px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#00d09c';
    ctx.fillText('RUN. TRACK. IMPROVE.', 100, topPadding + 40);

    // Date
    const workoutDate = workout.started_at ? new Date(workout.started_at) : new Date();
    const dateStr = workoutDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    ctx.font = '700 26px Inter, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.textAlign = 'right';
    ctx.fillText(dateStr, W - 100, topPadding + 20);
    ctx.restore();

    // 3. Middle Area: GPS Route Visualizer
    const mapY = aspectRatio === 'story' ? topPadding + 140 : topPadding + 80;
    const mapW = W - 200;
    const mapH = aspectRatio === 'story' ? 700 : 420;

    // Map Card Glass Box
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(100, mapY, mapW, mapH, 40);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Draw GPS Polyline
    drawRouteOnCanvas(ctx, workout.route_coordinates || [], 120, mapY + 20, mapW - 40, mapH - 40, '#00d09c');

    // 4. Hero Distance Highlight
    const distY = mapY + mapH + (aspectRatio === 'story' ? 120 : 80);
    const kmValue = (workout.distance_meters / 1000).toFixed(2);

    ctx.save();
    ctx.font = '900 130px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 208, 156, 0.3)';
    ctx.shadowBlur = 24;
    ctx.fillText(`${kmValue}`, W / 2 - 40, distY);

    ctx.font = '900 48px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#00d09c';
    ctx.textAlign = 'left';
    ctx.fillText('KM', W / 2 + (kmValue.length > 4 ? 140 : 100), distY - 30);
    ctx.restore();

    // 5. Secondary Metrics Grid (Time, Pace, Calories, Elevation)
    const statsY = distY + (aspectRatio === 'story' ? 100 : 70);
    const boxW = (W - 240) / 4;
    const boxH = aspectRatio === 'story' ? 140 : 110;

    const metrics = [
      { label: 'TIME', value: formatDuration(workout.duration_seconds) },
      { label: 'AVG PACE', value: formatPace(workout.average_pace) },
      { label: 'CALORIES', value: `${Math.round(workout.calories)} kcal` },
      { label: 'ELEVATION', value: `+${Math.round(workout.elevation_gain)}m` },
    ];

    metrics.forEach((m, idx) => {
      const bx = 100 + idx * (boxW + 13);
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(bx, statsY, boxW, boxH, 24);
      ctx.fill();
      ctx.stroke();

      // Metric Label
      ctx.font = '800 20px Inter, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.textAlign = 'center';
      ctx.fillText(m.label, bx + boxW / 2, statsY + 36);

      // Metric Value
      ctx.font = '900 32px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(m.value, bx + boxW / 2, statsY + 86);
      ctx.restore();
    });

    // 6. Bottom Watermark & Slogan
    const botY = H - (aspectRatio === 'story' ? 140 : 80);
    ctx.save();
    ctx.font = 'italic 700 34px Georgia, serif';
    ctx.fillStyle = '#00d09c';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 208, 156, 0.4)';
    ctx.shadowBlur = 12;
    ctx.fillText('Every Run Counts', W / 2, botY);
    ctx.restore();
  }, [aspectRatio, theme, userBgImage, workout, drawRouteOnCanvas]);

  useEffect(() => {
    renderCard();
  }, [renderCard]);

  // Handle Photo Upload
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setUserBgImage(img);
        setTheme('photo');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Export & Download
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `runwar-workout-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Web Share API
  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSharing(true);

    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `runwar-workout.png`, { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'My Run on RunWar',
            text: `Just crushed a ${(workout.distance_meters / 1000).toFixed(2)} km run on RunWar! 🏃⚡`,
            files: [file],
          });
        } else {
          // Fallback to direct download
          handleDownload();
        }
        setSharing(false);
      }, 'image/png');
    } catch (err) {
      console.warn('Share error:', err);
      handleDownload();
      setSharing(false);
    }
  };

  // Copy Image to Clipboard
  const handleCopy = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    } catch (err) {
      console.warn('Copy to clipboard failed:', err);
      handleDownload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto select-none">
      <div className="bg-[#09151f] border border-slate-800 rounded-3xl max-w-xl w-full p-4 sm:p-6 shadow-2xl flex flex-col gap-4 text-white relative animate-fade-in my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[#00d09c]" />
            <h3 className="font-display font-black text-lg tracking-tight">Share Workout Story</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* Live Canvas Preview Card */}
        <div className="w-full flex justify-center py-1">
          <div
            className={`relative rounded-3xl overflow-hidden shadow-2xl border border-slate-700/50 bg-slate-950 flex items-center justify-center transition-all ${
              aspectRatio === 'story'
                ? 'w-[260px] h-[460px] sm:w-[280px] sm:h-[498px]'
                : 'w-[320px] h-[320px] sm:w-[360px] sm:h-[360px]'
            }`}
          >
            <canvas
              ref={canvasRef}
              className="w-full h-full object-contain rounded-3xl"
            />
          </div>
        </div>

        {/* Customization Controls */}
        <div className="space-y-3 pt-1">
          {/* Aspect Ratio Selector */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-400">Card Format:</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setAspectRatio('story')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                  aspectRatio === 'story'
                    ? 'bg-[#00d09c] text-slate-950 border-[#00d09c]'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone size={13} />
                <span>9:16 Story</span>
              </button>
              <button
                onClick={() => setAspectRatio('square')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-all ${
                  aspectRatio === 'square'
                    ? 'bg-[#00d09c] text-slate-950 border-[#00d09c]'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Square size={13} />
                <span>1:1 Post</span>
              </button>
            </div>
          </div>

          {/* Theme Palette Selector */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-400">Aesthetic:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTheme('midnight')}
                className={`w-7 h-7 rounded-full bg-[#09151f] border-2 transition-all ${
                  theme === 'midnight' ? 'border-[#00d09c] scale-110 shadow-glow-mint' : 'border-slate-700'
                }`}
                title="Neon Midnight"
              />
              <button
                onClick={() => setTheme('cyber')}
                className={`w-7 h-7 rounded-full bg-[#020617] border-2 transition-all ${
                  theme === 'cyber' ? 'border-lime-400 scale-110' : 'border-slate-700'
                }`}
                title="Cyber Slate"
              />
              <button
                onClick={() => setTheme('sunrise')}
                className={`w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-900 to-slate-800 border-2 transition-all ${
                  theme === 'sunrise' ? 'border-cyan-400 scale-110' : 'border-slate-700'
                }`}
                title="Sunrise Trail"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 border transition-all ${
                  theme === 'photo'
                    ? 'bg-[#00d09c]/20 border-[#00d09c] text-[#00d09c]'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
                title="Upload custom runner photo"
              >
                <Camera size={12} />
                <span>Photo</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-slate-800/80">
          <button
            onClick={handleCopy}
            className="py-3 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            {copied ? <Check size={14} className="text-[#00d09c]" /> : <Copy size={14} />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="py-3 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
          >
            <Download size={14} />
            <span>Download</span>
          </button>

          <button
            onClick={handleShare}
            disabled={sharing}
            className="py-3 px-3 rounded-2xl bg-[#00d09c] hover:bg-[#00ba8b] text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-[#00d09c]/25 active:scale-95 transition-all"
          >
            <Share2 size={14} strokeWidth={2.5} />
            <span>Share Story</span>
          </button>
        </div>
      </div>
    </div>
  );
};
