# Error Incident Manager - Notion Database Template

Create this database in Notion to track Sentry incidents automatically.

## Quick Setup

1. **Create a new Notion database** (Full page database recommended)
2. **Name it:** `Incident Tracker` or `Error Log`
3. **Add the properties below** (exact names required)
4. **Copy the database ID** from the URL: `notion.so/YOUR_WORKSPACE/DATABASE_ID?v=...`

---

## Database Properties

| Property Name   | Type     | Options / Notes                                    |
|-----------------|----------|----------------------------------------------------|
| **Name**        | Title    | Auto-filled: `[ISSUE-ID] Error message`            |
| **Status**      | Select   | `Open`, `In Progress`, `Resolved`, `Ignored`       |
| **Severity**    | Select   | `Fatal`, `Error`, `Warning`, `Info`, `Debug`       |
| **First Seen**  | Date     | When Sentry first captured this error              |
| **Last Seen**   | Date     | Most recent occurrence                             |
| **Occurrences** | Number   | Total event count                                  |
| **Users Affected** | Number | Unique users impacted                           |
| **Project**     | Select   | Your Sentry project names (e.g., `workway-api`)    |
| **Sentry Link** | URL      | Direct link to issue in Sentry                     |
| **Assignee**    | Person   | (Optional) Who's fixing this                       |
| **Fix PR**      | URL      | (Optional) Link to the fix pull request            |
| **Resolved At** | Date     | Auto-set when Sentry marks issue resolved          |

---

## Recommended Views

### 1. Open Incidents (Default)
- **Filter:** Status is `Open` or `In Progress`
- **Sort:** Occurrences (descending) → most impactful first
- **Group by:** Severity

### 2. By Project
- **Group by:** Project
- **Sort:** Last Seen (descending)

### 3. Timeline
- **View type:** Timeline
- **Timeline by:** First Seen → Resolved At
- **Filter:** Status is not `Ignored`

### 4. This Week
- **Filter:** First Seen is within past week
- **Sort:** First Seen (descending)

---

## Page Template (Auto-created)

Each incident page includes:

```
## Error Details

> 🔴 [File path / function where error occurred]

---

### Resolution Checklist
- [ ] Investigate root cause
- [ ] Create fix PR
- [ ] Deploy fix
- [ ] Verify resolution in Sentry
```

---

## Workflow Connection

After creating the database:

1. Go to WORKWAY → Workflows → Error Incident Manager
2. Click "Configure"
3. Paste your **Notion Database ID**
4. Select your **Slack Alert Channel**
5. Enable the workflow

Your Sentry errors will now automatically:
- Create incident pages in this database
- Post alerts to your Slack channel
- Track resolution progress
- Update status to "Resolved" when fixed in Sentry

---

## Database ID

Find your database ID in the Notion URL:

```
https://notion.so/your-workspace/DATABASE_ID_HERE?v=...
                                  ^^^^^^^^^^^^^^^^
```

The ID is the 32-character string before `?v=`.

---

## Public Database (Optional)

To make this a public incident tracker:

1. Click "Share" in Notion
2. Enable "Share to web"
3. Copy the public URL
4. Share with your community for transparency

This is how WORKWAY dogfoods this workflow publicly.

---

## The Complete Circle (Self-Healing Architecture)

This workflow demonstrates the power of compound automation:

```
Error occurs in production
        ↓
Sentry captures error → Webhook to WORKWAY
        ↓
WORKWAY creates Notion incident page
        ↓
WORKWAY posts Slack alert with context
        ↓
Developer investigates and fixes
        ↓
Developer marks issue "Resolved" in Sentry
        ↓
WORKWAY updates Notion page → Status: Resolved
        ↓
Slack notification: "✅ Issue Resolved"
```

### Heideggerian Philosophy

This workflow embodies **Zuhandenheit** (ready-to-hand):
- **Normal operation**: The tool is invisible
- **Breakdown**: The tool surfaces with full context
- **Resolution**: Return to invisible flow

The tool recedes until breakdown occurs — then it surfaces to help you fix it.
