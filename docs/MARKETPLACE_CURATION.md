# Marketplace Curation: The Pathway Model

## The Core Insight

The WORKWAY "marketplace" isn't a marketplace at all. It's a **pathway**.

Traditional marketplaces present abundance: browse, compare, evaluate, choose. This forces users into *Vorhandenheit*—theoretical contemplation of tools as objects. The tool becomes visible; the outcome recedes.

WORKWAY inverts this. We pre-curate. We surface ONE path. The user never "shops"—they accept a recommendation and achieve an outcome.

**Heideggerian lens**: A marketplace with "taste" achieves Zuhandenheit by **disappearing**. The user doesn't think "I should check the marketplace." The right automation appears at the right moment. The tool recedes; the outcome remains.

---

## The Phenomenological Problem with Traditional Marketplaces

### Abundance Creates Burden

When users encounter:
- 15 workflows across 9 categories
- Featured vs. non-featured distinctions
- Ratings, reviews, developer reputation
- Pricing tiers to compare

...they must become **evaluators**. They think *about* workflows instead of *through* them to outcomes.

Every choice is a burden. Every comparison is cognitive load. The marketplace itself becomes the obstacle.

### Users Arrive Thrown, Not Browsing

Users don't think: "I need a productivity workflow."

Users think: "I just had a Zoom meeting and need to get notes somewhere."

They arrive in **situations** (Geworfenheit), not categories. The taxonomy of traditional marketplaces mismatches the phenomenology of need.

---

## The Pathway Model

### From Marketplace to Moment

**Traditional**: User → Marketplace → Browse → Compare → Evaluate → Choose → Configure → Activate

**Pathway**: Trigger → Suggestion → Accept → Done

The "marketplace" dissolves into contextual moments:
- User connects Zoom + Notion → "Want meeting notes automated?"
- User finishes a meeting → "Send notes to Notion?"
- User receives a payment → "Track this in Notion?"

No browsing. No comparison. One path to the outcome.

### One Integration-Pair, One Workflow

Instead of showing multiple workflows for the same use case, we **pre-curate**:

| Integration Pair | Outcome | Workflow |
|------------------|---------|----------|
| Zoom → Notion | Meeting notes | Meeting Intelligence |
| Stripe → Notion | Invoice tracking | Stripe to Notion |
| Typeform → HubSpot | Lead capture | Sales Lead Pipeline |
| Slack → Notion | Message archiving | (future) |

If users want alternatives, they can ask. But the default is **one path**.

### Outcome Taxonomy (Verbs, Not Nouns)

Replace category taxonomy with **outcome statements**:

| Old Category | New Outcome Frame |
|--------------|-------------------|
| productivity | "After meetings..." |
| finance | "When payments arrive..." |
| sales | "When leads come in..." |
| marketing | "Weekly, automatically..." |
| customer-support | "When tickets arrive..." |
| operations | "Every morning..." |

These are temporal, situational, verb-driven. They match how users actually think.

---

## Quality Without Social Proof

### Pre-Launch Reality

We don't have users yet. No ratings. No reviews. No install counts. No retention data.

**This is a feature, not a bug.**

Traditional marketplaces need social proof to help users choose between options. But we're not offering choices—we're offering **paths**. One integration pair = one workflow.

### Editorial Curation (Pre-Users)

Without social signals, curation is **editorial**:

| Signal | How We Measure | Why It Matters |
|--------|----------------|----------------|
| **Zuhandenheit Score** | Code analysis | Does the tool recede? |
| **Essential Fields** | Count ≤ 3 | Minimal configuration |
| **Works Out of Box** | Smart defaults | One-click ready |
| **Graceful Degradation** | Optional integrations | Handles missing pieces |
| **Automatic Trigger** | Webhook vs manual | No user action needed |

### Post-Launch Metrics (Future)

Once we have users, we'll add:

| Signal | When Available | Purpose |
|--------|----------------|---------|
| Success Rate | After ~100 executions | Reliability |
| Time-to-Value | After ~50 activations | Tool recession validation |
| 30-Day Retention | After 30 days | Outcome achievement |

**Key insight**: We don't need social proof to pre-curate. We need good taste.

### The Zuhandenheit Score

Calculated from pathway metadata—no user data required:

