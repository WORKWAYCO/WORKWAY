/**
 * Newsletter Autopilot
 * 
 * AI-native newsletter that writes, reviews, and sends itself.
 * Dog-fooding WORKWAY's own newsletter platform.
 * 
 * Full cycle:
 * 1. Discover content (platform data, git history, industry trends)
 * 2. Generate structured newsletter content with AI
 * 3. Review against taste guidelines (dimensional scoring)
 * 4. Refine if needed (max 3 cycles before human escalation)
 * 5. Render and send to subscribers
 * 6. Track analytics for feedback loop
 * 
 * Notifications: Email via Resend (no Slack required)
 * Trigger: Scheduled (bi-weekly, 1st and 15th of month)
 */

import { defineWorkflow, schedule } from '@workwayco/sdk';
import { AIModels } from '@workwayco/sdk';

// Helper to send admin notifications via Resend
async function sendAdminNotification(
	resendApiKey: string,
	adminEmail: string,
	subject: string,
	html: string,
	text: string
) {
	if (!resendApiKey || !adminEmail) return;
	
	try {
		await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				'Authorization': `Bearer ${resendApiKey}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				from: 'WORKWAY Newsletter <newsletter@workway.co>',
				to: adminEmail,
				subject,
				html,
				text,
			}),
		});
	} catch (error) {
		console.error('[Newsletter Autopilot] Failed to send notification:', error);
	}
}

// Newsletter content types (matching newsletter-taste.ts)
interface NewsletterSection {
	type: 'hero' | 'workflow_showcase' | 'automation_idea' | 'product_update' | 'industry_insight' | 'cta';
}

interface HeroSection extends NewsletterSection {
	type: 'hero';
	title: string;
	subtitle: string;
}

interface WorkflowShowcaseSection extends NewsletterSection {
	type: 'workflow_showcase';
	workflowId?: string;
	workflowName: string;
	outcomeFrame: string;
	integrations: string[];
	story: string;
	ctaUrl?: string;
}

interface AutomationIdeaSection extends NewsletterSection {
	type: 'automation_idea';
	problem: string;
	solution: string;
	outcome: string;
	difficulty?: 'simple' | 'standard' | 'complex';
}

interface ProductUpdateSection extends NewsletterSection {
	type: 'product_update';
	title: string;
	description: string;
	link?: string;
	isNew?: boolean;
}

interface IndustryInsightSection extends NewsletterSection {
	type: 'industry_insight';
	title: string;
	content: string;
	source?: string;
	sourceUrl?: string;
}

interface CtaSection extends NewsletterSection {
	type: 'cta';
	text: string;
	buttonText: string;
	buttonUrl: string;
}

type AnyNewsletterSection = HeroSection | WorkflowShowcaseSection | AutomationIdeaSection | ProductUpdateSection | IndustryInsightSection | CtaSection;

interface NewsletterContent {
	title: string;
	preheader: string;
	sections: AnyNewsletterSection[];
}

interface TasteReviewResult {
	passes: boolean;
	overallScore: number;
	dimensions: Record<string, number>;
	feedback: string[];
	suggestions: string[];
}

// Content generation system prompt
const CONTENT_GENERATION_PROMPT = `You are generating content for the WORKWAY newsletter.

WORKWAY is automation infrastructure for AI-native developers.
The newsletter reaches developers and teams interested in TypeScript-based workflow automation.

Follow these guidelines strictly:

BRAND VOICE:
- Developer-focused language
- Outcome-first framing ("Meetings that write their own notes" not "AI-powered meeting tool")
- No marketing superlatives or hype
- Concise, scannable writing

FORBIDDEN PHRASES (never use):
- "revolutionary", "game-changing", "best-in-class", "world-class"
- "cutting-edge", "next-generation", "industry-leading"
- "synergy", "leverage", "circle back", "move the needle"
- "amazing", "awesome", "incredible", "mind-blowing"

STRUCTURE:
- Subject line: max 60 chars, no emoji
- Target read time: 3 minutes
- Sections: 3-6 total
- Must include: hero section and CTA section

Return content as valid JSON matching this structure:
{
  "title": "Subject line here",
  "preheader": "Preview text here",
  "sections": [
    { "type": "hero", "title": "...", "subtitle": "..." },
    { "type": "workflow_showcase", "workflowName": "...", "outcomeFrame": "...", "integrations": [...], "story": "...", "ctaUrl": "..." },
    { "type": "automation_idea", "problem": "...", "solution": "...", "outcome": "..." },
    { "type": "cta", "text": "...", "buttonText": "...", "buttonUrl": "..." }
  ]
}`;

export default defineWorkflow({
	name: 'Newsletter Autopilot',
	description: 'AI-native newsletter that writes, reviews, and sends itself',
	version: '1.0.0',

	pathway: {
		outcomeFrame: 'biweekly_automatically',

		outcomeStatement: {
			suggestion: 'Newsletter that runs itself?',
			explanation: 'Every two weeks, we generate, review, and send a newsletter with workflow showcases, product updates, and industry insights.',
			outcome: 'Bi-weekly newsletter sent to subscribers',
		},

		primaryPair: {
			from: 'workway-api',
			to: 'resend',
			workflowId: 'newsletter-autopilot',
			outcome: 'Newsletter that writes itself',
		},

		discoveryMoments: [], // Internal workflow, not publicly discoverable

		smartDefaults: {
			notifyOnEscalation: { value: true },
			maxRefinementCycles: { value: 3 },
		},

		essentialFields: ['api_token', 'resend_api_key', 'admin_email'],

		zuhandenheit: {
			timeToValue: 14 * 24 * 60, // 14 days (bi-weekly)
			worksOutOfBox: false, // Requires API token
			gracefulDegradation: true, // Can escalate to human
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'free',
		description: 'WORKWAY internal workflow',
	},

	integrations: [
		{ service: 'workway-api', scopes: ['newsletter'] },
		{ service: 'resend', scopes: ['send'] },
	],

	config: {
		api_token: {
			type: 'secret',
			label: 'WORKWAY API Token',
			required: true,
			description: 'Admin API token for newsletter management',
		},
		api_base_url: {
			type: 'string',
			label: 'API Base URL',
			default: 'https://workway-api.half-dozen.workers.dev',
		},
		resend_api_key: {
			type: 'secret',
			label: 'Resend API Key',
			required: true,
			description: 'For sending notification emails',
		},
		admin_email: {
			type: 'string',
			label: 'Admin Email',
			required: true,
			description: 'Email for escalation and success notifications',
		},
		perplexity_api_key: {
			type: 'secret',
			label: 'Perplexity API Key',
			required: false,
			description: 'Optional: For industry insight research',
		},
		notify_on_escalation: {
			type: 'boolean',
			label: 'Notify on Escalation',
			default: true,
		},
		notify_on_success: {
			type: 'boolean',
			label: 'Notify on Success',
			default: true,
		},
		max_refinement_cycles: {
			type: 'number',
			label: 'Max Refinement Cycles',
			default: 3,
			min: 1,
			max: 5,
		},
	},

	trigger: schedule({
		// 1st and 15th of each month at 9 AM UTC
		cron: '0 9 1,15 * *',
		timezone: 'UTC',
	}),

	async execute({ inputs, integrations }) {
		const apiBaseUrl = inputs.apiBaseUrl;
		const authHeaders = {
			'Authorization': `Bearer ${inputs.apiToken}`,
			'Content-Type': 'application/json',
		};

		// ========================================
		// STEP 1: Discover Content
		// ========================================
		
		console.log('[Newsletter Autopilot] Step 1: Discovering content...');

		// Get featured workflows
		const workflowsResponse = await fetch(`${apiBaseUrl}/newsletter/sources/workflows`, {
			headers: authHeaders,
		});
		const workflowsData = await workflowsResponse.json() as { workflows: any[] };
		const workflows = workflowsData.workflows || [];

		// Get last issue for context
		const lastIssueResponse = await fetch(`${apiBaseUrl}/newsletter/sources/last-issue`, {
			headers: authHeaders,
		});
		const lastIssueData = await lastIssueResponse.json() as { lastIssue: any };
		const lastIssue = lastIssueData.lastIssue;

		// Get analytics for feedback
		const analyticsResponse = await fetch(`${apiBaseUrl}/newsletter/sources/analytics`, {
			headers: authHeaders,
		});
		const analyticsData = await analyticsResponse.json() as { issues: any[] };

		// ========================================
		// STEP 2: Generate Content with AI
		// ========================================
		
		console.log('[Newsletter Autopilot] Step 2: Generating content...');

		// Build context for AI
		const today = new Date();
		const issueDate = today.toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		});

		// Select featured workflows (new or high-performing)
		const newWorkflows = workflows.filter((w: any) => {
			const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
			return w.createdAt && w.createdAt * 1000 > twoWeeksAgo;
		});

		const featuredWorkflow = newWorkflows[0] || workflows[0];

		// Generate with AI
		const contentPrompt = `Generate a WORKWAY newsletter for ${issueDate}.

FEATURED WORKFLOW:
${featuredWorkflow ? `
- Name: ${featuredWorkflow.name}
- Description: ${featuredWorkflow.shortDescription}
- Integrations: ${featuredWorkflow.integrationPairs || 'Various'}
- Outcome: ${featuredWorkflow.outcomeFrame || 'Automation'}
` : 'No featured workflow this issue'}

RECENT CONTEXT:
- Last newsletter: ${lastIssue?.title || 'First issue'}
- Total subscribers: Growing

REQUIREMENTS:
1. Hero section with compelling subject line
2. If featured workflow exists, include a workflow_showcase section
3. Include one automation_idea (problem → solution → outcome)
4. End with clear CTA to browse marketplace

Generate JSON content following the schema provided.`;

		const generated = await integrations.ai.generateText({
			model: AIModels.LLAMA_3_8B,
			system: CONTENT_GENERATION_PROMPT,
			prompt: contentPrompt,
			temperature: 0.7,
			max_tokens: 2000,
		});

		let content: NewsletterContent;
		try {
			// Extract JSON from response
			const responseText = generated.data?.response || '';
			const jsonMatch = responseText.match(/\{[\s\S]*\}/);
			if (!jsonMatch) throw new Error('No JSON found in response');
			content = JSON.parse(jsonMatch[0]);
		} catch (error) {
			console.error('[Newsletter Autopilot] Failed to parse AI response:', error);
			
			// Fallback to minimal content
			content = {
				title: `WORKWAY Update - ${issueDate}`,
				preheader: 'Automation ideas and workflow updates',
				sections: [
					{
						type: 'hero',
						title: 'Automation Update',
						subtitle: 'New workflows and ideas for your automation stack.',
					},
					{
						type: 'cta',
						text: 'Explore the latest workflows in our marketplace.',
						buttonText: 'Browse Workflows',
						buttonUrl: 'https://workway.co/marketplace',
					},
				],
			};
		}

		// ========================================
		// STEP 3: Create Draft Issue
		// ========================================
		
		console.log('[Newsletter Autopilot] Step 3: Creating draft...');

		const createResponse = await fetch(`${apiBaseUrl}/newsletter/admin/issues`, {
			method: 'POST',
			headers: authHeaders,
			body: JSON.stringify({
				title: content.title,
				preheader: content.preheader,
				contentJson: content,
				generatedBy: 'agent',
			}),
		});

		if (!createResponse.ok) {
			throw new Error(`Failed to create issue: ${createResponse.status}`);
		}

		const createData = await createResponse.json() as { issue: { id: string; slug: string } };
		const issueId = createData.issue.id;
		const issueSlug = createData.issue.slug;

		// ========================================
		// STEP 4: Taste Review Loop
		// ========================================
		
		console.log('[Newsletter Autopilot] Step 4: Running taste review...');

		let cycles = 0;
		let review: TasteReviewResult | null = null;
		const maxCycles = inputs.maxRefinementCycles || 3;

		while (cycles < maxCycles) {
			const validateResponse = await fetch(`${apiBaseUrl}/newsletter/admin/issues/${issueId}/validate`, {
				method: 'POST',
				headers: authHeaders,
			});

			const validateData = await validateResponse.json() as { review: TasteReviewResult };
			review = validateData.review;
			cycles++;

			if (review.passes) {
				console.log(`[Newsletter Autopilot] Taste review passed (cycle ${cycles})`);
				break;
			}

			console.log(`[Newsletter Autopilot] Taste review failed (cycle ${cycles}), refining...`);

			// Refine content based on feedback
			const refinementPrompt = `The newsletter failed taste review. Please improve it.

CURRENT CONTENT:
${JSON.stringify(content, null, 2)}

FEEDBACK:
${review.feedback.join('\n')}

SUGGESTIONS:
${review.suggestions.join('\n')}

DIMENSIONAL SCORES:
${JSON.stringify(review.dimensions)}

Return improved JSON content addressing all feedback.`;

			const refined = await integrations.ai.generateText({
				model: AIModels.LLAMA_3_8B,
				system: CONTENT_GENERATION_PROMPT,
				prompt: refinementPrompt,
				temperature: 0.5,
				max_tokens: 2000,
			});

			try {
				const refinedText = refined.data?.response || '';
				const jsonMatch = refinedText.match(/\{[\s\S]*\}/);
				if (jsonMatch) {
					content = JSON.parse(jsonMatch[0]);

					// Update the issue with refined content
					await fetch(`${apiBaseUrl}/newsletter/admin/issues/${issueId}`, {
						method: 'PUT',
						headers: authHeaders,
						body: JSON.stringify({
							title: content.title,
							preheader: content.preheader,
							contentJson: content,
						}),
					});
				}
			} catch (error) {
				console.error('[Newsletter Autopilot] Failed to parse refined content:', error);
			}
		}

		// ========================================
		// STEP 5: Handle Result
		// ========================================

		if (!review?.passes) {
			// Escalate to human
			console.log('[Newsletter Autopilot] Escalating to human review...');

			if (inputs.notifyOnEscalation) {
				await sendAdminNotification(
					inputs.resendApiKey,
					inputs.adminEmail,
					`⚠️ Newsletter needs human review`,
					`
						<h2>Newsletter Autopilot: Human Review Needed</h2>
						<p>The newsletter failed to pass taste review after <strong>${cycles}</strong> refinement attempts.</p>
						<p><strong>Issue:</strong> ${content.title}</p>
						<p><strong>Feedback:</strong></p>
						<ul>${(review?.feedback || []).map(f => `<li>${f}</li>`).join('')}</ul>
						<p><strong>Suggestions:</strong></p>
						<ul>${(review?.suggestions || []).map(s => `<li>${s}</li>`).join('')}</ul>
						<p><a href="https://workway.co/admin/newsletter/issues/${issueSlug}" style="background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">Review and Edit →</a></p>
					`,
					`Newsletter Autopilot: Human Review Needed

The newsletter failed to pass taste review after ${cycles} refinement attempts.

Issue: ${content.title}
Feedback: ${(review?.feedback || []).join(', ')}

Review and edit: https://workway.co/admin/newsletter/issues/${issueSlug}`
				);
			}

			return {
				status: 'needs_review',
				issueId,
				issueSlug,
				cycles,
				feedback: review?.feedback || [],
			};
		}

		// ========================================
		// STEP 6: Render and Send
		// ========================================
		
		console.log('[Newsletter Autopilot] Step 6: Rendering and sending...');

		// Render HTML/text from structured content
		const renderResponse = await fetch(`${apiBaseUrl}/newsletter/admin/issues/${issueId}/render`, {
			method: 'POST',
			headers: authHeaders,
		});

		if (!renderResponse.ok) {
			throw new Error(`Failed to render issue: ${renderResponse.status}`);
		}

		// Send to subscribers
		const sendResponse = await fetch(`${apiBaseUrl}/newsletter/admin/issues/${issueId}/send`, {
			method: 'POST',
			headers: authHeaders,
		});

		if (!sendResponse.ok) {
			throw new Error(`Failed to send issue: ${sendResponse.status}`);
		}

		const sendData = await sendResponse.json() as { stats: { recipients: number; sent: number; failed: number } };

		// Notify success
		if (inputs.notifyOnSuccess) {
			await sendAdminNotification(
				inputs.resendApiKey,
				inputs.adminEmail,
				`✅ Newsletter sent to ${sendData.stats.sent} subscribers`,
				`
					<h2>Newsletter Autopilot: Sent Successfully</h2>
					<table style="border-collapse:collapse;margin:16px 0;">
						<tr><td style="padding:8px 16px 8px 0;color:#666;">Subject:</td><td style="padding:8px 0;"><strong>${content.title}</strong></td></tr>
						<tr><td style="padding:8px 16px 8px 0;color:#666;">Recipients:</td><td style="padding:8px 0;">${sendData.stats.sent}</td></tr>
						<tr><td style="padding:8px 16px 8px 0;color:#666;">Taste Score:</td><td style="padding:8px 0;">${review?.overallScore || 'N/A'}/10</td></tr>
						<tr><td style="padding:8px 16px 8px 0;color:#666;">Refinement Cycles:</td><td style="padding:8px 0;">${cycles}</td></tr>
					</table>
					<p><a href="https://workway.co/newsletter/issues/${issueSlug}" style="background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">View Issue →</a></p>
				`,
				`Newsletter Autopilot: Sent Successfully

Subject: ${content.title}
Recipients: ${sendData.stats.sent}
Taste Score: ${review?.overallScore || 'N/A'}/10
Refinement Cycles: ${cycles}

View issue: https://workway.co/newsletter/issues/${issueSlug}`
			);
		}

		return {
			status: 'sent',
			issueId,
			issueSlug,
			title: content.title,
			cycles,
			tasteScore: review?.overallScore,
			stats: sendData.stats,
		};
	},

	onError: async ({ error, inputs }) => {
		console.error('[Newsletter Autopilot] Error:', error.message);

		if (inputs.notifyOnEscalation) {
			await sendAdminNotification(
				inputs.resendApiKey,
				inputs.adminEmail,
				`❌ Newsletter Autopilot Error`,
				`
					<h2>Newsletter Autopilot Failed</h2>
					<p style="color:#d32f2f;"><strong>Error:</strong> ${error.message}</p>
					<p>Please check the logs and try again.</p>
				`,
				`Newsletter Autopilot Failed

Error: ${error.message}

Please check the logs and try again.`
			);
		}
	},
});

export const metadata = {
	id: 'newsletter-autopilot',
	category: 'internal',
	featured: false,
	internal: true,
	stats: { rating: 0, users: 1, reviews: 0 },
};
