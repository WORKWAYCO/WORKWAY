/**
 * Onboarding Automation
 *
 * Automate new team member onboarding process.
 * Creates tasks and notifies the team.
 *
 * Integrations: Notion, Slack
 * Trigger: New page in team members database
 */

import { defineWorkflow, webhook } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Onboarding Automation',
	description: 'Automate new team member onboarding process',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'when_clients_onboard', // Team members use same frame as clients

		outcomeStatement: {
			suggestion: 'Automate team member onboarding?',
			explanation: 'When you add someone to your team database, we\'ll create tasks and notify the team on Slack.',
			outcome: 'New hires onboarded automatically',
		},

		primaryPair: {
			from: 'notion',
			to: 'slack',
			workflowId: 'onboarding',
			outcome: 'Team members that onboard themselves',
		},

		additionalPairs: [],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['notion', 'slack'],
				workflowId: 'onboarding',
				priority: 60,
			},
			{
				trigger: 'event_received',
				eventType: 'notion.page.created',
				integrations: ['notion', 'slack'],
				workflowId: 'onboarding',
				priority: 70,
			},
		],

		smartDefaults: {
			defaultOnboardingTasks: { value: [
				'Complete I-9 form',
				'Set up workstation',
				'Read company handbook',
				'Meet with team lead',
				'Complete first project',
			]},
		},

		essentialFields: ['teamDatabase', 'announcementChannel'],

		zuhandenheit: {
			timeToValue: 5,
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'paid',
		pricePerMonth: 19,
		trialDays: 14,
		description: 'Streamlined onboarding for growing teams',
	},

	integrations: [
		{ service: 'notion', scopes: ['read_pages', 'write_pages', 'read_databases'] },
		{ service: 'slack', scopes: ['send_messages', 'invite_users'] },
	],

	inputs: {
		teamDatabase: {
			type: 'text',
			label: 'Team Members Database',
			required: true,
		},
		onboardingTasksDatabase: {
			type: 'text',
			label: 'Onboarding Tasks Database',
			required: true,
		},
		announcementChannel: {
			type: 'text',
			label: 'Team Announcement Channel',
			required: true,
		},
		hrEmail: {
			type: 'email',
			label: 'HR/Admin Email',
			required: true,
		},
		companyName: {
			type: 'string',
			label: 'Company Name',
			required: true,
		},
		defaultOnboardingTasks: {
			type: 'array',
			label: 'Default Onboarding Tasks',
			items: { type: 'string' },
			default: [
				'Complete HR paperwork',
				'Set up email and accounts',
				'IT equipment setup',
				'Meet with manager',
				'Team introductions',
				'Review company handbook',
				'Complete security training',
				'First week goals meeting',
			],
		},
	},

	trigger: webhook({
		service: 'notion',
		event: 'page.created',
		filter: { database_id: '{{inputs.teamDatabase}}' },
	}),

	async execute({ trigger, inputs, integrations }) {
		const newMember = trigger.data;

		// Extract member details
		const name =
			newMember.properties?.Name?.title?.[0]?.plain_text ||
			newMember.properties?.['Full Name']?.title?.[0]?.plain_text ||
			'New Team Member';
		const email =
			newMember.properties?.Email?.email ||
			newMember.properties?.['Work Email']?.email;
		const role =
			newMember.properties?.Role?.select?.name ||
			newMember.properties?.Position?.select?.name ||
			'Team Member';
		const department =
			newMember.properties?.Department?.select?.name ||
			newMember.properties?.Team?.select?.name ||
			'General';
		const startDate =
			newMember.properties?.['Start Date']?.date?.start ||
			new Date().toISOString().split('T')[0];
		const manager =
			newMember.properties?.Manager?.people?.[0]?.id;

		// 1. Create onboarding tasks in Notion
		const taskPromises = inputs.defaultOnboardingTasks.map(async (task: string, index: number) => {
			const dueDate = new Date(startDate);
			dueDate.setDate(dueDate.getDate() + Math.floor(index / 2) + 1); // Spread tasks across first week

			return integrations.notion.pages.create({
				parent: { database_id: inputs.onboardingTasksDatabase },
				properties: {
					Name: { title: [{ text: { content: task } }] },
					'New Hire': { relation: [{ id: newMember.id }] },
					Status: { select: { name: 'Not Started' } },
					'Due Date': { date: { start: dueDate.toISOString().split('T')[0] } },
					Priority: {
						select: { name: index < 3 ? 'High' : index < 6 ? 'Medium' : 'Low' },
					},
				},
			});
		});

		await Promise.all(taskPromises);

		// 2. Update the team member page with onboarding status
		await integrations.notion.pages.update({
			page_id: newMember.id,
			properties: {
				'Onboarding Status': { select: { name: 'In Progress' } },
				'Onboarding Started': { date: { start: new Date().toISOString() } },
			},
		});

		// 3. Announce in Slack
		await integrations.slack.chat.postMessage({
			channel: inputs.announcementChannel,
			text: `🎉 Please welcome our newest team member!`,
			blocks: [
				{
					type: 'header',
					text: { type: 'plain_text', text: '🎉 New Team Member Alert!' },
				},
				{
					type: 'section',
					text: {
						type: 'mrkdwn',
						text: `Please join me in welcoming *${name}* to the team!`,
					},
				},
				{
					type: 'section',
					fields: [
						{ type: 'mrkdwn', text: `*Role:*\n${role}` },
						{ type: 'mrkdwn', text: `*Department:*\n${department}` },
						{ type: 'mrkdwn', text: `*Start Date:*\n${new Date(startDate).toLocaleDateString()}` },
						...(email ? [{ type: 'mrkdwn', text: `*Email:*\n${email}` }] : []),
					],
				},
				{
					type: 'section',
					text: {
						type: 'mrkdwn',
						text: `Let's make ${name.split(' ')[0]}'s first days amazing! Feel free to reach out and introduce yourself. 👋`,
					},
				},
			],
		});

		return {
			success: true,
			newMember: {
				name,
				email,
				role,
				department,
				startDate,
			},
			tasksCreated: inputs.defaultOnboardingTasks.length,
			teamNotified: true,
		};
	},
});

export const metadata = {
	id: 'onboarding-automation',
	category: 'team-management',
	featured: false,
	stats: { rating: 4.8, users: 456, reviews: 23 },
};
