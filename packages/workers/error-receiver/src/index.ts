/**
 * Error Receiver Worker
 *
 * Receives error webhooks from various sources (Sentry, CloudWatch, custom),
 * normalizes them, and enqueues for the repair agent.
 *
 * Philosophy: Fast acknowledgment, async processing.
 * This worker should return within 100ms.
 */

import { normalizeError, type NormalizedError } from './normalize';
import { validateWebhook } from './validate';

export interface Env {
  REPAIR_QUEUE: Queue<NormalizedError>;
  WEBHOOK_SECRET: string;
  ALLOWED_REPOS: string; // Comma-separated list
}

/**
 * Test endpoint handler - creates a test error for pipeline validation
 */
async function handleTestError(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json() as {
      message?: string;
      repo?: string;
      level?: string;
    };

    const testError: NormalizedError = {
      id: `test-${Date.now()}`,
      fingerprint: `test-${crypto.randomUUID().slice(0, 16)}`,
      level: (body.level as 'error' | 'fatal' | 'warning') || 'error',
      message: body.message || 'Test error: Something went wrong',
      stack: `Error: ${body.message || 'Test error'}\n    at TestService.run (test.ts:42)\n    at main (index.ts:10)`,
      context: { test: true, triggered_at: new Date().toISOString() },
      source: 'test',
      repo: body.repo || 'workway-platform',
      received_at: new Date().toISOString(),
    };

    // Check repo allowlist
    const allowedRepos = env.ALLOWED_REPOS.split(',').map((r) => r.trim());
    if (!allowedRepos.includes(testError.repo)) {
      return Response.json(
        { error: `Repo '${testError.repo}' not in allowlist. Allowed: ${allowedRepos.join(', ')}` },
        { status: 400 }
      );
    }

    // Enqueue for processing
    await env.REPAIR_QUEUE.send(testError);

    return Response.json({
      status: 'queued',
      id: testError.id,
      fingerprint: testError.fingerprint,
      message: testError.message,
    });
  } catch (error) {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Only accept POST
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Test endpoint - bypasses signature validation
    if (url.pathname === '/test') {
      return handleTestError(request, env);
    }

    // Validate webhook signature (source-specific)
    const source = url.searchParams.get('source') || 'custom';
    const isValid = await validateWebhook(request, source, env.WEBHOOK_SECRET);
    if (!isValid) {
      return new Response('Invalid signature', { status: 401 });
    }

    try {
      const payload = await request.json();
      const normalized = normalizeError(payload, source);

      // Check repo allowlist
      const allowedRepos = env.ALLOWED_REPOS.split(',').map((r) => r.trim());
      if (!allowedRepos.includes(normalized.repo)) {
        console.log(`Rejected error for non-allowed repo: ${normalized.repo}`);
        return new Response('Repo not configured', { status: 400 });
      }

      // Enqueue for processing
      await env.REPAIR_QUEUE.send(normalized);

      return Response.json({
        status: 'queued',
        id: normalized.id,
        fingerprint: normalized.fingerprint,
      });
    } catch (error) {
      console.error('Error processing webhook:', error);
      return new Response('Invalid payload', { status: 400 });
    }
  },
};
