# BYOO: Bring Your Own OAuth Implementation Plan

**Status**: ✅ COMPLETE (Phases 1-2 implemented in API and SDK)
**Author**: Claude Code
**Date**: 2025-12-06
**Philosophy**: Zuhandenheit - the tool recedes, the developer builds

---

## Executive Summary

Enable developers to use their own OAuth app credentials for integrations, isolated from WORKWAY's system credentials. This provides:

1. **Development velocity** - Test with custom scopes without waiting for WORKWAY verification
2. **Enterprise compliance** - Corporate OAuth apps for security requirements
3. **Rate limit isolation** - Developer's app has separate rate limits
4. **Production pathway** - Graduate from dev credentials to marketplace

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Credential Resolution Flow                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   OAuth Request                                                     │
│        │                                                            │
│        ▼                                                            │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  Is this a developer's integration with BYOO enabled?        │  │
│   └─────────────────────────────────────────────────────────────┘  │
│        │                           │                                │
│       YES                         NO                                │
│        │                           │                                │
│        ▼                           ▼                                │
│   ┌──────────────┐          ┌──────────────┐                       │
│   │  Developer   │          │   System     │                       │
│   │  Credentials │          │  Credentials │                       │
│   │  (encrypted) │          │  (env vars)  │                       │
│   └──────────────┘          └──────────────┘                       │
│        │                           │                                │
│        └───────────┬───────────────┘                                │
│                    ▼                                                │
│            OAuth DO Token Storage                                   │
│            (tokens:userId:provider:credentialSource)                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### New Table: `developer_oauth_apps`

```sql
CREATE TABLE developer_oauth_apps (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),

  -- Ownership
  developer_id TEXT NOT NULL REFERENCES developer_profiles(id) ON DELETE CASCADE,
  integration_id TEXT REFERENCES marketplace_integrations(id) ON DELETE SET NULL,

  -- Provider configuration
  provider TEXT NOT NULL,  -- 'zoom', 'notion', 'slack', etc.

  -- Credentials (encrypted at rest)
  client_id TEXT NOT NULL,
  client_secret_encrypted TEXT NOT NULL,  -- AES-256-GCM encrypted
  encryption_key_id TEXT NOT NULL,        -- Key rotation support

  -- OAuth app configuration
  redirect_uri TEXT,           -- Custom redirect URI (optional)
  scopes TEXT,                 -- JSON array of scopes
  webhook_secret_encrypted TEXT,  -- For webhook validation (if applicable)

  -- Status & lifecycle
  status TEXT NOT NULL DEFAULT 'development'
    CHECK (status IN ('development', 'testing', 'pending_review', 'production', 'suspended')),

  -- Health monitoring
  last_health_check_at TEXT,
  health_status TEXT DEFAULT 'unknown'
    CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
  last_error TEXT,

  -- Audit
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  -- Constraints
  UNIQUE(developer_id, provider, integration_id)
);

CREATE INDEX idx_developer_oauth_apps_developer ON developer_oauth_apps(developer_id);
CREATE INDEX idx_developer_oauth_apps_provider ON developer_oauth_apps(provider);
CREATE INDEX idx_developer_oauth_apps_status ON developer_oauth_apps(status);
```

### Update: `marketplace_integrations`

```sql
ALTER TABLE marketplace_integrations ADD COLUMN
  credential_mode TEXT DEFAULT 'system'
  CHECK (credential_mode IN ('system', 'developer', 'hybrid'));

-- 'system'    = Always use WORKWAY's OAuth app
-- 'developer' = Always use developer's OAuth app
-- 'hybrid'    = Use developer's if available, fallback to system
```

### Update: `user_installations`

```sql
ALTER TABLE user_installations ADD COLUMN
  credential_source TEXT DEFAULT 'system'
  CHECK (credential_source IN ('system', 'developer'));
```

---

## API Endpoints

### Developer Credential Management

