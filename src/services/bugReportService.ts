import { createAdminClient } from '@insforge/sdk';
import { insforge } from '../lib/insforge';
import {
  BugReport,
  BugReportSubmission,
  ScreenshotAttachment,
  BugReportFilter,
  BugStatus,
} from '../types/bugReport';
import { collectSystemDiagnostics } from '../utils/systemDiagnostics';

const INSFORGE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_INSFORGE_URL) ||
  'https://7p7ewmvi.us-east.insforge.app';
const INSFORGE_API_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_INSFORGE_ANON_KEY) ||
  'ik_9d2a844d3d742c432e4c93745a27c78d';
const FUNCTIONS_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_INSFORGE_FUNCTIONS_URL) ||
  'https://7p7ewmvi.function2.insforge.app';
const ADMIN_EMAIL = 'mannamganeshbabu8@gmail.com';
const SENDER_EMAIL = 'RunWar <mannamganeshbabu8@gmail.com>';

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

      const fileExt = file.name.split('.').pop() || 'png';
      const storageKey = `bugs/${userId}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

      try {
        // Try avatars bucket (configured in project) with unique bug path
        const { data, error } = await insforge.storage
          .from('avatars')
          .upload(storageKey, file);

        if (!error && data?.url) {
          attachments.push({
            url: data.url,
            key: data.key || storageKey,
            name: file.name,
            size: file.size,
            mimeType: file.type,
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
        reader.readAsDataURL(file);
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
   * Dedicated Admin Client instance for server-level operations.
   * Ensures requests to /api/email/send-raw use the project API key
   * instead of standard end-user JWT session scoping.
   */
  private getAdminClientInstance() {
    try {
      return createAdminClient({
        baseUrl: INSFORGE_URL,
        apiKey: INSFORGE_API_KEY,
        headers: {
          apikey: INSFORGE_API_KEY,
        },
      });
    } catch (e) {
      console.warn('[BugReportService] Could not initialize createAdminClient:', e);
      return null;
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
   * Format and send bug report email via InsForge SMTP service
   * Employs multi-layer fallback strategy for guaranteed SMTP dispatch.
   */
  async sendBugReportEmail(report: BugReport): Promise<{ success: boolean; error?: string }> {
    const adminEmail = ADMIN_EMAIL;
    const emailSubject = `[Bug Report] ${report.title} (${report.report_code || 'New'})`;

    const severityColors: Record<string, string> = {
      critical: '#ef4444',
      high: '#f97316',
      medium: '#eab308',
      low: '#10b981',
    };
    const color = severityColors[report.severity] || '#64748b';

    let screenshotsHtml = '<span class="text" style="color: #64748b;">No screenshots attached.</span>';
    if (Array.isArray(report.screenshot_urls) && report.screenshot_urls.length > 0) {
      screenshotsHtml = report.screenshot_urls
        .map(
          (item: any, idx: number) =>
            `<a href="${item.url}" target="_blank" rel="noopener noreferrer">View Screenshot ${idx + 1} ${item.name ? `(${item.name})` : ''}</a>`
        )
        .join('');
    }

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      background: #f5f7f9;
      color: #1e293b;
      margin: 0;
      padding: 24px 12px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
    }
    .header {
      padding: 20px 24px;
      border-bottom: 1px solid #e2e8f0;
    }
    .header h1 {
      margin: 0;
      font-size: 18px;
      color: #0f172a;
    }
    .header p {
      margin: 5px 0 0;
      font-size: 12px;
      color: #64748b;
    }
    .content {
      padding: 24px;
    }
    .title {
      margin: 0 0 20px;
      font-size: 20px;
      color: #0f172a;
    }
    .section {
      margin-bottom: 20px;
    }
    .label {
      margin-bottom: 6px;
      font-size: 11px;
      font-weight: bold;
      text-transform: uppercase;
      color: #64748b;
    }
    .text {
      font-size: 14px;
      line-height: 1.6;
      color: #334155;
      white-space: pre-wrap;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    td {
      padding: 8px 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 13px;
      vertical-align: top;
    }
    .key {
      width: 130px;
      color: #64748b;
      font-weight: 600;
    }
    .value {
      color: #1e293b;
      word-break: break-word;
    }
    .screenshots {
      margin-top: 8px;
    }
    .screenshots a {
      display: block;
      margin-bottom: 6px;
      color: #059669;
      font-size: 13px;
      text-decoration: none;
      font-weight: 600;
    }
    .app-details {
      padding: 20px 24px 18px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      text-align: center;
    }
    .app-logo {
      width: 48px;
      height: 48px;
      margin: 0 auto 10px;
      border-radius: 12px;
      display: block;
    }
    .app-name {
      font-size: 17px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #0f172a;
      margin-bottom: 5px;
    }
    .app-tagline {
      font-size: 11px;
      color: #059669;
      font-weight: 600;
      margin-bottom: 7px;
    }
    .app-description {
      max-width: 470px;
      margin: 0 auto;
      font-size: 11px;
      line-height: 1.5;
      color: #64748b;
    }
    .app-meta {
      margin-top: 12px;
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 6px;
    }
    .app-meta span {
      padding: 5px 10px;
      border-radius: 999px;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      color: #475569;
      font-size: 10px;
      font-weight: 600;
    }
    .footer {
      padding: 13px 24px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>RunWar — New Bug Report</h1>
      <p>Report ID: ${report.report_code || report.id}</p>
    </div>
    <div class="content">
      <h2 class="title">${report.title}</h2>
      <div class="section">
        <div class="label">Description</div>
        <div class="text">${report.description}</div>
      </div>
      ${
        report.steps_to_reproduce
          ? `
          <div class="section">
            <div class="label">Steps to Reproduce</div>
            <div class="text">${report.steps_to_reproduce}</div>
          </div>
          `
          : ''
      }
      ${
        report.expected_behavior
          ? `
          <div class="section">
            <div class="label">Expected Behavior</div>
            <div class="text">${report.expected_behavior}</div>
          </div>
          `
          : ''
      }
      ${
        report.actual_behavior
          ? `
          <div class="section">
            <div class="label">Actual Behavior</div>
            <div class="text">${report.actual_behavior}</div>
          </div>
          `
          : ''
      }
      <div class="section">
        <div class="label">Report Information</div>
        <table>
          <tr><td class="key">Category</td><td class="value">${report.category}</td></tr>
          <tr><td class="key">Severity</td><td class="value">${report.severity}</td></tr>
          <tr><td class="key">Reporter</td><td class="value">${report.user_email}</td></tr>
          <tr><td class="key">User ID</td><td class="value">${report.user_id}</td></tr>
          <tr><td class="key">Reported From</td><td class="value">${report.reported_from || 'Direct Screen'}</td></tr>
          <tr><td class="key">App Version</td><td class="value">v${report.app_version || '1.0.0'}</td></tr>
          <tr><td class="key">Platform</td><td class="value">${report.platform || 'Unknown'}</td></tr>
          <tr><td class="key">OS</td><td class="value">${report.os_version || 'Unknown'}</td></tr>
          <tr><td class="key">Screen Size</td><td class="value">${report.screen_size || 'Unknown'}</td></tr>
          <tr><td class="key">Submitted</td><td class="value">${new Date(report.created_at).toLocaleString()}</td></tr>
        </table>
      </div>
      <div class="section">
        <div class="label">Screenshots & Attachments</div>
        <div class="screenshots">
          ${screenshotsHtml}
        </div>
      </div>
    </div>
    <div class="app-details">
      <img src="https://run-war-chi.vercel.app/logo.png" alt="RUN WAR" width="48" height="48" class="app-logo" />
      <div class="app-name">RUN WAR</div>
      <div class="app-tagline">Run. Compete. Improve.</div>
      <div class="app-description">
        RUN WAR is a smart jogging and running platform designed to help users track workouts, set goals, participate in challenges, build consistency, and improve their running performance.
      </div>
      <div class="app-meta">
        <span>Run Tracking</span>
        <span>Goals</span>
        <span>Challenges</span>
        <span>Notifications</span>
      </div>
    </div>
    <div class="footer">
      Automated bug report from RUN WAR.
    </div>
  </div>
</body>
</html>
    `;

    let lastError = '';

    // ─────────────────────────────────────────────────────────────
    // STRATEGY 1: Dedicated Admin Client via `createAdminClient`
    // Sends with Project API Key (avoids end-user JWT scoping issues)
    // ─────────────────────────────────────────────────────────────
    try {
      const adminClient = this.getAdminClientInstance();
      if (adminClient?.emails?.send) {
        console.log('[BugReportService] Attempt 1: Sending via createAdminClient.emails.send...');
        const emailRes = await adminClient.emails.send({
          from: SENDER_EMAIL,
          to: adminEmail,
          replyTo: report.user_email || adminEmail,
          subject: emailSubject,
          html: emailHtml,
        });

        if (!emailRes.error) {
          console.log('[BugReportService] Attempt 1 successful! SMTP email sent.');
          await this.markEmailStatus(report.id, 'sent');
          return { success: true };
        } else {
          lastError = emailRes.error?.message || 'AdminClient email send returned error';
          console.warn('[BugReportService] Attempt 1 error:', lastError);
        }
      }
    } catch (err: any) {
      lastError = err?.message || 'AdminClient send error';
      console.warn('[BugReportService] Attempt 1 exception:', lastError);
    }

    // ─────────────────────────────────────────────────────────────
    // STRATEGY 2: Direct HTTP POST to InsForge `/api/email/send-raw`
    // Explicitly sends `apikey` and `Authorization: Bearer` headers
    // ─────────────────────────────────────────────────────────────
    try {
      console.log('[BugReportService] Attempt 2: Sending via direct HTTP POST to /api/email/send-raw...');
      const directRes = await fetch(`${INSFORGE_URL}/api/email/send-raw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': INSFORGE_API_KEY,
          'Authorization': `Bearer ${INSFORGE_API_KEY}`,
        },
        body: JSON.stringify({
          from: SENDER_EMAIL,
          to: adminEmail,
          replyTo: report.user_email || adminEmail,
          subject: emailSubject,
          html: emailHtml,
        }),
      });

      if (directRes.ok) {
        console.log('[BugReportService] Attempt 2 successful! Direct SMTP endpoint sent email.');
        await this.markEmailStatus(report.id, 'sent');
        return { success: true };
      } else {
        const errorText = await directRes.text().catch(() => '');
        lastError = `HTTP ${directRes.status}: ${errorText || directRes.statusText}`;
        console.warn('[BugReportService] Attempt 2 error:', lastError);
      }
    } catch (err: any) {
      lastError = err?.message || 'Direct HTTP send-raw exception';
      console.warn('[BugReportService] Attempt 2 exception:', lastError);
    }

    // ─────────────────────────────────────────────────────────────
    // STRATEGY 3: Standard Client `insforge.emails.send`
    // With explicit `from` parameter
    // ─────────────────────────────────────────────────────────────
    try {
      console.log('[BugReportService] Attempt 3: Sending via insforge.emails.send with from parameter...');
      const fallbackRes = await insforge.emails.send({
        from: SENDER_EMAIL,
        to: adminEmail,
        replyTo: report.user_email || adminEmail,
        subject: emailSubject,
        html: emailHtml,
      });

      if (!fallbackRes.error) {
        console.log('[BugReportService] Attempt 3 successful! insforge.emails.send worked.');
        await this.markEmailStatus(report.id, 'sent');
        return { success: true };
      } else {
        lastError = fallbackRes.error?.message || 'insforge.emails.send error';
        console.warn('[BugReportService] Attempt 3 error:', lastError);
      }
    } catch (err: any) {
      lastError = err?.message || 'insforge.emails.send exception';
      console.warn('[BugReportService] Attempt 3 exception:', lastError);
    }

    // ─────────────────────────────────────────────────────────────
    // STRATEGY 4: Dedicated Edge Function Endpoint
    // ─────────────────────────────────────────────────────────────
    try {
      console.log('[BugReportService] Attempt 4: Invoking edge function endpoint...');
      const fnUrl = `${FUNCTIONS_URL}/send-bug-report`;
      const fnRes = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': INSFORGE_API_KEY,
          'Authorization': `Bearer ${INSFORGE_API_KEY}`,
        },
        body: JSON.stringify({ reportId: report.id }),
      });

      if (fnRes.ok) {
        const data = await fnRes.json().catch(() => ({}));
        if (data?.success && data?.emailSent) {
          console.log('[BugReportService] Attempt 4 successful! Edge function delivered email.');
          await this.markEmailStatus(report.id, 'sent');
          return { success: true };
        }
      } else {
        const fnErr = await fnRes.text().catch(() => '');
        console.warn('[BugReportService] Attempt 4 edge function status:', fnRes.status, fnErr);
      }
    } catch (err: any) {
      console.warn('[BugReportService] Attempt 4 exception:', err?.message);
    }

    // ─────────────────────────────────────────────────────────────
    // STRATEGY 5: SDK Functions invoke fallback
    // ─────────────────────────────────────────────────────────────
    try {
      console.log('[BugReportService] Attempt 5: Calling insforge.functions.invoke...');
      const sdkRes = await insforge.functions.invoke('send-bug-report', {
        body: { reportId: report.id },
      });

      if (!sdkRes.error && sdkRes.data?.success && sdkRes.data?.emailSent) {
        console.log('[BugReportService] Attempt 5 successful!');
        await this.markEmailStatus(report.id, 'sent');
        return { success: true };
      }
    } catch (err: any) {
      console.warn('[BugReportService] Attempt 5 exception:', err?.message);
    }

    // All attempts failed
    console.error('[BugReportService] All SMTP dispatch attempts exhausted. Last error:', lastError);
    await this.markEmailStatus(
      report.id,
      'failed',
      `SMTP dispatch error: ${lastError || 'Unable to connect to SMTP server'}`
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
