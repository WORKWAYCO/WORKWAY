# Essential Commands & Shortcuts

## Learning Objectives

By the end of this lesson, you will be able to:

- Navigate directories efficiently using `cd`, `pushd/popd`, and shell shortcuts
- Use essential Git commands for version control: `status`, `add -p`, `commit`, `stash`
- Configure shell aliases for WORKWAY, Wrangler, Git, and Claude Code
- Use Wrangler commands for debugging Cloudflare Workers: `tail`, `secret`, `d1`
- Test workflows locally with `curl` and process JSON responses with `jq`
- Use Claude Code slash commands and MCP learning tools
- Execute the complete development flow: `workway dev` → test → commit → deploy

---

Master these commands to move efficiently through your workflow development cycle. The goal: muscle memory that lets the tools recede.

## Use Claude Code

You can complete this entire lesson by asking Claude Code. Try these prompts:

```
> Add WORKWAY development aliases to my zshrc (wd, wdp, wl, gs, cc)

> Create shell functions for workflow testing (wrun, wwl, wdeploy)

> Show me the most useful keyboard shortcuts for terminal navigation

> Set up my shell for efficient WORKWAY development

> What's the complete development flow from dev to deploy?
```

Claude Code will add the aliases to your shell config, explain each shortcut, and help you practice the development cycle.

## Quick Start: Set Up Your Environment

### Step 1: Add WORKWAY Aliases to Your Shell

Open your shell config file:

```bash
# For zsh (macOS default)
nano ~/.zshrc

# For bash
nano ~/.bashrc
```

### Step 2: Paste These Aliases

```bash
# WORKWAY Development
alias wd="workway dev"
alias wdp="workway deploy"
alias wl="workway logs --tail"
alias wt="workway test"
alias ws="workway status"

# Wrangler (Cloudflare Workers)
alias wrt="wrangler tail"
alias wrte="wrangler tail --status error"

# Git shortcuts
alias gs="git status"
alias ga="git add -p"
alias gc="git commit"
alias gp="git push"

# Claude Code
alias cc="claude"
alias ccc="claude -c"

# Workflow Testing
alias wtest="curl -s localhost:8787/execute -d '{}' | jq ."
```

### Step 3: Reload Your Shell

```bash
source ~/.zshrc  # or ~/.bashrc
```

### Step 4: Test the Aliases

```bash
wd --help     # Should show workway dev help
cc --version  # Should show claude version
gs            # Should show git status
wrt --help    # Should show wrangler tail help
```

### Step 5: Practice the Development Flow

Run this sequence in your WORKWAY project:

```bash
wd            # Start dev server (Terminal 1)
cc            # Start Claude Code (Terminal 2)
wrt           # Watch logs in real-time (Terminal 3)
wtest         # Quick test your workflow
```

Now you're ready for rapid development.

---

## Terminal Navigation

### Directory Movement

| Command | Action |
|---------|--------|
| `cd -` | Return to previous directory |
| `cd ~` | Go to home directory |
| `cd ../..` | Go up two levels |
| `pushd/popd` | Stack-based navigation |

### File Operations

| Command | Action |
|---------|--------|
| `ls -la` | List all files with details |
| `tree -L 2` | Show directory tree (2 levels) |
| `cat file` | Display file contents |
| `less file` | Paginated file viewing |
| `head -n 20` | First 20 lines |
| `tail -f` | Follow file changes (logs) |

## Git Essentials

### Daily Workflow

```bash
# Check status
git status

# Stage changes
git add -p              # Interactive staging
git add .               # Stage all

# Commit
git commit -m "feat: add workflow trigger"

# Push
git push origin main
```

### Branching

```bash
# Create and switch
git checkout -b feature/new-workflow

# Switch branches
git checkout main

# Merge
git merge feature/new-workflow

# Delete branch
git branch -d feature/new-workflow
```

### Quick Fixes

```bash
# Undo last commit (keep changes)
git reset --soft HEAD~1

# Discard all local changes
git checkout -- .

# Stash changes
git stash
git stash pop
```

## WORKWAY CLI Quick Reference

### Development Cycle

```bash
# Start development
workway dev

# In another terminal, test
curl localhost:8787/execute -d '{}'

# Deploy when ready
workway deploy

# Monitor production
workway logs --tail
```

### Debugging

```bash
# Check workflow status
workway status

# View recent executions
workway executions --limit 10

# Get execution details
workway execution <id>
```

## Wrangler Commands (Cloudflare Workers)

WORKWAY workflows run on Cloudflare Workers. These wrangler commands are essential for debugging:

### Live Debugging

```bash
# Tail worker logs in real-time
wrangler tail

# Filter by status (errors only)
wrangler tail --status error

# Output as JSON for parsing
wrangler tail --format json

# Filter by specific method
wrangler tail --method POST
```

### Local Development

```bash
# Start local dev server
wrangler dev

# Start with specific port
wrangler dev --port 8787

# Test with local bindings
wrangler dev --local
```

### Secrets & Environment

