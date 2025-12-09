/**
 * Zoom Connection Worker
 *
 * Enables "Meeting Intelligence (Browser Workaround)" workflow.
 * Meetings and Clips that document themselves in Notion.
 *
 * ## Philosophy
 *
 * "The tool should recede; the outcome should remain."
 * User thinks: "My meetings are documented"
 * Not: "I manage connections and sessions"
 *
 * ## Capabilities
 *
 * - Zoom Meetings: Scrape recordings page, extract transcripts
 * - Zoom Clips: Scrape clips page, extract transcripts with virtual scroll
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

interface ExecutionRecord {
	id: string;
	workflow_id: string;
	status: 'running' | 'success' | 'failed';
	trigger_type: 'schedule' | 'manual';
	meetings_synced: number;
	clips_synced: number;
	action_items_found: number;
	result_summary: string | null;
	error_message: string | null;
	started_at: string;
	completed_at: string | null;
	execution_time_ms: number | null;
	created_at: string;
}

interface MeetingInfo {
	id: string;
	topic: string;
	start_time: string;
	duration: number;
	share_url?: string;
	speakers?: string[];
}

interface ClipInfo {
	id: string;
	title: string;
	created_at: string;
	duration: number;
	share_url: string;
	thumbnail_url?: string;
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
				version: '2.1.0',
				description: 'Per-user cookie storage for Meeting Intelligence (Browser Workaround) Workflow',
				endpoints: {
					'GET /setup/:userId': 'Personalized bookmarklet setup page',
					'GET /dashboard/:userId': 'Redirects to workway.co/workflows (unified dashboard)',
					'POST /upload-cookies/:userId': 'Cookie upload from bookmarklet',
					'GET /health/:userId': 'Check cookie status for user',
					'GET /dashboard-data/:userId': 'Get dashboard data (connection + executions)',
					'POST /disconnect/:userId': 'Remove stored Zoom connection',
					'POST /sync/:userId': 'Trigger manual sync to Notion',
					'POST /executions/:userId': 'Record workflow execution (API key required)',
					'GET /scrape-meetings/:userId': 'List user meetings',
					'POST /scrape-transcript/:userId': 'Extract meeting transcript',
					'GET /scrape-clips/:userId': 'List user clips',
					'POST /scrape-clip-transcript/:userId': 'Extract clip transcript',
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

		// Route: GET /dashboard/:userId - Redirect to unified workflows page
		// The dashboard now lives at workway.co/workflows (canonical location for all workflows)
		// This redirect preserves the old URL for bookmarks/links
		if (pathParts[0] === 'dashboard' && pathParts[1]) {
			return Response.redirect('https://workway.co/workflows', 302);
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

	/**
	 * Scheduled handler: Refresh cookies for all active users
	 * Runs every 12 hours (6 AM and 6 PM UTC) to keep sessions alive
	 * before their 24-hour expiration
	 */
	async scheduled(
		event: ScheduledEvent,
		env: Env,
		ctx: ExecutionContext
	): Promise<void> {
		console.log('Starting scheduled cookie refresh...');

		// Get list of all Durable Object IDs that have been used
		// We iterate through known users - in production you'd store this in KV
		// For now, we'll trigger refresh for all known users
		const knownUsers = ['dm-halfdozen-co', 'micah-halfdozen-co'];

		for (const userId of knownUsers) {
			try {
				const sessionId = env.USER_SESSIONS.idFromName(userId);
				const session = env.USER_SESSIONS.get(sessionId);

				// Trigger refresh in the Durable Object
				const refreshRequest = new Request('https://internal/refresh-session', {
					method: 'POST',
					headers: {
						'X-Endpoint': 'refresh-session',
						'X-User-Id': userId,
					},
				});

				ctx.waitUntil(
					session.fetch(refreshRequest).then((response) => {
						console.log(`Cookie refresh for ${userId}: ${response.status}`);
					})
				);
			} catch (error) {
				console.error(`Failed to refresh cookies for ${userId}:`, error);
			}
		}
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
					const meetingDays = parseInt(url.searchParams.get('days') || '1');
					return this.scrapeMeetings(meetingDays, corsHeaders);

				case 'scrape-transcript':
					return this.scrapeTranscript(request, corsHeaders);

				case 'scrape-clips':
					const clipDays = parseInt(url.searchParams.get('days') || '7');
					return this.scrapeClips(clipDays, corsHeaders);

				case 'scrape-clip-transcript':
					return this.scrapeClipTranscript(request, corsHeaders);

				// Execution tracking for Private Workflow dashboard
				case 'executions':
					if (request.method === 'POST') {
						return this.recordExecution(request, corsHeaders);
					}
					return this.listExecutions(corsHeaders);

				case 'dashboard-data':
					return this.getDashboardData(corsHeaders);

				case 'disconnect':
					return this.disconnect(corsHeaders);

				case 'sync':
					return this.triggerSync(request, userId, corsHeaders);

				case 'refresh-session':
					return this.refreshSession(corsHeaders);

				case 'debug-cookies':
					const debugData = await this.state.storage.get<StoredCookies>('zoom_cookies');
					const debugCookies = await this.getCookies();
					return Response.json({
						storageData: debugData ? {
							cookieCount: debugData.cookies.length,
							expiresAt: debugData.expiresAt,
							now: Date.now(),
							isExpired: Date.now() > debugData.expiresAt,
						} : null,
						getCookiesResult: debugCookies ? debugCookies.length : null,
					}, { headers: corsHeaders });

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
			// Cron job refreshes every 6 hours to keep sessions alive
			const data: StoredCookies = {
				cookies,
				capturedAt: Date.now(),
				expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
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
	 * Disconnect - remove stored cookies
	 */
	async disconnect(corsHeaders: Record<string, string>): Promise<Response> {
		await this.state.storage.delete('zoom_cookies');

		return Response.json(
			{
				success: true,
				message: 'Zoom connection removed',
			},
			{ headers: corsHeaders }
		);
	}

	/**
	 * Refresh session: Visit Zoom to capture rotated cookies
	 * Called by cron every 6 hours to keep session alive
	 */
	async refreshSession(corsHeaders: Record<string, string>): Promise<Response> {
		const cookieData = await this.state.storage.get<StoredCookies>('zoom_cookies');
		if (!cookieData) {
			return Response.json(
				{ success: false, error: 'No cookies to refresh' },
				{ headers: corsHeaders }
			);
		}

		// Check if cookies are still valid
		if (Date.now() > cookieData.expiresAt) {
			return Response.json(
				{ success: false, error: 'Cookies already expired', needsAuth: true },
				{ headers: corsHeaders }
			);
		}

		try {
			// Launch browser and load cookies
			const browser = await puppeteer.launch(this.env.BROWSER, {
				keep_alive: 60000, // 1 minute
			});
			const page = await browser.newPage();

			// Set cookies before navigating
			await page.setCookie(...cookieData.cookies);

			// Visit Zoom profile page to trigger cookie rotation
			console.log('Visiting Zoom to refresh cookies...');
			await page.goto('https://us06web.zoom.us/profile', {
				waitUntil: 'networkidle2',
				timeout: 30000,
			});

			// Check if still logged in
			const currentUrl = page.url();
			if (currentUrl.includes('/signin')) {
				await page.close();
				await browser.close();
				// Don't delete cookies yet - they might still work for scraping
				return Response.json(
					{ success: false, error: 'Session expired during refresh', needsAuth: true },
					{ headers: corsHeaders }
				);
			}

			// Capture rotated cookies
			const refreshedCookies = await page.cookies();
			const zoomCookies = refreshedCookies.filter((c) => c.domain.includes('zoom.us'));

			await page.close();
			await browser.close();

			if (zoomCookies.length > 0) {
				// Store refreshed cookies with new 24-hour expiration
				const newData: StoredCookies = {
					cookies: zoomCookies as Cookie[],
					capturedAt: Date.now(),
					expiresAt: Date.now() + 24 * 60 * 60 * 1000,
				};
				await this.state.storage.put('zoom_cookies', newData);

				console.log(`Refreshed ${zoomCookies.length} cookies, new expiry: ${new Date(newData.expiresAt).toISOString()}`);
				return Response.json(
					{
						success: true,
						message: 'Cookies refreshed',
						cookieCount: zoomCookies.length,
						expiresAt: new Date(newData.expiresAt).toISOString(),
					},
					{ headers: corsHeaders }
				);
			} else {
				return Response.json(
					{ success: false, error: 'No Zoom cookies captured during refresh' },
					{ headers: corsHeaders }
				);
			}
		} catch (error: any) {
			console.error('Cookie refresh failed:', error);
			return Response.json(
				{ success: false, error: error.message },
				{ status: 500, headers: corsHeaders }
			);
		}
	}

	/**
	 * Get stored cookies (returns null if expired)
	 */
	private async getCookies(): Promise<Cookie[] | null> {
		const data = await this.state.storage.get<StoredCookies>('zoom_cookies');
		console.log(`getCookies: data exists=${!!data}, expiresAt=${data?.expiresAt}, now=${Date.now()}`);
		if (!data) return null;

		if (Date.now() > data.expiresAt) {
			console.log(`getCookies: expired, deleting cookies`);
			await this.state.storage.delete('zoom_cookies');
			return null;
		}

		console.log(`getCookies: returning ${data.cookies.length} cookies`);
		return data.cookies;
	}

	// --------------------------------------------------------------------------
	// Execution Tracking (Private Workflow Dashboard)
	// --------------------------------------------------------------------------

	/**
	 * Trigger manual sync
	 *
	 * Note: This does NOT actually run the sync inline. The Meeting Intelligence
	 * workflow is triggered by CRON schedule (7 AM UTC daily).
	 *
	 * This endpoint:
	 * 1. Verifies the connection is valid
	 * 2. Returns information about when the next scheduled sync will occur
	 * 3. Provides a way to check connection status
	 *
	 * Future: We could add inline sync capability here if needed.
	 */
	async triggerSync(
		request: Request,
		userId: string,
		corsHeaders: Record<string, string>
	): Promise<Response> {
		if (request.method !== 'POST') {
			return Response.json(
				{ error: 'Method not allowed' },
				{ status: 405, headers: corsHeaders }
			);
		}

		// Check if connected
		const cookies = await this.getCookies();
		if (!cookies) {
			return Response.json(
				{
					success: false,
					error: 'Not connected',
					action: 'setup_required',
				},
				{ status: 400, headers: corsHeaders }
			);
		}

		// Calculate next scheduled run (7 AM UTC daily)
		const now = new Date();
		const nextRun = new Date();
		nextRun.setUTCHours(7, 0, 0, 0);
		if (nextRun <= now) {
			nextRun.setDate(nextRun.getDate() + 1);
		}

		return Response.json(
			{
				success: true,
				message: 'Connection verified',
				connectionValid: true,
				note: 'The workflow runs automatically at 7 AM UTC daily. Your meetings and clips will be synced to Notion during the next scheduled run.',
				nextScheduledRun: nextRun.toISOString(),
				tip: 'Duplicates are automatically skipped based on source URL matching.',
			},
			{ headers: corsHeaders }
		);
	}

	/**
	 * Record a workflow execution (called by workflow)
	 */
	async recordExecution(
		request: Request,
		corsHeaders: Record<string, string>
	): Promise<Response> {
		// Verify API secret
		const authHeader = request.headers.get('Authorization');
		if (!authHeader || authHeader !== `Bearer ${this.env.API_SECRET}`) {
			return Response.json(
				{ success: false, error: 'Unauthorized' },
				{ status: 401, headers: corsHeaders }
			);
		}

		try {
			const body = (await request.json()) as Partial<ExecutionRecord>;

			const execution: ExecutionRecord = {
				id: crypto.randomUUID(),
				workflow_id: body.workflow_id || 'meeting-intelligence-workaround',
				status: body.status || 'running',
				trigger_type: body.trigger_type || 'schedule',
				meetings_synced: body.meetings_synced || 0,
				clips_synced: body.clips_synced || 0,
				action_items_found: body.action_items_found || 0,
				result_summary: body.result_summary || null,
				error_message: body.error_message || null,
				started_at: body.started_at || new Date().toISOString(),
				completed_at: body.completed_at || null,
				execution_time_ms: body.execution_time_ms || null,
				created_at: new Date().toISOString(),
			};

			// Get existing executions and prepend new one (limit to 50)
			const existing = await this.state.storage.get<ExecutionRecord[]>('executions') || [];
			const updated = [execution, ...existing].slice(0, 50);
			await this.state.storage.put('executions', updated);

			return Response.json(
				{ success: true, execution_id: execution.id },
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
	 * List recent executions
	 */
	async listExecutions(corsHeaders: Record<string, string>): Promise<Response> {
		const executions = await this.state.storage.get<ExecutionRecord[]>('executions') || [];

		return Response.json(
			{ success: true, executions },
			{ headers: corsHeaders }
		);
	}

	/**
	 * Get all dashboard data in one request (for efficiency)
	 */
	async getDashboardData(corsHeaders: Record<string, string>): Promise<Response> {
		const cookieData = await this.state.storage.get<StoredCookies>('zoom_cookies');
		let executions = await this.state.storage.get<ExecutionRecord[]>('executions') || [];

		// Clean up orphaned "running" executions that are older than 30 minutes
		// These are leftovers from old manual sync attempts that never completed
		const thirtyMinutesAgo = new Date(Date.now() - 1800000).toISOString();
		const hasOrphans = executions.some(
			e => e.status === 'running' && e.started_at < thirtyMinutesAgo
		);

		if (hasOrphans) {
			executions = executions.map(e => {
				if (e.status === 'running' && e.started_at < thirtyMinutesAgo) {
					return {
						...e,
						status: 'failed' as const,
						error_message: 'Execution timed out (orphaned manual trigger)',
						completed_at: new Date().toISOString(),
					};
				}
				return e;
			});
			// Persist the cleanup
			await this.state.storage.put('executions', executions);
		}

		// Calculate connection status
		let zoomConnection = {
			connected: false,
			expiresIn: null as number | null,
			refreshSoon: false,
		};

		if (cookieData && Date.now() < cookieData.expiresAt) {
			const expiresIn = cookieData.expiresAt - Date.now();
			zoomConnection = {
				connected: true,
				expiresIn,
				refreshSoon: expiresIn < 3600000, // Less than 1 hour
			};
		}

		// Calculate stats (only count completed executions)
		const completedExecutions = executions.filter(e => e.status !== 'running');
		const stats = {
			totalRuns: completedExecutions.length,
			successfulRuns: completedExecutions.filter(e => e.status === 'success').length,
			totalMeetings: completedExecutions.reduce((sum, e) => sum + (e.meetings_synced || 0), 0),
			totalClips: completedExecutions.reduce((sum, e) => sum + (e.clips_synced || 0), 0),
			totalActionItems: completedExecutions.reduce((sum, e) => sum + (e.action_items_found || 0), 0),
		};

		return Response.json(
			{
				success: true,
				zoomConnection,
				executions: executions.slice(0, 20),
				stats,
			},
			{ headers: corsHeaders }
		);
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

			// Set cookies directly (matches reference implementation)
			console.log(`Loading ${cookies.length} stored cookies...`);
			await page.setCookie(...cookies);

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

	// --------------------------------------------------------------------------
	// Clips Scraping
	// --------------------------------------------------------------------------

	/**
	 * Scrape clips list from Zoom clips page
	 */
	async scrapeClips(
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

			// Navigate to clips page
			await page.goto('https://us06web.zoom.us/clips', {
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

			// Wait for clips to load
			await page.waitForSelector('[class*="clip"], .clip-item, .clip-card', { timeout: 10000 }).catch(() => {});

			// Calculate date filter
			const fromDate = new Date();
			fromDate.setDate(fromDate.getDate() - days);

			// Extract clips
			const clips = await page.evaluate((fromDateStr: string) => {
				const results: Array<{
					id: string;
					title: string;
					created_at: string;
					duration: number;
					share_url: string;
					thumbnail_url?: string;
				}> = [];

				// Try various selectors for clip items
				const clipElements = document.querySelectorAll(
					'[data-clip-id], .clip-item, .clip-card, [class*="clip-list"] > div, [role="listitem"]'
				);

				clipElements.forEach((el) => {
					// Extract clip ID
					const id =
						el.getAttribute('data-clip-id') ||
						el.getAttribute('data-id') ||
						el.querySelector('a[href*="/clips/"]')?.getAttribute('href')?.match(/clips\/([^/?]+)/)?.[1] ||
						'';

					if (!id) return;

					// Extract title
					const title =
						el.querySelector('[class*="title"], .clip-title, h3, h4')?.textContent?.trim() ||
						el.querySelector('a')?.textContent?.trim() ||
						'Untitled Clip';

					// Extract date
					const dateText =
						el.querySelector('[class*="date"], [class*="time"], .clip-date')?.textContent?.trim() ||
						'';
					let createdAt = new Date().toISOString();
					if (dateText) {
						const parsed = new Date(dateText);
						if (!isNaN(parsed.getTime())) {
							createdAt = parsed.toISOString();
						}
					}

					// Extract duration (format: "1:30" or "01:30")
					const durationText =
						el.querySelector('[class*="duration"], .clip-duration')?.textContent?.trim() || '';
					let duration = 0;
					const durationMatch = durationText.match(/(\d+):(\d+)/);
					if (durationMatch) {
						duration = parseInt(durationMatch[1]) * 60 + parseInt(durationMatch[2]);
					}

					// Extract share URL
					const shareLink = el.querySelector('a[href*="/clips/share/"], a[href*="/clips/"]');
					let shareUrl = shareLink?.getAttribute('href') || '';
					if (shareUrl && !shareUrl.startsWith('http')) {
						shareUrl = `https://zoom.us${shareUrl}`;
					}
					if (!shareUrl) {
						shareUrl = `https://zoom.us/clips/share/${id}`;
					}

					// Extract thumbnail
					const thumbnail = el.querySelector('img[src*="thumbnail"], img[class*="thumb"]');
					const thumbnailUrl = thumbnail?.getAttribute('src') || undefined;

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

			await browser.close();

			return Response.json(
				{
					success: true,
					clips,
					count: clips.length,
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
	 * Scrape transcript for a specific clip
	 * Uses virtual scroll handling for longer clips
	 */
	async scrapeClipTranscript(
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

		const { clipId, shareUrl } = (await request.json()) as {
			clipId: string;
			shareUrl?: string;
		};

		if (!clipId && !shareUrl) {
			return Response.json(
				{ success: false, error: 'clipId or shareUrl required' },
				{ status: 400, headers: corsHeaders }
			);
		}

		let browser: Browser | null = null;

		try {
			browser = await puppeteer.launch(this.env.BROWSER);
			const page = await browser.newPage();
			await page.setViewport({ width: 1280, height: 720 });

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

			// Navigate to clip share page
			const targetUrl = shareUrl || `https://zoom.us/clips/share/${clipId}`;

			await page.goto(targetUrl, {
				waitUntil: 'networkidle2',
				timeout: 60000,
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

			// Wait for transcript content to load
			await page
				.waitForSelector('.mv-transcript-list-item, [class*="transcript"]', { timeout: 15000 })
				.catch(() => {});

			// Extract transcript using virtual scroll technique
			const result = await page.evaluate(async () => {
				// Helper to wait
				const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

				// Find the scrollable container (usually the largest one)
				const scrollContainers = Array.from(document.querySelectorAll('.zoom-scrollbar__wrap'));
				let scrollContainer: Element | null = null;
				let maxHeight = 0;

				for (const container of scrollContainers) {
					if (container.scrollHeight > maxHeight) {
						maxHeight = container.scrollHeight;
						scrollContainer = container;
					}
				}

				const transcriptItems: Array<{ timestamp: string; text: string; seconds: number }> = [];
				const seenTimestamps = new Set<string>();

				// Function to extract visible transcript items
				const extractVisibleItems = () => {
					const items = document.querySelectorAll('.mv-transcript-list-item');
					items.forEach((item) => {
						const text = item.textContent?.trim() || '';
						// Parse timestamp (format: "MM:SS" at start)
						const match = text.match(/^(\d{1,2}):(\d{2})/);
						if (match) {
							const timestamp = `${match[1]}:${match[2]}`;
							if (!seenTimestamps.has(timestamp)) {
								seenTimestamps.add(timestamp);
								const seconds = parseInt(match[1]) * 60 + parseInt(match[2]);
								const content = text.substring(match[0].length).trim();
								transcriptItems.push({
									timestamp,
									text: content,
									seconds,
								});
							}
						}
					});
				};

				// If we have a scroll container, use virtual scroll technique
				if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
					// Pre-load by scrolling to bottom a few times
					for (let i = 0; i < 5; i++) {
						scrollContainer.scrollTop = scrollContainer.scrollHeight;
						await wait(200);
					}

					// Scroll back to top
					scrollContainer.scrollTop = 0;
					await wait(300);

					// Scroll incrementally and collect items
					const scrollStep = 500;
					let currentScroll = 0;

					while (currentScroll < scrollContainer.scrollHeight) {
						extractVisibleItems();
						currentScroll += scrollStep;
						scrollContainer.scrollTop = currentScroll;
						await wait(150);
					}

					// Final extraction at bottom
					extractVisibleItems();
				} else {
					// No scroll needed, just extract directly
					extractVisibleItems();
				}

				// Sort by timestamp seconds
				transcriptItems.sort((a, b) => a.seconds - b.seconds);

				// Format as transcript text
				const transcriptText = transcriptItems
					.map((item) => `${item.timestamp}\n${item.text}`)
					.join('\n\n');

				return {
					transcript: transcriptText,
					segmentCount: transcriptItems.length,
					extractionMethod: scrollContainer ? 'virtual_scroll' : 'static',
				};
			});

			await browser.close();

			return Response.json(
				{
					success: true,
					transcript: result.transcript,
					segmentCount: result.segmentCount,
					extractionMethod: result.extractionMethod,
					clipId,
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
alert('Connected! Your meetings and clips will now document themselves in Notion.');
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
  <link rel="icon" type="image/svg+xml" href="https://workway.co/favicon.svg">
  <link rel="icon" type="image/x-icon" href="https://workway.co/favicon.ico">
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
    <p class="outcome">Your meetings and clips will document themselves in Notion</p>

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
// DASHBOARD PAGE (Private Workflow UI)
// ============================================================================

function serveDashboard(userId: string, env: Env): Response {
	const workerUrl = env.WORKER_URL || 'https://zoom-cookie-sync.half-dozen.workers.dev';

	// Dashboard page with connection status and execution history
	const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meeting Intelligence | WORKWAY</title>
  <link rel="icon" type="image/svg+xml" href="https://workway.co/favicon.svg">
  <link rel="icon" type="image/x-icon" href="https://workway.co/favicon.ico">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: #000; color: #fff; min-height: 100vh;
    }
    .container { max-width: 800px; margin: 0 auto; padding: 48px 24px; }
    .logo { font-size: 11px; letter-spacing: 0.15em; color: rgba(255,255,255,0.4); margin-bottom: 8px; }
    h1 { font-size: 32px; font-weight: 600; margin-bottom: 8px; }
    .subtitle { color: rgba(255,255,255,0.6); margin-bottom: 40px; font-size: 15px; }

    /* Connection Card */
    .card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 24px; margin-bottom: 24px; }
    .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .card-title { font-size: 16px; font-weight: 600; }
    .status-badge { display: flex; align-items: center; gap: 8px; font-size: 14px; padding: 6px 12px; border-radius: 20px; }
    .status-badge.connected { background: rgba(34,197,94,0.1); color: #22c55e; }
    .status-badge.disconnected { background: rgba(239,68,68,0.1); color: #ef4444; }
    .status-badge.warning { background: rgba(251,191,36,0.1); color: #fbbf24; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; }
    .status-badge.connected .status-dot { background: #22c55e; }
    .status-badge.disconnected .status-dot { background: #ef4444; }
    .status-badge.warning .status-dot { background: #fbbf24; }

    .connect-btn { display: inline-block; padding: 10px 20px; background: #fff; color: #000; text-decoration: none; font-size: 14px; font-weight: 500; border-radius: 6px; border: none; cursor: pointer; }
    .connect-btn.secondary { background: rgba(255,255,255,0.1); color: #fff; }
    .connect-btn.danger { background: transparent; border: 1px solid rgba(239,68,68,0.3); color: rgba(239,68,68,0.8); }
    .connect-btn.danger:hover { background: rgba(239,68,68,0.1); color: #ef4444; }
    .action-row { display: flex; gap: 12px; align-items: center; margin-top: 12px; }

    /* Stats Grid */
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
    .stat-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 16px; text-align: center; }
    .stat-value { font-size: 28px; font-weight: 600; margin-bottom: 4px; }
    .stat-value.success { color: #22c55e; }
    .stat-value.info { color: #3b82f6; }
    .stat-value.purple { color: #a855f7; }
    .stat-label { font-size: 12px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.05em; }

    /* Executions Table */
    .table-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 12px 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: rgba(255,255,255,0.5); border-bottom: 1px solid rgba(255,255,255,0.1); }
    td { padding: 16px; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.05); }
    tr:hover { background: rgba(255,255,255,0.02); }

    .exec-status { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .exec-status.success { background: rgba(34,197,94,0.1); color: #22c55e; }
    .exec-status.failed { background: rgba(239,68,68,0.1); color: #ef4444; }
    .exec-status.running { background: rgba(251,191,36,0.1); color: #fbbf24; }

    .empty-state { text-align: center; padding: 48px; color: rgba(255,255,255,0.5); }
    .empty-icon { font-size: 48px; margin-bottom: 16px; }

    /* How it works */
    .help-card { background: rgba(59,130,246,0.05); border: 1px solid rgba(59,130,246,0.2); border-radius: 12px; padding: 24px; margin-top: 32px; }
    .help-title { font-size: 14px; font-weight: 600; color: #3b82f6; margin-bottom: 12px; }
    .help-list { list-style: none; }
    .help-list li { padding: 8px 0; font-size: 13px; color: rgba(255,255,255,0.7); display: flex; gap: 12px; }
    .help-list strong { color: #fff; }

    @media (max-width: 640px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      table { font-size: 13px; }
      th, td { padding: 12px 8px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">WORKWAY</div>
    <h1>Meeting Intelligence</h1>
    <p class="subtitle">Your Zoom meetings and clips automatically documented in Notion.</p>

    <!-- Connection Status -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">Zoom Connection</span>
        <div id="connection-status" class="status-badge disconnected">
          <span class="status-dot"></span>
          <span>Loading...</span>
        </div>
      </div>
      <div id="connection-actions" style="display: none;">
        <a href="${workerUrl}/setup/${userId}" class="connect-btn">Connect Zoom</a>
      </div>
      <div id="connection-info" style="display: none;">
        <p style="color: rgba(255,255,255,0.6); font-size: 14px; margin-bottom: 12px;">Your Zoom session is active. Meetings and clips sync daily at 7 AM UTC.</p>
        <div class="action-row">
          <a href="${workerUrl}/setup/${userId}" class="connect-btn secondary">Refresh</a>
          <button onclick="disconnect()" class="connect-btn danger" id="disconnect-btn">Disconnect</button>
        </div>
      </div>
    </div>

    <!-- Stats -->
    <div id="stats-grid" class="stats-grid">
      <div class="stat-card">
        <div class="stat-value" id="stat-runs">-</div>
        <div class="stat-label">Total Runs</div>
      </div>
      <div class="stat-card">
        <div class="stat-value success" id="stat-success">-</div>
        <div class="stat-label">Successful</div>
      </div>
      <div class="stat-card">
        <div class="stat-value info" id="stat-meetings">-</div>
        <div class="stat-label">Meetings</div>
      </div>
      <div class="stat-card">
        <div class="stat-value purple" id="stat-clips">-</div>
        <div class="stat-label">Clips</div>
      </div>
    </div>

    <!-- Executions Table -->
    <div class="card">
      <div class="table-header">
        <span class="card-title">Recent Runs</span>
      </div>
      <div id="executions-container">
        <div class="empty-state">
          <div class="empty-icon">...</div>
          <p>Loading execution history...</p>
        </div>
      </div>
    </div>

    <!-- Help -->
    <div class="help-card">
      <div class="help-title">How it works</div>
      <ul class="help-list">
        <li><strong>Daily Sync:</strong> Every day at 7 AM UTC, we check for new Zoom meetings and clips</li>
        <li><strong>AI Analysis:</strong> Each recording is analyzed for summaries, decisions, and action items</li>
        <li><strong>Notion Pages:</strong> Results are automatically created in your Internal LLM database</li>
        <li><strong>Session Refresh:</strong> Zoom sessions expire after 24 hours - refresh via the setup page</li>
      </ul>
    </div>
  </div>

  <script>
    const userId = '${userId}';
    const workerUrl = '${workerUrl}';

    function formatDate(dateString) {
      if (!dateString) return '-';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    function formatDuration(ms) {
      if (!ms) return '-';
      if (ms < 1000) return ms + 'ms';
      return (ms / 1000).toFixed(1) + 's';
    }

    function formatExpiresIn(ms) {
      if (!ms) return '';
      const hours = Math.floor(ms / 3600000);
      const minutes = Math.floor((ms % 3600000) / 60000);
      if (hours > 0) return ' (expires in ' + hours + 'h ' + minutes + 'm)';
      return ' (expires in ' + minutes + 'm)';
    }

    async function loadDashboard() {
      try {
        const res = await fetch(workerUrl + '/dashboard-data/' + userId);
        const data = await res.json();

        // Update connection status
        const statusEl = document.getElementById('connection-status');
        const actionsEl = document.getElementById('connection-actions');
        const infoEl = document.getElementById('connection-info');

        if (data.zoomConnection.connected) {
          const expiresText = formatExpiresIn(data.zoomConnection.expiresIn);
          if (data.zoomConnection.refreshSoon) {
            statusEl.className = 'status-badge warning';
            statusEl.innerHTML = '<span class="status-dot"></span><span>Refresh Soon' + expiresText + '</span>';
            actionsEl.style.display = 'block';
            actionsEl.innerHTML = '<a href="' + workerUrl + '/setup/' + userId + '" class="connect-btn secondary">Refresh Connection</a>';
          } else {
            statusEl.className = 'status-badge connected';
            statusEl.innerHTML = '<span class="status-dot"></span><span>Connected' + expiresText + '</span>';
            infoEl.style.display = 'block';
          }
        } else {
          statusEl.className = 'status-badge disconnected';
          statusEl.innerHTML = '<span class="status-dot"></span><span>Not Connected</span>';
          actionsEl.style.display = 'block';
        }

        // Update stats
        document.getElementById('stat-runs').textContent = data.stats.totalRuns;
        document.getElementById('stat-success').textContent = data.stats.successfulRuns;
        document.getElementById('stat-meetings').textContent = data.stats.totalMeetings;
        document.getElementById('stat-clips').textContent = data.stats.totalClips;

        // Update executions table
        const container = document.getElementById('executions-container');
        if (!data.executions || data.executions.length === 0) {
          container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>No workflow runs yet.</p><p style="margin-top: 8px; font-size: 13px;">Connect your Zoom account to start syncing meetings.</p></div>';
        } else {
          let html = '<table><thead><tr><th>Date</th><th>Status</th><th>Meetings</th><th>Clips</th><th>Duration</th></tr></thead><tbody>';
          data.executions.forEach(exec => {
            const statusClass = exec.status === 'success' ? 'success' : (exec.status === 'failed' ? 'failed' : 'running');
            const statusLabel = exec.status.charAt(0).toUpperCase() + exec.status.slice(1);
            html += '<tr>';
            html += '<td>' + formatDate(exec.started_at) + '</td>';
            html += '<td><span class="exec-status ' + statusClass + '">' + statusLabel + '</span></td>';
            html += '<td>' + (exec.meetings_synced || 0) + '</td>';
            html += '<td>' + (exec.clips_synced || 0) + '</td>';
            html += '<td>' + formatDuration(exec.execution_time_ms) + '</td>';
            html += '</tr>';
          });
          html += '</tbody></table>';
          container.innerHTML = html;
        }
      } catch (error) {
        console.error('Failed to load dashboard:', error);
        document.getElementById('connection-status').innerHTML = '<span class="status-dot"></span><span>Error loading</span>';
      }
    }

    async function disconnect() {
      if (!confirm('Disconnect your Zoom account? You can reconnect anytime.')) {
        return;
      }

      const btn = document.getElementById('disconnect-btn');
      btn.textContent = 'Disconnecting...';
      btn.disabled = true;

      try {
        const res = await fetch(workerUrl + '/disconnect/' + userId, { method: 'POST' });
        if (res.ok) {
          loadDashboard(); // Refresh the UI
        } else {
          alert('Failed to disconnect. Please try again.');
          btn.textContent = 'Disconnect';
          btn.disabled = false;
        }
      } catch (error) {
        console.error('Disconnect failed:', error);
        alert('Failed to disconnect. Please try again.');
        btn.textContent = 'Disconnect';
        btn.disabled = false;
      }
    }

    loadDashboard();
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
