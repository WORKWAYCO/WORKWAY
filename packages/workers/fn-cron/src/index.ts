/**
 * fn-cron Worker
 * 
 * Cloudflare Worker with scheduled trigger to run auto-sync
 * for fn.workway.co (Fireflies → Notion sync)
 * 
 * Runs hourly via cron trigger.
 */

export interface Env {
	CRON_SECRET: string;
	FN_URL: string;
}

export default {
	/**
	 * Scheduled handler - triggered by cron
	 */
	async scheduled(
		controller: ScheduledController,
		env: Env,
		ctx: ExecutionContext
	): Promise<void> {
		const url = `${env.FN_URL}/api/cron/auto-sync`;
		
		console.log(`[fn-cron] Running auto-sync at ${new Date().toISOString()}`);
		
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${env.CRON_SECRET}`,
					'Content-Type': 'application/json',
				},
			});

			const result = await response.json();
			
			if (!response.ok) {
				console.error(`[fn-cron] Auto-sync failed: ${response.status}`, result);
				return;
			}

			console.log(`[fn-cron] Auto-sync complete:`, result);
		} catch (error) {
			console.error(`[fn-cron] Auto-sync error:`, error);
		}
	},

	/**
	 * HTTP handler - for manual testing
	 */
	async fetch(
		request: Request,
		env: Env,
		ctx: ExecutionContext
	): Promise<Response> {
		// Only allow GET for status check
		if (request.method === 'GET') {
			return new Response(JSON.stringify({
				status: 'ok',
				worker: 'fn-cron',
				description: 'Hourly auto-sync trigger for fn.workway.co',
				target: `${env.FN_URL}/api/cron/auto-sync`,
			}), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// POST to manually trigger (useful for testing)
		if (request.method === 'POST') {
			const url = `${env.FN_URL}/api/cron/auto-sync`;
			
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${env.CRON_SECRET}`,
					'Content-Type': 'application/json',
				},
			});

			const result = await response.json();
			
			return new Response(JSON.stringify({
				triggered: true,
				response: result,
			}), {
				status: response.status,
				headers: { 'Content-Type': 'application/json' },
			});
		}

		return new Response('Method not allowed', { status: 405 });
	},
};
