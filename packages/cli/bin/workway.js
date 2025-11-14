#!/usr/bin/env node

// Entry point for the WORKWAY CLI
// This file loads the compiled TypeScript and runs the CLI

import('../dist/index.js')
  .then(({ run }) => run())
  .catch((error) => {
    console.error('Fatal error:', error.message);
    process.exit(1);
  });
