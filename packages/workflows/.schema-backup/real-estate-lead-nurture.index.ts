/**
 * Real Estate Lead Nurture
 *
 * Leads that nurture themselves.
 *
 * Uses Workers AI to generate personalized follow-up sequences based on
 * lead source, property interests, and engagement history. Automatically
 * handles initial outreach, drip sequences, and showing scheduling.
 *
 * Zuhandenheit: The mechanism (AI, Follow Up Boss API, email) recedes.
 * What remains: Leads get nurtured, showings get booked.
 *
 * Integrations: Follow Up Boss, Gmail, Calendly (optional), Workers AI
 * Trigger: Webhook (new lead) + Scheduled (daily nurture check)
 */

import { defineWorkflow, schedule } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Real Estate Lead Nurture',
	description: 'AI-powered lead follow-up that adapts to buyer/seller context',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'when_leads_arrive',

		outcomeStatement: {
			suggestion: 'Let leads nurture themselves?',
			explanation: 'We\'ll monitor Follow Up Boss for new leads, use AI to craft personalized outreach based on their interests, and handle the entire nurture sequence automatically until they\'re ready for a showing.',
			outcome: 'Leads that nurture themselves',
		},

		primaryPair: {
			from: 'follow-up-boss',
			to: 'gmail',
			workflowId: 'real-estate-lead-nurture',
			outcome: 'New inquiries become scheduled showings',
		},

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['follow-up-boss', 'gmail'],
				workflowId: 'real-estate-lead-nurture',
				priority: 90,
			},
			{
				trigger: 'event_received',
				integrations: ['follow-up-boss'],
				workflowId: 'real-estate-lead-nurture',
				priority: 95,
			},
		],

		smartDefaults: {
			followUpDays: { value: [1, 3, 7, 14] },
			timezone: { inferFrom: 'user_timezone' },
			tone: { value: 'professional' },
		},

		essentialFields: ['agentName', 'agentEmail', 'agentPhone'],

		zuhandenheit: {
			timeToValue: 5, // 5 minutes - responds to new leads quickly
			worksOutOfBox: true,
			gracefulDegradation: true, // Falls back to templates if AI fails
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'paid',
		pricePerMonth: 39,
		trialDays: 14,
		description: 'AI-powered lead nurturing for real estate agents',
	},

	integrations: [
		{ service: 'follow-up-boss', scopes: ['read_people', 'write_people', 'read_tasks', 'write_tasks', 'write_notes'] },
		{ service: 'gmail', scopes: ['send_emails'] },
		{ service: 'calendly', scopes: ['read_events'], optional: true },
		{ service: 'slack', scopes: ['send_messages'], optional: true },
	],

	inputs: {
		agentName: {
			type: 'string',
			label: 'Your Name',
			required: true,
		},
		agentEmail: {
			type: 'email',
			label: 'Your Email',
			required: true,
		},
		agentPhone: {
			type: 'phone',
			label: 'Your Phone',
			required: true,
		},
		brokerageName: {
			type: 'string',
			label: 'Brokerage Name',
		},
		followUpDays: {
			type: 'array',
			label: 'Follow-up Schedule (days after inquiry)',
			items: { type: 'number' },
			default: [1, 3, 7, 14],
		},
		calendlyLink: {
			type: 'url',
			label: 'Calendly Booking Link',
			description: 'Link for leads to schedule showings',
		},
		slackChannel: {
			type: 'string',
			label: 'Slack Channel for Hot Leads',
			description: 'Get notified when high-value leads come in',
		},
		minHotLeadPrice: {
			type: 'number',
			label: 'Hot Lead Price Threshold',
			default: 500000,
			description: 'Alert on leads looking for homes above this price',
		},
		tone: {
			type: 'select',
			label: 'Communication Style',
			options: [
				{ value: 'friendly', label: 'Warm & Friendly' },
				{ value: 'professional', label: 'Professional' },
				{ value: 'luxury', label: 'Luxury/Premium' },
			],
			default: 'professional',
		},
		timezone: {
			type: 'timezone',
			label: 'Timezone',
			default: 'America/New_York',
		},
	},

	// Schedule trigger for nurture (webhook handled separately via Follow Up Boss webhook)
	trigger: schedule({
		cron: '0 9 * * *', // Daily at 9am
		timezone: '{{inputs.timezone}}',
	}),

	async execute({ inputs, integrations, storage }) {
		// Daily nurture check - process leads needing follow-up
		return handleDailyNurture({ inputs, integrations, storage });
	},
});

