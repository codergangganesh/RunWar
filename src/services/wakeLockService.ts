import { WakeLockStatus } from '../types';

type WakeLockListener = (status: WakeLockStatus) => void;

class WakeLockService {
  private sentinel: any = null;
  private isRequested: boolean = false;
  private listeners: Set<WakeLockListener> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private fallbackVideo: HTMLVideoElement | null = null;

  constructor() {
    this.initLifecycleListeners();
  }

  /**
   * Check if Screen Wake Lock API is supported by the user's browser
   */
  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  }

  /**
   * Get current Wake Lock status
   */
  public getStatus(): WakeLockStatus {
    const supported = this.isSupported();
    const active = !!(this.sentinel && !this.sentinel.released);
    return {
      isSupported: supported,
      isActive: active,
      error: !supported ? 'Wake Lock API not supported in this browser' : null,
    };
  }

  /**
   * Subscribe to wake lock status changes
   */
  public subscribe(listener: WakeLockListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const status = this.getStatus();
    this.listeners.forEach((fn) => {
      try {
        fn(status);
      } catch (err) {
        console.warn('WakeLock listener error:', err);
      }
    });
  }

  /**
   * Request a Screen Wake Lock to keep the display awake during workouts
   */
  public async requestLock(): Promise<boolean> {
    this.isRequested = true;

    if (!this.isSupported()) {
      this.enableFallbackKeepAlive();
      this.notify();
      return false;
    }

    try {
      if (this.sentinel && !this.sentinel.released) {
        this.notify();
        return true;
      }

      this.sentinel = await (navigator as any).wakeLock.request('screen');

      this.sentinel.addEventListener('release', () => {
        this.notify();
        // If release happened while the workout is still marked as active,
        // attempt automatic re-acquisition if the tab is visible
        if (
          this.isRequested &&
          typeof document !== 'undefined' &&
          document.visibilityState === 'visible'
        ) {
          this.requestLock().catch(() => {});
        }
      });

      this.startHeartbeat();
      this.notify();
      return true;
    } catch (err: any) {
      console.warn('Screen Wake Lock request failed:', err?.message || err);
      this.enableFallbackKeepAlive();
      this.notify();
      return false;
    }
  }

  /**
   * Release the wake lock sentinel cleanly
   */
  public async releaseLock(): Promise<void> {
    this.isRequested = false;
    this.stopHeartbeat();
    this.disableFallbackKeepAlive();

    if (this.sentinel) {
      try {
        await this.sentinel.release();
      } catch (err) {
        // Ignore release errors
      } finally {
        this.sentinel = null;
      }
    }
    this.notify();
  }

  /**
   * Fallback for iOS Safari or older browsers where navigator.wakeLock is unavailable
   * Uses an invisible micro-looping canvas / video element to prevent screen sleep
   */
  private enableFallbackKeepAlive() {
    if (typeof document === 'undefined' || this.fallbackVideo) return;
    try {
      const video = document.createElement('video');
      video.setAttribute('playsinline', '');
      video.setAttribute('muted', '');
      video.muted = true;
      video.loop = true;
      video.style.position = 'fixed';
      video.style.opacity = '0.001';
      video.style.pointerEvents = 'none';
      video.style.width = '1px';
      video.style.height = '1px';
      video.style.bottom = '0';
      video.style.right = '0';

      // Lightweight 1-frame blank WebM data URI
      video.src = 'data:video/webm;base64,GkXfo0AgQoaBAUL3gQFC8oEEQvOBCEKCQAR3ZWJtQoeBAkKFgQIYUkoAkExhbGlzdGVuZXIAQUZ4Zg==';
      video.play().catch(() => {});
      document.body.appendChild(video);
      this.fallbackVideo = video;
    } catch (e) {
      // Ignore fallback errors
    }
  }

  private disableFallbackKeepAlive() {
    if (this.fallbackVideo) {
      try {
        this.fallbackVideo.pause();
        this.fallbackVideo.remove();
      } catch (e) {
        // Ignore
      }
      this.fallbackVideo = null;
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.isRequested && (!this.sentinel || this.sentinel.released)) {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          this.requestLock().catch(() => {});
        }
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private initLifecycleListeners() {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isRequested) {
        this.requestLock().catch(() => {});
      }
    });

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        if (this.isRequested) {
          this.requestLock().catch(() => {});
        }
      });
    }
  }
}

export const wakeLockService = new WakeLockService();
