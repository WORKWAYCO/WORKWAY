# Neomutt for Email Workflow

## Learning Objectives

By the end of this lesson, you will be able to:

- Install Neomutt on macOS or Linux
- Configure Neomutt with Gmail IMAP and SMTP settings
- Generate and use a Gmail App Password for secure authentication
- Navigate emails using Neomutt's vim-style keyboard shortcuts (`j/k`, `/`, `r`, `m`)
- Understand how terminal email enables workflow-triggered automations
- Connect email patterns to WORKWAY workflow triggers

---

Email is a workflow trigger. Neomutt brings email into your terminal, where it can integrate with your development flow and—more importantly—help you recognize the patterns that become automated workflows.

## Use Claude Code

You can complete this entire lesson by asking Claude Code. Try these prompts:

```
> Install Neomutt on my Mac

> Create a Neomutt config for Gmail with IMAP and SMTP

> Help me generate a Gmail App Password for Neomutt

> Show me vim-style navigation in Neomutt (j/k, search, reply)

> Add a monochrome color scheme to my Neomutt config
```

Claude Code will generate the config, walk you through App Password setup, and explain each setting.

## Why Terminal Email?

| Traditional Email         | Terminal Email       |
| ------------------------- | -------------------- |
| Context switch to browser | Stay in terminal     |
| Mouse-driven              | Keyboard-driven      |
| Notifications interrupt   | Check when ready     |
| Isolated from dev tools   | Pipeable, scriptable |

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

| Key     | Action         |
| ------- | -------------- |
| `j/k`   | Move down/up   |
| `Enter` | Open message   |
| `r`     | Reply          |
| `g`     | Group reply    |
| `m`     | Compose new    |
| `d`     | Delete         |
| `s`     | Save to folder |
| `q`     | Quit           |
| `/`     | Search         |
| `$`     | Sync mailbox   |

## Launch Neomutt

```bash
neomutt
```

First sync may take a few minutes depending on mailbox size.

## Workflow Integration Patterns

Understanding email patterns in Neomutt helps you design WORKWAY workflows. Here's how terminal email concepts map to automation.

### Pattern 1: Label-Based Triggers

In Neomutt, you search and tag emails. In WORKWAY, labels become triggers:

```bash
# Neomutt: search for meeting notes
/~s "meeting notes"

# WORKWAY equivalent: Gmail API query
const emails = await gmail.listMessages({
  query: 'label:meeting-notes is:unread',
  maxResults: 50,
});
```

**Workflow pattern**: Create a Gmail label like "Log to Notion", then use it as your trigger. When you label an email, the workflow runs.

### Pattern 2: Email Parsing for Actions

In Neomutt, you read headers to decide what to do. In WORKWAY, you parse programmatically:

```bash
# Neomutt: check who sent the email
# (visible in index view)

# WORKWAY equivalent: extract headers
const headers = email.payload?.headers || [];
const from = headers.find(h => h.name === 'From')?.value;
const subject = headers.find(h => h.name === 'Subject')?.value;

// Route based on sender
if (from.includes('@client.com')) {
  await notion.createPage({ /* ... */ });
}
```

**Workflow pattern**: Different email sources can trigger different actions—client emails create CRM entries, internal emails create tasks.

### Pattern 3: Piping to Scripts

Neomutt's pipe command (`|`) connects email to any shell script. This is the conceptual foundation for WORKWAY's fetch-based integrations:

```bash
# Neomutt: pipe email to a script
| process-email.sh

# WORKWAY equivalent: direct API call in execute()
export default defineWorkflow({
  async execute({ integrations }) {
    const gmail = integrations.gmail;

    // Fetch emails (the "pipe in")
    const emails = await gmail.listMessages({ query: 'is:starred' });

    // Process (the "script")
    for (const email of emails) {
      const full = await gmail.getMessage(email.id);
      // Your processing logic here
    }
  }
});
```

**Workflow pattern**: Every email operation you do manually in Neomutt can become an automated workflow step.

