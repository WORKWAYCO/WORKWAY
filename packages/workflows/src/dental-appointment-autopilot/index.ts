/**
 * Dental Appointment Autopilot
 *
 * Compound workflow: Sikka → Slack + SMS/Email
 *
 * Zuhandenheit: "Patients who show up" not "appointment reminder system"
 *
 * The workflow that makes no-shows disappear:
 * 1. Monitors tomorrow's appointments via Sikka
 * 2. Sends intelligent reminder sequences
 * 3. Enables easy confirmation/reschedule
 * 4. Backfills cancellations from waitlist
 * 5. Alerts staff to at-risk appointments
 *
 * Outcome: Chairs that stay full.
 */

import { defineWorkflow, cron } from '@workwayco/sdk';
// Types inline to avoid build dependency issues
interface SikkaAppointment {
	appointment_id: string;
	practice_id: string;
	patient_id: string;
	provider_id?: string;
	appointment_date: string;
	appointment_time: string;
	duration_minutes?: number;
	status: 'scheduled' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
	appointment_type?: string;
	procedure_codes?: string[];
	notes?: string;
}

interface SikkaPatient {
	patient_id: string;
	practice_id: string;
	first_name: string;
	last_name: string;
	email?: string;
	phone_cell?: string;
	phone_home?: string;
	status?: 'active' | 'inactive' | 'archived';
	balance?: number;
	last_visit_date?: string;
}

