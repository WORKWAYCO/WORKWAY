/**
 * learn_coach Tool
 *
 * Real-time WORKWAY pattern guidance.
 */

import { loadEthos } from '../../ethos/defaults.js';

export const definition = {
	name: 'learn_coach',
	description: 'Get real-time WORKWAY pattern guidance and explanations',
	inputSchema: {
		type: 'object' as const,
		properties: {
			question: {
				type: 'string',
				description: 'Your question about WORKWAY patterns or workflows'
			},
			context: {
				type: 'object',
				properties: {
					currentFile: { type: 'string' },
					currentCode: { type: 'string' },
					recentErrors: { type: 'array', items: { type: 'string' } }
				},
				description: 'Optional context about your current work'
			},
			mode: {
				type: 'string',
				enum: ['explain', 'suggest', 'debug', 'review'],
				description: 'Coaching mode'
			}
		},
		required: ['question']
	}
};

export interface LearnCoachInput {
	question: string;
	context?: {
		currentFile?: string;
		currentCode?: string;
		recentErrors?: string[];
	};
	mode?: 'explain' | 'suggest' | 'debug' | 'review';
}

export interface LearnCoachOutput {
	response: string;
	codeExamples?: Array<{
		description: string;
		code: string;
		language: string;
	}>;
	relatedResources: Array<{
		type: 'lesson' | 'doc' | 'workflow';
		title: string;
		url: string;
	}>;
	followUpQuestions?: string[];
}

