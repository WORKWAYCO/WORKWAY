# WORKWAY Construction MCP - API Design Analysis

**Date**: February 3, 2026  
**Target Users**: AI agents (Claude, GPT) automating construction workflows  
**Scope**: 16 tools + 5 resources across workflow, procore, and debugging categories

---

## Executive Summary

The WORKWAY Construction MCP server demonstrates **strong foundational design** with excellent self-documentation and AI-friendly patterns. However, several critical improvements are needed for production-grade AI agent consumption, particularly around error handling, idempotency, and schema consistency.

**Overall Grade**: B+ (Good foundation, needs refinement)

---

## 1. Tool Naming Consistency & Discoverability

### ✅ Strengths

1. **Consistent prefix pattern**: All tools use `workway_` prefix, making them easily discoverable
2. **Clear category grouping**: Tools organized into `workflow`, `procore`, `debugging` categories
3. **Verb-noun pattern**: Consistent naming like `create_workflow`, `add_action`, `list_procore_projects`

### ❌ Issues

#### 1.1 Inconsistent naming conventions

**Problem**: Mixed verb forms and inconsistent action naming

```typescript
// workflow.ts - uses imperative verbs
'workway_create_workflow'      ✅
'workway_configure_trigger'    ✅
'workway_add_action'           ✅
'workway_deploy'               ✅
'workway_test'                 ✅
'workway_list_workflows'       ✅
'workway_rollback'             ✅

// procore.ts - mixes "get" and "list"
'workway_connect_procore'       ✅
'workway_check_procore_connection'  ⚠️ (should be "verify" or "get_status")
'workway_list_procore_projects'    ✅
'workway_get_procore_rfis'         ❌ (inconsistent with "list")
'workway_get_procore_daily_logs'   ❌ (inconsistent)
'workway_get_procore_submittals'   ❌ (inconsistent)

// debugging.ts - good consistency
'workway_diagnose'              ✅
'workway_get_unstuck'            ⚠️ (should be "workway_guide" or "workway_help")
'workway_observe_execution'      ✅
```

**Recommendation**: Standardize on:
- `list_*` for collections (multiple items)
- `get_*` for single items
- `create_*`, `update_*`, `delete_*` for mutations
- `connect_*`, `check_*` for connection management

**Fix**:
```typescript
// Rename for consistency
'workway_get_procore_rfis' → 'workway_list_procore_rfis'
'workway_get_procore_daily_logs' → 'workway_list_procore_daily_logs'
'workway_get_procore_submittals' → 'workway_list_procore_submittals'
'workway_get_unstuck' → 'workway_guide' or 'workway_get_guidance'
```

#### 1.2 Missing tool discovery metadata

**Problem**: No tags, categories, or usage hints in tool definitions

**Recommendation**: Add metadata to each tool:
```typescript
{
  name: 'workway_create_workflow',
  description: '...',
  category: 'workflow',
  tags: ['create', 'workflow', 'setup'],
  usage: 'start_here', // or 'advanced', 'debugging'
  relatedTools: ['workway_configure_trigger', 'workway_add_action'],
  // ...
}
```

---

## 2. Input/Output Schema Design (Zod Schemas)

### ✅ Strengths

1. **Comprehensive Zod validation**: All inputs properly validated
2. **Rich descriptions**: Most fields have `.describe()` for AI context
3. **Type safety**: Strong TypeScript types throughout

### ❌ Critical Issues

#### 2.1 Schema inconsistency between input and output

**Problem**: Input uses snake_case, output uses camelCase inconsistently

```typescript
// workflow.ts - INCONSISTENT
inputSchema: z.object({
  workflow_id: z.string(),  // snake_case ✅
  project_id: z.string(),   // snake_case ✅
})

outputSchema: z.object({
  workflow_id: z.string(),  // snake_case ✅
  projectId: z.string(),     // camelCase ❌ INCONSISTENT
  triggerType: z.string(),   // camelCase ❌
})
```

**Impact**: AI agents must handle both naming conventions, increasing cognitive load.

