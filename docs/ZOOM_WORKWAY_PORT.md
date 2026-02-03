# Zoom Meeting Intelligence → WORKWAY Integration

## Technical Implementation Plan

**Status**: Planning
**Target**: Port ClipSync (Zoom Clips + Meetings → Notion) to WORKWAY integration framework

---

## 1. Executive Summary

### What We're Building
A **Meeting Intelligence** workflow for WORKWAY that:
- Syncs Zoom clips AND full meeting recordings to Notion
- Extracts transcripts with speaker attribution (hybrid OAuth + browser scraper)
- Extends to compound workflow (Notion + Slack + Email + CRM)

### Differentiation from Transkriptor
| Feature | Transkriptor | WORKWAY Meeting Intelligence |
|---------|-------------|------------------------------|
| Transcription → Notion | ✓ | ✓ |
| Slack summary post | ✗ | ✓ |
| Follow-up email drafts | ✗ | ✓ |
| CRM deal update | ✗ | ✓ |
| Action item extraction | Basic | AI-powered |

### Source Assets
- **ClipSync**: `/Users/micahjohnson/Documents/Github/HalfDozen/Zoom Clips Python/zoom-clips-nextjs`
- **Existing Workers**:
  - `zoom-transcript-scraper-browser` - Browser-based transcript extraction
  - `notion-text-splitter` - Parses transcripts into Notion blocks
  - `clipsync-daily-sync` - Orchestration logic

---

## 2. Technical Architecture

### Current ClipSync Architecture
```
┌─────────────────────────────────────────────────────────────┐
│  Zoom OAuth                                                 │
│  • Clips: /v2/clips                                        │
│  • Meetings: /v2/users/{id}/meetings                       │
│  • Recordings: /v2/meetings/{id}/recordings                │
│  • Transcripts: /v2/meetings/{id}/transcript               │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Hybrid Transcript Extraction                               │
│  TIER 1: OAuth API (fast, may lack speaker attribution)    │
│  TIER 2: Browser Scraper (Puppeteer, full speaker names)   │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Transcript Parser (Cloudflare Worker)                      │
│  • WebVTT parsing                                           │
│  • Split at sentence boundaries (<2000 chars)               │
│  • Return Notion block array                                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Notion API                                                 │
│  • Create page with metadata                                │
│  • Add transcript blocks (max 100 per request)              │
│  • Deduplication by Source URL                              │
└─────────────────────────────────────────────────────────────┘
```

### Target WORKWAY Architecture
```
┌─────────────────────────────────────────────────────────────┐
│  WORKWAY Integration Layer                                  │
│  • OAuth token management (existing)                        │
│  • Zoom integration client                                  │
│  • Unified credential store                                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Meeting Intelligence Workflow                              │
│                                                             │
│  TRIGGER: Daily cron (7 AM UTC) OR webhook                 │
│                                                             │
│  STEPS:                                                     │
│  1. Fetch yesterday's meetings/clips (Zoom API)            │
│  2. Extract transcripts (OAuth → Browser fallback)         │
│  3. Parse transcripts (Cloudflare Worker)                  │
│  4. Create Notion page with transcript                      │
│  5. Extract action items (AI)                               │
│  6. Post summary to Slack                                   │
│  7. Draft follow-up email (Gmail)                           │
│  8. Update CRM deal record (optional)                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Component Breakdown

### 3.1 Zoom Integration Client

**Location**: `packages/integrations/src/zoom/`

**Files to Create**:
```
zoom/
├── index.ts              # Main export
├── zoom.types.ts         # TypeScript interfaces
├── zoom-auth.ts          # OAuth 2.0 flow
├── zoom-clips.ts         # Clips API client
├── zoom-meetings.ts      # Meetings API client
├── zoom-transcripts.ts   # Transcript extraction (hybrid)
└── zoom.test.ts          # Integration tests
```

**OAuth Scopes Required**:
```
clips:read:list_user_clips
clips:read:clip
meeting:read:list_meetings
recording:read:list_recordings
recording:read:download_recording
```

**Key Methods**:
```typescript
// zoom-clips.ts
getClips(userId: string, from?: string, to?: string): Promise<ZoomClip[]>
getClipDetails(clipId: string): Promise<ZoomClipDetails>

// zoom-meetings.ts
getMeetings(userId: string, type: MeetingType, from?: string, to?: string): Promise<ZoomMeeting[]>
getRecordings(meetingId: string): Promise<ZoomRecording[]>

// zoom-transcripts.ts
getTranscript(meetingId: string, options?: TranscriptOptions): Promise<TranscriptResult>
// TIER 1: OAuth API
// TIER 2: Browser scraper fallback
```

### 3.2 Transcript Parser Worker

**Reuse Existing**: `zoom-transcript-scraper-browser` and `notion-text-splitter`

**Or Consolidate Into**: `packages/integrations/src/zoom/transcript-parser.ts`

**Function**:
```typescript
interface TranscriptParserInput {
  transcript: string;        // Raw WebVTT or text
  maxCharsPerBlock: number;  // Default: 1900
  preserveSpeakers: boolean; // Keep "Speaker: text" format
}

