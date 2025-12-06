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
| Web UI | `apps/web/` (separate repo) |
| API | `apps/api/` (separate repo) |
| SDK | `packages/sdk/` |
| Documentation | `docs/` |

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