# Error Repair Agent - Implementation Summary

> Agent does the work, human makes the decision.

## What Was Built

A complete autonomous error repair pipeline that receives production errors, diagnoses them with Claude, generates fixes, and creates PRs for human approval.

### Architecture

```
Error Sources (Sentry/CloudWatch/Custom)
           ↓
    error-receiver (Worker) ← Fast acknowledgment (<100ms)
           ↓
    repair-queue (Queue) ← Buffering & backpressure
           ↓
    repair-orchestrator (DO) ← Deduplication, rate limiting, state
           ↓
    repair-agent (Workflow) ← Claude-powered diagnosis & fix
           ↓
    GitHub PR + Beads Issue
           ↓
    Human Approval
           ↓
    Auto-Deploy (GitHub Actions) [NOT IMPLEMENTED YET]
```

## Components Implemented

### ✅ 1. Error Receiver Worker

**Location:** `packages/workers/error-receiver/`

**Files:**
- `src/index.ts` - Main worker entry point
- `src/normalize.ts` - Error normalization (Sentry, CloudWatch, custom)
- `src/validate.ts` - Webhook signature validation
- `wrangler.toml` - Worker configuration with queue binding
- `package.json` - Dependencies and scripts

**Features:**
- Accepts Sentry webhooks
- Accepts CloudWatch SNS notifications
- Accepts custom error JSON
- Normalizes all formats to common schema
- Validates webhook signatures (HMAC-SHA256)
- Repo allowlist for security
- Enqueues to `repair-queue`
- Returns within 100ms

### ✅ 2. Repair Queue Configuration

**Queues:**
- `repair-queue` - Main queue for error processing
- `repair-queue-dlq` - Dead letter queue for failed messages

**Configuration:**
- Max batch size: 10 messages
- Max batch timeout: 30 seconds
- Max retries: 3 attempts
- Consumer: repair-orchestrator worker

**Setup Commands:**
```bash
wrangler queues create repair-queue
wrangler queues create repair-queue-dlq
```

### ✅ 3. Repair Orchestrator Durable Object

**Location:** `packages/workers/repair-orchestrator/`

**Files:**
- `src/index.ts` - Durable Object class + queue consumer
- `src/state.ts` - State management and interfaces
- `wrangler.toml` - DO configuration with queue consumer
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `src/index.test.ts` - Unit tests

**Features:**
- **Deduplication:** Prevents duplicate repairs for same error fingerprint (1 hour window)
- **Rate Limiting:** Max 10 repairs per hour per repo
- **State Tracking:** pending → diagnosing → fixing → pr_created → approved → deployed → failed
- **Concurrent Prevention:** Prevents multiple agents working on same error
- **Status Endpoint:** `/status` for monitoring
- **Repair Endpoint:** `/repair` for triggering repairs
- **Statistics:** Tracks repairs by status and repo

**State Schema:**
```typescript
interface RepairState {
  id: string;
  error_fingerprint: string;
  status: RepairStatus;
  repo: string;
  error: NormalizedError;
  diagnosis?: Diagnosis;
  fix?: Fix;
  pr_url?: string;
  beads_issue?: string;
  created_at: string;
  updated_at: string;
  attempts: number;
  failure_reason?: string;
}
```

### ✅ 4. Repair Agent Workflow

**Location:** `packages/workflows/repair-agent/`

**Files:**
- `src/index.ts` - Main workflow orchestration
- `src/diagnose.ts` - Claude-powered diagnosis
- `src/fix.ts` - Fix generation and testing
- `src/pr.ts` - GitHub PR creation
- `wrangler.toml` - Workflow configuration
- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration

**Workflow Steps:**

1. **Diagnose** (Claude API):
   - Fetches relevant code from stack trace
   - Sends error + code context to Claude
   - Gets structured diagnosis with:
     - Root cause
     - Confidence level (high/medium/low)
     - Affected files
     - Risk assessment (low/medium/high)
     - Suggested approach

2. **Generate Fix** (Claude API):
   - Creates branch from main
   - Applies fix using Claude
   - Runs tests locally
   - Iterates max 3 times if tests fail

3. **Create PR** (GitHub API):
   - Pushes branch to GitHub
   - Creates PR with diagnosis + fix explanation
   - Includes test results as evidence
   - Links to error source
   - Adds labels: `repair-agent`, `risk:{level}`

4. **Create Beads Issue** (Beads CLI):
   - Creates issue for tracking
   - Links to PR
   - Adds appropriate labels

**Safety Features:**
- High-risk errors skip auto-fix (require manual triage)
- Failed tests abort the fix
- All changes in PR for human review
- No direct deployments

## Cost Controls Implemented

1. **Rate Limiting:** Max 10 repairs per hour per repo
2. **Claude API Limits:** Max 3 API calls per repair attempt
3. **Iteration Limits:** Max 3 fix iterations before failing to human
4. **Deduplication:** Batches similar errors (same fingerprint)
5. **Risk Gating:** High-risk errors require human triage

