/**
 * WORKWAY Workflow Principles (Ethos)
 *
 * Adapted from the Subtractive Triad to WORKWAY-specific workflow principles.
 * These guide Claude Code instances during workflow development.
 *
 * Philosophy:
 * - Zuhandenheit: The tool recedes; the outcome remains
 * - Weniger, aber besser: Less, but better (Dieter Rams)
 */

export type EthosCategory =
	| 'zuhandenheit' // Tool recession - the tool disappears into the outcome
	| 'outcome_focus' // Outcomes over mechanisms
	| 'simplicity' // Weniger, aber besser (Less, but better)
	| 'resilience' // Graceful degradation, error handling
	| 'honesty'; // Honest naming, no marketing jargon

export interface WorkflowPrinciple {
	category: EthosCategory;
	content: string;
	context?: string;
	setAt: string;
}

export interface WorkflowEthos {
	lastUpdated: string;
	principles: WorkflowPrinciple[];
}

/**
 * Default principles for each ethos category
 */
export const ETHOS_DEFAULTS: Record<EthosCategory, Omit<WorkflowPrinciple, 'setAt'>> = {
	zuhandenheit: {
		category: 'zuhandenheit',
		content: 'My workflows should be invisible when working correctly',
		context: 'Heidegger: The hammer recedes when used well. So should my automations.'
	},
	outcome_focus: {
		category: 'outcome_focus',
		content: "I describe workflows by what disappears from to-do lists, not what tech they use",
		context: 'The Outcome Test: Can I describe value without mentioning technology?'
	},
	simplicity: {
		category: 'simplicity',
		content: 'I remove features until the workflow breaks, then add back only what is essential',
		context: 'Dieter Rams: Good design is as little design as possible.'
	},
	resilience: {
		category: 'resilience',
		content: 'My workflows fail gracefully and explain themselves when they break',
		context:
			'Vorhandenheit: When tools become visible, they should guide users back to invisibility.'
	},
	honesty: {
		category: 'honesty',
		content: 'I name things for what they do, not what sounds impressive',
		context: 'No fake social proof. No marketing jargon. The code speaks for itself.'
	}
};

/**
 * Reflection prompts for each ethos category
 */
export const REFLECTION_PROMPTS: Record<EthosCategory, string[]> = {
	zuhandenheit: [
		'Think of a workflow you built recently. When does the user think about it?',
		'What would it mean for this automation to truly disappear?',
		'If your workflow worked perfectly, what would the user notice?'
	],
	outcome_focus: [
		'Describe your last workflow without mentioning any APIs or services.',
		'What to-do item does this workflow eliminate?',
		'If you told a non-technical friend about this, what would you say?'
	],
	simplicity: [
		'What could you remove from this workflow without breaking it?',
		'Is every configuration option necessary?',
		'Could a new user understand this in 60 seconds?'
	],
	resilience: [
		'What happens when the API is down?',
		'How does the user know something went wrong?',
		'What is the path back to normal operation?'
	],
	honesty: [
		'Does the name describe what it actually does?',
		'Would you feel comfortable if users read the source code?',
		'Are there any claims in your UI that the code cannot back up?'
	]
};

/**
 * Get all ethos categories
 */
export function getEthosCategories(): EthosCategory[] {
	return ['zuhandenheit', 'outcome_focus', 'simplicity', 'resilience', 'honesty'];
}

/**
 * Get a random reflection prompt for a category
 */
export function getRandomPrompt(category: EthosCategory): string {
	const prompts = REFLECTION_PROMPTS[category];
	return prompts[Math.floor(Math.random() * prompts.length)];
}

/**
 * Create default ethos with current timestamp
 */
export function createDefaultEthos(): WorkflowEthos {
	const now = new Date().toISOString();
	return {
		lastUpdated: now,
		principles: getEthosCategories().map((category) => ({
			...ETHOS_DEFAULTS[category],
			setAt: now
		}))
	};
}
