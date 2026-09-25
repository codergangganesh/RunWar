import { AudioFrequency, DistanceUnit, PaceUnit } from '../types';
import { soundEffects } from './soundEffects';
import { hapticsService } from './hapticsService';

const MOTIVATIONAL_PHRASES = [
  'Keep up the strong cadence!',
  'Looking solid and smooth!',
  'Great aerobic rhythm!',
  'Crushing this workout!',
  'Strong finish energy!',
  'Every step counts!',
  'Focus on your breathing, stay relaxed!',
  'Unstoppable momentum!',
];

export interface VoiceOption {
  name: string;
  lang: string;
  voiceURI: string;
  default: boolean;
  isPreferred?: boolean;
}

class AudioCoach {
  private isEnabled: boolean = true;
  private frequency: AudioFrequency = '1km';
  private lastAnnouncedDistanceMeters: number = 0;
  private lastAnnouncedTimeSeconds: number = 0;
  private synth: SpeechSynthesis | null = null;
  private voice: SpeechSynthesisVoice | null = null;
  private availableVoices: SpeechSynthesisVoice[] = [];

  // Configurable speech parameters
  private rate: number = 1.05;
  private pitch: number = 1.0;
  private volume: number = 1.0;
  private selectedVoiceURI: string | null = null;
  private enableChimes: boolean = true;
  private enableHaptics: boolean = true;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadSettings();
      this.initVoice();
    }
  }

  private loadSettings() {
    try {
      const savedVoiceURI = localStorage.getItem('runwar_coach_voice_uri');
      if (savedVoiceURI) this.selectedVoiceURI = savedVoiceURI;

      const savedRate = localStorage.getItem('runwar_coach_rate');
      if (savedRate) this.rate = parseFloat(savedRate) || 1.05;

      const savedPitch = localStorage.getItem('runwar_coach_pitch');
      if (savedPitch) this.pitch = parseFloat(savedPitch) || 1.0;

      const savedVolume = localStorage.getItem('runwar_coach_volume');
      if (savedVolume) this.volume = parseFloat(savedVolume) || 1.0;

      const savedChimes = localStorage.getItem('runwar_coach_chimes');
      if (savedChimes !== null) this.enableChimes = savedChimes === 'true';

      const savedHaptics = localStorage.getItem('runwar_coach_haptics');
      if (savedHaptics !== null) this.enableHaptics = savedHaptics === 'true';
    } catch { }
  }
  private initVoice() {
    if (!this.synth) return;

    const loadVoices = () => {
      this.availableVoices = this.synth?.getVoices() || [];
      if (this.availableVoices.length === 0) return;
      // 1. Try previously saved voice URI
      if (this.selectedVoiceURI) {
        const matched = this.availableVoices.find((v) => v.voiceURI === this.selectedVoiceURI);
        if (matched) {
          this.voice = matched;
          return;
        }
      }
      // 2. Prefer natural sounding English voices
      const preferred = this.availableVoices.find(
        (v) =>
          (v.name.includes('Google') ||
            v.name.includes('Natural') ||
            v.name.includes('Samantha') ||
            v.name.includes('Daniel') ||
            v.name.includes('Karen') ||
            v.name.includes('Moira') ||
            v.name.includes('Serena')) &&
          v.lang.startsWith('en')
      );

      this.voice = preferred || this.availableVoices.find((v) => v.lang.startsWith('en')) || this.availableVoices[0] || null;
    };
    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  public getAvailableVoices(): VoiceOption[] {
    if (!this.synth) return [];
    if (this.availableVoices.length === 0) {
      this.availableVoices = this.synth.getVoices() || [];
    }

    return this.availableVoices.map((v) => ({
      name: v.name,
      lang: v.lang,
      voiceURI: v.voiceURI,
      default: v.default,
      isPreferred:
        v.lang.startsWith('en') &&
        (v.name.includes('Google') ||
          v.name.includes('Natural') ||
          v.name.includes('Samantha') ||
          v.name.includes('Daniel')),
    }));
  }

  public getSelectedVoiceURI(): string | null {
    return this.voice ? this.voice.voiceURI : this.selectedVoiceURI;
  }

  public setVoiceByURI(voiceURI: string): boolean {
    this.selectedVoiceURI = voiceURI;
    try {
      localStorage.setItem('runwar_coach_voice_uri', voiceURI);
    } catch { }

    const matched = this.availableVoices.find((v) => v.voiceURI === voiceURI);
    if (matched) {
      this.voice = matched;
      return true;
    }
    return false;
  }

  public setParameters(params: {
    rate?: number;
    pitch?: number;
    volume?: number;
    enableChimes?: boolean;
    enableHaptics?: boolean;
  }) {
    if (params.rate !== undefined) {
      this.rate = Math.max(0.7, Math.min(1.5, params.rate));
      try {
        localStorage.setItem('runwar_coach_rate', String(this.rate));
      } catch { }
    }
    if (params.pitch !== undefined) {
      this.pitch = Math.max(0.7, Math.min(1.3, params.pitch));
      try {
        localStorage.setItem('runwar_coach_pitch', String(this.pitch));
      } catch { }
    }
    if (params.volume !== undefined) {
      this.volume = Math.max(0.1, Math.min(1.0, params.volume));
      try {
        localStorage.setItem('runwar_coach_volume', String(this.volume));
      } catch { }
    }
    if (params.enableChimes !== undefined) {
      this.enableChimes = params.enableChimes;
      soundEffects.setEnabled(params.enableChimes);
      try {
        localStorage.setItem('runwar_coach_chimes', String(this.enableChimes));
      } catch { }
    }
    if (params.enableHaptics !== undefined) {
      this.enableHaptics = params.enableHaptics;
      hapticsService.setEnabled(params.enableHaptics);
      try {
        localStorage.setItem('runwar_coach_haptics', String(this.enableHaptics));
      } catch { }
    }
  }

  public getParameters() {
    return {
      rate: this.rate,
      pitch: this.pitch,
      volume: this.volume,
      enableChimes: this.enableChimes,
      enableHaptics: this.enableHaptics,
      selectedVoiceURI: this.getSelectedVoiceURI(),
      frequency: this.frequency,
      isEnabled: this.isEnabled,
    };
  }

  public setConfig(enabled: boolean, frequency: AudioFrequency) {
    this.isEnabled = enabled;
    this.frequency = frequency;
  }

  public toggleMute(): boolean {
    this.isEnabled = !this.isEnabled;
    if (!this.isEnabled) {
      this.stop();
    } else {
      if (this.enableChimes) soundEffects.playResume();
      this.speak('Voice coaching enabled.');
    }
    return this.isEnabled;
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  public reset() {
    this.lastAnnouncedDistanceMeters = 0;
    this.lastAnnouncedTimeSeconds = 0;
    this.stop();
  }

  /**
   * Duck background audio if media element exists in DOM
   */
  private applyAudioDucking(duck: boolean) {
    if (typeof document === 'undefined') return;
    try {
      const mediaElements = document.querySelectorAll('audio, video');
      mediaElements.forEach((el) => {
        const media = el as HTMLMediaElement;
        if (!media.paused) {
          media.volume = duck ? Math.max(0.15, media.volume * 0.3) : Math.min(1.0, media.volume / 0.3);
        }
      });
    } catch { }
  }

  public speak(text: string, options?: { withChime?: boolean; withHaptic?: () => void }) {
    if (!this.isEnabled || !this.synth) return;

    try {
      // Optional sound effect chime right before speech
      if (options?.withChime && this.enableChimes) {
        soundEffects.playMilestone();
      }

      // Optional haptic vibration
      if (options?.withHaptic && this.enableHaptics) {
        options.withHaptic();
      }

      this.synth.cancel(); // Cancel backlog speech
      this.applyAudioDucking(true);

      const utterance = new SpeechSynthesisUtterance(text);
      if (this.voice) {
        utterance.voice = this.voice;
      }
      utterance.rate = this.rate;
      utterance.pitch = this.pitch;
      utterance.volume = this.volume;

      utterance.onend = () => {
        this.applyAudioDucking(false);
      };
      utterance.onerror = () => {
        this.applyAudioDucking(false);
      };

      this.synth.speak(utterance);
    } catch (err) {
      console.warn('Audio coach speech failed:', err);
      this.applyAudioDucking(false);
    }
  }

  /**
   * Play test sample so runner can evaluate current voice, rate, and pitch
   */
  public testVoice(sampleText?: string) {
    const text =
      sampleText ||
      `RunWar Voice Coach active. Split pace is 5 minutes 15 seconds per kilometer. Looking strong, keep pushing!`;
    if (this.enableChimes) {
      soundEffects.playMilestone();
      setTimeout(() => this.speak(text), 250);
    } else {
      this.speak(text);
    }
  }

  public stop() {
    if (this.synth) {
      this.synth.cancel();
    }
    this.applyAudioDucking(false);
  }

  /**
   * Check if an audio announcement should be triggered during live tracking
   */
  public checkAndAnnounce(
    distanceMeters: number,
    elapsedSeconds: number,
    avgPaceSecPerKm: number,
    splitPaceSecPerKm: number,
    distanceUnit: DistanceUnit = 'km',
    paceUnit: PaceUnit = 'min_km'
  ) {
    if (!this.isEnabled || this.frequency === 'off') return;

    if (this.frequency === '1km' || this.frequency === '0.5km') {
      const isHalf = this.frequency === '0.5km';
      const intervalMeters = distanceUnit === 'mi'
        ? (isHalf ? 804.67 : 1609.34)
        : (isHalf ? 500 : 1000);

      const targetMilestone = Math.floor(distanceMeters / intervalMeters) * intervalMeters;

      if (targetMilestone > 0 && targetMilestone > this.lastAnnouncedDistanceMeters) {
        this.lastAnnouncedDistanceMeters = targetMilestone;

        const count = Math.round(targetMilestone / intervalMeters);
        let distancePhrase = '';

        if (distanceUnit === 'mi') {
          distancePhrase = isHalf
            ? `${(targetMilestone / 1609.34).toFixed(1)} miles`
            : `Mile ${count}`;
        } else {
          distancePhrase = isHalf
            ? (targetMilestone < 1000 ? `${Math.round(targetMilestone)} meters` : `${(targetMilestone / 1000).toFixed(1)} kilometers`)
            : `Kilometer ${count}`;
        }

        const paceSec = paceUnit === 'min_mi' ? splitPaceSecPerKm * 1.60934 : splitPaceSecPerKm;
        const paceMins = Math.floor(paceSec / 60);
        const paceSecs = Math.round(paceSec % 60);

        const elapsedMins = Math.floor(elapsedSeconds / 60);
        const elapsedSecs = Math.round(elapsedSeconds % 60);

        const motivation = MOTIVATIONAL_PHRASES[count % MOTIVATIONAL_PHRASES.length];

        const speechText = `${distancePhrase} complete. Split pace: ${paceMins} minutes ${paceSecs} seconds. Total time: ${elapsedMins} minutes ${elapsedSecs} seconds. ${motivation}`;

        this.speak(speechText, {
          withChime: true,
          withHaptic: () => hapticsService.vibrateMilestone(),
        });
      }
    } else if (this.frequency === '5min') {
      const intervalSec = 300; // 5 minutes
      const targetSec = Math.floor(elapsedSeconds / intervalSec) * intervalSec;

      if (targetSec > 0 && targetSec > this.lastAnnouncedTimeSeconds) {
        this.lastAnnouncedTimeSeconds = targetSec;

        const mins = Math.floor(targetSec / 60);
        const distVal = distanceUnit === 'mi' ? (distanceMeters / 1609.34).toFixed(2) : (distanceMeters / 1000).toFixed(2);
        const distUnitLabel = distanceUnit === 'mi' ? 'miles' : 'kilometers';
        const paceSec = paceUnit === 'min_mi' ? avgPaceSecPerKm * 1.60934 : avgPaceSecPerKm;
        const paceMins = Math.floor(paceSec / 60);
        const paceSecs = Math.round(paceSec % 60);

        const speechText = `${mins} minutes completed. Distance: ${distVal} ${distUnitLabel}. Average pace: ${paceMins} minutes ${paceSecs} seconds. Keep moving!`;

        this.speak(speechText, {
          withChime: true,
          withHaptic: () => hapticsService.vibrateMilestone(),
        });
      }
    }
  }

  public announceWorkoutStart(type: string) {
    if (this.enableChimes) soundEffects.playStart();
    if (this.enableHaptics) hapticsService.vibrateCountdownGo();
    this.speak(`Starting ${type}. GPS signal locked. Have an awesome workout!`);
  }

  public announceWorkoutPaused() {
    if (this.enableChimes) soundEffects.playPause();
    if (this.enableHaptics) hapticsService.vibratePause();
    this.speak('Workout paused.');
  }

  public announceAutoPaused() {
    if (this.enableChimes) soundEffects.playPause();
    if (this.enableHaptics) hapticsService.vibratePause();
    this.speak('Auto paused. Catch your breath!');
  }

  public announceWorkoutResumed() {
    if (this.enableChimes) soundEffects.playResume();
    if (this.enableHaptics) hapticsService.vibrateResume();
    this.speak("Resuming workout. Let's go!");
  }

  public announceMilestone(milestoneText: string) {
    if (this.enableChimes) soundEffects.playMilestone();
    if (this.enableHaptics) hapticsService.vibrateMilestone();
    this.speak(`Milestone reached: ${milestoneText}`);
  }

  public announceWorkoutFinished(distanceMeters: number, elapsedSeconds: number, distanceUnit: DistanceUnit = 'km') {
    if (this.enableChimes) soundEffects.playFinishFanfare();
    if (this.enableHaptics) hapticsService.vibrateFinish();
    const distVal = distanceUnit === 'mi' ? (distanceMeters / 1609.34).toFixed(2) : (distanceMeters / 1000).toFixed(2);
    const distUnitLabel = distanceUnit === 'mi' ? 'miles' : 'kilometers';
    const mins = Math.floor(elapsedSeconds / 60);
    this.speak(`Workout complete! You conquered ${distVal} ${distUnitLabel} in ${mins} minutes. Outstanding effort!`);
  }
}

export const audioCoach = new AudioCoach();
