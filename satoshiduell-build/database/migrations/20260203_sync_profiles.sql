-- Safe migration to ensure every player has a profiles entry and to standardize username usage
-- Run this in Supabase SQL editor or via psql with your DB credentials.

BEGIN;

-- 1) If the profiles table still has a "name" column used previously, copy it to username where username is NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='name') THEN
    UPDATE profiles SET username = name WHERE username IS NULL AND name IS NOT NULL;
  END IF;
END$$;

-- 2) Insert missing profiles for players that don't have a profile yet
INSERT INTO profiles (username, created_at, games_played, wins, losses, draws, total_sats_won, last_updated)
SELECT p.name, now(), 0, 0, 0, 0, 0, now()
FROM players p
LEFT JOIN profiles pr ON pr.username = p.name
WHERE pr.username IS NULL;

-- 3) Try to create unique index on username (safe: only creates if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'profiles' AND indexname = 'profiles_username_idx') THEN
    BEGIN
      CREATE UNIQUE INDEX profiles_username_idx ON profiles (username);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not create unique index on profiles.username — check for duplicates first.';
    END;
  END IF;
END$$;

-- 4) Keep username as not null if possible
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM profiles WHERE username IS NULL) = 0 THEN
    ALTER TABLE profiles ALTER COLUMN username SET NOT NULL;
  ELSE
    RAISE NOTICE 'Cannot set profiles.username NOT NULL - null values exist.';
  END IF;
END$$;

COMMIT;

-- NOTES:
-- * Review duplicates before applying unique constraint. If duplicates exist, decide on merge strategy.
-- * Test in a staging DB first. Keep a backup snapshot before running in production.
