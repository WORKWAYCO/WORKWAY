# WORKWAY Construction MCP - Performance Analysis

**Target**: Mid-sized construction companies with multiple concurrent projects  
**Date**: February 3, 2026  
**Context**: Cloudflare Worker with D1 database, KV namespace, and Durable Objects

---

## Executive Summary

This analysis identifies **7 critical bottlenecks** and **12 optimization opportunities** across cold starts, database queries, caching, concurrency, memory usage, and rate limiting. The most severe issues are:

1. **N+1 query patterns** in workflow status resources (3 sequential queries)
2. **No rate limiting** for Procore API (3600 req/min limit at risk)
3. **Missing KV caching** for frequently accessed data (workflows, tokens, projects)
4. **Sequential workflow execution** blocking concurrent requests
5. **No database indexes** on frequently queried columns

---

## 1. Cold Start Latency & Worker Startup Time

### Current State

**Good:**
- Lightweight Hono framework (minimal overhead)
- No heavy module-level imports
- Durable Object class defined but not instantiated until needed

**Issues:**

#### 1.1 Module-Level Tool Registration
**Location**: `src/tools/index.ts` (implied), `src/index.ts:18`

**Problem**: All tools are imported and registered at module load time. With multiple tool files (`workflow.ts`, `procore.ts`, `debugging.ts`), this increases cold start time.

**Impact**: 
- Estimated +50-100ms cold start per tool file
- All Zod schemas parsed upfront
- All tool definitions loaded even if never used

**Recommendation**:
```typescript
// Lazy tool loading
const toolCache = new Map<string, Tool>();

async function getTool(name: string): Promise<Tool | null> {
  if (toolCache.has(name)) {
    return toolCache.get(name)!;
  }
  
  // Load tool module on-demand
  const module = await import(`./tools/${name}.ts`);
  const tool = module[name];
  toolCache.set(name, tool);
  return tool;
}
```

#### 1.2 Database Connection Initialization
**Location**: `src/index.ts:167`, `src/lib/db.ts`

**Problem**: D1 database is accessed immediately without connection pooling or warmup.

**Impact**: First query adds 10-30ms latency.

**Recommendation**: Use D1's connection reuse (already handled by Cloudflare, but ensure prepared statements are reused):
```typescript
// Cache prepared statements
const statementCache = new Map<string, D1PreparedStatement>();

function prepare(env: Env, sql: string): D1PreparedStatement {
  if (!statementCache.has(sql)) {
    statementCache.set(sql, env.DB.prepare(sql));
  }
  return statementCache.get(sql)!;
}
```

---

## 2. Database Query Efficiency

### Critical N+1 Query Patterns

#### 2.1 Workflow Status Resource (CRITICAL)
**Location**: `src/resources/index.ts:28-83`

**Problem**: Three sequential queries for a single resource fetch:
```typescript
// Query 1: Get workflow
const workflow = await env.DB.prepare(`SELECT * FROM workflows WHERE id = ?`).bind(workflowId).first();

// Query 2: Get actions (N+1 if multiple workflows)
const actions = await env.DB.prepare(`SELECT * FROM workflow_actions WHERE workflow_id = ? ORDER BY sequence`).bind(workflowId).all();

// Query 3: Get executions
const recentExecutions = await env.DB.prepare(`SELECT id, status, started_at, completed_at, error FROM executions WHERE workflow_id = ? ORDER BY started_at DESC LIMIT 5`).bind(workflowId).all();
```

**Impact**: 
- 3x database round trips per resource fetch
- ~30-90ms total latency (10-30ms per query)
- Multiplied by concurrent requests

**Fix**: Use JOIN or batch queries:
```typescript
// Single query with JOINs
const result = await env.DB.prepare(`
  SELECT 
    w.*,
    json_group_array(json_object(
      'id', wa.id,
      'type', wa.action_type,
      'sequence', wa.sequence,
      'hasCondition', CASE WHEN wa.condition IS NOT NULL THEN 1 ELSE 0 END
    )) as actions,
    json_group_array(json_object(
      'id', e.id,
      'status', e.status,
      'started_at', e.started_at,
      'completed_at', e.completed_at,
      'error', e.error
    )) FILTER (WHERE e.id IS NOT NULL) as recent_executions
  FROM workflows w
  LEFT JOIN workflow_actions wa ON w.id = wa.workflow_id
  LEFT JOIN (
    SELECT * FROM executions 
    WHERE workflow_id = ? 
    ORDER BY started_at DESC 
    LIMIT 5
  ) e ON w.id = e.workflow_id
  WHERE w.id = ?
  GROUP BY w.id
