import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import {
  BugReport,
  BugStatus,
  BugSeverity,
  BugCategory,
} from '../types/bugReport';
import { bugReportService } from '../services/bugReportService';
import {
  Bug,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  ChevronRight,
  X,
  ExternalLink,
  Save,
  Loader2,
  RefreshCw,
  Layers,
  Monitor,
  Smartphone,
  Calendar,
  User,
  Shield,
  MessageSquare,
  ArrowLeft,
} from 'lucide-react';

interface AdminBugReportsScreenProps {
  currentUser: any;
  profile: UserProfile | null;
  onBack: () => void;
}

export const AdminBugReportsScreen: React.FC<AdminBugReportsScreenProps> = ({
  currentUser,
  profile,
  onBack,
}) => {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | BugStatus>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | BugSeverity>('all');

  // Admin note and status update state
  const [editStatus, setEditStatus] = useState<BugStatus>('open');
  const [editAdminNotes, setEditAdminNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const userEmail = currentUser?.email || profile?.email;
  const isAdmin = bugReportService.isAdminUser(userEmail);

  const loadReports = async () => {
    setIsLoading(true);
    try {
      const data = await bugReportService.getAdminBugReports({
        status: statusFilter,
        severity: severityFilter,
        search: searchTerm,
      });
      setReports(data);
    } catch (err) {
      console.error('[AdminBugReports] Fetch error:', err);
      showToast('Failed to load bug reports from InsForge.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [statusFilter, severityFilter]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Open detail modal
  const handleOpenDetail = (report: BugReport) => {
    setSelectedReport(report);
    setEditStatus(report.status);
    setEditAdminNotes(report.admin_notes || '');
  };

  // Save admin updates
  const handleSaveAdminUpdate = async () => {
    if (!selectedReport) return;
    setIsUpdating(true);
    try {
      await bugReportService.updateReportStatus(
        selectedReport.id,
        editStatus,
        editAdminNotes
      );
      showToast('Report updated successfully.', 'success');

      // Update local state
      const updatedList = reports.map((r) =>
        r.id === selectedReport.id
          ? { ...r, status: editStatus, admin_notes: editAdminNotes }
          : r
      );
      setReports(updatedList);
      setSelectedReport((prev) =>
        prev ? { ...prev, status: editStatus, admin_notes: editAdminNotes } : null
      );
    } catch (err) {
      console.error('[AdminBugReports] Update error:', err);
      showToast('Failed to update report. Check connection.', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const [isResendingEmail, setIsResendingEmail] = useState(false);

  const handleResendEmail = async (reportId: string) => {
    if (isResendingEmail) return;
    setIsResendingEmail(true);
    try {
      const res = await bugReportService.resendBugReportEmail(reportId);
      if (res.success) {
        showToast('Notification email dispatched via SMTP to mannamganeshbabu8@gmail.com!', 'success');
        setSelectedReport((prev) => (prev ? { ...prev, email_status: 'sent' } : null));
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, email_status: 'sent' } : r))
        );
      } else {
        showToast(
          `SMTP dispatch deferred: ${res.error || 'Check SMTP configuration'}`,
          'error'
        );
      }
    } catch (e: any) {
      showToast(e?.message || 'Failed to dispatch email.', 'error');
    } finally {
      setIsResendingEmail(false);
    }
  };

  // Summary counts
  const countOpen = reports.filter((r) => r.status === 'open').length;
  const countInProgress = reports.filter((r) => r.status === 'in_progress').length;
  const countResolved = reports.filter((r) => r.status === 'resolved').length;
  const countClosed = reports.filter((r) => r.status === 'closed').length;

  // Filtered reports for search term
  const displayedReports = reports.filter((r) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      r.title?.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.report_code?.toLowerCase().includes(q) ||
      r.user_email?.toLowerCase().includes(q) ||
      r.category?.toLowerCase().includes(q)
    );
  });

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4">
        <div className="w-14 h-14 rounded-3xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
          <Shield size={28} />
        </div>
        <h3 className="text-base font-black text-slate-900 dark:text-white">
          Access Restricted
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Only authenticated administrators can view and manage internal bug reports.
        </p>
        <button
          onClick={onBack}
          className="py-2.5 px-5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
        >
          Back to Profile
        </button>
      </div>
    );
  }

  // DEDICATED BUG REPORT DETAIL SCREEN (No popup / modal)
  if (selectedReport) {
    const severityBadge =
      selectedReport.severity === 'critical'
        ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/30'
        : selectedReport.severity === 'high'
          ? 'text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/30'
          : selectedReport.severity === 'medium'
            ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30'
            : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30';

    const statusBadge =
      selectedReport.status === 'resolved'
        ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
        : selectedReport.status === 'in_progress'
          ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30'
          : selectedReport.status === 'closed'
            ? 'text-slate-500 bg-slate-500/10 border-slate-500/30'
            : 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/30';

    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 select-none animate-fade-in pb-24">
        {/* Toast Notification */}
        {toastMessage && (
          <div
            className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999]
    px-4 py-2 rounded-lg shadow-md
    flex items-center gap-2 text-xs font-medium
    transition-all duration-300 animate-slide-down
    ${toastMessage.type === 'success'
                ? 'bg-emerald-500 text-white'
                : 'bg-rose-500 text-white'
              }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 size={15} />
            ) : (
              <AlertCircle size={15} />
            )}

            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Top Back Navigation Bar */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedReport(null)}
            className="inline-flex items-center gap-2 py-2 px-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 font-bold text-xs transition-all cursor-pointer shadow-xs active:scale-98"
          >
            <ArrowLeft size={16} />
            <span>Back to Bug List</span>
          </button>

          <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
            {selectedReport.report_code || selectedReport.id.substring(0, 8)}
          </span>
        </div>

        {/* Hero Card: Title & Badges */}

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${statusBadge}`}>
            {selectedReport.status.replace('_', ' ')}
          </span>
          <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${severityBadge}`}>
            {selectedReport.severity} severity
          </span>
          <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {selectedReport.category}
          </span>
        </div>

        <h1 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white leading-tight">
          {selectedReport.title}
        </h1>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex-wrap">
          <div className="flex items-center gap-1.5">
            <User size={13} className="text-slate-400" />
            <span>Reported by <strong className="text-slate-800 dark:text-slate-200">{selectedReport.user_email}</strong></span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <Calendar size={13} className="text-slate-400" />
            <span>{new Date(selectedReport.created_at).toLocaleString()}</span>
          </div>
        </div>


        {/* Status & Resolution Control Bar */}

        <div className="flex items-center gap-2">
          {/* Status */}
          <select
            value={editStatus}
            onChange={(e) => setEditStatus(e.target.value as BugStatus)}
            className="h-8 px-2.5 pr-7 rounded-lg
      bg-slate-50 dark:bg-slate-900
      border border-slate-200 dark:border-slate-800
      text-[11px] font-semibold
      text-slate-700 dark:text-slate-200
      focus:outline-none focus:border-emerald-500
      cursor-pointer"
          >
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>

          {/* Save */}
          <button
            type="button"
            onClick={handleSaveAdminUpdate}
            disabled={isUpdating}
            className="h-8 px-3 rounded-lg
      bg-emerald-500 hover:bg-emerald-600
      text-white text-[11px] font-semibold
      flex items-center justify-center gap-1.5
      transition-all cursor-pointer
      disabled:opacity-50
      active:scale-95"
          >
            {isUpdating ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Save size={13} />
            )}
            <span>Save</span>
          </button>
        </div>




        {/* Issue Description Card */}

        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
            Description
          </label>
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
            {selectedReport.description}
          </div>
        </div>

        {selectedReport.steps_to_reproduce && (
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Steps to Reproduce
            </label>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
              {selectedReport.steps_to_reproduce}
            </div>
          </div>
        )}

        {(selectedReport.expected_behavior || selectedReport.actual_behavior) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
            {selectedReport.expected_behavior && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block">
                  Expected Behavior
                </span>
                <p className="text-slate-700 dark:text-slate-300 break-words leading-relaxed">{selectedReport.expected_behavior}</p>
              </div>
            )}
            {selectedReport.actual_behavior && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold uppercase text-rose-500 dark:text-rose-400 block">
                  Actual Behavior
                </span>
                <p className="text-slate-700 dark:text-slate-300 break-words leading-relaxed">{selectedReport.actual_behavior}</p>
              </div>
            )}
          </div>
        )}


        {/* Screenshots Gallery Card */}
        {Array.isArray(selectedReport.screenshot_urls) && selectedReport.screenshot_urls.length > 0 && (
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Uploaded Screenshots ({selectedReport.screenshot_urls.length})
              </label>
              <span className="text-[11px] text-slate-400">Click to view in full resolution</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {selectedReport.screenshot_urls.map((s, idx) => (
                <a
                  key={idx}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-950 block hover:border-emerald-500 transition-all shadow-sm"
                  title="Click to open image in full resolution"
                >
                  <img
                    src={s.url}
                    alt={s.name}
                    className="w-full max-h-72 object-contain bg-slate-900/60 p-2 group-hover:scale-[1.02] transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-bold text-xs backdrop-blur-xs">
                    <ExternalLink size={16} />
                    <span>View Full Size Image</span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Technical Diagnostics Card */}

        <div className="flex items-center gap-2">
          <Monitor size={16} className="text-emerald-500 shrink-0" />
          <h3 className="font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 text-xs">
            Technical Diagnostics
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 space-y-0.5">
            <span className="text-[10px] font-medium text-slate-400 block">Reporter Email</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100 break-all block">
              {selectedReport.user_email}
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 space-y-0.5">
            <span className="text-[10px] font-medium text-slate-400 block">Reported From</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100 block">
              {selectedReport.reported_from || 'Direct Screen'}
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 space-y-0.5">
            <span className="text-[10px] font-medium text-slate-400 block">App Version</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100 block">
              v{selectedReport.app_version}
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 space-y-0.5">
            <span className="text-[10px] font-medium text-slate-400 block">Operating System / Platform</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100 block">
              {selectedReport.os_version} ({selectedReport.platform})
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 space-y-0.5">
            <span className="text-[10px] font-medium text-slate-400 block">Screen Dimensions</span>
            <span className="font-mono text-slate-900 dark:text-slate-100 block">
              {selectedReport.screen_size}
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800/80 space-y-0.5">
            <span className="text-[10px] font-medium text-slate-400 block">Submitted Timestamp</span>
            <span className="text-slate-700 dark:text-slate-300 block">
              {new Date(selectedReport.created_at).toLocaleString()}
            </span>
          </div>
        </div>


        {/* SMTP Email Notification Card */}

        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
            SMTP Email Notification
          </span>
          <span
            className={`text-xs font-bold uppercase ${selectedReport.email_status === 'sent'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-amber-600 dark:text-amber-400'
              }`}
          >
            {selectedReport.email_status === 'sent'
              ? '✓ Delivered to mannamganeshbabu8@gmail.com'
              : '⚠ Delivery Failed / Deferred'}
          </span>
        </div>
        <button
          type="button"
          disabled={isResendingEmail}
          onClick={() => handleResendEmail(selectedReport.id)}
          className="py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs shadow-sm disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
        >
          {isResendingEmail ? <Loader2 size={14} className="animate-spin" /> : null}
          <span>Resend SMTP Email</span>
        </button>


        {/* Internal Admin Notes Card */}

        <div className="flex items-center justify-between">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
            Internal Admin Notes (Private)
          </label>
          <span className="text-[10px] text-slate-400">Only visible to administrators</span>
        </div>
        <textarea
          rows={4}
          placeholder="Add private technical notes, root causes, or patch references..."
          value={editAdminNotes}
          onChange={(e) => setEditAdminNotes(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 leading-relaxed"
        />


        {/* Bottom Back Button */}
        <div className="pt-2 flex justify-center">

        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 select-none animate-fade-in pb-16">
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

      {/* Screen Sub-Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <Bug size={14} />
            <span>Developer Bug Center</span>
          </span>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Review user-submitted problems, inspect diagnostics, and track resolution.
          </p>
        </div>

        <button
          type="button"
          onClick={loadReports}
          disabled={isLoading}
          className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 text-slate-600 dark:text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer shrink-0"
          title="Refresh reports"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin text-emerald-500' : ''} />
        </button>
      </div>

      {/* Metric Counters Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setStatusFilter('open')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${statusFilter === 'open'
            ? 'bg-sky-500/10 border-sky-500/40 text-sky-600 dark:text-sky-400 shadow-xs'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
            }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block">Open</span>
          <span className="text-xl font-black font-mono">{countOpen}</span>
        </div>

        <div
          onClick={() => setStatusFilter('in_progress')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${statusFilter === 'in_progress'
            ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400 shadow-xs'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
            }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block">In Progress</span>
          <span className="text-xl font-black font-mono">{countInProgress}</span>
        </div>

        <div
          onClick={() => setStatusFilter('resolved')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${statusFilter === 'resolved'
            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-xs'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
            }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block">Resolved</span>
          <span className="text-xl font-black font-mono">{countResolved}</span>
        </div>

        <div
          onClick={() => setStatusFilter('all')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${statusFilter === 'all'
            ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white shadow-xs'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
            }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block">All Reports</span>
          <span className="text-xl font-black font-mono">{reports.length}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center gap-2 w-full">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="text"
            placeholder="Search by code, title, email, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl
        bg-white dark:bg-slate-900
        border border-slate-200 dark:border-slate-800
        text-slate-900 dark:text-white text-xs
        placeholder:text-slate-400
        focus:outline-none focus:border-emerald-500
        transition-colors"
          />
        </div>

        {/* Severity Filter */}
        <div className="relative shrink-0">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as any)}
            aria-label="Filter by severity"
            className="appearance-none
        min-w-[120px]
        h-9
        pl-3 pr-8
        rounded-xl
        bg-white dark:bg-slate-900
        border border-slate-200 dark:border-slate-800
        text-slate-600 dark:text-slate-300
        text-xs font-medium
        cursor-pointer
        focus:outline-none
        focus:border-emerald-500
        transition-colors"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {/* Filter icon */}
          <Filter
            size={14}
            className="absolute right-2.5 top-1/2 -translate-y-1/2
        pointer-events-none
        text-slate-500 dark:text-slate-400"
          />
        </div>
      </div>

      {/* Reports List */}
      {isLoading ? (
        <div className="p-16 text-center space-y-3 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <Loader2 size={24} className="animate-spin text-emerald-500 mx-auto" />
          <p className="text-xs text-slate-500 dark:text-slate-400">Loading reports from InsForge...</p>
        </div>
      ) : displayedReports.length === 0 ? (
        <div className="p-12 text-center space-y-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <CheckCircle2 size={28} className="text-emerald-500 mx-auto" />
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
            No Reports Found
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No bug reports match the selected filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedReports.map((report) => {
            const severityColor =
              report.severity === 'critical'
                ? 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20'
                : report.severity === 'high'
                  ? 'text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/20'
                  : report.severity === 'medium'
                    ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20'
                    : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20';

            const statusColor =
              report.status === 'resolved'
                ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                : report.status === 'in_progress'
                  ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20'
                  : report.status === 'closed'
                    ? 'text-slate-500 bg-slate-500/10 border-slate-500/20'
                    : 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20';

            return (
              <div
                key={report.id}
                onClick={() => handleOpenDetail(report)}
                className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 dark:hover:border-emerald-500/60 transition-all cursor-pointer shadow-xs space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-black text-slate-900 dark:text-white">
                      {report.report_code || report.id.substring(0, 8)}
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${severityColor}`}>
                      {report.severity}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {report.category}
                    </span>
                  </div>

                  <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${statusColor}`}>
                    {report.status.replace('_', ' ')}
                  </span>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                    {report.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                    {report.description}
                  </p>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="truncate max-w-[200px]">By: {report.user_email}</span>
                  <div className="flex items-center gap-2">
                    {Array.isArray(report.screenshot_urls) && report.screenshot_urls.length > 0 && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                        📸 {report.screenshot_urls.length} images
                      </span>
                    )}
                    <span>{new Date(report.created_at).toLocaleDateString()}</span>
                    <ChevronRight size={14} className="text-slate-400" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
