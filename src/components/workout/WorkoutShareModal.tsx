import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { GPSCoordinate, Workout } from '../../types';
import { formatDuration, formatPace } from '../../utils/formatters';
import {
  ArrowLeft,
  RotateCcw,
  Download,
  Share2,
  Copy,
  MoreHorizontal,
  Check,
  Camera,
  Smartphone,
  Square,
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
type ThemeStyle = 'default' | 'dark' | 'sunrise' | 'minimal' | 'photo';

// Helper: Draw crisp athletic runner silhouette directly on canvas
const drawRunnerSilhouette = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string = '#ffffff'
) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = size * 0.12;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Head
  ctx.beginPath();
  ctx.arc(cx + size * 0.08, cy - size * 0.28, size * 0.12, 0, Math.PI * 2);
  ctx.fill();

  // Torso (forward running angle)
  ctx.beginPath();
  ctx.moveTo(cx + size * 0.05, cy - size * 0.14);
  ctx.lineTo(cx - size * 0.06, cy + size * 0.08);
  ctx.stroke();

  // Front Arm (swinging forward & bent)
  ctx.beginPath();
  ctx.moveTo(cx + size * 0.04, cy - size * 0.1);
  ctx.lineTo(cx + size * 0.18, cy - size * 0.02);
  ctx.lineTo(cx + size * 0.24, cy - size * 0.16);
  ctx.stroke();

  // Back Arm (swinging back & bent)
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.01, cy - size * 0.08);
  ctx.lineTo(cx - size * 0.18, cy + size * 0.02);
  ctx.lineTo(cx - size * 0.22, cy + size * 0.16);
  ctx.stroke();

  // Front Leg (high knee bent)
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.06, cy + size * 0.08);
  ctx.lineTo(cx + size * 0.16, cy + size * 0.16);
  ctx.lineTo(cx + size * 0.12, cy + size * 0.38);
  ctx.stroke();

  // Back Leg (striding back)
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.06, cy + size * 0.08);
  ctx.lineTo(cx - size * 0.18, cy + size * 0.2);
  ctx.lineTo(cx - size * 0.3, cy + size * 0.34);
  ctx.stroke();

  ctx.restore();
};

