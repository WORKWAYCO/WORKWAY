# System Architect Onboarding

WORKWAY Marketplace launches with 10 System Architects. Not 10,000.

Quality emerges from constraint, not scale.

---

## The Program

We're accepting 10 System Architects for the initial Marketplace cohort. Each will have the ability to publish workflows that users pay for. This isn't a beta—it's a curated launch.

**Why 10?**

- Every workflow reflects on the platform
- Support bandwidth is finite
- Patterns must stabilize before scaling
- Revenue share requires trust

**What you get:**

- Marketplace publishing (build once, earn recurring)
- Professional presence (your profile attracts client work)
- WORKWAY support crafting your positioning

WORKWAY helps System Architects build workflows AND find work.

If you're here, you've joined the waitlist. What follows is the path from waitlist to publishing.

---

## What You Have Access To

### Now (Waitlist)

| Access | Status |
|--------|--------|
| Public SDK (`@workwayco/sdk`) | ✓ Available |
| Public CLI (`workway`) | ✓ Available |
| Documentation | ✓ Available |
| Local development | ✓ Available |
| Profile creation | ✓ Available |
| SDK/CLI contributions | ✓ Welcome |

### After Approval

| Access | Status |
|--------|--------|
| Workflow publishing | Requires approval |
| Production OAuth credentials | Requires approval |
| Marketplace listing | Requires approval |
| Revenue share | Requires approval |

---

## Your Path

### 1. Get Acclimated

Install the CLI and SDK:

```bash
npm install -g @workwayco/cli
npm install @workwayco/sdk
```

Read the documentation:
- `packages/sdk/README.md` — SDK patterns
- `packages/sdk/DEVELOPERS.md` — Implementation details
- `docs/HEIDEGGER_DESIGN.md` — Design philosophy

Build locally. Break things. The SDK and CLI are public—improvements are welcome.

### 2. Create Your Profile

```bash
workway developer init
```

This creates your System Architect profile. It's stored locally until you submit.

Your profile serves two purposes:
- **Marketplace access**: Publishing rights, revenue share
- **Professional presence**: Attract client work through WORKWAY

Your profile includes:
- Identity (name, company/studio)
- Professional background (what you build, your expertise)
- Workflow focus (integrations, problems you solve)
- Why WORKWAY (what drew you here)

The profile isn't a form. It's your professional presence on the platform.

### 3. Submit for Review

```bash
workway developer submit
```

We review every submission. Criteria:

| Factor | Weight |
|--------|--------|
| Technical capability | High |
| Workflow viability | High |
| Alignment with platform direction | Medium |
| Contribution potential | Medium |

Response time: 5-7 business days.

### 4. Approval

If approved, you receive:
- Production OAuth credentials
- Workflow publishing access
- Marketplace listing capability
- Revenue share enrollment

If not approved, you receive:
- Specific feedback
- Path to resubmission (if applicable)

---

## What You Can Build Now

While waiting for approval, you can:

**Build integrations locally**
```bash
cd packages/integrations
# Add your integration following the BaseAPIClient pattern
```

**Test workflows locally**
```bash
workway workflow test ./my-workflow.ts --data test-payload.json
```

**Contribute to the SDK/CLI**

The SDK and CLI are open for contributions. If you find gaps, fill them. Good contributions demonstrate capability better than any application.

```bash
git clone https://github.com/workwayco/workway
cd workway
pnpm install
pnpm test
```

---

## Philosophy

WORKWAY follows Dieter Rams: *Weniger, aber besser*. Less, but better.

This applies to the developer program:
- Fewer developers, higher quality
- Fewer workflows, better curation
- Fewer features, deeper utility

Your workflow should disappear during use. Users don't want "automation"—they want outcomes. Meetings that summarize themselves. Payments that track themselves. The tool recedes; the outcome remains.

Read `docs/HEIDEGGER_DESIGN.md` for the full philosophy.

---

## Questions

Contact: developers@workway.co

Do not email asking for faster review. The timeline is the timeline.

---

## Summary

| Phase | What You Can Do | What You Cannot Do |
|-------|-----------------|-------------------|
| Waitlist | CLI, SDK, local dev, profile, contributions | Publish workflows |
| Review | Build locally, contribute | Publish workflows |
| Approved | Publish, earn, attract clients | — |

10 System Architects. Curated quality. The marketplace you publish to will be worth publishing to.

---

## Professional Services

WORKWAY provides support crafting your professional positioning:

- Profile optimization for client attraction
- Workflow portfolio strategy
- Integration specialization guidance

This isn't marketing fluff. We help you articulate what you build so the right clients find you.

Contact: developers@workway.co
