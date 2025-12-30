# Privacy Policy for WORKWAY Zoom Sync Extension

**Last Updated:** December 30, 2025

## Overview

WORKWAY Zoom Sync ("the Extension") is a browser extension that enables the WORKWAY Meeting Intelligence workflow by syncing Zoom authentication cookies.

## Data Collection

### What We Collect

The Extension collects **only** the following data:
- Zoom session cookies from the `zoom.us` domain
- Your WORKWAY User ID (entered by you)

### What We Do NOT Collect

- Browsing history
- Personal information
- Data from any website other than zoom.us
- Zoom meeting content, recordings, or transcripts (these are accessed server-side after authentication)

## How Data Is Used

1. **Zoom Cookies**: Sent securely via HTTPS to `meetings.workway.co` to authenticate with Zoom on your behalf. This enables WORKWAY to access your Zoom recordings and extract meeting transcripts.

2. **User ID**: Stored locally in Chrome extension storage to identify your WORKWAY account.

## Data Storage

- **Local Storage**: Your User ID and sync timestamps are stored in Chrome's extension storage on your device.
- **Server Storage**: Zoom cookies are stored securely on Cloudflare's infrastructure (Durable Objects) and automatically expire after 24 hours.

## Data Sharing

We do not sell, trade, or share your data with third parties. Zoom cookies are used solely to authenticate with Zoom's website on your behalf.

## Data Retention

- Zoom cookies expire and are deleted after 24 hours
- Local extension data persists until you uninstall the extension or clear extension data

## Security

- All data transmission uses HTTPS encryption
- Cookies are stored in Cloudflare Durable Objects with per-user isolation
- No cookies are logged or stored in plaintext

## Your Rights

You can:
- Stop syncing at any time by not clicking "Sync Now"
- Uninstall the extension to remove all local data
- Contact us to request deletion of server-side data

## Permissions Justification

| Permission | Why It's Needed |
|------------|-----------------|
| `cookies` | Read Zoom httpOnly cookies that are inaccessible to websites |
| `storage` | Store your User ID and sync preferences locally |
| `alarms` | Schedule automatic cookie sync every 6 hours |
| `notifications` | Alert you when cookies need to be refreshed |
| `*://*.zoom.us/*` | Access cookies from Zoom domains |
| `https://meetings.workway.co/*` | Send cookies to WORKWAY backend |

## Contact

For privacy questions or data deletion requests:
- Email: privacy@workway.co
- Website: https://workway.co

## Changes to This Policy

We may update this policy occasionally. Changes will be posted at the URL where this policy is hosted.

---

**WORKWAY, Inc.**
https://workway.co
