# Outcome Taxonomy: Verb-Driven Discovery

## The Principle

Users don't think in categories. They think in **situations**.

Not: "I need a productivity workflow."
But: "After meetings, I need notes somewhere."

The outcome taxonomy replaces the category taxonomy with **temporal, verb-driven frames** that match how users actually experience need.

---

## Outcome Frames

Each frame represents a **moment of need**—a situation where automation provides value.

### 1. "After meetings..."

**Trigger**: Meeting ends (Zoom, Google Meet, Teams)
**User thought**: "I need to do something with what just happened"
**Workflows**:
- **Meeting Intelligence** (Zoom → Notion + Slack + Email + CRM)
- **Meeting Summarizer** (Zoom → Slack)
- **Meeting Followup Engine** (Zoom → Email + Todoist)

**Suggestion text**: "Want meeting notes in Notion automatically?"

**Discovery moments**:
```typescript
{
  trigger: 'event_received',
  eventType: 'zoom.meeting.ended',
  integrations: ['zoom', 'notion'],
  workflowId: 'meeting-intelligence',
  priority: 100
}
```

---

### 2. "When payments arrive..."

**Trigger**: Payment succeeds (Stripe, PayPal)
**User thought**: "I need to track this / follow up"
**Workflows**:
- **Stripe to Notion** (Stripe → Notion)
- **Payment Reminders** (Stripe → Email)
- **Invoice Generator** (Stripe → PDF + Email)

**Suggestion text**: "Track this payment in Notion?"

**Discovery moments**:
```typescript
{
  trigger: 'event_received',
  eventType: 'stripe.payment_intent.succeeded',
  integrations: ['stripe', 'notion'],
  workflowId: 'stripe-to-notion',
  priority: 100
}
```

---

### 3. "When leads come in..."

**Trigger**: Form submission (Typeform, Tally), email inquiry
**User thought**: "I need to act on this before I forget"
**Workflows**:
- **Sales Lead Pipeline** (Typeform → HubSpot + Slack + Todoist + Gmail + Notion)

**Suggestion text**: "Want leads to flow into your CRM automatically?"

**Discovery moments**:
```typescript
{
  trigger: 'event_received',
  eventType: 'typeform.form_response',
  integrations: ['typeform', 'hubspot'],
  workflowId: 'sales-lead-pipeline',
  priority: 100
}
```

---

### 4. "Weekly, automatically..."

**Trigger**: Scheduled (Monday morning, Friday EOD)
**User thought**: "I want a summary without doing work"
**Workflows**:
- **Weekly Productivity Digest** (Multiple → Email)
- **Team Digest** (Slack + GitHub → Notion)
- **AI Newsletter** (RSS + AI → Email)

**Suggestion text**: "Want a weekly summary of your team's activity?"

**Discovery moments**:
```typescript
{
  trigger: 'integration_connected',
  integrations: ['slack', 'notion'],
  workflowId: 'team-digest',
  priority: 50  // Lower priority - suggest after other workflows
}
```

---

### 5. "When tickets arrive..."

**Trigger**: Support ticket created (email, form, chat)
**User thought**: "I need to route this to the right person"
**Workflows**:
- **Support Ticket Router** (Email → Slack + Notion)

**Suggestion text**: "Want support tickets routed automatically?"

**Discovery moments**:
```typescript
{
  trigger: 'integration_connected',
  integrations: ['gmail', 'slack'],
  workflowId: 'support-ticket-router',
  priority: 80
}
```

---

### 6. "Every morning..."

**Trigger**: Daily schedule (9 AM local)
**User thought**: "I want to start the day informed"
**Workflows**:
- **Daily Standup** (Slack → Notion)

**Suggestion text**: "Want a daily briefing delivered automatically?"

---

### 7. "When clients onboard..."

**Trigger**: New client signup, contract signed
**User thought**: "There's a sequence of things that need to happen"
**Workflows**:
- **Client Onboarding Pipeline** (Typeform → Notion + Slack + Todoist + Gmail + Calendly)

**Suggestion text**: "Automate your client onboarding sequence?"

---

### 8. "After calls..."

**Trigger**: Call ends (phone, Zoom 1:1)
**User thought**: "I need to log this and follow up"
**Workflows**:
- **Call Followup** (Zoom → CRM + Email)

**Suggestion text**: "Want call notes and follow-ups automated?"

---

## Integration Pair Registry

The canonical mapping of integration pairs to workflows.

**One pair → One workflow** (pre-curated, not compared)

| From | To | Workflow | Outcome Statement |
|------|----|----------|-------------------|
| Zoom | Notion | meeting-intelligence | "Zoom meetings that write their own notes" |
| Zoom | Slack | meeting-summarizer | "Meeting summaries in Slack" |
| Stripe | Notion | stripe-to-notion | "Payments tracked automatically" |
| Stripe | Email | payment-reminders | "Payment reminders that send themselves" |
| Typeform | HubSpot | sales-lead-pipeline | "Leads that flow into your CRM" |
| Email | Slack | support-ticket-router | "Support tickets routed to the right team" |
| Slack | Notion | team-digest | "Weekly team activity digest" |
| Typeform | Notion | client-onboarding-pipeline | "Client onboarding on autopilot" |