```bash
# Set a secret
wrangler secret put API_KEY

# List all secrets
wrangler secret list

# Delete a secret
wrangler secret delete API_KEY
```

### D1 Database (if using)

```bash
# Execute SQL query
wrangler d1 execute DB_NAME --command "SELECT * FROM users"

# Run migrations
wrangler d1 migrations apply DB_NAME

# Export database
wrangler d1 export DB_NAME --output backup.sql
```

## Workflow Testing Commands

### Manual Trigger Testing

```bash
# Trigger workflow locally
curl http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{"trigger": {"type": "manual"}}'

# Trigger with config
curl http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{
    "trigger": {"type": "manual"},
    "inputs": {"notionPageId": "abc123"}
  }'

# Simulate webhook trigger
curl http://localhost:8787/execute \
  -H "Content-Type: application/json" \
  -d '{
    "trigger": {
      "type": "webhook",
      "payload": {"event": "meeting.ended", "id": "123"}
    }
  }'
```

### Testing with jq (JSON Processing)

```bash
# Pretty print workflow response
curl -s localhost:8787/execute -d '{}' | jq .

# Extract specific field
curl -s localhost:8787/execute -d '{}' | jq '.result.pageUrl'

# Filter errors only
curl -s localhost:8787/execute -d '{}' | jq 'select(.error)'
```

## Claude Code Commands

### Session Commands

| Command | Action |
|---------|--------|
| `/help` | Show all commands |
| `/clear` | Clear conversation |
| `/compact` | Summarize and continue |
| `/cost` | Show token usage |
| `/init` | Initialize project context |
| `/resume` | Resume previous session |

### CLI Options

```bash
# Start new session
claude

# Continue previous session
claude -c

# One-shot question
claude "What does this error mean?"

# Resume specific session
claude --resume

# Use different model
claude --model opus
```

### File Operations

```
> Read src/index.ts
> Edit the execute function to add logging
> Create a new file at src/utils.ts
```

### Project Understanding

```
> What patterns are used in this codebase?
> Find all workflow definitions
> How does error handling work here?
```

### WORKWAY-Specific Prompts

For workflow development, these prompts are particularly useful:

```
> Show me the defineWorkflow() pattern in this codebase
> What integrations are available in packages/integrations?
> Help me create a workflow that sends Slack notifications
> Analyze my workflow for Zuhandenheit (does the tool recede?)
> What's wrong with this error: [paste error]
```

### WORKWAY Skills (Slash Commands)

When working in the WORKWAY codebase, these skills are available:

| Skill | Purpose | Example Use |
|-------|---------|-------------|
| `/heidegger-design` | Apply Zuhandenheit principles | Architecture decisions |
| `/workway-integrations` | Build integrations with BaseAPIClient | New API integrations |

Example usage:

```
> /heidegger-design
# Then describe your design decision for philosophical analysis

> /workway-integrations
# Then describe the API you want to integrate
```

## MCP Learning Commands

If you've configured the WORKWAY Learn MCP server, these commands are available:

| Command | Description |
|---------|-------------|
| `learn_status` | Check your learning progress |
| `learn_lesson` | Fetch lesson content |
| `learn_complete` | Mark lesson as complete |
| `learn_praxis` | Validate workflow code |
| `learn_coach` | Get pattern guidance |

Example prompts to Claude Code:

```
> Show me my learning progress
> Get the lesson on triggers
> Mark the essential-commands lesson as complete
> Analyze my workflow against WORKWAY patterns
```

## Shell Shortcuts (Bash/Zsh)

### Line Editing

| Shortcut | Action |
|----------|--------|
| `Ctrl+A` | Beginning of line |
| `Ctrl+E` | End of line |
| `Ctrl+U` | Delete to beginning |
| `Ctrl+K` | Delete to end |
| `Ctrl+W` | Delete word backward |
| `Alt+B` | Move word backward |
| `Alt+F` | Move word forward |

### History

| Shortcut | Action |
|----------|--------|
| `Ctrl+R` | Reverse search history |
| `!!` | Repeat last command |
| `!$` | Last argument of previous command |
| `history` | Show command history |

### Process Control

| Shortcut | Action |
|----------|--------|
| `Ctrl+C` | Cancel current command |
| `Ctrl+Z` | Suspend (then `bg` or `fg`) |
| `Ctrl+D` | Exit shell / EOF |

## Useful Aliases

Add to `~/.zshrc` or `~/.bashrc`:

```bash
# WORKWAY Development
alias wd="workway dev"
alias wdp="workway deploy"
alias wl="workway logs --tail"
alias wt="workway test"
alias ws="workway status"
alias we="workway executions --limit 10"

# Wrangler (Cloudflare Workers)
alias wrd="wrangler dev"
alias wrt="wrangler tail"
alias wrte="wrangler tail --status error"
alias wrs="wrangler secret list"

# Git
alias gs="git status"
alias ga="git add -p"
alias gc="git commit"
alias gp="git push"
alias gl="git log --oneline -10"
alias gd="git diff"
alias gco="git checkout"

# Navigation
alias ..="cd .."
alias ...="cd ../.."
alias ll="ls -la"
alias work="cd ~/path/to/workway"  # Customize this

# Claude Code
alias cc="claude"
alias ccc="claude -c"
alias cco="claude --model opus"

# Workflow Testing
alias wcurl="curl -s -H 'Content-Type: application/json'"
alias wtest="curl -s localhost:8787/execute -d '{}' | jq ."
```

