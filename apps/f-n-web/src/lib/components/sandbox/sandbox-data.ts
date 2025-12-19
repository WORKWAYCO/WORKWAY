/**
 * Sample Data for Landing Page Sandbox
 *
 * Canon Principle #6: Good design is honest
 * This data represents realistic meeting transcripts and Notion databases
 * that users would actually work with.
 */

export interface SampleTranscript {
	id: string;
	title: string;
	date: number;
	synced: boolean;
}

export interface SampleDatabase {
	id: string;
	title: string;
}

export const sampleTranscripts: SampleTranscript[] = [
	{
		id: 'demo-1',
		title: 'Q4 Planning Call',
		date: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day ago
		synced: false
	},
	{
		id: 'demo-2',
		title: 'Client Kickoff - Acme Corp',
		date: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
		synced: false
	},
	{
		id: 'demo-3',
		title: 'Sprint Retrospective',
		date: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
		synced: true
	},
	{
		id: 'demo-4',
		title: '1:1 with Sarah',
		date: Date.now() - 4 * 24 * 60 * 60 * 1000, // 4 days ago
		synced: false
	},
	{
		id: 'demo-5',
		title: 'Product Demo - Enterprise',
		date: Date.now() - 5 * 24 * 60 * 60 * 1000, // 5 days ago
		synced: false
	},
	{
		id: 'demo-6',
		title: 'Team Standup',
		date: Date.now() - 6 * 24 * 60 * 60 * 1000, // 6 days ago
		synced: true
	}
];

export const sampleDatabases: SampleDatabase[] = [
	{
		id: 'db-1',
		title: 'Meeting Notes'
	},
	{
		id: 'db-2',
		title: 'Project Tracker'
	},
	{
		id: 'db-3',
		title: 'Client CRM'
	}
];

/**
 * Creates a fresh copy of sample transcripts
 * (useful for resetting sandbox state)
 */
export function getInitialTranscripts(): SampleTranscript[] {
	return sampleTranscripts.map(t => ({ ...t }));
}

/**
 * Simulated sync delay (ms) per transcript
 * Adds realism to the demo
 */
export const SYNC_DELAY_PER_ITEM = 400;
