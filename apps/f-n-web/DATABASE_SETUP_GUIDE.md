# F→N Database Setup Guide for Blondish (Viv)

## Quick Reference: Required Notion Database Properties

For optimal Fireflies to Notion syncing, create a Notion database with these property types:

| Property Name | Notion Type | Purpose | Required? |
|--------------|-------------|---------|-----------|
| Title | Title | Meeting name (auto-created) | Yes (auto) |
| Meeting Date | Date | When meeting occurred | Recommended |
| Duration | Number | Meeting length in minutes | Optional |
| Participants | Multi-select OR Text | Attendee names | Optional |
| Keywords | Text | AI-extracted topics | Optional |
| Fireflies URL | URL | Link to original transcript | Recommended |
| Owner | Select | Meeting organizer (auto-populated with user email) | Optional |

## Step-by-Step Setup for Viv

### 1. Create the Notion Database

1. In Notion, create a new Database (inline or full-page)
2. Rename it to something like "Meetings" or "Fireflies Transcripts"
3. Add the following properties:

#### Essential Properties

**Meeting Date** (Date type)
- Click "+ Add a property"
- Name it "Meeting Date"
- Select type: Date

**Fireflies URL** (URL type)
- Click "+ Add a property"
- Name it "Fireflies URL"
- Select type: URL

#### Optional but Recommended Properties

**Duration** (Number type)
- Click "+ Add a property"
- Name it "Duration"
- Select type: Number
- This will show meeting length in minutes

**Participants** (Multi-select OR Text type)
- Click "+ Add a property"
- Name it "Participants"
- Select type: **Multi-select** (recommended for filtering) OR **Text** (simpler)
- Multi-select allows you to filter by specific people
- Text is simpler but doesn't create individual tags

**Keywords** (Text type)
- Click "+ Add a property"
- Name it "Keywords"
- Select type: Text
- AI-extracted topics will appear as comma-separated text

**Owner** (Select type)
- Click "+ Add a property"
- Name it "Owner"
- Select type: Select
- This will auto-populate with Viv's email address

### 2. Verify Account Connections

1. Log in to https://fn.workway.co
2. Go to Dashboard → Settings
3. Check that both services are connected:
   - **Fireflies**: Green checkmark showing API key is valid
   - **Notion**: Green checkmark showing OAuth connected

If either is missing:
- **Fireflies**: Go to https://app.fireflies.ai/settings#DeveloperSettings → Copy API key → Paste in F→N
- **Notion**: Click "Connect Notion" → Authorize F→N access

### 3. Configure Property Mapping

1. Go to F→N Dashboard
2. Select the database you just created from the dropdown
3. Expand the "Property Mapping" card
4. Map each Fireflies field to your Notion properties:

| Fireflies Field | Select This Notion Property |
|----------------|----------------------------|
| Duration (mins) | Duration |
| Participants | Participants |
| Keywords | Keywords |
| Meeting Date | Meeting Date |
| Fireflies URL | Fireflies URL |
| Owner | Owner |

5. **Enable Auto-sync** (checkbox at bottom):
   - ✅ Auto-sync new transcripts
   - New Fireflies transcripts will sync automatically every hour

6. Click **Save Mapping**

### 4. Test with a Single Transcript

1. In the Dashboard, you should see a list of recent Fireflies transcripts
2. Check **one** transcript (pick a test meeting)
3. Click "Sync Selected"
4. Wait for the sync to complete (progress bar shows status)
5. Open your Notion database and verify:
   - New row appears with meeting title
   - All properties are populated correctly
   - Open the page to see: Summary, Key Points, Action Items, Full Transcript

### 5. Bulk Sync (if test succeeds)

Once you've verified one transcript syncs correctly:
1. Select multiple transcripts (or use "Select All")
2. Click "Sync Selected"
3. Monitor progress in the dashboard
4. Check History tab to see all completed syncs

## What Syncs to Notion

### Database Properties (structured data)
- **Title**: Meeting name from Fireflies
- **Meeting Date**: ISO date (YYYY-MM-DD format)
- **Duration**: Integer (minutes)
- **Participants**: Comma-separated names (Multi-select) or text (Text)
- **Keywords**: AI topics as comma-separated text
- **Fireflies URL**: Direct link to Fireflies transcript
- **Owner**: Your email (Viv's email in this case)

### Page Content (inside each Notion page)
1. **AI Summary** (if available from Fireflies)
2. **Key Points** (bullet list)
3. **Action Items** (checkboxes for follow-up tasks)
4. **Full Transcript** (with speaker attribution)

## Troubleshooting

### "No databases found"
- Make sure Notion connection is active (Settings tab)
- Re-authorize Notion if needed
- Verify the database exists and you have edit permissions

### "Sync failed: Missing property"
- Check that your Notion database has the property types you mapped
- Property names must match exactly (case-sensitive)
- Delete the mapping and re-configure if needed

### "Already synced" message
- F→N tracks synced transcripts to prevent duplicates
- This is normal and saves you sync credits
- To force re-sync, delete the entry from History and try again

### Keywords appear as "undefined" or empty
- Some Fireflies transcripts don't have AI-extracted keywords
- This is a Fireflies API limitation, not an F→N issue
- Leave the property blank or remove the Keywords mapping

### Participants showing as one long string
- If using **Text** type: This is expected behavior (comma-separated)
- If using **Multi-select** type and still seeing text:
  - Check your Property Mapping configuration
  - Make sure "Participants" is mapped to a Multi-select property
  - Re-save the mapping

## Property Mapping: Multi-select vs Text for Participants

**Multi-select (recommended)**:
- ✅ Each participant becomes a separate tag
- ✅ Can filter database by specific people
- ✅ Can create views for "meetings with John"
- ❌ Notion has 100 option limit (F→N handles this automatically)

**Text**:
- ✅ Simpler setup (no option management)
- ✅ Unlimited participants (no Notion limit)
- ✅ Faster syncing
- ❌ Cannot filter by individual participants
- ❌ Shows as comma-separated text only

For most users: **Multi-select** is better for long-term database utility.

## Auto-sync Details

When enabled, auto-sync:
- Checks for new Fireflies transcripts **every hour**
- Only syncs transcripts created since last auto-sync
- Respects your subscription limits (counts against monthly quota)
- Runs in the background (no manual action needed)
- Sends email notification if sync fails (coming soon)

**Note**: First-time users should manually sync a test transcript before enabling auto-sync.

## Subscription Limits

| Tier | Monthly Syncs | Price |
|------|--------------|-------|
| Free | 5 | $0 |
| Pro | 100 | $5/month |
| Unlimited | ∞ | $15/month |

- Each transcript = 1 sync
- Failed syncs don't count
- Already-synced transcripts don't count (deduplication)
- Counts reset on the 1st of each month

## Support

Questions? Issues?
- Email: support@workway.co
- Dashboard has built-in error messages
- Check History tab for detailed sync logs