`).bind(workflowId, workflowId).first();
```

#### 2.2 Workflow Deploy Tool
**Location**: `src/tools/workflow.ts:220-235`

**Problem**: Two sequential queries:
```typescript
const workflow = await env.DB.prepare(`SELECT * FROM workflows WHERE id = ?`).bind(input.workflow_id).first();
const actions = await env.DB.prepare(`SELECT * FROM workflow_actions WHERE workflow_id = ? ORDER BY sequence`).bind(input.workflow_id).all();
```

**Fix**: Combine into single query with JOIN.

#### 2.3 Add Action Tool
**Location**: `src/tools/workflow.ts:170-173`

**Problem**: Separate COUNT query before INSERT:
```typescript
const countResult = await env.DB.prepare(`SELECT COUNT(*) as count FROM workflow_actions WHERE workflow_id = ?`).bind(input.workflow_id).first();
const sequence = (countResult?.count || 0) + 1;
```

**Fix**: Use MAX instead of COUNT (more efficient):
```typescript
const maxResult = await env.DB.prepare(`SELECT MAX(sequence) as max_seq FROM workflow_actions WHERE workflow_id = ?`).bind(input.workflow_id).first();
const sequence = (maxResult?.max_seq || 0) + 1;
```

### Missing Database Indexes

**Status**: Some indexes exist (see `migrations/0001_initial.sql`), but critical ones are missing.

**Existing indexes** ✅:
- `idx_workflows_status` - workflows(status)
- `idx_workflows_project` - workflows(project_id)
- `idx_executions_workflow` - executions(workflow_id)
- `idx_executions_status` - executions(status)
- `idx_oauth_tokens_provider` - oauth_tokens(provider)

**Missing indexes** ❌ (see `migrations/0002_performance_indexes.sql`):
- `idx_workflows_updated_at` - workflows(updated_at DESC) - **CRITICAL** for `list_workflows` ORDER BY
- `idx_workflow_actions_workflow_id` - workflow_actions(workflow_id) - **CRITICAL** for JOIN queries
- `idx_workflow_actions_sequence` - workflow_actions(workflow_id, sequence) - **CRITICAL** for ORDER BY sequence
- `idx_executions_started_at` - executions(workflow_id, started_at DESC) - **CRITICAL** for workflow status resource
- `idx_oauth_tokens_expires_at` - oauth_tokens(expires_at) - **HIGH** for token refresh checks

**Impact**: Without these indexes:
- `list_workflows` ORDER BY updated_at DESC will scan full table
- JOIN queries on workflow_actions will be slow
- Workflow status resource queries will be slow
- Token expiry checks will scan full oauth_tokens table

---

## 3. Caching Opportunities (KV Not Being Used Effectively)

### Current KV Usage

**Only used for**:
- OAuth state tokens (`oauth_state:${state}`) - temporary, 10min TTL ✅

**Not used for**:
- Workflow definitions (frequently accessed, rarely changed)
- OAuth tokens (queried on every Procore API call)
- Procore projects list (rarely changes, expensive API call)
- Workflow status resources (high read frequency)

### Critical Caching Gaps

#### 3.1 OAuth Token Caching (HIGH PRIORITY)
**Location**: `src/lib/procore-client.ts:31-76`, `src/tools/procore.ts:17-53`

**Problem**: Token fetched from database on **every** Procore API request:
```typescript
// Called on EVERY Procore API call
const token = await env.DB.prepare(`SELECT * FROM oauth_tokens WHERE provider = 'procore' LIMIT 1`).first();
```

**Impact**: 
- Database query overhead on every API call
- Token rarely changes (only on refresh/expiry)
- ProcoreClient has in-memory cache (`tokenCache`) but it's per-instance (lost on cold start)

