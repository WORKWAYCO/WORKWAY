#!/usr/bin/env node

/**
 * WORKWAY Learn CLI
 *
 * Usage:
 *   workway-learn init           # Initialize learning environment
 *   workway-learn init --full    # Full scaffolding with CLAUDE.md
 *   workway-learn status         # Show learning progress
 *   workway-learn clear          # Clear cache and credentials
 *   workway-learn --server       # Start MCP server (for Claude Code)
 */

import('../dist/cli.js').catch((err) => {
  // If dist doesn't exist, try source directly (dev mode)
  import('../src/cli.ts').catch(() => {
    console.error('Failed to load CLI:', err.message);
    console.error('Run "pnpm build" first');
    process.exit(1);
  });
});
