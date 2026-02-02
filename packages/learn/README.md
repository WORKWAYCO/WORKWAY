# @workwayco/learn

[![npm version](https://img.shields.io/npm/v/@workwayco/learn.svg)](https://www.npmjs.com/package/@workwayco/learn)
[![License](https://img.shields.io/npm/l/@workwayco/learn.svg)](https://github.com/workwayco/workway/blob/main/LICENSE)

**MCP server and CLI for learning WORKWAY workflow development with Claude Code.**

Build automations that recede—outcomes remain.

> *Zuhandenheit*: The tool should be invisible when working correctly. You don't think about the hammer; you think about the nail.

## What is WORKWAY?

[WORKWAY](https://workway.co) is a workflow automation platform built on Cloudflare Workers. It connects your tools (Gmail, Notion, Slack, Zoom, and more) into seamless automations that handle your follow-ups, syncs, and notifications—so you can focus on the work that matters.

**This package** helps you learn to build WORKWAY workflows with Claude Code as your AI pair programmer.

## Quick Start

```bash
# Install globally
npm install -g @workwayco/learn

# Or run directly
npx @workwayco/learn
```

## CLI Usage

```bash
# Initialize learning environment
workway-learn init

# Full scaffolding with CLAUDE.md and rules
workway-learn init --full

# Show learning progress
workway-learn status

# Clear cache
workway-learn clear --cache

# Clear everything (including credentials)
workway-learn clear --all
```

## MCP Server for Claude Code

Add to your Claude Code MCP settings (`.mcp.json`):

```json
{
  "mcpServers": {
    "workway-learn": {
      "command": "npx",
      "args": ["@workwayco/learn", "--server"]
    }
  }
}
```

Once configured, Claude Code gains access to 10 learning tools that guide you through WORKWAY workflow development.

## MCP Tools

| Tool | Description |
|------|-------------|
| `learn_authenticate` | Authenticate with WORKWAY Learn |
| `learn_status` | Get learning progress overview |
| `learn_lesson` | Fetch lesson content with caching |
| `learn_complete` | Mark lessons complete with reflection |
| `learn_praxis` | Execute workflow building exercises |
| `learn_ethos` | Manage personal workflow principles |
| `learn_analyze` | Analyze workflow code against patterns |
| `learn_recommend` | Get personalized lesson recommendations |
| `learn_coach` | Real-time WORKWAY pattern guidance |
| `learn_digest` | Generate weekly learning summaries |

## Learning Paths

**4 paths, 20 lessons, ~9 hours total**

1. **Getting Started** — Claude Code setup, WORKWAY CLI
2. **Workflow Foundations** — `defineWorkflow()`, integrations, triggers
3. **Building Workflows** — Gmail→Notion, Workers AI, error handling
4. **Systems Thinking** — Compound workflows, agency patterns

Start learning at [learn.workway.co](https://learn.workway.co)

## Workflow Principles (Ethos)

The package includes five workflow principles based on WORKWAY philosophy:

| Principle | Description |
|-----------|-------------|
| **Zuhandenheit** | My workflows should be invisible when working correctly |
| **Outcome Focus** | I describe workflows by what disappears from to-do lists |
| **Simplicity** | I remove until it breaks, then add back only essentials |
| **Resilience** | My workflows fail gracefully and explain themselves |
| **Honesty** | I name things for what they do, not what sounds impressive |

These principles are inspired by Heidegger's concept of *ready-to-hand* and Dieter Rams' design philosophy: *Weniger, aber besser* (Less, but better).

## Local Storage

Data is stored in `~/.workway/`:

| File | Purpose |
|------|---------|
| `learn-credentials.json` | Authentication tokens |
| `learn-ethos.json` | Personal workflow principles |
| `learn-cache/` | Cached lesson content (24h TTL) |
| `learn-offline-queue.json` | Pending progress sync |

## FAQ

### How do I automatically sync Gmail to Notion?

WORKWAY workflows use `defineWorkflow()` to connect Gmail and Notion via OAuth. The `learn_lesson` tool can teach you step-by-step.

### What's the difference between WORKWAY and Zapier?

WORKWAY runs on Cloudflare Workers (edge computing), uses TypeScript for full flexibility, and follows Zuhandenheit—tools that recede. You define outcomes, not mechanisms.

### Can I build private workflows for my organization?

Yes. WORKWAY supports private workflows with access control and BYOO (Bring Your Own OAuth) credentials. See the Systems Thinking learning path.

## Links

- **Learn**: [learn.workway.co](https://learn.workway.co)
- **Platform**: [workway.co](https://workway.co)
- **GitHub**: [github.com/workwayco/workway](https://github.com/workwayco/workway)
- **Issues**: [github.com/workwayco/workway/issues](https://github.com/workwayco/workway/issues)

## About

Built by [Half Dozen](https://halfdozen.co) for the [WORKWAY](https://workway.co) platform.

## License

Apache-2.0