**Recommendation**: **Pick one convention and stick to it**. For MCP/AI consumption, snake_case is more common:

```typescript
// Consistent snake_case everywhere
outputSchema: z.object({
  workflow_id: z.string(),
  project_id: z.string().optional(),
  trigger_type: z.string(),
  trigger_config: z.object({...}),
})
```

#### 2.2 Missing required field indicators

**Problem**: No clear distinction between required and optional fields in descriptions

**Example**:
```typescript
inputSchema: z.object({
  workflow_id: z.string().describe('The workflow to configure'),  // Required? Unclear
  source: z.enum([...]).optional().describe('Service that will trigger...'),  // Optional ✅
})
```

**Recommendation**: Add explicit indicators:
```typescript
workflow_id: z.string().describe('The workflow to configure (REQUIRED)'),
source: z.enum([...]).optional().describe('Service that will trigger this workflow (OPTIONAL)'),
```

#### 2.3 Output schemas don't match actual return values

**Problem**: Output schemas defined but actual return values don't match

```typescript
// workflow.ts:87 - configure_trigger
outputSchema: z.object({
  success: z.boolean(),
  trigger_config: z.object({...}),
  next_step: z.string(),
})

// Actual return (line 140-145)
return {
  success: true,
  data: {
    success: true,        // ❌ Duplicate "success"
    triggerConfig,        // ❌ camelCase, not snake_case
    webhookUrl,           // ❌ Not in schema
    nextStep,             // ❌ camelCase
  },
};
```

**Impact**: AI agents receive unexpected fields, breaking type expectations.

**Recommendation**: 
1. Match output schemas exactly to return values
2. Remove redundant `success` field (ToolResult already has it)
3. Use consistent naming

**Fix**:
```typescript
outputSchema: z.object({
  trigger_config: z.object({...}),
  webhook_url: z.string().optional(),
  next_step: z.string(),
}),

// Return matches schema
return {
  success: true,
  data: {
    trigger_config: triggerConfig,
    webhook_url: webhookUrl,
    next_step: nextStep,
  },
};
```

#### 2.4 Missing enum value descriptions

**Problem**: Enums lack descriptions for each value

```typescript
trigger_type: z.enum(['webhook', 'cron', 'manual']).optional()
  .describe('How the workflow is triggered')
```

**Recommendation**: Describe each enum value:
```typescript
trigger_type: z.enum(['webhook', 'cron', 'manual']).optional()
  .describe('How the workflow is triggered. Options: webhook (event-driven), cron (scheduled), manual (user-initiated)'),
```

#### 2.5 Missing examples in schemas

**Problem**: No example values for complex inputs

**Recommendation**: Add examples:
```typescript
cron_schedule: z.string().optional()
  .describe('Cron expression (e.g., "0 9 * * 1-5" for weekdays at 9am)')
  .example('0 9 * * 1-5'),  // Add .example()
```

---

## 3. Error Handling & Error Message Clarity

### ✅ Strengths

1. **Structured error responses**: Uses `ToolResult` with `success` boolean
2. **Contextual error messages**: Some errors include helpful context

### ❌ Critical Issues

#### 3.1 Inconsistent error response format

**Problem**: Errors returned in multiple formats

```typescript
// Pattern 1: ToolResult with error string
return {
  success: false,
  error: `Workflow ${input.workflow_id} not found`,
};

// Pattern 2: ToolResult with error in data
return {
  success: false,
  data: {
    success: false,
    validationErrors: errors,
    status: 'failed',
  },
};

// Pattern 3: Thrown exceptions (caught at handler level)
throw new Error('Not connected to Procore...');
```

**Impact**: AI agents must handle multiple error formats, making error handling fragile.

**Recommendation**: **Standardize on single error format**:

```typescript
// Always return ToolResult
return {
  success: false,
  error: {
    code: 'WORKFLOW_NOT_FOUND',
    message: `Workflow ${input.workflow_id} not found`,
    details: {
      workflow_id: input.workflow_id,
      suggestion: 'Use workway_list_workflows to see available workflows',
    },
  },
};
```