// ============================================================================
// NEW LEAD HANDLER
// ============================================================================

async function handleNewLead({
	trigger,
	inputs,
	integrations,
	storage,
}: {
	trigger: { data: { person: any } };
	inputs: any;
	integrations: any;
	storage: any;
}) {
	const person = trigger.data.person;
	const now = new Date();

	// Get full person details from Follow Up Boss
	const personResult = await integrations.followUpBoss.getPerson(person.id);
	if (!personResult.success || !personResult.data) {
		return { success: false, error: 'Could not fetch lead details' };
	}

	const lead = personResult.data;
	const leadEmail = lead.emails?.[0]?.value;
	const leadPhone = lead.phones?.[0]?.value;

	if (!leadEmail) {
		// Add note about missing email
		await integrations.followUpBoss.createNote({
			personId: lead.id,
			body: 'WORKWAY: Lead has no email address. Manual follow-up required.',
		});
		return { success: true, message: 'Lead has no email - flagged for manual follow-up' };
	}

	// Determine lead type from source/background
	const leadType = determineLeadType(lead);
	const isHotLead = lead.price && lead.price >= inputs.minHotLeadPrice;

	// Generate personalized initial outreach with Workers AI
	let emailContent: string;
	let emailSubject: string;
	let aiGenerated = false;

	try {
		const aiPrompt = buildInitialOutreachPrompt({
			agentName: inputs.agentName,
			brokerageName: inputs.brokerageName,
			leadName: lead.firstName,
			leadType,
			source: lead.source,
			priceRange: lead.price,
			background: lead.background,
			tone: inputs.tone,
			calendlyLink: inputs.calendlyLink,
		});

		const aiResult = await integrations.ai.generateText({
			model: '@cf/meta/llama-3.1-8b-instruct',
			prompt: aiPrompt,
			max_tokens: 600,
		});

		if (aiResult.success && aiResult.data) {
			const parsed = parseEmailResponse(aiResult.data);
			emailSubject = parsed.subject;
			emailContent = parsed.body;
			aiGenerated = true;
		} else {
			throw new Error('AI generation failed');
		}
	} catch {
		// Graceful degradation
		const template = getFallbackTemplate('initial', {
			agentName: inputs.agentName,
			brokerageName: inputs.brokerageName,
			leadName: lead.firstName,
			leadType,
			calendlyLink: inputs.calendlyLink,
		});
		emailSubject = template.subject;
		emailContent = template.body;
	}

	// Send initial outreach email
	await integrations.gmail.messages.send({
		to: leadEmail,
		subject: emailSubject,
		body: emailContent,
		replyTo: inputs.agentEmail,
	});

	// Add note to Follow Up Boss
	await integrations.followUpBoss.createNote({
		personId: lead.id,
		body: `WORKWAY: Sent initial outreach email.\n\nSubject: ${emailSubject}\n\n${aiGenerated ? '(AI-generated)' : '(Template)'}`,
	});

	// Create follow-up task
	const followUpDate = new Date(now);
	followUpDate.setDate(followUpDate.getDate() + inputs.followUpDays[0]);

	await integrations.followUpBoss.createTask({
		name: `Follow up with ${lead.firstName} ${lead.lastName || ''}`,
		dueDate: followUpDate.toISOString().split('T')[0],
		assignedUserId: lead.assignedUserId || lead.assignedTo,
		personId: lead.id,
		description: 'Automated follow-up if no response to initial outreach',
	});

	// Track nurture state
	await storage.put(`nurture:${lead.id}`, {
		leadId: lead.id,
		stage: 1,
		lastContact: now.toISOString(),
		nextFollowUp: followUpDate.toISOString(),
		emailsSent: 1,
	});

	// Alert on Slack for hot leads
	if (isHotLead && inputs.slackChannel) {
		await integrations.slack?.chat.postMessage({
			channel: inputs.slackChannel,
			text: `*Hot Lead Alert*\n\n*${lead.firstName} ${lead.lastName || ''}* just came in!\n\nPrice Range: $${(lead.price || 0).toLocaleString()}\nSource: ${lead.source || 'Unknown'}\nEmail: ${leadEmail}\nPhone: ${leadPhone || 'N/A'}\n\nInitial outreach sent automatically.`,
		});
	}

	return {
		success: true,
		action: 'initial_outreach',
		leadId: lead.id,
		leadName: `${lead.firstName} ${lead.lastName || ''}`,
		aiGenerated,
		isHotLead,
	};
}

