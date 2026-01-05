/**
 * Calendar Availability Sync Workflow
 *
 * Automatically update Slack status based on Google Calendar events.
 * Shows "In a meeting" when busy, "Focus time" during focus blocks,
 * and clears status when free.
 *
 * ZUHANDENHEIT: The tool recedes, the outcome remains.
 * User thinks: "My status updates itself"
 *
 * Integrations: Google Calendar, Slack
 * Trigger: Cron (every 5 minutes)
 */

import { defineWorkflow, cron } from '@workwayco/sdk';

export default defineWorkflow({
	name: 'Calendar Availability Sync',
	description: 'Status that updates itself - Slack status synced to your calendar automatically',
	version: '1.0.0',

	// Pathway metadata for Heideggerian discovery model
	pathway: {
		outcomeFrame: 'always_current',

		outcomeStatement: {
			suggestion: 'Want your status to stay current?',
			explanation: 'We sync your Slack status with your Google Calendar so teammates always know your availability.',
			outcome: 'Status that updates itself',
		},

		primaryPair: {
			from: 'google-calendar',
			to: 'slack',
			workflowId: 'calendar-availability-sync',
			outcome: 'Status that updates itself',
		},

		additionalPairs: [],

		discoveryMoments: [
			{
				trigger: 'integration_connected',
				integrations: ['google-calendar', 'slack'],
				workflowId: 'calendar-availability-sync',
				priority: 80,
			},
		],

		smartDefaults: {
			syncMeetings: { value: true },
			syncFocusTime: { value: true },
			syncOOO: { value: true },
			respectExistingStatus: { value: true },
		},

		essentialFields: [],

		zuhandenheit: {
			timeToValue: 1,
			worksOutOfBox: true,
			gracefulDegradation: true,
			automaticTrigger: true,
		},
	},

	pricing: {
		model: 'free',
		description: 'Free - included with calendar integration',
	},

	integrations: [
		{ service: 'google-calendar', scopes: ['calendar.readonly', 'calendar.events'] },
		{ service: 'slack', scopes: ['users.profile:write', 'users.profile:read'] },
	],

	config: {
		// Status messages
		meeting_status: {
			type: 'text',
			label: 'Meeting Status',
			default: 'In a meeting',
			description: 'Status shown during meetings',
		},
		meeting_emoji: {
			type: 'text',
			label: 'Meeting Emoji',
			default: ':calendar:',
			description: 'Emoji for meeting status',
		},
		focus_status: {
			type: 'text',
			label: 'Focus Time Status',
			default: 'Focus time - limited availability',
			description: 'Status shown during focus blocks',
		},
		focus_emoji: {
			type: 'text',
			label: 'Focus Emoji',
			default: ':headphones:',
			description: 'Emoji for focus time',
		},
		ooo_status: {
			type: 'text',
			label: 'Out of Office Status',
			default: 'Out of office',
			description: 'Status shown during OOO events',
		},
		ooo_emoji: {
			type: 'text',
			label: 'OOO Emoji',
			default: ':palm_tree:',
			description: 'Emoji for out of office',
		},

		// Sync settings
		sync_meetings: {
			type: 'boolean',
			label: 'Sync Meetings',
			default: true,
			description: 'Update status during calendar meetings',
		},
		sync_focus_time: {
			type: 'boolean',
			label: 'Sync Focus Time',
			default: true,
			description: 'Update status during focus time blocks',
		},
		sync_o_o_o: {
			type: 'boolean',
			label: 'Sync Out of Office',
			default: true,
			description: 'Update status during OOO/vacation events',
		},

		// Behavior settings
		respect_existing_status: {
			type: 'boolean',
			label: 'Respect Manual Status',
			default: true,
			description: 'Don\'t override manually set statuses',
		},
		clear_after_event: {
			type: 'boolean',
			label: 'Clear After Event',
			default: true,
			description: 'Clear status when event ends',
		},
		include_event_title: {
			type: 'boolean',
			label: 'Include Event Title',
			default: false,
			description: 'Show meeting name in status (privacy consideration)',
		},

		// Calendar settings
		calendars_to_sync: {
			type: 'text',
			label: 'Calendar IDs',
			required: false,
			default: 'primary',
			description: 'Comma-separated calendar IDs to sync (default: primary). Find IDs in Google Calendar settings.',
		},
		ignore_declined: {
			type: 'boolean',
			label: 'Ignore Declined Events',
			default: true,
			description: 'Skip events you\'ve declined',
		},
		ignore_all_day: {
			type: 'boolean',
			label: 'Ignore All-Day Events',
			default: false,
			description: 'Skip all-day events (except OOO)',
		},

		// Working hours
		respect_working_hours: {
			type: 'boolean',
			label: 'Respect Working Hours',
			default: true,
			description: 'Only sync during working hours',
		},
		working_hours_start: {
			type: 'text',
			label: 'Working Hours Start',
			default: '09:00',
			description: 'Start of working hours (HH:MM)',
		},
		working_hours_end: {
			type: 'text',
			label: 'Working Hours End',
			default: '18:00',
			description: 'End of working hours (HH:MM)',
		},
		timezone: {
			type: 'text',
			label: 'Timezone',
			default: 'America/New_York',
			description: 'Your timezone for working hours',
		},
	},

	trigger: cron({
		schedule: '*/5 * * * *', // Every 5 minutes
		timezone: 'UTC',
	}),

	async execute({ trigger, inputs, integrations, env }) {
		const now = new Date();

		// Check working hours
		if (inputs.respectWorkingHours) {
			const inWorkingHours = isWithinWorkingHours(
				now,
				inputs.workingHoursStart,
				inputs.workingHoursEnd,
				inputs.timezone
			);

			if (!inWorkingHours) {
				return {
					success: true,
					action: 'skipped',
					reason: 'Outside working hours',
				};
			}
		}

		// Get current Slack status
		let currentStatus: { text: string; emoji: string } | null = null;
		let wasSetByUs = false;

		try {
			const profileResult = await integrations.slack.users.profile.get();
			if (profileResult.success && profileResult.data?.profile) {
				currentStatus = {
					text: profileResult.data.profile.status_text || '',
					emoji: profileResult.data.profile.status_emoji || '',
				};

				// Check if we set this status (stored in KV)
				const ourStatusKey = 'calendar:status:current';
				const ourStatus = await env.KV?.get(ourStatusKey);
				wasSetByUs = ourStatus === currentStatus.text;
			}
		} catch {
			// Continue without current status
		}

		// Respect manual status if configured
		if (inputs.respectExistingStatus && currentStatus?.text && !wasSetByUs) {
			return {
				success: true,
				action: 'skipped',
				reason: 'Manual status set',
				currentStatus: currentStatus.text,
			};
		}

		// Get current calendar events
		const eventsResult = await integrations['google-calendar'].events.list({
			timeMin: now.toISOString(),
			timeMax: new Date(now.getTime() + 30 * 60 * 1000).toISOString(), // Next 30 min
			singleEvents: true,
			orderBy: 'startTime',
		});

		let targetStatus: { text: string; emoji: string; expiration: number } | null = null;

		if (eventsResult.success && eventsResult.data?.length > 0) {
			for (const event of eventsResult.data) {
				// Skip declined events
				if (inputs.ignoreDeclined && event.attendees) {
					const self = event.attendees.find((a: any) => a.self);
					if (self?.responseStatus === 'declined') continue;
				}

				// Skip all-day events unless OOO
				const isAllDay = !event.start?.dateTime;
				const isOOO = isOutOfOfficeEvent(event);

				if (isAllDay && inputs.ignoreAllDay && !isOOO) continue;

				// Determine event type and status
				const eventStart = new Date(event.start?.dateTime || event.start?.date);
				const eventEnd = new Date(event.end?.dateTime || event.end?.date);

				// Check if event is happening now
				if (eventStart <= now && eventEnd > now) {
					if (isOOO && inputs.syncOOO) {
						targetStatus = {
							text: inputs.oooStatus,
							emoji: inputs.oooEmoji,
							expiration: Math.floor(eventEnd.getTime() / 1000),
						};
						break;
					} else if (isFocusTimeEvent(event) && inputs.syncFocusTime) {
						targetStatus = {
							text: inputs.includeEventTitle ? `Focus: ${event.summary}` : inputs.focusStatus,
							emoji: inputs.focusEmoji,
							expiration: Math.floor(eventEnd.getTime() / 1000),
						};
						break;
					} else if (inputs.syncMeetings) {
						targetStatus = {
							text: inputs.includeEventTitle ? `Meeting: ${event.summary}` : inputs.meetingStatus,
							emoji: inputs.meetingEmoji,
							expiration: Math.floor(eventEnd.getTime() / 1000),
						};
						break;
					}
				}
			}
		}

		// Update Slack status
		if (targetStatus) {
			try {
				await integrations.slack.users.profile.set({
					profile: {
						status_text: targetStatus.text,
						status_emoji: targetStatus.emoji,
						status_expiration: targetStatus.expiration,
					},
				});

				// Remember we set this status
				await env.KV?.put('calendar:status:current', targetStatus.text, {
					expirationTtl: 3600,
				});

				return {
					success: true,
					action: 'updated',
					status: targetStatus.text,
					emoji: targetStatus.emoji,
				};
			} catch (error) {
				return {
					success: false,
					action: 'error',
					error: error instanceof Error ? error.message : 'Unknown error',
				};
			}
		} else if (inputs.clearAfterEvent && wasSetByUs) {
			// Clear status if we set it and no event is happening
			try {
				await integrations.slack.users.profile.set({
					profile: {
						status_text: '',
						status_emoji: '',
						status_expiration: 0,
					},
				});

				await env.KV?.delete('calendar:status:current');

				return {
					success: true,
					action: 'cleared',
				};
			} catch {
				return {
					success: true,
					action: 'skipped',
					reason: 'Failed to clear status',
				};
			}
		}

		return {
			success: true,
			action: 'no_change',
			reason: 'No active events',
		};
	},
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isWithinWorkingHours(
	now: Date,
	startTime: string,
	endTime: string,
	timezone: string
): boolean {
	try {
		const options: Intl.DateTimeFormatOptions = {
			timeZone: timezone,
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
		};

		const currentTime = now.toLocaleTimeString('en-US', options);
		const [currentHour, currentMinute] = currentTime.split(':').map(Number);
		const currentMinutes = currentHour * 60 + currentMinute;

		const [startHour, startMinute] = startTime.split(':').map(Number);
		const startMinutes = startHour * 60 + startMinute;

		const [endHour, endMinute] = endTime.split(':').map(Number);
		const endMinutes = endHour * 60 + endMinute;

		return currentMinutes >= startMinutes && currentMinutes < endMinutes;
	} catch {
		return true; // Default to within working hours on error
	}
}

function isOutOfOfficeEvent(event: any): boolean {
	const title = (event.summary || '').toLowerCase();
	const oooKeywords = ['ooo', 'out of office', 'vacation', 'pto', 'holiday', 'time off'];
	return oooKeywords.some(keyword => title.includes(keyword)) ||
		event.eventType === 'outOfOffice';
}

function isFocusTimeEvent(event: any): boolean {
	const title = (event.summary || '').toLowerCase();
	const focusKeywords = ['focus', 'deep work', 'do not disturb', 'heads down', 'no meetings'];
	return focusKeywords.some(keyword => title.includes(keyword)) ||
		event.eventType === 'focusTime';
}

export const metadata = {
	id: 'calendar-availability-sync',
	category: 'productivity',
	featured: true,
	stats: { rating: 0, users: 0, reviews: 0 },
};
