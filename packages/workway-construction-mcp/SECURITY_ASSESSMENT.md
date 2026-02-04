# WORKWAY Construction MCP - Security Assessment

**Date:** February 3, 2026  
**Server:** `https://workway-construction-mcp.half-dozen.workers.dev`  
**Assessment Type:** OAuth Flow, Credential Storage, Input Validation, Database Security

---

## Executive Summary

**Risk Level: HIGH** 🔴

Multiple critical security vulnerabilities identified that could lead to:
- OAuth token theft via CSRF attacks
- Credential exposure in logs/errors
- SQL injection vulnerabilities
- Token storage in plaintext
- Insecure redirect URI validation

---

## 1. OAuth Flow Security

### 🔴 CRITICAL: Missing PKCE (Proof Key for Code Exchange)

**Location:** `src/tools/procore.ts:85-89`, `src/index.ts:218-228`

**Issue:** The OAuth authorization flow does not implement PKCE, which is a critical security enhancement for public clients (OAuth 2.0 Security Best Current Practice).

**Current Implementation:**
```typescript
const authUrl = new URL('https://login.procore.com/oauth/authorize');
authUrl.searchParams.set('client_id', env.PROCORE_CLIENT_ID);
authUrl.searchParams.set('redirect_uri', 'https://workway-construction-mcp.workers.dev/oauth/callback');
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('state', state);
```

**Risk:** Authorization codes can be intercepted and exchanged for tokens by attackers if they gain access to the authorization code.

**Recommendation:**
```typescript
// Generate code verifier and challenge
const codeVerifier = base64URLEncode(crypto.getRandomValues(new Uint8Array(32)));
const codeChallenge = base64URLEncode(
  await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
);

// Store code_verifier with state
await env.KV.put(`oauth_state:${state}`, JSON.stringify({
  provider: 'procore',
  companyId: input.company_id,
  codeVerifier, // Store for later verification
  createdAt: new Date().toISOString(),
}), { expirationTtl: 600 });

authUrl.searchParams.set('code_challenge', codeChallenge);
authUrl.searchParams.set('code_challenge_method', 'S256');

// In callback, verify code_verifier matches
```

---

### 🟡 MEDIUM: State Parameter Validation Weakness

**Location:** `src/index.ts:211-215`

**Issue:** State validation exists but has a timing vulnerability. The state is deleted immediately after validation, but there's no check that the state belongs to the current user/session.

**Current Implementation:**
```typescript
const stateData = await c.env.KV.get(`oauth_state:${state}`, 'json') as any;
if (!stateData) {
  return c.json({ error: 'Invalid or expired state' }, 400);
}
// ... token exchange ...
await c.env.KV.delete(`oauth_state:${state}`);
```

**Risk:** If an attacker can predict or brute-force state values, they could potentially complete OAuth flows for other users.

**Recommendation:**
- Add user/session binding to state: `oauth_state:${userId}:${state}` or `oauth_state:${sessionId}:${state}`
- Include timestamp validation (already present but verify expiration)
- Use cryptographically secure random UUIDs (already using `crypto.randomUUID()` ✅)

---

### 🔴 CRITICAL: Redirect URI Mismatch

**Location:** `src/index.ts:226`, `src/tools/procore.ts:87`

**Issue:** The redirect URI is hardcoded to `https://workway-construction-mcp.workers.dev/oauth/callback`, but the actual server is deployed at `https://workway-construction-mcp.half-dozen.workers.dev`. Additionally, the user mentioned production uses `https://api.workway.co/oauth/callback/procore`.

**Current Implementation:**
```typescript
redirect_uri: 'https://workway-construction-mcp.workers.dev/oauth/callback',
```

**Risk:** 
1. OAuth flow will fail if Procore is configured with a different redirect URI
2. If Procore allows multiple redirect URIs, this creates confusion and potential security issues
3. No validation that the redirect URI matches what was registered with Procore

