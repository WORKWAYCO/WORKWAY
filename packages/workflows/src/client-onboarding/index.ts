/**
 * Client Onboarding Pipeline
 *
 * Compound workflow: Stripe payment → Notion client hub + Todoist tasks + Slack alert
 *
 * The complete client onboarding automation:
 * 1. Stripe successful payment triggers workflow
 * 2. Creates Notion client page with all details
 * 3. Generates onboarding task checklist in Todoist
 * 4. Notifies team on Slack with client context
 * 5. AI generates custom onboarding recommendations
 *
 * Zuhandenheit: Team thinks "new clients automatically get set up"
 * not "manually create 15 tasks and send welcome emails"
 */

import { defineWorkflow, webhook } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Client Onboarding Pipeline',
	description:
		'Automatically set up new clients in Notion, create onboarding tasks, and notify your team when payments complete',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'when_clients_onboard',

		outcomeStatement: {
			suggestion: 'Automate client onboarding?',
			explanation: 'When payments complete, we\'ll set up the client in Notion, create onboarding tasks, and notify your team.',
			outcome: 'New clients onboarded automatically',
		},

		primaryPair: {
			from: 'stripe',
			to: 'notion',
			workflowId: 'client-onboarding',
			outcome: 'Clients that onboard themselves',
		},

		additionalPairs: [
			{ from: 'stripe', to: 'todoist', workflowId: 'client-onboarding', outcome: 'Onboarding tasks created automatically' },
			{ from: 'stripe', to: 'slack', workflowId: 'client-onboarding', outcome: 'Team notified of new clients' },
		],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['stripe', 'notion', 'todoist'],
				workflowId: 'client-onboarding',
				priority: 90,
			},
			{
				trigger: 'event_received',
				eventType: 'stripe.checkout.session.completed',
				integrations: ['stripe', 'notion'],
				workflowId: 'client-onboarding',
				priority: 85,
			},
		],

		smartDefaults: {
			onboardingTemplate: { value: 'standard' },
			enableAIRecommendations: { value: true },
		},

		essentialFields: ['notionDatabaseId', 'slackChannel'],

		zuhandenheit: {
			timeToValue: 5,
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'freemium',
		pricePerMonth: 29,
		trialDays: 14,
		description: 'Free for 10 clients/month, then $29/month unlimited',
	},

	integrations: [
		{ service: 'stripe', scopes: ['read_only'] },
		{ service: 'notion', scopes: ['write_pages', 'read_databases'] },
		{ service: 'todoist', scopes: ['data:read_write'] },
		{ service: 'slack', scopes: ['chat:write', 'channels:read'] },
	],

	inputs: {
		notionDatabaseId: {
			type: 'notion_database_picker',
			label: 'Client Database',
			required: true,
			description: 'Notion database to track clients',
		},
		todoistProjectId: {
			type: 'todoist_project_picker',
			label: 'Onboarding Tasks Project',
			required: true,
			description: 'Todoist project for onboarding task checklists',
		},
		slackChannel: {
			type: 'slack_channel_picker',
			label: 'Team Notifications Channel',
			required: true,
			description: 'Channel for new client alerts',
		},
		onboardingTemplate: {
			type: 'select',
			label: 'Onboarding Template',
			required: true,
			options: [
				{ value: 'standard', label: 'Standard (5 tasks)' },
				{ value: 'enterprise', label: 'Enterprise (12 tasks)' },
				{ value: 'quick-start', label: 'Quick Start (3 tasks)' },
			],
			default: 'standard',
			description: 'Task template to use for new clients',
		},
		enableAIRecommendations: {
			type: 'boolean',
			label: 'AI Onboarding Recommendations',
			default: true,
			description: 'Use AI to generate custom onboarding steps based on client profile',
		},
		assigneeEmail: {
			type: 'email',
			label: 'Default Account Manager',
			required: false,
			description: 'Email of team member to assign onboarding tasks',
		},
	},

	trigger: webhook({
		service: 'stripe',
		events: ['checkout.session.completed', 'payment_intent.succeeded'],
	}),

	async execute({ trigger, inputs, integrations, env }) {
		const event = trigger.data;
		const eventType = event.type;

		// Extract customer info based on event type
		let customer: CustomerInfo;
		if (eventType === 'checkout.session.completed') {
			const session = event.data.object;
			customer = {
				email: session.customer_email || session.customer_details?.email,
				name: session.customer_details?.name,
				phone: session.customer_details?.phone,
				amount: session.amount_total,
				currency: session.currency,
				productName: session.metadata?.product_name || 'Subscription',
				customerId: session.customer,
				subscriptionId: session.subscription,
			};
		} else {
			const paymentIntent = event.data.object;
			customer = {
				email: paymentIntent.receipt_email || paymentIntent.metadata?.email,
				name: paymentIntent.metadata?.name,
				phone: paymentIntent.metadata?.phone,
				amount: paymentIntent.amount,
				currency: paymentIntent.currency,
				productName: paymentIntent.metadata?.product_name || 'Payment',
				customerId: paymentIntent.customer,
			};
		}

		if (!customer.email) {
			return { success: false, error: 'No customer email found in payment event' };
		}

		// 1. AI-generated onboarding recommendations (optional)
		let aiRecommendations: string[] = [];
		if (inputs.enableAIRecommendations && env.AI) {
			aiRecommendations = await generateOnboardingRecommendations(env.AI, customer);
		}

		// 2. Create Notion client page
		const notionProperties: Record<string, any> = {
			Name: { title: [{ text: { content: customer.name || customer.email } }] },
			Email: { email: customer.email },
			Status: { select: { name: 'Onboarding' } },
			'Start Date': { date: { start: new Date().toISOString() } },
			'Contract Value': customer.amount
				? { number: customer.amount / 100 }
				: undefined,
			Product: customer.productName
				? { select: { name: customer.productName } }
				: undefined,
		};

		// Remove undefined properties
		Object.keys(notionProperties).forEach((key) => {
			if (notionProperties[key] === undefined) {
				delete notionProperties[key];
			}
		});

		const notionPage = await integrations.notion.pages.create({
			parent: { database_id: inputs.notionDatabaseId },
			properties: notionProperties,
			children: aiRecommendations.length > 0
				? [
						{
							object: 'block',
							type: 'heading_2',
							heading_2: {
								rich_text: [{ text: { content: 'AI Onboarding Recommendations' } }],
							},
						},
						{
							object: 'block',
							type: 'bulleted_list_item',
							bulleted_list_item: {
								rich_text: aiRecommendations.map((rec) => ({ text: { content: rec + '\n' } })),
							},
						},
					]
				: undefined,
		});

		const notionPageId = notionPage.success ? notionPage.data.id : null;

		// 3. Create Todoist onboarding tasks
		const tasks = getOnboardingTasks(inputs.onboardingTemplate, customer, aiRecommendations);
		const createdTasks: string[] = [];

		for (let i = 0; i < tasks.length; i++) {
			const task = tasks[i];
			const dueDate = new Date();
			dueDate.setDate(dueDate.getDate() + task.daysFromNow);

			const result = await integrations.todoist.tasks.create({
				content: task.title.replace('{client}', customer.name || customer.email),
				description: task.description,
				projectId: inputs.todoistProjectId,
				priority: task.priority,
				dueDate: dueDate.toISOString().split('T')[0],
				labels: ['onboarding', `client-${customer.email.split('@')[0]}`],
			});

			if (result.success) {
				createdTasks.push(result.data.id);
			}
		}

		// 4. Post to Slack
		const formattedAmount = customer.amount
			? new Intl.NumberFormat('en-US', {
					style: 'currency',
					currency: customer.currency?.toUpperCase() || 'USD',
				}).format(customer.amount / 100)
			: 'N/A';

		const slackBlocks = [
			{
				type: 'header',
				text: { type: 'plain_text', text: '🎉 New Client Onboarding Started' },
			},
			{
				type: 'section',
				fields: [
					{ type: 'mrkdwn', text: `*Client:*\n${customer.name || 'Not provided'}` },
					{ type: 'mrkdwn', text: `*Email:*\n${customer.email}` },
					{ type: 'mrkdwn', text: `*Product:*\n${customer.productName}` },
					{ type: 'mrkdwn', text: `*Value:*\n${formattedAmount}` },
				],
			},
			{
				type: 'section',
				text: {
					type: 'mrkdwn',
					text: `✅ *${createdTasks.length} onboarding tasks created*${notionPageId ? `\n📄 <${getNotionPageUrl(notionPageId)}|View in Notion>` : ''}`,
				},
			},
		];

		if (aiRecommendations.length > 0) {
			slackBlocks.push({
				type: 'context',
				elements: [
					{
						type: 'mrkdwn',
						text: `🤖 AI suggested ${aiRecommendations.length} custom onboarding steps`,
					},
				],
			} as any);
		}

		await integrations.slack.chat.postMessage({
			channel: inputs.slackChannel,
			blocks: slackBlocks,
			text: `New client: ${customer.name || customer.email} - ${customer.productName}`,
		});

		return {
			success: true,
			client: {
				email: customer.email,
				name: customer.name,
				product: customer.productName,
				value: customer.amount ? customer.amount / 100 : null,
			},
			created: {
				notionPageId,
				todoistTasks: createdTasks,
			},
			notifications: {
				slack: true,
			},
			aiRecommendations: aiRecommendations.length,
		};
	},

	onError: async ({ error, trigger, inputs, integrations }) => {
		if (integrations.slack) {
			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: `:warning: Client Onboarding Error: ${error.message}\nPayment event: ${trigger.data?.type || 'unknown'}`,
			});
		}
	},
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

