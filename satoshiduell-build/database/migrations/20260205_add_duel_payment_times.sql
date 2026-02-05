-- Migration: add payment timestamps for duels/arena

BEGIN;

ALTER TABLE IF EXISTS duels
  ADD COLUMN IF NOT EXISTS creator_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS challenger_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS participant_paid_at jsonb DEFAULT '{}'::jsonb;

COMMIT;