```typescript
function calculateZuhandenheitScore(pathway: PathwayMetadata): number {
  let score = 50;

  // From pathway.zuhandenheit (declared by workflow author)
  if (pathway.zuhandenheit.worksOutOfBox) score += 15;
  if (pathway.zuhandenheit.gracefulDegradation) score += 10;
  if (pathway.zuhandenheit.automaticTrigger) score += 10;

  // From pathway.essentialFields (fewer = better)
  const fieldCount = pathway.essentialFields.length;
  if (fieldCount === 0) score += 20;      // One-click ready
  else if (fieldCount === 1) score += 15;
  else if (fieldCount <= 3) score += 10;
  else score -= 10;                        // Too many fields

  // From pathway.zuhandenheit.timeToValue (faster = better)
  if (pathway.zuhandenheit.timeToValue < 5) score += 10;
  else if (pathway.zuhandenheit.timeToValue < 60) score += 5;
  else if (pathway.zuhandenheit.timeToValue > 1440) score -= 5; // > 1 day

  return Math.max(0, Math.min(100, score));
}
```

High Zuhandenheit score = the workflow disappears into use.

**Current workflow scores** (from pathway metadata):

| Workflow | Essential Fields | Works Out of Box | Score |
|----------|------------------|------------------|-------|
| stripe-to-notion | 1 | Yes | 85 |
| meeting-intelligence | 1 | Yes | 85 |
| standup-bot | 1 | Yes | 85 |
| team-digest | 1 | Yes | 85 |
| sales-lead-pipeline | 2 | Yes | 80 |
| support-ticket-router | 1 | No | 70 |

---

## Contextual Surfacing

### Trigger-Based Discovery

Instead of users visiting a marketplace, workflows surface at moments of relevance:

```typescript
interface DiscoveryMoment {
  // When this moment occurs
  trigger:
    | 'integration_connected'      // User just connected Zoom
    | 'event_received'             // Webhook fired (meeting ended)
    | 'time_based'                 // Monday morning
    | 'pattern_detected';          // User manually did this 3 times

  // What integrations are involved
  integrations: string[];

  // The outcome to suggest
  suggestedWorkflow: string;

  // How to phrase it (outcome-focused)
  suggestionText: string;
}

// Examples
const moments: DiscoveryMoment[] = [
  {
    trigger: 'integration_connected',
    integrations: ['zoom', 'notion'],
    suggestedWorkflow: 'meeting-intelligence',
    suggestionText: 'Want meeting notes in Notion automatically?'
  },
  {
    trigger: 'event_received',
    integrations: ['stripe'],
    suggestedWorkflow: 'stripe-to-notion',
    suggestionText: 'Track this payment in Notion?'
  },
  {
    trigger: 'pattern_detected',
    integrations: ['slack', 'notion'],
    suggestedWorkflow: 'slack-to-notion',
    suggestionText: "You've saved 3 Slack messages to Notion this week. Automate it?"
  }
];
```

### The Suggestion Interface

When a discovery moment fires:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  📝 Want meeting notes in Notion automatically?     │
│                                                     │
│  After Zoom meetings, we'll create a Notion page    │
│  with transcript, action items, and summary.        │
│                                                     │
│  [Enable]                          [Not now]        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

No browsing. No comparison. One path.

---

## Minimal Configuration

### The 3-Field Maximum

Workflows should require **at most 3 configuration fields** for initial setup:

```typescript
// Good: Minimal config
inputs: {
  notionDatabase: { type: 'notion_database_picker', required: true },
}

// Bad: Too many choices
inputs: {
  notionDatabase: { required: true },
  slackChannel: { required: true },
  enableAI: { required: true },
  aiModel: { required: true },
  summaryLength: { required: true },
  includeTranscript: { required: true },
  // ... 15 more fields
}
```

### Smart Defaults

Everything beyond the essential 1-3 fields should have **intelligent defaults**:

| Field | Default | Reasoning |
|-------|---------|-----------|
| `enableAI` | `true` | Users want AI; that's why they're here |
| `postToSlack` | `true` if Slack connected | Assume yes if available |
| `summaryLength` | `'medium'` | Safe middle ground |
| `timezone` | Detected from browser | Don't ask what we can infer |

Users can adjust later. But **first activation should be one click**.

### Progressive Disclosure

```
Initial Setup:        "Where should meeting notes go?" → [Notion picker]
After first run:      "Want to also post to Slack?"
After 5 runs:         "Customize your summary format?"
```

Complexity reveals itself over time, not upfront.

---

## Developer Support (Preserved)

Quality signals still trigger support pathways. The platform catches problems before users do.

### Proactive Support Triggers

| Condition | Action |
|-----------|--------|
| Success rate <85% for 7 days | Health alert with diagnostics |
| Success rate <70% for 14 days | Support ticket opened |
| Success rate <70% for 30 days | Workflow hidden, still accessible via direct link |
| No updates for 12 months | "Legacy" label |

