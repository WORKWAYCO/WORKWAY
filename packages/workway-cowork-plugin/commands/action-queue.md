---
name: action-queue
description: Show prioritized items needing attention from WORKWAY Command Center
aliases: ["/queue", "/priorities", "/todo"]
---

# Action Queue Command

Retrieve and display all open items from the WORKWAY Command Center, sorted by priority score.

## Usage

Simply type `/action-queue` or ask naturally:
- "What needs my attention today?"
- "Show me my priorities"
- "What's blocking my projects?"

## Behavior

1. Call `workway_get_action_queue` with status="open"
2. Format results in a clear, scannable table
3. Color-code by score:
   - **90+** (Critical) - Red, requires immediate action
   - **70-89** (High) - Yellow, address today
   - **50-69** (Medium) - Normal priority
   - **<50** (Low) - Can be scheduled

## Output Format

Present the results as:

```
## Action Queue - [DATE]
[COUNT] items need attention · [CRITICAL] critical · [HIGH] high priority

| Score | Source | Item | Age | Impact |
|-------|--------|------|-----|--------|
| 🔴 98 | RFI | Structural RFI blocking pour | 2d | Schedule |
| 🔴 95 | Change | $47K CO needs signature | 3d | Cost |
| 🟡 85 | Safety | Fall protection gap | 1d | Safety |
| 🟡 78 | Submit | HVAC equipment pending | 14d | Schedule |
| 🟢 65 | Budget | Electrical over committed | - | Cost |
```

## Follow-up Actions

After presenting the queue, offer:
- "Would you like details on any specific item?"
- "Should I draft responses for the overdue RFIs?"
- "Want me to create an escalation plan for the critical items?"

## Filters

Support filtering by project, source type, or minimum score:
- `/action-queue project:Tower-B`
- `/action-queue source:rfi`
- `/action-queue min-score:70`
