# Workflow Sample Audit Report
**Date**: 2026-01-05
**Sample Size**: 5 workflows
**Audit Types**: Scoring Rules, Required Properties, Error Messages, User Input Quality

---

## Executive Summary

Audited 5 workflows representing different complexity levels:
- ✅ **4/5** have appropriate scoring keywords
- ⚠️ **1/5** has requiredProperties defined (best practice)
- ✅ **5/5** have clear, actionable error messages
- ✅ **1/1** with user_input has good field quality

**Key Finding**: `requiredProperties` is underutilized. Only Typeform→Notion defines them, but they significantly improve database selection quality.

---

## Detailed Findings

### 1. Focus - Deep Work Automation (`int_focus_timeboxing`)

**Config**: Slack + Notion → Focus session logging

**Scoring Rules** ✅
- **Keywords**: Excellent
  - Strong: "focus", "time", "pomodoro", "deep work", "session"
  - Moderate: "task", "log", "productivity", "tracking"
- **Assessment**: Keywords are semantically appropriate for focus/productivity tracking
- **Tier thresholds**: Standard (0.7/0.5/0.3)

**Required Properties** ⚠️
- **Status**: MISSING
- **Recommendation**: Add properties for focus workflow:
  ```json
  "requiredProperties": [
    { "type": "title", "weight": 0.2, "purpose": "Task name" },
    { "type": "date", "weight": 0.2, "purpose": "Focus session date" },
    { "type": "number", "weight": 0.15, "purpose": "Duration (minutes)" },
    { "type": "rich_text", "weight": 0.1, "purpose": "Session notes" }
  ]
  ```

**Error Message** ✅
- **Text**: "Please connect both Slack (User) and Notion to continue"
- **Assessment**: Clear, actionable, specifies both required providers

---

### 2. GitHub to Linear (`int_github_to_linear`)

**Config**: GitHub + Linear → Issue sync

**Scoring Rules** N/A
- **Status**: No `resource_selection` step
- **Assessment**: OAuth-only workflow (no database/resource selection needed)
- **Note**: This is correct for simple sync workflows

**Required Properties** N/A
- Not applicable (no resource selection)

**Error Message** ✅
- **Text**: "Please connect GitHub and Linear to use this workflow"
- **Assessment**: Clear and actionable

---

### 3. Meeting Intelligence (`int_meeting_intelligence`)

**Config**: Zoom + Notion → Meeting transcripts

**Scoring Rules** ✅
- **Keywords**: Excellent
  - Strong: "meeting", "notes", "transcript", "zoom"
  - Moderate: "recordings", "calls", "sessions"
- **Assessment**: Keywords match meeting/transcript use case perfectly
- **Tier thresholds**: Standard (0.7/0.5/0.3)

**Required Properties** ⚠️
- **Status**: MISSING
- **Recommendation**: Add properties for meeting notes:
  ```json
  "requiredProperties": [
    { "type": "title", "weight": 0.25, "purpose": "Meeting title" },
    { "type": "date", "weight": 0.2, "purpose": "Meeting date" },
    { "type": "rich_text", "weight": 0.15, "purpose": "Transcript content" },
    { "type": "multi_select", "weight": 0.1, "purpose": "Attendees" }
  ]
  ```

**Error Message** ✅
- **Text**: "Please connect Zoom and Notion to use this workflow"
- **Assessment**: Clear and actionable

---

### 4. QuickBooks Invoice Collector (`int_quickbooks_invoice_collector`)

**Config**: QuickBooks + Notion → Invoice tracking

**Scoring Rules** ✅
- **Keywords**: Excellent
  - Strong: "invoices", "billing", "payments", "quickbooks"
  - Moderate: "finance", "accounting", "revenue"
- **Assessment**: Keywords are highly specific to invoice/billing domain
- **Tier thresholds**: Standard (0.7/0.5/0.3)

**Required Properties** ⚠️
- **Status**: MISSING
- **Recommendation**: Add properties for invoice tracking:
  ```json
  "requiredProperties": [
    { "type": "title", "weight": 0.2, "purpose": "Invoice number" },
    { "type": "number", "weight": 0.25, "purpose": "Invoice amount" },
    { "type": "date", "weight": 0.2, "purpose": "Due date" },
    { "type": "select", "weight": 0.15, "purpose": "Payment status" },
    { "type": "email", "weight": 0.1, "purpose": "Client email" }
  ]
  ```
- **Priority**: P1 (invoices are financial data - structure is critical)

**Error Message** ✅
- **Text**: "Please connect QuickBooks and Notion to use this workflow"
- **Assessment**: Clear and actionable

---

### 5. Typeform to Notion Sync (`int_typeform_notion_sync`) ⭐ Best Practice Example

**Config**: Typeform + Notion → Form response collection

**Scoring Rules** ✅ (Both steps)

