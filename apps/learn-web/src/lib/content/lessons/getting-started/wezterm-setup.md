# WezTerm Installation & Configuration

## Learning Objectives

By the end of this lesson, you will be able to:

- Install WezTerm on macOS, Linux, or Windows
- Configure WezTerm using a Lua configuration file (`wezterm.lua`)
- Set up the WORKWAY monochrome color scheme with proper fonts
- Use WezTerm's multiplexing features for split panes and tabs
- Create custom keybindings for rapid Claude Code and WORKWAY development

---

The terminal is where workflows come to life. WezTerm provides a modern, GPU-accelerated terminal that disappears into your work.

## Why WezTerm?

| Feature | Benefit |
|---------|---------|
| GPU Rendering | Smooth scrolling, no lag |
| Lua Config | Programmable, version-controlled |
| Multiplexing | Built-in tabs/panes, no tmux needed |
| Cross-platform | Same config on macOS, Linux, Windows |

## Quick Start: 5-Minute Setup

Follow these steps to get WezTerm running with WORKWAY configuration:

### Step 1: Install WezTerm

**macOS:**
```bash
brew install --cask wezterm
```

**Linux:**
```bash
curl -fsSL https://apt.fury.io/wez/gpg.key | sudo gpg --yes --dearmor -o /usr/share/keyrings/wezterm-fury.gpg
echo 'deb [signed-by=/usr/share/keyrings/wezterm-fury.gpg] https://apt.fury.io/wez/ * *' | sudo tee /etc/apt/sources.list.d/wezterm.list
sudo apt update && sudo apt install wezterm
```

**Windows:**
```powershell
winget install wez.wezterm
```

### Step 2: Create Configuration Directory

```bash
mkdir -p ~/.config/wezterm
```

### Step 3: Create Configuration File

```bash
touch ~/.config/wezterm/wezterm.lua
```

### Step 4: Add WORKWAY Configuration

Copy the complete configuration from the "Minimal Config" and "WORKWAY-Specific Keybindings" sections below into your `wezterm.lua` file.

### Step 5: Verify Installation

```bash
wezterm --version
```

Launch WezTerm and test:
1. `Cmd+Shift+C` (macOS) or `Ctrl+Shift+Alt+C` (Linux/Windows) - Should open Claude Code
2. `Cmd+D` - Should split the terminal horizontally
3. `Cmd+H/J/K/L` - Should navigate between panes

---

## Installation

### macOS (Homebrew)

```bash
brew install --cask wezterm
```

### Linux (apt)

```bash
curl -fsSL https://apt.fury.io/wez/gpg.key | sudo gpg --yes --dearmor -o /usr/share/keyrings/wezterm-fury.gpg
echo 'deb [signed-by=/usr/share/keyrings/wezterm-fury.gpg] https://apt.fury.io/wez/ * *' | sudo tee /etc/apt/sources.list.d/wezterm.list
sudo apt update
sudo apt install wezterm
```

### Windows (winget)

```powershell
winget install wez.wezterm
```

## Configuration

Create your config file:

```bash
mkdir -p ~/.config/wezterm
touch ~/.config/wezterm/wezterm.lua
```

### Minimal Config

```lua
local wezterm = require 'wezterm'
local config = wezterm.config_builder()

-- Font
config.font = wezterm.font('JetBrains Mono')
config.font_size = 14.0

-- Colors (WORKWAY monochrome)
config.colors = {
  foreground = '#ffffff',
  background = '#000000',
  cursor_bg = '#ffffff',
  cursor_fg = '#000000',
  selection_bg = '#ffffff',
  selection_fg = '#000000',
}

-- Window
config.window_decorations = 'RESIZE'
config.window_padding = {
  left = 20,
  right = 20,
  top = 20,
  bottom = 20,
}

-- Tab bar
config.hide_tab_bar_if_only_one_tab = true
config.tab_bar_at_bottom = true

return config
```

