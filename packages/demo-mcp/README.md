# WORKWAY Demo MCP

Procore-shaped **mock** construction data and 8 MCP tools so you can try WORKWAY without a Procore account. Used by the [WORKWAY MCP Sandbox](https://workway.co) on the homepage and by Cursor/Claude via MCP.

## What it provides

- **8 tools**: `list_projects`, `list_rfis`, `get_rfi`, `list_submittals`, `get_submittal`, `get_project_summary`, `list_daily_logs`, `create_daily_log`
- **Mock data**: Projects (Main Street Tower, Harbor View Condos, Tech Campus Phase 2), RFIs, submittals, daily logs — all in-memory, no Procore OAuth
- **Active agent**: Heuristic router maps natural language to one tool + arguments (no LLM required; optional LLM can be added later)
- **Sandbox endpoint**: `POST /demo/query` with `{ message: string }` returns `{ toolCall, response, summary?, timeSaved }` for the web sandbox UI

## Run locally

```bash
cd Cloudflare/packages/demo-mcp
pnpm install
pnpm dev
```

Then open the MCP server at `http://localhost:8787`. The sandbox on the WORKWAY site will work when the platform API has `DEMO_MCP_URL=http://localhost:8787` (or your tunnel URL).

## Deploy (Worker)

1. Create a [KV namespace](https://developers.cloudflare.com/kv/) and [D1 database](https://developers.cloudflare.com/d1/) (required by `@workway/mcp-core` for metering).
2. In `wrangler.toml`, set `KV` and `DB` bindings to your ids.
3. Deploy:

   ```bash
   pnpm deploy
   ```

4. Set the platform API env: `DEMO_MCP_URL=https://your-demo-mcp.workers.dev` (or your custom domain).

## Use in Cursor / Claude

Add the Demo MCP server so your AI can call the same tools (mock data only).

**Cursor** — in `.cursor/mcp.json` or Cursor settings → MCP:

```json
{
  "mcpServers": {
    "workway-demo": {
      "url": "https://your-demo-mcp.workers.dev/sse"
    }
  }
}
```

If you run the server locally:

```json
{
  "mcpServers": {
    "workway-demo": {
      "url": "http://localhost:8787/sse"
    }
  }
}
```

**Claude Desktop** — in `claude_desktop_config.json`:

```json
{
  "mcp_servers": {
    "workway-demo": {
      "url": "https://your-demo-mcp.workers.dev/sse"
    }
  }
}
```

Then ask Claude or Cursor to “list overdue RFIs on Main Street Tower” or “show me submittals pending review” — they will call the demo tools and get mock results.

## Procore alignment

Mock entities and filters follow [Procore API](https://developers.procore.com/) semantics where relevant:

- [RFIs](https://developers.procore.com/reference/rest/v1/rfis) — project, status (open/closed), due dates
- [Submittals](https://developers.procore.com/reference/rest/v1/submittals) — project, status, ball in court
- [Daily Logs](https://procore.github.io/documentation/daily-logs) — date range, weather, notes, manpower

Project IDs in the demo are strings: `P-001`, `P-002`, `P-003` (Main Street Tower, Harbor View Condos, Tech Campus Phase 2).
