/**
 * Zoom Cookie Sync Worker
 *
 * Per-user Durable Objects storage for Zoom cookies used by Private Workflow.
 * Enables bookmarklet-based authentication without Zoom OAuth app approval.
 *
 * ## Philosophy
 *
 * "The tool should recede; the outcome should remain."
 * - Users think: "My meetings sync to Notion"
 * - Not: "I manage cookies and sessions"
 *
 * ## Endpoints
 *
 *   GET  /                       - Health check
 *   GET  /setup/:userId          - Personalized bookmarklet page
 *   POST /upload-cookies/:userId - Cookie upload from bookmarklet
 *   GET  /health/:userId         - Check user's cookie status
 *   GET  /scrape-meetings/:userId?days=N - List meetings
 *   POST /scrape-transcript/:userId      - Extract transcript
 *
 * @example Bookmarklet flow:
 * 1. User visits /setup/:userId
 * 2. Drags personalized bookmarklet to browser
 * 3. On Zoom, clicks bookmark -> cookies uploaded
 * 4. Private Workflow can now scrape meetings
 */

import puppeteer, { Browser, Page } from '@cloudflare/puppeteer';

// ============================================================================
// TYPES
// ============================================================================

interface Env {
	BROWSER: Fetcher;
	USER_SESSIONS: DurableObjectNamespace;
	UPLOAD_SECRET: string;
	API_SECRET?: string;
	WORKER_URL: string;
}

interface Cookie {
	name: string;
	value: string;
	domain?: string;
	path?: string;
	secure?: boolean;
	httpOnly?: boolean;
}

interface StoredCookies {
	cookies: Cookie[];
	capturedAt: number;
	expiresAt: number;
}

interface MeetingInfo {
	id: string;
	topic: string;
	start_time: string;
	duration: number;
	share_url?: string;
	speakers?: string[];
}

// ============================================================================
// MAIN WORKER
// ============================================================================

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const corsHeaders = getCorsHeaders(request);

		// CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		// Root - health check
		if (url.pathname === '/' || url.pathname === '/health') {
			return Response.json({
				service: 'WORKWAY Zoom Cookie Sync',
				version: '1.0.0',
				description: 'Per-user cookie storage for Private Workflow',
				endpoints: {
					'GET /setup/:userId': 'Personalized bookmarklet setup page',
					'POST /upload-cookies/:userId': 'Cookie upload from bookmarklet',
					'GET /health/:userId': 'Check cookie status for user',
					'GET /scrape-meetings/:userId': 'List user meetings',
					'POST /scrape-transcript/:userId': 'Extract meeting transcript',
				},
			});
		}

		// Parse userId from path
		const pathParts = url.pathname.split('/').filter(Boolean);

		// Route: GET /setup/:userId - Bookmarklet setup page
		if (pathParts[0] === 'setup' && pathParts[1]) {
			const userId = pathParts[1];
			return serveSetupPage(userId, env);
		}

		// All other routes require a userId
		if (pathParts.length < 2) {
			return Response.json(
				{ error: 'Missing userId in path. Use /{endpoint}/{userId}' },
				{ status: 400, headers: corsHeaders }
			);
		}

		const endpoint = pathParts[0];
		const userId = pathParts[1];

		// Get user's Durable Object
		const sessionId = env.USER_SESSIONS.idFromName(userId);
		const session = env.USER_SESSIONS.get(sessionId);

		// Forward to Durable Object with endpoint info
		const doRequest = new Request(request.url, {
			method: request.method,
			headers: request.headers,
			body: request.body,
		});
		doRequest.headers.set('X-Endpoint', endpoint);
		doRequest.headers.set('X-User-Id', userId);

		return session.fetch(doRequest);
	},
};

// ============================================================================
// DURABLE OBJECT: Per-User Session
// ============================================================================

export class UserSession {
	private state: DurableObjectState;
	private env: Env;

	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.env = env;
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const endpoint = request.headers.get('X-Endpoint') || '';
		const userId = request.headers.get('X-User-Id') || '';
		const corsHeaders = getCorsHeaders(request);

