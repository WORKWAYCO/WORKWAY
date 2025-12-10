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

## Commands

### Authentication

| Command | Description |
|---------|-------------|
| `workway login` | Authenticate with WORKWAY platform |
| `workway logout` | Clear local authentication |
| `workway whoami` | Display current authenticated user |

### Workflow Development

| Command | Description |
|---------|-------------|
| `workway workflow init [name]` | Create a new workflow project |
| `workway workflow init --ai [name]` | Create AI-powered workflow (Cloudflare Workers AI) |
| `workway workflow dev` | Start development server with hot reload |
| `workway workflow test` | Test workflow execution |
| `workway workflow build` | Build workflow for production |
| `workway workflow publish` | Publish workflow to marketplace |

**Test options:**
```bash
workway workflow test --mock      # Use mocked integrations
workway workflow test --live      # Use live OAuth connections
workway workflow test --data file.json  # Custom test data
```

**Build options:**
```bash
workway workflow build --minify        # Minify output
workway workflow build --sourcemap     # Generate sourcemaps
workway workflow build --out-dir dist  # Custom output directory
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
workway ai models --json             # JSON output
```

**Test AI:**
```bash
workway ai test "Summarize this text" --mock   # Mock response
workway ai test --model LLAMA_3_8B             # Specific model
```

**Estimate costs:**
```bash
workway ai estimate                           # Interactive
workway ai estimate --executions 1000 --tokens 500 --model LLAMA_3_8B
```

### OAuth Management

| Command | Description |
|---------|-------------|
| `workway oauth connect [provider]` | Connect an OAuth account (gmail, slack, notion, zoom) |
| `workway oauth list` | List connected OAuth accounts |
| `workway oauth disconnect [provider]` | Disconnect an OAuth account |

### Developer Profile

| Command | Description |
|---------|-------------|
| `workway developer register` | Register as a workflow developer |
| `workway developer profile` | View/edit developer profile |
| `workway developer earnings` | View earnings and payouts |

### Status & Logs

| Command | Description |
|---------|-------------|
| `workway status` | Show developer dashboard and health |
| `workway logs` | View production workflow execution logs |

**Logs options:**
```bash
workway logs --workflow <id>     # Filter by workflow
workway logs --limit 50          # Number of logs
workway logs --follow            # Stream in real-time
workway logs --status failed     # Filter by status
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
