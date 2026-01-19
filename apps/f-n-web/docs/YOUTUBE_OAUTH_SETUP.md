# YouTube OAuth Setup

This guide explains how to set up YouTube OAuth integration for the F→N web application.

## Overview

The YouTube OAuth integration allows users to connect their YouTube accounts to sync playlists to Notion. It follows the same pattern as the Notion OAuth integration, using:

- **OAuth 2.0 Authorization Code Flow**
- **Cloudflare KV** for state storage (CSRF protection)
- **Cloudflare D1** for persistent token storage

## Architecture

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/integrations/youtube` | GET | Initiates OAuth flow, redirects to Google OAuth |
| `/api/integrations/youtube/callback` | GET | Handles OAuth callback, stores tokens |
| `/api/integrations/youtube/disconnect` | POST | Removes YouTube connection |

### OAuth Flow

```
1. User clicks "Connect YouTube" in dashboard
   ↓
2. GET /api/integrations/youtube
   - Generate CSRF state token
   - Store state in KV (10min expiration)
   - Redirect to Google OAuth
   ↓
3. User authorizes on Google
   ↓
4. Google redirects to /api/integrations/youtube/callback?code=...&state=...
   - Verify state token (CSRF protection)
   - Exchange code for access token + refresh token
   - Store tokens in D1 connected_accounts table
   - Redirect to dashboard with success message
   ↓
5. YouTube connection ready for use
```

## Google Cloud Console Setup

### Step 1: Create OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. If prompted, configure the OAuth consent screen:
   - **User Type**: External (for testing) or Internal (for organization-only)
   - **App name**: "F→N - Fireflies to Notion"
   - **User support email**: Your email
   - **Developer contact**: Your email
   - **Scopes**: Add `https://www.googleapis.com/auth/youtube.readonly`
6. Select **Application type**: Web application
7. **Name**: "F→N Production"
8. **Authorized redirect URIs**:
   - Production: `https://fn.workway.co/api/integrations/youtube/callback`
   - Development: `http://localhost:5173/api/integrations/youtube/callback`
9. Click **Create**
10. Copy the **Client ID** and **Client Secret**

### Step 2: Enable YouTube Data API v3

1. In Google Cloud Console, go to **APIs & Services** → **Library**
2. Search for "YouTube Data API v3"
3. Click **Enable**

## Cloudflare Configuration

### Set Environment Variables (Production)

```bash
cd apps/f-n-web

# Set YouTube Client ID
wrangler pages secret put YOUTUBE_CLIENT_ID
# Paste the Client ID from Google Cloud Console

# Set YouTube Client Secret
wrangler pages secret put YOUTUBE_CLIENT_SECRET
# Paste the Client Secret from Google Cloud Console
```

### Local Development

For local development, add to `apps/f-n-web/.dev.vars`:

```env
YOUTUBE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
YOUTUBE_CLIENT_SECRET="your-client-secret"
```

**Important**: Never commit `.dev.vars` to git. It's in `.gitignore` by default.

## Database Schema

The YouTube integration uses the existing `connected_accounts` table schema:

```sql
CREATE TABLE connected_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,              -- 'youtube'
  access_token TEXT NOT NULL,          -- OAuth access token
  refresh_token TEXT,                  -- OAuth refresh token (for token refresh)
  workspace_name TEXT,                 -- Not used for YouTube
  workspace_id TEXT,                   -- Not used for YouTube
  expires_at TEXT,                     -- Token expiration timestamp
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, provider),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Token Expiration

- Google OAuth access tokens expire after **1 hour** (`expires_in: 3600`)
- Refresh tokens are long-lived (no expiration unless revoked)
- The callback endpoint calculates `expires_at` timestamp for future token refresh logic

## Security Considerations

### CSRF Protection

The OAuth flow uses state tokens to prevent CSRF attacks:

1. Generate random UUID state token
2. Store state + user context in KV (10min TTL)
3. Include state in OAuth URL
4. Google returns state in callback
5. Verify state matches stored value
6. Delete state after verification (single-use)

### Token Storage

- Access tokens stored in D1 `connected_accounts.access_token`
- Refresh tokens stored in D1 `connected_accounts.refresh_token`
- Both are encrypted at rest by Cloudflare D1
- Tokens are scoped to `youtube.readonly` (read-only access)

### OAuth Scopes

Current scope: `https://www.googleapis.com/auth/youtube.readonly`

This grants read-only access to:
- YouTube playlists
- Video metadata
- Channel information

**Note**: Does not grant permission to:
- Modify playlists
- Upload videos
- Post comments
- Access YouTube Analytics

## Testing

### Manual Test Flow

1. Start local development server:
   ```bash
   cd apps/f-n-web
   pnpm dev
   ```

2. Navigate to dashboard: `http://localhost:5173/dashboard`

3. Click "Connect YouTube" button (needs UI implementation)

4. Verify redirect to Google OAuth consent screen

5. Authorize the application

6. Verify callback redirect to dashboard with success message

7. Check D1 database for stored connection:
   ```bash
   wrangler d1 execute f-n-production --local --command \
     "SELECT provider, expires_at FROM connected_accounts WHERE provider='youtube'"
   ```

### Automated Tests

TODO: Add integration tests for OAuth flow

## Integration with YouTube Playlist Sync

Once connected, the YouTube access token can be used to:

1. List user's playlists: `GET https://www.googleapis.com/youtube/v3/playlists`
2. Get playlist items: `GET https://www.googleapis.com/youtube/v3/playlistItems`
3. Get video details: `GET https://www.googleapis.com/youtube/v3/videos`

See [YouTube Data API v3 Documentation](https://developers.google.com/youtube/v3) for full API reference.

## Troubleshooting

### Error: `youtube_not_configured`

**Cause**: Missing `YOUTUBE_CLIENT_ID` or `YOUTUBE_CLIENT_SECRET` environment variables.

**Fix**: Set secrets via `wrangler pages secret put` (see Configuration section above).

### Error: `invalid_state`

**Cause**: CSRF state token expired (>10 minutes) or invalid.

**Fix**: Restart OAuth flow. This is expected behavior for security.

### Error: `token_exchange_failed`

**Cause**: Invalid authorization code or OAuth credentials.

**Fix**:
1. Verify Client ID and Client Secret match Google Cloud Console
2. Ensure redirect URI matches exactly (including trailing slash)
3. Check Google Cloud Console for API errors

### Token Refresh (Future Implementation)

YouTube access tokens expire after 1 hour. To implement automatic token refresh:

1. Check `expires_at` before making API calls
2. If expired, use `refresh_token` to get new access token:
   ```typescript
   const response = await fetch('https://oauth2.googleapis.com/token', {
     method: 'POST',
     body: new URLSearchParams({
       grant_type: 'refresh_token',
       refresh_token: stored_refresh_token,
       client_id: YOUTUBE_CLIENT_ID,
       client_secret: YOUTUBE_CLIENT_SECRET
     })
   });
   ```
3. Update `access_token` and `expires_at` in D1

## References

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [YouTube Data API v3](https://developers.google.com/youtube/v3)
- [OAuth 2.0 Scopes for Google APIs](https://developers.google.com/identity/protocols/oauth2/scopes#youtube)
