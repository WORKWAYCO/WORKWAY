# GAS TOWN Integration Evaluation

**Date**: 2026-01-03
**Issue**: Cloudflare-066n
**Context**: Evaluating GAS TOWN (github.com/steveyegge/gastown) integration strategy for WORKWAY

---

## Executive Summary

**Recommendation**: **Merge Concepts** with selective adoption of GAS TOWN's role-based architecture.

WORKWAY's existing `@workwayco/harness` provides solid foundations for autonomous multi-session work. GAS TOWN offers valuable architectural patterns for scale (20-30 agents) and resilience, but full adoption would introduce Go dependencies and architectural complexity beyond WORKWAY's current needs.

**Strategic Path**: Evolve the harness incrementally, borrowing GAS TOWN's proven patterns while maintaining TypeScript/Beads foundations.

---

## Architecture Comparison

### WORKWAY Harness (Current)

| Component | Implementation | Maturity |
|-----------|---------------|----------|
| **Issue Tracking** | Beads v0.43.0 (bd CLI + SQLite) | Production |
| **Session Management** | TypeScript runner spawning Claude Code | Working |
| **Progress Tracking** | Checkpoint system (every 3 sessions / 4 hours) | Working |
| **Quality Gates** | Two-stage completion (code-complete → verified) | Working |
| **Agent Coordination** | Single autonomous agent per harness run | Basic |
| **Resume/Crash Recovery** | AgentContext schema, manual resume | Partial |
| **Scale** | 1 agent per harness, 4-10 concurrent (estimated) | Limited |
| **Dependencies** | Node.js 18+, Beads, Claude Code CLI | Minimal |

**Strengths**:
- Deep Beads integration (bd CLI abstraction prevents sync conflicts)
- Zuhandenheit philosophy embedded (tool recedes)
- Working two-stage verification
- DRY context discovery prevents code duplication
- Scope guard enforces one-feature-per-session

**Weaknesses**:
- No role-based agent specialization
- Limited crash resilience (manual resume required)
- Single-agent bottleneck
- No merge queue for concurrent work
- No inter-agent coordination primitives

### GAS TOWN (Evaluation Target)

| Component | Implementation | Value for WORKWAY |
|-----------|---------------|-------------------|
| **Role-Based Agents** | Mayor (coordinator), Polecats (workers), Witness (monitor), Refinery (merge queue), Deacon (daemon) | High - enables specialization |
| **Molecular Workflows** | Formulas expand into molecules with crash-resilient step tracking | High - complements Beads molecules |
| **Convoy System** | Groups related work across projects | Medium - cross-repo already solved via Beads |
| **Hook System** | Work hangs on "hooks" for crash recovery | High - better than manual resume |
| **Scale** | 20-30 concurrent agents with tmux sessions | Medium - aspirational for WORKWAY |
| **Dependencies** | Go 1.23+, tmux 3.0+, Beads, Claude Code CLI | Medium - adds language complexity |

