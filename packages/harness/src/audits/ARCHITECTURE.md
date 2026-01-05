# Workflow Audit Suite Architecture

**Pattern**: Gas Town Coordinator
**Language**: TypeScript
**Runtime**: Node.js
**Status**: Production-Ready

## System Overview

```
┌────────────────────────────────────────────────────────────────┐
│                     COORDINATOR                                 │
│                   (coordinator.ts)                              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ runAllAudits(config: AuditConfig)                        │  │
│  │  - Loads 8 audit executors                               │  │
│  │  - Distributes work (parallel or sequential)             │  │
│  │  - Aggregates results                                    │  │
│  │  - Generates reports (Markdown + JSON)                   │  │
│  │  - Creates Beads issues (optional)                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
          │         │         │         │         │         │
          ▼         ▼         ▼         ▼         ▼         ▼
    ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ...
    │Worker 1 │ │Worker 2 │ │Worker 3 │ │Worker 4 │ │Worker 5 │
    │Scoring  │ │Required │ │API      │ │OAuth    │ │User     │
    │Rules    │ │Props    │ │Health   │ │Coverage │ │Input    │
    └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘
          │         │         │         │         │         │
          ▼         ▼         ▼         ▼         ▼         ▼
    ┌──────────────────────────────────────────────────────────┐
    │              WORKFLOW LOADER                             │
    │            (workflow-loader.ts)                          │
    │                                                          │
    │  loadAllWorkflows() → 60 workflows                       │
    │  extractPathway()                                        │
    │  extractIntegrations()                                   │
    │  extractInputs()                                         │
    └──────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │   60 Workflows    │
                    │  /workflows/src/  │
                    └──────────────────┘
```

## Component Breakdown

### 1. Coordinator (`coordinator.ts`)

**Responsibilities**:
- Register all audit executors
- Distribute work to Workers (parallel or sequential)
- Aggregate AuditReports from all Workers
- Generate combined reports
- Create Beads issues for findings

**Key Functions**:
```typescript
async function runAllAudits(config: CoordinatorConfig): Promise<Map<string, AuditReport>>
async function generateMarkdownReports(reports, outputPath): Promise<void>
async function generateJsonReports(reports, outputPath): Promise<void>
async function createBeadsIssues(reports): Promise<void>
function printSummary(reports): void
```

**Execution Flow**:
1. Load config (paths, flags, options)
2. Create audit executors (8 instances)
3. Execute audits (parallel: Promise.all, sequential: for loop)
4. Generate reports (Markdown + JSON)
5. Create Beads issues (if enabled)
6. Print summary to console

### 2. Workers (8 Audit Executors)

All implement the `AuditExecutor` interface:

```typescript
interface AuditExecutor {
  name: string;
  description: string;
  execute(config: AuditConfig): Promise<AuditReport>;
}
```

#### Worker 1: Scoring Rules (`scoring-rules.ts`)

**Purpose**: Review nameKeywords and scoring tiers

**Checks**:
- Tier consistency (excellent: 0.7, good: 0.5, fair: 0.3)
- Keyword semantic appropriateness
- Strong vs. moderate keyword classification
- Duplicate keywords across levels

**Output**: 0 findings (workflows already compliant)

#### Worker 2: Required Properties (`required-properties.ts`)

**Purpose**: Validate requiredProperties match use cases

**Checks**:
- Missing requiredProperties config
- Property alignment with workflow category
- Property weight distribution
- Maximum single property weight (<0.5)
- Total weight range (0.3-1.5)

**Output**: 9 findings (missing configurations)

#### Worker 3: API Endpoint Health (`api-endpoint-health.ts`)

**Purpose**: Check API endpoint URLs for validity

**Checks**:
- Malformed URLs
- HTTP method validation (GET, POST, PUT, DELETE, PATCH)
- Deprecated endpoints
- Response code handling

**Output**: 0 findings (all endpoints valid)

#### Worker 4: OAuth Provider Coverage (`oauth-provider-coverage.ts`)

**Purpose**: Verify OAuth providers match integrations

**Checks**:
- Missing OAuth configs for integrations
- Scope mismatches
- Duplicate provider registrations
- Required scope coverage

**Output**: 0 findings (all providers configured)

#### Worker 5: User Input Field Quality (`user-input-field-quality.ts`)

**Purpose**: Review user_input step fields for UX quality