```
POST   /developers/:developerId/oauth-apps
GET    /developers/:developerId/oauth-apps
GET    /developers/:developerId/oauth-apps/:provider
PUT    /developers/:developerId/oauth-apps/:provider
DELETE /developers/:developerId/oauth-apps/:provider
POST   /developers/:developerId/oauth-apps/:provider/test
POST   /developers/:developerId/oauth-apps/:provider/promote
```

### Endpoint Details

#### `POST /developers/:developerId/oauth-apps`
Create a new OAuth app credential.

**Request:**
```json
{
  "provider": "zoom",
  "client_id": "abc123...",
  "client_secret": "secret...",
  "redirect_uri": "https://custom.domain/callback",
  "scopes": ["meeting:read", "recording:read"],
  "integration_id": "int_xxx"  // Optional: link to specific integration
}
```

**Response:**
```json
{
  "id": "doa_xxx",
  "provider": "zoom",
  "client_id": "abc123...",
  "status": "development",
  "health_status": "unknown",
  "scopes": ["meeting:read", "recording:read"],
  "created_at": "2025-12-06T..."
}
```

#### `POST /developers/:developerId/oauth-apps/:provider/test`
Test OAuth app credentials by initiating a test OAuth flow.

**Response:**
```json
{
  "success": true,
  "test_auth_url": "https://api.workway.co/oauth/zoom/authorize?mode=developer_test&...",
  "expires_in": 300
}
```

#### `POST /developers/:developerId/oauth-apps/:provider/promote`
Request promotion from development to production status.

**Request:**
```json
{
  "target_status": "pending_review",
  "justification": "Integration ready for marketplace"
}
```

---

## Credential Resolution Service

### New Module: `credential-resolver.ts`

```typescript
// /apps/api/src/services/credential-resolver.ts

import { Env } from '../types/env';

export interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  source: 'system' | 'developer';
  developerId?: string;
}

export interface CredentialResolverOptions {
  userId: string;
  provider: string;
  integrationId?: string;
  installationId?: string;
}

/**
 * Resolves OAuth credentials based on context.
 * Priority: Developer credentials > System credentials
 *
 * Zuhandenheit: This service is invisible during normal operation.
 * It only becomes visible (Vorhandenheit) when credentials are missing or invalid.
 */
export async function resolveCredentials(
  env: Env,
  options: CredentialResolverOptions
): Promise<OAuthCredentials> {
  const { userId, provider, integrationId, installationId } = options;

  // 1. Check if installation specifies credential source
  if (installationId) {
    const installation = await getInstallation(env, installationId);
    if (installation?.credential_source === 'developer') {
      const devCreds = await getDeveloperCredentials(env, installation.integration_id, provider);
      if (devCreds) {
        return formatCredentials(devCreds, 'developer');
      }
    }
  }

  // 2. Check integration's credential mode
  if (integrationId) {
    const integration = await getIntegration(env, integrationId);

    if (integration?.credential_mode === 'developer') {
      const devCreds = await getDeveloperCredentials(env, integrationId, provider);
      if (devCreds) {
        return formatCredentials(devCreds, 'developer');
      }
      // Fail hard if developer mode but no credentials
      throw new CredentialError('DEVELOPER_CREDENTIALS_REQUIRED', provider);
    }

    if (integration?.credential_mode === 'hybrid') {
      const devCreds = await getDeveloperCredentials(env, integrationId, provider);
      if (devCreds) {
        return formatCredentials(devCreds, 'developer');
      }
      // Fall through to system credentials
    }
  }

  // 3. Use system credentials (default)
  return getSystemCredentials(env, provider);
}

async function getDeveloperCredentials(
  env: Env,
  integrationId: string,
  provider: string
): Promise<DecryptedCredentials | null> {
  const result = await env.DB.prepare(`
    SELECT
      doa.client_id,
      doa.client_secret_encrypted,
      doa.encryption_key_id,
      doa.redirect_uri,
      doa.scopes,
      doa.status,
      doa.developer_id
    FROM developer_oauth_apps doa
    JOIN marketplace_integrations mi ON doa.integration_id = mi.id
    WHERE doa.integration_id = ?
      AND doa.provider = ?
      AND doa.status IN ('development', 'testing', 'production')
  `).bind(integrationId, provider).first();

  if (!result) return null;

  // Decrypt client secret
  const clientSecret = await decryptSecret(
    env,
    result.client_secret_encrypted,
    result.encryption_key_id
  );

  return {
    clientId: result.client_id,
    clientSecret,
    redirectUri: result.redirect_uri,
    scopes: JSON.parse(result.scopes || '[]'),
    developerId: result.developer_id,
  };
}

function getSystemCredentials(env: Env, provider: string): OAuthCredentials {
  const config = OAUTH_CONFIGS[provider];
  if (!config) {
    throw new CredentialError('UNKNOWN_PROVIDER', provider);
  }

  return {
    clientId: env[`${provider.toUpperCase()}_CLIENT_ID`],
    clientSecret: env[`${provider.toUpperCase()}_CLIENT_SECRET`],
    redirectUri: config.redirectUri,
    scopes: config.scopes,
    source: 'system',
  };
}
```

