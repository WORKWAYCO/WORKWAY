# WORKWAY: Workflow Understanding Map

> **Zuhandenheit**: Users don't want "workflow automation"—they want outcomes.

This document maps all WORKWAY workflows by outcome frame, integration pairs, and complexity. Designed for Claude Code comprehension and agentic workflow generation.

## Philosophy

WORKWAY fills gaps in Notion's integration ecosystem:
- **Gmail → Notion**: AI Connector is search-only, doesn't create entries
- **Slack → Notion**: Native integration is one-way (Notion → Slack only)
- **Zoom → Notion**: No official integration for meeting transcripts
- **CRM → Notion**: Wide open territory

**Differentiation**: WORKWAY orchestrates compound workflows, not just A → B data movement.

```
Meeting ends → Notion page + Slack summary + Email draft + CRM update
```

## Outcome Taxonomy

Users think in situations, not categories:

| Outcome Frame | Label | Description |
|---------------|-------|-------------|
| `before_meetings` | Before meetings... | Prepare context and talking points automatically |
| `after_meetings` | After meetings... | Automate what happens when meetings end |
| `when_payments_arrive` | When payments arrive... | Track, invoice, and follow up on payments |
| `when_leads_come_in` | When leads come in... | Route leads to CRM and team |
| `weekly_automatically` | Weekly, automatically... | Digests, reports, and summaries |
| `when_tickets_arrive` | When tickets arrive... | Route and analyze support requests |
| `every_morning` | Every morning... | Daily standups, digests, briefings |
| `when_clients_onboard` | When clients onboard... | Automate client and team onboarding |
| `after_calls` | After calls... | Follow-ups and task creation |
| `when_data_changes` | When data changes... | Sync and transform data automatically |
| `after_publishing` | After publishing... | Sync creative work across platforms |
| `when_meetings_booked` | When meetings are booked... | Log bookings and notify your team |
| `when_forms_submitted` | When forms are submitted... | Route responses to your databases |
| `when_deals_progress` | When deals progress... | Track deal movement and celebrate wins |
| `when_tasks_complete` | When tasks complete... | Build a productivity journal automatically |
| `when_emails_arrive` | When important emails arrive... | Sync emails to your knowledge base |
| `when_errors_happen` | When errors happen... | Document incidents and alert your team |
| `when_issues_arrive` | When issues arrive... | Sync issues across platforms automatically |
| `when_code_changes` | When code changes... | PR notifications and code review reminders |
| `when_files_change` | When files change... | Sync documents and notify your team |
| `when_approval_needed` | When approval is needed... | Request approvals and track decisions |
| `always_current` | Always current... | Keep status and availability in sync |
| `when_work_completes` | When work completes... | Track time and sync to reports |
| `when_appointments_scheduled` | When appointments are scheduled... | Reduce no-shows with smart reminders |
| `after_appointments` | After patient visits... | Turn happy patients into reviews |
| `when_rfis_need_answers` | When RFIs need answers... | Track and escalate open RFIs automatically |
| `end_of_day` | At end of day... | Daily logs and site reports |

## All Workflows (49 total)

### 1. Meeting Intelligence
**Outcome**: "Zoom meetings that write their own notes"
- **Integration Pair**: `zoom:notion`
- **Outcome Frame**: `after_meetings`
- **Complexity**: Standard (multi-integration, AI-powered)
- **Features**:
  - Syncs recordings and clips to Notion
  - AI transcript analysis (summary, decisions, action items)
  - Slack notification with summary
  - Optional CRM update (HubSpot)
- **Trigger**: Daily cron (7 AM) or Zoom webhook (`recording.completed`)
- **Dependencies**: Zoom OAuth, Notion API, optional Slack/HubSpot
- **File**: `packages/workflows/src/meeting-intelligence/index.ts`

### 2. Meeting Intelligence (Private)
**Outcome**: "Meetings that document themselves (browser workaround)"
- **Integration Pair**: `zoom-browser:notion`
- **Outcome Frame**: `after_meetings`
- **Complexity**: Complex (custom infrastructure required)
- **Features**:
  - Browser-based transcript scraping (when OAuth unavailable)
  - Requires custom Cloudflare Worker + Durable Objects
  - Bookmarklet authentication (24-hour expiration)
  - ~1,345 lines vs ~300 for standard workflow
