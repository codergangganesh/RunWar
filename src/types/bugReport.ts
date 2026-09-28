export type BugCategory =
  | 'Authentication'
  | 'Profile'
  | 'Step Tracking'
  | 'Walking/Jogging'
  | 'Activity History'
  | 'Notifications'
  | 'Dashboard'
  | 'UI/Design'
  | 'Performance'
  | 'Data/Sync'
  | 'Settings'
  | 'Other';

export type BugSeverity = 'low' | 'medium' | 'high' | 'critical';

export type BugStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type BugEmailStatus = 'pending' | 'sent' | 'failed';

export interface ScreenshotAttachment {
  url: string;
  key: string;
  name: string;
  size: number;
  mimeType?: string;
}

export interface BugReportSubmission {
  title: string;
  description: string;
  category: BugCategory;
  severity: BugSeverity;
  steps_to_reproduce?: string;
  expected_behavior?: string;
  actual_behavior?: string;
  reported_from?: string;
  screenshotFiles: File[];
}

export interface BugReport {
  id: string;
  report_code: string;
  user_id: string;
  user_email: string;
  title: string;
  description: string;
  category: BugCategory;
  severity: BugSeverity;
  steps_to_reproduce?: string | null;
  expected_behavior?: string | null;
  actual_behavior?: string | null;
  screenshot_urls: ScreenshotAttachment[];
  app_version: string;
  platform: string;
  os_version: string;
  device_info: Record<string, any>;
  screen_size: string;
  reported_from: string;
  status: BugStatus;
  email_status: BugEmailStatus;
  admin_notes?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface BugReportFilter {
  status?: 'all' | BugStatus;
  severity?: 'all' | BugSeverity;
  category?: 'all' | BugCategory;
  search?: string;
}
