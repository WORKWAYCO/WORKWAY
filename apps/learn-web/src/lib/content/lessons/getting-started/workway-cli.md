# WORKWAY CLI Installation

The WORKWAY CLI connects your local development environment to the WORKWAY platform. Deploy, test, and manage workflows from your terminal.

## Installation

### Via npm

```bash
npm install -g @workwayco/cli
```

### Via pnpm (recommended)

```bash
pnpm add -g @workwayco/cli
```

### Verify Installation

```bash
workway --version
```

## Authentication

### Login to WORKWAY

```bash
workway login
```

This opens a browser window for OAuth authentication. After approval, your session is stored locally.

### Check Auth Status

```bash
workway whoami
```

Output:
```
Logged in as: your.email@example.com
Organization: Your Org
Plan: Developer
```

## Project Setup

### Initialize a New Project

```bash
mkdir my-workflow
cd my-workflow
workway init
```

This creates:
```
my-workflow/
├── wrangler.toml       # Cloudflare Workers config
├── src/
│   └── index.ts        # Workflow entry point
├── package.json
└── tsconfig.json
```

### Link Existing Project

```bash
cd existing-project
workway link
```

Select the workflow to link from your WORKWAY account.

## Essential Commands

| Command | Purpose |
|---------|---------|
| `workway init` | Create new workflow project |
| `workway dev` | Start local development server |
| `workway deploy` | Deploy to production |
| `workway logs` | Stream production logs |
| `workway test` | Run workflow tests |
| `workway status` | Check workflow health |

## Local Development

### Start Dev Server

```bash
workway dev
```

This starts wrangler in development mode with:
- Hot reload on file changes
- Local D1 database
- Mocked integrations
- Request logging

### Test a Workflow Locally

```bash
curl http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{"input": "test"}'
```

## Deployment

### Deploy to Production

```bash
workway deploy
```

Output:
```
Deploying my-workflow...
✓ Build complete (1.2s)
✓ Uploaded to Cloudflare (0.8s)
✓ Workflow live at: https://my-workflow.workway.co

Deployment ID: abc123
```

### Environment Variables

```bash
# Set production secret
workway secret put API_KEY

# List secrets
workway secret list
```

## Project Configuration

### wrangler.toml

```toml
name = "my-workflow"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
ENVIRONMENT = "production"

[[d1_databases]]
binding = "DB"
database_name = "my-workflow-db"
database_id = "your-database-id"
```

### package.json scripts

```json
{
  "scripts": {
    "dev": "workway dev",
    "deploy": "workway deploy",
    "test": "workway test",
    "logs": "workway logs --tail"
  }
}
```

## Praxis

Install the WORKWAY CLI and verify it works:

> **Praxis**: Ask Claude Code: "Help me install and configure the WORKWAY CLI"

After installation, run through these commands:

```bash
workway --version
workway login
workway whoami
```

Then initialize a test project:

```bash
mkdir test-workflow && cd test-workflow
workway init
```

Examine the generated files with Claude Code to understand the project structure.

## Reflection

- How does having a CLI tool change your development-to-deployment workflow?
- What manual steps in your current process could the CLI automate?
