/**
 * Document Approval Flow Workflow
 *
 * When documents are added to a specific Drive folder, request approval
 * via Slack with interactive buttons. Track approval status and notify
 * when approved/rejected.
 *
 * ZUHANDENHEIT: The tool recedes, the outcome remains.
 * User thinks: "Documents that approve themselves"
 *
 * Integrations: Google Drive, Slack, Notion (optional tracking)
 * Trigger: Webhook (file added to approval folder) OR cron
 */

import { defineWorkflow, cron, webhook } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Document Approval Flow',
	description: 'Documents that approve themselves - Slack-based approval with automatic tracking',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'when_approval_needed',

		outcomeStatement: {
			suggestion: 'Need document approvals tracked?',
			explanation: 'When files are added to your approval folder, we request approval via Slack and track the status.',
			outcome: 'Documents that approve themselves',
		},

		primaryPair: {
			from: 'google-drive',
			to: 'slack',
			workflowId: 'document-approval-flow',
			outcome: 'Documents that approve themselves',
		},

		additionalPairs: [
			{ from: 'google-drive', to: 'notion', workflowId: 'document-approval-flow', outcome: 'Approval status in Notion' },
		],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['google-drive', 'slack'],
				workflowId: 'document-approval-flow',
				priority: 90,
			},
		],

		smartDefaults: {
			requireAllApprovers: { value: false },
			autoRemind: { value: true },
			reminderHours: { value: 24 },
			trackInNotion: { value: true },
		},

		essentialFields: ['approvalFolderId', 'approverChannel'],

		zuhandenheit: {
			timeToValue: 2,
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'usage',
		pricePerExecution: 0.08,
		freeExecutions: 50,
		description: 'Per approval request',
	},

	integrations: [
		{ service: 'google-drive', scopes: ['drive.readonly', 'drive.metadata.readonly'] },
		{ service: 'slack', scopes: ['send_messages', 'read_channels', 'interactive_messages'] },
		{ service: 'notion', scopes: ['read_databases', 'write_databases'], optional: true },
	],

	inputs: {
		// Folder configuration
		approvalFolderId: {
			type: 'google_drive_folder_picker',
			label: 'Approval Folder',
			required: true,
			description: 'Folder to watch for documents needing approval',
		},
		approvedFolderId: {
			type: 'google_drive_folder_picker',
			label: 'Approved Folder',
			required: false,
			description: 'Move approved documents here (optional)',
		},
		rejectedFolderId: {
			type: 'google_drive_folder_picker',
			label: 'Rejected Folder',
			required: false,
			description: 'Move rejected documents here (optional)',
		},

		// Approver settings
		approverChannel: {
			type: 'slack_channel_picker',
			label: 'Approver Channel',
			required: true,
			description: 'Channel where approval requests are posted',
		},
		approverUsers: {
			type: 'slack_users_picker',
			label: 'Approvers',
			required: false,
			description: 'Specific users who can approve (empty = anyone in channel)',
		},
		requireAllApprovers: {
			type: 'boolean',
			label: 'Require All Approvers',
			default: false,
			description: 'Require all listed approvers (vs just one)',
		},

		// Notification settings
		notifyOnApproval: {
			type: 'boolean',
			label: 'Notify on Approval',
			default: true,
			description: 'Post when document is approved',
		},
		notifyOnRejection: {
			type: 'boolean',
			label: 'Notify on Rejection',
			default: true,
			description: 'Post when document is rejected',
		},
		notifyUploader: {
			type: 'boolean',
			label: 'Notify Document Owner',
			default: true,
			description: 'DM the uploader with the decision',
		},

		// Reminder settings
		autoRemind: {
			type: 'boolean',
			label: 'Auto Remind',
			default: true,
			description: 'Remind approvers of pending requests',
		},
		reminderHours: {
			type: 'number',
			label: 'Reminder After (hours)',
			default: 24,
			description: 'Hours before sending reminder',
		},

		// Tracking
		notionDatabaseId: {
			type: 'notion_database_picker',
			label: 'Approval Tracking Database',
			required: false,
			description: 'Notion database for tracking approvals',
		},
	},

	trigger: cron({
		schedule: '0 * * * *', // Every hour (for reminders and new file check)
		timezone: 'UTC',
	}),

	webhooks: [
		webhook({
			service: 'google-drive',
			event: 'file.created',
		}),
		webhook({
			service: 'slack',
			event: 'interactive_message',
		}),
	],

	async execute({ trigger, inputs, integrations, env }) {
		const results: Array<{
			file: { id: string; name: string };
			action: 'requested' | 'approved' | 'rejected' | 'reminded' | 'skipped';
			approver?: string;
		}> = [];

		const isWebhookTrigger = trigger.type === 'webhook';
		const isSlackInteraction = isWebhookTrigger && (trigger as any).service === 'slack';

		if (isSlackInteraction) {
			// Handle approval/rejection button click
			const interaction = trigger.data;
			const action = interaction.actions?.[0];

			if (action?.action_id?.startsWith('approve_') || action?.action_id?.startsWith('reject_')) {
				const isApproval = action.action_id.startsWith('approve_');
				const fileId = action.value;

				// Get file info from KV
				const pendingKey = `approval:pending:${fileId}`;
				const pendingData = await env.KV?.get(pendingKey, 'json');

				if (pendingData) {
					const result = await processDecision({
						fileId,
						fileName: pendingData.fileName,
						isApproval,
						approver: interaction.user?.username || interaction.user?.id,
						inputs,
						integrations,
						env,
						messageTs: interaction.message?.ts,
						channel: interaction.channel?.id,
					});
					results.push(result);
				}
			}
		} else if (isWebhookTrigger && (trigger as any).service === 'google-drive') {
			// New file added - create approval request
			const file = trigger.data;

			// Check if file is in approval folder
			if (file.parents?.includes(inputs.approvalFolderId)) {
				const result = await createApprovalRequest({
					file,
					inputs,
					integrations,
					env,
				});
				results.push(result);
			}
		} else {
			// Cron: Check for new files and send reminders

			// 1. Check for new files in approval folder
			const filesResult = await integrations['google-drive'].files.list({
				q: `'${inputs.approvalFolderId}' in parents and trashed = false`,
				fields: 'files(id, name, webViewLink, owners, createdTime)',
				orderBy: 'createdTime desc',
				pageSize: 50,
			});

			if (filesResult.success && filesResult.data?.files) {
				for (const file of filesResult.data.files) {
					const pendingKey = `approval:pending:${file.id}`;
					const alreadyPending = await env.KV?.get(pendingKey);

					if (!alreadyPending) {
						const result = await createApprovalRequest({
							file,
							inputs,
							integrations,
							env,
						});
						results.push(result);
					}
				}
			}

			// 2. Send reminders for pending approvals
			if (inputs.autoRemind) {
				const reminderThreshold = Date.now() - inputs.reminderHours * 60 * 60 * 1000;

				// List pending approvals from KV
				const pendingList = await env.KV?.list({ prefix: 'approval:pending:' });

				if (pendingList?.keys) {
					for (const key of pendingList.keys) {
						const pendingData = await env.KV?.get(key.name, 'json') as any;

						if (pendingData && new Date(pendingData.requestedAt).getTime() < reminderThreshold) {
							// Check if reminder already sent
							const reminderKey = `approval:reminded:${pendingData.fileId}`;
							const alreadyReminded = await env.KV?.get(reminderKey);

							if (!alreadyReminded) {
								await sendReminder({
									file: { id: pendingData.fileId, name: pendingData.fileName },
									channel: inputs.approverChannel,
									messageTs: pendingData.messageTs,
									integrations,
								});

								await env.KV?.put(reminderKey, 'true', { expirationTtl: 86400 });

								results.push({
									file: { id: pendingData.fileId, name: pendingData.fileName },
									action: 'reminded',
								});
							}
						}
					}
				}
			}
		}

		return {
			success: true,
			processed: results.length,
			results,
		};
	},

	onError: async ({ error, inputs, integrations }) => {
		if (inputs.approverChannel && integrations.slack) {
			await integrations.slack.chat.postMessage({
				channel: inputs.approverChannel,
				text: `Document Approval Flow error: ${error.message}`,
			});
		}
	},
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function createApprovalRequest(params: {
	file: any;
	inputs: any;
	integrations: any;
	env: any;
}) {
	const { file, inputs, integrations, env } = params;

	const owner = file.owners?.[0]?.displayName || file.owners?.[0]?.emailAddress || 'Unknown';

	const blocks: any[] = [
		{
			type: 'header',
			text: { type: 'plain_text', text: 'Document Approval Required', emoji: true },
		},
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `*<${file.webViewLink}|${file.name}>*\nUploaded by: ${owner}`,
			},
		},
		{
			type: 'actions',
			elements: [
				{
					type: 'button',
					text: { type: 'plain_text', text: 'Approve', emoji: true },
					style: 'primary',
					action_id: `approve_${file.id}`,
					value: file.id,
				},
				{
					type: 'button',
					text: { type: 'plain_text', text: 'Reject', emoji: true },
					style: 'danger',
					action_id: `reject_${file.id}`,
					value: file.id,
				},
				{
					type: 'button',
					text: { type: 'plain_text', text: 'View Document', emoji: true },
					url: file.webViewLink,
				},
			],
		},
	];

	// Mention specific approvers if configured
	let text = `Document needs approval: ${file.name}`;
	if (inputs.approverUsers?.length > 0) {
		const mentions = inputs.approverUsers.map((u: string) => `<@${u}>`).join(' ');
		text = `${mentions} - Document needs approval: ${file.name}`;
	}

	try {
		const messageResult = await integrations.slack.chat.postMessage({
			channel: inputs.approverChannel,
			text,
			blocks,
		});

		// Store pending approval in KV
		const pendingKey = `approval:pending:${file.id}`;
		await env.KV?.put(pendingKey, JSON.stringify({
			fileId: file.id,
			fileName: file.name,
			fileUrl: file.webViewLink,
			owner,
			requestedAt: new Date().toISOString(),
			messageTs: messageResult.data?.ts,
			channel: inputs.approverChannel,
		}), { expirationTtl: 604800 }); // 7 days

		// Track in Notion if configured
		if (inputs.notionDatabaseId) {
			await integrations.notion.pages.create({
				parent: { database_id: inputs.notionDatabaseId },
				properties: {
					Name: { title: [{ text: { content: file.name } }] },
					Status: { select: { name: 'Pending' } },
					'Drive URL': { url: file.webViewLink },
					'Requested At': { date: { start: new Date().toISOString() } },
					Owner: { rich_text: [{ text: { content: owner } }] },
				},
			});
		}

		return {
			file: { id: file.id, name: file.name },
			action: 'requested' as const,
		};
	} catch {
		return {
			file: { id: file.id, name: file.name },
			action: 'skipped' as const,
		};
	}
}

