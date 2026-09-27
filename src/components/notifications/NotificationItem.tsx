import React from 'react';
import { AppNotification, NotificationType } from '../../types';
import { Bell, Target, Trophy, Swords, User, Zap, Settings, Clock, X } from 'lucide-react';

function getIcon(type: NotificationType) {
  const cls = 'shrink-0';
  switch (type) {
    case 'alarm':       return <Clock size={15} className={`${cls} text-emerald-500`} />;
    case 'goal':        return <Target size={15} className={`${cls} text-amber-500`} />;
    case 'challenge':   return <Swords size={15} className={`${cls} text-indigo-500`} />;
    case 'social':      return <User size={15} className={`${cls} text-blue-500`} />;
    case 'workout':     return <Zap size={15} className={`${cls} text-emerald-500`} />;
    case 'achievement': return <Trophy size={15} className={`${cls} text-amber-500`} />;
    case 'system':      return <Settings size={15} className={`${cls} text-slate-400`} />;
    default:            return <Bell size={15} className={`${cls} text-slate-400`} />;
  }
}

function getTypeBg(type: NotificationType) {
  switch (type) {
    case 'alarm':       return 'bg-emerald-500/10 border-emerald-500/20';
    case 'goal':        return 'bg-amber-500/10 border-amber-500/20';
    case 'challenge':   return 'bg-indigo-500/10 border-indigo-500/20';
    case 'social':      return 'bg-blue-500/10 border-blue-500/20';
    case 'workout':     return 'bg-emerald-500/10 border-emerald-500/20';
    case 'achievement': return 'bg-amber-500/10 border-amber-500/20';
    default:            return 'bg-slate-500/10 border-slate-500/20';
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface NotificationItemProps {
  notification: AppNotification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate?: (url: string) => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification: n,
  onRead,
  onDelete,
  onNavigate,
}) => {
  const isUnread = !n.read_at && n.status === 'sent';

  const handleClick = () => {
    if (isUnread) onRead(n.id);
    const url = n.data?.url || '/';
    if (onNavigate) onNavigate(url);
  };

  return (
    <div
      className={`relative flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer group active:scale-[0.98] ${
        isUnread
          ? 'bg-white dark:bg-slate-900 border-emerald-100 dark:border-slate-700 shadow-sm'
          : 'bg-slate-50/50 dark:bg-slate-950/50 border-transparent'
      }`}
      onClick={handleClick}
    >
      {/* Type icon */}
      <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${getTypeBg(n.type)}`}>
        {getIcon(n.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-xs font-bold truncate ${isUnread ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
            {n.title}
          </p>
          <span className="text-[9px] text-slate-400 dark:text-slate-500 shrink-0 mt-0.5">
            {timeAgo(n.created_at)}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5 line-clamp-2">
          {n.message}
        </p>
      </div>

      {/* Unread dot */}
      {isUnread && (
        <div className="absolute top-3 right-9 w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
      )}

      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(n.id); }}
        className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all"
        aria-label="Delete notification"
      >
        <X size={10} />
      </button>
    </div>
  );
};
