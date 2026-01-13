/**
 * Zoom Clips - Browser-based Transcript Extraction
 *
 * Heideggerian Canon: The tool should recede; the outcome should remain.
 * Users think: "My clips are transcribed" not "I manage browser sessions"
 *
 * EXCEPTION PATTERN: Integration Gap Workaround
 * =============================================
 * This worker exists because Zoom OAuth doesn't provide transcript access
 * for Zoom Clips. Browser scraping is required to extract transcripts.
 *
 * See CLAUDE.md "Exception Patterns" for full context.
 *
 * Trade-offs:
 * - Cookie expiry (~24 hours) requires periodic re-sync
 * - Browser scraping is slower than API calls
 * - Mechanism is more visible to users than OAuth
 *
 * Upgrade path: When Zoom OAuth adds transcript access, deprecate this
 * worker and use canonical pattern:
 *   const transcript = await integrations.zoom.getTranscript(clipId);
 *
 * CANONICAL EXTRACTION PATTERN (proven in Railway implementation):
 * 1. Navigate to Clip share URL
 * 2. Click "Transcript" tab
 * 3. Find scrollable container (.zoom-scrollbar__wrap with largest scrollHeight)
 * 4. Virtual scroll to collect all transcript items (.transcript-list-item for Clips, .mv-transcript-list-item for Meetings)
 * 5. Sort by timestamp, return joined text
 *
 * Multi-user architecture: /endpoint/:userId
 * Each user gets their own Durable Object for session isolation.
 */

import puppeteer, { Browser } from '@cloudflare/puppeteer';

interface Env {
  BROWSER: Fetcher;
  SESSIONS: DurableObjectNamespace;
  UPLOAD_SECRET?: string;
  WORKER_URL?: string;
  NOTION_API_KEY?: string;
  WORKWAY_API_TOKEN?: string;
}

// CORS and security headers helper
function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '';

  // Secure CORS validation using URL parsing (prevents subdomain spoofing)
  const allowedDomains = ['zoom.us', 'workway.co', 'half-dozen.workers.dev', 'localhost'];

  let isAllowed = false;
  try {
    const originUrl = new URL(origin);
    isAllowed = allowedDomains.some((domain) => {
      if (domain === 'localhost') {
        return originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1';
      }
      return originUrl.hostname === domain || originUrl.hostname.endsWith(`.${domain}`);
    });
  } catch {
    isAllowed = false;
  }

  return {
    // CORS headers
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://workway.co',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    // Security headers
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.workway.co https://*.workers.dev",
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
}

// Session expiry constant (24 hours)
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;
const SESSION_EXPIRY_HOURS = 24;

// Keep-alive interval (1 hour) - visits Zoom to refresh session cookies
const KEEP_ALIVE_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Setup page for browser extension workflow
 *
 * Exception to "JSON API only" pattern: Browser extension workflows
 * require a user-facing setup experience. The "Connect" button opens
 * in a new tab - users expect a page, not JSON.
 *
 * Uses CDN design tokens for consistent WORKWAY branding.
 * This pattern can be reused for other browser extension workflows.
 */
function getSetupPage(userId: string): Response {
  // Pure black canvas with white text - CREATE SOMETHING canon
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connect Zoom - WORKWAY</title>
  <link rel="stylesheet" href="https://cdn.workway.co/fonts.css">
  <link rel="stylesheet" href="https://cdn.workway.co/tokens.css">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      background: #000000;
      color: #ffffff;
      font-family: var(--font-sans, 'Stack Sans Notch', -apple-system, BlinkMacSystemFont, sans-serif);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    body {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Back navigation - top left, always visible */
    .back-nav {
      position: fixed;
      top: 0;
      left: 0;
      padding: 1.5rem 2rem;
      z-index: 100;
    }
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: rgba(255, 255, 255, 0.6);
      text-decoration: none;
      font-size: 0.875rem;
      transition: color 0.15s ease;
    }
    .back-link:hover {
      color: #ffffff;
    }
    .back-link svg {
      width: 16px;
      height: 16px;
    }

    /* Main content - centered */
    main {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 2rem;
    }

    .container {
      max-width: 440px;
      width: 100%;
    }

    /* Header */
    .header {
      margin-bottom: 3rem;
    }
    .header h1 {
      font-size: clamp(2rem, 5vw, 2.5rem);
      font-weight: 600;
      letter-spacing: -0.02em;
      line-height: 1.1;
      margin-bottom: 0.75rem;
    }
    .header p {
      color: rgba(255, 255, 255, 0.6);
      font-size: 1rem;
      line-height: 1.5;
    }

    /* Steps */
    .steps {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 2.5rem;
    }
    .step {
      display: flex;
      gap: 1rem;
      padding: 1.25rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      transition: border-color 0.15s ease;
    }
    .step:hover {
      border-color: rgba(255, 255, 255, 0.2);
    }
    .step-number {
      width: 28px;
      height: 28px;
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.8);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 500;
      font-size: 0.8125rem;
      flex-shrink: 0;
    }
    .step-content h3 {
      font-size: 0.9375rem;
      font-weight: 500;
      margin-bottom: 0.25rem;
      color: #ffffff;
    }
    .step-content p {
      font-size: 0.8125rem;
      color: rgba(255, 255, 255, 0.5);
      line-height: 1.4;
    }

    /* User ID box */
    .user-id-box {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 1.25rem;
      margin-bottom: 2rem;
    }
    .user-id-box label {
      display: block;
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.5);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.75rem;
    }
    .user-id-value {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 0.9375rem;
      background: #000000;
      padding: 0.875rem 1rem;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }
    .user-id-value code {
      word-break: break-all;
      color: #ffffff;
    }
    .copy-btn {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.2);
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8125rem;
      font-weight: 500;
      white-space: nowrap;
      transition: all 0.15s ease;
    }
    .copy-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.3);
    }

    /* Note */
    .note {
      font-size: 0.8125rem;
      color: rgba(255, 255, 255, 0.4);
      line-height: 1.5;
    }
    .note strong {
      color: rgba(255, 255, 255, 0.6);
    }

    /* Download link */
    .download-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: #ffffff;
      text-decoration: none;
      padding: 0.625rem 1rem;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.15s ease;
      margin-top: 0.5rem;
    }
    .download-link:hover {
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.3);
    }
    .download-link svg {
      width: 16px;
      height: 16px;
    }

    /* Inline code */
    .step-content code {
      font-family: var(--font-mono, 'JetBrains Mono', monospace);
      font-size: 0.75rem;
      background: rgba(255, 255, 255, 0.1);
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
    }

    /* Links in steps */
    .step-content a:not(.download-link) {
      color: rgba(255, 255, 255, 0.8);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .step-content a:not(.download-link):hover {
      color: #ffffff;
    }
  </style>
</head>
<body>
  <nav class="back-nav">
    <a href="javascript:history.back()" class="back-link" onclick="goBack(event)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7"/>
      </svg>
      Back
    </a>
  </nav>

  <main>
    <div class="container">
      <div class="header">
        <h1>Connect Zoom</h1>
        <p>Sync your Zoom meetings and clips to WORKWAY</p>
      </div>

      <div class="steps">
        <div class="step">
          <div class="step-number">1</div>
          <div class="step-content">
            <h3>Download the Extension</h3>
            <p>
              <a href="/download/extension.zip" class="download-link" download>
                Download WORKWAY Zoom Sync
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                </svg>
              </a>
            </p>
          </div>
        </div>

        <div class="step">
          <div class="step-number">2</div>
          <div class="step-content">
            <h3>Enable Developer Mode</h3>
            <p>Open <code>chrome://extensions</code> and toggle <strong>Developer mode</strong> (top right)</p>
          </div>
        </div>

        <div class="step">
          <div class="step-number">3</div>
          <div class="step-content">
            <h3>Load the Extension</h3>
            <p>Click <strong>Load unpacked</strong>, select the unzipped folder</p>
          </div>
        </div>

        <div class="step">
          <div class="step-number">4</div>
          <div class="step-content">
            <h3>Log into Zoom</h3>
            <p>Sign into <a href="https://zoom.us" target="_blank" rel="noopener">zoom.us</a> in Chrome</p>
          </div>
        </div>

        <div class="step">
          <div class="step-number">5</div>
          <div class="step-content">
            <h3>Sync Your Session</h3>
            <p>Click the extension icon, paste your User ID, click <strong>Sync Now</strong></p>
          </div>
        </div>
      </div>

      <div class="user-id-box">
        <label>Your User ID</label>
        <div class="user-id-value">
          <code id="userId">${userId}</code>
          <button class="copy-btn" onclick="copyUserId()">Copy</button>
        </div>
      </div>

      <p class="note">
        <strong>Note:</strong> Cookies expire after ~24 hours. Re-sync when prompted.
      </p>
    </div>
  </main>

  <script>
    function copyUserId() {
      const userId = document.getElementById('userId').textContent;
      navigator.clipboard.writeText(userId).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.textContent = 'Copied';
        setTimeout(() => btn.textContent = 'Copy', 2000);
      });
    }

    function goBack(e) {
      // If there's history, go back; otherwise go to workflows
      if (document.referrer && document.referrer.includes('workway.co')) {
        // Let the history.back() in href handle it
        return;
      }
      e.preventDefault();
      window.location.href = 'https://workway.co/workflows';
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// JSON API for programmatic access
function getSetupInfo(userId: string): Response {
  return Response.json({
    userId,
    uploadEndpoint: `/upload-cookies/${userId}`,
    healthEndpoint: `/health/${userId}`,
    transcriptEndpoint: `/transcript/${userId}`,
    setupSteps: [
      { step: 1, action: 'Install WORKWAY Zoom Sync extension' },
      { step: 2, action: 'Log into Zoom in your browser' },
      { step: 3, action: 'Click the extension and enter your User ID' },
      { step: 4, action: 'Click "Sync Cookies"' },
    ],
    cookieExpiryHours: SESSION_EXPIRY_HOURS,
    note: 'Cookies expire after ~24 hours. Re-sync when prompted.',
  });
}

// Main worker entry point
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: getCorsHeaders(request) });
    }

    // Route: GET /download/extension.zip - Download browser extension
    if (path === '/download/extension.zip' && request.method === 'GET') {
      try {
        const extensionZipBase64 = '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';

        // Decode base64 to binary using Uint8Array
        const binaryString = atob(extensionZipBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        return new Response(bytes, {
          headers: {
            ...getCorsHeaders(request),
            'Content-Type': 'application/zip',
            'Content-Disposition': 'attachment; filename="workway-zoom-sync.zip"',
          },
        });
      } catch (error: any) {
        return Response.json({ error: 'Failed to serve extension', details: error.message }, { status: 500, headers: getCorsHeaders(request) });
      }
    }

    // Route: GET / - API info
    if (path === '/' && request.method === 'GET') {
      return Response.json({
        service: 'zoom-clips',
        description: 'Zoom transcript extraction',
        endpoints: {
          'GET /health': 'Service health check (unauthenticated)',
          'GET /setup/:userId': 'Setup instructions',
          'GET /health/:userId': 'Check session status',
          'GET /dashboard-data/:userId': 'Dashboard data',
          'POST /upload-cookies/:userId': 'Upload Zoom cookies',
          'GET /meetings/:userId': 'List meetings with transcripts',
          'GET /clips/:userId?days=N': 'List clips from clips library',
          'GET /meeting-transcript/:userId?index=N': 'Get transcript for meeting',
          'POST /transcript/:userId': 'Extract transcript from Zoom URL',
          'POST /sync/:userId?days=N&writeToNotion=true': 'Trigger sync of clips and meetings (optionally write to Notion)',
        },
        sessionMaintenance: 'automatic',
      });
    }

    // Route: GET /notion-debug - Test Notion API integration
    if (path === '/notion-debug' && request.method === 'GET') {
      try {
        const notionApiKey = env.NOTION_API_KEY;
        if (!notionApiKey) {
          return Response.json({ error: 'NOTION_API_KEY not set' }, { status: 500 });
        }

        const HALFDOZEN_INTERNAL_LLM_DATABASE = '27a019187ac580b797fec563c98afbbc';

        // Get database schema to see what properties exist
        const schemaResponse = await fetch(`https://api.notion.com/v1/databases/${HALFDOZEN_INTERNAL_LLM_DATABASE}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${notionApiKey}`,
            'Notion-Version': '2022-06-28',
          },
        });

        const schemaData = await schemaResponse.json();

        return Response.json({
          success: schemaResponse.ok,
          status: schemaResponse.status,
          schema: schemaData,
        }, {
          headers: getCorsHeaders(request),
        });
      } catch (error: any) {
        return Response.json({ error: 'Debug failed', details: error.message }, { status: 500 });
      }
    }

    // Route: GET /health - Standard health check (no authentication required)
    if (path === '/health' && request.method === 'GET') {
      return Response.json({
        status: 'healthy',
        service: 'zoom-clips',
        timestamp: Date.now(),
        version: '2.0.0',
      }, {
        headers: getCorsHeaders(request),
      });
    }

    // Parse userId from path
    const pathParts = path.split('/').filter(Boolean);
    if (pathParts.length < 2) {
      return Response.json({ error: 'Missing userId in path. Use /{endpoint}/{userId}' }, { status: 400 });
    }

    const endpoint = pathParts[0];
    const userId = pathParts[1];

    // Validate userId format
    if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
      return Response.json({ error: 'Invalid userId format' }, { status: 400 });
    }

    // Route to Durable Object for user-specific session handling
    const sessionId = env.SESSIONS.idFromName(userId);
    const session = env.SESSIONS.get(sessionId);

    // Proxy to Durable Object with userId header
    const doUrl = new URL(request.url);
    doUrl.pathname = `/${endpoint}`;

    const headers = new Headers(request.headers);
    headers.set('X-User-Id', userId);

    const doResponse = await session.fetch(
      new Request(doUrl.toString(), {
        method: request.method,
        headers,
        body: request.body,
      })
    );

    // Add security headers to all Durable Object responses
    const securityHeaders = getCorsHeaders(request);
    const responseHeaders = new Headers(doResponse.headers);
    for (const [key, value] of Object.entries(securityHeaders)) {
      responseHeaders.set(key, value);
    }

    return new Response(doResponse.body, {
      status: doResponse.status,
      statusText: doResponse.statusText,
      headers: responseHeaders,
    });
  },
};

