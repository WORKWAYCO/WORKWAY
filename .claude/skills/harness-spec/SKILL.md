---
name: harness-spec
description: Seamlessly orchestrate multi-session autonomous work. Activates when work scope exceeds a single session. The harness recedes completely—user describes work, Claude handles execution, Beads tracks progress. Embodies Zuhandenheit.
---

# Harness Specification

Generate and execute harness specs for autonomous multi-session work on WORKWAY.

## Philosophy: Zuhandenheit

The harness must be invisible. User describes an outcome; the harness handles complexity detection, model routing, session management, and verification. The mechanism disappears into the work.

## When to Use

- Work exceeds a single session in scope
- Multiple features or files involved
- Cross-repo work (Cloudflare + workway-platform)
- User wants autonomous execution with checkpoints

## Spec Format

### YAML (Recommended)

```yaml
title: Feature Name
property: cloudflare  # or platform
complexity: standard  # trivial | simple | standard | complex

features:
  - title: First Feature
    priority: 1
    files:
      - packages/sdk/src/feature.ts
    acceptance:
      - test: Feature works as expected
        verify: pnpm test --filter=sdk
      - Edge case handled

  - title: Second Feature
    depends_on:
      - First Feature
    acceptance:
      - Builds on first feature

requirements:
  - All tests pass
  - TypeScript strict mode

success:
  - E2E verification passes
  - Code reviewed
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | Yes | Project/feature title |
| `property` | enum | No | `cloudflare` or `platform` |
| `complexity` | enum | No | Override auto-detection |
| `features` | array | Yes | List of features |
| `requirements` | array | No | Cross-cutting requirements |
| `success` | array | No | Project success criteria |

### Feature Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Feature title (required) |
| `priority` | int | P0-P4, lower is higher priority |
| `files` | array | Expected files to modify |
| `depends_on` | array | Feature titles this depends on |
| `acceptance` | array | Criteria (string or `{test, verify}`) |
| `labels` | array | Additional Beads labels |

## Complexity Detection

The harness auto-detects complexity based on:

| Signal | Weight | Example |
|--------|--------|---------|
| Keywords | High | "all", "migrate", "refactor", "across" |
| File count | Medium | 15+ files = complex |
| Cross-package | Medium | SDK + API = standard+ |
| Dependencies | Low | Multiple blocked issues |

Override with `--complexity=complex` or in YAML.

## Complexity → Model Routing

| Level | Files | Model | Overhead |
|-------|-------|-------|----------|
| trivial | 1 | haiku | minimal |
| simple | 2-5 | haiku | micro |
| standard | 5-15 | sonnet | auto |
| complex | 15+ | opus | full |

## Execution Workflow

```
1. Parse spec (YAML or Markdown)
2. Detect complexity
3. Create Beads issues with dependencies
4. Select model per issue
5. Execute sessions (one feature each)
6. Two-stage verification (code-complete → verified)
7. Checkpoint reviews (every 3 sessions or 4 hours)
8. Extract discovered work
9. Commit and close
```

## Two-Stage Verification

```
in_progress → code-complete → verified → closed
              (tests pass)   (E2E pass)
```

**Never skip E2E verification.** Unit tests are necessary but not sufficient.

## Cross-Repo Work

For work spanning both repos:

```yaml
title: Teams Feature
property: cloudflare  # Primary repo

features:
  - title: Add teams endpoint
    labels: [api, wwp]  # Indicates platform work
    acceptance:
      - Returns team list

  - title: Add teams SDK method
    depends_on: [Add teams endpoint]
    labels: [sdk, ww]  # Indicates cloudflare work
    acceptance:
      - SDK exposes teams.list()
```

The harness creates issues in the correct repo based on labels:
- `wwp`, `api`, `web` → workway-platform
- `ww`, `sdk`, `cli`, `integrations` → Cloudflare

## Commands

```bash
# Start from spec
bd work --spec specs/feature.yaml

# Work on existing issue
bd work ww-abc123

# Create and work
bd work --create "Add teams endpoint"

# With overrides
bd work ww-xyz --complexity=complex --model=opus
```

## Progress Monitoring

```bash
bd list --label harness     # All harness issues
bd progress                  # Checkpoint summary
bd blocked                   # Blocked issues
```

## Discovered Work

During execution, the harness captures discovered work:

| Label | Source | Priority |
|-------|--------|----------|
| `harness:blocker` | Blocks current work | +1 boost |
| `harness:related` | Related work | Normal |
| `harness:supervisor` | Review finding | Normal |
| `harness:self-heal` | Baseline broken | P1 |

## Quality Gates

### Gate 1: Session Completion
- Tests pass → `code-complete` label
- E2E passes → `verified` label
- Commit exists → close with hash

### Gate 2: Checkpoint Review
Triggered every 3 sessions or 4 hours:
- Security review (auth, injection, secrets)
- Architecture review (DRY violations)
- Quality review (testing, conventions)

### Gate 3: Work Extraction
Critical findings become blocker issues:
```bash
bd create "Fix X" --priority P0 --label harness:blocker
bd dep add <new> discovered-from <checkpoint>
```

## Self-Healing Baseline

Before starting work:
```bash
pnpm test         # Tests pass?
pnpm typecheck    # Types clean?
pnpm lint         # Lint clean?
```

If baseline is broken, fix before adding new code.

## Example Invocations

```
# Simple feature
run harness on "Add logout button to header"

# Complex refactor with thinking
run harness in the background: ultrathink
Refactor authentication to use JWT

# From spec file
run harness on specs/teams-feature.yaml
```

## Integration

The harness integrates with:
- **Beads** for issue tracking and progress
- **Git** for commits and history
- **CI/CD** for verification gates
- **Claude Code** for session execution

## Zuhandenheit Test

Before shipping a harness feature, ask:
1. Does the user think about the work or the tool?
2. Does complexity detection match intuition?
3. Do checkpoints happen without intervention?
4. Does verification catch real issues?

If the user notices the harness, it's not ready.
