/**
 * Tether & Walkie-Talkie Service
 * Manages peer pairing, real-time telemetry delta computation,
 * and push-to-talk voice recording/broadcasting via InsForge & BroadcastChannel.
 */

import { insforge } from '../lib/insforge';
import {
  TetherSession,
  TetherParticipant,
  TetherTelemetry,
  TetherDelta,
  TetherVoiceClip,
  TetherPresetVoiceMessage,
  TetherCommunicationMode,
  TetherTensionZone,
} from '../types/tether';
import { tetherAudio } from './tetherAudio';

const STORAGE_ACTIVE_TETHER = 'runwar_active_tether_session';
const BROADCAST_CHANNEL_NAME = 'runwar_tether_channel';

type TelemetryListener = (telemetry: TetherTelemetry, delta: TetherDelta) => void;
type SessionListener = (session: TetherSession | null) => void;
type VoiceClipListener = (clip: TetherVoiceClip) => void;
type DisconnectListener = (reason: string) => void;

class TetherService {
  private activeSession: TetherSession | null = null;
  private lastCompletedSession: TetherSession | null = null;
  private myTelemetry: TetherTelemetry | null = null;
  private peerTelemetry: TetherTelemetry | null = null;
  private lastPeerTelemetry: TetherTelemetry | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private syncInterval: any = null;
  private lastPingAt: number = 0;
  private lastAnnouncedPeerKm: number = 0;
  private lastTensionZone: TetherTensionZone = 'green';

  // Listeners
  private telemetryListeners: Set<TelemetryListener> = new Set();
  private sessionListeners: Set<SessionListener> = new Set();
  private voiceClipListeners: Set<VoiceClipListener> = new Set();
  private disconnectListeners: Set<DisconnectListener> = new Set();

  // Voice recording
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording: boolean = false;
  private recordingStartTime: number = 0;
  private mediaStream: MediaStream | null = null;

  constructor() {
    this.initBroadcastChannel();
    this.restoreSession();
    this.initUnloadListener();
  }

