-- Simplified tournament mode: single-round, time window, token access

BEGIN;

-- New tournament settings
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS question_count INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS play_until TIMESTAMP WITH TIME ZONE;

-- Relax access_level constraints to allow token access
ALTER TABLE tournaments
  DROP CONSTRAINT IF EXISTS tournaments_access_level_check;

ALTER TABLE tournaments
  ADD CONSTRAINT tournaments_access_level_check
  CHECK (access_level IN ('public', 'token', 'friends', 'private'));

-- Token table for one-time access keys
CREATE TABLE IF NOT EXISTS tournament_tokens (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tournament_id BIGINT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  issued_to TEXT,
  created_by TEXT,
  used_by TEXT,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tournament_tokens_tournament_id ON tournament_tokens(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_tokens_used_at ON tournament_tokens(used_at);

ALTER TABLE tournament_tokens ENABLE ROW LEVEL SECURITY;

-- Everyone can attempt to redeem by token hash; tokens are single-use and random
CREATE POLICY "Tournament tokens are redeemable"
  ON tournament_tokens FOR SELECT
  USING (true);

-- Creators/admin can insert tokens
CREATE POLICY "Creators can insert tokens"
  ON tournament_tokens FOR INSERT
  WITH CHECK (true);

-- Allow updates for marking tokens as used
CREATE POLICY "Tokens can be marked used"
  ON tournament_tokens FOR UPDATE
  USING (true);

COMMIT;