#### 3.2 Error messages lack actionable guidance

**Problem**: Errors don't tell AI agents what to do next

```typescript
// Current (procore.ts:28)
throw new Error('Not connected to Procore. Use workway_connect_procore first.');

// Better
return {
  success: false,
  error: {
    code: 'PROCORE_NOT_CONNECTED',
    message: 'Procore integration not connected',
    action: {
      tool: 'workway_connect_procore',
      params: {},
      explanation: 'Call this tool to initiate OAuth connection',
    },
  },
};
```

**Recommendation**: Every error should include:
- Error code (for programmatic handling)
- Human-readable message
- Suggested fix (tool + params)
- Related resources/docs

#### 3.3 Missing error codes

**Problem**: No standardized error codes for programmatic handling

**Recommendation**: Define error code taxonomy:
```typescript
// Error codes
'WORKFLOW_NOT_FOUND'
'WORKFLOW_INVALID_CONFIG'
'PROCORE_NOT_CONNECTED'
'PROCORE_TOKEN_EXPIRED'
'PROCORE_RATE_LIMITED'
'VALIDATION_FAILED'
'EXECUTION_FAILED'
```

#### 3.4 Validation errors buried in data

**Problem**: Validation failures return `success: false` but errors in nested data

```typescript
// workflow.ts:261-269
if (errors.length > 0) {
  return {
    success: false,
    data: {
      success: false,
      validationErrors: errors,  // ❌ Should be in error field
      status: 'failed',
    },
  };
}
```

**Recommendation**: Put validation errors in top-level error:
```typescript
return {
  success: false,
  error: {
    code: 'VALIDATION_FAILED',
    message: 'Workflow validation failed',
    validationErrors: errors,
  },
};
```

---

## 4. Idempotency of Operations

### ✅ Strengths

1. **Read operations**: All list/get operations are naturally idempotent

### ❌ Critical Issues

#### 4.1 Create operations not idempotent

**Problem**: `create_workflow` always creates new workflow, even if identical one exists

```typescript
// workflow.ts:33-60
execute: async (input, env) => {
  const id = crypto.randomUUID();  // ❌ Always new ID
  // ... creates new workflow every time
}
```

**Impact**: AI agents may accidentally create duplicate workflows.

**Recommendation**: Add idempotency key support:
```typescript
inputSchema: z.object({
  name: z.string(),
  idempotency_key: z.string().optional()
    .describe('Optional key to prevent duplicate creation. If provided and workflow with same key exists, returns existing workflow.'),
}),

execute: async (input, env) => {
  if (input.idempotency_key) {
    const existing = await env.DB.prepare(`
      SELECT * FROM workflows WHERE idempotency_key = ?
    `).bind(input.idempotency_key).first();
    
    if (existing) {
      return {
        success: true,
        data: { ...existing, already_exists: true },
      };
    }
  }
  // ... create new
}
```

#### 4.2 Update operations not idempotent-safe

**Problem**: `configure_trigger` overwrites config without versioning

**Recommendation**: Add version/ETag support for safe updates:
```typescript
inputSchema: z.object({
  workflow_id: z.string(),
  expected_version: z.number().optional()
    .describe('Expected workflow version. Update fails if version mismatch (prevents overwriting concurrent changes).'),
}),
```

#### 4.3 Add action not idempotent

**Problem**: Calling `add_action` multiple times with same config creates duplicates

**Recommendation**: Check for duplicate actions:
```typescript
// Before inserting, check if identical action exists
const existing = await env.DB.prepare(`
  SELECT * FROM workflow_actions 
  WHERE workflow_id = ? 
    AND action_type = ?
    AND action_config = ?
`).bind(workflow_id, action_type, JSON.stringify(config)).first();

if (existing) {
  return {
    success: true,
    data: {
      action_id: existing.id,
      already_exists: true,
      message: 'Action already exists with same configuration',
    },
  };
}
```

---

## 5. Resource URI Design Patterns

