# Private Workflows

## Zuhandenheit: The Tool Must Recede

Private workflows enable two outcomes:
- **Internal team tools** — Company uses their own OAuth credentials
- **Premium/exclusive workflows** — Developers sell directly without marketplace competition

The visibility setting recedes into the background. Users either have access or they don't.

## Visibility Modes

| Mode | Marketplace | Direct Link | Use Case |
|------|-------------|-------------|----------|
| `public` | Visible | Works | Standard marketplace workflow |
| `private` | Hidden | Requires access grant | Internal tools, premium offerings |
| `unlisted` | Hidden | Works | Beta testing, soft launches |

## BYOO: Bring Your Own OAuth

Private workflows typically require developer credentials because:
1. **Gmail/Google Workspace** — Google requires domain verification for OAuth apps accessing user data
2. **Enterprise compliance** — Corporate policies require organization-owned OAuth apps
3. **Rate limit isolation** — Developer's app has separate rate limits from WORKWAY's

### Credential Modes

| Mode | Description |
|------|-------------|
| `system` | Uses WORKWAY's OAuth credentials (default) |
| `developer` | Requires developer's BYOO credentials |
| `hybrid` | User chooses at install time |

## Access Grants

Private workflows can be shared via three methods:

### 1. User Grant
Grant access to specific users by user ID.

```typescript
{
  grantType: 'user',
  grantValue: 'usr_abc123',
}
```

### 2. Email Domain Grant
Grant access to all users with a specific email domain (for enterprise).

```typescript
{
  grantType: 'email_domain',
  grantValue: 'acme.com',
}
```

### 3. Access Code
Generate a shareable code that anyone can redeem.

```typescript
{
  grantType: 'access_code',
  grantValue: 'PREMIUM2024',
  maxInstalls: 100,        // Optional limit
  expiresAt: '2024-12-31', // Optional expiration
}
```

## Use Cases

### Internal Gmail → Notion Workflow

A company wants to sync specific Gmail labels to Notion for their team.

1. Developer creates workflow with `visibility: 'private'`
2. Developer registers their own Gmail OAuth app in Google Cloud Console
3. Developer adds BYOO credentials to WORKWAY
4. Developer creates email domain grant for `@acme.com`
5. Team members install via direct link
6. Each team member authorizes with company's Google OAuth app

**Why this works:**
- Google's OAuth verification process is satisfied (company-owned app)
- All team members under one rate limit bucket
- IT maintains control over data access

### Premium Workflow Sale

A developer builds a sophisticated multi-step workflow and wants to sell it at a premium without marketplace competition.

1. Developer creates workflow with `visibility: 'private'`
2. Developer sets `credential_mode: 'system'` (uses WORKWAY OAuth)
3. Developer generates unique access codes for each customer
4. Customer redeems code → gets access to install
5. Developer keeps 100% of their upfront fee (no marketplace discovery cost)

**Why this works:**
- No marketplace competition on price
- Direct relationship with customer
- Can charge premium for exclusivity

## Database Schema

### marketplace_integrations (new columns)

```sql
ALTER TABLE marketplace_integrations ADD COLUMN visibility TEXT DEFAULT 'public'
  CHECK (visibility IN ('public', 'private', 'unlisted'));

ALTER TABLE marketplace_integrations ADD COLUMN credential_mode TEXT DEFAULT 'system'
  CHECK (credential_mode IN ('system', 'developer', 'hybrid'));
```

### workflow_access_grants (new table)

```sql
CREATE TABLE workflow_access_grants (
  id TEXT PRIMARY KEY,
  integration_id TEXT NOT NULL,
  grant_type TEXT NOT NULL CHECK (grant_type IN ('user', 'email_domain', 'access_code')),
  grant_value TEXT NOT NULL,
  max_installs INTEGER,
  expires_at INTEGER,
  granted_by TEXT NOT NULL,
  notes TEXT,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER,
  FOREIGN KEY (integration_id) REFERENCES marketplace_integrations(id)
);
```

### workflow_access_redemptions (new table)

```sql
CREATE TABLE workflow_access_redemptions (
  id TEXT PRIMARY KEY,
  grant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  installation_id TEXT,
  redeemed_at INTEGER NOT NULL,
  FOREIGN KEY (grant_id) REFERENCES workflow_access_grants(id)
);
```

## API Endpoints

### Check Access

```
GET /api/marketplace/{integrationId}/access
```

Returns whether current user has access to the workflow.

### Redeem Access Code

```
POST /api/marketplace/{integrationId}/redeem
{
  "accessCode": "PREMIUM2024"
}
```

### Manage Grants (Developer Only)

```
GET /api/developer/workflows/{integrationId}/grants
POST /api/developer/workflows/{integrationId}/grants
DELETE /api/developer/workflows/{integrationId}/grants/{grantId}
```

## Weniger, aber besser

Three visibility modes. Three grant types. That's all.

No complex ACLs. No role hierarchies. No permission matrices.

Private workflows either work for you or they don't.
