-- =============================================================
-- KRITISCHES SICHERHEITSUPDATE #2: Payment-Hash Verifizierung
-- Datum: 2026-03-03
-- Grund: Ohne payment_hash kann ein Angreifer Fake-Spiele
--        erstellen und Sats abziehen ohne zu bezahlen
-- =============================================================

BEGIN;

-- =========================================
-- 1. Neue Spalten für Payment-Hash Tracking
-- =========================================
-- Jede Zahlung wird mit dem LNbits payment_hash verknüpft.
-- Die Edge Function verifiziert diese Hashes vor Auszahlung.

ALTER TABLE duels ADD COLUMN IF NOT EXISTS creator_payment_hash TEXT;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS challenger_payment_hash TEXT;
ALTER TABLE duels ADD COLUMN IF NOT EXISTS participant_payment_hashes JSONB DEFAULT '{}';

-- UNIQUE Constraints verhindern Replay-Angriffe
-- (ein payment_hash darf nur in einem Spiel verwendet werden)
CREATE UNIQUE INDEX IF NOT EXISTS idx_duels_creator_payment_hash 
  ON duels (creator_payment_hash) WHERE creator_payment_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_duels_challenger_payment_hash 
  ON duels (challenger_payment_hash) WHERE challenger_payment_hash IS NOT NULL;

-- =========================================
-- 2. Erweiterter Schutz-Trigger
-- =========================================
CREATE OR REPLACE FUNCTION protect_duel_critical_fields()
RETURNS TRIGGER AS $$
DECLARE
  caller_role text;
BEGIN
  -- Rolle des Aufrufers bestimmen
  BEGIN
    caller_role := current_setting('request.jwt.claims', true)::json->>'role';
  EXCEPTION WHEN OTHERS THEN
    caller_role := 'anon';
  END;

  -- ===== AMOUNT: Darf nicht erhöht werden =====
  IF OLD.amount IS NOT NULL AND NEW.amount > OLD.amount THEN
    RAISE EXCEPTION 'Cannot increase duel amount after creation';
  END IF;

  -- ===== CLAIMED FLAGS: Nur service_role darf zurücksetzen =====
  IF OLD.is_claimed = true AND NEW.is_claimed = false THEN
    IF caller_role != 'service_role' THEN
      RAISE EXCEPTION 'Cannot reset is_claimed flag';
    END IF;
  END IF;
  IF OLD.claimed = true AND NEW.claimed = false THEN
    IF caller_role != 'service_role' THEN
      RAISE EXCEPTION 'Cannot reset claimed flag';
    END IF;
  END IF;

  -- ===== SCORES: Einmal gesetzt → unveränderlich (für anon) =====
  IF caller_role != 'service_role' THEN
    IF OLD.creator_score IS NOT NULL AND OLD.creator_score IS DISTINCT FROM NEW.creator_score THEN
      RAISE EXCEPTION 'Cannot modify already submitted creator_score';
    END IF;
    IF OLD.challenger_score IS NOT NULL AND OLD.challenger_score IS DISTINCT FROM NEW.challenger_score THEN
      RAISE EXCEPTION 'Cannot modify already submitted challenger_score';
    END IF;
    -- Arena: Bestehende participant_scores dürfen nicht überschrieben werden
    IF OLD.participant_scores IS NOT NULL 
       AND jsonb_typeof(OLD.participant_scores::jsonb) = 'object' 
       AND OLD.participant_scores::text != '{}'
       AND OLD.participant_scores IS DISTINCT FROM NEW.participant_scores THEN
      IF EXISTS (
        SELECT 1 FROM jsonb_each(OLD.participant_scores::jsonb) AS o(k,v)
        WHERE NEW.participant_scores::jsonb->o.k IS DISTINCT FROM o.v
      ) THEN
        RAISE EXCEPTION 'Cannot modify already submitted participant scores';
      END IF;
    END IF;
  END IF;

  -- ===== STATUS 'finished': Erfordert Scores =====
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'finished' THEN
    IF (NEW.mode IS NULL OR NEW.mode = 'duel') THEN
      IF NEW.creator_score IS NULL OR NEW.challenger_score IS NULL THEN
        RAISE EXCEPTION 'Cannot finish duel without both scores';
      END IF;
    END IF;
    -- Arena: wird im Client und Edge Function geprüft
  END IF;

  -- ===== PAYMENT HASHES: Einmal gesetzt → unveränderlich =====
  IF caller_role != 'service_role' THEN
    IF OLD.creator_payment_hash IS NOT NULL AND OLD.creator_payment_hash IS DISTINCT FROM NEW.creator_payment_hash THEN
      RAISE EXCEPTION 'Cannot modify creator payment hash';
    END IF;
    IF OLD.challenger_payment_hash IS NOT NULL AND OLD.challenger_payment_hash IS DISTINCT FROM NEW.challenger_payment_hash THEN
      RAISE EXCEPTION 'Cannot modify challenger payment hash';
    END IF;
  END IF;

  -- ===== PAYMENT TIMESTAMPS: Nicht löschbar =====
  IF caller_role != 'service_role' THEN
    IF OLD.creator_paid_at IS NOT NULL AND NEW.creator_paid_at IS NULL THEN
      RAISE EXCEPTION 'Cannot remove payment timestamp';
    END IF;
    IF OLD.challenger_paid_at IS NOT NULL AND NEW.challenger_paid_at IS NULL THEN
      RAISE EXCEPTION 'Cannot remove payment timestamp';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger existiert bereits aus v1, CREATE OR REPLACE aktualisiert die Funktion

COMMIT;