**Fix**: Use KV for token caching:
```typescript
async getToken(): Promise<OAuthToken> {
  // Check KV first (fast, global)
  const cached = await this.env.KV.get(`token:procore`, 'json');
  if (cached && new Date(cached.expiresAt) > new Date()) {
    return cached;
  }
  
  // Fallback to DB
  const token = await this.env.DB.prepare(`SELECT * FROM oauth_tokens WHERE provider = 'procore' LIMIT 1`).first();
  
  // Cache in KV (5min TTL, shorter than token expiry)
  if (token) {
    await this.env.KV.put(`token:procore`, JSON.stringify({
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: token.expires_at,
    }), { expirationTtl: 300 });
  }
  
  return token;
}
```

**Performance gain**: ~10-30ms saved per API call (KV read: <1ms vs DB: 10-30ms)

#### 3.2 Workflow Definition Caching
**Location**: `src/tools/workflow.ts:222`, `src/resources/index.ts:34`

**Problem**: Workflow definitions fetched from DB on every deploy/test/status check.

**Impact**: 
- Workflows change infrequently (only on deploy/update)
- High read frequency (status checks, executions)
- Multiple tools fetch same workflow

**Fix**: Cache workflow definitions in KV:
```typescript
async function getWorkflow(env: Env, id: string): Promise<Workflow | null> {
  // Check KV cache
  const cached = await env.KV.get(`workflow:${id}`, 'json');
  if (cached) return cached;
  
  // Fetch from DB
  const workflow = await env.DB.prepare(`SELECT * FROM workflows WHERE id = ?`).bind(id).first();
  
  // Cache (1 hour TTL, invalidate on update)
  if (workflow) {
    await env.KV.put(`workflow:${id}`, JSON.stringify(workflow), { expirationTtl: 3600 });
  }
  
  return workflow;
}

// Invalidate on update
async function updateWorkflow(env: Env, id: string, data: Partial<Workflow>) {
  await env.DB.prepare(`UPDATE workflows SET ... WHERE id = ?`).bind(id).run();
  await env.KV.delete(`workflow:${id}`); // Invalidate cache
}
```

#### 3.3 Procore Projects Caching
**Location**: `src/tools/procore.ts:169-198`

**Problem**: Projects list fetched from Procore API every time (expensive external call).

**Impact**: 
- Projects rarely change
- External API latency (100-500ms)
- Rate limit consumption (3600 req/min)

**Fix**: Cache projects list:
```typescript
async list_procore_projects(input, env) {
  const cacheKey = `procore:projects:${input.company_id || 'all'}:${input.active_only}`;
  
  // Check KV cache (5min TTL)
  const cached = await env.KV.get(cacheKey, 'json');
  if (cached) {
    return { success: true, data: cached, metadata: { cached: true } };
  }
  
  // Fetch from API
  const projects = await procoreRequest(env, `/projects...`);
  
  // Cache result
  await env.KV.put(cacheKey, JSON.stringify(projects), { expirationTtl: 300 });
  
  return { success: true, data: projects };
}
```

---

## 4. Concurrent Execution Handling

### Sequential Execution Bottlenecks

#### 4.1 Workflow Test Tool
**Location**: `src/tools/workflow.ts:325-389`

**Problem**: Actions executed sequentially in a loop:
```typescript
for (const action of actions.results || []) {
  try {
    // TODO: Actually execute action
    completedSteps++;
    output[action.action_type] = { status: 'simulated', actionId: action.id };
  } catch (e) {
    errors.push(`Action ${action.action_type} failed: ${e}`);
    break; // Stops on first error
  }
}
```

**Impact**: 
- Total execution time = sum of all action times
- No parallelization for independent actions
- Blocks Worker thread during execution

**Fix**: Use Promise.all for independent actions:
```typescript
// Execute independent actions in parallel
const actionPromises = actions.results.map(async (action) => {
  try {
    const result = await executeAction(action, input.test_payload);
    return { actionId: action.id, success: true, result };
  } catch (e) {
    return { actionId: action.id, success: false, error: e.message };
  }
});

const results = await Promise.all(actionPromises);
completedSteps = results.filter(r => r.success).length;
errors = results.filter(r => !r.success).map(r => r.error);
```