## Essential Keybindings

| Action | macOS | Linux/Windows |
|--------|-------|---------------|
| New Tab | `Cmd+T` | `Ctrl+Shift+T` |
| Close Tab | `Cmd+W` | `Ctrl+Shift+W` |
| Split Horizontal | `Cmd+D` | `Ctrl+Shift+D` |
| Split Vertical | `Cmd+Shift+D` | `Ctrl+Shift+E` |
| Navigate Panes | `Cmd+[/]` | `Ctrl+Shift+[/]` |
| Search | `Cmd+F` | `Ctrl+Shift+F` |

## WORKWAY-Specific Keybindings

Add these custom keybindings to your `wezterm.lua` for workflow development:

```lua
local wezterm = require 'wezterm'
local act = wezterm.action

-- Add to your config
config.keys = {
  -- Quick Claude Code launch (Cmd+Shift+C)
  {
    key = 'c',
    mods = 'CMD|SHIFT',
    action = act.SpawnCommandInNewTab {
      args = { 'claude' },
    },
  },

  -- Continue previous Claude Code session (Cmd+Shift+R)
  {
    key = 'r',
    mods = 'CMD|SHIFT',
    action = act.SpawnCommandInNewTab {
      args = { 'claude', '-c' },
    },
  },

  -- Quick WORKWAY dev server (Cmd+Shift+W)
  {
    key = 'w',
    mods = 'CMD|SHIFT',
    action = act.SpawnCommandInNewTab {
      args = { 'pnpm', 'dev' },
    },
  },

  -- Quick WORKWAY test runner (Cmd+Shift+T)
  {
    key = 't',
    mods = 'CMD|SHIFT',
    action = act.SpawnCommandInNewTab {
      args = { 'pnpm', 'test' },
    },
  },

  -- Quick workflow logs (Cmd+Shift+L)
  {
    key = 'l',
    mods = 'CMD|SHIFT',
    action = act.SpawnCommandInNewTab {
      args = { 'wrangler', 'tail' },
    },
  },

  -- Split right for Claude Code session
  {
    key = 'd',
    mods = 'CMD',
    action = act.SplitHorizontal {
      domain = 'CurrentPaneDomain',
    },
  },

  -- Split down for logs/output
  {
    key = 'd',
    mods = 'CMD|SHIFT',
    action = act.SplitVertical {
      domain = 'CurrentPaneDomain',
    },
  },

  -- Quick pane switching with Cmd+H/J/K/L (vim-style)
  { key = 'h', mods = 'CMD', action = act.ActivatePaneDirection 'Left' },
  { key = 'l', mods = 'CMD', action = act.ActivatePaneDirection 'Right' },
  { key = 'k', mods = 'CMD', action = act.ActivatePaneDirection 'Up' },
  { key = 'j', mods = 'CMD', action = act.ActivatePaneDirection 'Down' },

  -- Resize panes (Cmd+Alt+H/J/K/L)
  { key = 'h', mods = 'CMD|ALT', action = act.AdjustPaneSize { 'Left', 5 } },
  { key = 'l', mods = 'CMD|ALT', action = act.AdjustPaneSize { 'Right', 5 } },
  { key = 'k', mods = 'CMD|ALT', action = act.AdjustPaneSize { 'Up', 5 } },
  { key = 'j', mods = 'CMD|ALT', action = act.AdjustPaneSize { 'Down', 5 } },

  -- Quick zoom current pane (Cmd+Z)
  { key = 'z', mods = 'CMD', action = act.TogglePaneZoomState },
}
```

### Keybinding Quick Reference