- **Trigger**: Cron or webhook
- **Experimental**: True
- **Custom Infrastructure**: True
- **File**: `packages/workflows/src/meeting-intelligence-private/index.ts`

### 3. Meeting Summarizer
**Outcome**: "Quick meeting summaries"
- **Integration Pair**: `zoom:notion`
- **Outcome Frame**: `after_meetings`
- **Complexity**: Simple (single-integration focus)
- **Features**: AI summary only, no action item extraction
- **File**: `packages/workflows/src/meeting-summarizer/index.ts`

### 4. Meeting Follow-up Engine
**Outcome**: "Meetings that create their own tasks"
- **Integration Pair**: `calendly:todoist`
- **Outcome Frame**: `after_calls`
- **Complexity**: Standard
- **Features**: Extract action items, create tasks in Todoist
- **File**: `packages/workflows/src/meeting-followup-engine/index.ts`

### 5. Meeting to Action
**Outcome**: "Meetings that assign themselves"
- **Integration Pair**: `zoom:todoist`, `zoom:linear`
- **Outcome Frame**: `after_meetings`
- **Complexity**: Standard
- **Features**: AI action item extraction → Linear/Todoist tasks
- **File**: `packages/workflows/src/meeting-to-action/index.ts`

### 6. Calendar Meeting Prep
**Outcome**: "Meetings that brief themselves"
- **Integration Pair**: `google-calendar:notion`, `google-calendar:slack`
- **Outcome Frame**: `before_meetings`
- **Complexity**: Standard
- **Features**: Pre-meeting briefs with context from Notion/Slack
- **File**: `packages/workflows/src/calendar-meeting-prep/index.ts`

### 7. Payments Tracked
**Outcome**: "Payments tracked automatically"
- **Integration Pair**: `stripe:notion`
- **Outcome Frame**: `when_payments_arrive`
- **Complexity**: Simple
- **Features**: Stripe webhook → Notion database entry
- **File**: `packages/workflows/src/payments-tracked/index.ts`

### 8. Invoice Generator
**Outcome**: "Projects that invoice themselves"
- **Integration Pair**: `notion:stripe`
- **Outcome Frame**: `when_payments_arrive`
- **Complexity**: Standard
- **Features**: Notion project completion → Stripe invoice creation
- **File**: `packages/workflows/src/invoice-generator/index.ts`

### 9. Revenue Radar
**Outcome**: "Payment alerts in Slack"
- **Integration Pair**: `stripe:slack`, `stripe:hubspot`
- **Outcome Frame**: `when_payments_arrive`
- **Complexity**: Simple
- **Features**: Stripe payment webhook → Slack notification + HubSpot deal update
- **File**: `packages/workflows/src/revenue-radar/index.ts`

### 10. Sales Lead Pipeline
**Outcome**: "Leads that route themselves"
- **Integration Pair**: `typeform:hubspot`, `typeform:slack`
- **Outcome Frame**: `when_leads_come_in`
- **Complexity**: Standard
- **Features**: Typeform submission → HubSpot contact + Slack alert
- **File**: `packages/workflows/src/sales-lead-pipeline/index.ts`

### 11. Client Onboarding
**Outcome**: "Clients onboarded automatically"
- **Integration Pair**: `stripe:todoist`
- **Outcome Frame**: `when_clients_onboard`
- **Complexity**: Standard
- **Features**: Stripe payment → Todoist checklist creation
- **File**: `packages/workflows/src/client-onboarding/index.ts`

### 12. Onboarding
**Outcome**: "Team onboarding automation"
- **Integration Pair**: Generic
- **Outcome Frame**: `when_clients_onboard`
- **Complexity**: Standard
- **File**: `packages/workflows/src/onboarding/index.ts`

### 13. Support Ticket Router
**Outcome**: "Tickets routed to the right team"
- **Integration Pair**: `slack:slack`
- **Outcome Frame**: `when_tickets_arrive`
- **Complexity**: Simple
- **Features**: AI classification → channel routing
- **File**: `packages/workflows/src/support-ticket-router/index.ts`

