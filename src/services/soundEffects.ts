/**
 * Web Audio API Sound Effects Engine
 * Generates synthetic, latency-free audio chimes without external mp3 dependencies
 */

class SoundEffectsService {
  private ctx: AudioContext | null = null;
  private isEnabled: boolean = true;
  private volume: number = 0.8;

  constructor() {
    // Lazy initialize on first user gesture
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('runwar_sound_effects_enabled');
        if (saved !== null) {
          this.isEnabled = saved === 'true';
        }
      } catch {}
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    try {
      localStorage.setItem('runwar_sound_effects_enabled', String(enabled));
    } catch {}
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  /**
   * Play a clean sine tone with attack and exponential decay
   */
  private playTone(frequency: number, duration: number, delay: number = 0, type: OscillatorType = 'sine') {
    if (!this.isEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(this.volume * 0.25, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + duration + 0.05);
    } catch (e) {
      // AudioContext play error ignored
    }
  }

  /**
   * Countdown pip (3, 2, 1)
   */
  public playCountdownPip() {
    this.playTone(440, 0.08, 0, 'triangle');
  }

  /**
   * Countdown GO!
   */
  public playCountdownGo() {
    this.playTone(880, 0.28, 0, 'sine');
    this.playTone(1174, 0.28, 0.04, 'triangle');
  }

  /**
   * Workout Start: energetic ascending chime
   */
  public playStart() {
    this.playTone(523.25, 0.12, 0, 'triangle'); // C5
    this.playTone(659.25, 0.12, 0.08, 'triangle'); // E5
    this.playTone(783.99, 0.25, 0.16, 'sine'); // G5
  }

  /**
   * Workout Pause: gentle descending chime
   */
  public playPause() {
    this.playTone(587.33, 0.12, 0, 'sine'); // D5
    this.playTone(440.0, 0.2, 0.09, 'sine'); // A4
  }

  /**
   * Workout Resume: energetic rising chime
   */
  public playResume() {
    this.playTone(440.0, 0.1, 0, 'sine'); // A4
    this.playTone(659.25, 0.2, 0.08, 'sine'); // E5
  }

  /**
   * Milestone Split Reached: resonant double bell
   */
  public playMilestone() {
    this.playTone(659.25, 0.25, 0, 'sine'); // E5
    this.playTone(880.0, 0.35, 0.1, 'sine'); // A5
    this.playTone(1046.5, 0.45, 0.2, 'triangle'); // C6
  }

  /**
   * Workout Completed: celebratory victory fanfare
   */
  public playFinishFanfare() {
    this.playTone(523.25, 0.14, 0, 'triangle'); // C5
    this.playTone(659.25, 0.14, 0.1, 'triangle'); // E5
    this.playTone(783.99, 0.14, 0.2, 'triangle'); // G5
    this.playTone(1046.5, 0.45, 0.3, 'sine'); // C6
  }
}

export const soundEffects = new SoundEffectsService();
