# Dental Practice Pathway

## Zuhandenheit: The Tool Must Recede

Dental practices don't want:
- "Sikka API integration"
- "Appointment reminder system"
- "Review management platform"

They want:
- **Chairs that stay full**
- **Patients who show up**
- **5-star reviews that write themselves**

## The Pathway Model

Traditional SaaS onboarding forces users into *Vorhandenheit*—theoretical contemplation of tools as objects:

```
Sign up → Browse → Configure → Map fields → Test → Activate
```

WORKWAY inverts this with the **Pathway**:

```
Trigger → Suggestion → Accept → Done
```

## User Journey: Dental Practice

### Step 1: Sign Up
- User arrives at workway.co
- "What practice management software do you use?"
- Shows logos: Dentrix, Eaglesoft, Open Dental, etc.
- All roads lead to Sikka (one integration covers 400+ PMS)

### Step 2: Connect Sikka
- OAuth-like flow via Sikka portal
- User logs in, authorizes WORKWAY
- We receive `office_id` + `secret_key`
- Silently: `getAuthorizedPractices()` → `obtainRequestKey()`

### Step 3: First Suggestion (Automatic)

The moment Sikka connects, this fires:

```typescript
{
  trigger: 'integration_connected',
  integrations: ['sikka'],
  workflowId: 'dental-appointment-autopilot',
  priority: 95,
}
```

User sees:

```
┌────────────────────────────────────────────────┐
│  Connected to [Practice Name]                  │
│                                                │
│  Want patients who actually show up?           │
│                                                │
│  Smart reminders 48h, 24h, and 2h before       │
│  appointments. Patients confirm via text.      │
│  Cancellations auto-fill from waitlist.        │
│                                                │
│  ┌──────────────┐       ┌─────────────┐       │
│  │ Enable Now   │       │ Maybe Later │       │
│  └──────────────┘       └─────────────┘       │
│                                                │
│  20 free executions · then 5¢ per reminder     │
└────────────────────────────────────────────────┘
```

**No configuration form.** Works out of box.

### Step 4: Accept = Done

One tap activates the workflow. Smart defaults:
- `reminder48h: true`
- `reminder24h: true`
- `reminder2h: true`
- `enableWaitlistBackfill: true`

The tool recedes. Reminders start flowing.

### Step 5: Second Suggestion (Pattern-Based)

After ~10 appointments complete, this fires:

```typescript
{
  trigger: 'pattern_detected',
  condition: 'appointments_completed >= 10',
  workflowId: 'dental-review-booster',
  priority: 85,
}
```

User sees:

```
┌────────────────────────────────────────────────┐
│  12 patients visited this week!                │
│                                                │
│  Want 5-star reviews that write themselves?    │
│                                                │
│  After each visit, we ask how it went.         │
│  Happy patients → direct link to Google/Yelp   │
│  Unhappy patients → personal follow-up first   │
│                                                │
│  ┌──────────────┐       ┌─────────────┐       │
│  │ Enable Now   │       │   Not Now   │       │
│  └──────────────┘       └─────────────┘       │
│                                                │
│  20 free executions · then 25¢ per review flow │
└────────────────────────────────────────────────┘
```

## Available Workflows

| Workflow | Outcome | Per Execution | Essential Fields |
|----------|---------|---------------|------------------|
| **Dental Appointment Autopilot** | Chairs that stay full | 5¢ (light) | 1 (practiceId) |
| **Dental Review Booster** | Reviews that write themselves | 25¢ (heavy) | 2 (practiceId, googleReviewUrl) |

### Future Workflows

| Workflow | Outcome | Trigger |
|----------|---------|---------|
| **Hygiene Recall Engine** | Patients who never go overdue | 6+ months since last cleaning |
| **Treatment Plan Closer** | Treatment acceptance that closes itself | Unsigned treatment plans detected |
| **Cancellation Backfill** | Empty slots that fill themselves | Last-minute cancellation |

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        WORKWAY                               │
├─────────────────────────────────────────────────────────────┤
│  Sikka Integration                                          │
│  ├── getAuthorizedPractices() → office_id, secret_key       │
│  ├── obtainRequestKey() → request_key (24h)                 │
│  └── Data access: patients, appointments, providers, etc.   │
├─────────────────────────────────────────────────────────────┤
│  Workflows                                                  │
│  ├── dental-appointment-autopilot (cron: */15 * * * *)     │
│  │   └── Check upcoming → Send reminders → Alert staff      │
│  └── dental-review-booster (cron: */15 * * * *)            │
│      └── Check completed → Satisfaction SMS → Route         │
├─────────────────────────────────────────────────────────────┤
│  Outputs                                                    │
│  ├── Twilio (SMS reminders)                                │
│  ├── Slack (Staff alerts)                                  │
│  └── Google Business / Yelp (Review links)                 │
└─────────────────────────────────────────────────────────────┘
```

## Technical Requirements

### Web App (apps/web)

1. **Sikka OAuth Flow**
   - Redirect to Sikka portal
   - Handle callback with office_id + secret_key
   - Store credentials securely
   - Auto-obtain request_key

2. **Discovery Moment UI**
   - Listen for `integration_connected` events
   - Show pathway suggestion modal
   - One-tap activation
   - No configuration forms

3. **Workflow Status Dashboard**
   - Active workflows
   - Recent activity (reminders sent, reviews captured)
   - Simple on/off toggles

### API (packages/api)

1. **Sikka Credential Storage**
   - Encrypt office_id + secret_key
   - Auto-refresh request_key (24h expiry)

2. **Workflow Execution**
   - Cron scheduler for dental workflows
   - Rate limit handling (Sikka Silver plan)
   - Graceful degradation

### SDK (packages/sdk)

1. **Request Key Management**
   - Auto-refresh when expired
   - Cache valid keys
   - Handle refresh failures gracefully

## Pricing Model

```typescript
pricing: {
  model: 'usage',
  tier: 'light',           // or 'heavy' for AI-powered workflows
  costPerExecution: 0.05,  // 5¢ for light, 25¢ for heavy
  freeTrialExecutions: 20,
  upfrontFee: 0,           // developer can set optional upfront fee
}
```

**Weniger, aber besser**: Pay only for what runs. No monthly fees. No commitments.

- **Light workflows** (5¢): Simple automations like SMS reminders, data syncs
- **Heavy workflows** (25¢): AI-powered flows like sentiment analysis, multi-step orchestration
- **20 free executions** per workflow to prove value before paying

## Success Metrics

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| **Time to First Reminder** | < 24 hours | Tool recession |
| **No-Show Rate Reduction** | > 30% | Outcome achieved |
| **Review Conversion** | > 15% of happy patients | Outcome achieved |
| **30-Day Retention** | > 80% | Continuous value |

## Zuhandenheit Checklist

- [x] Works out of box (smart defaults)
- [x] Essential fields ≤ 3
- [x] Automatic trigger (cron, no manual action)
- [x] Graceful degradation (Twilio optional)
- [x] One integration pair = one workflow
- [x] Outcome-focused language
- [x] No configuration forms
- [x] Usage-based pricing (pay for outcomes, not access)
