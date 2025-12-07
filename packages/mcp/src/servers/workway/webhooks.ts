/**
 * WORKWAY Webhook Operations
 *
 * Trigger test webhooks to simulate events from Sentry, Stripe, Typeform, etc.
 * Progressive disclosure: read this file when you need webhook testing.
 *
 * @example
 * ```typescript
 * import { webhooks } from './servers/workway';
 *
 * // Send a Sentry error event
 * const result = await webhooks.sentry({
 *   action: 'created',
 *   issue: {
 *     id: 'test-123',
 *     title: 'TypeError: Cannot read property',
 *     level: 'error'
 *   }
 * });
 *
 * // Only log success/failure (not full response)
 * console.log(`Sentry webhook: ${result.success ? 'OK' : 'FAILED'}`);
 * ```
 */

import { getConfig } from '../../config.js';

// ============================================================================
// TYPES
// ============================================================================

export interface WebhookResult {
	success: boolean;
	status: number;
	statusText: string;
	/** Response data (may be filtered to reduce context) */
	response?: unknown;
	/** Error message if failed */
	error?: string;
}

export interface SentryIssue {
	id: string;
	shortId?: string;
	title: string;
	culprit?: string;
	level: 'error' | 'warning' | 'info' | 'debug';
	count?: number;
	userCount?: number;
	firstSeen?: string;
	lastSeen?: string;
	permalink?: string;
	project?: { name: string };
}

export interface StripeEvent {
	type: string;
	data: {
		object: Record<string, unknown>;
	};
}

export interface TypeformResponse {
	event_id: string;
	event_type: 'form_response';
	form_response: {
		form_id: string;
		submitted_at: string;
		answers: Array<{
			field: { id: string; type: string };
			type: string;
			text?: string;
			email?: string;
			number?: number;
		}>;
	};
}

// ============================================================================
// OPERATIONS
// ============================================================================

/**
 * Send a raw webhook to any endpoint
 *
 * @example
 * ```typescript
 * const result = await webhooks.send({
 *   endpoint: '/webhooks/custom',
 *   payload: { event: 'test', data: { foo: 'bar' } },
 *   headers: { 'X-Custom-Header': 'value' }
 * });
 * ```
 */