export const WorkoutShareModal: React.FC<WorkoutShareModalProps> = ({
  workout,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('story');
  const [theme, setTheme] = useState<ThemeStyle>('default');
  const [userBgImage, setUserBgImage] = useState<HTMLImageElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Lock body scroll when open
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, []);

  // Draw background themes
  const drawBackground = useCallback(
    (ctx: CanvasRenderingContext2D, W: number, H: number) => {
      if (theme === 'photo' && userBgImage) {
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

        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, 'rgba(8, 24, 18, 0.75)');
        grad.addColorStop(0.45, 'rgba(8, 24, 18, 0.45)');
        grad.addColorStop(1, 'rgba(4, 14, 10, 0.92)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
        return;
      }

      if (theme === 'default') {
        // Forest Lake Satellite Aerial Landscape
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#0a271d');
        grad.addColorStop(0.3, '#113a2c');
        grad.addColorStop(0.65, '#0b261e');
        grad.addColorStop(1, '#04120e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        // Lake Water Basin in Center
        ctx.beginPath();
        ctx.ellipse(W * 0.5, H * 0.44, W * 0.38, H * 0.17, -0.06, 0, Math.PI * 2);
        const lakeGrad = ctx.createRadialGradient(W * 0.48, H * 0.43, 30, W * 0.5, H * 0.44, W * 0.38);
        lakeGrad.addColorStop(0, '#1c5a69');
        lakeGrad.addColorStop(0.6, '#0f3844');
        lakeGrad.addColorStop(1, '#08232b');
        ctx.fillStyle = lakeGrad;
        ctx.fill();

        // Lush Forest Shoreline
        ctx.lineWidth = 20;
        ctx.strokeStyle = '#1a4738';
        ctx.stroke();

        // Misty Forest Hills Base
        const hillGrad = ctx.createLinearGradient(0, H * 0.65, 0, H);
        hillGrad.addColorStop(0, 'rgba(6, 24, 18, 0)');
        hillGrad.addColorStop(0.5, 'rgba(4, 18, 14, 0.85)');
        hillGrad.addColorStop(1, '#030e0b');
        ctx.fillStyle = hillGrad;
        ctx.fillRect(0, H * 0.65, W, H * 0.35);

        // Mountain Silhouettes
        ctx.fillStyle = 'rgba(2, 10, 8, 0.65)';
        ctx.beginPath();
        ctx.moveTo(0, H * 0.78);
        ctx.lineTo(W * 0.28, H * 0.71);
        ctx.lineTo(W * 0.62, H * 0.76);
        ctx.lineTo(W * 0.88, H * 0.69);
        ctx.lineTo(W, H * 0.74);
        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.fill();
        ctx.restore();
      } else if (theme === 'dark') {
        // Midnight Mountain Sky
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#0a101d');
        grad.addColorStop(0.5, '#0f172a');
        grad.addColorStop(1, '#020617');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = '#060d1b';
        ctx.beginPath();
        ctx.moveTo(0, H * 0.6);
        ctx.lineTo(W * 0.38, H * 0.42);
        ctx.lineTo(W * 0.7, H * 0.52);
        ctx.lineTo(W, H * 0.43);
        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.fill();
      } else if (theme === 'sunrise') {
        // Sunset / Sunrise Orange Mountains
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#f97316');
        grad.addColorStop(0.35, '#ea580c');
        grad.addColorStop(0.65, '#9a3412');
        grad.addColorStop(1, '#381005');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Sun disc
        ctx.save();
        ctx.beginPath();
        ctx.arc(W * 0.5, H * 0.42, 90, 0, Math.PI * 2);
        ctx.fillStyle = '#ffedd5';
        ctx.shadowColor = '#fb923c';
        ctx.shadowBlur = 40;
        ctx.fill();

        ctx.fillStyle = '#7c2d12';
        ctx.beginPath();
        ctx.moveTo(0, H * 0.52);
        ctx.lineTo(W * 0.35, H * 0.44);
        ctx.lineTo(W * 0.65, H * 0.5);
        ctx.lineTo(W, H * 0.41);
        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.fill();
        ctx.restore();
      } else if (theme === 'minimal') {
        // Minimal Mint Landscape
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#eaf8f1');
        grad.addColorStop(0.4, '#d0ecdc');
        grad.addColorStop(1, '#aedbc5');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        ctx.fillStyle = '#8dcab2';
        ctx.beginPath();
        ctx.moveTo(0, H * 0.54);
        ctx.quadraticCurveTo(W * 0.4, H * 0.44, W * 0.7, H * 0.52);
        ctx.quadraticCurveTo(W * 0.85, H * 0.47, W, H * 0.5);
        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.fill();
      } else if (theme === 'photo') {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#1e3a8a');
        grad.addColorStop(0.5, '#0f766e');
        grad.addColorStop(1, '#042f2e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }
    },
    [theme, userBgImage]
  );

  // Normalize and draw GPS coordinates on canvas
  const drawRouteOnCanvas = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      coords: GPSCoordinate[],
      x: number,
      y: number,
      width: number,
      height: number
    ) => {
      if (!coords || coords.length < 2) {
        // Aesthetic loop running trail
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = '#00d09c';
        ctx.shadowBlur = 24;

        ctx.moveTo(x + width * 0.2, y + height * 0.65);
        ctx.bezierCurveTo(
          x + width * 0.16,
          y + height * 0.22,
          x + width * 0.82,
          y + height * 0.14,
          x + width * 0.8,
          y + height * 0.48
        );
        ctx.bezierCurveTo(
          x + width * 0.78,
          y + height * 0.82,
          x + width * 0.38,
          y + height * 0.84,
          x + width * 0.2,
          y + height * 0.65
        );
        ctx.stroke();

        // Start Marker & Badge
        const sX = x + width * 0.2;
        const sY = y + height * 0.65;
        ctx.beginPath();
        ctx.arc(sX, sY, 15, 0, Math.PI * 2);
        ctx.fillStyle = '#00d09c';
        ctx.fill();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        // Start Pill Badge
        ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
        ctx.beginPath();
        ctx.roundRect(sX + 22, sY - 17, 80, 34, 17);
        ctx.fill();
        ctx.font = '800 17px Outfit, Inter, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Start', sX + 62, sY);

        // Finish Marker & Badge
        const fX = x + width * 0.78;
        const fY = y + height * 0.26;
        ctx.beginPath();
        ctx.arc(fX, fY, 15, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();

        // Finish Pill Badge
        ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
        ctx.beginPath();
        ctx.roundRect(fX + 22, fY - 17, 88, 34, 17);
        ctx.fill();
        ctx.font = '800 17px Outfit, Inter, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Finish', fX + 66, fY);

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

      const pad = 44;
      const drawW = width - pad * 2;
      const drawH = height - pad * 2;

      const points = coords.map((c) => {
        const px = x + pad + ((c.longitude - minLng) / lngRange) * drawW;
        const py = y + height - pad - ((c.latitude - minLat) / latRange) * drawH;
        return { x: px, y: py };
      });

      ctx.save();

      // Outer Cyan-Green Athletic Glow
      ctx.beginPath();
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = '#00d09c';
      ctx.shadowBlur = 26;
      ctx.globalAlpha = 0.45;
      points.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      // Solid Main Route Line
      ctx.globalAlpha = 1.0;
      ctx.beginPath();
      ctx.strokeStyle = '#00d09c';
      ctx.lineWidth = 7;
      points.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      // Start Marker
      const start = points[0];
      ctx.beginPath();
      ctx.arc(start.x, start.y, 15, 0, Math.PI * 2);
      ctx.fillStyle = '#00d09c';
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
      ctx.beginPath();
      ctx.roundRect(start.x + 20, start.y - 17, 80, 34, 17);
      ctx.fill();
      ctx.font = '800 17px Outfit, Inter, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Start', start.x + 60, start.y);

      // Finish Marker
      const end = points[points.length - 1];
      ctx.beginPath();
      ctx.arc(end.x, end.y, 15, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.fillStyle = 'rgba(0, 0, 0, 0.82)';
      ctx.beginPath();
      ctx.roundRect(end.x + 20, end.y - 17, 88, 34, 17);
      ctx.fill();
      ctx.font = '800 17px Outfit, Inter, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Finish', end.x + 64, end.y);

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

    const isStory = aspectRatio === 'story';
    const W = 1080;
    const H = isStory ? 1920 : 1080;

    canvas.width = W;
    canvas.height = H;

    // 1. Draw Background
    drawBackground(ctx, W, H);

    // 2. Top Header (Brand Logo, Name, Date & Time)
    const topPadding = isStory ? 110 : 50;
    const logoX = isStory ? 135 : 105;
    const logoY = isStory ? topPadding + 22 : topPadding + 28;
    const logoR = isStory ? 44 : 34;

    ctx.save();
    // Green Circular Brand Runner Badge
    ctx.beginPath();
    ctx.arc(logoX, logoY, logoR, 0, Math.PI * 2);
    ctx.fillStyle = '#059669';
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Crisp Vector Runner Silhouette
    drawRunnerSilhouette(ctx, logoX, logoY, isStory ? 42 : 32, '#ffffff');

    // RUNWAR Bold Brand Title
    const brandX = isStory ? 196 : 155;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = isStory ? '900 52px Outfit, Inter, sans-serif' : '900 36px Outfit, Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('RUNWAR', brandX, isStory ? topPadding + 24 : topPadding + 24);

    ctx.font = isStory ? '800 20px Outfit, Inter, sans-serif' : '800 14px Outfit, Inter, sans-serif';
    ctx.fillStyle = '#00d09c';
    ctx.fillText('RUN. TRACK. IMPROVE.', brandX, isStory ? topPadding + 52 : topPadding + 46);

    // Top Right Date & Time
    const workoutDate = workout.started_at ? new Date(workout.started_at) : new Date();
    const dateStr = workoutDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timeStr = `${workoutDate.toLocaleDateString('en-US', { weekday: 'short' })} • ${workoutDate.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })}`;

    const dateRightX = isStory ? W - 90 : W - 70;
    ctx.textAlign = 'right';
    ctx.font = isStory ? '800 26px Outfit, Inter, sans-serif' : '800 20px Outfit, Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(dateStr, dateRightX, isStory ? topPadding + 14 : topPadding + 18);

    ctx.font = isStory ? '700 22px Outfit, Inter, sans-serif' : '700 15px Outfit, Inter, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText(timeStr, dateRightX, isStory ? topPadding + 44 : topPadding + 42);
    ctx.restore();

    // 3. Hero Distance & Subtitle (Clean, Spaced, NEVER OVERLAPPING)
    const distY = isStory ? 325 : 210;
    const kmValue = (workout.distance_meters / 1000).toFixed(2);
    const heroLeftX = isStory ? 90 : 70;

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = isStory ? '900 130px Outfit, Inter, sans-serif' : '900 90px Outfit, Inter, sans-serif';

    // Measure distance text width with actual font
    const numberWidth = ctx.measureText(kmValue).width;

    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 208, 156, 0.45)';
    ctx.shadowBlur = isStory ? 24 : 18;
    ctx.fillText(kmValue, heroLeftX, distY);

    // KM unit positioned after the number
    ctx.font = isStory ? '900 50px Outfit, Inter, sans-serif' : '900 36px Outfit, Inter, sans-serif';
    ctx.fillStyle = '#00d09c';
    ctx.shadowBlur = 0;
    ctx.fillText('KM', heroLeftX + numberWidth + (isStory ? 20 : 14), distY - (isStory ? 24 : 16));

    // Subtitle
    ctx.font = isStory ? '700 28px Inter, sans-serif' : '700 19px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText('A step closer to a healthier you!', heroLeftX, distY + (isStory ? 48 : 34));

    // Green Underline Accent Bar
    ctx.fillStyle = '#00d09c';
    ctx.beginPath();
    ctx.roundRect(heroLeftX, distY + (isStory ? 68 : 46), isStory ? 88 : 68, isStory ? 6 : 5, 2.5);
    ctx.fill();
    ctx.restore();

    // 4. Center Route Polyline Map Area
    const mapY = isStory ? 445 : 285;
    const mapW = isStory ? W - 180 : W - 140;
    const mapH = isStory ? 750 : 390;
    const mapX = isStory ? 90 : 70;

    // Route title watermark in center of loop
    if (theme === 'default') {
      ctx.save();
      ctx.font = isStory
        ? 'italic 700 30px "Playfair Display", Outfit, Inter, sans-serif'
        : 'italic 700 24px "Playfair Display", Outfit, Inter, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(workout.title || 'Jog Session', W / 2, mapY + mapH * 0.44);
      ctx.restore();
    }

    drawRouteOnCanvas(ctx, workout.route_coordinates || [], mapX, mapY, mapW, mapH);

    // 5. Glassmorphic 4-Column Stats Box
    const statsY = isStory ? 1265 : 700;
    const boxW = isStory ? W - 180 : W - 140;
    const boxH = isStory ? 160 : 120;
    const boxX = isStory ? 90 : 70;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(boxX, statsY, boxW, boxH, isStory ? 28 : 24);
    ctx.fill();
    ctx.stroke();

    const colW = boxW / 4;
    const paceDisplay = workout.average_pace > 0 ? `${formatPace(workout.average_pace)} /km` : '--:-- /km';

    const metrics = [
      { label: 'Time', val: formatDuration(workout.duration_seconds), icon: '⏱' },
      { label: 'Avg Pace', val: paceDisplay, icon: '⚡' },
      { label: 'Calories', val: `${Math.round(workout.calories)} kcal`, icon: '🔥' },
      { label: 'Elevation', val: `+${Math.round(workout.elevation_gain || 0)} m`, icon: '⛰' },
    ];

    metrics.forEach((m, idx) => {
      const cx = boxX + idx * colW + colW / 2;

      // Divider lines between columns
      if (idx > 0) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(boxX + idx * colW, statsY + (isStory ? 24 : 18));
        ctx.lineTo(boxX + idx * colW, statsY + boxH - (isStory ? 24 : 18));
        ctx.stroke();
      }

      // Icon & Label
      ctx.font = isStory ? '800 22px Outfit, Inter, sans-serif' : '800 17px Outfit, Inter, sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`${m.icon} ${m.label}`, cx, statsY + (isStory ? 54 : 40));

      // Value
      ctx.font = isStory ? '900 30px Outfit, Inter, sans-serif' : '900 23px Outfit, Inter, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(m.val, cx, statsY + (isStory ? 112 : 88));
    });
    ctx.restore();

    // 6. Bottom Handwritten Slogan & Discover Tag
    const botY = isStory ? 1810 : 995;
    const botLeftX = isStory ? 100 : 75;
    const botRightX = isStory ? W - 100 : W - 75;

    ctx.save();
    // Left: "Every Run Counts" in elegant serif cursive
    ctx.font = isStory
      ? 'italic 700 48px "Playfair Display", Georgia, serif'
      : 'italic 700 36px "Playfair Display", Georgia, serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = 'rgba(0, 208, 156, 0.5)';
    ctx.shadowBlur = 12;
    ctx.fillText('Every Run Counts', botLeftX, botY);

    // Green swoosh curve under slogan
    ctx.beginPath();
    ctx.strokeStyle = '#00d09c';
    ctx.lineWidth = isStory ? 5 : 4;
    ctx.lineCap = 'round';
    if (isStory) {
      ctx.moveTo(160, botY + 24);
      ctx.quadraticCurveTo(280, botY + 44, 380, botY + 12);
    } else {
      ctx.moveTo(120, botY + 18);
      ctx.quadraticCurveTo(210, botY + 32, 290, botY + 10);
    }
    ctx.stroke();

    // Right: "DISCOVER STRONGER YOU"
    ctx.textAlign = 'right';
    ctx.font = isStory ? '800 20px Outfit, Inter, sans-serif' : '800 15px Outfit, Inter, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillText('DISCOVER', botRightX, isStory ? botY - 14 : botY - 12);
    ctx.fillText('STRONGER YOU', botRightX, isStory ? botY + 12 : botY + 8);

    ctx.fillStyle = '#00d09c';
    ctx.beginPath();
    ctx.roundRect(botRightX - (isStory ? 60 : 48), botY + (isStory ? 22 : 16), isStory ? 60 : 48, isStory ? 5 : 4, 2);
    ctx.fill();
    ctx.restore();
  }, [aspectRatio, theme, workout, drawBackground, drawRouteOnCanvas]);

  useEffect(() => {
    if (document.fonts) {
      document.fonts.ready.then(() => {
        renderCard();
      });
    }
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
    link.download = `runwar-story-${Date.now()}.png`;
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
        const file = new File([blob], `runwar-story.png`, { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'My Run on RunWar',
            text: `Just crushed a ${(workout.distance_meters / 1000).toFixed(2)} km run on RunWar! 🏃⚡`,
            files: [file],
          });
        } else {
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

  const themeOptions: { id: ThemeStyle; label: string; previewBg: string; isPhoto?: boolean }[] = [
    { id: 'default', label: 'Default', previewBg: 'bg-gradient-to-tr from-emerald-900 to-teal-800' },
    { id: 'dark', label: 'Dark', previewBg: 'bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950' },
    { id: 'sunrise', label: 'Sunrise', previewBg: 'bg-gradient-to-tr from-orange-600 via-amber-500 to-yellow-400' },
    { id: 'minimal', label: 'Minimal', previewBg: 'bg-gradient-to-tr from-emerald-100 to-teal-200 text-emerald-900' },
    { id: 'photo', label: 'Photo', previewBg: 'bg-gradient-to-tr from-sky-800 to-teal-900', isPhoto: true },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] bg-[#eef8f4] dark:bg-slate-950 flex flex-col h-[100dvh] max-h-[100dvh] w-full overflow-hidden touch-none select-none overscroll-none animate-fade-in"
      onTouchMove={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Strict Viewport Frame */}
      <div className="max-w-md md:max-w-lg w-full h-full max-h-full mx-auto flex flex-col justify-between overflow-hidden p-3.5 sm:p-4 space-y-2.5">

        {/* Top Header Bar */}
        <header className="h-12 shrink-0 flex items-center justify-between">
          {/* Back Button */}
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-emerald-100/80 dark:border-slate-800 text-emerald-900 dark:text-white flex items-center justify-center shadow-sm active:scale-90 transition-all hover:border-emerald-400"
            aria-label="Go back"
            title="Go back"
          >
            <ArrowLeft size={18} />
          </button>

          {/* Title & Subtitle */}
          <div className="text-center">
            <h1 className="font-display font-black text-base sm:text-lg tracking-tight text-emerald-950 dark:text-white leading-tight">
              Share Workout Story
            </h1>
            <p className="text-[11px] text-emerald-700/80 dark:text-slate-400 font-medium">
              Save and share your achievement
            </p>
          </div>

          {/* Refresh / Theme Flip Button */}
          <button
            onClick={() => {
              const themes: ThemeStyle[] = ['default', 'dark', 'sunrise', 'minimal'];
              const nextIndex = (themes.indexOf(theme) + 1) % themes.length;
              setTheme(themes[nextIndex]);
            }}
            className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-emerald-100/80 dark:border-slate-800 text-emerald-900 dark:text-white flex items-center justify-center shadow-sm active:scale-90 transition-all hover:border-emerald-400"
            aria-label="Refresh Theme"
            title="Switch Aesthetic"
          >
            <RotateCcw size={16} />
          </button>
        </header>

        {/* Center Main Story Card Preview */}
        <main className="flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden py-1">
          <div
            className={`h-full max-h-full w-auto flex items-center justify-center rounded-[28px] sm:rounded-[32px] overflow-hidden shadow-2xl border border-emerald-200/60 dark:border-slate-800 bg-slate-950 transition-all ${aspectRatio === 'story' ? 'aspect-[9/16]' : 'aspect-square'
              }`}
          >
            <canvas
              ref={canvasRef}
              className="h-full w-full object-contain rounded-[28px] sm:rounded-[32px]"
            />
          </div>
        </main>

        {/* Controls Section */}
        <footer className="shrink-0 space-y-2.5">
          {/* 1. Theme Aesthetic Thumbnail Cards (5 Options) */}
          <div className="flex items-center justify-between gap-2 px-0.5">
            {themeOptions.map((opt) => {
              const isSelected = theme === opt.id;
              return (
                <div key={opt.id} className="flex flex-col items-center gap-1 flex-1">
                  <button
                    onClick={() => {
                      if (opt.isPhoto) {
                        fileInputRef.current?.click();
                      } else {
                        setTheme(opt.id);
                      }
                    }}
                    className={`relative w-full h-12 rounded-2xl overflow-hidden border-2 transition-all shadow-sm ${opt.previewBg} flex items-center justify-center ${isSelected
                      ? 'border-emerald-500 ring-2 ring-emerald-500/30 scale-105'
                      : 'border-transparent hover:opacity-90 opacity-80'
                      }`}
                  >
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}
                    {opt.isPhoto && !isSelected && (
                      <Camera size={15} className="text-white/80" />
                    )}
                  </button>
                  <span
                    className={`text-[10px] font-bold tracking-tight ${isSelected ? 'text-emerald-950 dark:text-emerald-400 font-extrabold' : 'text-slate-500 dark:text-slate-400'
                      }`}
                  >
                    {opt.label}
                  </span>
                </div>
              );
            })}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </div>

          {/* 2. Format Toggle (Side-by-Side Wide Pill Buttons) */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => setAspectRatio('story')}
              className={`py-2.5 px-3 rounded-2xl font-bold flex items-center justify-center gap-2 border text-xs transition-all ${aspectRatio === 'story'
                ? 'bg-white dark:bg-slate-900 border-2 border-emerald-500 text-emerald-900 dark:text-white shadow-sm'
                : 'bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
            >
              <Smartphone size={14} className={aspectRatio === 'story' ? 'text-emerald-600' : ''} />
              <span>Story (9:16)</span>
            </button>

            <button
              onClick={() => setAspectRatio('square')}
              className={`py-2.5 px-3 rounded-2xl font-bold flex items-center justify-center gap-2 border text-xs transition-all ${aspectRatio === 'square'
                ? 'bg-white dark:bg-slate-900 border-2 border-emerald-500 text-emerald-900 dark:text-white shadow-sm'
                : 'bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
            >
              <Square size={14} className={aspectRatio === 'square' ? 'text-emerald-600' : ''} />
              <span>Square (1:1)</span>
            </button>
          </div>

          {/* 3. Action Buttons (Download, Big Green Share, Copy, More) */}
          <div className="flex items-center justify-between gap-2.5 pt-0.5">
            {/* Download */}
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={handleDownload}
                className="w-12 h-12 rounded-full bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-sm active:scale-90 transition-all hover:text-emerald-600"
                title="Download PNG"
              >
                <Download size={18} />
              </button>
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Download</span>
            </div>

            {/* Big Green Share Button */}
            <button
              onClick={handleShare}
              disabled={sharing}
              className="flex-1 h-12 rounded-full bg-[#00875a] hover:bg-[#00744d] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/25 active:scale-95 transition-all"
            >
              <Share2 size={18} strokeWidth={2.5} />
              <span>Share</span>
            </button>

            {/* Copy */}
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={handleCopy}
                className="w-12 h-12 rounded-full bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-sm active:scale-90 transition-all hover:text-emerald-600"
                title="Copy Image"
              >
                {copied ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
              </button>
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                {copied ? 'Copied!' : 'Copy'}
              </span>
            </div>

            {/* More */}

          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
};
