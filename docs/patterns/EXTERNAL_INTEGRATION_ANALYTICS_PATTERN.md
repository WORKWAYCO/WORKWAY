# Pattern: External Integration Analytics

**Pattern ID:** `external-integration-analytics`
**Category:** Platform Integration
**Status:** Production
**Date:** January 21, 2026

---

## Context

WORKWAY has "internal" workflows (SDK-based, executed via Durable Objects) and "external" integrations (standalone apps like `fn.workway.co`) that provide value but live outside the core platform.

The challenge: **How do we surface analytics from external integrations into the WORKWAY dashboard without duplicating code or data?**

## Problem

When external apps exist alongside the core platform:
- **Siloed analytics** - Users can't see external app metrics in WORKWAY dashboard
- **Admin blind spots** - Team admins can't monitor their users' external integrations
- **Code duplication** - Temptation to rebuild analytics in two places
- **Infrastructure mismatch** - External app (Pages) lacks features the platform needs (cron)

## Solution: Sidecar Worker + Analytics API

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      WORKWAY DASHBOARD                              │
│                    (workway-platform/apps/web)                      │
├─────────────────────────────────────────────────────────────────────┤
│                              │                                      │
│                     GET /analytics?email=                           │
│                              │                                      │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────┐      │
│  │              SIDECAR WORKER (fn-cron)                     │      │
│  │                                                           │      │
│  │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │      │
│  │   │   Cron      │    │  Analytics  │    │  Bulk Ops   │   │      │
│  │   │  Trigger    │    │    API      │    │   (admin)   │   │      │
│  │   └─────────────┘    └─────────────┘    └─────────────┘   │      │
│  │          │                  │                  │          │      │
│  │          ▼                  ▼                  ▼          │      │
│  │   ┌─────────────────────────────────────────────────┐     │      │
│  │   │                D1 DATABASE                       │     │      │
│  │   │    sync_jobs │ synced_transcripts │ users        │     │      │
│  │   └─────────────────────────────────────────────────┘     │      │
│  └───────────────────────────────────────────────────────────┘      │
│                              │                                      │
│               POST /api/cron/auto-sync                              │
│                              │                                      │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────┐      │
│  │              EXTERNAL APP (fn.workway.co)                 │      │
│  │              Cloudflare Pages - No native cron            │      │
│  │                                                           │      │
│  │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │      │
│  │   │   User UI   │    │  Auto-Sync  │    │   Manual    │   │      │
│  │   │  Dashboard  │    │   Endpoint  │    │    Sync     │   │      │
│  │   └─────────────┘    └─────────────┘    └─────────────┘   │      │
│  └───────────────────────────────────────────────────────────┘      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Principles

#### 1. Sidecar Worker for Missing Infrastructure

Cloudflare Pages doesn't support cron triggers. Instead of migrating the entire app, create a lightweight Worker that provides the missing capability:

```typescript
// packages/workers/fn-cron/src/index.ts

export default {
  // Hourly cron trigger
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    await fetch(`${env.FN_URL}/api/cron/auto-sync`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.CRON_SECRET}` },
    });
  },

  // Additional endpoints: analytics, bulk-ops, admin functions
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    // ...
  }
};
```

**Why a sidecar?**
- Pages app stays focused on user experience
- Worker adds platform-level capabilities
- Shared D1 database = no data duplication
- Can evolve independently

#### 2. DRY Analytics: Query Existing Data

The external app already stores execution data (sync_jobs, synced_transcripts). The analytics API simply queries and formats it:

```typescript
// DON'T duplicate tracking logic
// DO query existing tables

async function getAnalytics(email: string, env: Env): Promise<Response> {
  // Find user
  const user = await env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first();

  // Query existing sync_jobs table
  const jobs = await env.DB.prepare(`
    SELECT status, progress, started_at, completed_at
    FROM sync_jobs WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 50
  `).bind(user.id).all();

  // Compute stats from existing data
  const successfulRuns = jobs.results.filter(j => j.status === 'completed').length;
  
  return Response.json({
    workflow: { id: 'fireflies-notion-sync', name: 'Fireflies → Notion Sync' },
    stats: {
      totalRuns: jobs.results.length,
      successfulRuns,
      successRate: Math.round((successfulRuns / jobs.results.length) * 100),
    },
    executions: jobs.results,
  });
}
```

**Key insight:** The external app's database IS the source of truth. Analytics are just a different view of the same data.

#### 3. Admin Team Analytics Pattern

Admins need to see metrics for all users they manage. This is a common B2B pattern:

```typescript
// Admin configuration - easily extensible
const ADMIN_CONFIGS: AdminConfig[] = [
  {
    email: 'admin@company.com',
    teamName: 'Engineering',
    managedUsers: ['alice@company.com', 'bob@company.com'],
  },
];

