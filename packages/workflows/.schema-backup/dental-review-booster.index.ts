/**
 * Dental Review Booster
 *
 * Compound workflow: Sikka → Slack + SMS/Email + Google/Yelp
 *
 * Zuhandenheit: "5-star reviews that write themselves"
 * not "post-visit satisfaction survey system"
 *
 * The workflow that turns visits into reviews:
 * 1. Detects completed appointments via Sikka
 * 2. Sends satisfaction pulse (NPS-style)
 * 3. Happy patients → direct to Google/Yelp review
 * 4. Unhappy patients → route to recovery workflow
 * 5. Tracks review conversion and sentiment
 *
 * Outcome: More 5-star reviews. Fewer public complaints.
 */

import { defineWorkflow, cron } from '@workwayco/sdk';

// Types inline to avoid build dependency issues
interface SikkaAppointment {
	appointment_id: string;
	practice_id: string;
	patient_id: string;
	appointment_date: string;
	appointment_time: string;
	duration_minutes?: number;
	status: 'scheduled' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
	appointment_type?: string;
}

interface SikkaPatient {
	patient_id: string;
	practice_id: string;
	first_name: string;
	last_name: string;
	email?: string;
	phone_cell?: string;
}

export default defineWorkflow({
	name: 'Dental Review Booster',
	description:
		'Turn happy patients into 5-star reviews. Route unhappy patients to recovery before they go public.',
	version: '1.0.0',

	pathway: {
		outcomeFrame: 'after_appointments',

		outcomeStatement: {
			suggestion: 'Want more 5-star reviews?',
			explanation:
				'After each visit, we ask how it went. Happy patients get a direct link to leave a review. Unhappy patients get personal follow-up before they complain publicly.',
			outcome: 'Reviews that write themselves',
		},

		primaryPair: {
			from: 'sikka',
			to: 'google-business',
			workflowId: 'dental-review-booster',
			outcome: 'Visits become Google reviews',
		},

		additionalPairs: [
			{
				from: 'sikka',
				to: 'slack',
				workflowId: 'dental-review-booster',
				outcome: 'Feedback alerts in Slack',
			},
			{
				from: 'sikka',
				to: 'yelp',
				workflowId: 'dental-review-booster',
				outcome: 'Visits become Yelp reviews',
			},
		],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['sikka'],
				workflowId: 'dental-review-booster',
				priority: 90,
			},
		],

		smartDefaults: {
			sendAfterMinutes: { value: 60 },
			happyThreshold: { value: 8 },
			enableRecovery: { value: true },
		},

		essentialFields: ['practice_id', 'google_review_url'],

		zuhandenheit: {
			timeToValue: 1,
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'subscription',
		pricePerMonth: 39,
		trialDays: 14,
		description: '$39/month per location. Unlimited reviews.',
	},

	integrations: [
		{ service: 'sikka', scopes: ['read_appointments', 'read_patients'] },
		{ service: 'slack', scopes: ['chat:write', 'channels:read'], optional: true },
		{ service: 'twilio', scopes: ['messages:write'], optional: true },
	],

	config: {
		practice_id: {
			type: 'text',
			label: 'Sikka Practice ID',
			required: true,
			description: 'Your practice ID from Sikka portal',
		},
		practice_name: {
			type: 'text',
			label: 'Practice Name',
			required: true,
			description: 'Your practice name for personalized messages',
		},
		google_review_url: {
			type: 'url',
			label: 'Google Review URL',
			required: true,
			description: 'Direct link to your Google Business review page',
		},
		yelp_review_url: {
			type: 'url',
			label: 'Yelp Review URL',
			required: false,
			description: 'Direct link to your Yelp review page',
		},
		slack_channel: {
			type: 'text',
			label: 'Feedback Alert Channel',
			required: false,
			description: 'Channel for positive feedback and recovery alerts',
		},
		send_after_minutes: {
			type: 'number',
			label: 'Send After (minutes)',
			default: 60,
			description: 'Minutes after appointment ends to send feedback request',
		},
		happy_threshold: {
			type: 'number',
			label: 'Happy Score Threshold',
			default: 8,
			description: 'Score 1-10 at or above which patient is asked for review',
		},
		enable_recovery: {
			type: 'boolean',
			label: 'Enable Recovery Workflow',
			default: true,
			description: 'Alert staff to personally follow up with unhappy patients',
		},
		satisfaction_message: {
			type: 'textarea',
			label: 'Satisfaction Request',
			default: 'Hi {{firstName}}, thanks for visiting {{practiceName}} today! How was your experience? Reply with a number 1-10 (10 = excellent)',
			description: 'Initial satisfaction check message',
		},
		review_request_message: {
			type: 'textarea',
			label: 'Review Request (Happy)',
			default: 'Thanks! We\'re so glad you had a great experience. Would you mind sharing it? It takes 30 seconds and helps others find us: {{reviewUrl}}',
			description: 'Message sent to happy patients',
		},
		recovery_message: {
			type: 'textarea',
			label: 'Recovery Message (Unhappy)',
			default: 'We\'re sorry your experience wasn\'t perfect. Our office manager {{managerName}} will call you today to make it right. Thank you for giving us the chance.',
			description: 'Message sent to unhappy patients before staff follow-up',
		},
		office_manager_name: {
			type: 'text',
			label: 'Office Manager Name',
			default: '',
			description: 'Name for recovery messages',
		},
	},

	// Run every 15 minutes to check for completed appointments
	trigger: cron({
		schedule: '*/15 * * * *',
	}),

	async execute({ trigger, inputs, integrations }) {
		const now = new Date();
		const results = {
			satisfactionSent: [] as SatisfactionRequest[],
			reviewRequestsSent: [] as ReviewRequest[],
			recoveryAlerts: [] as RecoveryAlert[],
		};

		// Get appointments completed in the last 2 hours
		// (wider window to catch any we might have missed)
		const startDate = new Date(now.getTime() - 2 * 60 * 60 * 1000);
		const endDate = now;

		const appointmentsResult = await integrations.sikka.getAppointments({
			practiceId: inputs.practiceId,
			startDate,
			endDate,
			status: 'completed',
		});

		if (!appointmentsResult.success) {
			throw new Error(`Failed to fetch appointments: ${appointmentsResult.error?.message}`);
		}

		const appointments = appointmentsResult.data;

		for (const appointment of appointments) {
			// Calculate when this appointment ended
			const appointmentStart = parseAppointmentTime(appointment);
			const duration = appointment.duration_minutes || 60;
			const appointmentEnd = new Date(appointmentStart.getTime() + duration * 60 * 1000);

			// Check if it's time to send (after sendAfterMinutes)
			const minutesSinceEnd = (now.getTime() - appointmentEnd.getTime()) / (1000 * 60);

			// Send if between sendAfterMinutes and sendAfterMinutes + 15 (our cron interval)
			const shouldSend = minutesSinceEnd >= inputs.sendAfterMinutes &&
				minutesSinceEnd < inputs.sendAfterMinutes + 15;

			if (!shouldSend) continue;

			// Get patient details
			const patientResult = await integrations.sikka.getPatient(
				inputs.practiceId,
				appointment.patient_id
			);

			if (!patientResult.success) continue;
			const patient = patientResult.data;

			// Skip if no cell phone
			if (!patient.phone_cell) continue;

			// Send satisfaction request
			const message = inputs.satisfactionMessage
				.replace('{{firstName}}', patient.first_name)
				.replace('{{lastName}}', patient.last_name)
				.replace('{{practiceName}}', inputs.practiceName);

			if (integrations.twilio) {
				try {
					await integrations.twilio.messages.create({
						to: patient.phone_cell,
						body: message,
					});

					results.satisfactionSent.push({
						appointmentId: appointment.appointment_id,
						patientId: patient.patient_id,
						patientName: `${patient.first_name} ${patient.last_name}`,
						phone: patient.phone_cell,
						sentAt: now.toISOString(),
					});
				} catch (error) {
					// Log but continue
					console.error(`Failed to send to ${patient.phone_cell}:`, error);
				}
			}
		}

		// Also process any incoming responses (this would be via webhook in production)
		// For now, just report what we sent

		return {
			success: true,
			summary: {
				appointmentsChecked: appointments.length,
				satisfactionRequestsSent: results.satisfactionSent.length,
				reviewRequestsSent: results.reviewRequestsSent.length,
				recoveryAlertsSent: results.recoveryAlerts.length,
			},
			details: results,
		};
	},

	// Note: SMS response handling would be implemented via a separate webhook endpoint
	// that processes incoming Twilio messages and routes based on patient state

	onError: async ({ error, inputs, integrations }) => {
		if (integrations.slack && inputs.slackChannel) {
			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: `:warning: Dental Review Booster Error: ${error.message}`,
			});
		}
	},
});

