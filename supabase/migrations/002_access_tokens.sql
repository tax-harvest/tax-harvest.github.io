-- Migration: Create access_tokens table for recovery links
-- Description: Allows anonymous users to access their buyback records from any device via a shareable link
-- This enables a privacy-first approach where users don't need email registration

-- Create access_tokens table
CREATE TABLE access_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Hash of the token (actual token is only given to user once)
    token_hash TEXT NOT NULL UNIQUE,
    -- The anonymous user this token grants access to
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Optional label for the token (e.g., "Buyback Jan 2026")
    label TEXT,
    -- When the token was created
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Track last access for potential cleanup of unused tokens
    last_accessed_at TIMESTAMPTZ
);

-- Add comments
COMMENT ON TABLE access_tokens IS 'Recovery tokens that allow accessing buyback records without authentication';
COMMENT ON COLUMN access_tokens.token_hash IS 'SHA-256 hash of the access token for secure storage';
COMMENT ON COLUMN access_tokens.user_id IS 'The user whose buyback records this token grants access to';
COMMENT ON COLUMN access_tokens.label IS 'User-friendly label for the token';
COMMENT ON COLUMN access_tokens.last_accessed_at IS 'Tracks when the token was last used for access';

-- Create index for fast token lookups
CREATE INDEX idx_access_tokens_hash ON access_tokens(token_hash);

-- Create index for user lookups (to find existing tokens for a user)
CREATE INDEX idx_access_tokens_user ON access_tokens(user_id);

-- Note: No RLS on this table - it's accessed via Edge Function with service role
-- The Edge Function validates the token and returns data securely

-- Enable anonymous sign-in in Supabase Auth (done via dashboard/API, not SQL)
-- This is just a reminder comment
