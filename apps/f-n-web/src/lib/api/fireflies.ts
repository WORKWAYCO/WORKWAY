/**
 * Fireflies.ai GraphQL API Client
 * Fetches meeting transcripts for F→N sync
 */

const FIREFLIES_API_URL = 'https://api.fireflies.ai/graphql';

export interface FirefliesTranscript {
	id: string;
	title: string;
	date: number;
	duration: number;
	transcript_url: string;
	participants: string[];
	summary?: {
		overview?: string;
		shorthand_bullet?: string[];
		action_items?: string[];
		keywords?: string[];
	};
	sentences?: Array<{
		text: string;
		speaker_name: string;
		start_time: number;
		end_time: number;
	}>;
}

export interface FirefliesClient {
	validateApiKey(): Promise<boolean>;
	getTranscripts(options?: { limit?: number; skip?: number }): Promise<FirefliesTranscript[]>;
	getTranscript(id: string): Promise<FirefliesTranscript | null>;
}

export function createFirefliesClient(apiKey: string): FirefliesClient {
	async function query<T>(gql: string, variables?: Record<string, unknown>): Promise<T> {
		const response = await fetch(FIREFLIES_API_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({ query: gql, variables })
		});

		if (!response.ok) {
			throw new Error(`Fireflies API error: ${response.status}`);
		}

		const result = await response.json() as { data: T; errors?: Array<{ message: string }> };

		if (result.errors) {
			throw new Error(result.errors[0]?.message || 'GraphQL error');
		}

		return result.data;
	}

	return {
		async validateApiKey(): Promise<boolean> {
			try {
				await query<{ user: { email: string } }>(`
					query {
						user {
							email
						}
					}
				`);
				return true;
			} catch {
				return false;
			}
		},

		async getTranscripts(options = {}): Promise<FirefliesTranscript[]> {
			const { limit = 50, skip = 0 } = options;

			const data = await query<{ transcripts: FirefliesTranscript[] }>(`
				query GetTranscripts($limit: Int, $skip: Int) {
					transcripts(limit: $limit, skip: $skip) {
						id
						title
						date
						duration
						transcript_url
						participants
						summary {
							overview
							shorthand_bullet
							action_items
							keywords
						}
					}
				}
			`, { limit, skip });

			return data.transcripts || [];
		},

		async getTranscript(id: string): Promise<FirefliesTranscript | null> {
			const data = await query<{ transcript: FirefliesTranscript | null }>(`
				query GetTranscript($id: String!) {
					transcript(id: $id) {
						id
						title
						date
						duration
						transcript_url
						participants
						summary {
							overview
							shorthand_bullet
							action_items
							keywords
						}
						sentences {
							text
							speaker_name
							start_time
							end_time
						}
					}
				}
			`, { id });

			return data.transcript;
		}
	};
}
