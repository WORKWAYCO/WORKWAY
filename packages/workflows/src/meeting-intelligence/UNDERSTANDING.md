# Meeting Intelligence - Agent Understanding

> This file enables AI agents to understand and modify this workflow.

## Purpose

Automated meeting documentation for Zoom users. Runs daily or on webhook to:
1. Sync Zoom meetings and clips to Notion
2. Extract transcripts (OAuth API only - no scraping)
3. AI-analyze meetings for action items, decisions, and key topics
4. Post summaries to Slack
5. Optionally update CRM (HubSpot)

## Outcome Frame

**"Zoom meetings that write their own notes"**

- Daily sync at 7 AM UTC (or webhook-triggered)
- Transcript via Zoom OAuth API (when available)
- AI-extracted action items and decisions

## ⚠️ API-Only Architecture (Important Limitation)

**This workflow uses Zoom's OAuth API exclusively** (no browser scraping).

**Transcript Availability**: ~70% of meetings
- ✅ Cloud recordings with transcript enabled
- ✅ Meetings where host enabled transcript
- ❌ Instant meetings (no transcript generated)
- ❌ Meetings where transcript disabled
- ❌ Zoom Clips (OAuth API does not provide clip transcripts)

**What This Means**:
- Simpler setup (no custom infrastructure)
- More reliable (no browser automation)
- But ~30% of meetings may not have transcripts available

**When transcript unavailable**: Notion page created with meeting metadata (title, date, participants) but no transcript content.

## Workflow Phases

```
┌─────────────────┐
│  1. TRIGGER     │ Cron (7AM) or Zoom webhook (recording.completed)
└────────┬────────┘
         ▼
┌─────────────────┐
│  2. FETCH       │ Get meetings/clips from Zoom OAuth API
└────────┬────────┘
         ▼
┌─────────────────┐
│  3. TRANSCRIPT  │ OAuth API transcript (if available)
└────────┬────────┘  Note: ~70% availability
         ▼
┌─────────────────┐
│  4. ANALYZE     │ Workers AI: summary, action items, decisions
└────────┬────────┘
         ▼
┌─────────────────┐
│  5. STORE       │ Create Notion page with metadata + transcript
└────────┬────────┘
         ▼
┌─────────────────┐
│  6. NOTIFY      │ Post Slack summary (optional CRM update)
└────────┴────────┘
```

## Key Integration Points

### Zoom OAuth

```
Scopes: meeting:read, recording:read, clip:read

Endpoints used:
- GET /users/me/meetings           # List meetings
- GET /meetings/:id/recordings     # Get recording details
- GET /users/me/clips              # List clips
- GET /clips/:id                   # Get clip details
```

### Notion API

```
Scopes: read_pages, write_pages, read_databases

Operations:
- Query database for existing pages (deduplication)
- Create page with meeting properties
- Append transcript blocks (chunked at 1900 chars)
```

### Transcript Extraction (API-Only)

```
Source: Zoom OAuth API only (no browser scraping)

Availability: ~70% of meetings
- ✅ Transcripts available: Cloud recordings with transcript enabled
- ❌ Transcripts unavailable: Instant meetings, clips, transcript disabled

Speaker Attribution: Depends on Zoom's processing
- Some transcripts include speaker names
- Others are plain text without attribution
- Quality varies based on Zoom's audio processing

Graceful Degradation: When transcript unavailable, page created with
meeting metadata (title, date, participants, recording URL) but no content.
```

### AI Analysis (Workers AI)

Uses Workers AI (LLAMA_3_8B) to extract:
- **Summary**: 2-3 paragraph meeting summary
- **Decisions**: Key decisions made
- **Action Items**: Tasks with optional assignee/due date
- **Follow-ups**: Items needing future discussion
- **Key Topics**: Main themes discussed
- **Sentiment**: positive/neutral/concerned

### Slack Notifications

Posts formatted summary to configured channel with:
- Meeting title and date
- AI-generated summary
- Action items list
- Link to Notion page

### HubSpot CRM (Optional)

When `update_c_r_m: true`:
- Search deals by attendee company names
- Log meeting activity record
- Append summary to deal notes

## Configuration

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| `notion_database_id` | text | Yes | Notion database for meeting notes |
| `slack_channel` | text | Yes | Slack channel for summaries |
| `sync_mode` | select | No | `meetings_only`, `clips_only`, or `both` (default: both) |
| `lookback_days` | number | No | Days to sync (default: 1) |
| `transcript_mode` | select | No | `oauth_only` (only option - API-only architecture) |
| `enable_a_i` | boolean | No | Enable AI analysis (default: true) |
| `analysis_depth` | select | No | `brief`, `standard`, `detailed` |
| `post_to_slack` | boolean | No | Post Slack summary (default: true) |
| `update_c_r_m` | boolean | No | Update HubSpot (default: false) |

**Note**: Removed `browser_scraper_url` - workflow is now API-only (no scraping infrastructure required).

## Notion Page Schema

```typescript
interface MeetingNotionPage {
  properties: {
    Name: { title: string };      // Meeting topic
    Date: { date: string };       // Meeting start time
    Duration: { number: number }; // Minutes
    Participants: { multi_select: string[] };
    'Meeting ID': { rich_text: string };
    'Recording URL': { url: string };
    Summary: { rich_text: string };  // AI summary
    'Action Items': { rich_text: string }; // Formatted list
  };
  children: Block[]; // Full transcript as paragraph blocks
}
```

## Error Handling

- **Zoom API errors**: Skip meeting, continue with others
- **Transcript unavailable**: Create page without transcript
- **AI analysis fails**: Use empty analysis, still create page
- **Notion rate limit**: Exponential backoff
- **Slack fails**: Log error, don't fail workflow
- **CRM fails**: Log error, don't fail workflow

## Modification Guidelines

When modifying this workflow:

1. **Add integrations**: Update `integrations` array and use in `processMeeting()`
2. **Change AI analysis**: Modify `analyzeMeeting()` in `utils.ts`
3. **New Notion fields**: Add to page properties in `createNotionPage()`
4. **Custom triggers**: Add webhook config to `webhooks` array
5. **Transcript processing**: Modify `splitTranscriptIntoBlocks()` in `utils.ts`

## Dependencies

- `@workwayco/sdk`: Workflow definition, cron/webhook triggers, AI
- Zoom OAuth: Meeting, recording, and transcript data (API-only)
- Notion OAuth: Page creation
- Slack OAuth: Message posting (optional)
- HubSpot OAuth: CRM updates (optional)

**Removed**: Browser scraper infrastructure (no longer needed with API-only approach)

## Testing

Manual trigger:
1. Ensure Zoom, Notion, and Slack OAuth connected
2. Have a recent Zoom cloud recording with transcript enabled
3. Run workflow manually via WORKWAY dashboard
4. Verify Notion page created
5. **Expected**: ~70% of meetings will have transcript content
6. **Expected**: ~30% will have metadata only (no transcript)
7. Verify Slack message posted with summary

Webhook test:
1. Start a Zoom meeting, enable cloud recording with transcript
2. End meeting and wait for webhook (may take 5-10 minutes for processing)
3. Verify real-time sync to Notion

**Note on Transcript Testing**:
- Instant meetings typically don't generate transcripts
- Scheduled meetings with recording enabled are most reliable
- Check Zoom account settings: Recording → Cloud Recording → Audio Transcript (enabled)

## Related Files

- `./utils.ts` - AI analysis and transcript utilities
- `Cloudflare/UNDERSTANDING.md` - Complete workflow map
- `packages/integrations/src/zoom/` - Zoom integration client
- `packages/integrations/src/notion/` - Notion integration client
