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
 * TypeScript types for WORKWAY CLI
 */

import type { ZodSchema } from 'zod';

// ============================================================================
// CONFIG TYPES
// ============================================================================

export interface CLIConfig {
	apiUrl: string;
	credentials?: {
		token: string;
		userId: string;
		email: string;
	};
	oauth?: {
		callbackPort: number;
	};
	editor?: string;
}

export interface ProjectConfig {
	name?: string;
	version?: string;
	dev?: {
		port?: number;
		hotReload?: boolean;
		mockMode?: boolean;
	};
	test?: {
		testDataFile?: string;
		timeout?: number;
	};
	build?: {
		outDir?: string;
		minify?: boolean;
	};
	publish?: {
		screenshots?: string[];
		demoVideo?: string;
	};
}

// ============================================================================
// WORKFLOW TYPES
// ============================================================================

export interface WorkflowMetadata {
	id: string;
	name: string;
	tagline?: string;
	description: string;
	category: string;
	icon: string;
	version: string;
	author: {
		name: string;
		email?: string;
		url?: string;
	};
	tags?: string[];
	screenshots?: string[];
	videoUrl?: string;
}

export interface WorkflowPricing {
	model: 'free' | 'subscription' | 'one-time' | 'usage-based';
	price?: number;
	trialDays?: number;
	currency?: string;
}

export interface WorkflowDefinition {
	metadata: WorkflowMetadata;
	pricing: WorkflowPricing;
	integrations: string[];
	trigger: {
		type: string;
		config?: any;
	};
	configSchema?: ZodSchema;
	configFields?: ConfigField[];
	execute: (context: WorkflowContext) => Promise<WorkflowResult>;
}

export interface ConfigField {
	key: string;
	label: string;
	description?: string;
	type: 'text' | 'number' | 'boolean' | 'select' | 'textarea';
	required?: boolean;
	placeholder?: string;
	options?: Array<{ label: string; value: string }>;
	schema: ZodSchema;
}

export interface WorkflowContext {
	trigger: {
		type: string;
		data: any;
	};
	config: any;
	actions: {
		execute: (actionId: string, input: any) => Promise<any>;
	};
	storage: any;
}

export interface WorkflowResult {
	success: boolean;
	data?: any;
	error?: string;
}

// ============================================================================
// API TYPES
// ============================================================================

export interface APIResponse<T = any> {
	success: boolean;
	data?: T;
	error?: string;
	message?: string;
}

export interface AuthResponse {
	token: string;
	userId: string;
	email: string;
	role: string;
}

export interface DeveloperProfile {
	id: string;
	userId: string;
	companyName?: string;
	bio?: string;
	websiteUrl?: string;
	githubUrl?: string;
	verified: boolean;
	onboardingStatus: string;
	stripeConnectAccountId?: string;
}

// ============================================================================
// DEVELOPER WAITLIST TYPES
// ============================================================================

/**
 * Developer waitlist profile - stored locally until submitted
 */
export interface DeveloperWaitlistProfile {
	// Identity
	name: string;
	email: string;
	companyName?: string;

	// Technical background
	technicalBackground: string;
	githubUrl?: string;
	portfolioUrl?: string;

	// Workflow ideas
	workflowIdeas: string;
	targetIntegrations: string[];

	// Why WORKWAY
	whyWorkway: string;

	// Metadata
	createdAt: string;
	updatedAt: string;
	submittedAt?: string;
}

/**
 * Developer waitlist status from API
 */
export interface DeveloperWaitlistStatus {
	status: 'not_submitted' | 'pending_review' | 'approved' | 'rejected';
	submittedAt?: string;
	reviewedAt?: string;
	feedback?: string;
	nextSteps?: string[];
}

export interface WorkflowListing {
	id: string;
	name: string;
	tagline: string | null;
	description: string | null;
	icon_url: string | null;
	banner_url: string | null;
	screenshots: string[];
	tags: string[];
	status: string;
	pricing_model: string;
	base_price: number;
	install_count: number;
	average_rating: number;
	review_count: number;
	workflow_definition: any;
	required_oauth_providers: string[];
	published_at: number | null;
}

export interface Earnings {
	month: string;
	installs: number;
	revenue: number;
	payout: number;
	status: 'pending' | 'paid';
}

// ============================================================================
// OAUTH TYPES
// ============================================================================

export interface OAuthTokens {
	accessToken: string;
	refreshToken?: string;
	expiresAt?: number;
	scope?: string;
	tokenType: string;
}

export interface OAuthConnection {
	provider: string;
	email?: string;
	scopes: string[];
	expiresAt?: number;
}

// ============================================================================
// COMMAND TYPES
// ============================================================================

export interface CommandContext {
	config: CLIConfig;
	projectConfig?: ProjectConfig;
	apiClient: any; // Will be typed when we create the API client
}

// ============================================================================
// DEVELOPER OAUTH APPS (BYOO - Bring Your Own OAuth)
// ============================================================================

/**
 * Supported OAuth providers for developer BYOO
 */
export type BYOOProvider =
	| 'zoom'
	| 'notion'
	| 'slack'
	| 'airtable'
	| 'typeform'
	| 'calendly'
	| 'todoist'
	| 'linear'
	| 'google-calendar'
	| 'google-drive'
	| 'stripe';

/**
 * Developer OAuth app status
 */
export type OAuthAppStatus = 'development' | 'pending_review' | 'production' | 'suspended';

/**
 * Developer OAuth app health status
 */
export type OAuthAppHealth = 'unknown' | 'healthy' | 'unhealthy';

/**
 * Developer OAuth app stored in the system
 */
export interface DeveloperOAuthApp {
	id: string;
	provider: BYOOProvider;
	clientId: string;
	clientSecretMasked: string;
	redirectUri?: string;
	scopes: string[];
	status: OAuthAppStatus;
	healthStatus: OAuthAppHealth;
	lastHealthCheck?: string;
	createdAt: string;
	updatedAt: string;
}

/**
 * Data for creating a new OAuth app
 */
export interface CreateOAuthAppData {
	provider: BYOOProvider;
	clientId: string;
	clientSecret: string;
	redirectUri?: string;
	scopes?: string[];
}

/**
 * Data for updating an OAuth app
 */
export interface UpdateOAuthAppData {
	clientId?: string;
	clientSecret?: string;
	redirectUri?: string;
	scopes?: string[];
}

/**
 * OAuth app test result
 */
export interface OAuthAppTestResult {
	success: boolean;
	latencyMs: number;
	error?: string;
	scopes?: string[];
}
