-- Migration: add login_days and last_login for daily badges

BEGIN;

ALTER TABLE IF EXISTS profiles
  ADD COLUMN IF NOT EXISTS login_days integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_login date;

COMMIT;
