# @workway/cli

WORKWAY CLI — Build, test, and publish workflows. Cloudflare-native. Less, but better.

## Installation

```bash
npm install -g @workway/cli
```

## Quick Start

```bash
# Authenticate
workway login

# Create a workflow
workway workflow init my-workflow

# Or create an AI-powered workflow (no API keys required)
workway workflow init --ai my-ai-workflow

# Test locally
cd my-workflow
workway workflow test --mock

# Publish to marketplace
workway workflow publish
```

## Commands Reference

### Authentication

| Command | Description |
|---------|-------------|
| `workway login` | Authenticate with WORKWAY platform |
| `workway logout` | Clear local authentication |
| `workway whoami` | Display current authenticated user |

```bash
# Interactive browser-based login
workway login

# Check who you're logged in as
workway whoami

# Clear credentials
workway logout
```

### Workflow Development

| Command | Description |
|---------|-------------|
| `workway workflow init [name]` | Create a new workflow project |
| `workway workflow dev` | Start development server with hot reload |
| `workway workflow test` | Test workflow execution |
| `workway workflow run` | Execute workflow locally |
| `workway workflow build` | Build workflow for production |
| `workway workflow validate` | Validate workflow schema without building |
| `workway workflow publish` | Publish workflow to marketplace |
| `workway workflow delete` | Permanently delete an inactive workflow |

**Initialize a workflow:**
```bash
workway workflow init my-workflow          # Basic workflow
workway workflow init --ai my-ai-workflow  # AI-powered (Cloudflare Workers AI)
```

**Development server:**
```bash
workway workflow dev                # Default: mock mode, port 3000
workway workflow dev --port 4000    # Custom port
workway workflow dev --no-mock      # Use live OAuth connections
```

**Test options:**
```bash
workway workflow test --mock           # Use mocked integrations
workway workflow test --live           # Use live OAuth connections
workway workflow test --data file.json # Custom test data
```

**Run locally:**
```bash
workway workflow run                           # Execute with defaults
workway workflow run --input data.json         # Custom input file
workway workflow run --env production          # Production environment
workway workflow run --verbose                 # Detailed output
workway workflow run --timeout 60000           # 60 second timeout
```

**Build options:**
```bash
workway workflow build                    # Build for production
workway workflow build --minify           # Minify output
workway workflow build --sourcemap        # Generate sourcemaps
workway workflow build --out-dir dist     # Custom output directory
```

**Validate workflow:**
```bash
workway workflow validate                      # Validate ./workflow.ts
workway workflow validate ./src/workflow.ts   # Validate specific file
workway workflow validate --strict            # Treat warnings as errors
workway workflow validate --json              # JSON output (for CI/CD)
```

**Publish:**
```bash
workway workflow publish          # Publish to marketplace
workway workflow publish --draft  # Publish as draft (not public)
```

**Delete workflow:**
```bash
workway workflow delete wf_abc123           # Delete by ID
workway workflow delete --path ./workflow   # Delete by path
workway workflow delete wf_abc123 --force   # Skip confirmation
workway workflow delete wf_abc123 --keep-data  # Keep stored data
```

### Workflow Forking & Lineage

Fork existing workflows from the marketplace and track attribution.

| Command | Description |
|---------|-------------|
| `workway workflow fork [workflow]` | Fork a workflow from the marketplace |
| `workway workflow lineage [workflow]` | View fork lineage and ancestry |

**Fork a workflow:**
```bash
# Interactive mode
workway workflow fork

# Fork specific workflow
workway workflow fork meeting-intelligence

# Fork with developer prefix
workway workflow fork alexchen/meeting-intelligence
```

When you fork, revenue is shared automatically:
- You (fork creator): 68%
- Original creator: 12%
- Platform: 20%

**View lineage:**
```bash
# View lineage of current project
cd my-forked-workflow
workway workflow lineage

# View lineage of specific workflow
workway workflow lineage sales-analyzer
```

