-- Require either play_until or max_players

BEGIN;

ALTER TABLE tournaments
  DROP CONSTRAINT IF EXISTS tournaments_deadline_or_max_players_check;

ALTER TABLE tournaments
  ADD CONSTRAINT tournaments_deadline_or_max_players_check
  CHECK (play_until IS NOT NULL OR max_players IS NOT NULL);

COMMIT;
