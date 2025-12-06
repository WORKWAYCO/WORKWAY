/**
 * WORKWAY SEO/AEO Data Configuration
 *
 * Centralized configuration for all page metadata, schema markup,
 * and content optimized for both search engines and AI answer engines.
 *
 * Philosophy: Zuhandenheit — the tool recedes, the outcome remains.
 * Voice: CREATE SOMETHING Canon — specificity over generality.
 *
 * IMPORTANT: Pricing in this file uses only provable claims:
 * - Platform fee: $0.05 (light) / $0.25 (heavy) per execution
 * - Developer pricing: Set by developers (variable)
 * - Claims like "$0.15/meeting" are EXAMPLES, not guarantees
 *
 * All prices marked with (platform fee) or (example) for clarity.
 */

// ============================================================================
// CORE PAGE SEO
// ============================================================================

export const corePages = {
	home: {
		path: '/',
		title: 'WORKWAY - Invisible Workflow Automation',
		description:
			'Meetings that write their own notes. Payments that track themselves. Workflows that run while you sleep. WORKWAY makes busywork disappear.',
		keywords: [
			'workflow automation',
			'invisible automation',
			'automatic workflows',
			'no-code automation',
		],
		ogImage: '/og/home.png',
		schema: {
			'@type': 'SoftwareApplication',
			name: 'WORKWAY',
			applicationCategory: 'BusinessApplication',
			operatingSystem: 'Web',
			offers: {
				'@type': 'Offer',
				price: '0',
				priceCurrency: 'USD',
				description: 'Pay per execution. $0.05-$0.25 per workflow run.',
			},
		},
		faq: [
			{
				question: 'What is workflow automation?',
				answer:
					'Workflow automation connects apps to perform tasks without manual intervention. When an event happens in one app (like a Zoom meeting ending), actions happen automatically in other apps (like creating Notion notes). WORKWAY handles 21 integration pairs across Zoom, Notion, Slack, Stripe, and more.',
			},
			{
				question: 'How much does WORKWAY cost?',
				answer:
					'WORKWAY uses pay-per-execution pricing. Each workflow run costs $0.05-$0.25 depending on complexity. No monthly fees. No per-seat pricing. A meeting summary costs $0.15. A payment notification costs $0.10.',
			},
			{
				question: 'Is my data secure with WORKWAY?',
				answer:
					"WORKWAY runs on Cloudflare's global edge network. Your credentials are encrypted at rest. Your data stays in your region. We never store your content—workflows process and forward, they don't retain.",
			},
		],
	},

	outcomes: {
		path: '/outcomes',
		title: 'Workflow Marketplace - Pre-Built Automation | WORKWAY',
		description:
			'Pick what should happen automatically. Zoom to Notion. Stripe to Slack. Meetings that write themselves. Payments that track themselves. Install in 90 seconds.',
		keywords: [
			'workflow marketplace',
			'automation workflows',
			'pre-built automation',
			'buy workflows',
		],
		ogImage: '/og/outcomes.png',
	},

	developers: {
		path: '/developers',
		title: 'Sell Workflow Automation - 85% Revenue Share | WORKWAY Developers',
		description:
			'Build TypeScript workflows. Sell on WORKWAY marketplace. Keep 85% of revenue. Average developer earns $340/month. Zero platform fee until $10K.',
		keywords: [
			'sell workflows',
			'workflow marketplace developers',
			'monetize automation',
			'typescript workflows',
		],
		ogImage: '/og/developers.png',
		schema: {
			'@type': 'WebPage',
			name: 'WORKWAY Developer Program',
			description: 'Build and sell automation workflows. Keep 85% of revenue.',
			mainEntity: {
				'@type': 'Offer',
				name: 'WORKWAY Developer Revenue Share',
				description: '85% revenue share on all workflow sales',
				eligibleRegion: 'Worldwide',
			},
		},
		faq: [
			{
				question: 'How much can developers earn on WORKWAY?',
				answer:
					'Developers keep 85% of every workflow execution. At $0.15/execution with 10,000 monthly runs, that\'s $1,275/month. Top developers earn $3,000+/month from a single workflow. Average time to first sale: 12 days.',
			},
			{
				question: 'What technology does WORKWAY use?',
				answer:
					"WORKWAY workflows are TypeScript functions that run on Cloudflare Workers. You get full type safety, local testing, and sub-50ms execution globally. The SDK handles OAuth, rate limiting, and error handling.",
			},
			{
				question: 'How does the fork attribution system work?',
				answer:
					'When someone forks your workflow and sells it, you automatically earn 12% of their revenue forever. Attribution is on-chain and permanent. If your forked workflow gets forked again, you still earn.',
			},
		],
	},

	docs: {
		path: '/docs',
		title: 'Documentation - Build Automation Workflows | WORKWAY',
		description:
			'Everything you need to build, test, and publish automation workflows. TypeScript SDK, CLI reference, integration guides, and examples.',
		keywords: ['workflow documentation', 'automation SDK', 'typescript workflow guide'],
		ogImage: '/og/docs.png',
	},
} as const;

// ============================================================================
// OUTCOME FRAME PAGES
// ============================================================================

