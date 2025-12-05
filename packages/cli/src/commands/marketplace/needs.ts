/**
 * Marketplace Needs Command - Pathway Model Discovery
 *
 * Instead of browsing categories, users express what they need.
 * The system surfaces ONE workflow - the best path to the outcome.
 *
 * Heideggerian principle: The tool recedes; the outcome remains.
 * Users don't "shop for workflows" - they accept suggestions.
 *
 * @example
 * ```bash
 * # Outcome-based discovery
 * workway needs --from zoom --to notion
 * workway needs --after meetings
 * workway needs                          # Interactive mode
 *
 * # Show what's possible with connected integrations
 * workway needs --show-outcomes
 * ```
 *
 * See: docs/MARKETPLACE_CURATION.md
 * See: docs/OUTCOME_TAXONOMY.md
 */

import inquirer from 'inquirer';
import { Logger } from '../../utils/logger.js';
import {
	integrationPairs,
	outcomeFrames,
	getWorkflowForPair,
	getPairsForOutcome,
	type IntegrationPairKey,
} from '@workwayco/workflows';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Outcome frame - verb-driven discovery
 */
type OutcomeFrameId = keyof typeof outcomeFrames;

/**
 * Workflow suggestion from the pathway model
 */
interface PathwaySuggestion {
	workflowId: string;
	suggestion: string;
	explanation: string;
	outcome: string;
	from: string;
	to: string;
	outcomeFrame: string;
}

/**
 * Command options
 */
interface NeedsOptions {
	from?: string;
	to?: string;
	after?: string;
	showOutcomes?: boolean;
}

// ============================================================================
// DATA TRANSFORMATION
// ============================================================================

/**
 * Convert registry pair to PathwaySuggestion for display
 */
function pairToSuggestion(
	pairKey: string,
	pairData: { workflowId: string; outcome: string; outcomeFrame: string }
): PathwaySuggestion {
	const [from, to] = pairKey.split(':');

	// Generate suggestion text based on outcome frame
	const suggestionText = generateSuggestionText(from, to, pairData.outcome);
	const explanationText = generateExplanationText(from, to, pairData.outcome);

	return {
		workflowId: pairData.workflowId,
		suggestion: suggestionText,
		explanation: explanationText,
		outcome: pairData.outcome,
		from,
		to,
		outcomeFrame: pairData.outcomeFrame,
	};
}

/**
 * Generate suggestion question based on outcome
 */
function generateSuggestionText(from: string, to: string, outcome: string): string {
	// Transform outcome into a question
	// "Zoom meetings that write their own notes" -> "Want meetings that write their own notes?"
	const lowerOutcome = outcome.toLowerCase();

	if (lowerOutcome.includes('automatically') || lowerOutcome.includes('that')) {
		return `Want ${lowerOutcome}?`;
	}

	return `Want ${from} → ${to} automation?`;
}

/**
 * Generate explanation text based on integrations
 */
