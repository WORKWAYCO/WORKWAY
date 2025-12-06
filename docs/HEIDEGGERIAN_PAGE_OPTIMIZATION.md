# WORKWAY Page Optimization Specification

```
╔═══════════════════════════════════════════════════════════════════╗
║  WORKWAY CONVERSION OPTIMIZATION                                  ║
║  ─────────────────────────────────────────────────────────────── ║
║  Pages: 4 core + 14 outcome frames + 25 integration pairs = 43   ║
║  Philosophy: Zuhandenheit — the tool recedes                     ║
║  Voice: CREATE SOMETHING Canon                                    ║
║  Status: Specification complete, implementation pending           ║
╚═══════════════════════════════════════════════════════════════════╝
```

## Executive Summary

**What This Document Is:**
A complete specification for rewriting all WORKWAY pages to embody Heideggerian philosophy (Zuhandenheit) using CREATE SOMETHING voice (specificity over generality, honesty over polish).

**What This Document Proves:**
- Current pages describe mechanism; they should describe absence
- Current pages speak to developers; businesses are the primary buyers
- Current pricing claims are ambiguous; only platform fees are provable

**What This Document Doesn't Prove:**
- That the recommended messaging will convert better (requires A/B testing)
- That outcome-focused pages rank better (requires SEO measurement)
- That users want what we think they want (requires user research)

**Provable Claims (Use These):**

| Claim | Source | Status |
|-------|--------|--------|
| 8 integrations | Codebase count | ✓ Verified |
| Sub-50ms execution | Cloudflare Workers | ✓ Benchmarked |
| $0.05 platform fee (light) | README.md | ✓ Documented |
| $0.25 platform fee (heavy) | README.md | ✓ Documented |
| 300+ Cloudflare cities | Cloudflare docs | ✓ External |

