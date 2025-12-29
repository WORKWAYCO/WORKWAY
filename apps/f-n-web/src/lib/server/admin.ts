/**
 * Admin Utilities
 *
 * Domain-based admin access for Half Dozen team.
 * Canon: One identity, domain determines capabilities.
 */

const ADMIN_DOMAINS = ['halfdozen.co'];

/**
 * Check if email belongs to an admin domain
 */
export function isAdmin(email: string | undefined): boolean {
	if (!email) return false;
	const domain = email.split('@')[1]?.toLowerCase();
	return ADMIN_DOMAINS.includes(domain || '');
}

/**
 * Generate a secure invite code
 */
export function generateInviteCode(): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let code = '';
	const array = new Uint8Array(8);
	crypto.getRandomValues(array);
	for (const byte of array) {
		code += chars[byte % chars.length];
	}
	return code;
}

/**
 * Get expiration timestamp (7 days from now)
 */
export function getExpirationTimestamp(): number {
	return Date.now() + 7 * 24 * 60 * 60 * 1000;
}

/**
 * Check if invitation is valid (not expired, not redeemed)
 */
export function isInvitationValid(invitation: {
	expires_at: number;
	redeemed_at: number | null;
	email?: string | null;
}, claimantEmail?: string): { valid: boolean; reason?: string } {
	if (invitation.redeemed_at) {
		return { valid: false, reason: 'Invitation has already been used' };
	}

	if (invitation.expires_at < Date.now()) {
		return { valid: false, reason: 'Invitation has expired' };
	}

	// If invitation is restricted to specific email, check it
	if (invitation.email && claimantEmail) {
		if (invitation.email.toLowerCase() !== claimantEmail.toLowerCase()) {
			return { valid: false, reason: 'Invitation is for a different email address' };
		}
	}

	return { valid: true };
}