### Private Workflow Access Grants

Control access to private workflows via email domains, specific users, or access codes.

| Command | Description |
|---------|-------------|
| `workway workflow access-grants list [workflow-id]` | List access grants |
| `workway workflow access-grants create [workflow-id]` | Create an access grant |
| `workway workflow access-grants revoke [grant-id]` | Revoke an access grant |

**List grants:**
```bash
workway workflow access-grants list                # Interactive workflow selection
workway workflow access-grants list wf_abc123      # Specific workflow
```

**Create grants:**
```bash
# Interactive mode (recommended)
workway workflow access-grants create

# Grant to email domain - all @company.com users get access
workway workflow access-grants create wf_abc123 \
  --grant-type email_domain \
  --grant-value company.com

# Grant to specific user
workway workflow access-grants create wf_abc123 \
  --grant-type user \
  --grant-value user@example.com

# Create shareable access code
workway workflow access-grants create wf_abc123 \
  --grant-type access_code \
  --max-installs 50 \
  --expires 2025-06-01

# With notes
workway workflow access-grants create wf_abc123 \
  --grant-type email_domain \
  --grant-value acme.co \
  --notes "Enterprise pilot - Q1 2025"
```

**Revoke grants:**
```bash
workway workflow access-grants revoke              # Interactive selection
workway workflow access-grants revoke grant_xyz    # By grant ID
```

### Marketplace Discovery

Discover workflows using the pathway model or traditional search.

| Command | Description |
|---------|-------------|
| `workway needs` | Discover workflows based on your needs (recommended) |
| `workway marketplace needs` | Same as above (full path) |
| `workway marketplace search [query]` | Search workflows (legacy) |
| `workway marketplace browse` | Browse by category (legacy) |
| `workway marketplace info [workflow]` | View detailed workflow info |

**Pathway model discovery (recommended):**
```bash
# Interactive mode - asks what you need
workway needs

# Specify integration pair
workway needs --from zoom --to notion
workway needs --from stripe --to airtable

# Specify outcome frame
workway needs --after meetings
workway needs --after payments

# Show available outcomes
workway needs --show-outcomes
```

**Legacy search:**
```bash
workway marketplace search "meeting notes"
workway marketplace search --category productivity
workway marketplace search --developer alexchen
workway marketplace search --sort popular --limit 20
```

**Browse and info:**
```bash
workway marketplace browse                    # Interactive category selection
workway marketplace browse --featured         # Featured workflows
workway marketplace browse --category ai      # Specific category

workway marketplace info meeting-intelligence # Detailed workflow info
```

### Agentic Commands (AI-Powered Workflow Operations)

Build workflows using natural language. No templates. No boilerplate.

| Command | Description |
|---------|-------------|
| `workway create [prompt]` | Generate a workflow from natural language |
| `workway explain [file]` | Understand what a workflow does |
| `workway modify [file] [request]` | Transform existing workflows |

**Create from natural language:**
```bash
# Interactive mode
workway create

# Direct prompt
workway create "When a Zoom meeting ends, create a Notion page with the transcript and send a Slack summary"

# With output file
workway create "sync Stripe payments to Airtable" --output stripe-sync.ts
```

**Explain any workflow:**
```bash
# Get a plain-English explanation
workway explain ./my-workflow.ts

# Explain with different verbosity
workway explain ./my-workflow.ts --verbose    # Full technical breakdown
workway explain ./my-workflow.ts --brief      # One-sentence summary

# Explain specific aspects
workway explain ./my-workflow.ts --focus triggers   # Just trigger logic
workway explain ./my-workflow.ts --focus data-flow  # Data transformations
```

**Modify existing workflows:**
```bash
# Add functionality
workway modify ./meeting-workflow.ts "add email notification after Slack message"

# Refactor
workway modify ./workflow.ts "use batch processing for the API calls"

# Fix issues
workway modify ./workflow.ts "handle the case where transcript is empty"

# Interactive mode
workway modify ./workflow.ts
```

