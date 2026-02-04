# Procore OAuth Setup Guide

Step-by-step guide for setting up Procore OAuth integration with WORKWAY Construction MCP.

## Overview

WORKWAY Construction MCP uses OAuth 2.0 to securely connect to your Procore account. This guide walks you through:

1. Creating a Procore Developer account
2. Creating an OAuth application
3. Configuring the callback URL
4. Connecting WORKWAY to Procore
5. Testing the connection

**Estimated time:** 10-15 minutes

---

## Prerequisites

- Procore account with admin or developer access
- Access to Procore Developer Portal
- WORKWAY Construction MCP server deployed

---

## Step 1: Create Procore Developer Account

1. **Visit Procore Developer Portal:**
   - Go to [https://developers.procore.com](https://developers.procore.com)

2. **Sign up or log in:**
   - If you don't have an account, click "Sign Up"
   - Use your Procore company email
   - Complete registration

3. **Verify email:**
   - Check your email for verification link
   - Click to verify your account

---

## Step 2: Create OAuth Application

1. **Navigate to Applications:**
   - In the Developer Portal, go to "Applications"
   - Click "Create Application"

2. **Fill in application details:**
   - **Application Name:** `WORKWAY Construction MCP` (or your preferred name)
   - **Description:** `AI-native workflow automation for construction`
   - **Application Type:** Select `Web Application`

3. **Configure redirect URI:**
   - **Redirect URI:** `https://workway-construction-mcp.workers.dev/oauth/callback`
   - ⚠️ **Important:** This must match exactly (no trailing slash, correct protocol)

4. **Select scopes:**
   - Minimum required scopes:
     - `read:projects` - Read project information
     - `read:rfis` - Read RFIs
     - `write:rfis` - Create/update RFI responses
     - `read:daily_logs` - Read daily logs
     - `write:daily_logs` - Create daily logs
     - `read:submittals` - Read submittals
   - Select additional scopes based on your workflow needs

5. **Save application:**
   - Click "Create Application"
   - **Important:** Copy the **Client ID** and **Client Secret**
   - Store these securely (you'll need them for MCP server configuration)

---

## Step 3: Configure MCP Server

1. **Set environment variables:**
   ```bash
   # Set Procore OAuth credentials
   wrangler secret put PROCORE_CLIENT_ID
   # Paste your Client ID when prompted
   
   wrangler secret put PROCORE_CLIENT_SECRET
   # Paste your Client Secret when prompted
   ```

2. **Set cookie encryption key:**
   ```bash
   # Generate a secure random key (32 bytes)
   openssl rand -hex 32
   
   wrangler secret put COOKIE_ENCRYPTION_KEY
   # Paste the generated key when prompted
   ```

3. **Verify configuration:**
   - Check `wrangler.toml` has correct database bindings
   - Ensure D1 database is created and migrated
   - Run migrations: `pnpm migrate:remote`

---

## Step 4: Connect WORKWAY to Procore

1. **Initiate OAuth connection:**
   ```json
   {
     "tool": "workway_connect_procore",
     "params": {
       "company_id": "your-procore-company-id"  // Optional
     }
   }
   ```

2. **Get authorization URL:**
   - Response includes `authorization_url`
   - Example:
     ```
     https://login.procore.com/oauth/authorize?client_id=...&redirect_uri=...&response_type=code&state=...
     ```

3. **Authorize application:**
   - Open the `authorization_url` in your browser
   - Log in to Procore (if not already logged in)
   - Review requested permissions
   - Click "Authorize" or "Allow"

4. **Complete OAuth flow:**
   - You'll be redirected to the callback URL
   - The MCP server will exchange the authorization code for tokens
   - Connection is complete when you see success message

---

## Step 5: Verify Connection

1. **Check connection status:**
   ```json
   {
     "tool": "workway_check_procore_connection",
     "params": {}
   }
   ```

2. **Expected response:**
   ```json
   {
     "connected": true,
     "token_expires_at": "2026-02-10T10:00:00Z",
     "scopes": ["read:projects", "read:rfis", "write:rfis"],
     "company_name": "Your Company Name",
     "last_used": "2026-02-03T09:00:00Z"
   }
   ```

3. **Test with list projects:**
   ```json
   {
     "tool": "workway_list_procore_projects",
     "params": {}
   }
   ```
   - Should return list of projects you have access to

---

## Troubleshooting

### Issue: "Invalid redirect URI" error

**Cause:** Redirect URI in Procore app doesn't match callback URL

**Solution:**
1. Check Procore app settings
2. Ensure redirect URI is exactly: `https://workway-construction-mcp.workers.dev/oauth/callback`
3. No trailing slash, correct protocol (https)
4. Update and save in Procore Developer Portal

---

### Issue: "Invalid OAuth state" error

**Cause:** OAuth state expired or mismatch

**Solution:**
1. OAuth state expires after 10 minutes
2. Complete OAuth flow immediately after getting authorization URL
3. Don't refresh or bookmark the authorization URL
4. Get new authorization URL and retry

---

### Issue: "Token exchange failed" error

**Cause:** Invalid client credentials or callback mismatch

**Solution:**
1. Verify `PROCORE_CLIENT_ID` and `PROCORE_CLIENT_SECRET` are set correctly
2. Check Procore app callback URL matches exactly
3. Ensure secrets are set in correct environment (dev vs production)
4. Check Procore Developer Portal for app status

---

### Issue: Connection shows but API calls fail

**Cause:** Insufficient scopes or permissions

**Solution:**
1. Check `workway_check_procore_connection` for scopes
2. Verify required scopes are selected in Procore app
3. Reconnect with correct scopes if needed
4. Check Procore user permissions for projects

---

### Issue: Token expired

**Cause:** OAuth token expired (tokens typically expire after period of inactivity)

**Solution:**
1. Tokens should auto-refresh, but if refresh fails:
2. Reconnect using `workway_connect_procore`
3. Complete OAuth flow again
4. Check token expiration in connection status

---

## Security Best Practices

1. **Protect Client Secret:**
   - Never commit `PROCORE_CLIENT_SECRET` to version control
   - Use `wrangler secret put` for all secrets
   - Rotate secrets periodically

2. **Limit Scopes:**
   - Only request scopes you actually need
   - Review scopes regularly
   - Remove unused scopes

3. **Monitor Access:**
   - Review OAuth connections periodically
   - Check token expiration dates
   - Revoke access if compromised

4. **Use HTTPS:**
   - Always use HTTPS for callback URLs
   - Verify SSL certificates
   - Don't use HTTP in production

---

## Multiple Environments

If running multiple environments (dev, staging, production):

1. **Create separate Procore apps:**
   - One app per environment
   - Use environment-specific names
   - Different callback URLs per environment

2. **Set environment-specific secrets:**
   ```bash
   # Development
   wrangler secret put PROCORE_CLIENT_ID --env dev
   
   # Production
   wrangler secret put PROCORE_CLIENT_ID --env production
   ```

3. **Update callback URLs:**
   - Dev: `https://workway-construction-mcp-dev.workers.dev/oauth/callback`
   - Prod: `https://workway-construction-mcp.workers.dev/oauth/callback`

---

## Next Steps

After connecting Procore:

1. **List projects:**
   ```json
   {
     "tool": "workway_list_procore_projects",
     "params": {}
   }
   ```

2. **Test RFI access:**
   ```json
   {
     "tool": "workway_get_procore_rfis",
     "params": {
       "project_id": 12345,
       "status": "open"
     }
   }
   ```

3. **Create your first workflow:**
   - See [API_REFERENCE.md](./API_REFERENCE.md) for examples
   - Start with RFI automation workflow
   - Test with `workway_test` before deploying

---

## Additional Resources

- [Procore API Documentation](https://developers.procore.com/documentation)
- [OAuth 2.0 Specification](https://oauth.net/2/)
- [WORKWAY API Reference](./API_REFERENCE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)

---

## Support

If you encounter issues not covered here:

1. Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. Review [ERROR_CODES.md](./ERROR_CODES.md)
3. Use `workway_diagnose` tool for automated diagnosis
4. Contact support with:
   - Procore app configuration (screenshot)
   - Error messages
   - Steps to reproduce
