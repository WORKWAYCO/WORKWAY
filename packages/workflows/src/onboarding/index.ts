/**
 * Onboarding Automation
 *
 * Automate new team member onboarding process.
 * Creates tasks, sends welcome emails, and notifies the team.
 *
 * Integrations: Notion, Slack, Gmail
 * Trigger: New page in team members database
 */

import { defineWorkflow, webhook } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Onboarding Automation',
	description: 'Automate new team member onboarding process',
	version: '1.0.0',

	pricing: {
		model: 'paid',
		pricePerMonth: 19,
		trialDays: 14,
		description: 'Streamlined onboarding for growing teams',
	},

	integrations: [
		{ service: 'notion', scopes: ['read_pages', 'write_pages', 'read_databases'] },
		{ service: 'slack', scopes: ['send_messages', 'invite_users'] },
		{ service: 'gmail', scopes: ['send_emails'] },
	],

	inputs: {
		teamDatabase: {
			type: 'notion_database_picker',
			label: 'Team Members Database',
			required: true,
		},
		onboardingTasksDatabase: {
			type: 'notion_database_picker',
			label: 'Onboarding Tasks Database',
			required: true,
		},
		announcementChannel: {
			type: 'slack_channel_picker',
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

		// 3. Send welcome email
		if (email) {
			const welcomeEmail = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0; padding: 40px; text-align: center;">
    <h1 style="color: white; margin: 0;">Welcome to ${inputs.companyName}! 🎉</h1>
  </div>

  <div style="background: #f8f9fa; border-radius: 0 0 8px 8px; padding: 30px;">
    <p style="font-size: 18px;">Hi ${name.split(' ')[0]},</p>

    <p>We're thrilled to have you join us as our new <strong>${role}</strong>! Your start date is <strong>${new Date(startDate).toLocaleDateString()}</strong>.</p>

    <h3>What to Expect</h3>
    <ul>
      <li>You'll receive access to your accounts and tools on your first day</li>
      <li>Your onboarding tasks have been created - you'll find them in Notion</li>
      <li>Your team will be notified and ready to welcome you</li>
    </ul>

    <h3>Before You Start</h3>
    <p>Please have the following ready:</p>
    <ul>
      <li>Government-issued ID</li>
      <li>Banking information for payroll</li>
      <li>Emergency contact information</li>
    </ul>

    <p>If you have any questions before your start date, don't hesitate to reach out to us at ${inputs.hrEmail}.</p>

    <p>See you soon!</p>

    <p style="color: #666;">The ${inputs.companyName} Team</p>
  </div>
</body>
</html>`;

			await integrations.gmail.messages.send({
				to: email,
				subject: `Welcome to ${inputs.companyName}, ${name.split(' ')[0]}! 🎉`,
				html: welcomeEmail,
			});
		}

		// 4. Notify HR
		await integrations.gmail.messages.send({
			to: inputs.hrEmail,
			subject: `New Hire Starting: ${name} - ${role}`,
			body: `
A new team member has been added and onboarding has begun:

Name: ${name}
Role: ${role}
Department: ${department}
Start Date: ${new Date(startDate).toLocaleDateString()}
Email: ${email || 'Not provided'}

Onboarding tasks have been created automatically.
View in Notion: ${newMember.url}
			`,
		});

		// 5. Announce in Slack
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
			welcomeEmailSent: !!email,
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