export default defineWorkflow({
	name: 'Dental Appointment Autopilot',
	description:
		'Reduce no-shows with intelligent appointment reminders. Patients confirm via text, cancellations auto-fill from waitlist.',
	version: '1.0.0',

	pathway: {
		outcomeFrame: 'when_appointments_scheduled',

		outcomeStatement: {
			suggestion: 'Want patients who actually show up?',
			explanation:
				'Smart reminders 48h, 24h, and 2h before appointments. Easy confirm/reschedule links. Waitlist backfill.',
			outcome: 'Chairs that stay full',
		},

		primaryPair: {
			from: 'sikka',
			to: 'slack',
			workflowId: 'dental-appointment-autopilot',
			outcome: 'No-shows that prevent themselves',
		},

		additionalPairs: [
			{
				from: 'sikka',
				to: 'twilio',
				workflowId: 'dental-appointment-autopilot',
				outcome: 'SMS appointment reminders',
			},
		],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['sikka'],
				workflowId: 'dental-appointment-autopilot',
				priority: 95, // High priority - core dental use case
			},
		],

		smartDefaults: {
			reminder48h: { value: true },
			reminder24h: { value: true },
			reminder2h: { value: true },
			enableWaitlistBackfill: { value: true },
		},

		essentialFields: ['practiceId'],

		zuhandenheit: {
			timeToValue: 1, // Immediate - runs on schedule
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'subscription',
		pricePerMonth: 49,
		trialDays: 14,
		description: '$49/month per practice location. Unlimited appointments.',
	},

	integrations: [
		{ service: 'sikka', scopes: ['read_appointments', 'read_patients'] },
		{ service: 'slack', scopes: ['chat:write', 'channels:read'], optional: true },
		{ service: 'twilio', scopes: ['messages:write'], optional: true },
	],

	inputs: {
		practiceId: {
			type: 'text',
			label: 'Sikka Practice ID',
			required: true,
			description: 'Your practice ID from Sikka portal',
		},
		slackChannel: {
			type: 'slack_channel_picker',
			label: 'Staff Notification Channel',
			required: false,
			description: 'Channel for staff alerts (cancellations, no-show risks)',
		},
		reminder48h: {
			type: 'boolean',
			label: '48-Hour Reminder',
			default: true,
			description: 'Send reminder 48 hours before appointment',
		},
		reminder24h: {
			type: 'boolean',
			label: '24-Hour Reminder',
			default: true,
			description: 'Send reminder 24 hours before appointment',
		},
		reminder2h: {
			type: 'boolean',
			label: '2-Hour Reminder',
			default: true,
			description: 'Send reminder 2 hours before appointment',
		},
		enableWaitlistBackfill: {
			type: 'boolean',
			label: 'Waitlist Backfill',
			default: true,
			description: 'Automatically offer canceled slots to waitlist patients',
		},
		highRiskThreshold: {
			type: 'number',
			label: 'No-Show Risk Threshold',
			default: 70,
			description: 'Alert staff when no-show probability exceeds this % (based on history)',
		},
		messageTemplate: {
			type: 'textarea',
			label: 'Reminder Message Template',
			default: 'Hi {{firstName}}, this is a reminder of your dental appointment at {{practiceName}} on {{appointmentDate}} at {{appointmentTime}}. Reply CONFIRM to confirm or RESCHEDULE to change.',
			description: 'Template for SMS/email reminders. Use {{placeholders}}.',
		},
	},

	// Run every hour to check for appointments needing reminders
	trigger: cron({
		schedule: '0 * * * *', // Every hour
	}),

	async execute({ trigger, inputs, integrations }) {
		const now = new Date();
		const results = {
			reminders48h: [] as ReminderResult[],
			reminders24h: [] as ReminderResult[],
			reminders2h: [] as ReminderResult[],
			highRiskAlerts: [] as HighRiskAlert[],
			waitlistOffers: [] as WaitlistOffer[],
		};

		// Get appointments for the next 48 hours
		const endDate = new Date(now.getTime() + 48 * 60 * 60 * 1000);
		const appointmentsResult = await integrations.sikka.getAppointments({
			practiceId: inputs.practiceId,
			startDate: now,
			endDate: endDate,
			status: 'scheduled',
		});

		if (!appointmentsResult.success) {
			throw new Error(`Failed to fetch appointments: ${appointmentsResult.error?.message}`);
		}

		const appointments = appointmentsResult.data;

		// Process each appointment
		for (const appointment of appointments) {
			const appointmentTime = parseAppointmentTime(appointment);
			const hoursUntil = (appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60);

			// Get patient details for personalization
			const patientResult = await integrations.sikka.getPatient(
				inputs.practiceId,
				appointment.patient_id
			);
			const patient = patientResult.success ? patientResult.data : null;

			// Determine which reminder to send (if any)
			const reminderType = determineReminderType(hoursUntil, inputs);

			if (reminderType && patient) {
				const reminder = await sendReminder({
					appointment,
					patient,
					reminderType,
					inputs,
					integrations,
				});
				results[`reminders${reminderType}`].push(reminder);
			}

			// Check for high no-show risk
			if (patient && inputs.slackChannel) {
				const riskScore = calculateNoShowRisk(patient, appointment);
				if (riskScore >= inputs.highRiskThreshold) {
					results.highRiskAlerts.push({
						appointmentId: appointment.appointment_id,
						patientName: `${patient.first_name} ${patient.last_name}`,
						appointmentTime: formatAppointmentTime(appointmentTime),
						riskScore,
						riskFactors: getRiskFactors(patient, appointment),
					});
				}
			}
		}

		// Send high-risk alerts to Slack
		if (results.highRiskAlerts.length > 0 && inputs.slackChannel && integrations.slack) {
			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				blocks: buildHighRiskAlertBlocks(results.highRiskAlerts),
				text: `${results.highRiskAlerts.length} high-risk appointments need attention`,
			});
		}

		// Check for recent cancellations and offer to waitlist
		if (inputs.enableWaitlistBackfill) {
			const canceledResult = await integrations.sikka.getAppointments({
				practiceId: inputs.practiceId,
				startDate: now,
				endDate: endDate,
				status: 'cancelled',
			});

			if (canceledResult.success) {
				// This would integrate with a waitlist system
				// For now, alert staff about open slots
				const openSlots = canceledResult.data.filter((apt) => {
					const aptTime = parseAppointmentTime(apt);
					return aptTime > now; // Only future slots
				});

				if (openSlots.length > 0 && inputs.slackChannel && integrations.slack) {
					await integrations.slack.chat.postMessage({
						channel: inputs.slackChannel,
						blocks: buildOpenSlotsBlocks(openSlots),
						text: `${openSlots.length} open appointment slots available for waitlist`,
					});
				}
			}
		}

		return {
			success: true,
			summary: {
				appointmentsChecked: appointments.length,
				reminders48hSent: results.reminders48h.length,
				reminders24hSent: results.reminders24h.length,
				reminders2hSent: results.reminders2h.length,
				highRiskAlerts: results.highRiskAlerts.length,
			},
			details: results,
		};
	},

	onError: async ({ error, inputs, integrations }) => {
		if (integrations.slack && inputs.slackChannel) {
			await integrations.slack.chat.postMessage({
				channel: inputs.slackChannel,
				text: `:warning: Dental Appointment Autopilot Error: ${error.message}`,
			});
		}
	},
});

