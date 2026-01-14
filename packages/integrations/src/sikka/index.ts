/**
 * Sikka ONE API Integration for WORKWAY
 *
 * Unified dental practice management integration covering 400+ PMS systems
 * including Dentrix, Eaglesoft, Open Dental, and more.
 *
 * Zuhandenheit: Dentists don't want "API calls" - they want:
 * - Patients who show up
 * - Chairs that stay full
 * - Less time in admin screens
 *
 * @example
 * ```typescript
 * import { Sikka } from '@workwayco/integrations/sikka';
 *
 * // Initialize with App ID and App Key from Sikka portal
 * const sikka = new Sikka({
 *   appId: process.env.SIKKA_APP_ID,
 *   appKey: process.env.SIKKA_APP_KEY,
 * });
 *
 * // Step 1: Get authorized practices (uses App-Id/App-Key auth)
 * const practices = await sikka.getAuthorizedPractices();
 * console.log(`Found ${practices.data.length} practices`);
 *
 * // Step 2: Connect to a practice (obtains temporary request_key)
 * await sikka.connectToPractice(practices.data[0].office_id);
 *
 * // Step 3: Now you can access data (uses request-key auth)
 * const appointments = await sikka.getAppointments({
 *   practiceId: practices.data[0].office_id,
 *   startDate: new Date(),
 *   endDate: new Date(),
 * });
 *
 * // Find patients modified in last 7 days (for incremental sync)
 * const patients = await sikka.getPatients({
 *   practiceId: practices.data[0].office_id,
 *   modifiedSince: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
 * });
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
 * Sikka integration configuration
 *
 * Authentication Model (3-step flow):
 * 1. Use `appId` + `appKey` to call /authorized_practices
 * 2. Exchange `officeId` + `secretKey` for a temporary `requestKey` (24h expiration)
 * 3. Use `requestKey` for all data access
 *
 * You can either:
 * - Provide appId + appKey (will fetch practices and request keys automatically)
 * - Provide a pre-fetched requestKey directly (for cached/stored keys)
 */
export interface SikkaConfig {
	/** Application ID from Sikka portal */
	appId: string;
	/** Application secret key from Sikka portal */
	appKey: string;
	/** Optional: Pre-fetched request key (skips auth flow if provided) */
	requestKey?: string;
	/** Optional: Override API endpoint (for testing) */
	apiUrl?: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
}

/**
 * Practice authorization info returned from /authorized_practices
 */
export interface SikkaAuthorizedPractice {
	office_id: string;
	secret_key: string;
	practice_name?: string;
	pms_type?: string;
	data_insert_date?: string;
}

/**
 * Request key response from POST /request_key
 */
export interface SikkaRequestKeyInfo {
	request_key: string;
	expires_in: string;
	status: string;
	scope?: string;
	issued_to?: string;
	start_time?: string;
	end_time?: string;
}

/**
 * Sikka practice (dental office)
 */
export interface SikkaPractice {
	practice_id: string;
	practice_name: string;
	practice_address?: string;
	practice_city?: string;
	practice_state?: string;
	practice_zip?: string;
	practice_phone?: string;
	pms_type?: string; // Practice Management System type (e.g., "Dentrix", "Eaglesoft")
	timezone?: string;
	is_active?: boolean;
}

/**
 * Sikka patient record
 */
export interface SikkaPatient {
	patient_id: string;
	practice_id: string;
	first_name: string;
	last_name: string;
	middle_name?: string;
	email?: string;
	phone_home?: string;
	phone_cell?: string;
	phone_work?: string;
	date_of_birth?: string;
	gender?: string;
	address?: string;
	city?: string;
	state?: string;
	zip?: string;
	insurance_carrier?: string;
	primary_provider_id?: string;
	status?: 'active' | 'inactive' | 'archived';
	balance?: number;
	last_visit_date?: string;
	next_appointment_date?: string;
	created_at?: string;
	modified_at?: string;
}

/**
 * Sikka appointment
 */
