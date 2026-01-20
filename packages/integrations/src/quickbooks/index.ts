/**
 * QuickBooks Online Integration for WORKWAY
 *
 * Unified client for QuickBooks Online accounting operations: Invoices, Customers, Payments.
 * Designed for financial automation workflows - sync invoices, track payments,
 * and trigger follow-up actions.
 *
 * Zuhandenheit: "Invoices that chase themselves" not "POST /invoice endpoint"
 *
 * @example
 * ```typescript
 * import { QuickBooks } from '@workwayco/integrations/quickbooks';
 *
 * const qb = new QuickBooks({
 *   accessToken: tokens.quickbooks.access_token,
 *   realmId: tokens.quickbooks.realm_id,
 * });
 *
 * // Get overdue invoices
 * const overdue = await qb.getOverdueInvoices();
 *
 * // Create invoice
 * const invoice = await qb.createInvoice({
 *   customerId: '123',
 *   lineItems: [{ description: 'Consulting', amount: 1500 }],
 * });
 *
 * // Record payment
 * await qb.recordPayment({
 *   customerId: '123',
 *   amount: 1500,
 *   invoiceId: invoice.data.Id,
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
	verifyHmacSignature,
} from '../core/index.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * QuickBooks integration configuration
 */
export interface QuickBooksConfig {
	/** OAuth access token */
	accessToken: string;
	/** QuickBooks company ID (realm ID) */
	realmId: string;
	/** OAuth refresh token for automatic refresh */
	refreshToken?: string;
	/** OAuth client ID (required for token refresh) */
	clientId?: string;
	/** OAuth client secret (required for token refresh) */
	clientSecret?: string;
	/** Callback when token is refreshed */
	onTokenRefreshed?: (accessToken: string, refreshToken?: string) => void | Promise<void>;
	/** Optional: Override API endpoint (for testing or sandbox) */
	apiUrl?: string;
	/** Use sandbox environment */
	sandbox?: boolean;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
}

/**
 * QuickBooks Invoice
 */
export interface QBInvoice {
	Id: string;
	DocNumber?: string;
	TxnDate: string;
	DueDate?: string;
	TotalAmt: number;
	Balance: number;
	CustomerRef: {
		value: string;
		name?: string;
	};
	BillEmail?: {
		Address: string;
	};
	Line: QBInvoiceLine[];
	LinkedTxn?: Array<{
		TxnId: string;
		TxnType: string;
	}>;
	EmailStatus?: 'NotSet' | 'NeedToSend' | 'EmailSent';
	PrintStatus?: 'NotSet' | 'NeedToPrint' | 'PrintComplete';
	MetaData: {
		CreateTime: string;
		LastUpdatedTime: string;
	};
}

/**
 * QuickBooks Invoice Line Item
 */
export interface QBInvoiceLine {
	Id?: string;
	LineNum?: number;
	Description?: string;
	Amount: number;
	DetailType: 'SalesItemLineDetail' | 'SubTotalLineDetail' | 'DescriptionOnly';
	SalesItemLineDetail?: {
		ItemRef?: {
			value: string;
			name?: string;
		};
		Qty?: number;
		UnitPrice?: number;
	};
}

/**
 * QuickBooks Customer
 */
export interface QBCustomer {
	Id: string;
	DisplayName: string;
	CompanyName?: string;
	GivenName?: string;
	FamilyName?: string;
	PrimaryEmailAddr?: {
		Address: string;
	};
	PrimaryPhone?: {
		FreeFormNumber: string;
	};
	BillAddr?: QBAddress;
	Balance: number;
	Active: boolean;
	MetaData: {
		CreateTime: string;
		LastUpdatedTime: string;
	};
}

/**
 * QuickBooks Address
 */
export interface QBAddress {
	Line1?: string;
	Line2?: string;
	City?: string;
	CountrySubDivisionCode?: string;
	PostalCode?: string;
	Country?: string;
}

/**
 * QuickBooks Payment
 */
