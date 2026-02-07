/**
 * Oracle Textura Payment Management API Integration for WORKWAY
 *
 * Construction payment lifecycle management.
 * Covers payment exports, invoice management, contract imports,
 * change orders, owner fundings, compliance documents, and ERP sync.
 *
 * Zuhandenheit: Accounting teams don't want "export endpoints" - they want:
 * - Payments that reconcile with the ERP automatically
 * - Invoice rejections handled before they hold up the job
 * - Compliance documents that never go missing
 * - Pay app status visible across every stakeholder
 *
 * @example
 * ```typescript
 * import { OracleTextura } from '@workwayco/integrations/oracle-textura';
 *
 * const textura = new OracleTextura({
 *   baseUrl: 'https://textura.example.com',
 *   accessToken: process.env.TEXTURA_TOKEN,
 * });
 *
 * // Export payments
 * const payments = await textura.exportPayments();
 *
 * // Sync ERP records
 * const sync = await textura.syncERPRecords(records);
 * ```
 */

import {
	ActionResult,
	createActionResult,
	ErrorCode,
	IntegrationError,
	type ActionCapabilities,
} from '@workwayco/sdk';
import { BaseAPIClient } from '../core/index.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Oracle Textura integration configuration
 *
 * Authentication: Username/password or Bearer token
 * Requires existing Oracle Textura customer relationship
 */
export interface OracleTexturaConfig {
	/** Textura API base URL */
	baseUrl: string;
	/** Pre-authenticated access token */
	accessToken?: string;
	/** Username (for auth) */
	username?: string;
	/** Password (for auth) */
	password?: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
}

// ----------------------------------------------------------------------------
// Payment Resources
// ----------------------------------------------------------------------------

/** Payment record */
export interface TexturaPayment {
	paymentId: string;
	projectId: string;
	projectName?: string;
	contractorId: string;
	contractorName?: string;
	amount: number;
	paymentDate?: string;
	status: string;
	invoiceNumber?: string;
	retainageAmount?: number;
	netPayment?: number;
	checkNumber?: string;
	paymentMethod?: string;
}

/** Invoice record */
export interface TexturaInvoice {
	invoiceId: string;
	projectId: string;
	contractorId: string;
	invoiceNumber: string;
	amount: number;
	submittedDate?: string;
	approvedDate?: string;
	rejectedDate?: string;
	status: string;
	rejectionReason?: string;
	lineItems?: TexturaInvoiceLineItem[];
}

/** Invoice line item */
export interface TexturaInvoiceLineItem {
	lineNumber: number;
	description: string;
	amount: number;
	costCode?: string;
	retainage?: number;
}

// ----------------------------------------------------------------------------
// Contract Resources
// ----------------------------------------------------------------------------

/** Contract record */
export interface TexturaContract {
	contractId: string;
	projectId: string;
	contractorId: string;
	contractorName?: string;
	description?: string;
	originalAmount: number;
	approvedChangeOrders?: number;
	revisedAmount?: number;
	billedToDate?: number;
	paidToDate?: number;
	retainageBalance?: number;
	status: string;
}

/** Change order */
export interface TexturaChangeOrder {
	changeOrderId: string;
	contractId: string;
	description?: string;
	amount: number;
	status: string;
	requestedDate?: string;
	approvedDate?: string;
	reason?: string;
}

// ----------------------------------------------------------------------------
// Document Resources
// ----------------------------------------------------------------------------

/** Compliance/supporting document */
export interface TexturaDocument {
	documentId: string;
	projectId: string;
	contractorId?: string;
	documentType: string;
	fileName: string;
	fileSize?: number;
	uploadDate: string;
	expirationDate?: string;
	status: string;
}

/** Document metadata */
export interface TexturaDocumentMeta {
	documentId: string;
	documentType: string;
	fileName: string;
	mimeType?: string;
	fileSize?: number;
	uploadDate: string;
	uploadedBy?: string;
}

// ----------------------------------------------------------------------------
// Compliance Resources
// ----------------------------------------------------------------------------

