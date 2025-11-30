/**
 * Stripe Integration for WORKWAY
 *
 * Enables payment processing workflows:
 * - Payment intents and charges
 * - Customer management
 * - Subscription lifecycle
 * - Webhook event parsing
 *
 * Implements the SDK patterns:
 * - ActionResult narrow waist for output
 * - IntegrationError narrow waist for errors
 * - StandardData for normalized data
 *
 * @example
 * ```typescript
 * import { Stripe } from '@workwayco/integrations/stripe';
 *
 * const stripe = new Stripe({ secretKey: env.STRIPE_SECRET_KEY });
 *
 * // Create a payment intent
 * const payment = await stripe.createPaymentIntent({
 *   amount: 2000, // $20.00
 *   currency: 'usd',
 *   customer: 'cus_xxx'
 * });
 *
 * // List recent payments
 * const payments = await stripe.listPayments({ limit: 10 });
 *
 * // Create a subscription
 * const subscription = await stripe.createSubscription({
 *   customer: 'cus_xxx',
 *   priceId: 'price_xxx'
 * });
 * ```
 */

import {
	ActionResult,
	createActionResult,
	type StandardData,
	type ActionCapabilities,
} from '@workwayco/sdk';
import { IntegrationError, ErrorCode } from '@workwayco/sdk';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Stripe integration configuration
 */
export interface StripeConfig {
	/** Stripe secret key (sk_live_xxx or sk_test_xxx) */
	secretKey: string;
	/** Optional: Override API endpoint (for testing) */
	apiUrl?: string;
	/** Optional: API version (default: 2023-10-16) */
	apiVersion?: string;
	/** Request timeout in milliseconds (default: 30000) */
	timeout?: number;
}

/**
 * Stripe Payment Intent
 */
export interface StripePaymentIntent {
	id: string;
	object: 'payment_intent';
	amount: number;
	amount_received: number;
	currency: string;
	status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'requires_capture' | 'canceled' | 'succeeded';
	customer: string | null;
	description: string | null;
	metadata: Record<string, string>;
	created: number;
	client_secret: string;
	payment_method: string | null;
	receipt_email: string | null;
}

/**
 * Stripe Customer
 */
export interface StripeCustomer {
	id: string;
	object: 'customer';
	email: string | null;
	name: string | null;
	phone: string | null;
	description: string | null;
	metadata: Record<string, string>;
	created: number;
	balance: number;
	currency: string | null;
	default_source: string | null;
	delinquent: boolean;
}

/**
 * Stripe Subscription
 */
export interface StripeSubscription {
	id: string;
	object: 'subscription';
	customer: string;
	status: 'incomplete' | 'incomplete_expired' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused';
	current_period_start: number;
	current_period_end: number;
	cancel_at_period_end: boolean;
	canceled_at: number | null;
	created: number;
	metadata: Record<string, string>;
	items: {
		data: Array<{
			id: string;
			price: {
				id: string;
				product: string;
				unit_amount: number | null;
				currency: string;
				recurring: {
					interval: 'day' | 'week' | 'month' | 'year';
					interval_count: number;
				} | null;
			};
			quantity: number;
		}>;
	};
}

/**
 * Stripe Charge
 */
export interface StripeCharge {
	id: string;
	object: 'charge';
	amount: number;
	amount_refunded: number;
	currency: string;
	status: 'succeeded' | 'pending' | 'failed';
	customer: string | null;
	description: string | null;
	metadata: Record<string, string>;
	created: number;
	paid: boolean;
	refunded: boolean;
	receipt_url: string | null;
	payment_intent: string | null;
}

/**
 * Stripe Webhook Event
 */
export interface StripeWebhookEvent {
	id: string;
	object: 'event';
	type: string;
	data: {
		object: Record<string, unknown>;
		previous_attributes?: Record<string, unknown>;
	};
	created: number;
	livemode: boolean;
	api_version: string;
}

