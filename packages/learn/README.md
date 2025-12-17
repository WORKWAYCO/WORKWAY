# @workway/learn

WORKWAY learning MCP server and CLI for workflow development mastery.

## Installation

```bash
npm install -g @workway/learn
# or
npx @workway/learn
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

## MCP Server

Add to your `.mcp.json` (Claude Code settings):

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

## Workflow Principles (Ethos)

The package includes five workflow principles based on WORKWAY philosophy:

| Principle | Description |
|-----------|-------------|
| **Zuhandenheit** | My workflows should be invisible when working correctly |
| **Outcome Focus** | I describe workflows by what disappears from to-do lists |
| **Simplicity** | I remove until it breaks, then add back only essentials |
| **Resilience** | My workflows fail gracefully and explain themselves |
| **Honesty** | I name things for what they do, not what sounds impressive |

## Learning Paths

1. **Getting Started** - Claude Code setup, WORKWAY CLI
2. **Workflow Foundations** - defineWorkflow(), integrations, triggers
3. **Building Workflows** - Gmail→Notion, Workers AI, error handling
4. **Systems Thinking** - Compound workflows, agency patterns

## Local Storage

Data is stored in `~/.workway/`:

- `learn-credentials.json` - Authentication tokens
- `learn-ethos.json` - Personal workflow principles
- `learn-cache/` - Cached lesson content
- `learn-offline-queue.json` - Pending progress sync

## License

Apache-2.0