interface TranscriptParserOutput {
  blocks: NotionBlock[];     // Paragraph blocks for Notion API
  segmentsCount: number;     // Number of blocks created
  speakers: string[];        // Detected speaker names
}

function parseTranscript(input: TranscriptParserInput): TranscriptParserOutput
```

### 3.3 Browser Scraper (Fallback)

**Challenge**: OAuth API transcripts often lack speaker attribution.

**Solution**: Reuse `zoom-transcript-scraper-browser` Cloudflare Worker

**Flow**:
1. Accept meeting_id and user credentials
2. Launch Puppeteer browser instance
3. Navigate to Zoom transcript page
4. Extract transcript with speaker names from DOM
5. Cache in Cloudflare KV (90-day TTL)
6. Return parsed transcript

**Considerations for WORKWAY**:
- Worker already deployed at `https://zoom-transcript-scraper-browser.workers.dev`
- Could invoke directly from WORKWAY workflow
- Or migrate to WORKWAY's worker infrastructure

### 3.4 Meeting Intelligence Workflow

**Location**: `packages/workflows/src/meeting-intelligence/`

**Files**:
```
meeting-intelligence/
├── index.ts                    # Workflow definition
├── steps/
│   ├── fetch-meetings.ts       # Step 1: Fetch from Zoom
│   ├── extract-transcript.ts   # Step 2: Get transcript
│   ├── create-notion-page.ts   # Step 3: Create in Notion
│   ├── extract-actions.ts      # Step 4: AI action items
│   ├── post-slack-summary.ts   # Step 5: Slack notification
│   ├── draft-followup.ts       # Step 6: Email draft
│   └── update-crm.ts           # Step 7: CRM update (optional)
├── triggers/
│   ├── daily-cron.ts           # Daily scheduled sync
│   └── webhook.ts              # Manual/webhook trigger
└── meeting-intelligence.test.ts
```

**Workflow Definition**:
```typescript
export const meetingIntelligenceWorkflow = defineWorkflow({
  id: 'meeting-intelligence',
  name: 'Meeting Intelligence',
  description: 'Sync Zoom meetings to Notion with full transcript and action items',

  trigger: {
    type: 'cron',
    schedule: '0 7 * * *',  // 7 AM UTC daily
  },

  // Alternative triggers
  webhooks: ['meeting.ended', 'recording.completed'],

  steps: [
    {
      id: 'fetch-meetings',
      type: 'zoom.getMeetings',
      input: {
        userId: 'me',
        from: '{{yesterday}}',
        to: '{{today}}',
        type: 'previous_meetings',
      },
    },
    {
      id: 'extract-transcript',
      type: 'zoom.getTranscript',
      foreach: '{{steps.fetch-meetings.output}}',
      input: {
        meetingId: '{{item.id}}',
        fallbackToBrowser: true,
      },
    },
    {
      id: 'create-notion-page',
      type: 'notion.createPage',
      foreach: '{{steps.extract-transcript.output}}',
      input: {
        databaseId: '{{user.notionDatabaseId}}',
        properties: {
          title: '{{item.topic}}',
          date: '{{item.start_time}}',
          sourceUrl: '{{item.share_url}}',
          type: 'Meeting',
        },
        content: '{{item.transcript_blocks}}',
      },
    },
    {
      id: 'extract-actions',
      type: 'ai.extract',
      input: {
        prompt: 'Extract action items from this meeting transcript...',
        content: '{{steps.extract-transcript.output.transcript_text}}',
      },
    },
    {
      id: 'post-slack',
      type: 'slack.postMessage',
      input: {
        channel: '{{user.slackChannel}}',
        text: 'Meeting summary: {{steps.fetch-meetings.output.topic}}\n\nAction items:\n{{steps.extract-actions.output}}',
      },
    },
    // Optional: Email follow-up, CRM update
  ],

  pricing: {
    tier: 'heavy',        // 25¢ per execution
    freeExecutions: 20,   // Trial
  },
});
```

---

## 4. Data Models

### Zoom Types
```typescript
interface ZoomMeeting {
  id: number;
  uuid: string;
  topic: string;
  start_time: string;
  duration: number;
  timezone?: string;
  type: 1 | 2 | 3 | 4;  // instant, scheduled, recurring, fixed recurring
  host_id: string;
  join_url?: string;
}

interface ZoomClip {
  clip_id: string;
  clip_name: string;
  share_url: string;
  created_at: string;
  duration: number;
  status: 'processing' | 'completed';
}

interface ZoomRecording {
  id: string;
  meeting_id: string;
  recording_start: string;
  recording_end: string;
  file_type: 'MP4' | 'TRANSCRIPT' | 'CHAT' | 'AUDIO';
  download_url: string;
  status: string;
}

interface TranscriptResult {
  transcript_text: string;
  source: 'oauth_api' | 'browser_scraper';
  has_speaker_attribution: boolean;
  speakers?: string[];
  webvtt_raw?: string;
}
```

