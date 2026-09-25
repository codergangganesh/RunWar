import React, { useState, useCallback, useRef } from 'react';
import { X, Search, Trophy, Copy, Check, ChevronRight, Loader2, UserCircle, Share2 } from 'lucide-react';
import { challengeService } from '../../services/challengeService';
import { UserProfile, PublicProfile, CreateChallengeParams, ChallengeType } from '../../types';
import { formatDistance } from '../../utils/formatters';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  currentUser?: UserProfile | null;
  distanceUnit: 'km' | 'mi';
  onChallengeCreated?: (challengeId: string, inviteUrl: string) => void;
}

const PRESET_DISTANCES_M = [1000, 3000, 5000, 10000, 21097, 42195];
const PRESET_LABELS = ['1 KM', '3 KM', '5 KM', '10 KM', 'Half', 'Full'];

type Step = 'distance' | 'invite' | 'share';

export const CreateChallengeModal: React.FC<Props> = ({ isOpen, onClose, userId, currentUser, distanceUnit, onChallengeCreated }) => {
  const [step, setStep] = useState<Step>('distance');
  const [selectedDistance, setSelectedDistance] = useState<number>(5000);
  const [customKm, setCustomKm] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [challengeType] = useState<ChallengeType>('distance_race');

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicProfile[]>([]);
  const [selectedAthletes, setSelectedAthletes] = useState<PublicProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [validationState, setValidationState] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [validationError, setValidationError] = useState('');
  const [validProfile, setValidProfile] = useState<PublicProfile | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [creating, setCreating] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [createdChallengeId, setCreatedChallengeId] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const effectiveDistance = isCustom
    ? parseFloat(customKm || '0') * 1000
    : selectedDistance;

  const myUsername = (currentUser?.username || '').replace(/^@/, '').toLowerCase().trim();

  // Real-time live username validation
  const handleInputChange = (val: string) => {
    setQuery(val);
    setValidationError('');
    setValidProfile(null);
    clearTimeout(searchTimer.current);

    const clean = val.replace(/^@/, '').toLowerCase().trim();
    if (!clean) {
      setValidationState('idle');
      setSearchResults([]);
      return;
    }

    // Check self username
    if (myUsername && clean === myUsername) {
      setValidationState('invalid');
      setValidationError('Self username not allowed.');
      return;
    }

    // Check duplicate in selected list
    if (selectedAthletes.some((a) => (a.username || '').toLowerCase().trim() === clean)) {
      setValidationState('invalid');
      setValidationError('Athlete already added.');
      return;
    }

    setValidationState('checking');
    searchTimer.current = setTimeout(async () => {
      const res = await challengeService.checkUsernameAvailable(clean, userId);

      // If user exists in DB -> valid athlete to challenge
      if (!res.available && res.profile) {
        if (selectedAthletes.some((a) => a.user_id === res.profile!.user_id)) {
          setValidationState('invalid');
          setValidationError('Athlete already added.');
          setValidProfile(null);
        } else {
          setValidationState('valid');
          setValidationError('');
          setValidProfile(res.profile);
        }
      } else if (res.available) {
        // Available means not in DB -> invalid athlete
        setValidationState('invalid');
        setValidationError(`User @${clean} not found.`);
        setValidProfile(null);
      } else {
        setValidationState('invalid');
        setValidationError(res.reason || 'Invalid username.');
        setValidProfile(null);
      }

      // Also trigger search dropdown
      const results = await challengeService.searchUsers(val, userId);
      setSearchResults(results);
    }, 300);
  };

  const addAthlete = (profile: PublicProfile) => {
    if (selectedAthletes.some((a) => a.user_id === profile.user_id)) return;
    setSelectedAthletes((prev) => [...prev, profile]);
    setQuery('');
    setSearchResults([]);
    setValidationState('idle');
    setValidProfile(null);
    setValidationError('');
  };

  const handleCreate = async () => {
    if (effectiveDistance < 100) { setError('Please select or enter a distance.'); return; }
    setCreating(true);
    setError('');
    try {
      const distKm = (effectiveDistance / 1000).toFixed(0);
      const recipientUsernames = selectedAthletes.map((a) => a.username).filter(Boolean) as string[];
      const recipientUserIds = selectedAthletes.map((a) => a.user_id);

      const params: CreateChallengeParams = {
        title: selectedAthletes.length > 0
          ? `${distKm} KM Race (${selectedAthletes.length + 1} Athletes)`
          : `${distKm} KM Running Challenge`,
        challenge_type: challengeType,
        target_distance_meters: effectiveDistance,
        recipient_user_ids: recipientUserIds,
        recipient_usernames: recipientUsernames,
      };

      const { challenge, invitation } = await challengeService.createChallenge(userId, params);
      const url = challengeService.buildInviteUrl(invitation.invite_token);
      setInviteUrl(url);
      setCreatedChallengeId(challenge.id);
      setStep('share');
      onChallengeCreated?.(challenge.id, url);
    } catch (e: any) {
      setError(e?.message || 'Failed to create challenge. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const resetAndClose = () => {
    setStep('distance');
    setSelectedDistance(5000);
    setCustomKm('');
    setIsCustom(false);
    setQuery('');
    setSearchResults([]);
    setSelectedAthletes([]);
    setValidationState('idle');
    setValidProfile(null);
    setValidationError('');
    setInviteUrl('');
    setCreatedChallengeId('');
    setCopied(false);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-end justify-center"
      onClick={(e) => e.target === e.currentTarget && resetAndClose()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={resetAndClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-white dark:bg-[#0f0f1a] text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-t-3xl shadow-2xl overflow-hidden animate-slide-up"
        style={{ maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-200/80 dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Trophy size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-slate-900 dark:text-white font-bold text-lg leading-tight">
                {step === 'share' ? 'Challenge Created!' : 'New Challenge'}
              </h2>
              <p className="text-slate-500 dark:text-white/40 text-xs">
                {step === 'distance' && 'Set your distance'}
                {step === 'invite' && 'Invite opponents (@username)'}
                {step === 'share' && 'Share the invite link'}
              </p>
            </div>
          </div>
          <button onClick={resetAndClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 dark:text-white/50 transition-colors cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* STEP 1: Distance */}
          {step === 'distance' && (
            <>
              <p className="text-slate-600 dark:text-white/60 text-sm font-medium">Choose the challenge distance</p>

              {/* Preset grid */}
              <div className="grid grid-cols-3 gap-3">
                {PRESET_DISTANCES_M.map((d, i) => (
                  <button
                    key={d}
                    onClick={() => { setSelectedDistance(d); setIsCustom(false); }}
                    className={`p-3 rounded-2xl border text-center transition-all duration-200 cursor-pointer ${!isCustom && selectedDistance === d
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-lg shadow-emerald-500/15'
                      : 'border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.04] text-slate-700 dark:text-white/60 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-100 dark:hover:bg-white/[0.08]'
                      }`}
                  >
                    <div className="text-lg font-bold">{PRESET_LABELS[i]}</div>
                    <div className="text-xs opacity-60">
                      {distanceUnit === 'mi' ? `${(d / 1609.34).toFixed(1)} mi` : `${(d / 1000).toFixed(1)} km`}
                    </div>
                  </button>
                ))}
              </div>

              {/* Custom distance */}
              <div>
                <button
                  onClick={() => setIsCustom(true)}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${isCustom ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.04] hover:border-slate-300 dark:hover:border-white/20'
                    }`}
                >
                  <span className="text-slate-600 dark:text-white/60 text-sm flex-1 text-left">Custom distance (km)</span>
                  {isCustom && (
                    <input
                      autoFocus
                      type="number"
                      min="0.1"
                      max="1000"
                      step="0.1"
                      value={customKm}
                      onChange={(e) => setCustomKm(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="e.g. 7.5"
                      className="bg-transparent text-emerald-600 dark:text-emerald-400 font-bold text-right w-24 outline-none placeholder:text-slate-400 dark:placeholder:text-white/30"
                    />
                  )}
                </button>
              </div>

              {/* Selected summary */}
              {effectiveDistance > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                  <Trophy size={16} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <span className="text-slate-800 dark:text-white/80 text-sm font-medium">
                    Target: <strong className="text-emerald-600 dark:text-emerald-400">{(effectiveDistance / 1000).toFixed(1)} KM</strong>
                    {distanceUnit === 'mi' && <span className="text-slate-400 dark:text-white/40 ml-1">({(effectiveDistance / 1609.34).toFixed(2)} mi)</span>}
                  </span>
                </div>
              )}

              {error && <p className="text-rose-500 dark:text-rose-400 text-sm">{error}</p>}

              <button
                onClick={() => { if (effectiveDistance >= 100) { setError(''); setStep('invite'); } else setError('Please select a distance.'); }}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-base shadow-lg shadow-emerald-500/30 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                Next: Invite Athletes <ChevronRight size={18} />
              </button>
            </>
          )}

          {/* STEP 2: Invite opponents */}
          {step === 'invite' && (
            <>
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                <Trophy size={15} className="text-emerald-500 dark:text-emerald-400" />
                <span className="text-slate-700 dark:text-white/70 text-sm font-medium">{(effectiveDistance / 1000).toFixed(1)} KM Race Challenge</span>
              </div>

              {/* Selected Athlete Chips */}
              {selectedAthletes.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-500 dark:text-white/50">Invited Athletes ({selectedAthletes.length}):</span>
                  <div className="flex flex-wrap gap-2">
                    {selectedAthletes.map((ath) => (
                      <div
                        key={ath.user_id}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold shadow-sm animate-scale-up"
                      >
                        {ath.avatar_url ? (
                          <img src={ath.avatar_url} alt={ath.name} className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <UserCircle size={18} className="text-emerald-400" />
                        )}
                        <span>@{ath.username || ath.name}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedAthletes((prev) => prev.filter((a) => a.user_id !== ath.user_id))}
                          className="p-0.5 rounded-full hover:bg-emerald-200 dark:hover:bg-emerald-400/20 text-emerald-500 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Real-time Username Input Box */}
              <div>
                <label className="block text-slate-700 dark:text-white/70 text-xs font-semibold mb-1.5">
                  Enter Athlete Username
                </label>
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && validProfile) {
                        e.preventDefault();
                        addAthlete(validProfile);
                      }
                    }}
                    placeholder="@john_runner"
                    className={`w-full pl-10 pr-10 py-3 bg-slate-50 dark:bg-white/[0.06] border rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/30 text-sm outline-none transition-colors ${
                      validationState === 'invalid'
                        ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-500/10 text-rose-900 dark:text-rose-100'
                        : validationState === 'valid'
                        ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/10'
                        : 'border-slate-200 dark:border-white/10 focus:border-emerald-500/50'
                    }`}
                  />

                  {/* Inline Icon Feedback */}
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center">
                    {validationState === 'checking' && (
                      <Loader2 size={16} className="text-slate-400 dark:text-white/40 animate-spin" />
                    )}
                    {validationState === 'valid' && (
                      <Check size={18} className="text-emerald-500 font-bold" />
                    )}
                    {validationState === 'invalid' && (
                      <X size={18} className="text-rose-500 font-bold" />
                    )}
                  </div>
                </div>

                {/* Real-time Status Badge / Error Text */}
                {validationState === 'invalid' && validationError && (
                  <p className="text-rose-500 dark:text-rose-400 text-xs font-semibold mt-1.5 flex items-center gap-1">
                    <span>✕ {validationError}</span>
                  </p>
                )}

                {validationState === 'valid' && validProfile && (
                  <div className="mt-2 flex items-center justify-between p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                    <div className="flex items-center gap-2">
                      {validProfile.avatar_url ? (
                        <img src={validProfile.avatar_url} alt={validProfile.name} className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <UserCircle size={24} className="text-emerald-500" />
                      )}
                      <div>
                        <div className="text-slate-900 dark:text-white text-xs font-bold">@{validProfile.username}</div>
                        <div className="text-emerald-600 dark:text-emerald-400 text-[10px] font-medium">{validProfile.name}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addAthlete(validProfile)}
                      className="px-3 py-1 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-colors shadow-sm cursor-pointer"
                    >
                      + Add Athlete
                    </button>
                  </div>
                )}
              </div>

              {/* Search Results Dropdown */}
              {searchResults.length > 0 && validationState !== 'valid' && (
                <div className="space-y-1 rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-lg max-h-48 overflow-y-auto">
                  {searchResults.map((user) => (
                    <button
                      key={user.user_id}
                      onClick={() => addAthlete(user)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors cursor-pointer text-left"
                    >
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <UserCircle size={28} className="text-slate-400 dark:text-white/30" />
                      )}
                      <div className="flex-1">
                        <div className="text-slate-900 dark:text-white text-xs font-semibold">{user.name}</div>
                        {user.username && <div className="text-slate-500 dark:text-white/40 text-[11px]">@{user.username}</div>}
                      </div>
                      <span className="text-emerald-500 text-xs font-bold">+ Add</span>
                    </button>
                  ))}
                </div>
              )}

              <p className="text-slate-400 dark:text-white/30 text-xs text-center">
                Or create a open challenge to get a shareable link for invited athletes
              </p>

              {error && <p className="text-rose-500 dark:text-rose-400 text-sm font-semibold">{error}</p>}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('distance')}
                  className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 text-sm hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors font-medium cursor-pointer"
                >
                  Back
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex-[2] py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-base shadow-lg shadow-emerald-500/30 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {creating ? <Loader2 size={18} className="animate-spin" /> : <Trophy size={18} />}
                  {creating ? 'Creating…' : selectedAthletes.length > 0 ? `Challenge ${selectedAthletes.length} Athletes` : 'Create & Get Link'}
                </button>
              </div>
            </>
          )}

          {/* STEP 3: Share */}
          {step === 'share' && (
            <div className="space-y-5">
              {/* Success icon */}
              <div className="flex flex-col items-center py-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-2xl shadow-emerald-500/40 mb-4">
                  <Trophy size={36} className="text-white" />
                </div>
                <h3 className="text-slate-900 dark:text-white font-bold text-xl">Challenge is live!</h3>
                <p className="text-slate-500 dark:text-white/50 text-sm text-center mt-1">
                  {selectedAthletes.length > 0
                    ? `Invitation sent to ${selectedAthletes.map((a) => a.name || `@${a.username}`).join(', ')}. `
                    : ''}
                  Share the link below so your opponents can join.
                </p>
              </div>

              {/* Link box */}
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10">
                <Share2 size={15} className="text-slate-400 dark:text-white/40 shrink-0" />
                <span className="text-slate-700 dark:text-white/60 text-xs flex-1 truncate font-mono">{inviteUrl}</span>
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${copied ? 'bg-emerald-500/15 text-emerald-600 dark:text-green-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25'
                    }`}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              {/* Share options */}
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  onClick={() => navigator.share({ title: 'Running Challenge!', text: 'Join my running challenge!', url: inviteUrl })}
                  className="w-full py-3 rounded-2xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/60 text-sm hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors flex items-center justify-center gap-2 font-medium cursor-pointer"
                >
                  <Share2 size={16} /> Share via...
                </button>
              )}

              <button
                onClick={resetAndClose}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-base shadow-lg shadow-emerald-500/30 hover:opacity-90 active:scale-98 transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