**Checks**:
- Label length (max 50 chars)
- Verbose label indicators
- Description presence and quality (min 20 chars)
- Placeholder vs. actual defaults
- Type-specific validation (email, URL)

**Output**: 0 findings (all fields meet standards)

#### Worker 6: Error Message Helpfulness (`error-message-helpfulness.ts`)

**Purpose**: Audit failureMessage strings for actionability

**Checks**:
- Vague error indicators
- Actionable indicators
- Message length (20-200 chars)
- Technical jargon
- Context appropriateness

**Output**: 5 findings (non-actionable messages)

#### Worker 7: Schema Consistency (`schema-consistency.ts`)

**Purpose**: Verify naming conventions across workflows

**Checks**:
- Version format (semantic versioning)
- Step type naming (canonical vs. variants)
- Config wrapper usage ("config" vs. "inputs")
- Step name conventions (snake_case)
- Field name conventions (camelCase)

**Output**: 409 findings (naming violations, 100% auto-fixable)

#### Worker 8: Field Mapping Completeness (`field-mapping-completeness.ts`)

**Purpose**: Check field mappings for resource_selection steps

**Checks**:
- Missing fieldMappings config
- Critical missing mappings (by integration)
- Mappings to non-existent properties
- Duplicate target properties
- Identity mappings

**Output**: 0 findings (all mappings complete)

### 3. Workflow Loader (`workflow-loader.ts`)

**Responsibilities**:
- Load all workflow files from directory
- Extract metadata (name, description, version)
- Parse workflow content (pathway, integrations, inputs)

**Key Functions**:
```typescript
async function loadAllWorkflows(path: string): Promise<LoadedWorkflow[]>
function extractPathway(content: string): Record<string, unknown> | null
function extractIntegrations(content: string): Array<{service, scopes}>
function extractInputs(content: string): Record<string, InputField>
```

**Extraction Strategy**: Regex-based parsing (current), AST-based parsing (future)

### 4. Types (`types.ts`)

**Shared Interfaces**:
```typescript
interface WorkflowMetadata {
  id: string;
  name: string;
  description?: string;
  version?: string;
  category?: string;
  featured?: boolean;
  visibility?: 'public' | 'private';
  filePath: string;
}

interface AuditFinding {
  workflowId: string;
  workflowName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  issue: string;
  recommendation: string;
  autoFixable: boolean;
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
  labels: string[];
  filePath: string;
  context?: Record<string, unknown>;
}

interface AuditReport {
  auditType: string;
  executedAt: string;
  totalWorkflows: number;
  workflowsAudited: number;
  findingsCount: number;
  findings: AuditFinding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    autoFixable: number;
  };
  metadata?: Record<string, unknown>;
}
```

**Helper Functions**:
```typescript
function severityToPriority(severity): priority
function createAuditReport(type, findings, totalWorkflows): AuditReport
```

## Data Flow

```
Input (CLI)
   │
   ▼
Config
   │
   ▼
Coordinator
   │
   ├─► Worker 1 ──┐
   ├─► Worker 2   │
   ├─► Worker 3   │
   ├─► Worker 4   ├──► Workflow Loader ──► 60 Workflows
   ├─► Worker 5   │
   ├─► Worker 6   │
   ├─► Worker 7   │
   └─► Worker 8 ──┘
   │
   ▼
AuditReport[] (8 reports)
   │
   ├─► Markdown Reports (8 files)
   ├─► JSON Reports (8 files)
   ├─► Combined JSON (1 file)
   └─► Beads Issues (optional, N issues)
```

## Execution Modes

### Parallel Mode (default)

```typescript
const promises = AUDIT_EXECUTORS.map(executor => executor.execute(config));
const results = await Promise.all(promises);
```

**Characteristics**:
- 8 Workers execute concurrently
- ~2 seconds execution time
- Higher memory usage (~150MB)
- 4 CPU cores utilized

**Use Case**: Production runs, CI/CD

### Sequential Mode (`--sequential`)

```typescript
for (const executor of AUDIT_EXECUTORS) {
  const report = await executor.execute(config);
}
```

**Characteristics**:
- 8 Workers execute one at a time
- ~2.5 seconds execution time
- Lower memory usage (~80MB)
- 1 CPU core utilized

**Use Case**: Debugging, low-resource environments

## Report Generation

### Markdown Reports

**Structure**:
```markdown
# AUDIT-NAME Audit Report

**Executed:** ISO timestamp
**Total Workflows:** N
**Findings:** M

## Summary
[Severity table]

## Critical Severity Findings
[Individual findings with context]

## High Severity Findings
...
```

