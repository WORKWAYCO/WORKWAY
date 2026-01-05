# Workflow Audit Skill

Run systematic quality audits on WORKWAY workflow configurations using Gas Town pattern.

## Usage

```bash
/workflow-audit                    # Audit all workflows
/workflow-audit --type=scoring     # Run specific audit type
/workflow-audit --sample=5         # Audit sample of 5 workflows
```

## What This Skill Does

Performs automated quality checks on workflow config_schema across all 60 production workflows:

1. **Scoring Rules**: Validates nameKeywords and tier thresholds
2. **Required Properties**: Checks property requirements match use cases
3. **API Endpoint Health**: Verifies fetchConfig endpoints are accessible
4. **OAuth Coverage**: Ensures OAuth providers exist in platform
5. **User Input Quality**: Reviews field labels, descriptions, defaults
6. **Error Messages**: Audits failureMessage helpfulness
7. **Schema Consistency**: Checks naming conventions and structure
8. **Field Mappings**: Validates field mapping completeness

## How It Works

1. Reads workflow config_schema from D1 database
2. Runs audit checks (leverages Gas Town Workers for parallelism)
3. Creates Beads issues for findings (auto-prioritized: P0-P3)
4. Generates markdown report with recommendations

## Audit Types

| Type | Focus | Priority Impact |
|------|-------|-----------------|
| `scoring` | Keyword strategy and tier thresholds | P2-P3 |
| `properties` | Required property validation | P1-P2 |
| `endpoints` | API endpoint health (200/401) | P0-P1 |
| `oauth` | OAuth provider coverage | P0 |
| `ux` | User input field quality | P2-P3 |
| `errors` | Error message helpfulness | P2 |
| `consistency` | Schema naming and structure | P2-P3 |
| `mappings` | Field mapping completeness | P1-P2 |

## Output Format

### Console
```
🔍 Workflow Audit: Scoring Rules
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Checking 60 workflows...

✅ 52 workflows: Keywords appropriate
⚠️  5 workflows: Weak keyword strategy
   - int_github_to_linear: Generic keywords (needs specificity)
   - int_form_response_hub: Missing strong keywords
   ...

❌ 3 workflows: No keywords defined
   - int_twilio_appointment_reminder
   - int_discord_standup_bot
   ...

Created 8 issues in Beads (ww-*)
Report: /tmp/workflow-audit-scoring-2026-01-05.md
```

### Beads Issues
```bash
bd list --label audit

ww-abc123: [Audit] Improve keyword strategy for GitHub→Linear workflow
Priority: P2
Labels: audit, workflows, ux

ww-xyz789: [Audit] Add OAuth provider config for Twilio
Priority: P0
Labels: audit, workflows, oauth
```

## When to Use

- After adding new workflows to marketplace
- Before major platform releases
- When user reports configuration issues
- Quarterly quality reviews
- After OAuth provider updates

## Formula

This skill uses the Gas Town formula: `specs/workflow-audit-suite.yaml`

To run via Gas Town directly:
```bash
bd work specs/workflow-audit-suite.yaml
```

The skill is a convenience wrapper that:
1. Validates database connection
2. Runs specified audit types
3. Formats output for human readability
4. Creates Beads issues automatically

## Philosophy

**Zuhandenheit**: The audit tool recedes. You run `/workflow-audit`, findings appear in Beads, you fix them. The mechanism disappears.

**Weniger, aber besser**: 8 focused audit types, each with clear purpose. No over-engineering for checks we don't need.

## Implementation Notes

- Audit logic lives in `packages/harness/src/audits/`
- Each audit exports `runAudit(workflows)` function
- Results follow standard `AuditResult` interface
- Idempotent: safe to re-run without side effects
- Database queries use read-only connections
- Gas Town Workers execute audits in parallel (2-4 concurrent)

## Related

- Formula spec: `specs/workflow-audit-suite.yaml`
- Gas Town docs: `packages/harness/GASTOWN_IMPLEMENTATION.md`
- Workflow config engine: `workway-platform/apps/api/src/lib/workflow-config-engine.ts`
