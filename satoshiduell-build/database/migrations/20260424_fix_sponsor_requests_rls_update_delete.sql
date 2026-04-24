-- ============================================================
-- FIX: Sponsor Request Update/Delete RLS
-- Ziel: Admin-Postfach kann Anfragen als bearbeitet markieren,
-- archivieren und loeschen.
-- ============================================================

-- Alte, auth.uid-abhaengige Policies entfernen
DROP POLICY IF EXISTS "Admins can update sponsor requests" ON sponsor_contact_requests;
DROP POLICY IF EXISTS "Admins can delete sponsor requests" ON sponsor_contact_requests;

-- App darf Status aendern (new/read/archived)
CREATE POLICY "App can update sponsor requests"
  ON sponsor_contact_requests FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (
    status IN ('new', 'read', 'archived')
  );

-- App darf Nachrichten loeschen
CREATE POLICY "App can delete sponsor requests"
  ON sponsor_contact_requests FOR DELETE
  TO anon, authenticated
  USING (true);
