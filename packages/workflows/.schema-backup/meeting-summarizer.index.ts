/**
 * Meeting Notes Summarizer
 *
 * @deprecated Use 'meeting-intelligence' instead.
 *
 * This workflow is deprecated in favor of meeting-intelligence which provides
 * a more comprehensive solution. Set analysisDepth: 'minimal' for lightweight
 * summarization similar to this workflow.
 *
 * Canon Audit 2025-12-07: Merged to reduce user confusion.
 * "One integration pair = one workflow" principle.
 */

import { defineWorkflow, webhook } from '@workwayco/sdk';
import { AIModels } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Meeting Notes Summarizer',
	description: '[DEPRECATED] Use Meeting Intelligence instead. AI-generated summaries with action items.',
	version: '1.0.0',
	deprecated: true,
	supersededBy: 'meeting-intelligence',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'after_meetings',

		outcomeStatement: {
			suggestion: 'Want AI summaries of your meeting notes?',
			explanation: 'This workflow is deprecated. Use Meeting Intelligence for comprehensive meeting automation.',
			outcome: 'Meeting notes summarized with AI',
		},

		primaryPair: {
			from: 'notion',
			to: 'slack',
			workflowId: 'meeting-summarizer',
			outcome: 'Meeting notes that summarize themselves',
		},

		discoveryMoments: [
			// Removed from discovery - users should find meeting-intelligence instead
		],

		smartDefaults: {
			autoAssignTasks: { value: true },
			summaryLength: { value: 'standard' },
		},

		essentialFields: ['meeting_notes_database'],

		zuhandenheit: {
			timeToValue: 2,
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'paid',
		pricePerMonth: 12,
		trialDays: 14,
		description: 'Unlimited meeting summaries',
	},

	integrations: [
		{ service: 'notion', scopes: ['read_pages', 'write_pages'] },
		{ service: 'slack', scopes: ['send_messages'] },
	],

	config: {
		meeting_notes_database: {
			type: 'text',
			label: 'Meeting Notes Database',
			required: true,
			description: 'Database containing meeting notes',
		},
		notify_channel: {
			type: 'text',
			label: 'Notification Channel',
			description: 'Where to post summaries (optional)',
		},
		auto_assign_tasks: {
			type: 'boolean',
			label: 'Auto-assign Tasks',
			default: true,
			description: 'Automatically assign action items to mentioned people',
		},
		summary_length: {
			type: 'select',
			label: 'Summary Length',
			options: ['brief', 'standard', 'detailed'],
			default: 'standard',
		},
	},

	trigger: webhook({
		service: 'notion',
		event: 'page.updated',
		filter: { database_id: '{{inputs.meetingNotesDatabase}}' },
	}),

	async execute({ trigger, inputs, integrations }) {
		const page = trigger.data;

		// Get full page content
		const blocks = await integrations.notion.blocks.children.list({
			block_id: page.id,
			page_size: 100,
		});

		if (!blocks.success) {
			throw new Error('Failed to fetch page content');
		}

		// Extract text content from blocks
		const textContent = blocks.data
			.map((block: any) => {
				if (block.paragraph?.rich_text) {
					return block.paragraph.rich_text.map((t: any) => t.plain_text).join('');
				}
				if (block.heading_1?.rich_text) {
					return '# ' + block.heading_1.rich_text.map((t: any) => t.plain_text).join('');
				}
				if (block.heading_2?.rich_text) {
					return '## ' + block.heading_2.rich_text.map((t: any) => t.plain_text).join('');
				}
				if (block.bulleted_list_item?.rich_text) {
					return '• ' + block.bulleted_list_item.rich_text.map((t: any) => t.plain_text).join('');
				}
				return '';
			})
			.filter(Boolean)
			.join('\n');

		if (!textContent || textContent.length < 50) {
			return { success: true, skipped: true, reason: 'Not enough content to summarize' };
		}

		// Get page title
		const pageTitle =
			page.properties?.Name?.title?.[0]?.plain_text ||
			page.properties?.Title?.title?.[0]?.plain_text ||
			'Meeting Notes';

		// AI Analysis
		const lengthInstructions = {
			brief: 'Keep the summary to 2-3 sentences.',
			standard: 'Provide a thorough summary in 4-6 sentences.',
			detailed: 'Provide a comprehensive summary with all key points.',
		};

		const analysis = await integrations.ai.generateText({
			model: AIModels.LLAMA_3_8B,
			system: `You are a meeting notes analyst. Analyze meeting notes and extract:
1. Summary: ${lengthInstructions[inputs.summaryLength]}
2. Key Decisions: List any decisions made (bullet points)
3. Action Items: List tasks with assignees if mentioned (format: "- [ ] Task (@person if mentioned)")
4. Next Steps: What needs to happen next

Return as JSON:
{
  "summary": "...",
  "decisions": ["..."],
  "actionItems": [{"task": "...", "assignee": "..." or null}],
  "nextSteps": ["..."]
}`,
			prompt: `Analyze these meeting notes:\n\nTitle: ${pageTitle}\n\n${textContent}`,
			temperature: 0.3,
			max_tokens: 800,
		});

		let parsed;
		try {
			parsed = JSON.parse(analysis.data?.response || '{}');
		} catch {
			parsed = {
				summary: 'Unable to generate summary',
				decisions: [],
				actionItems: [],
				nextSteps: [],
			};
		}

		// Update Notion page with summary
		const summaryBlocks: Array<Record<string, any>> = [
			{
				object: 'block',
				type: 'divider',
				divider: {},
			},
			{
				object: 'block',
				type: 'heading_2',
				heading_2: {
					rich_text: [{ text: { content: '🤖 AI Summary' } }],
				},
			},
			{
				object: 'block',
				type: 'paragraph',
				paragraph: {
					rich_text: [{ text: { content: parsed.summary } }],
				},
			},
		];

		if (parsed.decisions?.length > 0) {
			summaryBlocks.push({
				object: 'block',
				type: 'heading_3',
				heading_3: {
					rich_text: [{ text: { content: '✅ Key Decisions' } }],
				},
			});
			parsed.decisions.forEach((decision: string) => {
				summaryBlocks.push({
					object: 'block',
					type: 'bulleted_list_item',
					bulleted_list_item: {
						rich_text: [{ text: { content: decision } }],
					},
				});
			});
		}

		if (parsed.actionItems?.length > 0) {
			summaryBlocks.push({
				object: 'block',
				type: 'heading_3',
				heading_3: {
					rich_text: [{ text: { content: '📋 Action Items' } }],
				},
			});
			parsed.actionItems.forEach((item: any) => {
				const taskText = item.assignee ? `${item.task} (@${item.assignee})` : item.task;
				summaryBlocks.push({
					object: 'block',
					type: 'to_do',
					to_do: {
						rich_text: [{ text: { content: taskText } }],
						checked: false,
					},
				});
			});
		}

		await integrations.notion.blocks.children.append({
			block_id: page.id,
			children: summaryBlocks,
		});

		// Post to Slack if configured
		if (inputs.notifyChannel) {
			const actionItemsList = parsed.actionItems
				?.map((a: any) => `• ${a.task}${a.assignee ? ` (@${a.assignee})` : ''}`)
				.join('\n');

			await integrations.slack.chat.postMessage({
				channel: inputs.notifyChannel,
				text: `Meeting notes summarized: ${pageTitle}`,
				blocks: [
					{
						type: 'header',
						text: { type: 'plain_text', text: `📝 ${pageTitle}` },
					},
					{
						type: 'section',
						text: { type: 'mrkdwn', text: `*Summary:*\n${parsed.summary}` },
					},
					...(actionItemsList
						? [
								{
									type: 'section',
									text: { type: 'mrkdwn', text: `*Action Items:*\n${actionItemsList}` },
								},
							]
						: []),
					{
						type: 'actions',
						elements: [
							{
								type: 'button',
								text: { type: 'plain_text', text: 'View in Notion' },
								url: page.url,
							},
						],
					},
				],
			});
		}

		return {
			success: true,
			pageId: page.id,
			pageTitle,
			summary: parsed.summary,
			actionItemCount: parsed.actionItems?.length || 0,
			decisionCount: parsed.decisions?.length || 0,
		};
	},
});

export const metadata = {
	id: 'meeting-notes-summarizer',
	category: 'content-creation',
	featured: false,
	stats: { rating: 4.8, users: 743, reviews: 38 },
};
