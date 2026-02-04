-- Migration: Add npub to profiles for Nostr logins

BEGIN;

ALTER TABLE IF EXISTS profiles
  ADD COLUMN IF NOT EXISTS npub text;

-- Ensure unique npub when present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'profiles' AND indexname = 'profiles_npub_idx') THEN
    CREATE UNIQUE INDEX profiles_npub_idx ON profiles (npub) WHERE npub IS NOT NULL;
  END IF;
END$$;

COMMIT;
