# RLM Integration Analysis for WORKWAY

**Source**: CREATE SOMETHING's implementation of MIT CSAIL paper (arxiv:2512.24601)
**Status**: Research & Planning
**Issue**: Cloudflare-nvko

## Executive Summary

CREATE SOMETHING has successfully implemented **RLM (Recursive Language Model)** - a technique for processing contexts 10M+ tokens by treating context as a Python variable instead of prompt content. This has immediate applications for WORKWAY's Gas Town coordination and autonomous agent workflows.

## What is RLM?

### The Problem

LLMs have hard context limits. Even "long-context" models degrade on tasks requiring dense access to large inputs:
- GPT-5 scores **0%** on BrowseComp-Plus (1K documents)
- Performance drops **50%+** as context grows beyond 100K tokens
- Summarization loses critical details at scale

### The Solution

**Treat context as an external variable, not prompt content.**

The model writes Python code to navigate the context, using sub-LM calls for semantic understanding. This enables processing 10M+ tokens with comparable cost to a single long-context call.

### Architecture

```
┌─────────────────────────────────────────────┐
│         Root Model (Sonnet)                 │
│  - Plans exploration strategy               │
│  - Writes Python code to navigate context  │
│  - Synthesizes findings                     │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│      REPL Environment (Sandboxed)           │
│  - context = <10M+ char corpus>             │
│  - llm_query(prompt) → Sub-model call       │
│  - results = {} for findings                │
│  - Standard Python: re, json, chunking      │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│         Sub Model (Haiku/Gemini)            │
│  - Cheap semantic understanding             │
│  - Processes filtered chunks                │
│  - Returns findings to environment          │
└─────────────────────────────────────────────┘
```

## CREATE SOMETHING's Implementation

### Component Structure

**Package**: `packages/agent-sdk/src/create_something_agents/rlm/`

| File | Purpose |
|------|---------|
| `environment.py` | Sandboxed Python REPL with context as variable |
| `session.py` | Orchestrator for model ↔ REPL loop |
| `modal_rlm.py` | Production deployment on Modal (serverless) |
| `.claude/skills/rlm-patterns.md` | Claude Code skill for RLM usage |

### Key Innovations

1. **Model Routing**: Sonnet for planning, Haiku/Gemini for sub-queries (10x cost savings)
2. **RestrictedPython Sandbox**: Secure code execution without dangerous operations
3. **Parallel Sub-Calls**: Batch independent queries with `llm_query_parallel()`
4. **Modal Deployment**: Isolated execution environment with 10-minute timeout
5. **Cost Tracking**: Automatic token counting and cost estimation

### Production Features (v2)

```python
from modal_rlm import run_rlm_remote

result = run_rlm_remote.remote(
    context=massive_corpus,  # 10M+ chars
    query="What patterns emerge across all documents?",
    root_model="sonnet",      # Planning
    sub_model="gemini-pro",   # Sub-calls (cheaper than Haiku)
    sub_provider="gemini",    # Use Gemini 2.5 with thinking
    parallel_sub_calls=True,  # Batch independent chunks
    use_restricted_python=True, # Sandbox for security
)

print(f"Answer: {result['answer']}")
print(f"Cost: ${result['cost_usd']:.4f}")
print(f"Iterations: {result['iterations']}")
print(f"Sub-calls: {result['sub_calls']}")
```

## WORKWAY Applications

### 1. Gas Town Quality Assessment (Immediate)

**Problem**: Mayor/Witness need to evaluate worker outputs across dozens of files.

**Current Approach**: Sample-based checking (read 5-10 files max)

**RLM Approach**: Process ALL worker outputs comprehensively

```python
# Collect all worker outputs into single context
context = ""
for worker_id in workers:
    output = read_worker_output(worker_id)
    context += f"\n--- Worker {worker_id} ---\n{output}"

# RLM session analyzes ALL outputs
session = RLMSession(context=context, provider=ClaudeProvider())
result = await session.run("""
Evaluate all worker outputs for:
1. Code quality (DRY violations, proper patterns)
2. Completeness (acceptance criteria met)
3. Git hygiene (commit messages, file organization)
4. Security issues (auth, injection, secrets)

Provide per-worker scores and aggregate findings.
""")
```

**Benefits**:
- No sampling bias - sees every line of every file
- Consistent evaluation criteria across workers
- Automatic detection of cross-worker inconsistencies
- Cost: ~$0.50 vs $3+ for direct long-context

### 2. Checkpoint Decision Making

**Problem**: Harness needs to decide when to pause/resume based on session history.

