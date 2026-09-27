import React, { useState } from 'react';
import { Bell, BellOff, CheckCheck, Loader2, Trash2, X } from 'lucide-react';
import { AppNotification } from '../../types';
import { NotificationItem } from './NotificationItem';

interface NotificationCenterProps {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onDelete: (id: string) => void;
  onDeleteAll?: () => void;
  onNavigate: (url: string) => void;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  unreadCount,
  isLoading,
  onMarkAsRead,
  onMarkAllAsRead,
  onDelete,
  onDeleteAll,
  onNavigate,
  onClose,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const filtered = filter === 'unread'
    ? notifications.filter((n) => !n.read_at && n.status === 'sent')
    : notifications;

  return (
    <div className="flex flex-col h-full max-h-[85vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <Bell size={16} className="text-emerald-500" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white">Notifications</h2>
            {unreadCount > 0 && (
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                {unreadCount} unread
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all active:scale-95"
              title="Mark all notifications as read"
            >
              <CheckCheck size={12} />
              <span className="hidden sm:inline">Mark all read</span>
            </button>
          )}

          {notifications.length > 0 && onDeleteAll && (
            isConfirmingDelete ? (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsConfirmingDelete(false);
                    onDeleteAll();
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-500 text-white text-xs font-bold hover:bg-rose-600 transition-all active:scale-95 shadow-sm"
                  title="Confirm delete all notifications"
                >
                  <Trash2 size={12} />
                  <span>Delete all</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all active:scale-90"
                  title="Cancel"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all active:scale-95"
                title="Delete all notifications"
                aria-label="Delete all notifications"
              >
                <Trash2 size={13} />
                <span className="hidden sm:inline">Delete all</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 px-4 pb-3 shrink-0">
        {(['all', 'unread'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-bold capitalize transition-all ${
              filter === f
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {f}
            {f === 'unread' && unreadCount > 0 && (
              <span className="ml-1 bg-white/30 rounded-full px-1">{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-slate-100 dark:border-slate-800 mx-4 shrink-0" />

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 overscroll-contain">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 size={24} className="animate-spin text-emerald-500" />
            <p className="text-xs text-slate-400">Loading notifications...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <BellOff size={24} className="text-slate-300 dark:text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {filter === 'unread'
                  ? 'No unread notifications'
                  : 'Enable push notifications to get running reminders'}
              </p>
            </div>
          </div>
        ) : (
          filtered.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onRead={onMarkAsRead}
              onDelete={onDelete}
              onNavigate={(url) => { onNavigate(url); onClose(); }}
            />
          ))
        )}
      </div>
    </div>
  );
};

// ── Bell trigger button (used in TopHeader) ───────────────────────────────────

interface NotificationBellProps {
  unreadCount: number;
  onClick: () => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ unreadCount, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="relative w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-white active:scale-90 transition-all flex items-center justify-center shrink-0 shadow-sm"
    aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
    title="Notifications"
  >
    <Bell size={15} className={unreadCount > 0 ? 'text-emerald-500' : ''} />
    {unreadCount > 0 && (
      <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 bg-rose-500 rounded-full text-white text-[8px] font-black flex items-center justify-center px-0.5 leading-none">
        {unreadCount > 9 ? '9+' : unreadCount}
      </span>
    )}
  </button>
);
