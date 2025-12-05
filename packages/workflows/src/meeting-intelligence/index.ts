/**
 * Meeting Intelligence Workflow
 *
 * Full compound workflow for Zoom meeting follow-up automation.
 * Syncs meetings and clips to Notion with transcripts, extracts action items,
 * and posts summaries to Slack.
 *
 * ZUHANDENHEIT: The tool recedes, the outcome remains.
 * User thinks: "My meetings are documented and follow-up is automatic"
 *
 * Integrations: Zoom, Notion, Slack, HubSpot (optional)
 * Trigger: Daily cron (7 AM) OR Zoom webhook (recording.completed)
 */

import { defineWorkflow, cron, webhook } from '@workwayco/sdk';
import { AIModels } from '@workwayco/sdk';

// Schema for AI meeting analysis
const MeetingAnalysisSchema = {
	summary: 'string',
	decisions: 'string[]',
	actionItems: 'Array<{ task: string; assignee?: string; dueDate?: string }>',
	followUps: 'string[]',
	keyTopics: 'string[]',
	sentiment: "'positive' | 'neutral' | 'concerned'",
} as const;

export default defineWorkflow({
	name: 'Meeting Intelligence',
	description: 'Sync Zoom meetings to Notion with transcripts, action items, and Slack summaries',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	// See: docs/OUTCOME_TAXONOMY.md
	pathway: {
		outcomeFrame: 'after_meetings',

		outcomeStatement: {
			suggestion: 'Want meeting notes in Notion automatically?',
			explanation: 'After Zoom meetings, we\'ll create a Notion page with transcript, action items, and AI summary.',
			outcome: 'Meeting notes in Notion',
		},

		primaryPair: {
			from: 'zoom',
			to: 'notion',
			workflowId: 'meeting-intelligence',
			outcome: 'Zoom meetings that write their own notes',
		},

		additionalPairs: [
			{ from: 'zoom', to: 'slack', workflowId: 'meeting-intelligence', outcome: 'Meeting summaries in Slack' },
		],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['zoom', 'notion'],
				workflowId: 'meeting-intelligence',
				priority: 100,
			},
			{
				trigger: 'event_received',
				eventType: 'zoom.recording.completed',
				integrations: ['zoom', 'notion'],
				workflowId: 'meeting-intelligence',
				priority: 100,
			},
		],

		// Smart defaults - infer from context, don't ask
		smartDefaults: {
			syncMode: { value: 'both' },
			lookbackDays: { value: 1 },
			transcriptMode: { value: 'prefer_speakers' },
			enableAI: { value: true },
			analysisDepth: { value: 'standard' },
			postToSlack: { value: true },
			updateCRM: { value: false },
		},

		// Only these 1-2 fields are required for first activation
		essentialFields: ['notionDatabaseId'],

		zuhandenheit: {
			timeToValue: 3, // Minutes to first outcome
			worksOutOfBox: true, // Works with just essential fields
			gracefulDegradation: true, // Optional integrations handled gracefully
			automaticTrigger: true, // Webhook-triggered, no manual invocation
		},
	},

	pricing: {
		model: 'usage',
		pricePerExecution: 0.25, // Heavy tier: AI + multiple APIs
		freeExecutions: 20,
		description: 'Per meeting synced (includes transcription + AI analysis)',
	},

	integrations: [
		{ service: 'zoom', scopes: ['meeting:read', 'recording:read', 'clip:read'] },
		{ service: 'notion', scopes: ['read_pages', 'write_pages', 'read_databases'] },
		{ service: 'slack', scopes: ['send_messages', 'read_channels'] },
		{ service: 'hubspot', scopes: ['crm.objects.deals.read', 'crm.objects.deals.write', 'crm.objects.contacts.read'], optional: true },
	],

	inputs: {
		// Core configuration
		notionDatabaseId: {
			type: 'notion_database_picker',
			label: 'Meeting Notes Database',
			required: true,
			description: 'Where to store meeting notes',
		},
		slackChannel: {
			type: 'slack_channel_picker',
			label: 'Meeting Summaries Channel',
			required: true,
			description: 'Where to post meeting summaries',
		},

		// Sync settings
		syncMode: {
			type: 'select',
			label: 'What to Sync',
			options: ['meetings_only', 'clips_only', 'both'],
			default: 'both',
			description: 'Sync meetings, clips, or both',
		},
		lookbackDays: {
			type: 'number',
			label: 'Days to Look Back',
			default: 1,
			description: 'How many days of meetings to sync (for daily cron)',
		},

		// Transcript settings
		transcriptMode: {
			type: 'select',
			label: 'Transcript Extraction',
			options: ['oauth_only', 'prefer_speakers', 'always_browser'],
			default: 'prefer_speakers',
			description: 'oauth_only: Fast but may lack speaker names. prefer_speakers: Falls back to browser scraper for speaker attribution.',
		},
		browserScraperUrl: {
			type: 'text',
			label: 'Browser Scraper URL',
			default: 'https://zoom-scraper.half-dozen.workers.dev',
			description: 'Cloudflare Worker URL for transcript scraping (required for speaker attribution)',
		},

		// AI settings
		enableAI: {
			type: 'boolean',
			label: 'AI Analysis',
			default: true,
			description: 'Extract action items, decisions, and key topics',
		},
		analysisDepth: {
			type: 'select',
			label: 'Analysis Depth',
			options: ['brief', 'standard', 'detailed'],
			default: 'standard',
		},

		// Notification settings
		postToSlack: {
			type: 'boolean',
			label: 'Post Slack Summary',
			default: true,
		},
		// CRM settings
		updateCRM: {
			type: 'boolean',
			label: 'Update CRM (HubSpot)',
			default: false,
			description: 'Log meeting activity and update deals in HubSpot',
		},
		crmDealSearchEnabled: {
			type: 'boolean',
			label: 'Auto-find Deals',
			default: true,
			description: 'Search HubSpot for deals matching attendee companies',
		},
		crmLogMeetingActivity: {
			type: 'boolean',
			label: 'Log Meeting in CRM',
			default: true,
			description: 'Create a meeting activity record in HubSpot',
		},
		crmUpdateDealNotes: {
			type: 'boolean',
			label: 'Update Deal Notes',
			default: true,
			description: 'Append meeting summary to deal description',
		},
	},

	// Support both cron and webhook triggers
	trigger: cron({
		schedule: '0 7 * * *', // 7 AM UTC daily
		timezone: 'UTC',
	}),

	// Alternative webhook trigger
	webhooks: [
		webhook({
			service: 'zoom',
			event: 'recording.completed',
		}),
	],

	async execute({ trigger, inputs, integrations, env }) {
		const results: Array<{
			meeting: { id: string; topic: string; date: string };
			notionPageUrl?: string;
			slackPosted: boolean;
			crmUpdated: boolean;
			actionItemCount: number;
		}> = [];

		// Determine if this is a webhook trigger (single meeting) or cron (batch)
		const isWebhookTrigger = trigger.type === 'webhook';

		if (isWebhookTrigger) {
			// Single meeting from webhook
			const recording = trigger.data;
			const meetingResult = await processMeeting({
				meetingId: recording.meeting_id || recording.id,
				topic: recording.topic,
				startTime: recording.start_time,
				shareUrl: recording.share_url,
				inputs,
				integrations,
				env,
			});
			results.push(meetingResult);
		} else {
			// Batch sync from cron
			const syncMeetings = inputs.syncMode !== 'clips_only';
			const syncClips = inputs.syncMode !== 'meetings_only';

			// Fetch meetings
			if (syncMeetings) {
				const meetingsResult = await integrations.zoom.getMeetings({
					days: inputs.lookbackDays || 1,
					type: 'previous_meetings',
				});

				if (meetingsResult.success) {
					for (const meeting of meetingsResult.data) {
						// Check if already synced (deduplication by meeting ID)
						const existingPage = await checkExistingPage(
							integrations.notion,
							inputs.notionDatabaseId,
							String(meeting.id)
						);

						if (existingPage) {
							continue; // Skip already synced meetings
						}

						const meetingResult = await processMeeting({
							meetingId: String(meeting.id),
							topic: meeting.topic,
							startTime: meeting.start_time,
							shareUrl: meeting.join_url,
							inputs,
							integrations,
							env,
						});
						results.push(meetingResult);
					}
				}
			}

			// Fetch clips
			if (syncClips) {
				const clipsResult = await integrations.zoom.getClips({
					days: inputs.lookbackDays || 1,
				});

				if (clipsResult.success) {
					for (const clip of clipsResult.data) {
						// Check if already synced
						const existingPage = await checkExistingPage(
							integrations.notion,
							inputs.notionDatabaseId,
							clip.id
						);

						if (existingPage) {
							continue;
						}

						const clipResult = await processClip({
							clipId: clip.id,
							title: clip.title,
							createdAt: clip.created_at,
							shareUrl: clip.share_url,
							inputs,
							integrations,
							env,
						});
						results.push(clipResult);
					}
				}
			}
		}

		// Summary
		const totalSynced = results.length;
		const totalActionItems = results.reduce((sum, r) => sum + r.actionItemCount, 0);
		const totalCRMUpdated = results.filter((r) => r.crmUpdated).length;

		return {
			success: true,
			synced: totalSynced,
			actionItems: totalActionItems,
			crmUpdated: totalCRMUpdated,
			results,
		};
	},

	onError: async ({ error, inputs, integrations }) => {
		if (inputs.slackChannel && integrations.slack) {
			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: `Meeting Intelligence sync failed: ${error.message}`,
			});
		}
	},
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

interface ProcessMeetingParams {
	meetingId: string;
	topic: string;
	startTime: string;
	shareUrl?: string;
	inputs: any;
	integrations: any;
	env: any;
}

async function processMeeting(params: ProcessMeetingParams) {
	const { meetingId, topic, startTime, shareUrl, inputs, integrations, env } = params;

	let transcript: string | null = null;
	let speakers: string[] = [];

	// 1. Get transcript
	const fallbackToBrowser = inputs.transcriptMode !== 'oauth_only';
	const transcriptResult = await integrations.zoom.getTranscript({
		meetingId,
		fallbackToBrowser,
		shareUrl,
	});

	if (transcriptResult.success && transcriptResult.data) {
		transcript = transcriptResult.data.transcript_text;
		speakers = transcriptResult.data.speakers || [];
	}

	// 2. AI Analysis (if enabled and we have transcript)
	let analysis: {
		summary: string;
		decisions: string[];
		actionItems: Array<{ task: string; assignee?: string }>;
		followUps: string[];
		keyTopics: string[];
		sentiment: string;
	} | null = null;

	if (inputs.enableAI && transcript && transcript.length > 100) {
		analysis = await analyzeMeeting(transcript, topic, inputs.analysisDepth, integrations, env);
	}

	// 3. Create Notion page
	const notionPage = await createNotionMeetingPage({
		databaseId: inputs.notionDatabaseId,
		topic,
		startTime,
		transcript,
		speakers,
		analysis,
		sourceId: meetingId,
		sourceType: 'meeting',
		sourceUrl: shareUrl,
		integrations,
	});

	// 4. Post to Slack (if enabled)
	let slackPosted = false;
	if (inputs.postToSlack && inputs.slackChannel) {
		slackPosted = await postSlackSummary({
			channel: inputs.slackChannel,
			topic,
			summary: analysis?.summary || 'Meeting synced (no AI summary)',
			actionItems: analysis?.actionItems || [],
			notionUrl: notionPage?.url,
			integrations,
		});
	}

	// 5. Update CRM (HubSpot - if enabled)
	let crmUpdated = false;
	if (inputs.updateCRM && integrations.hubspot) {
		crmUpdated = await updateCRM({
			topic,
			summary: analysis?.summary,
			actionItems: analysis?.actionItems || [],
			speakers,
			notionUrl: notionPage?.url,
			inputs,
			integrations,
		});
	}

	return {
		meeting: { id: meetingId, topic, date: startTime },
		notionPageUrl: notionPage?.url,
		slackPosted,
		crmUpdated,
		actionItemCount: analysis?.actionItems?.length || 0,
	};
}