**Current Approach**: Heuristics (session count, time elapsed)

**RLM Approach**: Semantic analysis of full session trajectory

```python
# Load all session logs from .harness/session-*.log
context = load_all_session_logs()

session = RLMSession(context=context, provider=ClaudeProvider())
result = await session.run("""
Analyze session trajectory. Should we checkpoint?

Indicators:
- Confidence drops (model uncertainty in responses)
- Repeated failed attempts (same error 3+ times)
- Scope creep (working beyond original issue)
- Human redirect needed (blockers requiring input)

Return: {checkpoint: true/false, reason: string, confidence: 0-1}
""")
```

**Benefits**:
- Data-driven checkpoint decisions vs arbitrary thresholds
- Catches subtle patterns (diminishing returns, circular reasoning)
- Adapts to work complexity automatically

### 3. Codebase Audits (Workflow Quality Gates)

**Problem**: Need to audit 60+ workflows for consistency, security, best practices.

**Current Approach**: Sequential review (1-2 workflows/hour)

**RLM Approach**: Parallel analysis with comprehensive findings

```python
# Load all 60 workflows into context
workflows = glob("packages/workflows/src/**/*.ts")
context = [read_file(w) for w in workflows]

session = RLMSession(context=context, provider=ClaudeProvider())
result = await session.run("""
Audit all workflows for:

1. Security: Auth patterns, input validation, secret handling
2. Patterns: Consistent use of defineWorkflow, integration patterns
3. Documentation: Schema completeness, example quality
4. Performance: Unnecessary API calls, expensive operations

Group findings by severity (critical/high/medium/low).
Identify systemic issues affecting multiple workflows.
""")
```

**Benefits**:
- Complete coverage vs partial sampling
- Detects systemic patterns (same error in 20 workflows)
- Generates actionable issue list for Gas Town workers

### 4. Cross-Repo Dependency Analysis

**Problem**: Understand dependencies between Cloudflare + workway-platform repos.

**Current Approach**: Manual grep + understanding graphs

**RLM Approach**: Semantic dependency mapping

```python
# Load both repos
cloudflare_files = load_repo("/path/to/Cloudflare")
platform_files = load_repo("/path/to/workway-platform")
context = cloudflare_files + platform_files

session = RLMSession(context=context, provider=ClaudeProvider())
result = await session.run("""
Map cross-repo dependencies:

1. Which platform API endpoints are called by Cloudflare SDK?
2. Which database tables are accessed by which workflows?
3. Which types are shared between repos (type imports)?
4. What breaking changes would cascade across repos?

Output dependency graph in DOT format.
""")
```

### 5. Beads Issue Prioritization

**Problem**: Determine highest-impact work from hundreds of open issues.

**Current Approach**: `bv --robot-priority` (PageRank on dependency graph)

**RLM Approach**: Semantic impact analysis

```python
# Load all Beads issues
issues = bd_list_all_issues()
context = [issue.to_json() for issue in issues]

session = RLMSession(context=context, provider=ClaudeProvider())
result = await session.run("""
Prioritize issues by actual impact:

Consider:
- Dependency chains (blocks N other issues)
- Strategic alignment (enterprise-first positioning)
- Risk (security, data loss, user-facing bugs)
- Effort (complexity × time estimate)

Recommend top 10 issues with impact justification.
""")
```

## Implementation Roadmap

### Phase 1: Proof of Concept (Week 1)

**Deliverable**: RLM integration for Gas Town worker assessment

```bash
# Create RLM package in WORKWAY
cd Cloudflare/packages
mkdir rlm
cp /path/to/create-something/rlm/* rlm/

# Integrate with harness
cd packages/harness
npm install --save @workwayco/rlm

# Create worker assessment script
```

**Files to create**:
- `packages/rlm/environment.ts` (port from Python)
- `packages/rlm/session.ts` (port from Python)
- `packages/harness/src/rlm-assessment.ts` (Gas Town integration)
- `.claude/skills/rlm-worker-assessment.md` (skill for Claude Code)

**Success Criteria**:
- RLM can process all 6 Gas Town worker outputs
- Generates per-worker quality scores
- Costs < $1 per assessment run

### Phase 2: Harness Integration (Week 2)

**Deliverable**: RLM-powered checkpoint decisions

**Integration Points**:
- `packages/harness/src/checkpoint.ts` - Call RLM for checkpoint evaluation
- `packages/harness/src/session.ts` - Feed session logs to RLM
- `.harness/rlm-analysis.json` - Cache RLM insights

