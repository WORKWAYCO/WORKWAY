# WORKWAY Platform Thesis

**The tool recedes. The outcome remains.**

---

## Executive Summary

WORKWAY is a **two-sided platform** connecting:
- **Users** who want outcomes (not automations)
- **Developers** who want revenue (not infrastructure)

Both sides benefit from the same Heideggerian principle: the mechanism disappears, leaving only value.

---

## The Two Sides

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   USER SIDE                               DEVELOPER SIDE                    │
│   "I want outcomes"                       "I want revenue"                  │
│                                                                             │
│   Pain: Tools fragment my work            Pain: Infrastructure blocks       │
│   Want: Things that handle themselves     Want: Ship and earn               │
│                                                                             │
│   ┌───────────────────┐                   ┌───────────────────┐            │
│   │ Knowledge Worker  │                   │ Solo Developer    │            │
│   │ Small Business    │                   │ Agency            │            │
│   │ Operations Team   │                   │ Consultant        │            │
│   │ IT Administrator  │                   │ SaaS Builder      │            │
│   └───────────────────┘                   └───────────────────┘            │
│            │                                       │                        │
│            │ Discovers, Enables                    │ Builds, Deploys        │
│            ▼                                       ▼                        │
│   ┌─────────────────────────────────────────────────────────────┐          │
│   │                      WORKWAY PLATFORM                        │          │
│   │                                                              │          │
│   │   ┌─────────────┐                     ┌─────────────┐       │          │
│   │   │ Marketplace │ ◄─────────────────► │  SDK + CLI  │       │          │
│   │   │ (Browse)    │                     │  (Create)   │       │          │
│   │   └─────────────┘                     └─────────────┘       │          │
│   │                                                              │          │
│   │   OAuth ─── Billing ─── Users ─── Metering ─── Workers      │          │
│   │                                                              │          │
│   └─────────────────────────────────────────────────────────────┘          │
│            │                                       │                        │
│            ▼                                       ▼                        │
│   "My meetings handle                     Revenue per                       │
│    their own follow-up"                   workflow sold                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Pricing Model

### The Split

| Party | Revenue Source | Model |
|-------|----------------|-------|
| **Developer** | One-time purchase from User | Developer sets price (free or paid), keeps 100% after processing |
| **WORKWAY** | Per-execution fee from User | 1¢/run flat rate |
| **User** | Pays both | Upfront purchase + usage fees |

### No Subscriptions

WORKWAY deliberately avoids subscription pricing:
- No monthly platform fees
- No seat-based pricing
- No minimum commitments

**Why**: Subscriptions create Vorhandenheit—the tool becomes visible as a line item. Usage-based pricing lets the tool recede; users pay only when value is delivered.

### Trial Model

Every account starts with **100 free runs**. Users experience value before committing.

### Real-World Examples

| Business | Workflow | Upfront | Monthly Usage | Total |
|----------|----------|---------|---------------|-------|
| Dental office | Appointment reminders | $49 | ~$3 (300 × 1¢) | $52 first month |
| Coffee shop | Transaction sync | $29 | ~$2 (200 × 1¢) | $31 first month |
| Pickleball facility | Booking confirmations | $39 | ~$1.50 (150 × 1¢) | $40.50 first month |

---

## User Side

### Who They Are

| Segment | Size | Pain Point |
|---------|------|------------|
| **Knowledge Workers** | Individual | "I spend hours on meeting follow-up" |
| **Small Business** | 1-20 employees | "My tools don't talk to each other" |
| **Operations Teams** | Department | "Manual processes eat our time" |
| **IT Administrators** | Enterprise | "We need controlled, auditable automation" |

### What They Want

**Outcomes, not automations.**

| They Say | They Mean |
|----------|-----------|
| "Sync my Zoom to Notion" | "I want meetings that document themselves" |
| "Connect Stripe to Airtable" | "I want finances that track themselves" |
| "Integrate Slack with Linear" | "I want issues that create themselves from conversations" |

### User Journey

```
1. DISCOVER
   Browse marketplace by outcome ("meeting follow-up", "customer tracking")

2. TRY
   Enable workflow → 100 free runs
   Connect OAuth (one click per service)

3. USE
   Workflow runs automatically on triggers
   User sees outcomes, not mechanisms

4. PAY
   One-time purchase to developer (if priced)
   Per-execution to WORKWAY (1¢/run)

5. SCALE
   Usage grows naturally with business
   No plan upgrades, no tier negotiations
```