interface ProcessClipParams {
	clipId: string;
	title: string;
	createdAt: string;
	shareUrl?: string;
	inputs: any;
	integrations: any;
	env: any;
}

async function processClip(params: ProcessClipParams) {
	const { clipId, title, createdAt, shareUrl, inputs, integrations, env } = params;

	let transcript: string | null = null;

	// 1. Get transcript (clips require browser scraper)
	if (shareUrl && inputs.browserScraperUrl) {
		const transcriptResult = await integrations.zoom.getClipTranscript({
			shareUrl,
		});

		if (transcriptResult.success && transcriptResult.data) {
			transcript = transcriptResult.data.transcript_text;
		}
	}

	// 2. AI Analysis (if enabled)
	let analysis: any = null;
	if (inputs.enableAI && transcript && transcript.length > 50) {
		analysis = await analyzeMeeting(transcript, title, inputs.analysisDepth, integrations, env);
	}

	// 3. Create Notion page
	const notionPage = await createNotionMeetingPage({
		databaseId: inputs.notionDatabaseId,
		topic: title,
		startTime: createdAt,
		transcript,
		speakers: [],
		analysis,
		sourceId: clipId,
		sourceType: 'clip',
		sourceUrl: shareUrl,
		integrations,
	});

	// 4. Post to Slack (if enabled)
	let slackPosted = false;
	if (inputs.postToSlack && inputs.slackChannel) {
		slackPosted = await postSlackSummary({
			channel: inputs.slackChannel,
			topic: title,
			summary: analysis?.summary || 'Clip synced (no AI summary)',
			actionItems: analysis?.actionItems || [],
			notionUrl: notionPage?.url,
			integrations,
		});
	}

	return {
		meeting: { id: clipId, topic: title, date: createdAt },
		notionPageUrl: notionPage?.url,
		slackPosted,
		crmUpdated: false, // Clips typically don't need CRM updates
		actionItemCount: analysis?.actionItems?.length || 0,
	};
}

