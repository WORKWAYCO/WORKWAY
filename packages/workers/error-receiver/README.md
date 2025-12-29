# Error Repair Agent

Autonomous error diagnosis and fix with human-in-loop approval.

## Philosophy

> Agent does the work, human makes the decision.

The tool recedes from labor, not responsibility.

## Architecture

```
Error Sources (Sentry/CloudWatch/Custom)
           ↓
    error-receiver (Worker) ← Fast acknowledgment
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
    Auto-Deploy (GitHub Actions)
```

## Components

### 1. Error Receiver Worker

**Location:** `packages/workers/error-receiver/`

**Purpose:** Fast webhook endpoint that normalizes errors and enqueues them.

**Accepts:**
- Sentry webhooks
- CloudWatch SNS notifications
- Custom error JSON

**Returns:** Within 100ms with queued confirmation.

### 2. Repair Queue

**Queues:**
- `repair-queue`: Main queue for error processing
- `repair-queue-dlq`: Dead letter queue for failed messages

**Configuration:**
- Max batch size: 10
- Max batch timeout: 30s
- Max retries: 3

### 3. Repair Orchestrator (Durable Object)

**Location:** `packages/workers/repair-orchestrator/`

**Purpose:** Single source of truth for repair state.

**Features:**
- Deduplication by fingerprint (1 hour window)
- Rate limiting (max 10 repairs/hour per repo)
- State tracking (pending → diagnosing → fixing → pr_created → deployed)
- Prevents concurrent repairs for same error
- Status endpoint for monitoring

### 4. Repair Agent Workflow

**Location:** `packages/workflows/repair-agent/`

**Purpose:** Claude-powered diagnosis and fix generation.

**Steps:**
1. **Diagnose:** Fetch relevant code + Claude API call
2. **Generate Fix:** Create branch + apply fix + run tests
3. **Create PR:** Push branch + create PR with evidence
4. **Create Beads Issue:** Link to PR for tracking

**Cost Controls:**
- Max 3 Claude API calls per repair attempt
- Max 3 fix iterations before failing to human
- High-risk errors require manual triage

## Setup

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

### 3. Deploy

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

## Usage

### Send Error to Receiver

```bash
curl -X POST https://error-receiver.workway.co \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: <hmac-sha256>" \
  -d '{
    "level": "error",
    "message": "TypeError: Cannot read property of undefined",
    "stack": "...",
    "context": {
      "url": "/api/users",
      "request_id": "abc123"
    },
    "repo": "workway-platform"
  }'
```

### Check Repair Status

```bash
# Get orchestrator status
curl https://repair-orchestrator.workway.co/status

# Get specific repair
curl https://repair-orchestrator.workway.co/repair/<repair-id>
```

### Monitor Repairs

```bash
# Tail error receiver logs
cd packages/workers/error-receiver
pnpm tail

# Tail orchestrator logs
cd ../repair-orchestrator
pnpm tail
```

## Security

- All API keys stored in Worker secrets (never in code)
- GitHub token has minimal required permissions (repo, PR)
- Repo allowlist prevents unauthorized repair attempts
- All fixes must pass CI before deploy is possible
- Human approval required for every deploy

## Cost Controls

- Max 10 repairs per hour per repo
- Max 3 Claude API calls per repair attempt
- Max 3 fix iterations before failing to human
- Daily cost cap via Anthropic API usage limits
- Batch similar errors (same fingerprint) into single repair

## Success Criteria

- Error received → PR created in < 5 minutes (p95)
- Fix success rate > 70% for 'high' confidence diagnoses
- Zero unauthorized deployments
- Full audit trail for every repair attempt
- Human approval required for every deploy

## Future Enhancements

- Learn from approved fixes to improve diagnosis
- Auto-approve low-risk fixes after track record established
- Integration with on-call rotation for high-risk errors
- Proactive error prediction from log patterns
