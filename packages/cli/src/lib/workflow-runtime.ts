/**
 * Workflow Runtime for CLI
 *
 * Executes workflows locally with real OAuth tokens and API calls.
 * This bridges the gap between development and production.
 */

import { loadOAuthTokens, getOAuthToken } from './config.js';
import { Logger } from '../utils/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface WorkflowDefinition {
	metadata: {
		id: string;
		name: string;
		description?: string;
		category?: string;
		version?: string;
	};
	integrations: string[];
	trigger: {
		type: string;
		config?: any;
	};
	execute: (context: WorkflowContext) => Promise<WorkflowResult>;
}

export interface WorkflowContext {
	runId: string;
	userId: string;
	installationId: string;
	trigger: {
		type: string;
		data: any;
		timestamp: number;
	};
	config: Record<string, any>;
	actions: ActionHelpers;
	storage: WorkflowStorage;
	env: any;
}

export interface ActionHelpers {
	execute<TInput = any, TOutput = any>(actionId: string, input: TInput): Promise<TOutput>;
	gmail: GmailActions;
	slack: SlackActions;
	notion: NotionActions;
	[integration: string]: any;
}

export interface WorkflowStorage {
	get<T = any>(key: string): Promise<T | null>;
	set(key: string, value: any): Promise<void>;
	delete(key: string): Promise<void>;
	keys(): Promise<string[]>;
}

export interface WorkflowResult {
	success: boolean;
	data?: any;
	error?: string;
	metadata?: {
		actionsExecuted?: number;
		executionTimeMs?: number;
		[key: string]: any;
	};
}

export interface StepExecution {
	actionId: string;
	input: any;
	output: any;
	duration: number;
	status: 'success' | 'failed';
	error?: string;
}

// ============================================================================
// INTEGRATION ACTION TYPES
// ============================================================================

interface GmailActions {
	fetchEmail(input: { messageId: string }): Promise<any>;
	sendEmail(input: { to: string; subject: string; body: string }): Promise<any>;
	addLabel(input: { messageId: string; labelId: string }): Promise<any>;
	listMessages(input: { query?: string; maxResults?: number }): Promise<any>;
}

interface SlackActions {
	sendMessage(input: { channel: string; text: string; blocks?: any[] }): Promise<any>;
	listChannels(input?: { limit?: number }): Promise<any>;
}

interface NotionActions {
	createPage(input: { database_id: string; properties: any; children?: any[] }): Promise<any>;
	updatePage(input: { page_id: string; properties: any }): Promise<any>;
	queryDatabase(input: { database_id: string; filter?: any; sorts?: any[] }): Promise<any>;
}

// ============================================================================
// WORKFLOW RUNTIME
// ============================================================================

export class WorkflowRuntime {
	private oauthTokens: Record<string, any> = {};
	private storage: Map<string, any> = new Map();
	private stepExecutions: StepExecution[] = [];

	/**
	 * Initialize runtime with OAuth tokens
	 */
	async initialize(): Promise<void> {
		this.oauthTokens = await loadOAuthTokens();
	}

	/**
	 * Execute a workflow with test data
	 */
	async execute(
		workflow: WorkflowDefinition,
		testData: any,
		config: Record<string, any> = {}
	): Promise<{
		result: WorkflowResult;
		steps: StepExecution[];
		totalDuration: number;
	}> {
		const startTime = Date.now();
		this.stepExecutions = [];

		// Validate required integrations have OAuth tokens
		const missingIntegrations: string[] = [];
		for (const integration of workflow.integrations) {
			if (!this.oauthTokens[integration]) {
				missingIntegrations.push(integration);
			}
		}

		if (missingIntegrations.length > 0) {
			throw new Error(
				`Missing OAuth tokens for: ${missingIntegrations.join(', ')}\n` +
					`Connect them with: workway oauth connect <provider>`
			);
		}

		// Create context
		const context = this.createContext(workflow, testData, config);

		// Execute workflow
		let result: WorkflowResult;
		try {
			result = await workflow.execute(context);
		} catch (error: any) {
			result = {
				success: false,
				error: error.message,
			};
		}

		const totalDuration = Date.now() - startTime;

		// Add metadata
		result.metadata = {
			...result.metadata,
			actionsExecuted: this.stepExecutions.length,
			executionTimeMs: totalDuration,
		};

		return {
			result,
			steps: this.stepExecutions,
			totalDuration,
		};
	}

