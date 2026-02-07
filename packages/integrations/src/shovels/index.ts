/**
 * Shovels.ai API Integration for WORKWAY
 *
 * Construction permit intelligence from thousands of US municipalities.
 * Provides enriched, AI-standardized permit data, contractor profiles,
 * and property-level construction activity.
 *
 * Zuhandenheit: Contractors don't want "permit database queries" - they want:
 * - Early signals of construction activity in their market
 * - Contractor track records before they award work
 * - Property history before they bid a renovation
 * - Market intelligence without hiring an analyst
 *
 * @example
 * ```typescript
 * import { Shovels } from '@workwayco/integrations/shovels';
 *
 * const shovels = new Shovels({
 *   apiKey: process.env.SHOVELS_API_KEY,
 * });
 *
 * // Search permits in a zip code
 * const permits = await shovels.getPermits({ zipCode: '90210' });
 *
 * // Look up a contractor
 * const contractor = await shovels.getContractor('contractor-id');
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
 * Shovels.ai integration configuration
 *
 * Authentication: API key via X-API-Key header
 */
export interface ShovelsConfig {
	/** Shovels API key */
	apiKey: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
}

// ----------------------------------------------------------------------------
// Permit Resources
// ----------------------------------------------------------------------------

/** Construction permit record */
export interface ShovelsPermit {
	id: string;
	number?: string;
	type: string;
	subtype?: string;
	status: string;
	description?: string;
	address: string;
	city?: string;
	state?: string;
	zip_code?: string;
	county?: string;
	latitude?: number;
	longitude?: number;
	issue_date?: string;
	final_date?: string;
	expiration_date?: string;
	estimated_value?: number;
	fees?: number;
	contractor?: {
		id: string;
		name: string;
		license_number?: string;
	};
	property?: {
		id: string;
		address: string;
	};
	jurisdiction?: {
		id: string;
		name: string;
		state: string;
	};
	created_at: string;
	updated_at: string;
}

// ----------------------------------------------------------------------------
// Contractor Resources
// ----------------------------------------------------------------------------

/** Contractor profile */
export interface ShovelsContractor {
	id: string;
	name: string;
	business_name?: string;
	license_number?: string;
	license_type?: string;
	license_status?: string;
	address?: string;
	city?: string;
	state?: string;
	zip_code?: string;
	phone?: string;
	email?: string;
	specialties?: string[];
	permit_count?: number;
	first_permit_date?: string;
	last_permit_date?: string;
	average_project_value?: number;
	total_project_value?: number;
	jurisdictions?: string[];
}

// ----------------------------------------------------------------------------
// Property Resources
// ----------------------------------------------------------------------------

/** Property with permit history */
export interface ShovelsProperty {
	id: string;
	address: string;
	city?: string;
	state?: string;
	zip_code?: string;
	county?: string;
	latitude?: number;
	longitude?: number;
	parcel_number?: string;
	lot_size_sqft?: number;
	building_size_sqft?: number;
	year_built?: number;
	property_type?: string;
	permit_count?: number;
	permits?: ShovelsPermit[];
}

// ----------------------------------------------------------------------------
// Jurisdiction Resources
// ----------------------------------------------------------------------------

/** Jurisdiction (municipality/county providing permit data) */
export interface ShovelsJurisdiction {
	id: string;
	name: string;
	state: string;
	county?: string;
	fips_code?: string;
	permit_count?: number;
	coverage_start_date?: string;
	last_update_date?: string;
}

// ============================================================================
// OPTIONS TYPES
// ============================================================================

export interface GetPermitsOptions {
	/** Filter by zip code */
	zipCode?: string;
	/** Filter by city */
	city?: string;
	/** Filter by state (2-letter code) */
	state?: string;
	/** Filter by county */
	county?: string;
	/** Filter by permit type */
	type?: string;
	/** Filter by permit status */
	status?: string;
	/** Issued after date (ISO 8601) */
	issuedAfter?: string;
	/** Issued before date (ISO 8601) */
	issuedBefore?: string;
	/** Minimum estimated value */
	minValue?: number;
	/** Maximum estimated value */
	maxValue?: number;
	/** Page number */
	page?: number;
	/** Results per page (max 100) */
	perPage?: number;
}