---

## Outcome Statements

Each workflow needs three pieces of outcome text:

### 1. Suggestion (Question)
The question we ask when surfacing the workflow.
- "Want meeting notes in Notion automatically?"
- "Track this payment in Notion?"
- "Automate your client onboarding?"

### 2. Explanation (Brief)
One sentence explaining what happens.
- "After Zoom meetings, we'll create a Notion page with transcript, action items, and summary."
- "When payments arrive in Stripe, we'll log them to your Notion database."

### 3. Outcome (Result)
The tangible result achieved.
- "Meeting notes in Notion"
- "Payments tracked automatically"
- "Leads flowing into HubSpot"

---

## Complete Workflow Mapping

| Workflow ID | Outcome Frame | Suggestion | Explanation |
|-------------|---------------|------------|-------------|
| `meeting-intelligence` | after_meetings | "Want meeting notes in Notion automatically?" | "After Zoom meetings, we'll create a Notion page with transcript, action items, and AI summary." |
| `meeting-summarizer` | after_meetings | "Want meeting summaries in Slack?" | "After meetings end, we'll post a summary to your Slack channel." |
| `meeting-followup-engine` | after_meetings | "Want meeting follow-ups automated?" | "After meetings, we'll create tasks and draft follow-up emails." |
| `stripe-to-notion` | when_payments_arrive | "Track payments in Notion?" | "When Stripe payments succeed, we'll log them to your database." |
| `payment-reminders` | when_payments_arrive | "Send payment reminders automatically?" | "Before invoices are due, we'll send reminder emails." |
| `invoice-generator` | when_payments_arrive | "Generate invoices automatically?" | "When payments are received, we'll create and send PDF invoices." |
| `sales-lead-pipeline` | when_leads_come_in | "Want leads to flow into your CRM?" | "When forms are submitted, we'll create contacts, notify your team, and start tasks." |
| `support-ticket-router` | when_tickets_arrive | "Route support tickets automatically?" | "When emails arrive, we'll categorize and route them to the right team." |
| `team-digest` | weekly_automatically | "Want a weekly team digest?" | "Every Monday, we'll summarize your team's Slack and GitHub activity." |
| `weekly-productivity-digest` | weekly_automatically | "Want a weekly productivity summary?" | "Every Friday, we'll summarize what you accomplished." |
| `ai-newsletter` | weekly_automatically | "Generate newsletters automatically?" | "We'll curate and summarize content for your audience." |
| `client-onboarding-pipeline` | when_clients_onboard | "Automate client onboarding?" | "When clients sign up, we'll create their workspace, schedule calls, and start the sequence." |

---

## Discovery Priority Rules

When multiple workflows could match a context, use these rules:

### 1. Event-Triggered Beats Time-Triggered
If a specific event just happened (meeting ended, payment received), prioritize event-triggered workflows over scheduled ones.

### 2. More Specific Beats Less Specific
`zoom.meeting.ended` + `notion` connected → `meeting-intelligence`
vs.
`zoom` connected + `notion` connected → lower priority general suggestion

### 3. Outcome Proximity
Suggest the workflow that gets the user to value fastest. Meeting Intelligence has higher time-to-value than Team Digest.

### 4. Never Suggest What's Active
If user already has Meeting Intelligence enabled, don't suggest it again.

### 5. One Suggestion Per Moment
Even if multiple workflows could match, show only ONE. Pre-curate.

---

## Migration from Categories

| Old Category | Maps To |
|--------------|---------|
| productivity | after_meetings, weekly_automatically |
| finance | when_payments_arrive |
| sales | when_leads_come_in |
| marketing | weekly_automatically |
| customer-support | when_tickets_arrive |
| hr | when_clients_onboard |
| operations | every_morning |
| development | (rarely user-facing) |

The old categories were **platform-centric** (how we organize internally).
The new frames are **user-centric** (how users experience need).

---

## Implementation Notes

### Adding a New Workflow

1. Identify the **outcome frame** (when does the user need this?)
2. Write the **outcome statement** (suggestion, explanation, outcome)
3. Define the **primary integration pair**
4. Add **discovery moments** (when to surface)
5. Specify **essential fields** (max 3)
6. Configure **smart defaults** (what can be inferred)

### Canonical Workflow Selection

For each integration pair, one workflow is **canonical**—the default recommendation.

Selection criteria:
- Highest Zuhandenheit score
- Best success rate
- Lowest time-to-value
- Most complete outcome (prefer compound over simple)

If multiple workflows serve the same pair, the non-canonical ones are:
- Accessible via direct link
- Surfaced if user asks "show me alternatives"
- Not shown in initial suggestion

---

## The Disappearing Taxonomy

The ultimate goal: users never see this taxonomy.

They don't browse "after_meetings" workflows. They:
1. Finish a meeting
2. See: "Want meeting notes in Notion?"
3. Click "Enable"
4. Done

The taxonomy is infrastructure. The user sees outcomes.

*Weniger, aber besser.*
