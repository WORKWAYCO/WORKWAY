# Chrome Web Store Submission Checklist

## One-Time Setup

- [ ] Create Google Developer account: https://chrome.google.com/webstore/devconsole
- [ ] Pay $5 registration fee
- [ ] Verify account (may require phone verification)

## Required Assets

### Icons (Already Have)
- [x] 128x128 icon (`extension/icon128.png`)

### Store Icons (Need to Create)
- [ ] 128x128 store icon (can reuse extension icon)

### Screenshots (Required: 1-5)
Dimensions: 1280x800 or 640x400

- [ ] **Screenshot 1**: Extension popup showing "Ready" status after successful sync
- [ ] **Screenshot 2**: Extension popup showing User ID input field
- [ ] **Screenshot 3**: Chrome toolbar with extension icon visible

### Promotional Images (Optional but Recommended)
- [ ] Small promo tile: 440x280
- [ ] Large promo tile: 920x680
- [ ] Marquee: 1400x560

## Required Information

### URLs
- [ ] Privacy Policy URL (host `PRIVACY_POLICY.md` or create page at workway.co/privacy/zoom-sync)
- [ ] Support URL: support@workway.co or workway.co/support

### Permissions Justification
Chrome may ask why you need each permission. Prepare answers:

| Permission | Justification |
|------------|---------------|
| `cookies` | Required to read Zoom's httpOnly authentication cookies, which are not accessible via JavaScript. These cookies authenticate WORKWAY's server to access the user's Zoom recordings. |
| `storage` | Stores the user's WORKWAY User ID locally so they don't need to re-enter it. |
| `alarms` | Schedules automatic cookie refresh every 6 hours to maintain session validity. |
| `notifications` | Alerts users when their Zoom session has expired and needs manual refresh. |
| `host_permissions: *://*.zoom.us/*` | Required to read cookies from Zoom's domains. |
| `host_permissions: https://meetings.workway.co/*` | Required to send cookies to WORKWAY's secure backend. |

## Submission Steps

1. Go to https://chrome.google.com/webstore/devconsole
2. Click "New Item"
3. Upload `workway-zoom-sync-v2.0.0.zip`
4. Fill in store listing from `STORE_LISTING.md`
5. Upload screenshots
6. Set visibility to "Unlisted" (recommended for B2B)
7. Add Privacy Policy URL
8. Submit for review

## Post-Submission

- Review typically takes 1-3 business days
- May receive questions about permissions (especially `cookies`)
- Once approved, you'll get a Chrome Web Store URL to share with clients

## Visibility Options

| Option | Best For |
|--------|----------|
| **Public** | Consumer apps, SEO discovery |
| **Unlisted** | B2B, controlled distribution (clients get direct link) |
| **Private** | Google Workspace domains only |

**Recommended for WORKWAY:** Unlisted (clients get link, no Developer Mode needed)

## Updating the Extension

1. Increment version in `manifest.json`
2. Create new zip
3. Upload to Developer Console
4. Submit for review (usually faster than initial review)
