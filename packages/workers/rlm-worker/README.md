# Cloudflare-Native RLM Worker

Recursive Language Model implementation using **100% Cloudflare products**.

## Architecture

This RLM implementation leverages Cloudflare's edge platform for fully serverless, globally distributed long-context processing:

| Component | Cloudflare Product | Purpose |
|-----------|-------------------|---------|
| **LLM Inference** | Workers AI | Llama 3.1 8B/70B models for root and sub-calls |
| **Session State** | Durable Objects | Stateful RLM session management with crash recovery |
| **Context Storage** | R2 | Large document storage (100K+ character contexts) |
| **Result Caching** | KV | 1-hour cache for repeated queries |
| **Metrics** | Analytics Engine | Usage tracking and cost monitoring |
| **Orchestration** | Workers | Main RLM execution logic |

## Features

- **✅ No Python** - Pure TypeScript/JavaScript
- **✅ No Servers** - Fully serverless
- **✅ Global Edge** - Runs on Cloudflare's network (200+ cities)
- **✅ Auto-scaling** - Handles 1 or 1,000 concurrent requests
- **✅ Crash Recovery** - Durable Objects ensure state persistence
- **✅ Cost Tracking** - Built-in cost estimation
- **✅ Caching** - KV cache for repeat queries

## vs. Python RLM

| Feature | Cloudflare RLM | Python RLM |
|---------|----------------|------------|
| **Runtime** | Edge Workers | Python subprocess |
| **Models** | Workers AI (Llama 3.1) | Anthropic Claude |
| **Deployment** | `wrangler deploy` | `pip install` |
| **Scaling** | Automatic | Manual |
| **State** | Durable Objects | In-memory |
| **Storage** | R2 | Local filesystem |
| **Cost** | $0.011/1k neurons | $3-15 per 1M tokens |

## API

### TypeScript Client

```typescript
import { runRLM } from '@workwayco/rlm';

const result = await runRLM(
  ['doc1.txt', 'doc2.txt', ...], // Context (string or array)
  'What are the main DRY violations?', // Query
  {
    rootModel: 'llama-3.1-70b',      // Root model for synthesis
    subModel: 'llama-3.1-8b',        // Sub model for chunks
    maxIterations: 20,
    maxSubCalls: 100,
    chunkSize: 50000,
    useCache: true,
  }
);

console.log(result.answer);        // Final answer
console.log(result.iterations);    // Number of iterations
console.log(result.subCalls);      // Number of sub-calls
console.log(result.costUsd);       // Estimated cost
```

### HTTP API

```bash
# Run RLM analysis
curl -X POST https://rlm-worker.workway.workers.dev/rlm \
  -H "Content-Type: application/json" \
  -d '{
    "context": "Large document...",
    "query": "What are the key findings?",
    "config": {
      "rootModel": "llama-3.1-70b",
      "subModel": "llama-3.1-8b",
      "useCache": true
    }
  }'

# Health check
curl https://rlm-worker.workway.workers.dev/health
```

## How It Works

### Small Context (<50K chars)
```
1. Single Workers AI call with root model
2. Return result directly
3. No chunking needed
```

### Large Context (>50K chars)
```
1. Chunk context into 50K character pieces
2. Process each chunk with sub-model (Llama 3.1 8B)
3. Synthesize chunk results with root model (Llama 3.1 70B)
4. Return final answer
```

### With R2 (>100K chars)
```
1. Store context in R2
2. Chunk and process as above
3. Results cached in KV for 1 hour
```

## Deployment

### Prerequisites

1. Cloudflare account with Workers paid plan (for Workers AI)
2. Wrangler CLI installed

### Setup

```bash
# Install dependencies
pnpm install

# Create R2 bucket
wrangler r2 bucket create rlm-contexts

# Create KV namespace
wrangler kv:namespace create RLM_CACHE

# Deploy
pnpm deploy
```

### Configuration

Update `wrangler.toml` with your KV namespace IDs:

```toml
[[kv_namespaces]]
binding = "RLM_CACHE"
id = "your-kv-namespace-id"
```

## Cost Analysis

### Workers AI Pricing
- **Free tier**: 10,000 neurons/day
- **Paid**: $0.011 per 1,000 neurons

### Example Costs

| Task | Context | Neurons | Cost |
|------|---------|---------|------|
| Worker Assessment (38 files) | 405K chars | ~100K | $0.99 |
| DRY Violation Analysis (50 files) | 600K chars | ~150K | $1.54 |
| Large Codebase (200 files) | 2M chars | ~500K | $5.39 |

**Compare to Anthropic Claude:**
- Same 2M char analysis: **$45-90** (Claude Sonnet/Opus)
- **10-90x cheaper** with Workers AI

## Limitations

1. **Workers AI Models**: Limited to Llama 3.1 (no Claude)
   - Quality may be lower than Claude Opus
   - Trade-off: 10-90x cost savings

2. **Durable Objects**: Single-threaded per session
   - Can't parallelize within a single RLM session
   - Solution: Run multiple sessions for different queries

3. **Workers AI Quotas**: 10k neurons/day free tier
   - Need paid plan for production use
   - Monitor usage in Cloudflare dashboard

## Monitoring

### Analytics Engine

View RLM usage metrics:

```sql
SELECT
  SUM(double1) as total_iterations,
  SUM(double2) as total_sub_calls,
  SUM(double3) as total_cost_usd,
  AVG(double4) as avg_duration_ms
FROM RLM_ANALYTICS
WHERE timestamp > NOW() - INTERVAL '7' DAY
```

### Logs

```bash
# Tail live logs
pnpm tail

# Filter by status
pnpm tail --status error
```

## Migration from Python RLM

The API is backward-compatible:

```typescript
// Old (Python)
import { runRLM } from '@workwayco/rlm';
const result = await runRLM(context, query, config);

// New (Cloudflare) - same API!
import { runRLM } from '@workwayco/rlm';
const result = await runRLM(context, query, config);
```

Python bridge still available as `runRLMPython()` for gradual migration.

## Roadmap

- [ ] Support Claude via external API (Anthropic, OpenRouter)
- [ ] Streaming responses
- [ ] Trajectory visualization UI
- [ ] Batch processing API
- [ ] Custom model routing strategies

## References

- [MIT CSAIL RLM Paper](https://arxiv.org/abs/2512.24601)
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
- [Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [R2 Storage](https://developers.cloudflare.com/r2/)
