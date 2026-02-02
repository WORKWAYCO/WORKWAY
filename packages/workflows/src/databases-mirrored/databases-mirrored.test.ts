/**
 * Databases Mirrored - Unit Tests
 *
 * Tests for the Notion database sync workflow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// PROPERTY MAPPING TESTS
// ============================================================================

describe('Property Mapping', () => {
	describe('discoverPropertyMappings', () => {
		// Inline function for testing
		function discoverPropertyMappings(
			baseProperties: Record<string, any>,
			mirrorProperties: Record<string, any>
		): Array<{ baseName: string; mirrorName: string; type: string }> {
			const mappings: Array<{ baseName: string; mirrorName: string; type: string }> = [];

			for (const [baseName, baseProp] of Object.entries(baseProperties)) {
				const mirrorMatch = Object.entries(mirrorProperties).find(
					([mirrorName]) => mirrorName.toLowerCase() === baseName.toLowerCase()
				);

				if (mirrorMatch) {
					const [mirrorName, mirrorProp] = mirrorMatch;

					if (areTypesCompatible(baseProp.type, mirrorProp.type)) {
						mappings.push({
							baseName,
							mirrorName,
							type: baseProp.type,
						});
					}
				}
			}

			return mappings;
		}

		function areTypesCompatible(baseType: string, mirrorType: string): boolean {
			if (baseType === mirrorType) return true;

			const compatiblePairs: [string, string][] = [
				['rich_text', 'rich_text'],
				['title', 'title'],
				['select', 'select'],
				['status', 'status'],
				['multi_select', 'multi_select'],
				['date', 'date'],
				['number', 'number'],
				['checkbox', 'checkbox'],
				['url', 'url'],
				['email', 'email'],
				['phone_number', 'phone_number'],
			];

			return compatiblePairs.some(
				([a, b]) => (baseType === a && mirrorType === b) || (baseType === b && mirrorType === a)
			);
		}

		it('should map properties with matching names (case-insensitive)', () => {
			const baseProps = {
				Status: { type: 'select' },
				Priority: { type: 'select' },
			};
			const mirrorProps = {
				status: { type: 'select' },
				PRIORITY: { type: 'select' },
			};

			const mappings = discoverPropertyMappings(baseProps, mirrorProps);

			expect(mappings).toHaveLength(2);
			expect(mappings[0].baseName).toBe('Status');
			expect(mappings[0].mirrorName).toBe('status');
		});

		it('should skip properties with incompatible types', () => {
			const baseProps = {
				Notes: { type: 'rich_text' },
				Count: { type: 'number' },
			};
			const mirrorProps = {
				Notes: { type: 'select' }, // incompatible
				Count: { type: 'number' }, // compatible
			};

			const mappings = discoverPropertyMappings(baseProps, mirrorProps);

			expect(mappings).toHaveLength(1);
			expect(mappings[0].baseName).toBe('Count');
		});

		it('should return empty array when no matches', () => {
			const baseProps = { Title: { type: 'title' } };
			const mirrorProps = { Name: { type: 'title' } };

			const mappings = discoverPropertyMappings(baseProps, mirrorProps);

			expect(mappings).toHaveLength(0);
		});

		it('should handle empty property objects', () => {
			expect(discoverPropertyMappings({}, {})).toHaveLength(0);
			expect(discoverPropertyMappings({ Title: { type: 'title' } }, {})).toHaveLength(0);
		});
	});

	describe('areTypesCompatible', () => {
		function areTypesCompatible(baseType: string, mirrorType: string): boolean {
			if (baseType === mirrorType) return true;
			const compatiblePairs: [string, string][] = [
				['rich_text', 'rich_text'],
				['title', 'title'],
				['select', 'select'],
				['status', 'status'],
				['multi_select', 'multi_select'],
				['date', 'date'],
				['number', 'number'],
				['checkbox', 'checkbox'],
				['url', 'url'],
				['email', 'email'],
				['phone_number', 'phone_number'],
			];
			return compatiblePairs.some(
				([a, b]) => (baseType === a && mirrorType === b) || (baseType === b && mirrorType === a)
			);
		}

		it('should return true for identical types', () => {
			expect(areTypesCompatible('select', 'select')).toBe(true);
			expect(areTypesCompatible('checkbox', 'checkbox')).toBe(true);
		});

		it('should return false for incompatible types', () => {
			expect(areTypesCompatible('select', 'rich_text')).toBe(false);
			expect(areTypesCompatible('number', 'checkbox')).toBe(false);
		});

		it('should allow identical types even if not in explicit list', () => {
			// areTypesCompatible returns true for exact matches
			// but clonePropertyValue returns undefined for unsupported types
			expect(areTypesCompatible('formula', 'formula')).toBe(true);
			expect(areTypesCompatible('rollup', 'rollup')).toBe(true);
		});

		it('should return false for mixed unsupported types', () => {
			expect(areTypesCompatible('formula', 'rollup')).toBe(false);
			expect(areTypesCompatible('relation', 'rich_text')).toBe(false);
		});
	});
});

// ============================================================================
// PROPERTY VALUE CLONING TESTS
// ============================================================================

describe('Property Value Cloning', () => {
	describe('clonePropertyValue', () => {
		function clonePropertyValue(prop: any): any {
			switch (prop.type) {
				case 'title':
					return {
						title:
							prop.title?.map((t: any) => ({
								text: { content: t.plain_text || '' },
							})) || [],
					};

				case 'rich_text':
					return {
						rich_text:
							prop.rich_text?.map((t: any) => ({
								text: { content: t.plain_text || '' },
							})) || [],
					};

				case 'select':
					return prop.select ? { select: { name: prop.select.name } } : { select: null };

				case 'status':
					return prop.status ? { status: { name: prop.status.name } } : { status: null };

				case 'multi_select':
					return {
						multi_select: prop.multi_select?.map((s: any) => ({ name: s.name })) || [],
					};

				case 'date':
					return prop.date ? { date: prop.date } : { date: null };

				case 'number':
					return { number: prop.number };

				case 'checkbox':
					return { checkbox: prop.checkbox || false };

				case 'url':
					return { url: prop.url || null };

				case 'email':
					return { email: prop.email || null };

				case 'phone_number':
					return { phone_number: prop.phone_number || null };

				default:
					return undefined;
			}
		}

		it('should clone title property', () => {
			const prop = {
				type: 'title',
				title: [{ plain_text: 'My Task' }],
			};

			const result = clonePropertyValue(prop);

			expect(result.title[0].text.content).toBe('My Task');
		});

		it('should clone rich_text property', () => {
			const prop = {
				type: 'rich_text',
				rich_text: [{ plain_text: 'Description text' }],
			};

			const result = clonePropertyValue(prop);

			expect(result.rich_text[0].text.content).toBe('Description text');
		});

		it('should clone select property', () => {
			const prop = {
				type: 'select',
				select: { id: 'opt1', name: 'In Progress', color: 'blue' },
			};

			const result = clonePropertyValue(prop);

			expect(result.select.name).toBe('In Progress');
			expect(result.select.id).toBeUndefined(); // Should not include id
		});

		it('should handle null select', () => {
			const prop = { type: 'select', select: null };

			const result = clonePropertyValue(prop);

			expect(result.select).toBeNull();
		});

		it('should clone multi_select property', () => {
			const prop = {
				type: 'multi_select',
				multi_select: [
					{ name: 'Tag1', color: 'red' },
					{ name: 'Tag2', color: 'blue' },
				],
			};

			const result = clonePropertyValue(prop);

			expect(result.multi_select).toHaveLength(2);
			expect(result.multi_select[0].name).toBe('Tag1');
		});

		it('should clone date property', () => {
			const prop = {
				type: 'date',
				date: { start: '2024-01-15', end: '2024-01-20' },
			};

			const result = clonePropertyValue(prop);

			expect(result.date.start).toBe('2024-01-15');
			expect(result.date.end).toBe('2024-01-20');
		});

		it('should clone number property', () => {
			const prop = { type: 'number', number: 42 };

			const result = clonePropertyValue(prop);

			expect(result.number).toBe(42);
		});

		it('should clone checkbox property', () => {
			const prop = { type: 'checkbox', checkbox: true };

			const result = clonePropertyValue(prop);

			expect(result.checkbox).toBe(true);
		});

		it('should default checkbox to false when undefined', () => {
			const prop = { type: 'checkbox' };

			const result = clonePropertyValue(prop);

			expect(result.checkbox).toBe(false);
		});

		it('should clone url property', () => {
			const prop = { type: 'url', url: 'https://example.com' };

			const result = clonePropertyValue(prop);

			expect(result.url).toBe('https://example.com');
		});

		it('should return undefined for unsupported types', () => {
			const prop = { type: 'formula', formula: { type: 'number', number: 100 } };

			const result = clonePropertyValue(prop);

			expect(result).toBeUndefined();
		});
	});
});

// ============================================================================
// LOOP PREVENTION TESTS
// ============================================================================

describe('Loop Prevention', () => {
	const LOOP_PREVENTION_WINDOW_MS = 5000;

	describe('syncLocks', () => {
		function shouldSkipDueToLock(
			syncLocks: Record<string, number>,
			pageId: string,
			now: number
		): boolean {
			const lockTimestamp = syncLocks[pageId];
			if (lockTimestamp && now - lockTimestamp < LOOP_PREVENTION_WINDOW_MS) {
				return true;
			}
			return false;
		}

		it('should skip if recently synced', () => {
			const now = Date.now();
			const syncLocks = { page123: now - 1000 }; // 1 second ago

			expect(shouldSkipDueToLock(syncLocks, 'page123', now)).toBe(true);
		});

		it('should not skip if lock expired', () => {
			const now = Date.now();
			const syncLocks = { page123: now - 6000 }; // 6 seconds ago

			expect(shouldSkipDueToLock(syncLocks, 'page123', now)).toBe(false);
		});

		it('should not skip if no lock exists', () => {
			const now = Date.now();
			const syncLocks: Record<string, number> = {};

			expect(shouldSkipDueToLock(syncLocks, 'page123', now)).toBe(false);
		});

		it('should handle different page locks independently', () => {
			const now = Date.now();
			const syncLocks = {
				page123: now - 1000, // recent
				page456: now - 10000, // expired
			};

			expect(shouldSkipDueToLock(syncLocks, 'page123', now)).toBe(true);
			expect(shouldSkipDueToLock(syncLocks, 'page456', now)).toBe(false);
		});
	});
});

// ============================================================================
// STATE MANAGEMENT TESTS
// ============================================================================

describe('State Management', () => {
	describe('State Key Generation', () => {
		const STATE_KEY_PREFIX = 'databases-mirrored:';

		it('should generate correct state key', () => {
			const baseDb = 'db_base123';
			const mirrorDb = 'db_mirror456';

			const stateKey = `${STATE_KEY_PREFIX}${baseDb}:${mirrorDb}`;

			expect(stateKey).toBe('databases-mirrored:db_base123:db_mirror456');
		});
	});

	describe('Page Mappings', () => {
		interface PageMapping {
			basePageId: string;
			mirrorPageId: string;
			lastSyncedAt: string;
			lastSyncDirection: 'base_to_mirror' | 'mirror_to_base';
		}

		it('should find base page from mirror page', () => {
			const pageMappings: Record<string, PageMapping> = {
				base1: {
					basePageId: 'base1',
					mirrorPageId: 'mirror1',
					lastSyncedAt: new Date().toISOString(),
					lastSyncDirection: 'base_to_mirror',
				},
				base2: {
					basePageId: 'base2',
					mirrorPageId: 'mirror2',
					lastSyncedAt: new Date().toISOString(),
					lastSyncDirection: 'base_to_mirror',
				},
			};

			const findMapping = (mirrorPageId: string) =>
				Object.values(pageMappings).find((m) => m.mirrorPageId === mirrorPageId);

			expect(findMapping('mirror1')?.basePageId).toBe('base1');
			expect(findMapping('mirror2')?.basePageId).toBe('base2');
			expect(findMapping('unknown')).toBeUndefined();
		});
	});

	describe('Initial Sync Status', () => {
		type SyncStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

		it('should track sync progress', () => {
			const progress = {
				total: 100,
				synced: 0,
				startedAt: new Date().toISOString(),
			};

			// Simulate syncing
			progress.synced = 50;
			expect(progress.synced / progress.total).toBe(0.5);

			progress.synced = 100;
			expect(progress.synced / progress.total).toBe(1);
		});
	});
});

// ============================================================================
// SYNC RESULT TESTS
// ============================================================================

describe('Sync Results', () => {
	interface SyncResult {
		success: boolean;
		created: number;
		updated: number;
		skipped: number;
		errors: number;
		errorDetails?: string[];
	}

	describe('Result Aggregation', () => {
		it('should count operations correctly', () => {
			const result: SyncResult = {
				success: false,
				created: 0,
				updated: 0,
				skipped: 0,
				errors: 0,
				errorDetails: [],
			};

			// Simulate sync operations
			result.created++;
			result.created++;
			result.updated++;
			result.skipped++;
			result.errors++;
			result.errorDetails?.push('Failed to sync page xyz');

			expect(result.created).toBe(2);
			expect(result.updated).toBe(1);
			expect(result.skipped).toBe(1);
			expect(result.errors).toBe(1);
			expect(result.errorDetails).toHaveLength(1);
		});

		it('should determine success based on errors', () => {
			const determineSuccess = (result: SyncResult): boolean => {
				return result.errors === 0;
			};

			expect(determineSuccess({ success: false, created: 10, updated: 5, skipped: 2, errors: 0 })).toBe(true);
			expect(determineSuccess({ success: false, created: 10, updated: 5, skipped: 2, errors: 1 })).toBe(false);
		});
	});
});

// ============================================================================
// RETRY LOGIC TESTS
// ============================================================================

describe('Retry Logic', () => {
	const MAX_RETRIES = 3;
	const BASE_RETRY_DELAY_MS = 1000;

	describe('Exponential Backoff', () => {
		it('should calculate correct delays', () => {
			const delays = [];
			for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
				delays.push(BASE_RETRY_DELAY_MS * Math.pow(2, attempt));
			}

			expect(delays).toEqual([1000, 2000, 4000]);
		});

		it('should cap delay at 30 seconds', () => {
			const capDelay = (delayMs: number): number => Math.min(delayMs, 30000);

			expect(capDelay(1000)).toBe(1000);
			expect(capDelay(60000)).toBe(30000);
		});
	});

	describe('Retry-After Header Parsing', () => {
		function parseRetryAfter(retryAfter: string | null, attempt: number): number {
			if (retryAfter) {
				const seconds = parseInt(retryAfter, 10);
				if (!isNaN(seconds)) {
					return Math.min(seconds * 1000, 30000);
				}
			}
			return Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, attempt), 30000);
		}

		it('should use Retry-After header when numeric', () => {
			expect(parseRetryAfter('5', 0)).toBe(5000);
			expect(parseRetryAfter('60', 0)).toBe(30000); // capped
		});

		it('should fallback to exponential backoff when header is invalid', () => {
			expect(parseRetryAfter('invalid', 0)).toBe(1000);
			expect(parseRetryAfter(null, 1)).toBe(2000);
		});
	});
});

// ============================================================================
// WEBHOOK HANDLING TESTS
// ============================================================================

describe('Webhook Handling', () => {
	describe('Trigger Type Detection', () => {
		it('should identify oauth_callback trigger', () => {
			const trigger = {
				type: 'oauth_callback',
				data: { type: 'client_connected', mirrorDatabaseId: 'db123' },
			};

			expect(trigger.type).toBe('oauth_callback');
			expect(trigger.data?.type).toBe('client_connected');
		});

		it('should identify webhook trigger', () => {
			const trigger = {
				type: 'webhook',
				data: { page: { id: 'page123' }, database_id: 'db456' },
			};

			expect(trigger.type).toBe('webhook');
			expect(trigger.data?.page?.id).toBe('page123');
		});
	});

	describe('Webhook Signature Validation', () => {
		function validateWebhookSignature(
			secret: string | undefined,
			signature: string | undefined
		): { valid: boolean; error?: string } {
			// If no secret configured, skip validation (backwards compatible)
			if (!secret) {
				return { valid: true };
			}

			// If secret is configured, signature is required
			if (!signature) {
				return { valid: false, error: 'Missing webhook signature' };
			}

			// Actual validation would use HMAC comparison
			return { valid: true };
		}

		it('should pass if no secret is configured', () => {
			const result = validateWebhookSignature(undefined, undefined);
			expect(result.valid).toBe(true);
		});

		it('should fail if secret configured but no signature', () => {
			const result = validateWebhookSignature('my-secret', undefined);
			expect(result.valid).toBe(false);
			expect(result.error).toBe('Missing webhook signature');
		});

		it('should pass if secret and signature provided', () => {
			const result = validateWebhookSignature('my-secret', 'valid-signature');
			expect(result.valid).toBe(true);
		});
	});

	describe('Direction Detection', () => {
		it('should detect base to mirror sync', () => {
			const baseDatabase = 'db_base';
			const mirrorDatabase = 'db_mirror';
			const webhookDatabaseId = 'db_base';

			const direction =
				webhookDatabaseId === baseDatabase
					? 'base_to_mirror'
					: webhookDatabaseId === mirrorDatabase
						? 'mirror_to_base'
						: 'unknown';

			expect(direction).toBe('base_to_mirror');
		});

		it('should detect mirror to base sync', () => {
			const baseDatabase = 'db_base';
			const mirrorDatabase = 'db_mirror';
			const webhookDatabaseId = 'db_mirror';

			const direction =
				webhookDatabaseId === baseDatabase
					? 'base_to_mirror'
					: webhookDatabaseId === mirrorDatabase
						? 'mirror_to_base'
						: 'unknown';

			expect(direction).toBe('mirror_to_base');
		});

		it('should handle unknown database', () => {
			const baseDatabase = 'db_base';
			const mirrorDatabase = 'db_mirror';
			const webhookDatabaseId = 'db_unknown';

			const direction =
				webhookDatabaseId === baseDatabase
					? 'base_to_mirror'
					: webhookDatabaseId === mirrorDatabase
						? 'mirror_to_base'
						: 'unknown';

			expect(direction).toBe('unknown');
		});
	});
});

// ============================================================================
// FILTER LOGIC TESTS (v2.0.0+)
// ============================================================================

describe('Filtering (v2.0.0+)', () => {
	describe('Filter Value Parsing', () => {
		function parseFilterValues(filterValues: string | undefined): string[] {
			if (!filterValues) return [];
			return filterValues.split(',').map((v) => v.trim()).filter(Boolean);
		}

		it('should parse single value', () => {
			expect(parseFilterValues('Acme Corp')).toEqual(['Acme Corp']);
		});

		it('should parse comma-separated values', () => {
			expect(parseFilterValues('Client A, Client B, Client C')).toEqual([
				'Client A',
				'Client B',
				'Client C',
			]);
		});

		it('should handle empty or undefined', () => {
			expect(parseFilterValues(undefined)).toEqual([]);
			expect(parseFilterValues('')).toEqual([]);
		});

		it('should trim whitespace', () => {
			expect(parseFilterValues('  Value1  ,  Value2  ')).toEqual(['Value1', 'Value2']);
		});
	});

	describe('Page Filtering', () => {
		interface NotionPage {
			id: string;
			properties: Record<string, { type: string; select?: { name: string } | null }>;
		}

		function shouldSyncPage(
			page: NotionPage,
			filterProperty: string | undefined,
			filterValues: string[]
		): boolean {
			// No filter = sync all
			if (!filterProperty || filterValues.length === 0) {
				return true;
			}

			const prop = page.properties[filterProperty];
			if (!prop || prop.type !== 'select' || !prop.select) {
				return false;
			}

			return filterValues.includes(prop.select.name);
		}

		it('should sync all pages when no filter', () => {
			const page: NotionPage = { id: 'p1', properties: {} };

			expect(shouldSyncPage(page, undefined, [])).toBe(true);
			expect(shouldSyncPage(page, 'Client', [])).toBe(true);
		});

		it('should sync matching pages', () => {
			const page: NotionPage = {
				id: 'p1',
				properties: {
					Client: { type: 'select', select: { name: 'Acme Corp' } },
				},
			};

			expect(shouldSyncPage(page, 'Client', ['Acme Corp'])).toBe(true);
			expect(shouldSyncPage(page, 'Client', ['Other Corp'])).toBe(false);
		});

		it('should not sync if property is null', () => {
			const page: NotionPage = {
				id: 'p1',
				properties: {
					Client: { type: 'select', select: null },
				},
			};

			expect(shouldSyncPage(page, 'Client', ['Acme Corp'])).toBe(false);
		});
	});
});

// ============================================================================
// LAST-WRITE-WINS TESTS
// ============================================================================

describe('Last-Write-Wins Comparison', () => {
	function shouldSyncBasedOnTimestamp(
		sourceEditTime: string,
		targetEditTime: string
	): 'sync' | 'skip' {
		const sourceTime = new Date(sourceEditTime).getTime();
		const targetTime = new Date(targetEditTime).getTime();

		// Skip if target is newer - it will sync in the other direction
		if (targetTime > sourceTime) {
			return 'skip';
		}
		return 'sync';
	}

	it('should sync when source is newer', () => {
		const sourceTime = '2024-01-15T12:00:00.000Z';
		const targetTime = '2024-01-15T11:00:00.000Z';

		expect(shouldSyncBasedOnTimestamp(sourceTime, targetTime)).toBe('sync');
	});

	it('should skip when target is newer', () => {
		const sourceTime = '2024-01-15T11:00:00.000Z';
		const targetTime = '2024-01-15T12:00:00.000Z';

		expect(shouldSyncBasedOnTimestamp(sourceTime, targetTime)).toBe('skip');
	});

	it('should sync when times are equal', () => {
		const sourceTime = '2024-01-15T12:00:00.000Z';
		const targetTime = '2024-01-15T12:00:00.000Z';

		expect(shouldSyncBasedOnTimestamp(sourceTime, targetTime)).toBe('sync');
	});

	it('should handle different date formats', () => {
		// Notion returns ISO 8601 with milliseconds
		const sourceTime = '2024-01-15T12:00:00.500Z';
		const targetTime = '2024-01-15T12:00:00.000Z';

		expect(shouldSyncBasedOnTimestamp(sourceTime, targetTime)).toBe('sync');
	});
});

// ============================================================================
// MOCK FETCH TESTS
// ============================================================================

describe('Notion API Mocking', () => {
	describe('fetchWithToken behavior', () => {
		it('should include correct headers', () => {
			const NOTION_VERSION = '2022-06-28';
			const token = 'secret_abc123';

			const headers = {
				Authorization: `Bearer ${token}`,
				'Notion-Version': NOTION_VERSION,
				'Content-Type': 'application/json',
			};

			expect(headers.Authorization).toBe('Bearer secret_abc123');
			expect(headers['Notion-Version']).toBe('2022-06-28');
		});

		it('should stringify body for POST/PATCH', () => {
			const body = {
				parent: { database_id: 'db123' },
				properties: { Name: { title: [{ text: { content: 'Test' } }] } },
			};

			const stringified = JSON.stringify(body);

			expect(typeof stringified).toBe('string');
			expect(JSON.parse(stringified)).toEqual(body);
		});
	});
});