	/**
	 * Create workflow context
	 */
	private createContext(
		workflow: WorkflowDefinition,
		testData: any,
		config: Record<string, any>
	): WorkflowContext {
		const runId = `test-${Date.now()}`;

		return {
			runId,
			userId: 'cli-test-user',
			installationId: 'cli-test-installation',
			trigger: {
				type: testData.trigger?.type || 'manual',
				data: testData.trigger?.data || testData,
				timestamp: Date.now(),
			},
			config: { ...testData.config, ...config },
			actions: this.createActionHelpers(),
			storage: this.createStorage(),
			env: {},
		};
	}

	/**
	 * Create action helpers for executing integration actions
	 */
	private createActionHelpers(): ActionHelpers {
		const self = this;

		// Generic execute function
		const execute = async <TInput, TOutput>(actionId: string, input: TInput): Promise<TOutput> => {
			const [integration, action] = actionId.split('.');
			const handler = self.getActionHandler(integration, action);

			if (!handler) {
				throw new Error(`Unknown action: ${actionId}`);
			}

			const startTime = Date.now();
			let output: any;
			let status: 'success' | 'failed' = 'success';
			let error: string | undefined;

			try {
				output = await handler(input);
			} catch (err: any) {
				status = 'failed';
				error = err.message;
				throw err;
			} finally {
				self.stepExecutions.push({
					actionId,
					input,
					output,
					duration: Date.now() - startTime,
					status,
					error,
				});
			}

			return output;
		};

		// Create integration-specific helpers
		return {
			execute,
			gmail: {
				fetchEmail: (input) => execute('gmail.fetch-email', input),
				sendEmail: (input) => execute('gmail.send-email', input),
				addLabel: (input) => execute('gmail.add-label', input),
				listMessages: (input) => execute('gmail.list-messages', input),
			},
			slack: {
				sendMessage: (input) => execute('slack.send-message', input),
				listChannels: (input) => execute('slack.list-channels', input),
			},
			notion: {
				createPage: (input) => execute('notion.create-page', input),
				updatePage: (input) => execute('notion.update-page', input),
				queryDatabase: (input) => execute('notion.query-database', input),
			},
		};
	}

	/**
	 * Get action handler for integration
	 */
	private getActionHandler(integration: string, action: string): ((input: any) => Promise<any>) | null {
		const handlers: Record<string, Record<string, (input: any) => Promise<any>>> = {
			gmail: {
				'fetch-email': this.gmailFetchEmail.bind(this),
				'send-email': this.gmailSendEmail.bind(this),
				'add-label': this.gmailAddLabel.bind(this),
				'list-messages': this.gmailListMessages.bind(this),
			},
			slack: {
				'send-message': this.slackSendMessage.bind(this),
				'list-channels': this.slackListChannels.bind(this),
			},
			notion: {
				'create-page': this.notionCreatePage.bind(this),
				'update-page': this.notionUpdatePage.bind(this),
				'query-database': this.notionQueryDatabase.bind(this),
			},
		};

		return handlers[integration]?.[action] || null;
	}

	/**
	 * Create in-memory storage
	 */
	private createStorage(): WorkflowStorage {
		return {
			get: async <T>(key: string): Promise<T | null> => {
				return (this.storage.get(key) as T) || null;
			},
			set: async (key: string, value: any): Promise<void> => {
				this.storage.set(key, value);
			},
			delete: async (key: string): Promise<void> => {
				this.storage.delete(key);
			},
			keys: async (): Promise<string[]> => {
				return Array.from(this.storage.keys());
			},
		};
	}