/**
 * Durable Object: ZoomSessionManager
 *
 * Manages per-user browser sessions and cookie storage.
 * Zuhandenheit: Session management is invisible to the user.
 */
export class ZoomSessionManager {
  private state: DurableObjectState;
  private env: Env;
  private browser: Browser | null = null;
  private lastActivity: number = 0;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Persist userId for later background jobs (e.g. sync job metadata)
      // Note: X-User-Id is injected by the router at the edge.
      const userIdHeader = request.headers.get('X-User-Id');
      if (userIdHeader) {
        await this.state.storage.put('userId', userIdHeader);
      }

      // Route handlers
      if (path === '/setup' && request.method === 'GET') {
        const userId = request.headers.get('X-User-Id') || 'unknown';
        // Serve HTML page by default (user-facing Connect button)
        // Use Accept header or ?format=json for programmatic access
        const acceptHeader = request.headers.get('Accept') || '';
        const formatParam = new URL(request.url).searchParams.get('format');
        if (formatParam === 'json' || acceptHeader.includes('application/json')) {
          return getSetupInfo(userId);
        }
        return getSetupPage(userId);
      }

      if (path === '/health' && request.method === 'GET') {
        return this.getHealth();
      }

      if (path === '/upload-cookies' && request.method === 'POST') {
        return this.uploadCookies(request);
      }

      if (path === '/transcript' && request.method === 'POST') {
        return this.extractTranscript(request);
      }

      if (path === '/meetings' && request.method === 'GET') {
        return this.listMeetings();
      }

      if (path === '/meeting-transcript' && request.method === 'GET') {
        const index = parseInt(url.searchParams.get('index') || '0');
        return this.getMeetingTranscript(index);
      }

      if (path === '/dashboard-data' && request.method === 'GET') {
        return this.getDashboardData();
      }

      if (path === '/clips' && request.method === 'GET') {
        const days = parseInt(url.searchParams.get('days') || '7');
        return this.listClips(days);
      }

      if (path === '/clips-debug' && request.method === 'GET') {
        return this.debugClipsPage();
      }

      if (path === '/sync' && request.method === 'POST') {
        const days = parseInt(url.searchParams.get('days') || '7');
        const writeToNotion = url.searchParams.get('writeToNotion') === 'true';
        return this.runSync(days, writeToNotion);
      }

      // Polling endpoint for async Notion sync jobs
      // GET /sync-status?jobId=...
      if (path === '/sync-status' && request.method === 'GET') {
        const jobId = url.searchParams.get('jobId') || '';
        if (!jobId) {
          return Response.json({ success: false, error: 'Missing jobId' }, { status: 400 });
        }
        return this.getSyncStatus(jobId);
      }

      if (path === '/disconnect' && request.method === 'POST') {
        return this.disconnect();
      }

      if (path === '/analytics' && request.method === 'GET') {
        return this.getAnalytics();
      }

