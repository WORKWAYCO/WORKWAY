#!/bin/bash
# Build script for WORKWAY Rust Validator WASM module
#
# Prerequisites:
#   - Rust toolchain (rustup)
#   - wasm-pack: cargo install wasm-pack
#   - wasm32-unknown-unknown target: rustup target add wasm32-unknown-unknown

set -e

echo "Building WORKWAY Rust Validator..."

# Check for wasm-pack
if ! command -v wasm-pack &> /dev/null; then
    echo "wasm-pack not found. Installing..."
    cargo install wasm-pack
fi

# Build for Node.js target (compatible with CLI)
echo "Building for Node.js..."
wasm-pack build --target nodejs --out-dir pkg-node --release

# Build for web target (for browser/workers if needed)
echo "Building for web..."
wasm-pack build --target web --out-dir pkg-web --release

# Build for bundler target (for webpack/rollup)
echo "Building for bundler..."
wasm-pack build --target bundler --out-dir pkg --release

echo ""
echo "Build complete!"
echo ""
echo "Outputs:"
echo "  pkg/           - For bundlers (webpack, rollup, vite)"
echo "  pkg-node/      - For Node.js (CLI usage)"
echo "  pkg-web/       - For browsers and Cloudflare Workers"
echo ""
echo "Usage in Node.js:"
echo "  const { validate_workflow_wasm } = require('./pkg-node');"
echo ""
echo "Usage with bundler:"
echo "  import { validate_workflow_wasm } from './pkg';"
