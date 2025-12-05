/**
 * DiscoveryService Tests
 *
 * Tests for the Pathway Model discovery system.
 *
 * Philosophy:
 * - One integration pair = one workflow (pre-curation)
 * - Returns ONE suggestion, not a list
 * - Scoring based on editorial signals (no social proof pre-launch)
 * - Zuhandenheit: tool recedes, outcome remains
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
	DiscoveryService,
	createDiscoveryService,
	type DiscoveryContext,
} from './discovery-service.js';
import type { WorkflowDefinition } from './workflow-sdk.js';

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Create a mock workflow definition for testing
 */
function createMockWorkflow(overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
	return {
		name: 'Test Workflow',
		version: '1.0.0',
		description: 'A test workflow',
		metadata: {
			id: 'test-workflow',
			version: '1.0.0',
			name: 'Test Workflow',
			description: 'A test workflow',
			category: 'productivity',
			integrations: ['zoom', 'notion'],
			outcomeFrame: 'after_meetings',
			pathway: {
				outcomeFrame: 'after_meetings',
				outcomeStatement: {
					suggestion: 'Want meeting notes automatically?',
					explanation: 'After meetings, we create notes in Notion.',
					outcome: 'Meeting notes in Notion',
				},
				primaryPair: {
					from: 'zoom',
					to: 'notion',
					fromLabel: 'Zoom',
					toLabel: 'Notion',
				},
				discoveryMoments: [
					{
						trigger: 'integration_connected',
						integrations: ['zoom', 'notion'],
						suggestionText: 'Want meeting notes automatically?',
						priority: 80,
					},
				],
				smartDefaults: {},
				essentialFields: ['notionDatabaseId'],
				zuhandenheit: {
					timeToValue: 3,
					worksOutOfBox: true,
					gracefulDegradation: true,
					automaticTrigger: true,
				},
			},
			...overrides.metadata,
		},
		triggers: [],
		steps: [],
		configSchema: {},
		...overrides,
	} as unknown as WorkflowDefinition;
}

/**
 * Create a mock discovery context
 */
function createMockContext(overrides: Partial<DiscoveryContext> = {}): DiscoveryContext {
	return {
		userId: 'user-123',
		connectedIntegrations: ['zoom', 'notion'],
		installedWorkflows: [],
		dismissedWorkflows: [],
		timezone: 'America/Los_Angeles',
		...overrides,
	};
}

// ============================================================================
// CONSTRUCTOR TESTS
// ============================================================================

describe('DiscoveryService Constructor', () => {
	it('should create an instance via factory function', () => {
		const service = createDiscoveryService();
		expect(service).toBeInstanceOf(DiscoveryService);
	});

	it('should create an instance via constructor', () => {
		const service = new DiscoveryService();
		expect(service).toBeInstanceOf(DiscoveryService);
	});
});

// ============================================================================
// WORKFLOW REGISTRATION TESTS
// ============================================================================

describe('DiscoveryService.registerWorkflows', () => {
	let service: DiscoveryService;

	beforeEach(() => {
		service = createDiscoveryService();
	});

	it('should register workflows', () => {
		const workflow = createMockWorkflow();
		service.registerWorkflows([workflow]);

		// Verify by attempting to get a suggestion
		const context = createMockContext();
		// The service should now be able to find this workflow
		expect(async () => await service.getSuggestion(context)).not.toThrow();
	});

	it('should index workflows by integration pair', async () => {
		const workflow = createMockWorkflow();
		service.registerWorkflows([workflow]);

		const context = createMockContext();
		const suggestion = await service.getSuggestionForPair('zoom', 'notion', context);

		expect(suggestion).not.toBeNull();
		expect(suggestion?.workflowId).toBe('test-workflow');
	});

	it('should index additional pairs', async () => {
		const workflow = createMockWorkflow({
			metadata: {
				id: 'multi-pair-workflow',
				version: '1.0.0',
				name: 'Multi-Pair Workflow',
				description: 'A workflow with multiple pairs',
				category: 'productivity',
				integrations: ['zoom', 'notion', 'slack'],
				outcomeFrame: 'after_meetings',
				pathway: {
					outcomeFrame: 'after_meetings',
					outcomeStatement: {
						suggestion: 'Want comprehensive meeting automation?',
						explanation: 'Meetings go to Notion and Slack.',
						outcome: 'Full meeting workflow',
					},
					primaryPair: {
						from: 'zoom',
						to: 'notion',
						fromLabel: 'Zoom',
						toLabel: 'Notion',
					},
					additionalPairs: [
						{
							from: 'zoom',
							to: 'slack',
							fromLabel: 'Zoom',
							toLabel: 'Slack',
						},
					],
					discoveryMoments: [
						{
							trigger: 'integration_connected',
							integrations: ['zoom', 'notion'],
							suggestionText: 'Want meeting automation?',
							priority: 80,
						},
					],
					smartDefaults: {},
					essentialFields: [],
					zuhandenheit: {
						timeToValue: 3,
						worksOutOfBox: true,
						gracefulDegradation: true,
						automaticTrigger: true,
					},
				},
			},
		});

		service.registerWorkflows([workflow]);

		const context = createMockContext({ connectedIntegrations: ['zoom', 'slack'] });
		const suggestion = await service.getSuggestionForPair('zoom', 'slack', context);

		expect(suggestion).not.toBeNull();
		expect(suggestion?.workflowId).toBe('multi-pair-workflow');
	});
});

