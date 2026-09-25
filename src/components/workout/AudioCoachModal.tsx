import React, { useState, useEffect } from 'react';
import { audioCoach, VoiceOption } from '../../services/audioCoach';
import { soundEffects } from '../../services/soundEffects';
import { hapticsService } from '../../services/hapticsService';
import { AudioFrequency } from '../../types';
import {
  Volume2,
  VolumeX,
  Play,
  Bell,
  Vibrate,
  X,
  Check,
} from 'lucide-react';

interface AudioCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  frequency: AudioFrequency;
  onChangeFrequency: (freq: AudioFrequency) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const AudioCoachModal: React.FC<AudioCoachModalProps> = ({
  isOpen,
  onClose,
  frequency,
  onChangeFrequency,
  isMuted,
  onToggleMute,
}) => {
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>('');
  const [rate, setRate] = useState<number>(1.05);
  const [pitch, setPitch] = useState<number>(1.0);
  const [volume, setVolume] = useState<number>(1.0);
  const [enableChimes, setEnableChimes] = useState<boolean>(true);
  const [enableHaptics, setEnableHaptics] = useState<boolean>(true);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Load available voices
    const list = audioCoach.getAvailableVoices();
    setVoices(list);

    const params = audioCoach.getParameters();
    setRate(params.rate);
    setPitch(params.pitch);
    setVolume(params.volume);
    setEnableChimes(params.enableChimes);
    setEnableHaptics(params.enableHaptics);
    setSelectedVoiceURI(params.selectedVoiceURI || (list[0]?.voiceURI ?? ''));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleVoiceChange = (uri: string) => {
    setSelectedVoiceURI(uri);
    audioCoach.setVoiceByURI(uri);
  };

  const handleRateChange = (newRate: number) => {
    setRate(newRate);
    audioCoach.setParameters({ rate: newRate });
  };

  const handlePitchChange = (newPitch: number) => {
    setPitch(newPitch);
    audioCoach.setParameters({ pitch: newPitch });
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    audioCoach.setParameters({ volume: newVol });
  };

  const handleToggleChimes = (val: boolean) => {
    setEnableChimes(val);
    audioCoach.setParameters({ enableChimes: val });
    if (val) soundEffects.playResume();
  };

  const handleToggleHaptics = (val: boolean) => {
    setEnableHaptics(val);
    audioCoach.setParameters({ enableHaptics: val });
    if (val) hapticsService.vibrateResume();
  };

  const handleTestVoice = () => {
    setIsTesting(true);
    audioCoach.testVoice();
    setTimeout(() => setIsTesting(false), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in select-none">
      <div className="bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 rounded-3xl p-5 max-w-md w-full shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto animate-scale-up">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Volume2 size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">
                Audio & Voice Coach
              </h2>
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                Pace updates, split chimes & haptics
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Master Voice Coaching Toggle */}
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            {isMuted ? (
              <VolumeX size={18} className="text-slate-400" />
            ) : (
              <Volume2 size={18} className="text-emerald-500" />
            )}
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                Spoken Voice Guidance
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                {isMuted ? 'Muted — No voice announcements' : 'Active during workout tracking'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleMute}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
              !isMuted
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {!isMuted ? 'Enabled' : 'Muted'}
          </button>
        </div>

        {/* Announcement Frequency */}
        {!isMuted && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Announcement Frequency
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: '1km', label: 'Every 1 KM / 1 MI' },
                { id: '0.5km', label: 'Every 0.5 KM' },
                { id: '5min', label: 'Every 5 Mins' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    onChangeFrequency(opt.id as AudioFrequency);
                    audioCoach.setConfig(!isMuted, opt.id as AudioFrequency);
                  }}
                  className={`py-2 px-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 border ${
                    frequency === opt.id
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm'
                      : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-emerald-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Coach Voice Picker */}
        {!isMuted && voices.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Voice Selection
            </label>
            <select
              value={selectedVoiceURI}
              onChange={(e) => handleVoiceChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:border-emerald-500"
            >
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang}){v.isPreferred ? ' ⭐ Natural' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Speed & Pitch Controls */}
        {!isMuted && (
          <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                <span>Speed</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">{rate.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.35"
                step="0.05"
                value={rate}
                onChange={(e) => handleRateChange(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                <span>Pitch</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">{pitch.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="1.2"
                step="0.05"
                value={pitch}
                onChange={(e) => handlePitchChange(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Audio Chimes (Web Audio Synthesizer) & Haptics Cues */}
        <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-emerald-500" />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Audio Chimes & Bells
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Play musical chimes for splits and start/finish
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={enableChimes}
              onChange={(e) => handleToggleChimes(e.target.checked)}
              className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <Vibrate size={15} className="text-emerald-500" />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Haptic Feedback Patterns
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Distinct vibration signatures for milestones and pauses
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={enableHaptics}
              onChange={(e) => handleToggleHaptics(e.target.checked)}
              className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Action Buttons: Test Voice & Close */}
        <div className="pt-2 flex gap-2">
          {!isMuted && (
            <button
              type="button"
              onClick={handleTestVoice}
              disabled={isTesting}
              className="flex-1 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
            >
              <Play size={14} className={isTesting ? 'animate-pulse' : ''} />
              <span>{isTesting ? 'Playing Sample...' : 'Test Voice Coach'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md shadow-emerald-600/20"
          >
            <Check size={15} />
            <span>Save & Close</span>
          </button>
        </div>
      </div>
    </div>
  );
};