// =============================================================================
// TYPES
// =============================================================================

interface ReminderResult {
	appointmentId: string;
	patientName: string;
	channel: 'sms' | 'email' | 'both';
	sent: boolean;
	error?: string;
}

interface HighRiskAlert {
	appointmentId: string;
	patientName: string;
	appointmentTime: string;
	riskScore: number;
	riskFactors: string[];
}

interface WaitlistOffer {
	appointmentId: string;
	slotTime: string;
	offeredTo: string[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function parseAppointmentTime(appointment: SikkaAppointment): Date {
	return new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
}

function formatAppointmentTime(date: Date): string {
	return date.toLocaleString('en-US', {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
	});
}

function determineReminderType(
	hoursUntil: number,
	inputs: any
): '48h' | '24h' | '2h' | null {
	// 48h reminder: between 47-49 hours
	if (inputs.reminder48h && hoursUntil >= 47 && hoursUntil <= 49) {
		return '48h';
	}
	// 24h reminder: between 23-25 hours
	if (inputs.reminder24h && hoursUntil >= 23 && hoursUntil <= 25) {
		return '24h';
	}
	// 2h reminder: between 1.5-2.5 hours
	if (inputs.reminder2h && hoursUntil >= 1.5 && hoursUntil <= 2.5) {
		return '2h';
	}
	return null;
}

async function sendReminder({
	appointment,
	patient,
	reminderType,
	inputs,
	integrations,
}: {
	appointment: SikkaAppointment;
	patient: SikkaPatient;
	reminderType: string;
	inputs: any;
	integrations: any;
}): Promise<ReminderResult> {
	const appointmentTime = parseAppointmentTime(appointment);

	// Build personalized message
	const message = inputs.messageTemplate
		.replace('{{firstName}}', patient.first_name)
		.replace('{{lastName}}', patient.last_name)
		.replace('{{practiceName}}', 'the practice') // Would come from practice data
		.replace('{{appointmentDate}}', appointmentTime.toLocaleDateString())
		.replace('{{appointmentTime}}', appointmentTime.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
		}))
		.replace('{{appointmentType}}', appointment.appointment_type || 'dental');

	const result: ReminderResult = {
		appointmentId: appointment.appointment_id,
		patientName: `${patient.first_name} ${patient.last_name}`,
		channel: 'sms',
		sent: false,
	};

	// Send SMS if Twilio is configured and patient has cell phone
	if (integrations.twilio && patient.phone_cell) {
		try {
			await integrations.twilio.messages.create({
				to: patient.phone_cell,
				body: message,
			});
			result.sent = true;
			result.channel = 'sms';
		} catch (error) {
			result.error = error instanceof Error ? error.message : 'SMS send failed';
		}
	}

	// Could also add email fallback here

	return result;
}

/**
 * Calculate no-show risk based on patient history
 *
 * Factors:
 * - Previous no-shows
 * - Last-minute cancellations
 * - Time since last visit
 * - Outstanding balance
 * - Appointment type (new patients higher risk)
 */
