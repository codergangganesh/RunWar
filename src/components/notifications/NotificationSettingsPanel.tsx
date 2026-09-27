import React, { useState } from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  Smartphone,
  ShieldCheck,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  Sparkles,
  Clock,
  Target,
  Swords,
  Users,
  Trophy,
  Monitor,
  Trash2,
  Flame,
  ChevronDown,
  ChevronUp,
  Moon,
} from 'lucide-react';
import { UserSettings } from '../../types';
import { usePushSubscription } from '../../hooks/usePushSubscription';
import { notificationService } from '../../services/notificationService';
import { authService } from '../../services/authService';

interface NotificationSettingsPanelProps {
  userId: string;
  settings: UserSettings | null;
  onUpdateSettings?: (settings: UserSettings) => void;
}

const ToggleSwitch: React.FC<{
  checked: boolean;
  disabled?: boolean;
  isSaving?: boolean;
  onChange: () => void;
  id?: string;
}> = ({ checked, disabled, isSaving, onChange, id }) => (
  <button
    type="button"
    role="switch"
    id={id}
    aria-checked={checked}
    disabled={disabled || isSaving}
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden disabled:cursor-not-allowed ${disabled
      ? 'opacity-40 bg-slate-200 dark:bg-slate-800'
      : checked
        ? 'bg-emerald-500 shadow-xs shadow-emerald-500/30'
        : 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600'
      }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center ${checked ? 'translate-x-5' : 'translate-x-0'
        }`}
    >
      {isSaving && <Loader2 size={10} className="animate-spin text-emerald-600" />}
    </span>
  </button>
);

export const NotificationSettingsPanel: React.FC<NotificationSettingsPanelProps> = ({
  userId,
  settings,
  onUpdateSettings,
}) => {
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading: isSubLoading,
    subscriptionCount,
    subscriptions,
    currentEndpoint,
    isIOSDevice,
    needsIOSInstall,
    error: pushError,
    subscribe,
    unsubscribe,
    revokeDevice,
  } = usePushSubscription(userId);

  const [savingField, setSavingField] = useState<string | null>(null);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);
  const [showDevicesList, setShowDevicesList] = useState(false);
  const [isRevokingId, setIsRevokingId] = useState<string | null>(null);
  const [isTestingPush, setIsTestingPush] = useState(false);
  const [testPushStatus, setTestPushStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // Preference values from settings with safe defaults
  const masterEnabled = settings?.notifications_enabled ?? true;
  const runningReminders = settings?.notif_running_reminders ?? true;
  const goalNotifs = settings?.notif_goals ?? true;
  const challengeNotifs = settings?.notif_challenges ?? true;
  const socialNotifs = settings?.notif_social ?? true;
  const achievementNotifs = settings?.notif_achievements ?? true;
  const quietHoursEnabled = settings?.quiet_hours_enabled ?? false;
  const quietHoursStart = settings?.quiet_hours_start || '22:00';
  const quietHoursEnd = settings?.quiet_hours_end || '06:00';
  const quietHoursAllowAlarms = settings?.quiet_hours_allow_alarms ?? true;

  const handleTogglePreference = async (field: keyof UserSettings, currentValue: boolean) => {
    setSavingField(field as string);
    try {
      const updated = await authService.updateSettings(userId, {
        [field]: !currentValue,
      });
      onUpdateSettings?.(updated);
      setSaveSuccessNotice('Preferences updated');
      setTimeout(() => setSaveSuccessNotice(null), 2500);
    } catch (err: any) {
      console.error('[NotificationSettingsPanel] Error saving preference:', err);
    } finally {
      setSavingField(null);
    }
  };

  const handleUpdateQuietTime = async (field: 'quiet_hours_start' | 'quiet_hours_end', val: string) => {
    setSavingField(field);
    try {
      const updated = await authService.updateSettings(userId, {
        [field]: val,
      });
      onUpdateSettings?.(updated);
      setSaveSuccessNotice('Quiet hours updated');
      setTimeout(() => setSaveSuccessNotice(null), 2500);
    } catch (err: any) {
      console.error('[NotificationSettingsPanel] Error updating quiet hours time:', err);
    } finally {
      setSavingField(null);
    }
  };

  const handleTogglePush = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const handleRevokeDevice = async (subId: string) => {
    setIsRevokingId(subId);
    try {
      await revokeDevice(subId);
      setSaveSuccessNotice('Device removed');
      setTimeout(() => setSaveSuccessNotice(null), 2500);
    } finally {
      setIsRevokingId(null);
    }
  };

  const handleSendTestPush = async () => {
    setIsTestingPush(true);
    setTestPushStatus(null);
    try {
      await notificationService.sendTestNotification(userId);
      setTestPushStatus({ ok: true, msg: 'Test alert sent! Check your notification shade.' });
    } catch (err: any) {
      setTestPushStatus({ ok: false, msg: err?.message || 'Failed to send test push' });
    } finally {
      setIsTestingPush(false);
      setTimeout(() => setTestPushStatus(null), 5000);
    }
  };

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-slate-800 p-4 sm:p-5 space-y-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <BellRing size={18} />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
              PUSH & NOTIFICATIONS
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Alarms, run reminders, goals, and battle alerts
            </p>
          </div>
        </div>

        {/* Status Pill */}
        <span
          className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 ${isSubscribed
            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
            }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${isSubscribed ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}
          />
          {isSubscribed ? 'Active' : 'Disabled'}
        </span>
      </div>

      {/* iOS PWA Install Notice */}
      {needsIOSInstall && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <Info size={15} className="shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Enable Push</span>
          </div>
          <p className="text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-200/90">
            Apple requires RunWar to be installed on your Home Screen to deliver background notifications.
            Tap the <span className="font-bold">Share</span> button in Safari and select{' '}
            <span className="font-bold">"Add to Home Screen"</span>.
          </p>
        </div>
      )}

      {/* Push Support Error or Permission Banner */}
      {!isSupported && (
        <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="text-amber-500 shrink-0" />
          <span>Web Push is not supported in this browser version or mode.</span>
        </div>
      )}

      {pushError && (
        <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1">{pushError}</span>
        </div>
      )}

      {/* Main Push Toggle & Device Manager Card */}
      <div className="rounded-2xl bg-emerald-50/40 dark:bg-slate-950 border border-emerald-100 dark:border-slate-800 overflow-hidden">
        <div className="px-3.5 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Smartphone size={16} className="text-emerald-500" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                Device Push Notifications
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap flex items-center gap-1.5 mt-0.5">
                {isSubscribed ? (
                  <>
                    <span>Subscribed</span>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setShowDevicesList(!showDevicesList)}
                      className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline inline-flex items-center gap-0.5 cursor-pointer"
                      title="Manage linked devices"
                    >
                      <span>{subscriptionCount} device{subscriptionCount === 1 ? '' : 's'} linked</span>
                      {showDevicesList ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
                  </>
                ) : (
                  <span>Receive alarms and alerts when closed</span>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={handleTogglePush}
              disabled={!isSupported || isSubLoading}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0 flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap ${isSubscribed
                ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 hover:bg-rose-100'
                : 'bg-emerald-500 hover:bg-emerald-600 text-white dark:text-slate-950 shadow-xs shadow-emerald-500/20'
                }`}
            >
              {isSubLoading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : isSubscribed ? (
                <>
                  <BellOff size={13} />
                  <span>Disable</span>
                </>
              ) : (
                <>
                  <Bell size={13} />
                  <span>Enable</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Expandable Registered Devices List */}
        {isSubscribed && showDevicesList && (
          <div className="px-3.5 pb-3 pt-1 border-t border-emerald-100/80 dark:border-slate-800/80 space-y-2 bg-white/50 dark:bg-slate-900/50">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 pt-1 flex items-center justify-between">
              <span>Linked Devices</span>
              <button
                type="button"
                onClick={handleSendTestPush}
                disabled={isTestingPush}
                className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 flex items-center gap-1 disabled:opacity-50 cursor-pointer"
              >
                {isTestingPush ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                <span>Send Test Push</span>
              </button>
            </div>

            {testPushStatus && (
              <div
                className={`p-2 rounded-xl text-[11px] flex items-center gap-1.5 animate-fade-in ${testPushStatus.ok
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400'
                  }`}
              >
                {testPushStatus.ok ? (
                  <CheckCircle2 size={12} className="shrink-0 text-emerald-500" />
                ) : (
                  <AlertCircle size={12} className="shrink-0 text-rose-500" />
                )}
                <span>{testPushStatus.msg}</span>
              </div>
            )}

            <div className="space-y-1.5">
              {subscriptions.length === 0 ? (
                <div className="text-[11px] text-slate-400 py-1">No devices registered.</div>
              ) : (
                subscriptions.map((sub) => {
                  const isCurrent = currentEndpoint && sub.endpoint === currentEndpoint;
                  const isMobile =
                    sub.user_agent?.toLowerCase().includes('mobile') ||
                    sub.user_agent?.toLowerCase().includes('android') ||
                    sub.user_agent?.toLowerCase().includes('iphone');
                  const browser = sub.device_info?.browser || (isMobile ? 'Mobile Browser' : 'Web Browser');
                  const platform = sub.device_info?.platform || (isMobile ? 'Phone' : 'Computer');

                  return (
                    <div
                      key={sub.id}
                      className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                          {isMobile ? (
                            <Smartphone size={13} className="text-emerald-500" />
                          ) : (
                            <Monitor size={13} className="text-sky-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                            <span className="truncate">{browser} ({platform})</span>
                            {isCurrent && (
                              <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[9px] font-black shrink-0">
                                This Device
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            Registered {new Date(sub.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRevokeDevice(sub.id)}
                        disabled={isRevokingId === sub.id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all cursor-pointer shrink-0 disabled:opacity-50"
                        title="Remove this device"
                      >
                        {isRevokingId === sub.id ? (
                          <Loader2 size={13} className="animate-spin text-rose-500" />
                        ) : (
                          <Trash2 size={13} />
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Custom Haptics Note */}

          </div>
        )}
      </div>

      {/* Granular Preference Channels */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Notification Categories
          </div>
          {saveSuccessNotice && (
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 animate-fade-in">
              <CheckCircle2 size={11} />
              {saveSuccessNotice}
            </span>
          )}
        </div>

        {/* Master In-App Notifications */}
        <div className="p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <BellRing size={16} className="text-emerald-500" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Master Notifications</span>
                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                  Global
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Master switch for in-app & device alerts
              </div>
            </div>
          </div>
          <ToggleSwitch
            checked={masterEnabled}
            isSaving={savingField === 'notifications_enabled'}
            onChange={() => handleTogglePreference('notifications_enabled', masterEnabled)}
            id="pref-master-toggle"
          />
        </div>

        {!masterEnabled && (
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] flex items-center gap-1.5">
            <Info size={13} className="shrink-0" />
            <span>Master toggle is OFF. All category alerts and alarms are currently paused.</span>
          </div>
        )}

        <div className={`space-y-1 transition-opacity ${!masterEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
          {/* Running Alarms & Reminders */}
          <div className="flex items-center justify-between py-2 px-1 border-b border-slate-100 dark:border-slate-800/50">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <Clock size={14} className="text-emerald-500" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap">Running & Workout Alarms</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap truncate">Morning, evening, and stretch schedules</div>
              </div>
            </div>
            <ToggleSwitch
              checked={runningReminders}
              disabled={!masterEnabled}
              isSaving={savingField === 'notif_running_reminders'}
              onChange={() => handleTogglePreference('notif_running_reminders', runningReminders)}
              id="pref-alarms-toggle"
            />
          </div>

          {/* Fitness Goals */}
          <div className="flex items-center justify-between py-2 px-1 border-b border-slate-100 dark:border-slate-800/50">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <Target size={14} className="text-amber-500" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap">Fitness Goals & Milestones</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap truncate">Target reached and weekly progress alerts</div>
              </div>
            </div>
            <ToggleSwitch
              checked={goalNotifs}
              disabled={!masterEnabled}
              isSaving={savingField === 'notif_goals'}
              onChange={() => handleTogglePreference('notif_goals', goalNotifs)}
              id="pref-goals-toggle"
            />
          </div>

          {/* Challenges & Duels */}
          <div className="flex items-center justify-between py-2 px-1 border-b border-slate-100 dark:border-slate-800/50">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                <Swords size={14} className="text-indigo-500" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap">Challenges & Duels</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap truncate">Incoming match invites and battle outcomes</div>
              </div>
            </div>
            <ToggleSwitch
              checked={challengeNotifs}
              disabled={!masterEnabled}
              isSaving={savingField === 'notif_challenges'}
              onChange={() => handleTogglePreference('notif_challenges', challengeNotifs)}
              id="pref-challenges-toggle"
            />
          </div>

          {/* Social Feed */}
          <div className="flex items-center justify-between py-2 px-1 border-b border-slate-100 dark:border-slate-800/50">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <Users size={14} className="text-blue-500" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white whitespace-nowrap">Social & Kudos</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap truncate">Likes, cheers, comments, and followers</div>
              </div>
            </div>
            <ToggleSwitch
              checked={socialNotifs}
              disabled={!masterEnabled}
              isSaving={savingField === 'notif_social'}
              onChange={() => handleTogglePreference('notif_social', socialNotifs)}
              id="pref-social-toggle"
            />
          </div>

          {/* Achievements & Streak Protection */}
          <div className="flex items-center justify-between py-2 px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 relative">
                <Trophy size={14} className="text-amber-500" />
                <Flame size={9} className="text-rose-500 absolute -top-0.5 -right-0.5 fill-rose-500" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 whitespace-nowrap">
                  <span>Achievements & Streak Savers</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap truncate">
                  Badges, personal records, and 6:30 PM streak protection
                </div>
              </div>
            </div>
            <ToggleSwitch
              checked={achievementNotifs}
              disabled={!masterEnabled}
              isSaving={savingField === 'notif_achievements'}
              onChange={() => handleTogglePreference('notif_achievements', achievementNotifs)}
              id="pref-achievements-toggle"
            />
          </div>
        </div>
      </div>

      {/* Quiet Hours & Do-Not-Disturb Window */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">
            Quiet Hours &amp; Do-Not-Disturb
          </div>
          {quietHoursEnabled && (
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 whitespace-nowrap">
              Active {quietHoursStart} – {quietHoursEnd}
            </span>
          )}
        </div>

        {/* Master Quiet Hours Switch Card */}
        <div className="p-3 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
              <Moon size={16} className="text-indigo-500" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 whitespace-nowrap">
                <span>Sleep &amp; DND Window</span>
                {quietHoursEnabled && (
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap truncate">
                Silence social, duel, and challenge alerts during sleep
              </div>
            </div>
          </div>
          <ToggleSwitch
            checked={quietHoursEnabled}
            isSaving={savingField === 'quiet_hours_enabled'}
            onChange={() => handleTogglePreference('quiet_hours_enabled', quietHoursEnabled)}
            id="pref-quiet-hours-toggle"
          />
        </div>

        {/* Collapsible / expandable controls when enabled */}
        {quietHoursEnabled && (
          <div className="p-3 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 space-y-3 animate-fade-in">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1 whitespace-nowrap">
                  Quiet From (Bedtime)
                </label>
                <input
                  type="time"
                  value={quietHoursStart}
                  onChange={(e) => handleUpdateQuietTime('quiet_hours_start', e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1 whitespace-nowrap">
                  Quiet Until (Wake up)
                </label>
                <input
                  type="time"
                  value={quietHoursEnd}
                  onChange={(e) => handleUpdateQuietTime('quiet_hours_end', e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Morning Run Alarms Override Toggle */}
            <div className="pt-2 border-t border-indigo-100/80 dark:border-indigo-900/40 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 whitespace-nowrap">
                  <Clock size={13} className="text-emerald-500 shrink-0" />
                  <span>Allow Running Alarms to Override</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap truncate">
                  Morning run alarms still ring even inside quiet hours
                </div>
              </div>
              <ToggleSwitch
                checked={quietHoursAllowAlarms}
                isSaving={savingField === 'quiet_hours_allow_alarms'}
                onChange={() => handleTogglePreference('quiet_hours_allow_alarms', quietHoursAllowAlarms)}
                id="pref-quiet-allow-alarms-toggle"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