**Architectural Insights**:
- **Mayor/Polecat separation** prevents context sprawl (Mayor delegates, doesn't execute)
- **Refinery** solves concurrent merge conflicts (queue + validation)
- **Hooks** enable stateless agent recovery (work persists, agents restart)
- **Witness** provides real-time observability without blocking execution
- **Deacon** manages daemon lifecycle (prevents sync conflicts like WORKWAY does)

---

## Component-by-Component Analysis

### 1. Role-Based Agents

**GAS TOWN Pattern**:
```
Mayor (Coordinator)
  ├─ Assigns work to Polecats
  ├─ Monitors progress via Witness
  └─ Never executes work directly (prevents context overflow)

Polecat (Worker)
  ├─ Claims work from queue
  ├─ Executes in isolated tmux session
  └─ Commits to Refinery merge queue

Witness (Monitor)
  ├─ Observes agent state
  └─ Reports to Mayor

Refinery (Merge Queue)
  ├─ Validates commits
  └─ Resolves conflicts

Deacon (Daemon Manager)
  └─ Manages Beads daemon lifecycle
```

**WORKWAY Current**:
- Single harness runner spawns Claude Code sessions sequentially
- No role separation (harness does coordination + execution)
- Daemon management exists (stop at start, restart at end)

**Adoption Strategy**:
- **Adopt**: Separate coordinator from worker execution (prevents context sprawl)
- **Defer**: Multi-agent Polecats until scale demands (4-10 agents sufficient now)
- **Adopt**: Witness pattern for observability (non-blocking progress monitoring)
- **Adopt**: Refinery pattern for merge queue (enables parallel work)
- **Keep**: Deacon-equivalent daemon management (already working)

**Implementation Path**:
1. Extract coordinator logic from `runner.ts` into `coordinator.ts`
2. Create `Worker` class that wraps session execution
3. Add `MergeQueue` class for validating concurrent commits
4. Add `Observer` class for non-blocking progress monitoring
5. Keep TypeScript (no Go dependency yet)

---

### 2. Molecular Workflows

**GAS TOWN Pattern**:
- **Formulas**: Reusable workflow templates (like WORKWAY specs)
- **Molecules**: Expanded instances with crash-resilient step tracking
- **Steps**: Atomic units with status (pending/in-progress/complete/failed)

**WORKWAY Current**:
- **Specs**: YAML/Markdown project definitions
- **Features**: Issue-based tracking via Beads
- **Sessions**: Execution units (not crash-resilient)

**Beads v0.43.0 Already Has**:
- **Protos**: Reusable templates (solid phase)
- **Mols**: Persistent molecules (liquid phase)
- **Wisps**: Ephemeral molecules (vapor phase)

**Gap Analysis**:
- GAS TOWN molecules track **step-level state** (finer granularity)
- WORKWAY tracks **session-level state** (coarser granularity)
- GAS TOWN molecules are **crash-resilient** (steps persist)
- WORKWAY sessions require **manual resume** (AgentContext schema)

**Adoption Strategy**:
- **Adopt**: Step-level state tracking within Beads molecules
- **Integrate**: Map GAS TOWN steps to Beads molecule issues
- **Enhance**: Add crash recovery to session execution (resume from last step)

**Implementation Path**:
1. Extend Beads molecules to track step-level progress (use `bd set-state`)
2. Add checkpoint-to-molecule mapping (link checkpoints to mol steps)
3. Implement auto-resume from last successful step (read mol state)
4. Use Beads `gate` command for async coordination between steps

---

### 3. Convoy System

**GAS TOWN Pattern**:
- Groups related work across multiple projects
- Tracks cross-project dependencies
- Coordinates multi-repo workflows

**WORKWAY Current**:
- Cross-repo work via `ww-*` (Cloudflare) and `wwp-*` (workway-platform) prefixes
- Beads v0.34.0+ supports `external:<repo>:<capability>` dependencies
- Harness respects cross-repo dependencies (won't start blocked work)

**Gap Analysis**:
- WORKWAY already solves cross-repo coordination via Beads
- Convoy system adds **grouping** (related work identity)
- WORKWAY lacks **convoy-level progress tracking**

**Adoption Strategy**:
- **Defer**: Full convoy implementation (Beads dependencies sufficient)
- **Consider**: Lightweight convoy labels (e.g., `convoy:<name>`) for grouping
- **Monitor**: If multi-repo work increases, revisit convoy architecture

---

### 4. Hook System

**GAS TOWN Pattern**:
- Work "hangs" on hooks (persisted state)
- Agents retrieve work from hooks after restart
- Enables stateless agent design (agents crash-safe)

**WORKWAY Current**:
- `AgentContext` schema captures session state
- Manual resume via `bd work --resume`
- Context persisted in `.harness/` directory

**Gap Analysis**:
- GAS TOWN hooks are **agent-agnostic** (any agent can claim)
- WORKWAY context is **session-specific** (tied to harness run)
- GAS TOWN hooks enable **automatic recovery**
- WORKWAY requires **human intervention** to resume

**Adoption Strategy**:
- **Adopt**: Hook-based work persistence (replace manual resume)
- **Design**: Hooks as Beads labels (e.g., `hook:ready`, `hook:blocked`)
- **Implement**: Auto-claim logic (agent scans hooks, claims work)

**Implementation Path**:
1. Add hook labels to Beads issues (`hook:ready`, `hook:in-progress`, `hook:failed`)
2. Create `HookQueue` class that scans for `hook:ready` issues
3. Implement `claimWork()` that moves issue from `hook:ready` to `hook:in-progress`
4. Add crash detection (if agent dies, hook:in-progress → hook:ready)
5. Store minimal context in issue description (not separate files)

---

### 5. Scale (20-30 Concurrent Agents)

**GAS TOWN Architecture**:
- tmux sessions isolate agents (one per Polecat)
- Mayor coordinates via shared Beads database
- Refinery serializes merge conflicts

**WORKWAY Current**:
- Single harness run (1 agent)
- Sequential session execution
- No merge queue (assumes single writer)

**Scale Requirements Analysis**:
| Workload | Agents Needed | Current Support | GAS TOWN Gains |
|----------|---------------|-----------------|----------------|
| Single feature | 1 | ✅ Working | ❌ Overkill |
| Multi-feature project | 2-4 | ⚠️ Sequential only | ✅ Parallel execution |
| Platform-wide refactor | 10-20 | ❌ Not supported | ✅ Convoy coordination |
| Enterprise deployment | 20-30 | ❌ Not supported | ✅ Full GAS TOWN |

**Current Bottlenecks**:
1. Sequential session execution (one feature at a time)
2. No merge queue (concurrent commits conflict)
3. Single harness runner (no parallelism)

**Adoption Strategy**:
- **Phase 1** (Now): Support 2-4 concurrent workers with merge queue
- **Phase 2** (6 months): Scale to 10 workers with Mayor/Polecat pattern
- **Phase 3** (12 months): Evaluate 20-30 agents if demand exists

**Implementation Path**:
1. Add `MergeQueue` class (validates commits before merge)
2. Enable parallel harness runs with `--max-workers=N` flag
3. Add `Coordinator` class that distributes work to workers
4. Monitor: Does WORKWAY need 20-30 agents? (Enterprise vs. SaaS usage)

---

## Dependency Analysis

### Current Stack
- **Node.js 18+**: Runtime (required)
- **Beads v0.43.0**: Issue tracking (required)
- **Claude Code CLI**: Agent runtime (required)
- **TypeScript**: Implementation language (preferred)

### GAS TOWN Additions
- **Go 1.23+**: GAS TOWN implementation language (NEW)
- **tmux 3.0+**: Session isolation (NEW)

### Trade-offs

**Go Dependency**:
- ✅ Pro: GAS TOWN is battle-tested in Go
- ✅ Pro: Strong concurrency primitives
- ❌ Con: Adds language complexity to WORKWAY (TypeScript monorepo)
- ❌ Con: Deployment complexity (Go binaries + Node.js)
- ❌ Con: Developer onboarding (must know TypeScript + Go)

**tmux Dependency**:
- ✅ Pro: Process isolation (prevents crashes from cascading)
- ✅ Pro: Observability (attach to agent sessions)
- ❌ Con: macOS/Linux only (Windows support unclear)
- ⚠️ Neutral: Alternative exists (spawn child processes in Node.js)

### Recommendation
- **Avoid Go dependency** (at least initially)
- **Implement patterns in TypeScript** (keeps stack unified)
- **Use child processes instead of tmux** (cross-platform, native to Node.js)
- **Monitor**: If scale demands, evaluate Go port

---

## Integration Paths

### Option A: Full GAS TOWN Adoption
**Approach**: Replace `@workwayco/harness` with GAS TOWN

**Pros**:
- Battle-tested at scale (20-30 agents)
- Crash-resilient out of the box
- Role-based architecture prevents context sprawl

**Cons**:
- Go dependency (complicates stack)
- Loses existing harness features (DRY context, two-stage verification)
- Migration effort (rewrite specs, workflows)
- Overengineered for current scale (4-10 agents)

**Verdict**: ❌ **Reject** - Too disruptive, loses Zuhandenheit

---

### Option B: Parallel Systems
**Approach**: Run GAS TOWN alongside `@workwayco/harness`

**Pros**:
- Evaluate GAS TOWN without commitment
- Use GAS TOWN for large projects, harness for small
- Low risk (no migration)

**Cons**:
- Two orchestration systems (confusing for developers)
- Duplicate maintenance (bug fixes, features)
- No unified progress view
- Violates Zuhandenheit (tools don't recede)

**Verdict**: ❌ **Reject** - Creates tool sprawl

---

### Option C: Merge Concepts (TypeScript Implementation)
**Approach**: Evolve `@workwayco/harness` with GAS TOWN patterns in TypeScript

**Pros**:
- Keeps unified stack (TypeScript + Beads)
- Incremental adoption (no big bang migration)
- Learn from GAS TOWN without full dependency
- Maintains Zuhandenheit (tool recedes)
- Preserves existing features (DRY context, scope guard)

**Cons**:
- Requires custom implementation (not battle-tested)
- May diverge from GAS TOWN updates
- Scale ceiling uncertain (TypeScript vs. Go performance)

**Verdict**: ✅ **Adopt** - Best balance of risk and reward

---

## Recommended Integration Strategy

### Phase 1: Foundations (Q1 2026)
**Goal**: Support 2-4 concurrent workers with merge queue

**Work Items**:
1. **Extract Coordinator** (Cloudflare-x317)
   - Separate coordination logic from execution
   - Prevent context sprawl (Mayor pattern)
   - Implement work distribution queue

2. **Add Merge Queue** (Cloudflare-gr00)
   - Validate commits before merge
   - Resolve conflicts automatically where possible
   - Enable parallel work without clobbering

3. **Implement Hook System** (Cloudflare-u5q2)
   - Replace manual resume with hook-based recovery
   - Use Beads labels for hook state
   - Auto-claim logic for work retrieval

4. **Add Observer** (Cloudflare-x317)
   - Non-blocking progress monitoring
   - Real-time status without interfering
   - Feeds into checkpoint system

**Success Criteria**:
- 2-4 harness workers run in parallel
- Merge conflicts detected and resolved
- Crashed sessions auto-resume from hooks
- Observer provides real-time status

---

### Phase 2: Scale (Q2-Q3 2026)
**Goal**: Scale to 10 workers with convoy support

**Work Items**:
1. **Implement Convoy System** (Cloudflare-bma5)
   - Group related cross-repo work
   - Convoy-level progress tracking
   - Unified multi-repo workflows

2. **Integrate Molecular Workflows** (Cloudflare-ejbe)
   - Step-level state tracking in Beads molecules
   - Crash-resilient step execution
   - Auto-resume from last successful step

3. **Scale Testing** (Cloudflare-hhea)
   - Stress test with 10 concurrent agents
   - Identify bottlenecks (SQLite, file I/O)
   - Optimize coordinator performance

**Success Criteria**:
- 10 workers run concurrently without conflicts
- Convoy system groups multi-repo work
- Molecules track step-level progress
- Crash recovery works at step granularity

---

### Phase 3: Enterprise Scale (Q4 2026+)
**Goal**: Evaluate 20-30 agent scale (if needed)

**Decision Points**:
1. **Is 20-30 agent scale needed?**
   - Enterprise deployments vs. SaaS usage
   - Complexity vs. value trade-off
   - Cost of custom implementation vs. Go port

2. **TypeScript performance ceiling?**
   - Node.js concurrency limits
   - SQLite contention under load
   - Coordinator overhead

**Options**:
- **Option 3A**: Optimize TypeScript harness (profiling, caching)
- **Option 3B**: Port to Go (full GAS TOWN adoption)
- **Option 3C**: Hybrid (coordinator in Go, workers in TypeScript)

**Defer Decision**: Revisit after Phase 2 data

---

## Architecture Comparison Table

| Feature | WORKWAY Harness | GAS TOWN | Phase 1 Target | Phase 2 Target |
|---------|-----------------|----------|----------------|----------------|
| **Role-Based Agents** | ❌ Single agent | ✅ Mayor/Polecat/Witness/Refinery | ✅ Coordinator + Workers | ✅ Full roles |
| **Concurrent Workers** | ❌ 1 sequential | ✅ 20-30 parallel | ✅ 2-4 parallel | ✅ 10 parallel |
| **Merge Queue** | ❌ No | ✅ Refinery | ✅ Basic queue | ✅ Advanced validation |
| **Crash Recovery** | ⚠️ Manual resume | ✅ Hook-based auto | ✅ Hook system | ✅ Step-level resume |
| **Cross-Repo Work** | ✅ Beads dependencies | ✅ Convoy system | ✅ Keep Beads | ✅ Add convoy |
| **Molecular Workflows** | ⚠️ Session-level | ✅ Step-level | ⚠️ Session-level | ✅ Step-level |
| **Observability** | ⚠️ Checkpoint only | ✅ Witness real-time | ✅ Observer | ✅ Full observability |
| **Dependencies** | Node.js + Beads | Go + tmux + Beads | Node.js + Beads | Node.js + Beads |
| **Zuhandenheit** | ✅ Tool recedes | ⚠️ Go complexity | ✅ Maintained | ✅ Enhanced |

---

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| TypeScript performance ceiling | Medium | High | Profile early, prepare Go port |
| SQLite contention at scale | Medium | Medium | Add connection pooling, WAL mode |
| Coordinator becomes bottleneck | Low | High | Make coordinator stateless |
| Merge queue conflicts | Medium | Medium | Implement conflict detection early |
| Hook system data loss | Low | High | Use Beads SQLite (ACID guarantees) |

### Organizational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Go dependency resisted | Low | Low | Stay TypeScript for Phases 1-2 |
| Over-engineering for scale | Medium | Medium | Build incrementally, measure demand |
| Developer confusion (two systems) | Low | High | Single harness entry point (bd work) |
| Violates Zuhandenheit | Low | High | Keep tool invisible, focus on outcomes |

---

## Conclusion

### Core Findings

1. **GAS TOWN's architectural patterns are valuable**, especially:
   - Role-based agent separation (prevents context sprawl)
   - Hook-based crash recovery (better than manual resume)
   - Merge queue (enables parallel work)
   - Observer pattern (non-blocking observability)

2. **Full GAS TOWN adoption is premature**:
   - Adds Go dependency (complicates stack)
   - Overengineered for current scale (4-10 agents)
   - Loses existing harness features (DRY, scope guard)

3. **Merge Concepts strategy preserves Zuhandenheit**:
   - Incremental evolution (no big bang)
   - TypeScript-native (unified stack)
   - Learn from GAS TOWN without full dependency
   - Maintain tool invisibility

### Recommended Next Steps

1. **Immediate** (This Sprint):
   - Document architecture comparison ✅ (this file)
   - Create Phase 1 issues in Beads (Cloudflare-x317, Cloudflare-gr00, etc.)
   - Prototype Coordinator pattern (extract from runner.ts)

2. **Short-Term** (Q1 2026):
   - Implement Phase 1 (Coordinator + MergeQueue + Hooks + Observer)
   - Test with 2-4 concurrent workers
   - Measure performance and bottlenecks

3. **Medium-Term** (Q2-Q3 2026):
   - Implement Phase 2 (Convoy + Molecular Workflows)
   - Scale to 10 workers
   - Evaluate TypeScript performance ceiling

4. **Long-Term** (Q4 2026+):
   - Decide: Optimize TypeScript vs. Port to Go
   - Based on: Actual scale demand + Performance data
   - If 20-30 agents needed: Consider full GAS TOWN adoption

### Philosophy Alignment

This evaluation honors WORKWAY's Zuhandenheit principle:

> "The tool should recede; the outcome should remain."

**GAS TOWN's complexity** (Go + tmux + role-based agents) is justified at 20-30 agent scale.

**WORKWAY's current needs** (4-10 agents) demand simpler architecture.

**The merge path** (TypeScript + incremental patterns) keeps the tool invisible while learning from GAS TOWN's proven design.

The harness remains a single command: `bd work`

The mechanism recedes. The outcome remains.

---

## Appendix: GAS TOWN Resources

- **Repository**: github.com/steveyegge/gastown
- **Dependencies**: Go 1.23+, tmux 3.0+, Beads, Claude Code CLI
- **Scale**: Designed for 20-30 concurrent agents
- **Architecture**: Role-based (Mayor/Polecat/Witness/Refinery/Deacon)
- **Recovery**: Hook-based stateless agents
- **Workflows**: Molecular formulas with crash-resilient steps

## Appendix: WORKWAY Harness References

- **Package**: `@workwayco/harness` (v0.1.0)
- **Location**: `packages/harness/`
- **Key Files**:
  - `src/runner.ts` - Main orchestration loop
  - `src/session.ts` - Claude Code session execution
  - `src/checkpoint.ts` - Progress tracking and confidence scoring
  - `src/beads.ts` - Beads CLI integration
  - `src/types.ts` - TypeScript type definitions
- **Entry Point**: `bd work` (via Beads CLI)
- **Philosophy**: Zuhandenheit (tool recedes, outcome remains)