		// CORS preflight
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		try {
			switch (endpoint) {
				case 'upload-cookies':
					return this.uploadCookies(request, corsHeaders);

				case 'health':
					return this.checkHealth(corsHeaders);

				case 'scrape-meetings':
					const days = parseInt(url.searchParams.get('days') || '1');
					return this.scrapeMeetings(days, corsHeaders);

				case 'scrape-transcript':
					return this.scrapeTranscript(request, corsHeaders);

				default:
					return Response.json(
						{ error: `Unknown endpoint: ${endpoint}` },
						{ status: 404, headers: corsHeaders }
					);
			}
		} catch (error: any) {
			console.error(`Error in UserSession (${endpoint}):`, error);
			return Response.json(
				{ error: error.message },
				{ status: 500, headers: corsHeaders }
			);
		}
	}

	// --------------------------------------------------------------------------
	// Cookie Management
	// --------------------------------------------------------------------------

	/**
	 * Store cookies uploaded from bookmarklet
	 */
	async uploadCookies(
		request: Request,
		corsHeaders: Record<string, string>
	): Promise<Response> {
		// Verify authorization (bookmarklet includes secret)
		const authHeader = request.headers.get('Authorization');
		if (!authHeader || authHeader !== `Bearer ${this.env.UPLOAD_SECRET}`) {
			return Response.json(
				{ success: false, error: 'Unauthorized' },
				{ status: 401, headers: corsHeaders }
			);
		}

		try {
			const { cookies } = (await request.json()) as { cookies: Cookie[] };

			if (!Array.isArray(cookies) || cookies.length === 0) {
				return Response.json(
					{ success: false, error: 'No cookies provided' },
					{ status: 400, headers: corsHeaders }
				);
			}

			// Store with 24-hour expiration
			const data: StoredCookies = {
				cookies,
				capturedAt: Date.now(),
				expiresAt: Date.now() + 24 * 60 * 60 * 1000,
			};
			await this.state.storage.put('zoom_cookies', data);

			return Response.json(
				{
					success: true,
					cookieCount: cookies.length,
					expiresAt: new Date(data.expiresAt).toISOString(),
				},
				{ headers: corsHeaders }
			);
		} catch (error: any) {
			return Response.json(
				{ success: false, error: error.message },
				{ status: 500, headers: corsHeaders }
			);
		}
	}

	/**
	 * Check cookie health/status
	 */
	async checkHealth(corsHeaders: Record<string, string>): Promise<Response> {
		const data = await this.state.storage.get<StoredCookies>('zoom_cookies');

		if (!data) {
			return Response.json(
				{
					hasCookies: false,
					message: 'No cookies stored. Use bookmarklet to sync.',
				},
				{ headers: corsHeaders }
			);
		}

		const now = Date.now();
		const isExpired = now > data.expiresAt;

		if (isExpired) {
			// Clean up expired cookies
			await this.state.storage.delete('zoom_cookies');
			return Response.json(
				{
					hasCookies: false,
					message: 'Cookies expired. Use bookmarklet to re-sync.',
				},
				{ headers: corsHeaders }
			);
		}

		return Response.json(
			{
				hasCookies: true,
				age: now - data.capturedAt,
				expiresIn: data.expiresAt - now,
				expiresAt: new Date(data.expiresAt).toISOString(),
				cookieCount: data.cookies.length,
			},
			{ headers: corsHeaders }
		);
	}

	/**
	 * Get stored cookies (returns null if expired)
	 */
	private async getCookies(): Promise<Cookie[] | null> {
		const data = await this.state.storage.get<StoredCookies>('zoom_cookies');
		if (!data) return null;

		if (Date.now() > data.expiresAt) {
			await this.state.storage.delete('zoom_cookies');
			return null;
		}

		return data.cookies;
	}

	// --------------------------------------------------------------------------
	// Scraping
	// --------------------------------------------------------------------------

	/**
	 * Scrape meetings list from Zoom recordings page
	 */
	async scrapeMeetings(
		days: number,
		corsHeaders: Record<string, string>
	): Promise<Response> {
		const cookies = await this.getCookies();
		if (!cookies) {
			return Response.json(
				{
					success: false,
					error: 'No valid cookies. Use bookmarklet to sync.',
					needsBookmarkletSync: true,
				},
				{ status: 401, headers: corsHeaders }
			);
		}

		let browser: Browser | null = null;

		try {
			browser = await puppeteer.launch(this.env.BROWSER);
			const page = await browser.newPage();
			await page.setViewport({ width: 1920, height: 1080 });

			// Set cookies
			await page.goto('https://zoom.us', { waitUntil: 'domcontentloaded' });
			for (const cookie of cookies) {
				await page.setCookie({
					...cookie,
					domain: cookie.domain || '.zoom.us',
					path: cookie.path || '/',
					secure: cookie.secure ?? true,
					httpOnly: true,
				});
			}

			// Navigate to recordings
			await page.goto('https://us06web.zoom.us/recording/management', {
				waitUntil: 'networkidle2',
				timeout: 30000,
			});

			// Check if redirected to login
			if (page.url().includes('signin')) {
				await browser.close();
				await this.state.storage.delete('zoom_cookies');
				return Response.json(
					{
						success: false,
						error: 'Session expired. Use bookmarklet to re-sync.',
						needsBookmarkletSync: true,
					},
					{ status: 401, headers: corsHeaders }
				);
			}

			// Wait for content
			await page.waitForSelector('.recording-list, [class*="recording"]', { timeout: 10000 }).catch(() => {});

			// Calculate date filter
			const fromDate = new Date();
			fromDate.setDate(fromDate.getDate() - days);

			// Extract meetings
			const meetings = await page.evaluate((fromDateStr: string) => {
				const results: Array<{
					id: string;
					topic: string;
					start_time: string;
					duration: number;
					share_url?: string;
				}> = [];

				// Try various selectors for meeting rows
				const rows = document.querySelectorAll(
					'[data-recording-id], .recording-item, .recording-list tr, [role="row"]'
				);

				rows.forEach((row) => {
					const id =
						row.getAttribute('data-recording-id') ||
						row.getAttribute('data-id') ||
						row.getAttribute('data-key') ||
						'';

					if (!id) return;

					const topic =
						row.querySelector('.topic, .recording-topic, [data-topic]')?.textContent?.trim() ||
						row.querySelector('[class*="topic"]')?.textContent?.trim() ||
						'Untitled Meeting';

					const dateText =
						row.querySelector('.date, .recording-date, [data-date]')?.textContent?.trim() ||
						row.querySelector('[class*="date"]')?.textContent?.trim() ||
						'';

					// Parse date if available
					let startTime = new Date().toISOString();
					if (dateText) {
						const parsed = new Date(dateText);
						if (!isNaN(parsed.getTime())) {
							startTime = parsed.toISOString();
						}
					}

					// Get share URL if available
					const shareLink = row.querySelector('a[href*="share"], [data-share-url]');
					const shareUrl =
						shareLink?.getAttribute('href') || shareLink?.getAttribute('data-share-url');

					results.push({
						id,
						topic,
						start_time: startTime,
						duration: 0,
						share_url: shareUrl || undefined,
					});
				});

				return results;
			}, fromDate.toISOString());

			await browser.close();

			return Response.json(
				{
					success: true,
					meetings,
					count: meetings.length,
					daysSearched: days,
				},
				{ headers: corsHeaders }
			);
		} catch (error: any) {
			if (browser) await browser.close().catch(() => {});
			return Response.json(
				{ success: false, error: error.message },
				{ status: 500, headers: corsHeaders }
			);
		}
	}

	/**
	 * Scrape transcript for a specific meeting
	 */
	async scrapeTranscript(
		request: Request,
		corsHeaders: Record<string, string>
	): Promise<Response> {
		const cookies = await this.getCookies();
		if (!cookies) {
			return Response.json(
				{
					success: false,
					error: 'No valid cookies. Use bookmarklet to sync.',
					needsBookmarkletSync: true,
				},
				{ status: 401, headers: corsHeaders }
			);
		}

		const { meetingId, shareUrl } = (await request.json()) as {
			meetingId: string;
			shareUrl?: string;
		};

		if (!meetingId && !shareUrl) {
			return Response.json(
				{ success: false, error: 'meetingId or shareUrl required' },
				{ status: 400, headers: corsHeaders }
			);
		}

		let browser: Browser | null = null;

		try {
			browser = await puppeteer.launch(this.env.BROWSER);
			const page = await browser.newPage();
			await page.setViewport({ width: 1920, height: 1080 });

			// Set cookies
			await page.goto('https://zoom.us', { waitUntil: 'domcontentloaded' });
			for (const cookie of cookies) {
				await page.setCookie({
					...cookie,
					domain: cookie.domain || '.zoom.us',
					path: cookie.path || '/',
					secure: cookie.secure ?? true,
					httpOnly: true,
				});
			}

			// Navigate to transcript page
			const targetUrl =
				shareUrl ||
				`https://us06web.zoom.us/rec/share/${meetingId}` ||
				`https://us06web.zoom.us/recording/management/recording/${meetingId}`;

			await page.goto(targetUrl, {
				waitUntil: 'networkidle2',
				timeout: 30000,
			});

			// Check if redirected to login
			if (page.url().includes('signin')) {
				await browser.close();
				await this.state.storage.delete('zoom_cookies');
				return Response.json(
					{
						success: false,
						error: 'Session expired. Use bookmarklet to re-sync.',
						needsBookmarkletSync: true,
					},
					{ status: 401, headers: corsHeaders }
				);
			}

			// Wait for transcript content
			await page
				.waitForSelector(
					'.transcript-container, .vtt-transcript, [class*="transcript"]',
					{ timeout: 15000 }
				)
				.catch(() => {});

			// Extract transcript
			const result = await page.evaluate(() => {
				const selectors = [
					'.transcript-container',
					'.vtt-transcript',
					'[class*="transcript"]',
					'.meeting-transcript',
				];

				let transcriptText = '';

				for (const selector of selectors) {
					const container = document.querySelector(selector);
					if (container && container.textContent && container.textContent.length > 100) {
						transcriptText = container.textContent;
						break;
					}
				}

				if (!transcriptText) {
					// Fallback: look for download button and try to get content
					transcriptText = document.body.innerText;
				}

				// Extract speakers
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
					speakers,
				};
			});

			await browser.close();

			return Response.json(
				{
					success: true,
					transcript: result.transcript,
					speakers: result.speakers,
					meetingId,
				},
				{ headers: corsHeaders }
			);
		} catch (error: any) {
			if (browser) await browser.close().catch(() => {});
			return Response.json(
				{ success: false, error: error.message },
				{ status: 500, headers: corsHeaders }
			);
		}
	}
}