export interface SikkaAppointment {
	appointment_id: string;
	practice_id: string;
	patient_id: string;
	provider_id?: string;
	operatory_id?: string;
	appointment_date: string;
	appointment_time: string;
	duration_minutes?: number;
	status: 'scheduled' | 'confirmed' | 'checked_in' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
	appointment_type?: string;
	procedure_codes?: string[];
	notes?: string;
	created_at?: string;
	modified_at?: string;
}

/**
 * Sikka provider (dentist, hygienist, etc.)
 */
export interface SikkaProvider {
	provider_id: string;
	practice_id: string;
	first_name: string;
	last_name: string;
	provider_type?: string; // "DDS", "DMD", "RDH", etc.
	npi?: string;
	email?: string;
	is_active?: boolean;
}

/**
 * Sikka treatment/procedure
 */
export interface SikkaTreatment {
	treatment_id: string;
	practice_id: string;
	patient_id: string;
	provider_id?: string;
	procedure_code: string;
	procedure_description?: string;
	tooth_number?: string;
	surface?: string;
	fee?: number;
	insurance_portion?: number;
	patient_portion?: number;
	status: 'planned' | 'scheduled' | 'in_progress' | 'completed';
	treatment_date?: string;
	created_at?: string;
	modified_at?: string;
}

/**
 * Sikka insurance claim
 */
export interface SikkaClaim {
	claim_id: string;
	practice_id: string;
	patient_id: string;
	insurance_carrier: string;
	claim_date: string;
	amount_billed: number;
	amount_paid?: number;
	amount_adjusted?: number;
	status: 'pending' | 'submitted' | 'accepted' | 'rejected' | 'paid' | 'denied';
	procedure_codes: string[];
	created_at?: string;
	modified_at?: string;
}

/**
 * Sikka transaction
 */
export interface SikkaTransaction {
	transaction_id: string;
	practice_id: string;
	patient_id?: string;
	transaction_type: 'payment' | 'adjustment' | 'charge' | 'refund';
	amount: number;
	payment_method?: string;
	transaction_date: string;
	description?: string;
	created_at?: string;
}

/**
 * Sikka webhook event
 */
export interface SikkaWebhookEvent {
	event_type: 'appointment.created' | 'appointment.updated' | 'appointment.cancelled' |
		'patient.created' | 'patient.updated' |
		'treatment.completed' | 'payment.received';
	practice_id: string;
	timestamp: string;
	data: Record<string, unknown>;
	callback_key?: string;
}

// ============================================================================
// OPTIONS TYPES
// ============================================================================

export interface GetPatientsOptions {
	practiceId: string;
	/** Filter by modified date (incremental sync) */
	modifiedSince?: Date;
	modifiedUntil?: Date;
	/** Maximum records to return (max: 5000) */
	limit?: number;
	/** Offset for pagination */
	offset?: number;
}

export interface GetAppointmentsOptions {
	practiceId: string;
	/** Start date for appointment range */
	startDate?: Date;
	/** End date for appointment range */
	endDate?: Date;
	/** Filter by status */
	status?: SikkaAppointment['status'];
	/** Filter by provider */
	providerId?: string;
	limit?: number;
	offset?: number;
}

export interface GetTreatmentsOptions {
	practiceId: string;
	patientId?: string;
	/** Filter by status */
	status?: SikkaTreatment['status'];
	modifiedSince?: Date;
	limit?: number;
	offset?: number;
}

export interface GetClaimsOptions {
	practiceId: string;
	patientId?: string;
	status?: SikkaClaim['status'];
	startDate?: Date;
	endDate?: Date;
	limit?: number;
	offset?: number;
}

export interface GetTransactionsOptions {
	practiceId: string;
	startDate?: Date;
	endDate?: Date;
	transactionType?: SikkaTransaction['transaction_type'];
	limit?: number;
	offset?: number;
}

export interface CreateAppointmentOptions {
	practiceId: string;
	patientId: string;
	providerId?: string;
	appointmentDate: Date;
	appointmentTime: string; // "HH:MM" format
	durationMinutes?: number;
	appointmentType?: string;
	procedureCodes?: string[];
	notes?: string;
}

export interface UpdateAppointmentOptions {
	practiceId: string;
	appointmentId: string;
	status?: SikkaAppointment['status'];
	appointmentDate?: Date;
	appointmentTime?: string;
	notes?: string;
}