// ============================================================================
// DAILY NURTURE HANDLER
// ============================================================================

async function handleDailyNurture({
	inputs,
	integrations,
	storage,
}: {
	inputs: any;
	integrations: any;
	storage: any;
}) {
	const now = new Date();
	const results: NurtureResult[] = [];

	// Get uncontacted leads that need follow-up
	const leadsResult = await integrations.followUpBoss.getUncontactedLeads();

	if (!leadsResult.success) {
		return { success: false, error: 'Failed to fetch leads' };
	}

	const leads = leadsResult.data || [];

	for (const lead of leads) {
		// Get nurture state
		const nurtureState = await storage.get(`nurture:${lead.id}`) as NurtureState | null;

		if (!nurtureState) {
			// New lead without nurture state - skip (handled by webhook)
			continue;
		}

		// Check if it's time for next follow-up
		if (!nurtureState.nextFollowUp) {
			continue; // No more follow-ups scheduled
		}
		const nextFollowUp = new Date(nurtureState.nextFollowUp);
		if (nextFollowUp > now) {
			continue; // Not yet time
		}

		// Check if we've exhausted the follow-up sequence
		const currentStage = nurtureState.stage;
		if (currentStage > inputs.followUpDays.length) {
			// Mark as needing manual attention
			await integrations.followUpBoss.updatePerson(lead.id, {
				tags: [...(lead.tags || []), 'needs-manual-followup'],
			});
			continue;
		}

		const leadEmail = lead.emails?.[0]?.value;
		if (!leadEmail) continue;

		const leadType = determineLeadType(lead);

		// Generate follow-up email
		let emailContent: string;
		let emailSubject: string;
		let aiGenerated = false;

		try {
			const aiPrompt = buildFollowUpPrompt({
				agentName: inputs.agentName,
				brokerageName: inputs.brokerageName,
				leadName: lead.firstName,
				leadType,
				stage: currentStage,
				daysSinceLastContact: Math.floor(
					(now.getTime() - new Date(nurtureState.lastContact).getTime()) / (1000 * 60 * 60 * 24)
				),
				tone: inputs.tone,
				calendlyLink: inputs.calendlyLink,
			});

			const aiResult = await integrations.ai.generateText({
				model: '@cf/meta/llama-3.1-8b-instruct',
				prompt: aiPrompt,
				max_tokens: 500,
			});

			if (aiResult.success && aiResult.data) {
				const parsed = parseEmailResponse(aiResult.data);
				emailSubject = parsed.subject;
				emailContent = parsed.body;
				aiGenerated = true;
			} else {
				throw new Error('AI generation failed');
			}
		} catch {
			const template = getFallbackTemplate('followup', {
				agentName: inputs.agentName,
				brokerageName: inputs.brokerageName,
				leadName: lead.firstName,
				leadType,
				stage: currentStage,
				calendlyLink: inputs.calendlyLink,
			});
			emailSubject = template.subject;
			emailContent = template.body;
		}

		// Send follow-up email
		await integrations.gmail.messages.send({
			to: leadEmail,
			subject: emailSubject,
			body: emailContent,
			replyTo: inputs.agentEmail,
		});

		// Add note
		await integrations.followUpBoss.createNote({
			personId: lead.id,
			body: `WORKWAY: Sent follow-up #${currentStage}.\n\nSubject: ${emailSubject}\n\n${aiGenerated ? '(AI-generated)' : '(Template)'}`,
		});

		// Update nurture state
		const nextStage = currentStage + 1;
		const nextFollowUpDays = inputs.followUpDays[nextStage - 1];
		const nextFollowUpDate = nextFollowUpDays
			? new Date(now.getTime() + nextFollowUpDays * 24 * 60 * 60 * 1000)
			: null;

		await storage.put(`nurture:${lead.id}`, {
			leadId: lead.id,
			stage: nextStage,
			lastContact: now.toISOString(),
			nextFollowUp: nextFollowUpDate?.toISOString() || null,
			emailsSent: nurtureState.emailsSent + 1,
		});

		results.push({
			leadId: lead.id,
			leadName: `${lead.firstName} ${lead.lastName || ''}`,
			stage: currentStage,
			aiGenerated,
		});
	}

	return {
		success: true,
		action: 'daily_nurture',
		leadsProcessed: leads.length,
		emailsSent: results.length,
		results,
	};
}