/** Compliance tracking item */
export interface TexturaComplianceItem {
	complianceId: string;
	projectId: string;
	contractorId: string;
	requirementType: string;
	status: string;
	dueDate?: string;
	completedDate?: string;
	documentId?: string;
}

// ============================================================================
// OPTIONS TYPES
// ============================================================================

export interface ExportPaymentsOptions {
	projectId?: string;
	startDate?: string;
	endDate?: string;
	status?: string;
}

export interface ImportContractsOptions {
	contracts: Array<{
		projectId: string;
		contractorId: string;
		description?: string;
		amount: number;
	}>;
}

export interface ImportChangeOrdersOptions {
	changeOrders: Array<{
		contractId: string;
		description?: string;
		amount: number;
		reason?: string;
	}>;
}

export interface ImportOwnerFundingsOptions {
	fundings: Array<{
		projectId: string;
		amount: number;
		fundingDate: string;
		description?: string;
	}>;
}

// ============================================================================
// ORACLE TEXTURA INTEGRATION CLASS
// ============================================================================

/**
 * Oracle Textura Payment Management API Integration
 *
 * Weniger, aber besser: Construction payment lifecycle management.
 *
 * API: REST (JSON over HTTPS)
 * Auth: Username/password or Bearer token
 * Rate Limit: Not publicly documented
 * Access: Existing Oracle Textura customer required
 */
export class OracleTextura extends BaseAPIClient {
	constructor(config: OracleTexturaConfig) {
		if (!config.baseUrl) {
			throw new IntegrationError(
				ErrorCode.MISSING_REQUIRED_FIELD,
				'Oracle Textura base URL is required',
				{ integration: 'oracle-textura' }
			);
		}

		super({
			accessToken: config.accessToken || 'pending-auth',
			apiUrl: config.baseUrl,
			timeout: config.timeout,
			errorContext: { integration: 'oracle-textura' },
		});
	}

	// ==========================================================================
	// PAYMENT EXPORTS
	// ==========================================================================

