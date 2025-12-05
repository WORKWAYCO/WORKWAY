/**
 * Daily AI Newsletter
 *
 * Generate personalized newsletters based on your interests.
 * Uses AI to curate and summarize content.
 *
 * Integrations: Gmail, Workers AI
 * Trigger: Scheduled (daily)
 */

import { defineWorkflow, schedule } from '@workwayco/sdk';
import { AIModels } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Daily AI Newsletter',
	description: 'Generate personalized newsletters based on your interests',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'every_morning',

		outcomeStatement: {
			suggestion: 'Want AI-curated news every morning?',
			explanation: 'Every day, we\'ll curate and summarize content on your topics and send it to your inbox.',
			outcome: 'Personalized newsletter in your inbox',
		},

		primaryPair: {
			from: 'ai',
			to: 'gmail',
			workflowId: 'ai-newsletter',
			outcome: 'Newsletters that write themselves',
		},

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['gmail'],
				workflowId: 'ai-newsletter',
				priority: 30, // Lower priority - niche use case
			},
		],

		smartDefaults: {
			topics: { value: ['technology', 'business', 'productivity'] },
			newsletterName: { value: 'Your Daily Digest' },
			sendTime: { value: '07:00' },
			timezone: { inferFrom: 'user_timezone' },
			tone: { value: 'professional' },
		},

		essentialFields: ['recipientEmail'],

		zuhandenheit: {
			timeToValue: 1440, // 24 hours until first newsletter
			worksOutOfBox: true,
			gracefulDegradation: false,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'paid',
		pricePerMonth: 15,
		trialDays: 7,
		description: 'AI-powered daily newsletters',
	},

	integrations: [
		{ service: 'gmail', scopes: ['send_emails'] },
	],

	inputs: {
		recipientEmail: {
			type: 'email',
			label: 'Newsletter Recipient',
			required: true,
		},
		topics: {
			type: 'array',
			label: 'Topics of Interest',
			items: { type: 'string' },
			default: ['technology', 'business', 'productivity'],
		},
		newsletterName: {
			type: 'string',
			label: 'Newsletter Name',
			default: 'Your Daily Digest',
		},
		sendTime: {
			type: 'time',
			label: 'Send Time',
			default: '07:00',
		},
		timezone: {
			type: 'timezone',
			label: 'Timezone',
			default: 'America/New_York',
		},
		tone: {
			type: 'select',
			label: 'Writing Tone',
			options: ['professional', 'casual', 'enthusiastic'],
			default: 'professional',
		},
	},

	trigger: schedule({
		cron: '0 {{inputs.sendTime.hour}} * * *',
		timezone: '{{inputs.timezone}}',
	}),

	async execute({ inputs, integrations }) {
		const today = new Date().toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});

		// Generate newsletter content with AI
		const topicsStr = inputs.topics.join(', ');
		const toneInstructions = {
			professional: 'Write in a professional, informative tone.',
			casual: 'Write in a friendly, conversational tone.',
			enthusiastic: 'Write with energy and excitement.',
		};

		const contentGeneration = await integrations.ai.generateText({
			model: AIModels.LLAMA_3_8B,
			system: `You are a newsletter writer. ${toneInstructions[inputs.tone]}
Create a daily newsletter with the following sections:
1. Top Story (one compelling headline with 2-3 sentence summary)
2. Quick Hits (3-4 brief news items, one line each)
3. Tip of the Day (practical advice related to the topics)
4. Quote to Ponder (inspiring quote)

Format as clean HTML with inline styles. Use a modern, readable design.`,
			prompt: `Create today's newsletter for ${today}.
Topics: ${topicsStr}
Newsletter name: ${inputs.newsletterName}`,
			temperature: 0.7,
			max_tokens: 1500,
		});

		const htmlContent = contentGeneration.data?.response || '<p>Newsletter generation failed.</p>';

		// Wrap in email template
		const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5;">
  <div style="background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <header style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px;">
      <h1 style="color: #333; margin: 0;">${inputs.newsletterName}</h1>
      <p style="color: #666; margin: 10px 0 0;">${today}</p>
    </header>

    ${htmlContent}

    <footer style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px;">
      <p>Generated with AI by WORKWAY</p>
      <p>Topics: ${topicsStr}</p>
    </footer>
  </div>
</body>
</html>`;

		// Send email
		const sent = await integrations.gmail.messages.send({
			to: inputs.recipientEmail,
			subject: `${inputs.newsletterName} - ${today}`,
			html: emailHtml,
		});

		if (!sent.success) {
			throw new Error(`Failed to send newsletter: ${sent.error?.message}`);
		}

		return {
			success: true,
			recipient: inputs.recipientEmail,
			topics: inputs.topics,
			sentAt: new Date().toISOString(),
			messageId: sent.data?.id,
		};
	},

	onError: async ({ error, inputs }) => {
		console.error(`Newsletter failed for ${inputs.recipientEmail}:`, error.message);
	},
});

export const metadata = {
	id: 'daily-ai-newsletter',
	category: 'content-creation',
	featured: true,
	stats: { rating: 4.8, users: 892, reviews: 56 },
};