export interface QBPayment {
	Id: string;
	TxnDate: string;
	TotalAmt: number;
	CustomerRef: {
		value: string;
		name?: string;
	};
	Line?: Array<{
		Amount: number;
		LinkedTxn: Array<{
			TxnId: string;
			TxnType: string;
		}>;
	}>;
	PaymentMethodRef?: {
		value: string;
		name?: string;
	};
	DepositToAccountRef?: {
		value: string;
		name?: string;
	};
	MetaData: {
		CreateTime: string;
		LastUpdatedTime: string;
	};
}

/**
 * QuickBooks Account
 */
export interface QBAccount {
	Id: string;
	Name: string;
	AccountType: string;
	AccountSubType?: string;
	CurrentBalance: number;
	Active: boolean;
}

/**
 * QuickBooks Company Info
 */
export interface QBCompanyInfo {
	Id: string;
	CompanyName: string;
	LegalName?: string;
	CompanyAddr?: QBAddress;
	Email?: {
		Address: string;
	};
	WebAddr?: {
		URI: string;
	};
	FiscalYearStartMonth?: string;
	Country?: string;
}

/**
 * QuickBooks query response wrapper
 */
export interface QBQueryResponse<T> {
	QueryResponse: {
		Invoice?: T[];
		Customer?: T[];
		Payment?: T[];
		Account?: T[];
		startPosition?: number;
		maxResults?: number;
		totalCount?: number;
	};
}

// ============================================================================
// OPTIONS TYPES
// ============================================================================

export interface CreateInvoiceOptions {
	/** Customer ID */
	customerId: string;
	/** Line items */
	lineItems: Array<{
		description: string;
		amount: number;
		quantity?: number;
		itemId?: string;
	}>;
	/** Due date (ISO string) */
	dueDate?: string;
	/** Customer email for sending invoice */
	customerEmail?: string;
	/** Custom invoice number */
	docNumber?: string;
}

export interface UpdateInvoiceOptions {
	/** Invoice ID */
	invoiceId: string;
	/** Sync token (required for updates) */
	syncToken: string;
	/** Line items to replace */
	lineItems?: Array<{
		description: string;
		amount: number;
		quantity?: number;
	}>;
	/** New due date */
	dueDate?: string;
}

export interface ListInvoicesOptions {
	/** Filter by customer ID */
	customerId?: string;
	/** Filter by status: 'open', 'overdue', 'paid' */
	status?: 'open' | 'overdue' | 'paid';
	/** Start date for filtering (ISO string) */
	startDate?: string;
	/** End date for filtering (ISO string) */
	endDate?: string;
	/** Maximum results (default: 100, max: 1000) */
	limit?: number;
	/** Start position for pagination */
	offset?: number;
}

export interface CreateCustomerOptions {
	/** Display name (required) */
	displayName: string;
	/** Company name */
	companyName?: string;
	/** First name */
	givenName?: string;
	/** Last name */
	familyName?: string;
	/** Email address */
	email?: string;
	/** Phone number */
	phone?: string;
	/** Billing address */
	billingAddress?: {
		line1?: string;
		city?: string;
		state?: string;
		postalCode?: string;
		country?: string;
	};
}

export interface RecordPaymentOptions {
	/** Customer ID */
	customerId: string;
	/** Payment amount */
	amount: number;
	/** Invoice ID to apply payment to */
	invoiceId?: string;
	/** Payment date (ISO string, defaults to today) */
	paymentDate?: string;
	/** Payment method ID */
	paymentMethodId?: string;
	/** Deposit to account ID */
	depositAccountId?: string;
}

export interface SearchOptions {
	/** Entity type to search */
	entity: 'Customer' | 'Invoice' | 'Payment' | 'Account';
	/** Search query (name, email, etc.) */
	query: string;
	/** Maximum results */
	limit?: number;
}

// ============================================================================
// QUICKBOOKS INTEGRATION CLASS
// ============================================================================

