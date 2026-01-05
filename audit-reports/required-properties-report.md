# REQUIRED-PROPERTIES Audit Report

**Executed:** 2026-01-05T21:42:41.949Z
**Total Workflows:** 49
**Workflows Audited:** 8
**Findings:** 8

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 8 |
| **Total** | **8** |

**Auto-fixable:** 0 findings

## Low Severity Findings

### Stripe to QuickBooks Payment Sync (`accounting-stays-current`)

**Issue:** Property "customer_email" may not align with workflow purpose

**Recommendation:** Review if "customer_email" is necessary for this workflow. Typically used in: crm, sales, support, customer

**Priority:** P3
**Auto-fixable:** No
**File:** `/Users/micahjohnson/Documents/Github/WORKWAY/Cloudflare/packages/workflows/src/accounting-stays-current/index.ts`

**Context:**
```json
{
  "property": "customer_email",
  "typicalUseCases": [
    "crm",
    "sales",
    "support",
    "customer"
  ],
  "workflowCategory": "finance-billing"
}
```

---

### Invoice Generator (`invoice-generator`)

**Issue:** Property "customer_email" may not align with workflow purpose

**Recommendation:** Review if "customer_email" is necessary for this workflow. Typically used in: crm, sales, support, customer

**Priority:** P3
**Auto-fixable:** No
**File:** `/Users/micahjohnson/Documents/Github/WORKWAY/Cloudflare/packages/workflows/src/invoice-generator/index.ts`

**Context:**
```json
{
  "property": "customer_email",
  "typicalUseCases": [
    "crm",
    "sales",
    "support",
    "customer"
  ],
  "workflowCategory": "finance-billing"
}
```

---

### Meeting Expense Tracker (`meeting-expense-tracker`)

**Issue:** Property "customer_email" may not align with workflow purpose

**Recommendation:** Review if "customer_email" is necessary for this workflow. Typically used in: crm, sales, support, customer

**Priority:** P3
**Auto-fixable:** No
**File:** `/Users/micahjohnson/Documents/Github/WORKWAY/Cloudflare/packages/workflows/src/meeting-expense-tracker/index.ts`

**Context:**
```json
{
  "property": "customer_email",
  "typicalUseCases": [
    "crm",
    "sales",
    "support",
    "customer"
  ],
  "workflowCategory": "finance"
}
```

---

### Payment Celebration (`payment-celebration`)

**Issue:** Property "customer_email" may not align with workflow purpose

**Recommendation:** Review if "customer_email" is necessary for this workflow. Typically used in: crm, sales, support, customer

**Priority:** P3
**Auto-fixable:** No
**File:** `/Users/micahjohnson/Documents/Github/WORKWAY/Cloudflare/packages/workflows/src/payment-celebration/index.ts`

**Context:**
```json
{
  "property": "customer_email",
  "typicalUseCases": [
    "crm",
    "sales",
    "support",
    "customer"
  ],
  "workflowCategory": "finance-billing"
}
```

---

### Payment Reminder System (`payment-reminders`)

**Issue:** Property "customer_email" may not align with workflow purpose

**Recommendation:** Review if "customer_email" is necessary for this workflow. Typically used in: crm, sales, support, customer

**Priority:** P3
**Auto-fixable:** No
**File:** `/Users/micahjohnson/Documents/Github/WORKWAY/Cloudflare/packages/workflows/src/payment-reminders/index.ts`

**Context:**
```json
{
  "property": "customer_email",
  "typicalUseCases": [
    "crm",
    "sales",
    "support",
    "customer"
  ],
  "workflowCategory": "finance-billing"
}
```

---

### QuickBooks Cash Flow Monitor (`quickbooks-cash-flow-monitor`)

**Issue:** Property "customer_email" may not align with workflow purpose

**Recommendation:** Review if "customer_email" is necessary for this workflow. Typically used in: crm, sales, support, customer

**Priority:** P3
**Auto-fixable:** No
**File:** `/Users/micahjohnson/Documents/Github/WORKWAY/Cloudflare/packages/workflows/src/quickbooks-cash-flow-monitor/index.ts`

**Context:**
```json
{
  "property": "customer_email",
  "typicalUseCases": [
    "crm",
    "sales",
    "support",
    "customer"
  ],
  "workflowCategory": "finance-billing"
}
```

---

### QuickBooks Invoice Collector (`quickbooks-invoice-collector`)

**Issue:** Property "customer_email" may not align with workflow purpose

**Recommendation:** Review if "customer_email" is necessary for this workflow. Typically used in: crm, sales, support, customer

**Priority:** P3
**Auto-fixable:** No
**File:** `/Users/micahjohnson/Documents/Github/WORKWAY/Cloudflare/packages/workflows/src/quickbooks-invoice-collector/index.ts`

**Context:**
```json
{
  "property": "customer_email",
  "typicalUseCases": [
    "crm",
    "sales",
    "support",
    "customer"
  ],
  "workflowCategory": "finance-billing"
}
```

---

### Revenue Radar (`revenue-radar`)

**Issue:** Property "customer_email" may not align with workflow purpose

**Recommendation:** Review if "customer_email" is necessary for this workflow. Typically used in: crm, sales, support, customer

**Priority:** P3
**Auto-fixable:** No
**File:** `/Users/micahjohnson/Documents/Github/WORKWAY/Cloudflare/packages/workflows/src/revenue-radar/index.ts`

**Context:**
```json
{
  "property": "customer_email",
  "typicalUseCases": [
    "crm",
    "sales",
    "support",
    "customer"
  ],
  "workflowCategory": "finance-accounting"
}
```

---