async function analyzeMeeting(
	transcript: string,
	topic: string,
	depth: string,
	integrations: any,
	env: any
) {
	const depthInstructions: Record<string, string> = {
		brief: 'Keep summary to 2-3 sentences. List only the most critical items.',
		standard: 'Provide thorough summary in 4-6 sentences. Include all notable items.',
		detailed: 'Comprehensive analysis with full context. Include all items discussed.',
	};

	try {
		const result = await integrations.ai.generateText({
			model: AIModels.LLAMA_3_8B,
			system: `You are a meeting analyst. Analyze the transcript and extract structured insights.

${depthInstructions[depth] || depthInstructions.standard}

Return ONLY valid JSON in this format:
{
  "summary": "Brief summary of the meeting",
  "decisions": ["Decision 1", "Decision 2"],
  "actionItems": [
    {"task": "Task description", "assignee": "Person name or null"},
    {"task": "Another task", "assignee": null}
  ],
  "followUps": ["Follow-up item 1", "Follow-up item 2"],
  "keyTopics": ["Topic 1", "Topic 2"],
  "sentiment": "positive" | "neutral" | "concerned"
}`,
			prompt: `Meeting: ${topic}\n\nTranscript:\n${transcript.slice(0, 8000)}`,
			temperature: 0.3,
			max_tokens: 1000,
		});

		const responseText = result.data?.response || '{}';

		// Parse JSON from response
		const jsonMatch = responseText.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			return JSON.parse(jsonMatch[0]);
		}

		return null;
	} catch (error) {
		console.error('AI analysis failed:', error);
		return null;
	}
}

async function checkExistingPage(
	notion: any,
	databaseId: string,
	sourceId: string
): Promise<boolean> {
	try {
		const result = await notion.databases.query({
			database_id: databaseId,
			filter: {
				property: 'Source ID',
				rich_text: { equals: sourceId },
			},
			page_size: 1,
		});

		return result.success && result.data?.length > 0;
	} catch {
		return false;
	}
}

interface CreateNotionPageParams {
	databaseId: string;
	topic: string;
	startTime: string;
	transcript: string | null;
	speakers: string[];
	analysis: any;
	sourceId: string;
	sourceType: 'meeting' | 'clip';
	sourceUrl?: string;
	integrations: any;
}

