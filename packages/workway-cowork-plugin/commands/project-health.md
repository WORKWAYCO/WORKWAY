---
name: project-health
description: Get health metrics and status for a construction project
aliases: ["/health", "/status", "/metrics"]
---

# Project Health Command

Retrieve comprehensive health metrics for a construction project, including item counts, trends, and risk indicators.

## Usage

Type `/project-health [project-name]` or ask naturally:
- "How is the Tower B project doing?"
- "Give me a health check on my projects"
- "What's the status of our active projects?"

## Behavior

1. If no project specified, show summary of all active projects
2. Call `workway_get_project_health` for detailed metrics
3. Calculate trends (improving/stable/declining)
4. Highlight risk areas

## Metrics Included

### Item Counts
- Open RFIs (and average age)
- Pending submittals (and days overdue)
- Open change orders (and total value)
- Safety observations (open vs resolved)
- Daily log completeness

### Trend Indicators
- Items closed vs opened this week
- Average response time trend
- Schedule performance index
- Cost performance index

### Risk Indicators
- Critical items count (score 90+)
- Overdue items count
- Budget variance percentage
- Schedule variance percentage

## Output Format

```
## Project Health: [PROJECT NAME]

### Summary
Status: 🟡 Needs Attention
Items Needing Action: 23 (5 critical)
Trend: ↘️ Declining (up from 18 last week)

### By Category
| Category | Open | Critical | Avg Age | Trend |
|----------|------|----------|---------|-------|
| RFIs | 8 | 2 | 4.2d | ↗️ |
| Submittals | 12 | 1 | 8.5d | → |
| Change Orders | 3 | 2 | 6.0d | ↘️ |

### Financial Health
- Budget Variance: +8% over committed
- Contingency Remaining: $124,000 (62%)
- Pending Change Orders: $89,000

### Schedule Health
- Current Phase: Foundation
- Days Behind: 3
- Critical Path Risk: Medium

### Recommendations
1. Address the 2 critical RFIs blocking structural work
2. Follow up on $47K change order needing signature
3. Schedule MEP coordination meeting for next week
```

## Multi-Project View

When no project specified, show dashboard:

```
## Portfolio Health

| Project | Status | Critical | Action Items | Trend |
|---------|--------|----------|--------------|-------|
| Tower A | 🟢 | 0 | 12 | → |
| Tower B | 🟡 | 5 | 23 | ↘️ |
| Parking | 🟢 | 1 | 8 | ↗️ |

Total: 3 projects · 6 critical items · 43 total items
```
