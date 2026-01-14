/**
 * Beads → Notion Sync Logic
 *
 * Core functions for syncing Beads issues to a Notion database.
 * Zuhandenheit: Issues appear in Notion. The mechanism recedes.
 */

import fs from 'fs-extra';
import path from 'path';
import readline from 'readline';
import type { BeadsIssue, BeadsSyncResult } from '../types/index.js';
import {
	mapBeadsToNotionProperties,
	extractBeadsIdFromPage,
	BEADS_DATABASE_SCHEMA,
} from './beads-notion-schema.js';

// ============================================================================
// REPO PATHS
// ============================================================================

/**
 * Default paths to Beads issue files
 */
export const BEADS_REPO_PATHS = {
	workway: '/Users/micahjohnson/Documents/Github/WORKWAY/.beads/issues.jsonl',
	cloudflare: '/Users/micahjohnson/Documents/Github/WORKWAY/Cloudflare/.beads/issues.jsonl',
	'workway-platform': '/Users/micahjohnson/Documents/Github/WORKWAY/workway-platform/.beads/issues.jsonl',
};

// ============================================================================
// READ ISSUES
// ============================================================================

/**
 * Read Beads issues from a JSONL file
 *
 * Parses `.beads/issues.jsonl` line by line for memory efficiency.
 */
export async function readBeadsIssues(filePath: string): Promise<BeadsIssue[]> {
	if (!(await fs.pathExists(filePath))) {
		return [];
	}

	const issues: BeadsIssue[] = [];
	const fileStream = fs.createReadStream(filePath);

	const rl = readline.createInterface({
		input: fileStream,
		crlfDelay: Infinity,
	});

	for await (const line of rl) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		try {
			const issue = JSON.parse(trimmed) as BeadsIssue;
			// Skip tombstones (deleted issues)
			if ((issue as any).tombstone) continue;
			issues.push(issue);
		} catch {
			// Skip malformed lines
		}
	}

	return issues;
}

/**
 * Read issues from all configured repos
 */
export async function readAllBeadsIssues(): Promise<BeadsIssue[]> {
	const allIssues: BeadsIssue[] = [];

	for (const [, filePath] of Object.entries(BEADS_REPO_PATHS)) {
		const issues = await readBeadsIssues(filePath);
		allIssues.push(...issues);
	}

	return allIssues;
}

// ============================================================================
// NOTION API HELPERS
// ============================================================================

interface NotionClient {
	accessToken: string;
	notionVersion?: string;
}

const NOTION_API_URL = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

/**
 * Make a request to the Notion API
 */
async function notionRequest(
	client: NotionClient,
	method: string,
	endpoint: string,
	body?: unknown
): Promise<any> {
	const response = await fetch(`${NOTION_API_URL}${endpoint}`, {
		method,
		headers: {
			Authorization: `Bearer ${client.accessToken}`,
			'Notion-Version': client.notionVersion || NOTION_VERSION,
			'Content-Type': 'application/json',
		},
		body: body ? JSON.stringify(body) : undefined,
	});

	if (!response.ok) {
		const errorData = await response.json().catch(() => ({})) as { message?: string };
		throw new Error(
			`Notion API error: ${response.status} ${response.statusText}` +
				(errorData.message ? ` - ${errorData.message}` : '')
		);
	}

	return response.json();
}

/**
 * Create a Notion database for Beads issues
 */
export async function createBeadsDatabase(
	client: NotionClient,
	parentPageId: string,
	title: string = 'WORKWAY Issues'
): Promise<{ id: string; url: string }> {
	const result = await notionRequest(client, 'POST', '/databases', {
		parent: { page_id: parentPageId },
		title: [{ text: { content: title } }],
		properties: BEADS_DATABASE_SCHEMA,
	});

	return {
		id: result.id,
		url: result.url,
	};
}

/**
 * Query existing pages from the database by Beads ID
 *
 * Returns a map of Beads ID → Notion page data
 */
