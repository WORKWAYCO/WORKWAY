/**
 * WORKWAY Zoom Transcript Scraper
 *
 * Weniger, aber besser: Minimal browser automation for Zoom transcript extraction.
 * Uses Cloudflare Browser Rendering API with cookie-based authentication.
 *
 * Endpoints:
 *   GET  /              - Health check + instructions
 *   GET  /sync          - Bookmarklet page for cookie capture
 *   POST /cookies       - Upload cookies from bookmarklet
 *   POST /transcript    - Scrape transcript (called by SDK)
 *   POST /transcripts   - Scrape all recent transcripts
 *
 * @example SDK usage:
 * ```typescript
 * const zoom = new Zoom({
 *   accessToken: tokens.access_token,
 *   browserScraperUrl: 'https://zoom-scraper.workway.co'
 * });
 *
 * const transcript = await zoom.getTranscript({
 *   meetingId: '123456789',
 *   fallbackToBrowser: true,
 *   shareUrl: recording.share_url
 * });
 * ```
 */

import puppeteer, { Browser, Page } from '@cloudflare/puppeteer';

// ============================================================================
// TYPES
// ============================================================================

interface Env {
	BROWSER: Fetcher;
	ZOOM_COOKIES: KVNamespace;
	UPLOAD_SECRET: string;
}

interface Cookie {
	name: string;
	value: string;
	domain?: string;
	path?: string;
	secure?: boolean;
	httpOnly?: boolean;
}

interface TranscriptRequest {
	zoomUrl: string;
	userEmail?: string;
}

interface TranscriptResponse {
	success: boolean;
	transcript?: string;
	segments_count?: number;
	speakers?: string[];
	source: 'browser_scraper';
	error?: string;
}

interface TranscriptsResponse {
	success: boolean;
	transcripts: Array<{
		meeting_id: string;
		meeting_topic: string;
		transcript_text: string;
		generated_time: string;
		speakers?: string[];
	}>;
	error?: string;
}

// ============================================================================
// BOOKMARKLET HTML (Rams: minimal, functional)
// ============================================================================

