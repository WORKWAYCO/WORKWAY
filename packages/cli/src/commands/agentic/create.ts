/**
 * Agentic Create Command
 *
 * Generate workflows from natural language descriptions.
 * Zuhandenheit: Developer describes intent, Claude Code generates implementation.
 *
 * When intent is ambiguous, enters "clarification mode" - similar to
 * Claude Code's plan mode - to gather developer preferences before generating.
 *
 * @example
 * ```bash
 * workway create "A workflow that processes meeting recordings and creates tasks"
 * ```
 */

import inquirer from 'inquirer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Logger } from '../../utils/logger.js';

// ============================================================================
// CLARIFICATION PATTERNS - When multiple approaches are valid
// ============================================================================

interface ClarificationQuestion {
	id: string;
	question: string;
	options: Array<{ value: string; label: string; description: string }>;
	condition: (prompt: string, detected: DetectedConfig) => boolean;
}

interface DetectedConfig {
	integrations: string[];
	trigger: 'webhook' | 'schedule' | 'manual';
	hasAI: boolean;
	complexity: 'simple' | 'standard' | 'complex';
}

/**
 * Questions to ask when multiple valid approaches exist
 */
const CLARIFICATION_QUESTIONS: ClarificationQuestion[] = [
	{
		id: 'task_destination',
		question: 'Where should tasks/action items be created?',
		options: [
			{ value: 'linear', label: 'Linear', description: 'Best for engineering teams with sprints' },
			{ value: 'asana', label: 'Asana', description: 'Best for cross-functional project management' },
			{ value: 'notion', label: 'Notion Database', description: 'Best if you want tasks alongside docs' },
			{ value: 'github', label: 'GitHub Issues', description: 'Best for open source or code-related tasks' },
		],
		condition: (prompt, _detected) => {
			const lower = prompt.toLowerCase();
			return (lower.includes('task') || lower.includes('action item') || lower.includes('todo')) &&
				!lower.includes('linear') && !lower.includes('asana') && !lower.includes('notion') && !lower.includes('github issue');
		},
	},
	{
		id: 'notification_channel',
		question: 'How should notifications be delivered?',
		options: [
			{ value: 'slack', label: 'Slack', description: 'Real-time team notifications' },
			{ value: 'email', label: 'Email', description: 'Async notifications, good for external stakeholders' },
			{ value: 'both', label: 'Both', description: 'Slack for team, email for external' },
			{ value: 'none', label: 'No notifications', description: 'Silent operation' },
		],
		condition: (prompt, _detected) => {
			const lower = prompt.toLowerCase();
			return (lower.includes('notify') || lower.includes('alert') || lower.includes('send')) &&
				!lower.includes('slack') && !lower.includes('email');
		},
	},
	{
		id: 'document_storage',
		question: 'Where should documents/summaries be stored?',
		options: [
			{ value: 'notion', label: 'Notion', description: 'Rich documents with databases' },
			{ value: 'google_docs', label: 'Google Docs', description: 'Collaborative editing' },
			{ value: 'confluence', label: 'Confluence', description: 'Enterprise wiki' },
			{ value: 'markdown', label: 'GitHub/Markdown', description: 'Version-controlled docs' },
		],
		condition: (prompt, _detected) => {
			const lower = prompt.toLowerCase();
			return (lower.includes('document') || lower.includes('summary') || lower.includes('notes') || lower.includes('report')) &&
				!lower.includes('notion') && !lower.includes('google doc') && !lower.includes('confluence');
		},
	},
	{
		id: 'trigger_frequency',
		question: 'How often should this workflow run?',
		options: [
			{ value: 'realtime', label: 'Real-time (webhook)', description: 'Triggered immediately when events occur' },
			{ value: 'hourly', label: 'Hourly', description: 'Batch process every hour' },
			{ value: 'daily', label: 'Daily', description: 'Once per day (9am)' },
			{ value: 'manual', label: 'Manual', description: 'Only when explicitly triggered' },
		],
		condition: (prompt, detected) => {
			const lower = prompt.toLowerCase();
			// Ask if no clear timing indicator
			return detected.trigger === 'manual' &&
				!lower.includes('when') && !lower.includes('daily') && !lower.includes('hourly') &&
				!lower.includes('real-time') && !lower.includes('schedule');
		},
	},
	{
		id: 'ai_depth',
		question: 'How deep should the AI analysis be?',
		options: [
			{ value: 'quick', label: 'Quick', description: 'Fast, surface-level analysis (~$0.01/run)' },
			{ value: 'standard', label: 'Standard', description: 'Balanced depth and cost (~$0.05/run)' },
			{ value: 'detailed', label: 'Detailed', description: 'Deep analysis with nuance (~$0.15/run)' },
		],
		condition: (_prompt, detected) => detected.hasAI,
	},
	{
		id: 'complexity',
		question: 'What level of workflow do you need?',
		options: [
			{ value: 'simple', label: 'Simple', description: 'Single integration, straightforward logic' },
			{ value: 'standard', label: 'Standard', description: 'Multiple integrations, common patterns' },
			{ value: 'complex', label: 'Complex', description: 'Advanced logic, error handling, retries' },
		],
		condition: (_prompt, detected) => detected.complexity === 'standard' && detected.integrations.length >= 2,
	},
];