// ============================================================================
// TYPES
// ============================================================================

interface NurtureState {
	leadId: number;
	stage: number;
	lastContact: string;
	nextFollowUp: string | null;
	emailsSent: number;
}

interface NurtureResult {
	leadId: number;
	leadName: string;
	stage: number;
	aiGenerated: boolean;
}

type LeadType = 'buyer' | 'seller' | 'investor' | 'renter' | 'general';

// ============================================================================
// HELPERS
// ============================================================================

function determineLeadType(lead: { source?: string; background?: string; tags?: string[] }): LeadType {
	const source = (lead.source || '').toLowerCase();
	const background = (lead.background || '').toLowerCase();
	const tags = (lead.tags || []).map(t => t.toLowerCase());

	if (tags.includes('seller') || source.includes('seller') || background.includes('sell')) {
		return 'seller';
	}
	if (tags.includes('investor') || background.includes('invest')) {
		return 'investor';
	}
	if (tags.includes('renter') || source.includes('rent') || background.includes('rent')) {
		return 'renter';
	}
	if (tags.includes('buyer') || source.includes('buyer') || background.includes('buy') || background.includes('looking')) {
		return 'buyer';
	}
	return 'general';
}

function buildInitialOutreachPrompt(data: {
	agentName: string;
	brokerageName?: string;
	leadName: string;
	leadType: LeadType;
	source?: string;
	priceRange?: number;
	background?: string;
	tone: string;
	calendlyLink?: string;
}): string {
	const leadTypeContext = {
		buyer: 'looking to buy a home',
		seller: 'considering selling their property',
		investor: 'interested in investment properties',
		renter: 'looking for a rental',
		general: 'interested in real estate',
	};

	return `Generate a personalized initial outreach email for a real estate lead.

Context:
- Agent: ${data.agentName}${data.brokerageName ? ` with ${data.brokerageName}` : ''}
- Lead Name: ${data.leadName}
- Lead Type: ${data.leadType} (${leadTypeContext[data.leadType]})
- Lead Source: ${data.source || 'Website inquiry'}
${data.priceRange ? `- Price Range: $${data.priceRange.toLocaleString()}` : ''}
${data.background ? `- Additional Context: ${data.background}` : ''}
- Desired Tone: ${data.tone}
${data.calendlyLink ? `- Scheduling Link: ${data.calendlyLink}` : ''}

Requirements:
- Write a warm, personalized email (not generic)
- Reference their specific situation if known
- Include a clear call-to-action (schedule a call or reply)
- Keep it concise (under 200 words)
- Be ${data.tone} in tone
${data.calendlyLink ? '- Include the Calendly link for easy scheduling' : ''}

Format your response as:
SUBJECT: [subject line]

[email body]

Write only the email, nothing else.`;
}

