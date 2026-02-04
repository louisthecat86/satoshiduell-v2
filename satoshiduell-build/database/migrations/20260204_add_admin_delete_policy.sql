-- Migration: Admin DELETE Policy für duels Tabelle
-- Ermöglicht Admins das Löschen von Spielen

BEGIN;

-- 1. RLS für duels aktivieren (falls noch nicht aktiv)
ALTER TABLE duels ENABLE ROW LEVEL SECURITY;

-- 2. Policy: Jeder kann Spiele lesen (SELECT)
DROP POLICY IF EXISTS "duels_select_policy" ON duels;
CREATE POLICY "duels_select_policy" 
ON duels FOR SELECT 
USING (true);

-- 3. Policy: Jeder kann Spiele erstellen (INSERT)
DROP POLICY IF EXISTS "duels_insert_policy" ON duels;
CREATE POLICY "duels_insert_policy" 
ON duels FOR INSERT 
WITH CHECK (true);

-- 4. Policy: Jeder kann Spiele aktualisieren (UPDATE)
DROP POLICY IF EXISTS "duels_update_policy" ON duels;
CREATE POLICY "duels_update_policy" 
ON duels FOR UPDATE 
USING (true)
WITH CHECK (true);

-- 5. Policy: Admins können Spiele löschen (DELETE)
DROP POLICY IF EXISTS "duels_admin_delete_policy" ON duels;
CREATE POLICY "duels_admin_delete_policy" 
ON duels FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.username = current_setting('request.jwt.claims', true)::json->>'username'
    AND profiles.is_admin = true
  )
);

-- 6. Policy: Fallback - Erlaube Löschen für alle (nur für Entwicklung/Testing)
-- ACHTUNG: Diese Policy sollte in Produktion entfernt werden!
DROP POLICY IF EXISTS "duels_delete_all_policy" ON duels;
CREATE POLICY "duels_delete_all_policy" 
ON duels FOR DELETE 
USING (true);

COMMIT;