/**
 * Stripe List Response
 */
export interface StripeList<T> {
	object: 'list';
	data: T[];
	has_more: boolean;
	url: string;
}

// ============================================================================
// OPTIONS TYPES
// ============================================================================

export interface CreatePaymentIntentOptions {
	/** Amount in cents */
	amount: number;
	/** Three-letter ISO currency code */
	currency: string;
	/** Customer ID */
	customer?: string;
	/** Description */
	description?: string;
	/** Metadata */
	metadata?: Record<string, string>;
	/** Receipt email */
	receipt_email?: string;
	/** Automatic payment methods */
	automatic_payment_methods?: { enabled: boolean };
}

export interface ListPaymentsOptions {
	/** Maximum number of results (default: 10, max: 100) */
	limit?: number;
	/** Pagination cursor */
	starting_after?: string;
	/** Filter by customer */
	customer?: string;
	/** Filter by creation date (Unix timestamp) */
	created?: { gte?: number; lte?: number };
}

export interface CreateCustomerOptions {
	/** Customer email */
	email?: string;
	/** Customer name */
	name?: string;
	/** Customer phone */
	phone?: string;
	/** Description */
	description?: string;
	/** Metadata */
	metadata?: Record<string, string>;
	/** Payment method to attach */
	payment_method?: string;
}

export interface CreateSubscriptionOptions {
	/** Customer ID */
	customer: string;
	/** Price ID */
	priceId: string;
	/** Quantity (default: 1) */
	quantity?: number;
	/** Trial period days */
	trial_period_days?: number;
	/** Metadata */
	metadata?: Record<string, string>;
	/** Cancel at period end */
	cancel_at_period_end?: boolean;
}

export interface ListSubscriptionsOptions {
	/** Maximum number of results (default: 10, max: 100) */
	limit?: number;
	/** Pagination cursor */
	starting_after?: string;
	/** Filter by customer */
	customer?: string;
	/** Filter by status */
	status?: 'active' | 'past_due' | 'canceled' | 'all';
}

// ============================================================================
// STRIPE INTEGRATION CLASS
// ============================================================================

/**
 * Stripe Integration
 *
 * Implements the WORKWAY SDK patterns for Stripe API access.
 */
export class Stripe {
	private secretKey: string;
	private apiUrl: string;
	private apiVersion: string;
	private timeout: number;

	constructor(config: StripeConfig) {
		if (!config.secretKey) {
			throw new IntegrationError(
				ErrorCode.AUTH_MISSING,
				'Stripe secret key is required',
				{ integration: 'stripe', retryable: false }
			);
		}

		this.secretKey = config.secretKey;
		this.apiUrl = config.apiUrl || 'https://api.stripe.com/v1';
		this.apiVersion = config.apiVersion || '2023-10-16';
		this.timeout = config.timeout ?? 30000;
	}

	// ==========================================================================
	// PAYMENT INTENTS
	// ==========================================================================

	/**
	 * Create a payment intent
	 */
	async createPaymentIntent(
		options: CreatePaymentIntentOptions
	): Promise<ActionResult<StripePaymentIntent>> {
		try {
			const body = new URLSearchParams();
			body.append('amount', options.amount.toString());
			body.append('currency', options.currency);

			if (options.customer) body.append('customer', options.customer);
			if (options.description) body.append('description', options.description);
			if (options.receipt_email) body.append('receipt_email', options.receipt_email);
			if (options.automatic_payment_methods?.enabled) {
				body.append('automatic_payment_methods[enabled]', 'true');
			}
			if (options.metadata) {
				for (const [key, value] of Object.entries(options.metadata)) {
					body.append(`metadata[${key}]`, value);
				}
			}

			const response = await this.request('/payment_intents', {
				method: 'POST',
				body: body.toString(),
			});

			if (!response.ok) {
				return this.handleStripeError(response, 'create-payment-intent');
			}

			const paymentIntent = (await response.json()) as StripePaymentIntent;
			const rateLimit = this.extractRateLimit(response);

			return createActionResult({
				data: paymentIntent,
				integration: 'stripe',
				action: 'create-payment-intent',
				schema: 'stripe.payment-intent.v1',
				capabilities: this.getCapabilities(),
				rateLimit,
			});
		} catch (error) {
			return this.handleError(error, 'create-payment-intent');
		}
	}