### Notion Output
```typescript
interface NotionMeetingPage {
  parent: { database_id: string };
  properties: {
    Item: { title: [{ text: { content: string } }] };
    Date: { date: { start: string } };
    'Source URL': { url: string };
    Status: { select: { name: 'Active' } };
    Type: { select: { name: 'Meeting' | 'Clip' } };
    Source: { select: { name: 'Internal' } };
  };
}

interface NotionBlock {
  type: 'paragraph';
  paragraph: {
    rich_text: [{ text: { content: string } }];
  };
}
```

---

## 5. Implementation Phases

### Phase 1: Core Integration (Week 1-2)
- [ ] Create Zoom integration client (auth, clips, meetings)
- [ ] Port transcript extraction (OAuth + browser fallback)
- [ ] Create Notion page creation step
- [ ] Basic workflow: Zoom → Notion only

### Phase 2: AI Enhancement (Week 3)
- [ ] Add AI action item extraction
- [ ] Implement meeting summary generation
- [ ] Create Slack notification step

### Phase 3: Compound Workflow (Week 4)
- [ ] Add email follow-up draft (Gmail)
- [ ] Add CRM update step (optional)
- [ ] Implement workflow configuration UI

### Phase 4: Polish & Launch (Week 5)
- [ ] Usage tracking and billing integration
- [ ] Error handling and retry logic
- [ ] Documentation and marketplace listing
- [ ] Beta testing with select users

---

## 6. Pricing Model

### Per-Execution Pricing
```
Meeting Intelligence Workflow
├─ Complexity Tier: Heavy (AI + multiple APIs)
├─ Price: 25¢ per meeting synced
├─ Free Trial: 20 meetings
│
│ Comparison to ClipSync:
│ - ClipSync Pro: $12/month for 100 clips = 12¢/clip
│ - ClipSync Unlimited: $29/month = $0.XX/clip at scale
│
│ WORKWAY at 25¢/meeting:
│ - 100 meetings = $25 (more than ClipSync subscription)
│ - BUT: Includes Slack + Email + CRM (compound workflow)
│ - Value: Full workflow automation, not just transcription
```

### Alternative: Tiered Pricing
```
Light: 10¢/meeting - Zoom → Notion only
Heavy: 25¢/meeting - Full compound workflow (Notion + Slack + Email)
```

---

## 7. Dependencies

### External Services
- Zoom OAuth API
- Notion API
- Slack API (for summary posting)
- Gmail API (for follow-up drafts)
- OpenAI API (for AI extraction)
- Cloudflare Workers (transcript scraper)

### WORKWAY Components Required
- OAuth token management (existing)
- Workflow engine
- Notion integration (existing/planned)
- Slack integration (existing/planned)
- Gmail integration (existing/planned)
- AI extraction utilities

### Cloudflare Workers to Reuse/Migrate
- `zoom-transcript-scraper-browser` - Browser-based extraction
- `notion-text-splitter` - Transcript parsing
- Or consolidate into WORKWAY's worker infrastructure

---

## 8. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Browser scraper breakage (DOM changes) | Transcript extraction fails | Monitor Zoom UI, maintain selectors, fallback to OAuth-only |
| Session cookie expiry | Browser scraper auth fails | Alert system, re-auth flow, 90-day TTL |
| Notion rate limits | Page creation throttled | Batch operations, exponential backoff |
| OAuth token expiry | API calls fail | 5-minute buffer, auto-refresh |
| Zoom API changes | Endpoints break | Version pinning, monitoring |

---

## 9. Success Metrics

### Launch Metrics
- [ ] 10 beta users testing workflow
- [ ] 90%+ sync success rate
- [ ] <30 second average execution time
- [ ] Zero data loss incidents

### Growth Metrics
- [ ] 100 active workflows in month 1
- [ ] 1000 meetings synced in month 1
- [ ] <5% churn rate
- [ ] NPS > 40

---

## 10. References

### Source Code
- ClipSync: `/Users/micahjohnson/Documents/Github/HalfDozen/Zoom Clips Python/zoom-clips-nextjs`
- Key files:
  - `lib/zoom-meetings.ts` - Meetings API client
  - `lib/zoom-clips.ts` - Clips API client
  - `lib/hybrid-zoom-client.ts` - OAuth + browser fallback
  - `lib/sync/daily-sync.ts` - Orchestration logic

### Documentation
- [Zoom API Docs](https://developers.zoom.us/docs/api/)
- [Notion API Docs](https://developers.notion.com/)
- [WORKWAY Integration Patterns](/docs/INTEGRATIONS_AUDIT.md)

### Related WORKWAY Pages
- `/meetings` - SEO/AEO landing page for meeting follow-up automation
- `/marketplace/meeting-intelligence` - Workflow marketplace listing
