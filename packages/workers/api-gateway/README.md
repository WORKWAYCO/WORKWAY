# WORKWAY API Gateway

Public API for triggering WORKWAY workflows from external consumers.

## Endpoints

### `POST /workflows/{workflowId}/trigger`

Execute a workflow.

**Headers:**
- `Authorization: Bearer {API_KEY}` - Required
- `Content-Type: application/json`
- `Idempotency-Key: {key}` - Optional, prevents duplicate executions
- `X-Organization-ID: {orgId}` - Optional, for org-scoped access

**Body:**
```json
{
  "event": "spec.submitted",
  "data": {
    "user_spec": "I need a dental practice website...",
    "llm_context_url": "https://example.com/api/llm-context",
    "system_prompt": "You are...",
    "routing_rules": "{...}"
  },
  "timestamp": "2026-01-14T..."
}
```

**Response (200):**
```json
{
  "success": true,
  "executionId": "uuid",
  "message": "Workflow executed successfully",
  "understanding": "...",
  "confidence": 0.85,
  "action": "show_template",
  "matched_template": "dental-practice"
}
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-14T...",
  "version": "1.0.0"
}
```

## Setup

### 1. Create KV Namespaces

```bash
wrangler kv:namespace create API_KEYS
wrangler kv:namespace create IDEMPOTENCY
wrangler kv:namespace create WORKFLOW_STORAGE
```

Update `wrangler.toml` with the returned IDs.

### 2. Add API Keys

```bash
# Add an API key
wrangler kv:key put --namespace-id={API_KEYS_ID} "your-api-key-here" '{"orgId":"org-123","name":"CREATE SOMETHING Agency","created":"2026-01-14","enabled":true}'
```

### 3. Deploy

```bash
pnpm deploy
```

### 4. Configure DNS

Point `api.workway.co` to the worker using Cloudflare DNS.

## Development

```bash
# Run locally
pnpm dev

# Tail logs
pnpm tail
```

## Available Workflows

| Workflow ID | Description |
|-------------|-------------|
| `conversational-intake-agent` | AI-powered spec routing for intake forms |

## Consumers

- **CREATE SOMETHING `.agency`** - Spec intake
- **CLEARWAY** - Booking workflows