| Action | macOS | Purpose |
|--------|-------|---------|
| New Claude Code | `Cmd+Shift+C` | Fresh AI session |
| Resume Claude Code | `Cmd+Shift+R` | Continue previous session |
| Dev Server | `Cmd+Shift+W` | Start pnpm dev |
| Run Tests | `Cmd+Shift+T` | Run pnpm test |
| Tail Logs | `Cmd+Shift+L` | Watch worker logs |
| Split Right | `Cmd+D` | Add pane for Claude Code |
| Split Down | `Cmd+Shift+D` | Add pane for output |
| Navigate Panes | `Cmd+H/J/K/L` | Vim-style movement |
| Resize Panes | `Cmd+Alt+H/J/K/L` | Adjust pane size |
| Zoom Pane | `Cmd+Z` | Toggle fullscreen pane |

### Linux/Windows Variant

Replace `CMD` with `CTRL|SHIFT` for Linux/Windows:

```lua
config.keys = {
  { key = 'c', mods = 'CTRL|SHIFT|ALT', action = act.SpawnCommandInNewTab { args = { 'claude' } } },
  { key = 'r', mods = 'CTRL|SHIFT|ALT', action = act.SpawnCommandInNewTab { args = { 'claude', '-c' } } },
  { key = 'w', mods = 'CTRL|SHIFT|ALT', action = act.SpawnCommandInNewTab { args = { 'pnpm', 'dev' } } },
  { key = 't', mods = 'CTRL|SHIFT|ALT', action = act.SpawnCommandInNewTab { args = { 'pnpm', 'test' } } },
  { key = 'l', mods = 'CTRL|SHIFT|ALT', action = act.SpawnCommandInNewTab { args = { 'wrangler', 'tail' } } },
  { key = 'h', mods = 'CTRL|SHIFT', action = act.ActivatePaneDirection 'Left' },
  { key = 'l', mods = 'CTRL|SHIFT', action = act.ActivatePaneDirection 'Right' },
  { key = 'k', mods = 'CTRL|SHIFT', action = act.ActivatePaneDirection 'Up' },
  { key = 'j', mods = 'CTRL|SHIFT', action = act.ActivatePaneDirection 'Down' },
  { key = 'z', mods = 'CTRL|SHIFT', action = act.TogglePaneZoomState },
}
```

## Claude Code Integration Tips

WezTerm and Claude Code work together naturally. Here's how to optimize the experience.

### Recommended Layout: Split Pane Workflow

The most productive setup for WORKWAY development:

```
┌─────────────────────────┬─────────────────────────┐
│                         │                         │
│   Claude Code Session   │   Editor / Files        │
│   (interactive AI)      │   (code changes)        │
│                         │                         │
├─────────────────────────┴─────────────────────────┤
│                                                   │
│   pnpm dev / wrangler tail (bottom pane)          │
│                                                   │
└───────────────────────────────────────────────────┘
```

Create this layout with:
1. `Cmd+D` (split right) - Open Claude Code
2. `Cmd+Shift+D` (split down) - Start dev server or logs

### Claude Code Session Management

Essential session commands to know:

| Command | What It Does |
|---------|--------------|
| `claude` | Start fresh session |
| `claude -c` | Continue previous session (preserves context) |
| `/compact` | Summarize long conversation, reduce tokens |
| `/clear` | Start over within same session |
| `/cost` | Check token usage |

**Tip**: Use `Cmd+Shift+R` (the keybinding we set up) to resume where you left off after closing WezTerm.

### Scrollback for Claude Code Output

Claude Code can produce long outputs. Increase scrollback:

```lua
config.scrollback_lines = 10000
```

### Search Through Claude Code Output

When Claude Code generates long output, use WezTerm's search:

1. `Cmd+F` to open search
2. Type your query (regex supported)
3. `Enter` / `Shift+Enter` to navigate matches
4. `Escape` to close

This is invaluable for finding specific code snippets in long responses.

### Copy Mode for Precise Selection

Enter copy mode for keyboard-driven selection:

1. `Cmd+Shift+X` to enter copy mode
2. Use vim keys (`h/j/k/l`) to navigate
3. `v` for character selection, `V` for line selection
4. `y` to copy, `Escape` to exit

