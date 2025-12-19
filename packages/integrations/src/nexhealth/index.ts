/**
 * NexHealth Integration for WORKWAY
 *
 * Modern healthcare scheduling and patient engagement platform.
 * Designed for dental and medical practice automation - patient scheduling,
 * forms, reminders, and online booking.
 *
 * Zuhandenheit: "Appointments that confirm themselves" not "POST /appointments endpoint"
 *
 * @example
 * ```typescript
 * import { NexHealth } from '@workwayco/integrations/nexhealth';
 *
 * const nexhealth = new NexHealth({
 *   apiKey: env.NEXHEALTH_API_KEY,
 *   subdomain: 'your-practice',
 * });
 *
 * // Get today's appointments
 * const appointments = await nexhealth.getTodaysAppointments();
 *
 * // Get patients needing reactivation (no visit in 6+ months)
 * const inactive = await nexhealth.getInactivePatients({ monthsInactive: 6 });
 *
 * // Send appointment reminder
 * await nexhealth.sendAppointmentReminder(appointmentId);
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
	createErrorHandler,
	assertResponseOk,
} from '../core/index.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * NexHealth integration configuration
 */
export interface NexHealthConfig {
	/** API key (Bearer token) */
	apiKey: string;
	/** Practice subdomain */
	subdomain: string;
	/** Location ID (required for most operations) */
	locationId?: string;
	/** Optional: Override API endpoint (for testing) */
	apiUrl?: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
}

/**
 * NexHealth Patient
 */
export interface NHPatient {
	id: number;
	first_name: string;
	last_name: string;
	name: string;
	email?: string;
	phone?: string;
	cell_phone?: string;
	date_of_birth?: string;
	gender?: string;
	address?: NHAddress;
	inactive: boolean;
	balance?: number;
	insurance_id?: string;
	last_appointment_date?: string;
	next_appointment_date?: string;
	created_at: string;
	updated_at: string;
	foreign_id?: string;
	foreign_id_type?: string;
}

/**
 * NexHealth Address
 */
export interface NHAddress {
	line1?: string;
	line2?: string;
	city?: string;
	state?: string;
	zip?: string;
	country?: string;
}

/**
 * NexHealth Appointment
 */
export interface NHAppointment {
	id: number;
	patient_id: number;
	patient?: NHPatient;
	provider_id: number;
	provider?: NHProvider;
	location_id: number;
	operatory_id?: number;
	appointment_type_id?: number;
	appointment_type?: NHAppointmentType;
	start_time: string;
	end_time: string;
	duration: number;
	status: NHAppointmentStatus;
	confirmed: boolean;
	confirmation_status?: 'unconfirmed' | 'confirmed' | 'attempted';
	notes?: string;
	created_at: string;
	updated_at: string;
	foreign_id?: string;
}

/**
 * NexHealth Appointment Status
 */
export type NHAppointmentStatus =
	| 'pending'
	| 'confirmed'
	| 'checked_in'
	| 'in_progress'
	| 'completed'
	| 'cancelled'
	| 'no_show'
	| 'rescheduled';

/**
 * NexHealth Provider (Doctor/Hygienist)
 */
export interface NHProvider {
	id: number;
	first_name: string;
	last_name: string;
	name: string;
	email?: string;
	npi?: string;
	specialty?: string;
	active: boolean;
	foreign_id?: string;
}

/**
 * NexHealth Appointment Type
 */
export interface NHAppointmentType {
	id: number;
	name: string;
	duration: number;
	color?: string;
	description?: string;
	active: boolean;
	bookable_online: boolean;
}

/**
 * NexHealth Location
 */
export interface NHLocation {
	id: number;
	name: string;
	phone?: string;
	email?: string;
	address?: NHAddress;
	timezone: string;
	active: boolean;
}

/**
 * NexHealth Available Slot
 */
export interface NHAvailableSlot {
	time: string;
	provider_id: number;
	provider?: NHProvider;
	operatory_id?: number;
	duration: number;
}

/**
 * NexHealth Form
 */
export interface NHForm {
	id: number;
	name: string;
	description?: string;
	active: boolean;
	created_at: string;
}

/**
 * NexHealth Form Submission
 */
export interface NHFormSubmission {
	id: number;
	form_id: number;
	patient_id: number;
	status: 'pending' | 'completed' | 'expired';
	submitted_at?: string;
	created_at: string;
}

