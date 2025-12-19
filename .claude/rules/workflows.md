# Workflow Patterns

## Developer Capabilities

**The Honest Truth**: Workflows are TypeScript-based, but with Cloudflare Workers runtime constraints.

### What Developers CAN Do

Inside `defineWorkflow()`, developers have significant flexibility:

| Capability | Works | Example |
|------------|-------|---------|
| `fetch()` | Yes | Call any HTTP API directly |
| Custom helpers | Yes | Define functions at module level |
| Workers AI | Yes | `integrations.ai.generateText()` |
| Persistent storage | Yes | `context.storage.get/put()` |
| Standard JS APIs | Yes | Array, Date, JSON, RegExp, Map, Set |
| Complex control flow | Yes | if/else, loops, try/catch |

### What Developers CANNOT Do

The constraint is the **runtime** (Cloudflare Workers V8 isolate), not the language:

| Blocked | Reason |
|---------|--------|
| Node.js stdlib | `fs`, `child_process`, `os` not available |
| Most npm packages | Only Workers-compatible packages work |
| Escape `defineWorkflow()` | Required structure for execution |
| Long-running processes | Workers have execution time limits |

### The Escape Hatch

For APIs without pre-built integrations, use `fetch()` directly:

```typescript
export default defineWorkflow({
  async execute({ config }) {
    const response = await fetch('https://api.custom-service.com/data', {
      headers: { 'Authorization': `Bearer ${config.apiKey}` }
    });
    return await response.json();
  }
});
```

## Private Workflows

Private workflows are organization-specific workflows that require WORKWAY authentication.

### Unified Workflows Page

All workflows (public marketplace + private organization) appear at:
```
workway.co/workflows
```

This follows Zuhandenheit - users see their workflows in one place, not scattered across separate dashboards.

### Private Workflow Structure

```typescript
export const metadata = {
  id: 'my-workflow',
  visibility: 'private' as const,
  accessGrants: [
    { type: 'email_domain' as const, value: 'example.com' },
  ],
  analyticsUrl: 'https://workway.co/workflows/private/my-workflow/analytics',
  setupUrl: 'https://example-worker.workway.co/setup',
};
```

### Agency Strategic Pattern

Private workflows enable the **agency-as-moat** pattern:

1. Agency builds private workflow for enterprise client
2. Client pays (agency earns implementation fee, WORKWAY earns per-execution)
3. Agency recognizes pattern across clients → generalizes to marketplace
4. Agency earns from all future marketplace installs

This creates double Zuhandenheit: WORKWAY recedes for agencies, agencies recede for enterprises.

See [AGENCY_MOAT.md](../../docs/AGENCY_MOAT.md) for the full strategic analysis of agencies as platform multipliers.

### URL Patterns

| Purpose | URL Pattern |
|---------|-------------|
| All Workflows | `workway.co/workflows` |
| Private Workflow Analytics | `workway.co/workflows/private/{workflow-id}/analytics` |
| Worker Setup | `{worker-domain}.workway.co/setup/{user-id}` |
| Worker Data API | `{worker-domain}.workway.co/dashboard-data/{user-id}` |

### Anti-Pattern: Separate Dashboards

**Don't** create separate dashboard UIs for each workflow. Instead:
- Analytics live at `workway.co/workflows/private/{workflow-id}/analytics`
- Worker endpoints provide data APIs only (no HTML)
- All UI is in the unified `workway.co/workflows` page
