import { AudioFrequency, DistanceUnit, PaceUnit } from '../types';

const MOTIVATIONAL_PHRASES = [
  'Keep up the strong cadence!',
  'Looking solid and smooth!',
  'Great aerobic rhythm!',
  'Crushing this workout!',
  'Strong finish energy!',
  'Every step counts!',
];

class AudioCoach {
  private isEnabled: boolean = true;
  private frequency: AudioFrequency = '1km';
  private lastAnnouncedDistanceMeters: number = 0;
  private lastAnnouncedTimeSeconds: number = 0;
  private synth: SpeechSynthesis | null = null;
  private voice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.initVoice();
    }
  }

  private initVoice() {
    if (!this.synth) return;
    const loadVoices = () => {
      const voices = this.synth?.getVoices() || [];
      // Prefer natural English voice
      const preferred = voices.find(
        (v) => (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel') || v.name.includes('Karen') || v.name.includes('Moira')) && v.lang.startsWith('en')
      );
      this.voice = preferred || voices.find((v) => v.lang.startsWith('en')) || voices[0] || null;
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
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

  public speak(text: string) {
    if (!this.isEnabled || !this.synth) return;
    try {
      this.synth.cancel(); // Cancel any existing speech to prevent delay
      const utterance = new SpeechSynthesisUtterance(text);
      if (this.voice) {
        utterance.voice = this.voice;
      }
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      this.synth.speak(utterance);
    } catch (err) {
      console.warn('Audio coach speech failed:', err);
    }
  }

  public stop() {
    if (this.synth) {
      this.synth.cancel();
    }
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
      const intervalMeters = this.frequency === '0.5km' ? 500 : 1000;
      const targetMilestone = Math.floor(distanceMeters / intervalMeters) * intervalMeters;

      if (targetMilestone > 0 && targetMilestone > this.lastAnnouncedDistanceMeters) {
        this.lastAnnouncedDistanceMeters = targetMilestone;
        
        const splitIndex = Math.round(targetMilestone / 1000);
        const distNumber = (targetMilestone / 1000);
        const distUnitLabel = distanceUnit === 'mi' ? 'miles' : 'kilometers';
        const distFormatted = distNumber === 1 ? `1 ${distanceUnit === 'mi' ? 'mile' : 'kilometer'}` : `${distNumber} ${distUnitLabel}`;

        const paceSec = paceUnit === 'min_mi' ? splitPaceSecPerKm * 1.60934 : splitPaceSecPerKm;
        const paceMins = Math.floor(paceSec / 60);
        const paceSecs = Math.round(paceSec % 60);

        const elapsedMins = Math.floor(elapsedSeconds / 60);
        const elapsedSecs = Math.round(elapsedSeconds % 60);

        const motivation = MOTIVATIONAL_PHRASES[splitIndex % MOTIVATIONAL_PHRASES.length];

        const speechText = `Kilometer ${splitIndex} complete. Split pace: ${paceMins} minutes ${paceSecs} seconds. Total time: ${elapsedMins} minutes ${elapsedSecs} seconds. ${motivation}`;
        this.speak(speechText);
      }
    } else if (this.frequency === '5min') {
      const intervalSec = 300; // 5 minutes
      const targetSec = Math.floor(elapsedSeconds / intervalSec) * intervalSec;

      if (targetSec > 0 && targetSec > this.lastAnnouncedTimeSeconds) {
        this.lastAnnouncedTimeSeconds = targetSec;

        const mins = Math.floor(targetSec / 60);
        const distKm = (distanceMeters / 1000).toFixed(2);
        const paceMins = Math.floor(avgPaceSecPerKm / 60);
        const paceSecs = Math.round(avgPaceSecPerKm % 60);

        const speechText = `${mins} minutes completed. Distance: ${distKm} kilometers. Average pace: ${paceMins} minutes ${paceSecs} seconds. Keep moving!`;
        this.speak(speechText);
      }
    }
  }

  public announceWorkoutStart(type: string) {
    this.speak(`Starting ${type}. GPS signal locked. Have an awesome workout!`);
  }

  public announceWorkoutPaused() {
    this.speak('Workout paused.');
  }

  public announceAutoPaused() {
    this.speak('Auto paused. Catch your breath!');
  }

  public announceWorkoutResumed() {
    this.speak('Resuming workout. Let\'s go!');
  }

  public announceMilestone(milestoneText: string) {
    this.speak(`Milestone reached: ${milestoneText}`);
  }

  public announceWorkoutFinished(distanceMeters: number, elapsedSeconds: number) {
    const km = (distanceMeters / 1000).toFixed(2);
    const mins = Math.floor(elapsedSeconds / 60);
    this.speak(`Workout complete! You conquered ${km} kilometers in ${mins} minutes. Outstanding effort!`);
  }
}

export const audioCoach = new AudioCoach();