**Recommendation:**
```typescript
// Use environment variable
redirect_uri: c.env.PROCORE_REDIRECT_URI || 'https://workway-construction-mcp.half-dozen.workers.dev/oauth/callback',

// Validate redirect URI matches registered URI
const allowedRedirectUris = [
  'https://workway-construction-mcp.half-dozen.workers.dev/oauth/callback',
  'https://api.workway.co/oauth/callback/procore',
];
if (!allowedRedirectUris.includes(redirectUri)) {
  throw new Error('Invalid redirect URI');
}
```

---

## 2. Credential Exposure Risks

### 🔴 CRITICAL: Access Tokens Stored in Plaintext

**Location:** `migrations/0001_initial.sql:69`, `src/index.ts:240-250`

**Issue:** OAuth access tokens and refresh tokens are stored in plaintext in the D1 database.

**Current Schema:**
```sql
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  user_id TEXT NOT NULL,
  access_token TEXT NOT NULL,  -- PLAINTEXT ⚠️
  refresh_token TEXT,           -- PLAINTEXT ⚠️
  expires_at TEXT,
  scopes TEXT,
  company_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Risk:** 
- Database compromise exposes all OAuth tokens
- Anyone with database access can impersonate users
- Violates OAuth 2.0 security best practices

**Recommendation:**
```typescript
// Encrypt tokens before storage
import { encrypt, decrypt } from './crypto-utils';

const encryptedAccessToken = await encrypt(tokenData.access_token, c.env.COOKIE_ENCRYPTION_KEY);
const encryptedRefreshToken = tokenData.refresh_token 
  ? await encrypt(tokenData.refresh_token, c.env.COOKIE_ENCRYPTION_KEY)
  : null;

await c.env.DB.prepare(`
  INSERT INTO oauth_tokens (id, provider, user_id, access_token, refresh_token, expires_at, created_at)
  VALUES (?, 'procore', 'default', ?, ?, ?, ?)
`).bind(
  tokenId,
  encryptedAccessToken,
  encryptedRefreshToken,
  tokenData.expires_in 
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null,
  new Date().toISOString()
).run();
```

**Alternative:** Use Cloudflare Workers Secrets API or KV with encryption at rest.

---

### 🟡 MEDIUM: Client Secret in Environment Variables

**Location:** `src/index.ts:224-225`, `src/lib/procore-client.ts:88-89`

**Issue:** Client secret is stored in environment variables. While this is standard practice, there's no validation that it's not accidentally logged or exposed.

**Current Implementation:**
```typescript
client_id: c.env.PROCORE_CLIENT_ID,
client_secret: c.env.PROCORE_CLIENT_SECRET,
```

**Risk:** 
- If error handling logs the full request body, secrets could be exposed
- Environment variables might be visible in deployment logs

**Recommendation:**
- Ensure error logging never includes `client_secret` field
- Use Cloudflare Workers Secrets (already using `wrangler secret put` ✅)
- Add validation that secrets are not empty/undefined
- Consider using Workers Secrets API instead of env vars for production

---

### 🟡 MEDIUM: Error Messages May Expose Sensitive Information

**Location:** `src/index.ts:231-232`, `src/tools/procore.ts:48-49`

**Issue:** Error responses may include full API error messages that could reveal internal details.

**Current Implementation:**
```typescript
const error = await tokenResponse.text();
return c.json({ error: `Token exchange failed: ${error}` }, 400);
```

**Risk:** Procore API errors might contain sensitive information or reveal system internals.

**Recommendation:**
```typescript
if (!tokenResponse.ok) {
  const errorText = await tokenResponse.text();
  // Log full error server-side, but return sanitized message
  console.error('Token exchange failed:', errorText);
  return c.json({ 
    error: 'Token exchange failed. Please try again or contact support.',
    code: 'OAUTH_TOKEN_EXCHANGE_FAILED'
  }, 400);
}
```

---

## 3. Input Validation and Injection Risks

### 🔴 CRITICAL: SQL Injection Vulnerabilities

**Location:** Multiple locations using string concatenation in SQL queries

**Issue:** While D1 uses parameterized queries in most places, there are potential injection risks in dynamic query construction.

**Examples:**

1. **`src/tools/procore.ts:173`** - URL construction with user input:
```typescript
const projects = await procoreRequest<ProcoreProject[]>(
  env,
  `/projects${input.active_only ? '?filters[active]=true' : ''}`
);
```
✅ **Safe** - This is URL path construction, not SQL.

2. **`src/tools/procore.ts:234`** - Project ID in URL:
```typescript
let url = `/projects/${input.project_id}/rfis?per_page=${input.limit}`;
```
⚠️ **Risk** - `project_id` is a number from user input. While it's validated by Zod schema, ensure it's sanitized.

**Current Validation:**
```typescript
inputSchema: z.object({
  project_id: z.number().describe('Procore project ID'),
  // ...
})
```

**Recommendation:**
```typescript
// Ensure project_id is validated as positive integer
project_id: z.number().int().positive().describe('Procore project ID'),