### 14. Team Digest
**Outcome**: "Team activity digest"
- **Integration Pair**: `notion:slack`
- **Outcome Frame**: `every_morning`
- **Complexity**: Simple
- **Features**: Daily Notion database summary → Slack post
- **Trigger**: Cron (9 AM weekdays)
- **File**: `packages/workflows/src/team-digest/index.ts`

### 15. Standup Bot
**Outcome**: "Automated standup collection"
- **Integration Pair**: `slack:notion`
- **Outcome Frame**: `every_morning`
- **Complexity**: Simple
- **Features**: Slack standup prompts → Notion database
- **File**: `packages/workflows/src/standup-bot/index.ts`

### 16. Discord Standup Bot
**Outcome**: "Standups archived to Notion"
- **Integration Pair**: `discord:notion`
- **Outcome Frame**: `every_morning`
- **Complexity**: Simple
- **File**: `packages/workflows/src/discord-standup-bot/index.ts`

### 17. Weekly Productivity Digest
**Outcome**: "Productivity insights weekly"
- **Integration Pair**: `todoist:slack`
- **Outcome Frame**: `weekly_automatically`
- **Complexity**: Standard
- **Features**: Weekly Todoist completion summary → Slack
- **Trigger**: Cron (Monday 9 AM)
- **File**: `packages/workflows/src/weekly-productivity-digest/index.ts`

### 18. Sprint Progress Tracker
**Outcome**: "Sprint updates every morning"
- **Integration Pair**: `linear:slack`, `linear:notion`
- **Outcome Frame**: `every_morning`
- **Complexity**: Standard
- **Features**: Daily Linear sprint summary → Slack + Notion archive
- **File**: `packages/workflows/src/sprint-progress-tracker/index.ts`

### 19. Data Stays Consistent
**Outcome**: "Spreadsheets synced to Airtable"
- **Integration Pair**: `google-sheets:airtable`
- **Outcome Frame**: `when_data_changes`
- **Complexity**: Standard
- **Features**: Two-way sync between Google Sheets and Airtable
- **File**: `packages/workflows/src/data-stays-consistent/index.ts`

### 20. Content Calendar
**Outcome**: "Content reminders in Slack"
- **Integration Pair**: `airtable:slack`
- **Outcome Frame**: `every_morning`
- **Complexity**: Simple
- **Features**: Daily content due reminders from Airtable → Slack
- **File**: `packages/workflows/src/content-calendar/index.ts`

### 21. Design Portfolio Sync
**Outcome**: "Portfolio that updates itself"
- **Integration Pair**: `dribbble:notion`, `dribbble:slack`
- **Outcome Frame**: `after_publishing`
- **Complexity**: Simple
- **Features**: Dribbble shots → Notion portfolio + Slack announcement
- **File**: `packages/workflows/src/design-portfolio-sync/index.ts`

### 22. Scheduling Autopilot
**Outcome**: "Meetings logged automatically"
- **Integration Pair**: `calendly:notion`, `calendly:slack`
- **Outcome Frame**: `when_meetings_booked`
- **Complexity**: Simple
- **Features**: Calendly booking → Notion log + Slack alert
- **File**: `packages/workflows/src/scheduling-autopilot/index.ts`

### 23. Form Response Hub
**Outcome**: "Responses logged to Notion"
- **Integration Pair**: `typeform:notion`, `typeform:airtable`
- **Outcome Frame**: `when_forms_submitted`
- **Complexity**: Simple
- **Features**: Typeform webhook → Notion database / Airtable base
- **File**: `packages/workflows/src/form-response-hub/index.ts`

### 24. Deal Tracker
**Outcome**: "Deal alerts in Slack"
- **Integration Pair**: `hubspot:slack`, `hubspot:notion`
- **Outcome Frame**: `when_deals_progress`
- **Complexity**: Standard
- **Features**: HubSpot deal stage change → Slack + Notion archive
- **File**: `packages/workflows/src/deal-tracker/index.ts`

### 25. Task Sync Bridge
**Outcome**: "Completed tasks logged to Notion"
- **Integration Pair**: `todoist:notion`
- **Outcome Frame**: `when_tasks_complete`
- **Complexity**: Simple
- **Features**: Todoist completion → Notion productivity journal
- **File**: `packages/workflows/src/task-sync-bridge/index.ts`