const SYNC_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zoom Sync | WORKWAY</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: #000; color: #fff; min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
    }
    .container { max-width: 480px; padding: 40px 20px; text-align: center; }
    .logo { font-size: 11px; letter-spacing: 0.15em; color: rgba(255,255,255,0.5); margin-bottom: 16px; }
    h1 { font-size: 32px; font-weight: 600; margin-bottom: 40px; }
    .bookmarklet {
      display: inline-block; padding: 14px 32px; background: #fff; color: #000;
      text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 24px;
      cursor: move; transition: transform 0.2s;
    }
    .bookmarklet:hover { transform: translateY(-2px); }
    .instructions { margin-top: 48px; text-align: left; }
    .step { display: flex; gap: 12px; margin: 16px 0; align-items: flex-start; }
    .step-num {
      width: 24px; height: 24px; background: #fff; color: #000;
      border-radius: 50%; font-size: 12px; font-weight: 600;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .step-text { color: rgba(255,255,255,0.8); font-size: 14px; line-height: 1.5; }
    .note { margin-top: 32px; padding: 16px; background: rgba(255,255,255,0.05); border-radius: 8px; font-size: 13px; color: rgba(255,255,255,0.6); }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">WORKWAY</div>
    <h1>Zoom Sync</h1>
    <a href="javascript:(function(){if(!location.hostname.includes('zoom.us')){alert('Open this on zoom.us');return;}const c=document.cookie.split('; ').map(x=>{const[n,...v]=x.split('=');return{name:n,value:v.join('='),domain:'.zoom.us',path:'/',secure:true};});fetch('WORKER_URL/cookies',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer UPLOAD_SECRET'},body:JSON.stringify({cookies:c})}).then(r=>r.json()).then(d=>alert(d.success?'Synced '+d.count+' cookies':'Error: '+d.error)).catch(e=>alert('Error: '+e.message));})();" class="bookmarklet">Sync Cookies</a>
    <div class="instructions">
      <div class="step"><span class="step-num">1</span><span class="step-text">Drag the button above to your bookmarks bar</span></div>
      <div class="step"><span class="step-num">2</span><span class="step-text">Log in to Zoom (us06web.zoom.us)</span></div>
      <div class="step"><span class="step-num">3</span><span class="step-text">Click the bookmark</span></div>
    </div>
    <div class="note">Cookies expire after 24 hours. Re-sync when prompted.</div>
  </div>
</body>
</html>`;

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

		// Health check
		if (url.pathname === '/' || url.pathname === '/health') {
			return Response.json({
				service: 'WORKWAY Zoom Transcript Scraper',
				version: '1.0.0',
				endpoints: {
					'GET /sync': 'Bookmarklet page for cookie capture',
					'POST /cookies': 'Upload cookies from bookmarklet',
					'POST /transcript': 'Scrape single transcript from URL',
					'POST /transcripts': 'Scrape all recent transcripts',
				},
			});
		}

		// Bookmarklet page
		if (url.pathname === '/sync' || url.pathname === '/sync.html') {
			const workerUrl = new URL(request.url).origin;
			const html = SYNC_HTML
				.replace('WORKER_URL', workerUrl)
				.replace('UPLOAD_SECRET', env.UPLOAD_SECRET);
			return new Response(html, {
				headers: { 'Content-Type': 'text/html' },
			});
		}

		// Upload cookies (from bookmarklet)
		if (url.pathname === '/cookies' && request.method === 'POST') {
			return handleCookieUpload(request, env, corsHeaders);
		}

		// Scrape single transcript (called by SDK)
		if (url.pathname === '/transcript' && request.method === 'POST') {
			return handleTranscriptRequest(request, env, corsHeaders);
		}

		// Scrape all recent transcripts
		if (url.pathname === '/transcripts' && request.method === 'POST') {
			return handleTranscriptsRequest(request, env, corsHeaders);
		}

		return new Response('Not found', { status: 404, headers: corsHeaders });
	},
};

// ============================================================================
// HANDLERS
// ============================================================================

/**
 * Handle cookie upload from bookmarklet
 */
async function handleCookieUpload(
	request: Request,
	env: Env,
	corsHeaders: Record<string, string>
): Promise<Response> {
	// Verify authorization
	const authHeader = request.headers.get('Authorization');
	if (!authHeader || authHeader !== `Bearer ${env.UPLOAD_SECRET}`) {
		return Response.json(
			{ success: false, error: 'Unauthorized' },
			{ status: 401, headers: corsHeaders }
		);
	}

	try {
		const { cookies, userEmail = 'default' } = await request.json() as {
			cookies: Cookie[];
			userEmail?: string;
		};

		if (!Array.isArray(cookies) || cookies.length === 0) {
			return Response.json(
				{ success: false, error: 'No cookies provided' },
				{ status: 400, headers: corsHeaders }
			);
		}

		// Store in KV with 24-hour expiration
		await env.ZOOM_COOKIES.put(
			`cookies:${userEmail}`,
			JSON.stringify(cookies),
			{ expirationTtl: 86400 }
		);

		return Response.json({
			success: true,
			count: cookies.length,
			expiresIn: '24 hours',
		}, { headers: corsHeaders });
	} catch (error: any) {
		return Response.json(
			{ success: false, error: error.message },
			{ status: 500, headers: corsHeaders }
		);
	}
}

/**
 * Scrape a single transcript from a Zoom share URL
 * Called by SDK's Zoom integration when fallbackToBrowser is true
 */
async function handleTranscriptRequest(
	request: Request,
	env: Env,
	corsHeaders: Record<string, string>
): Promise<Response> {
	let browser: Browser | null = null;

	try {
		const { zoomUrl, userEmail = 'default' } = await request.json() as TranscriptRequest;

		if (!zoomUrl) {
			return Response.json(
				{ success: false, error: 'zoomUrl is required', source: 'browser_scraper' },
				{ status: 400, headers: corsHeaders }
			);
		}

		// Get stored cookies
		const cookiesJson = await env.ZOOM_COOKIES.get(`cookies:${userEmail}`);
		if (!cookiesJson) {
			return Response.json({
				success: false,
				error: 'No cookies found. Visit /sync to authenticate.',
				source: 'browser_scraper',
			} as TranscriptResponse, { status: 401, headers: corsHeaders });
		}

		const cookies = JSON.parse(cookiesJson) as Cookie[];

		// Launch browser
		browser = await puppeteer.launch(env.BROWSER);
		const page = await browser.newPage();
		await page.setViewport({ width: 1920, height: 1080 });

		// Set cookies
		await page.goto('https://zoom.us', { waitUntil: 'domcontentloaded' });
		for (const cookie of cookies) {
			await page.setCookie({ ...cookie, httpOnly: true });
		}

		// Navigate to share URL
		await page.goto(zoomUrl, { waitUntil: 'networkidle2', timeout: 30000 });

		// Check if redirected to login
		if (page.url().includes('signin')) {
			await browser.close();
			return Response.json({
				success: false,
				error: 'Session expired. Visit /sync to re-authenticate.',
				source: 'browser_scraper',
			} as TranscriptResponse, { status: 401, headers: corsHeaders });
		}

		// Extract transcript from page
		const result = await extractTranscriptFromPage(page);

		await browser.close();

		return Response.json({
			success: true,
			transcript: result.text,
			segments_count: result.segments,
			speakers: result.speakers,
			source: 'browser_scraper',
		} as TranscriptResponse, { headers: corsHeaders });
	} catch (error: any) {
		if (browser) await browser.close().catch(() => {});
		return Response.json({
			success: false,
			error: error.message,
			source: 'browser_scraper',
		} as TranscriptResponse, { status: 500, headers: corsHeaders });
	}
}

/**
 * Scrape all recent transcripts from Zoom transcript management page
 */
async function handleTranscriptsRequest(
	request: Request,
	env: Env,
	corsHeaders: Record<string, string>
): Promise<Response> {
	let browser: Browser | null = null;

	try {
		const { userEmail = 'default' } = await request.json() as { userEmail?: string };

		// Get stored cookies
		const cookiesJson = await env.ZOOM_COOKIES.get(`cookies:${userEmail}`);
		if (!cookiesJson) {
			return Response.json({
				success: false,
				transcripts: [],
				error: 'No cookies found. Visit /sync to authenticate.',
			} as TranscriptsResponse, { status: 401, headers: corsHeaders });
		}

		const cookies = JSON.parse(cookiesJson) as Cookie[];

		// Launch browser
		browser = await puppeteer.launch(env.BROWSER);
		const page = await browser.newPage();
		await page.setViewport({ width: 1920, height: 1080 });

		// Set cookies
		await page.goto('https://zoom.us', { waitUntil: 'domcontentloaded' });
		for (const cookie of cookies) {
			await page.setCookie({ ...cookie, httpOnly: true });
		}

		// Navigate to transcript management
		await page.goto('https://us06web.zoom.us/recording/management/meeting/transcript', {
			waitUntil: 'networkidle2',
			timeout: 30000,
		});

		// Check if redirected to login
		if (page.url().includes('signin')) {
			await browser.close();
			return Response.json({
				success: false,
				transcripts: [],
				error: 'Session expired. Visit /sync to re-authenticate.',
			} as TranscriptsResponse, { status: 401, headers: corsHeaders });
		}

		// Wait for table to load
		await page.waitForSelector('[role="row"].zoom-virtual-table__row', { timeout: 15000 })
			.catch(() => {});

		// Extract meeting list
		const meetings = await page.evaluate(() => {
			const results: Array<{
				meeting_id: string;
				meeting_topic: string;
				generated_time: string;
			}> = [];

			const rows = document.querySelectorAll('[role="row"].zoom-virtual-table__row');

			rows.forEach((row) => {
				const rowKey = row.getAttribute('data-key') || '';
				const checkbox = row.querySelector('input[type="checkbox"][aria-label]');
				const ariaLabel = checkbox?.getAttribute('aria-label') || '';
				const topicMatch = ariaLabel.match(/Topic:\s*(.+)$/);
				const topic = topicMatch ? topicMatch[1].trim() : '';

				const cells = row.querySelectorAll('[role="gridcell"]');
				let meetingId = '';
				let generatedTime = '';

				cells.forEach((cell) => {
					const text = cell.textContent?.trim() || '';
					const digitsOnly = text.replace(/\s/g, '');
					if (/^\d{11}$/.test(digitsOnly)) meetingId = digitsOnly;
					if (/\w{3}\s+\d{1,2},\s+\d{4}/.test(text)) generatedTime = text;
				});

				if (topic && rowKey) {
					results.push({
						meeting_id: meetingId || rowKey,
						meeting_topic: topic,
						generated_time: generatedTime,
					});
				}
			});

			return results;
		});

		// Download transcripts for each meeting
		const transcripts = [];
		for (const meeting of meetings.slice(0, 10)) { // Limit to 10 for performance
			try {
				const downloadBtn = await page.$(`button[aria-label="Download ${meeting.meeting_topic}"]`);
				if (!downloadBtn) continue;

				// Intercept download
				const transcript = await interceptDownload(page, downloadBtn);
				if (transcript) {
					const parsed = parseWebVTT(transcript);
					transcripts.push({
						...meeting,
						transcript_text: parsed.text,
						speakers: parsed.speakers,
					});
				}
			} catch {
				// Skip failed downloads
			}
		}

		await browser.close();

		return Response.json({
			success: true,
			transcripts,
		} as TranscriptsResponse, { headers: corsHeaders });
	} catch (error: any) {
		if (browser) await browser.close().catch(() => {});
		return Response.json({
			success: false,
			transcripts: [],
			error: error.message,
		} as TranscriptsResponse, { status: 500, headers: corsHeaders });
	}
}

// ============================================================================
// HELPERS (DRY: Reuse WebVTT parsing logic)
// ============================================================================

/**
 * Extract transcript from a Zoom share page
 */
async function extractTranscriptFromPage(page: Page): Promise<{
	text: string;
	segments: number;
	speakers: string[];
}> {
	// Wait for transcript container
	await page.waitForSelector('.transcript-container, .vtt-transcript, [class*="transcript"]', {
		timeout: 10000,
	}).catch(() => {});

	// Extract transcript text
	const result = await page.evaluate(() => {
		// Try various selectors for transcript content
		const selectors = [
			'.transcript-container',
			'.vtt-transcript',
			'[class*="transcript"]',
			'.meeting-transcript',
		];

		for (const selector of selectors) {
			const container = document.querySelector(selector);
			if (container && container.textContent && container.textContent.length > 100) {
				return container.textContent;
			}
		}

		// Fallback: get all text from page
		return document.body.innerText;
	});

	// Parse for speakers
	const speakers = new Set<string>();
	const speakerRegex = /^([^:]+):/gm;
	let match;
	while ((match = speakerRegex.exec(result)) !== null) {
		const speaker = match[1].trim();
		if (speaker.length < 50 && !speaker.includes('\n')) {
			speakers.add(speaker);
		}
	}

	return {
		text: result,
		segments: result.split('\n').filter(l => l.trim()).length,
		speakers: Array.from(speakers),
	};
}

/**
 * Intercept file download triggered by button click
 */
async function interceptDownload(page: Page, button: any): Promise<string | null> {
	return new Promise(async (resolve) => {
		const timeout = setTimeout(() => resolve(null), 10000);

		page.on('response', async (response) => {
			const url = response.url();
			const headers = response.headers();

			if (url.includes('transcript') || headers['content-disposition']?.includes('attachment')) {
				clearTimeout(timeout);
				try {
					const text = await response.text();
					resolve(text);
				} catch {
					resolve(null);
				}
			}
		});

		await button.click();
	});
}

/**
 * Parse WebVTT format to plain text with speaker extraction
 * (DRY: Same logic as SDK's Zoom.parseWebVTT)
 */
function parseWebVTT(webvtt: string): { text: string; speakers: string[] } {
	const lines = webvtt.split('\n');
	const textLines: string[] = [];
	const speakers = new Set<string>();

	let isTextLine = false;

	for (const line of lines) {
		const trimmed = line.trim();

		if (trimmed.startsWith('WEBVTT') || trimmed.length === 0) {
			isTextLine = false;
			continue;
		}

		if (trimmed.includes('-->')) {
			isTextLine = true;
			continue;
		}

		if (isTextLine && trimmed.length > 0) {
			textLines.push(trimmed);
			const speakerMatch = trimmed.match(/^([^:]+):/);
			if (speakerMatch) speakers.add(speakerMatch[1].trim());
		}
	}

	return {
		text: textLines.join('\n'),
		speakers: Array.from(speakers),
	};
}

/**
 * Get CORS headers based on request origin
 */
function getCorsHeaders(request: Request): Record<string, string> {
	const origin = request.headers.get('Origin') || '';
	const allowedOrigins = ['zoom.us', 'workway.co', 'localhost'];
	const isAllowed = allowedOrigins.some(o => origin.includes(o));

	return {
		'Access-Control-Allow-Origin': isAllowed ? origin : 'https://workway.co',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
	};
}
