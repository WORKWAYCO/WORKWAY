# WezTerm Installation & Configuration

The terminal is where workflows come to life. WezTerm provides a modern, GPU-accelerated terminal that disappears into your work.

## Why WezTerm?

| Feature | Benefit |
|---------|---------|
| GPU Rendering | Smooth scrolling, no lag |
| Lua Config | Programmable, version-controlled |
| Multiplexing | Built-in tabs/panes, no tmux needed |
| Cross-platform | Same config on macOS, Linux, Windows |

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

## Verify Installation

```bash
wezterm --version
```

You should see output like:
```
wezterm 20240203-110809-5046fc22
```

## Praxis

Install and configure WezTerm with the WORKWAY monochrome theme:

> **Praxis**: Ask Claude Code: "Help me install WezTerm and create a config file with a monochrome theme"

After installation, create your configuration:

```bash
mkdir -p ~/.config/wezterm
```

Copy the minimal config from this lesson into `~/.config/wezterm/wezterm.lua`, then launch WezTerm and verify:

- The font renders cleanly
- The pure black background (#000000) is applied
- Tab switching works with keyboard shortcuts

Practice splitting panes and navigating between them until the actions feel natural.

## Reflection

- How does a well-configured terminal recede during development?
- What friction points do you notice in your current terminal setup?
