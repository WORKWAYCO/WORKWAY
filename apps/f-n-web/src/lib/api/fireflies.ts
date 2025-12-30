/**
 * Fireflies.ai GraphQL API Client
 * Fetches meeting transcripts for F→N sync
 *
 * Rate limits (per Fireflies docs):
 * - Free/Pro: 50 requests/day
 * - Business/Enterprise: 60 requests/min
 */

const FIREFLIES_API_URL = 'https://api.fireflies.ai/graphql';

/** Custom error for Fireflies rate limiting */
export class FirefliesRateLimitError extends Error {
	retryAfter: Date;

	constructor(message: string, retryAfter: Date) {
		super(message);
		this.name = 'FirefliesRateLimitError';
		this.retryAfter = retryAfter;
	}
}

/** Check if an error is a rate limit error */
export function isRateLimitError(error: unknown): error is FirefliesRateLimitError {
	return error instanceof FirefliesRateLimitError;
}

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

		const result = await response.json() as {
			data: T;
			errors?: Array<{
				message: string;
				code?: string;
				extensions?: {
					code?: string;
					status?: number;
					metadata?: { retryAfter?: number };
				};
			}>;
		};

		if (result.errors) {
			const error = result.errors[0];
			const errorCode = error?.code || error?.extensions?.code;

			// Check for rate limit error
			if (errorCode === 'too_many_requests' || error?.extensions?.status === 429) {
				const retryAfterMs = error?.extensions?.metadata?.retryAfter;
				const retryAfter = retryAfterMs ? new Date(retryAfterMs) : new Date(Date.now() + 3600000); // Default 1 hour
				throw new FirefliesRateLimitError(
					error?.message || 'Rate limit exceeded',
					retryAfter
				);
			}

			throw new Error(error?.message || 'GraphQL error');
		}

		return result.data;
	}

	return {
		/**
		 * Validate API key by fetching user info
		 * @throws {FirefliesRateLimitError} if rate limited
		 * @returns true if valid, false if invalid
		 */
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
			} catch (error) {
				// Re-throw rate limit errors - they're not invalid keys
				if (isRateLimitError(error)) {
					throw error;
				}
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
