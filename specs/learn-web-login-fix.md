# Learn WORKWAY Login Fix

Fix the 404 error on POST /auth/login and create a shared auth package for DRY Identity integration.

## Overview

The login form at https://learn.workway.co/auth/login returns a 404 when submitting.

**Two bugs identified:**
1. SvelteKit route 404 - likely stale deployment or adapter config issue
2. Wrong endpoint - code calls `/api/auth/login` but Identity Worker uses `/v1/auth/login`

**Reference implementation:** `packages/learn/src/api/auth.ts` (CLI auth with correct endpoints)

## Feature: Fix learn-web Login Endpoint

Fix the immediate login bug by correcting the Identity Worker endpoint path.

### Acceptance Criteria
- Change `/api/auth/login` to `/v1/auth/login` in `apps/learn-web/src/routes/auth/login/+page.server.ts`
- Verify the Identity Worker URL is correct (`https://id.createsomething.space`)
- Test login locally with `pnpm dev` before deploying
- Ensure error responses from Identity Worker are handled gracefully

## Feature: Create Shared Auth Package

Extract Identity Worker integration into a reusable package following patterns from `packages/learn/src/api/auth.ts`.

### Acceptance Criteria
- Create `packages/auth/` with package.json and tsconfig.json
- Export `createIdentityClient(identityUrl)` for Identity Worker API calls
- Export `login(email, password)` returning `{ accessToken, refreshToken, user }`
- Export `refreshTokens(refreshToken)` for automatic token refresh
- Export `validateJWT(token)` with proper signature verification using JWKS from `/.well-known/jwks.json`
- Add to workspace in root `pnpm-workspace.yaml` if needed
- Works in Cloudflare Workers environment (no Node.js dependencies)

## Feature: Add Cookie Utilities

Create consistent cookie handling for all WORKWAY SvelteKit apps.

### Acceptance Criteria
- Export `setAuthCookies(cookies, { accessToken, refreshToken })` helper
- Export `clearAuthCookies(cookies)` helper
- Use consistent cookie names: `workway_access_token`, `workway_refresh_token`
- Cookie settings: httpOnly, secure, sameSite=lax, path=/
- Access token expires in 1 hour, refresh token in 7 days

## Feature: Add Server Hooks Template

Create a reusable auth hook factory for SvelteKit apps.

### Acceptance Criteria
- Export `createAuthHook(options)` from packages/auth
- Auto-validate access token on each request using JWKS
- Auto-refresh expired tokens (within 5 min of expiry) using refresh token
- Populate `event.locals.user` with `{ id, email, displayName }`
- Accept `protectedPaths` option for redirect-to-login behavior
- Accept `identityUrl` option (defaults to `https://id.createsomething.space`)

## Feature: Migrate learn-web to Shared Auth

Update learn-web to use the shared auth package.

### Acceptance Criteria
- Import `createIdentityClient`, `setAuthCookies` from `@workway/auth`
- Update `+page.server.ts` to use shared client
- Update `hooks.server.ts` to use `createAuthHook()`
- Migrate from `learn_access_token` to `workway_access_token`
- Test full login flow end-to-end

## Feature: Add Login Error Feedback

Improve the login form UX with proper error handling.

### Acceptance Criteria
- Display form validation errors inline (email/password required)
- Display authentication errors from server (invalid credentials, service unavailable)
- Add autocomplete attributes (`autocomplete="email"`, `autocomplete="current-password"`)
- Show loading/submitting state on button
- Clear error state when user starts typing
