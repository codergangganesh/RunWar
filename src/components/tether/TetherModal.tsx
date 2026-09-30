import React, { useState, useEffect } from 'react';
import { tetherService } from '../../services/tetherService';
import { TetherSession } from '../../types/tether';
import { UserProfile } from '../../types';
import {
  X,
  Radio,
  Copy,
  Check,
  Users,
  Unlink,
  Volume2,
  Mic,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface TetherModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  onSessionChange?: (session: TetherSession | null) => void;
}

export const TetherModal: React.FC<TetherModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSessionChange,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'join' | 'active'>('create');
  const [session, setSession] = useState<TetherSession | null>(() => tetherService.getActiveSession());
  const [joinCode, setJoinCode] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [disconnectNotice, setDisconnectNotice] = useState<string | null>(null);

  const onSessionChangeRef = React.useRef(onSessionChange);
  useEffect(() => {
    onSessionChangeRef.current = onSessionChange;
  }, [onSessionChange]);

  const prevIsOpenRef = React.useRef(false);

  // Sync tab only when the modal is freshly opened
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      const current = tetherService.getActiveSession();
      setSession(current);
      setErrorMessage(null);
      if (current?.status === 'active') {
        setActiveTab('active');
      } else if (current?.status === 'waiting') {
        setActiveTab('create');
      } else {
        setActiveTab('create');
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen]);

  // Subscribe to tether events without blowing away user-selected tabs
  useEffect(() => {
    const unsub = tetherService.onSessionChange((s) => {
      setSession(s);
      if (onSessionChangeRef.current) {
        onSessionChangeRef.current(s);
      }
      if (s?.status === 'active') {
        setActiveTab('active');
      }
    });

    const unsubDisconnect = tetherService.onPartnerDisconnected((reason) => {
      setDisconnectNotice(reason || 'Your running partner has disconnected.');
      setActiveTab('create');
    });

    return () => {
      unsub();
      unsubDisconnect();
    };
  }, []);

  if (!isOpen) return null;

  const handleCreateRoom = async () => {
    setErrorMessage(null);
    setDisconnectNotice(null);
    try {
      const newSession = await tetherService.createSession({
        id: profile?.user_id || profile?.id || 'usr_host',
        name: profile?.name || 'Runner',
        username: profile?.username || null,
        avatar_url: profile?.avatar_url || null,
      });
      setSession(newSession);
      setActiveTab('create');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create tether room');
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCode.trim()) {
      setErrorMessage('Please enter a 6-character room code');
      return;
    }
    setErrorMessage(null);
    setDisconnectNotice(null);
    setIsJoining(true);
    try {
      const joinedSession = await tetherService.joinSession(joinCode.trim(), {
        id: profile?.user_id || profile?.id || 'usr_guest',
        name: profile?.name || 'Running Buddy',
        username: profile?.username || null,
        avatar_url: profile?.avatar_url || null,
      });
      if (joinedSession) {
        setSession(joinedSession);
        setActiveTab('active');
        onClose();
      } else {
        setErrorMessage('Room code not found or expired.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to join tether session');
    } finally {
      setIsJoining(false);
    }
  };

  const handleCopyCode = () => {
    if (!session?.roomCode) return;
    navigator.clipboard.writeText(session.roomCode).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const handleDisconnect = async () => {
    await tetherService.endSession();
    setSession(null);
    setActiveTab('create');
  };

  return (
    <div
      className="fixed inset-0 z-[9990] bg-slate-950/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col max-h-[90dvh] overflow-y-auto space-y-4 animate-in slide-in-from-bottom duration-300">
        {/* Mobile Drag Handle Bar */}
        <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mx-auto -mt-2 mb-1 sm:hidden shrink-0" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Radio size={18} className="animate-pulse text-emerald-500" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Virtual Tether Run</span>
                <span className="text-[8px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1 py-0.5 rounded border border-emerald-500/20 leading-none">
                  Walkie-Talkie
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Run together in real-time with live voice radio
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation (if not currently in active session) */}
        {!session || session.status === 'waiting' ? (
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">
            <button
              onClick={() => setActiveTab('create')}
              className={`py-2 rounded-xl transition-all ${activeTab === 'create'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              Host a Tether
            </button>
            <button
              onClick={() => setActiveTab('join')}
              className={`py-2 rounded-xl transition-all ${activeTab === 'join'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
            >
              Join a Buddy
            </button>
          </div>
        ) : null}

        {/* Partner Disconnected Notice */}
        {disconnectNotice && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <Unlink size={15} className="shrink-0 text-amber-500" />
              <span>{disconnectNotice}</span>
            </div>
            <button
              onClick={() => setDisconnectNotice(null)}
              className="text-amber-500 hover:text-amber-600 p-1"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
            {errorMessage}
          </div>
        )}

        {/* TAB 1: CREATE / WAITING ROOM */}
        {activeTab === 'create' && (
          <div className="space-y-4">
            {!session || session.status !== 'waiting' ? (
              <div className="text-center py-4 space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Start a Tether Room to generate a unique 6-character code and invite your running buddy anywhere in the world!
                </p>
                <button
                  onClick={handleCreateRoom}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-sm shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-500 transition-all active:scale-95"
                >
                  Create Tether Room
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-center">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Your Room Code
                </span>
                <div
                  onClick={handleCopyCode}
                  title="Click to copy room code"
                  className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 font-mono text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-widest cursor-pointer hover:bg-emerald-100/50 dark:hover:bg-emerald-900/40 active:scale-98 transition-all flex items-center justify-center gap-2 select-all group shadow-inner"
                >
                  <span>{session.roomCode}</span>
                  <Copy size={16} className="text-emerald-500/60 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
                </div>

                {/* Waiting Pulse */}
                <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-500 animate-pulse pt-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Waiting for buddy to join...</span>
                </div>

                {/* Direct Room Code Copy Button & Cancel Option */}
                <div className="pt-2 space-y-2">
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="w-full py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                  >
                    {isCopied ? <Check size={16} className="text-white" /> : <Copy size={16} />}
                    <span>{isCopied ? 'Room Code Copied to Clipboard!' : 'Copy Room Code'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="w-full py-2.5 rounded-xl border border-rose-500/30 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <X size={14} />
                    <span>Cancel Room</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: JOIN BUDDY ROOM */}
        {activeTab === 'join' && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Enter the 6-character room code shared by your friend to tether your runs together:
            </p>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="e.g. TR-8K2P9M"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={9}
                className="w-full text-center font-mono text-xl font-black uppercase tracking-wider py-3 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              onClick={handleJoinRoom}
              disabled={isJoining || !joinCode.trim()}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-sm shadow-lg shadow-emerald-500/25 hover:from-emerald-400 hover:to-teal-500 transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2"
            >
              <span>{isJoining ? 'Connecting...' : 'Connect & Start Tether'}</span>
              <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* TAB 3: ACTIVE CONNECTED SESSION */}
        {activeTab === 'active' && session && session.status === 'active' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center font-bold text-sm shadow-md">
                  {session.peer?.avatarUrl ? (
                    <img
                      src={session.peer.avatarUrl}
                      alt={session.peer.name}
                      className="w-full h-full rounded-2xl object-cover"
                    />
                  ) : (
                    '🤝'
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-[10px] uppercase font-black text-emerald-600 dark:text-emerald-400">
                      Connected Live
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {session.peer?.name || session.host.name}
                  </h4>
                </div>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                {session.roomCode}
              </span>
            </div>

            {/* Radio / Voice Feature Guide */}
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                <Volume2 size={15} />
                <span>Walkie-Talkie Active</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                Hold the Push-to-Talk button on your active run screen to send voice transmissions with radio chirps directly into your buddy's headphones!
              </p>
            </div>

            {/* Disconnect Button */}
            <button
              onClick={handleDisconnect}
              className="w-full py-2.5 rounded-xl border border-rose-500/30 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Unlink size={14} />
              <span>Disconnect Tether</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