// Knowledge base for common questions
const KNOWLEDGE_BASE: Record<string, {
	answer: string;
	examples?: Array<{ description: string; code: string; language: string }>;
	resources: Array<{ type: 'lesson' | 'doc'; title: string; url: string }>;
}> = {
	'defineWorkflow': {
		answer: `The \`defineWorkflow()\` function is the foundation of every WORKWAY workflow. It creates a structured workflow definition with:

- **name**: Human-readable name (outcome-focused, not mechanism-focused)
- **description**: What the workflow achieves for the user
- **version**: Semantic version string (e.g., '1.0.0')
- **integrations**: Array of OAuth integrations with scopes
- **inputs**: User configuration fields with types and defaults
- **trigger**: When the workflow runs (webhook(), cron(), schedule())
- **execute**: The async function that performs the workflow
- **onError**: Optional error handler for graceful degradation

**Zuhandenheit principle**: The workflow should be invisible when working. Users should forget it exists because it just handles things.`,
		examples: [
			{
				description: 'Basic workflow structure',
				code: `import { defineWorkflow, webhook } from '@workwayco/sdk';

export default defineWorkflow({
  name: 'After Meeting Follow-up',
  description: 'Automatically creates notes and sends follow-ups after meetings',
  version: '1.0.0',

  integrations: [
    { service: 'zoom', scopes: ['meeting:read', 'recording:read'] },
    { service: 'notion', scopes: ['write_pages', 'read_databases'] },
    { service: 'slack', scopes: ['send_messages'] }
  ],

  inputs: {
    notionDatabaseId: {
      type: 'text',
      label: 'Meeting Notes Database',
      required: true,
      description: 'Where to save meeting notes'
    },
    slackChannel: {
      type: 'text',
      label: 'Notification Channel',
      required: false,
      description: 'Where to post meeting summaries'
    }
  },

  trigger: webhook({
    service: 'zoom',
    event: 'recording.completed'
  }),

  async execute({ trigger, inputs, integrations, env }) {
    const meeting = trigger.data;
    // Implementation here
  },

  onError: async ({ error, inputs, integrations }) => {
    console.error('Workflow failed:', error.message);
  }
});`,
				language: 'typescript'
			}
		],
		resources: [
			{ type: 'lesson', title: 'The defineWorkflow() Pattern', url: '/paths/workflow-foundations/define-workflow-pattern' }
		]
	},
	'integrations': {
		answer: `WORKWAY integrations use the **BaseAPIClient** pattern for consistent OAuth handling:

1. **OAuth is handled for you**: Users connect once, WORKWAY manages token refresh
2. **Type-safe methods**: Each integration has typed methods matching the API
3. **Rate limiting**: Built-in handling for API rate limits
4. **Error handling**: Consistent error types across integrations
5. **Scopes**: Declare required permissions explicitly
6. **Optional integrations**: Mark non-essential integrations as optional

Declare integrations in your workflow with the extended format, then access them through the \`integrations\` parameter in execute.`,
		examples: [
			{
				description: 'Declaring integrations with scopes',
				code: `import { defineWorkflow, webhook } from '@workwayco/sdk';

export default defineWorkflow({
  // ...

  integrations: [
    { service: 'zoom', scopes: ['meeting:read', 'recording:read'] },
    { service: 'notion', scopes: ['write_pages', 'read_databases'] },
    { service: 'slack', scopes: ['send_messages', 'read_channels'] },
    { service: 'hubspot', scopes: ['crm.objects.deals.read'], optional: true }
  ],

  async execute({ trigger, inputs, integrations }) {
    // Notion - create page
    const page = await integrations.notion.pages.create({
      parent: { database_id: inputs.notionDatabaseId },
      properties: {
        Title: { title: [{ text: { content: 'Meeting Notes' } }] },
        Date: { date: { start: new Date().toISOString().split('T')[0] } }
      }
    });

    // Slack - post message
    await integrations.slack.chat.postMessage({
      channel: inputs.slackChannel,
      text: 'New meeting notes created!',
      blocks: [
        { type: 'header', text: { type: 'plain_text', text: 'Meeting Notes' } },
        { type: 'section', text: { type: 'mrkdwn', text: \`View notes: \${page.data?.url}\` } }
      ]
    });

    // Optional integration - check if available
    if (integrations.hubspot) {
      await integrations.hubspot.logMeetingActivity({
        meetingTitle: trigger.data.topic,
        notes: 'Meeting synced via WORKWAY'
      });
    }
  }
});`,
				language: 'typescript'
			}
		],
		resources: [
			{ type: 'lesson', title: 'Integrations & OAuth', url: '/paths/workflow-foundations/integrations-oauth' },
			{ type: 'lesson', title: 'Working with Integrations', url: '/paths/building-workflows/working-with-integrations' }
		]
	},
	'zuhandenheit': {
		answer: `**Zuhandenheit** (German: "ready-to-hand") is Heidegger's concept that tools should disappear during use.

In WORKWAY:
- A good workflow is one users forget exists
- The tool becomes visible only when it breaks (Vorhandenheit)
- Focus on outcomes, not mechanisms

**The Outcome Test**: Can you describe your workflow's value without mentioning any technology? If yes, you've found the outcome.

**Wrong**: "It syncs my CRM with my email via REST API."
**Right**: "It handles my follow-ups after client calls."`,
		resources: [
			{ type: 'lesson', title: 'What is a Workflow?', url: '/paths/workflow-foundations/what-is-workflow' }
		]
	},
	'triggers': {
		answer: `WORKWAY supports three trigger types using helper functions:

1. **webhook()**: Triggered by external events (most common)
   - \`recording.completed\`, \`payment_intent.succeeded\`, \`ticket.created\`

2. **cron()**: Scheduled execution at fixed times
   - Daily reports, weekly syncs, hourly checks

3. **schedule()**: Scheduled execution with dynamic timing from inputs
   - User-configurable schedules, timezone-aware

Choose based on when the workflow should run, not how it works internally.`,
		examples: [
			{
				description: 'Trigger configurations',
				code: `import { defineWorkflow, webhook, cron, schedule } from '@workwayco/sdk';

// Webhook trigger - reacts to events from integrations
export default defineWorkflow({
  // ...
  trigger: webhook({
    service: 'zoom',
    event: 'recording.completed'
  }),
  // Can also listen to multiple events:
  // trigger: webhook({
  //   service: 'stripe',
  //   events: ['payment_intent.succeeded', 'charge.refunded']
  // }),
});

// Cron trigger - fixed schedule (daily at 7am UTC)
export default defineWorkflow({
  // ...
  trigger: cron({
    schedule: '0 7 * * *',
    timezone: 'UTC'
  }),
});

// Schedule trigger - user-configurable time
export default defineWorkflow({
  // ...
  inputs: {
    standupTime: { type: 'time', label: 'Standup Time', default: '09:00' },
    timezone: { type: 'timezone', label: 'Timezone', default: 'America/New_York' }
  },
  trigger: schedule({
    cron: '0 {{inputs.standupTime.hour}} * * 1-5', // Weekdays only
    timezone: '{{inputs.timezone}}'
  }),
});`,
				language: 'typescript'
			}
		],
		resources: [
			{ type: 'lesson', title: 'Triggers', url: '/paths/workflow-foundations/triggers' }
		]
	},
	'error': {
		answer: `Error handling in WORKWAY follows the "graceful degradation" principle:

1. **Don't crash silently**: Users should know when something goes wrong
2. **Provide context**: What failed and what can users do?
3. **Retry when appropriate**: Transient errors often resolve themselves
4. **Fall back gracefully**: Partial success is better than total failure

Use the \`onError\` handler to catch workflow-level errors and notify users gracefully.`,
		examples: [
			{
				description: 'Error handling pattern',
				code: `import { defineWorkflow, webhook } from '@workwayco/sdk';

export default defineWorkflow({
  name: 'Stripe to Notion Invoice Tracker',
  description: 'Automatically log Stripe payments to Notion',
  version: '1.0.0',

  integrations: [
    { service: 'stripe', scopes: ['read_payments', 'webhooks'] },
    { service: 'notion', scopes: ['write_pages'] },
    { service: 'slack', scopes: ['send_messages'], optional: true }
  ],

  inputs: {
    notionDatabaseId: { type: 'text', label: 'Payments Database', required: true },
    slackChannel: { type: 'text', label: 'Error Notifications', required: false }
  },

  trigger: webhook({
    service: 'stripe',
    event: 'payment_intent.succeeded'
  }),

  async execute({ trigger, inputs, integrations }) {
    const payment = trigger.data;

    // Check for existing entry (idempotency)
    const existingCheck = await integrations.notion.databases.query({
      database_id: inputs.notionDatabaseId,
      filter: { property: 'Payment ID', rich_text: { equals: payment.id } },
      page_size: 1
    });

    if (existingCheck.success && existingCheck.data?.results?.length > 0) {
      return { success: true, skipped: true, reason: 'Already logged' };
    }

    // Create the Notion page
    const page = await integrations.notion.pages.create({
      parent: { database_id: inputs.notionDatabaseId },
      properties: {
        Name: { title: [{ text: { content: \`Payment: $\${payment.amount / 100}\` } }] },
        'Payment ID': { rich_text: [{ text: { content: payment.id } }] },
        Status: { select: { name: 'Completed' } }
      }
    });

    if (!page.success) {
      throw new Error(\`Failed to create Notion page: \${page.error?.message}\`);
    }

    return { success: true, notionPageId: page.data.id };
  },

  onError: async ({ error, trigger, inputs, integrations }) => {
    console.error('Workflow failed:', error.message);

    // Notify via Slack if configured
    if (inputs.slackChannel && integrations.slack) {
      await integrations.slack.chat.postMessage({
        channel: inputs.slackChannel,
        text: \`⚠️ Payment sync failed for \${trigger.data.id}: \${error.message}\`
      });
    }
  }
});`,
				language: 'typescript'
			}
		],
		resources: [
			{ type: 'lesson', title: 'Error Handling', url: '/paths/building-workflows/error-handling' }
		]
	}
};

