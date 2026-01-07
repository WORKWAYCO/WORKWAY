# Extension Update Guide for Danny

Hey Danny! Here's how to update the WORKWAY Zoom Sync extension since you already have it installed via Developer Mode.

## Quick Update (If Extension is Already Loaded)

1. **Open Extensions Page**
   - Go to `chrome://extensions/` in your browser
   - Or click the puzzle icon in Chrome toolbar → "Manage Extensions"

2. **Find WORKWAY Zoom Sync**
   - Look for "WORKWAY Zoom Sync" with version 2.2.0

3. **Reload the Extension**
   - Click the circular reload icon (🔄) on the extension card
   - This reloads the extension with the latest code from disk

4. **Verify Update**
   - Click the WORKWAY Zoom Sync extension icon in your toolbar
   - You should see the new "Sync Meetings & Clips" button
   - The "Days to sync" dropdown should be visible

## Full Reinstall (If Reload Doesn't Work)

If the reload button doesn't update it properly:

1. **Remove the Extension**
   - Go to `chrome://extensions/`
   - Click "Remove" on the WORKWAY Zoom Sync card

2. **Re-add the Extension**
   - Toggle "Developer mode" ON (top right)
   - Click "Load unpacked"
   - Navigate to: `/Users/micahjohnson/Documents/Github/WORKWAY/Cloudflare/apps/zoom-clips/extension/`
   - Select that folder

3. **Configure Your User ID**
   - Click the extension icon
   - Enter your User ID: `dm-halfdozen-co`
   - Click "Save User ID"

## Using the New Manual Sync Feature

Once updated, you'll see two buttons:

### "Sync Cookies Only" (Old Feature)
- Uploads your Zoom cookies to the worker
- Doesn't trigger the Zoom → Notion workflow
- Use this if you just want to refresh your auth

### "Sync Meetings & Clips" (NEW Feature ✨)
- Triggers the full Zoom → Notion sync
- Choose how many days back to sync (default: 1 day)
- Fetches meetings and clips from Zoom
- Writes directly to your Notion database
- Shows result: "✓ Synced 3 clips, 5 meetings → 8 written to Notion"

**When to use manual sync:**
- After an important meeting you want in Notion immediately
- Daily cron hasn't run yet (7 AM UTC)
- Backfilling historical meetings (use 7+ days)

## Troubleshooting

**Extension won't load:**
- Make sure you're in the correct directory
- Path should be: `.../Cloudflare/apps/zoom-clips/extension/`
- All files should be present: manifest.json, popup.html, popup.js, background.js

**"Sync failed" error:**
- Make sure you're logged into Zoom in Chrome
- Try clicking "Sync Cookies Only" first to refresh auth
- Check that your User ID is saved correctly

**Manual sync button missing:**
- Version might not have updated
- Do a full reinstall (remove + re-add)
- Check manifest.json shows version "2.2.0"

## Setup Link

For complete setup/configuration:
https://meetings.workway.co/setup/dm-halfdozen-co

---

Questions? Ping Micah in Slack.