// =============================================================================
// TYPES
// =============================================================================

interface SatisfactionRequest {
	appointmentId: string;
	patientId: string;
	patientName: string;
	phone: string;
	sentAt: string;
}

interface ReviewRequest {
	patientId: string;
	patientName: string;
	platform: 'google' | 'yelp';
	sentAt: string;
}

interface RecoveryAlert {
	patientId: string;
	patientName: string;
	score: number;
	phone: string;
	alertedAt: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function parseAppointmentTime(appointment: SikkaAppointment): Date {
	return new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
}

function buildRecoveryAlertBlocks(data: { phone: string; score: number }): any[] {
	return [
		{
			type: 'header',
			text: {
				type: 'plain_text',
				text: ':rotating_light: Unhappy Patient - Follow Up Required',
			},
		},
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: [
					`*Satisfaction Score:* ${data.score}/10`,
					`*Phone:* ${data.phone}`,
					'',
					'Patient has been told someone will call today.',
					'*Please call within 2 hours to prevent public complaint.*',
				].join('\n'),
			},
		},
		{
			type: 'actions',
			elements: [
				{
					type: 'button',
					text: { type: 'plain_text', text: 'Mark Called' },
					style: 'primary',
					action_id: 'mark_called',
				},
				{
					type: 'button',
					text: { type: 'plain_text', text: 'Assign to Me' },
					action_id: 'assign_to_me',
				},
			],
		},
	];
}

export const metadata = {
	id: 'dental-review-booster',
	category: 'healthcare',
	industry: 'dental',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
};