// ============================================================================
// GET SUGGESTION TESTS
// ============================================================================

describe('DiscoveryService.getSuggestion', () => {
	let service: DiscoveryService;

	beforeEach(() => {
		service = createDiscoveryService();
	});

	it('should return null when no workflows registered', async () => {
		const context = createMockContext();
		const suggestion = await service.getSuggestion(context);

		expect(suggestion).toBeNull();
	});

	it('should return suggestion when integrations match', async () => {
		const workflow = createMockWorkflow();
		service.registerWorkflows([workflow]);

		const context = createMockContext();
		const suggestion = await service.getSuggestion(context);

		expect(suggestion).not.toBeNull();
		expect(suggestion?.workflowId).toBe('test-workflow');
	});

	it('should return outcome statement in suggestion', async () => {
		const workflow = createMockWorkflow();
		service.registerWorkflows([workflow]);

		const context = createMockContext();
		const suggestion = await service.getSuggestion(context);

		expect(suggestion?.outcomeStatement).toBeDefined();
		expect(suggestion?.outcomeStatement.suggestion).toBe('Want meeting notes automatically?');
		expect(suggestion?.outcomeStatement.outcome).toBe('Meeting notes in Notion');
	});

	it('should filter out already installed workflows', async () => {
		const workflow = createMockWorkflow();
		service.registerWorkflows([workflow]);

		const context = createMockContext({
			installedWorkflows: ['test-workflow'],
		});
		const suggestion = await service.getSuggestion(context);

		expect(suggestion).toBeNull();
	});

	it('should filter out dismissed workflows', async () => {
		const workflow = createMockWorkflow();
		service.registerWorkflows([workflow]);

		const context = createMockContext({
			dismissedWorkflows: ['test-workflow'],
		});
		const suggestion = await service.getSuggestion(context);

		expect(suggestion).toBeNull();
	});

	it('should return null when user lacks required integrations', async () => {
		const workflow = createMockWorkflow();
		service.registerWorkflows([workflow]);

		const context = createMockContext({
			connectedIntegrations: ['zoom'], // Missing notion
		});
		const suggestion = await service.getSuggestion(context);

		expect(suggestion).toBeNull();
	});
});

// ============================================================================
// GET SUGGESTION FOR PAIR TESTS
// ============================================================================

describe('DiscoveryService.getSuggestionForPair', () => {
	let service: DiscoveryService;

	beforeEach(() => {
		service = createDiscoveryService();
	});

	it('should return null for unknown pair', async () => {
		const context = createMockContext();
		const suggestion = await service.getSuggestionForPair('unknown', 'pair', context);

		expect(suggestion).toBeNull();
	});

	it('should find workflow by integration pair', async () => {
		const workflow = createMockWorkflow();
		service.registerWorkflows([workflow]);

		const context = createMockContext();
		const suggestion = await service.getSuggestionForPair('zoom', 'notion', context);

		expect(suggestion).not.toBeNull();
		expect(suggestion?.workflowId).toBe('test-workflow');
	});

	it('should be case insensitive', async () => {
		const workflow = createMockWorkflow();
		service.registerWorkflows([workflow]);

		const context = createMockContext();
		const suggestion = await service.getSuggestionForPair('ZOOM', 'NOTION', context);

		expect(suggestion).not.toBeNull();
		expect(suggestion?.workflowId).toBe('test-workflow');
	});

	it('should filter installed workflows for pair queries', async () => {
		const workflow = createMockWorkflow();
		service.registerWorkflows([workflow]);

		const context = createMockContext({
			installedWorkflows: ['test-workflow'],
		});
		const suggestion = await service.getSuggestionForPair('zoom', 'notion', context);

		expect(suggestion).toBeNull();
	});
});

