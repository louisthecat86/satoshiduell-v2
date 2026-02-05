-- Add simplified tournament gameplay fields

BEGIN;

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS questions JSONB,
  ADD COLUMN IF NOT EXISTS contact_info TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_path TEXT,
  ADD COLUMN IF NOT EXISTS participant_scores JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS participant_times JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS winner_token TEXT,
  ADD COLUMN IF NOT EXISTS winner_token_created_at TIMESTAMP WITH TIME ZONE;

COMMIT;