/**
 * Example workflow prompts for guidance
 */
const EXAMPLE_PROMPTS = [
	'A workflow that monitors GitHub PRs and posts AI code reviews to Slack',
	'A workflow that processes meeting recordings and creates Linear tasks',
	'A workflow that analyzes customer feedback and identifies trends in Notion',
	'A workflow that syncs Stripe payments to Google Sheets daily',
	'A workflow that transcribes voice memos and saves summaries to Notion',
];

/**
 * Integration hints based on keywords
 */
const INTEGRATION_HINTS: Record<string, string[]> = {
	github: ['github', 'pr', 'pull request', 'commit', 'issue', 'repository'],
	slack: ['slack', 'message', 'channel', 'notify', 'alert', 'team'],
	notion: ['notion', 'database', 'page', 'document', 'notes', 'wiki'],
	linear: ['linear', 'task', 'issue', 'project', 'sprint', 'ticket'],
	gmail: ['email', 'gmail', 'inbox', 'mail', 'send', 'receive'],
	stripe: ['stripe', 'payment', 'subscription', 'invoice', 'customer', 'charge'],
	zoom: ['zoom', 'meeting', 'recording', 'call', 'video'],
	airtable: ['airtable', 'spreadsheet', 'table', 'record', 'base'],
	sheets: ['sheets', 'google sheets', 'spreadsheet', 'csv', 'excel'],
};

/**
 * Detect integrations from prompt
 */
function detectIntegrations(prompt: string): string[] {
	const lower = prompt.toLowerCase();
	const detected: string[] = [];

	for (const [integration, keywords] of Object.entries(INTEGRATION_HINTS)) {
		if (keywords.some((kw) => lower.includes(kw))) {
			detected.push(integration);
		}
	}

	return detected;
}

/**
 * Detect trigger type from prompt
 */
function detectTrigger(prompt: string): 'webhook' | 'schedule' | 'manual' {
	const lower = prompt.toLowerCase();

	if (lower.includes('daily') || lower.includes('hourly') || lower.includes('weekly') || lower.includes('cron') || lower.includes('schedule')) {
		return 'schedule';
	}

	if (lower.includes('when') || lower.includes('monitors') || lower.includes('receives') || lower.includes('on new') || lower.includes('created')) {
		return 'webhook';
	}

	return 'manual';
}

/**
 * Detect if AI is needed
 */
function detectAI(prompt: string): boolean {
	const lower = prompt.toLowerCase();
	const aiKeywords = ['analyze', 'synthesis', 'summarize', 'extract', 'classify', 'sentiment', 'generate', 'ai', 'intelligent', 'smart', 'transcribe'];
	return aiKeywords.some((kw) => lower.includes(kw));
}

/**
 * Detect complexity
 */
function detectComplexity(prompt: string, integrations: string[]): 'simple' | 'standard' | 'complex' {
	const lower = prompt.toLowerCase();

	if (integrations.length >= 4 || lower.includes('complex') || lower.includes('advanced')) {
		return 'complex';
	}
	if (integrations.length <= 1 && !lower.includes('ai') && !lower.includes('analyze')) {
		return 'simple';
	}
	return 'standard';
}

