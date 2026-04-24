-- ============================================================
-- FIX: Sponsor Request Insert RLS
-- Erlaubt Sponsor-Anfragen auch ohne aktive Supabase-Auth-Session
-- (anon + authenticated), da die App eigene User-Logik nutzt.
-- ============================================================

-- Alte restrictive Insert-Policy entfernen
DROP POLICY IF EXISTS "Users can insert own sponsor requests" ON sponsor_contact_requests;

-- Neue Insert-Policy: Anfragen dürfen von allen App-Nutzern eingereicht werden
CREATE POLICY "Anyone can insert sponsor requests"
  ON sponsor_contact_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    username IS NOT NULL
    AND length(trim(username)) > 0
    AND (
      telegram IS NOT NULL
      OR email IS NOT NULL
      OR npub IS NOT NULL
      OR twitter IS NOT NULL
    )
  );
