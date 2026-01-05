# Workflow Audit Suite

Gas Town-powered systematic audits for WORKWAY workflow configuration quality.

## Quick Start

```bash
# Run all implemented audits
cd packages/harness
pnpm audit

# Dry run (no Beads issues created)
pnpm audit:dry-run

# Create Beads issues for findings
pnpm audit:with-issues
```

## What Gets Audited

The audit suite analyzes all workflows in `/packages/workflows/src/` for:

1. **Scoring Rules** - Keyword strategies and tier consistency
2. **Required Properties** - Property requirements and weight distribution
3. **API Endpoints** - Health checks and accessibility _(not yet implemented)_
4. **OAuth Coverage** - Provider registration and scopes _(not yet implemented)_
5. **User Input Quality** - Field labels, descriptions, defaults _(not yet implemented)_
6. **Error Messages** - Actionability and user-friendliness _(not yet implemented)_
7. **Schema Consistency** - Naming conventions and structure _(not yet implemented)_
8. **Field Mappings** - Completeness for resource_selection steps _(not yet implemented)_

## Reports Generated

All reports written to `/audit-reports/`:

```
audit-reports/
├── scoring-rules-report.md           # Human-readable markdown
├── scoring-rules-report.json         # Machine-readable JSON
├── required-properties-report.md
├── required-properties-report.json
└── audit-suite-combined.json         # Combined summary
```

### Report Format

#### Markdown Reports

- Severity-grouped findings
- Context and recommendations
- File paths and workflow IDs
- Auto-fixable flag

#### JSON Reports

```json
{
  "auditType": "required-properties",
  "executedAt": "2026-01-05T19:46:45.388Z",
  "totalWorkflows": 49,
  "workflowsAudited": 9,
  "findingsCount": 9,
  "summary": {
    "critical": 0,
    "high": 0,
    "medium": 9,
    "low": 0,
    "autoFixable": 0
  },
  "findings": [
    {
      "workflowId": "accounting-stays-current",
      "severity": "medium",
      "issue": "Missing requiredProperties configuration",
      "recommendation": "Add requiredProperties to ensure workflow has necessary data inputs",
      "priority": "P2",
      "labels": ["audit", "workflows", "required-properties"],
      "filePath": "/path/to/workflow/index.ts",
      "context": { ... }
    }
  ]
}
```

## Architecture

### Gas Town Coordinator Pattern

```
┌─────────────────────────────────────────┐
│         Coordinator                     │
│  (coordinator.ts)                       │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ runAllAudits()                  │   │
│  │ - Loads all audit executors     │   │
│  │ - Runs in parallel or sequential│   │
│  │ - Generates reports             │   │
│  │ - Creates Beads issues          │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
         │         │         │
         ▼         ▼         ▼
    ┌────────┐ ┌────────┐ ┌────────┐
    │Worker 1│ │Worker 2│ │Worker N│
    │(Audit  │ │(Audit  │ │(Audit  │
    │  1)    │ │  2)    │ │  N)    │
    └────────┘ └────────┘ └────────┘
```

### Creating a New Audit

1. **Implement `AuditExecutor` interface**:

```typescript
import type { AuditExecutor, AuditConfig, AuditReport } from './types';
import { createAuditReport, severityToPriority } from './types';
import { loadAllWorkflows } from './workflow-loader';

export class MyAuditExecutor implements AuditExecutor {
  name = 'my-audit';
  description = 'What this audit checks';

  async execute(config: AuditConfig): Promise<AuditReport> {
    const workflows = await loadAllWorkflows(config.workflowsPath);
    const findings = [];

    for (const workflow of workflows) {
      // Your audit logic here
      if (someCondition) {
        findings.push({
          workflowId: workflow.metadata.id,
          workflowName: workflow.metadata.name,
          severity: 'medium',
          category: this.name,
          issue: 'Description of the issue',
          recommendation: 'What to do about it',
          autoFixable: false,
          priority: severityToPriority('medium'),
          labels: ['audit', 'workflows'],
          filePath: workflow.metadata.filePath,
        });
      }
    }

    return createAuditReport(this.name, findings, workflows.length);
  }
}
```

2. **Register in coordinator**:

```typescript
// In coordinator.ts
import { MyAuditExecutor } from './my-audit';

const AUDIT_EXECUTORS = [
  new ScoringRulesAuditor(),
  new RequiredPropertiesAuditor(),
  new MyAuditExecutor(), // Add here
];
```

3. **Test it**:

```bash
pnpm audit:dry-run
```

## Workflow Loader Utilities

The `workflow-loader.ts` provides utilities for parsing workflows:

```typescript
import {
  loadAllWorkflows,
  extractPathway,
  extractIntegrations,
  extractInputs,
} from './workflow-loader';

const workflows = await loadAllWorkflows('/path/to/workflows');

for (const workflow of workflows) {
  const pathway = extractPathway(workflow.content);
  const integrations = extractIntegrations(workflow.content);
  const inputs = extractInputs(workflow.content);

  // Your audit logic
}
```

### Available Extractors

- `loadAllWorkflows(path)` - Load all workflows from directory
- `extractPathway(content)` - Extract pathway configuration
- `extractIntegrations(content)` - Extract integrations array
- `extractInputs(content)` - Extract inputs configuration

**Note**: Current extractors use regex-based parsing. For production, consider using proper TypeScript AST parsing (e.g., `ts-morph`).

## Severity Levels

| Severity | Priority | Use Case |
|----------|----------|----------|
| `critical` | P0 | Broken workflows, security issues |
| `high` | P1 | Missing required configuration |
| `medium` | P2 | Inconsistencies, UX issues |
| `low` | P3 | Style, polish, nice-to-haves |

Priority is auto-assigned via `severityToPriority()`.

## Auto-Fixable Findings

Mark findings as `autoFixable: true` when they can be programmatically fixed:

```typescript
findings.push({
  // ...
  autoFixable: true, // Enable automated fixes
  context: {
    currentValue: 0.8,
    suggestedValue: 0.7,
    fixStrategy: 'replace',
  },
});
```

Future phases will implement automated fix generation.

## Beads Integration

When run with `--create-issues`, findings become Beads issues:

```bash
pnpm audit:with-issues
```

Each finding creates:
- **Title**: `[audit-name] Workflow Name: Issue`
- **Body**: Recommendation + context
- **Priority**: Auto-assigned from severity
- **Labels**: From finding.labels array
- **Type**: `task`

## Performance

- **Parallel mode** (default): ~2 seconds for 49 workflows, 2 audits
- **Sequential mode**: ~2.5 seconds (use for debugging)

Parallel execution uses Promise.all() for independent audits.

## Future Enhancements

### Phase 2: Remaining P1 Audits

- API Endpoint Health Check
- OAuth Provider Coverage

### Phase 3: P2/P3 Audits

- User Input Field Quality
- Error Message Helpfulness
- Schema Consistency Check
- Field Mapping Completeness

### Phase 4: Automated Fixes

- Generate fix PRs for auto-fixable findings
- Apply consistent formatting
- Update score tiers to standard values

## Related Documentation

- **Gas Town Implementation**: `../GASTOWN_IMPLEMENTATION.md`
- **Molecular Workflows**: `../MOLECULAR_WORKFLOWS.md`
- **Audit Spec**: `/specs/workflow-audit-suite.yaml`
- **Implementation Summary**: `/WORKFLOW_AUDIT_SUITE_SUMMARY.md`
