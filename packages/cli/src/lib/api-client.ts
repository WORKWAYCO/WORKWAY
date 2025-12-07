/**
 * Copyright 2024 WORKWAY
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * WORKWAY API Client
 *
 * Weniger, aber besser: Unified HTTP foundation from @workwayco/sdk
 * Eliminates ~150 lines of duplicate Axios code by extending BaseHTTPClient.
 *
 * Handles all HTTP communication with the WORKWAY platform API.
 */

import {
	BaseHTTPClient,
	IntegrationError,
	ErrorCode,
	createErrorFromResponse,
	type HTTPClientConfig,
	type RequestOptions,
	type RequestWithBodyOptions,
} from '@workwayco/sdk';
import type {
	APIResponse,
	AuthResponse,
	DeveloperProfile,
	DeveloperWaitlistStatus,
	WorkflowListing,
	Earnings,
} from '../types/index.js';

// ============================================================================
// WORKWAY API CLIENT
// ============================================================================

/**
 * WorkwayAPIClient - CLI HTTP client extending SDK's BaseHTTPClient
 *
 * Preserves the existing API surface while using unified HTTP foundation.
 * Token is mutable via setToken() for post-construction auth.
 */
export class WorkwayAPIClient extends BaseHTTPClient {
	private token: string | null;
	private readonly apiUrl: string;

	constructor(apiUrl: string, token: string | null = null) {
		super({
			baseUrl: apiUrl,
			timeout: 30000,
			errorContext: {
				integration: 'workway-api',
			},
		});

		this.apiUrl = apiUrl;
		this.token = token;
	}

	/**
	 * Override request to inject auth header dynamically
	 */
	protected async request(
		method: string,
		path: string,
		options: RequestWithBodyOptions = {}
	): Promise<Response> {
		// Inject auth header if token exists
		if (this.token) {
			options.headers = {
				...options.headers,
				Authorization: `Bearer ${this.token}`,
			};
		}

		return super.request(method, path, options);
	}

	/**
	 * Set auth token (for post-construction auth)
	 */
	setToken(token: string): void {
		this.token = token;
	}

	// ============================================================================
	// JSON RESPONSE HELPERS (unwrap APIResponse wrapper)
	// ============================================================================

	/**
	 * GET request expecting APIResponse wrapper, returns unwrapped data
	 */
	private async getWrapped<T>(path: string, options: RequestOptions = {}): Promise<T> {
		const response = await this.getJson<APIResponse<T>>(path, options);
		return response.data!;
	}

	/**
	 * POST request expecting APIResponse wrapper, returns unwrapped data
	 */
	private async postWrapped<T>(
		path: string,
		body?: unknown,
		options: RequestOptions = {}
	): Promise<T> {
		const response = await this.postJson<APIResponse<T>>(path, { ...options, body });
		return response.data!;
	}

	/**
	 * PATCH request expecting APIResponse wrapper, returns unwrapped data
	 */
	private async patchWrapped<T>(
		path: string,
		body?: unknown,
		options: RequestOptions = {}
	): Promise<T> {
		const response = await this.patchJson<APIResponse<T>>(path, { ...options, body });
		return response.data!;
	}

	// ============================================================================
	// AUTHENTICATION
	// ============================================================================

	/**
	 * Login with email and password
	 */
	async login(email: string, password: string): Promise<AuthResponse> {
		return this.postWrapped<AuthResponse>('/auth/login', { email, password });
	}

	/**
	 * Register a new developer account
	 */
	async register(data: {
		email: string;
		password: string;
		companyName?: string;
		bio?: string;
		websiteUrl?: string;
	}): Promise<AuthResponse> {
		return this.postWrapped<AuthResponse>('/developers/register', data);
	}

	/**
	 * Get current user info
	 */
	async whoami(): Promise<AuthResponse> {
		return this.getWrapped<AuthResponse>('/auth/me');
	}

	// ============================================================================
	// DEVELOPER PROFILE
	// ============================================================================

	/**
	 * Get developer profile
	 */
	async getDeveloperProfile(): Promise<DeveloperProfile> {
		return this.getWrapped<DeveloperProfile>('/developers/me');
	}

