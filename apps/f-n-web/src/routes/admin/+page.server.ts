/**
 * Admin Panel - Server
 *
 * Protected by domain-based access (@halfdozen.co).
 * Allows generating and managing client invitation links.
 */

import { redirect, fail } from '@sveltejs/kit';
import { isAdmin, generateInviteCode, getExpirationTimestamp } from '$lib/server/admin';
import type { PageServerLoad, Actions } from './$types';

interface Invitation {
	id: string;
	invite_code: string;
	email: string | null;
	tier: string;
	created_by_email: string;
	expires_at: number;
	redeemed_at: number | null;
	redeemed_by_user_id: string | null;
	created_at: string;
}

export const load: PageServerLoad = async ({ locals, platform }) => {
	// Check authentication
	if (!locals.user) {
		throw redirect(302, '/auth/login?redirect=/admin');
	}

	// Check admin access
	if (!isAdmin(locals.user.email)) {
		throw redirect(302, '/dashboard');
	}

	if (!platform?.env) {
		return { invitations: [], error: 'Server configuration error' };
	}

	const { DB } = platform.env;

	// Get all invitations (most recent first)
	const invitations = await DB.prepare(
		`SELECT id, invite_code, email, tier, created_by_email, expires_at, redeemed_at, redeemed_by_user_id, created_at
		 FROM client_invitations
		 ORDER BY created_at DESC
		 LIMIT 50`
	).all<Invitation>();

	return {
		invitations: invitations.results || [],
		siteUrl: platform.env.SITE_URL || 'https://fn.workway.co'
	};
};

export const actions: Actions = {
	/**
	 * Create a new invitation
	 */
	create: async ({ request, locals, platform }) => {
		if (!locals.user || !isAdmin(locals.user.email)) {
			return fail(403, { message: 'Unauthorized' });
		}

		if (!platform?.env) {
			return fail(500, { message: 'Server configuration error' });
		}

		const formData = await request.formData();
		const email = formData.get('email')?.toString().toLowerCase().trim() || null;
		const tier = formData.get('tier')?.toString() || 'free';

		const { DB } = platform.env;

		const id = crypto.randomUUID();
		const inviteCode = generateInviteCode();
		const expiresAt = getExpirationTimestamp();

		await DB.prepare(
			`INSERT INTO client_invitations (id, invite_code, email, tier, created_by_email, expires_at)
			 VALUES (?, ?, ?, ?, ?, ?)`
		)
			.bind(id, inviteCode, email, tier, locals.user.email, expiresAt)
			.run();

		return {
			success: true,
			inviteCode,
			message: `Invitation created${email ? ` for ${email}` : ''}`
		};
	},

	/**
	 * Revoke an invitation
	 */
	revoke: async ({ request, locals, platform }) => {
		if (!locals.user || !isAdmin(locals.user.email)) {
			return fail(403, { message: 'Unauthorized' });
		}

		if (!platform?.env) {
			return fail(500, { message: 'Server configuration error' });
		}

		const formData = await request.formData();
		const id = formData.get('id')?.toString();

		if (!id) {
			return fail(400, { message: 'Invitation ID required' });
		}

		const { DB } = platform.env;

		await DB.prepare('DELETE FROM client_invitations WHERE id = ?').bind(id).run();

		return { success: true, message: 'Invitation revoked' };
	}
};