// For string inputs, add additional sanitization
company_id: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional()
```

---

### 🟡 MEDIUM: Missing Input Validation on Webhook Endpoints

**Location:** `src/index.ts:162-189`

**Issue:** Webhook endpoint accepts arbitrary JSON without validation.

**Current Implementation:**
```typescript
app.post('/webhooks/:workflow_id', async (c) => {
  const workflowId = c.req.param('workflow_id');
  const body = await c.req.json(); // No validation ⚠️
  
  const workflow = await c.env.DB.prepare(`
    SELECT * FROM workflows WHERE id = ? AND status = 'active'
  `).bind(workflowId).first<any>();
```

**Risk:** 
- Malicious webhook payloads could cause issues downstream
- No webhook signature verification

**Recommendation:**
```typescript
// Validate webhook signature
const signature = c.req.header('X-Webhook-Signature');
const expectedSignature = await generateWebhookSignature(body, workflow.webhookSecret);
if (signature !== expectedSignature) {
  return c.json({ error: 'Invalid webhook signature' }, 401);
}

// Validate workflow_id format
if (!/^[a-zA-Z0-9_-]+$/.test(workflowId)) {
  return c.json({ error: 'Invalid workflow ID format' }, 400);
}

// Validate body structure
const bodySchema = z.object({
  // Define expected webhook payload structure
});
const validatedBody = bodySchema.parse(body);
```

---

### 🟡 MEDIUM: URL Parameter Injection

**Location:** `src/tools/procore.ts:309-315`, `src/tools/procore.ts:375-378`

**Issue:** Date and status filters are directly concatenated into URLs without proper encoding.

**Current Implementation:**
```typescript
if (input.start_date) {
  url += `&filters[log_date][gte]=${input.start_date}`;
}
if (input.status !== 'all') {
  url += `&filters[status]=${input.status}`;
}
```

**Risk:** If input validation fails, malicious input could modify API requests.

**Recommendation:**
```typescript
// Use URLSearchParams for proper encoding
const params = new URLSearchParams();
if (input.start_date) {
  params.set('filters[log_date][gte]', input.start_date);
}
if (input.end_date) {
  params.set('filters[log_date][lte]', input.end_date);
}
const url = `/projects/${input.project_id}/daily_logs?${params.toString()}`;

// Validate date format
start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
```

---

## 4. Token Refresh and Expiration Handling

### 🟡 MEDIUM: Incomplete Token Refresh Implementation

**Location:** `src/tools/procore.ts:32-35`, `src/lib/procore-client.ts:56-58`

**Issue:** Token refresh is partially implemented in `procore-client.ts` but not used in `procore.ts` helper function.

**Current Implementation:**

**`src/tools/procore.ts`** (Helper function):
```typescript
// Check if token needs refresh
if (token.expires_at && new Date(token.expires_at) < new Date()) {
  // TODO: Implement token refresh
  throw new Error('Procore token expired. Please reconnect.');
}
```

**`src/lib/procore-client.ts`** (Client class):
```typescript
if (needsRefresh && token.refresh_token) {
  return await this.refreshToken(token);
}
```

**Risk:** 
- Users must manually reconnect when tokens expire
- Inconsistent behavior between different code paths
- `procore.ts` helper doesn't use `ProcoreClient` class

**Recommendation:**
```typescript
// In procore.ts, use ProcoreClient instead of direct DB queries
import { ProcoreClient } from '../lib/procore-client';

async function procoreRequest<T>(
  env: Env,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const client = new ProcoreClient({ env });
  return client.request<T>(path, options);
}
```

---

### 🟡 MEDIUM: Token Expiration Buffer Too Small

**Location:** `src/lib/procore-client.ts:38`

**Issue:** Token refresh buffer is 5 minutes, which may be insufficient for high-latency scenarios.

**Current Implementation:**
```typescript
if (!expiresAt || expiresAt.getTime() > Date.now() + 5 * 60 * 1000) {
  return this.tokenCache;
}
```

**Recommendation:** Increase buffer to 10-15 minutes to account for network latency and clock skew:
```typescript
const REFRESH_BUFFER_MS = 15 * 60 * 1000; // 15 minutes
if (!expiresAt || expiresAt.getTime() > Date.now() + REFRESH_BUFFER_MS) {
  return this.tokenCache;
}
```

---

### 🟡 MEDIUM: No Token Revocation Handling

**Location:** `src/lib/procore-client.ts:158-162`

**Issue:** When a 401 error occurs, the code clears cache but doesn't handle token revocation scenarios.

**Current Implementation:**
```typescript
if (response.status === 401) {
  this.tokenCache = null;
  throw new ProcoreError('UNAUTHORIZED', 'Procore authentication failed. Please reconnect.');
}
```

**Recommendation:**
```typescript
if (response.status === 401) {
  this.tokenCache = null;
  // Attempt refresh if refresh_token exists
  const token = await this.getToken();
  if (token.refreshToken) {
    try {
      await this.refreshToken(token);
      // Retry request once
      return this.request<T>(path, options);
    } catch (refreshError) {
      // Refresh failed, token likely revoked
      await this.revokeToken(token.id);
    }
  }
  throw new ProcoreError('UNAUTHORIZED', 'Procore authentication failed. Please reconnect.');
}
```

---

## 5. CORS Configuration

### 🔴 CRITICAL: Overly Permissive CORS

**Location:** `src/index.ts:28-32`

**Issue:** CORS is configured to allow all origins (`origin: '*'`).

**Current Implementation:**
```typescript
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));
```

**Risk:** 
- Any website can make requests to the MCP server
- CSRF attacks possible
- OAuth callback could be hijacked from malicious origins

**Recommendation:**
```typescript
const allowedOrigins = [
  'https://workway.co',
  'https://api.workway.co',
  'https://workway-construction-mcp.half-dozen.workers.dev',
  // Add MCP client origins
];

