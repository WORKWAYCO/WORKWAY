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

- **id**: Unique identifier for the workflow
- **name**: Human-readable name (outcome-focused, not mechanism-focused)
- **description**: What the workflow achieves for the user
- **integrations**: Array of required OAuth integrations
- **triggers**: When the workflow runs (webhook, cron, manual)
- **configSchema**: User configuration with sensible defaults
- **execute**: The async function that performs the workflow

**Zuhandenheit principle**: The workflow should be invisible when working. Users should forget it exists because it just handles things.`,
		examples: [
			{
				description: 'Basic workflow structure',
				code: `import { defineWorkflow } from '@workwayco/sdk';

export default defineWorkflow({
  id: 'after-meeting-followup',
  name: 'After Meeting Follow-up',
  description: 'Automatically creates notes and sends follow-ups after meetings',

  integrations: ['zoom', 'notion', 'gmail'],

  triggers: {
    type: 'webhook',
    events: ['meeting.ended']
  },

  configSchema: {
    inputs: [
      {
        id: 'notionDatabase',
        type: 'notion_database_picker',
        label: 'Notes database',
        description: 'Where to save meeting notes'
      }
    ]
  },

  async execute({ config, integrations, context }) {
    // Implementation here
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

Access integrations through the \`integrations\` parameter in your execute function.`,
		examples: [
			{
				description: 'Using integrations',
				code: `async execute({ integrations }) {
  // Gmail
  const emails = await integrations.gmail.listMessages({
    labelIds: ['STARRED'],
    maxResults: 10
  });

  // Notion
  await integrations.notion.createPage({
    parent: { database_id: config.notionDatabase },
    properties: {
      Name: { title: [{ text: { content: 'New Page' } }] }
    }
  });

  // Slack
  await integrations.slack.postMessage({
    channel: config.slackChannel,
    text: 'Workflow completed!'
  });
}`,
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
		answer: `WORKWAY supports three trigger types:

1. **Webhook**: Triggered by external events (most common)
   - \`meeting.ended\`, \`email.received\`, \`form.submitted\`

2. **Cron**: Scheduled execution
   - Daily reports, weekly syncs, hourly checks

3. **Manual**: User-initiated
   - On-demand tasks, batch processing

Choose based on when the workflow should run, not how it works internally.`,
		examples: [
			{
				description: 'Trigger configurations',
				code: `// Webhook trigger
triggers: {
  type: 'webhook',
  events: ['meeting.ended', 'recording.completed']
}

// Cron trigger (daily at 9am)
triggers: {
  type: 'cron',
  schedule: '0 9 * * *'
}

// Manual trigger
triggers: {
  type: 'manual'
}`,
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

Use the \`onError\` handler or try/catch blocks in your execute function.`,
		examples: [
			{
				description: 'Error handling pattern',
				code: `export default defineWorkflow({
  // ...

  onError: async ({ error, context }) => {
    // Log for debugging
    console.error('Workflow error:', error.message);

    // Notify user
    if (context.config.slackChannel) {
      await context.integrations.slack.postMessage({
        channel: context.config.slackChannel,
        text: \`⚠️ Workflow encountered an issue: \${error.message}\`
      });
    }

    // Return partial result if possible
    return { partial: true, error: error.message };
  },

  async execute({ config, integrations }) {
    try {
      // Main logic
    } catch (error) {
      // Handle specific errors
      if (error.code === 'RATE_LIMITED') {
        // Retry logic
      }
      throw error; // Re-throw for onError
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
