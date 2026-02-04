# WORKWAY Construction MCP - Architecture

System architecture and design documentation for the WORKWAY Construction MCP server.

## Overview

WORKWAY Construction MCP is an MCP (Model Context Protocol) server built on Cloudflare Workers that provides AI-native workflow automation for construction project management, with deep Procore integration.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 CLIENT'S AI AGENT (Claude Code / Codex)          │
│                                                                  │
│   "Cut our RFI response time in half"                            │
│                              │                                   │
│                              ▼                                   │
│                    ┌─────────────────┐                           │
│                    │  WORKWAY MCP    │                           │
│                    │  (remote)       │                           │
│                    └────────┬────────┘                           │
└─────────────────────────────│────────────────────────────────────┘
                              │ MCP Protocol (Streamable HTTP)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│           WORKWAY CONSTRUCTION MCP SERVER (Cloudflare)           │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  MCP Protocol Layer (Hono Router)                        │  │
│   │  - /mcp (server info)                                    │  │
│   │  - /mcp/tools (list/call tools)                         │  │
│   │  - /mcp/resources (list/read resources)                 │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  Tools Layer                                            │  │
│   │  ├─ Workflow Tools (create, configure, deploy)           │  │
│   │  ├─ Procore Tools (connect, list, fetch data)          │  │
│   │  └─ Debugging Tools (diagnose, get_unstuck)            │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  Business Logic Layer                                   │  │
│   │  ├─ Workflow Engine                                     │  │
│   │  ├─ Procore Client (OAuth, API calls)                  │  │
│   │  └─ AI Integration (Atlas-aligned)                      │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │  Data Layer                                             │  │
│   │  ├─ D1 Database (workflows, executions, tokens)         │  │
│   │  ├─ KV Storage (OAuth state, cache)                    │  │
│   │  └─ Durable Objects (workflow state machines)         │  │
│   └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PROCORE API (External)                        │
│  - Projects, RFIs, Daily Logs, Submittals                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### MCP Protocol Layer

**Technology:** Hono (lightweight web framework)

**Responsibilities:**
- Handle MCP protocol requests
- Route to appropriate tools/resources
- Format responses according to MCP spec
- Handle CORS and authentication

**Endpoints:**
- `GET /mcp` - Server info
- `GET /mcp/tools` - List tools
- `POST /mcp/tools/:name` - Execute tool
- `GET /mcp/resources` - List resources
- `GET /mcp/resources/read` - Read resource

---

### Tools Layer

**Structure:**
```
tools/
├── workflow.ts      # Workflow lifecycle tools
├── procore.ts        # Procore integration tools
├── debugging.ts      # Debugging & observability
└── index.ts          # Tool registry
```

**Tool Categories:**

1. **Workflow Lifecycle:**
   - `workway_create_workflow`
   - `workway_configure_trigger`
   - `workway_add_action`
   - `workway_deploy`
   - `workway_test`
   - `workway_list_workflows`
   - `workway_rollback`

2. **Procore Integration:**
   - `workway_connect_procore`
   - `workway_check_procore_connection`
   - `workway_list_procore_projects`
   - `workway_get_procore_rfis`
   - `workway_get_procore_daily_logs`
   - `workway_get_procore_submittals`

3. **Debugging & Observability:**
   - `workway_diagnose`
   - `workway_get_unstuck`
   - `workway_observe_execution`

---

### Business Logic Layer

#### Workflow Engine

**Responsibilities:**
- Execute workflow steps sequentially
- Handle conditional logic
- Manage workflow state
- Track execution history

**Execution Flow:**
```
1. Trigger received (webhook/cron/manual)
2. Create execution record
3. Load workflow configuration
4. Execute actions in sequence:
   - Validate action conditions
   - Execute action
   - Store step results
   - Handle errors
5. Update execution status
6. Store execution logs
```

#### Procore Client

**Responsibilities:**
- OAuth token management
- API request handling
- Rate limit management
- Error handling

**Features:**
- Automatic token refresh
- Request retry logic
- Rate limit handling
- Error translation

#### AI Integration

**AI Interaction Atlas Integration:**
- Classify AI tasks (classify, generate, verify, etc.)
- Track human tasks (review, approve, edit)
- Monitor system tasks (routing, logging)
- Provide observability with Atlas taxonomy

---

### Data Layer

#### D1 Database

**Tables:**

- `workflows` - Workflow definitions
- `workflow_actions` - Workflow action steps
- `executions` - Execution history
- `execution_steps` - Detailed execution traces
- `oauth_tokens` - OAuth token storage
- `rfi_outcomes` - RFI outcome data for learning

**Schema:** See `migrations/0001_initial.sql`

#### KV Storage