### Pattern 4: Batch Operations with Tags

Neomutt's tagging (`t`) and batch operations (`;`) map directly to batch processing in workflows:

```bash
# Neomutt: tag messages, then save all to folder
t (on each message)
;s +archive

# WORKWAY equivalent: batch processing
const emails = await gmail.listMessages({ query: 'label:to-archive' });
for (const email of emails) {
  await processEmail(email);
  // Mark as processed (remove label)
  await gmail.modifyMessage(email.id, {
    removeLabelIds: ['to-archive'],
    addLabelIds: ['archived'],
  });
}
```

**Workflow pattern**: WORKWAY workflows process emails in batches, just like your manual tagging workflow.

### Pattern 5: The Outcome Test

Every email action you take manually is a candidate for automation. Apply the Outcome Test:

| Manual Action in Neomutt      | Outcome Statement (No Tech)        |
| ----------------------------- | ---------------------------------- |
| `/~s "meeting" ; s +meetings` | Meeting emails organize themselves |
| `r` (reply to client)         | Clients receive acknowledgment     |
| `\| extract-invoice.sh`       | Invoices become Notion entries     |
| `d` (delete newsletters)      | Newsletter noise disappears        |

The workflow opportunity: Which of these actions could run without you?

### Email as Workflow Trigger vs. Workflow Action

Email plays two roles in WORKWAY:

**Email as Trigger** (workflow starts from email):

```typescript
// Poll for new labeled emails
trigger: schedule({
  cron: '*/15 * * * *',  // Check every 15 minutes
}),

async execute({ integrations }) {
  const emails = await integrations.gmail.listMessages({
    query: 'label:process-me',
  });
  // Process each email...
}
```

**Email as Action** (workflow sends email):

```typescript
// Workflow sends email after other events
async execute({ trigger, integrations }) {
  // Meeting ended (trigger from Zoom)
  const transcript = trigger.data.transcript;

  // Email the summary
  await integrations.gmail.sendMessage({
    to: 'team@company.com',
    subject: 'Meeting Summary: ' + trigger.data.meetingTitle,
    body: transcript.summary,
  });
}
```

## Neomutt Commands for Workflow Thinking

When exploring email in Neomutt, think about automation patterns:

| Key  | Action          | Workflow Translation     |
| ---- | --------------- | ------------------------ |
| `/`  | Search          | Gmail API query filter   |
| `t`  | Tag             | Label assignment         |
| `;`  | Apply to tagged | Batch processing loop    |
| `\|` | Pipe            | Workflow execute()       |
| `c`  | Change folder   | Different label triggers |
| `$`  | Sync            | Poll-based trigger       |

## Praxis

Install Neomutt and configure it for your Gmail account:

> **Praxis**: Ask Claude Code: "Help me install Neomutt and configure it for Gmail with an app password"

### Part 1: Setup

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

### Part 2: Workflow Pattern Recognition

Once Neomutt is running, identify email patterns for automation:

1. **Search for recurring patterns**:

   ```
   /~s "invoice"      # Find all invoices
   /~s "meeting"      # Find meeting-related emails
   /~f @client.com    # Find emails from a specific domain
   ```

2. **Notice your actions**: What do you do with these emails?
   - Do you forward them?
   - Copy content elsewhere?
   - File them in folders?

3. **Write one outcome statement**: Pick a pattern you found and describe it without technology:
   - "Invoices from suppliers become accounting entries"
   - "Meeting confirmations appear in my calendar summary"
   - "Client questions get logged for follow-up"

This outcome statement is the seed for a WORKWAY workflow.

Note: This is an optional setup. If you prefer your current email client, that's fine—the goal is understanding how terminal tools connect to workflow thinking.

## Reflection

- How does managing email in your terminal change your relationship with email?
- What email patterns could trigger useful automations?
- Which of your repetitive email tasks could a workflow handle?
- What emails arrive that you wish would auto-process themselves?
