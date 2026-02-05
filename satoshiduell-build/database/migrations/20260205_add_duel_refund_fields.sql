-- Migration: add refund fields to duels

BEGIN;

ALTER TABLE IF EXISTS duels
  ADD COLUMN IF NOT EXISTS withdraw_link text,
  ADD COLUMN IF NOT EXISTS withdraw_id text;

COMMIT;