### Graduated Visibility

```
Recommended → Listed → Needs Work → Dormant
     ↑                               ↓
     └──── Recovery path available ──┘
```

**"Needs Work"**: Hidden from suggestions, accessible via direct URL, developer gets diagnostics.

**"Dormant"**: Fully hidden, one-click reactivation, data preserved.

### Key Principle

Every status has a recovery path. The platform supports developers through difficulties.

---

## What We Removed

| Removed | Why |
|---------|-----|
| **Category browsing** | Users don't think in categories |
| **Featured vs. non-featured** | Creates meta-decisions |
| **User-visible ratings** | Makes users evaluate instead of act |
| **Developer reputation display** | Users don't care who made it |
| **Workflow comparison** | One path, not many |
| **Complex search filters** | Discovery is contextual, not searched |

## What We Kept

| Kept | Why |
|------|-----|
| **Quality tracking** | Informs which workflow we recommend |
| **Developer support** | Maintains ecosystem health |
| **Zuhandenheit scoring** | Measures tool recession |
| **Graceful degradation** | Optional features work automatically |

---

## Implementation: Discovery Service

```typescript
export class DiscoveryService {
  /**
   * Surface a workflow suggestion based on context
   * Returns at most ONE workflow—the best path
   */
  async getSuggestion(context: DiscoveryContext): Promise<WorkflowSuggestion | null> {
    const { userId, connectedIntegrations, recentEvent } = context;

    // Find workflows matching user's integration set
    const candidates = await this.findCandidates(connectedIntegrations);

    if (candidates.length === 0) return null;

    // Pre-curate: return THE best option, not a list
    const best = this.selectBest(candidates, context);

    return {
      workflow: best,
      suggestionText: this.generateOutcomeText(best, recentEvent),
      oneClickConfig: this.inferDefaults(best, context),
    };
  }

  /**
   * Select the single best workflow
   * Users never see this comparison—we do it for them
   */
  private selectBest(candidates: Workflow[], context: DiscoveryContext): Workflow {
    return candidates
      .map(w => ({
        workflow: w,
        score: this.calculateFitScore(w, context)
      }))
      .sort((a, b) => b.score - a.score)
      [0].workflow;
  }

  /**
   * Fit score considers quality AND context match
   */
  private calculateFitScore(workflow: Workflow, context: DiscoveryContext): number {
    const quality = workflow.qualityScore;           // Success rate, retention
    const zuhandenheit = workflow.zuhandenheitScore; // Tool recession
    const contextMatch = this.matchContext(workflow, context); // Relevance

    return quality * 0.4 + zuhandenheit * 0.3 + contextMatch * 0.3;
  }

  /**
   * Generate outcome-focused suggestion text
   */
  private generateOutcomeText(workflow: Workflow, event?: TriggerEvent): string {
    // Not: "Enable Meeting Intelligence workflow"
    // But: "Want meeting notes in Notion automatically?"
    return workflow.outcomeStatement;
  }
}
```

---

## The Disappearing Marketplace

The ultimate goal: **users forget the marketplace exists**.

They don't "visit WORKWAY to find a workflow." They:
1. Connect their tools
2. Accept contextual suggestions
3. Achieve outcomes

The marketplace becomes infrastructure—invisible, reliable, receding.

*Weniger, aber besser. Fewer choices, better outcomes.*

---

## Metrics That Matter

### Pre-Launch (Now)

Without users, we measure **editorial quality**:

| Metric | How to Measure | Target |
|--------|----------------|--------|
| **Zuhandenheit score** | Pathway metadata analysis | ≥ 80 for canonical workflows |
| **Essential field count** | pathway.essentialFields.length | ≤ 2 |
| **Integration pair coverage** | Unique pairs with workflows | All common pairs covered |
| **Outcome frame coverage** | Frames with ≥1 workflow | All 8 frames |

### Post-Launch (Future)

Once we have users, we'll add:

| Metric | What It Measures | When Available |
|--------|------------------|----------------|
| **Suggestion acceptance rate** | Right workflow, right moment? | After first users |
| **Time-to-first-outcome** | How fast do users see value? | After ~50 activations |
| **One-click activation rate** | Are defaults good enough? | After ~100 activations |
| **30-day outcome retention** | Still getting value? | After 30 days |

### Metrics We'll Never Track

- Marketplace page views (there's no page to view)
- Time spent browsing (there's no browsing)
- Workflows compared (there's no comparison)
- Search queries (discovery is contextual)

The best marketplace is the one users never think about.