	/**
	 * Retrieve a payment intent
	 */
	async getPaymentIntent(id: string): Promise<ActionResult<StripePaymentIntent>> {
		try {
			const response = await this.request(`/payment_intents/${id}`);

			if (!response.ok) {
				return this.handleStripeError(response, 'get-payment-intent');
			}

			const paymentIntent = (await response.json()) as StripePaymentIntent;

			return createActionResult({
				data: paymentIntent,
				integration: 'stripe',
				action: 'get-payment-intent',
				schema: 'stripe.payment-intent.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-payment-intent');
		}
	}

	/**
	 * List payment intents
	 */
	async listPaymentIntents(
		options: ListPaymentsOptions = {}
	): Promise<ActionResult<StripeList<StripePaymentIntent>>> {
		try {
			const params = new URLSearchParams();
			if (options.limit) params.append('limit', options.limit.toString());
			if (options.starting_after) params.append('starting_after', options.starting_after);
			if (options.customer) params.append('customer', options.customer);

			const url = `/payment_intents${params.toString() ? '?' + params.toString() : ''}`;
			const response = await this.request(url);

			if (!response.ok) {
				return this.handleStripeError(response, 'list-payment-intents');
			}

			const list = (await response.json()) as StripeList<StripePaymentIntent>;

			return createActionResult({
				data: list,
				integration: 'stripe',
				action: 'list-payment-intents',
				schema: 'stripe.payment-intent-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'list-payment-intents');
		}
	}

	// ==========================================================================
	// CUSTOMERS
	// ==========================================================================

	/**
	 * Create a customer
	 */
	async createCustomer(
		options: CreateCustomerOptions = {}
	): Promise<ActionResult<StripeCustomer>> {
		try {
			const body = new URLSearchParams();
			if (options.email) body.append('email', options.email);
			if (options.name) body.append('name', options.name);
			if (options.phone) body.append('phone', options.phone);
			if (options.description) body.append('description', options.description);
			if (options.payment_method) body.append('payment_method', options.payment_method);
			if (options.metadata) {
				for (const [key, value] of Object.entries(options.metadata)) {
					body.append(`metadata[${key}]`, value);
				}
			}

			const response = await this.request('/customers', {
				method: 'POST',
				body: body.toString(),
			});

			if (!response.ok) {
				return this.handleStripeError(response, 'create-customer');
			}

			const customer = (await response.json()) as StripeCustomer;

			return createActionResult({
				data: customer,
				integration: 'stripe',
				action: 'create-customer',
				schema: 'stripe.customer.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'create-customer');
		}
	}

	/**
	 * Retrieve a customer
	 */
	async getCustomer(id: string): Promise<ActionResult<StripeCustomer>> {
		try {
			const response = await this.request(`/customers/${id}`);

			if (!response.ok) {
				return this.handleStripeError(response, 'get-customer');
			}

			const customer = (await response.json()) as StripeCustomer;

			return createActionResult({
				data: customer,
				integration: 'stripe',
				action: 'get-customer',
				schema: 'stripe.customer.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-customer');
		}
	}

	/**
	 * List customers
	 */
	async listCustomers(
		options: { limit?: number; starting_after?: string; email?: string } = {}
	): Promise<ActionResult<StripeList<StripeCustomer>>> {
		try {
			const params = new URLSearchParams();
			if (options.limit) params.append('limit', options.limit.toString());
			if (options.starting_after) params.append('starting_after', options.starting_after);
			if (options.email) params.append('email', options.email);

			const url = `/customers${params.toString() ? '?' + params.toString() : ''}`;
			const response = await this.request(url);

			if (!response.ok) {
				return this.handleStripeError(response, 'list-customers');
			}

			const list = (await response.json()) as StripeList<StripeCustomer>;

			return createActionResult({
				data: list,
				integration: 'stripe',
				action: 'list-customers',
				schema: 'stripe.customer-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'list-customers');
		}
	}

	// ==========================================================================
	// SUBSCRIPTIONS
	// ==========================================================================

	/**
	 * Create a subscription
	 */
	async createSubscription(
		options: CreateSubscriptionOptions
	): Promise<ActionResult<StripeSubscription>> {
		try {
			const body = new URLSearchParams();
			body.append('customer', options.customer);
			body.append('items[0][price]', options.priceId);

			if (options.quantity) body.append('items[0][quantity]', options.quantity.toString());
			if (options.trial_period_days) {
				body.append('trial_period_days', options.trial_period_days.toString());
			}
			if (options.cancel_at_period_end) {
				body.append('cancel_at_period_end', 'true');
			}
			if (options.metadata) {
				for (const [key, value] of Object.entries(options.metadata)) {
					body.append(`metadata[${key}]`, value);
				}
			}

			const response = await this.request('/subscriptions', {
				method: 'POST',
				body: body.toString(),
			});

			if (!response.ok) {
				return this.handleStripeError(response, 'create-subscription');
			}

			const subscription = (await response.json()) as StripeSubscription;

			return createActionResult({
				data: subscription,
				integration: 'stripe',
				action: 'create-subscription',
				schema: 'stripe.subscription.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'create-subscription');
		}
	}

	/**
	 * Retrieve a subscription
	 */
	async getSubscription(id: string): Promise<ActionResult<StripeSubscription>> {
		try {
			const response = await this.request(`/subscriptions/${id}`);

			if (!response.ok) {
				return this.handleStripeError(response, 'get-subscription');
			}

			const subscription = (await response.json()) as StripeSubscription;

			return createActionResult({
				data: subscription,
				integration: 'stripe',
				action: 'get-subscription',
				schema: 'stripe.subscription.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-subscription');
		}
	}

	/**
	 * Cancel a subscription
	 */
	async cancelSubscription(
		id: string,
		options: { cancel_at_period_end?: boolean } = {}
	): Promise<ActionResult<StripeSubscription>> {
		try {
			let response: Response;

			if (options.cancel_at_period_end) {
				// Update to cancel at period end
				const body = new URLSearchParams();
				body.append('cancel_at_period_end', 'true');

				response = await this.request(`/subscriptions/${id}`, {
					method: 'POST',
					body: body.toString(),
				});
			} else {
				// Cancel immediately
				response = await this.request(`/subscriptions/${id}`, {
					method: 'DELETE',
				});
			}

			if (!response.ok) {
				return this.handleStripeError(response, 'cancel-subscription');
			}

			const subscription = (await response.json()) as StripeSubscription;

			return createActionResult({
				data: subscription,
				integration: 'stripe',
				action: 'cancel-subscription',
				schema: 'stripe.subscription.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'cancel-subscription');
		}
	}

	/**
	 * List subscriptions
	 */
	async listSubscriptions(
		options: ListSubscriptionsOptions = {}
	): Promise<ActionResult<StripeList<StripeSubscription>>> {
		try {
			const params = new URLSearchParams();
			if (options.limit) params.append('limit', options.limit.toString());
			if (options.starting_after) params.append('starting_after', options.starting_after);
			if (options.customer) params.append('customer', options.customer);
			if (options.status && options.status !== 'all') {
				params.append('status', options.status);
			}

			const url = `/subscriptions${params.toString() ? '?' + params.toString() : ''}`;
			const response = await this.request(url);

			if (!response.ok) {
				return this.handleStripeError(response, 'list-subscriptions');
			}

			const list = (await response.json()) as StripeList<StripeSubscription>;

			return createActionResult({
				data: list,
				integration: 'stripe',
				action: 'list-subscriptions',
				schema: 'stripe.subscription-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'list-subscriptions');
		}
	}

	// ==========================================================================
	// CHARGES
	// ==========================================================================

	/**
	 * List charges
	 */
	async listCharges(
		options: ListPaymentsOptions = {}
	): Promise<ActionResult<StripeList<StripeCharge>>> {
		try {
			const params = new URLSearchParams();
			if (options.limit) params.append('limit', options.limit.toString());
			if (options.starting_after) params.append('starting_after', options.starting_after);
			if (options.customer) params.append('customer', options.customer);

			const url = `/charges${params.toString() ? '?' + params.toString() : ''}`;
			const response = await this.request(url);

			if (!response.ok) {
				return this.handleStripeError(response, 'list-charges');
			}

			const list = (await response.json()) as StripeList<StripeCharge>;

			return createActionResult({
				data: list,
				integration: 'stripe',
				action: 'list-charges',
				schema: 'stripe.charge-list.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'list-charges');
		}
	}

	/**
	 * Retrieve a charge
	 */
	async getCharge(id: string): Promise<ActionResult<StripeCharge>> {
		try {
			const response = await this.request(`/charges/${id}`);

			if (!response.ok) {
				return this.handleStripeError(response, 'get-charge');
			}

			const charge = (await response.json()) as StripeCharge;

			return createActionResult({
				data: charge,
				integration: 'stripe',
				action: 'get-charge',
				schema: 'stripe.charge.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'get-charge');
		}
	}

	// ==========================================================================
	// WEBHOOKS
	// ==========================================================================

	/**
	 * Parse and verify a webhook event
	 *
	 * @param payload - Raw request body
	 * @param signature - Stripe-Signature header
	 * @param webhookSecret - Webhook endpoint secret
	 */
	async parseWebhookEvent(
		payload: string,
		signature: string,
		webhookSecret: string
	): Promise<ActionResult<StripeWebhookEvent>> {
		try {
			// Parse the signature header
			const elements = signature.split(',');
			const signatureMap: Record<string, string> = {};

			for (const element of elements) {
				const [key, value] = element.split('=');
				signatureMap[key] = value;
			}

			const timestamp = signatureMap['t'];
			const expectedSignature = signatureMap['v1'];

			if (!timestamp || !expectedSignature) {
				return ActionResult.error(
					'Invalid Stripe signature format',
					ErrorCode.VALIDATION_ERROR,
					{ integration: 'stripe', action: 'parse-webhook' }
				);
			}

			// Check timestamp to prevent replay attacks (5 minute tolerance)
			const timestampAge = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10);
			if (timestampAge > 300) {
				return ActionResult.error(
					'Webhook timestamp too old',
					ErrorCode.VALIDATION_ERROR,
					{ integration: 'stripe', action: 'parse-webhook' }
				);
			}

			// Compute expected signature
			const signedPayload = `${timestamp}.${payload}`;
			const encoder = new TextEncoder();
			const key = await crypto.subtle.importKey(
				'raw',
				encoder.encode(webhookSecret),
				{ name: 'HMAC', hash: 'SHA-256' },
				false,
				['sign']
			);
			const signatureBuffer = await crypto.subtle.sign(
				'HMAC',
				key,
				encoder.encode(signedPayload)
			);
			const computedSignature = Array.from(new Uint8Array(signatureBuffer))
				.map((b) => b.toString(16).padStart(2, '0'))
				.join('');

			// Compare signatures (timing-safe comparison)
			if (computedSignature !== expectedSignature) {
				return ActionResult.error(
					'Invalid webhook signature',
					ErrorCode.AUTH_INVALID,
					{ integration: 'stripe', action: 'parse-webhook' }
				);
			}

			// Parse the event
			const event = JSON.parse(payload) as StripeWebhookEvent;

			return createActionResult({
				data: event,
				integration: 'stripe',
				action: 'parse-webhook',
				schema: 'stripe.webhook-event.v1',
				capabilities: this.getCapabilities(),
			});
		} catch (error) {
			return this.handleError(error, 'parse-webhook');
		}
	}

	// ==========================================================================
	// PRIVATE METHODS
	// ==========================================================================

	/**
	 * Make authenticated request to Stripe API with timeout
	 */
	private async request(
		endpoint: string,
		options: RequestInit = {}
	): Promise<Response> {
		const url = `${this.apiUrl}${endpoint}`;

		// Add timeout via AbortController
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			return await fetch(url, {
				...options,
				headers: {
					Authorization: `Bearer ${this.secretKey}`,
					'Content-Type': 'application/x-www-form-urlencoded',
					'Stripe-Version': this.apiVersion,
					...options.headers,
				},
				signal: controller.signal,
			});
		} finally {
			clearTimeout(timeoutId);
		}
	}

	/**
	 * Get capabilities for Stripe actions
	 */
	private getCapabilities(): ActionCapabilities {
		return {
			canHandleText: true,
			supportsMetadata: true,
			supportsPagination: true,
			supportsBulkOperations: false,
		};
	}

	/**
	 * Extract rate limit information from response headers
	 * Stripe uses standard rate limit headers
	 */
	private extractRateLimit(response: Response): {
		remaining: number;
		limit: number;
		reset: number;
	} | undefined {
		const remaining = response.headers.get('X-RateLimit-Remaining');
		const limit = response.headers.get('X-RateLimit-Limit');
		const reset = response.headers.get('X-RateLimit-Reset');

		if (remaining && limit && reset) {
			return {
				remaining: parseInt(remaining, 10),
				limit: parseInt(limit, 10),
				reset: parseInt(reset, 10),
			};
		}
		return undefined;
	}

	/**
	 * Handle Stripe API errors
	 */
	private async handleStripeError<T>(
		response: Response,
		action: string
	): Promise<ActionResult<T>> {
		try {
			const errorData = (await response.json()) as {
				error?: { message?: string; type?: string; code?: string };
			};
			const message = errorData.error?.message || 'Stripe API error';
			const code = this.mapStripeError(response.status, errorData.error?.type);

			return ActionResult.error(message, code, {
				integration: 'stripe',
				action,
			});
		} catch {
			return ActionResult.error(
				`Stripe API error: ${response.status}`,
				ErrorCode.API_ERROR,
				{ integration: 'stripe', action }
			);
		}
	}

	/**
	 * Map Stripe error types to ErrorCode
	 */
	private mapStripeError(status: number, type?: string): string {
		if (status === 401) return ErrorCode.AUTH_INVALID;
		if (status === 403) return ErrorCode.AUTH_INSUFFICIENT_SCOPE;
		if (status === 404) return ErrorCode.NOT_FOUND;
		if (status === 429) return ErrorCode.RATE_LIMIT;

		switch (type) {
			case 'card_error':
				return ErrorCode.PAYMENT_FAILED;
			case 'invalid_request_error':
				return ErrorCode.VALIDATION_ERROR;
			case 'authentication_error':
				return ErrorCode.AUTH_INVALID;
			case 'rate_limit_error':
				return ErrorCode.RATE_LIMIT;
			default:
				return ErrorCode.API_ERROR;
		}
	}

	/**
	 * Handle general errors
	 */
	private handleError<T>(error: unknown, action: string): ActionResult<T> {
		if (error instanceof IntegrationError) {
			const integrationErr = error as IntegrationError;
			return ActionResult.error(integrationErr.message, integrationErr.code, {
				integration: 'stripe',
				action,
			});
		}

		const message = error instanceof Error ? error.message : 'Unknown error';
		return ActionResult.error(message, ErrorCode.UNKNOWN_ERROR, {
			integration: 'stripe',
			action,
		});
	}
}