	/**
	 * Update developer profile
	 */
	async updateDeveloperProfile(updates: Partial<DeveloperProfile>): Promise<DeveloperProfile> {
		return this.patchWrapped<DeveloperProfile>('/developers/me', updates);
	}

	/**
	 * Get developer earnings
	 */
	async getEarnings(period?: 'week' | 'month' | 'year'): Promise<Earnings[]> {
		const query = period ? { period } : undefined;
		return this.getWrapped<Earnings[]>('/developers/me/earnings', { query });
	}

	// ============================================================================
	// DEVELOPER WAITLIST
	// ============================================================================

	/**
	 * Submit developer application to the waitlist
	 */
	async submitDeveloperApplication(application: {
		name: string;
		email: string;
		companyName?: string;
		technicalBackground: string;
		githubUrl?: string;
		portfolioUrl?: string;
		targetIntegrations: string[];
		workflowIdeas: string;
		whyWorkway: string;
	}): Promise<{ applicationId: string; status: string }> {
		return this.postWrapped<{ applicationId: string; status: string }>(
			'/developers/waitlist/apply',
			application
		);
	}

	/**
	 * Get developer waitlist status
	 */
	async getDeveloperWaitlistStatus(): Promise<DeveloperWaitlistStatus> {
		return this.getWrapped<DeveloperWaitlistStatus>('/developers/waitlist/status');
	}

	// ============================================================================
	// WORKFLOWS
	// ============================================================================

	/**
	 * Publish a workflow
	 */
	async publishWorkflow(workflow: any): Promise<WorkflowListing> {
		return this.postWrapped<WorkflowListing>('/workflows/publish', workflow);
	}

	/**
	 * Create an integration
	 */
	async createIntegration(integrationData: any): Promise<any> {
		return this.postJson<any>('/integrations', { body: integrationData });
	}

	/**
	 * Check for similar workflows before publishing
	 */
	async checkSimilarity(data: {
		name: string;
		description: string;
		code: string;
		integrations?: string[];
		triggers?: string[];
		excludeId?: string;
	}): Promise<{
		isDuplicate: boolean;
		action: 'allow' | 'suggest_fork' | 'review' | 'block';
		overallSimilarity: number;
		similarWorkflows: Array<{
			id: string;
			name: string;
			developerName: string;
			developerId: string;
			codeSimilarity: number;
			semanticSimilarity: number;
			overallSimilarity: number;
			allowForks: boolean;
			installCount: number;
		}>;
		message: string;
	}> {
		return this.postJson('/integrations/check-similarity', { body: data });
	}

	/**
	 * Update a workflow
	 */
	async updateWorkflow(workflowId: string, updates: any): Promise<WorkflowListing> {
		return this.patchWrapped<WorkflowListing>(`/workflows/${workflowId}`, updates);
	}

	/**
	 * Unpublish a workflow
	 */
	async unpublishWorkflow(workflowId: string): Promise<void> {
		await this.post(`/workflows/${workflowId}/unpublish`);
	}

	/**
	 * Get workflow details
	 */
	async getWorkflow(workflowId: string): Promise<WorkflowListing> {
		return this.getJson<WorkflowListing>(`/marketplace/${workflowId}`);
	}

	/**
	 * List workflows by developer
	 */
	async listMyWorkflows(): Promise<WorkflowListing[]> {
		const response = await this.getJson<{ workflows: WorkflowListing[] }>('/workflows/me');
		return response.workflows;
	}

	/**
	 * Search workflows
	 */
	async searchWorkflows(query: string, filters?: any): Promise<WorkflowListing[]> {
		const response = await this.getJson<{ workflows: WorkflowListing[] }>('/marketplace', {
			query: { q: query, ...filters },
		});
		return response.workflows;
	}

	// ============================================================================
	// OAUTH
	// ============================================================================

