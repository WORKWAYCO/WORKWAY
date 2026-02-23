/**
 * MCP Telemetry + Braintrust tracing.
 *
 * - D1 telemetry tables for usage/health/activity
 * - Optional Braintrust emission for each tool invocation
 * - Helper resources: telemetry://usage, telemetry://health, telemetry://activity
 */

import type { Context } from 'hono';
import { initLogger, type Logger, type Span } from 'braintrust';
import { generateFingerprint, getUserFromToken } from './auth';
import type { BaseMCPEnv, BraintrustTelemetryOptions, MCPResource, UsageResult } from './types';

export interface RunCountRow {
  server_name: string;
  account_id: string;
  period_start: string;
  runs_this_period: number;
  updated_at: string;
}

export interface ToolInvocationRow {
  id: number;
  server_name: string;
  account_id: string;
  tool_name: string;
  success: number;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
}

export interface TelemetryUsageResult {
  serverName: string;
  accountId: string;
  period: string;
  runsThisPeriod: number;
}

export interface HealthResult {
  serverName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  totalInvocations24h: number;
  errorRate24h: number;
  toolBreakdown: Array<{
    toolName: string;
    invocations: number;
    errors: number;
    avgDurationMs: number;
  }>;
  lastActivity: string | null;
  checkedAt: string;
}

export interface ActivityResult {
  serverName: string;
  invocations: Array<{
    toolName: string;
    accountId: string;
    success: boolean;
    durationMs: number | null;
    error: string | null;
    createdAt: string;
  }>;
}

export interface TelemetryResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

export interface TelemetryInvocationArgs {
  db: D1Database;
  serverName: string;
  toolName: string;
  accountId: string;
  input: unknown;
  output: unknown;
  durationMs: number;
  success: boolean;
  error?: string;
  braintrust?: BraintrustTelemetryOptions;
}

const TELEMETRY_USAGE_URI = 'telemetry://usage';
const TELEMETRY_HEALTH_URI = 'telemetry://health';
const TELEMETRY_ACTIVITY_URI = 'telemetry://activity';
const DEFAULT_BRAINTRUST_PROJECT_NAME = 'WORKWAY';

const TELEMETRY_RESOURCE_URIS = new Set<string>([
  TELEMETRY_USAGE_URI,
  TELEMETRY_HEALTH_URI,
  TELEMETRY_ACTIVITY_URI,
]);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let braintrustLogger: Logger<any> | null = null;
let braintrustLoggerSignature: string | null = null;

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseBooleanFlag(value?: string): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return undefined;
}