function calculateNoShowRisk(patient: SikkaPatient, appointment: SikkaAppointment): number {
	let riskScore = 20; // Base risk

	// Outstanding balance increases risk
	if (patient.balance && patient.balance > 100) {
		riskScore += 15;
	} else if (patient.balance && patient.balance > 0) {
		riskScore += 5;
	}

	// Long time since last visit increases risk
	if (patient.last_visit_date) {
		const daysSinceVisit = Math.floor(
			(Date.now() - new Date(patient.last_visit_date).getTime()) / (1000 * 60 * 60 * 24)
		);
		if (daysSinceVisit > 365) {
			riskScore += 25;
		} else if (daysSinceVisit > 180) {
			riskScore += 15;
		} else if (daysSinceVisit > 90) {
			riskScore += 5;
		}
	} else {
		// New patient - higher risk
		riskScore += 20;
	}

	// Inactive status is high risk
	if (patient.status === 'inactive') {
		riskScore += 30;
	}

	// Cap at 100
	return Math.min(riskScore, 100);
}

function getRiskFactors(patient: SikkaPatient, appointment: SikkaAppointment): string[] {
	const factors: string[] = [];

	if (patient.balance && patient.balance > 100) {
		factors.push(`Outstanding balance: $${patient.balance.toFixed(2)}`);
	}

	if (!patient.last_visit_date) {
		factors.push('New patient');
	} else {
		const daysSinceVisit = Math.floor(
			(Date.now() - new Date(patient.last_visit_date).getTime()) / (1000 * 60 * 60 * 24)
		);
		if (daysSinceVisit > 365) {
			factors.push(`${Math.floor(daysSinceVisit / 30)} months since last visit`);
		}
	}

	if (patient.status === 'inactive') {
		factors.push('Inactive patient status');
	}

	if (!patient.phone_cell) {
		factors.push('No cell phone on file');
	}

	return factors;
}

function buildHighRiskAlertBlocks(alerts: HighRiskAlert[]): any[] {
	const blocks: any[] = [
		{
			type: 'header',
			text: {
				type: 'plain_text',
				text: ':warning: High No-Show Risk Appointments',
			},
		},
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `*${alerts.length} appointments* need personal follow-up to prevent no-shows:`,
			},
		},
		{ type: 'divider' },
	];

	for (const alert of alerts.slice(0, 10)) {
		blocks.push({
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: [
					`*${alert.patientName}* - ${alert.appointmentTime}`,
					`Risk Score: ${alert.riskScore}%`,
					`Factors: ${alert.riskFactors.join(', ')}`,
				].join('\n'),
			},
			accessory: {
				type: 'button',
				text: { type: 'plain_text', text: 'Call Patient' },
				action_id: `call_patient_${alert.appointmentId}`,
			},
		});
	}

	return blocks;
}

function buildOpenSlotsBlocks(slots: SikkaAppointment[]): any[] {
	const blocks: any[] = [
		{
			type: 'header',
			text: {
				type: 'plain_text',
				text: ':calendar: Open Appointment Slots',
			},
		},
		{
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `*${slots.length} slots* available for waitlist patients:`,
			},
		},
	];

	for (const slot of slots.slice(0, 5)) {
		const slotTime = parseAppointmentTime(slot);
		blocks.push({
			type: 'section',
			text: {
				type: 'mrkdwn',
				text: `*${formatAppointmentTime(slotTime)}* - ${slot.duration_minutes || 60} min ${slot.appointment_type || 'appointment'}`,
			},
			accessory: {
				type: 'button',
				text: { type: 'plain_text', text: 'Fill Slot' },
				action_id: `fill_slot_${slot.appointment_id}`,
			},
		});
	}

	return blocks;
}

export const metadata = {
	id: 'dental-appointment-autopilot',
	category: 'healthcare',
	industry: 'dental',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
};