Add to your config:

```lua
config.keys = {
  -- ... existing keys ...
  { key = 'x', mods = 'CMD|SHIFT', action = act.ActivateCopyMode },
}
```

### Mouse Selection in Claude Code

Enable mouse selection for copying code snippets:

```lua
config.mouse_bindings = {
  -- Right-click paste
  {
    event = { Down = { streak = 1, button = 'Right' } },
    mods = 'NONE',
    action = act.PasteFrom 'Clipboard',
  },
  -- Triple-click to select line
  {
    event = { Down = { streak = 3, button = 'Left' } },
    action = act.SelectTextAtMouseCursor 'Line',
  },
}
```

### Quick Command Palette

Access WezTerm's command palette for less-frequent actions:

| Action | macOS | Linux/Windows |
|--------|-------|---------------|
| Command Palette | `Cmd+Shift+P` | `Ctrl+Shift+P` |

Useful for: font size adjustments, color scheme switching, pane management.

### Terminal Hyperlinks

WezTerm auto-detects URLs and file paths. `Cmd+Click` (macOS) or `Ctrl+Click` (Linux/Windows) to open:

- URLs in Claude Code output - Opens browser
- File paths - Opens in default editor
- Error stack traces - Jump to source

Enable with:

```lua
config.hyperlink_rules = wezterm.default_hyperlink_rules()
```

### Working with Claude Code Slash Commands

Claude Code supports slash commands for common operations. In your WezTerm session:

```
> /help              # See all available commands
> /compact           # Reduce context, continue working
> /clear             # Start fresh
```

When building WORKWAY workflows, useful prompts:

```
> Show me examples of defineWorkflow() in this codebase
> What integrations are available?
> Help me create a workflow that...
```

### Development Workflow: Build → Test → Debug

A typical WORKWAY development cycle in WezTerm:

1. **Left pane**: Claude Code session
   ```
   > Help me implement a workflow that sends Slack notifications
   ```

2. **Right pane**: Your editor (if needed for manual edits)

3. **Bottom pane**: Dev server watching for changes
   ```bash
   pnpm dev
   ```

When tests fail or errors occur:
- Copy error text from bottom pane
- Paste to Claude Code pane
- Claude Code reads the error and helps fix it

The terminal stays out of your way. You focus on outcomes.

## Verify Installation

```bash
wezterm --version
```

You should see output like:
```
wezterm 20240203-110809-5046fc22
```

## Praxis

Install and configure WezTerm with the WORKWAY monochrome theme and keybindings:

> **Praxis**: Ask Claude Code: "Help me install WezTerm and create a config file with monochrome theme and WORKWAY keybindings"

After installation, create your configuration:

```bash
mkdir -p ~/.config/wezterm
```

Copy the minimal config from this lesson into `~/.config/wezterm/wezterm.lua`, including:
- The monochrome color scheme
- WORKWAY-specific keybindings
- Mouse bindings for Claude Code

Launch WezTerm and verify:

1. **Visual**: Pure black background (#000000), clean font rendering
2. **Keybindings**: Test `Cmd+Shift+C` to launch Claude Code
3. **Pane navigation**: Split with `Cmd+D`, navigate with `Cmd+H/L`
4. **Session resume**: Close Claude Code, then `Cmd+Shift+R` to continue

Practice the development workflow:
1. `Cmd+Shift+C` - Start Claude Code
2. `Cmd+D` - Split right for editor
3. `Cmd+Shift+D` - Split down for dev server
4. `Cmd+H/J/K/L` - Navigate between panes
5. `Cmd+Z` - Zoom a pane when you need focus

The keybindings should feel invisible within a few days of practice.

## Reflection

- How does a well-configured terminal recede during development?
- What friction points do you notice in your current terminal setup?
- Which keybindings will you customize for your workflow?
