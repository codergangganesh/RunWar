import React, { useState } from 'react';
import { Bell, ChevronRight, Trash2, X, Loader2, BellOff, Check } from 'lucide-react';
import { AppNotification } from '../types';

interface NotificationsScreenProps {
  userId?: string | null;
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
  onDeleteAll: () => void;
  onNavigate: (url: string) => void;
  onBack: () => void;
}

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  notifications,
  unreadCount,
  isLoading,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete: _onDelete,
  onDeleteAll,
  onNavigate,
  onBack,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const filtered = filter === 'unread'
    ? notifications.filter((n) => !n.read_at && n.status === 'sent')
    : notifications;

  const handleItemClick = (n: AppNotification) => {
    if (!n.read_at && n.status === 'sent') {
      onMarkAsRead(n.id);
    }
    const targetUrl = n.data?.url;
    if (targetUrl && targetUrl !== '/') {
      onNavigate(targetUrl);
    }
  };

  const handleConfirmDeleteAll = () => {
    onDeleteAll();
    setShowDeleteConfirm(false);
  };

  return (
    <div className="min-h-screen bg-[#060b18] text-white flex flex-col select-none">
      {/* Top Handle Bar */}
      <div className="pt-3 pb-1 flex justify-center">
        <div className="w-12 h-1.5 bg-slate-800/80 rounded-full" />
      </div>

      <div className="max-w-xl w-full mx-auto flex-1 flex flex-col px-4 sm:px-6">
        {/* Header Bar */}
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Bell size={26} className="text-emerald-400 shrink-0 stroke-[2.2]" />
            <h1 className="text-2xl font-bold tracking-tight text-white">Notifications</h1>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white flex items-center justify-center transition-all active:scale-90 shadow-sm"
            aria-label="Close notifications"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter Pills & Actions Row */}
        <div className="flex items-center justify-between py-3">
          {/* Segmented Capsule */}
          <div className="inline-flex items-center bg-[#0d1527] border border-slate-800/70 p-1 rounded-full shadow-inner">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${filter === 'all'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                  : 'text-slate-400 hover:text-white'
                }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-1.5 ${filter === 'unread'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                  : 'text-slate-400 hover:text-white'
                }`}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span
                  className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${filter === 'unread' ? 'bg-white/25 text-white' : 'bg-emerald-500/20 text-emerald-400'
                    }`}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Action buttons (Delete all / Mark read) */}
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="hidden sm:flex items-center gap-1 px-3 py-2 rounded-full bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold transition-all active:scale-95"
                title="Mark all as read"
              >
                <Check size={13} />
                <span>Mark read</span>
              </button>
            )}

            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500/20 flex items-center justify-center transition-all active:scale-95 shadow-sm"
                aria-label="Delete all notifications"
                title="Delete all notifications"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto mt-2 divide-y divide-slate-800/60 overscroll-contain">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
              <Loader2 size={28} className="animate-spin text-emerald-500" />
              <p className="text-xs">Loading notifications...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#0d1527] border border-slate-800/80 flex items-center justify-center shadow-inner">
                <BellOff size={28} className="text-slate-600" />
              </div>
              <div>
                <p className="text-base font-bold text-slate-200">
                  {filter === 'unread' ? 'All caught up!' : 'No notifications'}
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  {filter === 'unread'
                    ? 'You have read all your notifications'
                    : 'Reminders, alarms, and workout alerts will show up here'}
                </p>
              </div>
            </div>
          ) : (
            filtered.map((n) => {
              const isUnread = !n.read_at && n.status === 'sent';
              return (
                <div
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className={`py-4 px-2 flex items-center gap-3.5 group cursor-pointer transition-colors hover:bg-slate-900/40 rounded-xl ${isUnread ? 'bg-slate-900/20' : ''
                    }`}
                >
                  {/* Left avatar with golden bell icon */}
                  <div className="relative w-11 h-11 rounded-full bg-[#0d1527] border border-slate-800/80 flex items-center justify-center shrink-0 shadow-sm group-hover:border-slate-700 transition-colors">
                    <Bell size={18} className="text-amber-400 fill-amber-400/20" />
                    {isUnread && (
                      <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#060b18]" />
                    )}
                  </div>

                  {/* Middle content */}
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={`text-sm truncate ${isUnread ? 'font-black text-white' : 'font-semibold text-slate-200'}`}>
                        {n.title}
                      </p>
                      <span className="text-xs text-slate-500 shrink-0 font-normal">
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed mt-1 line-clamp-2">
                      {n.message}
                    </p>
                  </div>

                  {/* Right chevron */}
                  <ChevronRight size={18} className="text-slate-600 group-hover:text-slate-400 shrink-0 transition-colors ml-1" />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Confirmation Modal for Delete All */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0b1329] border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Delete All Notifications?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to clear all notifications? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs hover:bg-slate-700 transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAll}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-bold text-xs hover:bg-rose-600 transition-all active:scale-95 shadow-md shadow-rose-500/20"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