export async function queryExistingPages(
	client: NotionClient,
	databaseId: string
): Promise<Map<string, { pageId: string; lastEditedTime: string }>> {
	const pageMap = new Map<string, { pageId: string; lastEditedTime: string }>();
	let startCursor: string | undefined;

	do {
		const body: any = {
			page_size: 100,
			filter: {
				property: 'Beads ID',
				rich_text: { is_not_empty: true },
			},
		};

		if (startCursor) {
			body.start_cursor = startCursor;
		}

		const result = await notionRequest(
			client,
			'POST',
			`/databases/${databaseId}/query`,
			body
		);

		for (const page of result.results) {
			const beadsId = extractBeadsIdFromPage(page);
			if (beadsId) {
				pageMap.set(beadsId, {
					pageId: page.id,
					lastEditedTime: page.last_edited_time,
				});
			}
		}

		startCursor = result.has_more ? result.next_cursor : undefined;
	} while (startCursor);

	return pageMap;
}

/**
 * Create a page in the database
 */
async function createPage(
	client: NotionClient,
	databaseId: string,
	properties: Record<string, unknown>
): Promise<{ id: string }> {
	// Filter out undefined properties
	const cleanProps: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(properties)) {
		if (value !== undefined) {
			cleanProps[key] = value;
		}
	}

	const result = await notionRequest(client, 'POST', '/pages', {
		parent: { database_id: databaseId },
		properties: cleanProps,
	});

	return { id: result.id };
}

/**
 * Update a page in the database
 */
async function updatePage(
	client: NotionClient,
	pageId: string,
	properties: Record<string, unknown>
): Promise<void> {
	// Filter out undefined properties
	const cleanProps: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(properties)) {
		if (value !== undefined) {
			cleanProps[key] = value;
		}
	}

	await notionRequest(client, 'PATCH', `/pages/${pageId}`, {
		properties: cleanProps,
	});
}

// ============================================================================
// SYNC LOGIC
// ============================================================================

export interface SyncOptions {
	dryRun?: boolean;
	forceUpdate?: boolean;
}

/**
 * Sync Beads issues to Notion database
 *
 * Creates new pages for new issues, updates existing pages if changed.
 * Uses Beads ID for deduplication.
 */
export async function syncIssuesToNotion(
	client: NotionClient,
	databaseId: string,
	issues: BeadsIssue[],
	options: SyncOptions = {}
): Promise<BeadsSyncResult> {
	const { dryRun = false, forceUpdate = false } = options;

	const result: BeadsSyncResult = {
		created: 0,
		updated: 0,
		skipped: 0,
		errors: [],
	};

	// Get existing pages
	const existingPages = await queryExistingPages(client, databaseId);

	for (const issue of issues) {
		try {
			const properties = mapBeadsToNotionProperties(issue);
			const existing = existingPages.get(issue.id);

			if (existing) {
				// Check if update is needed
				const issueUpdated = issue.updated_at || issue.created_at;
				const notionUpdated = existing.lastEditedTime;

				// Compare timestamps - update if Beads is newer or force update
				const needsUpdate =
					forceUpdate ||
					(issueUpdated && new Date(issueUpdated) > new Date(notionUpdated));

				if (needsUpdate) {
					if (!dryRun) {
						await updatePage(client, existing.pageId, properties);
					}
					result.updated++;
				} else {
					result.skipped++;
				}
			} else {
				// Create new page
				if (!dryRun) {
					await createPage(client, databaseId, properties);
				}
				result.created++;
			}
		} catch (error) {
			result.errors.push({
				issueId: issue.id,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return result;
}

/**
 * Full sync from all repos
 */
export async function syncAllRepos(
	client: NotionClient,
	databaseId: string,
	options: SyncOptions = {}
): Promise<BeadsSyncResult> {
	const issues = await readAllBeadsIssues();
	return syncIssuesToNotion(client, databaseId, issues, options);
}