function buildFollowUpPrompt(data: {
	agentName: string;
	brokerageName?: string;
	leadName: string;
	leadType: LeadType;
	stage: number;
	daysSinceLastContact: number;
	tone: string;
	calendlyLink?: string;
}): string {
	const stageContext = {
		1: 'first follow-up - gentle reminder',
		2: 'second follow-up - add value with market insight',
		3: 'third follow-up - create soft urgency',
		4: 'final follow-up - last attempt before pausing outreach',
	};

	return `Generate a follow-up email for a real estate lead who hasn't responded.

Context:
- Agent: ${data.agentName}${data.brokerageName ? ` with ${data.brokerageName}` : ''}
- Lead Name: ${data.leadName}
- Lead Type: ${data.leadType}
- Follow-up Stage: ${data.stage} (${stageContext[data.stage as keyof typeof stageContext] || 'follow-up'})
- Days Since Last Contact: ${data.daysSinceLastContact}
- Desired Tone: ${data.tone}
${data.calendlyLink ? `- Scheduling Link: ${data.calendlyLink}` : ''}

Requirements:
- Reference that this is a follow-up (without being pushy)
- Add value - mention a market trend, new listing, or helpful tip
- Include a clear call-to-action
- Keep it brief (under 150 words)
- Be ${data.tone} in tone
- Don't guilt trip or pressure

Format your response as:
SUBJECT: [subject line]

[email body]

Write only the email, nothing else.`;
}

function parseEmailResponse(aiResponse: string): { subject: string; body: string } {
	const lines = aiResponse.trim().split('\n');
	let subject = '';
	let bodyLines: string[] = [];
	let inBody = false;

	for (const line of lines) {
		if (line.startsWith('SUBJECT:')) {
			subject = line.replace('SUBJECT:', '').trim();
		} else if (subject && (line.trim() === '' || inBody)) {
			inBody = true;
			bodyLines.push(line);
		}
	}

	// Fallback if parsing fails
	if (!subject) {
		subject = 'Following up on your real estate inquiry';
	}
	if (bodyLines.length === 0) {
		bodyLines = [aiResponse];
	}

	return {
		subject,
		body: bodyLines.join('\n').trim(),
	};
}

function getFallbackTemplate(
	type: 'initial' | 'followup',
	data: {
		agentName: string;
		brokerageName?: string;
		leadName: string;
		leadType: LeadType;
		stage?: number;
		calendlyLink?: string;
	}
): { subject: string; body: string } {
	const templates = {
		initial: {
			subject: `${data.leadName}, let's find your perfect home`,
			body: `Hi ${data.leadName},

Thank you for reaching out! I'm ${data.agentName}${data.brokerageName ? ` with ${data.brokerageName}` : ''}, and I'd love to help you with your real estate ${data.leadType === 'seller' ? 'sale' : 'search'}.

I noticed you're ${data.leadType === 'buyer' ? 'looking to buy' : data.leadType === 'seller' ? 'considering selling' : 'interested in real estate'}, and I have some great options that might be perfect for you.

Would you have 15 minutes this week to chat about what you're looking for?${data.calendlyLink ? ` You can book a time that works for you here: ${data.calendlyLink}` : ''}

Looking forward to connecting!

Best,
${data.agentName}`,
		},
		followup: {
			subject: `Quick follow-up, ${data.leadName}`,
			body: `Hi ${data.leadName},

I wanted to follow up on my previous message. I know life gets busy, but I'm still here to help whenever you're ready.

${data.stage === 2 ? 'The market has been moving quickly lately, and I\'d love to share some insights that might be helpful for your search.' : ''}
${data.stage === 3 ? 'I have a few new listings that came on the market that might interest you.' : ''}
${data.stage === 4 ? 'I don\'t want to overwhelm your inbox, so this will be my last message for now. When you\'re ready to continue your search, I\'m just a reply away.' : ''}

Feel free to reach out whenever works for you.${data.calendlyLink ? ` Or book a quick call here: ${data.calendlyLink}` : ''}

Best,
${data.agentName}`,
		},
	};

	return templates[type];
}

export const metadata = {
	id: 'real-estate-lead-nurture',
	category: 'real-estate',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
	new: true,
};
