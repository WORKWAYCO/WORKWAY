#!/usr/bin/env npx tsx
/**
 * Ground Import Health Check for WORKWAY
 * 
 * Detects deprecated imports and anti-patterns.
 * Adapted from CREATE SOMETHING monorepo.
 * 
 * Usage:
 *   pnpm ground:imports              # Check for issues
 *   pnpm ground:imports --fix        # Auto-fix issues
 *   pnpm ground:imports --json       # JSON output for CI
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration - WORKWAY specific
// ─────────────────────────────────────────────────────────────────────────────

// No deprecated packages currently - add when migrating
const DEPRECATED_PACKAGES: Record<string, string> = {
  // Example: '@workwayco/old-sdk': '@workwayco/sdk',
};

const SCAN_PATHS = [
  'apps',
  'packages/cli/src',
  'packages/workflows/src',
  'packages/integrations/src',
  'packages/workers',
];

const EXTENSIONS = ['.ts', '.tsx', '.svelte', '.js'];

const IGNORE_PATHS = [
  'node_modules',
  '.svelte-kit',
  'dist',
  'build',
  'target',  // Rust build output
];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Violation {
  file: string;
  line: number;
  column: number;
  type: 'deprecated' | 'direct-source' | 'relative-cross-package';
  original: string;
  replacement?: string;
  message: string;
}

interface Results {
  violations: Violation[];
  filesScanned: number;
  fixable: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scanning
// ─────────────────────────────────────────────────────────────────────────────

function* walkFiles(dir: string): Generator<string> {
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      
      if (IGNORE_PATHS.some(ignore => fullPath.includes(ignore))) {
        continue;
      }
      
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        yield* walkFiles(fullPath);
      } else if (EXTENSIONS.some(ext => entry.endsWith(ext))) {
        yield fullPath;
      }
    }
  } catch {
    // Directory doesn't exist
  }
}

function findViolations(filePath: string, content: string): Violation[] {
  const violations: Violation[] = [];
  const lines = content.split('\n');
  
  lines.forEach((line, lineIndex) => {
    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      return;
    }
    
    // Pattern 1: Deprecated package imports
    for (const [deprecated, replacement] of Object.entries(DEPRECATED_PACKAGES)) {
      const pattern = new RegExp(`from\\s+['"]${deprecated.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`);
      const match = line.match(pattern);
      if (match) {
        violations.push({
          file: filePath,
          line: lineIndex + 1,
          column: match.index! + 1,
          type: 'deprecated',
          original: deprecated,
          replacement,
          message: `Deprecated import: ${deprecated} → ${replacement}`,
        });
      }
    }
    
    // Pattern 2: Direct source imports across packages
    const directSourcePattern = /from\s+['"]\.\..*\/packages\/\w+\/src\//;
    const directMatch = line.match(directSourcePattern);
    if (directMatch) {
      violations.push({
        file: filePath,
        line: lineIndex + 1,
        column: directMatch.index! + 1,
        type: 'direct-source',
        original: line.trim(),
        message: 'Direct source import bypasses package boundaries. Use @workwayco/* import.',
      });
    }
    
    // Pattern 3: Relative cross-package imports
    const crossPackagePattern = /from\s+['"]\.\..*\/(apps|packages)\/\w+\//;
    const crossMatch = line.match(crossPackagePattern);
    if (crossMatch && !line.includes('@workwayco')) {
      violations.push({
        file: filePath,
        line: lineIndex + 1,
        column: crossMatch.index! + 1,
        type: 'relative-cross-package',
        original: line.trim(),
        message: 'Cross-package imports should use @workwayco/* package name',
      });
    }
  });
  
  return violations;
}

function scanFiles(): Results {
  const violations: Violation[] = [];
  let filesScanned = 0;
  
  for (const scanPath of SCAN_PATHS) {
    for (const filePath of walkFiles(scanPath)) {
      filesScanned++;
      try {
        const content = readFileSync(filePath, 'utf-8');
        const fileViolations = findViolations(filePath, content);
        violations.push(...fileViolations);
      } catch {
        // Skip unreadable files
      }
    }
  }
  
  const fixable = violations.filter(v => v.type === 'deprecated' && v.replacement).length;
  
  return { violations, filesScanned, fixable };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixing
// ─────────────────────────────────────────────────────────────────────────────

function applyFixes(violations: Violation[]): number {
  const byFile = new Map<string, Violation[]>();
  for (const v of violations) {
    if (v.type === 'deprecated' && v.replacement) {
      const existing = byFile.get(v.file) || [];
      existing.push(v);
      byFile.set(v.file, existing);
    }
  }
  
  let fixedCount = 0;
  
  for (const [filePath, fileViolations] of byFile) {
    let content = readFileSync(filePath, 'utf-8');
    
    for (const v of fileViolations) {
      const before = content;
      content = content.replace(
        new RegExp(`(['"])${v.original!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1`, 'g'),
        `$1${v.replacement}$1`
      );
      if (content !== before) {
        fixedCount++;
      }
    }
    
    writeFileSync(filePath, content);
  }
  
  return fixedCount;
}

// ─────────────────────────────────────────────────────────────────────────────
// Output
// ─────────────────────────────────────────────────────────────────────────────

function formatResults(results: Results, json: boolean): string {
  if (json) {
    return JSON.stringify(results, null, 2);
  }
  
  const lines: string[] = [];
  
  lines.push('');
  lines.push('┌─────────────────────────────────────────────────────────────────┐');
  lines.push('│  WORKWAY Import Health Check                                    │');
  lines.push('└─────────────────────────────────────────────────────────────────┘');
  lines.push('');
  
  if (results.violations.length === 0) {
    lines.push('✓ No import violations found');
    lines.push(`  Scanned ${results.filesScanned} files`);
    return lines.join('\n');
  }
  
  // Group by type
  const deprecated = results.violations.filter(v => v.type === 'deprecated');
  const directSource = results.violations.filter(v => v.type === 'direct-source');
  const crossPackage = results.violations.filter(v => v.type === 'relative-cross-package');
  
  if (deprecated.length > 0) {
    lines.push(`\n⚠ Deprecated Imports (${deprecated.length})`);
    lines.push('─'.repeat(60));
    for (const v of deprecated.slice(0, 10)) {
      lines.push(`  ${relative(process.cwd(), v.file)}:${v.line}`);
      lines.push(`    ${v.original} → ${v.replacement}`);
    }
    if (deprecated.length > 10) {
      lines.push(`  ... and ${deprecated.length - 10} more`);
    }
  }
  
  if (directSource.length > 0) {
    lines.push(`\n✗ Direct Source Imports (${directSource.length})`);
    lines.push('─'.repeat(60));
    for (const v of directSource.slice(0, 5)) {
      lines.push(`  ${relative(process.cwd(), v.file)}:${v.line}`);
    }
    if (directSource.length > 5) {
      lines.push(`  ... and ${directSource.length - 5} more`);
    }
  }
  
  if (crossPackage.length > 0) {
    lines.push(`\n✗ Cross-Package Relative Imports (${crossPackage.length})`);
    lines.push('─'.repeat(60));
    for (const v of crossPackage.slice(0, 5)) {
      lines.push(`  ${relative(process.cwd(), v.file)}:${v.line}`);
    }
    if (crossPackage.length > 5) {
      lines.push(`  ... and ${crossPackage.length - 5} more`);
    }
  }
  
  lines.push('');
  lines.push('─'.repeat(60));
  lines.push(`Summary: ${results.violations.length} violations in ${results.filesScanned} files`);
  if (results.fixable > 0) {
    lines.push(`         ${results.fixable} auto-fixable (run with --fix)`);
  }
  lines.push('');
  
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const shouldFix = args.includes('--fix');
  const jsonOutput = args.includes('--json');
  
  console.log(jsonOutput ? '' : '\nScanning for import violations...\n');
  
  const results = scanFiles();
  
  if (shouldFix && results.fixable > 0) {
    const fixed = applyFixes(results.violations);
    console.log(jsonOutput ? JSON.stringify({ fixed }) : `\n✓ Fixed ${fixed} violations\n`);
    
    const afterFix = scanFiles();
    console.log(formatResults(afterFix, jsonOutput));
    process.exit(afterFix.violations.length > 0 ? 1 : 0);
  } else {
    console.log(formatResults(results, jsonOutput));
    process.exit(results.violations.length > 0 ? 1 : 0);
  }
}

main();