export interface GetContractorsOptions {
	/** Filter by state */
	state?: string;
	/** Filter by city */
	city?: string;
	/** Filter by zip code */
	zipCode?: string;
	/** Filter by specialty */
	specialty?: string;
	/** Minimum number of permits */
	minPermits?: number;
	/** Page number */
	page?: number;
	/** Results per page */
	perPage?: number;
}

export interface GetPropertiesOptions {
	/** Filter by zip code */
	zipCode?: string;
	/** Filter by city */
	city?: string;
	/** Filter by state */
	state?: string;
	/** Filter by property type */
	propertyType?: string;
	/** Include permit history */
	includePermits?: boolean;
	/** Page number */
	page?: number;
	/** Results per page */
	perPage?: number;
}

export interface GeoSearchOptions {
	/** Center latitude */
	latitude: number;
	/** Center longitude */
	longitude: number;
	/** Radius in miles */
	radiusMiles?: number;
	/** Filter by permit type */
	type?: string;
	/** Issued after date */
	issuedAfter?: string;
	/** Page number */
	page?: number;
	/** Results per page */
	perPage?: number;
}

// ============================================================================
// SHOVELS INTEGRATION CLASS
// ============================================================================

/**
 * Shovels.ai API Integration
 *
 * Weniger, aber besser: Construction permit intelligence for market awareness.
 *
 * API: REST v2
 * Auth: API key (X-API-Key header)
 * Rate Limit: Varies by plan (free: 250 requests total)
 * Pagination: Page-based
 */
export class Shovels extends BaseAPIClient {
	private readonly shovelsApiKey: string;

	constructor(config: ShovelsConfig) {
		if (!config.apiKey) {
			throw new IntegrationError(
				ErrorCode.MISSING_REQUIRED_FIELD,
				'Shovels API key is required',
				{ integration: 'shovels' }
			);
		}

		super({
			accessToken: config.apiKey,
			apiUrl: 'https://api.shovels.ai',
			timeout: config.timeout,
			errorContext: { integration: 'shovels' },
		});

		this.shovelsApiKey = config.apiKey;
	}

	/**
	 * Override to use X-API-Key header instead of Bearer
	 */
	override get(path: string, additionalHeaders: Record<string, string> = {}): Promise<Response> {
		return super.get(path, {
			'X-API-Key': this.shovelsApiKey,
			...additionalHeaders,
		});
	}

	override getJson<T = unknown>(path: string, additionalHeaders: Record<string, string> = {}): Promise<T> {
		return super.getJson<T>(path, {
			'X-API-Key': this.shovelsApiKey,
			...additionalHeaders,
		});
	}

	// ==========================================================================
	// PERMITS
	// ==========================================================================