### User-Side Zuhandenheit

**The tool recedes:**
- User doesn't manage API keys
- User doesn't configure webhooks
- User doesn't think about "Zoom API" or "Notion API"
- User thinks: "my meetings create their own notes"

**The tool becomes visible only when it breaks** (Vorhandenheit):
- OAuth token expires → re-authenticate
- Workflow fails → error notification
- Otherwise: invisible

### Competitive Landscape (User Side)

| Alternative | Why Users Choose WORKWAY Instead |
|-------------|----------------------------------|
| **Zapier** | WORKWAY sells outcomes, Zapier sells connections. "Zoom to Notion in 5 steps" vs "Meeting notes that write themselves" |
| **Make** | Visual builders require users to think like programmers. WORKWAY: enable and forget |
| **Manual work** | WORKWAY is cheaper than human time. 1¢ vs 15 minutes of follow-up |
| **Custom development** | Users can't code. WORKWAY: no code required |
| **Do nothing** | WORKWAY's 20-trial model removes risk of trying |

### User-Side Value Proposition

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│   WITHOUT WORKWAY              WITH WORKWAY                    │
│                                                                │
│   Meeting ends                 Meeting ends                    │
│        │                            │                          │
│        ▼                            ▼                          │
│   Open Notion                  [Automatic]                     │
│   Copy meeting link            Notion page created             │
│   Create page                  Transcript attached             │
│   Find transcript              Summary generated               │
│   Copy transcript              Slack notification sent         │
│   Paste and format             Action items extracted          │
│   Open Slack                                                   │
│   Write summary                                                │
│   Post to channel                   │                          │
│   Review for action items           ▼                          │
│   Create tasks                 Done. 1¢.                       │
│        │                                                       │
│        ▼                                                       │
│   45 minutes gone                                              │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Developer Side

### Who They Are

| Segment | Motivation | Example |
|---------|------------|---------|
| **Solo Developer** | Side income from automation expertise | "I know Zoom's API well, let me monetize that" |
| **Agency** | Scalable client solutions | "I build custom workflows for clients, need billing" |
| **Consultant** | Productize expertise | "I solve this problem repeatedly, let me sell it" |
| **SaaS Builder** | Recurring revenue from workflow IP | "I want to build a workflow business" |

### What They Want

**Revenue, not infrastructure.**

| They Say | They Mean |
|----------|-----------|
| "I want to build a Zoom integration" | "I want to earn money when people use my Zoom workflow" |
| "I need OAuth for 5 services" | "I don't want to spend months on OAuth" |
| "I need to bill my clients" | "I don't want to integrate Stripe" |
| "I want to deploy to the edge" | "I don't want to manage Cloudflare" |

### Developer Journey

```
1. CREATE
   workway create "zoom meeting to notion with AI summary"
   → Generates workflow scaffold

2. CUSTOMIZE
   Edit execute() function
   Full TypeScript, Workers AI, fetch() available

3. PRICE
   Set one-time purchase price (or free)
   Pricing: 1¢/run flat rate

4. DEPLOY
   workway deploy
   → OAuth, billing, users, metering handled

5. EARN
   Marketplace: public discovery
   Private: org-specific, agency model

   Revenue = (one-time price) × installs
```

### Developer-Side Zuhandenheit

**Infrastructure recedes:**

| Without WORKWAY | With WORKWAY |
|-----------------|--------------|
| Implement OAuth for Zoom | `integrations: ['zoom']` |
| Implement OAuth for Notion | `integrations: ['zoom', 'notion']` |
| Build token refresh logic | Handled |
| Create user database | Handled |
| Implement billing with Stripe | `pricing: { upfrontPrice: 4900 }` |
| Build usage metering | Handled |
| Deploy to Cloudflare Workers | `workway deploy` |
| Handle multi-tenancy | Handled |

**Developer focuses on:**
```typescript
async execute({ integrations, trigger }) {
  const transcript = await integrations.zoom.getTranscript(trigger.data.meetingId);
  const summary = await integrations.ai.generateText({
    model: '@cf/meta/llama-3-8b-instruct',
    prompt: `Summarize this meeting: ${transcript}`
  });
  await integrations.notion.createPage({
    database: config.notionDatabase,
    properties: { Title: { title: [{ text: { content: trigger.data.topic } }] } },
    children: [{ paragraph: { text: summary } }]
  });
}
```

That's it. OAuth, billing, deployment, metering—all invisible.