### ✅ Strengths

1. **Clear URI patterns**: `workflow://{id}/status`, `procore://projects`
2. **Consistent naming**: Uses protocol-like URIs

### ❌ Issues

#### 5.1 Inconsistent URI patterns

**Problem**: Mixed patterns for similar resources

```typescript
'workflow://{id}/status'        // ✅ Good
'workflow://{id}/logs'          // ✅ Good
'procore://projects'            // ✅ Good
'construction://best-practices' // ✅ Good
'integration://{provider}/capabilities' // ⚠️ Different pattern
```

**Recommendation**: Standardize pattern:
```typescript
// All entity resources follow: {domain}://{entity}/{id?}/{subresource?}
'workflow://{id}/status'
'workflow://{id}/logs'
'procore://projects'
'procore://projects/{id}'
'procore://projects/{id}/rfis'
'integration://{provider}/capabilities'
'construction://best-practices'
```

#### 5.2 Missing resource versioning

**Problem**: No way to request specific resource versions

**Recommendation**: Add version support:
```typescript
'workflow://{id}/status?version=latest'
'workflow://{id}/logs?since=2026-01-01'
```

#### 5.3 Resource URIs not self-documenting

**Problem**: URI patterns don't indicate what they return

**Recommendation**: Add resource descriptions to URI patterns:
```typescript
{
  uri: 'workflow://{id}/status',
  name: 'Workflow Status',
  description: 'Current status, configuration, and health metrics for workflow {id}',
  parameters: {
    id: 'Workflow UUID',
  },
  example: 'workflow://abc-123-def/status',
}
```

---

## 6. MCP Protocol Compliance

### ✅ Strengths

1. **Correct endpoint structure**: `/mcp/tools`, `/mcp/resources`
2. **Proper response format**: Uses MCP content format

### ❌ Issues

#### 6.1 Missing MCP protocol version

**Problem**: No protocol version in server info

```typescript
// index.ts:41-52
app.get('/mcp', (c) => {
  return c.json({
    name: 'workway-construction-mcp',
    version: '0.1.0',
    // ❌ Missing protocol version
  });
});
```

**Recommendation**: Add protocol version:
```typescript
return c.json({
  name: 'workway-construction-mcp',
  version: '0.1.0',
  protocolVersion: '2024-11-05',  // MCP protocol version
  // ...
});
```

#### 6.2 Tool schema format may not match MCP spec

**Problem**: Returning Zod schemas directly, but MCP expects JSON Schema

**Current**:
```typescript
app.get('/mcp/tools', (c) => {
  const tools = Object.values(allTools).map(tool => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,  // ❌ Zod schema, not JSON Schema
  }));
});
```

**Recommendation**: Convert Zod to JSON Schema:
```typescript
import { zodToJsonSchema } from 'zod-to-json-schema';

const tools = Object.values(allTools).map(tool => ({
  name: tool.name,
  description: tool.description,
  inputSchema: zodToJsonSchema(tool.inputSchema),
}));
```

#### 6.3 Missing tool metadata

**Problem**: Tools don't include MCP-required metadata

**Recommendation**: Add full MCP tool structure:
```typescript
{
  name: 'workway_create_workflow',
  description: '...',
  inputSchema: {...},  // JSON Schema
  // Add MCP metadata
  category: 'workflow',
  tags: ['create', 'workflow'],
  examples: [
    {
      name: 'Create RFI workflow',
      input: { name: 'RFI Auto-Response', trigger_type: 'webhook' },
    },
  ],
}
```

#### 6.4 Resource subscription not implemented

**Problem**: Server claims `resources: { subscribe: false }` but could support it

**Recommendation**: Consider adding resource subscriptions for real-time updates:
```typescript
capabilities: {
  resources: { 
    subscribe: true,  // Enable if implementing
    listChanged: true 
  },
}
```

---

## 7. Self-Describing Nature for AI Consumption

### ✅ Strengths

