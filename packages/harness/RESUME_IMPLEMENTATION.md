# Harness Resume Implementation

## Summary

Successfully implemented the harness resume functionality that was previously a stub. The harness can now pause and resume workflows by storing and loading state from Beads issues.

## Implementation Details

### 1. State Persistence

**Harness Issue Format** (`beads.ts`):
- Updated `createHarnessIssue()` to include git branch in description
- Description format:
  ```
  Harness run for: <spec-file>
  Features: <count>
  Branch: <git-branch>
  Started: <timestamp>
  ```

### 2. State Loading

**`loadHarnessState()` function** (`runner.ts:572-628`):
- Parses harness issue description to extract:
  - Spec file path
  - Git branch name (with fallback)
  - Harness mode (workflow/platform)
- Counts completed/failed features from associated issues
- Reconstructs HarnessState object with accurate progress

**`loadCheckpointContext()` function** (`runner.ts:634-676`):
- Finds most recent checkpoint issue
- Parses checkpoint description to extract:
  - Summary
  - Completed issues list
  - In-progress issues list
  - Failed issues list
  - Confidence score
  - Git commit hash
  - Redirect notes
- Returns Checkpoint object for session priming

### 3. Resume Flow

**`resumeHarness()` function** (`runner.ts:685-738`):
1. Auto-detect harness ID if not provided (uses most recent)
2. Stop bd daemon (prevent sync conflicts)
3. Load harness state from issue
4. Load checkpoint context
5. Checkout git branch if it exists
6. Resume harness loop via `runHarness()`

### 4. CLI Integration

The CLI already had a `resume` command that now works:
```bash
pnpm harness resume              # Resume most recent harness
pnpm harness resume --id ww-123  # Resume specific harness
```

## Tests

Created comprehensive unit tests in `src/__tests__/resume.test.ts`:
- Spec file parsing
- Git branch extraction
- Checkpoint summary parsing
- Confidence score parsing
- Session number extraction
- Issue list parsing
- Git commit hash parsing
- Redirect notes parsing
- Workflow mode detection

All 10 tests pass.

## Files Modified

1. **`src/runner.ts`**:
   - Added `loadHarnessState()` function
   - Added `loadCheckpointContext()` function
   - Implemented `resumeHarness()` (replaced stub)
   - Added imports for `getIssue` and `getHarnessCheckpoints`

2. **`src/beads.ts`**:
   - Updated `createHarnessIssue()` to accept and store git branch

3. **`package.json`**:
   - Added vitest dev dependency
   - Added test scripts

4. **`vitest.config.ts`** (new):
   - Configured vitest for Node environment

5. **`src/__tests__/resume.test.ts`** (new):
   - Unit tests for parsing logic

## Verification

Build and tests pass:
```bash
pnpm build   # ✅ Success
pnpm test    # ✅ 10/10 tests pass
```

## Usage Example

### Pause and Resume a Harness

1. Start a harness:
   ```bash
   pnpm harness start specs/feature.yaml --mode platform
   ```

2. Pause it (via `bd` or automatic trigger):
   ```bash
   bd create "Pause requested" --labels pause,harness:<id>
   ```

3. Resume it:
   ```bash
   pnpm harness resume
   # or
   pnpm harness resume --id <harness-id>
   ```

### What Gets Restored

- Git branch (auto-checkout if exists)
- Spec file path
- Completed features count
- Failed features count
- Last checkpoint context
- Harness mode (workflow/platform)
- Checkpoint policy

### What Continues

- Picks up next unblocked feature
- Uses same git branch
- References previous checkpoint in session priming
- Maintains confidence tracking

## Key Design Decisions

1. **State in Beads**: Store state in Beads issue descriptions (not separate files)
   - Single source of truth
   - Git-syncable via Beads JSONL
   - Human-readable

2. **Automatic Branch Detection**: Falls back to generated branch name if not found
   - Graceful degradation
   - Prevents errors on missing branches

3. **Checkpoint Restoration**: Loads most recent checkpoint for context
   - Provides continuity across pause/resume
   - Helps session priming

4. **Auto-detect Harness**: Resume without ID uses most recent
   - Better UX for single-harness workflows
   - Explicit ID still supported

## Future Enhancements

1. **AgentContext Integration**: Spec mentions AgentContext schema for richer state
   - File modifications
   - Decisions made
   - Test state
   - Not yet implemented

2. **Resume Brief Generation**: Generate markdown summary for session priming
   - Mentioned in spec but not implemented
   - Would use checkpoint context

3. **Integration Tests**: Current tests are unit tests
   - Could add E2E tests with real Beads instance
   - Would test full pause/resume cycle