#### 4.2 Webhook Handler
**Location**: `src/index.ts:162-189`

**Problem**: Webhook handler creates execution record synchronously, then returns immediately:
```typescript
// Creates execution record
await c.env.DB.prepare(`INSERT INTO executions ...`).run();

// TODO: Queue workflow execution via Durable Object
// For now, return acknowledgment
return c.json({ received: true, executionId, ... });
```

**Impact**: 
- Execution not actually queued (TODO)
- No concurrent execution handling
- Risk of duplicate executions if webhook retries

**Fix**: Use Durable Object for execution queue:
```typescript
app.post('/webhooks/:workflow_id', async (c) => {
  const workflowId = c.req.param('workflow_id');
  const body = await c.req.json();
  
  // Verify workflow exists (cached check)
  const workflow = await getWorkflow(c.env, workflowId);
  if (!workflow || workflow.status !== 'active') {
    return c.json({ error: 'Workflow not found or not active' }, 404);
  }
  
  // Create execution record (async, don't wait)
  const executionId = crypto.randomUUID();
  c.env.DB.prepare(`INSERT INTO executions ...`).bind(...).run().catch(console.error);
  
  // Queue execution via Durable Object (non-blocking)
  const id = c.env.WORKFLOW_STATE.idFromName(workflowId);
  const stub = c.env.WORKFLOW_STATE.get(id);
  await stub.fetch(new Request('http://internal/execute', {
    method: 'POST',
    body: JSON.stringify({ executionId, workflowId, input: body }),
  }));
  
  return c.json({ received: true, executionId });
});
```

#### 4.3 Durable Object Implementation
**Location**: `src/index.ts:278-309`

**Problem**: Durable Object exists but is incomplete:
- No actual workflow execution logic
- No queue management
- No concurrent execution limits

**Fix**: Implement proper execution queue:
```typescript
export class WorkflowState implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private executionQueue: Execution[] = [];
  private isProcessing = false;
  private maxConcurrent = 5; // Limit concurrent executions
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/execute') {
      const { executionId, workflowId, input } = await request.json();
      
      // Add to queue
      this.executionQueue.push({ executionId, workflowId, input });
      
      // Process queue if not already processing
      if (!this.isProcessing) {
        this.processQueue();
      }
      
      return new Response(JSON.stringify({ queued: true, executionId }));
    }
    
    if (url.pathname === '/status') {
      return new Response(JSON.stringify({
        queueLength: this.executionQueue.length,
        isProcessing: this.isProcessing,
      }));
    }
    
    return new Response('Not found', { status: 404 });
  }
  
  private async processQueue() {
    this.isProcessing = true;
    
    while (this.executionQueue.length > 0) {
      const batch = this.executionQueue.splice(0, this.maxConcurrent);
      await Promise.all(batch.map(exec => this.executeWorkflow(exec)));
    }
    
    this.isProcessing = false;
  }
  
  private async executeWorkflow(exec: Execution) {
    // Fetch workflow and actions (cached)
    // Execute actions (parallel where possible)
    // Update execution status
  }
}
```

---

## 5. Memory Usage Patterns

### Large Result Sets

#### 5.1 List Workflows Tool
**Location**: `src/tools/workflow.ts:415-448`

**Problem**: No pagination, returns all workflows:
```typescript
const result = await (params.length > 0 ? stmt.bind(...params) : stmt).all<any>();
return { workflows: result.results?.map(...) || [], total: result.results?.length || 0 };
```

**Impact**: 
- Memory usage scales with number of workflows
- Large JSON response payloads
- No limit on result size

**Fix**: Add pagination:
```typescript
inputSchema: z.object({
  status: z.enum(['all', 'draft', 'active', 'paused', 'error']).optional(),
  project_id: z.string().optional(),
  limit: z.number().optional().default(50).max(100),
  offset: z.number().optional().default(0),
}),

// In execute:
query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
params.push(input.limit, input.offset);
```

#### 5.2 Procore API Results
**Location**: `src/tools/procore.ts:232-277`