/** Error handler bound to QuickBooks integration */
const handleError = createErrorHandler('quickbooks');

/** QuickBooks API minor version */
const QB_MINOR_VERSION = '73';

/**
 * QuickBooks Online Integration
 *
 * Weniger, aber besser: Unified accounting client for invoice and payment automation.
 */
export class QuickBooks extends BaseAPIClient {
	private readonly realmId: string;

	constructor(config: QuickBooksConfig) {
		validateAccessToken(config.accessToken, 'quickbooks');

		if (!config.realmId) {
			throw new Error('QuickBooks realm ID (company ID) is required');
		}

		const baseUrl = config.sandbox
			? 'https://sandbox-quickbooks.api.intuit.com'
			: 'https://quickbooks.api.intuit.com';

		super({
			accessToken: config.accessToken,
			apiUrl: config.apiUrl || `${baseUrl}/v3/company/${config.realmId}`,
			timeout: config.timeout,
			errorContext: { integration: 'quickbooks' },
			// Configure automatic token refresh if credentials provided
			tokenRefresh: config.refreshToken && config.clientId && config.clientSecret
				? {
						refreshToken: config.refreshToken,
						tokenEndpoint: 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
						clientId: config.clientId,
						clientSecret: config.clientSecret,
						onTokenRefreshed: config.onTokenRefreshed || (() => {}),
					}
				: undefined,
		});

		this.realmId = config.realmId;
	}

	// ==========================================================================
	// COMPANY INFO
	// ==========================================================================

