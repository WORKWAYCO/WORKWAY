# Neomutt for Email Workflow

## Learning Objectives

By the end of this lesson, you will be able to:

- Install Neomutt on macOS or Linux
- Configure Neomutt with Gmail IMAP and SMTP settings
- Generate and use a Gmail App Password for secure authentication
- Navigate emails using Neomutt's vim-style keyboard shortcuts (`j/k`, `/`, `r`, `m`)
- Understand how terminal email enables workflow-triggered automations

---

Email is a workflow trigger. Neomutt brings email into your terminal, where it can integrate with your development flow.

## Why Terminal Email?

| Traditional Email | Terminal Email |
|-------------------|----------------|
| Context switch to browser | Stay in terminal |
| Mouse-driven | Keyboard-driven |
| Notifications interrupt | Check when ready |
| Isolated from dev tools | Pipeable, scriptable |

## Installation

### macOS

```bash
brew install neomutt
```

### Linux (apt)

```bash
sudo apt install neomutt
```

## Gmail Configuration

### Enable IMAP

1. Go to Gmail Settings
2. Click "See all settings"
3. Go to "Forwarding and POP/IMAP"
4. Enable IMAP

### Create App Password

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Factor Authentication if not already
3. Go to App Passwords
4. Generate a new password for "Mail"
5. Save this password securely

## Neomutt Config

Create the config directory:

```bash
mkdir -p ~/.config/neomutt
touch ~/.config/neomutt/neomuttrc
```

### Basic Configuration

```bash
# ~/.config/neomutt/neomuttrc

# Identity
set realname = "Your Name"
set from = "your.email@gmail.com"

# Gmail IMAP
set imap_user = "your.email@gmail.com"
set imap_pass = "your-app-password"
set folder = "imaps://imap.gmail.com:993"
set spoolfile = "+INBOX"
set postponed = "+[Gmail]/Drafts"
set trash = "+[Gmail]/Trash"
set record = "+[Gmail]/Sent Mail"

# Gmail SMTP
set smtp_url = "smtps://your.email@gmail.com@smtp.gmail.com:465"
set smtp_pass = "your-app-password"

# Cache for speed
set header_cache = "~/.cache/neomutt/headers"
set message_cachedir = "~/.cache/neomutt/bodies"

# Security
set ssl_force_tls = yes
set ssl_starttls = yes

# Appearance (monochrome)
color normal white black
color indicator black white
color status white black
color tree white black
color header white black "^(From|Subject|Date):"

# Vim-like keybindings
bind index j next-entry
bind index k previous-entry
bind index g first-entry
bind index G last-entry
bind pager j next-line
bind pager k previous-line
```

### Create Cache Directory

```bash
mkdir -p ~/.cache/neomutt
```

## Essential Commands

| Key | Action |
|-----|--------|
| `j/k` | Move down/up |
| `Enter` | Open message |
| `r` | Reply |
| `g` | Group reply |
| `m` | Compose new |
| `d` | Delete |
| `s` | Save to folder |
| `q` | Quit |
| `/` | Search |
| `$` | Sync mailbox |

## Launch Neomutt

```bash
neomutt
```

First sync may take a few minutes depending on mailbox size.

## Workflow Integration

Neomutt enables email-driven workflows:

```bash
# Pipe email to a script
| workflow-trigger

# Search for workflow-relevant emails
/~s "meeting notes"

# Tag emails for batch processing
t (tag) then ; (apply action to tagged)
```

## Praxis

Install Neomutt and configure it for your Gmail account:

> **Praxis**: Ask Claude Code: "Help me install Neomutt and configure it for Gmail with an app password"

Follow these steps:
1. Install Neomutt via your package manager
2. Enable IMAP in Gmail settings
3. Generate a Gmail App Password
4. Create the config file at `~/.config/neomutt/neomuttrc`

Launch Neomutt and practice:
- Navigate with `j/k`
- Open a message with `Enter`
- Search with `/`
- Return to index with `q`

Note: This is an optional setup. If you prefer your current email client, that's fine—the goal is understanding how terminal tools can integrate into workflows.

## Reflection

- How does managing email in your terminal change your relationship with email?
- What email patterns could trigger useful automations?