// ============================================================================
// SIKKA INTEGRATION CLASS
// ============================================================================

/**
 * Sikka ONE API Integration
 *
 * Weniger, aber besser: One integration for 400+ dental PMS systems.
 *
 * Authentication flow:
 * 1. App-Id + App-Key → /authorized_practices → office_id + secret_key
 * 2. POST /request_key → temporary request_key (24h)
 * 3. request-key header → all data endpoints
 */
export class Sikka extends BaseAPIClient {
	private readonly appId: string;
	private readonly appKey: string;
	private requestKey?: string;
	private requestKeyExpiry?: Date;

	// Cache for authorized practices
	private authorizedPracticesCache?: SikkaAuthorizedPractice[];
	private currentPractice?: SikkaAuthorizedPractice;

	constructor(config: SikkaConfig) {
		if (!config.appId) {
			throw new IntegrationError(
				ErrorCode.MISSING_REQUIRED_FIELD,
				'Sikka App ID is required',
				{ integration: 'sikka' }
			);
		}
		if (!config.appKey) {
			throw new IntegrationError(
				ErrorCode.MISSING_REQUIRED_FIELD,
				'Sikka App Key is required',
				{ integration: 'sikka' }
			);
		}

		// Pass empty accessToken since we use custom auth
		super({
			accessToken: '',
			apiUrl: config.apiUrl || 'https://api.sikkasoft.com/v4',
			timeout: config.timeout,
			errorContext: { integration: 'sikka' },
		});

		this.appId = config.appId;
		this.appKey = config.appKey;
		this.requestKey = config.requestKey;
	}

	/**
	 * Make authenticated request using App-Id/App-Key headers
	 * Used for /authorized_practices endpoint
	 */
	private async requestWithAppAuth(path: string): Promise<Response> {
		const url = `${this['apiUrl']}${path}`;
		const headers = new Headers({
			'App-Id': this.appId,
			'App-Key': this.appKey,
			'Content-Type': 'application/json',
			'Accept': 'application/json',
		});

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this['timeout']);

