# Claude Code Setup

Claude Code is your primary tool for building WORKWAY workflows. Not a helper—the tool through which you'll complete everything that follows.

## Why Claude Code First?

This learning path is different. You won't passively read tutorials. You'll:

1. **Set up Claude Code** (this lesson)
2. **Use Claude Code** to complete every other lesson
3. **Learn by building** with an AI partner that understands the codebase

The tool recedes. The learning remains.

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

| Capability | What It Does |
|------------|--------------|
| **Read files** | Understands your entire codebase |
| **Write files** | Creates and edits code |
| **Run commands** | Executes terminal commands |
| **Search** | Finds patterns, definitions, usages |
| **Explain** | Breaks down complex code |
| **Build** | Implements features end-to-end |

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

## Essential Commands

### In-Session Commands

| Command | Action |
|---------|--------|
| `/help` | Show all commands |
| `/clear` | Clear conversation |
| `/compact` | Summarize and continue |
| `/cost` | Show token usage |

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

Navigate to the WORKWAY codebase and explore it with Claude Code:

> **Praxis**: Open a terminal in the WORKWAY project directory and ask Claude Code: "What patterns are used in the workflows folder?"

Then explore further:

> "Show me an example of defineWorkflow() in this codebase"

Document what you find. Notice how Claude Code reads files, understands structure, and explains patterns.

## Reflection

- How does having an AI partner change your approach to learning?
- What would you explore first if Claude Code could read any codebase?
- How might "learning by building with AI" differ from traditional tutorials?

## Next Step

With Claude Code installed, you'll use it to complete the next lesson: installing the WORKWAY CLI.

```
> Help me install and configure the WORKWAY CLI
```

The tool is ready. Let's build.
