# Install Claude Code

Install Claude Code, authenticate, and configure MCP servers.

## What you'll do

- Install Claude Code via npm
- Authenticate with your Anthropic account
- Configure the WORKWAY Learn MCP server
- Use session commands: `/help`, `/clear`, `/compact`
- Invoke skills: `/heidegger-design`, `/workway-integrations`

## Why Claude Code First?

This learning path is different. You won't passively read tutorials. You'll:

1. **Set up Claude Code** (this lesson)
2. **Use Claude Code** to complete every other lesson
3. **Learn by building** with an AI partner that understands the codebase

The tool recedes. The learning remains.

## Quick Start: Get Running in 3 Minutes

### Step 1: Install Claude Code

```bash
npm install -g @anthropic-ai/claude-code
```

### Step 2: Verify Installation

```bash
claude --version
```

### Step 3: Authenticate

```bash
claude
```

Your browser will open. Sign in with your Claude account.

### Step 4: Start Your First Session

```bash
cd your-project
claude
```

Try these prompts:

```
> What is this project?
> What patterns are used in this codebase?
```

### Step 5: (Optional) Add WORKWAY MCP Server

Create `.mcp.json` in your project directory:

```json
{
  "mcpServers": {
    "workway-learn": {
      "command": "npx",
      "args": ["@workway/learn", "--server"]
    }
  }
}
```

Restart Claude Code and verify:

```
> What learning tools are available via MCP?
```

---

## Recommended: Claude Max Plan

For the best experience building workflows, we recommend the **Claude Max plan**:

- **Unlimited usage** of Claude Code
- **Extended thinking** for complex architecture decisions
- **Priority access** during high-demand periods

**Pricing**: $100/month (or $200/month for 20x capacity)

