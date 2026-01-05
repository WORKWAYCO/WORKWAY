# WORKWAY Development Guide

This project is governed by CREATE SOMETHING's design canon, rooted in Heideggerian philosophy and Dieter Rams' principles.

## Core Philosophy: Zuhandenheit (Ready-to-hand)

**The tool should recede; the outcome should remain.**

When building WORKWAY integrations and workflows:
- Users don't want "workflow automation" - they want **outcomes** (meetings that follow up on themselves, CRMs that update themselves)
- The tool should be invisible during use - it only becomes visible when it breaks (Vorhandenheit)
- Every feature should ask: "Does this help the tool recede further?"

### The Outcome Test

> "Map your next project by what disappears from your to-do list, not what gets added to your tech stack."

Two ways to describe a workflow:
- **Wrong**: "It syncs my CRM with my email via REST API."
- **Right**: "It handles my follow-ups after client calls."

The test: Can you describe the workflow's value without mentioning a single piece of technology? If yes, you've found the outcome.

## Design Principles: Weniger, aber besser (Less, but better)

From Dieter Rams' design philosophy:

1. **Good design is innovative** - Don't copy Zapier/Make. Find the essence.
2. **Good design makes a product useful** - Not features, but utility.
3. **Good design is aesthetic** - Visual design follows function.
4. **Good design makes a product understandable** - Self-documenting interfaces.
5. **Good design is unobtrusive** - The tool recedes.
6. **Good design is honest** - No fake social proof, no marketing jargon.
7. **Good design is long-lasting** - Build for durability, not trends.
8. **Good design is thorough** - Every detail matters.
9. **Good design is environmentally friendly** - Efficient code, minimal dependencies.
10. **Good design is as little design as possible** - Remove until it breaks.

## Architectural Principles

### BaseAPIClient Pattern
All integrations MUST use the BaseAPIClient pattern:
- Centralized error handling
- Automatic token refresh
- Rate limiting
- Consistent response types

### Canonical Tokens
- `BRAND_RADIUS` - Border radius values
- `BRAND_OPACITY` - Opacity scale for text hierarchy
- Never hardcode values; import from `brand-design-system.ts`

### Integration Structure
```
packages/integrations/src/{service}/
├── index.ts           # Main export
├── {service}.types.ts # TypeScript interfaces
├── {service}.ts       # API client (extends BaseAPIClient)
└── {service}.test.ts  # Tests
```

### Gas Town Integration (Autonomous Multi-Agent Orchestration)

WORKWAY has integrated Steve Yegge's [Gas Town](https://github.com/steveyegge/gastown) pattern for coordinating multiple AI agents at scale. Implementation lives in `packages/harness/`.

**Architecture** (Coordinator/Worker/Observer pattern):

```
Coordinator (Mayor)
  ├─ Distributes work to Workers
  ├─ Never executes work directly (prevents context sprawl)
  └─ Monitors progress via Observer

Worker (Polecat)
  ├─ Claims work from queue
  ├─ Executes in isolated session
  └─ Reports completion

Observer (Witness)
  ├─ Non-blocking progress monitoring
  └─ Real-time status without interfering

Merge Queue (Refinery)
  ├─ Validates concurrent commits
  └─ Resolves conflicts automatically
```

**When to use Gas Town**:
- Systematic reviews/audits (e.g., 60 workflows quality check)
- Parallel refactoring across multiple packages
- Large-scale code generation tasks
- Cross-repo dependency resolution

**Formula Pattern**:
1. Define work in `specs/*.yaml` (features with dependencies)
2. Coordinator spawns Workers for each feature
3. Workers execute in parallel (respecting dependencies)
4. Findings tracked in Beads automatically
5. Merge Queue handles concurrent commits

**Example Use Case**: Workflow Configuration Audits
```bash
# Create formula for auditing all 60 workflows
bd work specs/workflow-audit-suite.yaml

# Coordinator distributes 8 audit types to Workers:
# - Scoring rules validation
# - Required properties check
# - API endpoint health
# - OAuth provider coverage
# - User input field quality
# - Error message helpfulness
# - Schema consistency
# - Field mapping completeness

# Workers run audits in parallel, create Beads issues for findings
```

**Current Scale**: Comfortable at 2-4 concurrent workers (Phase 1). Designed to scale to 10-30 workers (Phase 2-3).

**Documentation**:
- Implementation: `packages/harness/GASTOWN_IMPLEMENTATION.md`
- Evaluation: `docs/GASTOWN_EVALUATION.md`
- Molecular workflows: `packages/harness/MOLECULAR_WORKFLOWS.md`

## Workflow Developer Capabilities

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

