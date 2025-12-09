# F→N: Cloudflare-Native Migration Plan

> "The tool should recede; the outcome should remain."

## The Transformation

**SyncFlies → F→N**

The name itself embodies Zuhandenheit: `F→N` is the function, the transformation, the outcome. No branding noise. No copyright concern. Just the arrow of intent: Fireflies → Notion.

---

## Philosophical Foundation

### The Outcome Test

**Wrong**: "F→N syncs your Fireflies transcripts to Notion via API"
**Right**: "Your meeting knowledge appears in your Notion database"

The user doesn't want sync. They want their meetings to become searchable, analyzable, *present* in their knowledge system. The sync is invisible — Zuhandenheit.

### Weniger, aber besser

Current SyncFlies dependencies:
- Vercel (hosting, serverless, cron)
- Supabase (database, auth, realtime)
- Cloudflare Workers (background processing)
- Stripe (payments)

F→N dependencies:
- **Cloudflare** (everything)
- **Stripe** (payments — no CF equivalent)

Two vendors. The tool recedes further.

---

## Architecture Migration

### Current → Target

| Component | SyncFlies (Current) | F→N (Target) |
|-----------|---------------------|--------------|
| Frontend | Next.js on Vercel | Cloudflare Pages (Astro/SvelteKit) |
| API | Next.js API Routes | Cloudflare Workers |
| Database | Supabase PostgreSQL | Cloudflare D1 |
| Auth | Supabase Auth | Cloudflare Workers + D1 + KV Sessions |
| Realtime | Supabase Realtime | Durable Objects WebSocket |
| Background Jobs | CF Workers + Workflows | CF Workers + Workflows (keep) |
| Cron | Vercel Cron | CF Workers Cron Triggers |
| File Storage | (none needed) | R2 if needed |
| Sessions | Supabase | KV (SESSIONS namespace exists) |
| Cache | (none) | KV (CACHE namespace exists) |

### What We Keep

The existing Cloudflare Worker (`syncflies-worker`) with its Workflow already handles the heavy lifting. This stays — it's already Cloudflare-native.

---

## D1 Schema Design

```sql
-- F→N Database Schema for Cloudflare D1
-- Following "weniger, aber besser" — only what's necessary

-- Users (minimal, auth handled separately)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_verified INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_email ON users(email);

-- Connected Accounts (OAuth tokens)
CREATE TABLE connected_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'fireflies' | 'notion'
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  workspace_name TEXT,
  workspace_id TEXT,
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, provider),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_connected_accounts_user ON connected_accounts(user_id);

-- Sync Jobs
CREATE TABLE sync_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, queued, running, completed, failed
  database_id TEXT NOT NULL,
  database_name TEXT,
  progress INTEGER DEFAULT 0,
  total_transcripts INTEGER DEFAULT 0,
  selected_transcript_ids TEXT, -- JSON array
  date_field_id TEXT,
  date_range_days INTEGER,
  trigger TEXT DEFAULT 'manual', -- manual, scheduled, webhook
  error_message TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sync_jobs_user ON sync_jobs(user_id);
CREATE INDEX idx_sync_jobs_status ON sync_jobs(status);

-- Synced Transcripts (deduplication)
CREATE TABLE synced_transcripts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  fireflies_transcript_id TEXT NOT NULL,
  notion_page_id TEXT NOT NULL,
  database_id TEXT NOT NULL,
  transcript_title TEXT,
  synced_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, fireflies_transcript_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_synced_transcripts_user ON synced_transcripts(user_id);
CREATE INDEX idx_synced_transcripts_fireflies ON synced_transcripts(fireflies_transcript_id);

-- Subscriptions
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  tier TEXT DEFAULT 'free', -- free, pro, unlimited
  status TEXT DEFAULT 'free', -- free, active, canceled, past_due, trialing
  sync_count INTEGER DEFAULT 0,
  sync_count_reset_at TEXT,
  current_period_start TEXT,
  current_period_end TEXT,
  cancel_at_period_end INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_customer_id);

-- Auto Sync Settings (UNLIMITED tier)
CREATE TABLE auto_sync_settings (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  enabled INTEGER DEFAULT 0,
  frequency TEXT DEFAULT 'daily', -- daily, weekly
  database_id TEXT,
  database_name TEXT,
  date_field_id TEXT,
  date_field_name TEXT,
  next_scheduled_sync TEXT,
  last_sync_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_auto_sync_next ON auto_sync_settings(next_scheduled_sync);

-- Sync Notifications (UNLIMITED tier)
CREATE TABLE sync_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  email_enabled INTEGER DEFAULT 0,
  email_address TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

---

## Authentication Architecture

### No Supabase Auth — Build Minimal

Supabase Auth is convenient but adds a vendor. For F→N, we build minimal auth:

```
┌─────────────────────────────────────────────────────────┐
│                    Auth Flow                             │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Sign Up                                              │
│     └─> Hash password (bcrypt via WebCrypto)            │
│     └─> Store in D1                                      │
│     └─> Send verification email (Resend)                │
│     └─> Create session in KV                            │
│                                                          │
│  2. Sign In                                              │
│     └─> Verify password                                  │
│     └─> Create session token (crypto.randomUUID)        │
│     └─> Store in KV with TTL                            │
│     └─> Set HttpOnly cookie                             │
│                                                          │
│  3. Session Validation                                   │
│     └─> Read cookie                                      │
│     └─> Lookup in KV                                     │
│     └─> Return user_id or 401                           │
│                                                          │
│  4. Sign Out                                             │
│     └─> Delete from KV                                   │
│     └─> Clear cookie                                     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Session Storage (KV)

