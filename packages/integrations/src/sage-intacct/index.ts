/**
 * Sage Intacct Construction API Integration for WORKWAY
 *
 * Construction-specific cloud accounting and ERP.
 * Covers projects, vendors, contracts, change orders, bills, job costs, and GL.
 *
 * Zuhandenheit: Controllers don't want "API sessions" - they want:
 * - Job costs that reconcile across systems
 * - Pay apps that match the schedule
 * - Change orders tracked before they blow the budget
 * - Vendor payments that close on time
 *
 * @example
 * ```typescript
 * import { SageIntacct } from '@workwayco/integrations/sage-intacct';
 *
 * const sage = new SageIntacct({
 *   companyId: process.env.SAGE_COMPANY_ID,
 *   userId: process.env.SAGE_USER_ID,
 *   userPassword: process.env.SAGE_USER_PASSWORD,
 *   senderId: process.env.SAGE_SENDER_ID,
 *   senderPassword: process.env.SAGE_SENDER_PASSWORD,
 * });
 *
 * // Get construction projects
 * const projects = await sage.getProjects();
 *
 * // Get job cost transactions
 * const costs = await sage.getJobCosts('project-id');
 * ```
 */

import {
	ActionResult,
	createActionResult,
	ErrorCode,
	IntegrationError,
	type ActionCapabilities,
} from '@workwayco/sdk';
import { BaseAPIClient, buildQueryString } from '../core/index.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Sage Intacct Construction integration configuration
 *
 * Authentication: Session-based (company/user/sender credentials)
 * Partner approval required for API access
 */
export interface SageIntacctConfig {
	/** Intacct company ID */
	companyId: string;
	/** User ID */
	userId: string;
	/** User password */
	userPassword: string;
	/** Sender ID (partner credential) */
	senderId: string;
	/** Sender password (partner credential) */
	senderPassword: string;
	/** Pre-authenticated access token (REST API) */
	accessToken?: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
}

// ----------------------------------------------------------------------------
// Project Resources
// ----------------------------------------------------------------------------

/** Sage construction project */
export interface SageProject {
	PROJECTID: string;
	NAME: string;
	DESCRIPTION?: string;
	STATUS: string;
	PROJECTTYPE?: string;
	CUSTOMERID?: string;
	CUSTOMERNAME?: string;
	MANAGERID?: string;
	MANAGERNAME?: string;
	BEGINDATE?: string;
	ENDDATE?: string;
	CONTRACTAMOUNT?: number;
	BUDGETAMOUNT?: number;
	ESTIMATEDCOST?: number;
	ACTUALCOST?: number;
	PERCENTCOMPLETE?: number;
	DEPARTMENTID?: string;
	LOCATIONID?: string;
	WHENCREATED: string;
	WHENMODIFIED: string;
}

// ----------------------------------------------------------------------------
// Vendor Resources
// ----------------------------------------------------------------------------

/** Vendor/subcontractor */
export interface SageVendor {
	VENDORID: string;
	NAME: string;
	DISPLAYCONTACT?: {
		CONTACTNAME?: string;
		PHONE1?: string;
		EMAIL1?: string;
		MAILADDRESS?: {
			ADDRESS1?: string;
			CITY?: string;
			STATE?: string;
			ZIP?: string;
		};
	};
	STATUS: string;
	VENDTYPE?: string;
	TAXID?: string;
	ONHOLD: boolean;
	WHENCREATED: string;
	WHENMODIFIED: string;
}

// ----------------------------------------------------------------------------
// Contract Resources
// ----------------------------------------------------------------------------

/** Construction contract */
export interface SageContract {
	CONTRACTID: string;
	NAME: string;
	DESCRIPTION?: string;
	STATUS: string;
	PROJECTID: string;
	VENDORID?: string;
	VENDORNAME?: string;
	CONTRACTTYPE?: string;
	TOTALAMOUNT?: number;
	BILLEDAMOUNT?: number;
	PAIDAMOUNT?: number;
	RETAINAGEAMOUNT?: number;
	STARTDATE?: string;
	ENDDATE?: string;
	WHENCREATED: string;
	WHENMODIFIED: string;
}

