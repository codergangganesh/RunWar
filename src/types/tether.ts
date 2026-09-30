/**
 * Tether Types & Models
 * Virtual Tethered Running & Real-Time Walkie-Talkie feature for RunWar.
 */

export type TetherSessionStatus = 'waiting' | 'active' | 'completed' | 'ended';

export type TetherCommunicationMode = 'push_to_talk' | 'open_mic';

export type TetherTensionZone = 'green' | 'amber' | 'red';

export interface TetherParticipant {
  userId: string;
  name: string;
  username?: string | null;
  avatarUrl?: string | null;
  role: 'host' | 'peer';
  status: 'ready' | 'running' | 'paused' | 'finished' | 'disconnected';
  lastSeen?: string;
}

export interface TetherTelemetry {
  userId: string;
  distanceMeters: number;
  currentPaceSec: number;
  movingTimeSec: number;
  currentSpeedKmh: number;
  splitKm: number;
  lastPingAt: string;
  latitude?: number;
  longitude?: number;
}

export interface TetherDelta {
  deltaMeters: number; // positive = self ahead, negative = self behind
  tensionZone: TetherTensionZone; // green: 0-25m, amber: 25-80m, red: >80m
  leader: 'self' | 'peer' | 'tied';
  leaderName: string;
  speedDiffKmh: number;
  distanceTensionPct: number; // 0 to 100% for visual elasticity
}

export interface TetherVoiceClip {
  id: string;
  sessionCode: string;
  senderId: string;
  senderName: string;
  audioDataUri: string; // Base64 data URI or object URL
  durationSec: number;
  timestamp: string;
  presetText?: string;
}

export interface TetherSession {
  id: string;
  roomCode: string; // e.g. TR-8K2P9M
  host: TetherParticipant;
  peer?: TetherParticipant | null;
  targetDistanceMeters?: number | null;
  status: TetherSessionStatus;
  communicationMode: TetherCommunicationMode;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  endedAt?: string;
}

export interface TetherPresetVoiceMessage {
  id: string;
  emoji: string;
  label: string;
  speechText: string;
}

export const TETHER_PRESET_MESSAGES: TetherPresetVoiceMessage[] = [
  { id: 'surge', emoji: '⚡', label: 'Surge!', speechText: "Let's surge! Pick up the pace!" },
  { id: 'pacing', emoji: '🔥', label: 'Great pace!', speechText: 'Crushing this pace! Keep it locked in!' },
  { id: 'water', emoji: '💧', label: 'Water break', speechText: 'Quick water break, hold the rhythm.' },
  { id: 'hill', emoji: '⛰️', label: 'Push the hill', speechText: 'Dig deep on this incline! Lean in!' },
  { id: 'sprint', emoji: '🏁', label: 'Final sprint!', speechText: 'Home stretch! Empty the tank and sprint!' },
  { id: 'checkin', emoji: '👍', label: "How're you doing?", speechText: 'How are you holding up? Let me know!' },
];
