import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, PasswordAccountState } from '../types';
import { authService } from '../services/authService';
import {
  Lock,
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface PasswordScreenProps {
  currentUser: any;
  profile: UserProfile | null;
  onProfileUpdated?: (updated: UserProfile) => void;
  onBack: () => void;
}

export const PasswordScreen: React.FC<PasswordScreenProps> = ({
  currentUser,
  profile,
  onProfileUpdated,
  onBack,
}) => {
  // Server-determined state from InsForge (Source of Truth)
  const [accountState, setAccountState] = useState<PasswordAccountState | null>(null);
  const [isCheckingState, setIsCheckingState] = useState(true);

  // Form Fields (temporary in-memory UI state only)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Independent field visibility toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Submission & Feedback UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const userId = currentUser?.id || profile?.user_id;

  /**
   * Fetch authoritative authentication state directly from InsForge Auth + DB
   * NEVER uses localStorage for security-sensitive account state
   */
  const loadAccountState = async () => {
    if (!userId) {
      setIsCheckingState(false);
      return;
    }
    if (!accountState) {
      setIsCheckingState(true);
    }
    try {
      const state = await authService.getAccountPasswordState(userId);
      setAccountState(state);
    } catch (err) {
      console.warn('[RunWar Password] Failed to fetch account state from InsForge:', err);
    } finally {
      setIsCheckingState(false);
    }
  };

  useEffect(() => {
    loadAccountState();
  }, [userId]);

  // Real-time password requirement evaluations
  const requirements = useMemo(() => {
    return {
      hasMinLength: newPassword.length >= 8,
      hasUpperCase: /[A-Z]/.test(newPassword),
      hasLowerCase: /[a-z]/.test(newPassword),
      hasNumber: /[0-9]/.test(newPassword),
    };
  }, [newPassword]);

  const isPasswordValid =
    requirements.hasMinLength &&
    requirements.hasUpperCase &&
    requirements.hasLowerCase &&
    requirements.hasNumber;

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  /**
   * Client-side validation prior to sending request to InsForge
   */
  const validateForm = (): boolean => {
    setInlineError(null);

    const hasExistingPassword = accountState?.hasPassword;

    // Validate current password for existing password accounts
    if (hasExistingPassword) {
      if (!currentPassword) {
        setInlineError('Please enter your current password.');
        return false;
      }
    }

    // Validate new password presence
    if (!newPassword) {
      setInlineError('Please enter a password.');
      return false;
    }

    // Validate length
    if (newPassword.length < 8) {
      setInlineError('Password must be at least 8 characters.');
      return false;
    }

    // Validate complexity
    if (!requirements.hasUpperCase || !requirements.hasLowerCase || !requirements.hasNumber) {
      setInlineError('Password must contain at least one uppercase letter, lowercase letter, and number.');
      return false;
    }

    // Validate confirmation match
    if (!confirmPassword) {
      setInlineError('Please confirm your password.');
      return false;
    }

    if (newPassword !== confirmPassword) {
      setInlineError('Passwords do not match.');
      return false;
    }

    // Validate difference from current password if updating
    if (hasExistingPassword && currentPassword && newPassword === currentPassword) {
      setInlineError('Your new password must be different from your current password.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setInlineError(null);

    const hasExistingPassword = accountState?.hasPassword;

    try {
      if (hasExistingPassword) {
        // Case 1: Update Existing Password
        await authService.updatePassword(currentPassword, newPassword);
        showToast('Password updated successfully', 'success');
      } else {
        // Case 2: Create Password for Google / Passwordless User
        await authService.createPassword(newPassword);
        showToast('Password created successfully', 'success');
      }

      // Clear sensitive form values from temporary React memory
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // CRITICAL: Refresh authoritative account state from InsForge server
      // Confirms password credential on backend and smoothly updates UI
      await loadAccountState();

      if (profile && onProfileUpdated) {
        onProfileUpdated({
          ...profile,
          password_configured: true,
        });
      }
    } catch (err: any) {
      console.error('[RunWar Password] Operation error:', err);
      const rawMsg = String(err?.message || '').toLowerCase();

      if (rawMsg.includes('current password') || rawMsg.includes('incorrect') || rawMsg.includes('invalid credentials')) {
        setInlineError('Current password is incorrect');
      } else if (rawMsg.includes('different from your current')) {
        setInlineError('Your new password must be different from your current password.');
      } else if (rawMsg.includes('match')) {
        setInlineError('Passwords do not match.');
      } else if (rawMsg.includes('at least 8')) {
        setInlineError('Password must be at least 8 characters.');
      } else if (rawMsg.includes('uppercase')) {
        setInlineError('Password must contain at least one uppercase letter.');
      } else if (rawMsg.includes('lowercase')) {
        setInlineError('Password must contain at least one lowercase letter.');
      } else if (rawMsg.includes('number')) {
        setInlineError('Password must contain at least one number.');
      } else if (rawMsg.includes('expired') || rawMsg.includes('session')) {
        setInlineError('Your session has expired. Please sign in again.');
      } else if (rawMsg.includes('connection') || rawMsg.includes('network') || rawMsg.includes('fetch')) {
        setInlineError("Couldn't update your password. Check your connection and try again.");
      } else if (err?.message && !err.message.includes('{') && !err.message.includes('PGRST')) {
        setInlineError(err.message);
      } else {
        setInlineError("Couldn't update your password. Please try again.");
      }
      showToast(err?.message && !err.message.includes('{') && !err.message.includes('PGRST') ? err.message : "Couldn't update your password. Please try again.", 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasPassword = accountState?.hasPassword ?? false;

  return (
    <div className="p-4 sm:p-5 max-w-xl md:max-w-2xl mx-auto space-y-6 select-none animate-fade-in pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-50 py-3 px-5 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold transition-all duration-300 animate-slide-down ${toastMessage.type === 'success'
            ? 'bg-emerald-500/90 text-white border-emerald-400 backdrop-blur-md'
            : 'bg-rose-500/90 text-white border-rose-400 backdrop-blur-md'
            }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 size={16} className="shrink-0 text-white" />
          ) : (
            <AlertCircle size={16} className="shrink-0 text-white" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Screen Header */}
      <div>
        <h2 className="font-display text-xl sm:text-2xl font-black text-slate-950 dark:text-white tracking-tight flex items-center gap-2">
          <span>{isCheckingState ? 'Password' : hasPassword ? 'Change Password' : 'Create Password'}</span>
          <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <Lock size={16} />
          </span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {isCheckingState
            ? 'Checking authentication state...'
            : hasPassword
              ? 'Update your password to keep your account secure.'
              : 'Add a password to your account so you can also sign in using your email and password.'}
        </p>
      </div>

      {/* Account Info Pill */}
      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <KeyRound size={16} />
          </div>
          <div>
            <div className="text-[11px] font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>{accountState?.email || currentUser?.email || 'Authenticated Runner'}</span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
              <span>Methods:</span>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {accountState?.providers && accountState.providers.length > 0
                  ? accountState.providers.map((p) => p.toUpperCase()).join(' + ')
                  : hasPassword
                    ? 'EMAIL + PASSWORD'
                    : 'GOOGLE OAUTH'}
              </span>
            </div>
          </div>
        </div>


      </div>

      {/* Loading state indicator during initial server verification */}
      {isCheckingState ? (
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
          <Loader2 size={24} className="animate-spin text-emerald-500" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Verifying account security credentials with InsForge...
          </p>
        </div>
      ) : (
        /* Password Form */
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Inline Error Alert */}
          {inlineError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2.5 animate-scale-in">
              <AlertCircle size={16} className="shrink-0" />
              <span className="font-semibold">{inlineError}</span>
            </div>
          )}

          {/* Case 1: Current Password (Only displayed if user already has a password) */}
          {hasPassword && (
            <div className="space-y-1.5">
              <label
                htmlFor="current-password"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
              >
                Current Password
              </label>
              <div className="relative">
                <input
                  id="current-password"
                  name="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    if (inlineError) setInlineError(null);
                  }}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 pr-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 dark:focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white text-xs outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 transition-colors cursor-pointer"
                >
                  {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {/* New Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="new-password"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              {hasPassword ? 'New Password' : 'Password'}
            </label>
            <div className="relative">
              <input
                id="new-password"
                name="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (inlineError) setInlineError(null);
                }}
                placeholder={hasPassword ? 'Enter new password' : 'Create a secure password'}
                autoComplete={hasPassword ? 'new-password' : 'new-password'}
                disabled={isSubmitting}
                className="w-full px-4 py-3 pr-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 dark:focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white text-xs outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowNewPassword(!showNewPassword)}
                aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 transition-colors cursor-pointer"
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="confirm-password"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              {hasPassword ? 'Confirm New Password' : 'Confirm Password'}
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (inlineError) setInlineError(null);
                }}
                placeholder={hasPassword ? 'Confirm new password' : 'Confirm your password'}
                autoComplete="new-password"
                disabled={isSubmitting}
                className="w-full px-4 py-3 pr-12 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-emerald-500 dark:focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-slate-900 dark:text-white text-xs outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 transition-colors cursor-pointer"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Live Password Requirements Checklist */}
          <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 space-y-2.5">
            <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Password requirements</span>

            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div
                className={`flex items-center gap-2 text-[11px] transition-colors ${requirements.hasMinLength
                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400'
                  }`}
              >
                <CheckCircle2
                  size={14}
                  className={
                    requirements.hasMinLength
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-300 dark:text-slate-700'
                  }
                />
                <span>At least 8 characters</span>
              </div>

              <div
                className={`flex items-center gap-2 text-[11px] transition-colors ${requirements.hasUpperCase
                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400'
                  }`}
              >
                <CheckCircle2
                  size={14}
                  className={
                    requirements.hasUpperCase
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-300 dark:text-slate-700'
                  }
                />
                <span>One uppercase letter</span>
              </div>

              <div
                className={`flex items-center gap-2 text-[11px] transition-colors ${requirements.hasLowerCase
                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400'
                  }`}
              >
                <CheckCircle2
                  size={14}
                  className={
                    requirements.hasLowerCase
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-300 dark:text-slate-700'
                  }
                />
                <span>One lowercase letter</span>
              </div>

              <div
                className={`flex items-center gap-2 text-[11px] transition-colors ${requirements.hasNumber
                  ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400'
                  }`}
              >
                <CheckCircle2
                  size={14}
                  className={
                    requirements.hasNumber
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-300 dark:text-slate-700'
                  }
                />
                <span>One number</span>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 active:scale-98 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin text-white" />
                <span>{hasPassword ? 'Updating password...' : 'Creating password...'}</span>
              </>
            ) : (
              <span>{hasPassword ? 'Update Password' : 'Create Password'}</span>
            )}
          </button>
        </form>
      )}

      {/* Security Note Card */}

    </div>
  );
};