**Problem**: Default limit of 50 RFIs, but no pagination for larger datasets:
```typescript
limit: z.number().optional().default(50)
```

**Impact**: 
- Large arrays in memory
- Large JSON responses
- No way to fetch more than limit

**Fix**: Implement cursor-based pagination:
```typescript
outputSchema: z.object({
  rfis: z.array(...),
  total: z.number(),
  next_cursor: z.string().optional(), // For pagination
}),

// In execute:
const response = await procoreRequest(env, url);
const nextCursor = response.pagination?.next_cursor;

return {
  success: true,
  data: {
    rfis: response.data.map(...),
    total: response.total,
    nextCursor,
  },
};
```

---

## 6. Rate Limiting Considerations (Procore API: 3600 req/min)

### Current State: NO RATE LIMITING

**Critical Gap**: No rate limiting implementation for Procore API calls.

**Risk**: 
- 3600 requests/minute = 60 requests/second
- Multiple concurrent workflows could exceed limit
- No queuing or backoff strategy
- 429 errors will cause workflow failures

### Required Implementation

#### 6.1 Rate Limiter Using Durable Objects
**Location**: `src/lib/procore-client.ts:133-176`

**Fix**: Implement token bucket rate limiter:
```typescript
// Rate limiter Durable Object
export class ProcoreRateLimiter implements DurableObject {
  private state: DurableObjectState;
  private tokens = 60; // 60 req/sec = 3600 req/min
  private lastRefill = Date.now();
  private refillRate = 60; // tokens per second
  
  async fetch(request: Request): Promise<Response> {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(60, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
    
    if (this.tokens < 1) {
      const waitTime = (1 - this.tokens) / this.refillRate;
      return new Response(JSON.stringify({
        error: 'RATE_LIMITED',
        retryAfter: Math.ceil(waitTime),
      }), { status: 429 });
    }
    
    this.tokens -= 1;
    return new Response(JSON.stringify({ allowed: true }));
  }
}

// In ProcoreClient.request():
async request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Check rate limit
  const limiterId = this.env.PROCORE_RATE_LIMITER.idFromName('global');
  const limiter = this.env.PROCORE_RATE_LIMITER.get(limiterId);
  const limitCheck = await limiter.fetch(new Request('http://internal/check'));
  
  if (limitCheck.status === 429) {
    const retryAfter = await limitCheck.json();
    throw new ProcoreError('RATE_LIMITED', `Rate limit exceeded. Retry after ${retryAfter.retryAfter}s`);
  }
  
  // Proceed with request
  const token = await this.getToken();
  // ... rest of request logic
}
```

#### 6.2 Exponential Backoff on 429 Errors
**Location**: `src/lib/procore-client.ts:168-170`

**Current**: Throws error immediately on 429.

**Fix**: Implement retry with exponential backoff:
```typescript
async request<T>(path: string, options: RequestInit = {}, retries = 3): Promise<T> {
  try {
    const response = await fetch(`${PROCORE_API_BASE}${path}`, {
      ...options,
      headers: { ... },
    });
    
    if (response.status === 429 && retries > 0) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '1');
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return this.request(path, options, retries - 1);
    }
    
    // ... handle other errors
  } catch (error) {
    // ... error handling
  }
}
```

#### 6.3 Request Batching
**Location**: Multiple Procore tool functions

**Problem**: Each tool makes separate API calls. No batching for multiple requests.

**Fix**: Batch multiple requests where possible:
```typescript
// Instead of:
const rfis = await procoreRequest(env, `/projects/${id}/rfis`);
const logs = await procoreRequest(env, `/projects/${id}/daily_logs`);
const submittals = await procoreRequest(env, `/projects/${id}/submittals`);

// Use Promise.all (parallel, but still 3 API calls):
const [rfis, logs, submittals] = await Promise.all([
  procoreRequest(env, `/projects/${id}/rfis`),
  procoreRequest(env, `/projects/${id}/daily_logs`),
  procoreRequest(env, `/projects/${id}/submittals`),
]);
```

---

## 7. Additional Optimizations

### 7.1 Prepared Statement Caching
**Location**: `src/lib/db.ts`

**Problem**: New prepared statements created for every query.

