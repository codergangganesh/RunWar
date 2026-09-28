// Edge Function: send-bug-report
// Server-side bug report email notification dispatcher

declare const Deno: any;

const INSFORGE_URL =
  Deno.env.get('INSFORGE_BASE_URL') ??
  Deno.env.get('INSFORGE_URL') ??
  'https://7p7ewmvi.us-east.insforge.app';

const SERVICE_ROLE_KEY =
  Deno.env.get('API_KEY') ??
  Deno.env.get('ANON_KEY') ??
  Deno.env.get('INSFORGE_SERVICE_ROLE_KEY') ??
  'ik_9d2a844d3d742c432e4c93745a27c78d';

const ADMIN_EMAIL = 'mannamganeshbabu8@gmail.com';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { reportId } = body;

    if (!reportId) {
      return new Response(
        JSON.stringify({ error: 'Missing reportId parameter' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. Fetch authoritative bug report by ID using service role
    const reportUrl = `${INSFORGE_URL}/api/database/records/bug_reports?id=eq.${reportId}&limit=1`;
    const reportRes = await fetch(reportUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
      },
    });

    if (!reportRes.ok) {
      const errText = await reportRes.text().catch(() => '');
      return new Response(
        JSON.stringify({ error: `Failed to fetch bug report: ${errText}` }),
        { status: 404, headers: corsHeaders }
      );
    }

    const records = await reportRes.json();
    const report = Array.isArray(records) ? records[0] : records;

    if (!report) {
      return new Response(
        JSON.stringify({ error: 'Bug report record not found' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // 2. Render Screenshots list
    let screenshotsHtml = '<span class="text" style="color: #64748b;">No screenshots attached.</span>';
    if (Array.isArray(report.screenshot_urls) && report.screenshot_urls.length > 0) {
      screenshotsHtml = report.screenshot_urls
        .map(
          (item: any, idx: number) =>
            `<a href="${item.url}" target="_blank" rel="noopener noreferrer">View Screenshot ${idx + 1} ${item.name ? `(${item.name})` : ''}</a>`
        )
        .join('');
    }

    const emailSubject = `[Bug Report] ${report.title} (${report.report_code || 'New'})`;

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

    // 3. Send email via SMTP endpoint
    const emailRes = await fetch(`${INSFORGE_URL}/api/email/send-raw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        from: 'RunWar <mannamganeshbabu8@gmail.com>',
        to: ADMIN_EMAIL,
        replyTo: report.user_email || ADMIN_EMAIL,
        subject: emailSubject,
        html: emailHtml,
      }),
    });

    if (!emailRes.ok) {
      const emailErr = await emailRes.text().catch(() => '');
      console.warn('[send-bug-report] SMTP error:', emailErr);

      await fetch(`${INSFORGE_URL}/api/database/records/bug_reports?id=eq.${reportId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email_status: 'failed' }),
      });

      return new Response(
        JSON.stringify({ success: true, emailSent: false, warning: 'SMTP delivery deferred', details: emailErr }),
        { headers: corsHeaders }
      );
    }

    await fetch(`${INSFORGE_URL}/api/database/records/bug_reports?id=eq.${reportId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email_status: 'sent' }),
    });

    return new Response(
      JSON.stringify({ success: true, emailSent: true, reportCode: report.report_code }),
      { headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('[send-bug-report] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
}