export const outcomeFramePages = {
	after_meetings: {
		path: '/outcomes/after-meetings',
		slug: 'after-meetings',
		title: 'Zoom to Notion Automation - Meeting Notes That Write Themselves | WORKWAY',
		description:
			'Automatically sync Zoom meetings to Notion. AI-generated summaries, action items, and follow-ups. $0.15/meeting. Setup in 90 seconds.',
		h1: 'After your meeting ends, everything updates.',
		subhead: 'Notion page created. Slack summary posted. Tasks in Linear. You did nothing.',
		keywords: [
			'zoom to notion automation',
			'zoom meeting notes automation',
			'automatically transcribe zoom to notion',
			'sync zoom recordings to notion',
			'zoom transcription to notion',
			'automatic meeting notes',
		],
		ogImage: '/og/outcomes/after-meetings.png',
		workflows: ['meeting-intelligence', 'meeting-summarizer'],
		competitorComparison: {
			transkriptor: 'Transcription only. No Notion. No Slack. No tasks.',
			zapier: 'Multi-step setup. No AI synthesis. Per-task pricing adds up.',
			make: 'Complex visual builder. No built-in transcription.',
			workway: 'Zoom meeting ends → Everything updates. One workflow. One price.',
		},
		faq: [
			{
				question: 'How do I automatically sync Zoom meetings to Notion?',
				answer:
					"Install WORKWAY's Meeting Intelligence workflow. Connect your Zoom and Notion accounts via OAuth (takes 90 seconds). Every completed Zoom meeting automatically creates a Notion page with the full transcript, AI-generated summary, action items, and follow-ups. Cost: $0.15 per meeting.",
			},
			{
				question: 'Can I get Zoom transcripts in Slack?',
				answer:
					"Yes. WORKWAY's Meeting Summarizer posts an AI-generated summary to your Slack channel within 60 seconds of your meeting ending. Includes key decisions and action items. $0.08/meeting.",
			},
			{
				question: 'Does this work with Zoom\'s native transcription?',
				answer:
					"WORKWAY uses Zoom's cloud recording and generates higher-quality transcription via AI. Works with all Zoom accounts that have cloud recording enabled (Pro, Business, Enterprise).",
			},
		],
	},

	when_payments_arrive: {
		path: '/outcomes/when-payments-arrive',
		slug: 'when-payments-arrive',
		title: 'Stripe to Notion Automation - Payments That Track Themselves | WORKWAY',
		description:
			'Automatically log Stripe payments to Notion. Real-time revenue tracking, invoice generation, and team notifications. $0.10/payment.',
		h1: 'When payments arrive, everything updates.',
		subhead: 'Notion database updated. Slack notification sent. You didn\'t check Stripe.',
		keywords: [
			'stripe to notion automation',
			'log stripe payments to notion',
			'stripe notion integration',
			'automatic payment tracking',
			'stripe to slack notifications',
		],
		ogImage: '/og/outcomes/when-payments-arrive.png',
		workflows: ['stripe-to-notion', 'revenue-radar', 'invoice-generator'],
		faq: [
			{
				question: 'How do I automatically log Stripe payments to Notion?',
				answer:
					"Install WORKWAY's Stripe to Notion workflow. Connect Stripe and Notion via OAuth. Every payment automatically creates a row in your Notion database with amount, customer, date, and status. $0.10/payment.",
			},
			{
				question: 'Can I get Stripe payment notifications in Slack?',
				answer:
					"Yes. WORKWAY's Revenue Radar posts payment alerts to Slack in real-time. Includes customer name, amount, and product. Also updates HubSpot deals if connected. $0.10/payment.",
			},
		],
	},

	when_leads_come_in: {
		path: '/outcomes/when-leads-come-in',
		slug: 'when-leads-come-in',
		title: 'Form to CRM Automation - Leads That Route Themselves | WORKWAY',
		description:
			'Automatically send Typeform responses to HubSpot, Notion, or Airtable. AI-powered lead scoring and Slack notifications. $0.08/lead.',
		h1: 'When leads come in, they route themselves.',
		subhead: 'HubSpot contact created. Slack alert sent. You didn\'t check your inbox.',
		keywords: [
			'typeform to hubspot automation',
			'form to crm automation',
			'automatic lead routing',
			'typeform hubspot integration',
		],
		ogImage: '/og/outcomes/when-leads-come-in.png',
		workflows: ['sales-lead-pipeline', 'form-response-hub'],
		faq: [
			{
				question: 'How do I automatically send Typeform responses to HubSpot?',
				answer:
					"Install WORKWAY's Sales Lead Pipeline workflow. Connect Typeform and HubSpot. Every form submission creates a HubSpot contact with all form fields mapped. Includes AI-powered lead scoring. $0.08/lead.",
			},
		],
	},

	every_morning: {
		path: '/outcomes/every-morning',
		slug: 'every-morning',
		title: 'Daily Standup Automation - Morning Digests That Write Themselves | WORKWAY',
		description:
			'Automatic daily standups, sprint updates, and content reminders. Posted to Slack every morning. No more status meetings.',
		h1: 'Every morning, your team is already updated.',
		subhead: 'Standup compiled. Sprint progress posted. Content calendar reminded. You slept in.',
		keywords: [
			'automatic standup bot',
			'daily digest automation',
			'morning standup slack',
			'sprint progress automation',
		],
		ogImage: '/og/outcomes/every-morning.png',
		workflows: ['standup-bot', 'sprint-progress-tracker', 'content-calendar', 'team-digest'],
		faq: [
			{
				question: 'How do I automate daily standups?',
				answer:
					"Install WORKWAY's Standup Bot. It compiles yesterday's activity from Slack, Linear, and GitHub, then posts a summary to your team channel every morning at your chosen time. $0.05/day.",
			},
		],
	},

	weekly_automatically: {
		path: '/outcomes/weekly-automatically',
		slug: 'weekly-automatically',
		title: 'Weekly Digest Automation - Reports That Write Themselves | WORKWAY',
		description:
			'Automatic weekly productivity reports, team digests, and progress summaries. Posted to Slack every Monday.',
		h1: 'Weekly, your reports write themselves.',
		subhead: 'Productivity compiled. Progress summarized. Sent to Slack. You did nothing.',
		keywords: [
			'weekly digest automation',
			'automatic weekly report',
			'productivity tracking automation',
		],
		ogImage: '/og/outcomes/weekly-automatically.png',
		workflows: ['weekly-productivity-digest', 'team-digest'],
		faq: [
			{
				question: 'How do I automate weekly productivity reports?',
				answer:
					"Install WORKWAY's Weekly Productivity Digest. It compiles tasks completed, time tracked, and goals met from Todoist, then posts a summary to Slack every Monday. $0.05/week.",
			},
		],
	},

	when_clients_onboard: {
		path: '/outcomes/when-clients-onboard',
		slug: 'when-clients-onboard',
		title: 'Client Onboarding Automation - Onboarding That Runs Itself | WORKWAY',
		description:
			'Automatically create onboarding tasks when clients pay. Todoist tasks, Slack notifications, welcome sequences triggered.',
		h1: 'When clients pay, onboarding starts itself.',
		subhead: 'Todoist tasks created. Team notified. Welcome email queued. You didn\'t lift a finger.',
		keywords: [
			'client onboarding automation',
			'automatic onboarding workflow',
			'stripe to todoist',
		],
		ogImage: '/og/outcomes/when-clients-onboard.png',
		workflows: ['client-onboarding', 'onboarding-automation'],
		faq: [
			{
				question: 'How do I automate client onboarding?',
				answer:
					"Install WORKWAY's Client Onboarding workflow. When a Stripe payment is received, it automatically creates a Todoist project with onboarding tasks, notifies your team in Slack, and logs the new client to Notion. $0.15/client.",
			},
		],
	},

	after_calls: {
		path: '/outcomes/after-calls',
		slug: 'after-calls',
		title: 'Meeting Follow-up Automation - Follow-ups That Create Themselves | WORKWAY',
		description:
			'Automatically create follow-up tasks after Calendly meetings. Tasks in Todoist, reminders scheduled, nothing forgotten.',
		h1: 'After calls, follow-ups create themselves.',
		subhead: 'Todoist tasks created. Reminders scheduled. Nothing falls through the cracks.',
		keywords: [
			'meeting followup automation',
			'calendly to todoist',
			'automatic meeting tasks',
		],
		ogImage: '/og/outcomes/after-calls.png',
		workflows: ['meeting-followup-engine'],
		faq: [
			{
				question: 'How do I automatically create tasks after meetings?',
				answer:
					"Install WORKWAY's Meeting Follow-up Engine. After every Calendly meeting, it creates Todoist tasks for follow-ups based on the meeting type. Sales call? Follow-up email task. Discovery call? Proposal task. $0.08/meeting.",
			},
		],
	},

	when_data_changes: {
		path: '/outcomes/when-data-changes',
		slug: 'when-data-changes',
		title: 'Data Sync Automation - Spreadsheets That Sync Themselves | WORKWAY',
		description:
			'Automatically sync Google Sheets to Airtable. Real-time data synchronization, no manual imports.',
		h1: 'When data changes, everything syncs.',
		subhead: 'Sheets updated. Airtable synced. You didn\'t export anything.',
		keywords: [
			'google sheets to airtable sync',
			'automatic data sync',
			'spreadsheet automation',
		],
		ogImage: '/og/outcomes/when-data-changes.png',
		workflows: ['spreadsheet-sync'],
		faq: [
			{
				question: 'How do I automatically sync Google Sheets to Airtable?',
				answer:
					"Install WORKWAY's Spreadsheet Sync workflow. Changes in your Google Sheet automatically update the corresponding Airtable base. Works both ways. $0.05/sync.",
			},
		],
	},

	after_publishing: {
		path: '/outcomes/after-publishing',
		slug: 'after-publishing',
		title: 'Portfolio Sync Automation - Creative Work That Announces Itself | WORKWAY',
		description:
			'Automatically sync Dribbble shots to Notion and announce new work in Slack. Your portfolio updates itself.',
		h1: 'After publishing, your portfolio updates itself.',
		subhead: 'Notion updated. Slack notified. You just shipped.',
		keywords: ['dribbble to notion', 'portfolio automation', 'design portfolio sync'],
		ogImage: '/og/outcomes/after-publishing.png',
		workflows: ['design-portfolio-sync'],
		faq: [
			{
				question: 'How do I automatically sync Dribbble to Notion?',
				answer:
					"Install WORKWAY's Design Portfolio Sync. Every new Dribbble shot automatically creates a Notion page with the image, description, and stats. Also posts to Slack if enabled. $0.05/shot.",
			},
		],
	},

	when_meetings_booked: {
		path: '/outcomes/when-meetings-booked',
		slug: 'when-meetings-booked',
		title: 'Meeting Booking Automation - Calendars That Log Themselves | WORKWAY',
		description:
			'Automatically log Calendly bookings to Notion and notify Slack. Meeting prep that happens automatically.',
		h1: 'When meetings are booked, everything prepares.',
		subhead: 'Notion page created. Team notified. Prep notes ready. You just showed up.',
		keywords: ['calendly to notion', 'meeting booking automation', 'calendly slack notifications'],
		ogImage: '/og/outcomes/when-meetings-booked.png',
		workflows: ['scheduling-autopilot'],
		faq: [
			{
				question: 'How do I automatically log Calendly meetings to Notion?',
				answer:
					"Install WORKWAY's Scheduling Autopilot. Every Calendly booking creates a Notion page with attendee info, meeting type, and notes section. Also sends a Slack notification. $0.05/booking.",
			},
		],
	},

	when_forms_submitted: {
		path: '/outcomes/when-forms-submitted',
		slug: 'when-forms-submitted',
		title: 'Form Response Automation - Responses That Organize Themselves | WORKWAY',
		description:
			'Automatically route Typeform responses to Notion or Airtable. No more manual data entry.',
		h1: 'When forms are submitted, responses organize themselves.',
		subhead: 'Notion database updated. Airtable row created. You didn\'t touch a spreadsheet.',
		keywords: ['typeform to notion', 'form to database automation', 'typeform airtable integration'],
		ogImage: '/og/outcomes/when-forms-submitted.png',
		workflows: ['form-response-hub'],
		faq: [
			{
				question: 'How do I automatically send Typeform responses to Notion?',
				answer:
					"Install WORKWAY's Form Response Hub. Every Typeform submission creates a Notion database entry with all fields mapped. Works with Airtable too. $0.05/response.",
			},
		],
	},

	when_deals_progress: {
		path: '/outcomes/when-deals-progress',
		slug: 'when-deals-progress',
		title: 'Deal Tracking Automation - Sales That Update Themselves | WORKWAY',
		description:
			'Automatically notify Slack when HubSpot deals progress. Celebrate wins, track pipeline, stay informed.',
		h1: 'When deals progress, everyone knows.',
		subhead: 'Slack notification sent. Notion updated. Team celebrated. You closed the deal.',
		keywords: ['hubspot to slack', 'deal notification automation', 'crm slack integration'],
		ogImage: '/og/outcomes/when-deals-progress.png',
		workflows: ['deal-tracker'],
		faq: [
			{
				question: 'How do I get HubSpot deal notifications in Slack?',
				answer:
					"Install WORKWAY's Deal Tracker. When a HubSpot deal moves stages, it posts to Slack with deal value and stage. Closed-won deals get celebrated. $0.05/update.",
			},
		],
	},

	when_tasks_complete: {
		path: '/outcomes/when-tasks-complete',
		slug: 'when-tasks-complete',
		title: 'Task Logging Automation - Completed Work That Documents Itself | WORKWAY',
		description:
			'Automatically log completed Todoist tasks to Notion. Build a productivity journal without effort.',
		h1: 'When tasks complete, history writes itself.',
		subhead: 'Notion page updated. Productivity logged. You just checked the box.',
		keywords: ['todoist to notion', 'task logging automation', 'productivity journal automation'],
		ogImage: '/og/outcomes/when-tasks-complete.png',
		workflows: ['task-sync-bridge'],
		faq: [
			{
				question: 'How do I automatically log Todoist tasks to Notion?',
				answer:
					"Install WORKWAY's Task Sync Bridge. Every completed Todoist task creates an entry in your Notion database with task name, project, and completion date. $0.02/task.",
			},
		],
	},

	when_tickets_arrive: {
		path: '/outcomes/when-tickets-arrive',
		slug: 'when-tickets-arrive',
		title: 'Support Ticket Routing - Tickets That Route Themselves | WORKWAY',
		description:
			'Automatically route Slack support messages to the right team. AI-powered classification, no manual triage.',
		h1: 'When tickets arrive, they find the right team.',
		subhead: 'AI classified. Routed to channel. Team notified. You didn\'t triage.',
		keywords: ['slack support automation', 'ticket routing automation', 'support ticket classification'],
		ogImage: '/og/outcomes/when-tickets-arrive.png',
		workflows: ['support-ticket-router'],
		faq: [
			{
				question: 'How do I automatically route support tickets in Slack?',
				answer:
					"Install WORKWAY's Support Ticket Router. Messages in your support channel are AI-classified and routed to the right team channel (billing, technical, sales). $0.05/ticket.",
			},
		],
	},
} as const;