// ============================================================================
// SETUP PAGE (Zuhandenheit: Tool recedes, outcome remains)
// ============================================================================

function serveSetupPage(userId: string, env: Env): Response {
	const workerUrl = env.WORKER_URL || 'https://zoom-cookie-sync.half-dozen.workers.dev';
	const uploadSecret = env.UPLOAD_SECRET;

	// Generate personalized bookmarklet with userId embedded
	const bookmarkletCode = `javascript:(function(){
if(!window.location.hostname.includes('zoom.us')){
alert('Please open this on a Zoom page (zoom.us)');
return;
}
const c=document.cookie.split('; ').map(x=>{
const[n,...v]=x.split('=');
return{name:n,value:v.join('='),domain:'.zoom.us',path:'/',secure:true,httpOnly:false};
});
fetch('${workerUrl}/upload-cookies/${userId}',{
method:'POST',
headers:{'Content-Type':'application/json','Authorization':'Bearer ${uploadSecret}'},
body:JSON.stringify({cookies:c})
}).then(r=>r.json()).then(d=>{
if(d.success){
alert('Synced '+d.cookieCount+' cookies\\nExpires: '+new Date(d.expiresAt).toLocaleString());
}else{
alert('Error: '+d.error);
}
}).catch(e=>alert('Error: '+e.message));
})();`.replace(/\n/g, '');

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zoom Sync Setup | WORKWAY</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: #000; color: #fff; min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      line-height: 1.6;
    }
    .container { max-width: 520px; padding: 60px 24px; text-align: center; }
    .logo {
      font-size: 11px; letter-spacing: 0.15em; color: rgba(255,255,255,0.5);
      margin-bottom: 16px; text-transform: uppercase;
    }
    h1 { font-size: 36px; font-weight: 600; margin-bottom: 12px; letter-spacing: -0.02em; }
    .subtitle { color: rgba(255,255,255,0.7); margin-bottom: 48px; font-size: 16px; }

    .bookmarklet-area {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      padding: 40px 32px;
      margin-bottom: 48px;
    }
    .bookmarklet-label {
      color: rgba(255,255,255,0.6); font-size: 13px; margin-bottom: 20px;
    }
    .bookmarklet {
      display: inline-block; padding: 16px 40px;
      background: #fff; color: #000;
      text-decoration: none; font-size: 15px; font-weight: 600;
      border-radius: 24px; cursor: move;
      transition: all 0.2s ease;
    }
    .bookmarklet:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(255,255,255,0.15); }

    .instructions { text-align: left; margin-bottom: 40px; }
    .step { display: flex; gap: 16px; margin: 20px 0; align-items: flex-start; }
    .step-num {
      width: 28px; height: 28px; background: #fff; color: #000;
      border-radius: 50%; font-size: 13px; font-weight: 600;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .step-text { color: rgba(255,255,255,0.85); font-size: 15px; padding-top: 3px; }

    .note {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 20px 24px;
      font-size: 14px; color: rgba(255,255,255,0.6);
      text-align: left;
    }
    .note strong { color: rgba(255,255,255,0.8); }

    .status-check {
      margin-top: 32px;
      padding-top: 32px;
      border-top: 1px solid rgba(255,255,255,0.1);
    }
    .status-btn {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.2);
      color: #fff;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .status-btn:hover { border-color: rgba(255,255,255,0.4); }
    #status-result {
      margin-top: 16px;
      padding: 16px;
      border-radius: 8px;
      font-size: 14px;
      display: none;
    }
    #status-result.success { background: rgba(34, 197, 94, 0.1); color: #22c55e; display: block; }
    #status-result.error { background: rgba(239, 68, 68, 0.1); color: #ef4444; display: block; }

    footer { margin-top: 48px; font-size: 12px; color: rgba(255,255,255,0.4); }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">WORKWAY</div>
    <h1>Zoom Sync</h1>
    <p class="subtitle">Connect your Zoom meetings with one click</p>

    <div class="bookmarklet-area">
      <p class="bookmarklet-label">Drag this to your bookmarks bar</p>
      <a href="${bookmarkletCode}" class="bookmarklet">Sync Zoom</a>
    </div>

    <div class="instructions">
      <div class="step">
        <span class="step-num">1</span>
        <span class="step-text">Drag the button above to your bookmarks bar (usually below the URL bar)</span>
      </div>
      <div class="step">
        <span class="step-num">2</span>
        <span class="step-text">Login to Zoom at <a href="https://us06web.zoom.us" target="_blank" style="color:#fff;">us06web.zoom.us</a></span>
      </div>
      <div class="step">
        <span class="step-num">3</span>
        <span class="step-text">Click the bookmark - you'll see a success message</span>
      </div>
    </div>

    <div class="note">
      <p><strong>How it works:</strong> The bookmark captures your Zoom session cookies (valid 24 hours). Your meetings then sync automatically to Notion via the Private Workflow.</p>
      <p style="margin-top:12px;"><strong>Daily:</strong> When prompted by WORKWAY, just login to Zoom and click the bookmark again. Takes 5 seconds.</p>
    </div>

    <div class="status-check">
      <button class="status-btn" onclick="checkStatus()">Check Cookie Status</button>
      <div id="status-result"></div>
    </div>

    <footer>
      <p>User ID: ${userId}</p>
    </footer>
  </div>

  <script>
    async function checkStatus() {
      const result = document.getElementById('status-result');
      result.className = '';
      result.style.display = 'none';

      try {
        const response = await fetch('${workerUrl}/health/${userId}');
        const data = await response.json();

        if (data.hasCookies) {
          const expiresIn = Math.round(data.expiresIn / 3600000);
          result.className = 'success';
          result.innerHTML = 'Cookies synced. Expires in ' + expiresIn + ' hours (' + data.cookieCount + ' cookies stored).';
        } else {
          result.className = 'error';
          result.innerHTML = data.message || 'No cookies found. Please use the bookmarklet after logging into Zoom.';
        }
      } catch (error) {
        result.className = 'error';
        result.innerHTML = 'Error checking status: ' + error.message;
      }
    }
  </script>
</body>
</html>`;

	return new Response(html, {
		headers: { 'Content-Type': 'text/html' },
	});
}

// ============================================================================
// HELPERS
// ============================================================================

function getCorsHeaders(request: Request): Record<string, string> {
	const origin = request.headers.get('Origin') || '';
	const allowedOrigins = ['zoom.us', 'workway.co', 'half-dozen.workers.dev', 'localhost'];
	const isAllowed = allowedOrigins.some((o) => origin.includes(o));

	return {
		'Access-Control-Allow-Origin': isAllowed ? origin : 'https://workway.co',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Endpoint, X-User-Id',
	};
}
