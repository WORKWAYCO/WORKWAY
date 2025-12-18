# Learn WORKWAY Content Enhancement

Enhance and complete the learn.workway.co lesson content by researching the actual WORKWAY codebase and creating comprehensive, accurate tutorials.

## Goals

1. Research actual WORKWAY patterns from the codebase
2. Enhance lessons with real code examples from `packages/integrations/` and `packages/workflows/`
3. Add Praxis exercises where missing
4. Ensure technical accuracy against current implementation

## Content Requirements

Each lesson should include:
- Clear learning objectives
- Accurate code examples from the WORKWAY codebase
- Step-by-step instructions
- Common pitfalls and solutions
- Praxis exercise (hands-on practice)

## Acceptance Criteria

### Path: Getting Started (5 lessons)

- [ ] wezterm-setup: Add WORKWAY-specific keybindings, Claude Code integration tips
- [ ] claude-code-setup: Document MCP server setup, WORKWAY slash commands
- [ ] neomutt-setup: Add email workflow integration patterns
- [ ] workway-cli: Document all CLI commands with real examples
- [ ] essential-commands: Add workflow-specific commands and shortcuts

### Path: Workflow Foundations (5 lessons)

- [ ] what-is-workflow: Add Zuhandenheit philosophy examples, real outcome mapping
- [ ] define-workflow-pattern: Pull actual defineWorkflow() examples from packages/workflows/
- [ ] integrations-oauth: Document BaseAPIClient pattern with real integration code
- [ ] config-schemas: Show actual configSchema patterns from existing workflows
- [ ] triggers: Document webhook, cron, and manual triggers with examples

### Path: Building Workflows (5 lessons)

- [ ] first-workflow: Complete Gmail to Notion tutorial with working code
- [ ] working-with-integrations: Document Slack, Zoom, Stripe integration patterns
- [ ] workers-ai: Show AI summarization, classification examples from codebase
- [ ] error-handling: Document retry patterns, graceful degradation
- [ ] local-testing: Document wrangler dev workflow, mocking patterns

### Path: Systems Thinking (5 lessons)

- [ ] compound-workflows: Document Meeting Intelligence workflow architecture
- [ ] private-workflows: Show visibility: 'private' pattern, access grants
- [ ] agency-patterns: Document agency-as-moat pattern with examples
- [ ] performance-rate-limiting: Document rate limiting from BaseAPIClient
- [ ] monitoring-debugging: Document Cloudflare analytics, logging patterns

## Research Sources

- `packages/integrations/src/` - Integration patterns
- `packages/workflows/src/` - Workflow examples
- `packages/workers/` - Worker patterns
- `docs/PLATFORM_THESIS.md` - Strategic context
- `docs/DEVELOPER_CAPABILITIES.md` - What developers can do
- `.claude/rules/` - Design philosophy

## Output Format

Each lesson should be a complete markdown file at:
`apps/learn-web/src/lib/content/lessons/{path-id}/{lesson-id}.md`

Follow existing lesson structure with:
- H1 title matching lesson title
- Introduction paragraph
- Sections with H2 headings
- Code blocks with syntax highlighting
- Tables for comparisons
- Praxis section at end (if applicable)
