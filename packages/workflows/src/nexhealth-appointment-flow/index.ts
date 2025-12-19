/**
 * NexHealth Appointment Flow
 *
 * Appointments that confirm themselves.
 *
 * Uses Workers AI to generate personalized, context-aware appointment
 * communications based on patient history and appointment details.
 * Automatically handles confirmation, reminders, and form delivery.
 *
 * Zuhandenheit: The mechanism (AI, NexHealth API, Weave SMS) recedes.
 * What remains: Patients show up prepared, chairs stay full.
 *
 * Integrations: NexHealth, Weave, Workers AI, Slack (optional)
 * Trigger: Scheduled (hourly check for appointments needing communication)
 */

import { defineWorkflow, schedule } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'NexHealth Appointment Flow',
	description: 'AI-powered appointment communications via NexHealth + Weave',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'when_chairs_fill',

		outcomeStatement: {
			suggestion: 'Let appointments manage themselves?',
			explanation: 'We\'ll monitor NexHealth for upcoming appointments, send personalized confirmations and reminders via Weave, deliver intake forms at the right time, and handle the entire patient communication flow automatically.',
			outcome: 'Appointments that confirm themselves',
		},

		primaryPair: {
			from: 'nexhealth',
			to: 'weave',
			workflowId: 'nexhealth-appointment-flow',
			outcome: 'Scheduled appointments become confirmed, prepared patients',
		},

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['nexhealth', 'weave'],
				workflowId: 'nexhealth-appointment-flow',
				priority: 92,
			},
			{
				trigger: 'event_received',
				integrations: ['nexhealth'],
				workflowId: 'nexhealth-appointment-flow',
				priority: 95,
			},
		],

		smartDefaults: {
			confirmationHoursAfter: { value: 1 },
			reminderHoursBefore: { value: 24 },
			formHoursBefore: { value: 48 },
			timezone: { inferFrom: 'user_timezone' },
		},

		essentialFields: ['practiceName', 'practicePhone'],

		zuhandenheit: {
			timeToValue: 60, // 1 hour until first check
			worksOutOfBox: true,
			gracefulDegradation: true, // Falls back to template if AI fails
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'paid',
		pricePerMonth: 29,
		trialDays: 14,
		description: 'AI-powered appointment automation for healthcare practices',
	},

	integrations: [
		{ service: 'nexhealth', scopes: ['read_appointments', 'read_patients', 'send_forms'] },
		{ service: 'weave', scopes: ['send_sms', 'read_messages'] },
		{ service: 'slack', scopes: ['send_messages'], optional: true },
	],

	inputs: {
		practiceName: {
			type: 'string',
			label: 'Practice Name',
			required: true,
		},
		practicePhone: {
			type: 'phone',
			label: 'Practice Phone Number',
			required: true,
		},
		confirmationHoursAfter: {
			type: 'number',
			label: 'Send Confirmation (hours after booking)',
			default: 1,
			description: 'How soon after booking to send confirmation',
		},
		reminderHoursBefore: {
			type: 'number',
			label: 'Send Reminder (hours before appointment)',
			default: 24,
		},
		formHoursBefore: {
			type: 'number',
			label: 'Send Forms (hours before appointment)',
			default: 48,
			description: 'When to send intake/consent forms',
		},
		enableReplyToConfirm: {
			type: 'boolean',
			label: 'Allow "C" to Confirm',
			default: true,
			description: 'Let patients reply "C" to confirm their appointment',
		},
		slackChannel: {
			type: 'string',
			label: 'Slack Channel for Alerts',
			description: 'Get notified about unconfirmed appointments and no-shows',
		},
		timezone: {
			type: 'timezone',
			label: 'Practice Timezone',
			default: 'America/New_York',
		},
		tone: {
			type: 'select',
			label: 'Communication Tone',
			options: [
				{ value: 'warm', label: 'Warm & Friendly' },
				{ value: 'professional', label: 'Professional' },
				{ value: 'casual', label: 'Casual' },
			],
			default: 'warm',
		},
	},

	trigger: schedule({
		cron: '0 * * * *', // Every hour
		timezone: '{{inputs.timezone}}',
	}),

	async execute({ inputs, integrations, storage }) {
		const now = new Date();
		const results: CommunicationResult[] = [];

		// Get upcoming appointments (next 3 days)
		const appointmentsResult = await integrations.nexhealth.getUpcomingAppointments({
			days: 3,
			statuses: ['scheduled', 'confirmed'],
		});

		if (!appointmentsResult.success) {
			return {
				success: false,
				error: 'Failed to fetch appointments',
				details: appointmentsResult.error,
			};
		}

		const appointments = appointmentsResult.data || [];

		if (appointments.length === 0) {
			return { success: true, message: 'No upcoming appointments', communications: 0 };
		}

		// Get last run state to avoid duplicate messages
		const lastRunData = await storage.get<LastRunState>('last_run');
		const sentMessages = new Set(lastRunData?.sentMessageIds || []);

		for (const appointment of appointments) {
			const appointmentTime = new Date(appointment.start_time);
			const hoursUntil = (appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60);
			const hoursSinceCreated = appointment.created_at
				? (now.getTime() - new Date(appointment.created_at).getTime()) / (1000 * 60 * 60)
				: null;

			// Get patient details
			const patientResult = await integrations.nexhealth.getPatient(appointment.patient_id);
			if (!patientResult.success || !patientResult.data) continue;

			const patient = patientResult.data;
			const patientPhone = patient.phone || patient.cell_phone;

			if (!patientPhone) continue; // Can't communicate without phone

			// Determine what communication to send
			let communicationType: CommunicationType | null = null;
			const messageKey = `${appointment.id}-`;

			// Check for confirmation (X hours after booking)
			if (
				hoursSinceCreated !== null &&
				hoursSinceCreated >= inputs.confirmationHoursAfter &&
				hoursSinceCreated < inputs.confirmationHoursAfter + 1 &&
				!sentMessages.has(`${messageKey}confirmation`)
			) {
				communicationType = 'confirmation';
			}
			// Check for forms (48 hours before)
			else if (
				hoursUntil <= inputs.formHoursBefore &&
				hoursUntil > inputs.formHoursBefore - 1 &&
				!sentMessages.has(`${messageKey}forms`)
			) {
				communicationType = 'forms';
			}
			// Check for reminder (24 hours before)
			else if (
				hoursUntil <= inputs.reminderHoursBefore &&
				hoursUntil > inputs.reminderHoursBefore - 1 &&
				!sentMessages.has(`${messageKey}reminder`)
			) {
				communicationType = 'reminder';
			}

			if (!communicationType) continue;

			// Get appointment type for context
			const appointmentType = appointment.appointment_type?.name || 'appointment';

			// Build patient context for AI
			const patientContext = buildPatientContext(patient);

			// Generate personalized message with Workers AI
			let messageContent: string;
			let aiGenerated = false;

			try {
				const aiPrompt = buildAIPrompt(
					communicationType,
					{
						practiceName: inputs.practiceName,
						practicePhone: inputs.practicePhone,
						patientName: patient.first_name,
						appointmentType,
						appointmentTime,
						patientContext,
						tone: inputs.tone,
						enableReplyToConfirm: inputs.enableReplyToConfirm,
					}
				);

				const aiResult = await integrations.ai.generateText({
					model: '@cf/meta/llama-3.1-8b-instruct',
					prompt: aiPrompt,
					max_tokens: 300,
				});

				if (aiResult.success && aiResult.data) {
					messageContent = aiResult.data;
					aiGenerated = true;
				} else {
					throw new Error('AI generation failed');
				}
			} catch {
				// Graceful degradation: fall back to template
				messageContent = getFallbackTemplate(communicationType, {
					practiceName: inputs.practiceName,
					practicePhone: inputs.practicePhone,
					patientName: patient.first_name,
					appointmentType,
					appointmentTime,
					enableReplyToConfirm: inputs.enableReplyToConfirm,
				});
			}

			// Send SMS via Weave
			const smsResult = await integrations.weave.sendMessage({
				phoneNumber: patientPhone,
				body: messageContent,
			});

			if (!smsResult.success) {
				// Log failure but continue with other appointments
				continue;
			}

			// Send forms if this is a forms communication
			if (communicationType === 'forms') {
				await integrations.nexhealth.sendForm({
					patientId: patient.id,
					formType: 'intake',
					appointmentId: appointment.id,
				});
			}

			// Mark message as sent
			sentMessages.add(`${messageKey}${communicationType}`);

			results.push({
				appointmentId: appointment.id,
				patientName: `${patient.first_name} ${patient.last_name}`,
				patientPhone,
				appointmentTime: appointmentTime.toISOString(),
				appointmentType,
				communicationType,
				aiGenerated,
			});
		}

		// Check for unconfirmed appointments approaching (within 12 hours)
		const unconfirmedApproaching = appointments.filter(apt => {
			const hoursUntil = (new Date(apt.start_time).getTime() - now.getTime()) / (1000 * 60 * 60);
			return apt.status === 'scheduled' && hoursUntil <= 12 && hoursUntil > 0;
		});

		// Alert on Slack if we have unconfirmed appointments
		if (unconfirmedApproaching.length > 0 && inputs.slackChannel) {
			const appointmentList = await Promise.all(
				unconfirmedApproaching.slice(0, 10).map(async apt => {
					const patientResult = await integrations.nexhealth.getPatient(apt.patient_id);
					const patientName = patientResult.success && patientResult.data
						? `${patientResult.data.first_name} ${patientResult.data.last_name}`
						: 'Unknown';
					const time = new Date(apt.start_time).toLocaleTimeString('en-US', {
						hour: 'numeric',
						minute: '2-digit',
						timeZone: inputs.timezone,
					});
					return `• ${time} - ${patientName}`;
				})
			);

			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: `*Unconfirmed Appointments Alert*\n\n${unconfirmedApproaching.length} appointment(s) within 12 hours haven't been confirmed:\n\n${appointmentList.join('\n')}\n\nConsider a follow-up call.`,
			});
		}

		// Collect review stats if available
		let reviewStats = null;
		try {
			const statsResult = await integrations.weave.getReviewStats();
			if (statsResult.success) {
				reviewStats = statsResult.data;
			}
		} catch {
			// Optional feature - don't fail if unavailable
		}

		// Store execution state
		await storage.put('last_run', {
			timestamp: now.toISOString(),
			communicationsSent: results.length,
			appointmentsChecked: appointments.length,
			sentMessageIds: Array.from(sentMessages),
		});

		return {
			success: true,
			communications: results.length,
			appointmentsChecked: appointments.length,
			unconfirmedAlerts: unconfirmedApproaching.length,
			results,
			aiGeneratedCount: results.filter(r => r.aiGenerated).length,
			reviewStats,
		};
	},
});

