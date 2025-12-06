/**
 * Configuration Utilities - Extract values from workflow installation configs
 *
 * User installation configurations can be stored in different formats:
 * - Direct format: { notionDatabaseId: "abc123" }
 * - Step-based format: { select_notion_database: { resourceId: "abc123" } }
 *
 * This module provides utilities to extract values regardless of format.
 *
 * @example
 * ```typescript
 * import { getConfigValue, extractResourceId } from '@workway/sdk'
 *
 * const config = installation.configuration
 *
 * // Try multiple paths to find the database ID
 * const databaseId = getConfigValue(config,
 *   'notionDatabaseId',
 *   'select_notion_database.resourceId'
 * )
 *
 * // Or use the shorthand for resource selection steps
 * const dbId = extractResourceId(config, 'select_notion_database')
 * ```
 */

// Note: parseJsonField from d1-helpers can be used alongside these utilities
// for handling JSON fields that come from D1 database queries

/**
 * Parse configuration that may be JSON string or object
 */
export function parseConfig<T = Record<string, unknown>>(
	config: unknown
): T | null {
	if (config === null || config === undefined) {
		return null;
	}

	if (typeof config === 'string') {
		try {
			return JSON.parse(config) as T;
		} catch {
			return null;
		}
	}

	if (typeof config === 'object') {
		return config as T;
	}

	return null;
}

/**
 * Get a value from config using dot-notation path
 *
 * @param obj - The config object
 * @param path - Dot-notation path (e.g., "select_notion_database.resourceId")
 * @returns The value at the path, or undefined
 */
export function getByPath(obj: unknown, path: string): unknown {
	if (!obj || typeof obj !== 'object') {
		return undefined;
	}

	const parts = path.split('.');
	let current: unknown = obj;

	for (const part of parts) {
		if (current === null || current === undefined) {
			return undefined;
		}
		if (typeof current !== 'object') {
			return undefined;
		}
		current = (current as Record<string, unknown>)[part];
	}

	return current;
}

/**
 * Get a config value, trying multiple paths in order
 *
 * Useful when configuration format varies based on how the user configured
 * the workflow (direct input vs step-based selection).
 *
 * @param config - The configuration object (may be string or object)
 * @param paths - Paths to try in order (first match wins)
 * @returns The first non-null/undefined value found, or null
 *
 * @example
 * ```typescript
 * // Support both formats:
 * // { notionDatabaseId: "abc" }
 * // { select_notion_database: { resourceId: "abc" } }
 * const dbId = getConfigValue(config,
 *   'notionDatabaseId',
 *   'select_notion_database.resourceId'
 * )
 * ```
 */
export function getConfigValue<T = unknown>(
	config: unknown,
	...paths: string[]
): T | null {
	const parsed = parseConfig(config);
	if (!parsed) {
		return null;
	}

	for (const path of paths) {
		const value = getByPath(parsed, path);
		if (value !== null && value !== undefined) {
			return value as T;
		}
	}

	return null;
}

/**
 * Extract a resource ID from a step-based configuration
 *
 * Step-based configs store selections as:
 * { [stepId]: { resourceId: "...", resourceName: "..." } }
 *
 * @param config - The configuration object
 * @param stepId - The step ID to extract from
 * @returns The resource ID or null
 *
 * @example
 * ```typescript
 * const notionDbId = extractResourceId(config, 'select_notion_database')
 * const slackChannelId = extractResourceId(config, 'select_slack_channel')
 * ```
 */
export function extractResourceId(
	config: unknown,
	stepId: string
): string | null {
	return getConfigValue<string>(config, `${stepId}.resourceId`);
}

/**
 * Extract resource name from a step-based configuration
 */
export function extractResourceName(
	config: unknown,
	stepId: string
): string | null {
	return getConfigValue<string>(config, `${stepId}.resourceName`);
}

/**
 * Extract full resource selection from step config
 */
export interface ResourceSelection {
	resourceId: string;
	resourceName?: string;
	metadata?: Record<string, unknown>;
}

export function extractResourceSelection(
	config: unknown,
	stepId: string
): ResourceSelection | null {
	const parsed = parseConfig(config);
	if (!parsed) {
		return null;
	}

	const step = getByPath(parsed, stepId);
	if (!step || typeof step !== 'object') {
		return null;
	}

	const selection = step as Record<string, unknown>;
	if (!selection.resourceId || typeof selection.resourceId !== 'string') {
		return null;
	}

	return {
		resourceId: selection.resourceId,
		resourceName:
			typeof selection.resourceName === 'string'
				? selection.resourceName
				: undefined,
		metadata:
			typeof selection.metadata === 'object'
				? (selection.metadata as Record<string, unknown>)
				: undefined,
	};
}

/**
 * Check if a config step has been completed
 */
export function isStepConfigured(config: unknown, stepId: string): boolean {
	const resourceId = extractResourceId(config, stepId);
	return resourceId !== null && resourceId.length > 0;
}

/**
 * Get all configured step IDs from a config
 */
export function getConfiguredSteps(config: unknown): string[] {
	const parsed = parseConfig(config);
	if (!parsed) {
		return [];
	}

	const steps: string[] = [];
	for (const [key, value] of Object.entries(parsed)) {
		if (
			value &&
			typeof value === 'object' &&
			'resourceId' in (value as Record<string, unknown>)
		) {
			steps.push(key);
		}
	}

	return steps;
}

/**
 * Merge configurations safely
 * Later configs override earlier ones
 */
export function mergeConfigs(
	...configs: unknown[]
): Record<string, unknown> | null {
	const result: Record<string, unknown> = {};

	for (const config of configs) {
		const parsed = parseConfig(config);
		if (parsed) {
			Object.assign(result, parsed);
		}
	}

	return Object.keys(result).length > 0 ? result : null;
}

/**
 * Type-safe config builder for creating installation configurations
 *
 * @example
 * ```typescript
 * const config = new ConfigBuilder()
 *   .setDirect('notionDatabaseId', 'abc123')
 *   .setResourceSelection('select_slack_channel', {
 *     resourceId: 'C123',
 *     resourceName: '#general'
 *   })
 *   .build()
 * ```
 */
export class ConfigBuilder {
	private config: Record<string, unknown> = {};

	/**
	 * Set a direct config value
	 */
	setDirect(key: string, value: unknown): this {
		this.config[key] = value;
		return this;
	}

	/**
	 * Set a resource selection (step-based format)
	 */
	setResourceSelection(
		stepId: string,
		selection: ResourceSelection
	): this {
		this.config[stepId] = selection;
		return this;
	}

	/**
	 * Build the final configuration object
	 */
	build(): Record<string, unknown> {
		return { ...this.config };
	}

	/**
	 * Build as JSON string (for D1 storage)
	 */
	toJSON(): string {
		return JSON.stringify(this.config);
	}
}

/**
 * Create a new config builder
 */
export function createConfigBuilder(): ConfigBuilder {
	return new ConfigBuilder();
}
