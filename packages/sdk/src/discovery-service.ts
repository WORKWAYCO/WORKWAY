/**
 * Discovery Service - The Pathway Model Implementation
 *
 * Instead of users visiting a marketplace to browse and compare,
 * workflows surface at moments of relevance. The marketplace dissolves
 * into contextual suggestions.
 *
 * Heideggerian principle: The tool should recede; the outcome should remain.
 * Users don't "shop for workflows" - they accept suggestions that appear
 * at the right moment.
 *
 * See: docs/MARKETPLACE_CURATION.md
 * See: docs/OUTCOME_TAXONOMY.md
 */

import type {
	WorkflowDefinition,
	DiscoveryMoment,
	WorkflowSuggestion,
	OutcomeFrame,
	BreakdownEvent,
	ToolVisibilityState,
} from './workflow-sdk';

import {
	BreakdownSeverity,
	createBreakdown,
	classifyBreakdown,
} from './workflow-sdk';

// ============================================================================
// WORKFLOW ACCESSORS (Handle both shorthand and metadata patterns)
// ============================================================================

/**
 * Get workflow ID from a WorkflowDefinition
 * Handles both shorthand (at root) and metadata patterns
 */
function getWorkflowId(workflow: WorkflowDefinition): string {
	// Try metadata first (legacy pattern)
	if (workflow.metadata?.id) {
		return workflow.metadata.id;
	}
	// Try pathway (Heideggerian discovery pattern)
	if (workflow.pathway?.primaryPair?.workflowId) {
		return workflow.pathway.primaryPair.workflowId;
	}
	// Fallback: derive from name
	const name = workflow.metadata?.name || workflow.name || 'unknown';
	return name.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Get workflow pathway metadata
 * Handles both root-level and metadata-nested patterns
 */
function getWorkflowPathway(workflow: WorkflowDefinition) {
	return workflow.pathway || workflow.metadata?.pathway;
}

// ============================================================================
// TEMPORAL ECSTASES (Heideggerian Time Structures)
// ============================================================================

/**
 * Temporal Ecstases - Heidegger's three modes of existential time
 *
 * Not clock time, but lived time. Discovery should match the user's
 * temporal situation.
 *
 * See: docs/HEIDEGGER_DESIGN.md
 */
export interface TemporalContext {
	/**
	 * Having-been (Gewesenheit) - What has happened
	 *
	 * Recent events that shape the current situation.
	 * "A meeting just ended" triggers post-meeting workflows.
	 */
	havingBeen: {
		recentEvents: Array<{
			type: string; // e.g., 'zoom.meeting.ended'
			service: string;
			timestamp: number;
			data?: Record<string, unknown>;
		}>;
		/** How far back to consider (milliseconds) */
		horizon: number;
	};

	/**
	 * Making-present (Gegenwärtigen) - Current situation
	 *
	 * What integrations are connected, what time is it, what's the context.
	 */
	makingPresent: {
		connectedIntegrations: string[];
		currentTime: Date;
		timezone: string;
		/** Day of week (0 = Sunday) */
		dayOfWeek: number;
		/** Hour of day (0-23) */
		hourOfDay: number;
		/** Is it a workday? */
		isWorkday: boolean;
	};

	/**
	 * Coming-toward (Zukunft) - Anticipated future
	 *
	 * What's scheduled, what deadlines are approaching.
	 * "You have a meeting in 10 minutes" triggers pre-meeting workflows.
	 */
	comingToward: {
		scheduledEvents?: Array<{
			type: string;
			timestamp: number;
			data?: Record<string, unknown>;
		}>;
		upcomingDeadlines?: Array<{
			description: string;
			dueAt: number;
		}>;
		/** How far ahead to consider (milliseconds) */
		horizon: number;
	};
}

// ============================================================================
// DISCOVERY CONTEXT
// ============================================================================

/**
 * Context for discovery - what we know about the user's situation
 */
export interface DiscoveryContext {
	/** User ID */
	userId: string;

	/** Integrations the user has connected */
	connectedIntegrations: string[];

	/** Recent event that triggered discovery (optional) */
	recentEvent?: {
		type: string; // e.g., 'zoom.recording.completed'
		service: string;
		timestamp: number;
		data?: Record<string, unknown>;
	};

	/** User's timezone (for smart defaults) */
	timezone?: string;

	/** Workflows already installed by this user */
	installedWorkflows: string[];

	/** Workflows the user has dismissed/declined */
	dismissedWorkflows: string[];

	/** User preferences (for smart defaults) */
	preferences?: Record<string, unknown>;

	/**
	 * Full temporal context (optional, for advanced discovery)
	 *
	 * When provided, enables temporal-aware suggestions:
	 * - "Monday morning" → Weekly digest
	 * - "Just after meeting" → Meeting notes
	 * - "Deadline approaching" → Reminder workflows
	 */
	temporal?: TemporalContext;
}

// ============================================================================
// DISCOVERY SERVICE
// ============================================================================

/**
 * DiscoveryService - Returns ONE workflow suggestion at moments of relevance
 *
 * Not a list. Not options. One path to the outcome.
 * Users don't choose between workflows - they accept or defer.
 *
 * Heideggerian principles:
 * - Zuhandenheit: Tool recedes during normal use
 * - Vorhandenheit: Tool becomes visible on breakdown
 * - Temporal Ecstases: Discovery matches user's lived time
 */
export class DiscoveryService {
	private workflows: Map<string, WorkflowDefinition> = new Map();
	private integrationPairIndex: Map<string, string[]> = new Map();
	private eventTypeIndex: Map<string, string[]> = new Map();

	/** Track visibility state per workflow (Zuhandenheit ↔ Vorhandenheit) */
	private visibilityStates: Map<string, ToolVisibilityState> = new Map();

	/**
	 * Register workflows for discovery
	 */
	registerWorkflows(workflows: WorkflowDefinition[]): void {
		for (const workflow of workflows) {
			const workflowId = getWorkflowId(workflow);
			this.workflows.set(workflowId, workflow);

			// Index by integration pairs for fast lookup
			const pathway = getWorkflowPathway(workflow);
			if (pathway) {
				// Index primary pair
				const pairKey = this.pairKey(pathway.primaryPair.from, pathway.primaryPair.to);
				this.addToIndex(this.integrationPairIndex, pairKey, workflowId);

				// Index additional pairs
				for (const pair of pathway.additionalPairs || []) {
					const additionalKey = this.pairKey(pair.from, pair.to);
					this.addToIndex(this.integrationPairIndex, additionalKey, workflowId);
				}

				// Index by event types
				for (const moment of pathway.discoveryMoments) {
					if (moment.eventType) {
						this.addToIndex(this.eventTypeIndex, moment.eventType, workflowId);
					}
				}
			}
		}
	}

	/**
	 * Get a workflow suggestion based on context
	 *
	 * Returns at most ONE workflow - the best path for this moment.
	 * Returns null if no relevant suggestion.
	 */
	async getSuggestion(context: DiscoveryContext): Promise<WorkflowSuggestion | null> {
		// Find candidate workflows that match the context
		const candidates = this.findCandidates(context);

		if (candidates.length === 0) {
			return null;
		}

		// Pre-curate: select THE best option
		const best = this.selectBest(candidates, context);

		if (!best) {
			return null;
		}

		const pathway = getWorkflowPathway(best.workflow)!;

		return {
			workflowId: getWorkflowId(best.workflow),
			outcomeStatement: pathway.outcomeStatement,
			inferredConfig: this.inferConfig(best.workflow, context),
			triggerContext: {
				moment: best.moment,
				timestamp: Date.now(),
				relevantIntegrations: context.connectedIntegrations.filter((i) =>
					best.moment.integrations.includes(i)
				),
			},
			oneClickReady: this.isOneClickReady(best.workflow, context),
			requiredFields: this.getRequiredFields(best.workflow, context),
		};
	}

	/**
	 * Get suggestion for a specific trigger type
	 *
	 * Use when:
	 * - User just connected an integration ('integration_connected')
	 * - A webhook event was received ('event_received')
	 * - Time-based suggestion ('time_based')
	 */
	async getSuggestionForTrigger(
		triggerType: DiscoveryMoment['trigger'],
		context: DiscoveryContext
	): Promise<WorkflowSuggestion | null> {
		const candidates = this.findCandidates(context).filter(
			(c) => c.moment.trigger === triggerType
		);

		if (candidates.length === 0) {
			return null;
		}

		const best = this.selectBest(candidates, context);
		if (!best) return null;

		const pathway = getWorkflowPathway(best.workflow)!;

		return {
			workflowId: getWorkflowId(best.workflow),
			outcomeStatement: pathway.outcomeStatement,
			inferredConfig: this.inferConfig(best.workflow, context),
			triggerContext: {
				moment: best.moment,
				timestamp: Date.now(),
				relevantIntegrations: context.connectedIntegrations.filter((i) =>
					best.moment.integrations.includes(i)
				),
			},
			oneClickReady: this.isOneClickReady(best.workflow, context),
			requiredFields: this.getRequiredFields(best.workflow, context),
		};
	}

	/**
	 * Get suggestion for a specific integration pair
	 *
	 * Use when user explicitly asks: "What can I do with Zoom and Notion?"
	 * Returns the canonical workflow for this pair.
	 */
	async getSuggestionForPair(
		from: string,
		to: string,
		context: DiscoveryContext
	): Promise<WorkflowSuggestion | null> {
		const pairKey = this.pairKey(from, to);
		const workflowIds = this.integrationPairIndex.get(pairKey) || [];

		if (workflowIds.length === 0) {
			return null;
		}

		// Get workflows and filter out already installed/dismissed
		const candidates = workflowIds
			.map((id) => this.workflows.get(id))
			.filter((w): w is WorkflowDefinition => {
				const wPathway = w ? getWorkflowPathway(w) : undefined;
				if (!w || !wPathway) return false;
				const wId = getWorkflowId(w);
				if (context.installedWorkflows.includes(wId)) return false;
				if (context.dismissedWorkflows.includes(wId)) return false;
				return true;
			})
			.map((workflow) => {
				const wPathway = getWorkflowPathway(workflow)!;
				return {
					workflow,
					moment: wPathway.discoveryMoments[0],
					score: this.calculateFitScore(workflow, wPathway.discoveryMoments[0], context),
				};
			});

		if (candidates.length === 0) return null;

		// Sort by score and return best
		candidates.sort((a, b) => b.score - a.score);
		const best = candidates[0];
		const pathway = getWorkflowPathway(best.workflow)!;

		return {
			workflowId: getWorkflowId(best.workflow),
			outcomeStatement: pathway.outcomeStatement,
			inferredConfig: this.inferConfig(best.workflow, context),
			triggerContext: {
				moment: best.moment,
				timestamp: Date.now(),
				relevantIntegrations: [from, to].filter((i) => context.connectedIntegrations.includes(i)),
			},
			oneClickReady: this.isOneClickReady(best.workflow, context),
			requiredFields: this.getRequiredFields(best.workflow, context),
		};
	}

	/**
	 * Get all available outcome frames for user's connected integrations
	 *
	 * Use for showing a minimal menu of possibilities:
	 * "After meetings..." | "When payments arrive..." | "Weekly..."
	 */
	getAvailableOutcomeFrames(context: DiscoveryContext): OutcomeFrame[] {
		const frames = new Set<OutcomeFrame>();

		for (const [, workflow] of this.workflows) {
			const pathway = getWorkflowPathway(workflow);
			if (!pathway) continue;

			// Check if user has required integrations
			const hasRequiredIntegrations = pathway.discoveryMoments.some((moment) =>
				moment.integrations.every((i) => context.connectedIntegrations.includes(i))
			);

			if (hasRequiredIntegrations) {
				frames.add(pathway.outcomeFrame);
			}
		}

		return Array.from(frames);
	}

	/**
	 * Get suggestions for an outcome frame
	 *
	 * When user selects "After meetings...", show relevant workflows.
	 * Still pre-curates by returning only the BEST workflow per integration pair.
	 */
	async getSuggestionsForFrame(
		frame: OutcomeFrame,
		context: DiscoveryContext
	): Promise<WorkflowSuggestion[]> {
		const suggestions: WorkflowSuggestion[] = [];
		const seenPairs = new Set<string>();

		// Get workflows for this frame
		const frameWorkflows = Array.from(this.workflows.values())
			.filter((w) => {
				const wPathway = getWorkflowPathway(w);
				return wPathway?.outcomeFrame === frame;
			})
			.filter((w) => !context.installedWorkflows.includes(getWorkflowId(w)))
			.filter((w) => !context.dismissedWorkflows.includes(getWorkflowId(w)));

		// Group by primary pair and select best for each
		for (const workflow of frameWorkflows) {
			const pathway = getWorkflowPathway(workflow)!;
			const pairKey = this.pairKey(pathway.primaryPair.from, pathway.primaryPair.to);

			// Check if user has required integrations
			const hasIntegrations = pathway.discoveryMoments.some((moment) =>
				moment.integrations.every((i) => context.connectedIntegrations.includes(i))
			);

			if (!hasIntegrations) continue;

			// Only one workflow per integration pair
			if (seenPairs.has(pairKey)) continue;
			seenPairs.add(pairKey);

			suggestions.push({
				workflowId: getWorkflowId(workflow),
				outcomeStatement: pathway.outcomeStatement,
				inferredConfig: this.inferConfig(workflow, context),
				triggerContext: {
					moment: pathway.discoveryMoments[0],
					timestamp: Date.now(),
					relevantIntegrations: context.connectedIntegrations,
				},
				oneClickReady: this.isOneClickReady(workflow, context),
				requiredFields: this.getRequiredFields(workflow, context),
			});
		}

		return suggestions;
	}

	// ========================================================================
	// PRIVATE METHODS
	// ========================================================================

	private findCandidates(
		context: DiscoveryContext
	): Array<{ workflow: WorkflowDefinition; moment: DiscoveryMoment; score: number }> {
		const candidates: Array<{ workflow: WorkflowDefinition; moment: DiscoveryMoment; score: number }> = [];

		for (const [, workflow] of this.workflows) {
			const pathway = getWorkflowPathway(workflow);
			if (!pathway) continue;

			// Skip already installed or dismissed
			const workflowId = getWorkflowId(workflow);
			if (context.installedWorkflows.includes(workflowId)) continue;
			if (context.dismissedWorkflows.includes(workflowId)) continue;

			for (const moment of pathway.discoveryMoments) {
				// Check if moment matches context
				if (!this.momentMatchesContext(moment, context)) continue;

				const score = this.calculateFitScore(workflow, moment, context);
				candidates.push({ workflow, moment, score });
			}
		}

		return candidates;
	}

	private momentMatchesContext(moment: DiscoveryMoment, context: DiscoveryContext): boolean {
		// Check integrations match
		const hasRequiredIntegrations = moment.integrations.every((i) =>
			context.connectedIntegrations.includes(i)
		);
		if (!hasRequiredIntegrations) return false;

		// Check trigger type matches context
		switch (moment.trigger) {
			case 'integration_connected':
				// Always matches if integrations are connected
				return true;

			case 'event_received':
				// Only matches if recent event matches
				if (!context.recentEvent) return false;
				if (moment.eventType && context.recentEvent.type !== moment.eventType) return false;
				return true;

			case 'time_based':
				// Always matches (scheduled suggestions)
				return true;

			case 'pattern_detected':
				// Would require pattern detection service - skip for now
				return false;

			default:
				return false;
		}
	}

	private selectBest(
		candidates: Array<{ workflow: WorkflowDefinition; moment: DiscoveryMoment; score: number }>,
		_context: DiscoveryContext
	): { workflow: WorkflowDefinition; moment: DiscoveryMoment } | null {
		if (candidates.length === 0) return null;

		// Sort by score descending
		candidates.sort((a, b) => b.score - a.score);

		return candidates[0];
	}

	/**
	 * Calculate fit score for a workflow
	 *
	 * Pre-launch: Uses only editorial signals (pathway metadata).
	 * No social proof (ratings, installs, retention) - we don't have users yet.
	 *
	 * Scoring is based on:
	 * 1. Discovery moment priority (author-declared)
	 * 2. Zuhandenheit indicators (tool recession)
	 * 3. Context match (event type, integrations)
	 * 4. Configuration simplicity (fewer essential fields)
	 */
	private calculateFitScore(
		workflow: WorkflowDefinition,
		moment: DiscoveryMoment,
		context: DiscoveryContext
	): number {
		const pathway = getWorkflowPathway(workflow)!;
		let score = 0;

		// Priority from discovery moment (0-100, author-declared)
		score += moment.priority;

		// Zuhandenheit bonus (tool recession indicators)
		if (pathway.zuhandenheit.worksOutOfBox) score += 20;
		if (pathway.zuhandenheit.gracefulDegradation) score += 10;
		if (pathway.zuhandenheit.automaticTrigger) score += 10;

		// Time-to-value bonus (faster = better)
		if (pathway.zuhandenheit.timeToValue < 5) score += 15;
		else if (pathway.zuhandenheit.timeToValue < 60) score += 10;
		else if (pathway.zuhandenheit.timeToValue < 1440) score += 5;

		// Event match bonus (if event triggered discovery)
		if (context.recentEvent && moment.eventType === context.recentEvent.type) {
			score += 30;
		}

		// Essential fields bonus (fewer = better, enables one-click)
		const essentialCount = pathway.essentialFields.length;
		if (essentialCount === 0) score += 20; // One-click ready
		else if (essentialCount === 1) score += 15;
		else if (essentialCount <= 2) score += 10;
		else if (essentialCount <= 3) score += 5;

		// Future: Add social signals when available
		// if (workflow.stats?.successRate) score += workflow.stats.successRate * 0.2;
		// if (workflow.stats?.retention30d) score += workflow.stats.retention30d * 0.25;

		return score;
	}

	private inferConfig(
		workflow: WorkflowDefinition,
		context: DiscoveryContext
	): Record<string, unknown> {
		const config: Record<string, unknown> = {};
		const pathway = getWorkflowPathway(workflow);

		if (!pathway) return config;

		for (const [key, defaultSpec] of Object.entries(pathway.smartDefaults)) {
			if ('value' in defaultSpec) {
				config[key] = defaultSpec.value;
			} else if (defaultSpec.inferFrom === 'user_timezone' && context.timezone) {
				config[key] = context.timezone;
			} else if (defaultSpec.inferFrom === 'user_preference' && context.preferences) {
				config[key] = context.preferences[defaultSpec.key];
			}
			// connected_integration inference would require actual integration data
		}

		return config;
	}

	private isOneClickReady(workflow: WorkflowDefinition, _context: DiscoveryContext): boolean {
		const pathway = getWorkflowPathway(workflow);
		if (!pathway) return false;

		// One-click ready if no essential fields OR all essential fields can be inferred
		return pathway.essentialFields.length === 0;
	}

	private getRequiredFields(
		workflow: WorkflowDefinition,
		_context: DiscoveryContext
	): WorkflowSuggestion['requiredFields'] {
		const pathway = getWorkflowPathway(workflow);
		if (!pathway) return [];

		// Map essential fields to UI field definitions
		const configFields = workflow.configFields || [];

		return pathway.essentialFields.map((fieldKey) => {
			const field = configFields.find((f) => f.key === fieldKey);
			return {
				key: fieldKey,
				label: field?.label || fieldKey,
				type: (field?.type as any) || 'text',
			};
		});
	}

	private pairKey(from: string, to: string): string {
		return `${from.toLowerCase()}:${to.toLowerCase()}`;
	}

	private addToIndex(index: Map<string, string[]>, key: string, workflowId: string): void {
		const existing = index.get(key) || [];
		if (!existing.includes(workflowId)) {
			existing.push(workflowId);
			index.set(key, existing);
		}
	}

	// ========================================================================
	// VORHANDENHEIT: BREAKDOWN HANDLING
	// ========================================================================

	/**
	 * Report a breakdown for a workflow
	 *
	 * When a workflow fails, it transitions from Zuhandenheit (invisible)
	 * to Vorhandenheit (visible). This method tracks that transition.
	 *
	 * @param workflowId - The workflow that broke down
	 * @param error - The error that caused the breakdown
	 * @param context - Additional context about the breakdown
	 */
	reportBreakdown(
		workflowId: string,
		error: Error,
		_context?: { attemptedRecovery?: boolean; userNotified?: boolean }
	): BreakdownEvent {
		const severity = classifyBreakdown(error);
		const breakdown = createBreakdown(
			this.classifyBreakdownType(error),
			workflowId,
			this.getBreakdownMessage(error, severity),
			{
				severity,
				originalError: error,
				recovery: {
					automatic: severity === BreakdownSeverity.SILENT,
					steps: this.getRecoverySteps(error),
					estimatedTime: this.estimateRecoveryTime(severity),
				},
			}
		);

		// Update visibility state
		const state = this.getOrCreateVisibilityState(workflowId);
		state.zuhandenheit = false;
		state.breakdown = breakdown;
		state.breakdownHistory.push({
			event: breakdown,
			resolvedAt: undefined,
			resolutionMethod: undefined,
		});

		// Recalculate disappearance score
		state.disappearanceScore = this.calculateDisappearanceScore(state);

		return breakdown;
	}

	/**
	 * Report that a breakdown has been resolved
	 *
	 * The tool returns to Zuhandenheit (invisibility).
	 */
	resolveBreakdown(
		workflowId: string,
		resolutionMethod: 'automatic' | 'manual' = 'manual'
	): void {
		const state = this.visibilityStates.get(workflowId);
		if (!state) return;

		// Mark the current breakdown as resolved
		if (state.breakdownHistory.length > 0) {
			const lastBreakdown = state.breakdownHistory[state.breakdownHistory.length - 1];
			lastBreakdown.resolvedAt = Date.now();
			lastBreakdown.resolutionMethod = resolutionMethod;
		}

		// Return to Zuhandenheit
		state.zuhandenheit = true;
		state.breakdown = undefined;
		state.timeSinceLastBreakdown = 0;

		// Recalculate disappearance score
		state.disappearanceScore = this.calculateDisappearanceScore(state);
	}

	/**
	 * Get the visibility state for a workflow
	 *
	 * Returns whether the tool is currently in Zuhandenheit (invisible)
	 * or Vorhandenheit (visible due to breakdown).
	 */
	getVisibilityState(workflowId: string): ToolVisibilityState | undefined {
		return this.visibilityStates.get(workflowId);
	}

	/**
	 * Check if a workflow is currently in Zuhandenheit (working invisibly)
	 */
	isZuhandenheit(workflowId: string): boolean {
		const state = this.visibilityStates.get(workflowId);
		return state?.zuhandenheit ?? true; // Default to invisible
	}

	/**
	 * Get workflows currently in breakdown state
	 */
	getBreakdowns(): Array<{ workflowId: string; breakdown: BreakdownEvent }> {
		const breakdowns: Array<{ workflowId: string; breakdown: BreakdownEvent }> = [];

		for (const [workflowId, state] of this.visibilityStates) {
			if (!state.zuhandenheit && state.breakdown) {
				breakdowns.push({ workflowId, breakdown: state.breakdown });
			}
		}

		return breakdowns;
	}

	/**
	 * Get breakdowns that require user action
	 */
	getBlockingBreakdowns(): Array<{ workflowId: string; breakdown: BreakdownEvent }> {
		return this.getBreakdowns().filter(
			({ breakdown }) => breakdown.severity === BreakdownSeverity.BLOCKING
		);
	}

	// ========================================================================
	// TEMPORAL-AWARE DISCOVERY
	// ========================================================================

	/**
	 * Get suggestion with full temporal awareness
	 *
	 * Considers all three temporal ecstases:
	 * - Having-been: Recent events that shape the situation
	 * - Making-present: Current context (time, integrations)
	 * - Coming-toward: Anticipated future (scheduled events)
	 */
	async getSuggestionWithTemporalContext(
		context: DiscoveryContext & { temporal: TemporalContext }
	): Promise<WorkflowSuggestion | null> {
		// Check having-been first (most immediate - something just happened)
		if (context.temporal.havingBeen.recentEvents.length > 0) {
			const recentEvent = context.temporal.havingBeen.recentEvents[0];
			const contextWithEvent: DiscoveryContext = {
				...context,
				recentEvent,
			};

			const suggestion = await this.getSuggestionForTrigger('event_received', contextWithEvent);
			if (suggestion) return suggestion;
		}

		// Check coming-toward (anticipatory care - something is about to happen)
		if (context.temporal.comingToward.scheduledEvents?.length) {
			const nextEvent = context.temporal.comingToward.scheduledEvents[0];
			const timeUntil = nextEvent.timestamp - Date.now();

			// If event is within 30 minutes, suggest preparation workflows
			if (timeUntil > 0 && timeUntil < 30 * 60 * 1000) {
				// Could add pre-event workflow suggestions here
				// For now, fall through to making-present
			}
		}

		// Fall back to making-present (general context)
		// Check for time-based suggestions (e.g., Monday morning → Team Digest)
		const { hourOfDay, dayOfWeek, isWorkday } = context.temporal.makingPresent;

		if (isWorkday && hourOfDay >= 8 && hourOfDay <= 10 && dayOfWeek === 1) {
			// Monday morning - suggest weekly digest
			const suggestion = await this.getSuggestionForTrigger('time_based', context);
			if (suggestion) return suggestion;
		}

		// Default to regular suggestion
		return this.getSuggestion(context);
	}

	// ========================================================================
	// PRIVATE HELPER METHODS (BREAKDOWN)
	// ========================================================================

	private getOrCreateVisibilityState(workflowId: string): ToolVisibilityState {
		let state = this.visibilityStates.get(workflowId);
		if (!state) {
			state = {
				zuhandenheit: true,
				breakdownHistory: [],
				disappearanceScore: 100, // Start with perfect invisibility
			};
			this.visibilityStates.set(workflowId, state);
		}
		return state;
	}

	private classifyBreakdownType(error: Error): BreakdownEvent['type'] {
		const message = error.message.toLowerCase();

		if (message.includes('configuration') || message.includes('config') || message.includes('missing')) {
			return 'configuration_required';
		}
		if (message.includes('unauthorized') || message.includes('token') || message.includes('oauth')) {
			return 'integration_disconnected';
		}
		if (message.includes('rate limit') || message.includes('throttle') || message.includes('429')) {
			return 'rate_limited';
		}
		if (message.includes('unavailable') || message.includes('down') || message.includes('503')) {
			return 'dependency_unavailable';
		}

		return 'execution_failed';
	}

	private getBreakdownMessage(error: Error, severity: BreakdownSeverity): string {
		// Messages focus on outcomes, not technical details
		const message = error.message.toLowerCase();

		if (message.includes('unauthorized') || message.includes('token')) {
			return 'Reconnection needed to continue';
		}
		if (message.includes('rate limit')) {
			return 'Temporarily paused (will resume shortly)';
		}
		if (message.includes('configuration')) {
			return 'Quick setup needed';
		}
		if (severity === BreakdownSeverity.SILENT) {
			return 'Retrying automatically';
		}

		return 'Something went wrong';
	}

	private getRecoverySteps(error: Error): string[] {
		const message = error.message.toLowerCase();

		if (message.includes('unauthorized') || message.includes('token')) {
			return ['Reconnect your integration', 'We\'ll resume automatically'];
		}
		if (message.includes('configuration')) {
			return ['Review workflow settings', 'Update missing fields'];
		}

		return ['Check workflow status', 'Contact support if issue persists'];
	}

	private estimateRecoveryTime(severity: BreakdownSeverity): number {
		switch (severity) {
			case BreakdownSeverity.SILENT:
				return 1; // 1 minute - auto-retry
			case BreakdownSeverity.AMBIENT:
				return 5; // 5 minutes - rate limit cooldown
			case BreakdownSeverity.NOTIFICATION:
				return 15; // 15 minutes - user needs to reconnect
			case BreakdownSeverity.BLOCKING:
				return 30; // 30 minutes - configuration needed
		}
	}

	private calculateDisappearanceScore(state: ToolVisibilityState): number {
		// Higher score = more invisible (better Zuhandenheit)
		// Score decreases with breakdowns, increases with time since last breakdown

		let score = 100;

		// Penalty for recent breakdowns
		const recentBreakdowns = state.breakdownHistory.filter(
			(b) => Date.now() - b.event.timestamp < 7 * 24 * 60 * 60 * 1000 // Last 7 days
		);

		for (const breakdown of recentBreakdowns) {
			switch (breakdown.event.severity) {
				case BreakdownSeverity.SILENT:
					score -= 2; // Minor penalty for silent issues
					break;
				case BreakdownSeverity.AMBIENT:
					score -= 5;
					break;
				case BreakdownSeverity.NOTIFICATION:
					score -= 15;
					break;
				case BreakdownSeverity.BLOCKING:
					score -= 25;
					break;
			}

			// Bonus for auto-resolved issues
			if (breakdown.resolutionMethod === 'automatic') {
				score += 5;
			}
		}

		// Bonus for long periods without breakdown
		if (state.timeSinceLastBreakdown) {
			const daysSinceBreakdown = state.timeSinceLastBreakdown / (24 * 60 * 60 * 1000);
			score += Math.min(daysSinceBreakdown * 2, 20); // Up to +20 for 10+ days
		}

		// Current breakdown penalty
		if (!state.zuhandenheit) {
			score -= 30;
		}

		return Math.max(0, Math.min(100, score));
	}
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a DiscoveryService instance
 */
export function createDiscoveryService(): DiscoveryService {
	return new DiscoveryService();
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a temporal context from the current moment
 *
 * Helper to construct a TemporalContext for discovery.
 */
export function createTemporalContext(
	connectedIntegrations: string[],
	timezone: string = 'UTC',
	recentEvents: TemporalContext['havingBeen']['recentEvents'] = [],
	scheduledEvents: TemporalContext['comingToward']['scheduledEvents'] = []
): TemporalContext {
	const now = new Date();
	const dayOfWeek = now.getDay();
	const hourOfDay = now.getHours();
	const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 5;

	return {
		havingBeen: {
			recentEvents,
			horizon: 60 * 60 * 1000, // 1 hour default
		},
		makingPresent: {
			connectedIntegrations,
			currentTime: now,
			timezone,
			dayOfWeek,
			hourOfDay,
			isWorkday,
		},
		comingToward: {
			scheduledEvents,
			horizon: 24 * 60 * 60 * 1000, // 24 hours default
		},
	};
}

// ============================================================================
// EXPORTS
// ============================================================================

// Types exported via declarations above:
// - TemporalContext
// - DiscoveryContext