// Types
type CommunicationType = 'confirmation' | 'reminder' | 'forms';

interface CommunicationResult {
	appointmentId: string;
	patientName: string;
	patientPhone: string;
	appointmentTime: string;
	appointmentType: string;
	communicationType: CommunicationType;
	aiGenerated: boolean;
}

interface LastRunState {
	timestamp: string;
	communicationsSent: number;
	appointmentsChecked: number;
	sentMessageIds: string[];
}

interface PatientContext {
	isNewPatient: boolean;
	lastVisit: string | null;
}

interface TemplateData {
	practiceName: string;
	practicePhone: string;
	patientName: string;
	appointmentType: string;
	appointmentTime: Date;
	enableReplyToConfirm: boolean;
}

interface AIPromptData extends TemplateData {
	patientContext: PatientContext;
	tone: string;
}

/**
 * Build patient context for AI personalization
 */
function buildPatientContext(
	patient: { created_at?: string }
): PatientContext {
	const patientCreated = patient.created_at ? new Date(patient.created_at) : null;
	const isNewPatient = patientCreated
		? (Date.now() - patientCreated.getTime()) < 30 * 24 * 60 * 60 * 1000 // < 30 days
		: false;

	return {
		isNewPatient,
		lastVisit: null, // Would need appointment history API
	};
}

