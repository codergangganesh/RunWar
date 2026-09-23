import React, { useState, useEffect } from 'react';
import { Download, X, Share2, PlusSquare, Smartphone, Zap, Shield, Sparkles, Check } from 'lucide-react';

const PWA_DISMISSED_KEY = 'runwar_pwa_prompt_dismissed_until';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  useEffect(() => {
    // 1. Check if already running in standalone PWA mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 2. Check if user dismissed prompt recently (snooze for 5 days)
    const dismissedUntil = localStorage.getItem(PWA_DISMISSED_KEY);
    if (dismissedUntil && Number(dismissedUntil) > Date.now()) {
      return;
    }

    // 3. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/crios|fxios|optios|edgios/.test(userAgent);

    if (isIosDevice && isSafari && !isStandalone) {
      setIsIOS(true);
      // Wait a couple of seconds before showing to not disrupt initial load
      const timer = setTimeout(() => setIsVisible(true), 2500);
      return () => clearTimeout(timer);
    }

    // 4. Capture standard beforeinstallprompt (Android / Chrome / Edge)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after a short delay
      setTimeout(() => setIsVisible(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // 5. Track successful install
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsVisible(false);
      setInstalledSuccess(true);
      setTimeout(() => setInstalledSuccess(false), 3000);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsVisible(false);
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.warn('PWA install prompt error:', err);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Snooze for 5 days
    const snoozeTime = Date.now() + 5 * 24 * 60 * 60 * 1000;
    localStorage.setItem(PWA_DISMISSED_KEY, snoozeTime.toString());
  };

  if (isInstalled || !isVisible) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[90] animate-slide-up select-none">
      <div className="relative overflow-hidden rounded-3xl bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xl border border-emerald-500/30 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.6)] text-white">
        {/* Glow Accent */}
        <div className="absolute -top-10 -right-10 w-28 h-28 bg-[#00d09c]/20 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all"
          aria-label="Dismiss banner"
        >
          <X size={14} />
        </button>

        {/* Content */}
        <div className="flex items-start gap-3.5 pr-6">
          {/* App Logo */}
          <div className="relative shrink-0">
            <img
              src="/logo.png"
              alt="RunWar"
              className="w-12 h-12 rounded-2xl object-cover shadow-lg border border-emerald-400/40 p-0.5 bg-slate-900"
            />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[#00d09c] flex items-center justify-center text-slate-950">

            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <h4 className="font-display font-black text-sm text-white tracking-wide">
                Install RunWar App
              </h4>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-[#00d09c] text-[9px] font-bold uppercase tracking-wider">
                Fast & Free
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-snug">
              Get full-screen GPS tracking, offline runs & voice coach right from your home screen.
            </p>
          </div>
        </div>

        {/* Value Highlights */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 grid grid-cols-3 gap-1 text-[10px] text-slate-300 font-medium">
          <div className="flex items-center gap-1">
            <span className="text-emerald-400">✓</span> Fullscreen GPS
          </div>
          <div className="flex items-center gap-1">
            <span className="text-emerald-400">✓</span> Offline First
          </div>
          <div className="flex items-center gap-1">
            <span className="text-emerald-400">✓</span> Zero Lag
          </div>
        </div>

        {/* Action button */}
        <div className="mt-3 flex items-center gap-2">
          {isIOS ? (
            <div className="w-full bg-slate-800/90 rounded-xl p-2 px-3 border border-emerald-500/20 text-[11px] text-slate-200 flex items-center gap-2">
              <Share2 size={15} className="text-[#00d09c] shrink-0" />
              <span>
                Tap <strong className="text-white">Share</strong> then select{' '}
                <strong className="text-[#00d09c]">Add to Home Screen</strong>
              </span>
            </div>
          ) : (
            <>
              <button
                onClick={handleInstallClick}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#00d09c] to-emerald-500 hover:from-[#00b98a] hover:to-emerald-600 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#00d09c]/25 active:scale-95 transition-all"
              >
                <Download size={14} strokeWidth={2.5} />
                <span>Install Now</span>
              </button>
              <button
                onClick={handleDismiss}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs font-semibold active:scale-95 transition-all"
              >
                Not Now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