async function createNotionMeetingPage(params: CreateNotionPageParams) {
	const {
		databaseId,
		topic,
		startTime,
		transcript,
		speakers,
		analysis,
		sourceId,
		sourceType,
		sourceUrl,
		integrations,
	} = params;

	// Build properties
	const properties: Record<string, any> = {
		Title: {
			title: [{ text: { content: topic } }],
		},
		Date: {
			date: { start: startTime.split('T')[0] },
		},
		Type: {
			select: { name: sourceType === 'meeting' ? 'Meeting' : 'Clip' },
		},
		'Source ID': {
			rich_text: [{ text: { content: sourceId } }],
		},
		Status: {
			select: { name: 'Synced' },
		},
	};

	if (sourceUrl) {
		properties['Source URL'] = { url: sourceUrl };
	}

	if (analysis?.sentiment) {
		properties['Sentiment'] = { select: { name: analysis.sentiment } };
	}

	// Build content blocks
	const children: any[] = [];

	// Meeting info callout
	children.push({
		object: 'block',
		type: 'callout',
		callout: {
			rich_text: [
				{
					text: {
						content: `${sourceType === 'meeting' ? 'Meeting' : 'Clip'} on ${new Date(startTime).toLocaleDateString()}${speakers.length > 0 ? ` • Speakers: ${speakers.join(', ')}` : ''}`,
					},
				},
			],
			icon: { emoji: sourceType === 'meeting' ? '📅' : '🎬' },
			color: 'blue_background',
		},
	});

	// AI Summary (if available)
	if (analysis?.summary) {
		children.push({
			object: 'block',
			type: 'heading_2',
			heading_2: { rich_text: [{ text: { content: 'Summary' } }] },
		});
		children.push({
			object: 'block',
			type: 'paragraph',
			paragraph: { rich_text: [{ text: { content: analysis.summary } }] },
		});
	}

	// Decisions
	if (analysis?.decisions?.length > 0) {
		children.push({
			object: 'block',
			type: 'heading_2',
			heading_2: { rich_text: [{ text: { content: '✅ Decisions' } }] },
		});
		for (const decision of analysis.decisions) {
			children.push({
				object: 'block',
				type: 'numbered_list_item',
				numbered_list_item: { rich_text: [{ text: { content: decision } }] },
			});
		}
	}

	// Action Items
	if (analysis?.actionItems?.length > 0) {
		children.push({
			object: 'block',
			type: 'heading_2',
			heading_2: { rich_text: [{ text: { content: '📋 Action Items' } }] },
		});
		for (const item of analysis.actionItems) {
			const text = item.assignee ? `${item.task} (@${item.assignee})` : item.task;
			children.push({
				object: 'block',
				type: 'to_do',
				to_do: {
					rich_text: [{ text: { content: text } }],
					checked: false,
				},
			});
		}
	}

	// Follow-ups
	if (analysis?.followUps?.length > 0) {
		children.push({
			object: 'block',
			type: 'heading_2',
			heading_2: { rich_text: [{ text: { content: '📆 Follow-ups' } }] },
		});
		for (const followUp of analysis.followUps) {
			children.push({
				object: 'block',
				type: 'bulleted_list_item',
				bulleted_list_item: { rich_text: [{ text: { content: followUp } }] },
			});
		}
	}

	// Key Topics
	if (analysis?.keyTopics?.length > 0) {
		children.push({
			object: 'block',
			type: 'heading_2',
			heading_2: { rich_text: [{ text: { content: '💡 Key Topics' } }] },
		});
		for (const topic of analysis.keyTopics) {
			children.push({
				object: 'block',
				type: 'bulleted_list_item',
				bulleted_list_item: { rich_text: [{ text: { content: topic } }] },
			});
		}
	}

	// Full Transcript (in toggle)
	if (transcript) {
		children.push({
			object: 'block',
			type: 'divider',
			divider: {},
		});
		children.push({
			object: 'block',
			type: 'toggle',
			toggle: {
				rich_text: [{ text: { content: '📜 Full Transcript' } }],
				children: splitTranscriptIntoBlocks(transcript),
			},
		});
	}

	// Create page
	try {
		const result = await integrations.notion.pages.create({
			parent: { database_id: databaseId },
			properties,
			children,
		});

		return result.success ? { url: result.data?.url } : null;
	} catch (error) {
		console.error('Failed to create Notion page:', error);
		return null;
	}
}

function splitTranscriptIntoBlocks(transcript: string): any[] {
	const blocks: any[] = [];
	const maxChars = 1900; // Notion limit is 2000, leave buffer

	// Split by paragraphs or speaker changes
	const segments = transcript.split(/\n\n|\n(?=[A-Z][a-z]+:)/);

	let currentBlock = '';

	for (const segment of segments) {
		if (currentBlock.length + segment.length + 1 > maxChars) {
			if (currentBlock) {
				blocks.push({
					object: 'block',
					type: 'paragraph',
					paragraph: { rich_text: [{ text: { content: currentBlock } }] },
				});
			}
			currentBlock = segment;
		} else {
			currentBlock = currentBlock ? `${currentBlock}\n${segment}` : segment;
		}
	}

	if (currentBlock) {
		blocks.push({
			object: 'block',
			type: 'paragraph',
			paragraph: { rich_text: [{ text: { content: currentBlock } }] },
		});
	}

	return blocks.length > 0 ? blocks : [
		{
			object: 'block',
			type: 'paragraph',
			paragraph: { rich_text: [{ text: { content: 'No transcript available' } }] },
		},
	];
}

