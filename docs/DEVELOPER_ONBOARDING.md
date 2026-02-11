# Developer Onboarding

WORKWAY Marketplace launches with 10 developers. Not 10,000.

Quality emerges from constraint, not scale.

---

## The Program

We're accepting 10 developers for the initial Marketplace cohort. Each will have the ability to publish workflows that users pay for. This isn't a beta—it's a curated launch.

**Why 10?**

- Every workflow reflects on the platform
- Support bandwidth is finite
- Patterns must stabilize before scaling
- Revenue share requires trust

**What you get:**

- Marketplace publishing (build once, earn recurring)
- Professional presence (your profile attracts client work)
- WORKWAY support crafting your positioning

WORKWAY helps developers build workflows AND find work.

If you're here, you've joined the waitlist. What follows is the path from waitlist to publishing.

---

## Philosophy: Zuhandenheit

> The tool should recede; the outcome should remain.

Your workflow should disappear during use. Users don't want "automation"—they want outcomes. Meetings that summarize themselves. Payments that track themselves. The tool recedes; the outcome remains.

Read `docs/HEIDEGGER_DESIGN.md` for the full philosophy.

---

## What You Have Access To

### Now (Waitlist)

| Access | Status |
|--------|--------|
| Public SDK (`@workwayco/sdk`) | Available |
| Public CLI (`@workwayco/cli`) | Available |
| Documentation | Available |
| Local development | Available |
| Profile creation | Available |
| SDK/CLI contributions | Welcome |

### After Approval

| Access | Status |
|--------|--------|
| Workflow publishing | Requires approval |
| Production OAuth credentials | Requires approval |
| BYOO (Bring Your Own OAuth) | Requires approval |
| Marketplace listing | Requires approval |
| Revenue share | Requires approval |

---

## Your Path

### 1. Get Acclimated

Install the CLI and SDK:

```bash
npm install -g @workwayco/cli
npm install @workwayco/sdk
```

Read the documentation:
- `packages/sdk/README.md` — SDK patterns
- `packages/sdk/DEVELOPERS.md` — Implementation details
- `docs/HEIDEGGER_DESIGN.md` — Design philosophy

Build locally. Break things. The SDK and CLI are public—improvements are welcome.

### 2. Create Your Profile

```bash
workway developer init
```

This creates your developer profile. It's stored locally until you submit.

Your profile serves two purposes:
- **Marketplace access**: Publishing rights, revenue share
- **Professional presence**: Attract client work through WORKWAY

Your profile includes:
- Identity (name, company/studio)
- Professional background (what you build, your expertise)
- Workflow focus (integrations, problems you solve)
- Why WORKWAY (what drew you here)

The profile isn't a form. It's your professional presence on the platform.

### 3. Submit for Review

```bash
workway developer submit
```

We review every submission. Criteria:

| Factor | Weight |
|--------|--------|
| Technical capability | High |
| Workflow viability | High |
| Alignment with platform direction | Medium |
| Contribution potential | Medium |

Response time: 5-7 business days.

### 4. Approval

If approved, you receive:
- Production OAuth credentials
- Workflow publishing access
- Marketplace listing capability
- Revenue share enrollment

If not approved, you receive:
- Specific feedback
- Path to resubmission (if applicable)

---

## CLI Reference

The CLI is your primary interface. Heideggerian: ready-to-hand.

### Authentication

```bash
workway login              # Authenticate with WORKWAY
workway logout             # Clear local authentication
workway whoami             # Display current user
```

### Developer Commands

```bash
workway developer init     # Create developer profile
workway developer submit   # Submit for marketplace review
workway developer status   # Check application status
workway developer profile  # View/edit profile
workway developer profile --edit  # Interactive edit
workway developer earnings # View earnings and payouts
```

### Stripe Connect

```bash
workway developer stripe status   # Check Stripe Connect status
workway developer stripe setup    # Start Stripe onboarding
workway developer stripe refresh  # Refresh expired onboarding link
```

### BYOO OAuth (Bring Your Own OAuth)

After approval, use your own OAuth credentials for your app branding and API quotas.

```bash
workway developer oauth list      # List your OAuth apps
workway developer oauth add       # Add credentials (interactive)
workway developer oauth add zoom  # Add specific provider
workway developer oauth test zoom # Test credentials
workway developer oauth promote zoom  # Promote to production
workway developer oauth remove zoom   # Remove app
```

Supported providers: Zoom, Notion, Slack, Airtable, Typeform, Calendly, Todoist, Linear, Google Calendar, Google Drive, Stripe.

### Workflow Development