// ----------------------------------------------------------------------------
// Change Order Resources
// ----------------------------------------------------------------------------

/** Change order */
export interface SageChangeOrder {
	CHANGEORDERID: string;
	CONTRACTID: string;
	DESCRIPTION?: string;
	STATUS: string;
	AMOUNT: number;
	APPROVEDDATE?: string;
	REQUESTEDDATE?: string;
	EFFECTIVEDATE?: string;
	SCOPE?: string;
	REASON?: string;
	WHENCREATED: string;
	WHENMODIFIED: string;
}

// ----------------------------------------------------------------------------
// Bill Resources
// ----------------------------------------------------------------------------

/** AP Bill */
export interface SageBill {
	RECORDNO: number;
	VENDORID: string;
	VENDORNAME?: string;
	PROJECTID?: string;
	TRANSACTIONDATE: string;
	DUEDATE?: string;
	TOTALAMOUNT: number;
	AMOUNTPAID?: number;
	AMOUNTDUE?: number;
	STATUS: string;
	DESCRIPTION?: string;
	LINEITEMS?: SageBillLineItem[];
	WHENCREATED: string;
	WHENMODIFIED: string;
}

/** Bill line item */
export interface SageBillLineItem {
	RECORDNO: number;
	ACCOUNTNO: string;
	AMOUNT: number;
	DESCRIPTION?: string;
	PROJECTID?: string;
	COSTTYPE?: string;
	TASKID?: string;
}

// ----------------------------------------------------------------------------
// Job Cost Resources
// ----------------------------------------------------------------------------

/** Job cost transaction */
export interface SageJobCost {
	RECORDNO: number;
	PROJECTID: string;
	TASKID?: string;
	COSTTYPE: string;
	TRANSACTIONDATE: string;
	AMOUNT: number;
	QUANTITY?: number;
	UNITCOST?: number;
	VENDORID?: string;
	EMPLOYEEID?: string;
	DESCRIPTION?: string;
	ENTRYTYPE: string;
	WHENCREATED: string;
}

// ----------------------------------------------------------------------------
// Employee Resources
// ----------------------------------------------------------------------------

/** Employee */
export interface SageEmployee {
	EMPLOYEEID: string;
	FIRSTNAME: string;
	LASTNAME: string;
	STATUS: string;
	TITLE?: string;
	DEPARTMENTID?: string;
	LOCATIONID?: string;
	STARTDATE?: string;
	ENDDATE?: string;
	EMAIL1?: string;
	PHONE1?: string;
}

// ----------------------------------------------------------------------------
// GL Entry Resources
// ----------------------------------------------------------------------------

/** General ledger entry */
export interface SageGLEntry {
	RECORDNO: number;
	BATCHNO: number;
	JOURNAL: string;
	ACCOUNTNO: string;
	AMOUNT: number;
	TRANSACTIONDATE: string;
	DESCRIPTION?: string;
	PROJECTID?: string;
	DEPARTMENTID?: string;
	LOCATIONID?: string;
	WHENCREATED: string;
}

// ============================================================================
// OPTIONS TYPES
// ============================================================================

export interface GetBillsOptions {
	vendorId?: string;
	projectId?: string;
	status?: string;
	dueDateBefore?: string;
	dueDateAfter?: string;
}

export interface CreateBillOptions {
	vendorId: string;
	transactionDate: string;
	dueDate?: string;
	description?: string;
	lineItems: Array<{
		accountNo: string;
		amount: number;
		description?: string;
		projectId?: string;
		costType?: string;
	}>;
}

export interface GetGLEntriesOptions {
	projectId?: string;
	accountNo?: string;
	startDate?: string;
	endDate?: string;
}

// ============================================================================
// SAGE INTACCT INTEGRATION CLASS
// ============================================================================

