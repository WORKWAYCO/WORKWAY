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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Only accept POST
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Validate webhook signature (source-specific)
    const source = new URL(request.url).searchParams.get('source') || 'custom';
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
