# WORKWAY RLM (Recursive Language Model)

Long-context processing for WORKWAY autonomous agents.

Based on MIT CSAIL's [Recursive Language Models](https://arxiv.org/abs/2512.24601) paper.

## Overview

RLM enables processing contexts far beyond the model's context window (10M+ tokens) by treating context as a Python variable instead of prompt content.

**Key Innovation**: The model writes Python code to navigate the context, using sub-LM calls for semantic understanding.

## Installation

```bash
cd packages/rlm
pip install -e .
```

## Quick Start

```python
from workway_rlm import RLMSession, RLMConfig
from workway_rlm.providers import ClaudeProvider

# Your large context (can be 10M+ characters)
corpus = open("massive_worker_logs.txt").read()

# Create session
provider = ClaudeProvider()
session = RLMSession(
    context=corpus,
    provider=provider,
    config=RLMConfig(
        root_model="sonnet",   # For reasoning
        sub_model="haiku",     # For sub-queries (cheaper)
    )
)

# Run query
result = await session.run("What quality issues exist across all worker outputs?")

print(f"Answer: {result.answer}")
print(f"Iterations: {result.iterations}")
print(f"Sub-calls: {result.sub_calls}")
print(f"Cost: ${result.cost_usd:.4f}")
```

## How It Works

```
Root Model (Sonnet)
  ↓ writes Python code
REPL Environment
  - context = <10M chars> (NOT in prompt!)
  - llm_query() → Sub-model (Haiku)
  - Uses regex, chunking, filtering
  ↓ executes code
Sub Model processes filtered chunks
  ↓ returns findings
Root Model synthesizes final answer
```

## Components

### RLMEnvironment

Sandboxed Python REPL with the context as a variable.

```python
from workway_rlm import RLMEnvironment

env = RLMEnvironment(context="...large text...")

# Execute code
result = env.execute("""
import re
matches = re.findall(r'error: (.*)', context)
print(f"Found {len(matches)} errors")
""")

print(result.output)  # "Found 42 errors"
```

**Built-in helpers:**
- `context` - Your input data
- `results` - Dict to store findings
- `llm_query(prompt)` - Sub-LM call
- `chunk_text(text, size)` - Split by characters
- `chunk_lines(text, n)` - Split by lines
- `re`, `json` - Standard library

### RLMSession

Orchestrates the model ↔ REPL loop.

```python
from workway_rlm import RLMSession, RLMConfig

config = RLMConfig(
    root_model="sonnet",      # Main reasoning model
    sub_model="haiku",        # Cheap sub-queries
    max_iterations=20,        # Loop limit
    max_sub_calls=100,        # Sub-LM call limit
    track_costs=True,         # Enable cost tracking
)

session = RLMSession(context=data, provider=provider, config=config)
result = await session.run("Your question here")
```

### RLMResult

```python
@dataclass
class RLMResult:
    success: bool              # Did we get a FINAL() answer?
    answer: str | None         # The answer
    iterations: int            # REPL loop iterations
    sub_calls: int             # Number of llm_query() calls
    cost_usd: float            # Estimated cost
    trajectory: list[dict]     # Execution history
    error: str | None          # Error if failed
```

## Model Routing

RLM uses two models for cost efficiency:

| Role | Default | Purpose |
|------|---------|---------|
| Root | Sonnet | Planning, synthesis, final answer |
| Sub-calls | Haiku | Semantic understanding of chunks |

**Why Haiku for sub-calls?** The paper shows Haiku achieves 90% of Sonnet's performance on bounded tasks while costing 10x less.

## Cost Estimation

| Task Type | Context | Est. Cost |
|-----------|---------|-----------|
| Simple aggregation | 100K chars | ~$0.05 |
| Multi-doc synthesis | 1M chars | ~$0.30 |
| Deep codebase analysis | 5M chars | ~$1.00 |

**Compare to**: Direct Sonnet call on 1M chars costs ~$3 and likely fails.

## Paper Results

From the MIT CSAIL paper:

| Task | Base GPT-5 | RLM |
|------|------------|-----|
| BrowseComp-Plus (1K docs) | 0% | **91%** |
| OOLONG (aggregation) | 44% | **56%** |
| OOLONG-Pairs (pairwise) | 0.04% | **58%** |
| CodeQA (repo understanding) | 24% | **62%** |

## Testing

```bash
cd packages/rlm

# Unit tests (no API key needed)
pytest tests/ -v

# Integration tests (requires ANTHROPIC_API_KEY)
pytest tests/ -v -m integration
```

## Attribution

Adapted from CREATE SOMETHING's RLM implementation with gratitude.

Original implementation: CREATE SOMETHING monorepo
Paper: [Recursive Language Models (arxiv:2512.24601)](https://arxiv.org/abs/2512.24601)

## References

- [MIT CSAIL Paper](https://arxiv.org/abs/2512.24601)
- [WORKWAY RLM Integration Analysis](../../docs/RLM_INTEGRATION_ANALYSIS.md)