// ============================================================================
// GET SUGGESTION FOR TRIGGER TESTS
// ============================================================================

describe('DiscoveryService.getSuggestionForTrigger', () => {
	let service: DiscoveryService;

	beforeEach(() => {
		service = createDiscoveryService();
	});

	it('should return suggestion for integration_connected trigger', async () => {
		const workflow = createMockWorkflow();
		service.registerWorkflows([workflow]);

		const context = createMockContext();
		const suggestion = await service.getSuggestionForTrigger('integration_connected', context);

		expect(suggestion).not.toBeNull();
		expect(suggestion?.workflowId).toBe('test-workflow');
	});

	it('should return suggestion for event_received trigger with matching event', async () => {
		const workflow = createMockWorkflow({
			metadata: {
				id: 'event-workflow',
				version: '1.0.0',
				name: 'Event Workflow',
				description: 'Triggered by events',
				category: 'productivity',
				integrations: ['zoom', 'notion'],
				outcomeFrame: 'after_meetings',
				pathway: {
					outcomeFrame: 'after_meetings',
					outcomeStatement: {
						suggestion: 'Meeting just ended!',
						explanation: 'Create notes now.',
						outcome: 'Notes created',
					},
					primaryPair: {
						from: 'zoom',
						to: 'notion',
						fromLabel: 'Zoom',
						toLabel: 'Notion',
					},
					discoveryMoments: [
						{
							trigger: 'event_received',
							eventType: 'zoom.recording.completed',
							integrations: ['zoom', 'notion'],
							suggestionText: 'Meeting ended - create notes?',
							priority: 90,
						},
					],
					smartDefaults: {},
					essentialFields: [],
					zuhandenheit: {
						timeToValue: 1,
						worksOutOfBox: true,
						gracefulDegradation: true,
						automaticTrigger: true,
					},
				},
			},
		});

		service.registerWorkflows([workflow]);

		const context = createMockContext({
			recentEvent: {
				type: 'zoom.recording.completed',
				service: 'zoom',
				timestamp: Date.now(),
			},
		});
		const suggestion = await service.getSuggestionForTrigger('event_received', context);

		expect(suggestion).not.toBeNull();
		expect(suggestion?.workflowId).toBe('event-workflow');
	});

	it('should return null when no matching trigger type', async () => {
		const workflow = createMockWorkflow(); // Has integration_connected trigger
		service.registerWorkflows([workflow]);

		const context = createMockContext();
		// Trying to find event_received trigger but workflow only has integration_connected
		const suggestion = await service.getSuggestionForTrigger('event_received', context);

		expect(suggestion).toBeNull();
	});
});

// ============================================================================
// OUTCOME FRAME TESTS
// ============================================================================

describe('DiscoveryService.getAvailableOutcomeFrames', () => {
	let service: DiscoveryService;

	beforeEach(() => {
		service = createDiscoveryService();
	});

	it('should return empty array when no workflows registered', () => {
		const context = createMockContext();
		const frames = service.getAvailableOutcomeFrames(context);

		expect(frames).toEqual([]);
	});

	it('should return outcome frames for user integrations', () => {
		const workflow = createMockWorkflow();
		service.registerWorkflows([workflow]);

		const context = createMockContext();
		const frames = service.getAvailableOutcomeFrames(context);

		expect(frames).toContain('after_meetings');
	});

	it('should not return frames when user lacks integrations', () => {
		const workflow = createMockWorkflow();
		service.registerWorkflows([workflow]);

		const context = createMockContext({
			connectedIntegrations: ['slack'], // Doesn't have zoom or notion
		});
		const frames = service.getAvailableOutcomeFrames(context);

		expect(frames).not.toContain('after_meetings');
	});
});

