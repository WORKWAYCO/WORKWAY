/**
 * API Endpoint Health Check Audit
 *
 * Verify all fetch() endpoint URLs are accessible.
 * Check status codes: 200 = working, 401 = needs auth (expected), others = investigate.
 * Validate HTTP methods (GET vs POST) match API requirements.
 * Report dead/broken endpoints.
 *
 * Priority: P1
 * Labels: audit, workflows, api-health
 */

import type { AuditConfig, AuditFinding, AuditReport, AuditExecutor } from './types';
import { createAuditReport, severityToPriority } from './types';
import { loadAllWorkflows } from './workflow-loader';

/**
 * Expected status codes for endpoint health
 */
const EXPECTED_HEALTHY_CODES = [200, 201, 204];
const EXPECTED_AUTH_REQUIRED_CODES = [401, 403]; // Auth required (expected for OAuth endpoints)
const SUSPICIOUS_CODES = [404, 500, 502, 503]; // Dead/broken endpoints

/**
 * Known WORKWAY internal endpoints (no health check needed)
 */
const INTERNAL_ENDPOINTS = [
	'zoom-cookie-sync.workway.co',
	'fireflies-notion.workway.co',
	'api.workway.co',
];

interface EndpointReference {
	url: string;
	method: string;
	line: number;
	context: string;
}

export class ApiEndpointHealthAuditor implements AuditExecutor {
	name = 'api-endpoint-health';
	description = 'Verify all fetch() endpoint URLs are accessible';

	async execute(config: AuditConfig): Promise<AuditReport> {
		const workflows = await loadAllWorkflows(config.workflowsPath);
		const findings: AuditFinding[] = [];

		for (const workflow of workflows) {
			// Extract all fetch() calls from workflow content
			const endpoints = this.extractEndpoints(workflow.content);

			for (const endpoint of endpoints) {
				// Skip internal WORKWAY endpoints (we trust our own infrastructure)
				if (this.isInternalEndpoint(endpoint.url)) {
					continue;
				}

				// Skip dynamic URLs (runtime-constructed)
				if (this.isDynamicUrl(endpoint.url)) {
					continue;
				}

				// Perform health check if not in dry-run mode
				if (!config.dryRun) {
					const healthStatus = await this.checkEndpointHealth(endpoint.url, endpoint.method);

					if (healthStatus.status === 'error') {
						findings.push({
							workflowId: workflow.metadata.id,
							workflowName: workflow.metadata.name,
							severity: 'high',
							category: 'api-endpoint-health',
							issue: `Endpoint appears broken: ${endpoint.url}`,
							recommendation: `Verify endpoint exists and is accessible. Status: ${healthStatus.statusCode} ${healthStatus.statusText}`,
							autoFixable: false,
							priority: severityToPriority('high'),
							labels: ['audit', 'workflows', 'api-health', 'broken-endpoint'],
							filePath: workflow.metadata.filePath,
							context: {
								url: endpoint.url,
								method: endpoint.method,
								statusCode: healthStatus.statusCode,
								statusText: healthStatus.statusText,
								line: endpoint.line,
								codeContext: endpoint.context,
							},
						});
					} else if (healthStatus.status === 'suspicious') {
						findings.push({
							workflowId: workflow.metadata.id,
							workflowName: workflow.metadata.name,
							severity: 'medium',
							category: 'api-endpoint-health',
							issue: `Endpoint returned suspicious status: ${healthStatus.statusCode}`,
							recommendation: `Investigate endpoint health. This may indicate configuration issues or deprecated API.`,
							autoFixable: false,
							priority: severityToPriority('medium'),
							labels: ['audit', 'workflows', 'api-health', 'suspicious'],
							filePath: workflow.metadata.filePath,
							context: {
								url: endpoint.url,
								method: endpoint.method,
								statusCode: healthStatus.statusCode,
								statusText: healthStatus.statusText,
								line: endpoint.line,
							},
						});
					}
				}

				// Check for HTTP method mismatches (e.g., using GET when POST is required)
				const methodIssue = this.checkMethodAppropriate(endpoint.url, endpoint.method, endpoint.context);
				if (methodIssue) {
					findings.push({
						workflowId: workflow.metadata.id,
						workflowName: workflow.metadata.name,
						severity: 'medium',
						category: 'api-endpoint-health',
						issue: methodIssue.issue,
						recommendation: methodIssue.recommendation,
						autoFixable: false,
						priority: severityToPriority('medium'),
						labels: ['audit', 'workflows', 'api-health', 'http-method'],
						filePath: workflow.metadata.filePath,
						context: {
							url: endpoint.url,
							method: endpoint.method,
							suggestedMethod: methodIssue.suggestedMethod,
							line: endpoint.line,
							codeContext: endpoint.context,
						},
					});
				}
			}
		}

		return createAuditReport(this.name, findings, workflows.length);
	}

