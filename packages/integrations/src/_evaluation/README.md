# Composio Technical Evaluation

**Status**: Phase 1 — Workers Compatibility Gate

## Context

Evaluating [Composio](https://composio.dev) as invisible plumbing for commodity CRUD integrations (Slack notifications, HubSpot leads, Jira tickets). Deep MCPs (QuickBooks, Notion substrate, scheduling) stay custom-built.

The gating question: Does `composio-core` run in Cloudflare Workers?

## Quick Start

```bash
# 1. Install composio-core in the integrations package
cd Cloudflare/packages/integrations
pnpm add composio-core

# 2. Set your API key
cd src/_evaluation
wrangler secret put COMPOSIO_API_KEY

# 3. Run the compatibility test
wrangler dev

# 4. Test endpoints
curl http://localhost:8787/sdk      # SDK tests
curl http://localhost:8787/http-api  # HTTP API fallback tests  
curl http://localhost:8787/benchmark # Latency benchmarks
curl http://localhost:8787/all       # All tests
```

## Test Results

### Phase 1: Workers Compatibility (Days 1-2)

| Test | Status | Notes |
|------|--------|-------|
| SDK import (`CloudflareToolSet`) | Pending | Composio has official Workers support |
| SDK tool fetching | Pending | |
| SDK use-case filtering | Pending | |
| HTTP API fallback | Pending | Guaranteed to work (pure `fetch()`) |
| Latency: SDK vs HTTP API | Pending | Threshold: < 2x overhead |
| Bundle size | Pending | Limit: 10MB compressed |

### Phase 2: Adapter Pattern (Days 2-3)

| Test | Status | Notes |
|------|--------|-------|
| `ComposioAdapter` extends `BaseAPIClient` | Done | Created |
| Returns `ActionResult<T>` | Done | Full contract compliance |
| Error handling via `createErrorHandler` | Done | Consistent with other integrations |
| Typed wrappers (Slack, HubSpot, Jira) | Done | Created |
| Unit tests pass | Pending | Run `pnpm test` |

### Phase 3: OAuth Flow (Days 3-4)

| Test | Status | Notes |
|------|--------|-------|
| Slack OAuth via Composio | Pending | |
| HubSpot OAuth via Composio | Pending | |
| Jira OAuth via Composio | Pending | |
| Token refresh reliability | Pending | |
| White-label support | Pending | |

### Phase 4: Quality Assessment (Days 4-5)

| Test | Status | Notes |
|------|--------|-------|
| Tool definition quality (Slack) | Pending | |
| Tool definition quality (HubSpot) | Pending | |
| Tool definition quality (Jira) | Pending | |
| Latency benchmarks (3 services) | Pending | |
| MCP primitive coverage gaps | Pending | |

### Phase 5: Decision Gate (Days 5-6)

| Criterion | Pass/Fail | Notes |
|-----------|-----------|-------|
| Workers compatible | Pending | |
| Latency acceptable (< 2x) | Pending | |
| OAuth quality | Pending | |
| Tool depth sufficient | Pending | |
| Cost viable (< $100/mo) | Pending | |
| ActionResult compatible | Pending | |
| Swap-out clean | Pending | |

## Architecture

```
Client MCP Request
  → CREATE SOMETHING MCP Server (Workers)
    → Intelligence Layer (Skills, Agents, Three-Tier)
      → Integration Router
        ├── depth needed → Custom BaseAPIClient → External API
        └── commodity CRUD → ComposioAdapter → Composio API → External API
```

## Key Files

| File | Purpose |
|------|---------|
| `_evaluation/composio-compat.ts` | Workers compatibility test Worker |
| `_evaluation/wrangler.toml` | Worker config for test |
| `composio/adapter.ts` | ComposioAdapter (extends BaseAPIClient) |
| `composio/adapter.test.ts` | Adapter unit tests |
| `composio/slack.ts` | Typed Slack wrapper |
| `composio/hubspot.ts` | Typed HubSpot wrapper |
| `composio/jira.ts` | Typed Jira wrapper |

## Decision Criteria

- **Adopt**: All criteria pass → Add "Standard Integration" tier to .agency
- **Partial adopt**: SDK fails but HTTP API works → Use for non-latency-critical only
- **Reject**: Multiple criteria fail → Stay fully custom

## What Composio Cannot Replace

- QuickBooks GL mapping + Notion sync (deep domain logic)
- Schedule MCP with conflict detection (workflow orchestration)
- Substrate (agent-native data layer)
- Three-Tier classification (framework IP)
- Intelligence Layer Skills + Agents (the margin)
- Custom .agency client workflows (domain expertise)