	/**
	 * Get OAuth authorization URL
	 */
	getOAuthAuthUrl(provider: string, callbackUrl: string, state?: string): string {
		const params = new URLSearchParams({
			provider,
			redirectUri: callbackUrl,
		});

		if (state) {
			params.append('state', state);
		}

		return `${this.apiUrl}/oauth/${provider}/authorize?${params.toString()}`;
	}

	/**
	 * Exchange OAuth code for tokens
	 */
	async exchangeOAuthCode(provider: string, code: string, callbackUrl: string): Promise<any> {
		return this.postWrapped(`/oauth/${provider}/callback`, {
			code,
			redirectUri: callbackUrl,
		});
	}

	/**
	 * List connected OAuth accounts
	 */
	async listOAuthConnections(): Promise<any[]> {
		return this.getWrapped<any[]>('/oauth/connections');
	}

	/**
	 * Disconnect OAuth account
	 */
	async disconnectOAuth(provider: string): Promise<void> {
		await this.delete(`/oauth/${provider}`);
	}

	/**
	 * List available OAuth providers
	 */
	async listOAuthProviders(): Promise<OAuthProvider[]> {
		const response = await this.getJson<{
			providers: OAuthProvider[];
			total: number;
			configured: number;
		}>('/oauth/providers');
		return response.providers;
	}

	// ============================================================================
	// INTEGRATIONS (Registry)
	// ============================================================================

	/**
	 * List all integrations
	 */
	async listIntegrations(): Promise<any[]> {
		const response = await this.getJson<{ integrations: any[] }>('/registry/integrations');
		return response.integrations;
	}

	/**
	 * Get integration details
	 */
	async getIntegration(integrationId: string): Promise<any> {
		return this.getJson(`/registry/integrations/${integrationId}`);
	}

	/**
	 * List all actions
	 */
	async listActions(): Promise<any[]> {
		const response = await this.getJson<{ actions: any[] }>('/registry/actions');
		return response.actions;
	}

	/**
	 * Hot reload integration (dev mode only)
	 */
	async reloadIntegration(integrationId: string): Promise<any> {
		return this.postJson(`/registry/reload/${integrationId}`, {
			body: null,
			headers: { 'x-dev-mode': 'true' },
		});
	}

	// ============================================================================
	// LOGS
	// ============================================================================

	/**
	 * Get workflow execution logs for developer's integrations
	 */
	async getLogs(options: {
		limit?: number;
		page?: number;
		status?: string;
		integrationId?: string;
	}): Promise<{
		logs: WorkflowLog[];
		pagination: { page: number; limit: number; total: number; totalPages: number };
	}> {
		return this.getJson('/developers/me/logs', {
			query: {
				limit: options.limit,
				page: options.page,
				status: options.status,
				integrationId: options.integrationId,
			},
		});
	}

	/**
	 * Get developer analytics
	 */
	async getAnalytics(): Promise<any> {
		return this.getJson('/developers/me/analytics');
	}

	// ============================================================================
	// AI - Workers AI
	// ============================================================================

	/**
	 * Generate text using Workers AI
	 */
	async aiGenerate(options: {
		prompt: string;
		model?: string;
		maxTokens?: number;
		temperature?: number;
	}): Promise<AIGenerateResponse> {
		return this.postWrapped<AIGenerateResponse>('/ai/generate', options);
	}

	/**
	 * Generate embeddings using Workers AI
	 */
	async aiEmbeddings(options: {
		text: string;
		model?: string;
	}): Promise<AIEmbeddingsResponse> {
		return this.postWrapped<AIEmbeddingsResponse>('/ai/embeddings', options);
	}

	/**
	 * List available AI models
	 */
	async aiModels(): Promise<AIModel[]> {
		const response = await this.getJson<{ success: boolean; data: { models: AIModel[] } }>(
			'/ai/models'
		);
		return response.data.models;
	}

	// ============================================================================
	// STRIPE CONNECT
	// ============================================================================

	/**
	 * Start Stripe Connect onboarding
	 */
	async startStripeOnboarding(developerId: string): Promise<StripeOnboardingResponse> {
		return this.postJson<StripeOnboardingResponse>(`/developers/${developerId}/onboard`);
	}

