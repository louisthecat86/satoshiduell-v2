-- ============================================================
-- SPONSOR CONTACT REQUESTS
-- Ermöglicht es Sponsoren, Kontaktanfragen an den Superadmin
-- zu stellen, um Turniererstellungs-Rechte zu beantragen.
-- ============================================================

CREATE TABLE IF NOT EXISTS sponsor_contact_requests (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  username    text NOT NULL,            -- In-App-Username des Anfragenden
  telegram    text,                      -- Telegram-Handle
  email       text,                      -- E-Mail-Adresse
  npub        text,                      -- Nostr npub
  twitter     text,                      -- Twitter/X-Handle
  message     text,                      -- Optionale Nachricht
  status      text NOT NULL DEFAULT 'new', -- 'new' | 'read'
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index für schnelle Admin-Abfragen
CREATE INDEX IF NOT EXISTS sponsor_contact_requests_status_idx ON sponsor_contact_requests(status);
CREATE INDEX IF NOT EXISTS sponsor_contact_requests_created_at_idx ON sponsor_contact_requests(created_at DESC);

-- RLS aktivieren
ALTER TABLE sponsor_contact_requests ENABLE ROW LEVEL SECURITY;

-- Jeder eingeloggte Nutzer darf eine Anfrage einreichen
CREATE POLICY "Users can insert own sponsor requests"
  ON sponsor_contact_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Nur Admins (is_admin = true in profiles) dürfen alle Anfragen lesen/löschen
CREATE POLICY "Admins can read all sponsor requests"
  ON sponsor_contact_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can update sponsor requests"
  ON sponsor_contact_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

CREATE POLICY "Admins can delete sponsor requests"
  ON sponsor_contact_requests FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );
