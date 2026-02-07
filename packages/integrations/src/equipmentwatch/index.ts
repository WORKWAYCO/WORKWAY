/**
 * EquipmentWatch API Integration for WORKWAY
 *
 * Heavy equipment cost data, rental rates, specifications, and market values.
 * Used by contractors, lenders, insurance companies, and software vendors.
 *
 * Zuhandenheit: Estimators don't want "equipment data APIs" - they want:
 * - Accurate equipment costs in their estimates without manual lookups
 * - Rental vs. own decisions backed by real market data
 * - Equipment values for insurance and collateral assessment
 * - Specs that match what's actually available in the market
 *
 * @example
 * ```typescript
 * import { EquipmentWatch } from '@workwayco/integrations/equipmentwatch';
 *
 * const ew = new EquipmentWatch({
 *   apiKey: process.env.EQUIPMENTWATCH_API_KEY,
 * });
 *
 * // Search equipment
 * const results = await ew.searchEquipment('CAT 320 Excavator');
 *
 * // Get rental rates
 * const rates = await ew.getRentalRates('model-id', 'US-West');
 *
 * // Get market value
 * const value = await ew.getMarketValue('model-id', 'good');
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
 * EquipmentWatch integration configuration
 *
 * Authentication: API key
 * Access: Sales-gated, request form per endpoint
 */
export interface EquipmentWatchConfig {
	/** EquipmentWatch API key */
	apiKey: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
}

// ----------------------------------------------------------------------------
// Equipment Resources
// ----------------------------------------------------------------------------

/** Equipment model */
export interface EWEquipment {
	id: string;
	make: string;
	model: string;
	year?: number;
	category: string;
	subcategory?: string;
	description?: string;
	imageUrl?: string;
	specifications?: EWSpecification;
}

/** Equipment specifications */
export interface EWSpecification {
	id: string;
	equipmentId: string;
	operatingWeight?: number;
	operatingWeightUnit?: string;
	horsepower?: number;
	bucketCapacity?: number;
	bucketCapacityUnit?: string;
	maxDigDepth?: number;
	maxReach?: number;
	liftCapacity?: number;
	engineMake?: string;
	engineModel?: string;
	fuelType?: string;
	dimensions?: {
		length?: number;
		width?: number;
		height?: number;
		unit?: string;
	};
	additionalSpecs?: Record<string, unknown>;
}

// ----------------------------------------------------------------------------
// Cost & Value Resources
// ----------------------------------------------------------------------------

/** Rental rate data */
export interface EWRentalRate {
	equipmentId: string;
	region: string;
	daily?: number;
	weekly?: number;
	monthly?: number;
	currency: string;
	effectiveDate: string;
	source?: string;
	nationalAverage?: {
		daily?: number;
		weekly?: number;
		monthly?: number;
	};
}

/** Market value assessment */
export interface EWMarketValue {
	equipmentId: string;
	condition: string;
	fairMarketValue: number;
	auctionValue?: number;
	retailValue?: number;
	tradeInValue?: number;
	functionalLossValue?: number;
	currency: string;
	valuationDate: string;
	adjustments?: Record<string, number>;
}

/** Ownership cost breakdown */
export interface EWOwnershipCost {
	equipmentId: string;
	hourlyRate: number;
	monthlyRate: number;
	annualRate: number;
	currency: string;
	breakdown?: {
		depreciation?: number;
		interest?: number;
		insurance?: number;
		taxes?: number;
		storage?: number;
		fuel?: number;
		maintenance?: number;
		tires?: number;
	};
	utilizationRate?: number;
	economicLife?: number;
}

// ----------------------------------------------------------------------------
// Category/Taxonomy Resources
// ----------------------------------------------------------------------------

/** Equipment category */
export interface EWCategory {
	id: string;
	name: string;
	parentId?: string;
	level: number;
	equipmentCount?: number;
	subcategories?: EWCategory[];
}

// ----------------------------------------------------------------------------
// Market Data Resources
// ----------------------------------------------------------------------------

/** Market data (resale/auction benchmarks) */
export interface EWMarketData {
	equipmentId: string;
	dataType: string;
	period: string;
	saleCount?: number;
	averagePrice?: number;
	medianPrice?: number;
	lowPrice?: number;
	highPrice?: number;
	region?: string;
	source?: string;
}

// ============================================================================
// OPTIONS TYPES
// ============================================================================

export interface SearchEquipmentOptions {
	query: string;
	category?: string;
	make?: string;
	yearMin?: number;
	yearMax?: number;
	page?: number;
	perPage?: number;
}

export interface GetMarketDataOptions {
	equipmentId?: string;
	category?: string;
	make?: string;
	region?: string;
	period?: string;
	page?: number;
	perPage?: number;
}

// ============================================================================
// EQUIPMENTWATCH INTEGRATION CLASS
// ============================================================================

/**
 * EquipmentWatch API Integration
 *
 * Weniger, aber besser: Equipment cost intelligence for construction.
 *
 * API: REST
 * Auth: API key
 * Rate Limit: Varies by subscription
 * Access: Sales-gated, request form per endpoint
 * Coverage: 33K+ equipment models
 */
export class EquipmentWatch extends BaseAPIClient {
	private readonly ewApiKey: string;

	constructor(config: EquipmentWatchConfig) {
		if (!config.apiKey) {
			throw new IntegrationError(
				ErrorCode.MISSING_REQUIRED_FIELD,
				'EquipmentWatch API key is required',
				{ integration: 'equipmentwatch' }
			);
		}

		super({
			accessToken: config.apiKey,
			apiUrl: 'https://api.equipmentwatch.com',
			timeout: config.timeout,
			errorContext: { integration: 'equipmentwatch' },
		});

		this.ewApiKey = config.apiKey;
	}