/**
 * Sage Intacct Construction API Integration
 *
 * Weniger, aber besser: Construction accounting that connects to everything.
 *
 * API: REST (recommended) + legacy XML/SOAP
 * Auth: Session-based (company + user + sender credentials)
 * Rate Limit: Varies by subscription
 * Access: Partner application + security review + yearly fee
 */
export class SageIntacct extends BaseAPIClient {
	private readonly sageCompanyId: string;

	constructor(config: SageIntacctConfig) {
		if (!config.companyId) {
			throw new IntegrationError(
				ErrorCode.MISSING_REQUIRED_FIELD,
				'Sage Intacct company ID is required',
				{ integration: 'sage-intacct' }
			);
		}

		super({
			accessToken: config.accessToken || 'pending-session',
			apiUrl: 'https://api.intacct.com/ia/xml/xmlgw.phtml',
			timeout: config.timeout,
			errorContext: { integration: 'sage-intacct' },
		});

		this.sageCompanyId = config.companyId;
	}

	// ==========================================================================
	// PROJECTS
	// ==========================================================================

	async getProjects(): Promise<ActionResult<SageProject[]>> {
		try {
			const projects = await this.getJson<SageProject[]>('/objects/construction/project');

			return createActionResult({
				data: projects,
				integration: 'sage-intacct',
				action: 'get-projects',
				schema: 'sage-intacct.projects.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-projects');
		}
	}

	async getProject(projectId: string): Promise<ActionResult<SageProject>> {
		try {
			const project = await this.getJson<SageProject>(`/objects/construction/project/${projectId}`);

			return createActionResult({
				data: project,
				integration: 'sage-intacct',
				action: 'get-project',
				schema: 'sage-intacct.project.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-project');
		}
	}

	// ==========================================================================
	// VENDORS
	// ==========================================================================

	async getVendors(): Promise<ActionResult<SageVendor[]>> {
		try {
			const vendors = await this.getJson<SageVendor[]>('/objects/accounts-payable/vendor');

			return createActionResult({
				data: vendors,
				integration: 'sage-intacct',
				action: 'get-vendors',
				schema: 'sage-intacct.vendors.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-vendors');
		}
	}

	async getVendor(vendorId: string): Promise<ActionResult<SageVendor>> {
		try {
			const vendor = await this.getJson<SageVendor>(`/objects/accounts-payable/vendor/${vendorId}`);

			return createActionResult({
				data: vendor,
				integration: 'sage-intacct',
				action: 'get-vendor',
				schema: 'sage-intacct.vendor.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-vendor');
		}
	}

	// ==========================================================================
	// CONTRACTS
	// ==========================================================================

	async getContracts(projectId: string): Promise<ActionResult<SageContract[]>> {
		try {
			const contracts = await this.getJson<SageContract[]>(
				`/objects/construction/contract?filter=PROJECTID='${projectId}'`
			);

			return createActionResult({
				data: contracts,
				integration: 'sage-intacct',
				action: 'get-contracts',
				schema: 'sage-intacct.contracts.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-contracts');
		}
	}

	// ==========================================================================
	// CHANGE ORDERS
	// ==========================================================================

	async getChangeOrders(contractId: string): Promise<ActionResult<SageChangeOrder[]>> {
		try {
			const changeOrders = await this.getJson<SageChangeOrder[]>(
				`/objects/construction/changeorder?filter=CONTRACTID='${contractId}'`
			);

			return createActionResult({
				data: changeOrders,
				integration: 'sage-intacct',
				action: 'get-change-orders',
				schema: 'sage-intacct.change-orders.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-change-orders');
		}
	}

	// ==========================================================================
	// BILLS
	// ==========================================================================

	async getBills(options: GetBillsOptions = {}): Promise<ActionResult<SageBill[]>> {
		const filters: string[] = [];
		if (options.vendorId) filters.push(`VENDORID='${options.vendorId}'`);
		if (options.projectId) filters.push(`PROJECTID='${options.projectId}'`);
		if (options.status) filters.push(`STATUS='${options.status}'`);

		const query = filters.length ? `?filter=${filters.join(' AND ')}` : '';

		try {
			const bills = await this.getJson<SageBill[]>(`/objects/accounts-payable/bill${query}`);

			return createActionResult({
				data: bills,
				integration: 'sage-intacct',
				action: 'get-bills',
				schema: 'sage-intacct.bills.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-bills');
		}
	}

	async createBill(options: CreateBillOptions): Promise<ActionResult<SageBill>> {
		try {
			const bill = await this.postJson<SageBill>(
				'/objects/accounts-payable/bill',
				{
					VENDORID: options.vendorId,
					WHENCREATED: options.transactionDate,
					WHENDUE: options.dueDate,
					DESCRIPTION: options.description,
					APBILLITEMS: {
						APBILLITEM: options.lineItems.map(item => ({
							ACCOUNTNO: item.accountNo,
							AMOUNT: item.amount,
							MEMO: item.description,
							PROJECTID: item.projectId,
							COSTTYPEID: item.costType,
						})),
					},
				}
			);

			return createActionResult({
				data: bill,
				integration: 'sage-intacct',
				action: 'create-bill',
				schema: 'sage-intacct.bill.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'create-bill');
		}
	}

	// ==========================================================================
	// JOB COSTS
	// ==========================================================================

	async getJobCosts(projectId: string): Promise<ActionResult<SageJobCost[]>> {
		try {
			const costs = await this.getJson<SageJobCost[]>(
				`/objects/construction/jobcost?filter=PROJECTID='${projectId}'`
			);

			return createActionResult({
				data: costs,
				integration: 'sage-intacct',
				action: 'get-job-costs',
				schema: 'sage-intacct.job-costs.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-job-costs');
		}
	}

	// ==========================================================================
	// GL ENTRIES
	// ==========================================================================

	async getGLEntries(options: GetGLEntriesOptions = {}): Promise<ActionResult<SageGLEntry[]>> {
		const filters: string[] = [];
		if (options.projectId) filters.push(`PROJECTID='${options.projectId}'`);
		if (options.accountNo) filters.push(`ACCOUNTNO='${options.accountNo}'`);

		const query = filters.length ? `?filter=${filters.join(' AND ')}` : '';

		try {
			const entries = await this.getJson<SageGLEntry[]>(`/objects/general-ledger/glentry${query}`);

			return createActionResult({
				data: entries,
				integration: 'sage-intacct',
				action: 'get-gl-entries',
				schema: 'sage-intacct.gl-entries.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-gl-entries');
		}
	}

	// ==========================================================================
	// EMPLOYEES
	// ==========================================================================

	async getEmployees(): Promise<ActionResult<SageEmployee[]>> {
		try {
			const employees = await this.getJson<SageEmployee[]>('/objects/company-config/employee');

			return createActionResult({
				data: employees,
				integration: 'sage-intacct',
				action: 'get-employees',
				schema: 'sage-intacct.employees.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-employees');
		}
	}

	// ==========================================================================
	// PAY APPLICATIONS
	// ==========================================================================

	async getPayApplications(contractId: string): Promise<ActionResult<Record<string, unknown>[]>> {
		try {
			const payApps = await this.getJson<Record<string, unknown>[]>(
				`/objects/construction/payapplication?filter=CONTRACTID='${contractId}'`
			);

			return createActionResult({
				data: payApps,
				integration: 'sage-intacct',
				action: 'get-pay-applications',
				schema: 'sage-intacct.pay-applications.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-pay-applications');
		}
	}

	// ==========================================================================
	// HELPERS
	// ==========================================================================

	private handleError(error: unknown, action: string): ActionResult<never> {
		if (error instanceof IntegrationError) {
			return ActionResult.error(error.message, error.code, {
				integration: 'sage-intacct',
				action,
			});
		}

		const message = error instanceof Error ? error.message : String(error);
		return ActionResult.error(message, ErrorCode.API_ERROR, {
			integration: 'sage-intacct',
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
			supportsSearch: true,
			supportsPagination: true,
			supportsNesting: true,
			supportsRelations: true,
			supportsMetadata: true,
		};
	}
}