describe('DiscoveryService.getSuggestionsForFrame', () => {
	let service: DiscoveryService;

	beforeEach(() => {
		service = createDiscoveryService();
	});

	it('should return empty array for unknown frame', async () => {
		const context = createMockContext();
		const suggestions = await service.getSuggestionsForFrame('after_meetings', context);

		expect(suggestions).toEqual([]);
	});

	it('should return suggestions for matching frame', async () => {
		const workflow = createMockWorkflow();
		service.registerWorkflows([workflow]);

		const context = createMockContext();
		const suggestions = await service.getSuggestionsForFrame('after_meetings', context);

		expect(suggestions.length).toBe(1);
		expect(suggestions[0].workflowId).toBe('test-workflow');
	});

	it('should filter installed workflows', async () => {
		const workflow = createMockWorkflow();
		service.registerWorkflows([workflow]);

		const context = createMockContext({
			installedWorkflows: ['test-workflow'],
		});
		const suggestions = await service.getSuggestionsForFrame('after_meetings', context);

		expect(suggestions).toEqual([]);
	});

	it('should only return one workflow per integration pair', async () => {
		// Two workflows for same pair
		const workflow1 = createMockWorkflow();
		const workflow2 = createMockWorkflow({
			metadata: {
				id: 'test-workflow-2',
				version: '1.0.0',
				name: 'Test Workflow 2',
				description: 'Another workflow for same pair',
				category: 'productivity',
				integrations: ['zoom', 'notion'],
				outcomeFrame: 'after_meetings',
				pathway: {
					outcomeFrame: 'after_meetings',
					outcomeStatement: {
						suggestion: 'Another option?',
						explanation: 'Different approach.',
						outcome: 'Meeting notes v2',
					},
					primaryPair: {
						from: 'zoom',
						to: 'notion',
						fromLabel: 'Zoom',
						toLabel: 'Notion',
					},
					discoveryMoments: [
						{
							trigger: 'integration_connected',
							integrations: ['zoom', 'notion'],
							suggestionText: 'Another option?',
							priority: 70,
						},
					],
					smartDefaults: {},
					essentialFields: [],
					zuhandenheit: {
						timeToValue: 5,
						worksOutOfBox: false,
						gracefulDegradation: false,
						automaticTrigger: true,
					},
				},
			},
		});

		service.registerWorkflows([workflow1, workflow2]);

		const context = createMockContext();
		const suggestions = await service.getSuggestionsForFrame('after_meetings', context);

		// Should only return ONE per pair (pre-curation principle)
		expect(suggestions.length).toBe(1);
	});
});

// ============================================================================
// FIT SCORE TESTS (Editorial Signals)
// ============================================================================