/**
 * Full detection
 */
function detectConfig(prompt: string): DetectedConfig {
	const integrations = detectIntegrations(prompt);
	return {
		integrations,
		trigger: detectTrigger(prompt),
		hasAI: detectAI(prompt),
		complexity: detectComplexity(prompt, integrations),
	};
}

/**
 * Get outcome statement for a given frame
 */
function getOutcomeStatement(frame: string | null): string {
	if (!frame) return 'This workflow automates my work';

	const statements: Record<string, string> = {
		after_meetings: 'After meetings, everything is documented',
		before_meetings: 'Before meetings, I have all the context I need',
		after_calls: 'After calls, follow-ups happen automatically',
		when_payments_arrive: 'When payments arrive, everything updates',
		when_leads_come_in: 'When leads come in, they route themselves',
		when_tickets_arrive: 'When tickets arrive, they go to the right team',
		when_clients_onboard: 'When clients onboard, the process runs itself',
		when_data_changes: 'When data changes, everything stays in sync',
		every_morning: 'Every morning, I have my digest ready',
		weekly_automatically: 'Weekly reports write themselves',
		when_tasks_complete: 'When tasks complete, they log themselves',
		when_code_changes: 'When code changes, everyone knows',
		when_issues_arrive: 'When issues arrive, they sync across tools',
		when_errors_happen: 'When errors happen, they document themselves',
	};

	return statements[frame] || 'This workflow automates my work';
}

/**
 * Detect outcome frame from prompt
 * Maps to UNDERSTANDING.md outcome taxonomy
 */
function detectOutcomeFrame(prompt: string): string | null {
	const lower = prompt.toLowerCase();

	// Meeting-related
	if (lower.includes('after meeting') || lower.includes('meeting end')) return 'after_meetings';
	if (lower.includes('before meeting') || lower.includes('meeting prep')) return 'before_meetings';
	if (lower.includes('after call')) return 'after_calls';

	// Payment-related
	if (lower.includes('payment') || lower.includes('invoice')) return 'when_payments_arrive';

	// Lead-related
	if (lower.includes('lead') || lower.includes('form submit')) return 'when_leads_come_in';

	// Ticket-related
	if (lower.includes('ticket') || lower.includes('support')) return 'when_tickets_arrive';

	// Client-related
	if (lower.includes('onboard') || lower.includes('new client')) return 'when_clients_onboard';

	// Data sync
	if (lower.includes('sync') || lower.includes('data change')) return 'when_data_changes';

	// Time-based
	if (lower.includes('daily') || lower.includes('every morning')) return 'every_morning';
	if (lower.includes('weekly')) return 'weekly_automatically';

	// Task-related
	if (lower.includes('task complete') || lower.includes('todo complete')) return 'when_tasks_complete';

	// Code-related
	if (lower.includes('pr') || lower.includes('pull request') || lower.includes('code review')) return 'when_code_changes';
	if (lower.includes('issue')) return 'when_issues_arrive';

	// Error-related
	if (lower.includes('error') || lower.includes('incident')) return 'when_errors_happen';

	return null;
}

/**
 * Get applicable clarification questions
 */
function getApplicableQuestions(prompt: string, detected: DetectedConfig): ClarificationQuestion[] {
	return CLARIFICATION_QUESTIONS.filter((q) => q.condition(prompt, detected));
}

/**
 * Ask clarification questions interactively
 */
async function askClarifications(
	questions: ClarificationQuestion[]
): Promise<Record<string, string>> {
	const answers: Record<string, string> = {};

	Logger.blank();
	Logger.info('I have a few questions to ensure the workflow matches your needs:');
	Logger.blank();

	for (const question of questions) {
		const response = await inquirer.prompt([
			{
				type: 'list',
				name: question.id,
				message: question.question,
				choices: question.options.map((opt) => ({
					name: `${opt.label} - ${opt.description}`,
					value: opt.value,
					short: opt.label,
				})),
			},
		]);
		answers[question.id] = response[question.id];
	}

	return answers;
}

/**
 * Apply clarification answers to detected config
 */
