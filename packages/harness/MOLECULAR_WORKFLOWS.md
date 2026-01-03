# Molecular Workflows - Step-Level State Tracking

**Issue**: Cloudflare-ejbe
**Date**: 2026-01-03
**Status**: Complete

## Summary

Implemented step-level state tracking for crash-resilient workflow execution, inspired by GAS TOWN's molecular formulas. This fills the gap identified in `docs/GASTOWN_EVALUATION.md` Phase 2:

- Session-level tracking (current) → Step-level tracking (new)
- Manual resume (current) → Auto-resume from last successful step (new)
- Coarse granularity → Fine-grained crash recovery

## Architecture

### Molecule Structure

```typescript
interface Molecule {
  id: string;
  title: string;
  parentIssueId: string;  // Beads epic/container issue
  steps: MoleculeStep[];
  state: 'pending' | 'in_progress' | 'complete' | 'failed' | 'paused';
  metadata: MoleculeMetadata;
}

interface MoleculeStep {
  id: string;
  title: string;
  state: 'pending' | 'in_progress' | 'complete' | 'failed' | 'skipped';
  dependsOn: string[];        // Step dependencies
  issueId?: string;           // Beads issue for this step
  checkpoint?: MoleculeStepCheckpoint;  // Crash recovery data
  retryCount: number;
  maxRetries: number;
}

interface MoleculeStepCheckpoint {
  filesModified: string[];
  gitCommit?: string;
  testsPassed: boolean;
  notes: string;
  capturedAt: string;
}
```

### State Persistence

Molecule state is stored in the parent issue's description as an HTML comment:

```markdown
<!-- MOLECULE_STATE
{
  "id": "mol-1234567890",
  "title": "Auth Refactor",
  "steps": [...],
  "state": "in_progress"
}
-->
```

This approach:
- Uses Beads SQLite as single source of truth
- Survives daemon restarts
- Avoids separate state files
- Enables crash recovery from Beads data alone

## API Usage

### Creating a Molecule

```typescript
import { createMoleculeManager } from '@workwayco/harness';

const manager = createMoleculeManager('/path/to/repo', {
  createStepIssues: true,      // Auto-create Beads issues for steps
  captureCheckpoints: true,    // Capture checkpoint data
  autoCommit: false,           // Manual commit control
  defaultMaxRetries: 2,
});

const molecule = await manager.createMolecule(
  'parent-issue-id',           // Existing Beads issue (epic)
  'My Workflow',
  [
    { id: 'step1', title: 'Setup database' },
    { id: 'step2', title: 'Add API endpoint', dependsOn: ['step1'] },
    { id: 'step3', title: 'Add tests', dependsOn: ['step2'] },
  ],
  {
    createdBy: 'agent-1',
    labels: ['refactor', 'auth'],
  }
);
```

### Executing Steps

```typescript
// Get next executable step
const result = await manager.advanceMolecule(molecule);
if (result.success && result.nextStep) {
  const step = result.nextStep;

  // Start step
  await manager.startStep(molecule, step.id);

  try {
    // Execute work...
    const filesModified = await performWork(step);

    // Complete with checkpoint
    await manager.completeStep(molecule, step.id, {
      filesModified,
      gitCommit: await getHeadCommit(),
      testsPassed: true,
      notes: 'Step completed successfully',
      capturedAt: new Date().toISOString(),
    });
  } catch (error) {
    // Fail step (will retry if retryCount < maxRetries)
    await manager.failStep(molecule, step.id, error.message);
  }
}
```

### Crash Recovery

```typescript
// Load molecule from Beads
const molecule = await manager.loadMolecule('parent-issue-id');

if (molecule) {
  // Resume from crash (finds in_progress steps)
  const result = await manager.resumeMolecule(molecule);

  if (result.success && result.nextStep) {
    console.log(`Resuming from step: ${result.nextStep.title}`);
    // Continue execution...
  }
}
```

### Progress Tracking

```typescript
const progress = manager.getMoleculeProgress(molecule);

console.log(`Progress: ${progress.percentComplete}%`);
console.log(`Complete: ${progress.complete}/${progress.total}`);
console.log(`In Progress: ${progress.inProgress}`);
console.log(`Failed: ${progress.failed}`);
```

## Integration with Harness

### Coordinator Integration

The Coordinator can spawn molecules for multi-step workflows:

```typescript
const coordinator = new Coordinator(harnessState, {
  cwd: process.cwd(),
  maxWorkers: 1,
});

// Create molecule from spec
const molecule = await moleculeManager.createMolecule(
  harnessState.id,
  spec.title,
  spec.features.map(f => ({
    id: f.id,
    title: f.title,
    dependsOn: f.dependsOn,
  })),
  { createdBy: 'harness', labels: ['harness'] }
);

// Assign step to worker
const result = await moleculeManager.advanceMolecule(molecule);
if (result.success) {
  await worker.execute(result.nextStep);
}
```

### Worker Integration

Workers execute molecule steps with automatic checkpoint capture:

```typescript
class Worker {
  async executeStep(molecule: Molecule, step: MoleculeStep) {
    await moleculeManager.startStep(molecule, step.id);

    // Track file modifications
    const tracker = this.createTracker();

    // Execute work
    await this.runSession(step);

    // Capture checkpoint
    const checkpoint = {
      filesModified: tracker.getModifiedFiles(),
      gitCommit: await getHeadCommit(),
      testsPassed: await runTests(),
      notes: tracker.getNotes(),
      capturedAt: new Date().toISOString(),
    };

    await moleculeManager.completeStep(molecule, step.id, checkpoint);
  }
}
```

## Differences from Session-Level Tracking

| Feature | Session-Level | Step-Level (Molecules) |
|---------|---------------|----------------------|
| **Granularity** | Per feature (coarse) | Per step (fine) |
| **Crash Recovery** | Manual resume with AgentContext | Auto-resume from last step |
| **State Persistence** | `.harness/` directory files | Beads issue descriptions |
| **Dependencies** | Issue-level (Beads deps) | Step-level (within molecule) |
| **Retry Logic** | Session-level retry | Step-level retry |
| **Progress Tracking** | Feature completion % | Step completion % |

## Files Added

| File | Purpose | Lines |
|------|---------|-------|
| `src/molecule.ts` | MoleculeManager implementation | 452 |
| `src/__tests__/molecule.test.ts` | Test suite | 419 |
| `src/types.ts` | Molecule type definitions | +140 |

## Files Modified

| File | Changes |
|------|---------|
| `src/index.ts` | Added molecule exports |
| `src/types.ts` | Added molecular workflow types |

## Testing

```bash
pnpm test

✓ src/__tests__/molecule.test.ts (12 tests)
  ✓ createMolecule - creates molecule with steps
  ✓ getNextStep - returns first step with no dependencies
  ✓ getNextStep - returns second step after first completes
  ✓ getNextStep - returns null when no steps ready
  ✓ startStep - transitions step to in_progress
  ✓ completeStep - transitions step to complete with checkpoint
  ✓ failStep - retries step on first failure
  ✓ failStep - marks step as failed after max retries
  ✓ advanceMolecule - returns next executable step
  ✓ advanceMolecule - indicates completion when all steps done
  ✓ resumeMolecule - resumes from in_progress step after crash
  ✓ getMoleculeProgress - calculates progress correctly
```

All 60 tests pass (including existing tests).

## Philosophy Alignment

**Zuhandenheit**: Molecules recede into transparent operation. The harness creates molecules, workers execute steps, crashes are handled invisibly. The mechanism disappears; reliability remains.

**Weniger, aber besser**: One class (MoleculeManager), clear responsibility (step-level state tracking). No over-engineering. Simple, effective, testable.

## Future Enhancements

1. **Parallel Step Execution**: Execute independent steps concurrently
2. **Step Timeouts**: Auto-fail steps that exceed time limits
3. **Step Hooks**: Pre/post step hooks for custom logic
4. **Molecule Templates**: Reusable molecule patterns (Protos)
5. **Visual Progress**: CLI/Web UI for molecule visualization

## References

- **Evaluation**: `docs/GASTOWN_EVALUATION.md` Phase 2
- **GAS TOWN**: `github.com/steveyegge/gastown`
- **Issue**: `Cloudflare-ejbe`
- **Dependencies**: Beads v0.43.0+

## Success Criteria (All Met)

- ✅ Step-level state tracking works
- ✅ Crash recovery at step granularity
- ✅ Auto-resume from last successful step
- ✅ TypeScript types clean
- ✅ Tests pass (12/12 molecule tests, 60/60 total)
- ✅ Integration with Beads molecules
- ✅ Checkpoint-to-molecule mapping