```bash
workway workflow init [name]        # Create new workflow
workway workflow init --ai          # Create AI-powered workflow
workway workflow test               # Test execution
workway workflow test --mock        # Test with mocked integrations
workway workflow test --live        # Test with live OAuth
workway workflow dev                # Development server with hot reload
workway workflow build              # Build for production
workway workflow validate           # Validate schema
workway workflow publish            # Publish to marketplace
workway workflow fork [workflow]    # Fork existing workflow
workway workflow lineage [workflow] # View fork lineage
```

### OAuth Connections (User Connections)

```bash
workway oauth connect [provider]  # Connect OAuth account
workway oauth list                # List connected accounts
workway oauth disconnect [provider]  # Disconnect account
```

### Marketplace Discovery

```bash
workway needs                      # Discover based on your needs
workway needs --from zoom --to notion  # Find Zoom → Notion workflows
workway needs --after meetings     # Find workflows for meeting outcomes
workway marketplace search [query] # Search workflows
workway marketplace info [workflow] # Workflow details
```

### AI Tools (Cloudflare Workers AI)

```bash
workway ai models                  # List available models
workway ai test [prompt]           # Test AI model
workway ai estimate                # Estimate AI costs
```

### Agentic Commands

```bash
workway create [prompt]            # Create workflow from natural language
workway explain [file]             # Explain workflow in plain English
workway modify [file] [request]    # Modify workflow using natural language
```

---

## Revenue Model

### How You Earn

You set your upfront pricing:

| Model | Description | Example |
|-------|-------------|---------|
| **Free** | No upfront charge | Community tools, loss leaders |
| **One-Time** | Single payment | $29 or $49 one-time |

### Platform Usage Fees

After 100 free runs, WORKWAY charges users per execution:

| Workflow Type | Cost | Examples |
|---------------|------|----------|
| **All workflows** | 1¢/run | Flat rate for all workflow types |

### Revenue Split

| Component | Your Share | Platform Share |
|-----------|------------|----------------|
| Upfront pricing (free or one-time) | **100%** (minus ~3% payment processing) | 0% |
| Usage fees (after trial) | 0% | 100% |
| Fork attribution (if your workflow is forked) | 12% of fork's upfront revenue | — |

**The model is simple**: You set the upfront price and keep 100%. WORKWAY handles trials, billing, and infrastructure—charging 1¢ per run after the 100 free runs.

### Stripe Connect Setup

After approval:

```bash
workway developer stripe setup
```

This opens Stripe's onboarding flow. Complete it to receive payouts.

Check status anytime:

```bash
workway developer stripe status
```

---

## BYOO: Bring Your Own OAuth

After approval, you can use your own OAuth credentials instead of WORKWAY's system credentials.

### Why BYOO?

- **Your branding**: Your app name appears in OAuth consent screens
- **Your quotas**: API usage counts against your limits
- **Your reliability**: Not dependent on WORKWAY's credentials

### How It Works

1. Create an OAuth app with the provider (e.g., Zoom Developer Console)
2. Add credentials via CLI:
   ```bash
   workway developer oauth add zoom
   ```
3. Test credentials:
   ```bash
   workway developer oauth test zoom
   ```
4. Promote to production:
   ```bash
   workway developer oauth promote zoom
   ```

### Credential Security

- Client secrets are encrypted with AES-256-GCM
- Secrets are never logged or exposed
- You can rotate credentials anytime by removing and re-adding

### Fallback Behavior

If your credentials fail, workflows fall back to WORKWAY system credentials. This ensures users don't experience failures.

---

## Building Workflows

### Workflow Structure

```typescript
import { defineWorkflow } from '@workwayco/sdk';

export default defineWorkflow({
  metadata: {
    id: 'meeting-notes',
    name: 'Meeting Notes to Notion',
    description: 'Automatically create Notion pages from meeting transcripts',
    category: 'productivity',
    icon: 'video',
    version: '1.0.0',
  },

  pricing: {
    model: 'one_time',
    price: 2900, // $29 one-time (in cents)
    // Platform charges 1¢/run after free runs
  },

  integrations: ['zoom', 'notion'],

  trigger: {
    type: 'webhook',
    config: { event: 'meeting.ended' },
  },

  configSchema: z.object({
    notionDatabaseId: z.string(),
    includeTranscript: z.boolean().default(true),
  }),

  async execute(context) {
    // Your workflow logic
    const { trigger, config, actions } = context;

    // Get meeting transcript
    const meeting = await actions.execute('zoom.getMeeting', {
      meetingId: trigger.data.meetingId,
    });

    // Create Notion page
    await actions.execute('notion.createPage', {
      databaseId: config.notionDatabaseId,
      properties: {
        title: meeting.data.topic,
      },
      content: meeting.data.transcript,
    });

    return { success: true };
  },
});
```