describe('DiscoveryService Fit Score', () => {
	let service: DiscoveryService;

	beforeEach(() => {
		service = createDiscoveryService();
	});

	it('should prefer workflows with higher priority', async () => {
		const lowPriority = createMockWorkflow({
			metadata: {
				id: 'low-priority',
				version: '1.0.0',
				name: 'Low Priority',
				description: 'Low priority workflow',
				category: 'productivity',
				integrations: ['zoom', 'notion'],
				outcomeFrame: 'after_meetings',
				pathway: {
					outcomeFrame: 'after_meetings',
					outcomeStatement: {
						suggestion: 'Low priority',
						explanation: 'Low priority',
						outcome: 'Low priority',
					},
					primaryPair: { from: 'zoom', to: 'notion', fromLabel: 'Zoom', toLabel: 'Notion' },
					discoveryMoments: [
						{ trigger: 'integration_connected', integrations: ['zoom', 'notion'], suggestionText: 'Low', priority: 10 },
					],
					smartDefaults: {},
					essentialFields: [],
					zuhandenheit: { timeToValue: 3, worksOutOfBox: false, gracefulDegradation: false, automaticTrigger: false },
				},
			},
		});

		const highPriority = createMockWorkflow({
			metadata: {
				id: 'high-priority',
				version: '1.0.0',
				name: 'High Priority',
				description: 'High priority workflow',
				category: 'productivity',
				integrations: ['zoom', 'notion'],
				outcomeFrame: 'after_meetings',
				pathway: {
					outcomeFrame: 'after_meetings',
					outcomeStatement: {
						suggestion: 'High priority',
						explanation: 'High priority',
						outcome: 'High priority',
					},
					primaryPair: { from: 'zoom', to: 'notion', fromLabel: 'Zoom', toLabel: 'Notion' },
					discoveryMoments: [
						{ trigger: 'integration_connected', integrations: ['zoom', 'notion'], suggestionText: 'High', priority: 100 },
					],
					smartDefaults: {},
					essentialFields: [],
					zuhandenheit: { timeToValue: 3, worksOutOfBox: false, gracefulDegradation: false, automaticTrigger: false },
				},
			},
		});

		// Register low priority first to ensure sorting works
		service.registerWorkflows([lowPriority, highPriority]);

		const context = createMockContext();
		const suggestion = await service.getSuggestion(context);

		expect(suggestion?.workflowId).toBe('high-priority');
	});

	it('should prefer workflows with zuhandenheit indicators', async () => {
		const noZuhandenheit = createMockWorkflow({
			metadata: {
				id: 'no-zuhandenheit',
				version: '1.0.0',
				name: 'No Zuhandenheit',
				description: 'Requires manual setup',
				category: 'productivity',
				integrations: ['zoom', 'notion'],
				outcomeFrame: 'after_meetings',
				pathway: {
					outcomeFrame: 'after_meetings',
					outcomeStatement: {
						suggestion: 'Manual setup',
						explanation: 'Requires work',
						outcome: 'Manual',
					},
					primaryPair: { from: 'zoom', to: 'notion', fromLabel: 'Zoom', toLabel: 'Notion' },
					discoveryMoments: [
						{ trigger: 'integration_connected', integrations: ['zoom', 'notion'], suggestionText: 'Manual', priority: 50 },
					],
					smartDefaults: {},
					essentialFields: ['field1', 'field2', 'field3', 'field4'],
					zuhandenheit: {
						timeToValue: 1500, // > 1 day
						worksOutOfBox: false,
						gracefulDegradation: false,
						automaticTrigger: false,
					},
				},
			},
		});

		const highZuhandenheit = createMockWorkflow({
			metadata: {
				id: 'high-zuhandenheit',
				version: '1.0.0',
				name: 'High Zuhandenheit',
				description: 'Works out of box',
				category: 'productivity',
				integrations: ['zoom', 'notion'],
				outcomeFrame: 'after_meetings',
				pathway: {
					outcomeFrame: 'after_meetings',
					outcomeStatement: {
						suggestion: 'One click',
						explanation: 'Works immediately',
						outcome: 'Done',
					},
					primaryPair: { from: 'zoom', to: 'notion', fromLabel: 'Zoom', toLabel: 'Notion' },
					discoveryMoments: [
						{ trigger: 'integration_connected', integrations: ['zoom', 'notion'], suggestionText: 'One click', priority: 50 },
					],
					smartDefaults: {},
					essentialFields: [], // No config needed = one-click ready
					zuhandenheit: {
						timeToValue: 1, // < 5 minutes
						worksOutOfBox: true,
						gracefulDegradation: true,
						automaticTrigger: true,
					},
				},
			},
		});

		// Same priority (50), but zuhandenheit should win
		service.registerWorkflows([noZuhandenheit, highZuhandenheit]);

		const context = createMockContext();
		const suggestion = await service.getSuggestion(context);

		expect(suggestion?.workflowId).toBe('high-zuhandenheit');
	});

	it('should boost score for matching recent event', async () => {
		const eventWorkflow = createMockWorkflow({
			metadata: {
				id: 'event-workflow',
				version: '1.0.0',
				name: 'Event Workflow',
				description: 'Triggered by event',
				category: 'productivity',
				integrations: ['zoom', 'notion'],
				outcomeFrame: 'after_meetings',
				pathway: {
					outcomeFrame: 'after_meetings',
					outcomeStatement: {
						suggestion: 'Event triggered',
						explanation: 'Event detected',
						outcome: 'Event response',
					},
					primaryPair: { from: 'zoom', to: 'notion', fromLabel: 'Zoom', toLabel: 'Notion' },
					discoveryMoments: [
						{
							trigger: 'event_received',
							eventType: 'zoom.recording.completed',
							integrations: ['zoom', 'notion'],
							suggestionText: 'Meeting ended',
							priority: 50,
						},
					],
					smartDefaults: {},
					essentialFields: [],
					zuhandenheit: { timeToValue: 1, worksOutOfBox: true, gracefulDegradation: true, automaticTrigger: true },
				},
			},
		});

		service.registerWorkflows([eventWorkflow]);

		const context = createMockContext({
			recentEvent: {
				type: 'zoom.recording.completed',
				service: 'zoom',
				timestamp: Date.now(),
			},
		});
		const suggestion = await service.getSuggestion(context);

		// Event match should boost score significantly
		expect(suggestion?.workflowId).toBe('event-workflow');
	});
});

// ============================================================================
// ONE-CLICK READY TESTS
// ============================================================================

