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
 * Handles all HTTP communication with the WORKWAY platform API
 */

import axios, { type AxiosInstance, type AxiosError } from 'axios';
import type {
	APIResponse,
	AuthResponse,
	DeveloperProfile,
	WorkflowListing,
	Earnings,
} from '../types/index.js';

export class WorkwayAPIClient {
	private client: AxiosInstance;
	private apiUrl: string;
	private token: string | null;

	constructor(apiUrl: string, token: string | null = null) {
		this.apiUrl = apiUrl;
		this.token = token;

		this.client = axios.create({
			baseURL: apiUrl,
			headers: {
				'Content-Type': 'application/json',
			},
			timeout: 30000,
		});

		// Add auth token to requests if available
		this.client.interceptors.request.use((config) => {
			if (this.token) {
				config.headers.Authorization = `Bearer ${this.token}`;
			}
			return config;
		});

		// Handle errors
		this.client.interceptors.response.use(
			(response) => response,
			(error: AxiosError) => {
				if (error.response) {
					// Server responded with error status
					const data: any = error.response.data;
					throw new APIError(
						data.message || data.error || 'API request failed',
						error.response.status,
						data.code
					);
				} else if (error.request) {
					// Request made but no response
					throw new APIError('No response from server', 0, 'NETWORK_ERROR');
				} else {
					// Something else happened
					throw new APIError(error.message, 0, 'UNKNOWN_ERROR');
				}
			}
		);
	}

	/**
	 * Set auth token
	 */
	setToken(token: string): void {
		this.token = token;
	}

	// ============================================================================
	// AUTHENTICATION
	// ============================================================================

	/**
	 * Login with email and password
	 */
	async login(email: string, password: string): Promise<AuthResponse> {
		const response = await this.client.post<APIResponse<AuthResponse>>('/auth/login', {
			email,
			password,
		});
		return response.data.data!;
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
		const response = await this.client.post<APIResponse<AuthResponse>>('/developers/register', data);
		return response.data.data!;
	}

	/**
	 * Get current user info
	 */
	async whoami(): Promise<AuthResponse> {
		const response = await this.client.get<APIResponse<AuthResponse>>('/auth/me');
		return response.data.data!;
	}

	// ============================================================================
	// DEVELOPER PROFILE
	// ============================================================================

	/**
	 * Get developer profile
	 */
	async getDeveloperProfile(): Promise<DeveloperProfile> {
		const response = await this.client.get<APIResponse<DeveloperProfile>>('/developers/me');
		return response.data.data!;
	}

	/**
	 * Update developer profile
	 */
	async updateDeveloperProfile(updates: Partial<DeveloperProfile>): Promise<DeveloperProfile> {
		const response = await this.client.patch<APIResponse<DeveloperProfile>>('/developers/me', updates);
		return response.data.data!;
	}

	/**
	 * Get developer earnings
	 */
	async getEarnings(): Promise<Earnings[]> {
		const response = await this.client.get<APIResponse<Earnings[]>>('/developers/earnings');
		return response.data.data!;
	}

	// ============================================================================
	// WORKFLOWS
	// ============================================================================

	/**
	 * Publish a workflow
	 */
	async publishWorkflow(workflow: any): Promise<WorkflowListing> {
		const response = await this.client.post<APIResponse<WorkflowListing>>('/workflows/publish', workflow);
		return response.data.data!;
	}

	/**
	 * Create an integration
	 */
	async createIntegration(integrationData: any): Promise<any> {
		const response = await this.client.post<any>('/integrations', integrationData);
		return response.data;
	}

	/**
	 * Update a workflow
	 */
	async updateWorkflow(workflowId: string, updates: any): Promise<WorkflowListing> {
		const response = await this.client.patch<APIResponse<WorkflowListing>>(
			`/workflows/${workflowId}`,
			updates
		);
		return response.data.data!;
	}

	/**
	 * Unpublish a workflow
	 */
	async unpublishWorkflow(workflowId: string): Promise<void> {
		await this.client.post(`/workflows/${workflowId}/unpublish`);
	}