1. **Excellent descriptions**: Most tools have detailed descriptions
2. **Next-step guidance**: Many tools return `next_step` hints
3. **Atlas integration**: Debugging tools use AI Interaction Atlas taxonomy

### ❌ Issues

#### 7.1 Descriptions don't explain when to use each tool

**Problem**: Descriptions explain what, not when

```typescript
// Current
description: 'Create a new construction workflow. Returns workflow_id for subsequent configuration.',

// Better
description: `Create a new construction workflow. Returns workflow_id for subsequent configuration.

Use this tool when:
- Starting a new automation from scratch
- You need a workflow container before adding triggers/actions

Next steps after creation:
1. Call workway_configure_trigger to set up when workflow runs
2. Call workway_add_action to add workflow steps
3. Call workway_deploy to activate

See also: workway_list_workflows (to see existing workflows)`,
```

#### 7.2 Missing tool relationships

**Problem**: No indication of which tools work together

**Recommendation**: Add relationship metadata:
```typescript
{
  name: 'workway_create_workflow',
  relatedTools: [
    { name: 'workway_configure_trigger', relationship: 'next_step' },
    { name: 'workway_add_action', relationship: 'next_step' },
    { name: 'workway_list_workflows', relationship: 'alternative' },
  ],
  commonPatterns: [
    {
      name: 'RFI Automation',
      steps: [
        'workway_create_workflow',
        'workway_configure_trigger',
        'workway_add_action (procore.rfi.respond)',
        'workway_deploy',
      ],
    },
  ],
}
```

#### 7.3 Output schemas lack field descriptions

**Problem**: Output fields don't explain their meaning

```typescript
outputSchema: z.object({
  workflow_id: z.string(),  // ❌ No description
  status: z.enum([...]),    // ❌ No description
  webhook_url: z.string().optional(),  // ❌ No description
})
```

**Recommendation**: Describe all output fields:
```typescript
outputSchema: z.object({
  workflow_id: z.string().describe('Unique identifier for the created workflow. Use this in subsequent tool calls.'),
  status: z.enum(['draft', 'active', 'paused', 'error'])
    .describe('Current workflow status. draft = not yet deployed, active = running, paused = temporarily stopped, error = failed state'),
  webhook_url: z.string().optional()
    .describe('Webhook URL for receiving events. Only present if trigger_type is "webhook". Register this URL with the event source.'),
})
```

#### 7.4 Missing examples in tool responses

**Problem**: Tools don't return example usage

**Recommendation**: Include examples in responses:
```typescript
return {
  success: true,
  data: {
    workflow_id: '...',
    // ...
    examples: {
      next_tool_call: {
        tool: 'workway_configure_trigger',
        params: {
          workflow_id: '...',
          source: 'procore',
          event_types: ['rfi.created'],
        },
      },
    },
  },
};
```

---

## Priority Recommendations

### 🔴 Critical (Fix Before Production)

1. **Standardize naming conventions** (snake_case everywhere)
2. **Fix output schema mismatches** (match schemas to actual returns)
3. **Standardize error format** (single error structure with codes)
4. **Add idempotency keys** to create operations
5. **Convert Zod to JSON Schema** for MCP compliance

### 🟡 High Priority (Improve AI Experience)

6. **Add error actionability** (every error suggests fix tool)
7. **Enrich descriptions** (when to use, examples, relationships)
8. **Add output field descriptions**
9. **Implement resource versioning**
10. **Add tool relationship metadata**

### 🟢 Medium Priority (Polish)

11. **Add enum value descriptions**
12. **Add example values to schemas**
13. **Implement resource subscriptions**
14. **Add usage tags** (start_here, advanced, etc.)

---

## Example: Improved Tool Definition

```typescript
create_workflow: {
  name: 'workway_create_workflow',
  description: `Create a new construction workflow. Returns workflow_id for subsequent configuration.

**When to use:**
- Starting a new automation from scratch
- You need a workflow container before adding triggers/actions

**Next steps after creation:**
1. Call workway_configure_trigger to set up when workflow runs
2. Call workway_add_action to add workflow steps  
3. Call workway_deploy to activate

