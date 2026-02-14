/**
 * hd-zoom-sync-cron Worker
 *
 * Triggers Half Dozen Meeting Intelligence sync (Zoom -> Notion) at 8:00 AM CT
 * (America/Chicago), and emails micah@createsomething.io on failure via Resend.
 *
 * This worker DOES NOT upload Zoom cookies. Cookies are managed server-side by
 * meetings.workway.co; refresh manually when they expire.
 */

export interface Env {
	MEETINGS_BASE_URL: string;
	USER_ID: string;

	RESEND_API_KEY: string;
	RESEND_FROM: string;
	RESEND_TO: string;

	/** Optional: protect manual trigger endpoint */
	ADMIN_TOKEN?: string;
}

const CHICAGO_TZ = 'America/Chicago';

function getTimePartsInZone(date: Date, timeZone: string): { hour: number; minute: number } {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone,
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	}).formatToParts(date);

	const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 'NaN');
	const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 'NaN');

	return { hour, minute };
}

function isEightAmChicago(date: Date): boolean {
	const { hour, minute } = getTimePartsInZone(date, CHICAGO_TZ);
	return hour === 8 && minute === 0;
}

async function triggerSync(env: Env): Promise<{
	ok: boolean;
	status: number;
	message: string;
	bodyText: string;
}> {
	const url = `${env.MEETINGS_BASE_URL.replace(/\/$/, '')}/sync/${env.USER_ID}`;
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
	});

	const bodyText = await res.text();
	let message = bodyText;

	try {
		const json = JSON.parse(bodyText) as { success?: boolean; message?: string };
		if (typeof json?.message === 'string') message = json.message;
		if (json?.success === false) {
			return { ok: false, status: res.status, message, bodyText };
		}
	} catch {
		// Non-JSON is OK; we'll use raw text as message.
	}

	return { ok: res.ok, status: res.status, message, bodyText };
}

async function sendFailureEmail(env: Env, details: { status: number; message: string; when: string }) {
	const subject = `[FAIL] HD Zoom->Notion sync (${env.USER_ID})`;
	const text = [
		`Half Dozen Meeting Intelligence daily sync failed.`,
		``,
		`When (UTC): ${details.when}`,
		`HTTP status: ${details.status}`,
		`Message: ${details.message}`,
		``,
		`Next step: refresh Zoom cookies, then run: pnpm zoom-sync ${env.USER_ID}`,
	].join('\n');

	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${env.RESEND_API_KEY}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			from: env.RESEND_FROM,
			to: [env.RESEND_TO],
			subject,
			text,
		}),
	});

	if (!res.ok) {
		const body = await res.text();
		console.error('[hd-zoom-sync-cron] Failed to send Resend email:', res.status, body);
	}
}

function requireAdmin(request: Request, env: Env): Response | null {
	// If no ADMIN_TOKEN is configured, treat the endpoint as disabled.
	if (!env.ADMIN_TOKEN) {
		return new Response(JSON.stringify({ error: 'ADMIN_TOKEN not configured' }), {
			status: 503,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const auth = request.headers.get('authorization') || '';
	const expected = `Bearer ${env.ADMIN_TOKEN}`;
	if (auth !== expected) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), {
			status: 401,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	return null;
}

export default {
	async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
		const now = new Date();

		// Only run at 08:00 CT (DST-safe).
		if (!isEightAmChicago(now)) {
			const { hour, minute } = getTimePartsInZone(now, CHICAGO_TZ);
			console.log(
				`[hd-zoom-sync-cron] Skip: chicago=${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} cron=${controller.cron}`
			);
			return;
		}

		console.log(`[hd-zoom-sync-cron] Running daily sync at ${now.toISOString()} cron=${controller.cron}`);

		try {
			const result = await triggerSync(env);
			if (!result.ok) {
				console.error('[hd-zoom-sync-cron] Sync failed:', result.status, result.message);
				await sendFailureEmail(env, { status: result.status, message: result.message, when: now.toISOString() });
				return;
			}

			console.log('[hd-zoom-sync-cron] Sync OK:', result.status, result.message);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error('[hd-zoom-sync-cron] Sync error:', msg);
			await sendFailureEmail(env, { status: 0, message: msg, when: now.toISOString() });
		}
	},

	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === 'GET' && url.pathname === '/') {
			const now = new Date();
			const { hour, minute } = getTimePartsInZone(now, CHICAGO_TZ);
			return new Response(
				JSON.stringify(
					{
						status: 'ok',
						worker: 'hd-zoom-sync-cron',
						description: 'Daily 8am CT trigger for meetings.workway.co sync + failure email via Resend',
						target: `${env.MEETINGS_BASE_URL.replace(/\/$/, '')}/sync/${env.USER_ID}`,
						nowUtc: now.toISOString(),
						nowChicago: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
						willRunNow: isEightAmChicago(now),
						endpoints: ['GET /', 'POST /trigger (Authorization: Bearer <ADMIN_TOKEN>)'],
						config: {
							userId: env.USER_ID,
							resendTo: env.RESEND_TO,
							resendFrom: env.RESEND_FROM,
						},
					},
					null,
					2
				),
				{ headers: { 'Content-Type': 'application/json' } }
			);
		}

		if (request.method === 'POST' && url.pathname === '/trigger') {
			const authErr = requireAdmin(request, env);
			if (authErr) return authErr;

			const now = new Date();
			try {
				const result = await triggerSync(env);
				if (!result.ok) {
					await sendFailureEmail(env, { status: result.status, message: result.message, when: now.toISOString() });
				}

				return new Response(
					JSON.stringify(
						{
							triggered: true,
							ok: result.ok,
							status: result.status,
							message: result.message,
						},
						null,
						2
					),
					{ status: result.ok ? 200 : 502, headers: { 'Content-Type': 'application/json' } }
				);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				await sendFailureEmail(env, { status: 0, message: msg, when: now.toISOString() });
				return new Response(JSON.stringify({ triggered: true, ok: false, status: 0, message: msg }, null, 2), {
					status: 500,
					headers: { 'Content-Type': 'application/json' },
				});
			}
		}

		return new Response('Not found', { status: 404 });
	},
};
