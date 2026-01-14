# Google Sheets ↔ Notion Sync

**Private Workflow** for the @halfdozen.co team

Your team works in Sheets. Your data lives in Notion. Both stay in sync.

## Who this is for

Some teams just prefer spreadsheets—and that's okay. Maybe your team:
- Knows Sheets inside and out
- Finds Notion's interface unfamiliar
- Just wants to get work done without learning new tools

This workflow lets everyone keep working where they're comfortable while your data stays organized in Notion.

## How it works

Edit in Sheets. See it in Notion. Edit in Notion. See it in Sheets.

No copying. No pasting. No "which version is current?" conversations.

### Sheets → Notion

We check your spreadsheet every few minutes (you choose how often: 5, 15, 30, or 60 minutes). When something changes, it shows up in Notion automatically.

### Notion → Sheets

When someone updates a page in Notion, we write it back to your spreadsheet right away. No waiting.

### When both change at once

Sometimes two people edit the same record in different places. When that happens, the Sheets version wins. Simple rule, no confusion.

We also keep a record of what happened, so you can see if anything got overwritten.

## What you'll need

### The basics

| What | Where to find it |
|------|------------------|
| **Spreadsheet ID** | The long string in your Google Sheets URL (between `/d/` and `/edit`) |
| **Database ID** | The ID in your Notion database URL |
| **Key column** | A column in Sheets with unique IDs for each row (usually column A) |
| **Field mappings** | A list telling us which columns go where (see below) |

### Optional tweaks

| Setting | What it does | Default |
|---------|--------------|---------|
| **Sheet tab name** | Which tab to sync | `Sheet1` |
| **Sync frequency** | How often to check Sheets | Every 15 minutes |
| **Write back to Sheets** | Let Notion changes update Sheets | Yes |

### Mapping your columns

Tell us which Sheets columns match which Notion properties:

```json
[
  {"sheetsColumn": "A", "notionProperty": "ID", "type": "text"},
  {"sheetsColumn": "B", "notionProperty": "Name", "type": "title"},
  {"sheetsColumn": "C", "notionProperty": "Status", "type": "status"},
  {"sheetsColumn": "D", "notionProperty": "Due Date", "type": "date"},
  {"sheetsColumn": "E", "notionProperty": "Priority", "type": "number"},
  {"sheetsColumn": "F", "notionProperty": "Complete", "type": "checkbox"}
]
```

### What types work

| Your Sheets data | Use this type | Creates this in Notion |
|------------------|---------------|------------------------|
| Names, titles | `title` | The main title field |
| Regular text | `text` | Text property |
| Status or categories | `status` or `select` | Dropdown property |
| Dates | `date` | Date property |
| Numbers | `number` | Number property |
| TRUE/FALSE | `checkbox` | Checkbox property |

## Getting started

### Step 1: Set up your Google credentials

Your organization needs its own Google Cloud app. Here's how:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or pick an existing one)
3. Turn on the Google Sheets API
4. Create OAuth credentials (pick "Web application")
5. Add this redirect URL: `https://api.workway.co/oauth/google/callback`
6. Save your Client ID and Client Secret somewhere safe

### Step 2: Connect to WORKWAY

1. Open WORKWAY's Developer Settings
2. Add your Google credentials
3. Copy the connection ID it gives you

### Step 3: Set up your spreadsheet

1. Make sure row 1 has column headers
2. Add a column for unique IDs (column A works great)
3. Copy the spreadsheet ID from the URL

### Step 4: Set up your Notion database

**Important**: Create your Notion database first, with all the properties you want to sync.

The workflow can't create new properties—it can only fill in ones that already exist.

So if your Sheets has columns for Name, Status, and Due Date, your Notion database needs properties called Name, Status, and Due Date before you turn on the sync.

### Step 5: Turn it on

Configure the workflow with:
- Your spreadsheet ID
- Your Notion database ID  
- Which column has your unique IDs
- Your field mappings
- Your Google connection ID

That's it. Changes start syncing automatically.

## Good to know

### Speed
- **Sheets → Notion**: Every 5-15 minutes (you pick)
- **Notion → Sheets**: Instant

### Limits
- Syncs up to 500 rows at a time
- Google allows 300 API requests per minute
- Notion allows 3 requests per second

These limits are generous for most teams. You'd need thousands of changes per hour to hit them.

## If something's not working

**Nothing's syncing?**
- Double-check your spreadsheet and database IDs
- Make sure your Google credentials are still valid
- Look at the workflow logs for error messages

**Some rows aren't showing up?**
- Every row needs a unique ID in your key column
- Property names in your mapping must match exactly (capitalization matters!)
- Dates should look like `2026-01-14` (year-month-day)

**Seeing lots of conflicts?**
- Try syncing less often (every 30 or 60 minutes instead of 5)
- Or turn off Notion → Sheets if your team only edits in Sheets

## Who can use this

This workflow is private to the @halfdozen.co team. 

Anyone with a halfdozen.co email can install and use it.
