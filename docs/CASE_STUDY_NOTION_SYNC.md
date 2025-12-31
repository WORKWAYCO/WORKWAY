# Case Study: Notion Two-Way Sync

```
STATUS: Production
SYNC LATENCY: <2s per record
CONFLICT RESOLUTION: Last-write-wins with audit log
LIMITATIONS: Notion API rate limits (3 req/s)
```

## The Problem

Notion users need bidirectional sync with external databases. Native integrations and automation platforms offer one-way sync only.

| Platform | Direction | Limitation |
|----------|-----------|------------|
| Zapier | One-way | Cannot detect Notion changes reliably |
| Make | One-way | Same limitation |
| Native integrations | One-way | Notion → external only |
| WORKWAY | **Bidirectional** | Stateful sync with conflict handling |

## Why One-Way Fails

One-way sync creates data drift. Teams maintain two sources of truth—neither accurate.

**Measured impact** (from Half Dozen client work):
- 4.2 hours/week spent manually reconciling Notion ↔ Airtable
- 23% of records had sync discrepancies after 30 days
- 3 missed deadlines traced to stale data in secondary system

## The Solution

TypeScript workflow with state tracking. Changes in either system propagate to the other.

```
Notion record updated
       ↓
Webhook triggers workflow
       ↓
Compare with last-known state (stored in D1)
       ↓
Detect conflicts → resolve via last-write-wins
       ↓
Update external system
       ↓
Store new state
       ↓
(Reverse flow for external → Notion)
```

## Technical Implementation

**State storage**: Cloudflare D1 (SQLite at edge)
**Sync trigger**: Webhooks from both systems
**Conflict resolution**: Timestamp comparison with 5-second grace period
**Audit trail**: All sync events logged with before/after values

### What WORKWAY Handles

- OAuth token refresh (automatic)
- Webhook endpoint provisioning
- State persistence across executions
- Rate limit management (queuing when throttled)

### What You Configure

- Field mappings (Notion property → external field)
- Conflict resolution strategy (last-write-wins, Notion-wins, external-wins)
- Sync frequency for full reconciliation (hourly, daily)

## Results

Measured on production deployment (60-day period):

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Manual reconciliation time | 4.2 hrs/week | 0.3 hrs/week | -93% |
| Sync discrepancies (30-day) | 23% | 0.4% | -98% |
| Data staleness (avg) | 4.1 hours | 1.8 seconds | -99.98% |

## Limitations

**Notion API rate limits**: 3 requests/second. Bulk updates queue and process over time. A 1,000-record initial sync takes ~6 minutes.

**Webhook reliability**: Notion webhooks occasionally miss events. Full reconciliation runs (configurable) catch drift.

**Complex relations**: Linked databases sync as IDs, not resolved values. Deep nesting requires additional workflow steps.

**Schema changes**: Adding/removing Notion properties requires workflow update. No automatic schema detection yet.

## Pricing

| Component | Cost |
|-----------|------|
| Workflow (one-time) | $49 |
| Per sync execution | $0.001 |
| Estimated monthly (1,000 syncs/day) | $49 + $30 = $79 |

Compare: Manual reconciliation at $50/hour × 4.2 hours/week = $840/month.

## Who This Is For

- Teams using Notion as primary workspace with external data dependencies
- Agencies managing client data across Notion and Airtable/Sheets
- Operations teams tired of manual copy-paste between systems

## Who This Is Not For

- Simple one-way automations (Zapier works fine)
- Real-time sync requirements under 1 second (use direct database replication)
- Non-technical teams needing visual configuration (this is TypeScript)

## Try It

```bash
npx @workwayco/cli install notion-two-way-sync
```

Or view on marketplace: [workway.co/workflows/notion-two-way-sync](https://workway.co/workflows/notion-two-way-sync)

---

**Built by**: Half Dozen
**Production since**: 2024
**Last updated**: 2025-12-31
