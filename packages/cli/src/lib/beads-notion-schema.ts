/**
 * Beads → Notion Database Schema
 *
 * Defines the Notion database properties for syncing Beads issues.
 * Following Zuhandenheit: the schema enables visibility without mechanism awareness.
 */

import type { BeadsIssue, BeadsStatus } from '../types/index.js';

/**
 * Notion database schema for Beads issues
 *
 * Used when creating a new database via Notion API.
 */
export const BEADS_DATABASE_SCHEMA = {
	Title: { title: {} },
	'Beads ID': { rich_text: {} },
	Description: { rich_text: {} },
	Status: {
		status: {
			options: [
				{ name: 'Open', color: 'blue' },
				{ name: 'In Progress', color: 'yellow' },
				{ name: 'Code Complete', color: 'orange' },
				{ name: 'Verified', color: 'purple' },
				{ name: 'Closed', color: 'green' },
			],
		},
	},
	Priority: {
		select: {
			options: [
				{ name: 'P0', color: 'red' },
				{ name: 'P1', color: 'orange' },
				{ name: 'P2', color: 'yellow' },
				{ name: 'P3', color: 'blue' },
				{ name: 'P4', color: 'gray' },
			],
		},
	},
	Type: {
		select: {
			options: [
				{ name: 'feature', color: 'green' },
				{ name: 'bug', color: 'red' },
				{ name: 'task', color: 'blue' },
				{ name: 'refactor', color: 'purple' },
				{ name: 'docs', color: 'gray' },
				{ name: 'chore', color: 'brown' },
				{ name: 'experiment', color: 'pink' },
			],
		},
	},
	Labels: { multi_select: {} },
	Repository: {
		select: {
			options: [
				{ name: 'Cloudflare', color: 'orange' },
				{ name: 'workway-platform', color: 'blue' },
			],
		},
	},
	Created: { date: {} },
	Updated: { date: {} },
	Closed: { date: {} },
	'Close Reason': { rich_text: {} },
};

/**
 * Map Beads status to Notion status name
 */
export function mapBeadsStatusToNotion(status: BeadsStatus): string {
	const mapping: Record<string, string> = {
		open: 'Open',
		in_progress: 'In Progress',
		'in-progress': 'In Progress',
		code_complete: 'Code Complete',
		'code-complete': 'Code Complete',
		verified: 'Verified',
		closed: 'Closed',
	};
	return mapping[status] || 'Open';
}

/**
 * Determine repository from Beads issue ID
 */
export function getRepositoryFromId(issueId: string): string {
	if (issueId.startsWith('ww-') || issueId.startsWith('WORKWAY-')) {
		return 'Cloudflare';
	}
	if (issueId.startsWith('wwp-')) {
		return 'workway-platform';
	}
	// Default fallback
	return 'Cloudflare';
}

/**
 * Map Beads issue to Notion page properties
 *
 * Transforms a BeadsIssue into the format expected by Notion API.
 */
export function mapBeadsToNotionProperties(
	issue: BeadsIssue
): Record<string, unknown> {
	return {
		Title: {
			title: [{ text: { content: issue.title } }],
		},
		'Beads ID': {
			rich_text: [{ text: { content: issue.id } }],
		},
		Description: {
			rich_text: issue.description
				? [{ text: { content: issue.description.slice(0, 2000) } }]
				: [],
		},
		Status: {
			status: { name: mapBeadsStatusToNotion(issue.status) },
		},
		Priority: {
			select:
				issue.priority !== undefined
					? { name: `P${issue.priority}` }
					: { name: 'P2' },
		},
		Type: issue.issue_type
			? { select: { name: issue.issue_type } }
			: undefined,
		Labels: {
			multi_select: (issue.labels || []).map((label) => ({ name: label })),
		},
		Repository: {
			select: { name: getRepositoryFromId(issue.id) },
		},
		Created: issue.created_at
			? { date: { start: issue.created_at } }
			: undefined,
		Updated: issue.updated_at
			? { date: { start: issue.updated_at } }
			: undefined,
		Closed: issue.closed_at
			? { date: { start: issue.closed_at } }
			: undefined,
		'Close Reason': issue.close_reason
			? { rich_text: [{ text: { content: issue.close_reason.slice(0, 2000) } }] }
			: { rich_text: [] },
	};
}

/**
 * Extract Beads ID from a Notion page
 */
export function extractBeadsIdFromPage(page: any): string | null {
	const beadsIdProp = page.properties?.['Beads ID'];
	if (!beadsIdProp?.rich_text?.[0]?.plain_text) {
		return null;
	}
	return beadsIdProp.rich_text[0].plain_text;
}

/**
 * Extract updated timestamp from Notion page
 */
export function extractNotionUpdatedAt(page: any): string | null {
	return page.last_edited_time || null;
}
