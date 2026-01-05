# REQUIRED-PROPERTIES Audit Report

**Executed:** 2026-01-05T19:46:45.388Z
**Total Workflows:** 49
**Workflows Audited:** 9
**Findings:** 9

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 9 |
| Low | 0 |
| **Total** | **9** |

**Auto-fixable:** 0 findings

## Medium Severity Findings

### Stripe to QuickBooks Payment Sync (`accounting-stays-current`)

**Issue:** Missing requiredProperties configuration

**Recommendation:** Add requiredProperties to ensure workflow has necessary data inputs

**Priority:** P2
**Auto-fixable:** No
**File:** `/Users/micahjohnson/Documents/Github/WORKWAY/Cloudflare/packages/workflows/src/accounting-stays-current/index.ts`

**Context:**
```json
{
  "category": "finance-billing",
  "suggestedProperties": [
    {
      "name": "invoice_amount",
      "rationale": "Financial workflows typically need amount tracking"
    },
    {
      "name": "customer_email",
      "rationale": "Customer identification for billing"
    }
  ]
}
```

---

### Deal Tracker (`deal-tracker`)

**Issue:** Missing requiredProperties configuration

**Recommendation:** Add requiredProperties to ensure workflow has necessary data inputs

**Priority:** P2
**Auto-fixable:** No
**File:** `/Users/micahjohnson/Documents/Github/WORKWAY/Cloudflare/packages/workflows/src/deal-tracker/index.ts`

**Context:**
```json
{
  "category": "sales-crm",
  "suggestedProperties": [
    {
      "name": "customer_email",
      "rationale": "Customer identification"
    },
    {
      "name": "deal_stage",
      "rationale": "Sales pipeline tracking"
    }
  ]
}
```

---

### Invoice Generator (`invoice-generator`)

**Issue:** Missing requiredProperties configuration

**Recommendation:** Add requiredProperties to ensure workflow has necessary data inputs

**Priority:** P2
**Auto-fixable:** No
**File:** `/Users/micahjohnson/Documents/Github/WORKWAY/Cloudflare/packages/workflows/src/invoice-generator/index.ts`

**Context:**
```json
{
  "category": "finance-billing",
  "suggestedProperties": [
    {
      "name": "invoice_amount",
      "rationale": "Financial workflows typically need amount tracking"
    },
    {
      "name": "customer_email",
      "rationale": "Customer identification for billing"
    }
  ]
}
```

---

### Meeting Expense Tracker (`meeting-expense-tracker`)

**Issue:** Missing requiredProperties configuration

**Recommendation:** Add requiredProperties to ensure workflow has necessary data inputs

**Priority:** P2
**Auto-fixable:** No
**File:** `/Users/micahjohnson/Documents/Github/WORKWAY/Cloudflare/packages/workflows/src/meeting-expense-tracker/index.ts`

**Context:**
```json
{
  "category": "finance",
  "suggestedProperties": [
    {
      "name": "invoice_amount",
      "rationale": "Financial workflows typically need amount tracking"
    },
    {
      "name": "customer_email",
      "rationale": "Customer identification for billing"
    }
  ]
}
```

---

### Payment Celebration (`payment-celebration`)

**Issue:** Missing requiredProperties configuration

**Recommendation:** Add requiredProperties to ensure workflow has necessary data inputs

**Priority:** P2
**Auto-fixable:** No
**File:** `/Users/micahjohnson/Documents/Github/WORKWAY/Cloudflare/packages/workflows/src/payment-celebration/index.ts`

**Context:**
```json
{
  "category": "finance-billing",
  "suggestedProperties": [
    {
      "name": "invoice_amount",
      "rationale": "Financial workflows typically need amount tracking"
    },
    {
      "name": "customer_email",
      "rationale": "Customer identification for billing"
    }
  ]
}
```

---

### Payment Reminder System (`payment-reminders`)

**Issue:** Missing requiredProperties configuration

**Recommendation:** Add requiredProperties to ensure workflow has necessary data inputs

**Priority:** P2
**Auto-fixable:** No
**File:** `/Users/micahjohnson/Documents/Github/WORKWAY/Cloudflare/packages/workflows/src/payment-reminders/index.ts`

**Context:**
```json
{
  "category": "finance-billing",
  "suggestedProperties": [
    {
      "name": "invoice_amount",
      "rationale": "Financial workflows typically need amount tracking"
    },
    {
      "name": "customer_email",
      "rationale": "Customer identification for billing"
    }
  ]
}
```

---

### QuickBooks Cash Flow Monitor (`quickbooks-cash-flow-monitor`)

**Issue:** Missing requiredProperties configuration

**Recommendation:** Add requiredProperties to ensure workflow has necessary data inputs

**Priority:** P2
**Auto-fixable:** No
**File:** `/Users/micahjohnson/Documents/Github/WORKWAY/Cloudflare/packages/workflows/src/quickbooks-cash-flow-monitor/index.ts`

**Context:**
```json
{
  "category": "finance-billing",
  "suggestedProperties": [
    {
      "name": "invoice_amount",
      "rationale": "Financial workflows typically need amount tracking"
    },
    {
      "name": "customer_email",
      "rationale": "Customer identification for billing"
    }
  ]
}
```

---

### QuickBooks Invoice Collector (`quickbooks-invoice-collector`)

**Issue:** Missing requiredProperties configuration

**Recommendation:** Add requiredProperties to ensure workflow has necessary data inputs

**Priority:** P2
**Auto-fixable:** No
**File:** `/Users/micahjohnson/Documents/Github/WORKWAY/Cloudflare/packages/workflows/src/quickbooks-invoice-collector/index.ts`

**Context:**
```json
{
  "category": "finance-billing",
  "suggestedProperties": [
    {
      "name": "invoice_amount",
      "rationale": "Financial workflows typically need amount tracking"
    },
    {
      "name": "customer_email",
      "rationale": "Customer identification for billing"
    }
  ]
}
```

---

### Revenue Radar (`revenue-radar`)

**Issue:** Missing requiredProperties configuration

**Recommendation:** Add requiredProperties to ensure workflow has necessary data inputs

**Priority:** P2
**Auto-fixable:** No
**File:** `/Users/micahjohnson/Documents/Github/WORKWAY/Cloudflare/packages/workflows/src/revenue-radar/index.ts`

**Context:**
```json
{
  "category": "finance-accounting",
  "suggestedProperties": [
    {
      "name": "invoice_amount",
      "rationale": "Financial workflows typically need amount tracking"
    },
    {
      "name": "customer_email",
      "rationale": "Customer identification for billing"
    }
  ]
}
```

---