**Evidence**: Production workflows like `meeting-intelligence-private` use direct `fetch()` calls (lines 73, 447, 519).

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
    // Direct fetch() for any API
    const response = await fetch('https://api.custom-service.com/data', {
      headers: { 'Authorization': `Bearer ${config.apiKey}` }
    });
    return await response.json();
  }
});
```

**Full documentation**: See `docs/DEVELOPER_CAPABILITIES.md`

## Positioning Context

### WORKWAY fills Notion's integration gaps:
- **Gmail → Notion**: AI Connector is search-only, doesn't create database entries
- **Slack → Notion**: Native integration is one-way (Notion → Slack only)
- **Zoom → Notion**: No official integration for meeting transcripts
- **CRM → Notion**: Wide open territory

### Compound Workflow Differentiation
WORKWAY doesn't just move data A → B. We orchestrate the **full workflow**:
```
Meeting ends → Notion page + Slack summary + Email draft + CRM update
```
This is what competitors (Transkriptor, Zapier) don't do.

## SEO/AEO Strategy

Each outcome page targets:
- **SEO keywords**: Specific tool combinations (e.g., "zoom to notion automation")
- **AEO questions**: Direct answers for AI search (e.g., "How do I automatically sync Zoom meetings to Notion?")
- **Differentiation**: What competitors don't do

## File Locations

| Component | Location |
|-----------|----------|
| Integrations | `packages/integrations/src/` |
| Workflows | `packages/workflows/src/` |
| Workers | `packages/workers/` |
| Design Tokens CDN | `packages/workers/design-tokens/` |
| Web UI | `apps/web/` (separate repo) |
| API | `apps/api/` (separate repo) |
| SDK | `packages/sdk/` |
| Documentation | `docs/` |

## Key Documentation

**Start with**: [`docs/README.md`](docs/README.md) - Canonical documentation index

**For developers**:
- `docs/PLATFORM_THESIS.md` - Why WORKWAY exists, business model, competitive positioning
- `docs/DEVELOPER_CAPABILITIES.md` - What you can/cannot do in workflows
- `docs/ARCHITECTURE.md` - System architecture overview
- `docs/WORKERS_RUNTIME_GUIDE.md` - Cloudflare Workers constraints

**For investors**:
- `docs/TEAM_STORY.md` - Founder background and team composition
- `docs/ICP_AND_TARGETS.md` - Ideal customer profile and target list
- `docs/INVESTOR_TRANSLATION.md` - Philosophy in business terms

## Commands

```bash
# Development
pnpm dev                    # Start development servers
pnpm test                   # Run tests
pnpm lint                   # Lint code

# Deployment
pnpm deploy                 # Deploy workers

# Integrations
pnpm test:integration       # Integration tests
```

## Current Work

### Zoom Meeting Intelligence Port
See `docs/ZOOM_WORKWAY_PORT.md` for the technical implementation plan.

Key components:
- Zoom OAuth integration (clips + meetings)
- Hybrid transcript extraction (OAuth API → browser scraper fallback)
- Notion page creation with transcript blocks
- Compound workflow steps (Slack, Email, CRM)

## Code Review Checklist

Before committing, verify:
- [ ] Follows BaseAPIClient pattern
- [ ] Uses canonical design tokens
- [ ] No hardcoded values
- [ ] TypeScript interfaces defined
- [ ] Tests written
- [ ] Zuhandenheit: Does the tool recede?
- [ ] Weniger, aber besser: Can anything be removed?

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

### Design Token Distribution (CDN)

Private/BYOO workflows inherit WORKWAY design automatically via CDN:

```html
<head>
  <!-- Fonts - Stack Sans Notch + JetBrains Mono (proxied from Google Fonts) -->
  <link rel="stylesheet" href="https://cdn.workway.co/fonts.css" />
  <!-- Design Tokens -->
  <link rel="stylesheet" href="https://cdn.workway.co/tokens.css" />
  <!-- Icons - version-pinned Lucide -->
  <script src="https://cdn.workway.co/lucide.js"></script>
</head>
```

**What the CDN provides:**
- Fonts: Stack Sans Notch (sans-serif) + JetBrains Mono (monospace) via `/fonts.css`
- Color tokens: `--color-bg-pure`, `--color-fg-primary`, `--color-success`, etc.
- Short aliases: `--bg-pure`, `--fg-primary`, `--success` (backwards compatibility)
- Typography: `--font-sans`, `--font-mono`, `--text-h1`, `--text-body`, etc.
- Spacing: `--space-xs` to `--space-2xl` (Golden Ratio scale)
- Animation: `--ease-standard`, `--duration-standard`, etc.
- Base body styles: font-family, background, color, antialiasing

**Zuhandenheit achieved:** Developer adds one `<link>` tag. Design flows through. The mechanism disappears.

**CDN Worker location:** `packages/workers/design-tokens/`

## Exception Patterns

### Integration Gap Workarounds

Sometimes OAuth APIs don't provide the data you need. When building workarounds:

**When to use a workaround pattern:**
- OAuth genuinely doesn't provide required data (e.g., Zoom transcripts)
- No canonical alternative exists
- The outcome justifies the complexity

**Requirements for workaround workflows:**
1. Mark with `experimental: true` and `requiresCustomInfrastructure: true`
2. Document trade-offs prominently in the file header
3. Use honest naming (e.g., `meeting-intelligence-private`, not `meeting-intelligence-quick-start`)
4. Set `zuhandenheit.worksOutOfBox: false` - don't pretend it's seamless
5. Provide upgrade path to canonical workflow when API improves

**What workaround workflows should NOT do:**
- Claim to be "quick" or "easy" when they require custom infrastructure
- Hide mechanism complexity from developers
- Be featured or recommended over canonical alternatives

**Example: `meeting-intelligence-private`**

This workflow exists because Zoom OAuth doesn't provide transcript access. It requires:
- Custom Cloudflare Worker (`zoom-cookie-sync`)
- Durable Objects for session storage
- Puppeteer for browser scraping
- Manual bookmarklet authentication (24-hour expiration)

This is ~1,345 lines vs ~300 for a typical OAuth workflow. It's marked `experimental` and points users to upgrade when OAuth improves.

**The canonical workflow pattern remains:**
```typescript
export default defineWorkflow({
  integrations: [{ service: 'zoom', scopes: [...] }],
  async execute({ integrations }) {
    const transcript = await integrations.zoom.getTranscript(meetingId);
    // Done. Tool recedes.
  }
});
```

Workarounds are exceptions, not templates.