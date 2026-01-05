/**
 * Workflow Loader - Utility for loading and parsing all workflows
 */

import * as fs from 'fs';
import * as path from 'path';
import type { WorkflowMetadata } from './types';

export interface LoadedWorkflow {
	metadata: WorkflowMetadata;
	content: string;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	definition?: any; // The actual workflow definition if we can parse it
}

/**
 * Load all workflows from the workflows directory
 */
export async function loadAllWorkflows(workflowsPath: string): Promise<LoadedWorkflow[]> {
	const workflows: LoadedWorkflow[] = [];

	// Get all workflow directories
	const workflowDirs = fs
		.readdirSync(workflowsPath, { withFileTypes: true })
		.filter(dirent => dirent.isDirectory())
		.map(dirent => dirent.name);

	for (const workflowDir of workflowDirs) {
		const workflowPath = path.join(workflowsPath, workflowDir);
		const indexPath = path.join(workflowPath, 'index.ts');

		if (!fs.existsSync(indexPath)) {
			continue;
		}

		const content = fs.readFileSync(indexPath, 'utf-8');

		// Extract basic metadata from the file
		const metadata: WorkflowMetadata = {
			id: workflowDir,
			name: extractNameFromContent(content) || workflowDir,
			description: extractDescriptionFromContent(content),
			version: extractVersionFromContent(content),
			filePath: indexPath,
		};

		// Try to parse the actual workflow definition
		// Note: This is a simplified approach - in production we'd use proper TypeScript parsing
		try {
			// Extract metadata export
			const metadataMatch = content.match(/export const metadata\s*=\s*({[\s\S]*?});/);
			if (metadataMatch) {
				// Basic extraction - in production use proper AST parser
				const metadataStr = metadataMatch[1];
				const categoryMatch = metadataStr.match(/category:\s*['"]([^'"]+)['"]/);
				const featuredMatch = metadataStr.match(/featured:\s*(true|false)/);
				const visibilityMatch = metadataStr.match(/visibility:\s*['"]([^'"]+)['"]/);

				if (categoryMatch) metadata.category = categoryMatch[1];
				if (featuredMatch) metadata.featured = featuredMatch[1] === 'true';
				if (visibilityMatch) metadata.visibility = visibilityMatch[1] as 'public' | 'private';
			}
		} catch {
			// Ignore parsing errors
		}

		workflows.push({
			metadata,
			content,
		});
	}

	return workflows;
}

function extractNameFromContent(content: string): string | undefined {
	const nameMatch = content.match(/name:\s*['"]([^'"]+)['"]/);
	return nameMatch?.[1];
}

function extractDescriptionFromContent(content: string): string | undefined {
	const descMatch = content.match(/description:\s*['"]([^'"]+)['"]/);
	return descMatch?.[1];
}

function extractVersionFromContent(content: string): string | undefined {
	const versionMatch = content.match(/version:\s*['"]([^'"]+)['"]/);
	return versionMatch?.[1];
}

/**
 * Extract pathway configuration from workflow content
 */
export function extractPathway(content: string): Record<string, unknown> | null {
	const pathwayMatch = content.match(/pathway:\s*({[\s\S]*?\n\t})/);
	if (!pathwayMatch) return null;

	try {
		// This is a simplified extraction - in production use proper AST parsing
		const pathwayStr = pathwayMatch[1];

		// Extract key fields using regex (not perfect but works for our use case)
		const result: Record<string, unknown> = {};

		// Extract discoveryMoments
		const discoveryMatch = pathwayStr.match(/discoveryMoments:\s*(\[[^\]]+\])/);
		if (discoveryMatch) {
			result.discoveryMoments = discoveryMatch[1];
		}

		// Extract smartDefaults
		const smartDefaultsMatch = pathwayStr.match(/smartDefaults:\s*({[^}]+})/);
		if (smartDefaultsMatch) {
			result.smartDefaults = smartDefaultsMatch[1];
		}

		// Extract essentialFields
		const essentialFieldsMatch = pathwayStr.match(/essentialFields:\s*(\[[^\]]*\])/);
		if (essentialFieldsMatch) {
			result.essentialFields = essentialFieldsMatch[1];
		}

		return result;
	} catch {
		return null;
	}
}

/**
 * Extract integrations configuration from workflow content
 */
export function extractIntegrations(content: string): Array<{ service: string; scopes: string[]; optional?: boolean }> {
	const integrationsMatch = content.match(/integrations:\s*(\[[^\]]+\])/s);
	if (!integrationsMatch) return [];

	const result: Array<{ service: string; scopes: string[]; optional?: boolean }> = [];

	// Extract each integration object
	const integrationRegex = /{\s*service:\s*['"]([^'"]+)['"],\s*scopes:\s*(\[[^\]]+\])(,\s*optional:\s*(true|false))?\s*}/g;
	let match;

	while ((match = integrationRegex.exec(integrationsMatch[1])) !== null) {
		const service = match[1];
		const scopesStr = match[2];
		const optional = match[4] === 'true';

		// Extract scopes array
		const scopes: string[] = [];
		const scopeRegex = /['"]([^'"]+)['"]/g;
		let scopeMatch;
		while ((scopeMatch = scopeRegex.exec(scopesStr)) !== null) {
			scopes.push(scopeMatch[1]);
		}

		result.push({ service, scopes, optional });
	}

	return result;
}

/**
 * Extract inputs configuration from workflow content
 */
export function extractInputs(content: string): Record<string, { type: string; label: string; description?: string; default?: unknown }> {
	const inputsMatch = content.match(/inputs:\s*({[\s\S]*?\n\t})/);
	if (!inputsMatch) return {};

	const result: Record<string, { type: string; label: string; description?: string; default?: unknown }> = {};

	// This is a simplified extraction
	const inputRegex = /(\w+):\s*{[\s\S]*?type:\s*['"]([^'"]+)['"],[\s\S]*?label:\s*['"]([^'"]+)['"][\s\S]*?}/g;
	let match;

	while ((match = inputRegex.exec(inputsMatch[1])) !== null) {
		const fieldName = match[1];
		const type = match[2];
		const label = match[3];

		// Try to extract description
		const fieldBlock = match[0];
		const descMatch = fieldBlock.match(/description:\s*['"]([^'"]+)['"]/);
		const defaultMatch = fieldBlock.match(/default:\s*([^,}\n]+)/);

		result[fieldName] = {
			type,
			label,
			description: descMatch?.[1],
			default: defaultMatch?.[1],
		};
	}

	return result;
}