describe('DiscoveryService One-Click Ready', () => {
	let service: DiscoveryService;

	beforeEach(() => {
		service = createDiscoveryService();
	});

	it('should mark workflow as one-click ready when no essential fields', async () => {
		const workflow = createMockWorkflow({
			metadata: {
				id: 'one-click',
				version: '1.0.0',
				name: 'One-Click',
				description: 'No config needed',
				category: 'productivity',
				integrations: ['zoom', 'notion'],
				outcomeFrame: 'after_meetings',
				pathway: {
					outcomeFrame: 'after_meetings',
					outcomeStatement: {
						suggestion: 'One click to go',
						explanation: 'Instant setup',
						outcome: 'Done',
					},
					primaryPair: { from: 'zoom', to: 'notion', fromLabel: 'Zoom', toLabel: 'Notion' },
					discoveryMoments: [
						{ trigger: 'integration_connected', integrations: ['zoom', 'notion'], suggestionText: 'One click', priority: 80 },
					],
					smartDefaults: {},
					essentialFields: [], // No essential fields
					zuhandenheit: { timeToValue: 1, worksOutOfBox: true, gracefulDegradation: true, automaticTrigger: true },
				},
			},
		});

		service.registerWorkflows([workflow]);

		const context = createMockContext();
		const suggestion = await service.getSuggestion(context);

		expect(suggestion?.oneClickReady).toBe(true);
		expect(suggestion?.requiredFields).toEqual([]);
	});

	it('should not be one-click ready when essential fields exist', async () => {
		const workflow = createMockWorkflow();
		service.registerWorkflows([workflow]);

		const context = createMockContext();
		const suggestion = await service.getSuggestion(context);

		expect(suggestion?.oneClickReady).toBe(false);
		expect(suggestion?.requiredFields.length).toBeGreaterThan(0);
	});
});

// ============================================================================
// INFERRED CONFIG TESTS
// ============================================================================

describe('DiscoveryService Config Inference', () => {
	let service: DiscoveryService;

	beforeEach(() => {
		service = createDiscoveryService();
	});

	it('should infer timezone from context', async () => {
		const workflow = createMockWorkflow({
			metadata: {
				id: 'timezone-workflow',
				version: '1.0.0',
				name: 'Timezone Workflow',
				description: 'Uses timezone',
				category: 'productivity',
				integrations: ['zoom', 'notion'],
				outcomeFrame: 'after_meetings',
				pathway: {
					outcomeFrame: 'after_meetings',
					outcomeStatement: {
						suggestion: 'Timezone aware',
						explanation: 'Uses your timezone',
						outcome: 'Localized',
					},
					primaryPair: { from: 'zoom', to: 'notion', fromLabel: 'Zoom', toLabel: 'Notion' },
					discoveryMoments: [
						{ trigger: 'integration_connected', integrations: ['zoom', 'notion'], suggestionText: 'TZ', priority: 80 },
					],
					smartDefaults: {
						timezone: { inferFrom: 'user_timezone' },
					},
					essentialFields: [],
					zuhandenheit: { timeToValue: 1, worksOutOfBox: true, gracefulDegradation: true, automaticTrigger: true },
				},
			},
		});

		service.registerWorkflows([workflow]);

		const context = createMockContext({
			timezone: 'Europe/London',
		});
		const suggestion = await service.getSuggestion(context);

		expect(suggestion?.inferredConfig.timezone).toBe('Europe/London');
	});

	it('should use static default values', async () => {
		const workflow = createMockWorkflow({
			metadata: {
				id: 'static-defaults',
				version: '1.0.0',
				name: 'Static Defaults',
				description: 'Has static defaults',
				category: 'productivity',
				integrations: ['zoom', 'notion'],
				outcomeFrame: 'after_meetings',
				pathway: {
					outcomeFrame: 'after_meetings',
					outcomeStatement: {
						suggestion: 'Static defaults',
						explanation: 'Has defaults',
						outcome: 'Pre-configured',
					},
					primaryPair: { from: 'zoom', to: 'notion', fromLabel: 'Zoom', toLabel: 'Notion' },
					discoveryMoments: [
						{ trigger: 'integration_connected', integrations: ['zoom', 'notion'], suggestionText: 'Defaults', priority: 80 },
					],
					smartDefaults: {
						summaryLength: { value: 'medium' },
						enableAI: { value: true },
					},
					essentialFields: [],
					zuhandenheit: { timeToValue: 1, worksOutOfBox: true, gracefulDegradation: true, automaticTrigger: true },
				},
			},
		});

		service.registerWorkflows([workflow]);

		const context = createMockContext();
		const suggestion = await service.getSuggestion(context);

		expect(suggestion?.inferredConfig.summaryLength).toBe('medium');
		expect(suggestion?.inferredConfig.enableAI).toBe(true);
	});
});