async function getAdminAnalytics(adminEmail: string, config: AdminConfig, env: Env) {
  const teamUsers = [];
  let totalTeamSynced = 0;
  let totalTeamRuns = 0;

  // Aggregate metrics for each managed user
  for (const userEmail of config.managedUsers) {
    const userStats = await getUserStats(userEmail, env);
    teamUsers.push(userStats);
    totalTeamSynced += userStats.totalSynced;
    totalTeamRuns += userStats.stats.totalRuns;
  }

  return Response.json({
    admin: { email: adminEmail, teamName: config.teamName },
    teamStats: {
      totalUsers: teamUsers.length,
      totalTranscriptsSynced: totalTeamSynced,
      totalRuns: totalTeamRuns,
      // ... aggregated stats
    },
    users: teamUsers, // Individual breakdowns
  });
}
```

**Pattern benefits:**
- Zero-config for regular users (just their own data)
- Admin users automatically get team view
- Config-driven: add new admins without code changes

#### 4. Register in Workflow Registry

The external app appears in WORKWAY's workflow catalog:

```typescript
// packages/workflows/src/index.ts

export const integrationPairs: Record<string, IntegrationPairConfig> = {
  // ... internal workflows ...

  // External integration with analytics pointer
  'fireflies:notion': {
    workflowId: 'fireflies-notion-sync',
    outcome: 'Fireflies meetings that document themselves in Notion',
    outcomeFrame: 'after_meetings',
    experimental: true,
    requiresCustomInfrastructure: true,
    analyticsUrl: 'https://fn-cron.half-dozen.workers.dev/analytics',
    dashboardUrl: 'https://fn.workway.co/dashboard',
  },
};
```

**Why this matters:**
- External apps show up in WORKWAY marketplace
- Dashboard can fetch analytics from `analyticsUrl`
- Users see unified view of all their workflows

## Implementation: Fireflies → Notion

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| External App | `apps/f-n-web/` | User UI, manual sync, settings |
| Sidecar Worker | `packages/workers/fn-cron/` | Cron trigger, analytics API, admin ops |
| Workflow Registry | `packages/workflows/src/index.ts` | Catalog entry |
| D1 Database | `f-n-production` | Shared data layer |

### Database Schema (leveraged for analytics)

```sql
-- sync_jobs: Track every execution
CREATE TABLE sync_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL,        -- 'pending', 'running', 'completed', 'failed'
  trigger_type TEXT,           -- 'manual', 'auto', 'bulk'
  progress INTEGER DEFAULT 0,  -- transcripts synced
  total_transcripts INTEGER,
  error_message TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- synced_transcripts: Deduplication + count
CREATE TABLE synced_transcripts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  fireflies_transcript_id TEXT NOT NULL,
  notion_page_id TEXT,
  synced_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Analytics Response Format

```json
{
  "workflow": {
    "id": "fireflies-notion-sync",
    "name": "Fireflies → Notion Sync",
    "description": "Automatically sync Fireflies meeting transcripts to Notion"
  },
  "user": {
    "email": "user@example.com",
    "autoSyncEnabled": true,
    "lastAutoSyncAt": "2026-01-20T15:01:34Z",
    "totalSynced": 34
  },
  "stats": {
    "totalRuns": 5,
    "successfulRuns": 4,
    "failedRuns": 1,
    "successRate": 80,
    "avgExecutionTimeMs": 12500,
    "lastRunAt": "2026-01-20T15:01:02Z"
  },
  "executions": [
    {
      "id": "job_abc123",
      "status": "completed",
      "triggerType": "auto",
      "transcriptsSynced": 3,
      "startedAt": "2026-01-20T15:00:00Z",
      "completedAt": "2026-01-20T15:01:34Z"
    }
  ]
}
```

## Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Dashboard visibility | None | Full analytics | ∞ |
| Code duplication | Risk | Zero | DRY maintained |
| Admin visibility | None | Team-wide | B2B ready |
| Infrastructure added | Pages limitation | Cron + API | Capability gap filled |

## Pattern Applicability

**Use this pattern when:**
- External app exists with its own database
- Need to surface analytics in central dashboard
- Admin users need team-level visibility
- Platform feature (cron) is missing from external app host

**Don't use when:**
- App can be fully integrated into core platform
- No analytics data exists to surface
- Single-user product (no admin pattern needed)

## Learnings

1. **Sidecar > Migration**: Adding a Worker to provide missing capabilities is faster and safer than migrating an entire app.

2. **Database is the API**: When the external app already tracks execution data, analytics are just SQL queries. Don't rebuild tracking.

3. **Admin config, not admin code**: Store admin relationships in a config array, not code branches. Easy to extend.

4. **Registry enables discovery**: Adding external apps to the workflow registry makes them first-class citizens in the dashboard.

## Files Reference

```
Cloudflare/
├── apps/f-n-web/           # External app (Cloudflare Pages)
│   └── src/
│       └── routes/api/
│           └── cron/auto-sync/+server.ts
├── packages/workers/fn-cron/  # Sidecar worker
│   ├── src/index.ts        # Cron + analytics + admin endpoints
│   └── wrangler.toml       # D1 binding + cron schedule
└── packages/workflows/
    └── src/index.ts        # integrationPairs registry
```

---

*Pattern documented as part of WORKWAY platform integration work.*
*Experiment: Surfacing fn.workway.co analytics into WORKWAY dashboard.*
*Date: January 21, 2026*