  private initUnloadListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        if (this.activeSession) {
          const roomCode = this.activeSession.roomCode;
          this.broadcastMessage({
            type: 'SESSION_ENDED',
            roomCode,
          });
          try {
            insforge.database
              .from('tether_sessions')
              .update({
                status: 'completed',
                updated_at: new Date().toISOString(),
              })
              .eq('room_code', roomCode);
          } catch {}
        }
      });
    }
  }

  private initBroadcastChannel(): void {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        this.broadcastChannel.onmessage = (event) => {
          this.handleIncomingBroadcast(event.data);
        };
      } catch {
        // Fallback for environments where BroadcastChannel is blocked
      }
    }
  }

  private restoreSession(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_ACTIVE_TETHER);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.status === 'active' || parsed.status === 'waiting')) {
          this.activeSession = parsed;
          this.startPeriodicSync();
        }
      }
    } catch {
      // Ignored
    }
  }

  private saveSession(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      if (this.activeSession) {
        localStorage.setItem(STORAGE_ACTIVE_TETHER, JSON.stringify(this.activeSession));
      } else {
        localStorage.removeItem(STORAGE_ACTIVE_TETHER);
      }
    } catch {
      // Ignored
    }
    this.notifySessionListeners();
  }

  /**
   * Get the last completed or ended tether session (for post-run summary card)
   */
  getLastCompletedSession(): TetherSession | null {
    return this.lastCompletedSession;
  }

  /**
   * Get the last recorded telemetry of the partner
   */
  getLastPeerTelemetry(): TetherTelemetry | null {
    return this.lastPeerTelemetry;
  }

  /**
   * Generate clean 6-character room code (e.g. TR-8K2P9M)
   */
  generateRoomCode(): string {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `TR-${code}`;
  }

  getActiveSession(): TetherSession | null {
    return this.activeSession;
  }

  isTetherActive(): boolean {
    return this.activeSession?.status === 'active';
  }

  getPeerParticipant(): TetherParticipant | null {
    if (!this.activeSession) return null;
    return this.activeSession.peer || null;
  }

  /**
   * Create a new Tether session as Host
   */
  async createSession(
    hostUser: { id: string; name: string; username?: string | null; avatar_url?: string | null },
    targetDistanceMeters?: number
  ): Promise<TetherSession> {
    const roomCode = this.generateRoomCode();
    const session: TetherSession = {
      id: `teth_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      roomCode,
      host: {
        userId: hostUser.id,
        name: hostUser.name || 'Runner',
        username: hostUser.username || null,
        avatarUrl: hostUser.avatar_url || null,
        role: 'host',
        status: 'ready',
        lastSeen: new Date().toISOString(),
      },
      peer: null,
      targetDistanceMeters: targetDistanceMeters || null,
      status: 'waiting',
      communicationMode: 'push_to_talk',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.activeSession = session;
    this.peerTelemetry = null;
    this.saveSession();

    // Persist to InsForge database if table is available
    try {
      await insforge.database.from('tether_sessions').insert([{
        id: session.id,
        room_code: session.roomCode,
        host_user_id: session.host.userId,
        host_name: session.host.name,
        host_avatar: session.host.avatarUrl,
        status: session.status,
        target_distance_meters: session.targetDistanceMeters,
        created_at: session.createdAt,
        updated_at: session.updatedAt,
      }]);
    } catch {
      // Graceful fallback to real-time broadcast
    }

    this.broadcastMessage({
      type: 'ROOM_CREATED',
      session,
    });

    this.startPeriodicSync();
    return session;
  }

  /**
   * Join an existing Tether session as Peer
   */
  async joinSession(
    roomCode: string,
    guestUser: { id: string; name: string; username?: string | null; avatar_url?: string | null }
  ): Promise<TetherSession | null> {
    const cleanCode = roomCode.trim().toUpperCase();

    const peerInfo: TetherParticipant = {
      userId: guestUser.id,
      name: guestUser.name || 'Running Buddy',
      username: guestUser.username || null,
      avatarUrl: guestUser.avatar_url || null,
      role: 'peer',
      status: 'running',
      lastSeen: new Date().toISOString(),
    };

    let session: TetherSession | null = null;

    // 1. Check local session if matching
    if (this.activeSession && this.activeSession.roomCode === cleanCode) {
      session = this.activeSession;
      session.peer = peerInfo;
      session.status = 'active';
      session.startedAt = new Date().toISOString();
    }

    // 2. Check InsForge database
    if (!session) {
      try {
        const { data, error } = await insforge.database
          .from('tether_sessions')
          .select('*')
          .eq('room_code', cleanCode)
          .single();

        if (!error && data) {
          session = {
            id: data.id,
            roomCode: data.room_code,
            host: {
              userId: data.host_user_id,
              name: data.host_name,
              avatarUrl: data.host_avatar,
              role: 'host',
              status: 'running',
            },
            peer: peerInfo,
            targetDistanceMeters: data.target_distance_meters,
            status: 'active',
            communicationMode: 'push_to_talk',
            createdAt: data.created_at,
            updatedAt: new Date().toISOString(),
            startedAt: new Date().toISOString(),
          };

          // Update session in DB with peer info
          await insforge.database
            .from('tether_sessions')
            .update({
              peer_user_id: peerInfo.userId,
              peer_name: peerInfo.name,
              peer_avatar: peerInfo.avatarUrl,
              status: 'active',
              updated_at: new Date().toISOString(),
            })
            .eq('room_code', cleanCode);
        }
      } catch {
        // Fallback
      }
    }

    // 3. Fallback dummy session if pairing directly via code
    if (!session) {
      session = {
        id: `teth_${Date.now()}`,
        roomCode: cleanCode,
        host: {
          userId: 'host_partner',
          name: 'Running Partner',
          role: 'host',
          status: 'running',
        },
        peer: peerInfo,
        status: 'active',
        communicationMode: 'push_to_talk',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
      };
    }

    this.activeSession = session;
    this.saveSession();

    // Broadcast join event
    this.broadcastMessage({
      type: 'PEER_JOINED',
      roomCode: cleanCode,
      peer: peerInfo,
    });

    tetherAudio.playTetherAlert('reconnected');
    this.startPeriodicSync();
    return session;
  }

  /**
   * Leave / end the active Tether session (voluntary disconnect by this user)
   */
  async endSession(): Promise<void> {
    if (!this.activeSession) return;

    const roomCode = this.activeSession.roomCode;
    this.lastCompletedSession = this.activeSession;
    this.lastPeerTelemetry = this.peerTelemetry;

    // 1. Broadcast SESSION_ENDED to any other open tabs
    this.broadcastMessage({
      type: 'SESSION_ENDED',
      roomCode,
      reason: 'Partner ended the tether session',
    });

    // 2. Mark session completed in InsForge so the other device's polling disconnects
    try {
      await insforge.database
        .from('tether_sessions')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('room_code', roomCode);
    } catch {
      // Ignored
    }

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.activeSession = null;
    this.peerTelemetry = null;
    this.saveSession();

    tetherAudio.playTetherAlert('break');
  }

  /**
   * Automatically triggered when the OTHER participant disconnects
   */
  handlePartnerDisconnected(reason: string = 'Your partner disconnected the tether.'): void {
    if (!this.activeSession) return;

    const roomCode = this.activeSession.roomCode;
    this.lastCompletedSession = this.activeSession;
    this.lastPeerTelemetry = this.peerTelemetry;

    // Forward broadcast to any local tabs
    this.broadcastMessage({
      type: 'SESSION_ENDED',
      roomCode,
      reason,
    });

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.activeSession = null;
    this.peerTelemetry = null;
    this.saveSession();

    tetherAudio.playTetherAlert('break');
    this.notifyDisconnectListeners(reason);
  }

  /**
   * Update active runner's telemetry and compute delta with peer
   */
  updateTelemetry(telemetry: Omit<TetherTelemetry, 'lastPingAt'>): TetherDelta | null {
    if (!this.activeSession || this.activeSession.status !== 'active') {
      return null;
    }

    this.myTelemetry = {
      ...telemetry,
      lastPingAt: new Date().toISOString(),
    };

    // Broadcast telemetry to peer
    const now = Date.now();
    if (now - this.lastPingAt > 1500) {
      this.lastPingAt = now;
      this.broadcastMessage({
        type: 'TELEMETRY_UPDATE',
        roomCode: this.activeSession.roomCode,
        telemetry: this.myTelemetry,
      });
    }

    if (!this.peerTelemetry) {
      return null;
    }

    const delta = this.computeDelta(this.myTelemetry, this.peerTelemetry);
    this.notifyTelemetryListeners(this.peerTelemetry, delta);
    return delta;
  }

  /**
   * Compute relative distance delta, tension zone, and leader
   */
  computeDelta(my: TetherTelemetry, peer: TetherTelemetry): TetherDelta {
    const deltaMeters = Math.round(my.distanceMeters - peer.distanceMeters);
    const absGap = Math.abs(deltaMeters);

    let tensionZone: TetherTensionZone = 'green';
    if (absGap > 80) {
      tensionZone = 'red';
    } else if (absGap > 25) {
      tensionZone = 'amber';
    }

    // Trigger tension audio alert on zone shift to red
    if (tensionZone === 'red' && this.lastTensionZone !== 'red') {
      tetherAudio.playTetherAlert('stretch');
    }
    this.lastTensionZone = tensionZone;

    // Check peer kilometer milestones (e.g. peer passed Km 3)
    const peerKm = Math.floor(peer.distanceMeters / 1000);
    if (peerKm > 0 && peerKm > this.lastAnnouncedPeerKm) {
      this.lastAnnouncedPeerKm = peerKm;
      tetherAudio.playTetherAlert('milestone');
    }

    let leader: 'self' | 'peer' | 'tied' = 'tied';
    let leaderName = 'Neck & Neck';

    if (deltaMeters > 5) {
      leader = 'self';
      leaderName = 'You';
    } else if (deltaMeters < -5) {
      leader = 'peer';
      leaderName = this.activeSession?.peer?.name || this.activeSession?.host.name || 'Buddy';
    }

    const speedDiffKmh = Number((my.currentSpeedKmh - peer.currentSpeedKmh).toFixed(1));
    const distanceTensionPct = Math.min(100, Math.round((absGap / 100) * 100));

    return {
      deltaMeters,
      tensionZone,
      leader,
      leaderName,
      speedDiffKmh,
      distanceTensionPct,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Walkie-Talkie Push-to-Talk Voice Recording Engine
  // ──────────────────────────────────────────────────────────────────────────

  async startVoiceRecording(): Promise<boolean> {
    if (this.isRecording) return false;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      console.warn('Microphone access is not supported on this device/browser');
      return false;
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.audioChunks = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm';

      this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100);
      this.isRecording = true;
      this.recordingStartTime = Date.now();
      tetherAudio.playRadioChirpIn();
      return true;
    } catch (err) {
      console.warn('Microphone access denied:', err);
      return false;
    }
  }

  async stopVoiceRecording(): Promise<TetherVoiceClip | null> {
    if (!this.isRecording || !this.mediaRecorder) return null;

    return new Promise((resolve) => {
      this.mediaRecorder!.onstop = async () => {
        const durationSec = Math.max(1, Math.round((Date.now() - this.recordingStartTime) / 1000));
        const blob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType || 'audio/webm' });

        // Clean up media streams
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach((track) => track.stop());
          this.mediaStream = null;
        }
        this.isRecording = false;

        // Convert blob to Base64 Data URL for ultra-fast low-latency transmission
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          const sender = this.activeSession?.host || this.activeSession?.peer;
          const clip: TetherVoiceClip = {
            id: `clip_${Date.now()}`,
            sessionCode: this.activeSession?.roomCode || '',
            senderId: sender?.userId || 'me',
            senderName: sender?.name || 'You',
            audioDataUri: base64Audio,
            durationSec,
            timestamp: new Date().toISOString(),
          };

          // Broadcast voice clip to peer
          this.broadcastMessage({
            type: 'VOICE_CLIP',
            roomCode: this.activeSession?.roomCode,
            clip,
          });

          tetherAudio.playRadioChirpOut();
          resolve(clip);
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      };

      try {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
          this.mediaRecorder.stop();
        } else {
          this.isRecording = false;
          resolve(null);
        }
      } catch {
        this.isRecording = false;
        resolve(null);
      }
    });
  }

  /**
   * Broadcast a quick preset message (synthesizes speech on the buddy's device)
   */
  sendPresetMessage(preset: TetherPresetVoiceMessage): void {
    if (!this.activeSession) return;

    const sender = this.activeSession.host || this.activeSession.peer;
    const clip: TetherVoiceClip = {
      id: `preset_${Date.now()}`,
      sessionCode: this.activeSession.roomCode,
      senderId: sender?.userId || 'me',
      senderName: sender?.name || 'Buddy',
      audioDataUri: '',
      durationSec: 2,
      timestamp: new Date().toISOString(),
      presetText: preset.speechText,
    };

    this.broadcastMessage({
      type: 'VOICE_PRESET',
      roomCode: this.activeSession.roomCode,
      clip,
    });

    // Provide local audio feedback
    tetherAudio.speakText(preset.speechText);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Messaging & Realtime Synchronization
  // ──────────────────────────────────────────────────────────────────────────

  private broadcastMessage(payload: any): void {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(payload);
      } catch {
        // Ignored
      }
    }
  }

  private handleIncomingBroadcast(data: any): void {
    if (!data || !this.activeSession) return;

    // Filter messages for current room code
    if (data.roomCode && data.roomCode !== this.activeSession.roomCode) {
      return;
    }

    switch (data.type) {
      case 'PEER_JOINED':
        if (this.activeSession.status === 'waiting') {
          this.activeSession.peer = data.peer;
          this.activeSession.status = 'active';
          this.activeSession.startedAt = new Date().toISOString();
          this.saveSession();
          tetherAudio.playTetherAlert('reconnected');
        }
        break;

      case 'TELEMETRY_UPDATE':
        this.peerTelemetry = data.telemetry || null;
        if (this.myTelemetry && this.peerTelemetry) {
          const delta = this.computeDelta(this.myTelemetry, this.peerTelemetry);
          this.notifyTelemetryListeners(this.peerTelemetry, delta);
        }
        break;

      case 'VOICE_CLIP':
        if (data.clip) {
          this.notifyVoiceClipListeners(data.clip);
          tetherAudio.playVoiceClip(data.clip.audioDataUri);
        }
        break;

      case 'VOICE_PRESET':
        if (data.clip?.presetText) {
          this.notifyVoiceClipListeners(data.clip);
          tetherAudio.speakText(data.clip.presetText);
        }
        break;

      case 'SESSION_ENDED':
        if (this.activeSession) {
          this.handlePartnerDisconnected(data.reason || 'Partner disconnected');
        }
        break;
    }
  }

  private startPeriodicSync(): void {
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => {
      if (!this.activeSession) {
        if (this.syncInterval) {
          clearInterval(this.syncInterval);
          this.syncInterval = null;
        }
        return;
      }
      if (this.activeSession.status === 'waiting') {
        // Polling database for peer join if not already connected
        this.pollPeerJoinStatus();
      } else if (this.activeSession.status === 'active') {
        // Polling database to check if peer has disconnected/ended
        this.pollActiveSessionStatus();
      }
    }, 2000);
  }

  private async pollActiveSessionStatus(): Promise<void> {
    if (!this.activeSession || this.activeSession.status !== 'active') return;
    try {
      const { data, error } = await insforge.database
        .from('tether_sessions')
        .select('status')
        .eq('room_code', this.activeSession.roomCode)
        .single();

      if (!error && data) {
        if (data.status === 'completed' || data.status === 'ended' || data.status === 'disconnected') {
          this.handlePartnerDisconnected('Your partner disconnected the tether session.');
        }
      }
    } catch {
      // Ignored
    }
  }

  private async pollPeerJoinStatus(): Promise<void> {
    if (!this.activeSession || this.activeSession.status !== 'waiting') return;
    try {
      const { data } = await insforge.database
        .from('tether_sessions')
        .select('*')
        .eq('room_code', this.activeSession.roomCode)
        .single();

      if (data) {
        if (data.status === 'completed' || data.status === 'ended') {
          this.handlePartnerDisconnected('The tether session was cancelled.');
          return;
        }

        if (data.peer_user_id) {
          this.activeSession.peer = {
            userId: data.peer_user_id,
            name: data.peer_name || 'Running Buddy',
            avatarUrl: data.peer_avatar,
            role: 'peer',
            status: 'running',
          };
          this.activeSession.status = 'active';
          this.activeSession.startedAt = new Date().toISOString();
          this.saveSession();
          tetherAudio.playTetherAlert('reconnected');
        }
      }
    } catch {
      // Ignored
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Subscriptions
  // ──────────────────────────────────────────────────────────────────────────

  onTelemetry(listener: TelemetryListener): () => void {
    this.telemetryListeners.add(listener);
    return () => this.telemetryListeners.delete(listener);
  }

  onSessionChange(listener: SessionListener): () => void {
    this.sessionListeners.add(listener);
    listener(this.activeSession);
    return () => this.sessionListeners.delete(listener);
  }

  onVoiceClip(listener: VoiceClipListener): () => void {
    this.voiceClipListeners.add(listener);
    return () => this.voiceClipListeners.delete(listener);
  }

  onPartnerDisconnected(listener: DisconnectListener): () => void {
    this.disconnectListeners.add(listener);
    return () => this.disconnectListeners.delete(listener);
  }

  private notifyDisconnectListeners(reason: string): void {
    this.disconnectListeners.forEach((fn) => {
      try {
        fn(reason);
      } catch {}
    });
  }

  private notifyTelemetryListeners(telemetry: TetherTelemetry, delta: TetherDelta): void {
    this.telemetryListeners.forEach((fn) => fn(telemetry, delta));
  }

  private notifySessionListeners(): void {
    this.sessionListeners.forEach((fn) => fn(this.activeSession));
  }

  private notifyVoiceClipListeners(clip: TetherVoiceClip): void {
    this.voiceClipListeners.forEach((fn) => fn(clip));
  }

  /**
   * Extract room code from current URL (?tether=TR-XXXXXX)
   */
  getRoomCodeFromUrl(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('tether') || params.get('room');
      if (code && code.trim().length > 0) {
        return decodeURIComponent(code.trim().toUpperCase());
      }
    } catch {
      // Ignored
    }
    return null;
  }

  getShareableUrl(roomCode: string): string {
    if (typeof window === 'undefined') return `https://runwar.app/?tether=${roomCode}`;
    return `${window.location.origin}/?tether=${encodeURIComponent(roomCode)}`;
  }
}

export const tetherService = new TetherService();
