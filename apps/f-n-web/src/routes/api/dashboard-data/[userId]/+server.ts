/**
 * Dashboard Data Endpoint for WORKWAY Platform Integration
 * 
 * Provides F→N user data in the format expected by workway-platform.
 * The platform calls: /dashboard-data/{userIdFromEmail}
 * where userIdFromEmail = email.toLowerCase().replace('@', '-').replace(/\./g, '-')
 * 
 * This endpoint translates back to email and returns status/stats.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
	if (!platform?.env) {
		return json({ error: 'Server configuration error' }, { status: 500 });
	}

	const { DB } = platform.env;
	const { userId } = params;

	// Convert userId back to email format
	// userId format: "email-domain-com" → "email@domain.com"
	// Find the user by attempting to reconstruct email patterns
	const emailFromUserId = reconstructEmail(userId);

	try {
		// Try to find user by email
		const user = await DB.prepare(
			'SELECT id, email FROM users WHERE LOWER(email) = LOWER(?)'
		).bind(emailFromUserId).first<{ id: string; email: string }>();

		if (!user) {
			// Return needs_setup status if user not found
			return json({
				status: 'needs_setup',
				totalRuns: 0,
				stats: { totalRuns: 0, successfulRuns: 0 },
			}, {
				headers: corsHeaders(),
			});
		}

		// Check if user has connected both Fireflies and Notion
		const accounts = await DB.prepare(
			'SELECT provider FROM connected_accounts WHERE user_id = ?'
		).bind(user.id).all<{ provider: string }>();

		const hasFireflies = accounts.results?.some(a => a.provider === 'fireflies');
		const hasNotion = accounts.results?.some(a => a.provider === 'notion');

		// Determine status
		let status: 'active' | 'needs_setup' | 'expired' = 'needs_setup';
		if (hasFireflies && hasNotion) {
			status = 'active';
		}

		// Get sync stats
		const jobs = await DB.prepare(`
			SELECT id, status, progress, created_at, started_at, completed_at
			FROM sync_jobs
			WHERE user_id = ?
			ORDER BY created_at DESC
			LIMIT 50
		`).bind(user.id).all<{
			id: string;
			status: string;
			progress: number;
			created_at: string;
			started_at: string | null;
			completed_at: string | null;
		}>();

		const executions = jobs.results || [];
		const totalRuns = executions.length;
		const successfulRuns = executions.filter(j => j.status === 'completed').length;
		const lastRunAt = executions[0]?.created_at 
			? new Date(executions[0].created_at).getTime() 
			: null;

		return json({
			status,
			totalRuns,
			lastRunAt,
			stats: {
				totalRuns,
				successfulRuns,
			},
			executions: executions.map(j => ({
				id: j.id,
				status: j.status,
				started_at: j.started_at,
				completed_at: j.completed_at,
				meetings_synced: j.progress, // Map progress to meetings_synced for platform compatibility
			})),
		}, {
			headers: corsHeaders(),
		});

	} catch (error) {
		const errMsg = error instanceof Error ? error.message : 'Unknown error';
		console.error('Dashboard data error:', errMsg);
		return json({ error: errMsg }, { status: 500 });
	}
};

// Handle CORS preflight
export const OPTIONS: RequestHandler = async () => {
	return new Response(null, {
		headers: corsHeaders(),
	});
};

/**
 * Reconstruct email from userId format
 * "viv-os-life" → "viv@os.life"
 * "john-smith-example-com" → "john.smith@example.com"
 * 
 * Strategy: Try common patterns, the last two segments are likely domain
 */
function reconstructEmail(userId: string): string {
	const parts = userId.split('-');
	
	if (parts.length < 3) {
		// Simple case: "user-domain-tld"
		return parts.join('@').replace(/-([^-]+)$/, '.$1');
	}
	
	// Assume last two parts are domain (e.g., "example-com" → "example.com")
	const tld = parts.pop()!;
	const domain = parts.pop()!;
	const localPart = parts.join('.');
	
	return `${localPart}@${domain}.${tld}`;
}

function corsHeaders(): HeadersInit {
	return {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		'Cache-Control': 'no-cache',
	};
}
