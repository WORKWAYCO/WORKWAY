# @workwayco/mcp

[![npm version](https://img.shields.io/npm/v/@workwayco/mcp.svg)](https://www.npmjs.com/package/@workwayco/mcp)
[![License](https://img.shields.io/npm/l/@workwayco/mcp.svg)](https://github.com/workwayco/workway/blob/main/LICENSE)

**MCP (Model Context Protocol) server for WORKWAY workflow development and debugging.**

Build, test, and debug Cloudflare Workers workflows with AI assistance.

## Quick Start

```bash
# Install globally
npm install -g @workwayco/mcp

# Or run directly
npx @workwayco/mcp
```

## MCP Server for Claude Code

Add to your Claude Code MCP settings (`.mcp.json`):

```json
{
  "mcpServers": {
    "workway": {
      "command": "npx",
      "args": ["@workwayco/mcp"]
    }
  }
}
```

## Available Tools

### Workflow Development

| Tool | Description |
|------|-------------|
| `workflow_debug` | End-to-end workflow debugging |
| `workflow_diagnose` | AI-powered code analysis |
| `workflow_validate` | Schema validation |
| `sdk_pattern` | Get canonical SDK code patterns |
| `list_workflows` | List available workflows |
| `get_workflow` | Get workflow details |

### Testing & Webhooks

| Tool | Description |
|------|-------------|
| `trigger_webhook` | Test webhook endpoints |

### Cloudflare Integration

| Tool | Description |
|------|-------------|
| `kv_list` | List KV namespace keys |
| `kv_get` | Get KV values |
| `d1_query` | Execute D1 database queries |
| `d1_tables` | List D1 tables |
| `worker_analytics` | Get Worker analytics |
| `oauth_providers` | List OAuth providers |

## Usage Examples

### Debug a Workflow

```typescript
// Claude Code can use the workflow_debug tool to analyze issues
const result = await mcp.call('workflow_debug', {
  workflowId: 'meeting-intelligence',
  input: { meetingId: 'abc123' },
});
```

### Get SDK Patterns

```typescript
// Get canonical patterns for integration development
const pattern = await mcp.call('sdk_pattern', {
  pattern: 'base-api-client',
});
```

### Query D1 Database

```typescript
// Debug database state
const users = await mcp.call('d1_query', {
  database: 'marketplace',
  query: 'SELECT * FROM users WHERE email = ?',
  params: ['user@example.com'],
});
```

## Server Modules

The package includes specialized server modules:

```typescript
// Main MCP server
import { server } from '@workwayco/mcp/server';

// Cloudflare-specific tools
import { cloudflareServer } from '@workwayco/mcp/servers/cloudflare';

// WORKWAY platform tools
import { workwayServer } from '@workwayco/mcp/servers/workway';

// Skills/patterns library
import { skills } from '@workwayco/mcp/skills';
```

## Design Philosophy

**Zuhandenheit (Ready-to-hand)**: The tool recedes; the outcome remains.

This MCP server helps AI agents debug and develop WORKWAY workflows without needing to understand the full complexity of Cloudflare Workers. The tools provide:

- **Progressive disclosure**: Start with high-level debugging, drill down as needed
- **Canonical patterns**: Get the right way to build integrations
- **Direct data access**: Query KV, D1, and analytics without context switching

## Links

- **WORKWAY**: [workway.co](https://workway.co)
- **Documentation**: [docs.workway.co](https://docs.workway.co)
- **GitHub**: [github.com/workwayco/workway](https://github.com/workwayco/workway)
- **Issues**: [github.com/workwayco/workway/issues](https://github.com/workwayco/workway/issues)

## About

Built by [Half Dozen](https://halfdozen.co) for the [WORKWAY](https://workway.co) platform.

## License

Apache-2.0
