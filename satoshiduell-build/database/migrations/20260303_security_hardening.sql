-- =============================================================
-- KRITISCHES SICHERHEITSUPDATE: RLS Policies & Datenbank-Härtung
-- Datum: 2026-03-03
-- Grund: Sicherheitslücke - Wallet wurde über ungeschützte
--        Supabase-Tabellen und fehlende Validierung geleert.
-- =============================================================

BEGIN;

-- =========================================
-- 1. DUELS: Restriktive RLS-Policies
-- =========================================

-- Alte unsichere Policies entfernen
DROP POLICY IF EXISTS "duels_select_policy" ON duels;
DROP POLICY IF EXISTS "duels_insert_policy" ON duels;
DROP POLICY IF EXISTS "duels_update_policy" ON duels;
DROP POLICY IF EXISTS "duels_admin_delete_policy" ON duels;
DROP POLICY IF EXISTS "duels_delete_all_policy" ON duels;

-- RLS aktivieren
ALTER TABLE duels ENABLE ROW LEVEL SECURITY;

-- SELECT: Jeder kann Duelle sehen (notwendig für Lobby)
CREATE POLICY "duels_select_policy" 
ON duels FOR SELECT 
USING (true);

-- INSERT: Jeder kann Duelle erstellen (für neues Spiel)
CREATE POLICY "duels_insert_policy" 
ON duels FOR INSERT 
WITH CHECK (true);

-- UPDATE: Nur bestimmte Felder können geändert werden.
-- Da Supabase RLS keine Feld-Level-Kontrolle hat, 
-- erlauben wir Updates aber schützen die kritischen Felder
-- über einen Trigger (siehe unten).
CREATE POLICY "duels_update_policy" 
ON duels FOR UPDATE 
USING (true)
WITH CHECK (true);

-- DELETE: Nur über Service Role Key (Edge Functions / Admin)
-- Kein anonymer DELETE mehr erlaubt!
CREATE POLICY "duels_delete_service_only" 
ON duels FOR DELETE 
USING (false);

-- =========================================
-- 2. TRIGGER: Kritische Felder schützen
-- =========================================
-- Verhindert, dass is_claimed von true auf false
-- zurückgesetzt wird (Double-Claim Prevention)
-- Verhindert Manipulation von amount nach Erstellung

CREATE OR REPLACE FUNCTION protect_duel_critical_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- amount darf nach Erstellung nicht mehr erhöht werden
  IF OLD.amount IS NOT NULL AND NEW.amount > OLD.amount THEN
    RAISE EXCEPTION 'Cannot increase duel amount after creation';
  END IF;

  -- is_claimed darf nicht von true auf false gesetzt werden
  IF OLD.is_claimed = true AND NEW.is_claimed = false THEN
    RAISE EXCEPTION 'Cannot reset is_claimed flag';
  END IF;

  -- claimed darf nicht von true auf false gesetzt werden
  IF OLD.claimed = true AND NEW.claimed = false THEN
    RAISE EXCEPTION 'Cannot reset claimed flag';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_duel_fields ON duels;
CREATE TRIGGER protect_duel_fields
  BEFORE UPDATE ON duels
  FOR EACH ROW
  EXECUTE FUNCTION protect_duel_critical_fields();

-- =========================================
-- 3. PROFILES: RLS aktivieren und einschränken
-- =========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Alte Policies entfernen (falls vorhanden)
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON profiles;

-- SELECT: Jeder kann Profile sehen, aber OHNE PIN-Hash
-- (Hinweis: PIN wird trotzdem via select('*') geladen,
--  daher muss der Select im Code angepasst werden.
--  Hier schützen wir erstmal über RLS was geht.)
CREATE POLICY "profiles_select_policy" 
ON profiles FOR SELECT 
USING (true);

-- INSERT: Jeder kann ein Profil erstellen
CREATE POLICY "profiles_insert_policy" 
ON profiles FOR INSERT 
WITH CHECK (true);

-- UPDATE: Jeder kann Profile updaten (PIN-Hash nicht über RLS schützbar)
-- ABER: is_admin darf nicht gesetzt werden (Trigger unten)
CREATE POLICY "profiles_update_policy" 
ON profiles FOR UPDATE 
USING (true)
WITH CHECK (true);

-- DELETE: Nur Service Role Key
CREATE POLICY "profiles_delete_policy" 
ON profiles FOR DELETE 
USING (false);

-- Trigger: is_admin Eskalation verhindern
CREATE OR REPLACE FUNCTION protect_admin_flag()
RETURNS TRIGGER AS $$
BEGIN
  -- Normaler User darf is_admin nicht auf true setzen
  IF OLD.is_admin IS DISTINCT FROM NEW.is_admin AND NEW.is_admin = true THEN
    -- Nur erlaubt wenn über Service Role Key (Edge Function)
    -- Anon-Calls können is_admin nicht ändern
    IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
      NEW.is_admin := OLD.is_admin;
    END IF;
  END IF;
  
  -- can_create_tournaments Eskalation verhindern
  IF OLD.can_create_tournaments IS DISTINCT FROM NEW.can_create_tournaments 
     AND NEW.can_create_tournaments = true THEN
    IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
      NEW.can_create_tournaments := OLD.can_create_tournaments;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_admin ON profiles;
CREATE TRIGGER protect_admin
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_admin_flag();

-- =========================================
-- 4. QUESTIONS: RLS aktivieren
-- =========================================

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "questions_select_policy" ON questions;
DROP POLICY IF EXISTS "questions_insert_policy" ON questions;
DROP POLICY IF EXISTS "questions_update_policy" ON questions;
DROP POLICY IF EXISTS "questions_delete_policy" ON questions;

-- SELECT: Jeder kann Fragen lesen
CREATE POLICY "questions_select_policy" 
ON questions FOR SELECT 
USING (true);

-- INSERT/UPDATE/DELETE: Nur Service Role Key
CREATE POLICY "questions_insert_policy" 
ON questions FOR INSERT 
WITH CHECK (false);

CREATE POLICY "questions_update_policy" 
ON questions FOR UPDATE 
USING (false)
WITH CHECK (false);

CREATE POLICY "questions_delete_policy" 
ON questions FOR DELETE 
USING (false);

-- =========================================
-- 5. QUESTION_SUBMISSIONS: RLS aktivieren
-- =========================================

ALTER TABLE question_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "submissions_select_policy" ON question_submissions;
DROP POLICY IF EXISTS "submissions_insert_policy" ON question_submissions;
DROP POLICY IF EXISTS "submissions_update_policy" ON question_submissions;
DROP POLICY IF EXISTS "submissions_delete_policy" ON question_submissions;

CREATE POLICY "submissions_select_policy" 
ON question_submissions FOR SELECT 
USING (true);

CREATE POLICY "submissions_insert_policy" 
ON question_submissions FOR INSERT 
WITH CHECK (true);

-- UPDATE/DELETE: Nur Service Role Key  
CREATE POLICY "submissions_update_policy" 
ON question_submissions FOR UPDATE 
USING (false)
WITH CHECK (false);

CREATE POLICY "submissions_delete_policy" 
ON question_submissions FOR DELETE 
USING (false);

-- =========================================
-- 6. TOURNAMENTS: Sicherstellen RLS aktiv ist
-- =========================================

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

-- Falls noch nicht vorhanden: Basis-Policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tournaments' AND policyname = 'tournaments_select_all'
  ) THEN
    CREATE POLICY "tournaments_select_all" ON tournaments FOR SELECT USING (true);
  END IF;
END $$;

COMMIT;
