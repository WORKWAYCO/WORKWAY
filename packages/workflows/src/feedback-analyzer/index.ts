/**
 * Customer Feedback Analyzer
 *
 * AI analyzes customer feedback and extracts insights.
 * Monitors Gmail for feedback emails and logs to Notion.
 *
 * Integrations: AI, Gmail, Notion
 * Trigger: Gmail (new email matching feedback criteria)
 */

import { defineWorkflow, poll } from '@workwayco/sdk';
import { AIModels } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Customer Feedback Analyzer',
	description: 'AI analyzes customer feedback and extracts insights',
	version: '1.0.0',

	pricing: {
		model: 'paid',
		pricePerMonth: 15,
		trialDays: 7,
		description: 'Unlimited feedback analysis',
	},

	integrations: [
		{ service: 'gmail', scopes: ['read_emails', 'modify_labels'] },
		{ service: 'notion', scopes: ['write_pages', 'read_databases'] },
	],

	inputs: {
		feedbackDatabase: {
			type: 'notion_database_picker',
			label: 'Feedback Database',
			required: true,
			description: 'Where to store analyzed feedback',
		},
		emailQuery: {
			type: 'string',
			label: 'Gmail Search Query',
			default: 'subject:(feedback OR review OR suggestion) is:unread',
			description: 'Gmail search query to find feedback emails',
		},
		pollInterval: {
			type: 'select',
			label: 'Check Frequency',
			options: ['5min', '15min', '30min', '1hour'],
			default: '15min',
		},
		sentimentThreshold: {
			type: 'number',
			label: 'Alert Threshold (negative sentiment)',
			default: 0.7,
			description: 'Send alert for feedback above this negative score (0-1)',
		},
		alertEmail: {
			type: 'email',
			label: 'Alert Email',
			description: 'Email for urgent negative feedback alerts',
		},
	},

	trigger: poll({
		interval: '{{inputs.pollInterval}}',
	}),

	async execute({ inputs, integrations }) {
		// Search for feedback emails
		const emails = await integrations.gmail.messages.list({
			q: inputs.emailQuery,
			maxResults: 10,
		});

		if (!emails.success || !emails.data?.length) {
			return { success: true, processed: 0, message: 'No new feedback' };
		}

		const results: Array<{
			emailId: string;
			sentiment: string;
			category: string;
			priority: string;
			notionPageId?: string;
		}> = [];

		for (const emailSummary of emails.data) {
			// Get full email content
			const email = await integrations.gmail.messages.get({
				id: emailSummary.id,
				format: 'full',
			});

			if (!email.success) continue;

			const emailData = email.data;
			const subject = emailData.payload?.headers?.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
			const from = emailData.payload?.headers?.find((h: any) => h.name === 'From')?.value || 'Unknown';
			const body = emailData.snippet || '';

			// AI Analysis
			const analysis = await integrations.ai.generateText({
				model: AIModels.LLAMA_3_8B,
				system: `Analyze customer feedback and return JSON:
{
  "sentiment": "positive" | "neutral" | "negative",
  "sentimentScore": 0-1 (1 = very positive, 0 = very negative),
  "category": "bug" | "feature_request" | "praise" | "complaint" | "question" | "other",
  "summary": "one sentence summary",
  "keyPoints": ["point1", "point2"],
  "suggestedAction": "what to do about this feedback",
  "priority": "low" | "medium" | "high" | "urgent"
}`,
				prompt: `Analyze this customer feedback:\n\nFrom: ${from}\nSubject: ${subject}\n\n${body}`,
				temperature: 0.3,
				max_tokens: 400,
			});

			let parsed;
			try {
				parsed = JSON.parse(analysis.data?.response || '{}');
			} catch {
				parsed = {
					sentiment: 'neutral',
					sentimentScore: 0.5,
					category: 'other',
					summary: 'Unable to analyze',
					keyPoints: [],
					suggestedAction: 'Manual review required',
					priority: 'medium',
				};
			}

			// Create Notion page
			const notionPage = await integrations.notion.pages.create({
				parent: { database_id: inputs.feedbackDatabase },
				properties: {
					Name: {
						title: [{ text: { content: parsed.summary } }],
					},
					Sentiment: {
						select: { name: parsed.sentiment },
					},
					'Sentiment Score': {
						number: parsed.sentimentScore,
					},
					Category: {
						select: { name: parsed.category },
					},
					Priority: {
						select: { name: parsed.priority },
					},
					From: {
						email: from.match(/<(.+)>/)?.[1] || from,
					},
					Subject: {
						rich_text: [{ text: { content: subject } }],
					},
					Date: {
						date: { start: new Date().toISOString() },
					},
					Status: {
						select: { name: 'New' },
					},
				},
				children: [
					{
						object: 'block',
						type: 'heading_2',
						heading_2: { rich_text: [{ text: { content: '📧 Original Feedback' } }] },
					},
					{
						object: 'block',
						type: 'paragraph',
						paragraph: { rich_text: [{ text: { content: body } }] },
					},
					{
						object: 'block',
						type: 'divider',
						divider: {},
					},
					{
						object: 'block',
						type: 'heading_2',
						heading_2: { rich_text: [{ text: { content: '🤖 AI Analysis' } }] },
					},
					{
						object: 'block',
						type: 'heading_3',
						heading_3: { rich_text: [{ text: { content: 'Key Points' } }] },
					},
					...parsed.keyPoints.map((point: string) => ({
						object: 'block',
						type: 'bulleted_list_item',
						bulleted_list_item: { rich_text: [{ text: { content: point } }] },
					})),
					{
						object: 'block',
						type: 'heading_3',
						heading_3: { rich_text: [{ text: { content: 'Suggested Action' } }] },
					},
					{
						object: 'block',
						type: 'callout',
						callout: {
							rich_text: [{ text: { content: parsed.suggestedAction } }],
							icon: { emoji: '💡' },
						},
					},
				],
			});

			// Mark email as read
			await integrations.gmail.messages.modify({
				id: emailSummary.id,
				removeLabelIds: ['UNREAD'],
				addLabelIds: ['FEEDBACK_PROCESSED'],
			});

			// Alert for highly negative feedback
			if (parsed.sentimentScore < (1 - inputs.sentimentThreshold) && inputs.alertEmail) {
				await integrations.gmail.messages.send({
					to: inputs.alertEmail,
					subject: `⚠️ Urgent Negative Feedback: ${parsed.summary}`,
					body: `
Negative feedback detected (score: ${parsed.sentimentScore.toFixed(2)})

From: ${from}
Subject: ${subject}
Category: ${parsed.category}
Priority: ${parsed.priority}

Summary: ${parsed.summary}

Suggested Action: ${parsed.suggestedAction}

View in Notion: ${notionPage.data?.url}
					`,
				});
			}

			results.push({
				emailId: emailSummary.id,
				sentiment: parsed.sentiment,
				category: parsed.category,
				priority: parsed.priority,
				notionPageId: notionPage.data?.id,
			});
		}

		return {
			success: true,
			processed: results.length,
			results,
		};
	},
});

export const metadata = {
	id: 'customer-feedback-analyzer',
	category: 'data-analytics',
	featured: false,
	stats: { rating: 4.6, users: 478, reviews: 24 },
};