---

## Encryption Service

### Secret Encryption with Key Rotation

```typescript
// /apps/api/src/services/encryption.ts

import { Env } from '../types/env';

interface EncryptedPayload {
  ciphertext: string;   // Base64 encoded
  iv: string;           // Base64 encoded
  tag: string;          // Base64 encoded (for GCM)
  keyId: string;        // Which key was used
}

/**
 * Encrypts sensitive data using AES-256-GCM.
 * Keys are stored in Cloudflare KV with rotation support.
 */
export async function encryptSecret(
  env: Env,
  plaintext: string
): Promise<EncryptedPayload> {
  // Get current encryption key
  const keyId = await env.SECRETS_KV.get('current_key_id');
  const keyMaterial = await env.SECRETS_KV.get(`key:${keyId}`);

  if (!keyId || !keyMaterial) {
    throw new Error('Encryption key not configured');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    hexToBuffer(keyMaterial),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  return {
    ciphertext: bufferToBase64(ciphertext.slice(0, -16)),
    iv: bufferToBase64(iv),
    tag: bufferToBase64(ciphertext.slice(-16)),
    keyId,
  };
}

export async function decryptSecret(
  env: Env,
  encrypted: string,
  keyId: string
): Promise<string> {
  const payload: EncryptedPayload = JSON.parse(encrypted);
  const keyMaterial = await env.SECRETS_KV.get(`key:${keyId}`);

  if (!keyMaterial) {
    throw new Error(`Encryption key ${keyId} not found - key rotation issue?`);
  }

  const key = await crypto.subtle.importKey(
    'raw',
    hexToBuffer(keyMaterial),
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const ciphertext = new Uint8Array([
    ...base64ToBuffer(payload.ciphertext),
    ...base64ToBuffer(payload.tag),
  ]);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBuffer(payload.iv) },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}
```

---

## OAuth Flow Modifications

### Update: `/oauth/:provider/authorize`

```typescript
// Modify existing authorize endpoint to support BYOO

app.post('/oauth/:provider/authorize', async (c) => {
  const { provider } = c.req.param();
  const userId = c.get('userId');
  const { integrationId, installationId, mode } = await c.req.json();

  // Resolve credentials based on context
  const credentials = await resolveCredentials(c.env, {
    userId,
    provider,
    integrationId,
    installationId,
  });

  // Build auth URL with resolved credentials
  const config = OAUTH_CONFIGS[provider];
  const state = generateSecureState();

  // Store state with credential source info
  await oauthDO.storeState(state, {
    userId,
    provider,
    integrationId,
    credentialSource: credentials.source,
    developerId: credentials.developerId,
  });

  const authUrl = buildAuthUrl({
    ...config,
    clientId: credentials.clientId,
    redirectUri: credentials.redirectUri,
    scopes: credentials.scopes,
    state,
  });

  return c.json({ authUrl, expiresIn: 600 });
});
```

