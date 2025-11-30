/**
 * Gmail Integration for WORKWAY
 *
 * Demonstrates the SDK patterns:
 * - ActionResult narrow waist for output
 * - IntegrationError narrow waist for errors
 * - StandardMessage for normalized data
 * - OAuth token handling
 *
 * @example
 * ```typescript
 * import { Gmail } from '@workwayco/integrations/gmail';
 *
 * const gmail = new Gmail({ accessToken: tokens.gmail.access_token });
 *
 * // List recent emails
 * const emails = await gmail.listEmails({ maxResults: 10 });
 *
 * // Get a specific email
 * const email = await gmail.getEmail({ id: 'abc123' });
 *
 * // Send an email
 * const sent = await gmail.sendEmail({
 *   to: ['recipient@example.com'],
 *   subject: 'Hello from WORKWAY',
 *   body: 'This is a test email'
 * });
 * ```
 */

import {
	ActionResult,
	createActionResult,
	type StandardMessage,
	type ActionCapabilities,
} from '@workwayco/sdk';
import {
	IntegrationError,
	ErrorCode,
	createErrorFromResponse,
} from '@workwayco/sdk';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Gmail API email message format
 */
export interface GmailMessage {
	id: string;
	threadId: string;
	labelIds: string[];
	snippet: string;
	payload: {
		headers: Array<{ name: string; value: string }>;
		mimeType: string;
		body?: { data?: string; size: number };
		parts?: Array<{
			mimeType: string;
			body?: { data?: string; size: number };
		}>;
	};
	internalDate: string;
}

/**
 * Gmail integration configuration
 */
export interface GmailConfig {
	/** OAuth access token */
	accessToken: string;
	/** Optional: Override API endpoint (for testing) */
	apiUrl?: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
}

/**
 * Options for listing emails
 */
export interface ListEmailsOptions {
	/** Maximum number of emails to return (default: 20, max: 100) */
	maxResults?: number;
	/** Filter query (Gmail search syntax) */
	query?: string;
	/** Label to filter by */
	labelId?: string;
	/** Page token for pagination */
	pageToken?: string;
	/** Include spam and trash (default: false) */
	includeSpamTrash?: boolean;
}

/**
 * Options for getting a single email
 */
export interface GetEmailOptions {
	/** Email ID */
	id: string;
	/** Format: 'full', 'metadata', 'minimal', 'raw' */
	format?: 'full' | 'metadata' | 'minimal' | 'raw';
}

/**
 * Options for sending an email
 */
export interface SendEmailOptions {
	/** Recipients */
	to: string[];
	/** CC recipients */
	cc?: string[];
	/** BCC recipients */
	bcc?: string[];
	/** Email subject */
	subject: string;
	/** Plain text body */
	body: string;
	/** HTML body (optional) */
	htmlBody?: string;
	/** Thread ID to reply to */
	threadId?: string;
}

// ============================================================================
// GMAIL INTEGRATION CLASS
// ============================================================================

/**
 * Gmail Integration
 *
 * Implements the WORKWAY SDK patterns for Gmail API access.
 */
export class Gmail {
	private accessToken: string;
	private apiUrl: string;
	private timeout: number;

	constructor(config: GmailConfig) {
		if (!config.accessToken) {
			throw new IntegrationError(
				ErrorCode.AUTH_MISSING,
				'Gmail access token is required',
				{ integration: 'gmail', retryable: false }
			);
		}

		this.accessToken = config.accessToken;
		this.apiUrl = config.apiUrl || 'https://gmail.googleapis.com/gmail/v1';
		this.timeout = config.timeout ?? 30000;
	}

	// ==========================================================================
	// ACTIONS
	// ==========================================================================