/**
 * NexHealth Paginated Response
 */
export interface NHPaginatedResponse<T> {
	data: T[];
	count: number;
	page: number;
	per_page: number;
	total_pages: number;
}

// ============================================================================
// OPTIONS TYPES
// ============================================================================

export interface ListPatientsOptions {
	/** Search query (name, email, phone) */
	query?: string;
	/** Filter by inactive status */
	inactive?: boolean;
	/** Page number */
	page?: number;
	/** Results per page (max 100) */
	perPage?: number;
}

export interface CreatePatientOptions {
	firstName: string;
	lastName: string;
	email?: string;
	phone?: string;
	cellPhone?: string;
	dateOfBirth?: string;
	gender?: string;
	address?: {
		line1?: string;
		city?: string;
		state?: string;
		zip?: string;
	};
}

export interface ListAppointmentsOptions {
	/** Filter by patient ID */
	patientId?: number;
	/** Filter by provider ID */
	providerId?: number;
	/** Start date (ISO string) */
	startDate?: string;
	/** End date (ISO string) */
	endDate?: string;
	/** Filter by status */
	status?: NHAppointmentStatus;
	/** Page number */
	page?: number;
	/** Results per page */
	perPage?: number;
}

export interface CreateAppointmentOptions {
	/** Patient ID */
	patientId: number;
	/** Provider ID */
	providerId: number;
	/** Appointment type ID */
	appointmentTypeId: number;
	/** Start time (ISO string) */
	startTime: string;
	/** Duration in minutes (optional, uses appointment type default) */
	duration?: number;
	/** Operatory ID */
	operatoryId?: number;
	/** Notes */
	notes?: string;
}

export interface GetAvailableSlotsOptions {
	/** Provider ID */
	providerId?: number;
	/** Appointment type ID */
	appointmentTypeId: number;
	/** Start date (ISO string) */
	startDate: string;
	/** End date (ISO string) */
	endDate: string;
}

export interface SendFormOptions {
	/** Patient ID */
	patientId: number;
	/** Form ID */
	formId: number;
	/** Delivery method */
	deliveryMethod?: 'email' | 'sms' | 'both';
}

export interface GetInactivePatientsOptions {
	/** Months since last appointment (default: 6) */
	monthsInactive?: number;
	/** Page number */
	page?: number;
	/** Results per page */
	perPage?: number;
}

// ============================================================================
// NEXHEALTH INTEGRATION CLASS
// ============================================================================

/** Error handler bound to NexHealth integration */
const handleError = createErrorHandler('nexhealth');

/**
 * NexHealth Healthcare Integration
 *
 * Weniger, aber besser: Unified healthcare client for patient scheduling automation.
 */
export class NexHealth extends BaseAPIClient {
	private readonly subdomain: string;
	private readonly locationId?: string;

	constructor(config: NexHealthConfig) {
		if (!config.apiKey) {
			throw new Error('NexHealth API key is required');
		}

		if (!config.subdomain) {
			throw new Error('NexHealth subdomain is required');
		}

		super({
			accessToken: config.apiKey,
			apiUrl: config.apiUrl || 'https://nexhealth.info/api/v1',
			timeout: config.timeout,
			errorContext: { integration: 'nexhealth' },
		});

		this.subdomain = config.subdomain;
		this.locationId = config.locationId;
	}

	/**
	 * Get standard query params including subdomain
	 */
	private getBaseParams(): Record<string, string | undefined> {
		return {
			subdomain: this.subdomain,
			location_id: this.locationId,
		};
	}

	// ==========================================================================
	// PATIENTS
	// ==========================================================================