function getCurrentPeriod(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function resolveBraintrustTelemetryOptions<TEnv extends BaseMCPEnv>(
  env: TEnv,
  options?: BraintrustTelemetryOptions,
): BraintrustTelemetryOptions {
  const envAny = env as Record<string, unknown>;
  const envEnabled = parseBooleanFlag(asString(envAny.BRAINTRUST_ENABLED));

  return {
    apiKey: options?.apiKey || asString(envAny.BRAINTRUST_API_KEY),
    projectName:
      options?.projectName || asString(envAny.BRAINTRUST_PROJECT_NAME) || DEFAULT_BRAINTRUST_PROJECT_NAME,
    enabled: options?.enabled ?? envEnabled,
  };
}

function initBraintrustTelemetry(options: BraintrustTelemetryOptions = {}, serverName: string): boolean {
  if (!options.apiKey || options.enabled === false) return false;

  const projectName = options.projectName || DEFAULT_BRAINTRUST_PROJECT_NAME;
  const signature = `${options.apiKey}:${projectName}`;

  if (braintrustLogger && braintrustLoggerSignature === signature) {
    return true;
  }

  braintrustLogger = initLogger({
    apiKey: options.apiKey,
    projectName,
    asyncFlush: true,
    setCurrent: true,
  });
  braintrustLoggerSignature = signature;

  console.info(`[telemetry] Braintrust enabled for ${serverName} (project=${projectName})`);
  return true;
}

async function emitBraintrustInvocation(args: {
  serverName: string;
  toolName: string;
  accountId: string;
  input: unknown;
  output: unknown;
  durationMs: number;
  success: boolean;
  error?: string;
}): Promise<void> {
  if (!braintrustLogger) return;

  await braintrustLogger.traced(
    (span: Span) => {
      span.log({
        input: args.input,
        output: args.output,
        error: args.error,
        tags: ['mcp', args.serverName, args.toolName, args.success ? 'success' : 'error'],
        metadata: {
          server: args.serverName,
          tool: args.toolName,
          accountId: args.accountId,
          durationMs: args.durationMs,
          success: args.success,
        },
      });
    },
    {
      name: `mcp:${args.serverName}:${args.toolName}`,
      type: 'tool',
    },
  );
}

export async function recordInvocation(
  db: D1Database,
  serverName: string,
  accountId: string,
  toolName: string,
  durationMs: number,
  success: boolean,
  error?: unknown,
): Promise<void> {
  const period = getCurrentPeriod();
  const errorMessage = error
    ? (error instanceof Error ? error.message : String(error)).slice(0, 500)
    : null;

  await db
    .prepare(
      `INSERT INTO mcp_run_counts (server_name, account_id, period_start, runs_this_period, updated_at)
       VALUES (?, ?, ?, 1, datetime('now'))
       ON CONFLICT(server_name, account_id, period_start) DO UPDATE SET
         runs_this_period = mcp_run_counts.runs_this_period + 1,
         updated_at = datetime('now')`,
    )
    .bind(serverName, accountId, period)
    .run();

  await db
    .prepare(
      `INSERT INTO mcp_tool_invocations (server_name, account_id, tool_name, success, duration_ms, error_message)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(serverName, accountId, toolName, success ? 1 : 0, durationMs, errorMessage)
    .run();
}

export async function emitTelemetryInvocation(args: TelemetryInvocationArgs): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  tasks.push(
    recordInvocation(
      args.db,
      args.serverName,
      args.accountId,
      args.toolName,
      args.durationMs,
      args.success,
      args.error,
    ).catch((error: unknown) => {
      console.warn(`[telemetry] metering failed for ${args.toolName}:`, error);
    }),
  );

  if (initBraintrustTelemetry(args.braintrust, args.serverName)) {
    tasks.push(
      emitBraintrustInvocation({
        serverName: args.serverName,
        toolName: args.toolName,
        accountId: args.accountId,
        input: args.input,
        output: args.output,
        durationMs: args.durationMs,
        success: args.success,
        error: args.error,
      }).catch((error: unknown) => {
        console.warn(`[telemetry] braintrust emit failed for ${args.toolName}:`, error);
      }),
    );
  }

  await Promise.all(tasks);
}

export async function getUsage(
  db: D1Database,
  serverName: string,
  accountId?: string,
): Promise<TelemetryUsageResult> {
  const period = getCurrentPeriod();
  const acct = accountId || 'operator';

  const row = await db
    .prepare(
      `SELECT server_name, account_id, period_start, runs_this_period
       FROM mcp_run_counts
       WHERE server_name = ? AND account_id = ? AND period_start = ?`,
    )
    .bind(serverName, acct, period)
    .first<RunCountRow>();

  return {
    serverName,
    accountId: acct,
    period,
    runsThisPeriod: row?.runs_this_period ?? 0,
  };
}

export async function getHealth(
  db: D1Database,
  serverName: string,
): Promise<HealthResult> {
  const breakdown = await db
    .prepare(
      `SELECT
         tool_name,
         COUNT(*) as invocations,
         SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as errors,
         AVG(duration_ms) as avg_duration_ms
       FROM mcp_tool_invocations
       WHERE server_name = ? AND created_at > datetime('now', '-24 hours')
       GROUP BY tool_name
       ORDER BY invocations DESC`,
    )
    .bind(serverName)
    .all<{ tool_name: string; invocations: number; errors: number; avg_duration_ms: number }>();

  const lastRow = await db
    .prepare(
      `SELECT created_at FROM mcp_tool_invocations
       WHERE server_name = ? ORDER BY created_at DESC LIMIT 1`,
    )
    .bind(serverName)
    .first<{ created_at: string }>();

  const totalInvocations = breakdown.results.reduce((sum, row) => sum + row.invocations, 0);
  const totalErrors = breakdown.results.reduce((sum, row) => sum + row.errors, 0);
  const errorRate = totalInvocations > 0 ? totalErrors / totalInvocations : 0;

  let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (errorRate > 0.5) status = 'unhealthy';
  else if (errorRate > 0.1) status = 'degraded';

  return {
    serverName,
    status,
    totalInvocations24h: totalInvocations,
    errorRate24h: Math.round(errorRate * 1000) / 1000,
    toolBreakdown: breakdown.results.map((row) => ({
      toolName: row.tool_name,
      invocations: row.invocations,
      errors: row.errors,
      avgDurationMs: Math.round(row.avg_duration_ms ?? 0),
    })),
    lastActivity: lastRow?.created_at ?? null,
    checkedAt: new Date().toISOString(),
  };
}

export async function getActivity(
  db: D1Database,
  serverName: string,
  limit: number = 50,
): Promise<ActivityResult> {
  const rows = await db
    .prepare(
      `SELECT tool_name, account_id, success, duration_ms, error_message, created_at
       FROM mcp_tool_invocations
       WHERE server_name = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(serverName, limit)
    .all<ToolInvocationRow>();

  return {
    serverName,
    invocations: rows.results.map((row) => ({
      toolName: row.tool_name,
      accountId: row.account_id,
      success: row.success === 1,
      durationMs: row.duration_ms,
      error: row.error_message,
      createdAt: row.created_at,
    })),
  };
}

export async function cleanupOldInvocations(
  db: D1Database,
  daysToKeep: number = 30,
): Promise<void> {
  await db
    .prepare(
      `DELETE FROM mcp_tool_invocations WHERE created_at < datetime('now', '-' || ? || ' days')`,
    )
    .bind(daysToKeep)
    .run();
}

export async function resolveTelemetryAccountId<TEnv extends BaseMCPEnv>(
  c: Context<{ Bindings: TEnv }>,
): Promise<string> {
  const user = await getUserFromToken(c);
  if (user?.id) return user.id;
  return `anon:${generateFingerprint(c)}`;
}

export function resolveTelemetryAccountIdFromUsage<TEnv extends BaseMCPEnv>(
  c: Context<{ Bindings: TEnv }>,
  usage: UsageResult,
): string {
  if (usage.userId) return usage.userId;
  return `anon:${generateFingerprint(c)}`;
}

export function isTelemetryResourceUri(uri: string): boolean {
  return TELEMETRY_RESOURCE_URIS.has(uri);
}

export function getTelemetryResources(serverName: string): MCPResource[] {
  return [
    {
      uri: TELEMETRY_USAGE_URI,
      name: 'telemetry-usage',
      description: `Run usage for ${serverName} this period`,
      mimeType: 'application/json',
    },
    {
      uri: TELEMETRY_HEALTH_URI,
      name: 'telemetry-health',
      description: `Health status for ${serverName} (last 24 hours)`,
      mimeType: 'application/json',
    },
    {
      uri: TELEMETRY_ACTIVITY_URI,
      name: 'telemetry-activity',
      description: `Recent activity log for ${serverName}`,
      mimeType: 'application/json',
    },
  ];
}

export function mergeTelemetryResources(resources: MCPResource[], serverName: string): MCPResource[] {
  const merged = [...resources];
  for (const telemetryResource of getTelemetryResources(serverName)) {
    if (!merged.some((resource) => resource.uri === telemetryResource.uri)) {
      merged.push(telemetryResource);
    }
  }
  return merged;
}

export async function readTelemetryResource(
  db: D1Database,
  serverName: string,
  uri: string,
  accountId: string,
): Promise<TelemetryResourceContent | null> {
  try {
    if (uri === TELEMETRY_USAGE_URI) {
      const usage = await getUsage(db, serverName, accountId);
      return {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(usage, null, 2),
      };
    }

    if (uri === TELEMETRY_HEALTH_URI) {
      const health = await getHealth(db, serverName);
      return {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(health, null, 2),
      };
    }

    if (uri === TELEMETRY_ACTIVITY_URI) {
      const activity = await getActivity(db, serverName);
      return {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(activity, null, 2),
      };
    }

    return null;
  } catch (error) {
    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        serverName,
      }),
    };
  }
}

export const TELEMETRY_MIGRATION = `
-- MCP Telemetry: Aggregate run counts per server/account/month
CREATE TABLE IF NOT EXISTS mcp_run_counts (
  server_name TEXT NOT NULL,
  account_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  runs_this_period INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (server_name, account_id, period_start)
);

-- MCP Telemetry: Individual tool invocation log
CREATE TABLE IF NOT EXISTS mcp_tool_invocations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_name TEXT NOT NULL,
  account_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 1,
  duration_ms INTEGER,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for health queries
CREATE INDEX IF NOT EXISTS idx_mcp_invocations_server_time
  ON mcp_tool_invocations(server_name, created_at);
CREATE INDEX IF NOT EXISTS idx_mcp_invocations_tool
  ON mcp_tool_invocations(server_name, tool_name);
`.trim();
