# Essential Commands & Shortcuts

## Learning Objectives

By the end of this lesson, you will be able to:

- Navigate directories efficiently using `cd`, `pushd/popd`, and shell shortcuts
- Use essential Git commands for version control: `status`, `add -p`, `commit`, `stash`
- Configure shell aliases for faster WORKWAY development workflows
- Use keyboard shortcuts for line editing (`Ctrl+A/E/U/K`) and history search (`Ctrl+R`)
- Execute the complete development flow: `workway dev` → test → commit → deploy

---

Master these commands to move efficiently through your workflow development cycle. The goal: muscle memory that lets the tools recede.

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

# Git shortcuts
alias gs="git status"
alias ga="git add -p"
alias gc="git commit"
alias gp="git push"

# Claude Code
alias cc="claude"
alias ccc="claude -c"
```

### Step 3: Reload Your Shell

```bash
source ~/.zshrc  # or ~/.bashrc
```

### Step 4: Test the Aliases

```bash
wd --help    # Should show workway dev help
cc --version # Should show claude version
gs           # Should show git status
```

### Step 5: Practice the Development Flow

Run this sequence in your WORKWAY project:

```bash
wd            # Start dev server (Terminal 1)
cc            # Start Claude Code (Terminal 2)
wl            # Tail logs (Terminal 3)
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

## Claude Code Commands

### Session Commands

| Command | Action |
|---------|--------|
| `/help` | Show all commands |
| `/clear` | Clear conversation |
| `/compact` | Summarize and continue |
| `/cost` | Show token usage |

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
# WORKWAY
alias wd="workway dev"
alias wdp="workway deploy"
alias wl="workway logs --tail"

# Git
alias gs="git status"
alias ga="git add -p"
alias gc="git commit"
alias gp="git push"
alias gl="git log --oneline -10"

# Navigation
alias ..="cd .."
alias ...="cd ../.."
alias ll="ls -la"

# Claude
alias cc="claude"
alias ccc="claude -c"
```

Reload:
```bash
source ~/.zshrc
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

## Praxis

Set up your development environment with the essential aliases:

> **Praxis**: Ask Claude Code: "Help me add WORKWAY development aliases to my shell config"

Add these aliases to your `~/.zshrc` or `~/.bashrc`:

```bash
alias wd="workway dev"
alias wdp="workway deploy"
alias wl="workway logs --tail"
alias gs="git status"
alias cc="claude"
```

Then reload and test:

```bash
source ~/.zshrc
wd --help
```

Practice the keyboard shortcuts from this lesson until they become muscle memory.

## Reflection

- Which commands do you use most frequently?
- What aliases would save you the most keystrokes?
- How can you make your terminal environment more invisible to your workflow?