**See also:** workway_list_workflows (to see existing workflows)`,
  
  category: 'workflow',
  tags: ['create', 'workflow', 'setup', 'start_here'],
  relatedTools: [
    'workway_configure_trigger',
    'workway_add_action',
    'workway_list_workflows',
  ],
  
  inputSchema: z.object({
    name: z.string()
      .describe('Human-readable workflow name (REQUIRED). Example: "RFI Auto-Response"'),
    description: z.string().optional()
      .describe('What this workflow accomplishes (OPTIONAL)'),
    project_id: z.string().optional()
      .describe('Procore project ID to scope this workflow to (OPTIONAL)'),
    trigger_type: z.enum(['webhook', 'cron', 'manual']).optional()
      .describe('How the workflow is triggered (OPTIONAL, can be set later). Options: webhook (event-driven), cron (scheduled), manual (user-initiated)'),
    idempotency_key: z.string().optional()
      .describe('Optional key to prevent duplicate creation. If provided and workflow with same key exists, returns existing workflow.'),
  }),
  
  outputSchema: z.object({
    workflow_id: z.string()
      .describe('Unique identifier for the created workflow. Use this in subsequent tool calls.'),
    status: z.enum(['draft', 'active', 'paused', 'error'])
      .describe('Current workflow status. draft = not yet deployed, active = running, paused = temporarily stopped, error = failed state'),
    webhook_url: z.string().optional()
      .describe('Webhook URL for receiving events. Only present if trigger_type is "webhook". Register this URL with the event source.'),
    next_step: z.string()
      .describe('Recommended next action to configure this workflow'),
    already_exists: z.boolean().optional()
      .describe('True if workflow already existed (idempotency key match)'),
  }),
  
  examples: [
    {
      name: 'Create RFI automation workflow',
      input: {
        name: 'RFI Auto-Response',
        description: 'Automatically draft responses to new RFIs',
        trigger_type: 'webhook',
      },
    },
  ],
  
  execute: async (input, env) => {
    // Check idempotency
    if (input.idempotency_key) {
      const existing = await env.DB.prepare(`
        SELECT * FROM workflows WHERE idempotency_key = ?
      `).bind(input.idempotency_key).first();
      
      if (existing) {
        return {
          success: true,
          data: {
            workflow_id: existing.id,
            status: existing.status,
            webhook_url: existing.trigger_type === 'webhook' 
              ? `https://workway-construction-mcp.half-dozen.workers.dev/webhooks/${existing.id}`
              : undefined,
            next_step: 'Workflow already exists. Use workway_configure_trigger or workway_add_action to modify.',
            already_exists: true,
          },
        };
      }
    }
    
    // Create new workflow
    const id = crypto.randomUUID();
    // ... rest of creation logic
    
    return {
      success: true,
      data: {
        workflow_id: id,
        status: 'draft',
        webhook_url: input.trigger_type === 'webhook' 
          ? `https://workway-construction-mcp.half-dozen.workers.dev/webhooks/${id}`
          : undefined,
        next_step: input.trigger_type === 'webhook'
          ? 'Call workway_configure_trigger to set up the webhook source and events'
          : input.trigger_type
          ? 'Call workway_add_action to add workflow steps'
          : 'Call workway_configure_trigger to set up when the workflow runs',
        already_exists: false,
      },
    };
  },
},
```

---

## Conclusion

The WORKWAY Construction MCP server has a **solid foundation** with excellent self-documentation and thoughtful AI-friendly patterns. The main gaps are in **consistency** (naming, schemas, errors) and **completeness** (idempotency, error actionability, relationships).

**Key Takeaway**: The API is designed for humans reading code, not AI agents consuming it. To make it truly AI-native, prioritize:
1. **Consistency** above all else
2. **Actionable errors** that guide next steps
3. **Self-description** that explains relationships and usage patterns
4. **Idempotency** to prevent accidental duplicates

With these improvements, the API will be significantly more reliable and easier for AI agents to use autonomously.
