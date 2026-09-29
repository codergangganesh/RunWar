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
    <div className="min-h-screen bg-[#f0fdf4] dark:bg-[#060b18] text-slate-900 dark:text-white flex flex-col select-none transition-colors">
      {/* Top Handle Bar */}
      <div className="pt-3 pb-1 flex justify-center">
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700/80 rounded-full" />
      </div>

      <div className="max-w-xl w-full mx-auto flex-1 flex flex-col px-4 sm:px-6">
        {/* Header Bar */}
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Bell size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Notifications
              </h1>
              {unreadCount > 0 && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                  {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white flex items-center justify-center transition-all active:scale-90 shadow-sm border border-slate-200 dark:border-slate-700/60 cursor-pointer"
            aria-label="Close notifications"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter Pills & Actions Row */}
        <div className="flex items-center justify-between py-3">
          {/* Segmented Capsule */}
          <div className="inline-flex items-center bg-white/80 dark:bg-[#0d1527] border border-emerald-100 dark:border-slate-800/80 p-1 rounded-full shadow-xs">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                filter === 'all'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                filter === 'unread'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span
                  className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                    filter === 'unread'
                      ? 'bg-white/25 text-white'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
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
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-slate-800/60 hover:bg-emerald-100 dark:hover:bg-slate-800 text-emerald-700 dark:text-slate-300 hover:text-emerald-900 dark:hover:text-white text-xs font-bold transition-all active:scale-95 border border-emerald-200/60 dark:border-transparent cursor-pointer"
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
                className="w-9 h-9 rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/20 flex items-center justify-center transition-all active:scale-95 shadow-xs cursor-pointer"
                aria-label="Delete all notifications"
                title="Delete all notifications"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto mt-2 space-y-2.5 pb-6 overscroll-contain">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
              <Loader2 size={28} className="animate-spin text-emerald-500" />
              <p className="text-xs">Loading notifications...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white dark:bg-[#0d1527] border border-slate-200 dark:border-slate-800/80 flex items-center justify-center shadow-xs">
                <BellOff size={28} className="text-slate-400 dark:text-slate-600" />
              </div>
              <div>
                <p className="text-base font-bold text-slate-900 dark:text-slate-200">
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
                  className={`p-3.5 sm:p-4 rounded-2xl flex items-center gap-3.5 group cursor-pointer transition-all border ${
                    isUnread
                      ? 'bg-white dark:bg-slate-900/90 border-emerald-200/90 dark:border-emerald-500/30 shadow-sm'
                      : 'bg-white/80 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800/60 hover:bg-white dark:hover:bg-slate-900/80 shadow-xs'
                  }`}
                >
                  {/* Left avatar with golden bell icon */}
                  <div className="relative w-11 h-11 rounded-full bg-amber-50 dark:bg-[#0d1527] border border-amber-200/60 dark:border-slate-800/80 flex items-center justify-center shrink-0 shadow-xs group-hover:border-amber-300 dark:group-hover:border-slate-700 transition-colors">
                    <Bell size={18} className="text-amber-500 dark:text-amber-400 fill-amber-500/20 dark:fill-amber-400/20" />
                    {isUnread && (
                      <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#060b18]" />
                    )}
                  </div>

                  {/* Middle content */}
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={`text-sm truncate ${isUnread ? 'font-black text-slate-900 dark:text-white' : 'font-bold text-slate-700 dark:text-slate-200'}`}>
                        {n.title}
                      </p>
                      <span className="text-xs text-emerald-700/80 dark:text-slate-400 shrink-0 font-medium">
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-1 line-clamp-2">
                      {n.message}
                    </p>
                  </div>

                  {/* Right chevron */}
                  <ChevronRight size={18} className="text-slate-400 dark:text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-400 shrink-0 transition-colors ml-1" />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Confirmation Modal for Delete All */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#0b1329] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-500 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete All Notifications?</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Are you sure you want to clear all notifications? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAll}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs transition-all active:scale-95 shadow-md shadow-rose-500/20 cursor-pointer"
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
