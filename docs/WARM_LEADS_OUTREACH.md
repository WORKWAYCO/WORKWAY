# Warm Leads Outreach Plan

> **Goal**: Contact 10 warm leads this week. Convert 3 to paying customers.

## Lead Sources

### 1. npm Package Users (@workwayco/sdk)

**How to find**:
```bash
# Check weekly downloads
npm info @workwayco/sdk

# For detailed analytics, use npm's website:
# https://www.npmjs.com/package/@workwayco/sdk
```

**What we know**: ~845 downloads/week (from YC readiness audit)

**Outreach angle**: "You're already using @workwayco/sdk. Want early access to the marketplace?"

### 2. GitHub Stargazers

**How to find**:
```bash
# List stargazers via GitHub API
gh api repos/WORKWAYCO/WORKWAY/stargazers --paginate
```

**Outreach angle**: "You starred WORKWAY. The marketplace is live—want to be one of our first workflow creators?"

### 3. Waitlist Signups

**Location**: Check your email marketing tool (Mailchimp, ConvertKit, etc.) or Airtable

**Outreach angle**: "You signed up for WORKWAY. We're live. Here's your early access."

## 10 Warm Leads Template

Fill in with real data from the sources above:

| # | Name | Source | Email/Contact | Company/Context | Personalization Hook | Status |
|---|------|--------|---------------|-----------------|---------------------|--------|
| 1 | | npm user | | | Specific package usage | ⬜ Not contacted |
| 2 | | npm user | | | | ⬜ Not contacted |
| 3 | | GitHub star | | | When they starred | ⬜ Not contacted |
| 4 | | GitHub star | | | | ⬜ Not contacted |
| 5 | | Waitlist | | | What they said they'd build | ⬜ Not contacted |
| 6 | | Waitlist | | | | ⬜ Not contacted |
| 7 | | Waitlist | | | | ⬜ Not contacted |
| 8 | | Twitter/X | | | Their automation tweets | ⬜ Not contacted |
| 9 | | LinkedIn | | | Their integration work | ⬜ Not contacted |
| 10 | | Referral | | | Who referred them | ⬜ Not contacted |

**Status Legend**:
- ⬜ Not contacted
- 📧 Email sent
- 👀 Opened
- 💬 Replied
- 📞 Call scheduled
- ✅ Converted
- ❌ Not interested

## Personalized Email Templates

### Template A: npm Package User

**Subject**: You're using @workwayco/sdk—want early marketplace access?

```
Hi [Name],

I noticed you've been using @workwayco/sdk. Thanks for being an early adopter.

Quick update: The WORKWAY marketplace is now live. You can:
- Publish workflows and earn from every install
- Get 100% of upfront revenue (we only charge per-execution)
- Access private workflows for enterprise clients

As an early SDK user, I'd love to give you priority access and hear what you're building.

Worth a 15-minute chat this week?

Best,
[Danny/Micah]
Half Dozen / WORKWAY
```

### Template B: GitHub Stargazer

**Subject**: You starred WORKWAY—want to be a founding creator?

```
Hi [Name],

You starred WORKWAY on GitHub [X days ago]. Thanks for the support!

Since then, we've launched the marketplace. Founding creators get:
- Featured placement for the first 30 days
- Direct Slack access to the team
- Priority support for your workflows

We're looking for 10 developers to create the first marketplace workflows. Interested?

Best,
[Danny/Micah]
```

### Template C: Waitlist Signup

**Subject**: WORKWAY is live—your early access is ready

```
Hi [Name],

You signed up for WORKWAY [when they signed up]. The wait is over—we're live.

Here's your early access: workway.co

What you can do now:
- Build TypeScript workflows (no visual builders)
- Publish to the marketplace and earn per-execution
- Create private workflows for clients

What are you hoping to automate first? I'd love to help you ship your first workflow.

Best,
[Danny/Micah]
```

### Template D: Twitter/X Automation Builder

**Subject**: Saw your [specific tweet]—this might help

```
Hi [Name],

I saw your tweet about [specific automation problem/project].

We built WORKWAY to solve exactly this: TypeScript workflows that run on Cloudflare's edge. No Zapier limits, no per-task pricing.

Example: [relevant workflow to their tweet]

Want to try it? I'll personally help you port your automation.

Best,
[Danny/Micah]
```

## Outreach Tracking

### Daily Log

| Date | Lead # | Action | Response | Next Step |
|------|--------|--------|----------|-----------|
| | | | | |

### Weekly Metrics

| Week | Emails Sent | Opens | Replies | Calls | Conversions |
|------|-------------|-------|---------|-------|-------------|
| 1 | | | | | |
| 2 | | | | | |

### Conversion Funnel

```
Contacted (10)
    ↓
Opened (target: 6 = 60%)
    ↓
Replied (target: 3 = 30%)
    ↓
Call Scheduled (target: 2 = 20%)
    ↓
Paid Customer (target: 1 = 10%)
```

## Follow-Up Cadence

| Day | Action |
|-----|--------|
| 0 | Initial email |
| 3 | Follow-up if no open |
| 7 | Second follow-up with different angle |
| 14 | Final "closing the loop" email |

### Follow-Up Template (Day 3)

**Subject**: Re: [Original subject]

```
Hi [Name],

Just floating this back up. Happy to jump on a quick call if easier than email.

[One-line value prop reminder]

Best,
[Danny/Micah]
```

### Follow-Up Template (Day 7)

**Subject**: Different angle—[new hook]

```
Hi [Name],

Trying a different approach: [share a specific workflow example or case study relevant to them]

If this resonates, let's chat. If not, no worries—I'll stop bugging you.

Best,
[Danny/Micah]
```

### Final Follow-Up (Day 14)

**Subject**: Closing the loop

```
Hi [Name],

I'll assume this isn't the right time. No problem.

If you ever need TypeScript workflows that run on the edge, we're at workway.co.

Best,
[Danny/Micah]
```

## Action Items

1. **Today**: Export npm users, GitHub stars, waitlist → fill in lead table
2. **Tomorrow**: Send first 5 emails (personalized)
3. **Day 3**: Send remaining 5 emails
4. **Day 4+**: Follow-up cadence for non-responders
5. **End of Week**: Review metrics, adjust messaging

## Tools Needed

- [ ] Email tool with open tracking (Superhuman, Mailtrack, etc.)
- [ ] Calendar booking link (Calendly, Cal.com)
- [ ] CRM or spreadsheet for tracking (Notion, Airtable, Google Sheets)

## Success Criteria

- **Minimum**: 1 paying customer from warm leads
- **Target**: 3 paying customers
- **Stretch**: 5 paying customers

---

**Owner**: Danny Morgan (Growth) + Micah Johnson (Technology)

**Last Updated**: 2025-12-31