// ============================================================================
// INTEGRATION PAIR PAGES
// ============================================================================

export const integrationPairPages = {
	'zoom:notion': {
		path: '/connect/zoom/notion',
		title: 'Zoom to Notion Integration — Automatic Meeting Notes | WORKWAY',
		description:
			'Connect Zoom to Notion in 90 seconds. Every meeting automatically creates a Notion page with transcript, AI summary, and action items. From $0.25/meeting (heavy tier).',
		h1: 'Zoom + Notion, connected.',
		subhead: 'Every meeting → Notion page. Transcript, summary, action items. You did nothing.',
		from: 'Zoom',
		to: 'Notion',
		workflowId: 'meeting-intelligence',
		price: 'From $0.25/meeting (heavy tier — AI + multiple APIs)',
		setupTime: '90 seconds',
		keywords: [
			'zoom notion integration',
			'connect zoom to notion',
			'zoom to notion automation',
			'zoom meeting notes notion',
			'sync zoom to notion',
		],
		whatHappens: [
			'Your Zoom meeting ends',
			'WORKWAY grabs the recording',
			'AI transcribes and summarizes',
			'Notion page created automatically',
		],
		notionPageIncludes: [
			'Full transcript',
			'AI-generated summary (3-5 sentences)',
			'Decisions made',
			'Action items extracted',
			'Follow-ups with dates',
			'Attendee list',
		],
		vsManual: {
			manual: 'Watch recording (45 min) + Write notes (15 min) = 60 min/meeting',
			workway: '0 min/meeting + from $0.25',
			weeklyComparison: {
				meetings: 10,
				manualHours: 10,
				workwayHours: 0,
				workwayCost: 2.5, // 10 × $0.25 minimum
			},
		},
	},

	'zoom:slack': {
		path: '/connect/zoom/slack',
		title: 'Zoom to Slack Integration - Meeting Summaries in Slack | WORKWAY',
		description:
			'Automatically post Zoom meeting summaries to Slack. AI-generated highlights within 60 seconds of meeting end. $0.08/meeting.',
		h1: 'Zoom + Slack, connected.',
		subhead: 'Meeting ends → Slack summary appears. Key points, decisions, action items.',
		from: 'Zoom',
		to: 'Slack',
		workflowId: 'meeting-summarizer',
		price: '$0.08/meeting',
		setupTime: '60 seconds',
		keywords: [
			'zoom slack integration',
			'zoom meeting summary slack',
			'post zoom summary to slack',
			'zoom to slack automation',
		],
	},

	'stripe:notion': {
		path: '/connect/stripe/notion',
		title: 'Stripe to Notion Integration - Payments That Log Themselves | WORKWAY',
		description:
			'Automatically log Stripe payments to Notion. Real-time revenue tracking in your workspace. $0.10/payment.',
		h1: 'Stripe + Notion, connected.',
		subhead: 'Payment received → Notion row created. Amount, customer, date, status.',
		from: 'Stripe',
		to: 'Notion',
		workflowId: 'stripe-to-notion',
		price: '$0.10/payment',
		setupTime: '90 seconds',
		keywords: [
			'stripe notion integration',
			'log stripe payments notion',
			'stripe to notion automation',
			'track stripe in notion',
		],
	},

	'stripe:slack': {
		path: '/connect/stripe/slack',
		title: 'Stripe to Slack Integration - Payment Alerts in Slack | WORKWAY',
		description:
			'Get instant Slack notifications when Stripe payments arrive. Customer name, amount, product. $0.10/payment.',
		h1: 'Stripe + Slack, connected.',
		subhead: 'Payment arrives → Slack notification. Customer, amount, product. Celebrate in real-time.',
		from: 'Stripe',
		to: 'Slack',
		workflowId: 'revenue-radar',
		price: '$0.10/payment',
		setupTime: '60 seconds',
		keywords: [
			'stripe slack integration',
			'stripe payment notifications slack',
			'stripe to slack automation',
		],
	},

	'calendly:notion': {
		path: '/connect/calendly/notion',
		title: 'Calendly to Notion Integration - Meetings That Log Themselves | WORKWAY',
		description:
			'Automatically log Calendly bookings to Notion. Attendee info, meeting type, notes section ready. $0.05/booking.',
		h1: 'Calendly + Notion, connected.',
		subhead: 'Meeting booked → Notion page created. Attendee, type, notes section ready.',
		from: 'Calendly',
		to: 'Notion',
		workflowId: 'scheduling-autopilot',
		price: '$0.05/booking',
		setupTime: '60 seconds',
		keywords: [
			'calendly notion integration',
			'calendly to notion automation',
			'log calendly meetings notion',
		],
	},

	'calendly:slack': {
		path: '/connect/calendly/slack',
		title: 'Calendly to Slack Integration - Booking Notifications in Slack | WORKWAY',
		description:
			'Get instant Slack notifications when Calendly meetings are booked. Attendee, time, meeting type. $0.05/booking.',
		h1: 'Calendly + Slack, connected.',
		subhead: 'Meeting booked → Slack notification. Attendee, time, type.',
		from: 'Calendly',
		to: 'Slack',
		workflowId: 'scheduling-autopilot',
		price: '$0.05/booking',
		setupTime: '60 seconds',
		keywords: [
			'calendly slack integration',
			'calendly booking notifications slack',
			'calendly to slack automation',
		],
	},

	'calendly:todoist': {
		path: '/connect/calendly/todoist',
		title: 'Calendly to Todoist Integration - Meetings That Create Follow-ups | WORKWAY',
		description:
			'Automatically create Todoist tasks after Calendly meetings. Follow-up reminders, prep tasks, nothing forgotten. $0.08/meeting.',
		h1: 'Calendly + Todoist, connected.',
		subhead: 'Meeting happens → Follow-up tasks created. Nothing falls through the cracks.',
		from: 'Calendly',
		to: 'Todoist',
		workflowId: 'meeting-followup-engine',
		price: '$0.08/meeting',
		setupTime: '90 seconds',
		keywords: [
			'calendly todoist integration',
			'calendly to todoist automation',
			'meeting followup tasks',
		],
	},

	'hubspot:slack': {
		path: '/connect/hubspot/slack',
		title: 'HubSpot to Slack Integration - Deal Alerts in Slack | WORKWAY',
		description:
			'Get instant Slack notifications when HubSpot deals progress. Stage changes, closed-won celebrations, pipeline visibility. $0.05/update.',
		h1: 'HubSpot + Slack, connected.',
		subhead: 'Deal moves → Slack notification. Stage, value, rep. Celebrate wins together.',
		from: 'HubSpot',
		to: 'Slack',
		workflowId: 'deal-tracker',
		price: '$0.05/update',
		setupTime: '60 seconds',
		keywords: [
			'hubspot slack integration',
			'hubspot deal notifications slack',
			'hubspot to slack automation',
		],
	},

	'hubspot:notion': {
		path: '/connect/hubspot/notion',
		title: 'HubSpot to Notion Integration - Deals That Document Themselves | WORKWAY',
		description:
			'Automatically log HubSpot deal activity to Notion. Pipeline history, deal notes, stage progression. $0.05/update.',
		h1: 'HubSpot + Notion, connected.',
		subhead: 'Deal progresses → Notion updated. Full pipeline history in your workspace.',
		from: 'HubSpot',
		to: 'Notion',
		workflowId: 'deal-tracker',
		price: '$0.05/update',
		setupTime: '90 seconds',
		keywords: [
			'hubspot notion integration',
			'hubspot to notion automation',
			'sync hubspot deals notion',
		],
	},

	'typeform:hubspot': {
		path: '/connect/typeform/hubspot',
		title: 'Typeform to HubSpot Integration - Leads That Route Themselves | WORKWAY',
		description:
			'Automatically create HubSpot contacts from Typeform submissions. AI lead scoring, field mapping, instant routing. $0.08/lead.',
		h1: 'Typeform + HubSpot, connected.',
		subhead: 'Form submitted → HubSpot contact created. Fields mapped, lead scored, team notified.',
		from: 'Typeform',
		to: 'HubSpot',
		workflowId: 'sales-lead-pipeline',
		price: '$0.08/lead',
		setupTime: '90 seconds',
		keywords: [
			'typeform hubspot integration',
			'typeform to hubspot automation',
			'form to crm automation',
		],
	},

	'typeform:notion': {
		path: '/connect/typeform/notion',
		title: 'Typeform to Notion Integration - Responses That Organize Themselves | WORKWAY',
		description:
			'Automatically log Typeform responses to Notion databases. All fields mapped, no manual entry. $0.05/response.',
		h1: 'Typeform + Notion, connected.',
		subhead: 'Form submitted → Notion row created. All fields mapped. Zero data entry.',
		from: 'Typeform',
		to: 'Notion',
		workflowId: 'form-response-hub',
		price: '$0.05/response',
		setupTime: '60 seconds',
		keywords: [
			'typeform notion integration',
			'typeform to notion automation',
			'form responses to notion',
		],
	},

	'typeform:airtable': {
		path: '/connect/typeform/airtable',
		title: 'Typeform to Airtable Integration - Forms That Fill Databases | WORKWAY',
		description:
			'Automatically sync Typeform responses to Airtable. Fields mapped, records created, no CSV exports. $0.05/response.',
		h1: 'Typeform + Airtable, connected.',
		subhead: 'Form submitted → Airtable record created. Fields mapped automatically.',
		from: 'Typeform',
		to: 'Airtable',
		workflowId: 'form-response-hub',
		price: '$0.05/response',
		setupTime: '60 seconds',
		keywords: [
			'typeform airtable integration',
			'typeform to airtable automation',
			'sync typeform airtable',
		],
	},

	'linear:slack': {
		path: '/connect/linear/slack',
		title: 'Linear to Slack Integration - Sprint Updates in Slack | WORKWAY',
		description:
			'Automatic daily sprint progress in Slack. Issues completed, blockers flagged, velocity tracked. $0.05/day.',
		h1: 'Linear + Slack, connected.',
		subhead: 'Every morning → Sprint progress in Slack. Completed, in-progress, blocked.',
		from: 'Linear',
		to: 'Slack',
		workflowId: 'sprint-progress-tracker',
		price: '$0.05/day',
		setupTime: '60 seconds',
		keywords: ['linear slack integration', 'linear to slack automation', 'sprint updates slack'],
	},

	'linear:notion': {
		path: '/connect/linear/notion',
		title: 'Linear to Notion Integration - Sprints That Document Themselves | WORKWAY',
		description:
			'Automatically log Linear sprint history to Notion. Velocity trends, completed issues, retrospective data. $0.05/sync.',
		h1: 'Linear + Notion, connected.',
		subhead: 'Sprint ends → Notion updated. History, velocity, issues logged.',
		from: 'Linear',
		to: 'Notion',
		workflowId: 'sprint-progress-tracker',
		price: '$0.05/sync',
		setupTime: '90 seconds',
		keywords: [
			'linear notion integration',
			'linear to notion automation',
			'sync linear sprints notion',
		],
	},

	'todoist:slack': {
		path: '/connect/todoist/slack',
		title: 'Todoist to Slack Integration - Productivity Insights in Slack | WORKWAY',
		description:
			'Weekly productivity digest from Todoist to Slack. Tasks completed, goals met, streaks maintained. $0.05/week.',
		h1: 'Todoist + Slack, connected.',
		subhead: 'Every Monday → Productivity digest in Slack. Tasks done, goals met.',
		from: 'Todoist',
		to: 'Slack',
		workflowId: 'weekly-productivity-digest',
		price: '$0.05/week',
		setupTime: '60 seconds',
		keywords: [
			'todoist slack integration',
			'todoist to slack automation',
			'productivity digest slack',
		],
	},

	'todoist:notion': {
		path: '/connect/todoist/notion',
		title: 'Todoist to Notion Integration - Tasks That Log Themselves | WORKWAY',
		description:
			'Automatically log completed Todoist tasks to Notion. Build a productivity journal effortlessly. $0.02/task.',
		h1: 'Todoist + Notion, connected.',
		subhead: 'Task completed → Notion entry created. Automatic productivity journal.',
		from: 'Todoist',
		to: 'Notion',
		workflowId: 'task-sync-bridge',
		price: '$0.02/task',
		setupTime: '60 seconds',
		keywords: [
			'todoist notion integration',
			'todoist to notion automation',
			'sync todoist tasks notion',
		],
	},

	'airtable:slack': {
		path: '/connect/airtable/slack',
		title: 'Airtable to Slack Integration - Content Reminders in Slack | WORKWAY',
		description:
			'Daily content calendar reminders from Airtable to Slack. Never miss a publishing deadline. $0.05/day.',
		h1: 'Airtable + Slack, connected.',
		subhead: 'Every morning → Content reminders in Slack. What\'s due today, what\'s coming up.',
		from: 'Airtable',
		to: 'Slack',
		workflowId: 'content-calendar',
		price: '$0.05/day',
		setupTime: '60 seconds',
		keywords: [
			'airtable slack integration',
			'airtable to slack automation',
			'content calendar slack',
		],
	},

	'dribbble:notion': {
		path: '/connect/dribbble/notion',
		title: 'Dribbble to Notion Integration - Portfolio That Updates Itself | WORKWAY',
		description:
			'Automatically sync Dribbble shots to Notion. Image, description, stats. Your portfolio manages itself. $0.05/shot.',
		h1: 'Dribbble + Notion, connected.',
		subhead: 'New shot published → Notion page created. Image, description, stats synced.',
		from: 'Dribbble',
		to: 'Notion',
		workflowId: 'design-portfolio-sync',
		price: '$0.05/shot',
		setupTime: '60 seconds',
		keywords: ['dribbble notion integration', 'dribbble to notion automation', 'portfolio sync notion'],
	},

	'dribbble:slack': {
		path: '/connect/dribbble/slack',
		title: 'Dribbble to Slack Integration - New Work Announced in Slack | WORKWAY',
		description:
			'Automatically share new Dribbble shots to Slack. Team celebrates, feedback flows. $0.05/shot.',
		h1: 'Dribbble + Slack, connected.',
		subhead: 'New shot published → Slack notification. Team sees, feedback flows.',
		from: 'Dribbble',
		to: 'Slack',
		workflowId: 'design-portfolio-sync',
		price: '$0.05/shot',
		setupTime: '60 seconds',
		keywords: ['dribbble slack integration', 'dribbble to slack automation', 'share dribbble slack'],
	},

	'notion:slack': {
		path: '/connect/notion/slack',
		title: 'Notion to Slack Integration - Team Digest in Slack | WORKWAY',
		description:
			'Daily team activity digest from Notion to Slack. Who updated what, decisions made, docs changed. $0.05/day.',
		h1: 'Notion + Slack, connected.',
		subhead: 'Every morning → Team digest in Slack. Updates, changes, activity summarized.',
		from: 'Notion',
		to: 'Slack',
		workflowId: 'team-digest',
		price: '$0.05/day',
		setupTime: '60 seconds',
		keywords: ['notion slack integration', 'notion to slack automation', 'team digest slack'],
	},

	'notion:stripe': {
		path: '/connect/notion/stripe',
		title: 'Notion to Stripe Integration - Projects That Invoice Themselves | WORKWAY',
		description:
			'Automatically generate Stripe invoices from Notion projects. Project complete → Invoice sent. $0.15/invoice.',
		h1: 'Notion + Stripe, connected.',
		subhead: 'Project marked complete → Stripe invoice generated. Client billed automatically.',
		from: 'Notion',
		to: 'Stripe',
		workflowId: 'invoice-generator',
		price: '$0.15/invoice',
		setupTime: '90 seconds',
		keywords: [
			'notion stripe integration',
			'notion to stripe automation',
			'automatic invoicing notion',
		],
	},

	'google-sheets:airtable': {
		path: '/connect/google-sheets/airtable',
		title: 'Google Sheets to Airtable Integration - Spreadsheets That Sync | WORKWAY',
		description:
			'Automatically sync Google Sheets to Airtable. Changes flow both ways, no manual imports. $0.05/sync.',
		h1: 'Google Sheets + Airtable, connected.',
		subhead: 'Sheet updated → Airtable synced. Two-way sync, zero manual work.',
		from: 'Google Sheets',
		to: 'Airtable',
		workflowId: 'spreadsheet-sync',
		price: '$0.05/sync',
		setupTime: '90 seconds',
		keywords: [
			'google sheets airtable integration',
			'sheets to airtable automation',
			'sync google sheets airtable',
		],
	},

	'stripe:todoist': {
		path: '/connect/stripe/todoist',
		title: 'Stripe to Todoist Integration - Payments That Create Tasks | WORKWAY',
		description:
			'Automatically create Todoist onboarding tasks when Stripe payments arrive. Client onboarding on autopilot. $0.15/client.',
		h1: 'Stripe + Todoist, connected.',
		subhead: 'Payment received → Onboarding tasks created. Client journey starts itself.',
		from: 'Stripe',
		to: 'Todoist',
		workflowId: 'client-onboarding',
		price: '$0.15/client',
		setupTime: '90 seconds',
		keywords: [
			'stripe todoist integration',
			'stripe to todoist automation',
			'payment triggered tasks',
		],
	},

	'stripe:hubspot': {
		path: '/connect/stripe/hubspot',
		title: 'Stripe to HubSpot Integration - Deals That Close Themselves | WORKWAY',
		description:
			'Automatically update HubSpot deals when Stripe payments arrive. Deal closed-won, revenue logged. $0.10/payment.',
		h1: 'Stripe + HubSpot, connected.',
		subhead: 'Payment received → HubSpot deal closed. Revenue logged automatically.',
		from: 'Stripe',
		to: 'HubSpot',
		workflowId: 'revenue-radar',
		price: '$0.10/payment',
		setupTime: '90 seconds',
		keywords: [
			'stripe hubspot integration',
			'stripe to hubspot automation',
			'close hubspot deals automatically',
		],
	},

	'slack:slack': {
		path: '/connect/slack/routing',
		title: 'Slack Ticket Routing - Support That Routes Itself | WORKWAY',
		description:
			'AI-powered ticket routing within Slack. Messages classified and routed to the right team channel. $0.05/ticket.',
		h1: 'Slack support, routed automatically.',
		subhead: 'Message received → AI classified → Routed to right team. Zero manual triage.',
		from: 'Slack',
		to: 'Slack',
		workflowId: 'support-ticket-router',
		price: '$0.05/ticket',
		setupTime: '60 seconds',
		keywords: [
			'slack ticket routing',
			'slack support automation',
			'ai ticket classification slack',
		],
	},
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export type OutcomeFrameId = keyof typeof outcomeFramePages;
export type IntegrationPairId = keyof typeof integrationPairPages;
export type CorePageId = keyof typeof corePages;

/**
 * Get SEO data for any page
 */
export function getPageSEO(
	pageType: 'core' | 'outcome' | 'integration',
	pageId: string
): {
	title: string;
	description: string;
	keywords: readonly string[];
	ogImage: string;
	path: string;
} | null {
	if (pageType === 'core' && pageId in corePages) {
		const page = corePages[pageId as CorePageId];
		return {
			title: page.title,
			description: page.description,
			keywords: page.keywords,
			ogImage: page.ogImage,
			path: page.path,
		};
	}

	if (pageType === 'outcome' && pageId in outcomeFramePages) {
		const page = outcomeFramePages[pageId as OutcomeFrameId];
		return {
			title: page.title,
			description: page.description,
			keywords: page.keywords,
			ogImage: page.ogImage,
			path: page.path,
		};
	}

	if (pageType === 'integration' && pageId in integrationPairPages) {
		const page = integrationPairPages[pageId as IntegrationPairId];
		return {
			title: page.title,
			description: page.description,
			keywords: page.keywords,
			ogImage: `/og/connect/${pageId.replace(':', '-')}.png`,
			path: page.path,
		};
	}

	return null;
}

/**
 * Generate FAQ schema markup
 */
export function generateFAQSchema(
	faqs: Array<{ question: string; answer: string }>
): object {
	return {
		'@context': 'https://schema.org',
		'@type': 'FAQPage',
		mainEntity: faqs.map((faq) => ({
			'@type': 'Question',
			name: faq.question,
			acceptedAnswer: {
				'@type': 'Answer',
				text: faq.answer,
			},
		})),
	};
}

/**
 * Generate HowTo schema for integration pair pages
 */
export function generateHowToSchema(
	integrationPair: IntegrationPairId
): object | null {
	const page = integrationPairPages[integrationPair];
	if (!page) return null;

	return {
		'@context': 'https://schema.org',
		'@type': 'HowTo',
		name: `How to Connect ${page.from} to ${page.to}`,
		description: page.description,
		totalTime: 'PT2M',
		estimatedCost: {
			'@type': 'MonetaryAmount',
			currency: 'USD',
			value: page.price.replace(/[^0-9.]/g, ''),
		},
		step: [
			{
				'@type': 'HowToStep',
				name: `Connect ${page.from}`,
				text: `Click 'Connect ${page.from}' and authorize WORKWAY via OAuth.`,
			},
			{
				'@type': 'HowToStep',
				name: `Connect ${page.to}`,
				text: `Click 'Connect ${page.to}' and authorize access.`,
			},
			{
				'@type': 'HowToStep',
				name: 'Configure',
				text: 'Select your destination database or channel.',
			},
			{
				'@type': 'HowToStep',
				name: 'Done',
				text: `Your ${page.from} events will now automatically update ${page.to}.`,
			},
		],
	};
}

/**
 * Get all keywords for sitemap/indexing
 */
export function getAllKeywords(): string[] {
	const keywords = new Set<string>();

	Object.values(corePages).forEach((page) => {
		page.keywords.forEach((kw) => keywords.add(kw));
	});

	Object.values(outcomeFramePages).forEach((page) => {
		page.keywords.forEach((kw) => keywords.add(kw));
	});

	Object.values(integrationPairPages).forEach((page) => {
		page.keywords.forEach((kw) => keywords.add(kw));
	});

	return Array.from(keywords).sort();
}

/**
 * Get all paths for sitemap generation
 */
export function getAllPaths(): Array<{ path: string; priority: number }> {
	const paths: Array<{ path: string; priority: number }> = [];

	// Core pages
	Object.values(corePages).forEach((page) => {
		paths.push({
			path: page.path,
			priority: page.path === '/' ? 1.0 : 0.8,
		});
	});

	// Outcome frame pages
	Object.values(outcomeFramePages).forEach((page) => {
		paths.push({
			path: page.path,
			priority: 0.9,
		});
	});

	// Integration pair pages
	Object.values(integrationPairPages).forEach((page) => {
		paths.push({
			path: page.path,
			priority: 0.85,
		});
	});

	return paths;
}