	/**
	 * Get Stripe Connect account status
	 */
	async getStripeStatus(developerId: string): Promise<StripeStatusResponse> {
		return this.getJson<StripeStatusResponse>(`/developers/${developerId}/stripe-status`);
	}

	/**
	 * Complete Stripe Connect onboarding (verify status after returning from Stripe)
	 */
	async completeStripeOnboarding(developerId: string): Promise<StripeCompleteResponse> {
		return this.postJson<StripeCompleteResponse>(
			`/developers/${developerId}/onboarding/complete`
		);
	}

	/**
	 * Refresh expired Stripe Connect onboarding link
	 */
	async refreshStripeOnboarding(developerId: string): Promise<StripeOnboardingResponse> {
		return this.postJson<StripeOnboardingResponse>(
			`/developers/${developerId}/onboarding/refresh`
		);
	}

	// ============================================================================
	// DEVELOPER OAUTH APPS (BYOO - Bring Your Own OAuth)
	// ============================================================================

	/**
	 * List developer's OAuth apps
	 */
	async listOAuthApps(): Promise<DeveloperOAuthApp[]> {
		const response = await this.getJson<{ oauth_apps: DeveloperOAuthApp[] }>(
			'/developers/me/oauth-apps'
		);
		return response.oauth_apps;
	}

	/**
	 * Create a new OAuth app
	 */
	async createOAuthApp(data: CreateOAuthAppInput): Promise<DeveloperOAuthApp> {
		return this.postWrapped<DeveloperOAuthApp>('/developers/me/oauth-apps', data);
	}

	/**
	 * Update an OAuth app
	 */
	async updateOAuthApp(provider: string, data: UpdateOAuthAppInput): Promise<DeveloperOAuthApp> {
		return this.patchWrapped<DeveloperOAuthApp>(`/developers/me/oauth-apps/${provider}`, data);
	}

	/**
	 * Delete an OAuth app
	 */
	async deleteOAuthApp(provider: string): Promise<void> {
		await this.delete(`/developers/me/oauth-apps/${provider}`);
	}

	/**
	 * Test OAuth app credentials
	 */
	async testOAuthApp(provider: string): Promise<OAuthAppTestResult> {
		return this.postWrapped<OAuthAppTestResult>(`/developers/me/oauth-apps/${provider}/test`);
	}

	/**
	 * Promote OAuth app to production
	 */
	async promoteOAuthApp(provider: string): Promise<DeveloperOAuthApp> {
		return this.postWrapped<DeveloperOAuthApp>(`/developers/me/oauth-apps/${provider}/promote`);
	}
}

// ============================================================================
// TYPES
// ============================================================================

export interface WorkflowLog {
	id: string;
	integrationId: string;
	integrationName: string;
	userId: string;
	userEmail: string;
	installationId: string;
	triggerType: string;
	status: 'running' | 'completed' | 'failed' | 'cancelled';
	error: string | null;
	startedAt: number;
	completedAt: number | null;
	durationMs: number | null;
	stepsTotal: number;
	stepsCompleted: number;
	stepsFailed: number;
	stepResults: any;
}

export interface AIGenerateResponse {
	text: string;
	model: string;
	modelName: string;
	metrics: {
		inputTokens: number;
		outputTokens: number;
		totalTokens: number;
		latencyMs: number;
	};
}

export interface AIEmbeddingsResponse {
	embedding: number[];
	dimensions: number;
	model: string;
	modelName: string;
	latencyMs: number;
}

export interface AIModel {
	alias: string;
	id: string;
	name: string;
	type: 'text' | 'embeddings';
}

export interface OAuthProvider {
	id: string;
	name: string;
	category: string;
	configured: boolean;
	scope: string;
}

export interface StripeOnboardingResponse {
	success: boolean;
	onboardingUrl: string;
	stripeAccountId: string;
}

export interface StripeStatusResponse {
	hasStripeAccount: boolean;
	onboardingStatus: string | null;
	accountStatus?: {
		chargesEnabled: boolean;
		payoutsEnabled: boolean;
		detailsSubmitted: boolean;
		requiresAction: boolean;
	};
}

