import { formatDistance, formatDuration, formatPace } from '../utils/formatters';

class MediaSessionManager {
  private isSupported: boolean = typeof navigator !== 'undefined' && 'mediaSession' in navigator;
  private audioCtx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isRunning: boolean = false;
  private workoutType: string = 'Run';
  private onPlayCallback: (() => void) | null = null;
  private onPauseCallback: (() => void) | null = null;

  /**
   * Start silent audio carrier and initialize Media Session
   */
  public startSession(
    workoutType: string = 'Run',
    onPlay?: () => void,
    onPause?: () => void
  ) {
    if (!this.isSupported) return;

    this.workoutType = workoutType.toUpperCase();
    this.onPlayCallback = onPlay || null;
    this.onPauseCallback = onPause || null;
    this.isRunning = true;

    try {
      // Start a silent Web Audio loop to maintain media session on iOS & Android lock screens
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        if (!this.audioCtx || this.audioCtx.state === 'closed') {
          this.audioCtx = new AudioContextClass();
        }

        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }

        // Silent oscillator
        this.oscillator = this.audioCtx.createOscillator();
        this.gainNode = this.audioCtx.createGain();
        this.gainNode.gain.setValueAtTime(0.0001, this.audioCtx.currentTime); // Inaudible
        this.oscillator.connect(this.gainNode);
        this.gainNode.connect(this.audioCtx.destination);
        this.oscillator.start();
      }
    } catch (err) {
      console.warn('Could not initialize audio carrier for MediaSession:', err);
    }

    this.setupActionHandlers();
    this.updateTelemetry(0, 0, 0, 0, false);
  }

  private setupActionHandlers() {
    if (!this.isSupported) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        if (this.onPlayCallback) this.onPlayCallback();
        navigator.mediaSession.playbackState = 'playing';
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        if (this.onPauseCallback) this.onPauseCallback();
        navigator.mediaSession.playbackState = 'paused';
      });

      navigator.mediaSession.setActionHandler('stop', () => {
        if (this.onPauseCallback) this.onPauseCallback();
        navigator.mediaSession.playbackState = 'paused';
      });
    } catch (err) {
      console.warn('Error setting up MediaSession action handlers:', err);
    }
  }

  /**
   * Dynamically update lock screen telemetry metadata
   */
  public updateTelemetry(
    distanceMeters: number,
    elapsedSeconds: number,
    currentPaceSecPerKm: number,
    calories: number,
    isPaused: boolean = false
  ) {
    if (!this.isSupported || !this.isRunning) return;

    const kmStr = (distanceMeters / 1000).toFixed(2);
    const paceStr = currentPaceSecPerKm > 0 ? formatPace(currentPaceSecPerKm) : '--:--';
    const timeStr = formatDuration(elapsedSeconds);

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `🏃 ${kmStr} km  •  ${paceStr}`,
        artist: `⏱️ ${timeStr}  •  🔥 ${Math.round(calories)} kcal`,
        album: `RUNWAR  •  ${this.workoutType} WORKOUT`,
        artwork: [
          { src: '/logo.png', sizes: '192x192', type: 'image/png' },
          { src: '/logo.png', sizes: '512x512', type: 'image/png' },
        ],
      });

      navigator.mediaSession.playbackState = isPaused ? 'paused' : 'playing';
    } catch (err) {
      // Ignore metadata update failures
    }
  }

  /**
   * End session and release audio context
   */
  public endSession() {
    this.isRunning = false;
    if (this.oscillator) {
      try {
        this.oscillator.stop();
        this.oscillator.disconnect();
      } catch (e) {}
      this.oscillator = null;
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close();
      } catch (e) {}
      this.audioCtx = null;
    }

    if (this.isSupported) {
      try {
        navigator.mediaSession.playbackState = 'none';
        navigator.mediaSession.metadata = null;
      } catch (e) {}
    }
  }
}

export const mediaSessionManager = new MediaSessionManager();
