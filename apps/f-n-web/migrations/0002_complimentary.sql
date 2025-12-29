-- Complimentary (100% off) invitations
-- Allows Half Dozen team to grant free Unlimited access to white glove clients

-- Add complimentary flag to invitations
ALTER TABLE client_invitations ADD COLUMN complimentary INTEGER DEFAULT 0;

-- Add complimentary and sponsorship fields to subscriptions
ALTER TABLE subscriptions ADD COLUMN complimentary INTEGER DEFAULT 0;
ALTER TABLE subscriptions ADD COLUMN sponsored_by TEXT;
