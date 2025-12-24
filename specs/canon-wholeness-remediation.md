# Canon Wholeness Remediation

## Overview

Remediate all gaps identified in the Canon Wholeness Audit to achieve 100% philosophical integrity across the WORKWAY codebase.

**Philosophy**: Zuhandenheit—the tool recedes; the outcome remains. Weniger, aber besser—less, but better.

**Audit Score**: 91% → Target: 100%

**Key Findings**:
1. Integration template doesn't extend BaseAPIClient (violates DRY)
2. workway-platform lacks Claude infrastructure
3. 8 workflows use mechanism-based naming (anti-pattern)
4. Configuration engine has 11 verbose interfaces
5. Revenue constants scattered across 4+ locations

**Cross-Repo Context**: This spec runs from `Cloudflare/` but some tasks require changes in `workway-platform/`. Use relative paths: `../workway-platform/`.

## Features

### Refactor integration template to extend BaseAPIClient
Update `packages/integrations/src/_template/index.ts` to extend the canonical BaseAPIClient pattern.

Currently duplicates ~150 lines of HTTP logic that BaseAPIClient provides:
- Manual fetch() with AbortController
- Custom error mapping
- Manual timeout logic
- No token refresh support

Reference implementation: `packages/integrations/src/notion/index.ts`
- Extend `BaseAPIClient` from `../core/base-client`
- Use `getJson`, `postJson`, `patchJson`, `deleteJson` helpers
- Use `createErrorFromResponse` for error handling
- Configure `tokenRefresh` handler for OAuth support
- Remove duplicated request/timeout/error logic
- Keep webhook verification as template-specific helper

### Create workway-platform CLAUDE.md
Create `../workway-platform/CLAUDE.md` with routing guidance for platform development.

The platform repo currently has only canon-audits in `.claude/`. Needs:
- Routing between `apps/api/` and `apps/web/`
- Database migration patterns
- Deployment commands specific to platform
- Reference to root CLAUDE.md for cross-repo patterns

### Create workway-platform deployment rule
Create `../workway-platform/.claude/rules/deployment.md` with platform-specific deployment safety.

Include:
- Wrangler project names (workway-api, workway-web)
- D1 migration safety checklist
- Environment variable management
- Rollback procedures for API and Web

### Create workway-platform auth patterns rule
Create `../workway-platform/.claude/rules/auth-patterns.md` documenting the teams/auth implementation.

Cover:
- Domain-based auto-join pattern
- Session management via KV
- Role hierarchy (owner, admin, member)
- Middleware usage (`requireAuth`, `requireRole`, `optionalAuth`)

### Rename gmail-to-notion-private workflow
Rename `packages/workflows/src/gmail-to-notion-private/` to outcome-based name.

Current name exposes mechanism. Should describe outcome:
- Update directory name to `private-emails-documented`
- Update `metadata.id` in index.ts
- Update any imports/references in `packages/workflows/src/index.ts`
- Verify workflow still functions

### Rename stripe-to-notion workflow
Rename `packages/workflows/src/stripe-to-notion/` to outcome-based name.

- Update directory name to `payments-tracked`
- Update `metadata.id` in index.ts
- Update any imports/references in `packages/workflows/src/index.ts`

### Rename stripe-quickbooks-sync workflow
Rename `packages/workflows/src/stripe-quickbooks-sync/` to outcome-based name.

- Update directory name to `accounting-stays-current`
- Update `metadata.id` in index.ts
- Update any imports/references in `packages/workflows/src/index.ts`

### Rename github-to-linear workflow
Rename `packages/workflows/src/github-to-linear/` to outcome-based name.

- Update directory name to `issues-synced-to-sprint`
- Update `metadata.id` in index.ts
- Update any imports/references in `packages/workflows/src/index.ts`

### Rename notion-two-way-sync workflow
Rename `packages/workflows/src/notion-two-way-sync/` to outcome-based name.

- Update directory name to `databases-mirrored`
- Update `metadata.id` in index.ts
- Update any imports/references in `packages/workflows/src/index.ts`

### Rename drive-document-hub workflow
Rename `packages/workflows/src/drive-document-hub/` to outcome-based name.

- Update directory name to `documents-organized`
- Update `metadata.id` in index.ts
- Update any imports/references in `packages/workflows/src/index.ts`

### Rename spreadsheet-sync workflow
Rename `packages/workflows/src/spreadsheet-sync/` to outcome-based name.

- Update directory name to `data-stays-consistent`
- Update `metadata.id` in index.ts
- Update any imports/references in `packages/workflows/src/index.ts`

### Extract revenue constants in workway-platform
Create `../workway-platform/apps/api/src/lib/revenue-constants.ts` with centralized revenue splits.

Currently hardcoded in multiple places (68/12/20 splits):
- ForkModal component
- Backend fork logic
- Stripe configuration
- Revenue attribution table

Extract to single source of truth:
- FORK_CREATOR_SHARE = 0.68
- ORIGINAL_CREATOR_SHARE = 0.12
- PLATFORM_SHARE = 0.20
- Update all references to import from this file

### Consolidate configuration engine interfaces
Refactor `../workway-platform/apps/api/src/workflow-config-engine.ts` to reduce interface count.

Currently 11 interfaces create cognitive load:
- ConfigSchema, ConfigStep, OAuthVerificationStep, ResourceSelectionStep
- CustomInputStep, UserInputStep, UserInputConfig, UserInputField
- ResourceSelectionConfig, FetchConfig, ScoringRules

Use discriminated union pattern:
- Create type ConfigStep = OAuthStep | ResourceStep | UserInputStep | CustomStep
- Collapse redundant interfaces
- Maintain type safety with narrowing

### Verification
Confirm all remediation tasks complete successfully.

- Run pnpm build in Cloudflare repo with zero errors
- Run pnpm build in workway-platform with zero errors
- Run pnpm test in both repos
- Verify template extends BaseAPIClient by checking the file
- Verify no mechanism-based workflow directory names remain
- Verify revenue constants are centralized in one file
- Verify platform CLAUDE.md exists