app.use('*', cors({
  origin: (origin) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return origin;
    }
    return null; // Reject
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true, // If using cookies
}));
```

**Note:** For MCP servers, you may need to allow specific MCP client origins. Check your MCP client documentation.

---

## 6. Database Security

### 🟡 MEDIUM: Missing User Isolation

**Location:** `src/index.ts:241`, `src/tools/procore.ts:23-25`

**Issue:** OAuth tokens are stored with `user_id: 'default'`, meaning there's no user isolation.

**Current Implementation:**
```typescript
await c.env.DB.prepare(`
  INSERT INTO oauth_tokens (id, provider, user_id, access_token, refresh_token, expires_at, created_at)
  VALUES (?, 'procore', 'default', ?, ?, ?, ?)
`).bind(...)
```

**Risk:** 
- All tokens share the same user_id
- No way to identify which user/token belongs to which session
- Multi-user scenarios will overwrite each other's tokens

**Recommendation:**
```typescript
// Extract user ID from session or OAuth callback
const userId = c.req.query('user_id') || extractUserIdFromSession(c);
// Or from state data
const stateData = await c.env.KV.get(`oauth_state:${state}`, 'json');
const userId = stateData.userId || 'default';

await c.env.DB.prepare(`
  INSERT INTO oauth_tokens (id, provider, user_id, access_token, refresh_token, expires_at, created_at)
  VALUES (?, 'procore', ?, ?, ?, ?, ?)
`).bind(tokenId, userId, ...)
```

---

### 🟡 MEDIUM: No Database Access Controls

**Location:** All database queries

**Issue:** No row-level security or access control checks before database queries.

**Risk:** If user context is added later, existing queries won't filter by user_id.

**Recommendation:**
```typescript
// Always filter by user_id when querying tokens
const token = await env.DB.prepare(`
  SELECT * FROM oauth_tokens 
  WHERE provider = ? AND user_id = ?
  LIMIT 1
`).bind('procore', userId).first<any>();
```

---

## 7. Additional Security Concerns

### 🟡 MEDIUM: No Rate Limiting

**Location:** All endpoints

**Issue:** No rate limiting on OAuth endpoints or API calls.

**Risk:** 
- Brute force attacks on OAuth callback
- API abuse
- DoS attacks

**Recommendation:**
```typescript
import { rateLimiter } from '@cloudflare/workers-rate-limiter';