function applyClarifications(
	detected: DetectedConfig,
	clarifications: Record<string, string>
): DetectedConfig {
	const updated = { ...detected };

	// Apply task destination
	if (clarifications.task_destination) {
		const dest = clarifications.task_destination;
		if (!updated.integrations.includes(dest) && dest !== 'none') {
			updated.integrations.push(dest);
		}
	}

	// Apply notification channel
	if (clarifications.notification_channel) {
		const channel = clarifications.notification_channel;
		if (channel === 'slack' && !updated.integrations.includes('slack')) {
			updated.integrations.push('slack');
		}
		if (channel === 'email' && !updated.integrations.includes('gmail')) {
			updated.integrations.push('gmail');
		}
		if (channel === 'both') {
			if (!updated.integrations.includes('slack')) updated.integrations.push('slack');
			if (!updated.integrations.includes('gmail')) updated.integrations.push('gmail');
		}
	}

	// Apply document storage
	if (clarifications.document_storage) {
		const storage = clarifications.document_storage;
		const storageMap: Record<string, string> = {
			notion: 'notion',
			google_docs: 'google_docs',
			confluence: 'confluence',
			markdown: 'github',
		};
		const integration = storageMap[storage];
		if (integration && !updated.integrations.includes(integration)) {
			updated.integrations.push(integration);
		}
	}

	// Apply trigger frequency
	if (clarifications.trigger_frequency) {
		const freq = clarifications.trigger_frequency;
		if (freq === 'realtime') updated.trigger = 'webhook';
		else if (freq === 'manual') updated.trigger = 'manual';
		else updated.trigger = 'schedule';
	}

	// Apply complexity
	if (clarifications.complexity) {
		updated.complexity = clarifications.complexity as 'simple' | 'standard' | 'complex';
	}

	return updated;
}

/**
 * Generate workflow code from prompt with context from UNDERSTANDING.md
 */