function generateExplanationText(from: string, to: string, outcome: string): string {
	const fromTitle = from.charAt(0).toUpperCase() + from.slice(1);
	const toTitle = to.charAt(0).toUpperCase() + to.slice(1);

	return `When ${fromTitle} events occur, we'll update ${toTitle} automatically.`;
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Display a single workflow suggestion
 *
 * No ratings. No install counts. No social proof.
 * Just the outcome and how to get there.
 */
function displaySuggestion(suggestion: PathwaySuggestion): void {
	Logger.blank();
	Logger.log(`  ${suggestion.suggestion}`);
	Logger.blank();
	Logger.log(`  ${suggestion.explanation}`);
	Logger.blank();
	Logger.log(`  ${suggestion.from} → ${suggestion.to}`);
	Logger.log(`  Outcome: ${suggestion.outcome}`);
	Logger.blank();
}

/**
 * Display outcome frame options
 */
function displayOutcomeFrames(): void {
	Logger.blank();
	Logger.info('What do you need?');
	Logger.blank();

	for (const [frameId, frame] of Object.entries(outcomeFrames)) {
		const pairs = getPairsForOutcome(frameId);
		if (pairs.length > 0) {
			Logger.log(`  ${frame.label}`);
			Logger.log(`    ${frame.description}`);
			Logger.blank();
		}
	}
}

// ============================================================================
// COMMAND IMPLEMENTATION
// ============================================================================

/**
 * Get suggestion for integration pair
 */
async function getSuggestionForPairImpl(from: string, to: string): Promise<PathwaySuggestion | null> {
	const pairData = getWorkflowForPair(from, to);
	if (!pairData) return null;

	const pairKey = `${from.toLowerCase()}:${to.toLowerCase()}`;
	return pairToSuggestion(pairKey, pairData);
}

/**
 * Get suggestions for outcome frame
 */
async function getSuggestionsForFrame(frameId: string): Promise<PathwaySuggestion[]> {
	const pairs = getPairsForOutcome(frameId);

	return pairs.map((pair) => ({
		workflowId: pair.workflowId,
		suggestion: generateSuggestionText(pair.from, pair.to, pair.outcome),
		explanation: generateExplanationText(pair.from, pair.to, pair.outcome),
		outcome: pair.outcome,
		from: pair.from,
		to: pair.to,
		outcomeFrame: pair.outcomeFrame,
	}));
}

/**
 * Marketplace needs command - Pathway model discovery
 */
export async function marketplaceNeedsCommand(options: NeedsOptions = {}): Promise<void> {
	Logger.header('What do you need?');

	// Option 1: Integration pair specified (--from, --to)
	if (options.from && options.to) {
		Logger.blank();
		const spinner = Logger.spinner(`Finding ${options.from} → ${options.to} automation...`);
		await new Promise((resolve) => setTimeout(resolve, 400));

		const suggestion = await getSuggestionForPairImpl(options.from, options.to);

		if (!suggestion) {
			spinner.fail(`No workflow found for ${options.from} → ${options.to}`);
			Logger.blank();
			Logger.log('  Try one of these combinations:');
			for (const key of Object.keys(integrationPairs)) {
				const [f, t] = key.split(':');
				Logger.log(`    --from ${f} --to ${t}`);
			}
			return;
		}

		spinner.succeed('Found your path');
		displaySuggestion(suggestion);

		// Prompt for action
		const action = await inquirer.prompt([
			{
				type: 'list',
				name: 'choice',
				message: 'What would you like to do?',
				choices: [
					{ name: 'Enable this workflow', value: 'enable' },
					{ name: 'Learn more', value: 'info' },
					{ name: 'Not now', value: 'exit' },
				],
			},
		]);

		if (action.choice === 'enable') {
			Logger.blank();
			Logger.info(`To enable: workway workflow enable ${suggestion.workflowId}`);
		} else if (action.choice === 'info') {
			Logger.blank();
			Logger.info(`To learn more: workway marketplace info ${suggestion.workflowId}`);
		}
		return;
	}

	// Option 2: Outcome frame specified (--after)
	if (options.after) {
		// Try both with and without "after_" prefix
		const frameKey = options.after.startsWith('after_')
			? options.after
			: `after_${options.after}`;

		const frame = outcomeFrames[frameKey as OutcomeFrameId] ||
			outcomeFrames[options.after as OutcomeFrameId];

		const effectiveFrameKey = outcomeFrames[frameKey as OutcomeFrameId]
			? frameKey
			: options.after;

		if (!frame) {
			Logger.blank();
			Logger.error(`Unknown outcome: ${options.after}`);
			Logger.log('');
			Logger.log('Try one of these:');
			for (const [id, f] of Object.entries(outcomeFrames)) {
				Logger.log(`  --after ${id.replace('after_', '').replace('when_', '').replace('_', '-')}`);
			}
			return;
		}

		Logger.blank();
		const spinner = Logger.spinner(`Finding automations for "${frame.label}"...`);
		await new Promise((resolve) => setTimeout(resolve, 400));

		const suggestions = await getSuggestionsForFrame(effectiveFrameKey);

		if (suggestions.length === 0) {
			spinner.fail(`No workflows found for "${frame.label}"`);
			return;
		}

		spinner.succeed(`${suggestions.length} option${suggestions.length === 1 ? '' : 's'} found`);

		// Show the best suggestion (first one)
		displaySuggestion(suggestions[0]);

		if (suggestions.length > 1) {
			Logger.log(`  (${suggestions.length - 1} more option${suggestions.length > 2 ? 's' : ''} available)`);
			Logger.blank();
		}

		// Prompt for action
		const choices = [
			{ name: 'Enable this workflow', value: 'enable' },
			{ name: 'Learn more', value: 'info' },
		];

		if (suggestions.length > 1) {
			choices.push({ name: 'Show alternatives', value: 'alternatives' });
		}
		choices.push({ name: 'Not now', value: 'exit' });

		const action = await inquirer.prompt([
			{
				type: 'list',
				name: 'choice',
				message: 'What would you like to do?',
				choices,
			},
		]);

		if (action.choice === 'enable') {
			Logger.blank();
			Logger.info(`To enable: workway workflow enable ${suggestions[0].workflowId}`);
		} else if (action.choice === 'info') {
			Logger.blank();
			Logger.info(`To learn more: workway marketplace info ${suggestions[0].workflowId}`);
		} else if (action.choice === 'alternatives') {
			Logger.blank();
			Logger.info('Alternative workflows:');
			for (let i = 1; i < suggestions.length; i++) {
				const s = suggestions[i];
				Logger.log(`  ${s.from} → ${s.to}: ${s.outcome}`);
			}
		}
		return;
	}

	// Option 3: Show available outcomes (--show-outcomes)
	if (options.showOutcomes) {
		displayOutcomeFrames();
		return;
	}

	// Option 4: Interactive mode (no flags)
	Logger.blank();

	// Build choices from outcome frames that have workflows
	const frameChoices: Array<{ name: string; value: string }> = Object.entries(outcomeFrames)
		.filter(([frameId]) => getPairsForOutcome(frameId).length > 0)
		.map(([frameId, frame]) => ({
			name: frame.label,
			value: frameId,
		}));

	frameChoices.push({ name: '← Specify integrations manually', value: 'manual' });
	frameChoices.push({ name: '✕ Exit', value: 'exit' });

	const frameAnswer = await inquirer.prompt([
		{
			type: 'list',
			name: 'frame',
			message: 'What do you need?',
			choices: frameChoices,
		},
	]);

	if (frameAnswer.frame === 'exit') return;

	if (frameAnswer.frame === 'manual') {
		// Manual integration pair entry
		const pairAnswer = await inquirer.prompt([
			{
				type: 'input',
				name: 'from',
				message: 'From integration (e.g., zoom, stripe):',
			},
			{
				type: 'input',
				name: 'to',
				message: 'To integration (e.g., notion, slack):',
			},
		]);

		await marketplaceNeedsCommand({ from: pairAnswer.from, to: pairAnswer.to });
		return;
	}

	// Get suggestions for selected frame
	const suggestions = await getSuggestionsForFrame(frameAnswer.frame);

	if (suggestions.length === 0) {
		Logger.blank();
		Logger.log('  No workflows available for this outcome yet.');
		return;
	}

	// Show the best suggestion
	displaySuggestion(suggestions[0]);

	// Prompt for action
	const choices = [
		{ name: 'Enable this workflow', value: 'enable' },
		{ name: 'Learn more', value: 'info' },
	];

	if (suggestions.length > 1) {
		choices.push({ name: `Show ${suggestions.length - 1} alternative${suggestions.length > 2 ? 's' : ''}`, value: 'alternatives' });
	}
	choices.push({ name: 'Choose different outcome', value: 'back' });
	choices.push({ name: 'Not now', value: 'exit' });

	const action = await inquirer.prompt([
		{
			type: 'list',
			name: 'choice',
			message: 'What would you like to do?',
			choices,
		},
	]);

	if (action.choice === 'enable') {
		Logger.blank();
		Logger.info(`To enable: workway workflow enable ${suggestions[0].workflowId}`);
	} else if (action.choice === 'info') {
		Logger.blank();
		Logger.info(`To learn more: workway marketplace info ${suggestions[0].workflowId}`);
	} else if (action.choice === 'alternatives') {
		Logger.blank();
		Logger.info('Alternative workflows:');
		for (let i = 1; i < suggestions.length; i++) {
			const s = suggestions[i];
			Logger.log(`  ${s.from} → ${s.to}: ${s.outcome}`);
			Logger.log(`    workway marketplace info ${s.workflowId}`);
			Logger.blank();
		}
	} else if (action.choice === 'back') {
		await marketplaceNeedsCommand({});
	}
}

export default marketplaceNeedsCommand;