	/**
	 * Search permits with filters
	 */
	async getPermits(options: GetPermitsOptions = {}): Promise<ActionResult<ShovelsPermit[]>> {
		const query = buildQueryString({
			zip_code: options.zipCode,
			city: options.city,
			state: options.state,
			county: options.county,
			type: options.type,
			status: options.status,
			issued_after: options.issuedAfter,
			issued_before: options.issuedBefore,
			min_value: options.minValue,
			max_value: options.maxValue,
			page: options.page,
			per_page: options.perPage ? Math.min(options.perPage, 100) : undefined,
		});

		try {
			const permits = await this.getJson<ShovelsPermit[]>(`/v2/permits${query}`);

			return createActionResult({
				data: permits,
				integration: 'shovels',
				action: 'get-permits',
				schema: 'shovels.permits.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-permits');
		}
	}

	/**
	 * Get a single permit by ID
	 */
	async getPermit(permitId: string): Promise<ActionResult<ShovelsPermit>> {
		try {
			const permit = await this.getJson<ShovelsPermit>(`/v2/permits/${permitId}`);

			return createActionResult({
				data: permit,
				integration: 'shovels',
				action: 'get-permit',
				schema: 'shovels.permit.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-permit');
		}
	}

	/**
	 * Geo-search for permit activity around a point
	 */
	async getPermitActivity(options: GeoSearchOptions): Promise<ActionResult<ShovelsPermit[]>> {
		const query = buildQueryString({
			latitude: options.latitude,
			longitude: options.longitude,
			radius_miles: options.radiusMiles || 5,
			type: options.type,
			issued_after: options.issuedAfter,
			page: options.page,
			per_page: options.perPage ? Math.min(options.perPage, 100) : undefined,
		});

		try {
			const permits = await this.getJson<ShovelsPermit[]>(`/v2/permits/geo${query}`);

			return createActionResult({
				data: permits,
				integration: 'shovels',
				action: 'get-permit-activity',
				schema: 'shovels.permits.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-permit-activity');
		}
	}

	// ==========================================================================
	// CONTRACTORS
	// ==========================================================================

	/**
	 * Search contractors
	 */
	async getContractors(options: GetContractorsOptions = {}): Promise<ActionResult<ShovelsContractor[]>> {
		const query = buildQueryString({
			state: options.state,
			city: options.city,
			zip_code: options.zipCode,
			specialty: options.specialty,
			min_permits: options.minPermits,
			page: options.page,
			per_page: options.perPage,
		});

		try {
			const contractors = await this.getJson<ShovelsContractor[]>(`/v2/contractors${query}`);

			return createActionResult({
				data: contractors,
				integration: 'shovels',
				action: 'get-contractors',
				schema: 'shovels.contractors.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-contractors');
		}
	}

	/**
	 * Get a single contractor by ID
	 */
	async getContractor(contractorId: string): Promise<ActionResult<ShovelsContractor>> {
		try {
			const contractor = await this.getJson<ShovelsContractor>(`/v2/contractors/${contractorId}`);

			return createActionResult({
				data: contractor,
				integration: 'shovels',
				action: 'get-contractor',
				schema: 'shovels.contractor.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-contractor');
		}
	}

	// ==========================================================================
	// PROPERTIES
	// ==========================================================================

	/**
	 * Search properties
	 */
	async getProperties(options: GetPropertiesOptions = {}): Promise<ActionResult<ShovelsProperty[]>> {
		const query = buildQueryString({
			zip_code: options.zipCode,
			city: options.city,
			state: options.state,
			property_type: options.propertyType,
			include_permits: options.includePermits,
			page: options.page,
			per_page: options.perPage,
		});

		try {
			const properties = await this.getJson<ShovelsProperty[]>(`/v2/properties${query}`);

			return createActionResult({
				data: properties,
				integration: 'shovels',
				action: 'get-properties',
				schema: 'shovels.properties.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-properties');
		}
	}

	/**
	 * Get property by ID
	 */
	async getProperty(propertyId: string): Promise<ActionResult<ShovelsProperty>> {
		try {
			const property = await this.getJson<ShovelsProperty>(`/v2/properties/${propertyId}`);

			return createActionResult({
				data: property,
				integration: 'shovels',
				action: 'get-property',
				schema: 'shovels.property.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-property');
		}
	}

	// ==========================================================================
	// JURISDICTIONS
	// ==========================================================================

	/**
	 * Get available jurisdictions
	 */
	async getJurisdictions(state?: string): Promise<ActionResult<ShovelsJurisdiction[]>> {
		const query = state ? buildQueryString({ state }) : '';

		try {
			const jurisdictions = await this.getJson<ShovelsJurisdiction[]>(`/v2/jurisdictions${query}`);

			return createActionResult({
				data: jurisdictions,
				integration: 'shovels',
				action: 'get-jurisdictions',
				schema: 'shovels.jurisdictions.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-jurisdictions');
		}
	}

	// ==========================================================================
	// HELPERS
	// ==========================================================================

	private handleError(error: unknown, action: string): ActionResult<never> {
		if (error instanceof IntegrationError) {
			return ActionResult.error(error.message, error.code, {
				integration: 'shovels',
				action,
			});
		}

		const message = error instanceof Error ? error.message : String(error);
		return ActionResult.error(message, ErrorCode.API_ERROR, {
			integration: 'shovels',
			action,
		});
	}

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
 * Convert Shovels permit to standard project signal format
 */
export function toStandardPermit(permit: ShovelsPermit) {
	return {
		id: permit.id,
		type: permit.type,
		description: permit.description,
		status: permit.status,
		value: permit.estimated_value,
		location: {
			address: permit.address,
			city: permit.city,
			state: permit.state,
			zip: permit.zip_code,
			coordinates: permit.latitude && permit.longitude ? {
				lat: permit.latitude,
				lng: permit.longitude,
			} : undefined,
		},
		issueDate: permit.issue_date,
		contractor: permit.contractor ? {
			id: permit.contractor.id,
			name: permit.contractor.name,
		} : undefined,
		source: 'shovels' as const,
		sourceId: permit.id,
	};
}
