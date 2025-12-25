# Claude Code Plugins Setup

## Learning Objectives

By the end of this lesson, you will be able to:

- Install and configure the WORKWAY plugin marketplace
- Use slash commands for deployment and testing
- Understand how skills auto-activate based on context
- Customize plugin settings for your workflow

---

Claude Code plugins extend your development environment with WORKWAY-specific tools and patterns. The mechanism is invisible—skills appear when needed, commands execute when invoked.

## Installation

### Step 1: Add the WORKWAY Marketplace

```bash
claude plugin marketplace add workway
```

This registers the WORKWAY plugin repository as a source.

### Step 2: Install All Plugins

```bash
claude plugin install workway
```

This installs all WORKWAY plugins in one command.

### Step 3: Verify Installation

```bash
claude plugin list
```

You should see:
- `workway` (containing skills, commands, and agents)

## Available Commands

Commands are user-invoked via `/command`:

| Command | Purpose |
|---------|---------|
| `/deploy` | Safe deployment with pre-checks (tests, lint, git status) |
| `/harness-spec` | Generate markdown specs for autonomous harness execution |
| `/integration-test` | Validate integration against BaseAPIClient patterns |

### Using /deploy

The `/deploy` command runs a safety checklist before any deployment:

```
/deploy
```

It will:
1. Check for uncommitted changes
2. Run lint
3. Run tests
4. Verify build
5. Confirm deployment target

If any check fails, deployment is blocked with a clear explanation.

### Using /harness-spec

Generate a specification for autonomous execution:

```
/harness-spec
```

Creates a markdown file that the harness can parse into Beads issues and execute autonomously.

### Using /integration-test

Validate an integration implementation:

```
/integration-test packages/integrations/src/notion/
```

Checks for:
- BaseAPIClient extension
- Proper type definitions
- Error handling patterns
- OAuth token refresh

## Available Skills

Skills are model-invoked—they activate automatically based on context:

| Skill | Activates When |
|-------|----------------|
| `heidegger-design` | Making architectural, UX, or naming decisions |
| `subtractive-review` | Reviewing PRs, refactoring code |
| `d1-migration-safety` | Creating or applying D1 migrations |
| `compound-workflow` | Designing multi-output workflows |
| `workway-integrations` | Building service integrations |

### How Skills Activate

You don't invoke skills directly. They appear when Claude Code detects relevant context:

```
User: "How should I name this API endpoint?"

Claude: [heidegger-design skill activates]
Consider Zuhandenheit—name for the outcome, not the mechanism.

Instead of: /api/v1/oauth/tokens/refresh
Consider: /reconnect

The user thinks "reconnect my account", not "refresh my OAuth token".
```

### Skill Detection Triggers

| Skill | Detection Pattern |
|-------|-------------------|
| `heidegger-design` | Keywords: "name", "design", "architecture", "UX" |
| `d1-migration-safety` | File patterns: `migrations/*.sql`, D1 commands |
| `subtractive-review` | Keywords: "review", "refactor", "simplify" |
| `compound-workflow` | Keywords: "workflow", "automation", multi-service mentions |

## Configuration

### Project-Level Settings

Add to your project's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "workway": {
      "source": {
        "source": "github",
        "repo": "WORKWAYCO/workway-plugins"
      }
    }
  },
  "enabledPlugins": {
    "workway": true
  }
}
```

### Disabling Specific Skills

If a skill is too noisy for your workflow:

```json
{
  "enabledPlugins": {
    "workway": true
  },
  "disabledSkills": ["subtractive-review"]
}
```

## Workflow Integration

### With Beads (Issue Tracking)

The plugins integrate with Beads for issue tracking:

```bash
bd create "Add Slack integration" --label integrations

# Claude Code sees this issue and activates workway-integrations skill
# when you start working on it
```

### With Harness (Autonomous Execution)

Use `/harness-spec` to create specs that the harness can execute:

```bash
/harness-spec

# Creates spec file
# Then run:
pnpm harness start specs/your-spec.md
```

## Zuhandenheit in Action

Notice how the plugins recede:

- **Commands**: You type `/deploy`, safety checks happen automatically
- **Skills**: You describe a problem, relevant knowledge appears
- **Configuration**: Set once in settings.json, forget forever

The mechanism disappears. You focus on your work.

## Praxis

Experience the plugins in action:

> **Praxis**: Install the WORKWAY plugin marketplace. Run `/deploy` to see the safety checklist. Start working on a naming decision and observe how the heidegger-design skill activates.

Document:
1. Which commands you found most useful
2. Which skills activated during your work
3. Any adjustments you made to settings

## Troubleshooting

### Plugins Not Loading

```bash
# Check plugin status
claude plugin list

# Reinstall
claude plugin uninstall workway
claude plugin install workway
```

### Skills Not Activating

Skills require context. Try being more explicit:

```
"I'm designing the API endpoint names for this feature..."
```

### Command Not Found

Ensure the plugin is installed and enabled:

```bash
claude plugin list --enabled
```

## Reflection

- How do plugins change your development workflow?
- When does automation help vs. hinder?
- What's the right level of tool visibility for your work?
