/**
 * Procedural Web Audio Engine for Tether & Walkie-Talkie
 * Synthesizes authentic radio chirps, squelch noise tails, and harmonic tension chimes
 * without requiring external MP3 audio asset files.
 */

class TetherAudioEngine {
  private ctx: AudioContext | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
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
    } catch {
      return null;
    }
  }

  /**
   * Play the classic F1 / Walkie-Talkie "Chirp In" sound effect (incoming transmission)
   */
  playRadioChirpIn(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Fast dual-tone chirp
      osc.frequency.setValueAtTime(1420, now);
      osc.frequency.exponentialRampToValueAtTime(1980, now + 0.04);
      osc.frequency.setValueAtTime(2150, now + 0.045);
      osc.frequency.exponentialRampToValueAtTime(2450, now + 0.08);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.015);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.075);
      gain.gain.linearRampToValueAtTime(0.001, now + 0.095);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // AudioContext blocked by user policy
    }
  }

  /**
   * Play the classic Walkie-Talkie "Chirp Out / Squelch Tail" static burst
   */
  playRadioChirpOut(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const bufferSize = ctx.sampleRate * 0.06; // 60ms noise
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.Q.setValueAtTime(1.5, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start(now);
      noise.stop(now + 0.065);
    } catch {
      // Ignored
    }
  }

  /**
   * Play harmonic tension chime when buddy pulls away or rejoins
   */
  playTetherAlert(type: 'stretch' | 'break' | 'reconnected' | 'milestone'): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === 'stretch') {
        // Warning dual ping
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(783.99, now + 0.08); // G5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.23);
      } else if (type === 'break') {
        // High alert descent
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.2);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.23);
      } else if (type === 'reconnected') {
        // Welcoming upward chord
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.07); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.14); // G5
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'milestone') {
        // Victory chime
        osc.type = 'sine';
        osc.frequency.setValueAtTime(659.25, now); // E5
        osc.frequency.setValueAtTime(987.77, now + 0.08); // B5
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.36);
      }

      osc.connect(gain);
      gain.connect(ctx.destination);
    } catch {
      // Ignored
    }
  }

  /**
   * Play an incoming voice clip with realistic radio chirp-in and chirp-out
   */
  async playVoiceClip(audioDataUri: string, onEnd?: () => void): Promise<void> {
    try {
      // 1. Play chirp-in
      this.playRadioChirpIn();

      // Wait 120ms for chirp to finish before playing voice
      await new Promise((r) => setTimeout(r, 120));

      if (this.currentAudioElement) {
        this.currentAudioElement.pause();
        this.currentAudioElement = null;
      }

      const audio = new Audio(audioDataUri);
      this.currentAudioElement = audio;

      audio.onended = () => {
        this.playRadioChirpOut();
        this.currentAudioElement = null;
        if (onEnd) onEnd();
      };

      audio.onerror = () => {
        this.currentAudioElement = null;
        if (onEnd) onEnd();
      };

      await audio.play();
    } catch (err) {
      console.warn('Failed to play voice clip:', err);
      if (onEnd) onEnd();
    }
  }

  /**
   * Synthesize spoken speech for quick audio presets
   */
  speakText(text: string, onEnd?: () => void): void {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      if (onEnd) onEnd();
      return;
    }

    try {
      this.playRadioChirpIn();

      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.15;
        utterance.pitch = 1.05;
        utterance.onend = () => {
          this.playRadioChirpOut();
          if (onEnd) onEnd();
        };
        utterance.onerror = () => {
          if (onEnd) onEnd();
        };
        window.speechSynthesis.speak(utterance);
      }, 100);
    } catch {
      if (onEnd) onEnd();
    }
  }
}

export const tetherAudio = new TetherAudioEngine();
