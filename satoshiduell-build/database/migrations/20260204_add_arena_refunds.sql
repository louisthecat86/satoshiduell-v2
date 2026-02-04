-- Migration: add refund maps for arena

BEGIN;

ALTER TABLE IF EXISTS duels
  ADD COLUMN IF NOT EXISTS refund_links jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS refund_ids jsonb DEFAULT '{}'::jsonb;

COMMIT;
