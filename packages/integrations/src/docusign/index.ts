/**
 * DocuSign Integration for WORKWAY
 *
 * Unified client for DocuSign eSignature operations: Envelopes, Templates, Recipients.
 * Designed for document workflow automation - send contracts, track signatures,
 * and trigger follow-up actions on completion.
 *
 * Zuhandenheit: "Contracts that sign themselves" not "POST /envelopes endpoint"
 *
 * @example
 * ```typescript
 * import { DocuSign } from '@workwayco/integrations/docusign';
 *
 * const docusign = new DocuSign({
 *   accessToken: tokens.docusign.access_token,
 *   accountId: tokens.docusign.account_id,
 *   basePath: tokens.docusign.base_uri,
 * });
 *
 * // Send document for signature
 * const envelope = await docusign.sendEnvelope({
 *   emailSubject: 'Please sign: Service Agreement',
 *   documents: [{ name: 'contract.pdf', content: pdfBase64 }],
 *   recipients: [{ email: 'client@example.com', name: 'Client Name' }],
 * });
 *
 * // Check envelope status
 * const status = await docusign.getEnvelope(envelope.data.envelopeId);
 *
 * // Use template for recurring documents
 * const fromTemplate = await docusign.sendFromTemplate({
 *   templateId: 'abc-123',
 *   recipients: [{ email: 'client@example.com', name: 'Client Name', roleName: 'Signer' }],
 * });
 * ```
 */

import {
	ActionResult,
	createActionResult,
	ErrorCode,
	type ActionCapabilities,
} from '@workwayco/sdk';
import {
	BaseAPIClient,
	buildQueryString,
	validateAccessToken,
	createErrorHandler,
	assertResponseOk,
} from '../core/index.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * DocuSign integration configuration
 */
export interface DocuSignConfig {
	/** OAuth access token */
	accessToken: string;
	/** DocuSign account ID */
	accountId: string;
	/** Base path from /oauth/userinfo (e.g., https://na4.docusign.net) */
	basePath: string;
	/** OAuth refresh token for automatic refresh */
	refreshToken?: string;
	/** OAuth client ID (integration key) */
	clientId?: string;
	/** OAuth client secret */
	clientSecret?: string;
	/** Callback when token is refreshed */
	onTokenRefreshed?: (accessToken: string, refreshToken?: string) => void | Promise<void>;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
}

/**
 * DocuSign Envelope (document package)
 */
export interface DSEnvelope {
	envelopeId: string;
	status: DSEnvelopeStatus;
	emailSubject: string;
	emailBlurb?: string;
	createdDateTime: string;
	sentDateTime?: string;
	completedDateTime?: string;
	voidedDateTime?: string;
	voidedReason?: string;
	statusChangedDateTime: string;
	documentsUri?: string;
	recipientsUri?: string;
	envelopeUri?: string;
	purgeState?: string;
}

/**
 * DocuSign Envelope Status
 */
export type DSEnvelopeStatus =
	| 'created'
	| 'sent'
	| 'delivered'
	| 'signed'
	| 'completed'
	| 'declined'
	| 'voided'
	| 'deleted';

/**
 * DocuSign Recipient
 */
export interface DSRecipient {
	recipientId: string;
	recipientIdGuid?: string;
	email: string;
	name: string;
	recipientType?: 'signer' | 'cc' | 'certifiedDelivery' | 'inPersonSigner' | 'editor' | 'agent';
	routingOrder?: string;
	status?: 'created' | 'sent' | 'delivered' | 'signed' | 'completed' | 'declined' | 'autoresponded';
	signedDateTime?: string;
	deliveredDateTime?: string;
	declinedDateTime?: string;
	declinedReason?: string;
	roleName?: string;
	clientUserId?: string;
	tabs?: DSTabs;
}

/**
 * DocuSign Tabs (signature fields)
 */
export interface DSTabs {
	signHereTabs?: DSTab[];
	initialHereTabs?: DSTab[];
	dateSignedTabs?: DSTab[];
	textTabs?: DSTab[];
	checkboxTabs?: DSTab[];
}

/**
 * DocuSign Tab (field)
 */
