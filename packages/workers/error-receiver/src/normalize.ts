/**
 * Error Normalization
 *
 * Converts various error formats into a common schema.
 */

import { createHash } from 'node:crypto';

export interface NormalizedError {
  id: string;
  fingerprint: string;
  level: 'error' | 'fatal' | 'warning';
  message: string;
  stack: string | null;
  context: {
    url?: string;
    user_id?: string;
    request_id?: string;
    worker?: string;
    [key: string]: unknown;
  };
  source: string;
  repo: string;
  received_at: string;
}

interface SentryEvent {
  event_id: string;
  level: string;
  message?: string;
  exception?: {
    values: Array<{
      type: string;
      value: string;
      stacktrace?: {
        frames: Array<{
          filename: string;
          function: string;
          lineno: number;
        }>;
      };
    }>;
  };
  tags?: Record<string, string>;
  contexts?: Record<string, unknown>;
  project: string;
}

interface CloudWatchEvent {
  AlarmName: string;
  AlarmDescription: string;
  NewStateValue: string;
  NewStateReason: string;
  StateChangeTime: string;
  Trigger: {
    MetricName: string;
    Namespace: string;
  };
}

interface CustomEvent {
  level?: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  repo?: string;
  fingerprint?: string;
}

export function normalizeError(
  payload: unknown,
  source: string
): NormalizedError {
  switch (source) {
    case 'sentry':
      return normalizeSentry(payload as SentryEvent);
    case 'cloudwatch':
      return normalizeCloudWatch(payload as CloudWatchEvent);
    default:
      return normalizeCustom(payload as CustomEvent);
  }
}

function normalizeSentry(event: SentryEvent): NormalizedError {
  const exception = event.exception?.values?.[0];
  const message = exception
    ? `${exception.type}: ${exception.value}`
    : event.message || 'Unknown error';

  const stack = exception?.stacktrace?.frames
    ? exception.stacktrace.frames
        .map((f) => `  at ${f.function} (${f.filename}:${f.lineno})`)
        .reverse()
        .join('\n')
    : null;

  // Infer repo from project name or tags
  const repo = event.tags?.repo || inferRepoFromProject(event.project);

  return {
    id: event.event_id,
    fingerprint: generateFingerprint(message, stack),
    level: normalizeLevel(event.level),
    message,
    stack,
    context: {
      ...event.tags,
      sentry_project: event.project,
    },
    source: 'sentry',
    repo,
    received_at: new Date().toISOString(),
  };
}

function normalizeCloudWatch(event: CloudWatchEvent): NormalizedError {
  const message = `${event.AlarmName}: ${event.NewStateReason}`;

  return {
    id: crypto.randomUUID(),
    fingerprint: generateFingerprint(event.AlarmName, null),
    level: event.NewStateValue === 'ALARM' ? 'error' : 'warning',
    message,
    stack: null,
    context: {
      alarm_name: event.AlarmName,
      alarm_description: event.AlarmDescription,
      metric: event.Trigger.MetricName,
      namespace: event.Trigger.Namespace,
    },
    source: 'cloudwatch',
    repo: inferRepoFromNamespace(event.Trigger.Namespace),
    received_at: new Date().toISOString(),
  };
}

function normalizeCustom(event: CustomEvent): NormalizedError {
  return {
    id: crypto.randomUUID(),
    fingerprint: event.fingerprint || generateFingerprint(event.message, event.stack || null),
    level: normalizeLevel(event.level),
    message: event.message,
    stack: event.stack || null,
    context: event.context || {},
    source: 'custom',
    repo: event.repo || 'unknown',
    received_at: new Date().toISOString(),
  };
}

function normalizeLevel(level?: string): 'error' | 'fatal' | 'warning' {
  switch (level?.toLowerCase()) {
    case 'fatal':
    case 'critical':
      return 'fatal';
    case 'warning':
    case 'warn':
      return 'warning';
    default:
      return 'error';
  }
}

function generateFingerprint(message: string, stack: string | null): string {
  // Create fingerprint from message + first stack frame
  const content = stack
    ? `${message}:${stack.split('\n')[0]}`
    : message;

  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function inferRepoFromProject(project: string): string {
  // Map Sentry project names to repos
  const mapping: Record<string, string> = {
    'workway-api': 'workway-platform',
    'workway-web': 'workway-platform',
    'workway-sdk': 'Cloudflare',
    'workway-workers': 'Cloudflare',
  };
  return mapping[project] || 'unknown';
}

function inferRepoFromNamespace(namespace: string): string {
  // Map CloudWatch namespaces to repos
  if (namespace.includes('Lambda') || namespace.includes('API')) {
    return 'workway-platform';
  }
  return 'Cloudflare';
}
