You are implementing a WORKWAY platform component.

## WORKWAY Conventions
- Packages in `packages/`
- Workers in `packages/workers/`
- Apps in `apps/`
- Follow Zuhandenheit and Weniger, aber besser

## DRY Principles (CRITICAL)

Before writing ANY code:
1. **Read first** - ALWAYS read existing files before modifying or creating new ones
2. **Search for patterns** - Use Grep/Glob to find existing implementations of similar functionality
3. **Reuse, don't recreate** - If a pattern, component, or utility exists, USE it
4. **Edit over create** - Prefer editing existing files over creating new ones
5. **Check CLAUDE.md** - Read project rules and conventions first

**Anti-patterns to AVOID:**
- Creating a new file without checking if similar exists
- Duplicating utility functions that exist elsewhere
- Hardcoding values that are defined as design tokens
- Ignoring existing component patterns in the codebase
- Writing code before understanding the existing architecture

## Existing Patterns to Reuse
- Project rules exist in .claude/rules/ - read before implementing

## Relevant Files to Reference
- `CLAUDE.md`
- `.claude/rules/beads-workflow.md`
- `.claude/rules/deployment-safety.md`
- `.claude/rules/design-tokens.md`
- `./examples/meeting-intelligence/workflow.ts`
- `./examples/ai-email-assistant/workflow.ts`
- `./examples/ai-support-agent/workflow.ts`
- `./scripts/test-sikka-connection.ts`
- `./packages/learn/src/mcp/tools/learn-praxis.ts`

---

## Current Issue
**Middleware usage (, , )** (Cloudflare-1jmn)

Created by harness

## Session Goal
Complete: Middleware usage (, , )

Created by harness

## Recent Commits
- 6cce3f7 refactor(workflows): fix github-to-linear export to use renamed directory
- 9dba8d1 refactor(integrations): eliminate manual fetch() with AbortController
- 9ddc616 refactor(integrations): use createErrorHandler in template
- ac325c2 feat(sdk): add token refresh support to BaseHTTPClient
- 9c7cb0f refactor(integrations): use deleteJson and add patchJson example to template

## Last Checkpoint
Session #6: 2 completed (92% confidence)
Confidence: 92%

## Scope Guard (CRITICAL)

**Active Issue**: Cloudflare-1jmn (Middleware usage (, , ))
**Status**: ✓ Single issue assigned for this session

⚠️ **CONSTRAINTS**:
- Work ONLY on the issue above - do NOT touch other features
- If you discover additional work needed, note it but do NOT implement it
- Do NOT create new issues - the harness handles issue management
- Complete this one feature fully before the session ends

If blocked, describe the blocker clearly and stop. Do NOT work around it by starting other features.

## Completion Criteria (Two-Stage)

**Stage 1: Code Complete**
1. All files created/modified as needed
2. TypeScript compiles without errors
3. Unit tests pass

**Stage 2: Verified**
4. Acceptance criteria actually met (not just "code exists")
5. Feature works end-to-end (test in browser/CLI)
6. No regressions introduced

Only declare success when BOTH stages are complete.

---

Begin working on this issue. Focus exclusively on this one feature.
When complete, simply finish your work - the harness will close the issue automatically.

**IMPORTANT**: Do NOT run `bd close` or `bd update` commands - the harness manages issue state.