async function processDecision(params: {
	fileId: string;
	fileName: string;
	isApproval: boolean;
	approver: string;
	inputs: any;
	integrations: any;
	env: any;
	messageTs: string;
	channel: string;
}) {
	const { fileId, fileName, isApproval, approver, inputs, integrations, env, messageTs, channel } = params;

	const status = isApproval ? 'Approved' : 'Rejected';
	const emoji = isApproval ? '' : '';

	// Update the original message
	try {
		await integrations.slack.chat.update({
			channel,
			ts: messageTs,
			text: `${emoji} Document ${status.toLowerCase()}: ${fileName}`,
			blocks: [
				{
					type: 'section',
					text: {
						type: 'mrkdwn',
						text: `${emoji} *${status}*: ${fileName}\nBy: <@${approver}> at ${new Date().toLocaleString()}`,
					},
				},
			],
		});
	} catch {
		// Message update failed, post new message
		if ((isApproval && inputs.notifyOnApproval) || (!isApproval && inputs.notifyOnRejection)) {
			await integrations.slack.chat.postMessage({
				channel,
				text: `${emoji} Document ${status.toLowerCase()}: ${fileName} (by ${approver})`,
			});
		}
	}

	// Move file if folders configured
	if (isApproval && inputs.approvedFolderId) {
		await integrations['google-drive'].files.update({
			fileId,
			addParents: inputs.approvedFolderId,
			removeParents: inputs.approvalFolderId,
		});
	} else if (!isApproval && inputs.rejectedFolderId) {
		await integrations['google-drive'].files.update({
			fileId,
			addParents: inputs.rejectedFolderId,
			removeParents: inputs.approvalFolderId,
		});
	}

	// Update Notion tracking
	if (inputs.notionDatabaseId) {
		try {
			const searchResult = await integrations.notion.databases.query({
				database_id: inputs.notionDatabaseId,
				filter: {
					property: 'Name',
					title: { equals: fileName },
				},
				page_size: 1,
			});

			if (searchResult.data?.results?.length > 0) {
				await integrations.notion.pages.update({
					page_id: searchResult.data.results[0].id,
					properties: {
						Status: { select: { name: status } },
						'Decided By': { rich_text: [{ text: { content: approver } }] },
						'Decided At': { date: { start: new Date().toISOString() } },
					},
				});
			}
		} catch {
			// Notion update failed silently
		}
	}

	// Clean up pending approval
	const pendingKey = `approval:pending:${fileId}`;
	await env.KV?.delete(pendingKey);

	return {
		file: { id: fileId, name: fileName },
		action: isApproval ? 'approved' as const : 'rejected' as const,
		approver,
	};
}

async function sendReminder(params: {
	file: { id: string; name: string };
	channel: string;
	messageTs: string;
	integrations: any;
}) {
	const { file, channel, messageTs, integrations } = params;

	try {
		await integrations.slack.chat.postMessage({
			channel,
			thread_ts: messageTs,
			text: `Reminder: This document is still pending approval: ${file.name}`,
		});
	} catch {
		// Reminder failed silently
	}
}

export const metadata = {
	id: 'document-approval-flow',
	category: 'productivity',
	featured: false,
	stats: { rating: 0, users: 0, reviews: 0 },
};