Reload:
```bash
source ~/.zshrc
```

### Workflow-Specific Functions

Add these shell functions for common workflow tasks:

```bash
# Quick workflow test with inputs
wrun() {
  curl -s localhost:8787/execute \
    -H "Content-Type: application/json" \
    -d "{\"trigger\":{\"type\":\"manual\"},\"inputs\":$1}" | jq .
}

# Watch workflow logs with filtering
wwl() {
  wrangler tail --format json | jq "select(.level == \"${1:-error}\")"
}

# Deploy and tail logs immediately
wdeploy() {
  workway deploy && wrangler tail
}
```

Usage:
```bash
wrun '{"pageId":"abc123"}'    # Test with inputs
wwl error                      # Watch error logs
wwl info                       # Watch info logs
wdeploy                        # Deploy and monitor
```

## Cheatsheet: Development Flow

```bash
# 1. Start project
cd my-workflow
workway dev           # Terminal 1

# 2. Develop with Claude
claude                # Terminal 2
> "Add error handling to the execute function"

# 3. Test locally
curl localhost:8787/execute -d '{"test": true}'

# 4. Commit changes
git add -p
git commit -m "feat: add error handling"

# 5. Deploy
workway deploy

# 6. Monitor
workway logs --tail
```

## Complete Workflow Shortcuts Reference

### Development Cycle (Most Common)

| Alias | Command | Purpose |
|-------|---------|---------|
| `wd` | `workway dev` | Start dev server |
| `wt` | `workway test` | Run tests |
| `wdp` | `workway deploy` | Deploy to production |
| `wrt` | `wrangler tail` | Watch live logs |

### Claude Code

| Alias | Command | Purpose |
|-------|---------|---------|
| `cc` | `claude` | New session |
| `ccc` | `claude -c` | Continue previous |
| `cco` | `claude --model opus` | Use Opus model |

### Git (Quick Commits)

| Alias | Command | Purpose |
|-------|---------|---------|
| `gs` | `git status` | Check changes |
| `ga` | `git add -p` | Stage interactively |
| `gc` | `git commit` | Commit |
| `gp` | `git push` | Push to remote |

### Testing & Debugging

| Function | Usage | Purpose |
|----------|-------|---------|
| `wtest` | `wtest` | Quick local test |
| `wrun` | `wrun '{"key":"value"}'` | Test with inputs |
| `wwl` | `wwl error` | Filter logs |
| `wrte` | `wrte` | Watch errors only |

### Keyboard Shortcuts (Shell)

| Shortcut | Action |
|----------|--------|
| `Ctrl+R` | Search command history |
| `Ctrl+A` | Beginning of line |
| `Ctrl+E` | End of line |
| `Ctrl+K` | Delete to end |
| `Ctrl+W` | Delete word backward |
| `!!` | Repeat last command |
| `!$` | Last argument of previous |

## Praxis

Configure your development environment with workflow-specific shortcuts:

> **Praxis**: Ask Claude Code: "Help me add WORKWAY development aliases and functions to my shell config"

### Step 1: Open Your Shell Config

```bash
# For zsh (macOS default)
nano ~/.zshrc

# For bash
nano ~/.bashrc
```

### Step 2: Add WORKWAY Aliases

Copy the complete alias block from the "Useful Aliases" section above.

### Step 3: Add Shell Functions

Copy the shell functions (`wrun`, `wwl`, `wdeploy`) from the "Workflow-Specific Functions" section.

### Step 4: Reload and Test

```bash
source ~/.zshrc

# Test aliases
wd --help        # Should show workway dev help
cc --version     # Should show Claude version
wrt --help       # Should show wrangler tail help

# Test in a workflow project
cd your-workflow
wtest            # Should test workflow locally
```

### Step 5: Practice the Development Cycle

Run this sequence to internalize the workflow:

```bash
wd               # Start dev server (Terminal 1)
cc               # Start Claude Code (Terminal 2)
wrt              # Watch logs (Terminal 3)
wtest            # Test your workflow
```

### Step 6: Practice Keyboard Shortcuts

Open a terminal and practice until these are automatic:

1. `Ctrl+R` → type "workway" → find previous command
2. `Ctrl+A` → go to start → `Ctrl+K` → clear line
3. `!!` → repeat last command
4. `!$` → use last argument in new command

The shortcuts should feel invisible within a week of daily use.

## Reflection

- Which commands do you use most frequently?
- What aliases would save you the most keystrokes?
- How can you make your terminal environment more invisible to your workflow?
- Which keyboard shortcuts felt awkward at first but now feel natural?