function generateWorkflowCode(config: {
	name: string;
	description: string;
	integrations: string[];
	trigger: 'webhook' | 'schedule' | 'manual';
	prompt: string;
}): string {
	const integrationImports = config.integrations.length > 0
		? `// Detected integrations: ${config.integrations.join(', ')}\n// See: UNDERSTANDING.md for all 49 WORKWAY workflows and integration pairs`
		: '';

	const triggerCode = config.trigger === 'schedule'
		? `cron('0 9 * * 1-5') // Weekdays at 9am`
		: config.trigger === 'webhook'
		? `webhook({ service: '${config.integrations[0] || 'github'}', event: 'EVENT_TYPE' })`
		: `manual() // Triggered via CLI or API`;

	const integrationArray = config.integrations
		.map((i) => `    { service: '${i}', scopes: ['read', 'write'] }`)
		.join(',\n');

	// Detect outcome frame based on prompt
	const outcomeFrame = detectOutcomeFrame(config.prompt);
	const outcomeComment = outcomeFrame
		? `// Outcome frame: ${outcomeFrame}\n  // See: UNDERSTANDING.md for all outcome frames`
		: '';

	return `/**
 * ${config.name}
 *
 * ${config.description}
 *
 * Generated from: "${config.prompt}"
 * ${outcomeComment}
 *
 * ZUHANDENHEIT: Tools recede, outcomes remain.
 * Users think: "${getOutcomeStatement(outcomeFrame)}"
 *
 * Edit the execute() function to implement your workflow logic.
 * Refer to UNDERSTANDING.md for patterns from 49 production workflows.
 */

import { defineWorkflow, ${config.trigger === 'schedule' ? 'cron' : config.trigger === 'webhook' ? 'webhook' : 'manual'} } from '@workwayco/sdk';
import { createAIClient } from '@workwayco/sdk/workers-ai';

${integrationImports}

export default defineWorkflow({
  name: '${config.name}',
  description: '${config.description}',
  version: '1.0.0',

  // Pricing model
  pricing: {
    model: 'usage',
    pricePerExecution: 0.10,
    description: 'Per execution pricing'
  },

  // Integration connections
  integrations: [
${integrationArray || '    // Add integrations here'}
  ],

  // User-facing inputs
  inputs: {
    // TODO: Define your inputs
    // Examples:
    // notionDatabaseId: {
    //   type: 'notion_database_picker',
    //   label: 'Target Database',
    //   required: true
    // },
    // slackChannel: {
    //   type: 'slack_channel_picker',
    //   label: 'Notification Channel',
    //   required: false
    // }
  },

  // Execution trigger
  trigger: ${triggerCode},

  // Main workflow logic
  async execute({ trigger, inputs, integrations, env }) {
    // Initialize AI client (if needed)
    const ai = createAIClient(env).for('synthesis', 'standard');

    // TODO: Implement your workflow logic
    //
    // Available Zuhandenheit patterns:
    //
    // AI Synthesis:
    //   const result = await ai.synthesize(content, {
    //     type: 'meeting' | 'email' | 'support' | 'feedback',
    //     output: { themes: 'string[]', summary: 'string' }
    //   });
    //
    // AI Content Generation:
    //   const content = await ai.generateContent(topic, {
    //     type: 'blog-post' | 'newsletter' | 'social-media',
    //     audience: 'general' | 'technical' | 'business'
    //   });
    //
    // Notion Documents:
    //   await integrations.notion.createDocument({
    //     database: inputs.notionDatabaseId,
    //     template: 'summary' | 'report' | 'meeting',
    //     data: { title, summary, sections }
    //   });
    //
    // Linear Tasks:
    //   await integrations.linear.issues.create({
    //     teamId: inputs.linearTeamId,
    //     title: 'Task title',
    //     assigneeByName: 'john',  // Zuhandenheit: no ID lookup needed
    //     labels: ['bug', 'urgent']  // Labels by name
    //   });
    //
    // Slack Messages:
    //   await integrations.slack.sendMessage({
    //     channel: inputs.slackChannel,
    //     text: 'Message content'
    //   });

    return {
      success: true,
      message: 'Workflow executed successfully',
      // Add your return data here
    };
  },

  onError: async ({ error, integrations, inputs }) => {
    // Handle errors gracefully
    console.error('Workflow error:', error.message);

    // Optionally notify via Slack
    // await integrations.slack?.sendMessage({
    //   channel: inputs.errorChannel,
    //   text: \`Workflow error: \${error.message}\`
    // });
  }
});

/**
 * NEXT STEPS:
 *
 * 1. Define inputs{} - user-facing configuration
 * 2. Configure trigger - webhook, cron, or manual
 * 3. Implement execute() - your workflow logic
 * 4. Test locally: workway workflow test
 * 5. Deploy: workway workflow publish
 *
 * LEARNING RESOURCES:
 *
 * - UNDERSTANDING.md - All 49 WORKWAY workflows mapped by outcome
 * - Integration patterns: packages/workflows/src/<workflow-name>/
 * - SDK reference: packages/sdk/README.md
 * - Examples by complexity:
 *   - Light (simple): calendar-availability-sync, standup-bot
 *   - Heavy (standard): meeting-intelligence, sprint-progress-tracker
 *   - Custom (complex): databases-mirrored, meeting-intelligence-private
 *
 * OUTCOME TEST:
 * Can you describe this workflow's value without mentioning technology?
 * Wrong: "It syncs Zoom with Notion via REST API"
 * Right: "After meetings, notes appear in my workspace"
 */
`;
}

/**
 * Create workflow from natural language
 */
