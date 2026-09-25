import React, { useState, useEffect } from 'react';
import { X, Trophy, Loader2, Check, Pencil } from 'lucide-react';
import { Challenge } from '../../types';
import { challengeService } from '../../services/challengeService';

interface Props {
  isOpen: boolean;
  challenge: Challenge | null;
  userId: string;
  distanceUnit: 'km' | 'mi';
  onClose: () => void;
  onChallengeUpdated: (updated: Challenge) => void;
}

const PRESET_DISTANCES_M = [1000, 3000, 5000, 10000, 21097, 42195];

export const EditChallengeModal: React.FC<Props> = ({
  isOpen,
  challenge,
  userId,
  distanceUnit,
  onClose,
  onChallengeUpdated,
}) => {
  const [title, setTitle] = useState('');
  const [selectedDistance, setSelectedDistance] = useState<number>(5000);
  const [customKm, setCustomKm] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (challenge && isOpen) {
      setTitle(challenge.title || '');
      const dist = challenge.target_distance_meters || 5000;
      if (PRESET_DISTANCES_M.includes(dist)) {
        setSelectedDistance(dist);
        setIsCustom(false);
        setCustomKm((dist / 1000).toString());
      } else {
        setIsCustom(true);
        setSelectedDistance(dist);
        setCustomKm((dist / 1000).toString());
      }
      setError('');
    }
  }, [challenge?.id, isOpen]);

  if (!isOpen || !challenge) return null;

  const effectiveDistance = isCustom
    ? parseFloat(customKm || '0') * 1000
    : selectedDistance;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Please enter a valid challenge title.');
      return;
    }
    if (effectiveDistance < 100) {
      setError('Please select or enter a valid distance (min 0.1 KM).');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const updated = await challengeService.updateChallenge(challenge.id, userId, {
        title: cleanTitle,
        target_distance_meters: effectiveDistance,
      });

      onChallengeUpdated(updated);
      onClose();
    } catch (err: any) {
      console.error('Error updating challenge:', err);
      setError(err?.message || 'Failed to update challenge title. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white dark:bg-[#0f0f1a] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-slide-up select-none">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-200/80 dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Pencil size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-slate-900 dark:text-white font-bold text-lg leading-tight">
                Edit Challenge
              </h2>
              <p className="text-slate-500 dark:text-white/40 text-xs">
                Modify title and target distance
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 dark:text-white/50 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              Challenge Title
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 5K Race vs Opponent"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white text-sm font-semibold outline-none focus:border-emerald-500/60"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
              Target Distance
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: '1 KM', m: 1000 },
                { label: '3 KM', m: 3000 },
                { label: '5 KM', m: 5000 },
                { label: '10 KM', m: 10000 },
                { label: 'Half', m: 21097 },
                { label: 'Full', m: 42195 },
              ].map((p) => {
                const isSelected = !isCustom && selectedDistance === p.m;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setSelectedDistance(p.m);
                      setIsCustom(false);
                    }}
                    className={`py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${isSelected
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-emerald-500 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-emerald-300 dark:hover:border-emerald-500/50'
                      }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={() => setIsCustom(!isCustom)}
                className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline mb-1.5 flex items-center gap-1 cursor-pointer"
              >
                <span>{isCustom ? '← Use Preset Distances' : '+ Set Custom Target Distance (KM)'}</span>
              </button>
              {isCustom && (
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="500"
                  value={customKm}
                  onChange={(e) => setCustomKm(e.target.value)}
                  placeholder="e.g. 7.5 KM"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white text-sm font-bold outline-none focus:border-emerald-500/60"
                />
              )}
            </div>
          </div>

          {error && (
            <p className="text-rose-500 text-xs font-semibold">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 rounded-2xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 text-sm font-medium hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-[2] py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/30 hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              <span>{saving ? 'Saving Updates...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
