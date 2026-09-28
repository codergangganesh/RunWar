import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../types';
import {
  BugCategory,
  BugSeverity,
  BugReport,
  ScreenshotAttachment,
} from '../types/bugReport';
import { bugReportService } from '../services/bugReportService';
import {
  Bug,
  UploadCloud,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Clock,
  Sparkles,
  Info,
  ChevronDown,
  ArrowLeft,
  FileImage,
  ShieldCheck,
  ListOrdered,
  HelpCircle,
  ChevronRight,
  Calendar,
  User,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

interface BugReportScreenProps {
  currentUser: any;
  profile: UserProfile | null;
  onBack: () => void;
  reportedFrom?: string;
}

const CATEGORIES: BugCategory[] = [
  'Authentication',
  'Profile',
  'Step Tracking',
  'Walking/Jogging',
  'Activity History',
  'Notifications',
  'Dashboard',
  'UI/Design',
  'Performance',
  'Data/Sync',
  'Settings',
  'Other',
];

const SEVERITY_LEVELS: Array<{
  value: BugSeverity;
  label: string;
  desc: string;
  badgeClass: string;
  borderClass: string;
}> = [
    {
      value: 'low',
      label: 'Low',
      desc: "Minor issue that doesn't prevent normal use.",
      badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      borderClass: 'border-emerald-500/40 hover:border-emerald-500',
    },
    {
      value: 'medium',
      label: 'Medium',
      desc: 'A feature is partially affected.',
      badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
      borderClass: 'border-amber-500/40 hover:border-amber-500',
    },
    {
      value: 'high',
      label: 'High',
      desc: 'A major feature is difficult or impossible to use.',
      badgeClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30',
      borderClass: 'border-orange-500/40 hover:border-orange-500',
    },
    {
      value: 'critical',
      label: 'Critical',
      desc: 'The application is seriously broken or unusable.',
      badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
      borderClass: 'border-rose-500/40 hover:border-rose-500',
    },
  ];

export const BugReportScreen: React.FC<BugReportScreenProps> = ({
  currentUser,
  profile,
  onBack,
  reportedFrom = 'Profile',
}) => {
  // Navigation Tabs: Submit Form | My History
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<BugCategory>('Step Tracking');
  const [severity, setSeverity] = useState<BugSeverity>('medium');
  const [stepsToReproduce, setStepsToReproduce] = useState('');
  const [expectedBehavior, setExpectedBehavior] = useState('');
  const [actualBehavior, setActualBehavior] = useState('');

  // Selected Screenshots (Temporary in-memory File objects)
  const [selectedImages, setSelectedImages] = useState<Array<{ file: File; previewUrl: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Submission & UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [submittedReport, setSubmittedReport] = useState<BugReport | null>(null);
  const [emailWarning, setEmailWarning] = useState(false);
  const [emailWarningReason, setEmailWarningReason] = useState<string | null>(null);
  const [isRetryingEmail, setIsRetryingEmail] = useState(false);

  // User History State
  const [userReports, setUserReports] = useState<BugReport[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedDetailReport, setSelectedDetailReport] = useState<BugReport | null>(null);

  const userId = currentUser?.id || profile?.user_id;
  const userEmail = currentUser?.email || profile?.email;

  // Cleanup object URLs on unmount or removal
  useEffect(() => {
    return () => {
      selectedImages.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
  }, [selectedImages]);

  // Load user bug history initially and when switching tabs
  useEffect(() => {
    if (userId) {
      loadUserHistory();
    }
  }, [userId, activeTab]);

  const loadUserHistory = async () => {
    if (!userId) return;
    setIsLoadingHistory(true);
    try {
      const reports = await bugReportService.getUserBugReports(userId);
      setUserReports(reports);
    } catch (err) {
      console.warn('[BugReportScreen] Error loading history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Image Selection Handler
  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInlineError(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (selectedImages.length + files.length > 3) {
      setInlineError('You can attach a maximum of 3 screenshots per report.');
      return;
    }

    const newItems: Array<{ file: File; previewUrl: string }> = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const validation = bugReportService.validateImageFile(file);
      if (!validation.valid) {
        setInlineError(validation.error || 'Invalid file format.');
        return;
      }
      newItems.push({
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }

    setSelectedImages((prev) => [...prev, ...newItems]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Image Remove Handler
  const handleRemoveImage = (index: number) => {
    setSelectedImages((prev) => {
      const target = prev[index];
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  // Form Validation
  const validateForm = (): boolean => {
    setInlineError(null);

    if (!userId || !userEmail) {
      setInlineError('Your session has expired. Please sign in again.');
      return false;
    }

    if (!title.trim()) {
      setInlineError('Please enter a bug title.');
      return false;
    }

    if (title.trim().length < 5) {
      setInlineError('Bug title should be at least 5 characters long.');
      return false;
    }

    if (!description.trim()) {
      setInlineError('Please describe the issue.');
      return false;
    }

    if (!category) {
      setInlineError('Please select a category.');
      return false;
    }

    if (!severity) {
      setInlineError('Please select a severity level.');
      return false;
    }

    return true;
  };

  // Submission Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validateForm()) return;

    setIsSubmitting(true);
    setInlineError(null);
    setEmailWarning(false);

    try {
      const filesToUpload = selectedImages.map((img) => img.file);

      const result = await bugReportService.submitBugReport(userId, userEmail, {
        title,
        description,
        category,
        severity,
        steps_to_reproduce: stepsToReproduce,
        expected_behavior: expectedBehavior,
        actual_behavior: actualBehavior,
        reported_from: reportedFrom,
        screenshotFiles: filesToUpload,
      });

      // Clear memory form values
      setTitle('');
      setDescription('');
      setStepsToReproduce('');
      setExpectedBehavior('');
      setActualBehavior('');
      setSelectedImages([]);

      // Transition to success state
      setSubmittedReport(result.report);
      if (!result.emailSent) {
        setEmailWarning(true);
        setEmailWarningReason(result.emailError || null);
      } else {
        setEmailWarning(false);
        setEmailWarningReason(null);
      }

      showToast('Bug report submitted successfully.', 'success');
    } catch (err: any) {
      console.error('[BugReportScreen] Submission error:', err);
      const msg =
        err?.message && !err.message.includes('{') && !err.message.includes('PGRST')
          ? err.message
          : 'Something went wrong while submitting your report. Please try again.';
      setInlineError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetryEmail = async () => {
    if (!submittedReport?.id || isRetryingEmail) return;
    setIsRetryingEmail(true);
    try {
      const res = await bugReportService.resendBugReportEmail(submittedReport.id);
      if (res.success) {
        setEmailWarning(false);
        setEmailWarningReason(null);
        showToast('Notification email sent successfully via SMTP!', 'success');
      } else {
        setEmailWarningReason(res.error || 'SMTP delivery still deferred.');
        showToast('SMTP retry failed. Check console for details.', 'error');
      }
    } catch (e: any) {
      showToast(e?.message || 'Failed to retry email.', 'error');
    } finally {
      setIsRetryingEmail(false);
    }
  };

  // DEDICATED USER BUG REPORT DETAIL SCREEN (No popup / modal)
  if (selectedDetailReport) {
    const severityBadge =
      selectedDetailReport.severity === 'critical'
        ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30'
        : selectedDetailReport.severity === 'high'
          ? 'text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/30'
          : selectedDetailReport.severity === 'medium'
            ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30'
            : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30';

    const statusBadge =
      selectedDetailReport.status === 'resolved'
        ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
        : selectedDetailReport.status === 'in_progress'
          ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30'
          : selectedDetailReport.status === 'closed'
            ? 'text-slate-500 bg-slate-500/10 border-slate-500/30'
            : 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/30';

    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6 select-none animate-fade-in pb-20">
        {/* Top Back Row */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedDetailReport(null)}
            className="inline-flex items-center gap-2 py-2 px-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 font-bold text-xs transition-all cursor-pointer shadow-xs active:scale-98"
          >
            <ArrowLeft size={16} />
            <span>Back to My Reports</span>
          </button>

          <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
            {selectedDetailReport.report_code || selectedDetailReport.id.substring(0, 8)}
          </span>
        </div>

        {/* Hero Card */}

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${statusBadge}`}>
            {selectedDetailReport.status.replace('_', ' ')}
          </span>
          <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${severityBadge}`}>
            {selectedDetailReport.severity} severity
          </span>
          <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {selectedDetailReport.category}
          </span>
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white leading-tight">
          {selectedDetailReport.title}
        </h2>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <Calendar size={13} className="text-slate-400" />
          <span>Submitted on {new Date(selectedDetailReport.created_at).toLocaleString()}</span>
        </div>


        {/* Status Explanation Card */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
            <Info size={16} />
          </div>
          <div className="space-y-0.5 text-xs">
            <span className="font-bold text-slate-900 dark:text-white block">
              {selectedDetailReport.status === 'resolved'
                ? 'Issue Resolved'
                : selectedDetailReport.status === 'in_progress'
                  ? 'Fix In Progress'
                  : selectedDetailReport.status === 'closed'
                    ? 'Report Closed'
                    : 'Report Received & Under Review'}
            </span>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              {selectedDetailReport.status === 'resolved'
                ? 'Our development team has deployed a fix for this bug. Thank you for reporting it!'
                : selectedDetailReport.status === 'in_progress'
                  ? 'An engineer is actively investigating reproduction logs and preparing a patch.'
                  : selectedDetailReport.status === 'closed'
                    ? 'This report is completed and archived.'
                    : 'We have received your report and diagnostic data. It will be prioritized according to severity.'}
            </p>
          </div>
        </div>

        {/* Description & Reproduction Card */}

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
            Description
          </label>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
            {selectedDetailReport.description}
          </div>
        </div>

        {selectedDetailReport.steps_to_reproduce && (
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Steps to Reproduce
            </label>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
              {selectedDetailReport.steps_to_reproduce}
            </div>
          </div>
        )}

        {(selectedDetailReport.expected_behavior || selectedDetailReport.actual_behavior) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
            {selectedDetailReport.expected_behavior && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block">
                  Expected
                </span>
                <p className="text-slate-700 dark:text-slate-300 break-words leading-relaxed">{selectedDetailReport.expected_behavior}</p>
              </div>
            )}
            {selectedDetailReport.actual_behavior && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold uppercase text-rose-500 dark:text-rose-400 block">
                  Actual
                </span>
                <p className="text-slate-700 dark:text-slate-300 break-words leading-relaxed">{selectedDetailReport.actual_behavior}</p>
              </div>
            )}
          </div>
        )}


        {/* Screenshots */}
        {Array.isArray(selectedDetailReport.screenshot_urls) && selectedDetailReport.screenshot_urls.length > 0 && (
          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Uploaded Screenshots ({selectedDetailReport.screenshot_urls.length})
              </label>
              <span className="text-[11px] text-slate-400">Click to view full image</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedDetailReport.screenshot_urls.map((s, idx) => (
                <a
                  key={idx}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 block hover:border-emerald-500 transition-all shadow-sm"
                  title="Click to view full size"
                >
                  <img
                    src={s.url}
                    alt={s.name}
                    className="w-full max-h-60 object-contain bg-slate-900/60 p-2 group-hover:scale-[1.02] transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white font-bold text-xs backdrop-blur-xs">
                    <ExternalLink size={16} />
                    <span>View Image</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}



      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6 select-none animate-fade-in pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-16 sm:top-20 left-1/2 -translate-x-1/2 z-50 py-3 px-5 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold transition-all duration-300 animate-slide-down ${toastMessage.type === 'success'
            ? 'bg-emerald-500/95 text-white border-emerald-400 backdrop-blur-md'
            : 'bg-rose-500/95 text-white border-rose-400 backdrop-blur-md'
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
      <div className="flex items-center gap-3">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-black text-slate-950 dark:text-white tracking-tight flex items-center gap-2">
            <span>Report a Bug</span>
            <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Bug size={18} />
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Help us improve the app by telling us what went wrong.
          </p>
        </div>
        <div className="flex justify-end mb-4">
          <div className="flex justify-end mb-3">
            <div className="relative inline-flex items-center p-0.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">

              {/* Sliding active background */}
              <div
                className={`absolute top-0.5 bottom-0.5 rounded-full
        bg-white dark:bg-slate-800 shadow-sm
        transition-all duration-300 ease-out
        ${activeTab === 'form'
                    ? 'left-0.5 right-[50%]'
                    : 'left-[50%] right-0.5'
                  }`}
              />

              {/* New Report */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('form');
                  setSubmittedReport(null);
                }}
                className={`relative z-10 px-3 py-1.5 rounded-full
        text-[10px] font-semibold whitespace-nowrap
        transition-colors duration-300 cursor-pointer
        ${activeTab === 'form'
                    ? 'text-slate-900 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400'
                  }`}
              >
                New Report
              </button>

              {/* My Reports */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('history');
                  loadUserHistory();
                }}
                className={`relative z-10 px-3 py-1.5 rounded-full
        text-[10px] font-semibold whitespace-nowrap
        transition-colors duration-300 cursor-pointer
        ${activeTab === 'history'
                    ? 'text-slate-900 dark:text-white'
                    : 'text-slate-500 dark:text-slate-400'
                  }`}
              >
                My Reports
                {userReports.length > 0 && (
                  <span className="ml-1 text-[8px] opacity-60">
                    ({userReports.length})
                  </span>
                )}
              </button>

            </div>
          </div>
        </div>
      </div>

      {/* View Switcher Tabs: New Report | My Reports */}


      {activeTab === 'history' ? (
        /* USER BUG REPORTS LIST VIEW */
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Submitted Reports ({userReports.length})
            </span>
            <button
              type="button"
              onClick={loadUserHistory}
              disabled={isLoadingHistory}
              className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 text-slate-600 dark:text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer shrink-0"
              title="Refresh reports"
            >
              <RefreshCw size={14} className={isLoadingHistory ? 'animate-spin text-emerald-500' : ''} />
            </button>
          </div>

          {isLoadingHistory ? (
            <div className="p-14 text-center space-y-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              <Loader2 size={24} className="animate-spin text-emerald-500 mx-auto" />
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Loading your reports...
              </p>
            </div>
          ) : userReports.length === 0 ? (
            <div className="p-12 text-center space-y-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                No Reports Submitted
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                You haven't reported any bugs yet. If you encounter any problem, let us know!
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className="mt-2 py-2.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-98 transition-all cursor-pointer"
              >
                Report a Bug Now
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {userReports.map((r) => {
                const statusColor =
                  r.status === 'resolved'
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : r.status === 'in_progress'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      : r.status === 'closed'
                        ? 'bg-slate-500/10 text-slate-500 border-slate-500/30'
                        : 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30';

                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedDetailReport(r)}
                    className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 transition-all cursor-pointer shadow-xs space-y-2.5 active:scale-99"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-black text-slate-900 dark:text-white">
                          {r.report_code || r.id.substring(0, 8)}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                          {r.category}
                        </span>
                      </div>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${statusColor}`}>
                        {r.status.replace('_', ' ')}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                      {r.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                      {r.description}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                      <span>{new Date(r.created_at).toLocaleDateString()}</span>
                      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                        <span>View Details</span>
                        <ChevronRight size={13} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : submittedReport ? (
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-500/30 text-center space-y-5 shadow-lg shadow-emerald-500/5 animate-scale-in">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 size={36} />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-black text-slate-950 dark:text-white">
              ✓ Bug Report Submitted
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Thank you for helping us improve the application. Your report has been stored securely in InsForge and sent to our team.
            </p>
          </div>

          {/* Official Server Generated Report ID */}
          <div className="inline-flex flex-col items-center py-2.5 px-6 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
              Report ID
            </span>
            <span className="font-mono text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-wide">
              {submittedReport.report_code || submittedReport.id}
            </span>
          </div>

          {emailWarning && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-300 font-medium space-y-2 text-left sm:text-center">
              <div className="flex items-center justify-between gap-2">
                <span>We saved your report, but SMTP notification delivery is deferred.</span>
                <button
                  type="button"
                  disabled={isRetryingEmail}
                  onClick={handleRetryEmail}
                  className="px-2.5 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] shrink-0 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1"
                >
                  {isRetryingEmail ? <Loader2 size={12} className="animate-spin" /> : null}
                  {isRetryingEmail ? 'Retrying...' : 'Retry Email'}
                </button>
              </div>
              {emailWarningReason && (
                <div className="text-[10px] font-mono text-amber-800/80 dark:text-amber-400/80 truncate">
                  Details: {emailWarningReason}
                </div>
              )}
            </div>
          )}

          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={onBack}
              className="py-3 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-98 transition-all cursor-pointer"
            >
              Back to Profile
            </button>
            <button
              type="button"
              onClick={() => {
                setSubmittedReport(null);
                setActiveTab('history');
                loadUserHistory();
              }}
              className="py-3 px-6 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 font-bold text-xs active:scale-98 transition-all cursor-pointer"
            >
              View in My Reports
            </button>
            <button
              type="button"
              onClick={() => {
                setSubmittedReport(null);
                setActiveTab('form');
              }}
              className="py-3 px-6 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs active:scale-98 transition-all cursor-pointer"
            >
              Submit Another Bug
            </button>
          </div>
        </div>
      ) : (
        /* BUG REPORT FORM */
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Inline Error Banner */}
          {inlineError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2.5 animate-scale-in">
              <AlertCircle size={16} className="shrink-0" />
              <span className="font-semibold">{inlineError}</span>
            </div>
          )}

          {/* Authenticated Reporter Pill */}
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Reporting As Authenticated User
                </span>
                <span className="font-semibold text-slate-900 dark:text-white truncate block">
                  {userEmail}
                </span>
              </div>
            </div>
          </div>

          {/* Bug Title */}
          <div className="space-y-1.5">
            <label
              htmlFor="bug-title"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              Bug Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="bug-title"
              type="text"
              required
              placeholder="Briefly describe the problem (e.g. Steps are not updating correctly)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-medium placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Category & Severity Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category Dropdown */}
            <div className="space-y-1.5">
              <label
                htmlFor="bug-category"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
              >
                Bug Category <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  id="bug-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as BugCategory)}
                  className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-emerald-500 appearance-none cursor-pointer pr-10"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
              </div>
            </div>

            {/* Severity Radio Cards */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Severity <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SEVERITY_LEVELS.map((level) => {
                  const isSelected = severity === level.value;
                  return (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => setSeverity(level.value)}
                      className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${isSelected
                        ? `bg-white dark:bg-slate-900 border-2 ${level.borderClass} shadow-xs`
                        : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${level.badgeClass}`}>
                          {level.label}
                        </span>
                        {isSelected && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                        {level.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bug Description */}
          <div className="space-y-1.5">
            <label
              htmlFor="bug-description"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
            >
              Bug Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="bug-description"
              rows={4}
              required
              placeholder="Describe what happened, what you expected to happen, and what actually happened..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-medium placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-colors resize-y"
            />
          </div>

          {/* Steps to Reproduce */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="steps-to-reproduce"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
              >
                Steps to Reproduce
              </label>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                Highly Recommended
              </span>
            </div>
            <textarea
              id="steps-to-reproduce"
              rows={3}
              placeholder={`1. Open Activity\n2. Start a jogging session\n3. Stop the session\n4. Open History\n5. The session is missing`}
              value={stepsToReproduce}
              onChange={(e) => setStepsToReproduce(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-medium placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-colors font-mono resize-y"
            />
          </div>

          {/* Expected vs Actual Behavior */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="expected-behavior"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
              >
                Expected Behavior
              </label>
              <input
                id="expected-behavior"
                type="text"
                placeholder="What did you expect to happen?"
                value={expectedBehavior}
                onChange={(e) => setExpectedBehavior(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-medium placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="actual-behavior"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300"
              >
                Actual Behavior
              </label>
              <input
                id="actual-behavior"
                type="text"
                placeholder="What actually happened?"
                value={actualBehavior}
                onChange={(e) => setActualBehavior(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs font-medium placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Screenshot Upload Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Screenshots ({selectedImages.length}/3)
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Add a screenshot showing the problem. This can help us understand the issue faster.
                </p>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold shrink-0">
                Max 5 MB • PNG, JPG, WebP
              </span>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={handleSelectFiles}
            />

            {/* Image Previews */}
            {selectedImages.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-2">
                {selectedImages.map((item, idx) => (
                  <div
                    key={idx}
                    className="relative group rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 aspect-video flex items-center justify-center shadow-xs"
                  >
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-md cursor-pointer"
                      title="Remove image"
                    >
                      <X size={12} />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                      <p className="text-[9px] text-white font-mono truncate">
                        {item.file.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Button */}
            {selectedImages.length < 3 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 px-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 dark:hover:border-emerald-500/60 bg-slate-50/50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <UploadCloud size={18} />
                </div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  + Add Screenshot
                </span>
                <span className="text-[10px] text-slate-400">
                  Click to browse from your device
                </span>
              </button>
            )}
          </div>



          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 active:scale-98 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-3"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin text-white" />
                <span>Submitting Report...</span>
              </>
            ) : (
              <>
                <Bug size={16} />
                <span>Submit Bug Report</span>
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
};
