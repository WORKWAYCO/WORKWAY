# RLM Integration for Gas Town

Research summary for [arxiv:2512.24601](https://arxiv.org/abs/2512.24601) - Recursive Language Models.

## What is RLM?

RLM (Recursive Language Models) is an **inference-time strategy** for handling arbitrarily long prompts by:

1. Treating the full input as an **external environment** (not directly in context)
2. Using a **Python REPL** where the model writes code to interact with context
3. **Recursively calling** itself or sub-models on relevant snippets

**Key Results:**
- Handles 10M+ token inputs where base models collapse
- 91% accuracy on BrowseComp-Plus with GPT-5
- Cost-efficient via selective context reading

## Relevance to Gas Town

### Pattern Alignment

| RLM Concept | Gas Town Equivalent |
|-------------|---------------------|
| Main model orchestrates | **Mayor** (coordinator) |
| Sub-model calls on snippets | **Polecat** (workers) |
| Verification sub-calls | **Witness** (observer) |
| Code-driven context management | **Merge Queue** |

### Integration Opportunities

#### 1. Large Codebase Processing

**Current**: Workers receive full context, hit token limits.

**With RLM**: 
```typescript
// Mayor decomposes large task
const chunks = await decompose(codebase, {
  strategy: 'semantic',  // or 'file', 'function'
  maxTokens: 8000,
});

// Polecats process chunks in parallel
const results = await Promise.all(
  chunks.map(chunk => polecat.process(chunk))
);

// Mayor aggregates results
return aggregate(results);
```

#### 2. Quality Signal Generation

**Use RLM-style verification for Witness pattern:**

```typescript
// Witness verifies Polecat output
async function witnessVerify(polecatOutput: WorkResult): Promise<QualitySignal> {
  // Sub-call to verify correctness
  const correctness = await subModel.verify(polecatOutput.code);
  
  // Sub-call to check completeness
  const completeness = await subModel.checkRequirements(
    polecatOutput.code, 
    originalRequirements
  );
  
  return {
    score: (correctness.score + completeness.score) / 2,
    issues: [...correctness.issues, ...completeness.issues],
  };
}
```

#### 3. Task Decomposition Signals

**Improve Mayor's decomposition decisions:**

```typescript
interface DecompositionStrategy {
  // RLM-inspired: estimate complexity before decomposing
  estimateComplexity(task: Task): Promise<ComplexityScore>;
  
  // Decide: single worker vs parallel decomposition
  shouldDecompose(complexity: ComplexityScore): boolean;
  
  // Generate optimal chunk boundaries
  findChunkBoundaries(context: string, maxTokens: number): ChunkBoundary[];
}
```

## Implementation Phases

### Phase 1: Context Chunking (Low Effort)
- Add semantic chunking to Mayor
- Implement token-aware context splitting
- Use existing Polecat pattern for parallel processing

### Phase 2: Recursive Sub-calls (Medium Effort)
- Enable Polecats to spawn sub-Polecats
- Add recursion depth limits (RLM uses depth=1)
- Track cost across recursion tree

### Phase 3: Verification Integration (Medium Effort)
- Add sub-model verification calls to Witness
- Generate quality signals from verification results
- Feed signals back to Mayor for future decomposition

### Phase 4: Learning from Signals (Future)
- Collect decomposition/quality data
- Train better decomposition strategies
- Optimize cost-performance tradeoff

## Key Considerations

### What RLM Does NOT Provide
- **Not RLHF** - No human feedback or reward models
- **Not alignment** - Doesn't address bias/safety
- **Not training** - Inference-time only

### Limitations to Address
- **Cost variance** - Some tasks require many sub-calls
- **Short input overhead** - Skip RLM for small tasks
- **Code generation dependency** - Requires reliable code gen

## Recommended Next Steps

1. **Prototype context chunking** in Mayor pattern
2. **Add recursion support** to Polecat spawning
3. **Implement verification sub-calls** in Witness
4. **Track quality signals** for future optimization

## References

- [arxiv:2512.24601](https://arxiv.org/abs/2512.24601) - Recursive Language Models
- [MarkTechPost Analysis](https://www.marktechpost.com/2026/01/02/recursive-language-models-rlms-from-mits-blueprint-to-prime-intellects-rlmenv-for-long-horizon-llm-agents/)
- [EmergentMind Summary](https://www.emergentmind.com/papers/2512.24601)