	/**
	 * Get a patient by ID
	 */
	async getPatient(patientId: number): Promise<ActionResult<NHPatient>> {
		try {
			const response = await this.get(
				`/patients/${patientId}${buildQueryString(this.getBaseParams())}`
			);
			await assertResponseOk(response, { integration: 'nexhealth', action: 'get-patient' });

			const data = (await response.json()) as { data: NHPatient };

			return createActionResult({
				data: data.data,
				integration: 'nexhealth',
				action: 'get-patient',
				schema: 'nexhealth.patient.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-patient');
		}
	}

	/**
	 * List patients with optional filters
	 */
	async listPatients(options: ListPatientsOptions = {}): Promise<ActionResult<NHPaginatedResponse<NHPatient>>> {
		const { query, inactive, page = 1, perPage = 50 } = options;

		try {
			const params: Record<string, string | number | boolean | undefined> = {
				...this.getBaseParams(),
				page,
				per_page: perPage,
			};

			if (query) params.query = query;
			if (inactive !== undefined) params.inactive = inactive;

			const response = await this.get(`/patients${buildQueryString(params)}`);
			await assertResponseOk(response, { integration: 'nexhealth', action: 'list-patients' });

			const data = (await response.json()) as NHPaginatedResponse<NHPatient>;

			return createActionResult({
				data,
				integration: 'nexhealth',
				action: 'list-patients',
				schema: 'nexhealth.patient-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-patients');
		}
	}

	/**
	 * Search for patients
	 */
	async searchPatients(query: string): Promise<ActionResult<NHPatient[]>> {
		const result = await this.listPatients({ query });
		if (!result.success) {
			return ActionResult.error(
				result.error?.message || 'Failed to search patients',
				result.error?.code || ErrorCode.API_ERROR,
				{ integration: 'nexhealth', action: 'search-patients' }
			);
		}

		return createActionResult({
			data: result.data.data,
			integration: 'nexhealth',
			action: 'search-patients',
			schema: 'nexhealth.patient-list.v1',
			capabilities: this.getCapabilities(),
		});
	}

	/**
	 * Create a patient
	 */
	async createPatient(options: CreatePatientOptions): Promise<ActionResult<NHPatient>> {
		const { firstName, lastName, email, phone, cellPhone, dateOfBirth, gender, address } = options;

		if (!firstName || !lastName) {
			return ActionResult.error('First name and last name are required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'nexhealth',
				action: 'create-patient',
			});
		}

		try {
			const patientData: Record<string, unknown> = {
				first_name: firstName,
				last_name: lastName,
			};

			if (email) patientData.email = email;
			if (phone) patientData.phone = phone;
			if (cellPhone) patientData.cell_phone = cellPhone;
			if (dateOfBirth) patientData.date_of_birth = dateOfBirth;
			if (gender) patientData.gender = gender;
			if (address) {
				patientData.address = {
					line1: address.line1,
					city: address.city,
					state: address.state,
					zip: address.zip,
				};
			}

			const response = await this.post(
				`/patients${buildQueryString(this.getBaseParams())}`,
				{ patient: patientData }
			);
			await assertResponseOk(response, { integration: 'nexhealth', action: 'create-patient' });

			const data = (await response.json()) as { data: NHPatient };

			return createActionResult({
				data: data.data,
				integration: 'nexhealth',
				action: 'create-patient',
				schema: 'nexhealth.patient.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'create-patient');
		}
	}

	/**
	 * Get inactive patients (Zuhandenheit API)
	 *
	 * Outcome-focused: "Who needs to be reactivated?"
	 */
	async getInactivePatients(options: GetInactivePatientsOptions = {}): Promise<ActionResult<NHPatient[]>> {
		const { monthsInactive = 6, page = 1, perPage = 100 } = options;

		try {
			// Calculate the cutoff date
			const cutoffDate = new Date();
			cutoffDate.setMonth(cutoffDate.getMonth() - monthsInactive);

			// Get patients and filter by last appointment date
			const result = await this.listPatients({ inactive: false, page, perPage });
			if (!result.success) {
				return ActionResult.error(
					result.error?.message || 'Failed to get patients',
					result.error?.code || ErrorCode.API_ERROR,
					{ integration: 'nexhealth', action: 'get-inactive-patients' }
				);
			}

			const inactivePatients = result.data.data.filter(patient => {
				if (!patient.last_appointment_date) return true;
				const lastVisit = new Date(patient.last_appointment_date);
				return lastVisit < cutoffDate;
			});

			return createActionResult({
				data: inactivePatients,
				integration: 'nexhealth',
				action: 'get-inactive-patients',
				schema: 'nexhealth.patient-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-inactive-patients');
		}
	}

	// ==========================================================================
	// APPOINTMENTS
	// ==========================================================================

	/**
	 * Get an appointment by ID
	 */
	async getAppointment(appointmentId: number): Promise<ActionResult<NHAppointment>> {
		try {
			const response = await this.get(
				`/appointments/${appointmentId}${buildQueryString(this.getBaseParams())}`
			);
			await assertResponseOk(response, { integration: 'nexhealth', action: 'get-appointment' });

			const data = (await response.json()) as { data: NHAppointment };

			return createActionResult({
				data: data.data,
				integration: 'nexhealth',
				action: 'get-appointment',
				schema: 'nexhealth.appointment.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-appointment');
		}
	}

	/**
	 * List appointments with optional filters
	 */
	async listAppointments(options: ListAppointmentsOptions = {}): Promise<ActionResult<NHPaginatedResponse<NHAppointment>>> {
		const { patientId, providerId, startDate, endDate, status, page = 1, perPage = 50 } = options;

		try {
			const params: Record<string, string | number | undefined> = {
				...this.getBaseParams(),
				page,
				per_page: perPage,
			};

			if (patientId) params.patient_id = patientId;
			if (providerId) params.provider_id = providerId;
			if (startDate) params.start_date = startDate;
			if (endDate) params.end_date = endDate;
			if (status) params.status = status;

			const response = await this.get(`/appointments${buildQueryString(params)}`);
			await assertResponseOk(response, { integration: 'nexhealth', action: 'list-appointments' });

			const data = (await response.json()) as NHPaginatedResponse<NHAppointment>;

			return createActionResult({
				data,
				integration: 'nexhealth',
				action: 'list-appointments',
				schema: 'nexhealth.appointment-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-appointments');
		}
	}

	/**
	 * Get today's appointments (Zuhandenheit API)
	 *
	 * Outcome-focused: "What's on the schedule today?"
	 */
	async getTodaysAppointments(): Promise<ActionResult<NHAppointment[]>> {
		const today = new Date();
		const startDate = today.toISOString().split('T')[0];
		const endDate = startDate;

		const result = await this.listAppointments({ startDate, endDate, perPage: 100 });
		if (!result.success) {
			return ActionResult.error(
				result.error?.message || 'Failed to get appointments',
				result.error?.code || ErrorCode.API_ERROR,
				{ integration: 'nexhealth', action: 'get-todays-appointments' }
			);
		}

		return createActionResult({
			data: result.data.data,
			integration: 'nexhealth',
			action: 'get-todays-appointments',
			schema: 'nexhealth.appointment-list.v1',
			capabilities: this.getCapabilities(),
		});
	}

	/**
	 * Get upcoming appointments (Zuhandenheit API)
	 *
	 * Outcome-focused: "What's coming up this week?"
	 */
	async getUpcomingAppointments(days = 7): Promise<ActionResult<NHAppointment[]>> {
		const today = new Date();
		const endDate = new Date();
		endDate.setDate(endDate.getDate() + days);

		const result = await this.listAppointments({
			startDate: today.toISOString().split('T')[0],
			endDate: endDate.toISOString().split('T')[0],
			perPage: 100,
		});
		if (!result.success) {
			return ActionResult.error(
				result.error?.message || 'Failed to get appointments',
				result.error?.code || ErrorCode.API_ERROR,
				{ integration: 'nexhealth', action: 'get-upcoming-appointments' }
			);
		}

		return createActionResult({
			data: result.data.data,
			integration: 'nexhealth',
			action: 'get-upcoming-appointments',
			schema: 'nexhealth.appointment-list.v1',
			capabilities: this.getCapabilities(),
		});
	}

	/**
	 * Create an appointment
	 */
	async createAppointment(options: CreateAppointmentOptions): Promise<ActionResult<NHAppointment>> {
		const { patientId, providerId, appointmentTypeId, startTime, duration, operatoryId, notes } = options;

		if (!patientId || !providerId || !appointmentTypeId || !startTime) {
			return ActionResult.error(
				'Patient ID, provider ID, appointment type ID, and start time are required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'nexhealth', action: 'create-appointment' }
			);
		}

		try {
			const appointmentData: Record<string, unknown> = {
				patient_id: patientId,
				provider_id: providerId,
				appointment_type_id: appointmentTypeId,
				start_time: startTime,
			};

			if (duration) appointmentData.duration = duration;
			if (operatoryId) appointmentData.operatory_id = operatoryId;
			if (notes) appointmentData.notes = notes;

			const response = await this.post(
				`/appointments${buildQueryString(this.getBaseParams())}`,
				{ appointment: appointmentData }
			);
			await assertResponseOk(response, { integration: 'nexhealth', action: 'create-appointment' });

			const data = (await response.json()) as { data: NHAppointment };

			return createActionResult({
				data: data.data,
				integration: 'nexhealth',
				action: 'create-appointment',
				schema: 'nexhealth.appointment.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'create-appointment');
		}
	}

	/**
	 * Confirm an appointment
	 */
	async confirmAppointment(appointmentId: number): Promise<ActionResult<NHAppointment>> {
		try {
			const response = await this.patch(
				`/appointments/${appointmentId}${buildQueryString(this.getBaseParams())}`,
				{ appointment: { confirmed: true, confirmation_status: 'confirmed' } }
			);
			await assertResponseOk(response, { integration: 'nexhealth', action: 'confirm-appointment' });

			const data = (await response.json()) as { data: NHAppointment };

			return createActionResult({
				data: data.data,
				integration: 'nexhealth',
				action: 'confirm-appointment',
				schema: 'nexhealth.appointment.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'confirm-appointment');
		}
	}

	/**
	 * Cancel an appointment
	 */
	async cancelAppointment(appointmentId: number, reason?: string): Promise<ActionResult<NHAppointment>> {
		try {
			const response = await this.patch(
				`/appointments/${appointmentId}${buildQueryString(this.getBaseParams())}`,
				{ appointment: { status: 'cancelled', notes: reason } }
			);
			await assertResponseOk(response, { integration: 'nexhealth', action: 'cancel-appointment' });

			const data = (await response.json()) as { data: NHAppointment };

			return createActionResult({
				data: data.data,
				integration: 'nexhealth',
				action: 'cancel-appointment',
				schema: 'nexhealth.appointment.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'cancel-appointment');
		}
	}

	/**
	 * Mark appointment as no-show
	 */
	async markNoShow(appointmentId: number): Promise<ActionResult<NHAppointment>> {
		try {
			const response = await this.patch(
				`/appointments/${appointmentId}${buildQueryString(this.getBaseParams())}`,
				{ appointment: { status: 'no_show' } }
			);
			await assertResponseOk(response, { integration: 'nexhealth', action: 'mark-no-show' });

			const data = (await response.json()) as { data: NHAppointment };

			return createActionResult({
				data: data.data,
				integration: 'nexhealth',
				action: 'mark-no-show',
				schema: 'nexhealth.appointment.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'mark-no-show');
		}
	}

	// ==========================================================================
	// AVAILABILITY
	// ==========================================================================

	/**
	 * Get available appointment slots
	 */
	async getAvailableSlots(options: GetAvailableSlotsOptions): Promise<ActionResult<NHAvailableSlot[]>> {
		const { providerId, appointmentTypeId, startDate, endDate } = options;

		if (!appointmentTypeId || !startDate || !endDate) {
			return ActionResult.error(
				'Appointment type ID, start date, and end date are required',
				ErrorCode.MISSING_REQUIRED_FIELD,
				{ integration: 'nexhealth', action: 'get-available-slots' }
			);
		}

		try {
			const params: Record<string, string | number | undefined> = {
				...this.getBaseParams(),
				appointment_type_id: appointmentTypeId,
				start_date: startDate,
				end_date: endDate,
			};

			if (providerId) params.provider_id = providerId;

			const response = await this.get(`/availabilities${buildQueryString(params)}`);
			await assertResponseOk(response, { integration: 'nexhealth', action: 'get-available-slots' });

			const data = (await response.json()) as { data: NHAvailableSlot[] };

			return createActionResult({
				data: data.data,
				integration: 'nexhealth',
				action: 'get-available-slots',
				schema: 'nexhealth.availability-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'get-available-slots');
		}
	}

	// ==========================================================================
	// PROVIDERS
	// ==========================================================================

	/**
	 * List providers
	 */
	async listProviders(): Promise<ActionResult<NHProvider[]>> {
		try {
			const response = await this.get(`/providers${buildQueryString(this.getBaseParams())}`);
			await assertResponseOk(response, { integration: 'nexhealth', action: 'list-providers' });

			const data = (await response.json()) as { data: NHProvider[] };

			return createActionResult({
				data: data.data,
				integration: 'nexhealth',
				action: 'list-providers',
				schema: 'nexhealth.provider-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-providers');
		}
	}

	// ==========================================================================
	// LOCATIONS
	// ==========================================================================

	/**
	 * List locations
	 */
	async listLocations(): Promise<ActionResult<NHLocation[]>> {
		try {
			const response = await this.get(`/locations${buildQueryString({ subdomain: this.subdomain })}`);
			await assertResponseOk(response, { integration: 'nexhealth', action: 'list-locations' });

			const data = (await response.json()) as { data: NHLocation[] };

			return createActionResult({
				data: data.data,
				integration: 'nexhealth',
				action: 'list-locations',
				schema: 'nexhealth.location-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-locations');
		}
	}

	// ==========================================================================
	// APPOINTMENT TYPES
	// ==========================================================================

	/**
	 * List appointment types
	 */
	async listAppointmentTypes(): Promise<ActionResult<NHAppointmentType[]>> {
		try {
			const response = await this.get(`/appointment_types${buildQueryString(this.getBaseParams())}`);
			await assertResponseOk(response, { integration: 'nexhealth', action: 'list-appointment-types' });

			const data = (await response.json()) as { data: NHAppointmentType[] };

			return createActionResult({
				data: data.data,
				integration: 'nexhealth',
				action: 'list-appointment-types',
				schema: 'nexhealth.appointment-type-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-appointment-types');
		}
	}

	// ==========================================================================
	// FORMS
	// ==========================================================================

	/**
	 * List forms
	 */
	async listForms(): Promise<ActionResult<NHForm[]>> {
		try {
			const response = await this.get(`/forms${buildQueryString(this.getBaseParams())}`);
			await assertResponseOk(response, { integration: 'nexhealth', action: 'list-forms' });

			const data = (await response.json()) as { data: NHForm[] };

			return createActionResult({
				data: data.data,
				integration: 'nexhealth',
				action: 'list-forms',
				schema: 'nexhealth.form-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'list-forms');
		}
	}

	/**
	 * Send form to patient
	 */
	async sendForm(options: SendFormOptions): Promise<ActionResult<NHFormSubmission>> {
		const { patientId, formId, deliveryMethod = 'email' } = options;

		if (!patientId || !formId) {
			return ActionResult.error('Patient ID and form ID are required', ErrorCode.MISSING_REQUIRED_FIELD, {
				integration: 'nexhealth',
				action: 'send-form',
			});
		}

		try {
			const response = await this.post(
				`/form_submissions${buildQueryString(this.getBaseParams())}`,
				{
					form_submission: {
						patient_id: patientId,
						form_id: formId,
						delivery_method: deliveryMethod,
					},
				}
			);
			await assertResponseOk(response, { integration: 'nexhealth', action: 'send-form' });

			const data = (await response.json()) as { data: NHFormSubmission };

			return createActionResult({
				data: data.data,
				integration: 'nexhealth',
				action: 'send-form',
				schema: 'nexhealth.form-submission.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'send-form');
		}
	}

	// ==========================================================================
	// WEBHOOKS
	// ==========================================================================

	/**
	 * Verify NexHealth webhook signature
	 */
	async verifyWebhook(
		payload: string,
		signature: string,
		secret: string
	): Promise<ActionResult<{ valid: boolean; event: NHWebhookEvent | null }>> {
		try {
			const encoder = new TextEncoder();
			const key = await crypto.subtle.importKey(
				'raw',
				encoder.encode(secret),
				{ name: 'HMAC', hash: 'SHA-256' },
				false,
				['sign']
			);
			const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
			const computedSignature = Array.from(new Uint8Array(signatureBuffer))
				.map(b => b.toString(16).padStart(2, '0'))
				.join('');

			if (computedSignature !== signature) {
				return createActionResult({
					data: { valid: false, event: null },
					integration: 'nexhealth',
					action: 'verify-webhook',
					schema: 'nexhealth.webhook-result.v1',
					capabilities: this.getCapabilities(),
				});
			}

			const event = JSON.parse(payload) as NHWebhookEvent;

			return createActionResult({
				data: { valid: true, event },
				integration: 'nexhealth',
				action: 'verify-webhook',
				schema: 'nexhealth.webhook-result.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return handleError(error, 'verify-webhook');
		}
	}

	// ==========================================================================
	// HELPERS
	// ==========================================================================

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
// WEBHOOK TYPES
// ============================================================================

export interface NHWebhookEvent {
	event: string;
	resource_type: 'appointment' | 'patient' | 'form_submission';
	resource_id: number;
	data: {
		appointment?: NHAppointment;
		patient?: NHPatient;
		form_submission?: NHFormSubmission;
	};
	created_at: string;
}
