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
}

// CORS helper
function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const isZoomOrigin = origin.includes('zoom.us');
  const isWorkwayOrigin = origin.includes('workway.co') || origin.includes('localhost');

  return {
    'Access-Control-Allow-Origin': isZoomOrigin ? origin : isWorkwayOrigin ? origin : 'https://workway.co',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

// Session expiry constant (24 hours)
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;
const SESSION_EXPIRY_HOURS = 24;

// Keep-alive interval (1 hour) - visits Zoom to refresh session cookies
const KEEP_ALIVE_INTERVAL_MS = 60 * 60 * 1000;

// Setup info endpoint (JSON API, not HTML - per canon)
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

    // Route: GET / - API info
    if (path === '/' && request.method === 'GET') {
      return Response.json({
        service: 'zoom-clips',
        description: 'Zoom transcript extraction via browser automation',
        endpoints: {
          'GET /setup/:userId': 'Setup info (JSON) with extension instructions',
          'GET /health/:userId': 'Check session health and cookie status',
          'GET /dashboard-data/:userId': 'Dashboard data for workway.co/workflows',
          'POST /upload-cookies/:userId': 'Upload Zoom cookies (from extension)',
          'POST /keep-alive/:userId': 'Manually trigger session refresh (visits Zoom)',
          'GET /meetings/:userId': 'List AI Companion transcripts from Zoom Recordings',
          'GET /meeting-transcript/:userId?index=N': 'Extract transcript from meeting at index N',
          'POST /transcript/:userId': 'Extract transcript from a Zoom share URL (clips)',
        },
        sessionKeepAlive: {
          interval: '1 hour',
          mechanism: 'Durable Object alarm visits Zoom profile to refresh session cookies',
        },
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

    return session.fetch(
      new Request(doUrl.toString(), {
        method: request.method,
        headers,
        body: request.body,
      })
    );
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
      // Route handlers
      if (path === '/setup' && request.method === 'GET') {
        const userId = request.headers.get('X-User-Id') || 'unknown';
        return getSetupInfo(userId);
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

      if (path === '/keep-alive' && request.method === 'POST') {
        return this.refreshSession();
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
      console.log(`Keep-alive alarm set for ${new Date(nextAlarm).toISOString()}`);

      return Response.json({
        success: true,
        message: `Stored ${zoomCookies.length} Zoom cookies`,
        expiresAt: new Date(Date.now() + SESSION_EXPIRY_MS).toISOString(),
        nextKeepAlive: new Date(nextAlarm).toISOString(),
      });
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
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
        console.log(`Processing captured response from: ${downloadResponse.url}`);

        const vttContent = downloadResponse.content;

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
                downloadUrl: downloadResponse.url,
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
            downloadUrl: downloadResponse.url,
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
   * Parse VTT content to plain text transcript
   */
  private parseVTT(vttContent: string): string {
    const lines = vttContent.split('\n');
    const textLines: string[] = [];
    let currentSpeaker = '';

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip WEBVTT header, timestamps, and empty lines
      if (!trimmed ||
          trimmed === 'WEBVTT' ||
          trimmed.match(/^\d{2}:\d{2}:\d{2}/) ||
          trimmed.match(/^NOTE/) ||
          trimmed.match(/-->/)
      ) {
        continue;
      }

      // Check for speaker prefix (e.g., "Danny Morgan:")
      const speakerMatch = trimmed.match(/^([A-Za-z][A-Za-z\s]+):\s*(.*)/);
      if (speakerMatch) {
        const speaker = speakerMatch[1].trim();
        const text = speakerMatch[2].trim();
        if (speaker !== currentSpeaker) {
          currentSpeaker = speaker;
          if (text) {
            textLines.push(`${speaker}: ${text}`);
          } else {
            textLines.push(`${speaker}:`);
          }
        } else if (text) {
          textLines.push(text);
        }
      } else if (trimmed.length > 1) {
        textLines.push(trimmed);
      }
    }

    return textLines.join('\n');
  }

  /**
   * Durable Object Alarm Handler
   * Called every hour to refresh the Zoom session by visiting a Zoom page
   */
  async alarm(): Promise<void> {
    console.log('Keep-alive alarm triggered');

    const sessionActive = await this.state.storage.get<boolean>('session_active');
    if (!sessionActive) {
      console.log('Session not active, skipping keep-alive');
      return;
    }

    const cookies = await this.state.storage.get<any[]>('zoom_cookies');
    if (!cookies || cookies.length === 0) {
      console.log('No cookies stored, skipping keep-alive');
      await this.state.storage.put('session_active', false);
      return;
    }

    try {
      // Refresh the session
      const result = await this.doRefreshSession(cookies);

      if (result.success) {
        // Update cookies if we got new ones
        if (result.newCookies && result.newCookies.length > 0) {
          await this.state.storage.put('zoom_cookies', result.newCookies);
          await this.state.storage.put('cookies_uploaded_at', Date.now());
          console.log(`Session refreshed, updated ${result.newCookies.length} cookies`);
        } else {
          console.log('Session refreshed, cookies still valid');
        }

        // Schedule next alarm
        const nextAlarm = Date.now() + KEEP_ALIVE_INTERVAL_MS;
        await this.state.storage.setAlarm(nextAlarm);
        console.log(`Next keep-alive scheduled for ${new Date(nextAlarm).toISOString()}`);
      } else {
        console.log(`Session refresh failed: ${result.error}`);
        // Mark session as inactive - user needs to re-sync
        await this.state.storage.put('session_active', false);
        await this.state.storage.put('session_expired_at', Date.now());
      }
    } catch (error: any) {
      console.error('Keep-alive alarm error:', error);
      // Don't mark inactive on transient errors - try again next hour
      const nextAlarm = Date.now() + KEEP_ALIVE_INTERVAL_MS;
      await this.state.storage.setAlarm(nextAlarm);
    }
  }

  /**
   * POST /keep-alive - Manually trigger session refresh
   */
  private async refreshSession(): Promise<Response> {
    const cookies = await this.state.storage.get<any[]>('zoom_cookies');
    if (!cookies || cookies.length === 0) {
      return Response.json({
        success: false,
        error: 'No cookies stored',
        needsAuth: true,
      }, { status: 401 });
    }

    const result = await this.doRefreshSession(cookies);

    if (result.success && result.newCookies) {
      await this.state.storage.put('zoom_cookies', result.newCookies);
      await this.state.storage.put('cookies_uploaded_at', Date.now());
      await this.state.storage.put('session_active', true);

      // Reset the alarm
      const nextAlarm = Date.now() + KEEP_ALIVE_INTERVAL_MS;
      await this.state.storage.setAlarm(nextAlarm);
    }

    return Response.json(result);
  }

  /**
   * Internal: Visit Zoom to refresh session and capture updated cookies
   */
  private async doRefreshSession(cookies: any[]): Promise<{
    success: boolean;
    error?: string;
    newCookies?: any[];
  }> {
    let browser: Browser | null = null;
    let page: any = null;

    try {
      browser = await this.getBrowser();
      page = await browser.newPage();

      // Set existing cookies
      for (const cookie of cookies) {
        try {
          await page.setCookie(cookie);
        } catch {
          // Skip invalid cookies
        }
      }

      // Visit Zoom homepage to refresh session
      console.log('Visiting zoom.us to refresh session...');
      await page.goto('https://zoom.us/profile', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Check if we're still logged in
      const currentUrl = page.url();
      if (currentUrl.includes('/signin') || currentUrl.includes('/login')) {
        await page.close();
        return {
          success: false,
          error: 'Session expired - redirected to login',
        };
      }

      // Get updated cookies from the page
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
      if (page) {
        try { await page.close(); } catch {}
      }
      return {
        success: false,
        error: error.message || 'Failed to refresh session',
      };
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