interface CustomerInfo {
	email: string;
	name?: string;
	phone?: string;
	amount?: number;
	currency?: string;
	productName: string;
	customerId?: string;
	subscriptionId?: string;
}

interface OnboardingTask {
	title: string;
	description: string;
	priority: number;
	daysFromNow: number;
}

function getOnboardingTasks(
	template: string,
	customer: CustomerInfo,
	aiRecommendations: string[]
): OnboardingTask[] {
	const baseTasks: Record<string, OnboardingTask[]> = {
		'quick-start': [
			{
				title: 'Send welcome package to {client}',
				description: 'Include login credentials, quick start guide, and support contact',
				priority: 4,
				daysFromNow: 0,
			},
			{
				title: 'Schedule kickoff call with {client}',
				description: 'Book 30-minute intro call to discuss goals and timeline',
				priority: 4,
				daysFromNow: 1,
			},
			{
				title: 'Follow up on {client} onboarding progress',
				description: 'Check if they completed setup and answer any questions',
				priority: 3,
				daysFromNow: 3,
			},
		],
		standard: [
			{
				title: 'Send welcome package to {client}',
				description: 'Include login credentials, quick start guide, and support contact',
				priority: 4,
				daysFromNow: 0,
			},
			{
				title: 'Schedule kickoff call with {client}',
				description: 'Book 30-minute intro call to discuss goals and timeline',
				priority: 4,
				daysFromNow: 1,
			},
			{
				title: 'Complete account setup for {client}',
				description: 'Configure their workspace, permissions, and initial settings',
				priority: 3,
				daysFromNow: 2,
			},
			{
				title: 'Send training resources to {client}',
				description: 'Share relevant tutorials, documentation, and video guides',
				priority: 3,
				daysFromNow: 3,
			},
			{
				title: 'One-week check-in with {client}',
				description: 'Review progress, gather feedback, and address any issues',
				priority: 3,
				daysFromNow: 7,
			},
		],
		enterprise: [
			{
				title: 'Send welcome package to {client}',
				description: 'Include login credentials, enterprise guide, and dedicated support contact',
				priority: 4,
				daysFromNow: 0,
			},
			{
				title: 'Assign dedicated account manager to {client}',
				description: 'Ensure single point of contact is established',
				priority: 4,
				daysFromNow: 0,
			},
			{
				title: 'Schedule discovery call with {client}',
				description: 'Deep dive into requirements, integrations, and success metrics',
				priority: 4,
				daysFromNow: 1,
			},
			{
				title: 'Create custom implementation plan for {client}',
				description: 'Document timeline, milestones, and responsibilities',
				priority: 4,
				daysFromNow: 2,
			},
			{
				title: 'Configure SSO/security for {client}',
				description: 'Set up enterprise authentication and security policies',
				priority: 3,
				daysFromNow: 3,
			},
			{
				title: 'Complete data migration for {client}',
				description: 'Import existing data and verify integrity',
				priority: 3,
				daysFromNow: 5,
			},
			{
				title: 'Conduct admin training for {client}',
				description: 'Train their team on administration and configuration',
				priority: 3,
				daysFromNow: 7,
			},
			{
				title: 'Conduct user training for {client}',
				description: 'Train end users on daily workflows',
				priority: 3,
				daysFromNow: 9,
			},
			{
				title: 'Integration setup for {client}',
				description: 'Configure any third-party integrations',
				priority: 3,
				daysFromNow: 10,
			},
			{
				title: 'UAT sign-off from {client}',
				description: 'Get formal acceptance of implementation',
				priority: 4,
				daysFromNow: 12,
			},
			{
				title: 'Go-live support for {client}',
				description: 'Provide enhanced support during launch week',
				priority: 4,
				daysFromNow: 14,
			},
			{
				title: 'Post-launch review with {client}',
				description: 'Review success metrics and plan next steps',
				priority: 3,
				daysFromNow: 21,
			},
		],
	};

	const tasks = baseTasks[template] || baseTasks['standard'];

	// Add AI-recommended tasks
	if (aiRecommendations.length > 0) {
		aiRecommendations.slice(0, 3).forEach((rec, index) => {
			tasks.push({
				title: rec,
				description: 'AI-recommended onboarding step',
				priority: 2,
				daysFromNow: 5 + index,
			});
		});
	}

	return tasks;
}

async function generateOnboardingRecommendations(ai: any, customer: CustomerInfo): Promise<string[]> {
	try {
		const prompt = `Generate 3 specific onboarding recommendations for this new client.

Client Profile:
- Product: ${customer.productName}
- Contract Value: ${customer.amount ? `$${customer.amount / 100}` : 'Unknown'}
- Has phone: ${customer.phone ? 'Yes' : 'No'}

Generate exactly 3 actionable onboarding tasks specific to their profile.
Format: Return only a JSON array of strings, like ["task 1", "task 2", "task 3"]`;

		const result = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
			messages: [{ role: 'user', content: prompt }],
			max_tokens: 150,
		});

		const text = result.response || '';
		const jsonMatch = text.match(/\[[\s\S]*\]/);
		if (jsonMatch) {
			return JSON.parse(jsonMatch[0]);
		}
	} catch (e) {
		// Graceful degradation
	}
	return [];
}

function getNotionPageUrl(pageId: string): string {
	return `https://notion.so/${pageId.replace(/-/g, '')}`;
}

export const metadata = {
	id: 'client-onboarding-pipeline',
	category: 'sales',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
};
