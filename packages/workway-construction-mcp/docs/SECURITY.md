# WORKWAY Construction MCP - Security Best Practices

Security guidelines for deploying and using the WORKWAY Construction MCP server.

## Overview

This document covers security best practices for:

- OAuth token management
- Secret management
- API security
- Data protection
- Access control

---

## OAuth Token Security

### Token Storage

OAuth tokens are stored encrypted in D1 database:

```sql
-- Tokens stored with encryption
CREATE TABLE oauth_tokens (
  access_token TEXT NOT NULL,  -- Encrypted
  refresh_token TEXT,           -- Encrypted
  expires_at TEXT,
  ...
);
```

### Token Refresh

- Tokens automatically refresh before expiration
- Refresh tokens stored securely
- Failed refreshes trigger re-authentication

### Token Rotation

**Best Practices:**

1. **Regular Rotation:**
   - Rotate tokens periodically (e.g., every 90 days)
   - Re-authenticate to get fresh tokens
   - Revoke old tokens in Procore

2. **Immediate Revocation:**
   - Revoke tokens if compromised
   - Use Procore Developer Portal to revoke
   - Reconnect to get new tokens

3. **Scope Minimization:**
   - Request only necessary scopes
   - Review scopes regularly
   - Remove unused scopes

---

## Secret Management

### Environment Variables

**Never commit secrets to version control:**

```bash
# ❌ Bad: Hardcoded in code
const CLIENT_SECRET = "abc123...";

# ✅ Good: Environment variable
const CLIENT_SECRET = env.PROCORE_CLIENT_SECRET;
```

### Wrangler Secrets

Use `wrangler secret put` for all secrets:

```bash
# Set secrets
wrangler secret put PROCORE_CLIENT_ID
wrangler secret put PROCORE_CLIENT_SECRET
wrangler secret put COOKIE_ENCRYPTION_KEY

# List secrets (names only, not values)
wrangler secret list

# Delete secrets
wrangler secret delete PROCORE_CLIENT_SECRET
```

### Secret Generation

Generate secure random keys:

```bash
# Generate 32-byte hex key
openssl rand -hex 32

# Generate base64 key
openssl rand -base64 32
```

### Secret Rotation

**Rotation Procedure:**

1. Generate new secret
2. Update secret in Wrangler
3. Restart worker (automatic on deploy)
4. Verify functionality
5. Delete old secret (if needed)

---

## API Security

### HTTPS Only

**Always use HTTPS:**

```bash
# ✅ Good
https://workway-construction-mcp.workers.dev

# ❌ Bad
http://workway-construction-mcp.workers.dev
```

### CORS Configuration

CORS is configured for MCP clients:

```typescript
app.use('*', cors({
  origin: '*',  // Configure for production
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));
```

**Production Recommendations:**

- Restrict `origin` to known MCP clients
- Use allowlist instead of wildcard
- Review CORS headers regularly

### Input Validation

All inputs are validated with Zod schemas:

```typescript
const inputSchema = z.object({
  workflow_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  // ...
});
```

**Validation Best Practices:**

1. Validate all inputs
2. Sanitize user-provided data
3. Reject malformed requests
4. Log validation failures

### SQL Injection Prevention

Use parameterized queries:

```typescript
// ✅ Good: Parameterized
await env.DB.prepare(`
  SELECT * FROM workflows WHERE id = ?
`).bind(workflowId).first();

// ❌ Bad: String concatenation
await env.DB.prepare(`
  SELECT * FROM workflows WHERE id = '${workflowId}'
`).first();
```

---

## Data Protection

### Encryption at Rest

- OAuth tokens encrypted in database
- Sensitive data encrypted before storage
- Encryption keys stored as secrets

### Encryption in Transit

- All API calls use HTTPS
- OAuth flows use HTTPS
- Webhook endpoints use HTTPS

### Data Retention

**Retention Policies:**