### 26. Private Emails Documented
**Outcome**: "Important emails that become searchable knowledge"
- **Integration Pair**: `gmail:notion`
- **Outcome Frame**: `when_emails_arrive`
- **Complexity**: Complex (BYOO - Bring Your Own OAuth)
- **Experimental**: True
- **Features**: Gmail → Notion with full thread context
- **Note**: Requires Gmail app verification (not public marketplace)
- **File**: `packages/workflows/src/private-emails-documented/index.ts`

### 27. Databases Mirrored
**Outcome**: "Support tickets that sync across workspaces"
- **Integration Pair**: `notion:notion`
- **Outcome Frame**: `when_tickets_arrive`
- **Complexity**: Standard
- **Features**: Two-way Notion database sync across workspaces
- **Use Cases**: Client support, cross-team updates, multi-workspace agencies
- **File**: `packages/workflows/src/databases-mirrored/index.ts`

### 28. Error Incident Manager
**Outcome**: "Errors that document themselves"
- **Integration Pair**: `sentry:notion`, `sentry:slack`
- **Outcome Frame**: `when_errors_happen`
- **Complexity**: Standard
- **Features**: Sentry error → Notion incident page + Slack alert
- **Dogfooding**: WORKWAY uses this internally
- **File**: `packages/workflows/src/error-incident-manager/index.ts`

### 29. Issues Synced to Sprint
**Outcome**: "Issues synced to Linear"
- **Integration Pair**: `github:linear`
- **Outcome Frame**: `when_issues_arrive`
- **Complexity**: Standard
- **Features**: GitHub issue → Linear issue (two-way sync)
- **File**: `packages/workflows/src/issues-synced-to-sprint/index.ts`

### 30. PR Review Notifier
**Outcome**: "PR alerts in Slack"
- **Integration Pair**: `github:slack`, `github:discord`
- **Outcome Frame**: `when_code_changes`
- **Complexity**: Simple
- **Features**: GitHub PR webhook → Slack/Discord notification
- **File**: `packages/workflows/src/pr-review-notifier/index.ts`

### 31. Documents Organized
**Outcome**: "Documents that organize themselves"
- **Integration Pair**: `google-drive:notion`, `google-drive:slack`
- **Outcome Frame**: `when_files_change`
- **Complexity**: Standard
- **Features**: Google Drive file change → Notion index + Slack notification
- **File**: `packages/workflows/src/documents-organized/index.ts`

### 32. Document Approval Flow
**Outcome**: "Documents that approve themselves"
- **Integration Pair**: `google-drive:slack:approval`
- **Outcome Frame**: `when_approval_needed`
- **Complexity**: Standard
- **Features**: Google Drive document → Slack approval request with buttons
- **File**: `packages/workflows/src/document-approval-flow/index.ts`

### 33. Calendar Availability Sync
**Outcome**: "Status that updates itself"
- **Integration Pair**: `google-calendar:slack:status`
- **Outcome Frame**: `always_current`
- **Complexity**: Simple
- **Features**: Google Calendar busy/free → Slack status emoji
- **File**: `packages/workflows/src/calendar-availability-sync/index.ts`

### 34. Meeting Expense Tracker
**Outcome**: "Meetings that invoice themselves"
- **Integration Pair**: `zoom:stripe`, `zoom:notion:billing`
- **Outcome Frame**: `after_meetings`
- **Complexity**: Standard
- **Features**: Zoom meeting duration → billable time tracking + invoicing
- **File**: `packages/workflows/src/meeting-expense-tracker/index.ts`

### 35. Project Time Tracker
**Outcome**: "Time that tracks itself"
- **Integration Pair**: `linear:google-sheets`, `linear:slack:time`
- **Outcome Frame**: `when_work_completes`
- **Complexity**: Standard
- **Features**: Linear issue completion → time tracking sheet + Slack report
- **File**: `packages/workflows/src/project-time-tracker/index.ts`

### 36. Dental Appointment Autopilot
**Outcome**: "No-shows that prevent themselves"
- **Integration Pair**: `sikka:slack`, `sikka:twilio`
- **Outcome Frame**: `when_appointments_scheduled`
- **Complexity**: Standard (vertical-specific)
- **Features**: Sikka (dental PMS) appointment → SMS/Slack reminders
- **Industry**: Healthcare (Dental)
- **File**: `packages/workflows/src/dental-appointment-autopilot/index.ts`

