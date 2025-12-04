# Subtractive Triad Audit: Cloudflare

**Date:** 11/28/2025
**Overall Score:** 5/10

## Score Summary

| Level | Score | Status |
|-------|-------|--------|
| DRY (Implementation) | 10/10 | Excellent |
| Rams (Artifact) | 1/10 | Critical |
| Heidegger (System) | 4.3/10 | Needs Work |

## Violation Summary

- **Critical:** 0
- **High:** 5
- **Medium:** 38
- **Low:** 5

## DRY Violations

*"Have I built this before?" → Unify*

### Medium Priority

#### Duplicate Constant

**Files:** `packages/cli/src/commands/workflow/init.ts`, `packages/cli/src/commands/workflow/publish.ts`, `workway-public/packages/cli/src/commands/workflow/init.ts`, `workway-public/packages/cli/src/commands/workflow/publish.ts`

Constant "CATEGORIES" defined in 4 locations

> **Suggestion:** Move to a shared constants file

## Rams Violations

*"Does this earn its existence?" → Remove*

### High Priority

#### Large File

**File:** `workway-private/apps/api/src/routes/installations.ts`

File has 1761 lines

> **Suggestion:** Consider splitting into multiple modules

#### Large File

**File:** `workway-private/apps/web/src/routes/workflow.$workflowId.tsx`

File has 1598 lines

> **Suggestion:** Consider splitting into multiple modules

#### Large File

**File:** `workway-private/apps/api/src/routes/developers.ts`

File has 1297 lines

> **Suggestion:** Consider splitting into multiple modules

### Medium Priority

#### Dead Export

**File:** `packages/cli/src/lib/api-client.ts`

Export "WorkwayAPIClient" is never imported

> **Suggestion:** Remove unused export or verify it's needed externally

#### Dead Export

**File:** `packages/cli/src/lib/api-client.ts`

Export "APIError" is never imported

> **Suggestion:** Remove unused export or verify it's needed externally

#### Dead Export

**File:** `packages/cli/src/lib/api-client.ts`

Export "createAPIClient" is never imported

> **Suggestion:** Remove unused export or verify it's needed externally

#### Dead Export

**File:** `packages/cli/src/lib/config.ts`

Export "getConfigDir" is never imported

> **Suggestion:** Remove unused export or verify it's needed externally

#### Dead Export

**File:** `packages/cli/src/lib/config.ts`

Export "getDefaultConfig" is never imported

> **Suggestion:** Remove unused export or verify it's needed externally

#### Dead Export

**File:** `packages/cli/src/lib/config.ts`

Export "getDefaultProjectConfig" is never imported

> **Suggestion:** Remove unused export or verify it's needed externally

#### Dead Export

**File:** `packages/cli/src/lib/oauth-flow.ts`

Export "OAuthFlowOptions" is never imported

> **Suggestion:** Remove unused export or verify it's needed externally

#### Dead Export

**File:** `packages/cli/src/lib/oauth-flow.ts`

Export "OAuthFlowResult" is never imported

> **Suggestion:** Remove unused export or verify it's needed externally

#### Dead Export

**File:** `packages/cli/src/lib/oauth-flow.ts`

Export "OAuthCallbackServer" is never imported

> **Suggestion:** Remove unused export or verify it's needed externally

#### Dead Export

**File:** `packages/cli/src/utils/logger.ts`

Export "Logger" is never imported

> **Suggestion:** Remove unused export or verify it's needed externally

#### Dead Export

**File:** `workway-private/apps/api/scripts/cleanup-gmail-notion-workflow.ts`

Export "findGmailNotionWorkflows" is never imported

> **Suggestion:** Remove unused export or verify it's needed externally

#### Dead Export

**File:** `workway-private/apps/api/scripts/cleanup-gmail-notion-workflow.ts`

Export "cancelWorkflow" is never imported

> **Suggestion:** Remove unused export or verify it's needed externally

#### Dead Export

**File:** `workway-private/apps/api/scripts/cleanup-gmail-notion-workflow.ts`

Export "disableInstallation" is never imported

> **Suggestion:** Remove unused export or verify it's needed externally

#### Dead Export

**File:** `workway-private/apps/web/src/routeTree.gen.ts`

Export "FileRoutesByFullPath" is never imported

> **Suggestion:** Remove unused export or verify it's needed externally

#### Dead Export

**File:** `workway-private/apps/web/src/routeTree.gen.ts`

Export "FileRoutesByTo" is never imported

> **Suggestion:** Remove unused export or verify it's needed externally

#### Dead Export

**File:** `workway-private/apps/web/src/routeTree.gen.ts`

Export "FileRoutesById" is never imported

> **Suggestion:** Remove unused export or verify it's needed externally

#### Dead Export

**File:** `workway-private/apps/web/src/routeTree.gen.ts`

Export "FileRouteTypes" is never imported

> **Suggestion:** Remove unused export or verify it's needed externally

#### Dead Export

**File:** `workway-private/apps/web/src/routeTree.gen.ts`

