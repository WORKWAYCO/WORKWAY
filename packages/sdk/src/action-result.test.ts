/**
 * ActionResult Tests
 *
 * Tests for the ActionResult pattern - the "narrow waist" for integration data.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	ActionResult,
	createActionResult,
	isActionResult,
	unwrapResult,
	areResultsCompatible,
	getErrorMessage,
	getErrorCode,
	hasErrorCode,
	isFailure,
	isSuccess,
	type ActionCapabilities,
	type StandardMessage,
	type StandardTask,
	type StandardDocument,
	type StandardEvent,
	type StandardList,
} from './action-result.js';
import { ErrorCode } from './integration-error.js';

// ============================================================================
// ACTIONRESULT.SUCCESS TESTS
// ============================================================================

describe('ActionResult.success', () => {
	it('should create a successful result with data', () => {
		const data = { id: '123', name: 'Test' };
		const result = ActionResult.success(data);

		expect(result.success).toBe(true);
		expect(result.data).toEqual(data);
		expect(result.error).toBeUndefined();
	});

	it('should include default metadata', () => {
		const result = ActionResult.success({ id: '123' });

		expect(result.metadata.source.integration).toBe('sdk');
		expect(result.metadata.source.action).toBe('unknown');
		expect(result.metadata.schema).toBe('sdk.result.v1');
		expect(typeof result.metadata.timestamp).toBe('number');
	});

	it('should include custom metadata when provided', () => {
		const result = ActionResult.success(
			{ id: '123' },
			{
				integration: 'gmail',
				action: 'send-email',
				schema: 'gmail.email.v1',
			}
		);

		expect(result.metadata.source.integration).toBe('gmail');
		expect(result.metadata.source.action).toBe('send-email');
		expect(result.metadata.schema).toBe('gmail.email.v1');
	});

	it('should include capabilities when provided', () => {
		const capabilities: ActionCapabilities = {
			canHandleText: true,
			canHandleAttachments: true,
			supportsPagination: true,
		};

		const result = ActionResult.success({ id: '123' }, { capabilities });

		expect(result.capabilities).toEqual(capabilities);
	});

	it('should use empty capabilities by default', () => {
		const result = ActionResult.success({ id: '123' });
		expect(result.capabilities).toEqual({});
	});

	it('should handle null data', () => {
		const result = ActionResult.success(null);
		expect(result.success).toBe(true);
		expect(result.data).toBeNull();
	});

	it('should handle array data', () => {
		const data = [{ id: '1' }, { id: '2' }, { id: '3' }];
		const result = ActionResult.success(data);
		expect(result.data).toEqual(data);
		expect(result.data).toHaveLength(3);
	});
});

// ============================================================================
// ACTIONRESULT.ERROR TESTS
// ============================================================================

describe('ActionResult.error', () => {
	it('should create a failed result with error details', () => {
		const result = ActionResult.error('Not found', ErrorCode.NOT_FOUND);

		expect(result.success).toBe(false);
		expect(result.error?.message).toBe('Not found');
		expect(result.error?.code).toBe('not_found');
	});

	it('should include metadata with error schema', () => {
		const result = ActionResult.error('Error', 'test_error');

		expect(result.metadata.schema).toBe('sdk.error.v1');
		expect(typeof result.metadata.timestamp).toBe('number');
	});

	it('should include custom integration and action', () => {
		const result = ActionResult.error('Auth failed', ErrorCode.AUTH_INVALID, {
			integration: 'slack',
			action: 'send-message',
		});

		expect(result.metadata.source.integration).toBe('slack');
		expect(result.metadata.source.action).toBe('send-message');
	});

	it('should have null data by default', () => {
		const result = ActionResult.error('Error', 'test_error');
		expect(result.data).toBeNull();
	});

	it('should include partial data when provided', () => {
		const result = ActionResult.error('Partial failure', 'partial_error', {
			data: { processed: 5, failed: 2 },
		});

		expect(result.data).toEqual({ processed: 5, failed: 2 });
	});

	it('should have empty capabilities', () => {
		const result = ActionResult.error('Error', 'test_error');
		expect(result.capabilities).toEqual({});
	});
});

// ============================================================================
// CREATEACTIONRESULT TESTS
// ============================================================================

describe('createActionResult', () => {
	it('should create success result with simplified pattern', () => {
		const result = createActionResult({
			success: true,
			data: { id: '123' },
		});

		expect(result.success).toBe(true);
		expect(result.data).toEqual({ id: '123' });
	});

	it('should create failure result with simplified pattern', () => {
		const result = createActionResult({
			success: false,
			error: { message: 'Failed', code: ErrorCode.API_ERROR },
		});

		expect(result.success).toBe(false);
		expect(result.error?.message).toBe('Failed');
		expect(result.error?.code).toBe('api_error');
	});

	it('should create full result with all metadata', () => {
		const result = createActionResult({
			data: { subject: 'Hello', body: 'World' },
			integration: 'gmail',
			action: 'send-email',
			schema: 'gmail.email.v1',
			capabilities: { canHandleText: true, canHandleHtml: true },
		});

		expect(result.success).toBe(true);
		expect(result.data).toEqual({ subject: 'Hello', body: 'World' });
		expect(result.metadata.source.integration).toBe('gmail');
		expect(result.metadata.source.action).toBe('send-email');
		expect(result.metadata.schema).toBe('gmail.email.v1');
		expect(result.capabilities.canHandleText).toBe(true);
		expect(result.capabilities.canHandleHtml).toBe(true);
	});

	it('should include standard data when provided', () => {
		const standard: StandardMessage = {
			type: 'message',
			id: '123',
			title: 'Subject',
			body: 'Content',
			timestamp: Date.now(),
			metadata: {},
		};

		const result = createActionResult({
			data: { id: '123', raw: 'data' },
			integration: 'gmail',
			action: 'fetch-email',
			schema: 'gmail.email.v1',
			capabilities: { canHandleText: true },
			standard,
		});

		expect(result.standard).toEqual(standard);
	});

	it('should include rate limit info when provided', () => {
		const result = createActionResult({
			data: [],
			integration: 'slack',
			action: 'list-channels',
			schema: 'slack.channel-list.v1',
			capabilities: { supportsPagination: true },
			rateLimit: {
				remaining: 50,
				reset: Date.now() + 60000,
				limit: 100,
			},
		});

		expect(result.metadata.rateLimit?.remaining).toBe(50);
		expect(result.metadata.rateLimit?.limit).toBe(100);
	});

	it('should include cost info when provided', () => {
		const result = createActionResult({
			data: { tokens: 150 },
			integration: 'openai',
			action: 'complete',
			schema: 'openai.completion.v1',
			capabilities: { canHandleText: true },
			cost: {
				credits: 1.5,
				operations: 1,
			},
		});

		expect(result.metadata.cost?.credits).toBe(1.5);
		expect(result.metadata.cost?.operations).toBe(1);
	});
});

// ============================================================================
// ISACTIONRESULT TYPE GUARD TESTS
// ============================================================================

describe('isActionResult', () => {
	it('should return true for valid ActionResult', () => {
		const result = ActionResult.success({ id: '123' });
		expect(isActionResult(result)).toBe(true);
	});

	it('should return true for error ActionResult', () => {
		const result = ActionResult.error('Error', 'test_error');
		expect(isActionResult(result)).toBe(true);
	});

	it('should return false for null', () => {
		expect(isActionResult(null)).toBe(false);
	});

	it('should return false for undefined', () => {
		expect(isActionResult(undefined)).toBe(false);
	});

	it('should return false for plain object', () => {
		expect(isActionResult({ id: '123' })).toBe(false);
	});

	it('should return false for partial result missing metadata', () => {
		expect(
			isActionResult({
				success: true,
				data: { id: '123' },
			})
		).toBe(false);
	});

	it('should return false for partial result missing capabilities', () => {
		expect(
			isActionResult({
				success: true,
				data: { id: '123' },
				metadata: {
					source: { integration: 'test', action: 'test' },
					schema: 'test.v1',
					timestamp: Date.now(),
				},
			})
		).toBe(false);
	});

	it('should return false for array', () => {
		expect(isActionResult([])).toBe(false);
	});

	it('should return false for string', () => {
		expect(isActionResult('string')).toBe(false);
	});

	it('should return false for number', () => {
		expect(isActionResult(123)).toBe(false);
	});
});

// ============================================================================
// UNWRAPRESULT TESTS
// ============================================================================

describe('unwrapResult', () => {
	it('should extract data from ActionResult', () => {
		const result = ActionResult.success({ id: '123', name: 'Test' });
		const data = unwrapResult(result);

		expect(data).toEqual({ id: '123', name: 'Test' });
	});

	it('should return raw value if not ActionResult', () => {
		const data = { id: '123', name: 'Test' };
		const unwrapped = unwrapResult(data);

		expect(unwrapped).toEqual(data);
	});

	it('should handle null data in ActionResult', () => {
		const result = ActionResult.success(null);
		expect(unwrapResult(result)).toBeNull();
	});

	it('should handle error result data', () => {
		const result = ActionResult.error('Error', 'test', {
			data: { partial: true },
		});
		expect(unwrapResult(result)).toEqual({ partial: true });
	});
});

// ============================================================================
// ARERESULTSCOMPATIBLE TESTS
// ============================================================================

describe('areResultsCompatible', () => {
	it('should return compatible for matching capabilities', () => {
		const output: ActionCapabilities = {
			canHandleText: true,
			canHandleAttachments: true,
		};
		const input: ActionCapabilities = {
			canHandleText: true,
		};

		const result = areResultsCompatible(output, input);
		expect(result.compatible).toBe(true);
		expect(result.reason).toBeUndefined();
	});

	it('should return incompatible when text is required but not provided', () => {
		const output: ActionCapabilities = {
			canHandleImages: true,
		};
		const input: ActionCapabilities = {
			canHandleText: true,
		};

		const result = areResultsCompatible(output, input);
		expect(result.compatible).toBe(false);
		expect(result.reason).toContain('text');
	});

	it('should return incompatible when rich text is required but not provided', () => {
		const output: ActionCapabilities = {
			canHandleText: true,
		};
		const input: ActionCapabilities = {
			canHandleRichText: true,
		};

		const result = areResultsCompatible(output, input);
		expect(result.compatible).toBe(false);
		expect(result.reason).toContain('rich text');
	});

	it('should return incompatible when attachments are required but not provided', () => {
		const output: ActionCapabilities = {
			canHandleText: true,
		};
		const input: ActionCapabilities = {
			canHandleAttachments: true,
		};

		const result = areResultsCompatible(output, input);
		expect(result.compatible).toBe(false);
		expect(result.reason).toContain('attachments');
	});

	it('should return compatible for empty capabilities', () => {
		const result = areResultsCompatible({}, {});
		expect(result.compatible).toBe(true);
	});
});

// ============================================================================
// ERROR ACCESS HELPER TESTS
// ============================================================================

describe('getErrorMessage', () => {
	it('should return error message from failed result', () => {
		const result = ActionResult.error('Something went wrong', 'test_error');
		expect(getErrorMessage(result)).toBe('Something went wrong');
	});

	it('should return undefined from successful result', () => {
		const result = ActionResult.success({ id: '123' });
		expect(getErrorMessage(result)).toBeUndefined();
	});
});

describe('getErrorCode', () => {
	it('should return error code from failed result', () => {
		const result = ActionResult.error('Error', ErrorCode.NOT_FOUND);
		expect(getErrorCode(result)).toBe('not_found');
	});

	it('should return undefined from successful result', () => {
		const result = ActionResult.success({ id: '123' });
		expect(getErrorCode(result)).toBeUndefined();
	});
});

describe('hasErrorCode', () => {
	it('should return true when error code matches', () => {
		const result = ActionResult.error('Rate limited', ErrorCode.RATE_LIMITED);
		expect(hasErrorCode(result, ErrorCode.RATE_LIMITED)).toBe(true);
	});

	it('should return false when error code does not match', () => {
		const result = ActionResult.error('Not found', ErrorCode.NOT_FOUND);
		expect(hasErrorCode(result, ErrorCode.RATE_LIMITED)).toBe(false);
	});

	it('should return false for successful result', () => {
		const result = ActionResult.success({ id: '123' });
		expect(hasErrorCode(result, ErrorCode.NOT_FOUND)).toBe(false);
	});
});

describe('isFailure', () => {
	it('should return true for failed result', () => {
		const result = ActionResult.error('Failed', 'error');
		expect(isFailure(result)).toBe(true);
	});

	it('should return false for successful result', () => {
		const result = ActionResult.success({ id: '123' });
		expect(isFailure(result)).toBe(false);
	});

	it('should narrow type to include error property', () => {
		const result = ActionResult.error('Test error', 'test_code');

		if (isFailure(result)) {
			// TypeScript should know error is defined here
			expect(result.error.message).toBe('Test error');
			expect(result.error.code).toBe('test_code');
		}
	});
});

describe('isSuccess', () => {
	it('should return true for successful result', () => {
		const result = ActionResult.success({ id: '123' });
		expect(isSuccess(result)).toBe(true);
	});

	it('should return false for failed result', () => {
		const result = ActionResult.error('Failed', 'error');
		expect(isSuccess(result)).toBe(false);
	});

	it('should narrow type for data access', () => {
		const result = ActionResult.success({ id: '123', name: 'Test' });

		if (isSuccess(result)) {
			// TypeScript should know data is the expected type
			expect(result.data.id).toBe('123');
			expect(result.data.name).toBe('Test');
		}
	});
});

// ============================================================================
// STANDARD DATA TYPE TESTS
// ============================================================================

describe('Standard Data Types', () => {
	it('should create valid StandardMessage', () => {
		const message: StandardMessage = {
			type: 'message',
			id: 'msg_123',
			title: 'Hello World',
			body: 'This is a test message',
			bodyText: 'This is a test message',
			from: 'sender@example.com',
			to: ['recipient@example.com'],
			timestamp: Date.now(),
			metadata: { labels: ['important'] },
		};

		const result = ActionResult.success(message);
		expect(result.data.type).toBe('message');
		expect(result.data.title).toBe('Hello World');
	});

	it('should create valid StandardTask', () => {
		const task: StandardTask = {
			type: 'task',
			id: 'task_123',
			title: 'Complete SDK tests',
			description: 'Write comprehensive tests for ActionResult',
			status: 'in_progress',
			priority: 'high',
			timestamp: Date.now(),
			metadata: { project: 'WORKWAY' },
		};

		const result = ActionResult.success(task);
		expect(result.data.type).toBe('task');
		expect(result.data.status).toBe('in_progress');
	});

	it('should create valid StandardDocument', () => {
		const doc: StandardDocument = {
			type: 'document',
			id: 'doc_123',
			title: 'Technical Spec',
			content: '# Heading\n\nContent here',
			contentMarkdown: '# Heading\n\nContent here',
			author: 'developer@example.com',
			createdAt: Date.now() - 86400000,
			updatedAt: Date.now(),
			tags: ['technical', 'spec'],
			metadata: { version: '1.0' },
		};

		const result = ActionResult.success(doc);
		expect(result.data.type).toBe('document');
		expect(result.data.tags).toContain('technical');
	});

	it('should create valid StandardEvent', () => {
		const event: StandardEvent = {
			type: 'event',
			id: 'event_123',
			title: 'Team Meeting',
			description: 'Weekly standup',
			startTime: Date.now() + 3600000,
			endTime: Date.now() + 5400000,
			location: 'Conference Room A',
			attendees: ['alice@example.com', 'bob@example.com'],
			timestamp: Date.now(),
			metadata: { recurring: true },
		};

		const result = ActionResult.success(event);
		expect(result.data.type).toBe('event');
		expect(result.data.attendees).toHaveLength(2);
	});

	it('should create valid StandardList', () => {
		const list: StandardList = {
			type: 'list',
			items: [
				{ id: '1', title: 'Item 1' },
				{ id: '2', title: 'Item 2' },
				{ id: '3', title: 'Item 3' },
			],
			metadata: {
				total: 100,
				hasMore: true,
				cursor: 'next_page_token',
			},
		};

		const result = ActionResult.success(list);
		expect(result.data.items).toHaveLength(3);
		expect(result.data.metadata?.hasMore).toBe(true);
		expect(result.data.metadata?.cursor).toBe('next_page_token');
	});

	it('should support simple list format without nested metadata', () => {
		const list: StandardList = {
			items: [{ id: '1', title: 'Item' }],
			hasMore: false,
			total: 1,
		};

		const result = ActionResult.success(list);
		expect(result.data.items).toHaveLength(1);
		expect(result.data.hasMore).toBe(false);
	});
});

// ============================================================================
// EDGE CASES AND INTEGRATION TESTS
// ============================================================================

describe('Edge Cases', () => {
	it('should handle deeply nested data', () => {
		const data = {
			level1: {
				level2: {
					level3: {
						level4: {
							value: 'deep',
						},
					},
				},
			},
		};

		const result = ActionResult.success(data);
		expect(result.data.level1.level2.level3.level4.value).toBe('deep');
	});

	it('should handle circular reference protection', () => {
		// ActionResult should work with circular refs
		// (JSON.stringify would fail, but ActionResult shouldn't)
		const obj: any = { name: 'test' };
		obj.self = obj; // Circular reference

		const result = ActionResult.success(obj);
		expect(result.data.name).toBe('test');
		expect(result.data.self).toBe(result.data);
	});

	it('should handle special characters in strings', () => {
		const data = {
			unicode: '🚀 Émoji and spëcial çhars 日本語',
			html: '<script>alert("xss")</script>',
			newlines: 'line1\nline2\rline3',
		};

		const result = ActionResult.success(data);
		expect(result.data.unicode).toContain('🚀');
		expect(result.data.html).toContain('<script>');
		expect(result.data.newlines).toContain('\n');
	});

	it('should handle empty strings', () => {
		const result = ActionResult.success({ empty: '' });
		expect(result.data.empty).toBe('');
	});

	it('should handle very large arrays', () => {
		const largeArray = Array.from({ length: 10000 }, (_, i) => ({ id: i }));
		const result = ActionResult.success(largeArray);
		expect(result.data).toHaveLength(10000);
	});

	it('should preserve Date objects in data', () => {
		const now = new Date();
		const result = ActionResult.success({ date: now });
		expect(result.data.date).toEqual(now);
	});

	it('should handle undefined values in objects', () => {
		const result = ActionResult.success({ defined: 'yes', undef: undefined });
		expect(result.data.defined).toBe('yes');
		expect(result.data.undef).toBeUndefined();
	});
});
