# DRY Violations in packages/harness

Manual analysis found the following Don't Repeat Yourself violations.

## 🔴 CRITICAL: `bd()` Function Duplicated (3 instances)

**Severity:** Critical
**Effort to Fix:** Low
**Duplicated Lines:** ~15 lines × 3 files = 45 lines

### Locations:
1. `packages/harness/src/beads.ts:65-81` (17 lines)
2. `packages/harness/src/hook-queue.ts:36-47` (12 lines)
3. `packages/harness/src/molecule.ts:33-44` (12 lines)

### Code:
```typescript
// beads.ts
async function bd(args: string, cwd?: string): Promise<string> {
  try {
    if (!bdPath) {
      bdPath = await findBdPath();
    }
    const { stdout } = await execAsync(`${bdPath} ${args}`, {
      cwd: cwd || process.cwd(),
      env: { ...process.env },
    });
    return stdout.trim();
  } catch (error) {
    const err = error as { stderr?: string; message: string };
    throw new Error(`bd command failed: ${err.stderr || err.message}`);
  }
}

// hook-queue.ts (nearly identical)
async function bd(args: string, cwd?: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`bd ${args}`, {
      cwd: cwd || process.cwd(),
      env: { ...process.env },
    });
    return stdout.trim();
  } catch (error) {
    const err = error as { stderr?: string; message: string };
    throw new Error(`bd command failed: ${err.stderr || err.message}`);
  }
}

// molecule.ts (slightly different signature)
async function bd(args: string[], cwd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`bd ${args.join(' ')}`, {
      cwd,
      env: { ...process.env },
    });
    return stdout.trim();
  } catch (error) {
    const err = error as { stderr?: string; message: string };
    throw new Error(`bd command failed: ${err.stderr || err.message}`);
  }
}
```

### Recommendation:
Extract to a shared utility module:

```typescript
// packages/harness/src/lib/bd-client.ts
import { execAsync } from './exec.js';

let bdPath: string | null = null;

async function findBdPath(): Promise<string> {
  // ... existing implementation from beads.ts:33-63
}

export async function bd(args: string | string[], cwd?: string): Promise<string> {
  try {
    // Find bd path on first use
    if (!bdPath) {
      bdPath = await findBdPath();
    }

    const argsString = Array.isArray(args) ? args.join(' ') : args;
    const { stdout } = await execAsync(`${bdPath} ${argsString}`, {
      cwd: cwd || process.cwd(),
      env: { ...process.env },
    });
    return stdout.trim();
  } catch (error) {
    const err = error as { stderr?: string; message: string };
    throw new Error(`bd command failed: ${err.stderr || err.message}`);
  }
}
```

Then replace all 3 instances with:
```typescript
import { bd } from './lib/bd-client.js';
```

### Benefits:
- Single source of truth for `bd` command execution
- Consistent error handling across all files
- Easier to add features (e.g., retries, logging, timeouts)
- Reduced maintenance burden

---

## Summary

| Severity | Count | Estimated Effort |
|----------|-------|------------------|
| Critical | 1 | 1 hour |
| High | 0 | - |
| Medium | 0 | - |
| Low | 0 | - |

**Total Effort:** ~1 hour to create `packages/harness/src/lib/bd-client.ts` and refactor 3 files.

**Immediate Action:** This is a clear DRY violation that should be fixed. The `bd()` function is core infrastructure used throughout the harness package.