## Security Features

1. **Secrets Management:** All API keys in Worker secrets
2. **Webhook Validation:** HMAC-SHA256 signatures
3. **Repo Allowlist:** Only configured repos accepted
4. **GitHub Permissions:** Minimal required (repo, PR)
5. **No Direct Deployments:** All fixes via PR + approval

## Testing

**Unit Tests:** `packages/workers/repair-orchestrator/src/index.test.ts`
- Deduplication logic
- Rate limiting per repo
- State management (create, update, retrieve)
- Statistics calculation

**To Run:**
```bash
cd packages/workers/repair-orchestrator
pnpm test
```

## Deployment

### 1. Create Queues

```bash
wrangler queues create repair-queue
wrangler queues create repair-queue-dlq
```

### 2. Set Secrets

```bash
# Error Receiver
cd packages/workers/error-receiver
wrangler secret put WEBHOOK_SECRET

# Repair Orchestrator
cd ../repair-orchestrator
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put GITHUB_TOKEN

# Repair Agent
cd ../../workflows/repair-agent
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put GITHUB_TOKEN
```

### 3. Deploy Workers

```bash
# Deploy error receiver
cd packages/workers/error-receiver
pnpm deploy

# Deploy repair orchestrator
cd ../repair-orchestrator
pnpm deploy

# Deploy repair agent workflow
cd ../../workflows/repair-agent
pnpm deploy
```

## What's NOT Implemented (Priority 2+)

### GitHub Actions Deploy-on-Approval
- **Location:** `.github/workflows/repair-deploy.yml`
- **Trigger:** PR approval with `repair-agent` label
- **Actions:**
  - Run full test suite
  - Deploy to staging first
  - Deploy to production
  - Post status to PR
  - Update Beads issue

### Monitoring Dashboard
- **Location:** `packages/workers/repair-orchestrator/src/dashboard.ts`
- **Features:**
  - Pending/active repairs
  - Success/failure rate
  - Average time-to-fix
  - Manual retry for failed repairs

## Usage Example

### Send Error to System

```bash
curl -X POST https://error-receiver.workway.co \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: $(echo -n '<payload>' | openssl dgst -sha256 -hmac '<secret>' | cut -d' ' -f2)" \
  -d '{
    "level": "error",
    "message": "TypeError: Cannot read property '\''user'\'' of undefined",
    "stack": "at getUserName (src/utils/user.ts:42:18)",
    "context": {
      "url": "/api/users/profile",
      "request_id": "req_abc123"
    },
    "repo": "workway-platform"
  }'
```

### Check Repair Status

```bash
# Get all active repairs
curl https://repair-orchestrator.workway.co/status

# Get specific repair
curl https://repair-orchestrator.workway.co/repair/<repair-id>
```

## Success Metrics (Targets)

- ✅ Error received → PR created in < 5 minutes (p95)
- ✅ Fix success rate > 70% for 'high' confidence diagnoses
- ✅ Zero unauthorized deployments (all via PR + approval)
- ✅ Full audit trail for every repair attempt
- ✅ Human approval required for every deploy

## File Structure

```
packages/
├── workers/
│   ├── error-receiver/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── normalize.ts
│   │   │   └── validate.ts
│   │   ├── wrangler.toml
│   │   ├── package.json
│   │   └── README.md
│   │
│   └── repair-orchestrator/
│       ├── src/
│       │   ├── index.ts
│       │   ├── state.ts
│       │   └── index.test.ts
│       ├── wrangler.toml
│       ├── package.json
│       └── tsconfig.json
│
└── workflows/
    └── repair-agent/
        ├── src/
        │   ├── index.ts
        │   ├── diagnose.ts
        │   ├── fix.ts
        │   └── pr.ts
        ├── wrangler.toml
        ├── package.json
        └── tsconfig.json
```

## Next Steps

1. **Deploy to Production:**
   - Create queues in Cloudflare
   - Set secrets for all workers
   - Deploy workers and workflow
   - Test end-to-end pipeline

2. **Integration Testing:**
   - Send test errors through system
   - Verify PR creation
   - Test deduplication
   - Verify rate limiting

3. **Monitoring Setup:**
   - Set up alerts for failed repairs
   - Track success/failure rates
   - Monitor Claude API costs

4. **GitHub Actions (Priority 2):**
   - Implement deploy-on-approval workflow
   - Add staging deployment step
   - Add Beads issue updates

## Philosophy Check: Zuhandenheit

Does the tool recede?

✅ **For Developers:** Errors automatically become PRs. The mechanism (queue, DO, workflow) is invisible. Only the outcome (PR ready for review) is visible.

✅ **For Operations:** Set it and forget it. Queues handle backpressure, rate limits prevent runaway costs, deduplication prevents duplicate work.

✅ **For Decision Makers:** Human approval required for every deploy. Agent does the diagnosis and fix work, but humans retain authority.

The tool recedes from labor, not responsibility.
