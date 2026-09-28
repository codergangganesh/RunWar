/**
 * System Diagnostics Collector for Bug Reports
 * Safely collects useful, non-sensitive client environment information for debugging.
 */

export interface SystemDiagnostics {
  app_version: string;
  platform: string;
  os_version: string;
  device_info: {
    browser: string;
    userAgent: string;
    language: string;
    deviceMemory?: number;
    hardwareConcurrency?: number;
    touchPoints: number;
    isOnline: boolean;
  };
  screen_size: string;
  timestamp: string;
}

export function collectSystemDiagnostics(): SystemDiagnostics {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
  
  // Safe Browser Detection
  let browser = 'Unknown Browser';
  if (ua.includes('Firefox/')) {
    browser = 'Firefox';
  } else if (ua.includes('Edg/')) {
    browser = 'Edge';
  } else if (ua.includes('Chrome/')) {
    browser = 'Chrome';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    browser = 'Safari';
  } else if (ua.includes('Opera/') || ua.includes('OPR/')) {
    browser = 'Opera';
  }

  // Safe Operating System Detection
  let os = 'Unknown OS';
  if (/Android/i.test(ua)) {
    const match = ua.match(/Android\s([0-9.]+)/i);
    os = match ? `Android ${match[1]}` : 'Android';
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    const match = ua.match(/OS\s([0-9_]+)/i);
    os = match ? `iOS ${match[1].replace(/_/g, '.')}` : 'iOS';
  } else if (/Windows NT 10.0/i.test(ua)) {
    os = 'Windows 10/11';
  } else if (/Windows/i.test(ua)) {
    os = 'Windows';
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    os = 'macOS';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  // Safe Screen & Viewport Dimensions
  let screenSize = 'Unknown';
  if (typeof window !== 'undefined' && window.screen) {
    const width = window.screen.width;
    const height = window.screen.height;
    const dpr = window.devicePixelRatio || 1;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    screenSize = `${width} × ${height} (viewport: ${viewportW} × ${viewportH}, dpr: ${dpr})`;
  }

  // Safe platform string
  const platform =
    typeof navigator !== 'undefined'
      ? (navigator as any).userAgentData?.platform || navigator.platform || 'Web'
      : 'Web';

  return {
    app_version: '1.0.0',
    platform,
    os_version: os,
    device_info: {
      browser,
      userAgent: ua,
      language: typeof navigator !== 'undefined' ? navigator.language || 'en' : 'en',
      deviceMemory: typeof navigator !== 'undefined' ? (navigator as any).deviceMemory : undefined,
      hardwareConcurrency: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined,
      touchPoints: typeof navigator !== 'undefined' ? navigator.maxTouchPoints || 0 : 0,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    },
    screen_size: screenSize,
    timestamp: new Date().toISOString(),
  };
}
