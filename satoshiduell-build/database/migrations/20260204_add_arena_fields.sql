-- Migration: add arena fields to duels

BEGIN;

ALTER TABLE IF EXISTS duels
  ADD COLUMN IF NOT EXISTS mode text DEFAULT 'duel',
  ADD COLUMN IF NOT EXISTS max_players integer,
  ADD COLUMN IF NOT EXISTS participants jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS participant_scores jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS participant_times jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS winner text;

COMMIT;