export async function send(input: {
	endpoint: string;
	payload: unknown;
	headers?: Record<string, string>;
}): Promise<WebhookResult> {
	const config = getConfig();
	const url = `${config.apiUrl}${input.endpoint}`;

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...input.headers,
			},
			body: JSON.stringify(input.payload),
		});

		let responseData: unknown;
		const text = await response.text();
		try {
			responseData = JSON.parse(text);
		} catch {
			responseData = text;
		}

		return {
			success: response.ok,
			status: response.status,
			statusText: response.statusText,
			response: responseData,
		};
	} catch (error) {
		return {
			success: false,
			status: 0,
			statusText: 'Network Error',
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}

/**
 * Send a Sentry webhook event
 *
 * @example
 * ```typescript
 * // Simulate a new error
 * const result = await webhooks.sentry({
 *   action: 'created',
 *   issue: {
 *     id: 'test-' + Date.now(),
 *     title: 'TypeError: Cannot read property "foo" of undefined',
 *     level: 'error',
 *     culprit: 'app/components/Dashboard.tsx',
 *     permalink: 'https://sentry.io/issues/123'
 *   }
 * });
 *
 * console.log(`Sentry webhook: ${result.success ? 'OK' : result.error}`);
 * ```
 */
export async function sentry(input: {
	action: 'created' | 'resolved' | 'assigned' | 'ignored';
	issue: SentryIssue;
}): Promise<WebhookResult> {
	const payload = {
		action: input.action,
		resource: 'issue',
		data: {
			issue: {
				id: input.issue.id,
				shortId: input.issue.shortId || `TEST-${Date.now()}`,
				title: input.issue.title,
				culprit: input.issue.culprit || 'unknown',
				level: input.issue.level,
				count: input.issue.count || 1,
				userCount: input.issue.userCount || 1,
				firstSeen: input.issue.firstSeen || new Date().toISOString(),
				lastSeen: input.issue.lastSeen || new Date().toISOString(),
				permalink: input.issue.permalink || `https://sentry.io/issues/${input.issue.id}`,
				project: input.issue.project || { name: 'test-project' },
			},
		},
	};

	return send({ endpoint: '/webhooks/sentry', payload });
}

/**
 * Send a Stripe webhook event
 *
 * @example
 * ```typescript
 * // Simulate a successful payment
 * const result = await webhooks.stripe({
 *   type: 'payment_intent.succeeded',
 *   data: {
 *     object: {
 *       id: 'pi_test_123',
 *       amount: 2000,
 *       currency: 'usd',
 *       customer: 'cus_test_456'
 *     }
 *   }
 * });
 * ```
 */
export async function stripe(event: StripeEvent): Promise<WebhookResult> {
	const payload = {
		id: `evt_test_${Date.now()}`,
		object: 'event',
		api_version: '2023-10-16',
		created: Math.floor(Date.now() / 1000),
		type: event.type,
		data: event.data,
	};

	return send({ endpoint: '/webhooks/stripe', payload });
}

/**
 * Send a Typeform webhook response
 *
 * @example
 * ```typescript
 * const result = await webhooks.typeform({
 *   formId: 'abc123',
 *   answers: [
 *     { field: 'email', type: 'email', value: 'test@example.com' },
 *     { field: 'name', type: 'text', value: 'John Doe' }
 *   ]
 * });
 * ```
 */
export async function typeform(input: {
	formId: string;
	answers: Array<{
		field: string;
		type: 'text' | 'email' | 'number' | 'choice';
		value: string | number;
	}>;
}): Promise<WebhookResult> {
	const payload = {
		event_id: `evt_${Date.now()}`,
		event_type: 'form_response',
		form_response: {
			form_id: input.formId,
			submitted_at: new Date().toISOString(),
			answers: input.answers.map(a => ({
				field: { id: a.field, type: a.type },
				type: a.type,
				[a.type]: a.value,
			})),
		},
	};

	return send({ endpoint: '/webhooks/typeform', payload });
}

/**
 * Send a GitHub webhook event
 *
 * @example
 * ```typescript
 * // Simulate issue opened
 * const result = await webhooks.github({
 *   event: 'issues',
 *   action: 'opened',
 *   issue: {
 *     number: 42,
 *     title: 'Bug: Login not working',
 *     body: 'Users cannot log in'
 *   },
 *   repository: { full_name: 'org/repo' }
 * });
 * ```
 */
export async function github(input: {
	event: 'issues' | 'pull_request' | 'push' | 'issue_comment';
	action?: string;
	issue?: { number: number; title: string; body?: string };
	pull_request?: { number: number; title: string; body?: string };
	repository: { full_name: string };
}): Promise<WebhookResult> {
	const payload: Record<string, unknown> = {
		action: input.action,
		repository: {
			id: 123,
			full_name: input.repository.full_name,
			name: input.repository.full_name.split('/')[1],
			owner: { login: input.repository.full_name.split('/')[0] },
		},
		sender: { login: 'test-user', id: 456 },
	};

	if (input.issue) {
		payload.issue = {
			id: Date.now(),
			number: input.issue.number,
			title: input.issue.title,
			body: input.issue.body || '',
			state: 'open',
			user: { login: 'test-user', id: 456 },
		};
	}

	if (input.pull_request) {
		payload.pull_request = {
			id: Date.now(),
			number: input.pull_request.number,
			title: input.pull_request.title,
			body: input.pull_request.body || '',
			state: 'open',
			user: { login: 'test-user', id: 456 },
			head: { ref: 'feature-branch', sha: 'abc123' },
			base: { ref: 'main', sha: 'def456' },
		};
	}

	return send({
		endpoint: '/webhooks/github',
		payload,
		headers: { 'X-GitHub-Event': input.event },
	});
}

/**
 * Send a Calendly webhook event
 *
 * @example
 * ```typescript
 * const result = await webhooks.calendly({
 *   event: 'invitee.created',
 *   name: 'John Doe',
 *   email: 'john@example.com',
 *   eventType: 'Sales Call'
 * });
 * ```
 */
export async function calendly(input: {
	event: 'invitee.created' | 'invitee.canceled';
	name: string;
	email: string;
	eventType: string;
	startTime?: string;
}): Promise<WebhookResult> {
	const payload = {
		event: input.event,
		payload: {
			event_type: { name: input.eventType },
			invitee: {
				name: input.name,
				email: input.email,
			},
			event: {
				start_time: input.startTime || new Date(Date.now() + 86400000).toISOString(),
				end_time: input.startTime
					? new Date(new Date(input.startTime).getTime() + 3600000).toISOString()
					: new Date(Date.now() + 90000000).toISOString(),
			},
		},
	};

	return send({ endpoint: '/webhooks/calendly', payload });
}