### Update: `/oauth/:provider/callback`

```typescript
// Modify callback to use correct credentials for token exchange

app.get('/oauth/:provider/callback', async (c) => {
  const { provider } = c.req.param();
  const { code, state } = c.req.query();

  // Retrieve state (includes credential source info)
  const stateData = await oauthDO.getState(state);
  if (!stateData) {
    return redirectWithError('invalid_state');
  }

  // Resolve credentials matching the authorize flow
  const credentials = await resolveCredentials(c.env, {
    userId: stateData.userId,
    provider,
    integrationId: stateData.integrationId,
  });

  // Exchange code for tokens using correct credentials
  const tokens = await exchangeCodeForTokens({
    provider,
    code,
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    redirectUri: credentials.redirectUri,
  });

  // Store tokens with credential source metadata
  const tokenKey = buildTokenKey(stateData.userId, provider, credentials.source);
  await oauthDO.storeTokens(tokenKey, tokens);

  // Update installation with credential source
  if (stateData.installationId) {
    await updateInstallationCredentialSource(
      c.env,
      stateData.installationId,
      credentials.source
    );
  }

  return redirectToSuccess();
});
```

---

## Developer Settings UI

### New Page: `/developer/settings/oauth-apps`

```tsx
// apps/web/src/routes/developer.settings.oauth-apps.tsx

function DeveloperOAuthApps() {
  const { developerId } = useAuth();
  const { data: oauthApps } = useQuery(['oauth-apps', developerId]);

  return (
    <div className="space-y-8">
      <div>
        <BrandHeading level={2}>OAuth App Credentials</BrandHeading>
        <p className="text-white/60 mt-2">
          Use your own OAuth apps for development and testing.
          Your credentials are encrypted and isolated from WORKWAY's system credentials.
        </p>
      </div>

      {/* Provider Cards */}
      <div className="grid gap-4">
        {SUPPORTED_PROVIDERS.map(provider => (
          <OAuthAppCard
            key={provider.id}
            provider={provider}
            credential={oauthApps?.find(a => a.provider === provider.id)}
            onConfigure={() => openConfigModal(provider)}
            onTest={() => testCredential(provider.id)}
            onDelete={() => deleteCredential(provider.id)}
          />
        ))}
      </div>

      {/* Security Notice */}
      <div className="border border-white/10 p-4">
        <div className="flex gap-3">
          <Shield className="w-5 h-5 text-white/60 flex-shrink-0" />
          <div>
            <p className="text-white/80 text-sm font-medium">Security</p>
            <p className="text-white/60 text-sm mt-1">
              Client secrets are encrypted with AES-256-GCM.
              They are never exposed in API responses or logs.
              You can delete credentials at any time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Production Pathway

### Status Lifecycle

```
                    ┌─────────────────┐
                    │   development   │
                    │  (default)      │
                    └────────┬────────┘
                             │
                    Developer tests locally
                             │
                             ▼
                    ┌─────────────────┐
                    │    testing      │
                    │  (self-serve)   │
                    └────────┬────────┘
                             │
                    Developer submits for review
                             │
                             ▼
                    ┌─────────────────┐
                    │ pending_review  │
                    │ (WORKWAY team)  │
                    └────────┬────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
           ▼                 ▼                 ▼
    ┌──────────┐      ┌──────────┐      ┌──────────┐
    │production│      │ rejected │      │suspended │
    │          │      │          │      │          │
    └──────────┘      └──────────┘      └──────────┘
