# WORKWAY Zoom Sync Extension

Chrome extension that syncs Zoom cookies (including httpOnly) to enable Meeting Intelligence workflows.

## Why This Extension?

Zoom's authentication cookies are marked `httpOnly`, meaning JavaScript in web pages cannot access them. Only Chrome extensions with the `cookies` permission can capture these cookies via `chrome.cookies.getAll()`.

This is required for the Meeting Intelligence workflow to scrape your Zoom recordings and meeting transcripts.

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right)
3. Click "Load unpacked"
4. Select this `extension` folder

## Usage

1. Login to [zoom.us](https://zoom.us) in Chrome
2. Click the WORKWAY Zoom Sync extension icon
3. Enter your User ID (e.g., `dm-halfdozen-co`)
4. Click "Save User ID"
5. Click "Sync Now"

## Automatic Sync

The extension automatically syncs cookies every 6 hours while Chrome is running. If Chrome is closed for more than 24 hours, the cookies will expire and you'll need to re-sync manually.

## Limitations

- **Chrome must be open** for automatic syncing to work
- Cookie sessions expire after ~24 hours
- If cookies expire, simply open Chrome with Zoom logged in and click "Sync Now"

## Files

- `manifest.json` - Extension configuration
- `background.js` - Service worker that handles cookie sync
- `popup.html` - Extension popup UI
- `popup.js` - Popup interaction logic
- `icon*.png` - Extension icons

## Worker Endpoint

Cookies are uploaded to: `https://meetings.workway.co/upload-cookies/{userId}`