**New Function**:
```typescript
async function shouldCreateCheckpointRLM(
  sessionLogs: string[],
  config: RLMCheckpointConfig
): Promise<{
  checkpoint: boolean;
  reason: string;
  confidence: number;
  findings: string[];
}> {
  const context = sessionLogs.join('\n---\n');

  const session = new RLMSession({
    context,
    provider: new ClaudeProvider(),
    config: {
      root_model: 'sonnet',
      sub_model: 'haiku',
      max_iterations: 10,
    }
  });

  const result = await session.run(`
    Analyze session trajectory for checkpoint decision.
    [checkpoint criteria prompt]
  `);

  return JSON.parse(result.answer);
}
```

### Phase 3: Production Deployment (Week 3)

**Deliverable**: Modal-hosted RLM service for WORKWAY

**Deploy Options**:

1. **Modal Deployment** (Recommended - matches CREATE SOMETHING)
   - Isolated sandbox execution
   - 10-minute timeout for complex analyses
   - RestrictedPython security
   - Pay-per-use scaling

2. **Cloudflare Workers AI** (Alternative)
   - Leverage existing CF infrastructure
   - May need chunking strategy (1MB request limit)
   - Durable Objects for session state

**Recommended**: Start with Modal, migrate to CF Workers if/when needed.

### Phase 4: Codebase Audit Suite (Week 4)

**Deliverable**: RLM-powered workflow quality gates

**Audit Types**:
1. Security audit (all workflows)
2. Pattern consistency audit
3. Documentation completeness audit
4. Performance audit (unnecessary API calls)

**Integration**:
```bash
# CLI command
workway audit workflows --type=security --rlm

# Gas Town formula
bd pour mol-rlm-audit --var type=security
```

## Cost Analysis

### CREATE SOMETHING Benchmark (from paper)

| Task Type | Context | Sub-calls | Cost |
|-----------|---------|-----------|------|
| Simple aggregation | 100K chars | 10-20 | ~$0.05 |
| Multi-doc synthesis | 1M chars | 50-80 | ~$0.30 |
| Deep codebase analysis | 5M chars | 100-150 | ~$1.00 |

### WORKWAY Projected Costs

| Use Case | Context Size | Est. Cost | Frequency |
|----------|--------------|-----------|-----------|
| Worker assessment (6 workers) | 500K chars | $0.15 | Per Gas Town run |
| Checkpoint decision | 200K chars | $0.08 | Every 3 sessions |
| Workflow audit (60 workflows) | 3M chars | $0.80 | Weekly |
| Cross-repo dependency map | 5M chars | $1.20 | Monthly |
| Beads prioritization (200 issues) | 800K chars | $0.25 | Daily |

**Monthly estimate**: ~$30-50 for comprehensive RLM usage across all Gas Town operations.

**Compare to**: Current cost of manual review (~10 hours/week × $100/hr = $4,000/month engineer time).

## Technical Considerations

### TypeScript Port vs Python SDK

**Option 1: Port to TypeScript** (Matches WORKWAY stack)
- Pros: Native integration, no Python dependency
- Cons: More upfront work, need to test parity

**Option 2: Call Python via subprocess** (Faster MVP)
- Pros: Leverage CREATE SOMETHING's proven implementation
- Cons: Python runtime dependency, subprocess overhead

**Recommendation**: Start with Python SDK (fast MVP), port to TypeScript in Phase 2.

### Modal vs Cloudflare Workers