```typescript
// Session structure in KV
// Key: session:{token}
// Value: { userId: string, createdAt: number, expiresAt: number }
// TTL: 7 days (604800 seconds)

interface Session {
  userId: string;
  email: string;
  createdAt: number;
  expiresAt: number;
}
```

---

## Real-time Progress: Durable Objects

Supabase Realtime is replaced with Durable Objects for sync progress:

```typescript
// SyncProgressDO - Handles real-time sync updates
export class SyncProgressDO implements DurableObject {
  private sessions: Map<WebSocket, string> = new Map();
  private state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/ws') {
      // WebSocket upgrade for real-time updates
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.state.acceptWebSocket(server);
      this.sessions.set(server, url.searchParams.get('jobId') || '');

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === '/progress' && request.method === 'POST') {
      // Worker calls this to broadcast progress
      const { jobId, progress, total, status } = await request.json();

      this.broadcast(jobId, { progress, total, status });

      return new Response('ok');
    }

    return new Response('Not found', { status: 404 });
  }

  private broadcast(jobId: string, data: object) {
    for (const [ws, subscribedJobId] of this.sessions) {
      if (subscribedJobId === jobId) {
        ws.send(JSON.stringify(data));
      }
    }
  }

  webSocketClose(ws: WebSocket) {
    this.sessions.delete(ws);
  }
}
```

---

## Worker Architecture

### Single Worker, Multiple Routes

```typescript
// f-n-api worker
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // CORS
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    // Route matching
    const routes: Record<string, Handler> = {
      // Auth
      'POST /auth/signup': handleSignup,
      'POST /auth/signin': handleSignin,
      'POST /auth/signout': handleSignout,
      'GET /auth/verify': handleVerifyEmail,
      'POST /auth/reset-password': handleResetPassword,

      // Integrations
      'POST /integrations/fireflies/connect': handleFirefliesConnect,
      'POST /integrations/fireflies/disconnect': handleFirefliesDisconnect,
      'GET /integrations/notion/connect': handleNotionOAuthStart,
      'GET /integrations/notion/callback': handleNotionCallback,
      'POST /integrations/notion/disconnect': handleNotionDisconnect,

      // Sync
      'POST /sync': handleStartSync,
      'GET /sync/:id': handleGetSyncStatus,
      'GET /sync/history': handleGetSyncHistory,
      'POST /sync/resync': handleResync,

      // Transcripts
      'GET /transcripts/available': handleGetAvailableTranscripts,

      // Notion
      'GET /notion/databases': handleGetDatabases,
      'GET /notion/database/:id/fields': handleGetDatabaseFields,

      // Subscription
      'GET /subscription': handleGetSubscription,
      'POST /stripe/checkout': handleCreateCheckout,
      'POST /stripe/portal': handleCreatePortal,
      'POST /stripe/webhook': handleStripeWebhook,

      // Auto-sync settings
      'GET /auto-sync': handleGetAutoSyncSettings,
      'PUT /auto-sync': handleUpdateAutoSyncSettings,

      // Stats
      'GET /stats': handleGetStats,
    };

    return routeRequest(request, routes, env, ctx);
  },

  // Cron trigger for scheduled syncs
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(processScheduledSyncs(env));
  },
};

// Durable Object export
export { SyncProgressDO } from './durable-objects/sync-progress';

// Workflow export (existing)
export { SyncWorkflow } from './workflows/sync-workflow';
```

### Wrangler Configuration

```toml
name = "f-n-api"
main = "src/index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "f-n-production"
database_id = "TO_BE_CREATED"

# KV Namespaces
[[kv_namespaces]]
binding = "SESSIONS"
id = "973b18397c4d4b068313152a642f1ad5"  # Existing SESSIONS namespace

[[kv_namespaces]]
binding = "CACHE"
id = "bcb39a6258fe49b79da9dc9b09440934"  # Existing CACHE namespace

# Durable Objects
[[durable_objects.bindings]]
name = "SYNC_PROGRESS"
class_name = "SyncProgressDO"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["SyncProgressDO"]

# Workflows
[[workflows]]
binding = "SYNC_WORKFLOW"
name = "f-n-sync-workflow"
class_name = "SyncWorkflow"

# Cron Triggers
[triggers]
crons = ["0 */6 * * *"]  # Every 6 hours

# Environment Variables (secrets set via wrangler secret)
[vars]
ENVIRONMENT = "production"
```

