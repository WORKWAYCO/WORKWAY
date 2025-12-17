/**
 * learn_ethos Tool
 *
 * Manage personal workflow principles.
 */

import { loadEthos, saveEthos, updatePrinciple, getPrinciple } from '../../ethos/defaults.js';
import {
	type EthosCategory,
	type WorkflowPrinciple,
	type WorkflowEthos,
	ETHOS_DEFAULTS,
	REFLECTION_PROMPTS,
	getRandomPrompt,
	getEthosCategories
} from '../../ethos/schema.js';

export const definition = {
	name: 'learn_ethos',
	description: 'Manage personal workflow principles (Zuhandenheit, outcome focus, simplicity, resilience, honesty)',
	inputSchema: {
		type: 'object' as const,
		properties: {
			action: {
				type: 'string',
				enum: ['get', 'set', 'reflect', 'suggest', 'reset'],
				description: 'Action to perform: get (view all), set (update principle), reflect (prompt for category), suggest (get suggestions), reset (restore defaults)'
			},
			category: {
				type: 'string',
				enum: ['zuhandenheit', 'outcome_focus', 'simplicity', 'resilience', 'honesty'],
				description: 'Ethos category (for set/reflect actions)'
			},
			content: {
				type: 'string',
				description: 'New principle content (for set action)'
			},
			context: {
				type: 'string',
				description: 'Why this principle matters to you (for set action)'
			}
		},
		required: ['action']
	}
};

export interface LearnEthosInput {
	action: 'get' | 'set' | 'reflect' | 'suggest' | 'reset';
	category?: EthosCategory;
	content?: string;
	context?: string;
}

export interface LearnEthosOutput {
	ethos: WorkflowEthos;
	message: string;
	reflection?: string;
	suggestions?: Array<{
		category: EthosCategory;
		suggestion: string;
		rationale: string;
	}>;
}

export async function handler(input: LearnEthosInput): Promise<LearnEthosOutput> {
	const { action, category, content, context } = input;

	switch (action) {
		case 'get': {
			const ethos = loadEthos();
			return {
				ethos,
				message: `You have ${ethos.principles.length} workflow principles defined.`
			};
		}

		case 'set': {
			if (!category || !content) {
				return {
					ethos: loadEthos(),
					message: 'Category and content are required for set action'
				};
			}

			const principle: WorkflowPrinciple = {
				category,
				content,
				context,
				setAt: new Date().toISOString()
			};

			const ethos = updatePrinciple(principle);

			return {
				ethos,
				message: `Updated "${category}" principle.`
			};
		}

		case 'reflect': {
			const ethos = loadEthos();
			const targetCategory = category || getEthosCategories()[Math.floor(Math.random() * 5)];
			const prompt = getRandomPrompt(targetCategory);
			const current = getPrinciple(targetCategory);

			return {
				ethos,
				message: `Reflecting on: ${targetCategory}`,
				reflection: `Current principle: "${current?.content || ETHOS_DEFAULTS[targetCategory].content}"\n\nReflection prompt: ${prompt}`
			};
		}

		case 'suggest': {
			const ethos = loadEthos();
			const suggestions = generateSuggestions(ethos);

			return {
				ethos,
				message: 'Here are some suggestions to strengthen your workflow principles:',
				suggestions
			};
		}

		case 'reset': {
			const ethos = loadEthos();
			const now = new Date().toISOString();

			// Reset to defaults
			const newEthos: WorkflowEthos = {
				lastUpdated: now,
				principles: getEthosCategories().map((cat) => ({
					...ETHOS_DEFAULTS[cat],
					setAt: now
				}))
			};

			saveEthos(newEthos);

			return {
				ethos: newEthos,
				message: 'Ethos reset to default principles.'
			};
		}

		default:
			return {
				ethos: loadEthos(),
				message: `Unknown action: ${action}`
			};
	}
}

/**
 * Generate suggestions for improving ethos
 */
function generateSuggestions(ethos: WorkflowEthos): Array<{
	category: EthosCategory;
	suggestion: string;
	rationale: string;
}> {
	const suggestions: Array<{
		category: EthosCategory;
		suggestion: string;
		rationale: string;
	}> = [];

	// Check for default principles that haven't been personalized
	for (const principle of ethos.principles) {
		const defaultPrinciple = ETHOS_DEFAULTS[principle.category];

		if (principle.content === defaultPrinciple.content) {
			suggestions.push({
				category: principle.category,
				suggestion: `Personalize your "${principle.category}" principle`,
				rationale:
					"You're still using the default. Consider what this principle means specifically in your workflow development practice."
			});
		}
	}

	// Check for missing context
	for (const principle of ethos.principles) {
		if (!principle.context && principle.content !== ETHOS_DEFAULTS[principle.category].content) {
			suggestions.push({
				category: principle.category,
				suggestion: `Add context to your "${principle.category}" principle`,
				rationale: 'Explaining why a principle matters helps reinforce it during development.'
			});
		}
	}

	// Suggest reflection if principles are old
	const oldestPrinciple = ethos.principles.reduce(
		(oldest, p) => (p.setAt < oldest.setAt ? p : oldest),
		ethos.principles[0]
	);

	const daysSinceOldest = Math.floor(
		(Date.now() - new Date(oldestPrinciple.setAt).getTime()) / (1000 * 60 * 60 * 24)
	);

	if (daysSinceOldest > 30) {
		suggestions.push({
			category: oldestPrinciple.category,
			suggestion: `Revisit your "${oldestPrinciple.category}" principle`,
			rationale: `It's been ${daysSinceOldest} days since you updated this. Has your understanding evolved?`
		});
	}

	return suggestions;
}