	// ============================================================================
	// GMAIL ACTIONS
	// ============================================================================

	private async gmailFetchEmail(input: { messageId: string }): Promise<any> {
		const token = this.oauthTokens.gmail;
		if (!token?.access_token) {
			throw new Error('Gmail not connected. Run: workway oauth connect gmail');
		}

		const response = await fetch(
			`https://gmail.googleapis.com/gmail/v1/users/me/messages/${input.messageId}?format=full`,
			{
				headers: {
					Authorization: `Bearer ${token.access_token}`,
				},
			}
		);

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Gmail API error: ${response.status} - ${error}`);
		}

		const message = await response.json();
		return this.parseGmailMessage(message);
	}

	private async gmailSendEmail(input: { to: string; subject: string; body: string }): Promise<any> {
		const token = this.oauthTokens.gmail;
		if (!token?.access_token) {
			throw new Error('Gmail not connected. Run: workway oauth connect gmail');
		}

		// Create email in RFC 2822 format
		const email = [
			`To: ${input.to}`,
			`Subject: ${input.subject}`,
			'Content-Type: text/html; charset=utf-8',
			'',
			input.body,
		].join('\r\n');

		const encodedEmail = Buffer.from(email).toString('base64url');

		const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token.access_token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ raw: encodedEmail }),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Gmail API error: ${response.status} - ${error}`);
		}

		return await response.json();
	}

	private async gmailAddLabel(input: { messageId: string; labelId: string }): Promise<any> {
		const token = this.oauthTokens.gmail;
		if (!token?.access_token) {
			throw new Error('Gmail not connected. Run: workway oauth connect gmail');
		}

		const response = await fetch(
			`https://gmail.googleapis.com/gmail/v1/users/me/messages/${input.messageId}/modify`,
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token.access_token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					addLabelIds: [input.labelId],
				}),
			}
		);

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Gmail API error: ${response.status} - ${error}`);
		}

		return await response.json();
	}

	private async gmailListMessages(input: { query?: string; maxResults?: number }): Promise<any> {
		const token = this.oauthTokens.gmail;
		if (!token?.access_token) {
			throw new Error('Gmail not connected. Run: workway oauth connect gmail');
		}

		const params = new URLSearchParams();
		if (input.query) params.set('q', input.query);
		if (input.maxResults) params.set('maxResults', String(input.maxResults));

		const response = await fetch(
			`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
			{
				headers: {
					Authorization: `Bearer ${token.access_token}`,
				},
			}
		);

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Gmail API error: ${response.status} - ${error}`);
		}

		return await response.json();
	}

	private parseGmailMessage(message: any): any {
		const headers = message.payload?.headers || [];
		const getHeader = (name: string) =>
			headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value;

		let body = '';
		if (message.payload?.body?.data) {
			body = Buffer.from(message.payload.body.data, 'base64').toString('utf8');
		} else if (message.payload?.parts) {
			const textPart = message.payload.parts.find(
				(p: any) => p.mimeType === 'text/plain' || p.mimeType === 'text/html'
			);
			if (textPart?.body?.data) {
				body = Buffer.from(textPart.body.data, 'base64').toString('utf8');
			}
		}

		return {
			id: message.id,
			threadId: message.threadId,
			from: getHeader('from'),
			to: getHeader('to'),
			subject: getHeader('subject'),
			date: getHeader('date'),
			body,
			snippet: message.snippet,
			labelIds: message.labelIds,
		};
	}

	// ============================================================================
	// SLACK ACTIONS
	// ============================================================================

	private async slackSendMessage(input: { channel: string; text: string; blocks?: any[] }): Promise<any> {
		const token = this.oauthTokens.slack;
		if (!token?.access_token) {
			throw new Error('Slack not connected. Run: workway oauth connect slack');
		}

		const response = await fetch('https://slack.com/api/chat.postMessage', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token.access_token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				channel: input.channel,
				text: input.text,
				blocks: input.blocks,
			}),
		});

		const result = await response.json();
		if (!result.ok) {
			throw new Error(`Slack API error: ${result.error}`);
		}

		return result;
	}

	private async slackListChannels(input?: { limit?: number }): Promise<any> {
		const token = this.oauthTokens.slack;
		if (!token?.access_token) {
			throw new Error('Slack not connected. Run: workway oauth connect slack');
		}

		const params = new URLSearchParams();
		if (input?.limit) params.set('limit', String(input.limit));

		const response = await fetch(`https://slack.com/api/conversations.list?${params}`, {
			headers: {
				Authorization: `Bearer ${token.access_token}`,
			},
		});

		const result = await response.json();
		if (!result.ok) {
			throw new Error(`Slack API error: ${result.error}`);
		}

		return result;
	}

	// ============================================================================
	// NOTION ACTIONS
	// ============================================================================

	private async notionCreatePage(input: {
		database_id: string;
		properties: any;
		children?: any[];
	}): Promise<any> {
		const token = this.oauthTokens.notion;
		if (!token?.access_token) {
			throw new Error('Notion not connected. Run: workway oauth connect notion');
		}

		const response = await fetch('https://api.notion.com/v1/pages', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token.access_token}`,
				'Content-Type': 'application/json',
				'Notion-Version': '2022-06-28',
			},
			body: JSON.stringify({
				parent: { database_id: input.database_id },
				properties: input.properties,
				children: input.children,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Notion API error: ${response.status} - ${error}`);
		}

		return await response.json();
	}

	private async notionUpdatePage(input: { page_id: string; properties: any }): Promise<any> {
		const token = this.oauthTokens.notion;
		if (!token?.access_token) {
			throw new Error('Notion not connected. Run: workway oauth connect notion');
		}

		const response = await fetch(`https://api.notion.com/v1/pages/${input.page_id}`, {
			method: 'PATCH',
			headers: {
				Authorization: `Bearer ${token.access_token}`,
				'Content-Type': 'application/json',
				'Notion-Version': '2022-06-28',
			},
			body: JSON.stringify({
				properties: input.properties,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Notion API error: ${response.status} - ${error}`);
		}

		return await response.json();
	}

	private async notionQueryDatabase(input: {
		database_id: string;
		filter?: any;
		sorts?: any[];
	}): Promise<any> {
		const token = this.oauthTokens.notion;
		if (!token?.access_token) {
			throw new Error('Notion not connected. Run: workway oauth connect notion');
		}

		const response = await fetch(`https://api.notion.com/v1/databases/${input.database_id}/query`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token.access_token}`,
				'Content-Type': 'application/json',
				'Notion-Version': '2022-06-28',
			},
			body: JSON.stringify({
				filter: input.filter,
				sorts: input.sorts,
			}),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Notion API error: ${response.status} - ${error}`);
		}

		return await response.json();
	}
}

/**
 * Load and compile a workflow from TypeScript
 */
export async function loadWorkflow(workflowPath: string): Promise<WorkflowDefinition> {
	const { build } = await import('esbuild');
	const fs = await import('fs-extra');
	const path = await import('path');
	const os = await import('os');

	// Create temp directory for compiled output
	const tempDir = path.join(os.tmpdir(), 'workway-cli-test');
	await fs.ensureDir(tempDir);

	const outfile = path.join(tempDir, `workflow-${Date.now()}.mjs`);

	try {
		// Compile TypeScript to JavaScript
		await build({
			entryPoints: [workflowPath],
			outfile,
			bundle: true,
			format: 'esm',
			platform: 'node',
			target: 'node18',
			external: ['@workway/sdk'],
			sourcemap: false,
			minify: false,
		});

		// Import the compiled workflow
		const workflowModule = await import(`file://${outfile}`);
		const workflow = workflowModule.default || workflowModule;

		if (!workflow.execute || typeof workflow.execute !== 'function') {
			throw new Error('Workflow must export an execute function');
		}

		return workflow;
	} finally {
		// Clean up temp file
		try {
			await fs.remove(outfile);
		} catch {
			// Ignore cleanup errors
		}
	}
}