**Fix**: Cache prepared statements:
```typescript
const statementCache = new Map<string, D1PreparedStatement>();

export function prepare(env: Env, sql: string): D1PreparedStatement {
  if (!statementCache.has(sql)) {
    statementCache.set(sql, env.DB.prepare(sql));
  }
  return statementCache.get(sql)!;
}

// Use in queries:
export async function query<T>(env: Env, sql: string, params: any[] = []): Promise<T[]> {
  const stmt = prepare(env, sql);
  const result = await (params.length > 0 ? stmt.bind(...params) : stmt).all<T>();
  return result.results || [];
}
```

### 7.2 Resource Pattern Matching Optimization
**Location**: `src/resources/index.ts:333-346`

**Problem**: Regex pattern matching on every resource fetch:
```typescript
for (const [pattern, resource] of Object.entries(resources)) {
  const regexPattern = pattern.replace(/\{[^}]+\}/g, '[^/]+');
  const regex = new RegExp(`^${regexPattern}$`);
  if (regex.test(uri)) {
    return await resource.fetch(uri, env);
  }
}
```

**Fix**: Pre-compile regex patterns:
```typescript
const compiledPatterns = Object.entries(resources).map(([pattern, resource]) => ({
  regex: new RegExp(`^${pattern.replace(/\{[^}]+\}/g, '([^/]+)')}$`),
  resource,
  pattern,
}));

export async function fetchResource(uri: string, env: Env) {
  for (const { regex, resource } of compiledPatterns) {
    if (regex.test(uri)) {
      return await resource.fetch(uri, env);
    }
  }
  return null;
}
```

---

## Priority Recommendations

### Critical (Implement Immediately)
1. ✅ **Add database indexes** (5min implementation, huge performance gain)
2. ✅ **Implement KV caching for OAuth tokens** (prevents DB query on every API call)
3. ✅ **Fix N+1 queries in workflow status resource** (3 queries → 1 query)
4. ✅ **Implement Procore rate limiting** (prevents 429 errors)

### High Priority (This Week)
5. ✅ **Cache workflow definitions in KV** (high read frequency)
6. ✅ **Cache Procore projects list** (expensive external API call)
7. ✅ **Add pagination to list endpoints** (prevents memory issues)

### Medium Priority (This Month)
8. ✅ **Parallelize workflow action execution** (faster test/deploy)
9. ✅ **Implement Durable Object execution queue** (proper concurrency)
10. ✅ **Add exponential backoff for 429 errors** (resilience)

### Low Priority (Nice to Have)
11. ✅ **Lazy tool loading** (reduces cold start)
12. ✅ **Prepared statement caching** (minor optimization)

---

## Performance Targets

| Metric | Current | Target | Method |
|--------|---------|--------|--------|
| Cold start | ~200-300ms | <150ms | Lazy loading, statement caching |
| Workflow status fetch | ~90ms (3 queries) | <30ms | Single JOIN query + KV cache |
| Procore API call | ~150ms + DB query | <150ms | KV token cache |
| Concurrent executions | Sequential | 5 parallel | Durable Object queue |
| Rate limit errors | Unhandled | 0% | Rate limiter + backoff |

---

## Implementation Checklist

- [ ] Create database migration for indexes
- [ ] Implement KV token caching in ProcoreClient
- [ ] Refactor workflow status resource to use JOIN
- [ ] Add rate limiter Durable Object
- [ ] Implement execution queue in WorkflowState DO
- [ ] Add pagination to list endpoints
- [ ] Cache workflow definitions in KV
- [ ] Cache Procore projects in KV
- [ ] Add exponential backoff to ProcoreClient
- [ ] Parallelize workflow action execution
- [ ] Add prepared statement caching
- [ ] Implement lazy tool loading

---

## Testing Recommendations

1. **Load testing**: Simulate 100 concurrent workflow executions
2. **Rate limit testing**: Verify rate limiter prevents 429 errors
3. **Cache hit rate**: Monitor KV cache hit rates (target: >80%)
4. **Database query count**: Verify N+1 fixes reduce query count
5. **Cold start monitoring**: Track p50/p95/p99 cold start times