These commands use AI to understand workflow patterns and generate idiomatic WORKWAY code that follows the `defineWorkflow()` structure.

### AI Commands (Cloudflare Workers AI)

| Command | Description |
|---------|-------------|
| `workway ai models` | List available AI models with costs |
| `workway ai test [prompt]` | Test AI model with a prompt |
| `workway ai estimate` | Estimate AI workflow costs |

**List models:**
```bash
workway ai models                    # All models
workway ai models --type text        # Text generation only
workway ai models --type embeddings  # Embeddings only
workway ai models --type image       # Image models
workway ai models --type audio       # Audio models
workway ai models --json             # JSON output
```

**Test AI:**
```bash
workway ai test "Summarize this text"          # Interactive model selection
workway ai test "Hello" --mock                 # Mock response (no API call)
workway ai test "Translate to French" --model LLAMA_3_8B  # Specific model
workway ai test --json                         # JSON output
```

**Estimate costs:**
```bash
workway ai estimate                           # Interactive
workway ai estimate --executions 1000 --tokens 500
workway ai estimate --executions 10000 --tokens 800 --model LLAMA_3_8B
```

### OAuth Management

Manage OAuth connections for testing workflows.

| Command | Description |
|---------|-------------|
| `workway oauth connect [provider]` | Connect an OAuth account |
| `workway oauth list` | List connected OAuth accounts |
| `workway oauth disconnect [provider]` | Disconnect an OAuth account |

```bash
# Connect to providers
workway oauth connect               # Interactive provider selection
workway oauth connect zoom
workway oauth connect slack
workway oauth connect notion
workway oauth connect gmail

# List connections
workway oauth list

# Disconnect
workway oauth disconnect zoom
```

### Developer Profile & Earnings

| Command | Description |
|---------|-------------|
| `workway developer init` | Create your developer profile |
| `workway developer submit` | Submit profile for marketplace review |
| `workway developer status` | Check application status |
| `workway developer profile` | View/edit developer profile |
| `workway developer earnings` | View earnings and payouts |
| `workway developer stripe [action]` | Manage Stripe Connect (setup/status/refresh) |
| `workway developer register` | Register as developer (legacy) |

**Developer onboarding flow:**
```bash
# Step 1: Create profile
workway developer init

# Step 2: Submit for review
workway developer submit

# Step 3: Check status
workway developer status
```

**Profile management:**
```bash
workway developer profile          # View profile
workway developer profile --edit   # Edit interactively
```

**Earnings:**
```bash
workway developer earnings                 # View all earnings
workway developer earnings --period week   # This week
workway developer earnings --period month  # This month
workway developer earnings --setup         # Set up Stripe payout
```

**Stripe Connect:**
```bash
workway developer stripe              # Check status (default)
workway developer stripe setup        # Set up Stripe Connect
workway developer stripe status       # View connection status
workway developer stripe refresh      # Refresh connection
```

### Developer OAuth Apps (BYOO - Bring Your Own OAuth)

Use your own OAuth app credentials for custom branding and API quotas.

| Command | Description |
|---------|-------------|
| `workway developer oauth list` | List your OAuth apps |
| `workway developer oauth add [provider]` | Add OAuth app credentials |
| `workway developer oauth remove [provider]` | Remove OAuth app |
| `workway developer oauth test [provider]` | Test OAuth app credentials |
| `workway developer oauth promote [provider]` | Promote OAuth app to production |

**Supported providers:**
- Meetings: Zoom, Calendly
- Productivity: Notion, Airtable, Todoist, Linear
- Communication: Slack, Discord
- Google: Sheets, Calendar, Drive
- Developer: GitHub
- Forms: Typeform
- CRM: HubSpot
- Design: Dribbble
- Payments: Stripe

**Add your OAuth app:**
```bash
# Interactive mode
workway developer oauth add

# Add specific provider
workway developer oauth add zoom
workway developer oauth add notion
workway developer oauth add slack

# Overwrite existing
workway developer oauth add zoom --force
```

