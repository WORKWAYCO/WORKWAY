# F→N Admin Guide

> For Half Dozen team members creating client invitations.

## Quick Start

1. Go to [fn.workway.co/admin](https://fn.workway.co/admin)
2. Click **Create New Invitation**
3. Fill out the form → **Generate Invitation Link**
4. Copy and share the link with your client

---

## Creating a Client Invitation

### Step 1: Open Admin Panel

Navigate to [fn.workway.co/admin](https://fn.workway.co/admin)

You'll see:
- **Stats cards** — Active, Redeemed, Expired counts
- **Create New Invitation** button
- **Invitation list** — All existing invitations

### Step 2: Fill Out the Form

| Field | Description |
|-------|-------------|
| **Client Email** | Optional. Leave blank for anyone to use, or enter a specific email to restrict access. |
| **Subscription Tier** | Free (5 syncs), Pro (100 syncs), or Unlimited |
| **Complimentary** | Check for 100% off — automatically grants Unlimited tier at no cost |

**Note**: When Complimentary is checked, the tier selector shows "Unlimited" and is disabled.

### Step 3: Generate & Share

Click **Generate Invitation Link**

The invitation appears in the list with action buttons:
- **Copy** (clipboard icon) — Copy link to share
- **Open** (external link) — Preview the setup page
- **Delete** (trash) — Revoke the invitation

**Share the link with your client.** They have 7 days to redeem it.

---

## What Clients See

When a client opens the invitation link:

1. **"You've been invited!"** banner with their plan (e.g., Unlimited)
2. **Email field** — Pre-filled if you specified one
3. **Password field** — They create their password
4. **Create Account & Get Started** button

After signup:
- Account created with the specified tier
- If Complimentary: Unlimited access at no cost
- Redirected to dashboard to connect Fireflies and Notion

---

## Invitation Lifecycle

```
Created → Active → Redeemed
             ↓
          Expired (7 days)
```

| Status | Meaning |
|--------|---------|
| **Active** | Link is valid, awaiting redemption |
| **Redeemed** | Client created account |
| **Expired** | 7 days passed, link no longer works |

You can delete active invitations at any time.

---

## Example: White Glove Client Setup

**Scenario**: New client needs unlimited access at no cost.

1. Go to [fn.workway.co/admin](https://fn.workway.co/admin)
2. Click **Create New Invitation**
3. Enter: `client@theircompany.com`
4. Check: **Complimentary (100% off)**
5. Click **Generate Invitation Link**
6. Copy the link and send to client

**Client receives**: `fn.workway.co/setup/abc123`

They sign up → Unlimited tier → Ready to sync.

---

## FAQ

**Can I resend an invitation?**
No. Create a new one and share the new link.

**What if I need to change a client's tier after they sign up?**
Contact support — not available in admin panel yet.

**Can multiple people use the same link?**
Only if you left Client Email blank. Otherwise, only that specific email can use it.

**How do I know when someone redeemed?**
The stats card shows "Redeemed" count, and the invitation row shows status.