      return Response.json({ error: 'Unknown endpoint', path }, { status: 404 });
    } catch (error: any) {
      console.error('DO Error:', error);
      return Response.json({ error: error.message || 'Internal error' }, { status: 500 });
    }
  }

  /**
   * GET /health - Check session and cookie status
   */
  private async getHealth(): Promise<Response> {
    const cookies = await this.state.storage.get<any[]>('zoom_cookies');
    const uploadedAt = await this.state.storage.get<number>('cookies_uploaded_at');

    if (!cookies || cookies.length === 0) {
      return Response.json({
        status: 'no_cookies',
        message: 'No cookies uploaded. Use Chrome extension to sync.',
        needsAuth: true,
      });
    }

    // Check cookie expiration
    const cookieAge = uploadedAt ? Date.now() - uploadedAt : 0;
    const expiresIn = SESSION_EXPIRY_MS - cookieAge;

    if (expiresIn < 0) {
      return Response.json({
        status: 'cookies_expired',
        message: 'Cookies have expired. Please re-sync via Chrome extension.',
        needsAuth: true,
        cookieAge: Math.floor(cookieAge / 1000 / 60 / 60),
      });
    }

    return Response.json({
      status: 'ready',
      cookieCount: cookies.length,
      cookieAge: Math.floor(cookieAge / 1000 / 60 / 60),
      expiresIn: Math.floor(expiresIn / 1000 / 60 / 60),
      needsAuth: false,
    });
  }

  /**
   * GET /dashboard-data - Get data for workway.co/workflows dashboard
   * Returns connection status and execution stats in expected format
   */
  private async getDashboardData(): Promise<Response> {
    const cookies = await this.state.storage.get<any[]>('zoom_cookies');
    const uploadedAt = await this.state.storage.get<number>('cookies_uploaded_at');
    const executions = await this.state.storage.get<Array<{
      started_at: string;
      completed_at?: string;
      success: boolean;
      source_url?: string;
    }>>('executions') || [];

    // Connection status
    let connected = false;
    let expiresIn = 0;

    if (cookies && cookies.length > 0 && uploadedAt) {
      const cookieAge = Date.now() - uploadedAt;
      expiresIn = SESSION_EXPIRY_MS - cookieAge;
      connected = expiresIn > 0;
    }

    // Calculate stats
    const totalRuns = executions.length;
    const successfulRuns = executions.filter(e => e.success).length;

    return Response.json({
      zoomConnection: {
        connected,
        expiresIn: expiresIn > 0 ? expiresIn : 0,
      },
      stats: {
        totalRuns,
        successfulRuns,
      },
      executions: executions.slice(0, 10), // Last 10 executions
    });
  }

  /**
   * POST /disconnect - Clear stored cookies and session data
   * Called when user disconnects the workflow from workway.co/workflows
   */
  private async disconnect(): Promise<Response> {
    try {
      // Clear all session data
      await this.state.storage.delete('zoom_cookies');
      await this.state.storage.delete('cookies_uploaded_at');
      await this.state.storage.delete('session_active');

      // Cancel any pending alarms
      await this.state.storage.deleteAlarm();

      // Close browser if open
      if (this.browser) {
        try {
          await this.browser.close();
        } catch {
          // Browser may already be closed
        }
        this.browser = null;
      }

      return Response.json({
        success: true,
        message: 'Disconnected successfully',
      });
    } catch (error: any) {
      return Response.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }
  }

  /**
   * GET /analytics - Get detailed analytics for the workflow
   * Called by workway.co/workflows/private/{id}/analytics
   */
  private async getAnalytics(): Promise<Response> {
    const executions = await this.state.storage.get<Array<{
      started_at: string;
      completed_at?: string;
      success: boolean;
      source_url?: string;
      type?: string;
      meetings_count?: number;
      clips_count?: number;
      transcripts_extracted?: number;
    }>>('executions') || [];

    // Calculate stats
    const totalRuns = executions.length;
    const successfulRuns = executions.filter(e => e.success).length;
    const failedRuns = executions.filter(e => !e.success).length;
    const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0;

    // Aggregate content counts
    const totalMeetingsSynced = executions.reduce((sum, e) => sum + (e.meetings_count || 0), 0);
    const totalClipsSynced = executions.reduce((sum, e) => sum + (e.clips_count || 0), 0);
    const totalTranscripts = executions.reduce((sum, e) => sum + (e.transcripts_extracted || 0), 0);

    return Response.json({
      executions: executions.slice(0, 50), // Last 50 executions for analytics
      stats: {
        totalRuns,
        successfulRuns,
        failedRuns,
        successRate,
        totalMeetingsSynced,
        totalClipsSynced,
        totalThreadsSynced: 0, // Not applicable for this workflow
        totalContactsCreated: 0, // Not applicable
        totalTranscripts,
      },
    });
  }

  /**
   * POST /upload-cookies - Store Zoom cookies from Chrome extension
   */
  private async uploadCookies(request: Request): Promise<Response> {
    try {
      const body = await request.json() as { cookies: any[] };

      if (!body.cookies || !Array.isArray(body.cookies) || body.cookies.length === 0) {
        return Response.json({ error: 'Invalid cookies format' }, { status: 400 });
      }

      // Filter to Zoom-relevant cookies
      const zoomCookies = body.cookies.filter((c: any) =>
        c.domain?.includes('zoom.us') || c.domain?.includes('.zoom.us')
      );

      if (zoomCookies.length === 0) {
        return Response.json({ error: 'No Zoom cookies found' }, { status: 400 });
      }

      // Store cookies
      await this.state.storage.put('zoom_cookies', zoomCookies);
      await this.state.storage.put('cookies_uploaded_at', Date.now());
      await this.state.storage.put('session_active', true);

      // Set hourly keep-alive alarm to refresh session
      const nextAlarm = Date.now() + KEEP_ALIVE_INTERVAL_MS;
      await this.state.storage.setAlarm(nextAlarm);

      return Response.json({
        success: true,
        message: `Stored ${zoomCookies.length} Zoom cookies`,
        expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS).toISOString(),
      });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }
  }

  /**
   * Extract meeting transcript by row index and return just the text
   * @private
   */
  private async extractMeetingTranscriptByIndex(index: number): Promise<string | null> {
    const storedCookies = await this.state.storage.get<any>('zoom_cookies');
    const cookies = Array.isArray(storedCookies) ? storedCookies : [];

    if (cookies.length === 0) {
      return null;
    }

    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();

      // Set cookies
      for (const cookie of cookies) {
        try {
          await page.setCookie(cookie);
        } catch (e) {
          // Skip invalid cookies
        }
      }

      // Set up CDP to capture download response (VTT content)
      let downloadResponse: { content: string; url: string } | null = null;
      const client = await page.target().createCDPSession();
      await client.send('Network.enable');

      // Listen for response body
      client.on('Network.responseReceived', async (event: any) => {
        const url = event.response.url;
        if (url.includes('transcript') && url.includes('download')) {
          console.log(`[Worker] Download response received: ${url}, status: ${event.response.status}`);
          try {
            const body = await client.send('Network.getResponseBody', { requestId: event.requestId });
            if (body.body) {
              downloadResponse = { content: body.body, url };
              console.log(`[Worker] Captured response body, length: ${body.body.length}`);
            }
          } catch (e: any) {
            console.log(`[Worker] Could not get response body: ${e.message}`);
          }
        }
      });

      // Navigate to Recordings page
      await page.goto('https://zoom.us/recording', { waitUntil: 'networkidle2', timeout: 30000 });

      // Check if redirected to login
      if (page.url().includes('/signin') || page.url().includes('/login')) {
        await page.close();
        return null;
      }

      // Wait and click Transcripts tab
      await new Promise(r => setTimeout(r, 2000));
      await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('a, button, [role="tab"]'));
        for (const tab of tabs) {
          const text = (tab as HTMLElement).textContent || '';
          if (text.trim() === 'Transcripts') {
            (tab as HTMLElement).click();
            break;
          }
        }
      });

      // Wait for table to load
      await new Promise(r => setTimeout(r, 3000));

      // Click the Download button for the specified row
      const clickResult = await page.evaluate((rowIndex: number) => {
        const downloadButtons = Array.from(document.querySelectorAll('button[aria-label^="Download"]'));
        if (rowIndex >= downloadButtons.length) {
          return { success: false, error: `Index ${rowIndex} out of range (${downloadButtons.length} meetings)` };
        }
        const btn = downloadButtons[rowIndex] as HTMLElement;
        btn.click();
        return { success: true };
      }, index);

      if (!clickResult.success) {
        console.warn(`[Worker] ${clickResult.error}`);
        await page.close();
        return null;
      }

      // Wait for the download response to be captured
      await new Promise(r => setTimeout(r, 5000));

      await page.close();

      // If we captured a download response, parse it
      if (downloadResponse) {
        const captured = downloadResponse as { url: string; content: string };
        console.log(`[Worker] Processing captured response from: ${captured.url}`);

        const vttContent = captured.content;

        // Check if response is JSON (error) or VTT
        if (vttContent.startsWith('{')) {
          // It's JSON, likely an error or wrapped response
          try {
            const jsonResponse = JSON.parse(vttContent);

            if (jsonResponse.errorMessage) {
              console.error(`[Worker] Zoom API error: ${jsonResponse.errorMessage}`);
              return null;
            }

            // Check if VTT is in result field
            if (jsonResponse.result) {
              return this.parseVTT(jsonResponse.result);
            }
          } catch {
            // Not valid JSON, treat as VTT
          }
        }

        // It's VTT content
        if (vttContent.includes('WEBVTT') || vttContent.includes('-->')) {
          return this.parseVTT(vttContent);
        }

        console.log(`[Worker] Unexpected response format: ${vttContent.substring(0, 200)}`);
      }

      // Fallback: couldn't capture download
      console.warn('[Worker] Could not capture download response for meeting transcript');
      return null;

    } catch (error) {
      console.error(`[Worker] Meeting transcript extraction failed for index ${index}:`, error);
      return null;
    }
  }

  /**
   * Extract transcript from Zoom Clip share URL and return just the text
   * Uses the same proven virtual scrolling pattern as extractTranscript()
   * @private
   */
  private async extractTranscriptFromUrl(clipUrl: string): Promise<string | null> {
    const storedCookies = await this.state.storage.get<any>('zoom_cookies');
    const cookies = Array.isArray(storedCookies) ? storedCookies : [];

    if (cookies.length === 0 || !clipUrl) {
      return null;
    }

    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();

      // Set cookies
      for (const cookie of cookies) {
        try {
          await page.setCookie(cookie);
        } catch (e) {
          // Skip invalid cookies
        }
      }

      // Navigate to clip
      await page.goto(clipUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // Check if redirected to login
      if (page.url().includes('/signin') || page.url().includes('/login')) {
        await page.close();
        return null;
      }

      // Wait for page to fully render
      await new Promise(r => setTimeout(r, 3000));

      // Wait for video player or transcript button
      try {
        await page.waitForSelector('button[aria-label], .zoom-player, video', { timeout: 10000 });
      } catch {
        // Continue anyway
      }

      await new Promise(r => setTimeout(r, 2000));

      // Extract transcript using CANONICAL PATTERN (virtual scrolling)
      const result = await page.evaluate(async () => {
        const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

        // Click Transcript tab/button
        const transcriptBtn = document.querySelector('button[aria-label="View transcript"], button[aria-label="Transcript"]');
        if (transcriptBtn) {
          (transcriptBtn as HTMLElement).click();
          await wait(3000);
        } else {
          const tabElements = Array.from(document.querySelectorAll('button, a, div[role="tab"]'));
          for (const el of tabElements) {
            const text = (el as HTMLElement).textContent || '';
            if (text.toLowerCase().includes('transcript')) {
              (el as HTMLElement).click();
              await wait(3000);
              break;
            }
          }
        }

        // Find scrollable container
        let scrollContainer: Element | null = null;
        const transcriptList = document.querySelector('.transcript-list.zoom-scrollbar, .zm-vod-transcript-wrapper .zoom-scrollbar__wrap');
        if (transcriptList && transcriptList.scrollHeight > transcriptList.clientHeight) {
          scrollContainer = transcriptList;
        }

        if (!scrollContainer) {
          const scrollContainers = Array.from(document.querySelectorAll('.zoom-scrollbar__wrap'));
          let maxHeight = 0;
          for (const container of scrollContainers) {
            const scrollH = container.scrollHeight;
            const clientH = container.clientHeight;
            if (scrollH > clientH && scrollH > maxHeight) {
              maxHeight = scrollH;
              scrollContainer = container;
            }
          }
        }

        // Collect transcript items via virtual scrolling
        const collectedItems: { [key: string]: string } = {};

        if (scrollContainer) {
          // Pre-load by scrolling to bottom
          for (let i = 0; i < 5; i++) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
            scrollContainer.dispatchEvent(new Event('scroll'));
            await wait(500);
          }

          scrollContainer.scrollTop = 0;
          await wait(1000);

          // Scroll incrementally to collect all items
          const scrollStep = 500;
          let currentScroll = 0;

          while (currentScroll <= scrollContainer.scrollHeight) {
            const items = Array.from(document.querySelectorAll('.transcript-list-item, .mv-transcript-list-item'));
            for (const item of items) {
              const text = (item as HTMLElement).innerText?.trim();
              if (text) {
                const key = text.split('\n')[0];
                if (!collectedItems[key]) {
                  collectedItems[key] = text;
                }
              }
            }

            scrollContainer.scrollTop = currentScroll;
            scrollContainer.dispatchEvent(new Event('scroll'));
            await wait(300);
            currentScroll += scrollStep;
          }
        } else {
          // Fallback: static extraction
          const items = Array.from(document.querySelectorAll('.transcript-list-item, .mv-transcript-list-item, [class*="transcript-item"]'));
          for (const item of items) {
            const text = (item as HTMLElement).innerText?.trim();
            if (text && text.length > 3) {
              const key = text.split('\n')[0];
              collectedItems[key] = text;
            }
          }
        }

        // Sort by timestamp
        const sortedItems = Object.values(collectedItems).sort((a, b) => {
          const getSeconds = (text: string) => {
            const match = text.match(/^(\d{1,3}):(\d{2})/);
            if (!match) return 0;
            return parseInt(match[1]) * 60 + parseInt(match[2]);
          };
          return getSeconds(a) - getSeconds(b);
        });

        return sortedItems.join('\n\n');
      });

      await page.close();
      return result || null;

    } catch (error) {
      console.error(`[Worker] Transcript extraction failed for ${clipUrl}:`, error);
      return null;
    }
  }

  /**
   * POST /transcript - Extract transcript from Zoom Clip share URL
   *
   * CANONICAL PATTERN (proven in Railway implementation):
   * 1. Navigate to clip share URL
   * 2. Click Transcript tab
   * 3. Find scrollable container with virtual list
   * 4. Scroll to collect all transcript items
   * 5. Sort by timestamp, return text
   */
  private async extractTranscript(request: Request): Promise<Response> {
    // Validate cookies exist
    const storedCookies = await this.state.storage.get<any>('zoom_cookies');
    const cookies = Array.isArray(storedCookies) ? storedCookies : [];
    if (cookies.length === 0) {
      return Response.json({
        success: false,
        error: 'No cookies. Use Chrome extension to sync first.',
        needsAuth: true,
      }, { status: 401 });
    }

    // Parse request body
    let clipUrl: string;
    try {
      const body = await request.json() as { url?: string; clipUrl?: string };
      clipUrl = body.url || body.clipUrl || '';
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!clipUrl) {
      return Response.json({ error: 'Missing url or clipUrl in request body' }, { status: 400 });
    }

    // Validate URL format
    if (!clipUrl.includes('zoom.us') || !clipUrl.startsWith('https://')) {
      return Response.json({ error: 'Invalid Zoom URL format' }, { status: 400 });
    }

    // Launch browser and extract
    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();

      // Set cookies one by one (spread may fail with non-array)
      console.log(`Loading ${cookies.length} cookies...`);
      for (const cookie of cookies) {
        try {
          await page.setCookie(cookie);
        } catch (e) {
          // Skip invalid cookies
        }
      }

      // Navigate to clip URL
      console.log(`Navigating to: ${clipUrl}`);
      await page.goto(clipUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // Check if redirected to login
      const currentUrl = page.url();
      if (currentUrl.includes('/signin') || currentUrl.includes('/login')) {
        await page.close();
        return Response.json({
          success: false,
          error: 'Cookies expired. Please re-sync via Chrome extension.',
          needsAuth: true,
        }, { status: 401 });
      }

      // Wait for page to fully render (Vue components need time to mount)
      await new Promise(r => setTimeout(r, 3000));

      // Wait for video player or transcript button to appear
      try {
        await page.waitForSelector('button[aria-label], .zoom-player, video', { timeout: 10000 });
      } catch {
        // Continue anyway
      }

      // Additional wait for UI components
      await new Promise(r => setTimeout(r, 2000));

      // Extract transcript using canonical pattern
      const result = await page.evaluate(async () => {
        const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

        // Step 1: Click Transcript tab/button
        // Clips uses button with aria-label="View transcript" or "Transcript"
        const transcriptBtn = document.querySelector('button[aria-label="View transcript"], button[aria-label="Transcript"]');
        if (transcriptBtn) {
          (transcriptBtn as HTMLElement).click();
          await wait(3000);
        } else {
          // Fallback: text-based search (older pages)
          const tabElements = Array.from(document.querySelectorAll('button, a, div[role="tab"]'));
          for (const el of tabElements) {
            const text = (el as HTMLElement).textContent || '';
            if (text.toLowerCase().includes('transcript')) {
              (el as HTMLElement).click();
              await wait(3000);
              break;
            }
          }
        }

        // Step 2: Find scrollable container
        // Clips uses .transcript-list, older pages use .zoom-scrollbar__wrap
        let scrollContainer: Element | null = null;

        // First try Clips-specific transcript list container
        const transcriptList = document.querySelector('.transcript-list.zoom-scrollbar, .zm-vod-transcript-wrapper .zoom-scrollbar__wrap');
        if (transcriptList && transcriptList.scrollHeight > transcriptList.clientHeight) {
          scrollContainer = transcriptList;
        }

        // Fallback: find largest scrollable .zoom-scrollbar__wrap
        if (!scrollContainer) {
          const scrollContainers = Array.from(document.querySelectorAll('.zoom-scrollbar__wrap'));
          let maxHeight = 0;
          for (const container of scrollContainers) {
            const scrollH = container.scrollHeight;
            const clientH = container.clientHeight;
            if (scrollH > clientH && scrollH > maxHeight) {
              maxHeight = scrollH;
              scrollContainer = container;
            }
          }
        }

        // Step 3: Collect transcript items via virtual scrolling
        const collectedItems: { [key: string]: string } = {};

        if (scrollContainer) {
          // Pre-load by scrolling to bottom multiple times
          for (let i = 0; i < 5; i++) {
            scrollContainer.scrollTop = scrollContainer.scrollHeight;
            scrollContainer.dispatchEvent(new Event('scroll'));
            await wait(500);
          }

          // Scroll back to top
          scrollContainer.scrollTop = 0;
          await wait(1000);

          // Scroll incrementally to collect all items
          const scrollStep = 500;
          let currentScroll = 0;

          while (currentScroll <= scrollContainer.scrollHeight) {
            // Collect visible items (Clips uses .transcript-list-item, Meetings uses .mv-transcript-list-item)
            const items = Array.from(document.querySelectorAll('.transcript-list-item, .mv-transcript-list-item'));
            for (const item of items) {
              const text = (item as HTMLElement).innerText?.trim();
              if (text) {
                const key = text.split('\n')[0]; // Use timestamp as key
                if (!collectedItems[key]) {
                  collectedItems[key] = text;
                }
              }
            }

            // Scroll and trigger virtual list render
            scrollContainer.scrollTop = currentScroll;
            scrollContainer.dispatchEvent(new Event('scroll'));
            await wait(300);
            currentScroll += scrollStep;
          }
        } else {
          // Fallback: static extraction for short clips (no scroll container found)
          const items = Array.from(document.querySelectorAll('.transcript-list-item, .mv-transcript-list-item, [class*="transcript-item"]'));
          for (const item of items) {
            const text = (item as HTMLElement).innerText?.trim();
            if (text && text.length > 3) {
              const key = text.split('\n')[0];
              collectedItems[key] = text;
            }
          }
        }

        // Sort by timestamp (MM:SS format)
        const sortedItems = Object.values(collectedItems).sort((a, b) => {
          const getSeconds = (text: string) => {
            const match = text.match(/^(\d{1,3}):(\d{2})/);
            return match ? parseInt(match[1]) * 60 + parseInt(match[2]) : -1;
          };
          return getSeconds(a) - getSeconds(b);
        });

        // Extract metadata
        let heading = '';
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) heading = (ogTitle as HTMLMetaElement).content;
        if (!heading) {
          const h1 = document.querySelector('h1');
          if (h1) heading = h1.innerText;
        }

        // Extract speakers
        const transcriptText = sortedItems.join('\n\n');
        const speakers: string[] = [];
        const speakerRegex = /^([A-Za-z][A-Za-z\s]{1,30}):/gm;
        let match;
        while ((match = speakerRegex.exec(transcriptText)) !== null) {
          const speaker = match[1].trim();
          if (!speakers.includes(speaker)) {
            speakers.push(speaker);
          }
        }

        return {
          transcript: transcriptText,
          segmentCount: sortedItems.length,
          heading,
          speakers,
          method: scrollContainer ? 'virtual_scroll' : 'static',
        };
      });

      await page.close();
      this.lastActivity = Date.now();

      if (!result.transcript || result.segmentCount === 0) {
        return Response.json({
          success: false,
          error: 'No transcript found. The clip may not have a transcript.',
        }, { status: 404 });
      }

      return Response.json({
        success: true,
        transcript: result.transcript,
        segmentCount: result.segmentCount,
        heading: result.heading,
        speakers: result.speakers,
        extractionMethod: result.method,
        clipUrl,
      });

    } catch (error: any) {
      console.error('Transcript extraction error:', error);
      return Response.json({
        success: false,
        error: error.message || 'Extraction failed',
      }, { status: 500 });
    }
  }

  /**
   * GET /meetings - List AI Companion transcripts from Zoom
   *
   * Scrapes zoom.us/recording#/Transcript page to get meeting list.
   * Each meeting has a share_url that can be passed to /transcript endpoint.
   */
  private async listMeetings(): Promise<Response> {
    // Validate cookies exist
    const storedCookies = await this.state.storage.get<any>('zoom_cookies');
    const cookies = Array.isArray(storedCookies) ? storedCookies : [];
    if (cookies.length === 0) {
      return Response.json({
        success: false,
        error: 'No cookies. Use Chrome extension to sync first.',
        needsAuth: true,
      }, { status: 401 });
    }

    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();

      // Set cookies
      console.log(`Loading ${cookies.length} cookies for meetings list...`);
      for (const cookie of cookies) {
        try {
          await page.setCookie(cookie);
        } catch (e) {
          // Skip invalid cookies
        }
      }

      // Navigate to Recordings page first
      console.log('Navigating to Recordings page...');
      await page.goto('https://zoom.us/recording', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Check if redirected to login
      const currentUrl = page.url();
      if (currentUrl.includes('/signin') || currentUrl.includes('/login')) {
        await page.close();
        return Response.json({
          success: false,
          error: 'Cookies expired. Please re-sync via Chrome extension.',
          needsAuth: true,
        }, { status: 401 });
      }

      // Wait for page to load
      await new Promise(r => setTimeout(r, 2000));

      // Click the Transcripts tab
      console.log('Clicking Transcripts tab...');
      await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('a, button, [role="tab"]'));
        for (const tab of tabs) {
          const text = (tab as HTMLElement).textContent || '';
          if (text.trim() === 'Transcripts') {
            (tab as HTMLElement).click();
            break;
          }
        }
      });

      // Wait for table to load
      await new Promise(r => setTimeout(r, 3000));

      // Extract meeting list from the table
      // The Zoom Transcripts page uses a custom component structure, not standard HTML tables
      const meetings = await page.evaluate(() => {
        const results: any[] = [];
        const seen = new Set<string>();

        // Strategy: Find Download buttons which have aria-label="Download {topic}"
        // Then find parent row to extract other data
        const downloadButtons = Array.from(document.querySelectorAll('button[aria-label^="Download"]'));

        for (const btn of downloadButtons) {
          const ariaLabel = (btn as HTMLElement).getAttribute('aria-label') || '';
          // Extract topic from "Download MJ x DM"
          const topic = ariaLabel.replace(/^Download\s+/, '').trim();
          if (!topic || topic.length < 2) continue;

          // Walk up to find the row container
          let row = btn.parentElement;
          for (let i = 0; i < 10 && row; i++) {
            // Look for a row-like container (has multiple data points)
            const text = row.textContent || '';
            if (text.includes('@') && text.match(/\d{3}\s*\d{4}\s*\d{4}/)) {
              break;
            }
            row = row.parentElement;
          }

          if (!row) continue;
          const rowText = row.textContent || '';

          // Extract meeting ID (looks like "836 4027 9004")
          let meetingId = '';
          const idMatch = rowText.match(/(\d{3}\s+\d{4}\s+\d{4})/);
          if (idMatch) meetingId = idMatch[1];

          // Extract host email (must start with letter, capture up to TLD then strip trailing month names)
          let host = '';
          const emailMatch = rowText.match(/([a-zA-Z][a-zA-Z0-9._%+-]*@[a-zA-Z0-9.-]+\.(?:com|co|org|net|edu|io|us|uk|ca)[a-zA-Z]*)/i);
          if (emailMatch) {
            host = emailMatch[1];
            // Strip trailing month names that got concatenated (e.g., "coDec" -> "co")
            host = host.replace(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/i, '');
          }

          // Extract date/time (e.g., "Dec 8, 2025 05:58 PM")
          let dateTime = '';
          const dateMatch = rowText.match(/([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\s+[AP]M)/);
          if (dateMatch) dateTime = dateMatch[1];

          // Generate unique key
          const key = `${topic}-${meetingId}-${dateTime}`.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);

          // Look for any link in the row - could be on topic text or elsewhere
          let shareUrl: string | null = null;
          const links = Array.from(row.querySelectorAll('a[href]'));
          for (const link of links) {
            const href = (link as HTMLAnchorElement).href;
            const text = (link as HTMLElement).textContent?.trim() || '';
            // Skip action links like Download/Delete
            if (text === 'Download' || text === 'Delete') continue;
            // Recording detail links or any link with the topic name
            if (href.includes('detail') || href.includes('meeting_id') || href.includes('/rec/') || text === topic) {
              shareUrl = href;
              break;
            }
          }

          // If still no shareUrl, look for any clickable element with topic text
          if (!shareUrl) {
            const clickables = Array.from(row.querySelectorAll('a, button, [role="link"], [onclick]'));
            for (const el of clickables) {
              const text = (el as HTMLElement).textContent?.trim() || '';
              const href = (el as HTMLAnchorElement).href;
              if (text === topic && href && !href.includes('javascript:')) {
                shareUrl = href;
                break;
              }
            }
          }

          // Store row index for potential click-through navigation
          const rowIndex = results.length;

          results.push({
            topic,
            meetingId,
            host,
            dateTime,
            shareUrl,
            rowIndex,
          });
        }

        return { meetings: results };
      });

      await page.close();
      this.lastActivity = Date.now();

      return Response.json({
        success: true,
        meetings: meetings.meetings,
        count: meetings.meetings.length,
      });

    } catch (error: any) {
      console.error('List meetings error:', error);
      return Response.json({
        success: false,
        error: error.message || 'Failed to list meetings',
      }, { status: 500 });
    }
  }

  /**
   * GET /clips?days=N - List Zoom Clips from the user's clips library
   *
   * Scrapes zoom.us/clips page to get clip list with share URLs.
   * Each clip's share_url can be passed to /transcript endpoint for extraction.
   */
  private async listClips(days: number = 7): Promise<Response> {
    // Validate cookies exist
    const storedCookies = await this.state.storage.get<any>('zoom_cookies');
    const cookies = Array.isArray(storedCookies) ? storedCookies : [];
    if (cookies.length === 0) {
      return Response.json({
        success: false,
        error: 'No cookies. Use Chrome extension to sync first.',
        needsAuth: true,
      }, { status: 401 });
    }

    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });

      // Set cookies
      console.log(`Loading ${cookies.length} cookies for clips list...`);
      for (const cookie of cookies) {
        try {
          await page.setCookie({
            ...cookie,
            domain: cookie.domain || '.zoom.us',
            path: cookie.path || '/',
            secure: cookie.secure ?? true,
            httpOnly: true,
          });
        } catch (e) {
          // Skip invalid cookies
        }
      }

      // Navigate to clips library page directly
      console.log('Navigating to Clips library page...');
      await page.goto('https://zoom.us/clips/library', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Check if redirected to login
      const currentUrl = page.url();
      if (currentUrl.includes('/signin') || currentUrl.includes('/login')) {
        await page.close();
        return Response.json({
          success: false,
          error: 'Cookies expired. Please re-sync via Chrome extension.',
          needsAuth: true,
        }, { status: 401 });
      }

      // Wait for clips to load
      await page.waitForSelector('[class*="clip"], .clip-item, .clip-card', { timeout: 10000 }).catch(() => {});

      // Additional wait for UI to fully render
      await new Promise(r => setTimeout(r, 2000));

      // Calculate date filter
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      // Extract clips from the page
      // Structure: <a class="clips-grid-item-wrap" href="/clips/share/...">
      //              <div class="clips-grid-item">
      //                <div class="clips-grid-item-title">Title</div>
      //              </div>
      //            </a>
      const clips = await page.evaluate((fromDateStr: string) => {
        const fromDate = new Date(fromDateStr);
        const now = new Date();

        const inferYearForMonthDay = (monthDayText: string): Date | null => {
          // monthDayText: "Nov 9" (no year). Infer year relative to now to avoid
          // assigning future dates (common around year boundaries).
          const currentYear = now.getFullYear();
          let d = new Date(`${monthDayText}, ${currentYear}`);
          if (isNaN(d.getTime())) return null;
          // If inferred date is in the future by more than 24h, it's probably last year.
          if (d.getTime() - now.getTime() > 24 * 60 * 60 * 1000) {
            d.setFullYear(currentYear - 1);
          }
          return d;
        };

        const results: Array<{
          id: string;
          title: string;
          created_at: string;
          duration: number;
          share_url: string;
          thumbnail_url?: string;
        }> = [];

        // Find all clip wrap items - these ARE the <a> tags with the share URLs
        const clipWraps = document.querySelectorAll('a.clips-grid-item-wrap');

        clipWraps.forEach((el) => {
          const linkEl = el as HTMLAnchorElement;
          const shareUrl = linkEl.href;

          // Extract clip ID from share URL: /clips/share/DvX9KdPiT3eMcyTTb5J0-w
          const idMatch = shareUrl.match(/\/clips\/share\/([^/?]+)/);
          const id = idMatch?.[1] || '';

          if (!id) return;

          const allText = el.textContent || '';

          // Extract title from the grid item's title element inside the wrapper
          let title =
            el.querySelector('.clips-grid-item-title')?.textContent?.trim() ||
            el.textContent?.trim()?.split('\n')[0] ||
            'Untitled Clip';

          // Clean up title - remove duration/stats text if concatenated
          title = title.replace(/\d+\s*plays?/i, '').replace(/duration:?\s*\d+\s*min/i, '').trim();

          // Try to extract date - look for patterns like "4 days ago", "Dec 26", etc.
          let createdAt = new Date().toISOString();
          const daysAgoMatch = allText.match(/(\d+)\s*days?\s*ago/i);
          const hoursAgoMatch = allText.match(/(\d+)\s*hours?\s*ago/i);
          // Prefer explicit UI date, e.g. <span class="start-time-str">Nov 9, 2025</span>
          const startTimeText = (el.querySelector('.start-time-str')?.textContent || '').trim();

          if (daysAgoMatch) {
            const daysAgo = parseInt(daysAgoMatch[1]);
            const date = new Date();
            date.setDate(date.getDate() - daysAgo);
            createdAt = date.toISOString();
          } else if (hoursAgoMatch) {
            const hoursAgo = parseInt(hoursAgoMatch[1]);
            const date = new Date();
            date.setHours(date.getHours() - hoursAgo);
            createdAt = date.toISOString();
          } else if (startTimeText) {
            // Handles both "Nov 9, 2025" and "Nov 9"
            const hasYear = /\b\d{4}\b/.test(startTimeText);
            const parsed = hasYear ? new Date(startTimeText) : inferYearForMonthDay(startTimeText);
            if (parsed && !isNaN(parsed.getTime())) {
              createdAt = parsed.toISOString();
            }
          } else {
            // Fallback: try to parse from allText (sometimes concatenated)
            // Match "Nov 9, 2025" OR "Nov 9"
            const dateMatch = allText.match(
              /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:,\s+\d{4})?\b/i
            );
            if (dateMatch) {
              const text = dateMatch[0];
              const hasYear = /\b\d{4}\b/.test(text);
              const parsed = hasYear ? new Date(text) : inferYearForMonthDay(text);
              if (parsed && !isNaN(parsed.getTime())) {
                createdAt = parsed.toISOString();
              }
            }
          }

          // Optional filter: if we can parse createdAt and it's older than fromDate, skip.
          // This keeps the /clips?days=N semantic more accurate when Zoom displays older clips.
          try {
            const created = new Date(createdAt);
            if (!isNaN(created.getTime()) && created.getTime() < fromDate.getTime()) {
              return;
            }
          } catch {}

          // Extract duration (format: "1 min", "2:30", etc.)
          let duration = 0;
          const durMatch = allText.match(/duration:?\s*(\d+)\s*min/i) ||
                          allText.match(/(\d+)\s*min\.?/i) ||
                          allText.match(/(\d+):(\d+)/);
          if (durMatch) {
            if (durMatch[2]) {
              // Format: "2:30"
              duration = parseInt(durMatch[1]) * 60 + parseInt(durMatch[2]);
            } else {
              // Format: "1 min"
              duration = parseInt(durMatch[1]) * 60;
            }
          }

          // Extract thumbnail
          const thumbnail = el.querySelector('img') as HTMLImageElement | null;
          const thumbnailUrl = thumbnail?.src || undefined;

          results.push({
            id,
            title,
            created_at: createdAt,
            duration,
            share_url: shareUrl,
            thumbnail_url: thumbnailUrl,
          });
        });

        return results;
      }, fromDate.toISOString());

      await page.close();
      this.lastActivity = Date.now();

      return Response.json({
        success: true,
        clips,
        count: clips.length,
        daysSearched: days,
      });

    } catch (error: any) {
      console.error('List clips error:', error);
      return Response.json({
        success: false,
        error: error.message || 'Failed to list clips',
      }, { status: 500 });
    }
  }

  /**
   * GET /clips-debug - Debug the clips page structure
   *
   * Returns information about what elements exist on the page to help
   * diagnose why clips aren't being found.
   */
  private async debugClipsPage(): Promise<Response> {
    const storedCookies = await this.state.storage.get<any>('zoom_cookies');
    const cookies = Array.isArray(storedCookies) ? storedCookies : [];
    if (cookies.length === 0) {
      return Response.json({
        success: false,
        error: 'No cookies. Use Chrome extension to sync first.',
        needsAuth: true,
      }, { status: 401 });
    }

    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });

      // Set cookies
      for (const cookie of cookies) {
        try {
          await page.setCookie({
            ...cookie,
            domain: cookie.domain || '.zoom.us',
            path: cookie.path || '/',
            secure: cookie.secure ?? true,
            httpOnly: true,
          });
        } catch (e) {
          // Skip invalid cookies
        }
      }

      // Navigate to clips library page
      await page.goto('https://zoom.us/clips/library', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      const currentUrl = page.url();
      if (currentUrl.includes('/signin') || currentUrl.includes('/login')) {
        await page.close();
        return Response.json({
          success: false,
          error: 'Cookies expired. Please re-sync via Chrome extension.',
          needsAuth: true,
        }, { status: 401 });
      }

      // Wait for page to render
      await new Promise(r => setTimeout(r, 3000));

      // Collect debug info
      const debugInfo = await page.evaluate(() => {
        // Get page title and URL
        const pageTitle = document.title;
        const bodyText = document.body?.innerText?.substring(0, 500) || '';

        // Check various potential selectors
        const selectorTests: Record<string, number> = {
          '[data-clip-id]': document.querySelectorAll('[data-clip-id]').length,
          '.clip-item': document.querySelectorAll('.clip-item').length,
          '.clip-card': document.querySelectorAll('.clip-card').length,
          '.clips-grid-item-wrap': document.querySelectorAll('.clips-grid-item-wrap').length,
          '.clips-grid-item': document.querySelectorAll('.clips-grid-item').length,
          '.clips-grid-item-title': document.querySelectorAll('.clips-grid-item-title').length,
          '[class*="clip-list"]': document.querySelectorAll('[class*="clip-list"]').length,
          '[role="listitem"]': document.querySelectorAll('[role="listitem"]').length,
          '[class*="clip"]': document.querySelectorAll('[class*="clip"]').length,
          '[class*="Clip"]': document.querySelectorAll('[class*="Clip"]').length,
          '[class*="video"]': document.querySelectorAll('[class*="video"]').length,
          '[class*="Video"]': document.querySelectorAll('[class*="Video"]').length,
          '[class*="recording"]': document.querySelectorAll('[class*="recording"]').length,
          '[class*="Recording"]': document.querySelectorAll('[class*="Recording"]').length,
          'table': document.querySelectorAll('table').length,
          'tr': document.querySelectorAll('tr').length,
          '[role="row"]': document.querySelectorAll('[role="row"]').length,
          '[role="grid"]': document.querySelectorAll('[role="grid"]').length,
          '[role="gridcell"]': document.querySelectorAll('[role="gridcell"]').length,
          'a[href*="/clips/"]': document.querySelectorAll('a[href*="/clips/"]').length,
          'a[href*="/clips/share/"]': document.querySelectorAll('a[href*="/clips/share/"]').length,
          'a[href*="/clip/"]': document.querySelectorAll('a[href*="/clip/"]').length,
          'img': document.querySelectorAll('img').length,
          'video': document.querySelectorAll('video').length,
        };

        // Get all unique class names on the page
        const allClasses = new Set<string>();
        document.querySelectorAll('*').forEach(el => {
          el.classList.forEach(c => {
            if (c.toLowerCase().includes('clip') ||
                c.toLowerCase().includes('video') ||
                c.toLowerCase().includes('list') ||
                c.toLowerCase().includes('item') ||
                c.toLowerCase().includes('card') ||
                c.toLowerCase().includes('row') ||
                c.toLowerCase().includes('grid')) {
              allClasses.add(c);
            }
          });
        });

        // Get all links on the page
        const links = Array.from(document.querySelectorAll('a[href]'))
          .map(a => (a as HTMLAnchorElement).href)
          .filter(h => h.includes('clip'))
          .slice(0, 20);

        // Examine each .clips-grid-item-wrap to understand structure
        const clipWrapDetails: Array<{
          hasShareLink: boolean;
          shareUrl: string | null;
          hasGridItem: boolean;
          titleText: string | null;
          allLinksInside: string[];
          outerHTML: string;
        }> = [];

        document.querySelectorAll('.clips-grid-item-wrap').forEach((el, i) => {
          if (i >= 3) return; // Just first 3 for debug

          const shareLink = el.querySelector('a[href*="/clips/share/"]') as HTMLAnchorElement | null;
          const gridItem = el.querySelector('.clips-grid-item');
          const titleEl = el.querySelector('.clips-grid-item-title');
          const allLinks = Array.from(el.querySelectorAll('a[href]')).map(a => (a as HTMLAnchorElement).href);

          clipWrapDetails.push({
            hasShareLink: !!shareLink,
            shareUrl: shareLink?.href || null,
            hasGridItem: !!gridItem,
            titleText: titleEl?.textContent?.trim() || null,
            allLinksInside: allLinks,
            outerHTML: el.outerHTML.substring(0, 800),
          });
        });

        // Check if share links are siblings - trace up to find the context
        const shareLinkContext: Array<{
          href: string;
          parentHierarchy: string[];
        }> = [];
        document.querySelectorAll('a[href*="/clips/share/"]').forEach((link, i) => {
          if (i >= 2) return;
          const alink = link as HTMLAnchorElement;
          const hierarchy: string[] = [];
          let el = link.parentElement;
          for (let j = 0; j < 6 && el; j++) {
            hierarchy.push(`${el.tagName}.${el.className.split(' ').slice(0, 2).join('.')}`);
            el = el.parentElement;
          }
          shareLinkContext.push({
            href: alink.href,
            parentHierarchy: hierarchy,
          });
        });

        return {
          pageTitle,
          bodyTextPreview: bodyText,
          selectorTests,
          relevantClasses: Array.from(allClasses).slice(0, 50),
          clipLinks: links,
          clipWrapDetails,
          shareLinkContext,
        };
      });

      await page.close();

      return Response.json({
        success: true,
        url: currentUrl,
        debug: debugInfo,
      });

    } catch (error: any) {
      console.error('Debug clips error:', error);
      return Response.json({
        success: false,
        error: error.message || 'Debug failed',
      }, { status: 500 });
    }
  }

  /**
   * POST /sync - Trigger a full sync of clips and meetings
   *
   * Fetches clips and meetings, logs the execution, and returns results.
   * This endpoint is called by the WORKWAY platform to trigger syncs.
   *
   * @param days - Number of days to look back for clips/meetings
   * @param writeToNotion - If true, triggers Notion workflow after fetching data
   */
  private async runSync(days: number = 7, writeToNotion: boolean = false): Promise<Response> {
    const startTime = Date.now();

    // Validate cookies exist
    const storedCookies = await this.state.storage.get<any>('zoom_cookies');
    const cookies = Array.isArray(storedCookies) ? storedCookies : [];
    if (cookies.length === 0) {
      return Response.json({
        success: false,
        error: 'No cookies. Use Chrome extension to sync first.',
        needsAuth: true,
      }, { status: 401 });
    }

    try {
      // Fetch clips
      console.log(`[Sync] Fetching clips for last ${days} days...`);
      const clipsResponse = await this.listClips(days);
      const clipsData = await clipsResponse.json() as { success: boolean; clips?: any[]; error?: string };

      if (!clipsData.success) {
        return Response.json({
          success: false,
          error: `Failed to fetch clips: ${clipsData.error}`,
        }, { status: 500 });
      }

      // Fetch meetings
      console.log('[Sync] Fetching meetings...');
      const meetingsResponse = await this.listMeetings();
      const meetingsData = await meetingsResponse.json() as { success: boolean; meetings?: any[]; error?: string };

      if (!meetingsData.success) {
        return Response.json({
          success: false,
          error: `Failed to fetch meetings: ${meetingsData.error}`,
        }, { status: 500 });
      }

      const duration = Date.now() - startTime;

      // Log execution for dashboard stats (fetch phase)
      const executions = await this.state.storage.get<Array<{
        started_at: string;
        completed_at?: string;
        success: boolean;
        clips_count?: number;
        meetings_count?: number;
        notion_job_id?: string;
        notion_status?: 'queued' | 'running' | 'completed' | 'failed';
        notion_written?: number;
        notion_failed?: number;
      }>>('executions') || [];

      const executionRecord: {
        started_at: string;
        completed_at?: string;
        success: boolean;
        clips_count?: number;
        meetings_count?: number;
        notion_job_id?: string;
        notion_status?: 'queued' | 'running' | 'completed' | 'failed';
        notion_written?: number;
        notion_failed?: number;
      } = {
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        success: true,
        clips_count: clipsData.clips?.length || 0,
        meetings_count: meetingsData.meetings?.length || 0,
      };

      // NEW: Trigger Notion workflow asynchronously if requested
      // This avoids browser extension timeouts and makes sync resilient.
      let notionResult: null | { status: 'queued'; jobId: string } = null;
      if (writeToNotion) {
        const userId = await this.state.storage.get<string>('userId') || 'unknown';
        const jobId = crypto.randomUUID();
        notionResult = { status: 'queued', jobId };

        executionRecord.notion_job_id = jobId;
        executionRecord.notion_status = 'queued';

        await this.state.storage.put(`sync_job:${jobId}`, {
          jobId,
          userId,
          status: 'queued',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          clipsCount: (clipsData.clips || []).length,
          meetingsCount: (meetingsData.meetings || []).length,
          written: 0,
          failed: 0,
          error: null as string | null,
        });

        // Mark as running and execute in background
        this.state.waitUntil((async () => {
          await this.state.storage.put(`sync_job:${jobId}`, {
            jobId,
            userId,
            status: 'running',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            clipsCount: (clipsData.clips || []).length,
            meetingsCount: (meetingsData.meetings || []).length,
            written: 0,
            failed: 0,
            error: null as string | null,
          });

          try {
            const res = await this.triggerNotionWorkflow(userId, clipsData.clips || [], meetingsData.meetings || []);
            await this.state.storage.put(`sync_job:${jobId}`, {
              jobId,
              userId,
              status: res.failed > 0 && res.written === 0 ? 'failed' : 'completed',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              clipsCount: (clipsData.clips || []).length,
              meetingsCount: (meetingsData.meetings || []).length,
              written: res.written,
              failed: res.failed,
              error: null as string | null,
            });
          } catch (e: any) {
            await this.state.storage.put(`sync_job:${jobId}`, {
              jobId,
              userId,
              status: 'failed',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              clipsCount: (clipsData.clips || []).length,
              meetingsCount: (meetingsData.meetings || []).length,
              written: 0,
              failed: (clipsData.clips || []).length + (meetingsData.meetings || []).length,
              error: e?.message || 'Notion sync failed',
            });
          }
        })());
      }

      executions.unshift(executionRecord);

      // Keep only last 100 executions
      if (executions.length > 100) {
        executions.length = 100;
      }

      await this.state.storage.put('executions', executions);

      console.log(`[Sync] Complete: ${clipsData.clips?.length || 0} clips, ${meetingsData.meetings?.length || 0} meetings in ${duration}ms`);

      return Response.json({
        success: true,
        message: writeToNotion
          ? `Queued Notion sync for ${clipsData.clips?.length || 0} clips and ${meetingsData.meetings?.length || 0} meetings`
          : `Synced ${clipsData.clips?.length || 0} clips and ${meetingsData.meetings?.length || 0} meetings`,
        data: {
          clips: clipsData.clips || [],
          meetings: meetingsData.meetings || [],
          daysSearched: days,
          durationMs: duration,
          ...(notionResult && { notion: notionResult })
        },
      });

    } catch (error: any) {
      console.error('[Sync] Error:', error);

      // Log failed execution
      const executions = await this.state.storage.get<Array<any>>('executions') || [];
      executions.unshift({
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        success: false,
        error: error.message,
      });
      if (executions.length > 100) executions.length = 100;
      await this.state.storage.put('executions', executions);

      return Response.json({
        success: false,
        error: error.message || 'Sync failed',
      }, { status: 500 });
    }
  }

  private async getSyncStatus(jobId: string): Promise<Response> {
    const job = await this.state.storage.get<any>(`sync_job:${jobId}`);
    if (!job) {
      return Response.json({ success: false, error: 'Job not found' }, { status: 404 });
    }
    return Response.json({ success: true, job });
  }

  /**
   * Trigger Notion sync workflow with pre-fetched data
   * Called when writeToNotion=true query parameter is provided
   * @private
   */
  private async triggerNotionWorkflow(
    userId: string,
    clips: any[],
    meetings: any[]
  ): Promise<{ written: number; skipped: number; failed: number }> {
    try {
      const notionApiKey = this.env.NOTION_API_KEY;

      if (!notionApiKey) {
        console.error('[Worker] NOTION_API_KEY not set - cannot write to Notion');
        return { written: 0, skipped: 0, failed: clips.length + meetings.length };
      }

      // Half Dozen's central LLM database in Notion
      const HALFDOZEN_INTERNAL_LLM_DATABASE = '27a019187ac580b797fec563c98afbbc';

      let written = 0;
      let failed = 0;

      // Write clips to Notion (with transcript extraction)
      for (const clip of clips) {
        try {
          // Extract transcript for this clip
          let transcript = '(Transcript not available)';
          if (clip.share_url) {
            try {
              console.log(`[Worker] Extracting transcript for clip: ${clip.title}`);
              const transcriptResponse = await this.extractTranscriptFromUrl(clip.share_url);
              transcript = transcriptResponse || '(Transcript extraction failed)';
            } catch (error) {
              console.warn(`[Worker] Failed to extract transcript for clip ${clip.id}:`, error);
            }
          }

          await this.createNotionPage(notionApiKey, HALFDOZEN_INTERNAL_LLM_DATABASE, {
            title: clip.title || 'Untitled Clip',
            type: 'Clip',
            date: clip.created_at,
            url: clip.share_url,
            duration: clip.duration,
            content: transcript,
          });
          written++;
        } catch (error) {
          console.error('[Worker] Failed to write clip to Notion:', clip.id, error);
          failed++;
        }
      }

      // Write meetings to Notion (with transcript extraction)
      for (let i = 0; i < meetings.length; i++) {
        const meeting = meetings[i];
        try {
          // Convert meeting dateTime from "Jan 6, 2026 06:39 PM" to ISO 8601
          let meetingDate = null;
          if (meeting.dateTime) {
            try {
              meetingDate = new Date(meeting.dateTime).toISOString();
            } catch (e) {
              console.warn('[Worker] Failed to parse meeting date:', meeting.dateTime);
            }
          }

          // Extract transcript for this meeting using row index
          let transcript = '(Transcript not available)';
          try {
            console.log(`[Worker] Extracting transcript for meeting: ${meeting.topic}`);
            const transcriptText = await this.extractMeetingTranscriptByIndex(i);
            transcript = transcriptText || '(Transcript extraction failed)';
          } catch (error) {
            console.warn(`[Worker] Failed to extract transcript for meeting ${meeting.meetingId}:`, error);
          }

          await this.createNotionPage(notionApiKey, HALFDOZEN_INTERNAL_LLM_DATABASE, {
            title: meeting.topic || 'Untitled Meeting',
            type: 'Meeting',
            date: meetingDate,
            url: meeting.shareUrl || null,
            duration: null,
            content: transcript,
          });
          written++;
        } catch (error) {
          console.error('[Worker] Failed to write meeting to Notion:', meeting.meetingId, error);
          failed++;
        }
      }

      console.log(`[Worker] Notion sync complete: ${written} written, ${failed} failed`);

      return {
        written,
        skipped: 0,
        failed,
      };
    } catch (error: any) {
      console.error('[Worker] Error in Notion workflow:', error);
      return { written: 0, skipped: 0, failed: clips.length + meetings.length };
    }
  }

  /**
   * Create a Notion page in the LLM database
   * @private
   */
  private async createNotionPage(
    notionApiKey: string,
    databaseId: string,
    data: {
      title: string;
      type: string;
      date: string | null;
      url: string | null;
      duration: number | null;
      content: string;
    }
  ): Promise<void> {
    // Build page properties (matching Half Dozen LLM database schema)
    const properties: any = {
      Item: {
        title: [{
          text: { content: data.title },
        }],
      },
      Type: {
        select: { name: data.type },
      },
    };

    // Add Date if available
    if (data.date) {
      properties.Date = {
        date: { start: data.date },
      };
    }

    // Add Source URL if available
    if (data.url) {
      properties['Source URL'] = {
        url: data.url,
      };
    }

    // Build page content blocks
    const blocks: any[] = [];

    // Add transcript as paragraph blocks (split into 2000 char chunks)
    const contentChunks = this.splitTextIntoChunks(data.content, 2000);
    for (const chunk of contentChunks) {
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            type: 'text',
            text: { content: chunk },
          }],
        },
      });
    }

    // Create the page
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${notionApiKey}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties,
        children: blocks,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Worker] Notion API Error (${response.status}):`, errorText);
      console.error(`[Worker] Attempted to create page in database: ${databaseId}`);
      console.error(`[Worker] Page title: ${data.title}`);
      throw new Error(`Failed to create Notion page: ${response.status} ${errorText}`);
    }

    console.log(`[Worker] Created Notion page: ${data.title}`);
  }

  /**
   * Split text into chunks of specified size
   * @private
   */
  private splitTextIntoChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    let currentChunk = '';

    for (const char of text) {
      currentChunk += char;
      if (currentChunk.length >= chunkSize) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks.length > 0 ? chunks : [''];
  }

  /**
   * GET /meeting-transcript?index=N - Download VTT transcript for meeting at index N
   *
   * This navigates to the Transcripts list, clicks the Download button for the meeting
   * at the given index, intercepts the VTT file download, and returns the transcript text.
   */
  private async getMeetingTranscript(index: number): Promise<Response> {
    // Validate cookies
    const storedCookies = await this.state.storage.get<any>('zoom_cookies');
    const cookies = Array.isArray(storedCookies) ? storedCookies : [];
    if (cookies.length === 0) {
      return Response.json({
        success: false,
        error: 'No cookies. Use Chrome extension to sync first.',
        needsAuth: true,
      }, { status: 401 });
    }

    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();

      // Set cookies
      console.log(`Loading ${cookies.length} cookies...`);
      for (const cookie of cookies) {
        try {
          await page.setCookie(cookie);
        } catch (e) {
          // Skip invalid cookies
        }
      }

      // Set up to capture download response
      // The Download button triggers an XHR that returns the VTT content
      let downloadResponse: { content: string; url: string } | null = null;
      const client = await page.target().createCDPSession();
      await client.send('Network.enable');

      // Listen for response body
      client.on('Network.responseReceived', async (event: any) => {
        const url = event.response.url;
        if (url.includes('transcript') && url.includes('download')) {
          console.log(`Download response received: ${url}, status: ${event.response.status}`);
          try {
            const body = await client.send('Network.getResponseBody', { requestId: event.requestId });
            if (body.body) {
              downloadResponse = { content: body.body, url };
              console.log(`Captured response body, length: ${body.body.length}`);
            }
          } catch (e: any) {
            console.log(`Could not get response body: ${e.message}`);
          }
        }
      });

      // Navigate to Recordings page
      console.log('Navigating to Recordings page...');
      await page.goto('https://zoom.us/recording', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Check if redirected to login
      if (page.url().includes('/signin') || page.url().includes('/login')) {
        await page.close();
        return Response.json({
          success: false,
          error: 'Cookies expired. Please re-sync via Chrome extension.',
          needsAuth: true,
        }, { status: 401 });
      }

      // Wait and click Transcripts tab
      await new Promise(r => setTimeout(r, 2000));
      await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('a, button, [role="tab"]'));
        for (const tab of tabs) {
          if ((tab as HTMLElement).textContent?.trim() === 'Transcripts') {
            (tab as HTMLElement).click();
            break;
          }
        }
      });
      await new Promise(r => setTimeout(r, 3000));

      // Find the Download button at the given index and click it
      const clickResult = await page.evaluate((targetIndex: number) => {
        const downloadButtons = Array.from(document.querySelectorAll('button[aria-label^="Download"]'));
        if (targetIndex >= downloadButtons.length) {
          return { success: false, error: `Index ${targetIndex} out of range (${downloadButtons.length} meetings)` };
        }

        const btn = downloadButtons[targetIndex] as HTMLElement;
        const ariaLabel = btn.getAttribute('aria-label') || '';
        const topic = ariaLabel.replace(/^Download\s+/, '').trim();

        // Find the row to extract meeting info
        let row = btn.parentElement;
        for (let i = 0; i < 10 && row; i++) {
          const text = row.textContent || '';
          if (text.includes('@') && text.match(/\d{3}\s*\d{4}\s*\d{4}/)) break;
          row = row.parentElement;
        }

        let meetingId = '';
        let dateTime = '';
        if (row) {
          const rowText = row.textContent || '';
          const idMatch = rowText.match(/(\d{3}\s+\d{4}\s+\d{4})/);
          if (idMatch) meetingId = idMatch[1];
          const dateMatch = rowText.match(/([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}\s+\d{1,2}:\d{2}\s+[AP]M)/);
          if (dateMatch) dateTime = dateMatch[1];
        }

        // Click the Download button
        btn.click();

        return { success: true, topic, meetingId, dateTime };
      }, index);

      if (!clickResult.success) {
        await page.close();
        return Response.json({
          success: false,
          error: clickResult.error,
        }, { status: 400 });
      }

      console.log(`Clicked Download for: ${clickResult.topic}`);

      // Wait for the download response to be captured
      await new Promise(r => setTimeout(r, 5000));

      // If we captured a download response, parse it
      if (downloadResponse) {
        const captured = downloadResponse as { url: string; content: string };
        console.log(`Processing captured response from: ${captured.url}`);

        const vttContent = captured.content;

        // Check if response is JSON (error) or VTT
        if (vttContent.startsWith('{')) {
          // It's JSON, likely an error or wrapped response
          try {
            const jsonResponse = JSON.parse(vttContent);

            if (jsonResponse.errorMessage) {
              await page.close();
              return Response.json({
                success: false,
                error: jsonResponse.errorMessage,
                topic: clickResult.topic,
                errorCode: jsonResponse.errorCode,
              }, { status: 500 });
            }

            // Check if VTT is in result field
            if (jsonResponse.result) {
              await page.close();
              this.lastActivity = Date.now();

              const transcript = this.parseVTT(jsonResponse.result);

              return Response.json({
                success: true,
                topic: clickResult.topic,
                meetingId: clickResult.meetingId,
                dateTime: clickResult.dateTime,
                transcript,
                format: 'vtt',
                downloadUrl: captured.url,
              });
            }
          } catch {
            // Not valid JSON, treat as VTT
          }
        }

        // It's VTT content
        if (vttContent.includes('WEBVTT') || vttContent.includes('-->')) {
          await page.close();
          this.lastActivity = Date.now();

          const transcript = this.parseVTT(vttContent);

          return Response.json({
            success: true,
            topic: clickResult.topic,
            meetingId: clickResult.meetingId,
            dateTime: clickResult.dateTime,
            transcript,
            format: 'vtt',
            downloadUrl: captured.url,
          });
        }

        console.log(`Unexpected response format: ${vttContent.substring(0, 200)}`);
      }

      // Fallback: couldn't capture download
      await page.close();
      this.lastActivity = Date.now();

      return Response.json({
        success: false,
        error: 'Could not capture download response. The download may have triggered a file save dialog.',
        topic: clickResult.topic,
        downloadCaptured: !!downloadResponse,
      }, { status: 500 });

    } catch (error: any) {
      console.error('Meeting transcript error:', error);
      return Response.json({
        success: false,
        error: error.message || 'Failed to extract meeting transcript',
      }, { status: 500 });
    }
  }

  /**
   * Parse VTT content to structured transcript with timestamps
   *
   * Output format (for Notion):
   * ### 00:42
   * Ford: Hey, Danny, good morning.
   *
   * ### 00:44
   * Danny Morgan: What up?
   */
  private parseVTT(vttContent: string): string {
    const lines = vttContent.split('\n');
    const segments: Array<{ timestamp: string; speaker: string; text: string }> = [];
    let currentTimestamp = '';
    let currentSpeaker = '';
    let currentText = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip WEBVTT header and NOTE lines
      if (!line || line === 'WEBVTT' || line.startsWith('NOTE')) {
        continue;
      }

      // Capture timestamp from "00:00:42.000 --> 00:00:44.000" format
      const timestampMatch = line.match(/^(\d{2}):(\d{2}):(\d{2})\.\d{3}\s+-->/);
      if (timestampMatch) {
        // Save previous segment if exists
        if (currentTimestamp && (currentSpeaker || currentText)) {
          segments.push({
            timestamp: currentTimestamp,
            speaker: currentSpeaker,
            text: currentText,
          });
        }

        // Convert HH:MM:SS to MM:SS (skip hours if 00)
        const hours = parseInt(timestampMatch[1]);
        const mins = parseInt(timestampMatch[2]);
        const secs = timestampMatch[3];

        if (hours > 0) {
          currentTimestamp = `${hours}:${mins.toString().padStart(2, '0')}:${secs}`;
        } else {
          currentTimestamp = `${mins}:${secs}`;
        }

        currentSpeaker = '';
        currentText = '';
        continue;
      }

      // Skip standalone timestamp lines (without -->)
      if (line.match(/^\d{2}:\d{2}:\d{2}/)) {
        continue;
      }

      // Check for speaker prefix (e.g., "Danny Morgan: text")
      const speakerMatch = line.match(/^([A-Za-z][A-Za-z\s]+):\s*(.*)/);
      if (speakerMatch) {
        currentSpeaker = speakerMatch[1].trim();
        currentText = speakerMatch[2].trim();
      } else if (line.length > 1) {
        // Continuation of text without speaker prefix
        if (currentText) {
          currentText += ' ' + line;
        } else {
          currentText = line;
        }
      }
    }

    // Don't forget the last segment
    if (currentTimestamp && (currentSpeaker || currentText)) {
      segments.push({
        timestamp: currentTimestamp,
        speaker: currentSpeaker,
        text: currentText,
      });
    }

    // Format output with timestamp headers
    const outputLines: string[] = [];
    for (const segment of segments) {
      outputLines.push(`### ${segment.timestamp}`);
      if (segment.speaker) {
        outputLines.push(`${segment.speaker}: ${segment.text}`);
      } else if (segment.text) {
        outputLines.push(segment.text);
      }
      outputLines.push(''); // Blank line between segments
    }

    return outputLines.join('\n').trim();
  }

  /**
   * Durable Object Alarm Handler - Session maintenance runs automatically
   */
  async alarm(): Promise<void> {
    const sessionActive = await this.state.storage.get<boolean>('session_active');
    if (!sessionActive) return;

    const cookies = await this.state.storage.get<any[]>('zoom_cookies');
    if (!cookies || cookies.length === 0) {
      await this.state.storage.put('session_active', false);
      return;
    }

    try {
      const result = await this.doRefreshSession(cookies);

      if (result.success) {
        if (result.newCookies && result.newCookies.length > 0) {
          await this.state.storage.put('zoom_cookies', result.newCookies);
          await this.state.storage.put('cookies_uploaded_at', Date.now());
        }
        await this.state.storage.setAlarm(Date.now() + KEEP_ALIVE_INTERVAL_MS);
      } else {
        // Session expired - user needs to re-sync
        await this.state.storage.put('session_active', false);
        await this.state.storage.put('session_expired_at', Date.now());
      }
    } catch (error: any) {
      // Transient error - retry next hour
      console.error('Session refresh error:', error.message);
      await this.state.storage.setAlarm(Date.now() + KEEP_ALIVE_INTERVAL_MS);
    }
  }

  /**
   * Internal: Visit Zoom to refresh session and capture updated cookies
   */
  private async doRefreshSession(cookies: any[]): Promise<{
    success: boolean;
    error?: string;
    newCookies?: any[];
  }> {
    let page: any = null;

    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();

      for (const cookie of cookies) {
        try { await page.setCookie(cookie); } catch {}
      }

      await page.goto('https://zoom.us/profile', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      const currentUrl = page.url();
      if (currentUrl.includes('/signin') || currentUrl.includes('/login')) {
        await page.close();
        return { success: false, error: 'Session expired' };
      }

      const updatedCookies = await page.cookies();
      const zoomCookies = updatedCookies.filter((c: any) =>
        c.domain?.includes('zoom.us') || c.domain?.includes('.zoom.us')
      );

      await page.close();
      return {
        success: true,
        newCookies: zoomCookies.length > 0 ? zoomCookies : cookies,
      };
    } catch (error: any) {
      if (page) { try { await page.close(); } catch {} }
      return { success: false, error: error.message || 'Refresh failed' };
    }
  }

  /**
   * Get or create browser instance
   */
  private async getBrowser(): Promise<Browser> {
    if (this.browser) {
      try {
        // Check if browser is still connected
        const pages = await this.browser.pages();
        if (pages.length >= 0) {
          return this.browser;
        }
      } catch {
        this.browser = null;
      }
    }

    console.log('Launching new browser...');
    this.browser = await puppeteer.launch(this.env.BROWSER);
    return this.browser;
  }
}