	/**
	 * Get workflow details
	 */
	async getWorkflow(workflowId: string): Promise<WorkflowListing> {
		const response = await this.client.get<WorkflowListing>(`/marketplace/${workflowId}`);
		return response.data;
	}

	/**
	 * List workflows by developer
	 */
	async listMyWorkflows(): Promise<WorkflowListing[]> {
		const response = await this.client.get<{ workflows: WorkflowListing[] }>('/workflows/me');
		return response.data.workflows;
	}

	/**
	 * Search workflows
	 */
	async searchWorkflows(query: string, filters?: any): Promise<WorkflowListing[]> {
		const response = await this.client.get<{ workflows: WorkflowListing[] }>('/marketplace', {
			params: { q: query, ...filters },
		});
		return response.data.workflows;
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
		const response = await this.client.post<APIResponse<any>>(`/oauth/${provider}/callback`, {
			code,
			redirectUri: callbackUrl,
		});
		return response.data.data!;
	}

	/**
	 * List connected OAuth accounts
	 */
	async listOAuthConnections(): Promise<any[]> {
		const response = await this.client.get<APIResponse<any[]>>('/oauth/connections');
		return response.data.data!;
	}

	/**
	 * Disconnect OAuth account
	 */
	async disconnectOAuth(provider: string): Promise<void> {
		await this.client.delete(`/oauth/${provider}`);
	}

	// ============================================================================
	// INTEGRATIONS (Registry)
	// ============================================================================

	/**
	 * List all integrations
	 */
	async listIntegrations(): Promise<any[]> {
		const response = await this.client.get<{ integrations: any[] }>('/registry/integrations');
		return response.data.integrations;
	}

	/**
	 * Get integration details
	 */
	async getIntegration(integrationId: string): Promise<any> {
		const response = await this.client.get(`/registry/integrations/${integrationId}`);
		return response.data;
	}

	/**
	 * List all actions
	 */
	async listActions(): Promise<any[]> {
		const response = await this.client.get<{ actions: any[] }>('/registry/actions');
		return response.data.actions;
	}

	/**
	 * Hot reload integration (dev mode only)
	 */
	async reloadIntegration(integrationId: string): Promise<any> {
		const response = await this.client.post(`/registry/reload/${integrationId}`, null, {
			headers: { 'x-dev-mode': 'true' },
		});
		return response.data;
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
		const params = new URLSearchParams();
		if (options.limit) params.append('limit', String(options.limit));
		if (options.page) params.append('page', String(options.page));
		if (options.status) params.append('status', options.status);
		if (options.integrationId) params.append('integrationId', options.integrationId);

		const response = await this.client.get<{
			logs: WorkflowLog[];
			pagination: { page: number; limit: number; total: number; totalPages: number };
		}>(`/developers/me/logs?${params.toString()}`);
		return response.data;
	}

	/**
	 * Get developer analytics
	 */
	async getAnalytics(): Promise<any> {
		const response = await this.client.get<any>('/developers/me/analytics');
		return response.data;
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

// ============================================================================
// API ERROR
// ============================================================================

export class APIError extends Error {
	constructor(
		message: string,
		public statusCode: number,
		public code?: string
	) {
		super(message);
		this.name = 'APIError';
	}

	isUnauthorized(): boolean {
		return this.statusCode === 401;
	}

	isForbidden(): boolean {
		return this.statusCode === 403;
	}

	isNotFound(): boolean {
		return this.statusCode === 404;
	}

	isValidationError(): boolean {
		return this.code === 'VALIDATION_ERROR' || this.statusCode === 422;
	}

	isNetworkError(): boolean {
		return this.code === 'NETWORK_ERROR';
	}
}

/**
 * Create API client with config
 */
export function createAPIClient(apiUrl: string, token?: string | null): WorkwayAPIClient {
	return new WorkwayAPIClient(apiUrl, token);
}