	/**
	 * List emails from the user's inbox
	 *
	 * @returns ActionResult with list of emails
	 */
	async listEmails(options: ListEmailsOptions = {}): Promise<ActionResult<GmailMessage[]>> {
		const {
			maxResults = 20,
			query,
			labelId = 'INBOX',
			pageToken,
			includeSpamTrash = false,
		} = options;

		try {
			// Build query params
			const params = new URLSearchParams({
				maxResults: Math.min(maxResults, 100).toString(),
				labelIds: labelId,
				includeSpamTrash: includeSpamTrash.toString(),
			});

			if (query) params.set('q', query);
			if (pageToken) params.set('pageToken', pageToken);

			// Fetch message list
			const listResponse = await this.request(`/users/me/messages?${params}`);

			if (!listResponse.ok) {
				throw await createErrorFromResponse(listResponse, {
					integration: 'gmail',
					action: 'list-emails',
				});
			}

			const listData = await listResponse.json() as {
				messages?: Array<{ id: string; threadId: string }>;
				nextPageToken?: string;
				resultSizeEstimate?: number;
			};

			// If no messages, return empty array
			if (!listData.messages || listData.messages.length === 0) {
				return ActionResult.success([], {
					integration: 'gmail',
					action: 'list-emails',
					schema: 'gmail.email-list.v1',
					capabilities: this.getCapabilities(),
					metadata: {
						total: 0,
						hasMore: false,
					},
				});
			}

			// Fetch full message details for each email
			const messages = await Promise.all(
				listData.messages.map(async (msg) => {
					const msgResponse = await this.request(
						`/users/me/messages/${msg.id}?format=full`
					);
					if (!msgResponse.ok) {
						throw await createErrorFromResponse(msgResponse, {
							integration: 'gmail',
							action: 'list-emails',
						});
					}
					return msgResponse.json() as Promise<GmailMessage>;
				})
			);

			return createActionResult({
				data: messages,
				integration: 'gmail',
				action: 'list-emails',
				schema: 'gmail.email-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error: unknown) {
			if (error instanceof IntegrationError) {
				const integrationErr = error as IntegrationError;
				return ActionResult.error(integrationErr.message, integrationErr.code, {
					integration: 'gmail',
					action: 'list-emails',
				});
			}
			const errMessage = error instanceof Error ? error.message : String(error);
			return ActionResult.error(
				`Failed to list emails: ${errMessage}`,
				ErrorCode.API_ERROR,
				{ integration: 'gmail', action: 'list-emails' }
			);
		}
	}

	/**
	 * Get a single email by ID
	 *
	 * @returns ActionResult with email data and StandardMessage format
	 */
	async getEmail(options: GetEmailOptions): Promise<ActionResult<GmailMessage>> {
		const { id, format = 'full' } = options;

		try {
			const response = await this.request(
				`/users/me/messages/${id}?format=${format}`
			);

			if (!response.ok) {
				throw await createErrorFromResponse(response, {
					integration: 'gmail',
					action: 'get-email',
				});
			}

			const message = await response.json() as GmailMessage;

			// Also provide standardized format
			const standard = this.toStandardMessage(message);

			return createActionResult({
				data: message,
				integration: 'gmail',
				action: 'get-email',
				schema: 'gmail.email.v1',
				capabilities: this.getCapabilities(),
				standard,
			});
		} catch (error: unknown) {
			if (error instanceof IntegrationError) {
				const integrationErr = error as IntegrationError;
				return ActionResult.error(integrationErr.message, integrationErr.code, {
					integration: 'gmail',
					action: 'get-email',
				});
			}
			const errMessage = error instanceof Error ? error.message : String(error);
			return ActionResult.error(
				`Failed to get email: ${errMessage}`,
				ErrorCode.API_ERROR,
				{ integration: 'gmail', action: 'get-email' }
			);
		}
	}

	/**
	 * Send an email
	 *
	 * @returns ActionResult with sent message info
	 */
	async sendEmail(options: SendEmailOptions): Promise<ActionResult<{ id: string; threadId: string }>> {
		const { to, cc, bcc, subject, body, htmlBody, threadId } = options;

		// Validate inputs
		if (!to || to.length === 0) {
			return ActionResult.error(
				'At least one recipient is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'gmail', action: 'send-email' }
			);
		}

		if (!subject) {
			return ActionResult.error(
				'Subject is required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'gmail', action: 'send-email' }
			);
		}

		try {
			// Build RFC 2822 email message
			const messageParts = [
				`To: ${to.join(', ')}`,
				cc ? `Cc: ${cc.join(', ')}` : '',
				bcc ? `Bcc: ${bcc.join(', ')}` : '',
				`Subject: ${subject}`,
				'MIME-Version: 1.0',
				htmlBody
					? 'Content-Type: multipart/alternative; boundary="boundary"'
					: 'Content-Type: text/plain; charset=utf-8',
				'',
			].filter(Boolean);

			if (htmlBody) {
				messageParts.push(
					'--boundary',
					'Content-Type: text/plain; charset=utf-8',
					'',
					body,
					'--boundary',
					'Content-Type: text/html; charset=utf-8',
					'',
					htmlBody,
					'--boundary--'
				);
			} else {
				messageParts.push(body);
			}

			const rawMessage = messageParts.join('\r\n');
			const encodedMessage = this.base64UrlEncode(rawMessage);

			// Build request body
			const requestBody: { raw: string; threadId?: string } = { raw: encodedMessage };
			if (threadId) {
				requestBody.threadId = threadId;
			}

			// Send the email
			const response = await this.request('/users/me/messages/send', {
				method: 'POST',
				body: JSON.stringify(requestBody),
			});

			if (!response.ok) {
				throw await createErrorFromResponse(response, {
					integration: 'gmail',
					action: 'send-email',
				});
			}

			const result = await response.json() as { id: string; threadId: string };

			return ActionResult.success(result, {
				integration: 'gmail',
				action: 'send-email',
				schema: 'gmail.send-result.v1',
				capabilities: { canHandleText: true, canHandleHtml: !!htmlBody },
			});
		} catch (error: unknown) {
			if (error instanceof IntegrationError) {
				const integrationErr = error as IntegrationError;
				return ActionResult.error(integrationErr.message, integrationErr.code, {
					integration: 'gmail',
					action: 'send-email',
				});
			}
			const errMessage = error instanceof Error ? error.message : String(error);
			return ActionResult.error(
				`Failed to send email: ${errMessage}`,
				ErrorCode.API_ERROR,
				{ integration: 'gmail', action: 'send-email' }
			);
		}
	}

	/**
	 * Search emails with query
	 *
	 * @returns ActionResult with matching emails
	 */
	async searchEmails(query: string, maxResults = 20): Promise<ActionResult<GmailMessage[]>> {
		return this.listEmails({ query, maxResults });
	}

	// ==========================================================================
	// HELPERS
	// ==========================================================================

	/**
	 * Make authenticated request to Gmail API with timeout
	 */
	private async request(path: string, options: RequestInit = {}): Promise<Response> {
		const url = `${this.apiUrl}${path}`;

		const headers = new Headers(options.headers);
		headers.set('Authorization', `Bearer ${this.accessToken}`);
		headers.set('Content-Type', 'application/json');

		// Add timeout via AbortController
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			return await fetch(url, {
				...options,
				headers,
				signal: controller.signal,
			});
		} finally {
			clearTimeout(timeoutId);
		}
	}

	/**
	 * Get capabilities for Gmail actions
	 */
	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			canHandleHtml: true,
			// Note: Attachment downloading not yet implemented - only text content extracted
			canHandleAttachments: false,
			supportsSearch: true,
			supportsPagination: true,
		};
	}

	/**
	 * Convert Gmail message to StandardMessage format
	 */
	private toStandardMessage(message: GmailMessage): StandardMessage {
		const headers = message.payload.headers.reduce(
			(acc, h) => ({ ...acc, [h.name.toLowerCase()]: h.value }),
			{} as Record<string, string>
		);

		// Extract body text
		let bodyText = '';
		let bodyHtml = '';

		if (message.payload.body?.data) {
			bodyText = this.base64UrlDecode(message.payload.body.data);
		} else if (message.payload.parts) {
			for (const part of message.payload.parts) {
				if (part.mimeType === 'text/plain' && part.body?.data) {
					bodyText = this.base64UrlDecode(part.body.data);
				} else if (part.mimeType === 'text/html' && part.body?.data) {
					bodyHtml = this.base64UrlDecode(part.body.data);
				}
			}
		}

		return {
			type: 'message',
			id: message.id,
			title: headers['subject'] || '(no subject)',
			body: bodyText || bodyHtml,
			bodyText,
			bodyHtml,
			from: headers['from'],
			to: headers['to']?.split(',').map((e) => e.trim()),
			cc: headers['cc']?.split(',').map((e) => e.trim()),
			timestamp: parseInt(message.internalDate, 10),
			metadata: {
				threadId: message.threadId,
				labelIds: message.labelIds,
				snippet: message.snippet,
			},
		};
	}

	/**
	 * Base64 URL-safe encode (for email content)
	 */
	private base64UrlEncode(str: string): string {
		const base64 = btoa(unescape(encodeURIComponent(str)));
		return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
	}

	/**
	 * Base64 URL-safe decode (for email content)
	 */
	private base64UrlDecode(str: string): string {
		const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
		const padded = base64 + '=='.substring(0, (4 - (base64.length % 4)) % 4);
		return decodeURIComponent(escape(atob(padded)));
	}
}