	/**
	 * Override to use API key header
	 */
	override getJson<T = unknown>(path: string, additionalHeaders: Record<string, string> = {}): Promise<T> {
		return super.getJson<T>(path, {
			'X-API-Key': this.ewApiKey,
			...additionalHeaders,
		});
	}

	// ==========================================================================
	// TAXONOMY
	// ==========================================================================

	async getCategories(): Promise<ActionResult<EWCategory[]>> {
		try {
			const categories = await this.getJson<EWCategory[]>('/v1/taxonomy/categories');

			return createActionResult({
				data: categories,
				integration: 'equipmentwatch',
				action: 'get-categories',
				schema: 'equipmentwatch.categories.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-categories');
		}
	}

	// ==========================================================================
	// EQUIPMENT SEARCH
	// ==========================================================================

	async searchEquipment(options: SearchEquipmentOptions): Promise<ActionResult<EWEquipment[]>> {
		const query = buildQueryString({
			q: options.query,
			category: options.category,
			make: options.make,
			year_min: options.yearMin,
			year_max: options.yearMax,
			page: options.page,
			per_page: options.perPage,
		});

		try {
			const equipment = await this.getJson<EWEquipment[]>(`/v1/equipment${query}`);

			return createActionResult({
				data: equipment,
				integration: 'equipmentwatch',
				action: 'search-equipment',
				schema: 'equipmentwatch.equipment.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'search-equipment');
		}
	}

	// ==========================================================================
	// SPECIFICATIONS
	// ==========================================================================

	async getSpecifications(equipmentId: string): Promise<ActionResult<EWSpecification>> {
		try {
			const specs = await this.getJson<EWSpecification>(`/v1/equipment/${equipmentId}/specs`);

			return createActionResult({
				data: specs,
				integration: 'equipmentwatch',
				action: 'get-specifications',
				schema: 'equipmentwatch.specifications.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-specifications');
		}
	}

	// ==========================================================================
	// RENTAL RATES
	// ==========================================================================

	async getRentalRates(equipmentId: string, region?: string): Promise<ActionResult<EWRentalRate>> {
		const query = region ? buildQueryString({ region }) : '';

		try {
			const rates = await this.getJson<EWRentalRate>(`/v1/equipment/${equipmentId}/rental${query}`);

			return createActionResult({
				data: rates,
				integration: 'equipmentwatch',
				action: 'get-rental-rates',
				schema: 'equipmentwatch.rental-rates.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-rental-rates');
		}
	}

	// ==========================================================================
	// MARKET VALUE
	// ==========================================================================

	async getMarketValue(equipmentId: string, condition?: string): Promise<ActionResult<EWMarketValue>> {
		const query = condition ? buildQueryString({ condition }) : '';

		try {
			const value = await this.getJson<EWMarketValue>(`/v1/equipment/${equipmentId}/value${query}`);

			return createActionResult({
				data: value,
				integration: 'equipmentwatch',
				action: 'get-market-value',
				schema: 'equipmentwatch.market-value.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-market-value');
		}
	}

	// ==========================================================================
	// OWNERSHIP COSTS
	// ==========================================================================

	async getOwnershipCosts(equipmentId: string): Promise<ActionResult<EWOwnershipCost>> {
		try {
			const costs = await this.getJson<EWOwnershipCost>(`/v1/equipment/${equipmentId}/ownership-costs`);

			return createActionResult({
				data: costs,
				integration: 'equipmentwatch',
				action: 'get-ownership-costs',
				schema: 'equipmentwatch.ownership-costs.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-ownership-costs');
		}
	}

	// ==========================================================================
	// VERIFICATION
	// ==========================================================================

	async verifyEquipment(serialNumber: string): Promise<ActionResult<Record<string, unknown>>> {
		try {
			const result = await this.getJson<Record<string, unknown>>(
				`/v1/verification?serial_number=${encodeURIComponent(serialNumber)}`
			);

			return createActionResult({
				data: result,
				integration: 'equipmentwatch',
				action: 'verify-equipment',
				schema: 'equipmentwatch.verification.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'verify-equipment');
		}
	}

	// ==========================================================================
	// MARKET DATA
	// ==========================================================================

	async getMarketData(options: GetMarketDataOptions = {}): Promise<ActionResult<EWMarketData[]>> {
		const query = buildQueryString({
			equipment_id: options.equipmentId,
			category: options.category,
			make: options.make,
			region: options.region,
			period: options.period,
			page: options.page,
			per_page: options.perPage,
		});

		try {
			const data = await this.getJson<EWMarketData[]>(`/v1/market-data${query}`);

			return createActionResult({
				data,
				integration: 'equipmentwatch',
				action: 'get-market-data',
				schema: 'equipmentwatch.market-data.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-market-data');
		}
	}

	// ==========================================================================
	// HELPERS
	// ==========================================================================

	private handleError(error: unknown, action: string): ActionResult<never> {
		if (error instanceof IntegrationError) {
			return ActionResult.error(error.message, error.code, {
				integration: 'equipmentwatch',
				action,
			});
		}

		const message = error instanceof Error ? error.message : String(error);
		return ActionResult.error(message, ErrorCode.API_ERROR, {
			integration: 'equipmentwatch',
			action,
		});
	}

	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			canHandleRichText: false,
			canHandleMarkdown: false,
			canHandleImages: true,
			canHandleAttachments: false,
			supportsSearch: true,
			supportsPagination: true,
			supportsNesting: true,
			supportsRelations: false,
			supportsMetadata: true,
		};
	}
}
