# Google Sheets ↔ Notion Bidirectional Sync

**Private Workflow** - Requires BYOO (Bring Your Own OAuth)

Bidirectional synchronization between Google Sheets and a Notion database with Google Sheets as the source of truth when conflicts occur.

## Use Case

Teams who:
- Prefer Google Sheets' familiar spreadsheet interface for data entry
- Need Notion's structured database capabilities (relations, views, formulas)
- Want changes in either system to automatically appear in the other

## Architecture

```
Google Sheets                              Notion Database
     │                                           │
     │ ←── Polling (every 5-15 min) ───────────→│
     │ ←── Notion webhooks (instant) ───────────│
     │                                           │
     ▼                                           ▼
┌─────────────────────────────────────────────────────┐
│              Sync State Store (KV)                  │
│  ─────────────────────────────────────────────────  │
│  row_id │ sheets_hash │ notion_hash │ last_sync    │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
              ┌─────────────────┐
              │ Conflict Check  │
              │ Sheets-wins     │
              └─────────────────┘
```

## Sync Directions

### Sheets → Notion (Polling)
- Runs on cron schedule (configurable: 5, 15, 30, or 60 minutes)
- Hash-based change detection (only syncs modified rows)
- Creates new Notion pages for new rows
- Updates existing pages for changed rows

### Notion → Sheets (Webhook)
- Triggered instantly when Notion pages are updated
- Loop prevention (ignores changes within 5 seconds of sync)
- Updates corresponding Sheets row
- **Conflict Resolution**: If Sheets changed since last sync, Sheets wins

## Configuration

### Required Settings

| Setting | Description | Example |
|---------|-------------|---------|
| `spreadsheet_id` | Google Sheets ID from URL | `1abc123def456...` |
| `notion_database_id` | Notion database ID | `abc123-def456...` |
| `key_column` | Column with unique IDs | `A` or `ID` |
| `field_mappings` | JSON mapping columns to properties | See below |
| `google_connection_id` | Your BYOO connection ID | `conn_abc123` |

### Optional Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `sheet_name` | `Sheet1` | Tab name to sync |
| `sync_interval` | `15` | Minutes between syncs |
| `enable_notion_to_sheets` | `true` | Allow write-back to Sheets |

### Field Mappings

JSON array mapping Sheets columns to Notion properties:

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

### Supported Field Types

| Type | Sheets Format | Notion Property |
|------|---------------|-----------------|
| `title` | Any text | Title (required, one per DB) |
| `text` / `rich_text` | Any text | Text / Rich Text |
| `select` / `status` | Dropdown value | Select / Status |
| `date` | Date format | Date |
| `number` | Numeric | Number |
| `checkbox` | `TRUE`/`FALSE` or `1`/`0` | Checkbox |

## Setup Instructions

### 1. Create Google Cloud OAuth App

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable Google Sheets API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `https://api.workway.co/oauth/google/callback`
6. Note your Client ID and Client Secret

### 2. Configure BYOO in WORKWAY

1. Go to WORKWAY Developer Settings
2. Add Google Sheets connection with your credentials
3. Note the connection ID

### 3. Prepare Your Sheets

1. Add a unique ID column (column A recommended)
2. Add header row with column names
3. Note the spreadsheet ID from URL

### 4. Prepare Your Notion Database

1. Create database with matching properties
2. Property names should match your field mappings
3. Note the database ID from URL

### 5. Configure the Workflow

```typescript
{
  spreadsheet_id: "1abc123...",
  sheet_name: "Sheet1",
  notion_database_id: "abc123...",
  key_column: "A",
  field_mappings: JSON.stringify([
    {"sheetsColumn": "A", "notionProperty": "ID", "type": "text"},
    {"sheetsColumn": "B", "notionProperty": "Name", "type": "title"},
    // ... more mappings
  ]),
  sync_interval: "15",
  enable_notion_to_sheets: true,
  google_connection_id: "conn_abc123"
}
```

## Conflict Resolution

When both Sheets and Notion change the same record between syncs:

1. **Detection**: Compare current Sheets hash with stored hash
2. **Resolution**: Sheets value is authoritative (Sheets-wins)
3. **Action**: Notion page updated with Sheets data
4. **Logging**: Conflict logged with before/after values

## Limitations

- **Google Sheets API Rate Limits**: 300 requests per minute per user
- **Notion API Rate Limits**: 3 requests per second
- **Polling Latency**: Sheets→Notion has 5-15 min delay (not real-time)
- **Maximum Rows**: 500 rows per sync cycle (configurable)
- **Cell-Level Timestamps**: Sheets only provides file-level timestamps, so all rows are checked each sync

## Troubleshooting

### Sync not running?
- Check cron schedule is active
- Verify OAuth tokens are valid
- Check workflow logs for errors

### Rows not syncing?
- Verify key column has unique values
- Check field mappings match actual column/property names
- Ensure data types match (e.g., dates in ISO format)

### Conflicts occurring frequently?
- Increase sync interval to reduce race conditions
- Consider making Notion read-only (`enable_notion_to_sheets: false`)
- Review which team should edit which system

## Access Control

This is a private workflow. Access is controlled via:

- **Email Domain Grants**: `{ type: 'email_domain', value: 'yourcompany.com' }`
- **Individual User Grants**: `{ type: 'user', value: 'usr_abc123' }`
- **Access Codes**: `{ type: 'access_code', value: 'SHEETS2026' }`

Contact your WORKWAY administrator to request access.
