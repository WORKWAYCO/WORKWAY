# Gemini RLM Analysis: Critical Findings

**Date**: 2026-01-18
**Analyzer**: Gemini 2.5 Pro via Cloudflare RLM
**Cost**: $0.0054
**Outcome**: Unsuitable for code analysis

---

## Summary

Gemini Pro successfully performed the RLM analysis at 20x lower cost than Claude Sonnet, but **100% of reported DRY violations were hallucinated**.

While file paths were accurate (after prompt improvements), the code patterns described were completely fabricated.

---

## What Gemini Got Right

✅ **File path accuracy**: After adding explicit file lists to prompts, Gemini stopped inventing file paths
✅ **Plausibility**: Violations sounded realistic and followed common anti-patterns
✅ **Structure**: Output was well-formatted with priorities and recommendations
✅ **Cost**: $0.0054 vs ~$0.10 for Claude Sonnet (20x cheaper)

---

## What Gemini Got Wrong

❌ **Pattern accuracy**: 0% - all code patterns were fabricated
❌ **Service initialization**: No pino/Redis imports found in flagged files
❌ **Queue workers**: No `while(true)` patterns found in flagged files
❌ **Bead auditing**: No `kit.beads()` calls or described patterns found

### Verification Evidence

```bash
# Searching for pino/Redis imports in flagged files
grep -E "import.*(pino|Redis|ioredis)" packages/harness/src/*.ts
# Result: No matches found

# Searching for queue worker patterns
rg "while.*true" packages/harness/src/{convoy,hook-queue,merge-queue,molecule,observer}.ts
# Result: No matches found

# Searching for bead auditing patterns
rg "kit\.beads\(\)" packages/harness/src/audits/
# Result: No matches found

rg "bead\.type\s*===" packages/harness/src/audits/
# Result: No matches found
```

---

## Cost-Quality Trade-off

| Model | Cost | Pattern Accuracy | Value |
|-------|------|------------------|-------|
| Gemini Pro | $0.0054 | 0% (hallucinated) | Negative |
| Claude Sonnet | ~$0.10 | >95% expected | Positive |

**Conclusion**: The 20x cost savings is meaningless when you must manually verify every finding. Manual verification eliminates the automation benefit entirely.

---

## Recommendations

### For Code Analysis

1. **Use Claude Sonnet** - Higher cost justified by accurate results
2. **Never trust Gemini** - Even with perfect prompts, it fabricates code patterns
3. **Verification overhead** - If using Gemini, budget time to verify 100% of findings

### For RLM Use Cases

Gemini may be suitable for:
- Document summarization (where hallucinations are less critical)
- General Q&A (where accuracy can be manually spot-checked)
- Draft generation (where human review is expected)

Gemini is unsuitable for:
- Code analysis requiring precision
- Automated refactoring decisions
- Any use case where false positives are costly

### Prompt Engineering Lessons

**What worked:**
- Explicit file lists in prompts prevented file path hallucinations
- Structured output format produced well-organized results

**What didn't work:**
- Even with explicit constraints, Gemini fabricated code patterns
- "CRITICAL RULES" in prompts didn't prevent pattern hallucinations
- Context window size didn't affect hallucination rate

---

## Files Updated

- `DRY_VIOLATIONS_SUMMARY.md` - Added critical warning about hallucinations
- Beads issues closed: `Cloudflare-2lhp`, `Cloudflare-g5c4`, `Cloudflare-mv9s`

---

## Next Steps

1. If code analysis is needed, re-run with Claude Sonnet
2. Consider Gemini for non-critical document analysis only
3. Update RLM worker to prefer Claude for code-related queries
4. Document this finding for future reference

---

## Philosophical Note

> "Weniger, aber besser" (Less, but better)

A $0.10 analysis that's correct is infinitely more valuable than a $0.0054 analysis that requires $1.00 of verification time.

The tool should recede - but Gemini's hallucinations make it obstrusively visible.
