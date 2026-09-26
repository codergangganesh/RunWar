import React, { useState, useEffect, useCallback } from 'react';
import { Trophy, Bell, Plus, RefreshCw, Loader2, Swords, CheckCircle2, Clock, ChevronLeft, BellRing, Check, X, Trash2, AlertTriangle } from 'lucide-react';
import { Challenge, ChallengeNotification } from '../types';
import { challengeService } from '../services/challengeService';
import { ChallengeCard } from '../components/challenge/ChallengeCard';
import { CreateChallengeModal } from '../components/challenge/CreateChallengeModal';
import { EditChallengeModal } from '../components/challenge/EditChallengeModal';
import { ChallengeRequestModal } from '../components/challenge/ChallengeRequestModal';
import { ChallengeDetailModal } from '../components/challenge/ChallengeDetailModal';
import { UserProfile } from '../types';

interface Props {
  currentUser: UserProfile;
  onStartRun?: (challenge: Challenge) => void;
  onBack?: () => void;
}

type Tab = 'active' | 'history' | 'notifications';

export const ChallengesScreen: React.FC<Props> = ({ currentUser, onStartRun, onBack }) => {
  const userId = currentUser.user_id || currentUser.id || '';

  const [tab, setTab] = useState<Tab>('active');
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [notifications, setNotifications] = useState<ChallengeNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [deletingChallenge, setDeletingChallenge] = useState<Challenge | null>(null);
  const [selectedDetailChallenge, setSelectedDetailChallenge] = useState<Challenge | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingChallenge, setPendingChallenge] = useState<Challenge | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);

  const loadData = useCallback(async () => {
    if (!userId) return;
    try {
      const [challengeList, notifList, unread] = await Promise.all([
        challengeService.getUserChallenges(userId),
        challengeService.getNotifications(userId),
        challengeService.getUnreadNotificationCount(userId),
      ]);
      setChallenges(challengeList);
      setNotifications(notifList);
      setUnreadCount(unread);
    } catch (err) {
      console.warn('ChallengesScreen loadData error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();

    // Periodic sync interval (15s) to guarantee UI reflects opponent acceptance/run status in real time
    const intervalId = setInterval(() => {
      loadData();
    }, 15000);

    // Realtime subscription for new notifications
    const unsub = challengeService.subscribeToNotifications(userId, (notif) => {
      setNotifications((prev) => [notif, ...prev]);
      setUnreadCount((c) => c + 1);
      // Reload challenges immediately when an acceptance notification arrives
      loadData();
    });

    return () => {
      clearInterval(intervalId);
      unsub();
    };
  }, [userId, loadData]);

  // Check for pending challenge requests to auto-show
  useEffect(() => {
    const pending = challenges.find(
      (c) => c.status === 'pending' && c.creator_id !== userId && c.my_participation?.status === 'pending'
    );
    if (pending) {
      setPendingChallenge(pending);
    }
  }, [challenges, userId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const handleTabChange = async (t: Tab) => {
    setTab(t);
    if (t === 'notifications' && unreadCount > 0) {
      await challengeService.markNotificationsRead(userId);
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    }
  };

  const handleChallengeAccepted = (updated: Challenge) => {
    setChallenges((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setShowRequestModal(false);
    setPendingChallenge(null);
    setTab('active');
  };

  const handleChallengeRejected = () => {
    setChallenges((prev) => prev.filter((c) => c.id !== pendingChallenge?.id));
    setShowRequestModal(false);
    setPendingChallenge(null);
  };

  const handleCardAccept = (updated: Challenge) => {
    setChallenges((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handleCardReject = () => {
    loadData();
  };

  const handleChallengeCreated = () => {
    loadData();
  };

  const handleChallengeUpdated = (updated: Challenge) => {
    setChallenges((prev) =>
      prev.map((c) => (c.id === updated.id ? { ...c, ...updated, title: updated.title, target_distance_meters: updated.target_distance_meters } : c))
    );
    if (selectedDetailChallenge?.id === updated.id) {
      setSelectedDetailChallenge((prev) => (prev ? { ...prev, ...updated, title: updated.title, target_distance_meters: updated.target_distance_meters } : updated));
    }
    loadData();
  };

  const handleConfirmDelete = async () => {
    if (!deletingChallenge) return;
    const targetId = deletingChallenge.id;
    setIsDeleting(true);
    setDeleteError(null);

    // Optimistically remove from UI state immediately
    setChallenges((prev) => prev.filter((c) => c.id !== targetId));
    setDeletingChallenge(null);

    try {
      await challengeService.deleteChallenge(targetId, userId);
    } catch (err: any) {
      console.error('Error deleting challenge from DB:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Split challenges
  const activeChallenges = challenges.filter((c) =>
    ['pending', 'accepted', 'active'].includes(c.status)
  );
  const historyChallenges = challenges.filter((c) =>
    ['completed', 'rejected', 'cancelled', 'expired'].includes(c.status)
  );

  const TABS: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'active', label: 'Active', icon: <Swords size={15} />, count: activeChallenges.length },
    { id: 'history', label: 'History', icon: <CheckCircle2 size={15} />, count: historyChallenges.length },
    { id: 'notifications', label: 'Inbox', icon: <Bell size={15} />, count: unreadCount > 0 ? unreadCount : undefined },
  ];

  return (
    <div className="min-h-full bg-slate-50/70 dark:bg-[#080810] text-slate-900 dark:text-white flex flex-col">
      {/* Header */}
      <div className="px-5 pt-safe pt-5 pb-4 flex items-center gap-3 border-b border-slate-200/80 dark:border-white/[0.07] bg-white/80 dark:bg-slate-950/60 backdrop-blur-md">
        {onBack && (
          <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-white/50 transition-colors">
            <ChevronLeft size={22} />
          </button>
        )}
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-500/25">
            <Trophy size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-slate-900 dark:text-white font-bold text-lg leading-tight">Challenges</h1>
            <p className="text-slate-500 dark:text-white/40 text-xs">{challenges.length} total challenge{challenges.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={handleRefresh} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-white/40 transition-colors" disabled={refreshing}>
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-bold shadow-lg shadow-emerald-500/30 hover:opacity-90 active:scale-[0.97] transition-all cursor-pointer"
        >
          New
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 px-5 pt-4 pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => handleTabChange(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${tab === t.id
              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white border border-emerald-500 shadow-md shadow-emerald-500/20'
              : 'bg-white dark:bg-white/[0.04] text-slate-700 dark:text-white/60 border border-slate-200/90 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/[0.07] hover:text-slate-900 dark:hover:text-white font-semibold'
              }`}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-black leading-none ${tab === t.id
                  ? 'bg-white text-emerald-900 shadow-xs border border-emerald-200/60'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-300/80 dark:border-slate-700'
                  }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-32">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 size={32} className="text-emerald-500 animate-spin" />
            <p className="text-slate-500 dark:text-white/40 text-sm">Loading challenges…</p>
          </div>
        ) : (
          <>
            {/* Active Tab */}
            {tab === 'active' && (
              <div className="space-y-3">
                {activeChallenges.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">

                    <div className="text-center">
                      <h3 className="text-slate-800 dark:text-white/70 font-semibold">No active challenges</h3>
                      <p className="text-slate-500 dark:text-white/30 text-sm mt-1">Challenge a friend to a race!</p>
                    </div>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/30 hover:opacity-90 transition-all cursor-pointer"
                    >
                      Create a Challenge
                    </button>
                  </div>
                ) : (
                  activeChallenges.map((c) => (
                    <ChallengeCard
                      key={c.id}
                      challenge={c}
                      currentUserId={userId}
                      onAccept={handleCardAccept}
                      onReject={handleCardReject}
                      onEdit={(ch) => setEditingChallenge(ch)}
                      onDelete={(ch) => {
                        setDeleteError(null);
                        setDeletingChallenge(ch);
                      }}
                      onPress={(ch) => {
                        if (ch.status === 'pending' && ch.creator_id !== userId && ch.my_participation?.status === 'pending') {
                          setPendingChallenge(ch);
                          setShowRequestModal(true);
                        } else {
                          setSelectedDetailChallenge(ch);
                        }
                      }}
                      onStartRun={onStartRun}
                    />
                  ))
                )}
              </div>
            )}

            {/* History Tab */}
            {tab === 'history' && (
              <div className="space-y-3">
                {historyChallenges.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">

                    <div className="text-center">
                      <h3 className="text-slate-800 dark:text-white/70 font-semibold">No challenge history</h3>
                      <p className="text-slate-500 dark:text-white/30 text-sm mt-1">Completed challenges will appear here</p>
                    </div>
                  </div>
                ) : (
                  historyChallenges.map((c) => (
                    <ChallengeCard
                      key={c.id}
                      challenge={c}
                      currentUserId={userId}
                      onEdit={(ch) => setEditingChallenge(ch)}
                      onDelete={(ch) => {
                        setDeleteError(null);
                        setDeletingChallenge(ch);
                      }}
                      onPress={(ch) => setSelectedDetailChallenge(ch)}
                    />
                  ))
                )}
              </div>
            )}

            {/* Notifications Tab */}
            {tab === 'notifications' && (
              <div className="space-y-3">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="w-20 h-20 rounded-3xl bg-white dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/10 flex items-center justify-center shadow-sm">
                      <Bell size={36} className="text-slate-300 dark:text-white/20" />
                    </div>
                    <div className="text-center">
                      <h3 className="text-slate-800 dark:text-white/70 font-semibold">No notifications</h3>
                      <p className="text-slate-500 dark:text-white/30 text-sm mt-1">Challenge updates will appear here</p>
                    </div>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 p-4 rounded-2xl border transition-all ${!n.is_read
                        ? 'bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 shadow-xs'
                        : 'bg-white dark:bg-white/[0.03] border-slate-200/80 dark:border-white/[0.06] shadow-2xs'
                        }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${!n.is_read ? 'bg-emerald-500/15 dark:bg-emerald-500/20' : 'bg-slate-100 dark:bg-white/[0.07]'
                        }`}>
                        {n.type === 'challenge_received' && <BellRing size={17} className="text-emerald-500 dark:text-emerald-400" />}
                        {n.type === 'challenge_accepted' && <Check size={17} className="text-emerald-500 dark:text-emerald-400" />}
                        {(n.type === 'opponent_completed' || n.type === 'challenge_completed') && <Trophy size={17} className="text-amber-500 dark:text-yellow-400" />}
                        {n.type === 'challenge_rejected' && <X size={17} className="text-rose-500 dark:text-rose-400" />}
                        {!['challenge_received', 'challenge_accepted', 'opponent_completed', 'challenge_completed', 'challenge_rejected'].includes(n.type) && <Bell size={17} className="text-slate-400 dark:text-white/40" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-semibold ${!n.is_read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-white/60'}`}>{n.title}</div>
                        <div className="text-slate-500 dark:text-white/40 text-xs mt-0.5">{n.message}</div>
                        <div className="text-slate-400 dark:text-white/25 text-xs mt-1">
                          {new Date(n.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1" />
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <CreateChallengeModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        userId={userId}
        currentUser={currentUser}
        distanceUnit={(currentUser.distance_unit as 'km' | 'mi') || 'km'}
        onChallengeCreated={handleChallengeCreated}
      />

      <EditChallengeModal
        isOpen={!!editingChallenge}
        challenge={editingChallenge}
        userId={userId}
        distanceUnit={(currentUser.distance_unit as 'km' | 'mi') || 'km'}
        onClose={() => setEditingChallenge(null)}
        onChallengeUpdated={handleChallengeUpdated}
      />

      <ChallengeRequestModal
        isOpen={showRequestModal}
        challenge={pendingChallenge}
        currentUserId={userId}
        onAccepted={handleChallengeAccepted}
        onRejected={handleChallengeRejected}
        onClose={() => { setShowRequestModal(false); setPendingChallenge(null); }}
      />

      <ChallengeDetailModal
        isOpen={!!selectedDetailChallenge}
        challenge={selectedDetailChallenge}
        currentUserId={userId}
        distanceUnit={(currentUser.distance_unit as 'km' | 'mi') || 'km'}
        onClose={() => setSelectedDetailChallenge(null)}
        onStartRun={onStartRun}
        onEdit={(ch) => setEditingChallenge(ch)}
      />

      {/* Delete Confirmation Modal */}
      {deletingChallenge && (
        <div
          className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4 select-none"
          onClick={(e) => e.target === e.currentTarget && !isDeleting && setDeletingChallenge(null)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-xs" onClick={() => !isDeleting && setDeletingChallenge(null)} />

          <div className="relative w-full max-w-md bg-white dark:bg-[#0f0f1a] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 space-y-4 animate-slide-up z-10 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Delete Challenge?
                </h3>
                <p className="text-xs text-slate-500 dark:text-white/50">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-white/[0.03] p-3 rounded-2xl border border-slate-200/80 dark:border-white/5">
              Are you sure you want to delete <strong className="text-slate-900 dark:text-white">"{deletingChallenge.title}"</strong>? It will be removed permanently from your account and all participants.
            </p>

            {deleteError && (
              <p className="text-xs text-rose-500 font-semibold">{deleteError}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingChallenge(null)}
                className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/30 transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    <span>Delete Challenge</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

