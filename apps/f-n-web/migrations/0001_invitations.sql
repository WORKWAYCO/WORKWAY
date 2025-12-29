-- Client invitations for white glove onboarding
-- Allows Half Dozen team to generate setup links for clients

CREATE TABLE IF NOT EXISTS client_invitations (
  id TEXT PRIMARY KEY,
  invite_code TEXT UNIQUE NOT NULL,
  email TEXT,                              -- Optional: restrict to specific email
  tier TEXT DEFAULT 'free' NOT NULL,       -- Subscription tier to grant
  created_by_email TEXT NOT NULL,          -- Admin email who created
  expires_at INTEGER NOT NULL,             -- Unix timestamp (7 days from creation)
  redeemed_at INTEGER,                     -- Unix timestamp when used
  redeemed_by_user_id TEXT,                -- User ID who redeemed
  created_at TEXT DEFAULT (datetime('now'))
);

-- Index for fast lookup by invite code
CREATE INDEX IF NOT EXISTS idx_invitations_code ON client_invitations(invite_code);

-- Index for listing active invitations
CREATE INDEX IF NOT EXISTS idx_invitations_expires ON client_invitations(expires_at) WHERE redeemed_at IS NULL;
