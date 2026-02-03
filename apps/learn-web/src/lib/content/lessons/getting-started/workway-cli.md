# Install the WORKWAY CLI

Install the CLI, authenticate, and deploy your first workflow.

## What you'll do

- Install the CLI with pnpm or npm
- Authenticate with `workway login`
- Initialize a project with `workway init`
- Run locally with `workway dev`
- Deploy with `workway deploy`

## Use Claude Code

You can complete this entire lesson by asking Claude Code. Try these prompts:

```
> Install the WORKWAY CLI globally with pnpm

> Help me authenticate with workway login

> Create a new workflow project with workway init

> Show me how to test my workflow locally with curl

> Deploy my workflow to production
```

Claude Code will run the commands, explain each step, and help troubleshoot any issues.

## Quick Start: Your First Workflow in 5 Minutes

### Step 1: Install the CLI

```bash
pnpm add -g @workwayco/cli
# or: npm install -g @workwayco/cli
```

### Step 2: Authenticate

```bash
workway login
```

A browser window opens. Sign in with your WORKWAY account.

### Step 3: Verify Authentication

```bash
workway whoami
```

You should see your email and organization.

### Step 4: Create a New Project

```bash
mkdir my-first-workflow
cd my-first-workflow
workway init
```

### Step 5: Start Development Server

```bash
workway dev
```

### Step 6: Test Your Workflow

In a new terminal:

```bash
curl http://localhost:8787/execute -d '{}'
```

### Step 7: Deploy to Production

When ready:

```bash
workway deploy
```

Your workflow is now live.

---

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

| Command          | Purpose                        |
| ---------------- | ------------------------------ |
| `workway init`   | Create new workflow project    |
| `workway dev`    | Start local development server |
| `workway deploy` | Deploy to production           |
| `workway logs`   | Stream production logs         |
| `workway test`   | Run workflow tests             |
| `workway status` | Check workflow health          |

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