[Compare plans →](https://claude.com/pricing/max)

[Max plan guide →](https://support.claude.com/en/articles/11145838-using-claude-code-with-your-pro-or-max-plan)

You can also use Claude Pro ($20/month) with usage limits, or connect your own Anthropic API key.

## Installation

### macOS / Linux

```bash
npm install -g @anthropic-ai/claude-code
```

### Verify Installation

```bash
claude --version
```

You should see output like:

```
claude-code 1.x.x
```

## Authentication

### With Claude Max/Pro

If you have a Claude Max or Pro subscription:

```bash
claude
```

On first run, Claude Code opens your browser to authenticate with your Claude account. Sign in, and you're connected.

### With API Key

If you prefer to use an Anthropic API key:

1. Get your key from [console.anthropic.com](https://console.anthropic.com)
2. Run:

```bash
claude auth
```

Follow the prompts to enter your API key. It's stored securely in your system keychain.

## First Session

Navigate to any project directory:

```bash
cd your-project
claude
```

### Try These Prompts

Start exploring:

```
> What is this project?

> What patterns are used in this codebase?

> Show me the main entry point
```

Claude Code reads files, understands structure, and can modify code when you ask.

## How Claude Code Works

| Capability       | What It Does                        |
| ---------------- | ----------------------------------- |
| **Read files**   | Understands your entire codebase    |
| **Write files**  | Creates and edits code              |
| **Run commands** | Executes terminal commands          |
| **Search**       | Finds patterns, definitions, usages |
| **Explain**      | Breaks down complex code            |
| **Build**        | Implements features end-to-end      |

### The CLAUDE.md File

Projects can include a `CLAUDE.md` file with context:

```markdown
# Project Name

## Overview

What this project does.

## Key Files

- `src/workflows/` - Workflow definitions
- `src/integrations/` - API integrations

## Patterns

- Use defineWorkflow() for all workflows
- Follow BaseAPIClient pattern for integrations
```

Claude Code reads this automatically and follows your project's conventions.

## MCP Server Setup

Claude Code supports Model Context Protocol (MCP) servers for extended functionality. WORKWAY provides an MCP server that gives Claude Code direct access to learning tools.

### Adding WORKWAY Learn MCP Server

Create or edit `.mcp.json` in your project or home directory:

```json
{
  "mcpServers": {
    "workway-learn": {
      "command": "npx",
      "args": ["@workway/learn", "--server"]
    }
  }
}
```

Location options:

- **Project-level**: `.mcp.json` in project root (recommended for teams)
- **User-level**: `~/.claude/.mcp.json` (available across all projects)

### Verifying MCP Connection

After adding the config, restart Claude Code. You can verify the connection:

```
> What MCP servers are connected?
```

Claude Code should show `workway-learn` as available.

### Available MCP Tools

Once connected, Claude Code gains access to these learning tools:

| Tool                 | Description                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| `learn_status`       | Get learning progress overview including paths, lessons, and recommendations                       |
| `learn_lesson`       | Fetch lesson content from WORKWAY Learn with offline caching                                       |
| `learn_complete`     | Mark a lesson as complete with optional reflection                                                 |
| `learn_praxis`       | Execute workflow building exercises with pattern validation                                        |
| `learn_coach`        | Get real-time WORKWAY pattern guidance and explanations                                            |
| `learn_analyze`      | Analyze workflow code against WORKWAY patterns and Zuhandenheit principles                         |
| `learn_recommend`    | Get personalized lesson recommendations based on your progress and skill gaps                      |
| `learn_digest`       | Generate a weekly or monthly learning summary with achievements and goals                          |
| `learn_ethos`        | Manage personal workflow principles (Zuhandenheit, outcome focus, simplicity, resilience, honesty) |
| `learn_authenticate` | Authenticate with WORKWAY Learn to sync progress across devices                                    |

### Tool Usage Examples

**Check your progress:**

```
> Show me my learning progress
> What lessons have I completed?
```

**Fetch lesson content:**

```
> Get the lesson on defineWorkflow()
> Show me the triggers lesson
```

**Complete a lesson with reflection:**

```
> Mark the claude-code-setup lesson as complete
> I finished the first-workflow lesson. My reflection: Understanding how integrations work was key.
```

**Validate your workflow code:**

```
> Analyze my workflow in packages/workflows/src/my-workflow/index.ts
> Check if this code follows WORKWAY patterns: [paste code]
```

**Get coaching on patterns:**

```
> How do I use integrations in a workflow?
> Explain the Zuhandenheit principle
> Help me debug this error: [paste error]
```

**Manage your ethos (workflow principles):**

```
> Show me my workflow principles
> Suggest improvements for my ethos
> Reflect on my Zuhandenheit principle
```

**Get recommendations:**

```
> What should I learn next?
> Recommend lessons for improving my integration skills
```

## WORKWAY Skills (Slash Commands)

Skills are reusable prompts that Claude Code executes with project context. WORKWAY provides specialized skills for workflow development.

### Project Skills

When working in the WORKWAY codebase, these skills are available:

| Skill                   | Description                                                   | When to Use                                                   |
| ----------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- |
| `/heidegger-design`     | Apply Zuhandenheit, Geworfenheit, and Dieter Rams' principles | Architecture decisions, UI/UX choices, naming conventions     |
| `/workway-integrations` | Build integrations using BaseAPIClient pattern                | Creating new service integrations (Zoom, Notion, Slack, etc.) |

### /heidegger-design Skill

This skill applies Heideggerian design philosophy to your code and design decisions:

**Core Concepts:**

- **Zuhandenheit (Ready-to-hand)**: The tool disappears during use—users think about their goal, not the mechanism
- **Vorhandenheit (Present-at-hand)**: When a tool breaks, it becomes visible—minimize this through graceful error handling
- **Geworfenheit (Thrownness)**: Users arrive mid-task with existing context—meet them where they are

**Practical Checklist:**

1. Will the user notice this, or will it fade into their workflow?
2. If this breaks, does the user smoothly return to flow?
3. Does this respect the user's existing context?
4. Can this be removed without loss of function?
5. Is this making a real promise or a marketing promise?

**Example Usage:**

```
> /heidegger-design

Claude Code will apply Heideggerian design principles to evaluate
your current work, asking questions like:
- Does the tool recede?
- Is this Zuhandenheit or Vorhandenheit?
- What would Dieter Rams remove?
```

### /workway-integrations Skill

This skill guides you through building integrations using the canonical patterns:

**Directory Structure:**

```
packages/integrations/src/{service}/
├── index.ts           # Main export
├── {service}.types.ts # TypeScript interfaces
├── {service}.ts       # API client (extends BaseAPIClient)
└── {service}.test.ts  # Tests
```

**What the Skill Provides:**

- Proper directory structure setup
- BaseAPIClient extension pattern
- Type definitions template
- OAuth token refresh handling
- Error handling patterns
- Test scaffolding

**Example Usage:**

```
> /workway-integrations

Claude Code will help you build an integration following the
canonical BaseAPIClient pattern, including:
- Proper directory structure
- Type definitions
- Error handling
- Tests
```

### Skill Philosophy

Skills embody Zuhandenheit—they encode expert knowledge into simple invocations. Instead of explaining design philosophy each time, you invoke `/heidegger-design` and the principles flow through Claude Code's responses.

The skill recedes. The better design remains.

### Creating Custom Skills

You can create your own skills in `.claude/skills/`:

```bash
mkdir -p .claude/skills/my-skill
touch .claude/skills/my-skill/SKILL.md
```

Example `SKILL.md`:

```markdown
---
name: my-skill
description: What this skill does
---

# My Skill

Instructions for Claude Code when this skill is invoked...
```

Skills are version-controlled with your project, ensuring team-wide consistency.

## Essential Commands

### In-Session Commands

| Command    | Action                 |
| ---------- | ---------------------- |
| `/help`    | Show all commands      |
| `/clear`   | Clear conversation     |
| `/compact` | Summarize and continue |
| `/cost`    | Show token usage       |

### CLI Options

```bash
claude              # Start interactive session
claude "question"   # One-shot question
claude -c           # Continue previous session
```

## Using Claude Code to Learn

Throughout this course, praxis exercises look like:

> **Praxis**: Ask Claude Code: "Help me build a workflow that saves starred emails to Notion"

This isn't a metaphor. You'll literally type that prompt into Claude Code and build the workflow together.

### Example Learning Flow

1. **Read the lesson** - Understand the concept
2. **Open Claude Code** in the WORKWAY codebase
3. **Ask about patterns** - "Show me examples of defineWorkflow()"
4. **Build something** - "Help me create a workflow that..."
5. **Deploy and test** - "How do I deploy this?"

Claude Code has the codebase context. You have the intent. Together: outcomes.

## Troubleshooting

### "Command not found: claude"

npm global bin not in PATH. Add to your shell config:

```bash
# For zsh (~/.zshrc)
export PATH="$PATH:$(npm config get prefix)/bin"

# Reload
source ~/.zshrc
```

### "Authentication failed"

Clear credentials and re-authenticate:

```bash
claude auth logout
claude auth
```

### "Rate limited"

With Claude Pro, you may hit usage limits. Options:

- Wait for reset (usually daily)
- Upgrade to Claude Max for unlimited
- Use API key with separate billing

## Praxis

### Part 1: Basic Exploration

Navigate to the WORKWAY codebase and explore it with Claude Code:

> **Praxis**: Open a terminal in the WORKWAY project directory and ask Claude Code: "What patterns are used in the workflows folder?"

Then explore further:

> "Show me an example of defineWorkflow() in this codebase"

Document what you find. Notice how Claude Code reads files, understands structure, and explains patterns.

### Part 2: MCP Setup

Configure the WORKWAY Learn MCP server:

1. Create `.mcp.json` in your project directory:

```json
{
  "mcpServers": {
    "workway-learn": {
      "command": "npx",
      "args": ["@workway/learn", "--server"]
    }
  }
}
```

2. Restart Claude Code
3. Verify the connection:
   > "What learning tools are available via MCP?"

Claude Code should list the `learn_*` tools.

### Part 3: Skills

Test the WORKWAY skills:

> "/heidegger-design"

When prompted, describe a recent design decision. Notice how the skill applies philosophical principles to practical choices.

> "/workway-integrations"

When prompted, mention an API you'd like to integrate (e.g., "Stripe", "Airtable"). Notice how the skill guides you toward the canonical BaseAPIClient pattern.

## Reflection

- How does having an AI partner change your approach to learning?
- What would you explore first if Claude Code could read any codebase?
- How might "learning by building with AI" differ from traditional tutorials?
- How do skills (slash commands) encode expertise into reusable patterns?
- What custom skills might benefit your workflow development?

## Use Claude Code for Everything That Follows

With Claude Code installed, you can use it to complete every remaining lesson in this path:

| Lesson             | Ask Claude Code                                                    |
| ------------------ | ------------------------------------------------------------------ |
| WezTerm Setup      | "Help me install WezTerm and configure it with a pure black theme" |
| Neomutt Setup      | "Set up Neomutt for Gmail with an app password"                    |
| WORKWAY CLI        | "Install and configure the WORKWAY CLI"                            |
| Essential Commands | "Add WORKWAY development aliases to my shell"                      |

You don't have to copy/paste configs manually. You can—but Claude Code can also generate, explain, and apply them for you.

## Next Step

Let's configure your terminal. Ask Claude Code:

```
> Help me install WezTerm and configure it with a pure black background for WORKWAY development
```

The tool is ready. Let's build.
