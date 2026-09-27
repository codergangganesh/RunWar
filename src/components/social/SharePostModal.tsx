import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Check, Share2, Send, MessageCircle, Globe, Sparkles } from 'lucide-react';
import { FeedPost, socialService } from '../../services/socialService';
import { formatDistance, formatDuration, formatPace } from '../../utils/formatters';

interface SharePostModalProps {
  post: FeedPost | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SharePostModal: React.FC<SharePostModalProps> = ({ post, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !post) return null;

  const shareDetails = socialService.getPostShareDetails(post);
  const distMeters = post.workout?.distance_meters || 0;
  const distFormatted = formatDistance(distMeters, 'km');
  const paceFormatted = formatPace(post.workout?.average_pace || 360, 'min_km');
  const durFormatted = formatDuration(post.workout?.duration_seconds || 1800);

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareDetails.url);
      } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = shareDetails.url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareDetails.title,
          text: shareDetails.text,
          url: shareDetails.url,
        });
        onClose();
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.warn('Native share error:', err);
        }
      }
    } else {
      handleCopyLink();
    }
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all transform animate-scale-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Share2 size={16} />
            </div>
            <div>
              <h3 id="share-modal-title" className="font-display text-sm font-black text-slate-900 dark:text-white">
                Share Workout
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Unique global link for this activity
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer"
            aria-label="Close share dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Post Preview Card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 space-y-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full overflow-hidden bg-emerald-100 dark:bg-slate-800 border border-emerald-300 dark:border-slate-700 shrink-0">
                {post.userAvatar ? (
                  <img src={post.userAvatar} alt={post.userName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-xs text-emerald-800 dark:text-emerald-300">
                    {post.userName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                    {post.userName}
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    {post.userBadge || 'Athlete'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Globe size={11} />
                  <span>Public permalink</span>
                </div>
              </div>
            </div>

            {/* Metrics Snapshot */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-center">
              <div className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50">
                <div className="text-[10px] uppercase font-bold text-slate-400">Distance</div>
                <div className="font-mono text-xs font-black text-slate-900 dark:text-white mt-0.5">
                  {distFormatted} km
                </div>
              </div>
              <div className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50">
                <div className="text-[10px] uppercase font-bold text-slate-400">Pace</div>
                <div className="font-mono text-xs font-black text-slate-900 dark:text-white mt-0.5">
                  {paceFormatted}
                </div>
              </div>
              <div className="p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50">
                <div className="text-[10px] uppercase font-bold text-slate-400">Time</div>
                <div className="font-mono text-xs font-black text-slate-900 dark:text-white mt-0.5">
                  {durFormatted}
                </div>
              </div>
            </div>

            {post.caption && (
              <p className="text-xs text-slate-700 dark:text-slate-300 italic line-clamp-2 pt-1 border-t border-slate-200/40 dark:border-slate-800/40">
                "{post.caption}"
              </p>
            )}
          </div>

          {/* Dedicated Link Box */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Dedicated Post URL
            </label>
            <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <input
                type="text"
                readOnly
                value={shareDetails.url}
                className="flex-1 bg-transparent px-2.5 py-1 text-xs font-mono text-slate-800 dark:text-slate-200 outline-none truncate select-all"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 shadow-sm ${
                  copied
                    ? 'bg-emerald-500 text-white shadow-emerald-500/25'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-95'
                }`}
              >
                {copied ? (
                  <>
                    <Check size={14} />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Native Share Button (if supported) */}
          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-600 text-white text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-emerald-500/20 active:scale-98 transition-all cursor-pointer"
            >
              <Share2 size={15} />
              <span>Share via App / More Options</span>
            </button>
          )}

          {/* Social Quick Share Grid */}
          <div className="space-y-2 pt-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Instant Share To
            </div>
            <div className="grid grid-cols-3 gap-2">
              {/* WhatsApp */}
              <a
                href={shareDetails.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 active:scale-95 transition-all text-center group cursor-pointer"
              >
                <div className="w-7 h-7 rounded-xl bg-[#25D366] text-white flex items-center justify-center shadow-sm">
                  <MessageCircle size={15} fill="currentColor" />
                </div>
                <span className="text-[11px] font-bold">WhatsApp</span>
              </a>

              {/* Twitter / X */}
              <a
                href={shareDetails.twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 active:scale-95 transition-all text-center group cursor-pointer"
              >
                <div className="w-7 h-7 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center shadow-sm">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </div>
                <span className="text-[11px] font-bold">X (Twitter)</span>
              </a>

              {/* Telegram */}
              <a
                href={shareDetails.telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-2xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/40 active:scale-95 transition-all text-center group cursor-pointer"
              >
                <div className="w-7 h-7 rounded-xl bg-[#0088cc] text-white flex items-center justify-center shadow-sm">
                  <Send size={13} className="translate-x-0.5 -translate-y-0.5" />
                </div>
                <span className="text-[11px] font-bold">Telegram</span>
              </a>
            </div>
          </div>

          {/* Viral Conversion / Info Footer */}
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px]">
            <Sparkles size={14} className="shrink-0 text-amber-500" />
            <span>
              Anyone with this link can view this workout, even without a RunWar account.
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