### 37. Dental Review Booster
**Outcome**: "Visits become Google reviews"
- **Integration Pair**: `sikka:google-business`, `sikka:yelp`
- **Outcome Frame**: `after_appointments`
- **Complexity**: Standard (vertical-specific)
- **Features**: Post-appointment → automated review request SMS
- **Industry**: Healthcare (Dental)
- **File**: `packages/workflows/src/dental-review-booster/index.ts`

### 38. Construction RFI Tracker
**Outcome**: "RFIs that get answered"
- **Integration Pair**: `procore:slack`, `procore:notion`
- **Outcome Frame**: `when_rfis_need_answers`
- **Complexity**: Standard (vertical-specific)
- **Features**: Procore RFI status → Slack escalation + Notion archive
- **Industry**: Construction
- **File**: `packages/workflows/src/construction-rfi-tracker/index.ts`

### 39. Construction Daily Log
**Outcome**: "Daily logs that write themselves"
- **Integration Pair**: `procore:slack:dailylog`, `procore:notion:dailylog`
- **Outcome Frame**: `end_of_day`
- **Complexity**: Standard (vertical-specific)
- **Features**: End-of-day Procore data → automated site log + Slack digest
- **Industry**: Construction
- **File**: `packages/workflows/src/construction-daily-log/index.ts`

### 40. Construction Project Digest
**Outcome**: "Projects that report themselves"
- **Integration Pair**: `procore:slack:digest`, `procore:notion:digest`
- **Outcome Frame**: `weekly_automatically`
- **Complexity**: Standard (vertical-specific)
- **Features**: Weekly Procore project summary → Slack + Notion report
- **Industry**: Construction
- **File**: `packages/workflows/src/construction-project-digest/index.ts`

### 41-49: Additional Workflows

*(Note: Some workflows may be deprecated or experimental. Check workflow metadata for current status.)*

**Accounting & Finance**:
- Accounting Stays Current
- QuickBooks Cash Flow Monitor
- QuickBooks Invoice Collector
- Payment Celebration
- Payment Reminders (DEPRECATED: requires Gmail)

**Real Estate**:
- Real Estate Lead Nurture

**NexHealth Integration**:
- NexHealth Appointment Flow

**Additional deprecated workflows** (Gmail app verification required):
- AI Newsletter (DEPRECATED)
- Feedback Analyzer (DEPRECATED)

## Complexity Tiers

### Light (Simple)
**Characteristics**:
- Single integration pair
- Straightforward data mapping
- No AI processing
- ~100-200 lines of code

**Examples**: Calendar Availability Sync, Standup Bot, Revenue Radar

### Heavy (Standard)
**Characteristics**:
- 2-3 integrations
- AI-powered analysis
- Error handling and retries
- ~300-500 lines of code

**Examples**: Meeting Intelligence, Sprint Progress Tracker, Deal Tracker

### Custom (Complex)
**Characteristics**:
- Custom infrastructure required
- Experimental or BYOO
- Multiple workers or Durable Objects
- ~800-1,500 lines of code

**Examples**: Meeting Intelligence (Private), Private Emails Documented, Databases Mirrored

## Package Dependencies

```
packages/
├── workflows/          # 49 workflow templates
│   └── src/
│       ├── meeting-intelligence/
│       ├── payments-tracked/
│       └── ...
│
├── integrations/       # BaseAPIClient implementations
│   └── src/
│       ├── zoom/
│       ├── notion/
│       ├── slack/
│       ├── stripe/
│       └── ...
│
├── sdk/               # Core SDK (@workwayco/sdk)
│   └── src/
│       ├── defineWorkflow.ts
│       ├── workers-ai/
│       └── ...
│
├── cli/               # CLI tool (workway command)
│   └── src/
│       ├── commands/
│       │   ├── workflow/init.ts
│       │   └── agentic/create.ts
│       └── ...
│
└── workers/           # Cloudflare Workers
    └── design-tokens/ # CDN for design system
```

## Integration Availability