**Step 1: Typeform Form Selection**
- **Keywords**: Good
  - Strong: "form", "survey", "questionnaire"
  - Moderate: "response", "submission", "feedback"
- **Assessment**: Generic but appropriate for Typeform forms

**Step 2: Notion Database Selection**
- **Keywords**: Excellent
  - Strong: "typeform", "form", "response", "responses"
  - Moderate: "lead", "submission", "entry", "survey"
- **Assessment**: Specific to Typeform→Notion use case

**Required Properties** ✅ EXCELLENT
- **Status**: DEFINED (only workflow in sample with this!)
- **Properties**:
  ```json
  [
    { "type": "title", "weight": 0.2, "purpose": "Response title or identifier" },
    { "type": "rich_text", "weight": 0.1, "purpose": "Form field content" },
    { "type": "email", "weight": 0.1, "purpose": "Respondent email" }
  ]
  ```
- **Assessment**:
  - Weights are balanced (total = 0.4, leaving room for optional properties)
  - Purpose descriptions are clear and specific
  - Property types match expected form response structure
  - **This is the gold standard** - other workflows should follow this pattern

**User Input Fields** ✅
- **Field 1**: "Include Hidden Fields"
  - Label: Clear and concise
  - Description: "Include hidden field values like UTM parameters" (specific example!)
  - Type: checkbox (appropriate)
  - Default: true (reasonable)

- **Field 2**: "Include Quiz Score"
  - Label: Clear and concise
  - Description: "Include calculated score for quiz forms" (explains when relevant)
  - Type: checkbox (appropriate)
  - Default: true (reasonable)

**Error Message** ✅
- **Text**: "Please connect both Typeform and Notion to continue"
- **Assessment**: Clear and actionable

---

## Audit Summary by Type

### Scoring Rules Audit
| Workflow | Status | Keywords Quality | Notes |
|----------|--------|------------------|-------|
| Focus - Deep Work | ✅ Pass | Excellent | Productivity-focused keywords appropriate |
| GitHub to Linear | N/A | N/A | No resource selection (correct) |
| Meeting Intelligence | ✅ Pass | Excellent | Meeting/transcript keywords spot-on |
| QuickBooks Invoice | ✅ Pass | Excellent | Finance-specific keywords |
| Typeform→Notion | ✅ Pass | Good | Generic form keywords (acceptable) |

**Result**: 4/4 applicable workflows have good scoring rules

### Required Properties Audit
| Workflow | Status | Properties Defined | Impact |
|----------|--------|--------------------|--------|
| Focus - Deep Work | ⚠️ Missing | No | Medium - would improve DB selection |
| GitHub to Linear | N/A | N/A | N/A |
| Meeting Intelligence | ⚠️ Missing | No | Medium - meetings have clear structure |
| QuickBooks Invoice | ❌ Missing | No | **High - invoices are structured data** |
| Typeform→Notion | ✅ Defined | Yes (3 properties) | N/A - already implemented |

**Result**: Only 1/4 applicable workflows define requiredProperties

**Recommendation**: Add requiredProperties to all workflows with structured data (meeting notes, invoices, focus sessions).

### Error Message Audit
| Workflow | Status | Message Quality | Notes |
|----------|--------|-----------------|-------|
| Focus - Deep Work | ✅ Pass | Clear | Specifies both providers |
| GitHub to Linear | ✅ Pass | Clear | Actionable |
| Meeting Intelligence | ✅ Pass | Clear | Actionable |
| QuickBooks Invoice | ✅ Pass | Clear | Actionable |
| Typeform→Notion | ✅ Pass | Clear | Specifies both providers |

**Result**: 5/5 workflows have clear, actionable error messages

### User Input Quality Audit
| Workflow | Fields | Label Quality | Description Quality | Defaults |
|----------|--------|---------------|---------------------|----------|
| Typeform→Notion | 2 | Excellent | Excellent (with examples) | Reasonable |

**Result**: 1/1 workflows with user_input have good field quality

---

## Prioritized Action Items

### P1 - High Impact (Financial/Structured Data)
1. **QuickBooks Invoice Collector** - Add requiredProperties for invoice structure
   - Properties: Invoice number, amount, due date, status, client email
   - Rationale: Invoices are structured financial data

### P2 - Medium Impact (Data Quality Improvement)
2. **Meeting Intelligence** - Add requiredProperties for meeting notes
   - Properties: Meeting title, date, transcript, attendees
   - Rationale: Improves database selection for meeting tracking

3. **Focus - Deep Work** - Add requiredProperties for focus sessions
   - Properties: Task name, date, duration, notes
   - Rationale: Improves database selection for productivity tracking

### P3 - Best Practice Documentation
4. **Create "requiredProperties Best Practices" guide**
   - Use Typeform→Notion as reference implementation
   - Document property weight guidelines (0.1-0.25 per property, 0.4-0.6 total)
   - Explain when to use requiredProperties vs when to skip