export interface DSTab {
	tabId?: string;
	tabLabel?: string;
	documentId?: string;
	recipientId?: string;
	pageNumber?: string;
	xPosition?: string;
	yPosition?: string;
	anchorString?: string;
	anchorXOffset?: string;
	anchorYOffset?: string;
	value?: string;
	locked?: string;
	required?: string;
}

/**
 * DocuSign Document
 */
export interface DSDocument {
	documentId: string;
	name: string;
	fileExtension?: string;
	order?: string;
	pages?: string;
	uri?: string;
}

/**
 * DocuSign Template
 */
export interface DSTemplate {
	templateId: string;
	name: string;
	description?: string;
	shared?: string;
	created?: string;
	lastModified?: string;
	uri?: string;
	folderName?: string;
	folderId?: string;
	owner?: {
		userName: string;
		email: string;
	};
}

/**
 * DocuSign Envelope Summary (for lists)
 */
export interface DSEnvelopeSummary {
	envelopeId: string;
	status: DSEnvelopeStatus;
	emailSubject: string;
	sentDateTime?: string;
	completedDateTime?: string;
	statusChangedDateTime: string;
}

/**
 * DocuSign User Info
 */
export interface DSUserInfo {
	sub: string;
	name: string;
	givenName: string;
	familyName: string;
	email: string;
	accounts: Array<{
		accountId: string;
		accountName: string;
		baseUri: string;
		isDefault: boolean;
	}>;
}

// ============================================================================
// OPTIONS TYPES
// ============================================================================

export interface SendEnvelopeOptions {
	/** Email subject line */
	emailSubject: string;
	/** Email body text */
	emailBlurb?: string;
	/** Documents to include */
	documents: Array<{
		/** Document name with extension */
		name: string;
		/** Base64-encoded document content */
		content: string;
		/** File extension (inferred from name if not provided) */
		fileExtension?: string;
		/** Document order (1-based) */
		order?: number;
	}>;
	/** Recipients (signers) */
	recipients: Array<{
		email: string;
		name: string;
		/** Routing order (1 = first to sign) */
		routingOrder?: number;
		/** Recipient type */
		recipientType?: 'signer' | 'cc';
		/** Embedded signing client user ID */
		clientUserId?: string;
		/** Tabs/fields for this recipient */
		tabs?: DSTabs;
	}>;
	/** Send immediately or save as draft */
	status?: 'sent' | 'created';
}

export interface SendFromTemplateOptions {
	/** Template ID */
	templateId: string;
	/** Email subject (overrides template default) */
	emailSubject?: string;
	/** Email body (overrides template default) */
	emailBlurb?: string;
	/** Template role assignments */
	recipients: Array<{
		email: string;
		name: string;
		/** Role name from template */
		roleName: string;
		/** Embedded signing client user ID */
		clientUserId?: string;
		/** Tab values to pre-fill */
		tabs?: DSTabs;
	}>;
	/** Send immediately or save as draft */
	status?: 'sent' | 'created';
}

export interface ListEnvelopesOptions {
	/** Filter by status */
	status?: DSEnvelopeStatus | 'any';
	/** From date (ISO string) */
	fromDate?: string;
	/** To date (ISO string) */
	toDate?: string;
	/** Search in subject/recipient email */
	searchText?: string;
	/** Include recipients in response */
	includeRecipients?: boolean;
	/** Maximum results (default: 100) */
	count?: number;
	/** Start position for pagination */
	startPosition?: number;
}

export interface GetSigningUrlOptions {
	/** Envelope ID */
	envelopeId: string;
	/** Recipient email */
	recipientEmail: string;
	/** Recipient name */
	recipientName: string;
	/** Client user ID (must match what was set when creating envelope) */
	clientUserId: string;
	/** Return URL after signing */
	returnUrl: string;
	/** Authentication method */
	authenticationMethod?: string;
}

export interface VoidEnvelopeOptions {
	/** Envelope ID */
	envelopeId: string;
	/** Reason for voiding */
	voidedReason: string;
}

// ============================================================================
// DOCUSIGN INTEGRATION CLASS
// ============================================================================

/** Error handler bound to DocuSign integration */
const handleError = createErrorHandler('docusign');

/**
 * DocuSign eSignature Integration
 *
 * Weniger, aber besser: Unified e-signature client for document workflow automation.
 */
