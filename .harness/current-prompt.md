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
- `.claude/rules/design-tokens.md`
- `.claude/rules/integrations.md`
- `.claude/rules/philosophy.md`
- `./packages/workflows/src/client-onboarding/index.ts`
- `./packages/cli/src/lib/workflow-validator.ts`
- `./packages/integrations/openapi/generated/stripe.generated.d.ts`
- `./packages/sdk/src/vectorize.ts`
- `./apps/f-n-web/src/routes/auth/signup/+page.svelte`
- `./packages/learn/src/types/index.ts`

---

## Current Issue
**Enhance lessons with real code examples from  and ** (Cloudflare-g7sn)

Created by harness

## Session Goal
Complete: Enhance lessons with real code examples from  and 

Created by harness

## Recent Commits
- d183d50 fix(learn): Fix syntax highlighting in code blocks
- 41e9e2d feat(learn): Add missing praxis validators for common-pitfalls and design-philosophy
- cb7472a fix(learn): Fix TypeScript errors in API routes and auth
- 4b6a57c feat(learn): Add accurate code examples from WORKWAY codebase
- dd97504 feat(learn): Add step-by-step instructions to three lessons

## Last Checkpoint
Session #38: 3 completed (100% confidence)
Confidence: 100%

## Completion Criteria
1. All acceptance criteria met
2. TypeScript compiles without errors
3. Tests pass

---

Begin working on this issue. When complete, simply finish your work - the harness will close the issue automatically.

**IMPORTANT**: Do NOT run `bd close` or `bd update` commands - the harness manages issue state.