	/**
	 * Extract all fetch() calls from workflow content
	 */
	private extractEndpoints(content: string): EndpointReference[] {
		const endpoints: EndpointReference[] = [];
		const lines = content.split('\n');

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];

			// Match fetch() calls
			const fetchMatch = line.match(/fetch\s*\(\s*[`'"](https?:\/\/[^`'"]+)[`'"]/);
			if (fetchMatch) {
				const url = fetchMatch[1];

				// Determine HTTP method (default GET if not specified)
				let method = 'GET';
				const methodMatch = line.match(/method:\s*['"](\w+)['"]/);
				if (methodMatch) {
					method = methodMatch[1].toUpperCase();
				}

				// Also check next few lines for method in options object
				for (let j = i; j < Math.min(i + 5, lines.length); j++) {
					const nextLine = lines[j];
					const nextMethodMatch = nextLine.match(/method:\s*['"](\w+)['"]/);
					if (nextMethodMatch) {
						method = nextMethodMatch[1].toUpperCase();
						break;
					}
				}

				endpoints.push({
					url,
					method,
					line: i + 1,
					context: line.trim(),
				});
			}

			// Match template literal fetch calls
			const templateMatch = line.match(/fetch\s*\(\s*`(https?:\/\/[^`]+)`/);
			if (templateMatch && !fetchMatch) {
				const url = templateMatch[1];
				let method = 'GET';

				// Check for method in same line or nearby lines
				const methodMatch = line.match(/method:\s*['"](\w+)['"]/);
				if (methodMatch) {
					method = methodMatch[1].toUpperCase();
				}

				// Only include if URL doesn't contain ${} placeholders
				if (!url.includes('${')) {
					endpoints.push({
						url,
						method,
						line: i + 1,
						context: line.trim(),
					});
				}
			}
		}

		return endpoints;
	}

	/**
	 * Check if URL is a WORKWAY internal endpoint
	 */
	private isInternalEndpoint(url: string): boolean {
		return INTERNAL_ENDPOINTS.some(internal => url.includes(internal));
	}

	/**
	 * Check if URL is dynamically constructed (contains variables)
	 */
	private isDynamicUrl(url: string): boolean {
		// Check for common variable patterns
		return url.includes('${') || url.includes('config.') || url.includes('inputs.');
	}

	/**
	 * Perform health check on endpoint
	 */
	private async checkEndpointHealth(url: string, method: string): Promise<{
		status: 'healthy' | 'auth_required' | 'suspicious' | 'error';
		statusCode: number;
		statusText: string;
	}> {
		try {
			const response = await fetch(url, {
				method: method === 'GET' ? 'HEAD' : method, // Use HEAD for GET to avoid downloading body
				// Don't send auth headers - we're just checking if endpoint exists
				signal: AbortSignal.timeout(5000), // 5 second timeout
			});

			const statusCode = response.status;
			const statusText = response.statusText;

			if (EXPECTED_HEALTHY_CODES.includes(statusCode)) {
				return { status: 'healthy', statusCode, statusText };
			}

			if (EXPECTED_AUTH_REQUIRED_CODES.includes(statusCode)) {
				return { status: 'auth_required', statusCode, statusText };
			}

			if (SUSPICIOUS_CODES.includes(statusCode)) {
				return { status: 'error', statusCode, statusText };
			}

			return { status: 'suspicious', statusCode, statusText };
		} catch (error) {
			// Network error, DNS failure, timeout, etc.
			return {
				status: 'error',
				statusCode: 0,
				statusText: error instanceof Error ? error.message : 'Unknown error',
			};
		}
	}

	/**
	 * Check if HTTP method is appropriate for the endpoint
	 */
	private checkMethodAppropriate(
		url: string,
		method: string,
		context: string
	): { issue: string; recommendation: string; suggestedMethod: string } | null {
		// Check for common patterns that suggest wrong method

		// POST indicators in URL or context
		if ((url.includes('/create') || url.includes('/update') || url.includes('/delete') || context.includes('body:')) && method === 'GET') {
			return {
				issue: `Using GET for endpoint that appears to modify data: ${url}`,
				recommendation: 'Use POST, PUT, or DELETE for data modification endpoints',
				suggestedMethod: 'POST',
			};
		}

		// GET indicators but using POST
		if ((url.includes('/list') || url.includes('/get') || url.includes('/fetch')) && method === 'POST' && !context.includes('body:')) {
			return {
				issue: `Using POST for endpoint that appears to be read-only: ${url}`,
				recommendation: 'Use GET for read-only operations unless API requires POST',
				suggestedMethod: 'GET',
			};
		}

		return null;
	}
}