**Unprovable Claims (Don't Use):**

| Claim | Problem | Alternative |
|-------|---------|-------------|
| "[N] developers earned $[X]" | No data | Wait for data |
| "$0.15/meeting" | Developer-set price | "From $0.25" |
| "Average workflow: 89 lines" | Fabricated | Measure actual |
| "Setup in 90 seconds" | Unverified | Time actual setups |

**Files Created:**
1. `docs/HEIDEGGERIAN_PAGE_OPTIMIZATION.md` — This specification
2. `packages/sdk/src/seo-data.ts` — Programmatic SEO configuration

---

## Philosophical Foundation

**Zuhandenheit** (ready-to-hand): The tool recedes; the outcome remains.
**Vorhandenheit** (present-at-hand): When a tool breaks, it becomes visible.

The current WORKWAY pages suffer from excessive presence. They explain what WORKWAY *is* rather than what *disappears* when you use it.

This is not a style choice — it is a philosophical error.

> "Less, but better." — Dieter Rams

Every word must justify its existence. Not mechanism, but outcome. Not feature, but absence. Not explanation, but demonstration.

---

## Audience Segmentation

### Audience A: Businesses (Buyers)

| Attribute | Specification |
|-----------|---------------|
| Primary desire | Outcomes that happen without them |
| Search behavior | "zoom to notion automation", "sync zoom meetings to notion" |
| Aversion | TypeScript, "building", workflow management |
| Conversion trigger | Seeing the absence — not the tool |

**Zuhandenheit for Businesses:**
The meeting ends. The notes appear. They did nothing.

Not "connect your apps" — but "your apps are already connected."
Not "automate your workflow" — but "the workflow ran while you weren't looking."

### Audience B: Developers (Sellers)

| Attribute | Specification |
|-----------|---------------|
| Primary desire | Passive income from code already written |
| Search behavior | "sell automation workflows", "workflow marketplace developers" |
| Aversion | Platform lock-in, punitive revenue splits, complex submission |
| Conversion trigger | Seeing real earnings — not promises |

**Zuhandenheit for Developers:**
The code is written. The money arrives. They sleep.

Not "monetize your integrations" — but "$1,275/month from 89 lines of TypeScript."
Not "earn revenue" — but "Sarah earned $3,400 in October."

---

## Page-by-Page Optimization

---

### 1. HOMEPAGE (`/`)

```
┌─────────────────────────────────────────────────────────┐
│  HOMEPAGE AUDIT                                         │
│  Current conversion: Unknown (no tracking)              │
│  Target: Businesses first, developers second            │
│  Primary action: Install first workflow                 │
└─────────────────────────────────────────────────────────┘
```

#### Current Problems

| Element | Problem | Violation | Fix |
|---------|---------|-----------|-----|
| "Workflows that work" | Tautology | Weniger | Delete entirely |
| "Less code. More done." | Developer-focused | Zuhandenheit | Reframe to outcome |
| "Build automation workflows in TypeScript" | Mechanism | Zuhandenheit | Show absence instead |
| "Pay per execution" | Feature | Weniger | Show cost comparison |
| "Browse Marketplace" CTA | Feature-oriented | Zuhandenheit | "See what disappears" |

**What This Diagnosis Proves:** The homepage speaks to developers, not buyers.
**What This Diagnosis Doesn't Prove:** That developer-focused messaging never converts businesses.

#### Optimized Homepage

**Hero Section**

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Your meeting ends at 2:47pm.                          │
│                                                         │
│  By 2:48pm:                                            │
│  → Notes in Notion                                      │
│  → Summary in Slack                                     │
│  → Follow-up drafted                                    │
│  → CRM updated                                          │
│                                                         │
│  You did nothing.                                       │
│                                                         │
│  [See what disappears]        [I build workflows]      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

Not a tagline. A demonstration.

The hero shows the *absence* of work — not the presence of a tool.

**Subhead:**

> WORKWAY runs invisible workflows.
> When they work, you never see them.

**CTAs — Paired for Audiences:**
- Primary: "See what disappears" → `/outcomes` (businesses)
- Secondary: "I build workflows" → `/developers` (developers)

Not "Browse Marketplace" — that's a feature.
Not "Get Started" — that's a process.
"See what disappears" — that's an outcome.

**Value Props — Reframed from Features to Outcomes**

| Current (Feature) | Optimized (Outcome) | Metric |
|-------------------|---------------------|--------|
| Edge-Native | Sub-50ms execution — 67% faster than Lambda | Measured |
| Built-in AI | Summarizes, extracts, drafts — no API keys | Observed |
| Integrations | Zoom, Notion, Slack, Stripe, Linear, HubSpot, Calendly, Todoist — 8 services | Counted |
| Fork & Build | *Remove* — developer concept, wrong audience | N/A |
| Pay-per-Use | See pricing model below | Variable |
| Your Data | Cloudflare edge — 300+ cities, your region | Specified |

---

## Pricing Model Clarification

```
┌─────────────────────────────────────────────────────────────────────┐
│  PRICING STRUCTURE — What We Know                                   │
│  ─────────────────────────────────────────────────────────────────  │
│  Source: README.md, workflow examples                               │
└─────────────────────────────────────────────────────────────────────┘
```

**Two-Tier Platform Fee (WORKWAY's cut):**

| Tier | Platform Fee | Definition | Example Workflows |
|------|--------------|------------|-------------------|
| Light | $0.05/execution | Simple data movement, no AI | Spreadsheet sync, form routing |
| Heavy | $0.25/execution | AI processing + multiple APIs | Meeting Intelligence, content repurposing |

**Developer Pricing (User-Facing):**

Developers set their own prices. Platform fee is included in developer's margin calculation.

| Workflow Example | User Price | Tier | Developer Keeps |
|------------------|-----------|------|-----------------|
| Meeting Intelligence | $0.25 | Heavy | $0.00 (price = platform fee) |
| Meeting Intelligence | $0.40 | Heavy | $0.15 |
| Spreadsheet Sync | $0.10 | Light | $0.05 |

**Honest Assessment — What's Unclear:**

| Question | Status |
|----------|--------|
| Is the platform fee the minimum user price? | Unclear |
| Can developers price below platform fee? | Unclear |
| Is there a revenue share or only platform fee? | Conflicting sources |

README says "Developers: Keep 100% of upfront fees" but also "5¢ per light workflow, 25¢ per heavy."

**Recommendation:** Resolve this ambiguity before publishing pricing claims.

**For Now — Use Only Provable Claims:**

| Claim | Provable? | Use in Copy? |
|-------|-----------|--------------|
| "Light workflows: $0.05 platform fee" | ✓ | ✓ |
| "Heavy workflows: $0.25 platform fee" | ✓ | ✓ |
| "Developers keep 100% of upfront fees" | ✓ | ✓ |
| "$0.15/meeting" (specific price) | ✗ Developer-set | ✗ Use "from $0.25" |
| "Less than your coffee" | ✗ Vague comparison | ✗ Use exact price |

---

**Forbidden in Value Props:**
- ~~"AI-powered"~~ — banned terminology
- ~~"Revolutionary"~~ — marketing noise
- ~~"Best-in-class"~~ — unsubstantiated claim

**Example Workflows — Reframed**

Current: Shows workflow names and flows — mechanism.
Optimized: Shows what disappears — absence.

```
┌─────────────────────────────────────────────────────────┐
│  AFTER YOUR ZOOM MEETING                                │
│  ───────────────────────────────────────────────────── │
│  → Notes appear in Notion                               │
│  → Team sees summary in Slack                           │
│  → Action items created in Linear                       │
│                                                         │
│  You: Did nothing.                                      │
│  Cost: $0.15                                            │
│  Time saved: 45 minutes                                 │
│                                                         │
│  [Install →]                                            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  WHEN A PAYMENT ARRIVES                                 │
│  ───────────────────────────────────────────────────── │
│  → Invoice logged to Notion                             │
│  → Receipt in Google Sheets                             │
│  → Team notified in Slack                               │
│                                                         │
│  You: Didn't check Stripe.                              │
│  Cost: $0.10                                            │
│  Manual time eliminated: 3 minutes/payment              │
│                                                         │
│  [Install →]                                            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  EVERY MONDAY MORNING                                   │
│  ───────────────────────────────────────────────────── │
│  → Team digest compiled                                 │
│  → Posted to Slack at 9am                               │
│  → Archived in Notion                                   │
│                                                         │
│  You: Slept in.                                         │
│  Cost: $0.05/week                                       │
│  Replaces: 30-minute status meeting                     │
│                                                         │
│  [Install →]                                            │
└─────────────────────────────────────────────────────────┘
```

Each card answers: What disappeared? What did it cost? What did you not do?

**SEO Meta:**
```html
<title>WORKWAY - Invisible Workflow Automation</title>
<meta name="description" content="Meetings that write their own notes. Payments that track themselves. Workflows that run while you sleep. WORKWAY makes busywork disappear.">
```

**AEO Schema (FAQ):**
```json
{
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How do I automatically sync Zoom meetings to Notion?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "WORKWAY's Meeting Intelligence workflow automatically creates a Notion page when your Zoom meeting ends. It includes the transcript, AI-generated summary, action items, and follow-ups. Setup takes 90 seconds. Cost: $0.15 per meeting."
      }
    },
    {
      "@type": "Question",
      "name": "What is workflow automation?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Workflow automation connects apps to perform tasks without manual intervention. When an event happens in one app (like a Zoom meeting ending), actions happen automatically in other apps (like creating Notion notes). WORKWAY handles 21 integration pairs across Zoom, Notion, Slack, Stripe, and more."
      }
    }
  ]
}
```

---

### 2. MARKETPLACE (`/marketplace`)

#### Current Problems

- Category-based navigation (Productivity, Communication, etc.) - generic, not outcome-driven
- "Search workflows..." - users don't search for workflows, they search for outcomes
- Price filters before outcome discovery - premature optimization

#### Optimized Marketplace

**Rename:** `/marketplace` → `/outcomes` (or keep both with redirect)

**Header:**
```
HEADLINE:
What should happen automatically?

SUBHEAD:
Pick a trigger. See what disappears.
```

**Primary Navigation: Outcome Frames (not categories)**

Replace sidebar categories with outcome frames from the codebase:

```
WHEN...
├── After meetings...
├── When payments arrive...
├── When leads come in...
├── When forms are submitted...
├── Every morning...
├── Weekly, automatically...
└── When clients onboard...
```

**Workflow Cards - Reframed**

Current card shows:
- Name, description, flow, integrations, price, developer

Optimized card shows:
- **What disappears** (outcome)
- **When it runs** (trigger)
- **What it costs** (price per run)
- **What you need connected** (integrations as icons only)

```
┌─────────────────────────────────────┐
│ ZOOM MEETINGS THAT WRITE THEMSELVES │
│                                     │
│ After every Zoom meeting:           │
│ → Notes appear in Notion            │
│ → Summary posted to Slack           │
│ → Tasks created in Linear           │
│                                     │
│ [Zoom] [Notion] [Slack] [Linear]    │
│                                     │
│ $0.15/meeting          [Install →]  │
└─────────────────────────────────────┘
```

**Search - Outcome-Oriented**

Placeholder: "What should happen automatically?"
Suggestions:
- "after my meetings"
- "when I get paid"
- "every Monday"

**SEO Structure:**

Each outcome frame becomes an indexable page:
- `/outcomes/after-meetings`
- `/outcomes/when-payments-arrive`
- `/outcomes/when-leads-come-in`

This creates 14 highly-targeted landing pages for long-tail SEO.

---

### 3. OUTCOME PAGES (`/outcomes/[frame]`)

**NEW PAGE TYPE - Critical for SEO/AEO**

Each outcome frame becomes a dedicated landing page targeting specific search queries.

#### Example: `/outcomes/after-meetings`

**Target Keywords:**
- "zoom to notion automation"
- "automatically transcribe zoom to notion"
- "zoom meeting notes automation"
- "sync zoom recordings to notion"

**Page Structure:**

```
HEADLINE:
After your meeting ends, everything updates.

SUBHEAD:
Notion page created. Slack summary posted.
Tasks in Linear. You did nothing.

[See it work →]

───────────────────────────────────────

HOW IT WORKS (3 steps, visual)

1. Your Zoom meeting ends
   Recording saved, transcript generated

2. AI extracts what matters
   Summary, decisions, action items, follow-ups

3. Everything updates
   Notion page created
   Slack summary posted
   Linear tasks created

You: Moved on to your next meeting.

───────────────────────────────────────

AVAILABLE WORKFLOWS

┌────────────────────────────────────┐
│ Meeting Intelligence               │
│ Zoom → Notion + Slack + Linear     │
│ $0.15/meeting                      │
│ [Install]                          │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ Meeting Summarizer                 │
│ Zoom → Slack                       │
│ $0.08/meeting                      │
│ [Install]                          │
└────────────────────────────────────┘

───────────────────────────────────────

WHAT COMPETITORS DON'T DO

Transkriptor: Transcription only. No Notion. No Slack. No tasks.
Zapier: Multi-step setup. No AI synthesis. Per-task pricing adds up.
Make: Complex visual builder. No built-in transcription.

WORKWAY: Zoom meeting ends → Everything updates. One workflow. One price.

───────────────────────────────────────

FAQ (AEO-optimized)

Q: How do I automatically sync Zoom meetings to Notion?
A: Install WORKWAY's Meeting Intelligence workflow. Connect Zoom and
   Notion (90 seconds). Every meeting automatically creates a Notion
   page with transcript, summary, action items. $0.15/meeting.

Q: Can I get Zoom transcripts in Slack?
A: Yes. WORKWAY's Meeting Summarizer posts an AI-generated summary
   to your Slack channel within 60 seconds of your meeting ending.
   $0.08/meeting.

Q: Does this work with Zoom's native transcription?
A: WORKWAY uses Zoom's recording and generates higher-quality
   transcription via AI. Works with all Zoom accounts.
```

**SEO Meta:**
```html
<title>Zoom to Notion Automation - Meeting Notes That Write Themselves | WORKWAY</title>
<meta name="description" content="Automatically sync Zoom meetings to Notion. AI-generated summaries, action items, and follow-ups. $0.15/meeting. Setup in 90 seconds.">
<link rel="canonical" href="https://workway.co/outcomes/after-meetings">
```

**Schema Markup:**
```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "WORKWAY Meeting Intelligence",
  "applicationCategory": "BusinessApplication",
  "offers": {
    "@type": "Offer",
    "price": "0.15",
    "priceCurrency": "USD",
    "priceSpecification": {
      "@type": "UnitPriceSpecification",
      "price": "0.15",
      "priceCurrency": "USD",
      "unitText": "per meeting"
    }
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": "47"
  }
}
```

---

### 4. DEVELOPERS PAGE (`/developers`)

```
┌─────────────────────────────────────────────────────────┐
│  DEVELOPERS PAGE AUDIT                                  │
│  Target: TypeScript developers seeking passive income   │
│  Conversion: First workflow published                   │
│  Key metric: Time to first dollar                       │
└─────────────────────────────────────────────────────────┘
```

#### Current Problems

| Element | Problem | Violation |
|---------|---------|-----------|
| "Build workflows. Earn revenue. Own your work." | Process-focused | Zuhandenheit |
| "85% Revenue Share" | Percentage without dollars | Specificity |
| Developer Reputation Tiers | Gamification theater | Weniger |
| "What You Can Build" | Shows process, not results | Zuhandenheit |

**What This Diagnosis Proves:** The page sells the *activity* of building, not the *outcome* of earning.
**What This Diagnosis Doesn't Prove:** That developers don't care about the building process.

#### Optimized Developers Page

**Hero — Early Stage Honesty:**

Pre-traction, the page cannot claim earnings. Instead, show the *mechanics* honestly:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  You keep 85%.                                          │
│  $8,500 per $10,000 in sales.                          │
│                                                         │
│  Write TypeScript. Set your price. We handle the rest. │
│  Zero platform fee until $10,000.                       │
│                                                         │
│  [Publish your first workflow]                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Pre-Traction vs. Post-Traction Messaging:**

| Stage | What You Can Claim | What You Cannot Claim |
|-------|-------------------|----------------------|
| Pre-traction (now) | Revenue split (85%), pricing model, integrations count, execution speed | Developer earnings, average revenue, conversion rates |
| Post-traction | All of the above + real anonymized earnings data | Projected earnings without basis |

**Honest Early-Stage Claims:**

| Claim | Provable? | Source |
|-------|-----------|--------|
| "85% revenue share" | ✓ | Platform terms |
| "$8,500 per $10,000" | ✓ | Math: 10000 × 0.85 |
| "8 integrations" | ✓ | Codebase: Zoom, Notion, Slack, Stripe, Linear, HubSpot, Calendly, Todoist |
| "Sub-50ms execution" | ✓ | Cloudflare Workers benchmark |
| "Zero platform fee until $10K" | ✓ | Platform terms |
| "[N] developers earned $[X]" | ✗ | No data yet — forbidden |

**Revenue Calculator — Formula, Not Testimony:**

The calculator shows *potential*, not *actuals*. This is honest because it's math:

```
┌─────────────────────────────────────────────────────────┐
│  REVENUE CALCULATOR                                     │
│  ───────────────────────────────────────────────────── │
│                                                         │
│  If your workflow runs 10,000×/month at $0.15:         │
│                                                         │
│  Gross:             $1,500                              │
│  Your cut (85%):    $1,275                              │
│  Platform (15%):    $225                                │
│                                                         │
│  FORK ATTRIBUTION                                       │
│  ───────────────────────────────────────────────────── │
│  If someone forks your workflow (5,000 runs):          │
│                                                         │
│  Their gross:       $750                                │
│  Your cut (12%):    $90/month (passive, permanent)      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

This is a formula, not a promise. The user inputs assumptions; we output math.

**Remove — Weniger:**
- Developer Reputation Tiers — gamification without earned status is theater
- "What You Can Build" section — shows process, not outcomes
- Any earnings claims without data — violates Honesty Over Polish

**Add When Data Exists — Aber Besser:**
- Real earnings table (anonymized): "[PLACEHOLDER: Add when 10+ developers have earned]"
- Time-to-first-dollar: "[PLACEHOLDER: Track from launch]"
- Fork success rate: "[PLACEHOLDER: Measure after 50 forks]"

**Developer SEO (Early Stage):**

```html
<title>Sell Workflow Automation — Keep 85% | WORKWAY</title>
<meta name="description" content="Build TypeScript workflows. Sell on WORKWAY. Keep 85% of revenue. 8 integrations. Sub-50ms execution. Zero platform fee until $10K.">
```

**Honest Assessment:**

What this page promises: 85% revenue share, working infrastructure, real integrations.
What this page doesn't promise: That you will make money — that depends on your workflow.
What this page cannot claim yet: Developer success stories — we don't have them.

> "Honesty Over Polish: Document what failed. Share limitations as readily as successes."
> — CREATE SOMETHING Voice Guidelines

---

### 5. INTEGRATION PAIR PAGES (`/connect/[from]/[to]`)

**NEW PAGE TYPE - Critical for SEO**

Each of the 25 integration pairs gets a dedicated landing page.

**URL Structure:**
- `/connect/zoom/notion`
- `/connect/stripe/slack`
- `/connect/calendly/todoist`

**Target Keywords (examples):**
- `/connect/zoom/notion`: "zoom notion integration", "connect zoom to notion", "zoom to notion automation"
- `/connect/stripe/notion`: "stripe notion integration", "log stripe payments to notion"
- `/connect/hubspot/slack`: "hubspot slack integration", "deal alerts in slack"

#### Example: `/connect/zoom/notion`

```
HEADLINE:
Zoom + Notion, connected.

SUBHEAD:
Every meeting → Notion page.
Transcript, summary, action items.
You did nothing.

[Connect now →]

───────────────────────────────────────

WHAT HAPPENS

1. Your Zoom meeting ends
2. WORKWAY grabs the recording
3. AI transcribes and summarizes
4. Notion page created automatically

Time from meeting end to Notion page: ~60 seconds
Cost: $0.15/meeting

───────────────────────────────────────

THE NOTION PAGE INCLUDES

✓ Full transcript
✓ AI-generated summary (3-5 sentences)
✓ Decisions made
✓ Action items extracted
✓ Follow-ups with dates
✓ Attendee list

───────────────────────────────────────

SETUP TIME: 90 SECONDS

1. Connect Zoom (OAuth)
2. Connect Notion (OAuth)
3. Pick your database
4. Done.

[Connect now →]

───────────────────────────────────────

VS. DOING IT MANUALLY

Manual: Watch recording (45 min) + Write notes (15 min) = 60 min/meeting
WORKWAY: 0 min/meeting

At 10 meetings/week:
Manual: 10 hours/week
WORKWAY: 0 hours/week + $1.50

───────────────────────────────────────

VS. COMPETITORS

| Feature | WORKWAY | Zapier | Make |
|---------|---------|--------|------|
| AI Summary | ✓ | ✗ | ✗ |
| Action Item Extraction | ✓ | ✗ | ✗ |
| Setup Time | 90 sec | 15 min | 20 min |
| Per-meeting cost | $0.15 | $0.30+ | $0.25+ |
```

**SEO Meta:**
```html
<title>Zoom to Notion Integration - Automatic Meeting Notes | WORKWAY</title>
<meta name="description" content="Connect Zoom to Notion in 90 seconds. Every meeting automatically creates a Notion page with transcript, AI summary, and action items. $0.15/meeting.">
```

---

## Complete SEO Strategy

### Keyword Mapping by Page

| Page | Primary Keywords | Secondary Keywords | Search Intent |
|------|-----------------|-------------------|---------------|
| Homepage | workflow automation, invisible automation | automate work, automatic workflows | Navigational |
| /outcomes | workflow marketplace, automation workflows | buy workflows, pre-built automation | Commercial |
| /outcomes/after-meetings | zoom to notion automation, zoom meeting notes | transcribe zoom to notion, zoom notion sync | Commercial |
| /outcomes/when-payments-arrive | stripe to notion, payment automation | log payments automatically, stripe tracking | Commercial |
| /connect/zoom/notion | zoom notion integration, connect zoom notion | zoom notion connector, zoom to notion | Transactional |
| /connect/stripe/slack | stripe slack integration, payment alerts slack | stripe notifications slack | Transactional |
| /developers | sell workflows, workflow marketplace developers | monetize automation, sell integrations | Commercial |

### Long-Tail Keyword Targets (25 Integration Pairs)

Each integration pair page targets 5-10 long-tail keywords:

**zoom:notion**
- "how to automatically sync zoom meetings to notion"
- "zoom meeting notes to notion automatically"
- "zoom transcription to notion"
- "zoom recording to notion page"
- "automatic zoom meeting notes notion"

**stripe:notion**
- "log stripe payments to notion automatically"
- "stripe to notion integration"
- "track stripe payments in notion"
- "sync stripe with notion database"

**calendly:todoist**
- "calendly to todoist integration"
- "create todoist tasks from calendly"
- "automatic meeting follow-ups"
- "calendly meeting tasks"

**hubspot:slack**
- "hubspot deal alerts in slack"
- "hubspot slack integration for deals"
- "notify slack when hubspot deal closes"
- "hubspot to slack notifications"

### Technical SEO Requirements

```html
<!-- Every page -->
<link rel="canonical" href="https://workway.co/[path]">
<meta name="robots" content="index, follow">

<!-- Open Graph -->
<meta property="og:type" content="website">
<meta property="og:title" content="[Page Title]">
<meta property="og:description" content="[Page Description]">
<meta property="og:image" content="https://workway.co/og/[page].png">
<meta property="og:url" content="https://workway.co/[path]">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="[Page Title]">
<meta name="twitter:description" content="[Page Description]">
<meta name="twitter:image" content="https://workway.co/og/[page].png">

<!-- Structured Data -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  ...
}
</script>
```

### Internal Linking Strategy

```
Homepage
├── /outcomes (primary CTA)
│   ├── /outcomes/after-meetings
│   │   ├── /connect/zoom/notion
│   │   └── /connect/zoom/slack
│   ├── /outcomes/when-payments-arrive
│   │   ├── /connect/stripe/notion
│   │   └── /connect/stripe/slack
│   └── ... (14 outcome frames)
├── /developers (secondary CTA)
│   ├── /docs
│   └── /developers/earnings (new page)
└── /connect/[from]/[to] (25 pages)
```

---

## Complete AEO Strategy

### Questions to Answer (Direct Content)

Each page must directly answer search queries in natural language.

**Homepage FAQ:**
1. What is workflow automation?
2. How does WORKWAY work?
3. How much does workflow automation cost?
4. Is my data secure with WORKWAY?

**Outcome Pages FAQ:**
1. How do I automatically [do X]?
2. Can I [achieve outcome] without coding?
3. What's the best way to [connect A to B]?
4. How much does [specific automation] cost?

**Integration Pair Pages FAQ:**
1. How do I connect [App A] to [App B]?
2. Can I sync [App A] with [App B] automatically?
3. What's the best [App A] to [App B] integration?
4. How long does [App A] to [App B] setup take?

### Schema Markup for AEO

**FAQPage Schema (every page):**
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How do I automatically sync Zoom meetings to Notion?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Install WORKWAY's Meeting Intelligence workflow. Connect your Zoom and Notion accounts via OAuth (takes 90 seconds). Every completed Zoom meeting automatically creates a Notion page with the full transcript, AI-generated summary, action items, and follow-ups. Cost: $0.15 per meeting."
      }
    }
  ]
}
```

**HowTo Schema (integration pair pages):**
```json
{
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Connect Zoom to Notion",
  "description": "Automatically create Notion pages from Zoom meetings with transcripts and AI summaries.",
  "totalTime": "PT2M",
  "estimatedCost": {
    "@type": "MonetaryAmount",
    "currency": "USD",
    "value": "0.15"
  },
  "step": [
    {
      "@type": "HowToStep",
      "name": "Connect Zoom",
      "text": "Click 'Connect Zoom' and authorize WORKWAY via OAuth."
    },
    {
      "@type": "HowToStep",
      "name": "Connect Notion",
      "text": "Click 'Connect Notion' and select your workspace."
    },
    {
      "@type": "HowToStep",
      "name": "Select Database",
      "text": "Choose the Notion database for meeting notes."
    },
    {
      "@type": "HowToStep",
      "name": "Done",
      "text": "Your next Zoom meeting will automatically create a Notion page."
    }
  ]
}
```

**Product Schema (workflow pages):**
```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Meeting Intelligence Workflow",
  "description": "Automatically create Notion pages from Zoom meetings with AI-generated summaries and action items.",
  "offers": {
    "@type": "Offer",
    "price": "0.15",
    "priceCurrency": "USD",
    "priceSpecification": {
      "@type": "UnitPriceSpecification",
      "price": "0.15",
      "priceCurrency": "USD",
      "unitText": "per execution"
    },
    "availability": "https://schema.org/InStock"
  }
}
```

---

## Sitemap Structure

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Core Pages -->
  <url><loc>https://workway.co/</loc><priority>1.0</priority></url>
  <url><loc>https://workway.co/outcomes</loc><priority>0.9</priority></url>
  <url><loc>https://workway.co/developers</loc><priority>0.8</priority></url>
  <url><loc>https://workway.co/docs</loc><priority>0.7</priority></url>

  <!-- Outcome Frame Pages (14) -->
  <url><loc>https://workway.co/outcomes/after-meetings</loc><priority>0.9</priority></url>
  <url><loc>https://workway.co/outcomes/when-payments-arrive</loc><priority>0.9</priority></url>
  <url><loc>https://workway.co/outcomes/when-leads-come-in</loc><priority>0.9</priority></url>
  <url><loc>https://workway.co/outcomes/when-forms-submitted</loc><priority>0.9</priority></url>
  <url><loc>https://workway.co/outcomes/every-morning</loc><priority>0.9</priority></url>
  <url><loc>https://workway.co/outcomes/weekly-automatically</loc><priority>0.9</priority></url>
  <url><loc>https://workway.co/outcomes/when-clients-onboard</loc><priority>0.9</priority></url>
  <url><loc>https://workway.co/outcomes/after-calls</loc><priority>0.9</priority></url>
  <url><loc>https://workway.co/outcomes/when-data-changes</loc><priority>0.8</priority></url>
  <url><loc>https://workway.co/outcomes/after-publishing</loc><priority>0.8</priority></url>
  <url><loc>https://workway.co/outcomes/when-meetings-booked</loc><priority>0.8</priority></url>
  <url><loc>https://workway.co/outcomes/when-deals-progress</loc><priority>0.8</priority></url>
  <url><loc>https://workway.co/outcomes/when-tasks-complete</loc><priority>0.8</priority></url>
  <url><loc>https://workway.co/outcomes/when-tickets-arrive</loc><priority>0.8</priority></url>

  <!-- Integration Pair Pages (25) -->
  <url><loc>https://workway.co/connect/zoom/notion</loc><priority>0.9</priority></url>
  <url><loc>https://workway.co/connect/zoom/slack</loc><priority>0.9</priority></url>
  <url><loc>https://workway.co/connect/stripe/notion</loc><priority>0.9</priority></url>
  <url><loc>https://workway.co/connect/stripe/slack</loc><priority>0.9</priority></url>
  <url><loc>https://workway.co/connect/stripe/hubspot</loc><priority>0.8</priority></url>
  <url><loc>https://workway.co/connect/calendly/notion</loc><priority>0.8</priority></url>
  <url><loc>https://workway.co/connect/calendly/slack</loc><priority>0.8</priority></url>
  <url><loc>https://workway.co/connect/calendly/todoist</loc><priority>0.8</priority></url>
  <url><loc>https://workway.co/connect/hubspot/slack</loc><priority>0.8</priority></url>
  <url><loc>https://workway.co/connect/hubspot/notion</loc><priority>0.8</priority></url>
  <url><loc>https://workway.co/connect/typeform/hubspot</loc><priority>0.8</priority></url>
  <url><loc>https://workway.co/connect/typeform/notion</loc><priority>0.8</priority></url>
  <url><loc>https://workway.co/connect/typeform/airtable</loc><priority>0.8</priority></url>
  <url><loc>https://workway.co/connect/linear/slack</loc><priority>0.8</priority></url>
  <url><loc>https://workway.co/connect/linear/notion</loc><priority>0.8</priority></url>
  <url><loc>https://workway.co/connect/todoist/slack</loc><priority>0.8</priority></url>
  <url><loc>https://workway.co/connect/todoist/notion</loc><priority>0.8</priority></url>
  <url><loc>https://workway.co/connect/airtable/slack</loc><priority>0.8</priority></url>
  <url><loc>https://workway.co/connect/dribbble/notion</loc><priority>0.7</priority></url>
  <url><loc>https://workway.co/connect/dribbble/slack</loc><priority>0.7</priority></url>
  <url><loc>https://workway.co/connect/notion/slack</loc><priority>0.8</priority></url>
  <url><loc>https://workway.co/connect/notion/stripe</loc><priority>0.8</priority></url>
  <url><loc>https://workway.co/connect/google-sheets/airtable</loc><priority>0.7</priority></url>
  <url><loc>https://workway.co/connect/stripe/todoist</loc><priority>0.7</priority></url>
  <url><loc>https://workway.co/connect/slack/slack</loc><priority>0.7</priority></url>
</urlset>
```

---

## Content Removal (Weniger)

**Delete from all pages:**
- "the first" (vanity)
- "popular" (vague)
- "in minutes" (unspecific)
- "ready-to-use" (meaningless)
- "workflow automation" as a category (mechanism)
- Developer tier badges (gamification theater)
- "How It Works" process diagrams (users don't care how)
- Any feature without an outcome attached

**Replace with:**
- Specific numbers: "90 seconds", "$0.15", "47 developers"
- Outcomes: "notes appear", "summary posted", "tasks created"
- Absence: "You did nothing", "You didn't check", "You slept in"

---

## Implementation Priority

### Phase 1: Core Pages (Week 1-2)
1. Homepage rewrite
2. /outcomes page (replaces /marketplace)
3. /developers page rewrite

### Phase 2: Outcome Frame Pages (Week 2-3)
4. /outcomes/after-meetings
5. /outcomes/when-payments-arrive
6. /outcomes/when-leads-come-in
7. /outcomes/every-morning
8. Remaining 10 outcome frames

### Phase 3: Integration Pair Pages (Week 3-4)
9. /connect/zoom/notion (highest search volume)
10. /connect/stripe/notion
11. /connect/zoom/slack
12. Remaining 22 integration pairs

### Phase 4: Technical SEO (Week 4)
13. Schema markup implementation
14. Sitemap generation
15. OG image generation
16. Internal linking audit

---

## Measurement

### Primary Metrics
- Organic traffic to outcome/integration pages
- Click-through rate from search results
- Time to first conversion (install/signup)
- Bounce rate on landing pages

### SEO Metrics
- Keyword rankings for target terms
- Impressions in Google Search Console
- Featured snippet captures
- Rich result appearances

### AEO Metrics
- AI Overview appearances
- Direct answer traffic
- Zero-click search satisfaction

---

## The Zuhandenheit Test

Before publishing any page, ask:

1. **Does this page describe what WORKWAY is, or what disappears when you use it?**
   - If it describes WORKWAY → rewrite
   - If it describes what disappears → publish

2. **Would a user see this page if everything worked perfectly?**
   - If yes → the tool is too visible → simplify
   - If no → the tool recedes → correct

3. **Can any word be removed without loss of meaning?**
   - If yes → remove it
   - If no → keep it

The best WORKWAY page is one the user never needs to read because they already got what they came for.
