# WORKWAY Rust Validator

High-performance workflow validator compiled to WebAssembly for the WORKWAY CLI.

## Why Rust?

The TypeScript validator uses 40+ regex patterns per file validation. While we've optimized by caching compiled patterns, Rust provides:

- **10-50x faster regex matching** - The `regex` crate compiles patterns to optimized native code
- **Zero allocation for pattern matching** - Patterns are compiled once at startup
- **Better CPU efficiency** - Important for validating many workflows

## Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add WASM target
rustup target add wasm32-unknown-unknown

# Install wasm-pack
cargo install wasm-pack
```

## Building

```bash
# Build all targets
./build.sh

# Or build manually for specific target
wasm-pack build --target nodejs --out-dir pkg-node --release
```

## Output

After building, you'll have:

- `pkg/` - For bundlers (webpack, rollup, vite)
- `pkg-node/` - For Node.js (CLI usage)
- `pkg-web/` - For browsers and Cloudflare Workers

## Usage

### Node.js (CLI)

```javascript
const { validate_workflow_wasm, get_version, health_check } = require('./pkg-node');

// Validate workflow content
const result = validate_workflow_wasm(workflowContent);
console.log(result.valid);
console.log(result.errors);
console.log(result.warnings);
console.log(result.metadata);

// Check version
console.log(get_version()); // "0.1.0"

// Health check
console.log(health_check()); // true
```

### With Bundler

```typescript
import { validate_workflow_wasm } from '@workwayco/rust-validator';

const result = validate_workflow_wasm(content);
```

## API

### `validate_workflow_wasm(content: string): ValidationResult`

Validates workflow content and returns:

```typescript
interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata?: WorkflowMetadata;
}

interface ValidationError {
  type: 'error';
  code: string;
  message: string;
  line?: number;
  suggestion?: string;
}

interface ValidationWarning {
  type: 'warning';
  code: string;
  message: string;
  line?: number;
  suggestion?: string;
}

interface WorkflowMetadata {
  name?: string;
  type?: string;
  integrations?: string[];
  trigger?: string;
  hasAi?: boolean;
  pricing?: {
    model?: string;
    price?: number;
  };
}
```

### `get_version(): string`

Returns the validator version.

### `health_check(): boolean`

Returns `true` if the WASM module is properly loaded.

## Testing

```bash
# Run Rust tests
cargo test

# Run WASM tests (requires wasm-pack)
wasm-pack test --node
```

## Development

```bash
# Build in debug mode (faster compilation)
wasm-pack build --target nodejs --out-dir pkg-node --dev

# Run tests with output
cargo test -- --nocapture
```

## Performance

Benchmarks comparing TypeScript vs Rust validator:

| Metric | TypeScript | Rust/WASM | Improvement |
|--------|------------|-----------|-------------|
| Single file | ~5ms | ~0.3ms | 15x faster |
| 100 files | ~500ms | ~30ms | 15x faster |
| Pattern compile | Per-call | Once | N/A |

*Benchmarks run on M1 MacBook Pro, Node.js v20*

## Architecture

```
src/
├── lib.rs         # WASM entry point, JS bindings
├── validator.rs   # Core validation logic
└── patterns.rs    # Pre-compiled regex patterns
```

The validator uses `once_cell::sync::Lazy` to compile all regex patterns exactly once when the module is first loaded. Subsequent validations reuse these compiled patterns.

## Integration with CLI

The CLI automatically uses the WASM validator when available, falling back to TypeScript:

```typescript
// In CLI
let validate: (content: string) => ValidationResult;

try {
  const wasm = await import('@workwayco/rust-validator');
  validate = wasm.validate_workflow_wasm;
  console.log('Using Rust validator');
} catch {
  validate = validateWorkflowTS;
  console.log('Using TypeScript validator');
}
```