		try {
			const response = await fetch(url, {
				method: 'GET',
				headers,
				signal: controller.signal,
			});
			return response;
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				throw new IntegrationError(
					ErrorCode.TIMEOUT,
					`Request timed out after ${this['timeout']}ms`,
					{ integration: 'sikka', retryable: true }
				);
			}
			throw new IntegrationError(
				ErrorCode.NETWORK_ERROR,
				`Network request failed: ${error}`,
				{ integration: 'sikka', retryable: true }
			);
		} finally {
			clearTimeout(timeoutId);
		}
	}

	/**
	 * Obtain a request_key for a specific practice
	 */
	async obtainRequestKey(practice: SikkaAuthorizedPractice): Promise<ActionResult<SikkaRequestKeyInfo>> {
		try {
			const url = `${this['apiUrl']}/request_key`;
			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Accept': 'application/json',
				},
				body: JSON.stringify({
					grant_type: 'request_key',
					office_id: practice.office_id,
					secret_key: practice.secret_key,
					app_id: this.appId,
					app_key: this.appKey,
				}),
			});

			if (!response.ok) {
				const errorBody = await response.text();
				return ActionResult.error(
					`Failed to obtain request key: ${errorBody}`,
					ErrorCode.AUTH_EXPIRED,
					{ integration: 'sikka', action: 'obtain-request-key' }
				);
			}

			const data = (await response.json()) as SikkaRequestKeyInfo;

			// Cache the request key and set expiry
			this.requestKey = data.request_key;
			this.currentPractice = practice;

			// Parse expires_in (e.g., "86400 second(s)")
			const expiresMatch = data.expires_in.match(/(\d+)/);
			if (expiresMatch) {
				const expiresInSeconds = parseInt(expiresMatch[1], 10);
				this.requestKeyExpiry = new Date(Date.now() + expiresInSeconds * 1000);
			}

			return createActionResult({
				data,
				integration: 'sikka',
				action: 'obtain-request-key',
				schema: 'sikka.request-key.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'obtain-request-key');
		}
	}

	/**
	 * Check if current request key is valid
	 */
	hasValidRequestKey(): boolean {
		if (!this.requestKey) return false;
		if (!this.requestKeyExpiry) return true; // Assume valid if no expiry set
		return new Date() < this.requestKeyExpiry;
	}

	/**
	 * Override to use Sikka's request-key authentication
	 * Requires a valid request_key to be set (call obtainRequestKey first)
	 * Note: Must match parent's signature (method, path, options)
	 */
	protected override async request(
		method: string,
		path: string,
		options: { body?: unknown; headers?: Record<string, string> } = {}
	): Promise<Response> {
		if (!this.requestKey) {
			throw new IntegrationError(
				ErrorCode.AUTH_EXPIRED,
				'No request key available. Call obtainRequestKey() first.',
				{ integration: 'sikka' }
			);
		}

		// Sikka uses request-key header for data access
		const sikkaHeaders = {
			...options.headers,
			'request-key': this.requestKey,
			Accept: 'application/json',
			'Accept-Encoding': 'gzip,compress',
		};

		return super.request(method, path, { ...options, headers: sikkaHeaders });
	}


	// ==========================================================================
	// PRACTICES
	// ==========================================================================

	/**
	 * Get all practices you have authorization to access
	 *
	 * Uses App-Id/App-Key authentication (not request-key).
	 * Returns office_id and secret_key which are needed to obtain request_keys.
	 *
	 * @example
	 * ```typescript
	 * const sikka = new Sikka({ appId: '...', appKey: '...' });
	 * const practices = await sikka.getAuthorizedPractices();
	 *
	 * // Get request key for first practice
	 * await sikka.obtainRequestKey(practices.data[0]);
	 *
	 * // Now you can access data
	 * const patients = await sikka.getPatients({ practiceId: practices.data[0].office_id });
	 * ```
	 */
	async getAuthorizedPractices(): Promise<ActionResult<SikkaAuthorizedPractice[]>> {
		try {
			const response = await this.requestWithAppAuth('/authorized_practices');

			if (!response.ok) {
				const errorBody = await response.text();
				return ActionResult.error(
					`Failed to get authorized practices: ${errorBody}`,
					ErrorCode.API_ERROR,
					{ integration: 'sikka', action: 'get-authorized-practices' }
				);
			}

			const data = (await response.json()) as { items?: SikkaAuthorizedPractice[]; data?: SikkaAuthorizedPractice[] };
			const practices: SikkaAuthorizedPractice[] = data.items || data.data || [];

			// Cache the practices
			this.authorizedPracticesCache = practices;

			return createActionResult({
				data: practices,
				integration: 'sikka',
				action: 'get-authorized-practices',
				schema: 'sikka.authorized-practices.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-authorized-practices');
		}
	}

	/**
	 * Connect to a practice (get request key and prepare for data access)
	 *
	 * Convenience method that combines getAuthorizedPractices + obtainRequestKey
	 */
	async connectToPractice(officeId?: string): Promise<ActionResult<SikkaRequestKeyInfo>> {
		// Get authorized practices if not cached
		if (!this.authorizedPracticesCache) {
			const practicesResult = await this.getAuthorizedPractices();
			if (!practicesResult.success) {
				return ActionResult.error(
					practicesResult.error?.message || 'Failed to get practices',
					practicesResult.error?.code || ErrorCode.API_ERROR,
					{ integration: 'sikka', action: 'connect-to-practice' }
				);
			}
		}

		// Find the practice
		const practices = this.authorizedPracticesCache!;
		const practice = officeId
			? practices.find(p => p.office_id === officeId)
			: practices[0];

		if (!practice) {
			return ActionResult.error(
				officeId ? `Practice ${officeId} not found` : 'No practices available',
				ErrorCode.NOT_FOUND,
				{ integration: 'sikka', action: 'connect-to-practice' }
			);
		}

		// Obtain request key
		return this.obtainRequestKey(practice);
	}

	/**
	 * Get practice details
	 */
	async getPractice(practiceId: string): Promise<ActionResult<SikkaPractice>> {
		try {
			const practice = await this.getJson<{ data: SikkaPractice }>(
				`/practices/${practiceId}`
			);

			return createActionResult({
				data: practice.data,
				integration: 'sikka',
				action: 'get-practice',
				schema: 'sikka.practice.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-practice');
		}
	}

	// ==========================================================================
	// PATIENTS
	// ==========================================================================

	/**
	 * Get patients from a practice
	 *
	 * Supports incremental sync via modifiedSince parameter.
	 */
	async getPatients(options: GetPatientsOptions): Promise<ActionResult<SikkaPatient[]>> {
		const { practiceId, modifiedSince, modifiedUntil, limit = 1000, offset = 0 } = options;

		const query = buildQueryString({
			practice_id: practiceId,
			loaded_startdate: modifiedSince?.toISOString().split('T')[0],
			loaded_enddate: modifiedUntil?.toISOString().split('T')[0],
			limit: Math.min(limit, 5000), // API max is 5000
			offset,
		});

		try {
			const patients = await this.getJson<{ data: SikkaPatient[] }>(
				`/patients${query}`
			);

			return createActionResult({
				data: patients.data || [],
				integration: 'sikka',
				action: 'get-patients',
				schema: 'sikka.patients.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-patients');
		}
	}

	/**
	 * Get a single patient by ID
	 */
	async getPatient(practiceId: string, patientId: string): Promise<ActionResult<SikkaPatient>> {
		try {
			const patient = await this.getJson<{ data: SikkaPatient }>(
				`/patients/${patientId}?practice_id=${practiceId}`
			);

			return createActionResult({
				data: patient.data,
				integration: 'sikka',
				action: 'get-patient',
				schema: 'sikka.patient.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-patient');
		}
	}

	/**
	 * Search patients by name or email
	 */
	async searchPatients(
		practiceId: string,
		searchTerm: string
	): Promise<ActionResult<SikkaPatient[]>> {
		const query = buildQueryString({
			practice_id: practiceId,
			search: searchTerm,
			limit: 50,
		});

		try {
			const patients = await this.getJson<{ data: SikkaPatient[] }>(
				`/patients/search${query}`
			);

			return createActionResult({
				data: patients.data || [],
				integration: 'sikka',
				action: 'search-patients',
				schema: 'sikka.patients.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'search-patients');
		}
	}

	// ==========================================================================
	// APPOINTMENTS
	// ==========================================================================

	/**
	 * Get appointments for a practice
	 *
	 * Zuhandenheit: "Show me today's schedule" not "GET /appointments?date_range=..."
	 */
	async getAppointments(options: GetAppointmentsOptions): Promise<ActionResult<SikkaAppointment[]>> {
		const { practiceId, startDate, endDate, status, providerId, limit = 1000, offset = 0 } = options;

		const query = buildQueryString({
			practice_id: practiceId,
			start_date: startDate?.toISOString().split('T')[0],
			end_date: endDate?.toISOString().split('T')[0],
			status,
			provider_id: providerId,
			limit: Math.min(limit, 5000),
			offset,
		});

		try {
			const appointments = await this.getJson<{ data: SikkaAppointment[] }>(
				`/appointments${query}`
			);

			return createActionResult({
				data: appointments.data || [],
				integration: 'sikka',
				action: 'get-appointments',
				schema: 'sikka.appointments.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-appointments');
		}
	}

	/**
	 * Get today's appointments for a practice
	 *
	 * Convenience method for the most common use case.
	 */
	async getTodaysAppointments(practiceId: string): Promise<ActionResult<SikkaAppointment[]>> {
		const today = new Date();
		return this.getAppointments({
			practiceId,
			startDate: today,
			endDate: today,
		});
	}

	/**
	 * Get upcoming appointments for a patient
	 */
	async getPatientAppointments(
		practiceId: string,
		patientId: string
	): Promise<ActionResult<SikkaAppointment[]>> {
		const query = buildQueryString({
			practice_id: practiceId,
			patient_id: patientId,
			start_date: new Date().toISOString().split('T')[0],
			limit: 20,
		});

		try {
			const appointments = await this.getJson<{ data: SikkaAppointment[] }>(
				`/appointments${query}`
			);

			return createActionResult({
				data: appointments.data || [],
				integration: 'sikka',
				action: 'get-patient-appointments',
				schema: 'sikka.appointments.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-patient-appointments');
		}
	}

	// ==========================================================================
	// PROVIDERS
	// ==========================================================================

	/**
	 * Get providers (dentists, hygienists) for a practice
	 */
	async getProviders(practiceId: string): Promise<ActionResult<SikkaProvider[]>> {
		try {
			const providers = await this.getJson<{ data: SikkaProvider[] }>(
				`/providers?practice_id=${practiceId}`
			);

			return createActionResult({
				data: providers.data || [],
				integration: 'sikka',
				action: 'get-providers',
				schema: 'sikka.providers.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-providers');
		}
	}

	// ==========================================================================
	// TREATMENTS
	// ==========================================================================

	/**
	 * Get treatment plans and procedures
	 */
	async getTreatments(options: GetTreatmentsOptions): Promise<ActionResult<SikkaTreatment[]>> {
		const { practiceId, patientId, status, modifiedSince, limit = 1000, offset = 0 } = options;

		const query = buildQueryString({
			practice_id: practiceId,
			patient_id: patientId,
			status,
			loaded_startdate: modifiedSince?.toISOString().split('T')[0],
			limit: Math.min(limit, 5000),
			offset,
		});

		try {
			const treatments = await this.getJson<{ data: SikkaTreatment[] }>(
				`/treatments${query}`
			);

			return createActionResult({
				data: treatments.data || [],
				integration: 'sikka',
				action: 'get-treatments',
				schema: 'sikka.treatments.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-treatments');
		}
	}

	/**
	 * Get pending treatment plans for a patient
	 *
	 * Useful for treatment acceptance tracking.
	 */
	async getPendingTreatments(
		practiceId: string,
		patientId: string
	): Promise<ActionResult<SikkaTreatment[]>> {
		return this.getTreatments({
			practiceId,
			patientId,
			status: 'planned',
		});
	}

	// ==========================================================================
	// INSURANCE & CLAIMS
	// ==========================================================================

	/**
	 * Get insurance claims
	 */
	async getClaims(options: GetClaimsOptions): Promise<ActionResult<SikkaClaim[]>> {
		const { practiceId, patientId, status, startDate, endDate, limit = 1000, offset = 0 } = options;

		const query = buildQueryString({
			practice_id: practiceId,
			patient_id: patientId,
			status,
			start_date: startDate?.toISOString().split('T')[0],
			end_date: endDate?.toISOString().split('T')[0],
			limit: Math.min(limit, 5000),
			offset,
		});

		try {
			const claims = await this.getJson<{ data: SikkaClaim[] }>(
				`/claims${query}`
			);

			return createActionResult({
				data: claims.data || [],
				integration: 'sikka',
				action: 'get-claims',
				schema: 'sikka.claims.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-claims');
		}
	}

	// ==========================================================================
	// TRANSACTIONS
	// ==========================================================================

	/**
	 * Get financial transactions
	 */
	async getTransactions(options: GetTransactionsOptions): Promise<ActionResult<SikkaTransaction[]>> {
		const { practiceId, startDate, endDate, transactionType, limit = 1000, offset = 0 } = options;

		const query = buildQueryString({
			practice_id: practiceId,
			start_date: startDate?.toISOString().split('T')[0],
			end_date: endDate?.toISOString().split('T')[0],
			transaction_type: transactionType,
			limit: Math.min(limit, 5000),
			offset,
		});

		try {
			const transactions = await this.getJson<{ data: SikkaTransaction[] }>(
				`/transactions${query}`
			);

			return createActionResult({
				data: transactions.data || [],
				integration: 'sikka',
				action: 'get-transactions',
				schema: 'sikka.transactions.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-transactions');
		}
	}

	// ==========================================================================
	// WRITE OPERATIONS (Enterprise only)
	// ==========================================================================

	/**
	 * Create an appointment (requires Enterprise license)
	 *
	 * Note: Write-back is only available with Enterprise API license.
	 */
	async createAppointment(options: CreateAppointmentOptions): Promise<ActionResult<SikkaAppointment>> {
		const {
			practiceId,
			patientId,
			providerId,
			appointmentDate,
			appointmentTime,
			durationMinutes = 60,
			appointmentType,
			procedureCodes,
			notes,
		} = options;

		try {
			const appointment = await this.postJson<{ data: SikkaAppointment }>(
				'/appointments',
				{
					practice_id: practiceId,
					patient_id: patientId,
					provider_id: providerId,
					appointment_date: appointmentDate.toISOString().split('T')[0],
					appointment_time: appointmentTime,
					duration_minutes: durationMinutes,
					appointment_type: appointmentType,
					procedure_codes: procedureCodes,
					notes,
				}
			);

			return createActionResult({
				data: appointment.data,
				integration: 'sikka',
				action: 'create-appointment',
				schema: 'sikka.appointment.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'create-appointment');
		}
	}

	/**
	 * Update appointment status (requires Enterprise license)
	 */
	async updateAppointmentStatus(options: UpdateAppointmentOptions): Promise<ActionResult<SikkaAppointment>> {
		const { practiceId, appointmentId, status, appointmentDate, appointmentTime, notes } = options;

		try {
			const appointment = await this.patchJson<{ data: SikkaAppointment }>(
				`/appointments/${appointmentId}`,
				{
					practice_id: practiceId,
					status,
					appointment_date: appointmentDate?.toISOString().split('T')[0],
					appointment_time: appointmentTime,
					notes,
				}
			);

			return createActionResult({
				data: appointment.data,
				integration: 'sikka',
				action: 'update-appointment',
				schema: 'sikka.appointment.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'update-appointment');
		}
	}

	// ==========================================================================
	// HELPERS
	// ==========================================================================

	/**
	 * Handle errors consistently
	 */
	private handleError(error: unknown, action: string): ActionResult<never> {
		if (error instanceof IntegrationError) {
			return ActionResult.error(error.message, error.code, {
				integration: 'sikka',
				action,
			});
		}

		const message = error instanceof Error ? error.message : String(error);
		return ActionResult.error(message, ErrorCode.API_ERROR, {
			integration: 'sikka',
			action,
		});
	}

	/**
	 * Get capabilities for Sikka actions
	 */
	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			canHandleRichText: false,
			canHandleMarkdown: false,
			canHandleImages: false,
			canHandleAttachments: false,
			supportsSearch: true,
			supportsPagination: true,
			supportsNesting: false,
			supportsRelations: true,
			supportsMetadata: true,
		};
	}
}

// ============================================================================
// STANDARD DATA CONVERTERS
// ============================================================================

/**
 * Convert Sikka patient to standard contact format
 */
export function toStandardContact(patient: SikkaPatient) {
	return {
		id: patient.patient_id,
		firstName: patient.first_name,
		lastName: patient.last_name,
		email: patient.email,
		phone: patient.phone_cell || patient.phone_home || patient.phone_work,
		source: 'sikka' as const,
		sourceId: patient.patient_id,
		metadata: {
			practiceId: patient.practice_id,
			dateOfBirth: patient.date_of_birth,
			lastVisit: patient.last_visit_date,
			nextAppointment: patient.next_appointment_date,
			balance: patient.balance,
		},
	};
}

/**
 * Convert Sikka appointment to standard calendar event format
 */
export function toStandardEvent(appointment: SikkaAppointment) {
	const dateTime = `${appointment.appointment_date}T${appointment.appointment_time}`;
	const startDate = new Date(dateTime);
	const endDate = new Date(startDate.getTime() + (appointment.duration_minutes || 60) * 60 * 1000);

	return {
		id: appointment.appointment_id,
		title: appointment.appointment_type || 'Dental Appointment',
		start: startDate.toISOString(),
		end: endDate.toISOString(),
		status: appointment.status,
		source: 'sikka' as const,
		sourceId: appointment.appointment_id,
		metadata: {
			practiceId: appointment.practice_id,
			patientId: appointment.patient_id,
			providerId: appointment.provider_id,
			procedureCodes: appointment.procedure_codes,
			notes: appointment.notes,
		},
	};
}