export interface StripeCompleteResponse {
	success: boolean;
	onboardingStatus: string;
	accountStatus: {
		chargesEnabled: boolean;
		payoutsEnabled: boolean;
		detailsSubmitted: boolean;
		requiresAction: boolean;
	};
}

// Developer OAuth Apps (BYOO)
export interface DeveloperOAuthApp {
	id: string;
	provider: string;
	clientId: string;
	clientSecretMasked: string;
	redirectUri?: string;
	scopes: string[];
	status: 'development' | 'pending_review' | 'production' | 'suspended';
	healthStatus: 'unknown' | 'healthy' | 'unhealthy';
	lastHealthCheck?: string;
	createdAt: string;
	updatedAt: string;
}

export interface CreateOAuthAppInput {
	provider: string;
	clientId: string;
	clientSecret: string;
	redirectUri?: string;
	scopes?: string[];
}

export interface UpdateOAuthAppInput {
	clientId?: string;
	clientSecret?: string;
	redirectUri?: string;
	scopes?: string[];
}

export interface OAuthAppTestResult {
	success: boolean;
	latencyMs: number;
	error?: string;
	scopes?: string[];
}

// ============================================================================
// API ERROR (Backwards Compatibility Bridge)
// ============================================================================

/**
 * APIError - Backwards compatibility with IntegrationError
 *
 * CLI commands may still use `APIError`. This class bridges to `IntegrationError`
 * while preserving the existing API surface.
 */
export class APIError extends Error {
	public readonly statusCode: number;
	public readonly code?: string;
	public readonly integrationError: IntegrationError;

	constructor(message: string, statusCode: number, code?: string) {
		super(message);
		this.name = 'APIError';
		this.statusCode = statusCode;
		this.code = code;

		// Map to IntegrationError for unified handling
		const errorCode = this.mapToErrorCode(statusCode, code);
		this.integrationError = new IntegrationError(errorCode, message, {
			statusCode,
			providerCode: code,
			retryable: this.isRetryableStatus(statusCode),
		});
	}

	private mapToErrorCode(statusCode: number, code?: string): ErrorCode {
		if (code === 'NETWORK_ERROR') return ErrorCode.NETWORK_ERROR;
		if (code === 'VALIDATION_ERROR') return ErrorCode.VALIDATION_ERROR;

		switch (statusCode) {
			case 401:
				return ErrorCode.AUTH_EXPIRED;
			case 403:
				return ErrorCode.PERMISSION_DENIED;
			case 404:
				return ErrorCode.NOT_FOUND;
			case 409:
				return ErrorCode.CONFLICT;
			case 422:
				return ErrorCode.VALIDATION_ERROR;
			case 429:
				return ErrorCode.RATE_LIMITED;
			default:
				if (statusCode >= 500) return ErrorCode.PROVIDER_DOWN;
				return ErrorCode.API_ERROR;
		}
	}

	private isRetryableStatus(statusCode: number): boolean {
		return statusCode === 429 || statusCode >= 500;
	}

	// Unified error interface (mirrors IntegrationError)
	isUnauthorized(): boolean {
		return this.statusCode === 401;
	}

	isForbidden(): boolean {
		return this.statusCode === 403;
	}

	isNotFound(): boolean {
		return this.statusCode === 404;
	}

	isConflict(): boolean {
		return this.statusCode === 409;
	}

	isValidationError(): boolean {
		return this.code === 'VALIDATION_ERROR' || this.statusCode === 422;
	}

	isNetworkError(): boolean {
		return this.code === 'NETWORK_ERROR';
	}

	isRateLimited(): boolean {
		return this.statusCode === 429;
	}

	isServerError(): boolean {
		return this.statusCode >= 500;
	}

	isRetryable(): boolean {
		return this.integrationError.isRetryable();
	}
}

/**
 * Create API client with config
 */
export function createAPIClient(apiUrl: string, token?: string | null): WorkwayAPIClient {
	return new WorkwayAPIClient(apiUrl, token ?? null);
}

// Re-export IntegrationError for direct access
export { IntegrationError, ErrorCode } from '@workwayco/sdk';