export async function handler(input: LearnCoachInput): Promise<LearnCoachOutput> {
	const { question, context, mode = 'explain' } = input;
	const ethos = loadEthos();

	// Find relevant knowledge
	const lowerQuestion = question.toLowerCase();
	let bestMatch: keyof typeof KNOWLEDGE_BASE | null = null;

	for (const topic of Object.keys(KNOWLEDGE_BASE)) {
		if (lowerQuestion.includes(topic.toLowerCase())) {
			bestMatch = topic as keyof typeof KNOWLEDGE_BASE;
			break;
		}
	}

	// Check for common question patterns
	if (!bestMatch) {
		if (lowerQuestion.includes('workflow') && (lowerQuestion.includes('create') || lowerQuestion.includes('define'))) {
			bestMatch = 'defineWorkflow';
		} else if (lowerQuestion.includes('integration') || lowerQuestion.includes('oauth')) {
			bestMatch = 'integrations';
		} else if (lowerQuestion.includes('trigger') || lowerQuestion.includes('when') || lowerQuestion.includes('schedule')) {
			bestMatch = 'triggers';
		} else if (lowerQuestion.includes('error') || lowerQuestion.includes('fail') || lowerQuestion.includes('catch')) {
			bestMatch = 'error';
		} else if (lowerQuestion.includes('recede') || lowerQuestion.includes('invisible') || lowerQuestion.includes('outcome')) {
			bestMatch = 'zuhandenheit';
		}
	}

	// Build response
	let response: string;
	let codeExamples: Array<{ description: string; code: string; language: string }> | undefined;
	let relatedResources: Array<{ type: 'lesson' | 'doc' | 'workflow'; title: string; url: string }> = [];
	const followUpQuestions: string[] = [];

	if (bestMatch && KNOWLEDGE_BASE[bestMatch]) {
		const knowledge = KNOWLEDGE_BASE[bestMatch];
		response = knowledge.answer;
		codeExamples = knowledge.examples;
		relatedResources = knowledge.resources;
	} else {
		// Generic response with ethos principles
		response = `I don't have specific knowledge about "${question}", but here are the WORKWAY principles to guide you:

**Your Workflow Principles (Ethos):**
${ethos.principles.map((p) => `- **${p.category}**: ${p.content}`).join('\n')}

**General Guidance:**
1. Start with the outcome: What should disappear from the user's to-do list?
2. Use \`defineWorkflow()\` as your foundation
3. Leverage existing integrations instead of raw \`fetch()\`
4. Add sensible defaults to reduce configuration burden
5. Handle errors gracefully with user-friendly messages

Would you like me to explain any specific pattern?`;

		relatedResources = [
			{ type: 'lesson', title: 'What is a Workflow?', url: '/paths/workflow-foundations/what-is-workflow' },
			{ type: 'lesson', title: 'The defineWorkflow() Pattern', url: '/paths/workflow-foundations/define-workflow-pattern' }
		];
	}

	// Add mode-specific guidance
	if (mode === 'debug' && context?.recentErrors?.length) {
		response += `\n\n**Debugging your errors:**\n`;
		for (const error of context.recentErrors.slice(0, 3)) {
			response += `- ${error}\n`;
		}
		response += `\nCheck: Is the integration connected? Are your config values valid?`;
	}

	if (mode === 'review' && context?.currentCode) {
		response += `\n\n**Quick review of your code:**\n`;
		const hasDefineWorkflow = context.currentCode.includes('defineWorkflow');
		const hasIntegrations = context.currentCode.includes('integrations:');
		const hasErrorHandling = context.currentCode.includes('try') || context.currentCode.includes('onError');

		response += hasDefineWorkflow ? '✓ Uses defineWorkflow()\n' : '○ Missing defineWorkflow()\n';
		response += hasIntegrations ? '✓ Declares integrations\n' : '○ Missing integrations array\n';
		response += hasErrorHandling ? '✓ Has error handling\n' : '○ Consider adding error handling\n';
	}

	// Generate follow-up questions
	if (bestMatch === 'defineWorkflow') {
		followUpQuestions.push('How do I add integrations?', 'What triggers should I use?');
	} else if (bestMatch === 'integrations') {
		followUpQuestions.push('How do I handle OAuth errors?', 'Can I use multiple integrations?');
	}

	return {
		response,
		codeExamples,
		relatedResources,
		followUpQuestions: followUpQuestions.length > 0 ? followUpQuestions : undefined
	};
}
