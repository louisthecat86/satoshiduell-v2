-- ============================================================
-- FIX: Sponsor Request Read RLS
-- Ziel: Admin-Ansicht kann Anfragen sicher laden, auch wenn kein
-- Supabase-Auth-User (auth.uid) im Frontend-Kontext vorhanden ist.
-- ============================================================

-- Alte restrictive Select-Policy entfernen (auth.uid-basierter Check)
DROP POLICY IF EXISTS "Admins can read all sponsor requests" ON sponsor_contact_requests;

-- Lesepolicy für App-Client (anon + authenticated), damit Postfach sichtbar ist
CREATE POLICY "App can read sponsor requests"
  ON sponsor_contact_requests FOR SELECT
  TO anon, authenticated
  USING (true);
