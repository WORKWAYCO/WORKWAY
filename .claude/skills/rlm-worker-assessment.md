---
name: rlm-worker-assessment
description: Use RLM to comprehensively assess Gas Town worker outputs
---

# RLM Worker Assessment Skill

Use RLM (Recursive Language Model) to analyze ALL Gas Town worker outputs for quality, completeness, security, and git hygiene.

## When to Use

- After Gas Town workers complete (Witness/Observer role)
- Manual quality checks of worker outputs
- Post-mortem analysis of completed Gas Town runs
- Before merging worker contributions

## How It Works

RLM processes the complete context of all worker outputs (10M+ tokens capacity) rather than sampling. This enables:
- Detection of cross-worker inconsistencies
- Identification of systemic patterns
- Comprehensive security analysis
- Complete coverage vs partial sampling

## Usage

### From TypeScript/Node.js

```typescript
import { assessWorkers, formatAssessmentResult } from '@workwayco/harness/rlm-assessment';

// Assess specific workers
const result = await assessWorkers(['a548b2a', 'aaca4cf', 'a40570f']);

// Print formatted output
console.log(formatAssessmentResult(result));

// Access structured data
for (const worker of result.workers) {
  console.log(`${worker.workerId}: ${worker.overallScore}/100`);

  const critical = worker.issues.filter(i => i.severity === 'critical');
  if (critical.length > 0) {
    console.log(`  ⚠️  ${critical.length} critical issues`);
  }
}
```

### From Command Line (Phase 4)

```bash
# Assess latest Gas Town run
workway rlm assess

# Assess specific workers
workway rlm assess --workers a548b2a,aaca4cf,a40570f

# JSON output for programmatic use
workway rlm assess --json

# Verbose mode (show RLM trajectory)
workway rlm assess --verbose
```

## Assessment Criteria

### Code Quality (0-100)
- DRY violations (repeated code patterns)
- Proper use of existing patterns
- TypeScript best practices
- Error handling

### Completeness (0-100)
- Acceptance criteria met
- All requested features implemented
- Edge cases handled
- Tests written

### Security (0-100)
- Authentication patterns correct
- Input validation present
- No secret leaks
- SQL injection prevention

### Git Hygiene (0-100)
- Commit messages clear and descriptive
- File organization proper
- No unnecessary files committed
- Commit granularity appropriate

## Issue Severity Levels

- **CRITICAL**: Security vulnerabilities, data loss risks, breaking changes
- **HIGH**: Major bugs, missing acceptance criteria, bad patterns
- **MEDIUM**: DRY violations, minor bugs, incomplete tests
- **LOW**: Code style, minor improvements, documentation

## Example Output

```
📊 Gas Town Worker Assessment

============================================================
Worker: a548b2a
Overall Score: 85/100
  Code Quality:  90/100
  Completeness:  80/100
  Security:      95/100
  Git Hygiene:   75/100

Summary: Strong implementation with comprehensive observability infrastructure.

Issues (2):
  🟠 [HIGH] Missing Phase 3.3 (R2 storage) implementation
  🟡 [MEDIUM] Consider adding integration tests for SLI queries

============================================================
Aggregate Findings
Total Issues: 6
Critical Issues: 0

Common Patterns:
  ✓ Excellent error handling across all workers
  ✓ Consistent TypeScript patterns
  ✓ Proper git commit messages

Recommendations:
  → Add integration tests for Phase 3 implementations
  → Consider consolidating similar error handling logic

============================================================
RLM Metrics
Iterations: 8
Sub-calls: 24
Cost: $0.18
Duration: 45.2s
```

## Cost Estimation

| Workers | Context Size | Estimated Cost | Duration |
|---------|--------------|----------------|----------|
| 1-3 | ~500K chars | $0.10-0.15 | 30-45s |
| 4-6 | ~1M chars | $0.15-0.30 | 45-90s |
| 7-10 | ~2M chars | $0.30-0.50 | 90-120s |

**Compare to**: Manual review of 6 workers takes 2-3 hours (~$200-300 engineer time)

## Technical Details

**RLM Configuration**:
- Root Model: Sonnet (planning and synthesis)
- Sub Model: Haiku (chunk analysis)
- Max Iterations: 15
- Max Sub-Calls: 80

**Output Directory**: `/private/tmp/claude/-Users-micahjohnson-Documents-Github-WORKWAY/tasks/*.output`

## Integration with Gas Town

### Witness/Observer Pattern

The Observer (Witness) calls RLM assessment after all workers complete:

```typescript
// In packages/harness/src/witness.ts
import { assessWorkers } from './rlm-assessment';

class Witness {
  async observeCompletion(workerIds: string[]) {
    // RLM assessment
    const assessment = await assessWorkers(workerIds);

    // Create issues for critical findings
    for (const worker of assessment.workers) {
      const critical = worker.issues.filter(i => i.severity === 'critical');

      for (const issue of critical) {
        await createBeadsIssue({
          title: `[RLM] ${issue.message}`,
          type: 'bug',
          priority: 'P0',
          label: `worker:${worker.workerId}`,
        });
      }
    }

    return assessment;
  }
}
```

## Limitations

- Requires Python 3.11+ with `workway_rlm` package installed
- Requires `ANTHROPIC_API_KEY` environment variable
- Output files must be in standard Gas Town location
- Large contexts (>5M chars) may take 2+ minutes

## References

- [RLM Integration Analysis](../../docs/RLM_INTEGRATION_ANALYSIS.md)
- [MIT CSAIL Paper](https://arxiv.org/abs/2512.24601)
- [Gas Town Implementation](../packages/harness/GASTOWN_IMPLEMENTATION.md)