export class DocuSign extends BaseAPIClient {
	private readonly accountId: string;

	constructor(config: DocuSignConfig) {
		validateAccessToken(config.accessToken, 'docusign');

		if (!config.accountId) {
			throw new Error('DocuSign account ID is required');
		}

		if (!config.basePath) {
			throw new Error('DocuSign base path is required (from /oauth/userinfo)');
		}

		// Ensure basePath ends properly for API calls
		const baseUri = config.basePath.endsWith('/')
			? config.basePath.slice(0, -1)
			: config.basePath;

		super({
			accessToken: config.accessToken,
			apiUrl: `${baseUri}/restapi/v2.1/accounts/${config.accountId}`,
			timeout: config.timeout,
			errorContext: { integration: 'docusign' },
			// Configure automatic token refresh if credentials provided
			tokenRefresh: config.refreshToken && config.clientId && config.clientSecret
				? {
						refreshToken: config.refreshToken,
						tokenEndpoint: 'https://account.docusign.com/oauth/token',
						clientId: config.clientId,
						clientSecret: config.clientSecret,
						onTokenRefreshed: config.onTokenRefreshed || (() => {}),
					}
				: undefined,
		});

		this.accountId = config.accountId;
	}

	// ==========================================================================
	// ENVELOPES
	// ==========================================================================

	/**
	 * Get an envelope by ID
	 */
	async getEnvelope(envelopeId: string): Promise<ActionResult<DSEnvelope>> {
		try {
			const response = await this.get(`/envelopes/${envelopeId}`);
			await assertResponseOk(response, { integration: 'docusign', action: 'get-envelope' });

			const envelope = (await response.json()) as DSEnvelope;

			return createActionResult({
				data: envelope,
				integration: 'docusign',
				action: 'get-envelope',
				schema: 'docusign.envelope.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-envelope');
		}
	}

	/**
	 * List envelopes with optional filters
	 */
	async listEnvelopes(options: ListEnvelopesOptions = {}): Promise<ActionResult<DSEnvelopeSummary[]>> {
		const {
			status,
			fromDate,
			toDate,
			searchText,
			includeRecipients,
			count = 100,
			startPosition = 0,
		} = options;

		try {
			// Default to last 30 days if no date specified
			const defaultFromDate = new Date();
			defaultFromDate.setDate(defaultFromDate.getDate() - 30);

			const queryParams: Record<string, string | number | boolean | undefined> = {
				from_date: fromDate || defaultFromDate.toISOString(),
				count,
				start_position: startPosition,
			};

			if (toDate) queryParams.to_date = toDate;
			if (status && status !== 'any') queryParams.status = status;
			if (searchText) queryParams.search_text = searchText;
			if (includeRecipients) queryParams.include = 'recipients';

			const response = await this.get(`/envelopes${buildQueryString(queryParams)}`);
			await assertResponseOk(response, { integration: 'docusign', action: 'list-envelopes' });

			const data = (await response.json()) as { envelopes?: DSEnvelopeSummary[] };

			return createActionResult({
				data: data.envelopes || [],
				integration: 'docusign',
				action: 'list-envelopes',
				schema: 'docusign.envelope-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-envelopes');
		}
	}

	/**
	 * Get pending envelopes (Zuhandenheit API)
	 *
	 * Outcome-focused: "Which contracts are waiting for signatures?"
	 */
	async getPendingEnvelopes(): Promise<ActionResult<DSEnvelopeSummary[]>> {
		return this.listEnvelopes({ status: 'sent' });
	}

	/**
	 * Get completed envelopes (Zuhandenheit API)
	 *
	 * Outcome-focused: "Which contracts were signed recently?"
	 */
	async getCompletedEnvelopes(days = 7): Promise<ActionResult<DSEnvelopeSummary[]>> {
		const fromDate = new Date();
		fromDate.setDate(fromDate.getDate() - days);

		return this.listEnvelopes({
			status: 'completed',
			fromDate: fromDate.toISOString(),
		});
	}

	/**
	 * Send an envelope with documents
	 */
	async sendEnvelope(options: SendEnvelopeOptions): Promise<ActionResult<DSEnvelope>> {
		const { emailSubject, emailBlurb, documents, recipients, status = 'sent' } = options;

		if (!emailSubject) {
			return ActionResult.error('Email subject is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'docusign',
				action: 'send-envelope',
			});
		}

		if (!documents || documents.length === 0) {
			return ActionResult.error('At least one document is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'docusign',
				action: 'send-envelope',
			});
		}

		if (!recipients || recipients.length === 0) {
			return ActionResult.error('At least one recipient is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'docusign',
				action: 'send-envelope',
			});
		}