export async function createCommand(prompt?: string): Promise<void> {
	Logger.header('Create Workflow from Natural Language');
	Logger.blank();

	// Get prompt if not provided
	let workflowPrompt = prompt;
	if (!workflowPrompt) {
		Logger.info('Describe the workflow you want to create in plain English.');
		Logger.log('');
		Logger.log('Examples:');
		for (const example of EXAMPLE_PROMPTS.slice(0, 3)) {
			Logger.log(`  - "${example}"`);
		}
		Logger.blank();

		const answers = await inquirer.prompt([
			{
				type: 'input',
				name: 'prompt',
				message: 'Describe your workflow:',
				validate: (input: string) => {
					if (!input || input.length < 10) {
						return 'Please provide a more detailed description';
					}
					return true;
				},
			},
		]);
		workflowPrompt = answers.prompt;
	}

	// Analyze prompt
	const spinner = Logger.spinner('Analyzing your request...');

	let detected = detectConfig(workflowPrompt!);
	const applicableQuestions = getApplicableQuestions(workflowPrompt!, detected);

	spinner.succeed('Analysis complete');
	Logger.blank();

	// Show detected configuration
	Logger.info('I detected the following from your description:');
	Logger.log('');
	Logger.log(`  Integrations: ${detected.integrations.length > 0 ? detected.integrations.join(', ') : 'none detected'}`);
	Logger.log(`  Trigger type: ${detected.trigger}`);
	Logger.log(`  AI-powered: ${detected.hasAI ? 'Yes' : 'No'}`);
	Logger.log(`  Complexity: ${detected.complexity}`);

	// ============================================================================
	// CLARIFICATION MODE - Ask questions when multiple approaches are valid
	// ============================================================================
	if (applicableQuestions.length > 0) {
		const clarifications = await askClarifications(applicableQuestions);
		detected = applyClarifications(detected, clarifications);

		Logger.blank();
		Logger.info('Updated configuration based on your answers:');
		Logger.log(`  Integrations: ${detected.integrations.join(', ')}`);
		Logger.log(`  Trigger type: ${detected.trigger}`);
	}

	Logger.blank();

	// Get workflow name
	const nameAnswer = await inquirer.prompt([
		{
			type: 'input',
			name: 'name',
			message: 'Workflow name:',
			default: workflowPrompt!.split(' ').slice(0, 4).join('-').toLowerCase().replace(/[^a-z0-9-]/g, ''),
			validate: (input: string) => {
				if (!input || input.length < 3) {
					return 'Name must be at least 3 characters';
				}
				if (!/^[a-z0-9-]+$/.test(input)) {
					return 'Name must be lowercase letters, numbers, and hyphens only';
				}
				return true;
			},
		},
	]);

	// Confirm integrations (pre-selected based on detection + clarifications)
	const integrationAnswer = await inquirer.prompt([
		{
			type: 'checkbox',
			name: 'integrations',
			message: 'Confirm integrations to include:',
			choices: [
				{ name: 'Slack', value: 'slack', checked: detected.integrations.includes('slack') },
				{ name: 'Notion', value: 'notion', checked: detected.integrations.includes('notion') },
				{ name: 'Linear', value: 'linear', checked: detected.integrations.includes('linear') },
				{ name: 'GitHub', value: 'github', checked: detected.integrations.includes('github') },
				{ name: 'Gmail', value: 'gmail', checked: detected.integrations.includes('gmail') },
				{ name: 'Stripe', value: 'stripe', checked: detected.integrations.includes('stripe') },
				{ name: 'Zoom', value: 'zoom', checked: detected.integrations.includes('zoom') },
				{ name: 'Google Sheets', value: 'sheets', checked: detected.integrations.includes('sheets') },
				{ name: 'Airtable', value: 'airtable', checked: detected.integrations.includes('airtable') },
			],
		},
	]);

	// Generate workflow
	const genSpinner = Logger.spinner('Generating workflow...');

	const workflowCode = generateWorkflowCode({
		name: nameAnswer.name
			.split('-')
			.map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
			.join(' '),
		description: workflowPrompt!,
		integrations: integrationAnswer.integrations,
		trigger: detected.trigger,
		prompt: workflowPrompt!,
	});

	// Create directory and file
	const workflowDir = path.join(process.cwd(), 'workflows', nameAnswer.name);
	const workflowFile = path.join(workflowDir, 'workflow.ts');

	await fs.mkdir(workflowDir, { recursive: true });
	await fs.writeFile(workflowFile, workflowCode, 'utf-8');

	genSpinner.succeed('Workflow generated!');
	Logger.blank();

	// Show result
	Logger.success(`Created: ${workflowFile}`);
	Logger.blank();
	Logger.log('Next steps:');
	Logger.log(`  1. cd workflows/${nameAnswer.name}`);
	Logger.log('  2. Edit workflow.ts to implement your logic');
	Logger.log('  3. Run: workway workflow test');
	Logger.log('  4. Deploy: workway workflow publish');
	Logger.blank();
	Logger.info('Tip: Use `workway explain workflow.ts` to understand the generated code');
}

export default createCommand;