---

## Validation of Audit Approach

### What Worked
✅ **Scoring Rules Audit**: Easy to validate, clear pass/fail criteria
✅ **Error Message Audit**: Objective assessment of clarity
✅ **User Input Quality**: Typeform example shows what "good" looks like
✅ **Sample size sufficient**: 5 workflows revealed key pattern (requiredProperties underuse)

### What to Improve
⚠️ **Property Weight Validation**: Need automated check for total weight (should be 0.4-0.6)
⚠️ **Keyword Specificity**: Could rank keywords by specificity (domain-specific > generic)
⚠️ **Cross-workflow consistency**: Should check if similar workflows use similar keywords

### Recommended Automation
1. **requiredProperties checker**: Flag workflows with structured data but no properties
2. **Weight validator**: Ensure property weights sum to reasonable total
3. **Keyword similarity**: Flag workflows in same category with divergent keywords

---

## Conclusion

**Sample audit successfully validates approach.** Key insights:

1. **Scoring rules are generally good** - developers understand keyword strategy
2. **requiredProperties is the gap** - only 1/4 workflows use this powerful feature
3. **Error messages are consistently good** - no issues found
4. **User input quality is high** - when used, it's done well

**Next Steps**:
1. Run full audit on all 60 workflows (via Gas Town Workers)
2. Create Beads issues for requiredProperties additions (P1-P2)
3. Document Typeform→Notion as reference implementation
4. Add requiredProperties validation to workflow schema validator

**Estimated Impact**:
- **High**: QuickBooks Invoice (P1) - 1 workflow
- **Medium**: Meeting Intelligence, Focus (P2) - 2 workflows
- **Low**: Documentation/automation - platform-wide improvement

**Time to Fix**: ~2-4 hours for all 3 property additions

---

## Appendix: Full Config Samples

<details>
<summary>Typeform→Notion (Best Practice Example)</summary>

```json
{
  "version": "1.0",
  "steps": [
    {
      "id": "verify_oauth",
      "type": "oauth_verification",
      "providers": ["typeform", "notion"],
      "failureMessage": "Please connect both Typeform and Notion to continue"
    },
    {
      "id": "select_typeform_form",
      "type": "resource_selection",
      "config": {
        "provider": "typeform",
        "resourceType": "form",
        "title": "Select Typeform Form",
        "description": "Choose which form to sync responses from",
        "fetchConfig": {
          "endpoint": "https://api.typeform.com/forms",
          "method": "GET"
        },
        "scoringRules": {
          "nameKeywords": {
            "strong": ["form", "survey", "questionnaire"],
            "moderate": ["response", "submission", "feedback"]
          },
          "strongBoost": 0.3,
          "moderateBoost": 0.15,
          "tiers": {
            "excellent": 0.7,
            "good": 0.5,
            "fair": 0.3
          }
        }
      }
    },
    {
      "id": "select_notion_database",
      "type": "resource_selection",
      "config": {
        "provider": "notion",
        "resourceType": "database",
        "title": "Select Notion Database",
        "description": "Choose which database to create entries in",
        "fetchConfig": {
          "endpoint": "https://api.notion.com/v1/search",
          "method": "POST",
          "body": {
            "filter": {
              "property": "object",
              "value": "database"
            }
          }
        },
        "scoringRules": {
          "nameKeywords": {
            "strong": ["typeform", "form", "response", "responses"],
            "moderate": ["lead", "submission", "entry", "survey"]
          },
          "strongBoost": 0.3,
          "moderateBoost": 0.15,
          "requiredProperties": [
            {
              "type": "title",
              "weight": 0.2,
              "purpose": "Response title or identifier"
            },
            {
              "type": "rich_text",
              "weight": 0.1,
              "purpose": "Form field content"
            },
            {
              "type": "email",
              "weight": 0.1,
              "purpose": "Respondent email"
            }
          ],
          "tiers": {
            "excellent": 0.7,
            "good": 0.5,
            "fair": 0.3
          }
        }
      }
    },
    {
      "id": "configure_field_mappings",
      "type": "user_input",
      "config": {
        "title": "Configure Field Mappings",
        "description": "Map Typeform fields to Notion properties",
        "fields": [
          {
            "id": "includeHiddenFields",
            "type": "checkbox",
            "label": "Include Hidden Fields",
            "placeholder": "",
            "description": "Include hidden field values like UTM parameters",
            "required": false,
            "default": true
          },
          {
            "id": "includeScore",
            "type": "checkbox",
            "label": "Include Quiz Score",
            "placeholder": "",
            "description": "Include calculated score for quiz forms",
            "required": false,
            "default": true
          }
        ]
      }
    }
  ]
}
```
</details>
