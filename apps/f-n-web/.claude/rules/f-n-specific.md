# F→N Specific Rules

## Product Context

F→N syncs Fireflies transcripts to Notion **databases** (not pages). This is the differentiator.

- **Wrong**: "Sync Fireflies to Notion"
- **Right**: "Sync Fireflies transcripts to Notion databases"

## Tech Stack

- **Framework**: SvelteKit 2 + Svelte 5 (runes)
- **Adapter**: `@sveltejs/adapter-cloudflare` (Cloudflare Pages)
- **Database**: Cloudflare D1 (SQLite)
- **Sessions**: Cloudflare KV (`SESSIONS` namespace)
- **Styling**: Tailwind CSS + CSS custom properties

## CSS Token Pattern

Dashboard uses `--brand-*` tokens aliased in `app.css`:

```css
:root {
  --brand-bg: var(--color-bg-pure);
  --brand-surface: var(--color-bg-surface);
  --brand-surface-elevated: var(--color-bg-elevated);
  --brand-border: var(--color-border-default);
  --brand-radius: var(--radius-md);
  --brand-text: var(--color-fg-primary);
  --brand-text-muted: var(--color-fg-muted);
  --brand-primary: var(--color-fg-primary);
  --brand-accent: var(--color-fg-primary);
  --brand-success: var(--color-success);
  --brand-error: var(--color-error);
}
```

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Landing page |
| `/pricing` | Pricing tiers |
| `/auth/login` | Login form |
| `/auth/signup` | Signup form |
| `/auth/signout` | Session destruction |
| `/dashboard` | Main sync interface |
| `/dashboard/history` | Sync job history |
| `/dashboard/settings` | Account & connection settings |

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/integrations/fireflies/connect` | POST | Validate & store Fireflies API key |
| `/api/integrations/fireflies/disconnect` | POST | Remove Fireflies connection |
| `/api/integrations/notion/connect` | GET | Redirect to Notion OAuth |
| `/api/integrations/notion/callback` | GET | Handle Notion OAuth callback |
| `/api/integrations/notion/disconnect` | POST | Remove Notion connection |
| `/api/notion/databases` | GET | List user's Notion databases |
| `/api/transcripts` | GET | List Fireflies transcripts |
| `/api/sync` | POST/GET | Start sync / poll status |

## Zuhandenheit Pattern

The dashboard implements tool recession:
- Connection cards **disappear** when both services connected
- User sees only: select database → select transcripts → sync
- Progress polling is invisible (1s intervals)
- Upon completion, interface resets for next sync

```typescript
const bothConnected = $derived(data.connections.fireflies && data.connections.notion);

{#if !bothConnected}
  <!-- Show connection UI -->
{/if}
```

## Pricing Tiers

| Tier | Price | Syncs/month |
|------|-------|-------------|
| Free | $0 | 5 |
| Pro | $5 | 100 |
| Unlimited | $15 | ∞ |

## Deploy Command

```bash
cd apps/f-n-web
pnpm run build && pnpm exec wrangler pages deploy .svelte-kit/cloudflare
```
