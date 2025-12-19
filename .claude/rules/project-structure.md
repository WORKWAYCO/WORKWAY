# Project Structure

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

| Document | Purpose |
|----------|---------|
| `docs/PLATFORM_THESIS.md` | **Start here.** Two-sided platform model, pricing, competitive positioning |
| `docs/DEVELOPER_CAPABILITIES.md` | What developers can/cannot do in workflows |
| `docs/WORKERS_RUNTIME_GUIDE.md` | Cloudflare Workers constraints and patterns |

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