**Use Cases:**
- OAuth state (temporary, 10-minute TTL)
- Rate limit counters
- Cache for frequently accessed data

#### Durable Objects

**WorkflowState Durable Object:**

- Manages workflow execution state
- Handles concurrent executions
- Provides workflow state machine
- Coordinates multi-step workflows

---

## Workflow Execution Flow

### Sequence Diagram

```
Client                    MCP Server              Procore API
  │                          │                        │
  │── workway_deploy ────────>│                        │
  │                          │                        │
  │                          │── Validate config     │
  │                          │                        │
  │<─── Success ─────────────│                        │
  │                          │                        │
  │                          │                        │
  │                          │<─── Webhook Event ────│
  │                          │                        │
  │                          │── Create Execution    │
  │                          │                        │
  │                          │── Execute Action 1    │
  │                          │                        │
  │                          │─── API Call ──────────>│
  │                          │<─── Response ─────────│
  │                          │                        │
  │                          │── Execute Action 2    │
  │                          │                        │
  │                          │── Store Results       │
  │                          │                        │
  │                          │── Update Execution    │
  │                          │                        │
```

### Detailed Execution Flow

1. **Trigger:**
   - Webhook: Event received at `/webhooks/:workflow_id`
   - Cron: Scheduled execution triggered
   - Manual: User-initiated execution

2. **Execution Creation:**
   - Create execution record in D1
   - Status: `pending`
   - Store trigger data

3. **Workflow Loading:**
   - Load workflow from D1
   - Load workflow actions (ordered by sequence)
   - Validate workflow is active

4. **Action Execution:**
   - For each action:
     - Check condition (if present)
     - Execute action
     - Store step result
     - Handle errors

5. **Completion:**
   - Update execution status
   - Store final output
   - Log execution trace

---

## Data Flow

### OAuth Flow

```
1. User calls workway_connect_procore
   └─> Generate OAuth state
   └─> Store state in KV (10-min TTL)
   └─> Return authorization URL

2. User visits authorization URL
   └─> Procore OAuth page
   └─> User authorizes
   └─> Redirect to callback URL

3. Callback receives code
   └─> Verify state from KV
   └─> Exchange code for token
   └─> Store token in D1 (encrypted)
   └─> Return success
```

### Workflow Creation Flow

```
1. workway_create_workflow
   └─> Generate workflow ID
   └─> Insert into workflows table
   └─> Return workflow_id

2. workway_configure_trigger
   └─> Update workflows table
   └─> Store trigger config (JSON)
   └─> Generate webhook URL (if webhook)

3. workway_add_action
   └─> Get action sequence number
   └─> Insert into workflow_actions table
   └─> Return action_id

4. workway_deploy
   └─> Validate workflow config
   └─> Check required fields
   └─> Update status to 'active'
   └─> Return deployment_id
```

---

## Security Architecture

### Authentication

- **OAuth 2.0** for Procore integration
- **State parameter** for CSRF protection
- **Token encryption** for storage

### Authorization

- **Scope-based** access control
- **Project-level** permissions
- **Workflow-level** access control

### Data Protection

- **Encryption at rest** for sensitive data
- **HTTPS** for all communications
- **Input validation** on all endpoints
- **SQL injection** prevention via parameterized queries

---

## Scalability

### Cloudflare Workers

- **Edge deployment** for low latency
- **Automatic scaling** based on demand
- **Global distribution** via Cloudflare network

### D1 Database

- **SQLite-based** for simplicity
- **Replication** for availability
- **Backup** capabilities

### Durable Objects

- **Stateful execution** for workflows
- **Concurrent execution** support
- **Automatic failover**

---

## Monitoring & Observability

### Logging

- **Execution logs** in D1
- **Error logs** with context
- **Performance metrics** tracked

### Debugging Tools

- **workway_diagnose** - Automated diagnosis
- **workway_observe_execution** - Detailed traces
- **workway_get_unstuck** - Guidance system

### AI Interaction Atlas

- **Task classification** (AI/Human/System)
- **Confidence tracking**
- **Token usage** monitoring
- **Human override** tracking

---

## Future Enhancements

### Planned Features

1. **Multi-tenant support** - Organization-level isolation
2. **Workflow versioning** - Version control for workflows
3. **Advanced scheduling** - Complex cron expressions
4. **Workflow templates** - Pre-built workflow patterns
5. **Enhanced AI** - Fine-tuned models for construction

### Architecture Improvements

1. **Event sourcing** - Full execution history
2. **CQRS** - Separate read/write models
3. **GraphQL API** - Alternative to MCP protocol
4. **WebSocket support** - Real-time updates

---

## Additional Resources

- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Procore API Documentation](https://developers.procore.com/)
- [AI Interaction Atlas](https://github.com/quietloudlab/ai-interaction-atlas)
