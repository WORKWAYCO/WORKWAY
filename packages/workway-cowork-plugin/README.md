# WORKWAY Construction Plugin for Claude Cowork

AI-native construction workflow automation powered by WORKWAY.

## Installation

1. Download or clone this plugin directory
2. Place it in your Cowork plugins folder:
   - macOS: `~/Library/Application Support/Claude/plugins/workway-construction/`
3. Restart Claude Desktop

Or install via the Cowork plugin marketplace (coming soon).

## What's Included

### Skills

- **construction-pm.md** - General construction project management guidance
- **rfi-management.md** - RFI tracking, response drafting, and escalation
- **daily-reporting.md** - Daily log automation and progress documentation

### Commands

- **/action-queue** - Show prioritized items needing attention
- **/project-health** - Get project health metrics and status

### MCP Server

Pre-configured connection to WORKWAY Construction MCP at `https://mcp.workway.co/mcp`

## Setup

### 1. Get API Key

Sign up at [workway.co](https://workway.co) and get your API key from the dashboard.

### 2. Set Environment Variable

```bash
export WORKWAY_API_KEY=your_api_key_here
```

### 3. Connect Procore

In your WORKWAY dashboard, connect your Procore account to enable construction data access.

## Example Tasks

Once installed, try these with Cowork:

```
"Show me what needs attention today"
→ Uses /action-queue to show prioritized items

"Draft responses for all RFIs older than 5 days"
→ Uses rfi-management skill to find and respond to overdue RFIs

"Generate a weekly owner's report from this week's daily logs"
→ Uses daily-reporting skill to compile progress

"Create an escalation workflow for critical RFIs"
→ Uses construction-pm skill to build automation
```

## Requirements

- Claude Desktop (macOS) with Cowork enabled
- WORKWAY account (free tier works)
- Procore account (for construction data features)

## Support

- Documentation: https://workway.co/docs/mcp/cowork
- Issues: https://github.com/workway-co/cowork-plugin/issues
- Email: support@workway.co

## License

MIT License - see LICENSE file for details.
