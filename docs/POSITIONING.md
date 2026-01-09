# WORKWAY Competitive Positioning

> **Zuhandenheit**: Not "better than Zapier" — different weight class.

## What We Are

**Automation infrastructure for AI-native developers.**

WORKWAY is TypeScript-native workflow automation built on Cloudflare Workers. We serve developer teams building complex, version-controlled automations that need to scale efficiently.

**Business Model Priority**: Enterprise-first, marketplace second (like Webflow).
- **Enterprise/Private (P0)**: Per-user + per-run SaaS
- **Public Marketplace (P1)**: Developer ecosystem, network effects
- **Worker Hire (P2)**: Expert marketplace for non-technical buyers

## What We're Not

- **Not a Zapier competitor**: We're infrastructure for developers who outgrew drag-and-drop
- **Not a low-code platform**: We're code-first, Git-native, type-safe
- **Not for non-technical users**: Our users write TypeScript, commit to Git, deploy via CI/CD

## Core Differentiators

### 1. TypeScript-Native

**Zapier/Make**: Visual workflow builders with limited code support
**WORKWAY**: Full TypeScript workflows with complete type safety

```typescript
// This is a WORKWAY workflow - real TypeScript code
export default async function(context: WorkflowContext) {
  const meeting = await context.integrations.zoom.getMeeting(context.trigger.meetingId);
  const summary = await context.ai.summarize(meeting.transcript);
  await context.integrations.notion.createPage({
    database: context.config.notionDatabase,
    properties: { summary, date: meeting.startTime }
  });
}
```

**Why this matters**:
- Full IDE support (autocomplete, type checking, refactoring)
- Unit testable with standard TypeScript testing tools
- Reusable functions and packages from npm
- Complex business logic without platform limitations

### 2. Cheaper at Scale

**Zapier pricing** (Team plan):
- $69/user/month minimum (5 users = $345/month base)
- 50,000 tasks/month included
- $0.003 per task beyond included amount
- **Total cost for 100k tasks/month**: $345 + (50k × $0.003) = $495/month

**WORKWAY pricing** (Enterprise):
- $20/user/month (5 users = $100/month)
- Unlimited workflows
- $0.03 per standard run, $0.15 per advanced run
- **Total cost for 100k runs/month**: $100 + (100k × $0.03) = $3,100/month

Wait... that's MORE expensive?

**Correction**: For simple automations, Zapier is cheaper. WORKWAY wins when:
1. You need complex logic Zapier can't handle (then you're paying for Make + Zapier + custom scripts)
2. You're building product features, not internal tools (then you need infrastructure, not a workflow tool)
3. You want version control, CI/CD, and developer workflows (priceless for engineering teams)

**Honest positioning**: We're not competing on price-per-task. We're competing on **total cost of ownership** for developer teams.

### 3. Claude Code Forward

**Every workflow is an agentic development target.**

WORKWAY workflows ship with `UNDERSTANDING.md` files that enable Claude Code (and other AI coding assistants) to understand, modify, and debug workflows autonomously.

```bash
# Natural language → working workflow
$ claude "add error retry logic to the zoom-notion workflow"
# Claude reads UNDERSTANDING.md, modifies TypeScript, tests locally, commits

$ claude "why did the last 3 runs fail?"
# Claude analyzes execution logs, identifies root cause, suggests fix
```

**No other workflow platform is designed for AI-assisted development.**

### 4. Cloudflare Workers Edge Deployment

**Zapier/Make**: Centralized US/EU datacenters
**WORKWAY**: Runs on Cloudflare's edge network (300+ cities globally)

- Sub-100ms latency worldwide
- Auto-scales to any load
- No cold starts
- Built-in DDoS protection

**Why this matters**: Your workflows run **where your users are**, not in a distant datacenter.

### 5. Git-Native, Version-Controlled

**Zapier/Make**: Workflows live in their UI, limited export/import
**WORKWAY**: Workflows are TypeScript files in your Git repo

