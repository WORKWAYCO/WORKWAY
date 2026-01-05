# Schema Consistency Migration

Auto-fix migration script to resolve 409 schema consistency findings identified in workflow audits.

## Quick Start

```bash
# 1. Test on 5 workflows first (dry run)
pnpm migrate:schema:test

# 2. Preview all changes (dry run)
pnpm migrate:schema:dry-run

# 3. Apply fixes
pnpm migrate:schema

# 4. Rollback if needed
pnpm migrate:schema:rollback
```

## What It Fixes

The migration tool automatically fixes three categories of schema consistency issues:

### 1. Config Wrapper Inconsistencies (49 findings)

**Problem**: Workflows use deprecated `inputs:` wrapper instead of `config:`

**Before**:
```typescript
verify_oauth: {
  type: 'verify_oauth',
  inputs: {
    service: 'zoom'
  }
}
```

**After**:
```typescript
verify_oauth: {
  type: 'verify_oauth',
  config: {
    service: 'zoom'
  }
}
```

**Note**: The fixer intelligently skips `user_input` steps which correctly use `inputs:` for field definitions.

### 2. Step Naming Conventions (359 findings)

**Problem**: Step names use camelCase instead of snake_case

**Before**:
```typescript
autoMatchInvoices: {
  type: 'api_call',
  // ...
}
```

**After**:
```typescript
auto_match_invoices: {
  type: 'api_call',
  // ...
}
```

The fixer automatically:
- Renames step definitions
- Updates all references (`steps.stepName`)
- Updates string references (`"stepName"`)

### 3. Version Format Normalization (1 finding)

**Problem**: Version formats don't match standard "X.Y" pattern

**Before**:
```typescript
export const metadata = {
  version: '1.0.0'
}
```

**After**:
```typescript
export const metadata = {
  version: '1.0'
}
```

## Safety Features

### 1. Dry-Run Mode

Preview all changes before applying:

```bash
pnpm migrate:schema:dry-run
```

Output shows exactly what will change:

```
📄 Processing: accounting-stays-current/index.ts
   ✓ Fixed: Workflow uses deprecated "inputs" wrapper
   ✓ Fixed: Step name "autoMatchInvoices" doesn't follow convention
   ✓ Fixed: Step name "createCustomerIfMissing" doesn't follow convention
   📋 Would modify this file (dry run)
```

### 2. Automatic Backups

Before any changes, the tool creates backups at:

```
packages/workflows/.schema-backup/
├── accounting-stays-current.index.ts
├── deal-tracker.index.ts
└── ... (all modified workflows)
```

### 3. TypeScript Validation

After each file modification, the tool runs `tsc --noEmit` to validate syntax. If validation fails, the file is automatically restored from backup.

### 4. Rollback Capability

If something goes wrong, instantly rollback all changes:

```bash
pnpm migrate:schema:rollback
```

This restores all files from the backup directory.

### 5. Subset Testing

Test on a small number of workflows first:

```bash
# Test on 5 workflows only
pnpm migrate:schema --subset 5 --dry-run

# Apply to 5 workflows
pnpm migrate:schema --subset 5
```

## Migration Report

After running, a detailed report is generated at:

```
audit-reports/schema-consistency-migration-YYYY-MM-DD.json
```

Example report structure:

```json
{
  "executedAt": "2026-01-05T21:30:00.000Z",
  "dryRun": false,
  "totalFindings": 409,
  "fixedFindings": 405,
  "failedFixes": 0,
  "skippedFindings": 4,
  "filesModified": 47,
  "backupPath": "/path/to/.schema-backup",
  "changes": [
    {
      "file": "/path/to/workflow/index.ts",
      "findingType": "config-wrapper",
      "before": "inputs: {...}",
      "after": "config: {...}",
      "success": true
    }
  ],
  "errors": []
}
```

## Verification

After running the migration, verify all findings are resolved:

```bash
# Run audit again
pnpm audit:dry-run

# Check schema-consistency report
cat audit-reports/schema-consistency-report.json | jq '.findingsCount'
# Expected: 0 (down from 409)
```

## Advanced Usage

### Custom Paths

```bash
# Custom findings file
pnpm migrate:schema --findings /path/to/custom-report.json

# Custom workflows directory
pnpm migrate:schema --workflows /path/to/workflows
```

### Programmatic Usage

```typescript
import { SchemaConsistencyFixer } from '@workwayco/harness/migrations';

const fixer = new SchemaConsistencyFixer('/path/to/workflows', {
  dryRun: true
});

const report = await fixer.execute('/path/to/findings.json');

console.log(`Fixed ${report.fixedFindings} findings`);
```

## Troubleshooting

### Problem: TypeScript validation fails after changes

**Solution**: The tool automatically rolls back the file. Check the error in the migration report and fix manually.

### Problem: Some findings not fixed

**Solution**: Check the `skippedFindings` count in the report. Some findings may not be auto-fixable (e.g., complex cases requiring manual review).

### Problem: Need to restore original files

**Solution**:
```bash
pnpm migrate:schema:rollback
```

### Problem: Want to see what changed

**Solution**: Check the migration report JSON file:
```bash
cat audit-reports/schema-consistency-migration-*.json | jq '.changes'
```

## Testing Workflow

Recommended testing workflow before production:

1. **Run audit to get baseline**:
   ```bash
   pnpm audit:dry-run
   ```

2. **Test on 5 workflows (dry run)**:
   ```bash
   pnpm migrate:schema:test
   ```

3. **Apply to 5 workflows**:
   ```bash
   pnpm migrate:schema --subset 5
   ```

4. **Verify 5 workflows still work**:
   ```bash
   # Manually test or run workflow tests
   ```

5. **If successful, apply to all**:
   ```bash
   pnpm migrate:schema
   ```

6. **Re-run audit to verify**:
   ```bash
   pnpm audit:dry-run
   ```

Expected result: `schema-consistency: 0 findings` (down from 409)

## Architecture

The migration tool follows these principles:

- **Idempotent**: Can be run multiple times safely
- **Atomic**: Either all changes succeed or none (per file)
- **Reversible**: Full rollback capability
- **Transparent**: Detailed logging and reporting
- **Safe**: Extensive validation and backups

## Acceptance Criteria

✅ Dry-run mode shows all planned changes
✅ Migration completes successfully with 0 errors
✅ Post-migration audit shows 0 schema consistency findings (down from 409)
✅ All workflows still function correctly
✅ Detailed migration report generated
✅ Backup created before any changes
✅ TypeScript validation passes after changes
✅ Rollback functionality works

## Impact

This migration eliminates **96.7%** of all audit findings (409 out of 423), significantly improving codebase consistency and maintainability.