### Competitive Landscape (Developer Side)

| Alternative | Why Developers Choose WORKWAY Instead |
|-------------|---------------------------------------|
| **Build SaaS yourself** | 2-6 months of OAuth/billing/infra work vs days with WORKWAY |
| **Supabase + Stripe + Cloudflare** | Still need to wire everything together. WORKWAY: integrated |
| **Pipedream** | Developer-focused but no marketplace monetization model |
| **Sell on Zapier** | Zapier's partner program has high barriers. WORKWAY: deploy and earn |
| **Freelance/consulting** | Time-for-money. WORKWAY: build once, earn repeatedly |

### Developer-Side Value Proposition

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│   WITHOUT WORKWAY                WITH WORKWAY                  │
│                                                                │
│   Month 1: OAuth implementation  Day 1: Write workflow logic   │
│   Month 2: User management       Day 2: Test locally           │
│   Month 3: Billing integration   Day 3: Deploy                 │
│   Month 4: Usage metering        Day 4: Listed in marketplace  │
│   Month 5: Deployment pipeline   Day 5: First sale             │
│   Month 6: Bug fixes                                           │
│        │                              │                        │
│        ▼                              ▼                        │
│   Maybe ready to sell            Earning revenue               │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## The Flywheel

```
                    ┌─────────────────────┐
                    │   More Workflows    │
                    │   in Marketplace    │
                    └──────────┬──────────┘
                               │
              Developers see   │   More outcomes
              revenue ◄────────┤   attract users
                               │
                               ▼
┌──────────────┐      ┌─────────────────┐      ┌──────────────┐
│   Developer  │      │                 │      │     User     │
│   Revenue    │◄─────│     WORKWAY     │─────►│    Value     │
│              │      │                 │      │              │
└──────────────┘      └─────────────────┘      └──────────────┘
                               ▲
              More users       │   Users want
              attract ─────────┤   more workflows
              developers       │
                               │
                    ┌──────────┴──────────┐
                    │    More Users       │
                    │    on Platform      │
                    └─────────────────────┘
```

### Flywheel Mechanics

1. **Developer builds workflow** → Listed in marketplace
2. **User discovers workflow** → Gets 100 free runs
3. **User sees value** → Purchases and uses
4. **Developer earns revenue** → Builds more workflows
5. **More workflows** → More users discover platform
6. **More users** → More developers see opportunity
7. **Repeat**

### Private Workflows: Flywheel Accelerant

Private workflows (org-specific) provide immediate revenue without marketplace chicken-and-egg:

```
Agency builds for Client A
        │
        ▼
Client A pays upfront + usage
        │
        ▼
Agency reuses pattern for Client B
        │
        ▼
Agency generalizes → Marketplace workflow
        │
        ▼
Public users discover
```

---

## Heideggerian Design Principles

### For Users: Zuhandenheit (Ready-to-hand)

The workflow is **ready-to-hand** when the user doesn't think about it:

| Vorhandenheit (Present-at-hand) | Zuhandenheit (Ready-to-hand) |
|---------------------------------|------------------------------|
| "I need to configure my Zoom-Notion integration" | "My meetings document themselves" |
| "The OAuth token expired" | [Invisible re-authentication] |
| "Let me check if the workflow ran" | [It ran. User sees the Notion page.] |

**Design test**: Can the user describe the value without mentioning technology?
- Wrong: "It syncs Zoom transcripts to Notion via API"
- Right: "My meetings write their own notes"

### For Developers: Infrastructure Recession

The platform is **ready-to-hand** when developers focus only on workflow logic:

| Vorhandenheit | Zuhandenheit |
|---------------|--------------|
| "I need to implement OAuth for Zoom" | `integrations: ['zoom']` |
| "How do I handle token refresh?" | [Handled] |
| "I need to set up Stripe webhooks" | `pricing: { upfrontPrice: 4900 }` |
| "How do I deploy to Cloudflare?" | `workway deploy` |

**Design test**: Can the developer ship in days, not months?

### For Both: Weniger, aber besser (Less, but better)

| Principle | User Application | Developer Application |
|-----------|------------------|----------------------|
| **Remove until it breaks** | Fewest possible configuration options | Fewest possible SDK concepts |
| **Outcomes over features** | "Meeting follow-up" not "Zoom + Notion + Slack" | "Deploy and earn" not "OAuth + billing + metering" |
| **Honest design** | Real pricing, no hidden fees | Real capabilities, no false promises |

