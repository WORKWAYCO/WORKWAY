/**
 * RLM Session Durable Object
 *
 * Stateful session management for RLM executions
 * Enables pause/resume, progress tracking, and crash recovery
 */

import { DurableObject } from 'cloudflare:workers';
import { Env, RLMSessionState, RLMIteration, RLMConfig } from './types';
import { executeRLM, estimateCost } from './rlm-engine';

export class RLMSession extends DurableObject<Env> {
	private state: RLMSessionState | null = null;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	/**
	 * Initialize a new RLM session
	 */
	async initialize(context: string, query: string, config: RLMConfig): Promise<string> {
		const sessionId = this.ctx.id.toString();

		this.state = {
			sessionId,
			context,
			query,
			config,
			iterations: [],
			subCalls: 0,
			startTime: Date.now(),
			status: 'running',
		};

		// Store in Durable Object storage
		await this.ctx.storage.put('state', this.state);

		return sessionId;
	}

	/**
	 * Execute RLM analysis
	 */
	async execute(): Promise<void> {
		if (!this.state) {
			this.state = await this.ctx.storage.get<RLMSessionState>('state');
			if (!this.state) {
				throw new Error('Session not initialized');
			}
		}

		try {
			// Run RLM
			const result = await executeRLM(
				this.env,
				this.state.context,
				this.state.query,
				this.state.config,
				this.state.iterations,
			);

			// Update state
			this.state.iterations = result.iterations;
			this.state.subCalls = result.subCalls;
			this.state.result = result.answer;
			this.state.status = 'completed';

			await this.ctx.storage.put('state', this.state);

			// Track analytics
			const provider = this.state.config.provider || 'gemini';
			const rootModel = this.state.config.rootModel;
			this.env.RLM_ANALYTICS.writeDataPoint({
				blobs: [this.state.sessionId, this.state.status, provider],
				doubles: [
					result.iterations.length,
					result.subCalls,
					estimateCost(result.iterations, provider, rootModel),
					Date.now() - this.state.startTime,
				],
				indexes: [this.state.sessionId],
			});
		} catch (error) {
			this.state.status = 'failed';
			this.state.error = error instanceof Error ? error.message : 'Unknown error';
			await this.ctx.storage.put('state', this.state);
		}
	}

	/**
	 * Get session status
	 */
	async getStatus(): Promise<RLMSessionState> {
		if (!this.state) {
			this.state = await this.ctx.storage.get<RLMSessionState>('state');
		}

		if (!this.state) {
			throw new Error('Session not found');
		}

		return this.state;
	}

	/**
	 * Get final result
	 */
	async getResult(): Promise<{
		success: boolean;
		answer: string | null;
		iterations: RLMIteration[];
		subCalls: number;
		costUsd: number;
		durationMs: number;
		error?: string;
	}> {
		const state = await this.getStatus();

		const provider = state.config.provider || 'gemini';
		const rootModel = state.config.rootModel;

		return {
			success: state.status === 'completed',
			answer: state.result || null,
			iterations: state.iterations,
			subCalls: state.subCalls,
			costUsd: estimateCost(state.iterations, provider, rootModel),
			durationMs: Date.now() - state.startTime,
			error: state.error,
		};
	}

	/**
	 * Handle HTTP requests to this Durable Object
	 */
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		if (path === '/initialize' && request.method === 'POST') {
			const body = await request.json();
			const sessionId = await this.initialize(body.context, body.query, body.config);
			return Response.json({ sessionId });
		}

		if (path === '/execute' && request.method === 'POST') {
			await this.execute();
			return Response.json({ success: true });
		}

		if (path === '/status') {
			const status = await this.getStatus();
			return Response.json(status);
		}

		if (path === '/result') {
			const result = await this.getResult();
			return Response.json(result);
		}

		return new Response('Not Found', { status: 404 });
	}
}