**Output**: `/audit-reports/{audit-name}-report.md`

### JSON Reports

**Structure**:
```json
{
  "auditType": "audit-name",
  "executedAt": "ISO timestamp",
  "totalWorkflows": N,
  "findingsCount": M,
  "findings": [...],
  "summary": {...}
}
```

**Output**: `/audit-reports/{audit-name}-report.json`

### Combined JSON Report

**Structure**:
```json
{
  "executedAt": "ISO timestamp",
  "audits": [8 audit reports],
  "summary": {
    "totalAudits": 8,
    "totalFindings": N,
    "bySeverity": {...},
    "autoFixable": M
  }
}
```

**Output**: `/audit-reports/audit-suite-combined.json`

## Beads Integration

**When**: `--create-issues` flag enabled

**Logic**:
- Skip low severity findings (unless auto-fixable)
- Create one issue per finding
- Title: `[audit-name] Workflow: Issue`
- Priority: Auto-assigned from severity
- Labels: From finding.labels array
- Context: JSON in issue body

**Implementation**: Placeholder (requires bd CLI integration)

## Extension Points

### Adding a New Audit

1. **Create Executor File**: `src/audits/my-audit.ts`

```typescript
export class MyAuditor implements AuditExecutor {
  name = 'my-audit';
  description = 'What this audits';

  async execute(config: AuditConfig): Promise<AuditReport> {
    const workflows = await loadAllWorkflows(config.workflowsPath);
    const findings: AuditFinding[] = [];

    // Audit logic here

    return createAuditReport(this.name, findings, workflows.length);
  }
}
```

2. **Register in Coordinator**: `src/audits/coordinator.ts`

```typescript
import { MyAuditor } from './my-audit';

const AUDIT_EXECUTORS = [
  // ... existing auditors
  new MyAuditor(),
];
```

3. **Export**: `src/audits/index.ts`

```typescript
export { MyAuditor } from './my-audit';
```

4. **Test**: `pnpm exec tsx src/audits/test-suite.ts`

### Custom Report Formats

Override `generateMarkdownReport()` or `generateJsonReports()` in coordinator.ts

### Custom Filters

Add to `AuditConfig`:
```typescript
interface AuditConfig {
  filterCategory?: string;
  filterVisibility?: 'public' | 'private';
  filterWorkflowIds?: string[];
}
```

## Performance Characteristics

**Workflow Loading**: O(n) where n = number of workflows
**Audit Execution**: O(n*m) where m = complexity of audit logic
**Report Generation**: O(f) where f = number of findings

**Bottlenecks**:
- Workflow loading (file I/O)
- Regex-based parsing (CPU-bound)

**Optimizations**:
- Parallel execution reduces wall-clock time
- Shared workflow loader (load once, use across audits)
- Lazy evaluation (skip irrelevant workflows)

## Error Handling

**Strategy**: Fail-fast for critical errors, continue for audit-level errors

```typescript
try {
  const report = await executor.execute(config);
} catch (error) {
  console.error(`Failed: ${executor.name}`, error);
  // Log error, continue with other audits
}
```

**Error Types**:
- File system errors (workflow loading)
- Parsing errors (invalid TypeScript)
- Logic errors (audit implementation bugs)

## Security Considerations

**Code Execution**: No dynamic code execution (static analysis only)
**File System**: Read-only access to workflow files
**Network**: No network requests (offline operation)
**Secrets**: No secret detection (future enhancement)

## Testing

**Test Suite**: `src/audits/test-suite.ts`

**Validates**:
- All 8 audits registered
- All audits executable
- All audits return AuditReport
- Dry-run mode works

**Run**: `pnpm exec tsx src/audits/test-suite.ts`

## Monitoring

**Metrics to Track**:
- Total findings per audit
- Findings by severity
- Auto-fixable percentage
- Execution time per audit
- Trends over time

**Dashboard** (future): Visualize quality metrics across sprints

## Philosophy Alignment

**Zuhandenheit**: The audit suite recedes. One command → comprehensive quality assessment. The mechanism is invisible.

**Weniger, aber besser**: 8 focused audits beat 50 superficial checks. Each has clear purpose, actionable output.

**Gas Town Coordinator**: Multiple autonomous Workers collaborate without central state. Scales to 10+ audits without architectural changes.