		try {
			// Build documents array
			const envelopeDocuments = documents.map((doc, index) => {
				const extension = doc.fileExtension || doc.name.split('.').pop() || 'pdf';
				return {
					documentId: String(index + 1),
					name: doc.name,
					fileExtension: extension,
					documentBase64: doc.content,
					order: String(doc.order || index + 1),
				};
			});

			// Build recipients - separate signers and CCs
			const signers: Array<Record<string, unknown>> = [];
			const carbonCopies: Array<Record<string, unknown>> = [];

			recipients.forEach((recipient, index) => {
				const recipientData: Record<string, unknown> = {
					recipientId: String(index + 1),
					email: recipient.email,
					name: recipient.name,
					routingOrder: String(recipient.routingOrder || index + 1),
				};

				if (recipient.clientUserId) {
					recipientData.clientUserId = recipient.clientUserId;
				}

				if (recipient.tabs) {
					recipientData.tabs = recipient.tabs;
				}

				if (recipient.recipientType === 'cc') {
					carbonCopies.push(recipientData);
				} else {
					signers.push(recipientData);
				}
			});

			const envelopeDefinition = {
				emailSubject,
				emailBlurb,
				documents: envelopeDocuments,
				recipients: {
					signers,
					carbonCopies: carbonCopies.length > 0 ? carbonCopies : undefined,
				},
				status,
			};

			const response = await this.post('/envelopes', envelopeDefinition);
			await assertResponseOk(response, { integration: 'docusign', action: 'send-envelope' });

			const envelope = (await response.json()) as DSEnvelope;

			return createActionResult({
				data: envelope,
				integration: 'docusign',
				action: 'send-envelope',
				schema: 'docusign.envelope.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'send-envelope');
		}
	}

	/**
	 * Send an envelope from a template
	 */
	async sendFromTemplate(options: SendFromTemplateOptions): Promise<ActionResult<DSEnvelope>> {
		const { templateId, emailSubject, emailBlurb, recipients, status = 'sent' } = options;

		if (!templateId) {
			return ActionResult.error('Template ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'docusign',
				action: 'send-from-template',
			});
		}

		if (!recipients || recipients.length === 0) {
			return ActionResult.error('At least one recipient is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'docusign',
				action: 'send-from-template',
			});
		}

		try {
			const templateRoles = recipients.map((recipient, index) => {
				const role: Record<string, unknown> = {
					email: recipient.email,
					name: recipient.name,
					roleName: recipient.roleName,
				};

				if (recipient.clientUserId) {
					role.clientUserId = recipient.clientUserId;
				}

				if (recipient.tabs) {
					role.tabs = recipient.tabs;
				}

				return role;
			});

			const envelopeDefinition: Record<string, unknown> = {
				templateId,
				templateRoles,
				status,
			};

			if (emailSubject) envelopeDefinition.emailSubject = emailSubject;
			if (emailBlurb) envelopeDefinition.emailBlurb = emailBlurb;

			const response = await this.post('/envelopes', envelopeDefinition);
			await assertResponseOk(response, { integration: 'docusign', action: 'send-from-template' });

			const envelope = (await response.json()) as DSEnvelope;

			return createActionResult({
				data: envelope,
				integration: 'docusign',
				action: 'send-from-template',
				schema: 'docusign.envelope.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'send-from-template');
		}
	}

	/**
	 * Void an envelope
	 */
	async voidEnvelope(options: VoidEnvelopeOptions): Promise<ActionResult<DSEnvelope>> {
		const { envelopeId, voidedReason } = options;

		if (!envelopeId) {
			return ActionResult.error('Envelope ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'docusign',
				action: 'void-envelope',
			});
		}

		if (!voidedReason) {
			return ActionResult.error('Voided reason is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'docusign',
				action: 'void-envelope',
			});
		}