```

### Review Checklist

Before promotion to production, WORKWAY reviews:

1. **OAuth App Verification**: Is the app verified with the provider (Google, Zoom)?
2. **Scope Justification**: Are requested scopes necessary?
3. **Privacy Policy**: Does developer have adequate privacy policy?
4. **Security Posture**: Any red flags in usage patterns?
5. **Rate Limit History**: Has the app hit rate limits excessively?

---

## Health Monitoring

### Automated Health Checks

```typescript
// Cron job: every 15 minutes
async function checkOAuthAppHealth(env: Env) {
  const apps = await env.DB.prepare(`
    SELECT id, provider, client_id, developer_id
    FROM developer_oauth_apps
    WHERE status IN ('testing', 'production')
  `).all();

  for (const app of apps.results) {
    try {
      // Attempt token introspection or lightweight API call
      const health = await checkProviderHealth(app.provider, app.client_id);

      await env.DB.prepare(`
        UPDATE developer_oauth_apps
        SET health_status = ?, last_health_check_at = datetime('now'), last_error = NULL
        WHERE id = ?
      `).bind(health.status, app.id).run();

    } catch (error) {
      await env.DB.prepare(`
        UPDATE developer_oauth_apps
        SET health_status = 'unhealthy',
            last_health_check_at = datetime('now'),
            last_error = ?
        WHERE id = ?
      `).bind(error.message, app.id).run();

      // Notify developer if previously healthy
      await notifyDeveloperOfHealthIssue(env, app.developer_id, app.provider, error);
    }
  }
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1) ✅ COMPLETE
- [x] Database schema migration (`workway-platform/apps/api/migrations/0038_developer_oauth_apps.sql`)
- [x] Encryption service (API: `services/encryption.ts`, SDK: `packages/sdk/src/encryption.ts`)
- [x] Developer OAuth apps CRUD API (`workway-platform/apps/api/src/routes/developer-oauth-apps.ts`)
- [x] Basic credential resolution (`workway-platform/apps/api/src/services/credential-resolver.ts`)
- [x] BYOO types and provider configs (`packages/sdk/src/byoo.ts`)
- [x] Unit tests (`packages/sdk/src/encryption.test.ts`)

### Phase 2: OAuth Integration (Week 2) ✅ COMPLETE
- [x] Credential resolver integrated with OAuth flows
- [x] Developer test endpoint (`POST /developers/:id/oauth-apps/:provider/test`)
- [x] Promotion endpoint (`POST /developers/:id/oauth-apps/:provider/promote`)

### Phase 3: UI & UX (Week 3)
- [ ] Developer settings OAuth apps page
- [ ] Status indicators and health display
- [ ] Configuration modals

### Phase 4: Production Pathway (Week 4)
- [ ] Review workflow
- [ ] Health monitoring cron
- [ ] Admin review interface
- [ ] Promotion/suspension APIs

---

## Security Considerations

### Encryption
- AES-256-GCM for all secrets
- Key rotation support (keyId tracking)
- Keys stored in separate KV namespace

### Isolation
- Developer credentials NEVER touch system credentials
- Separate token storage keys per credential source
- Database-level isolation by developer_id

### Access Control
- Only credential owner can view/modify
- Admin can suspend but not view secrets
- Audit log all credential operations

### Revocation
- Instant revocation deletes encrypted secrets
- Tokens using revoked credentials invalidated
- Webhook to notify affected users

---

## Rollback Plan

If issues arise:
1. Set `credential_mode = 'system'` for affected integrations
2. Developer credentials remain encrypted but unused
3. All users fall back to system credentials automatically

No data loss - developer credentials can be re-enabled later.

---

## Success Metrics

1. **Adoption**: # developers using BYOO
2. **Health**: % healthy developer credentials
3. **Velocity**: Time from BYOO setup to first successful OAuth flow
4. **Production**: # credentials promoted to production
5. **Support**: Reduction in "WORKWAY doesn't support X scope" tickets
