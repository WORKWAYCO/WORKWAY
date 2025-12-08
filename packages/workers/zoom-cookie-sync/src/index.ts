/**
 * Zoom Connection Worker
 *
 * Enables "Meeting Intelligence (Quick Start)" workflow.
 * Meetings that document themselves - ready in 30 seconds.
 *
 * ## Philosophy
 *
 * "The tool should recede; the outcome should remain."
 * User thinks: "My meetings are documented"
 * Not: "I manage connections and sessions"
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
					connected: false,
					message: 'Not connected yet',
				},
				{ headers: corsHeaders }
			);
		}

		const now = Date.now();
		const isExpired = now > data.expiresAt;

		if (isExpired) {
			await this.state.storage.delete('zoom_cookies');
			return Response.json(
				{
					hasCookies: false,
					connected: false,
					message: 'Connection needs refresh',
				},
				{ headers: corsHeaders }
			);
		}

		return Response.json(
			{
				hasCookies: true,
				connected: true,
				expiresIn: data.expiresAt - now,
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
					error: 'Connection needs refresh',
					needsRefresh: true,
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
						error: 'Connection needs refresh',
						needsRefresh: true,
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
					error: 'Connection needs refresh',
					needsRefresh: true,
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
						error: 'Connection needs refresh',
						needsRefresh: true,
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
// SETUP PAGE (Zuhandenheit: Outcome first, mechanism invisible)
// ============================================================================

function serveSetupPage(userId: string, env: Env): Response {
	const workerUrl = env.WORKER_URL || 'https://zoom-cookie-sync.half-dozen.workers.dev';
	const uploadSecret = env.UPLOAD_SECRET;

	// Bookmarklet with friendly success message (no technical details)
	const bookmarkletCode = `javascript:(function(){
if(!window.location.hostname.includes('zoom.us')){
alert('Please open this on Zoom first');
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
alert('Connected! Your meetings will now document themselves in Notion.');
}else{
alert('Connection failed. Please try again.');
}
}).catch(e=>alert('Connection failed. Please try again.'));
})();`.replace(/\n/g, '');

	// Minimal, outcome-focused page
	const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connect Zoom | WORKWAY</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: #000; color: #fff; min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
    }
    .container { max-width: 400px; padding: 48px 24px; text-align: center; }
    .logo { font-size: 11px; letter-spacing: 0.15em; color: rgba(255,255,255,0.4); margin-bottom: 32px; }
    h1 { font-size: 28px; font-weight: 600; margin-bottom: 8px; }
    .outcome { color: rgba(255,255,255,0.6); margin-bottom: 40px; font-size: 15px; }
    .bookmark-btn {
      display: inline-block; padding: 16px 48px;
      background: #fff; color: #000;
      text-decoration: none; font-size: 15px; font-weight: 600;
      border-radius: 32px; cursor: move;
    }
    .hint { margin-top: 16px; font-size: 13px; color: rgba(255,255,255,0.4); }
    .status { margin-top: 48px; padding: 16px; border-radius: 8px; font-size: 14px; }
    .status.connected { background: rgba(34,197,94,0.1); color: #22c55e; }
    .status.disconnected { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.5); }
    .upgrade { margin-top: 32px; padding-top: 32px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 13px; color: rgba(255,255,255,0.4); }
    .upgrade a { color: rgba(255,255,255,0.6); }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">WORKWAY</div>
    <h1>Connect Zoom</h1>
    <p class="outcome">Your meetings will document themselves in Notion</p>

    <a href="${bookmarkletCode}" class="bookmark-btn">Sync Zoom</a>
    <p class="hint">Drag this to your bookmarks bar, then click it on Zoom</p>

    <div id="status" class="status"></div>

    <div class="upgrade">
      Want fully automatic sync? <a href="/workflows/meeting-intelligence">Upgrade to OAuth version</a>
    </div>
  </div>

  <script>
    // Auto-check connection status on load
    (async function() {
      const status = document.getElementById('status');
      try {
        const res = await fetch('${workerUrl}/health/${userId}');
        const data = await res.json();
        if (data.hasCookies) {
          status.className = 'status connected';
          status.textContent = 'Connected';
        } else {
          status.className = 'status disconnected';
          status.textContent = 'Not connected yet';
        }
      } catch {
        status.className = 'status disconnected';
        status.textContent = 'Not connected yet';
      }
    })();
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
