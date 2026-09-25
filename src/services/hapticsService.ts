/**
 * Haptic Feedback Service
 * Provides distinct vibrational signatures for running events using navigator.vibrate
 */

class HapticsService {
  private isEnabled: boolean = true;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('runwar_haptics_enabled');
        if (saved !== null) {
          this.isEnabled = saved === 'true';
        }
      } catch {}
    }
  }

  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'vibrate' in navigator;
  }

  public setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    try {
      localStorage.setItem('runwar_haptics_enabled', String(enabled));
    } catch {}
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  private vibrate(pattern: number | number[]) {
    if (!this.isEnabled || !this.isSupported()) return;
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // Ignore vibration errors
    }
  }

  /**
   * Split milestone reached: distinct double-pulse
   */
  public vibrateMilestone() {
    this.vibrate([120, 80, 120]);
  }

  /**
   * Auto-paused: prominent warning pulse
   */
  public vibratePause() {
    this.vibrate([220]);
  }

  /**
   * Resumed: rapid double-tap
   */
  public vibrateResume() {
    this.vibrate([80, 50, 80]);
  }

  /**
   * Countdown tick (3, 2, 1)
   */
  public vibrateCountdown() {
    this.vibrate([40]);
  }

  /**
   * Countdown GO!
   */
  public vibrateCountdownGo() {
    this.vibrate([200]);
  }

  /**
   * Workout Finished: celebratory cadence
   */
  public vibrateFinish() {
    this.vibrate([100, 60, 120, 60, 250]);
  }

  /**
   * User interaction or micro-tap
   */
  public vibrateTap() {
    this.vibrate([15]);
  }

  /**
   * Alert or pace deviation
   */
  public vibrateWarning() {
    this.vibrate([150, 100, 150]);
  }
}

export const hapticsService = new HapticsService();