		try {
			const response = await this.put(`/envelopes/${envelopeId}`, {
				status: 'voided',
				voidedReason,
			});
			await assertResponseOk(response, { integration: 'docusign', action: 'void-envelope' });

			const envelope = (await response.json()) as DSEnvelope;

			return createActionResult({
				data: envelope,
				integration: 'docusign',
				action: 'void-envelope',
				schema: 'docusign.envelope.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'void-envelope');
		}
	}

	/**
	 * Resend envelope notifications
	 */
	async resendEnvelope(envelopeId: string): Promise<ActionResult<{ sent: boolean }>> {
		try {
			const response = await this.put(`/envelopes/${envelopeId}?resend_envelope=true`, {});
			await assertResponseOk(response, { integration: 'docusign', action: 'resend-envelope' });

			return createActionResult({
				data: { sent: true },
				integration: 'docusign',
				action: 'resend-envelope',
				schema: 'docusign.resend-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'resend-envelope');
		}
	}

	// ==========================================================================
	// RECIPIENTS
	// ==========================================================================

	/**
	 * Get envelope recipients
	 */
	async getRecipients(envelopeId: string): Promise<ActionResult<{
		signers: DSRecipient[];
		carbonCopies: DSRecipient[];
	}>> {
		try {
			const response = await this.get(`/envelopes/${envelopeId}/recipients`);
			await assertResponseOk(response, { integration: 'docusign', action: 'get-recipients' });

			const data = (await response.json()) as {
				signers?: DSRecipient[];
				carbonCopies?: DSRecipient[];
			};

			return createActionResult({
				data: {
					signers: data.signers || [],
					carbonCopies: data.carbonCopies || [],
				},
				integration: 'docusign',
				action: 'get-recipients',
				schema: 'docusign.recipients.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-recipients');
		}
	}

	// ==========================================================================
	// DOCUMENTS
	// ==========================================================================

	/**
	 * Get envelope documents list
	 */
	async getDocuments(envelopeId: string): Promise<ActionResult<DSDocument[]>> {
		try {
			const response = await this.get(`/envelopes/${envelopeId}/documents`);
			await assertResponseOk(response, { integration: 'docusign', action: 'get-documents' });

			const data = (await response.json()) as { envelopeDocuments?: DSDocument[] };

			return createActionResult({
				data: data.envelopeDocuments || [],
				integration: 'docusign',
				action: 'get-documents',
				schema: 'docusign.document-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-documents');
		}
	}

	/**
	 * Download a document (returns base64)
	 */
	async downloadDocument(envelopeId: string, documentId: string): Promise<ActionResult<{
		content: string;
		contentType: string;
	}>> {
		try {
			const response = await this.get(`/envelopes/${envelopeId}/documents/${documentId}`);
			await assertResponseOk(response, { integration: 'docusign', action: 'download-document' });

			const arrayBuffer = await response.arrayBuffer();
			const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
			const contentType = response.headers.get('content-type') || 'application/pdf';

			return createActionResult({
				data: { content: base64, contentType },
				integration: 'docusign',
				action: 'download-document',
				schema: 'docusign.document-content.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'download-document');
		}
	}

	/**
	 * Download combined documents (all in one PDF)
	 */
	async downloadCombinedDocuments(envelopeId: string): Promise<ActionResult<{
		content: string;
		contentType: string;
	}>> {
		return this.downloadDocument(envelopeId, 'combined');
	}

	// ==========================================================================
	// EMBEDDED SIGNING
	// ==========================================================================

	/**
	 * Get embedded signing URL
	 *
	 * Used for in-app signing experiences
	 */
	async getSigningUrl(options: GetSigningUrlOptions): Promise<ActionResult<{ url: string }>> {
		const { envelopeId, recipientEmail, recipientName, clientUserId, returnUrl, authenticationMethod = 'none' } = options;

		if (!envelopeId || !recipientEmail || !recipientName || !clientUserId || !returnUrl) {
			return ActionResult.error(
				'Envelope ID, recipient email, name, client user ID, and return URL are all required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'docusign', action: 'get-signing-url' }
			);
		}

		try {
			const response = await this.post(`/envelopes/${envelopeId}/views/recipient`, {
				email: recipientEmail,
				userName: recipientName,
				clientUserId,
				returnUrl,
				authenticationMethod,
			});
			await assertResponseOk(response, { integration: 'docusign', action: 'get-signing-url' });

			const data = (await response.json()) as { url: string };

			return createActionResult({
				data: { url: data.url },
				integration: 'docusign',
				action: 'get-signing-url',
				schema: 'docusign.signing-url.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-signing-url');
		}
	}

	// ==========================================================================
	// TEMPLATES
	// ==========================================================================

	/**
	 * List available templates
	 */
	async listTemplates(options: { count?: number; startPosition?: number } = {}): Promise<ActionResult<DSTemplate[]>> {
		const { count = 100, startPosition = 0 } = options;

		try {
			const response = await this.get(
				`/templates${buildQueryString({ count, start_position: startPosition })}`
			);
			await assertResponseOk(response, { integration: 'docusign', action: 'list-templates' });

			const data = (await response.json()) as { envelopeTemplates?: DSTemplate[] };

			return createActionResult({
				data: data.envelopeTemplates || [],
				integration: 'docusign',
				action: 'list-templates',
				schema: 'docusign.template-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-templates');
		}
	}

	/**
	 * Get template details
	 */
	async getTemplate(templateId: string): Promise<ActionResult<DSTemplate>> {
		try {
			const response = await this.get(`/templates/${templateId}`);
			await assertResponseOk(response, { integration: 'docusign', action: 'get-template' });

			const template = (await response.json()) as DSTemplate;

			return createActionResult({
				data: template,
				integration: 'docusign',
				action: 'get-template',
				schema: 'docusign.template.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-template');
		}
	}

	// ==========================================================================
	// WEBHOOKS (Connect)
	// ==========================================================================

	/**
	 * Verify DocuSign Connect webhook signature
	 *
	 * @param payload - Raw request body
	 * @param signature - X-DocuSign-Signature-1 header
	 * @param hmacKey - Your Connect HMAC key
	 */
	async verifyWebhook(
		payload: string,
		signature: string,
		hmacKey: string
	): Promise<ActionResult<{ valid: boolean; event: DSWebhookEvent | null }>> {
		try {
			// Compute HMAC-SHA256
			const encoder = new TextEncoder();
			const key = await crypto.subtle.importKey(
				'raw',
				encoder.encode(hmacKey),
				{ name: 'HMAC', hash: 'SHA-256' },
				false,
				['sign']
			);
			const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
			const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

			if (computedSignature !== signature) {
				return createActionResult({
					data: { valid: false, event: null },
					integration: 'docusign',
					action: 'verify-webhook',
					schema: 'docusign.webhook-result.v1',
					capabilities: this.getCapabilities(),
				});
			}

			const event = JSON.parse(payload) as DSWebhookEvent;

			return createActionResult({
				data: { valid: true, event },
				integration: 'docusign',
				action: 'verify-webhook',
				schema: 'docusign.webhook-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'verify-webhook');
		}
	}

	// ==========================================================================
	// HELPERS
	// ==========================================================================

	/**
	 * Get capabilities for DocuSign actions
	 */
	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			canHandleRichText: false,
			canHandleMarkdown: false,
			canHandleImages: false,
			canHandleAttachments: true, // DocuSign handles PDF documents
			supportsSearch: true,
			supportsPagination: true,
			supportsNesting: false,
			supportsRelations: true, // Envelopes linked to recipients, documents
			supportsMetadata: true,
		};
	}
}

// ============================================================================
// WEBHOOK TYPES
// ============================================================================

export interface DSWebhookEvent {
	event: string;
	apiVersion: string;
	uri: string;
	retryCount: number;
	configurationId: string;
	generatedDateTime: string;
	data: {
		accountId: string;
		userId: string;
		envelopeId: string;
		envelopeSummary?: {
			status: DSEnvelopeStatus;
			emailSubject: string;
			sentDateTime?: string;
			completedDateTime?: string;
			recipients?: {
				signers?: DSRecipient[];
				carbonCopies?: DSRecipient[];
			};
		};
	};
}