	/**
	 * Get company information
	 */
	async getCompanyInfo(): Promise<ActionResult<QBCompanyInfo>> {
		try {
			const response = await this.get(
				`/companyinfo/${this.realmId}${buildQueryString({ minorversion: QB_MINOR_VERSION })}`
			);
			await assertResponseOk(response, { integration: 'quickbooks', action: 'get-company-info' });

			const data = (await response.json()) as { CompanyInfo: QBCompanyInfo };

			return createActionResult({
				data: data.CompanyInfo,
				integration: 'quickbooks',
				action: 'get-company-info',
				schema: 'quickbooks.company-info.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-company-info');
		}
	}

	// ==========================================================================
	// INVOICES
	// ==========================================================================

	/**
	 * Get an invoice by ID
	 */
	async getInvoice(invoiceId: string): Promise<ActionResult<QBInvoice>> {
		try {
			const response = await this.get(
				`/invoice/${invoiceId}${buildQueryString({ minorversion: QB_MINOR_VERSION })}`
			);
			await assertResponseOk(response, { integration: 'quickbooks', action: 'get-invoice' });

			const data = (await response.json()) as { Invoice: QBInvoice };

			return createActionResult({
				data: data.Invoice,
				integration: 'quickbooks',
				action: 'get-invoice',
				schema: 'quickbooks.invoice.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-invoice');
		}
	}

	/**
	 * List invoices with optional filters
	 */
	async listInvoices(options: ListInvoicesOptions = {}): Promise<ActionResult<QBInvoice[]>> {
		const { customerId, status, startDate, endDate, limit = 100, offset = 1 } = options;

		try {
			// Build query conditions
			const conditions: string[] = [];

			if (customerId) {
				conditions.push(`CustomerRef = '${customerId}'`);
			}

			if (status === 'overdue') {
				const today = new Date().toISOString().split('T')[0];
				conditions.push(`DueDate < '${today}'`);
				conditions.push(`Balance > '0'`);
			} else if (status === 'open') {
				conditions.push(`Balance > '0'`);
			} else if (status === 'paid') {
				conditions.push(`Balance = '0'`);
			}

			if (startDate) {
				conditions.push(`TxnDate >= '${startDate}'`);
			}

			if (endDate) {
				conditions.push(`TxnDate <= '${endDate}'`);
			}

			const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
			const query = `SELECT * FROM Invoice${whereClause} MAXRESULTS ${limit} STARTPOSITION ${offset}`;

			const response = await this.get(
				`/query${buildQueryString({ query, minorversion: QB_MINOR_VERSION })}`
			);
			await assertResponseOk(response, { integration: 'quickbooks', action: 'list-invoices' });

			const data = (await response.json()) as QBQueryResponse<QBInvoice>;
			const invoices = data.QueryResponse.Invoice || [];

			return createActionResult({
				data: invoices,
				integration: 'quickbooks',
				action: 'list-invoices',
				schema: 'quickbooks.invoice-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-invoices');
		}
	}

	/**
	 * Get overdue invoices (Zuhandenheit API)
	 *
	 * Outcome-focused: "Which invoices need follow-up?"
	 */
	async getOverdueInvoices(): Promise<ActionResult<QBInvoice[]>> {
		return this.listInvoices({ status: 'overdue' });
	}

	/**
	 * Create an invoice
	 */
	async createInvoice(options: CreateInvoiceOptions): Promise<ActionResult<QBInvoice>> {
		const { customerId, lineItems, dueDate, customerEmail, docNumber } = options;

		if (!customerId) {
			return ActionResult.error('Customer ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'quickbooks',
				action: 'create-invoice',
			});
		}

		if (!lineItems || lineItems.length === 0) {
			return ActionResult.error('At least one line item is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'quickbooks',
				action: 'create-invoice',
			});
		}

		try {
			const invoiceData: Record<string, unknown> = {
				CustomerRef: { value: customerId },
				Line: lineItems.map((item, index) => ({
					LineNum: index + 1,
					Description: item.description,
					Amount: item.amount,
					DetailType: 'SalesItemLineDetail',
					SalesItemLineDetail: {
						Qty: item.quantity || 1,
						UnitPrice: item.amount / (item.quantity || 1),
						...(item.itemId && { ItemRef: { value: item.itemId } }),
					},
				})),
			};

			if (dueDate) {
				invoiceData.DueDate = dueDate;
			}

			if (customerEmail) {
				invoiceData.BillEmail = { Address: customerEmail };
			}

			if (docNumber) {
				invoiceData.DocNumber = docNumber;
			}

			const response = await this.post(
				`/invoice${buildQueryString({ minorversion: QB_MINOR_VERSION })}`,
				invoiceData
			);
			await assertResponseOk(response, { integration: 'quickbooks', action: 'create-invoice' });

			const data = (await response.json()) as { Invoice: QBInvoice };

			return createActionResult({
				data: data.Invoice,
				integration: 'quickbooks',
				action: 'create-invoice',
				schema: 'quickbooks.invoice.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'create-invoice');
		}
	}

	/**
	 * Send invoice by email
	 */
	async sendInvoice(invoiceId: string, email?: string): Promise<ActionResult<QBInvoice>> {
		try {
			const queryParams: Record<string, string> = { minorversion: QB_MINOR_VERSION };
			if (email) {
				queryParams.sendTo = email;
			}

			const response = await this.post(
				`/invoice/${invoiceId}/send${buildQueryString(queryParams)}`,
				{}
			);
			await assertResponseOk(response, { integration: 'quickbooks', action: 'send-invoice' });

			const data = (await response.json()) as { Invoice: QBInvoice };

			return createActionResult({
				data: data.Invoice,
				integration: 'quickbooks',
				action: 'send-invoice',
				schema: 'quickbooks.invoice.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'send-invoice');
		}
	}

	/**
	 * Void an invoice
	 */
	async voidInvoice(invoiceId: string, syncToken: string): Promise<ActionResult<QBInvoice>> {
		try {
			const response = await this.post(
				`/invoice${buildQueryString({ minorversion: QB_MINOR_VERSION, operation: 'void' })}`,
				{ Id: invoiceId, SyncToken: syncToken }
			);
			await assertResponseOk(response, { integration: 'quickbooks', action: 'void-invoice' });

			const data = (await response.json()) as { Invoice: QBInvoice };

			return createActionResult({
				data: data.Invoice,
				integration: 'quickbooks',
				action: 'void-invoice',
				schema: 'quickbooks.invoice.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'void-invoice');
		}
	}

	// ==========================================================================
	// CUSTOMERS
	// ==========================================================================

	/**
	 * Get a customer by ID
	 */
	async getCustomer(customerId: string): Promise<ActionResult<QBCustomer>> {
		try {
			const response = await this.get(
				`/customer/${customerId}${buildQueryString({ minorversion: QB_MINOR_VERSION })}`
			);
			await assertResponseOk(response, { integration: 'quickbooks', action: 'get-customer' });

			const data = (await response.json()) as { Customer: QBCustomer };

			return createActionResult({
				data: data.Customer,
				integration: 'quickbooks',
				action: 'get-customer',
				schema: 'quickbooks.customer.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-customer');
		}
	}

	/**
	 * List all customers
	 */
	async listCustomers(limit = 100, offset = 1): Promise<ActionResult<QBCustomer[]>> {
		try {
			const query = `SELECT * FROM Customer WHERE Active = true MAXRESULTS ${limit} STARTPOSITION ${offset}`;

			const response = await this.get(
				`/query${buildQueryString({ query, minorversion: QB_MINOR_VERSION })}`
			);
			await assertResponseOk(response, { integration: 'quickbooks', action: 'list-customers' });

			const data = (await response.json()) as QBQueryResponse<QBCustomer>;
			const customers = data.QueryResponse.Customer || [];

			return createActionResult({
				data: customers,
				integration: 'quickbooks',
				action: 'list-customers',
				schema: 'quickbooks.customer-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-customers');
		}
	}

	/**
	 * Search for a customer by name or email
	 */
	async searchCustomers(searchTerm: string): Promise<ActionResult<QBCustomer[]>> {
		try {
			// QuickBooks uses LIKE with % wildcards
			const query = `SELECT * FROM Customer WHERE DisplayName LIKE '%${searchTerm}%' OR PrimaryEmailAddr LIKE '%${searchTerm}%'`;

			const response = await this.get(
				`/query${buildQueryString({ query, minorversion: QB_MINOR_VERSION })}`
			);
			await assertResponseOk(response, { integration: 'quickbooks', action: 'search-customers' });

			const data = (await response.json()) as QBQueryResponse<QBCustomer>;
			const customers = data.QueryResponse.Customer || [];

			return createActionResult({
				data: customers,
				integration: 'quickbooks',
				action: 'search-customers',
				schema: 'quickbooks.customer-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'search-customers');
		}
	}

	/**
	 * Create a customer
	 */
	async createCustomer(options: CreateCustomerOptions): Promise<ActionResult<QBCustomer>> {
		const { displayName, companyName, givenName, familyName, email, phone, billingAddress } = options;

		if (!displayName) {
			return ActionResult.error('Display name is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'quickbooks',
				action: 'create-customer',
			});
		}

		try {
			const customerData: Record<string, unknown> = {
				DisplayName: displayName,
			};

			if (companyName) customerData.CompanyName = companyName;
			if (givenName) customerData.GivenName = givenName;
			if (familyName) customerData.FamilyName = familyName;
			if (email) customerData.PrimaryEmailAddr = { Address: email };
			if (phone) customerData.PrimaryPhone = { FreeFormNumber: phone };

			if (billingAddress) {
				customerData.BillAddr = {
					Line1: billingAddress.line1,
					City: billingAddress.city,
					CountrySubDivisionCode: billingAddress.state,
					PostalCode: billingAddress.postalCode,
					Country: billingAddress.country,
				};
			}

			const response = await this.post(
				`/customer${buildQueryString({ minorversion: QB_MINOR_VERSION })}`,
				customerData
			);
			await assertResponseOk(response, { integration: 'quickbooks', action: 'create-customer' });

			const data = (await response.json()) as { Customer: QBCustomer };

			return createActionResult({
				data: data.Customer,
				integration: 'quickbooks',
				action: 'create-customer',
				schema: 'quickbooks.customer.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'create-customer');
		}
	}

	// ==========================================================================
	// PAYMENTS
	// ==========================================================================

	/**
	 * Get a payment by ID
	 */
	async getPayment(paymentId: string): Promise<ActionResult<QBPayment>> {
		try {
			const response = await this.get(
				`/payment/${paymentId}${buildQueryString({ minorversion: QB_MINOR_VERSION })}`
			);
			await assertResponseOk(response, { integration: 'quickbooks', action: 'get-payment' });

			const data = (await response.json()) as { Payment: QBPayment };

			return createActionResult({
				data: data.Payment,
				integration: 'quickbooks',
				action: 'get-payment',
				schema: 'quickbooks.payment.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-payment');
		}
	}

	/**
	 * List recent payments
	 */
	async listPayments(limit = 100, offset = 1): Promise<ActionResult<QBPayment[]>> {
		try {
			const query = `SELECT * FROM Payment ORDERBY TxnDate DESC MAXRESULTS ${limit} STARTPOSITION ${offset}`;

			const response = await this.get(
				`/query${buildQueryString({ query, minorversion: QB_MINOR_VERSION })}`
			);
			await assertResponseOk(response, { integration: 'quickbooks', action: 'list-payments' });

			const data = (await response.json()) as QBQueryResponse<QBPayment>;
			const payments = data.QueryResponse.Payment || [];

			return createActionResult({
				data: payments,
				integration: 'quickbooks',
				action: 'list-payments',
				schema: 'quickbooks.payment-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-payments');
		}
	}

	/**
	 * Record a payment
	 */
	async recordPayment(options: RecordPaymentOptions): Promise<ActionResult<QBPayment>> {
		const { customerId, amount, invoiceId, paymentDate, paymentMethodId, depositAccountId } = options;

		if (!customerId) {
			return ActionResult.error('Customer ID is required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'quickbooks',
				action: 'record-payment',
			});
		}

		if (!amount || amount <= 0) {
			return ActionResult.error('Valid payment amount is required', ErrorCode.VALIDATION_ERROR, {
				integration: 'quickbooks',
				action: 'record-payment',
			});
		}

		try {
			const paymentData: Record<string, unknown> = {
				CustomerRef: { value: customerId },
				TotalAmt: amount,
				TxnDate: paymentDate || new Date().toISOString().split('T')[0],
			};

			// Link to specific invoice if provided
			if (invoiceId) {
				paymentData.Line = [
					{
						Amount: amount,
						LinkedTxn: [
							{
								TxnId: invoiceId,
								TxnType: 'Invoice',
							},
						],
					},
				];
			}

			if (paymentMethodId) {
				paymentData.PaymentMethodRef = { value: paymentMethodId };
			}

			if (depositAccountId) {
				paymentData.DepositToAccountRef = { value: depositAccountId };
			}

			const response = await this.post(
				`/payment${buildQueryString({ minorversion: QB_MINOR_VERSION })}`,
				paymentData
			);
			await assertResponseOk(response, { integration: 'quickbooks', action: 'record-payment' });

			const data = (await response.json()) as { Payment: QBPayment };

			return createActionResult({
				data: data.Payment,
				integration: 'quickbooks',
				action: 'record-payment',
				schema: 'quickbooks.payment.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'record-payment');
		}
	}

	// ==========================================================================
	// ACCOUNTS
	// ==========================================================================

	/**
	 * List chart of accounts
	 */
	async listAccounts(): Promise<ActionResult<QBAccount[]>> {
		try {
			const query = 'SELECT * FROM Account WHERE Active = true';

			const response = await this.get(
				`/query${buildQueryString({ query, minorversion: QB_MINOR_VERSION })}`
			);
			await assertResponseOk(response, { integration: 'quickbooks', action: 'list-accounts' });

			const data = (await response.json()) as QBQueryResponse<QBAccount>;
			const accounts = data.QueryResponse.Account || [];

			return createActionResult({
				data: accounts,
				integration: 'quickbooks',
				action: 'list-accounts',
				schema: 'quickbooks.account-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-accounts');
		}
	}

	// ==========================================================================
	// REPORTS (Zuhandenheit APIs)
	// ==========================================================================

	/**
	 * Get accounts receivable aging summary (Zuhandenheit API)
	 *
	 * Outcome-focused: "Who owes us money and for how long?"
	 */
	async getReceivablesAging(): Promise<ActionResult<{
		current: number;
		days1to30: number;
		days31to60: number;
		days61to90: number;
		over90: number;
		total: number;
	}>> {
		try {
			const response = await this.get(
				`/reports/AgedReceivables${buildQueryString({ minorversion: QB_MINOR_VERSION })}`
			);
			await assertResponseOk(response, { integration: 'quickbooks', action: 'get-receivables-aging' });

			const data = (await response.json()) as {
				Rows?: {
					Row?: Array<{
						Summary?: {
							ColData?: Array<{ value: string }>;
						};
					}>;
				};
			};

			// Parse the aging buckets from the report
			// QuickBooks report format varies, this is a simplified extraction
			const totalsRow = data.Rows?.Row?.find(r => r.Summary)?.Summary?.ColData || [];

			return createActionResult({
				data: {
					current: parseFloat(totalsRow[1]?.value || '0'),
					days1to30: parseFloat(totalsRow[2]?.value || '0'),
					days31to60: parseFloat(totalsRow[3]?.value || '0'),
					days61to90: parseFloat(totalsRow[4]?.value || '0'),
					over90: parseFloat(totalsRow[5]?.value || '0'),
					total: parseFloat(totalsRow[6]?.value || '0'),
				},
				integration: 'quickbooks',
				action: 'get-receivables-aging',
				schema: 'quickbooks.aging-summary.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-receivables-aging');
		}
	}

	// ==========================================================================
	// WEBHOOKS
	// ==========================================================================

	/**
	 * Verify QuickBooks webhook signature
	 *
	 * @param payload - Raw request body
	 * @param signature - intuit-signature header
	 * @param webhookVerifierToken - Your webhook verifier token from Intuit
	 */
	async verifyWebhook(
		payload: string,
		signature: string,
		webhookVerifierToken: string
	): Promise<ActionResult<{ valid: boolean; events: QBWebhookEvent[] }>> {
		try {
			const isValid = await verifyHmacSignature(payload, signature, webhookVerifierToken, { encoding: 'base64' });

			if (!isValid) {
				return createActionResult({
					data: { valid: false, events: [] },
					integration: 'quickbooks',
					action: 'verify-webhook',
					schema: 'quickbooks.webhook-result.v1',
					capabilities: this.getCapabilities(),
				});
			}

			const events = JSON.parse(payload) as { eventNotifications: QBWebhookEvent[] };

			return createActionResult({
				data: {
					valid: true,
					events: events.eventNotifications || [],
				},
				integration: 'quickbooks',
				action: 'verify-webhook',
				schema: 'quickbooks.webhook-result.v1',
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
	 * Get capabilities for QuickBooks actions
	 */
	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			canHandleRichText: false,
			canHandleMarkdown: false,
			canHandleImages: false,
			canHandleAttachments: true, // QB supports attachments
			supportsSearch: true,
			supportsPagination: true,
			supportsNesting: false,
			supportsRelations: true, // Invoices linked to customers, payments linked to invoices
			supportsMetadata: true,
		};
	}
}

// ============================================================================
// WEBHOOK TYPES
// ============================================================================

export interface QBWebhookEvent {
	realmId: string;
	dataChangeEvent?: {
		entities: Array<{
			name: string; // 'Invoice', 'Customer', 'Payment', etc.
			id: string;
			operation: 'Create' | 'Update' | 'Delete' | 'Merge' | 'Void';
			lastUpdated: string;
		}>;
	};
}