---

## Competitive Positioning Summary

### WORKWAY vs. Alternatives

| Competitor | User Experience | Developer Experience | WORKWAY Advantage |
|------------|-----------------|---------------------|-------------------|
| **Zapier** | Build automations step-by-step | Partner program (high barrier) | Outcomes, not connections. Marketplace for all |
| **Make** | Visual programming | No marketplace | No-code enable, not no-code build |
| **n8n** | Self-host complexity | Open source (no monetization) | Hosted + monetization |
| **Pipedream** | Developer-focused | Good DX, no marketplace | Marketplace + billing |
| **Tray.io** | Enterprise, expensive | Enterprise sales model | SMB-friendly, usage-based |
| **Building yourself** | N/A | 2-6 months infrastructure | Days to revenue |

### The WORKWAY Position

```
                        Developer-Friendly
                              ▲
                              │
                              │    ┌─────────┐
                              │    │ WORKWAY │ ← Marketplace + SDK + Revenue
                              │    └─────────┘
                              │
                    ┌─────────┤
                    │Pipedream│
                    └─────────┘
                              │
         ┌──────┐             │              ┌───────┐
         │ n8n  │             │              │ Tray  │
         └──────┘             │              └───────┘
                              │
◄─────────────────────────────┼──────────────────────────────────►
Open Source                   │                          Enterprise
                              │
                    ┌─────────┤
                    │  Make   │
                    └─────────┘
                              │
                    ┌─────────┤
                    │ Zapier  │
                    └─────────┘
                              │
                              ▼
                        User-Friendly
```

WORKWAY occupies the **upper-right quadrant**: developer-friendly SDK with user-friendly outcomes, plus a monetization layer neither axis provides alone.

---

## Success Metrics

### User Side

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Workflow activation rate | >50% try → enable | Users find value in trial |
| Trial → paid conversion | >20% | Value is clear |
| Execution volume growth | MoM increase | Platform delivering outcomes |
| Net Promoter Score | >40 | Users recommend to others |

### Developer Side

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Time to first deploy | <1 week | Platform is truly easy |
| Workflows per developer | >3 average | Developers see ongoing opportunity |
| Developer revenue | Growing | Flywheel working |
| Private workflow adoption | >30% of revenue | Agency model validated |

### Platform Health

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Workflows in marketplace | 100+ | Critical mass for discovery |
| Unique integrations used | All 18+ active | Platform breadth |
| User-developer ratio | 100:1 | Healthy two-sided dynamics |

---

## Appendix: Pricing Deep Dive

### Why This Model Works

**For Users:**
- Try before buying (100 free runs)
- Pay for value received (per execution)
- No commitment trap (no subscriptions)
- Costs scale with business (not with seats)

**For Developers:**
- 100% of purchase price (after processing)
- No revenue share on their pricing
- Clear value proposition to users
- Recurring exposure via marketplace

**For WORKWAY:**
- Revenue scales with platform value delivered
- Aligned incentives (more usage = more revenue)
- No customer success burden (self-service)
- Defensible moat (integrations + marketplace)

### Pricing Examples

**Flat Rate (1¢/run)**
```
Meeting Notes Automation
- Developer price: $39 one-time
- User executes: 200 meetings/month
- Monthly cost to user: $39 + $2 = $41 first month, $2/month ongoing
- Developer earns: $39 per install
- WORKWAY earns: $2/month per active user
```

```
AI Meeting Intelligence with Multi-Step Processing
- Developer price: $99 one-time
- User executes: 50 meetings/month
- Monthly cost to user: $99 + $0.50 = $99.50 first month, $0.50/month ongoing
- Developer earns: $99 per install
- WORKWAY earns: $0.50/month per active user
```

### Why No Subscriptions

Subscriptions create **Vorhandenheit**:
- Monthly bill → user thinks about the tool
- "Am I using this enough?" → tool becomes visible
- Cancellation friction → adversarial relationship

Usage-based pricing maintains **Zuhandenheit**:
- Pay only when value delivered
- Tool invisible when working
- Natural scaling with business
- No "subscription fatigue"

---

## Conclusion

WORKWAY's thesis is simple:

**Users want outcomes. Developers want revenue. WORKWAY makes both invisible.**

The platform succeeds when:
1. Users describe workflows by outcome, not technology
2. Developers ship in days, not months
3. Both sides forget WORKWAY exists—and that's the point

*Weniger, aber besser.*
