-- Allow optional max_players for tournaments

BEGIN;

ALTER TABLE tournaments
  ALTER COLUMN max_players DROP NOT NULL;

ALTER TABLE tournaments
  DROP CONSTRAINT IF EXISTS tournaments_max_players_check;

ALTER TABLE tournaments
  DROP CONSTRAINT IF EXISTS tournaments_max_players_check1;

COMMIT;