### The Outcome Test

Before building, pass this test:

> Can you describe what the workflow does without mentioning the workflow?

Good: "Meetings that document themselves"
Bad: "Meeting Intelligence workflow with AI transcription"

### Configuration: Less is Better

| Fields | Quality |
|--------|---------|
| 0 | Excellent (works out of box) |
| 1-2 | Good (minimal setup) |
| 3 | Acceptable (slight friction) |
| 4+ | Reconsider (too much visibility) |

### Testing Locally

```bash
# Create test data file
echo '{"meetingId": "123", "topic": "Standup"}' > test-data.json

# Run test
workway workflow test --data test-data.json --mock
```

---

## Building Integrations

Integrations follow the BaseAPIClient pattern from `@workwayco/sdk`.

### Structure

```
packages/integrations/src/
  myservice/
    index.ts           # Main class + types
    myservice.test.ts  # Tests
```

### Pattern

```typescript
import { BaseAPIClient, ActionResult, ErrorCode } from '@workwayco/sdk';

export interface MyServiceConfig {
  accessToken: string;
  timeout?: number;
}

export class MyService extends BaseAPIClient {
  constructor(config: MyServiceConfig) {
    super({
      baseUrl: 'https://api.myservice.com',
      timeout: config.timeout ?? 30000,
      defaultHeaders: {
        Authorization: `Bearer ${config.accessToken}`,
      },
    });
  }

  async getResource(id: string): Promise<ActionResult<Resource>> {
    try {
      const data = await this.getJson<Resource>(`/resources/${id}`);
      return ActionResult.success(data, {
        integration: 'myservice',
        action: 'get-resource',
        schema: 'myservice.resource.v1',
      });
    } catch (error) {
      return ActionResult.error(
        error.message,
        ErrorCode.API_ERROR,
        { integration: 'myservice', action: 'get-resource' }
      );
    }
  }
}
```

### Integration Checklist

- [ ] Extends `BaseAPIClient`
- [ ] All methods return `ActionResult<T>`
- [ ] Uses `ErrorCode` taxonomy
- [ ] Configurable timeout
- [ ] Webhook signature verification (if applicable)
- [ ] Tests for happy path and error cases

See `packages/sdk/DEVELOPERS.md` for detailed patterns.

---

## Forking Workflows

You can fork existing workflows to customize them:

```bash
workway workflow fork meeting-intelligence
```

### Fork Attribution

If someone forks your workflow and earns revenue, you receive 12% automatically.

| Revenue | Fork Creator | Original Author |
|---------|--------------|-----------------|
| $100 | $88 | $12 |

### Fork Lineage

View the ancestry of any workflow:

```bash
workway workflow lineage my-forked-workflow
```

This shows the chain of derivation back to the original.

---

## What You Can Build Now

While waiting for approval:

**Build integrations locally**
```bash
cd packages/integrations
# Add your integration following the BaseAPIClient pattern
```

**Test workflows locally**
```bash
workway workflow test ./my-workflow.ts --data test-payload.json
```

**Contribute to the SDK/CLI**

The SDK and CLI are open for contributions. If you find gaps, fill them. Good contributions demonstrate capability better than any application.

```bash
git clone https://github.com/workwayco/workway
cd workway
pnpm install
pnpm test
```

---

## Documentation Map

| Document | Purpose |
|----------|---------|
| This file | Onboarding journey |
| `packages/sdk/README.md` | SDK usage |
| `packages/sdk/DEVELOPERS.md` | Integration patterns |
| `docs/HEIDEGGER_DESIGN.md` | Design philosophy |
| `docs/WORKFLOW_FORKING.md` | Fork system details |
| `docs/patterns/COMPOUND_WORKFLOW_PATTERN.md` | Multi-step workflow patterns |

---

## Professional Services

WORKWAY provides support crafting your professional positioning:

- Profile optimization for client attraction
- Workflow portfolio strategy
- Integration specialization guidance

This isn't marketing fluff. We help you articulate what you build so the right clients find you.

Contact: developers@workway.co

---

## Questions

Contact: developers@workway.co

Do not email asking for faster review. The timeline is the timeline.

---

## Summary

| Phase | What You Can Do | What You Cannot Do |
|-------|-----------------|-------------------|
| Waitlist | CLI, SDK, local dev, profile, contributions | Publish workflows |
| Review | Build locally, contribute | Publish workflows |
| Approved | Publish, earn, BYOO OAuth, attract clients | — |

10 developers. Curated quality. The marketplace you publish to will be worth publishing to.

---

*Weniger, aber besser.* Less, but better.
