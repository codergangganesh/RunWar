import { insforge } from '../lib/insforge';
import {
  BugReport,
  BugReportSubmission,
  ScreenshotAttachment,
  BugReportFilter,
  BugStatus,
} from '../types/bugReport';
import { collectSystemDiagnostics } from '../utils/systemDiagnostics';
import { compressImageFile } from '../utils/imageCompressor';

const INSFORGE_ANON_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_INSFORGE_ANON_KEY) || '';
const FUNCTIONS_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_INSFORGE_FUNCTIONS_URL) ||
  'https://9r3q7vvs.function2.insforge.app';
const ADMIN_EMAIL = 'mannamganeshbabu8@gmail.com';

// Max file size: 5 MB
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

export class BugReportService {
  /**
   * Validate a single screenshot file
   */
  validateImageFile(file: File): { valid: boolean; error?: string } {
    if (!file) {
      return { valid: false, error: 'No file selected.' };
    }

    // Size validation
    if (file.size > MAX_IMAGE_SIZE) {
      return { valid: false, error: `Image "${file.name}" exceeds the 5 MB size limit.` };
    }

    // MIME type validation
    if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      return {
        valid: false,
        error: `File format "${file.type}" is not supported. Please upload PNG, JPG, or WebP.`,
      };
    }

    // Extension validation
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      return {
        valid: false,
        error: `File extension ".${ext}" is not supported. Please upload PNG, JPG, or WebP.`,
      };
    }

    return { valid: true };
  }

  /**
   * Upload screenshot attachments to InsForge Storage.
   * Persists both returned `url` and `key` as per InsForge best practices.
   */
  async uploadScreenshots(
    userId: string,
    files: File[]
  ): Promise<ScreenshotAttachment[]> {
    if (!files || files.length === 0) return [];

    const attachments: ScreenshotAttachment[] = [];

    for (const file of files) {
      const validation = this.validateImageFile(file);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Compress screenshot client-side (max 1024x1024 JPEG) to minimize upload/storage egress
      const compressed = await compressImageFile(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.8, mimeType: 'image/jpeg' });
      const fileExt = compressed.name.split('.').pop() || 'jpg';
      const storageKey = `bugs/${userId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

      try {
        // Try avatars bucket (configured in project) with unique bug path
        const { data, error } = await insforge.storage
          .from('avatars')
          .upload(storageKey, compressed);

        if (!error && data?.url) {
          attachments.push({
            url: data.url,
            key: data.key || storageKey,
            name: file.name,
            size: compressed.size,
            mimeType: compressed.type,
          });
          continue;
        }
      } catch (uploadErr) {
        console.warn('[BugReportService] Storage upload failed, attempting signed upload:', uploadErr);
      }

      // If direct upload fails, fallback to Data URL for resilience so report isn't lost
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(compressed);
      });

      attachments.push({
        url: dataUrl,
        key: storageKey,
        name: file.name,
        size: file.size,
        mimeType: file.type,
      });
    }

    return attachments;
  }

  /**
   * Submit a new Bug Report
   * Flow:
   * 1. Validate inputs
   * 2. Upload screenshots to InsForge Storage
   * 3. Collect non-sensitive system diagnostics
   * 4. Save to InsForge Database
   * 5. Trigger server-side SMTP email Edge function
   */
  async submitBugReport(
    userId: string,
    userEmail: string,
    submission: BugReportSubmission
  ): Promise<{ report: BugReport; emailSent: boolean; emailError?: string }> {
    if (!userId || !userEmail) {
      throw new Error('Your session has expired. Please sign in again.');
    }

    if (!submission.title?.trim()) {
      throw new Error('Please enter a bug title.');
    }

    if (!submission.description?.trim()) {
      throw new Error('Please describe the issue.');
    }

    if (!submission.category) {
      throw new Error('Please select a category.');
    }

    if (!submission.severity) {
      throw new Error('Please select a severity level.');
    }

    // 1. Upload screenshots
    let screenshotUrls: ScreenshotAttachment[] = [];
    if (submission.screenshotFiles && submission.screenshotFiles.length > 0) {
      screenshotUrls = await this.uploadScreenshots(userId, submission.screenshotFiles);
    }

    // 2. Collect diagnostic info
    const diagnostics = collectSystemDiagnostics();

    // 3. Prepare Postgres payload
    const reportPayload = {
      user_id: userId,
      user_email: userEmail,
      title: submission.title.trim(),
      description: submission.description.trim(),
      category: submission.category,
      severity: submission.severity,
      steps_to_reproduce: submission.steps_to_reproduce?.trim() || null,
      expected_behavior: submission.expected_behavior?.trim() || null,
      actual_behavior: submission.actual_behavior?.trim() || null,
      screenshot_urls: screenshotUrls,
      app_version: diagnostics.app_version,
      platform: diagnostics.platform,
      os_version: diagnostics.os_version,
      device_info: diagnostics.device_info,
      screen_size: diagnostics.screen_size,
      reported_from: submission.reported_from || 'Profile > Report a Bug',
      status: 'open',
      email_status: 'pending',
    };

    // 4. Save to InsForge Postgres DB
    const { data, error } = await insforge.database
      .from('bug_reports')
      .insert([reportPayload])
      .select();

    if (error) {
      console.error('[BugReportService] Database save error:', error);
      throw new Error("We couldn't submit your report. Please check your connection and try again.");
    }

    const createdReport = (Array.isArray(data) ? data[0] : data) as BugReport;
    if (!createdReport?.id) {
      throw new Error('Something went wrong while submitting your report. Please try again.');
    }

    // 5. Trigger server-side SMTP email notification
    const emailResult = await this.sendBugReportEmail(createdReport);

    return {
      report: createdReport,
      emailSent: emailResult.success,
      emailError: emailResult.error,
    };
  }

  /**
   * Helper to update bug report email delivery status in InsForge database
   */
  private async markEmailStatus(
    reportId: string,
    status: 'sent' | 'failed',
    note?: string
  ): Promise<void> {
    const updatePayload: Record<string, any> = {
      email_status: status,
      updated_at: new Date().toISOString(),
    };
    if (note) {
      updatePayload.admin_notes = note;
    }

    try {
      await insforge.database
        .from('bug_reports')
        .update(updatePayload)
        .eq('id', reportId);
    } catch (e: any) {
      console.warn('[BugReportService] Failed to update email_status in DB:', e);
    }
  }

  /**
   * Resend bug report email notification via SMTP (callable by user or admin)
   */
  async resendBugReportEmail(reportId: string): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await insforge.database
      .from('bug_reports')
      .select('*')
      .eq('id', reportId)
      .maybeSingle();

    if (error || !data) {
      return { success: false, error: 'Bug report not found.' };
    }

    return await this.sendBugReportEmail(data as BugReport);
  }

  /**
   * Dispatch bug report email notification via the server-side `send-bug-report` Edge Function.
   * Avoids exposing any admin API key or sending raw SMTP requests from the browser.
   */
  async sendBugReportEmail(report: BugReport): Promise<{ success: boolean; error?: string }> {
    let lastError = '';

    // STRATEGY 1: Authenticated SDK Edge Function invocation (attaches user JWT automatically)
    try {
      const sdkRes = await insforge.functions.invoke('send-bug-report', {
        body: { reportId: report.id },
      });

      if (!sdkRes.error && sdkRes.data?.success && sdkRes.data?.emailSent) {
        await this.markEmailStatus(report.id, 'sent');
        return { success: true };
      }
      if (sdkRes.error) {
        lastError = sdkRes.error?.message || 'Edge function invoke error';
      } else if (sdkRes.data?.warning || sdkRes.data?.error) {
        lastError = sdkRes.data?.error || sdkRes.data?.warning;
      }
    } catch (err: any) {
      lastError = err?.message || 'Edge function invoke exception';
      console.warn('[BugReportService] SDK invoke exception:', lastError);
    }

    // STRATEGY 2: Direct HTTP POST to Edge Function endpoint with current session token or anon key
    if (INSFORGE_ANON_KEY) {
      try {
        let bearerToken = INSFORGE_ANON_KEY;
        try {
          bearerToken = localStorage.getItem('runwar_auth_token') || INSFORGE_ANON_KEY;
        } catch {}
        const fnRes = await fetch(`${FUNCTIONS_URL}/send-bug-report`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': INSFORGE_ANON_KEY,
            'Authorization': `Bearer ${bearerToken}`,
          },
          body: JSON.stringify({ reportId: report.id }),
        });

        if (fnRes.ok) {
          const data = await fnRes.json().catch(() => ({}));
          if (data?.success && data?.emailSent) {
            await this.markEmailStatus(report.id, 'sent');
            return { success: true };
          }
          lastError = data?.error || data?.warning || lastError;
        } else {
          const fnErr = await fnRes.text().catch(() => '');
          lastError = `HTTP ${fnRes.status}: ${fnErr || fnRes.statusText}`;
        }
      } catch (err: any) {
        lastError = err?.message || lastError || 'Edge function fetch exception';
        console.warn('[BugReportService] Direct edge function exception:', lastError);
      }
    }

    // All attempts failed
    console.error('[BugReportService] Bug report email dispatch failed. Last error:', lastError);
    await this.markEmailStatus(
      report.id,
      'failed',
      `SMTP dispatch error: ${lastError || 'Unable to reach notification service'}`
    );

    return { success: false, error: lastError };
  }

  /**
   * Fetch bug reports for the authenticated user (for User History)
   */
  async getUserBugReports(userId: string): Promise<BugReport[]> {
    if (!userId) return [];

    const { data, error } = await insforge.database
      .from('bug_reports')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[BugReportService] Failed to fetch user reports:', error);
      return [];
    }

    return (data || []) as BugReport[];
  }

  /**
   * Admin: Fetch all bug reports with optional filters
   */
  async getAdminBugReports(filter?: BugReportFilter): Promise<BugReport[]> {
    let query = insforge.database
      .from('bug_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter?.status && filter.status !== 'all') {
      query = query.eq('status', filter.status);
    }

    if (filter?.severity && filter.severity !== 'all') {
      query = query.eq('severity', filter.severity);
    }

    if (filter?.category && filter.category !== 'all') {
      query = query.eq('category', filter.category);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[BugReportService] Admin fetch error:', error);
      throw error;
    }

    let results = (data || []) as BugReport[];

    // In-memory search filter for title, description, code, reporter email
    if (filter?.search?.trim()) {
      const q = filter.search.toLowerCase().trim();
      results = results.filter(
        (r) =>
          r.title?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          r.report_code?.toLowerCase().includes(q) ||
          r.user_email?.toLowerCase().includes(q)
      );
    }

    return results;
  }

  /**
   * Admin: Update report status and/or admin notes
   */
  async updateReportStatus(
    reportId: string,
    status: BugStatus,
    adminNotes?: string
  ): Promise<void> {
    const updatePayload: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'resolved' || status === 'closed') {
      updatePayload.resolved_at = new Date().toISOString();
    }

    if (adminNotes !== undefined) {
      updatePayload.admin_notes = adminNotes;
    }

    const { error } = await insforge.database
      .from('bug_reports')
      .update(updatePayload)
      .eq('id', reportId);

    if (error) {
      console.error('[BugReportService] Failed to update report status:', error);
      throw error;
    }
  }

  /**
   * Check if current user is an authorized admin
   */
  isAdminUser(userEmail?: string | null): boolean {
    if (!userEmail) return false;
    return userEmail.trim().toLowerCase() === 'mannamganeshbabu8@gmail.com';
  }
}

export const bugReportService = new BugReportService();
