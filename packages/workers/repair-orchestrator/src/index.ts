/**
 * Repair Orchestrator Durable Object
 *
 * Manages repair sessions with deduplication, rate limiting, and state tracking.
 *
 * Philosophy: Single source of truth for repair state.
 * Prevents duplicate work and runaway costs.
 */

import { RepairStateManager, type NormalizedError, type RepairState } from './state';

export interface Env {
  REPAIR_ORCHESTRATOR: DurableObjectNamespace;
  REPAIR_AGENT_WORKFLOW: Workflow;
  ANTHROPIC_API_KEY: string;
  GITHUB_TOKEN: string;
}

/**
 * Durable Object managing repair lifecycle
 */
export class RepairOrchestrator {
  private state: DurableObjectState;
  private env: Env;
  private manager: RepairStateManager;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.manager = new RepairStateManager(state.storage);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Status endpoint
    if (path === '/status') {
      return this.handleStatus();
    }

    // Trigger repair endpoint
    if (path === '/repair' && request.method === 'POST') {
      return this.handleRepair(request);
    }

    // Get repair state
    if (path.startsWith('/repair/')) {
      const id = path.split('/')[2];
      return this.handleGetRepair(id);
    }

    return new Response('Not found', { status: 404 });
  }

  /**
   * Handle incoming error for repair
   */
  private async handleRepair(request: Request): Promise<Response> {
    try {
      const error = (await request.json()) as NormalizedError;

      // Check for duplicate
      if (await this.manager.isDuplicate(error.fingerprint)) {
        const existing = await this.manager.getRepairByFingerprint(error.fingerprint);
        return Response.json({
          status: 'duplicate',
          existing_repair_id: existing?.id,
          message: 'Error already being repaired',
        });
      }

      // Check rate limit
      if (await this.manager.isRateLimited(error.repo)) {
        return Response.json(
          {
            status: 'rate_limited',
            message: `Repo ${error.repo} has exceeded rate limit`,
          },
          { status: 429 }
        );
      }

      // Create repair state
      const repair = await this.manager.createRepair(error);
      await this.manager.incrementRateLimit(error.repo);

      // Trigger workflow asynchronously
      this.state.waitUntil(this.triggerWorkflow(repair));

      return Response.json({
        status: 'started',
        repair_id: repair.id,
      });
    } catch (err) {
      console.error('Error handling repair:', err);
      return Response.json(
        { error: 'Failed to process repair request' },
        { status: 500 }
      );
    }
  }

  /**
   * Trigger repair workflow
   */
  private async triggerWorkflow(repair: RepairState): Promise<void> {
    try {
      // Update status to diagnosing
      await this.manager.updateRepair(repair.id, { status: 'diagnosing' });

      // Trigger workflow
      const instance = await this.env.REPAIR_AGENT_WORKFLOW.create({
        params: {
          repair_id: repair.id,
          error: repair.error,
          orchestrator_url: `https://repair-orchestrator.workway.co/${repair.id}`,
        },
      });

      console.log(`Triggered workflow for repair ${repair.id}:`, instance.id);
    } catch (err) {
      console.error(`Failed to trigger workflow for repair ${repair.id}:`, err);
      await this.manager.updateRepair(repair.id, {
        status: 'failed',
        failure_reason: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  /**
   * Get repair status
   */
  private async handleGetRepair(id: string): Promise<Response> {
    const repair = await this.manager.getRepair(id);

    if (!repair) {
      return Response.json({ error: 'Repair not found' }, { status: 404 });
    }

    return Response.json(repair);
  }

  /**
   * Get orchestrator status
   */
  private async handleStatus(): Promise<Response> {
    const stats = await this.manager.getStats();
    const active = await this.manager.listActiveRepairs();

    return Response.json({
      stats,
      active_repairs: active.length,
      active: active.map((r) => ({
        id: r.id,
        repo: r.repo,
        status: r.status,
        fingerprint: r.error_fingerprint,
        created_at: r.created_at,
      })),
    });
  }
}

/**
 * Worker that routes to Durable Object
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Get DO instance ID from URL or use default
    const url = new URL(request.url);
    const doId = url.searchParams.get('do_id') || 'global';

    const id = env.REPAIR_ORCHESTRATOR.idFromName(doId);
    const stub = env.REPAIR_ORCHESTRATOR.get(id);

    return stub.fetch(request);
  },

  /**
   * Queue consumer for repair-queue
   */
  async queue(batch: MessageBatch<NormalizedError>, env: Env): Promise<void> {
    // Use global DO instance for all repairs
    const id = env.REPAIR_ORCHESTRATOR.idFromName('global');
    const stub = env.REPAIR_ORCHESTRATOR.get(id);

    for (const message of batch.messages) {
      try {
        await stub.fetch('https://internal/repair', {
          method: 'POST',
          body: JSON.stringify(message.body),
        });
        message.ack();
      } catch (err) {
        console.error('Failed to process message:', err);
        message.retry();
      }
    }
  },
};

export { RepairStateManager } from './state';
