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
} from './workflow-sdk';

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
}

// ============================================================================
// DISCOVERY SERVICE
// ============================================================================

/**
 * DiscoveryService - Returns ONE workflow suggestion at moments of relevance
 *
 * Not a list. Not options. One path to the outcome.
 * Users don't choose between workflows - they accept or defer.
 */
export class DiscoveryService {
	private workflows: Map<string, WorkflowDefinition> = new Map();
	private integrationPairIndex: Map<string, string[]> = new Map();
	private eventTypeIndex: Map<string, string[]> = new Map();

	/**
	 * Register workflows for discovery
	 */
	registerWorkflows(workflows: WorkflowDefinition[]): void {
		for (const workflow of workflows) {
			this.workflows.set(workflow.metadata.id, workflow);

			// Index by integration pairs for fast lookup
			if (workflow.metadata.pathway) {
				const pathway = workflow.metadata.pathway;

				// Index primary pair
				const pairKey = this.pairKey(pathway.primaryPair.from, pathway.primaryPair.to);
				this.addToIndex(this.integrationPairIndex, pairKey, workflow.metadata.id);

				// Index additional pairs
				for (const pair of pathway.additionalPairs || []) {
					const additionalKey = this.pairKey(pair.from, pair.to);
					this.addToIndex(this.integrationPairIndex, additionalKey, workflow.metadata.id);
				}

				// Index by event types
				for (const moment of pathway.discoveryMoments) {
					if (moment.eventType) {
						this.addToIndex(this.eventTypeIndex, moment.eventType, workflow.metadata.id);
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

		const pathway = best.workflow.metadata.pathway!;

		return {
			workflowId: best.workflow.metadata.id,
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

		const pathway = best.workflow.metadata.pathway!;

		return {
			workflowId: best.workflow.metadata.id,
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
				if (!w || !w.metadata.pathway) return false;
				if (context.installedWorkflows.includes(w.metadata.id)) return false;
				if (context.dismissedWorkflows.includes(w.metadata.id)) return false;
				return true;
			})
			.map((workflow) => ({
				workflow,
				moment: workflow.metadata.pathway!.discoveryMoments[0],
				score: this.calculateFitScore(workflow, workflow.metadata.pathway!.discoveryMoments[0], context),
			}));

		if (candidates.length === 0) return null;

		// Sort by score and return best
		candidates.sort((a, b) => b.score - a.score);
		const best = candidates[0];
		const pathway = best.workflow.metadata.pathway!;

		return {
			workflowId: best.workflow.metadata.id,
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
			if (!workflow.metadata.pathway) continue;

			const pathway = workflow.metadata.pathway;

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
			.filter((w) => w.metadata.pathway?.outcomeFrame === frame)
			.filter((w) => !context.installedWorkflows.includes(w.metadata.id))
			.filter((w) => !context.dismissedWorkflows.includes(w.metadata.id));

		// Group by primary pair and select best for each
		for (const workflow of frameWorkflows) {
			const pathway = workflow.metadata.pathway!;
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
				workflowId: workflow.metadata.id,
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
			if (!workflow.metadata.pathway) continue;

			// Skip already installed or dismissed
			if (context.installedWorkflows.includes(workflow.metadata.id)) continue;
			if (context.dismissedWorkflows.includes(workflow.metadata.id)) continue;

			const pathway = workflow.metadata.pathway;

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
		const pathway = workflow.metadata.pathway!;
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
		const pathway = workflow.metadata.pathway;

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
		const pathway = workflow.metadata.pathway;
		if (!pathway) return false;

		// One-click ready if no essential fields OR all essential fields can be inferred
		return pathway.essentialFields.length === 0;
	}

	private getRequiredFields(
		workflow: WorkflowDefinition,
		_context: DiscoveryContext
	): WorkflowSuggestion['requiredFields'] {
		const pathway = workflow.metadata.pathway;
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
// EXPORTS
// ============================================================================

// DiscoveryContext is already exported via the interface declaration above
