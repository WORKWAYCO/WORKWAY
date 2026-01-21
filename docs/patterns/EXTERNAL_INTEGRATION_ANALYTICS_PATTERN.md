# How to Surface Analytics from External Apps

**Pattern ID:** `external-integration-analytics`  
**Status:** Production  
**Date:** January 21, 2026

---

## The situation

You've built something useful outside the main platform. Maybe it's a standalone app, a quick prototype that stuck, or a tool that grew its own legs. Now users want to see how it's doing—right alongside everything else in their dashboard.

The question: **How do you show analytics from external apps without copying code or duplicating data?**

## What we were up against

When external apps live next to your main platform, a few problems pop up:

- **Users can't see the full picture.** Their metrics are split across different dashboards.
- **Admins are flying blind.** They manage a team but can't see how the team's tools are performing.
- **You're tempted to rebuild.** It feels easier to rewrite analytics in two places—but that's a maintenance headache waiting to happen.
- **The infrastructure doesn't match.** Your external app (maybe on Cloudflare Pages) lacks features the platform needs, like scheduled jobs.

## What we did instead

We added a lightweight helper—a "sidecar" Worker—that fills in the gaps and exposes the data that already exists.

### Here's how it fits together

```
┌─────────────────────────────────────────────────────────────────────┐
│                      WORKWAY DASHBOARD                              │
│                    Asks: "How's this workflow doing?"               │
├─────────────────────────────────────────────────────────────────────┤
│                              │                                      │
│                     GET /analytics?email=                           │
│                              │                                      │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              SIDECAR WORKER                                   │  │
│  │              The helpful middleman                            │  │
│  │                                                               │  │
│  │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │  │
│  │   │   Cron      │    │  Analytics  │    │   Admin     │       │  │
│  │   │  Trigger    │    │    API      │    │    Tools    │       │  │
│  │   └─────────────┘    └─────────────┘    └─────────────┘       │  │
│  │          │                  │                  │              │  │
│  │          └──────────────────┼──────────────────┘              │  │
│  │                             ▼                                 │  │
│  │   ┌─────────────────────────────────────────────────────┐     │  │
│  │   │                SHARED DATABASE                       │     │  │
│  │   │    The source of truth—no duplication needed         │     │  │
│  │   └─────────────────────────────────────────────────────┘     │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│               Triggers the external app hourly                      │
│                              │                                      │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              EXTERNAL APP                                     │  │
│  │              Does the real work—syncing, processing, etc.     │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Four ideas that made this work

### 1. Add what's missing without rebuilding

Cloudflare Pages doesn't run scheduled jobs. Instead of migrating the whole app, we made a tiny Worker that does one thing: wake up the app every hour.

```typescript
// A sidecar that fills in the gaps
export default {
  async scheduled(event, env) {
    // Every hour, give the app a nudge
    await fetch(`${env.APP_URL}/api/cron/auto-sync`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.SECRET}` },
    });
  }
};
```

Why bother with a sidecar?

- The main app stays focused on what users see
- The Worker handles platform-level stuff
- They share the same database—no extra work
- Each can change without breaking the other

### 2. Query what's already there

The external app already tracks every sync job. We just needed to ask the database nicely:

```typescript
async function getAnalytics(email: string, env: Env) {
  // Find the user
  const user = await env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first();

  // Get their recent sync jobs—the data is already there
  const jobs = await env.DB.prepare(`
    SELECT status, progress, started_at, completed_at
    FROM sync_jobs WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 50
  `).bind(user.id).all();

  // Calculate what matters
  const successful = jobs.results.filter(j => j.status === 'completed').length;
  const total = jobs.results.length;
  
  return Response.json({
    workflow: { id: 'fireflies-notion-sync', name: 'Fireflies → Notion Sync' },
    stats: {
      totalRuns: total,
      successfulRuns: successful,
      successRate: Math.round((successful / total) * 100),
    },
  });
}
```

The key insight: your database is already keeping score. Analytics are just a different view.

### 3. Give admins the full picture

When someone manages a team, they want to see how everyone's doing—not just their own stats. We handle this with a simple config:

```typescript
// Easy to add new teams
const ADMIN_CONFIGS = [
  {
    email: 'admin@company.com',
    teamName: 'Engineering',
    managedUsers: ['alice@company.com', 'bob@company.com'],
  },
];

async function getAdminAnalytics(adminEmail, config, env) {
  const teamStats = [];
  
  // Gather each team member's numbers
  for (const userEmail of config.managedUsers) {
    const stats = await getUserStats(userEmail, env);
    teamStats.push(stats);
  }

  // Roll it up into a team view
  return Response.json({
    admin: { email: adminEmail, teamName: config.teamName },
    teamStats: summarize(teamStats),
    users: teamStats, // Individual breakdowns too
  });
}
```

What this gets you:

- Regular users see only their own data
- Admins automatically see their whole team
- Adding a new admin is one line of config

### 4. Make it discoverable

Once your external app has an analytics endpoint, register it in the workflow catalog:

```typescript
// Now it shows up in the marketplace
export const integrationPairs = {
  'fireflies:notion': {
    workflowId: 'fireflies-notion-sync',
    outcome: 'Fireflies meetings that document themselves in Notion',
    analyticsUrl: 'https://your-sidecar.workers.dev/analytics',
    dashboardUrl: 'https://your-external-app.com/dashboard',
  },
};
```

This way, external apps appear right alongside native workflows. Users get one place to see everything.

## What the response looks like

```json
{
  "workflow": {
    "id": "fireflies-notion-sync",
    "name": "Fireflies → Notion Sync"
  },
  "user": {
    "email": "user@example.com",
    "autoSyncEnabled": true,
    "totalSynced": 34
  },
  "stats": {
    "totalRuns": 5,
    "successfulRuns": 4,
    "successRate": 80
  }
}
```

## When this approach makes sense

**Use it when:**

- You have an external app with its own database
- Users want to see those metrics in a central dashboard
- Admins need visibility into their team's usage
- Your app host is missing a feature (like cron)

**Skip it when:**

- The app could just live inside the main platform
- There's no analytics data to surface
- It's a single-user tool (no admin pattern needed)

## What we learned

1. **A sidecar beats a migration.** Adding a small helper is faster and safer than moving an entire app.

2. **Your database already knows.** If you're tracking execution data, analytics are just SQL queries. Don't rebuild tracking.

3. **Configure admins, don't code them.** Store team relationships in a config array. Adding a new admin shouldn't require a code change.

4. **Registry makes discovery.** Once an external app is in the catalog, it's a first-class citizen.

## Where things live

```
Cloudflare/
├── apps/your-external-app/     # The external app (Cloudflare Pages)
├── packages/workers/sidecar/   # The helper Worker
│   └── src/index.ts            # Cron + analytics + admin endpoints
└── packages/workflows/
    └── src/index.ts            # The catalog entry
```

---

*This pattern came out of integrating fn.workway.co analytics into the WORKWAY dashboard—without duplicating any code.*
