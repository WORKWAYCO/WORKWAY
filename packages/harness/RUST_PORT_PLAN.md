# Gastown Coordinator Rust Port Plan

## When to Port

Run the profiler to determine if a Rust port is needed:

```typescript
import { runProfileSession } from '@workwayco/harness';

const results = await runProfileSession({
  targetAgents: 25,
  targetIssues: 100,
  durationMs: 60000,
});

if (results.rustRecommendation.recommended) {
  console.log('Rust port recommended:', results.rustRecommendation.reasons);
}
```

**Port to Rust if:**
- Coordinator loop P95 > 100ms
- SQLite operations avg > 50ms
- Memory growth > 100MB during session
- Event loop lag > 100ms
- Profiler confidence > 50%

## Architecture

```
packages/
  gastown-coordinator/        # New Rust crate
    Cargo.toml
    src/
      main.rs                 # Entry point (HTTP server or CLI)
      coordinator.rs          # Core coordinator logic
      db/
        mod.rs                # SQLite module
        beads.rs              # Beads JSONL handling
        schema.rs             # Schema definitions
      worker/
        mod.rs                # Worker pool management
        pool.rs               # Connection pooling
      queue/
        mod.rs                # Work queue
        priority.rs           # Priority queue
        merge.rs              # Merge queue
      metrics/
        mod.rs                # Metrics collection
        prometheus.rs         # Prometheus export
```

## Key Dependencies

```toml
[dependencies]
# Async runtime
tokio = { version = "1.0", features = ["full"] }

# SQLite with connection pooling
rusqlite = { version = "0.32", features = ["bundled"] }
r2d2 = "0.8"
r2d2_sqlite = "0.25"

# JSON handling
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"

# HTTP server (for coordinator API)
axum = "0.7"

# Command line
clap = { version = "4.0", features = ["derive"] }

# Logging
tracing = "0.1"
tracing-subscriber = "0.3"
```

## Performance Targets

| Metric | TypeScript | Rust Target |
|--------|------------|-------------|
| Loop P95 | 100-500ms | <10ms |
| SQLite read | 10-50ms | <5ms |
| SQLite write | 20-100ms | <10ms |
| Memory usage | 200MB+ | <50MB |
| Concurrent agents | 20-30 | 100+ |

## Implementation Phases

### Phase 1: SQLite Layer (1 week)
- [ ] Implement rusqlite connection pooling
- [ ] Port beads JSONL parsing to Rust
- [ ] Add prepared statement caching
- [ ] Enable WAL mode

### Phase 2: Coordinator Core (1 week)
- [ ] Port coordinator loop to async Rust
- [ ] Implement work queue with priority
- [ ] Add worker pool management
- [ ] Implement health checks

### Phase 3: Integration (1 week)
- [ ] Create HTTP API for coordination
- [ ] Implement JSON-RPC for worker communication
- [ ] Add metrics endpoint (Prometheus)
- [ ] Integration tests with TypeScript workers

## Migration Strategy

1. **Hybrid first**: Run Rust coordinator alongside TypeScript workers
2. **Gradual migration**: Start with SQLite layer only
3. **Feature flags**: Enable Rust components via environment variables
4. **Rollback plan**: Keep TypeScript coordinator as fallback

## Testing

```bash
# Run Rust tests
cargo test

# Run load test
cargo run --release --bin load-test -- --agents 30 --issues 500

# Profile
cargo flamegraph --bin gastown-coordinator
```

## Success Criteria

1. 5x improvement in coordinator loop latency
2. Support for 100+ concurrent agents
3. Memory usage under 50MB at scale
4. No regressions in existing functionality
5. Seamless integration with TypeScript workers
