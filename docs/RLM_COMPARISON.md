# RLM Implementation Comparison

Comparison between WORKWAY's RLM implementation (adapted from CREATE SOMETHING) and the official [alexzhang13/rlm](https://github.com/alexzhang13/rlm) repository.

## Summary

| Aspect | WORKWAY Implementation | Official alexzhang13/rlm |
|--------|------------------------|--------------------------|
| **Source** | Adapted from CREATE SOMETHING | MIT CSAIL original authors |
| **Language** | Python + TypeScript bridge | Pure Python |
| **Integration** | Gas Town worker assessment | General-purpose task decomposition |
| **Backends** | Anthropic Claude only | OpenAI, Anthropic, OpenRouter, Portkey, LiteLLM |
| **Environments** | Local exec only | Local, Docker, Modal, Prime Intellect |
| **Package Manager** | pip | uv (recommended) |
| **Primary Use Case** | Code quality assessment | Long-context task decomposition |

## Architecture Comparison

### WORKWAY Implementation

**Structure:**
```
packages/rlm/
├── src/workway_rlm/
│   ├── environment.py      # Sandboxed REPL
│   ├── session.py          # RLM orchestration loop
│   └── providers/
│       ├── base.py
│       └── claude.py       # Anthropic provider only
├── src/                    # TypeScript bridge
│   ├── rlm-bridge.ts       # Spawns Python subprocess
│   └── types.ts            # TypeScript interfaces
└── dist/                   # Compiled JS
```

**Key Features:**
- TypeScript/Node.js integration via child process
- Focused on Anthropic Claude models
- Simplified for single use case (worker assessment)
- Hardcoded for Sonnet (root) + Haiku (sub-calls) routing

**Integration:**
```typescript
import { assessWorkers } from '@workwayco/harness';
const result = await assessWorkers(['worker1', 'worker2']);
```

### Official alexzhang13/rlm

**Structure:**
```
rlm/
├── clients/         # LLM provider integrations
├── core/            # Main RLM logic
├── environments/    # Sandbox environments
├── logger/          # Trajectory logging
└── utils/           # Helper functions
```

**Key Features:**
- Multi-backend support (OpenAI, Anthropic, routers)
- Multiple sandbox environments (local, Docker, cloud)
- Trajectory visualization UI (Node.js/shadcn)
- Production-ready with extensive logging
- Task-agnostic design

**Integration:**
```python
from rlm import RLM
rlm = RLM(backend="anthropic", backend_kwargs={"model_name": "claude-sonnet-4"})
result = rlm.completion("Analyze this codebase...").response
```

## Feature Comparison

| Feature | WORKWAY | Official |
|---------|---------|----------|
| **Multiple LLM Providers** | ❌ (Anthropic only) | ✅ OpenAI, Anthropic, routers |
| **Docker Sandboxing** | ❌ | ✅ |
| **Cloud Sandboxes** | ❌ | ✅ (Modal, Prime) |
| **TypeScript Bridge** | ✅ | ❌ (Python only) |
| **Trajectory Visualization** | ❌ | ✅ (shadcn UI) |
| **Cost Tracking** | ✅ (basic) | ✅ (comprehensive) |
| **Worker Assessment** | ✅ (built-in) | ❌ (general-purpose) |
| **Production Security** | ⚠️  (uses `exec`) | ✅ (Docker/cloud options) |

## API Design Comparison

### WORKWAY API

**TypeScript:**
```typescript
import { runRLM } from '@workwayco/rlm';

const result = await runRLM(context, query, {
  rootModel: 'sonnet',
  subModel: 'haiku',
  maxIterations: 20,
  maxSubCalls: 100,
});

// Returns: { success, answer, iterations, subCalls, costUsd, error }
```

**Python (internal):**
```python
from workway_rlm import RLMEnvironment, RLMSession

env = RLMEnvironment(context=documents)
session = RLMSession(env, provider_config)
result = await session.run(query)
```

### Official API

**Python:**
```python
from rlm import RLM
from rlm.logger import RLMLogger

rlm = RLM(
    backend="anthropic",
    backend_kwargs={"model_name": "claude-sonnet-4"},
    environment="docker",  # or "local", "modal", "prime"
    logger=RLMLogger(log_dir="./logs"),
    verbose=True
)

result = rlm.completion("Your prompt here")
print(result.response)
```

## Performance & Cost

### WORKWAY Results
From our Gas Town worker assessment (38 files, 405K chars):
- **Iterations:** 1
- **Sub-calls:** 0
- **Cost:** $0.089
- **Duration:** 82 seconds

⚠️ **Issue:** Context was small enough for Sonnet to handle in one pass without recursing. This defeats the purpose of RLM (no actual recursive decomposition).

### Official Benchmarks
Per arXiv paper 2512.24601:
- **91% accuracy** on 1K-document needle-in-haystack
- **GPT-4/5:** 0% accuracy (context overflow)
- **~10x cost savings** vs. direct long-context calls
- **Processes 10M+ tokens** via recursive decomposition

## Recommendations

### For WORKWAY

1. **Consider migrating to official RLM:**
   - Better multi-backend support
   - Production-ready security (Docker/cloud sandboxes)
   - More active development and community

2. **If keeping custom implementation:**
   - Add OpenAI backend support
   - Implement Docker sandboxing for production safety
   - Fix recursive decomposition (force chunking for large contexts)
   - Add trajectory visualization

3. **Quick Win:**
   - Keep TypeScript bridge (unique value-add)
   - Swap underlying Python to official `alexzhang13/rlm`
   - Maintain worker assessment wrapper as high-level API

### Migration Path

**Option 1: Hybrid Approach (Recommended)**
```python
# packages/rlm/src/workway_rlm/session.py
from rlm import RLM  # Use official implementation
from rlm.logger import RLMLogger

class WorkwayRLMSession:
    """Wrapper around official RLM with WORKWAY-specific defaults"""
    def __init__(self, context, provider_config):
        self.rlm = RLM(
            backend="anthropic",
            backend_kwargs={"model_name": provider_config.model},
            environment="docker",  # Production-safe
            logger=RLMLogger(log_dir="./logs"),
        )
        self.context = context

    async def run(self, query):
        # Inject context into query
        full_query = f"Context:\n{self.context}\n\nQuery: {query}"
        result = self.rlm.completion(full_query)
        return result
```

**Option 2: Full Migration**
Replace `packages/rlm/` with official package:
```bash
cd packages/rlm
uv pip install git+https://github.com/alexzhang13/rlm.git
```

Update TypeScript bridge to call official API.

**Option 3: Keep As-Is**
Current implementation works for our use case (Gas Town assessment) but lacks:
- Recursive decomposition for truly large contexts
- Production security (exec-based sandbox)
- Multi-backend flexibility

## Conclusion

The official `alexzhang13/rlm` is more mature, better supported, and production-ready. Our implementation is simpler and TypeScript-integrated, but limited.

**Recommended Action:**
- **Short-term:** Document current limitations (no true recursion for small contexts)
- **Medium-term:** Migrate to official RLM as Python backend, keep TypeScript bridge
- **Long-term:** Contribute TypeScript bridge back to official repo

## References

- [alexzhang13/rlm GitHub](https://github.com/alexzhang13/rlm)
- [arXiv paper 2512.24601](https://arxiv.org/abs/2512.24601)
- [CREATE SOMETHING RLM Implementation](https://github.com/create-something/create-something-monorepo/tree/main/packages/agent-sdk/src/create_something_agents/rlm)
- [WORKWAY RLM Analysis](./RLM_INTEGRATION_ANALYSIS.md)