interface PostSlackSummaryParams {
	channel: string;
	topic: string;
	summary: string;
	actionItems: Array<{ task: string; assignee?: string }>;
	notionUrl?: string;
	integrations: any;
}

async function postSlackSummary(params: PostSlackSummaryParams): Promise<boolean> {
	const { channel, topic, summary, actionItems, notionUrl, integrations } = params;

	const actionItemsList = actionItems.length > 0
		? actionItems.map((a) => `• ${a.task}${a.assignee ? ` (@${a.assignee})` : ''}`).join('\n')
		: null;

	const blocks: any[] = [
		{
			type: 'header',
			text: { type: 'plain_text', text: `📋 ${topic}`, emoji: true },
		},
		{
			type: 'section',
			text: { type: 'mrkdwn', text: `*Summary:*\n${summary}` },
		},
	];

	if (actionItemsList) {
		blocks.push({
			type: 'section',
			text: { type: 'mrkdwn', text: `*Action Items (${actionItems.length}):*\n${actionItemsList}` },
		});
	}

	if (notionUrl) {
		blocks.push({
			type: 'actions',
			elements: [
				{
					type: 'button',
					text: { type: 'plain_text', text: 'View in Notion', emoji: true },
					url: notionUrl,
				},
			],
		});
	}

	try {
		await integrations.slack.chat.postMessage({
			channel,
			text: `Meeting synced: ${topic}`,
			blocks,
		});
		return true;
	} catch {
		return false;
	}
}

interface UpdateCRMParams {
	topic: string;
	summary?: string;
	actionItems: Array<{ task: string; assignee?: string }>;
	speakers: string[];
	notionUrl?: string;
	inputs: any;
	integrations: any;
}

/**
 * Update CRM (HubSpot) with meeting data
 *
 * Zuhandenheit: Developer thinks "sync meeting to CRM"
 * not "search deals by attendee, log engagement, update notes"
 */
async function updateCRM(params: UpdateCRMParams): Promise<boolean> {
	const { topic, summary, actionItems, speakers, notionUrl, inputs, integrations } = params;

	try {
		let dealId: string | null = null;
		let contactIds: string[] = [];

		// 1. Try to find relevant deal (if auto-search enabled)
		if (inputs.crmDealSearchEnabled && speakers.length > 0) {
			// Search for deals by meeting topic or attendee names
			const dealSearch = await integrations.hubspot.searchDeals({
				query: topic,
				limit: 1,
			});

			if (dealSearch.success && dealSearch.data?.length > 0) {
				dealId = dealSearch.data[0].id;
			} else {
				// Try searching by speaker name (might be company name)
				for (const speaker of speakers.slice(0, 3)) {
					const companySearch = await integrations.hubspot.searchDeals({
						query: speaker.split(' ')[0], // First name or company
						limit: 1,
					});
					if (companySearch.success && companySearch.data?.length > 0) {
						dealId = companySearch.data[0].id;
						break;
					}
				}
			}

			// Also try to find contacts by speaker names (for meeting activity)
			for (const speaker of speakers.slice(0, 5)) {
				const contactSearch = await integrations.hubspot.searchContacts({
					query: speaker,
					limit: 1,
				});
				if (contactSearch.success && contactSearch.data?.length > 0) {
					contactIds.push(contactSearch.data[0].id);
				}
			}
		}

		// 2. Log meeting activity (if enabled)
		if (inputs.crmLogMeetingActivity && (dealId || contactIds.length > 0)) {
			await integrations.hubspot.logMeetingActivity({
				dealId: dealId || undefined,
				contactIds: contactIds.length > 0 ? contactIds : undefined,
				meetingTitle: topic,
				notes: summary || `Meeting: ${topic}`,
				externalUrl: notionUrl,
			});
		}

		// 3. Update deal notes (if enabled and we found a deal)
		if (inputs.crmUpdateDealNotes && dealId) {
			await integrations.hubspot.updateDealFromMeeting({
				dealId,
				meetingTitle: topic,
				summary: summary,
				actionItems: actionItems,
				notionUrl: notionUrl,
			});
		}

		return !!(dealId || contactIds.length > 0);
	} catch (error) {
		console.error('CRM update failed:', error);
		return false;
	}
}

export const metadata = {
	id: 'meeting-intelligence',
	category: 'productivity',
	featured: true,
	stats: { rating: 4.9, users: 0, reviews: 0 },
};