**Manage apps:**
```bash
# List all apps
workway developer oauth list

# Test credentials
workway developer oauth test zoom

# Remove app
workway developer oauth remove zoom
workway developer oauth remove zoom --force  # Skip confirmation

# Promote to production (from development)
workway developer oauth promote zoom
```

### Status & Logs

| Command | Description |
|---------|-------------|
| `workway status` | Show developer dashboard and health |
| `workway logs` | View production workflow execution logs |

```bash
# Dashboard overview
workway status

# View logs
workway logs                             # Recent logs
workway logs --workflow wf_abc123        # Filter by workflow
workway logs --limit 50                  # More logs
workway logs --follow                    # Stream in real-time
workway logs --status failed             # Only failed runs
workway logs --status completed          # Only completed runs
```

### Database Commands

Tools for database management and debugging.

| Command | Description |
|---------|-------------|
| `workway db check` | Check D1 schema against Drizzle definitions |
| `workway db sync-workflows` | Sync workflows from package to D1 database |

**Schema drift detection:**
```bash
# Check all tables
workway db check

# Check specific table
workway db check --table workflow_runs

# Generate migration SQL for drift
workway db check --generate-migration

# Check local database
workway db check --local

# Custom wrangler config
workway db check --config ./apps/api/wrangler.jsonc
```

**Sync workflows:**
```bash
# Preview what would sync
workway db sync-workflows --dry-run

# Sync to remote database
workway db sync-workflows

# Sync to local database
workway db sync-workflows --local

# Custom config
workway db sync-workflows --config ./wrangler.jsonc
```

## AI Workflow Development

Create AI-powered workflows using Cloudflare Workers AI — no external API keys required.

### 1. Initialize AI Workflow

```bash
workway workflow init --ai "Email Summarizer"
```

This creates a project with:
- `workflow.ts` — AI workflow template
- `test-data.json` — Test inputs
- `package.json` — Dependencies

### 2. Explore Available Models

```bash
workway ai models
```

Output:
```
TEXT GENERATION
────────────────────────────────────────────────────────
Model              Alias           Cost/1M    Context
────────────────────────────────────────────────────────
Llama 2 7B         LLAMA_2_7B      $0.005     4096
Llama 3 8B         LLAMA_3_8B      $0.010     8192
Mistral 7B         MISTRAL_7B      $0.020     8192
```

### 3. Estimate Costs

```bash
workway ai estimate --executions 1000 --tokens 500
```

### 4. Test Your Workflow

```bash
workway workflow test --mock
```

### 5. Publish

```bash
workway workflow publish
```

## Cost Comparison

| Provider | Model | Cost/1M tokens |
|----------|-------|----------------|
| **Workers AI** | Llama 3 8B | $0.01 |
| OpenAI | GPT-4o-mini | $0.15-0.60 |
| Anthropic | Claude Haiku | $0.25-1.25 |

Workers AI runs on Cloudflare edge. No API keys. Zero egress.

## Configuration

### Global Config

Stored in `~/.workway/config.json`:

```json
{
  "apiUrl": "https://workway-api.half-dozen.workers.dev",
  "credentials": {
    "token": "...",
    "userId": "...",
    "email": "..."
  }
}
```

### Project Config

Stored in `workway.config.json`:

```json
{
  "dev": {
    "port": 3000,
    "hotReload": true,
    "mockMode": true
  },
  "test": {
    "testDataFile": "./test-data.json",
    "timeout": 30000
  },
  "build": {
    "outDir": "./dist",
    "minify": false
  }
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Test
npm test

# Link locally for testing
npm link
```

## Documentation

- [SDK Documentation](../sdk/README.md)
- [Workers AI Models](https://developers.cloudflare.com/workers-ai/models/)
- [WORKWAY Docs](https://docs.workway.dev)

## License

Apache-2.0 © WORKWAY