- Execution logs: 30 days
- OAuth tokens: Until expiration/revocation
- Workflow configs: Until deletion
- RFI outcomes: Indefinite (for learning)

### Data Deletion

**Deletion Procedures:**

1. Delete workflow data:
   ```json
   {
     "tool": "workway_rollback_workflow",
     "params": {
       "workflow_id": "...",
       "action": "rollback"
     }
   }
   ```

2. Delete OAuth tokens:
   - Revoke in Procore Developer Portal
   - Delete from database

3. Export data before deletion:
   ```bash
   wrangler d1 export workway-construction --output backup.sql
   ```

---

## Access Control

### OAuth Scopes

**Principle of Least Privilege:**

- Request only necessary scopes
- Review scope requirements regularly
- Remove unused scopes

**Common Scopes:**

- `read:projects` - Read project info
- `read:rfis` - Read RFIs
- `write:rfis` - Create/update RFIs
- `read:daily_logs` - Read daily logs
- `write:daily_logs` - Create daily logs

### Workflow Access

**Access Control:**

- Workflows scoped to projects
- Users can only access their workflows
- Project-level permissions enforced

### API Access

**Authentication:**

- OAuth tokens required for Procore API
- MCP protocol handles authentication
- No API keys exposed to users

---

## Security Audit Checklist

### Pre-Deployment

- [ ] All secrets stored securely (not in code)
- [ ] HTTPS enabled for all endpoints
- [ ] CORS configured appropriately
- [ ] Input validation implemented
- [ ] SQL injection prevention verified
- [ ] OAuth scopes minimized
- [ ] Error messages don't leak sensitive data

### Post-Deployment

- [ ] Health endpoint accessible
- [ ] OAuth flow works correctly
- [ ] Tokens stored encrypted
- [ ] Rate limiting functional
- [ ] Error handling secure
- [ ] Logging doesn't expose secrets

### Ongoing

- [ ] Review access logs monthly
- [ ] Rotate secrets quarterly
- [ ] Review OAuth scopes quarterly
- [ ] Audit database access
- [ ] Monitor for suspicious activity
- [ ] Update dependencies regularly

---

## Incident Response

### Security Incident Procedure

1. **Identify:**
   - Detect security issue
   - Assess severity
   - Document details

2. **Contain:**
   - Revoke compromised tokens
   - Disable affected workflows
   - Isolate affected systems

3. **Remediate:**
   - Fix security vulnerability
   - Rotate compromised secrets
   - Update security controls

4. **Notify:**
   - Notify affected users
   - Report to Procore if needed
   - Document incident

5. **Review:**
   - Post-incident review
   - Update procedures
   - Improve security controls

### Compromised Token Response

If OAuth token is compromised:

1. **Immediate Actions:**
   ```bash
   # Revoke token in Procore Developer Portal
   # Delete token from database
   # Force re-authentication
   ```

2. **User Notification:**
   - Notify user of compromise
   - Request re-authentication
   - Review access logs

3. **Prevention:**
   - Review OAuth flow security
   - Implement token rotation
   - Add monitoring

---

## Compliance

### Data Privacy

- Follow GDPR/privacy regulations
- Implement data retention policies
- Provide data export capabilities
- Support data deletion requests

### Audit Logging

Log security-relevant events:

- OAuth token creation/refresh
- Workflow deployments
- Failed authentication attempts
- Rate limit violations
- Data access

---

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Cloudflare Security Best Practices](https://developers.cloudflare.com/workers/learning/security-best-practices/)
- [OAuth 2.0 Security Best Practices](https://oauth.net/2/oauth-best-practices/)
- [Procore Security Documentation](https://developers.procore.com/documentation/security)

---

## Security Contact

For security issues:

1. **Do not** create public issues
2. Contact security team directly
3. Provide detailed information
4. Allow time for response

---

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do not** disclose publicly
2. Contact: security@workway.co
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

4. **Response Time:**
   - Acknowledgment: 24 hours
   - Initial assessment: 72 hours
   - Resolution: Depends on severity