Export "RootRouteChildren" is never imported

> **Suggestion:** Remove unused export or verify it's needed externally

#### Dead Export

**File:** `workway-private/apps/web/src/router.tsx`

Export "getRouter" is never imported

> **Suggestion:** Remove unused export or verify it's needed externally

#### Dead Export

**File:** `packages/cli/src/commands/ai/models.ts`

Export "AI_MODELS" is never imported

> **Suggestion:** Remove unused export or verify it's needed externally

#### Large File

**File:** `workway-private/apps/api/src/durable-objects/WorkflowExecutor.ts`

File has 901 lines

> **Suggestion:** Monitor for growth, consider refactoring

#### Large File

**File:** `workway-private/apps/api/src/lib/email.ts`

File has 893 lines

> **Suggestion:** Monitor for growth, consider refactoring

#### Large File

**File:** `workway-private/apps/api/src/routes/integrations.ts`

File has 860 lines

> **Suggestion:** Monitor for growth, consider refactoring

#### Large File

**File:** `workway-private/apps/api/src/routes/oauth.ts`

File has 773 lines

> **Suggestion:** Monitor for growth, consider refactoring

#### Large File

**File:** `workway-private/apps/api/src/routes/categories.ts`

File has 738 lines

> **Suggestion:** Monitor for growth, consider refactoring

#### Large File

**File:** `workway-public/packages/cli/src/lib/workflow-runtime.ts`

File has 731 lines

> **Suggestion:** Monitor for growth, consider refactoring

#### Large File

**File:** `workway-private/apps/api/src/routes/users.ts`

File has 729 lines

> **Suggestion:** Monitor for growth, consider refactoring

## Heidegger Violations

*"Does this serve the whole?" → Reconnect*

### High Priority

#### Incomplete Package

**File:** `integrations`

Package "integrations" is 40% complete

> **Suggestion:** Add missing: package.json, README.md, tests

#### Incomplete Package

**File:** `workflow-engine`

Package "workflow-engine" is 10% complete

> **Suggestion:** Add missing: src/ directory, package.json, README.md

### Medium Priority

#### Orphaned File

**File:** `examples/ai-email-assistant/workflow.ts`

File is not imported by any other file

> **Suggestion:** Import this file somewhere or remove it

#### Orphaned File

**File:** `examples/smart-content-pipeline/workflow.ts`

File is not imported by any other file

> **Suggestion:** Import this file somewhere or remove it

#### Orphaned File

**File:** `examples/ai-support-agent/workflow.ts`

File is not imported by any other file

> **Suggestion:** Import this file somewhere or remove it

#### Orphaned File

**File:** `packages/sdk/src/testing.ts`

File is not imported by any other file

> **Suggestion:** Import this file somewhere or remove it

#### Orphaned File

**File:** `packages/sdk/src/transform-utils.ts`

File is not imported by any other file

> **Suggestion:** Import this file somewhere or remove it

#### Orphaned File

**File:** `packages/sdk/src/vectorize.ts`

File is not imported by any other file

> **Suggestion:** Import this file somewhere or remove it

#### Orphaned File

**File:** `packages/sdk/src/workflow-sdk.ts`

File is not imported by any other file

> **Suggestion:** Import this file somewhere or remove it

#### Orphaned File

**File:** `workway-private/apps/api/test-trigger-workflow.ts`

File is not imported by any other file

> **Suggestion:** Import this file somewhere or remove it

#### Orphaned File

**File:** `workway-private/apps/api/worker-configuration.d.ts`

File is not imported by any other file

> **Suggestion:** Import this file somewhere or remove it

#### Orphaned File

**File:** `workway-private/apps/web/worker-configuration.d.ts`

File is not imported by any other file

> **Suggestion:** Import this file somewhere or remove it

### Low Priority

#### Missing Documentation

**File:** `packages/cli/src/index.ts`

Public exports lack JSDoc documentation

> **Suggestion:** Add JSDoc comments to exported functions and types

#### Missing Documentation

**File:** `packages/cli/src/commands/logs.ts`

Public exports lack JSDoc documentation

> **Suggestion:** Add JSDoc comments to exported functions and types

#### Missing Documentation

**File:** `packages/cli/src/commands/status.ts`

Public exports lack JSDoc documentation

> **Suggestion:** Add JSDoc comments to exported functions and types

#### Missing Documentation

**File:** `workway-public/packages/cli/src/index.ts`

Public exports lack JSDoc documentation

> **Suggestion:** Add JSDoc comments to exported functions and types

#### Missing Documentation

**File:** `packages/cli/src/commands/ai/estimate.ts`

Public exports lack JSDoc documentation

> **Suggestion:** Add JSDoc comments to exported functions and types

## Commendations

- **Codebase** (dry): Minimal code duplication detected
- **Dependencies** (rams): No unused dependencies detected
- **Files** (rams): No empty files found
- **Architecture** (heidegger): No circular dependencies detected

---

*Audit conducted using the Subtractive Triad methodology.*
*Reference: createsomething.ltd/ethos*