/**
 * Build AI prompt for personalized messaging
 */
function buildAIPrompt(type: CommunicationType, data: AIPromptData): string {
	const timeStr = data.appointmentTime.toLocaleString('en-US', {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	});

	const baseContext = `
Generate a ${type} SMS message for a healthcare appointment.

Context:
- Practice: ${data.practiceName}
- Patient Name: ${data.patientName}
- Appointment: ${data.appointmentType}
- Date/Time: ${timeStr}
- Practice Phone: ${data.practicePhone}
- Patient Status: ${data.patientContext.isNewPatient ? 'New patient' : 'Returning patient'}
- Desired Tone: ${data.tone}

Requirements:
- Keep it under 160 characters if possible (SMS limit)
- Be ${data.tone} in tone
- Use patient's first name
- Include essential details only
`;

	const typeSpecific: Record<CommunicationType, string> = {
		confirmation: `
- This is an appointment CONFIRMATION
- Thank them for booking
${data.enableReplyToConfirm ? '- Tell them to reply "C" to confirm' : ''}
- Keep it brief and welcoming
`,
		reminder: `
- This is a REMINDER (appointment is tomorrow or today)
- Create gentle urgency
${data.enableReplyToConfirm ? '- Remind them to reply "C" if they haven\'t confirmed' : ''}
- Include practice phone for questions
`,
		forms: `
- This is about completing INTAKE FORMS
- Let them know forms have been sent to their email/patient portal
- Encourage completing before arrival
- Mention it saves time at the office
`,
	};

	return `${baseContext}${typeSpecific[type]}

Write only the SMS message, nothing else. No quotes around it.`;
}

/**
 * Fallback templates when AI is unavailable
 * Graceful degradation maintains Zuhandenheit
 */
function getFallbackTemplate(type: CommunicationType, data: TemplateData): string {
	const timeStr = data.appointmentTime.toLocaleString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	});

	const confirmPrompt = data.enableReplyToConfirm ? ' Reply C to confirm.' : '';

	const templates: Record<CommunicationType, string> = {
		confirmation: `Hi ${data.patientName}! Your ${data.appointmentType} at ${data.practiceName} is scheduled for ${timeStr}.${confirmPrompt} Questions? Call ${data.practicePhone}`,

		reminder: `Reminder: ${data.patientName}, your ${data.appointmentType} at ${data.practiceName} is tomorrow at ${timeStr}.${confirmPrompt} See you soon!`,

		forms: `Hi ${data.patientName}! Please complete your intake forms before your ${data.appointmentType} on ${timeStr}. Check your email or patient portal. This saves time at check-in!`,
	};

	return templates[type];
}

export const metadata = {
	id: 'nexhealth-appointment-flow',
	category: 'healthcare-dental',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
	new: true,
};
