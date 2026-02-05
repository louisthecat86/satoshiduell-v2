-- Migration: add arena refund claimed map

BEGIN;

ALTER TABLE IF EXISTS duels
  ADD COLUMN IF NOT EXISTS refund_claimed jsonb DEFAULT '{}'::jsonb;

COMMIT;