const limiter = rateLimiter({
  limit: 10,
  window: 60, // 10 requests per minute
});

app.post('/oauth/callback', async (c) => {
  const identifier = c.req.header('CF-Connecting-IP') || 'unknown';
  const { success } = await limiter.limit(identifier);
  if (!success) {
    return c.json({ error: 'Rate limit exceeded' }, 429);
  }
  // ... rest of handler
});
```

---

### 🟡 MEDIUM: Missing HTTPS Enforcement

**Location:** All endpoints

**Issue:** No explicit HTTPS enforcement (though Cloudflare Workers enforce HTTPS by default).

**Recommendation:** Add explicit checks:
```typescript
if (c.req.url.startsWith('http://')) {
  return c.redirect(c.req.url.replace('http://', 'https://'), 301);
}
```

---

### 🟡 MEDIUM: No Request Logging/Auditing

**Location:** All endpoints

**Issue:** No audit trail for OAuth flows or sensitive operations.

**Recommendation:**
```typescript
// Log OAuth events
await c.env.DB.prepare(`
  INSERT INTO audit_logs (event_type, user_id, ip_address, details, created_at)
  VALUES (?, ?, ?, ?, ?)
`).bind(
  'oauth_callback',
  userId,
  c.req.header('CF-Connecting-IP'),
  JSON.stringify({ provider: 'procore', success: true }),
  new Date().toISOString()
).run();
```

---

## Summary of Vulnerabilities

| Severity | Count | Category |
|----------|-------|----------|
| 🔴 Critical | 5 | OAuth, CORS, Token Storage |
| 🟡 Medium | 10 | Input Validation, Token Refresh, Rate Limiting |

---

## Priority Remediation Plan

### Immediate (Critical - Fix Before Production)

1. **Implement PKCE** for OAuth flow
2. **Encrypt OAuth tokens** in database
3. **Restrict CORS** to allowed origins only
4. **Fix redirect URI** mismatch
5. **Add user isolation** for OAuth tokens

### Short-term (High Priority - Fix Within 1 Week)

6. **Complete token refresh** implementation
7. **Add input validation** for all user inputs
8. **Implement rate limiting** on OAuth endpoints
9. **Add webhook signature verification**
10. **Sanitize error messages** to prevent information leakage

### Medium-term (Important - Fix Within 1 Month)

11. **Add audit logging** for security events
12. **Implement token revocation** handling
13. **Add database access controls** (row-level security)
14. **Increase token refresh buffer** time
15. **Add HTTPS enforcement** checks

---

## Testing Recommendations

1. **OAuth Flow Testing:**
   - Test CSRF protection with invalid state
   - Test expired state handling
   - Test PKCE flow (after implementation)
   - Test redirect URI validation

2. **Token Security Testing:**
   - Verify tokens are encrypted at rest
   - Test token refresh flow
   - Test token expiration handling
   - Test concurrent token refresh requests

3. **Input Validation Testing:**
   - SQL injection attempts on all inputs
   - XSS attempts in error messages
   - Path traversal attempts
   - Invalid data type handling

4. **CORS Testing:**
   - Test from allowed origins
   - Test from disallowed origins
   - Test preflight requests

---

## References

- [OAuth 2.0 Security Best Current Practice](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Cloudflare Workers Security Best Practices](https://developers.cloudflare.com/workers/platform/security/)
- [Procore API Documentation](https://developers.procore.com/)
