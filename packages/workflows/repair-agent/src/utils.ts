/**
 * Repair Agent Utilities
 *
 * Shared utilities for repair agent operations.
 * DRY Fix: Consolidated from fix.ts and pr.ts.
 */

/**
 * Parse repository name to GitHub owner/repo pair
 *
 * Maps internal repo names to their GitHub coordinates.
 *
 * @param repo - Repository name (e.g., 'workway-platform', 'Cloudflare')
 * @returns Tuple of [owner, repo]
 *
 * @example
 * ```typescript
 * parseRepo('workway-platform'); // ['WORKWAYCO', 'workway-platform']
 * parseRepo('Cloudflare');       // ['WORKWAYCO', 'WORKWAY']
 * parseRepo('unknown');          // ['WORKWAYCO', 'unknown']
 * ```
 */
export function parseRepo(repo: string): [string, string] {
	const mapping: Record<string, [string, string]> = {
		'workway-platform': ['WORKWAYCO', 'workway-platform'],
		Cloudflare: ['WORKWAYCO', 'WORKWAY'], // Cloudflare is inside WORKWAY repo
	};
	return mapping[repo] || ['WORKWAYCO', repo];
}