	async exportPayments(options: ExportPaymentsOptions = {}): Promise<ActionResult<TexturaPayment[]>> {
		try {
			const result = await this.postJson<TexturaPayment[]>(
				'/api/v1/export/payments',
				{
					projectId: options.projectId,
					startDate: options.startDate,
					endDate: options.endDate,
					status: options.status,
				}
			);

			return createActionResult({
				data: result,
				integration: 'oracle-textura',
				action: 'export-payments',
				schema: 'oracle-textura.payments.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'export-payments');
		}
	}

	async getPaymentStatus(jobId: string): Promise<ActionResult<Record<string, unknown>>> {
		try {
			const result = await this.getJson<Record<string, unknown>>(
				`/api/v1/export/payments/${jobId}`
			);

			return createActionResult({
				data: result,
				integration: 'oracle-textura',
				action: 'get-payment-status',
				schema: 'oracle-textura.payment-status.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-payment-status');
		}
	}

	// ==========================================================================
	// INVOICE MANAGEMENT
	// ==========================================================================

	async exportInvoiceRejections(): Promise<ActionResult<TexturaInvoice[]>> {
		try {
			const result = await this.getJson<TexturaInvoice[]>('/api/v1/export/invoice-rejections');

			return createActionResult({
				data: result,
				integration: 'oracle-textura',
				action: 'export-invoice-rejections',
				schema: 'oracle-textura.invoices.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'export-invoice-rejections');
		}
	}

	// ==========================================================================
	// DOCUMENT MANAGEMENT
	// ==========================================================================

	async exportDocuments(projectId?: string): Promise<ActionResult<TexturaDocument[]>> {
		try {
			const body = projectId ? { projectId } : {};
			const result = await this.postJson<TexturaDocument[]>(
				'/api/v1/export/documents',
				body
			);

			return createActionResult({
				data: result,
				integration: 'oracle-textura',
				action: 'export-documents',
				schema: 'oracle-textura.documents.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'export-documents');
		}
	}

	async getDocumentMeta(documentId: string): Promise<ActionResult<TexturaDocumentMeta>> {
		try {
			const result = await this.getJson<TexturaDocumentMeta>(
				`/api/v1/document-meta/${documentId}`
			);

			return createActionResult({
				data: result,
				integration: 'oracle-textura',
				action: 'get-document-meta',
				schema: 'oracle-textura.document-meta.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-document-meta');
		}
	}

	async getDocumentFile(documentId: string): Promise<ActionResult<Response>> {
		try {
			const response = await this.get(`/api/v1/document-file/${documentId}`);

			return createActionResult({
				data: response,
				integration: 'oracle-textura',
				action: 'get-document-file',
				schema: 'oracle-textura.document-file.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-document-file');
		}
	}

	// ==========================================================================
	// CONTRACT IMPORTS
	// ==========================================================================

	async importContracts(options: ImportContractsOptions): Promise<ActionResult<Record<string, unknown>>> {
		try {
			const result = await this.postJson<Record<string, unknown>>(
				'/api/v1/import/insert-contracts',
				options.contracts
			);

			return createActionResult({
				data: result,
				integration: 'oracle-textura',
				action: 'import-contracts',
				schema: 'oracle-textura.import-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'import-contracts');
		}
	}

	async importChangeOrders(options: ImportChangeOrdersOptions): Promise<ActionResult<Record<string, unknown>>> {
		try {
			const result = await this.postJson<Record<string, unknown>>(
				'/api/v1/import/changeorders',
				options.changeOrders
			);

			return createActionResult({
				data: result,
				integration: 'oracle-textura',
				action: 'import-change-orders',
				schema: 'oracle-textura.import-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'import-change-orders');
		}
	}

	// ==========================================================================
	// OWNER FUNDINGS
	// ==========================================================================

	async importOwnerFundings(options: ImportOwnerFundingsOptions): Promise<ActionResult<Record<string, unknown>>> {
		try {
			const result = await this.postJson<Record<string, unknown>>(
				'/api/v2/owner-fundings',
				options.fundings
			);

			return createActionResult({
				data: result,
				integration: 'oracle-textura',
				action: 'import-owner-fundings',
				schema: 'oracle-textura.import-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'import-owner-fundings');
		}
	}

	async importCashReceipts(receipts: Array<Record<string, unknown>>): Promise<ActionResult<Record<string, unknown>>> {
		try {
			const result = await this.postJson<Record<string, unknown>>(
				'/api/v2/owner-funding-checks',
				receipts
			);

			return createActionResult({
				data: result,
				integration: 'oracle-textura',
				action: 'import-cash-receipts',
				schema: 'oracle-textura.import-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'import-cash-receipts');
		}
	}

	// ==========================================================================
	// ERP SYNC
	// ==========================================================================

	async syncERPRecords(records: Array<Record<string, unknown>>): Promise<ActionResult<Record<string, unknown>>> {
		try {
			const result = await this.postJson<Record<string, unknown>>(
				'/api/v2/erp-records',
				records
			);

			return createActionResult({
				data: result,
				integration: 'oracle-textura',
				action: 'sync-erp-records',
				schema: 'oracle-textura.erp-sync.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'sync-erp-records');
		}
	}

	// ==========================================================================
	// HELPERS
	// ==========================================================================

	private handleError(error: unknown, action: string): ActionResult<never> {
		if (error instanceof IntegrationError) {
			return ActionResult.error(error.message, error.code, {
				integration: 'oracle-textura',
				action,
			});
		}

		const message = error instanceof Error ? error.message : String(error);
		return ActionResult.error(message, ErrorCode.API_ERROR, {
			integration: 'oracle-textura',
			action,
		});
	}

	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			canHandleRichText: false,
			canHandleMarkdown: false,
			canHandleImages: false,
			canHandleAttachments: true,
			supportsSearch: false,
			supportsPagination: false,
			supportsNesting: true,
			supportsRelations: true,
			supportsMetadata: true,
		};
	}
}
