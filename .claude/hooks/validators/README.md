# WORKWAY Validators

Specialized self-validation hooks for Claude Code agents.

## Philosophy

From [Specialized Self-Validating Agents](https://www.youtube.com/watch?v=...):

> "A focused agent with one purpose, using specialized hooks for that purpose, outperforms a generalist agent."

Each validator is **specialized** for a specific purpose. This enables:
- **Deterministic validation** (code, not LLM judgment)
- **Immediate feedback** to Claude when something fails
- **Observability** via log files
- **Trust** in agent output

## Validators

### PostToolUse Validators (run after Edit/Write/Bash)

| Validator | Purpose | Hook Type | Used By |
|-----------|---------|-----------|---------|
| `typescript-validator.ts` | TypeScript syntax check | PostToolUse (Edit\|Write) | Global, integration-builder, workflow-designer |
| `integration-pattern.ts` | BaseAPIClient pattern | PostToolUse (Edit\|Write) | integration-builder |
| `workflow-structure.ts` | Workflow definition validation | PostToolUse (Edit\|Write) | workflow-designer |
| `beads-consistency.ts` | Issue state validation | PostToolUse (Bash) | harness |
| `dry-violations.ts` | Duplicate code detection | PostToolUse (Edit\|Write) | Global |

### PreToolUse Validators (run before tool execution)

| Validator | Purpose | Hook Type | Used By |
|-----------|---------|-----------|---------|
| `dangerous-command-blocker.ts` | Block destructive shell commands | PreToolUse (Bash) | Global |

### Stop Validators (run when agent finishes)

| Validator | Purpose | Hook Type | Used By |
|-----------|---------|-----------|---------|
| `completion-checker.ts` | Verify work is committed/pushed | Stop | harness |
| `test-runner.ts` | Run tests for changed packages | Stop | harness |

### Prompt-Based Validators

| Location | Purpose | Hook Type |
|----------|---------|-----------|
| Global settings.json | Intelligent completion check | Stop (prompt) |
| canon-reviewer agent | Review completeness check | Stop (prompt) |

## Hook Types

### Command Hooks (Deterministic)
```yaml
hooks:
  PostToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: "npx tsx \"$CLAUDE_PROJECT_DIR/.claude/hooks/validators/typescript-validator.ts\""
```

### Prompt Hooks (LLM-based)
```yaml
hooks:
  Stop:
    - hooks:
        - type: prompt
          prompt: "Check if work is complete. Context: $ARGUMENTS. Return {\"ok\": true} or {\"ok\": false, \"reason\": \"...\"}"
```

## Exit Codes

All validators follow the Claude Code hook convention:

| Exit Code | Meaning | Action |
|-----------|---------|--------|
| `0` | Valid | Continue normally |
| `2` | Invalid | Block operation, stderr sent to Claude |
| Other | Error | Non-blocking, shown in verbose mode |

## Blocked Commands (dangerous-command-blocker.ts)

The PreToolUse blocker prevents these dangerous patterns:

| Category | Examples | Reason |
|----------|----------|--------|
| **File deletion** | `rm -rf /`, `rm -rf *` | Recursive deletion of critical paths |
| **Git destruction** | `git reset --hard`, `git push --force main` | Discards work or shared history |
| **Database drops** | `DROP TABLE`, `DELETE FROM x` (no WHERE) | Permanent data loss |
| **Permission changes** | `chmod 777`, `chown -R root` | Security vulnerabilities |
| **Credential leaks** | `echo password \|`, `curl \| bash` | Exposes secrets or executes remote code |

## Log Files

Each validator writes to its own `.log` file in this directory:

```
validators/
├── typescript-validator.log
├── integration-pattern.log
├── workflow-structure.log
├── beads-consistency.log
├── completion-checker.log
├── dry-violations.log
├── test-runner.log
└── dangerous-command-blocker.log
```

View recent activity:
```bash
tail -f .claude/hooks/validators/*.log
```

## Usage in Agents

Add hooks to agent frontmatter:

```yaml
---
name: my-agent
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "npx tsx \"$CLAUDE_PROJECT_DIR/.claude/hooks/validators/dangerous-command-blocker.ts\""
          timeout: 5
  PostToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: "npx tsx \"$CLAUDE_PROJECT_DIR/.claude/hooks/validators/typescript-validator.ts\""
          timeout: 30
  Stop:
    - hooks:
        - type: command
          command: "npx tsx \"$CLAUDE_PROJECT_DIR/.claude/hooks/validators/completion-checker.ts\""
          timeout: 30
        - type: command
          command: "npx tsx \"$CLAUDE_PROJECT_DIR/.claude/hooks/validators/test-runner.ts\""
          timeout: 120
---
```

## Creating New Validators

1. Create `my-validator.ts` in this directory
2. Read JSON from stdin (hook input)
3. Validate the relevant file/state
4. Exit 0 for success, 2 for blocking failure
5. Write to stderr for Claude feedback
6. Log to `my-validator.log` for observability

Template:

```typescript
#!/usr/bin/env npx tsx
import * as fs from 'fs';
import * as path from 'path';

const LOG_FILE = path.join(
  process.env.CLAUDE_PROJECT_DIR || process.cwd(),
  '.claude/hooks/validators/my-validator.log'
);

interface HookInput {
  tool_name: string;
  tool_input: { file_path?: string };
}

function log(msg: string) {
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
}

async function main() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  
  const hookInput: HookInput = JSON.parse(input);
  const filePath = hookInput.tool_input?.file_path;
  
  // Your validation logic here
  const isValid = true;
  
  if (isValid) {
    log(`PASSED: ${filePath}`);
    process.exit(0);
  } else {
    log(`FAILED: ${filePath}`);
    console.error('Fix this issue: ...');
    process.exit(2);
  }
}

main().catch(e => { log(`ERROR: ${e.message}`); process.exit(1); });
```

## Testing Validators

Run directly with mock input:

```bash
# Test PostToolUse validator
echo '{"tool_name":"Write","tool_input":{"file_path":"packages/integrations/src/test/index.ts"}}' | \
  npx tsx .claude/hooks/validators/integration-pattern.ts

# Test PreToolUse validator
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' | \
  npx tsx .claude/hooks/validators/dangerous-command-blocker.ts

# Test Stop validator
echo '{"hook_event_name":"Stop","stop_hook_active":false}' | \
  npx tsx .claude/hooks/validators/completion-checker.ts
```

## Current Hook Configuration

### Global (settings.json)
- **PreToolUse (Bash)**: dangerous-command-blocker
- **PostToolUse (Edit|Write)**: typescript-validator, dry-violations
- **SessionStart**: bd prime
- **Stop**: Prompt-based completion check

### integration-builder Agent
- **PostToolUse (Edit|Write)**: typescript-validator, integration-pattern

### workflow-designer Agent
- **PostToolUse (Edit|Write)**: typescript-validator, workflow-structure

### harness Agent
- **PostToolUse (Bash)**: beads-consistency
- **Stop**: completion-checker, test-runner

### canon-reviewer Agent
- **Stop**: Prompt-based review completeness check