- Commit workflow changes like any other code
- Review workflow changes in pull requests
- Deploy workflows via CI/CD pipelines
- Rollback to any previous version instantly

**Why this matters**: Workflows are critical infrastructure. Treat them like code, not like spreadsheets.

## Who We're For

### Ideal Customer Profile (ICP)

**Primary**: Developer teams at B2B SaaS companies (10-500 employees)
- Using workflows to build product features, not just internal automation
- Need complex business logic Zapier/Make can't express
- Already on Cloudflare (Pages, Workers, R2, etc.)
- Value version control, testing, and CI/CD for all infrastructure

**Secondary**: Agencies building client workflows
- Need white-label solutions
- Billing clients per workflow run
- Want to write workflows once, deploy for multiple clients

**Tertiary**: Individual developers building side projects
- Using workflows as product backend (e.g., "meeting notes SaaS")
- Need cost-effective scaling from 0 to first revenue
- Want to work in TypeScript, not low-code editors

### Not For

- **Non-technical teams** → Use Zapier (seriously, it's great for them)
- **Simple 2-3 step automations** → Zapier is cheaper and faster to set up
- **Teams without Git/CI/CD workflows** → Our differentiators won't matter to you
- **Windows-only shops** → Our CLI is built for Unix-like environments

## Messaging Framework

### For Developer Teams

**Problem**: Zapier can't handle complex logic. Custom scripts are expensive to maintain. You need infrastructure, not a toy.

**Solution**: WORKWAY is TypeScript-native automation infrastructure. Write workflows in your IDE, test them locally, deploy via CI/CD.

**Proof**: "Half Dozen (2 founders + agents) runs their entire operation on WORKWAY. Dog-fooding at scale."

### For Agencies

**Problem**: Building custom integrations for every client is expensive. Zapier doesn't scale to client complexity. You need white-label infrastructure.

**Solution**: WORKWAY lets you write workflows once, deploy for multiple clients with isolated configs. Charge per run, we handle execution.

**Proof**: "Build a Zoom-to-Notion workflow once. Deploy it for 50 clients. Each pays you $49/month. We charge you $3/client."

### For Investors/Partners

**Problem**: Workflow automation is a $10B+ market, but it's stuck in drag-and-drop. Developers are building automations in Lambda/Actions/Workers with custom code. No platform serves them.

**Solution**: WORKWAY is automation infrastructure for the 28M developers worldwide. TypeScript-native, Git-native, AI-native. The Vercel of workflow automation.

**Traction**: "Two founders + AI agents built marketplace + SDK + integrations in 6 months. Dog-fooding = product validation."

## Competitive Landscape

| Competitor | Target User | Strengths | Why We're Different |
|------------|-------------|-----------|---------------------|
| **Zapier** | Non-technical teams | Huge integration library, easy to use | We're code-first for developers |
| **Make** | Power users | Visual builder with complex logic | We're Git-native, not GUI-native |
| **n8n** | Self-hosters | Open source, self-hostable | We're managed infrastructure on Cloudflare edge |
| **Temporal** | Infrastructure teams | Durable execution, complex workflows | We're higher-level (integrations built-in) |
| **Inngest** | Backend engineers | TypeScript-native, durable execution | We're multi-tenant marketplace, not self-hosted SDK |

**Strategic positioning**: We sit between Zapier (too simple) and Temporal (too complex). We're **infrastructure that feels like a platform**.

## Key Messages (External)

### Website Hero
"Automation infrastructure for AI-native developers"

### For Developers
"TypeScript workflows on Cloudflare Workers. Built for developers, cheaper at scale."

### For Teams
"Per-user + per-run pricing. No arbitrary limits. Version control included."

### For Agencies
"Build workflows once. Deploy for every client. Charge per run."

### Technical Differentiation
"TypeScript-native. Claude Code-forward. Git-native."

## What We DON'T Say

- ❌ "Better than Zapier" → We're for different users
- ❌ "Workflow automation made easy" → We're for developers, not simplicity
- ❌ "No-code/low-code" → We're code-first, full stop
- ❌ "Enterprise-grade" → Meaningless marketing jargon
- ❌ "AI-powered" → Unless specifically about Claude Code integration

## Internal Positioning (Team Alignment)

**We are building**: Infrastructure for developers who outgrew Zapier

**We are not building**: A Zapier competitor for non-technical users

**Success looks like**: Engineering teams saying "we replaced our Lambda functions with WORKWAY workflows"

**Failure looks like**: Marketing teams saying "WORKWAY is too complicated, we'll stick with Zapier"

## Business Model Transparency

**Enterprise-first with marketplace growth** (the Webflow model):

| Tier | Priority | Revenue Model |
|------|----------|---------------|
| **Enterprise/Private** | P0 | Per-user + per-run SaaS |
| **Public Marketplace** | P1 | 30% commission on installs |
| **Worker Hire** | P2 | 20% platform fee on projects |

**Revenue streams in priority order**:

1. **Enterprise (P0)**: Per-user + per-run pricing for teams
   - $25/user/month base
   - $0.03 per standard run, $0.15 per advanced run
   - 40% discount vs marketplace run pricing
   - Cost transparency: users see exactly what they pay
   - Target: 100-500 user teams

2. **Marketplace (P1)**: 30% commission on workflow installations
   - Developers set their own pricing ($5-99/month typical)
   - We handle billing, execution, OAuth
   - Target: 1000+ published workflows

3. **Worker Hire (P2)**: Agencies charge hourly/project rates
   - We take 20% platform fee
   - Workers bid on workflow development projects
   - Target: 500+ active freelance developers

**Key insight**: We're not just a SaaS product. We're a **platform economy**. But we lead with enterprise (easier story, recurring revenue), and let marketplace grow the ecosystem.

## Honest Limitations (Don't Hide These)

1. **Smaller integration library than Zapier**: We have 40+ integrations. Zapier has 5000+. We'll never catch up—and that's okay. We focus on **developer-centric** integrations (GitHub, Linear, Notion), not every SaaS tool ever made.

2. **Steeper learning curve**: If you don't know TypeScript, WORKWAY isn't for you. We won't dumb down the product to serve non-developers.

3. **Not drag-and-drop**: We have a workflow builder UI, but it generates TypeScript code. If you want pure visual workflows, use Zapier.

4. **Early stage**: We're 6 months old. Zapier has been around for 12 years. Expect rough edges, fast iteration, and occasional breaking changes.

## Long-Term Vision

**Phase 1 (Now)**: Workflow marketplace for developer teams
**Phase 2 (6 months)**: Agentic workflow development (Claude writes entire workflows from specs)
**Phase 3 (12 months)**: Multi-tenant workflow infrastructure (agencies deploy client workflows at scale)
**Phase 4 (24 months)**: Workflow observability platform (APM for automation)

**End state**: Every developer team runs their automation infrastructure on WORKWAY, the same way they run their frontend on Vercel and their backend on Railway.

## Zuhandenheit in Practice

Our positioning isn't "look at our features." It's "look at what disappears from your work."

**Before WORKWAY**:
- Zapier hits limitations, so you write custom Lambda functions
- Lambda functions need IAM roles, VPC configs, deployment pipelines
- OAuth tokens expire, no centralized refresh logic
- No version control, no testing, no CI/CD for automations
- Half your backend codebase is "glue code" between services

**After WORKWAY**:
- Write TypeScript workflows in your IDE
- Deploy via `git push` (or Cloudflare CLI)
- OAuth, retries, observability built-in
- Workflows are code—test them, version them, review them like any other code

**The platform recedes. The outcomes remain.**

---

**Questions for positioning refinement**:
1. Are we infrastructure or a platform? (Answer: Both—infrastructure that feels like a platform)
2. Who's our real competitor? (Answer: Custom Lambda/Worker scripts, not Zapier)
3. What's our moat? (Answer: TypeScript-native + Claude Code integration + marketplace ecosystem)