| Integration | OAuth | Webhook | SDK Path |
|-------------|-------|---------|----------|
| Zoom | ✅ | ✅ | `integrations/zoom` |
| Notion | ✅ | ❌ | `integrations/notion` |
| Slack | ✅ | ✅ | `integrations/slack` |
| Stripe | ✅ | ✅ | `integrations/stripe` |
| Linear | ✅ | ✅ | `integrations/linear` |
| GitHub | ✅ | ✅ | `integrations/github` |
| HubSpot | ✅ | ✅ | `integrations/hubspot` |
| Google Calendar | ✅ | ✅ | `integrations/google-calendar` |
| Google Drive | ✅ | ✅ | `integrations/google-drive` |
| Google Sheets | ✅ | ❌ | `integrations/google-sheets` |
| Todoist | ✅ | ✅ | `integrations/todoist` |
| Calendly | ✅ | ✅ | `integrations/calendly` |
| Typeform | ✅ | ✅ | `integrations/typeform` |
| Airtable | ✅ | ✅ | `integrations/airtable` |
| Dribbble | ✅ | ❌ | `integrations/dribbble` |
| Sentry | ✅ | ✅ | `integrations/sentry` |
| Discord | ✅ | ✅ | `integrations/discord` |
| Twilio | ✅ | ❌ | `integrations/twilio` |
| Gmail | ⚠️  | ❌ | `integrations/gmail` (BYOO only) |
| Sikka | ✅ | ✅ | `integrations/sikka` (Dental PMS) |
| Procore | ✅ | ✅ | `integrations/procore` (Construction) |

**Legend**:
- ✅ Available
- ❌ Not supported
- ⚠️  BYOO (Bring Your Own OAuth) - requires custom app verification

## AI Capabilities

WORKWAY uses Cloudflare Workers AI (no external API keys required):

| Intent | Model | Cost per 1M tokens | Use Case |
|--------|-------|-------------------|----------|
| Synthesis | Llama 3 | ~$0.01 | Meeting summaries, email digests |
| Classification | Llama 2 | ~$0.005 | Ticket routing, sentiment analysis |
| Extraction | Llama 3 | ~$0.01 | Action items, key topics |
| Generation | Mistral | ~$0.02 | Blog posts, newsletters |

## Agentic Workflow Creation

The CLI supports natural language workflow generation:

```bash
workway create "A workflow that processes meeting recordings and creates tasks"
```

**Clarification Mode**: When multiple approaches are valid, CLI enters interactive mode:
- Task destination? (Linear, Asana, Notion, GitHub Issues)
- Notification channel? (Slack, Email, Both, None)
- Document storage? (Notion, Google Docs, Confluence, Markdown)
- Trigger frequency? (Real-time, Hourly, Daily, Manual)
- AI depth? (Quick, Standard, Detailed)

**Generated Output**: TypeScript workflow with:
- Detected integrations
- Smart defaults
- Intent-based AI model selection
- Zuhandenheit patterns (tools recede, outcomes remain)

## Claude Code Integration

### Commands Added (Phase 4)

```bash
workway init --with-claude          # Generate .claude/ directory
workway create [prompt]             # Agentic workflow generation
```

### .claude/ Directory Structure

```
workflows/my-workflow/
├── workflow.ts
├── test-data.json
├── README.md
├── package.json
└── .claude/
    ├── CLAUDE.md           # Workflow-specific instructions
    ├── context.json        # Integration metadata
    └── workflow-meta.yaml  # Beads issue mapping
```

### Beads Integration

```bash
# workway init creates Beads issue
$ workway init my-workflow --with-claude
✓ Created workflow project
✓ Created Beads issue: ww-abc123 (workflow:init)

# workway publish updates issue status
$ workway publish
✓ Published to marketplace
✓ Updated Beads issue: ww-abc123 → closed (commit: a1b2c3d)
```

## Related Documentation

- `docs/PLATFORM_THESIS.md` - Business model and positioning
- `docs/DEVELOPER_CAPABILITIES.md` - What developers can/cannot do
- `docs/WORKERS_RUNTIME_GUIDE.md` - Cloudflare Workers constraints
- `docs/OUTCOME_TAXONOMY.md` - Outcome-driven discovery model
- `docs/MARKETPLACE_CURATION.md` - Workflow curation principles
- `CLAUDE.md` - Root project instructions
- `.claude/rules/` - Beads workflow, deployment safety, harness patterns