---

## Frontend: Astro on Cloudflare Pages

### Why Astro?

- **Islands architecture**: JavaScript only where needed (Zuhandenheit)
- **Cloudflare Pages adapter**: First-class support
- **Content-first**: Landing pages are mostly static
- **Minimal JS**: Dashboard uses targeted interactivity

### Structure

```
apps/f-n-web/
├── src/
│   ├── pages/
│   │   ├── index.astro          # Landing page (static)
│   │   ├── pricing.astro        # Pricing page (static)
│   │   ├── about.astro          # About page (static)
│   │   ├── auth/
│   │   │   ├── login.astro
│   │   │   ├── signup.astro
│   │   │   └── reset.astro
│   │   └── dashboard/
│   │       ├── index.astro      # Main sync UI (island)
│   │       ├── history.astro    # Sync history
│   │       └── settings.astro   # Settings & billing
│   ├── components/
│   │   ├── SyncInterface.tsx    # React island for sync UI
│   │   ├── ProgressBar.tsx      # Real-time progress
│   │   └── TranscriptSelector.tsx
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   └── DashboardLayout.astro
│   └── styles/
│       └── global.css           # Tailwind
├── astro.config.mjs
└── package.json
```

### Astro Config

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  integrations: [
    react(),  // For interactive islands
    tailwind(),
  ],
});
```

---

## Migration Strategy

### Phase 1: Database Migration

1. Create D1 database: `f-n-production`
2. Run schema migrations
3. Write migration script to export Supabase → D1
4. Validate data integrity

### Phase 2: Auth Migration

1. Implement Workers auth handlers
2. Set up KV session management
3. Test auth flows locally
4. Migrate user passwords (already hashed, compatible)

### Phase 3: API Migration

1. Port each API route to Workers
2. Update Fireflies/Notion clients for Workers runtime
3. Integrate Durable Objects for real-time
4. Test all endpoints

### Phase 4: Frontend Migration

1. Set up Astro project
2. Port landing pages (mostly copy)
3. Port dashboard with React islands
4. Connect to new API

### Phase 5: Cutover

1. DNS switch: `f-n.workway.co` → Cloudflare Pages
2. API: `api.f-n.workway.co` → Workers
3. Monitor for issues
4. Decommission Vercel + Supabase

---

## Naming & Branding

### Domain
- **Product URL**: `f-n.workway.co` or `fn.workway.co`
- **API URL**: `api.f-n.workway.co`

### Visual Identity

The arrow `→` is the brand:
- Logo: `F→N` in monospace
- Favicon: Arrow icon
- Colors: Inherit WORKWAY/CREATE SOMETHING palette

### Copy Alignment

Before (SyncFlies):
> "Sync your Fireflies transcripts to Notion databases"

After (F→N):
> "Your meetings, in your Notion database"

The tool recedes. The outcome remains.

---

## Cost Analysis

### Current (SyncFlies)

| Service | Cost |
|---------|------|
| Vercel Pro | $20/mo |
| Supabase Pro | $25/mo |
| Cloudflare Workers | ~$5/mo |
| **Total** | **~$50/mo** |

### Target (F→N)

| Service | Cost |
|---------|------|
| Cloudflare Workers Paid | $5/mo base |
| D1 | Included (10GB free) |
| KV | Included |
| Pages | Free |
| **Total** | **~$5-10/mo** |

**80-90% infrastructure cost reduction.**

---

## Timeline

Not providing time estimates — just the sequence:

1. **D1 setup & schema** → Foundation
2. **Auth system** → Unblocks everything
3. **Core API routes** → Sync functionality
4. **Durable Objects** → Real-time progress
5. **Frontend port** → User-facing
6. **Testing & validation** → Confidence
7. **Cutover** → Launch F→N

---

## Open Questions

1. **SvelteKit vs Astro?** — Astro recommended for content-heavy landing + React islands for dashboard. SvelteKit if you prefer unified framework.

2. **Keep existing syncflies-worker?** — Yes, rename to `f-n-sync-workflow`. The workflow logic is solid.

3. **Supabase data export** — Need to write migration script. ~1000 users? Straightforward.

4. **Email provider** — Keep Resend for transactional emails (CF doesn't have equivalent).

---

## The Canon Check

Before committing to this migration:

- [x] **Zuhandenheit**: Does the tool recede further? *Yes — fewer vendors, simpler architecture*
- [x] **Weniger, aber besser**: Can anything be removed? *Removed Vercel, Supabase*
- [x] **The Outcome Test**: Can we describe without technology? *"Your meetings in your Notion database"*
- [x] **Honest design**: No fake complexity, no over-engineering
- [x] **Long-lasting**: Cloudflare is stable infrastructure, not a startup

**F→N passes the canon.**