**Modal** (CREATE SOMETHING's choice):
- ✅ Proven for RLM (10-minute timeout, RestrictedPython)
- ✅ Pay-per-use (no idle costs)
- ✅ Easy deployment (`modal deploy`)
- ❌ Adds external dependency

**Cloudflare Workers**:
- ✅ Already in WORKWAY stack
- ✅ Global edge deployment
- ❌ 30s CPU timeout (may not be enough)
- ❌ 1MB request limit (need streaming or chunking)

**Recommendation**: Modal for Phase 1-3, evaluate CF Workers migration in Phase 4.

### Security: RestrictedPython

CREATE SOMETHING uses RestrictedPython to sandbox code execution:
- Blocks `open()`, `exec()`, `eval()`, `__import__`
- Prevents filesystem access
- Disallows dangerous `getattr`/`setattr`

**For WORKWAY**: Essential if RLM runs user-provided contexts. Less critical for internal-only use (Gas Town assessment, codebase audits).

## Paper Results (Validation)

From MIT CSAIL paper:

| Task | Base GPT-5 | RLM |
|------|------------|-----|
| BrowseComp-Plus (1K docs) | 0% | **91%** |
| OOLONG (aggregation) | 44% | **56%** |
| OOLONG-Pairs (pairwise) | 0.04% | **58%** |
| CodeQA (repo understanding) | 24% | **62%** |

**Key Takeaway**: RLM delivers **10-100x improvement** on tasks requiring dense long-context access.

## Integration with Existing WORKWAY Patterns

### 1. Gas Town Coordinator/Worker Pattern

**Current**:
```
Coordinator (Mayor) → spawns → Workers (Polecats) → Observer (Witness) monitors
```

**With RLM**:
```
Coordinator → spawns → Workers
                ↓
Observer + RLM Assessment → comprehensive quality analysis
                ↓
Mayor makes scaling/intervention decisions based on RLM insights
```

### 2. Beads Issue Tracking

**Current**:
```bash
bd ready  # Shows unblocked issues
bd list --status=open  # All open
```

**With RLM**:
```bash
bd prioritize --rlm  # RLM semantic impact analysis
# Output: Top 10 issues with impact justification
```

### 3. Harness Checkpoint Protocol

**Current**:
```typescript
const decision = shouldCreateCheckpoint(
  tracker,
  state.checkpointPolicy,
  lastResult,
  hasRedirects
);
// Heuristic: every N sessions, time threshold, failure
```

**With RLM**:
```typescript
const rlmDecision = await shouldCreateCheckpointRLM(
  sessionLogs,
  config
);
// Semantic: confidence drops, scope creep, circular reasoning
```

## Success Metrics

### Phase 1 (POC)
- [ ] RLM processes 6 Gas Town worker outputs in < 2 minutes
- [ ] Cost per assessment < $0.50
- [ ] Identifies at least 3 quality issues missed by current sampling

### Phase 2 (Harness Integration)
- [ ] RLM checkpoint decisions reduce false positives by 50%
- [ ] Catches scope creep before 5+ wasted sessions
- [ ] Confidence scores correlate with actual work quality

### Phase 3 (Production)
- [ ] Modal deployment uptime > 99%
- [ ] Average RLM session latency < 60 seconds
- [ ] Zero security incidents from sandbox escapes

### Phase 4 (Audit Suite)
- [ ] Workflow audits complete in < 10 minutes (vs 2-3 hours manual)
- [ ] Detects 90%+ of issues found in manual review
- [ ] Gas Town workers successfully auto-fix 70%+ of findings

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| RLM misses critical issues | High | Run RLM + manual review in parallel (Phase 1) |
| Modal cost overrun | Medium | Set hard limits on max_sub_calls, monitor spend |
| Python dependency adds complexity | Low | Document setup, provide Docker container |
| RestrictedPython sandbox escape | High | Use CREATE SOMETHING's proven config, pen-test |
| TypeScript port introduces bugs | Medium | Comprehensive test suite, parity validation |

## Next Steps

1. **Immediate (This Week)**:
   - Create `Cloudflare-nvko` issue with detailed spec
   - Set up test harness with CREATE SOMETHING's Python SDK
   - Run POC: RLM assessment on last Gas Town run outputs

2. **Short-term (Next 2 Weeks)**:
   - Integrate with `packages/harness/src/checkpoint.ts`
   - Deploy Modal endpoint for WORKWAY
   - Create `.claude/skills/rlm-assessment.md` skill

3. **Long-term (1 Month)**:
   - Port to TypeScript (if Python proves friction)
   - Build audit suite for workflows
   - Integrate with `bd prioritize` command

## References

- **Paper**: [Recursive Language Models (arxiv:2512.24601)](https://arxiv.org/abs/2512.24601)
- **CREATE SOMETHING Implementation**: `/Users/micahjohnson/Documents/Github/Create Something/create-something-monorepo/packages/agent-sdk/src/create_something_agents/rlm/`
- **Modal Documentation**: https://modal.com/docs
- **WORKWAY Issue**: Cloudflare-nvko
- **Related WORKWAY Docs**:
  - `docs/CLAUDE_CODE_2.1.0_INTEGRATION.md` (harness patterns)
  - `packages/harness/GASTOWN_IMPLEMENTATION.md` (coordinator/worker)
  - `.claude/rules/harness-patterns.md` (checkpoint protocol)

---

**Philosophical Alignment**: RLM embodies Zuhandenheit - the context recedes into the environment, the mechanism disappears, only the insights remain. The model doesn't struggle with context limits; it navigates context as a variable, using code as a tool that becomes ready-to-hand.

**The tool recedes. The understanding remains.**
