-- Create tournaments table for community tournament system

BEGIN;

CREATE TABLE IF NOT EXISTS tournaments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  
  -- Basic Info
  name TEXT NOT NULL,
  description TEXT,
  creator VARCHAR(255) NOT NULL, -- Username des Erstellers
  
  -- Configuration
  max_players INT NOT NULL CHECK (max_players IN (2, 4, 8, 16, 32, 64, 128)),
  entry_fee INT NOT NULL DEFAULT 0, -- Sats pro Teilnehmer
  creator_prize_deposit INT NOT NULL, -- Vom Creator eingezahlt
  
  -- Prize Pool Management
  total_prize_pool INT NOT NULL, -- Dynamisch: creator_deposit + entry_fees (optional)
  entry_fees_go_to_pool BOOLEAN DEFAULT false, -- true = Option C (Hybrid), false = Option A (Creator behält Entry Fees)
  
  accumulated_entry_fees INT DEFAULT 0, -- Gesammelte Entry Fees
  
  -- Access Control
  access_level VARCHAR(20) DEFAULT 'public' CHECK (access_level IN ('public', 'friends', 'private')),
  
  -- Game Format
  questions_per_round JSONB NOT NULL DEFAULT '{"round1": 3, "round2": 4, "semifinals": 5, "final": 6}'::jsonb,
  
  -- Rules
  match_deadline INT DEFAULT 24, -- Stunden bis Match gespielt sein muss
  no_show_penalty VARCHAR(20) DEFAULT 'loss' CHECK (no_show_penalty IN ('loss', 'disqualify')),
  max_waiting_time INT DEFAULT 48, -- Stunden vor Auto-Disqualifikation
  late_join_allowed BOOLEAN DEFAULT false,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'registration', 'active', 'finished', 'cancelled')),
  current_round INT DEFAULT 0,
  
  -- Payment Tracking
  creator_payment_hash TEXT, -- Hash der Creator Prize Pool Zahlung
  creator_payment_request TEXT, -- LNbits Payment Request (Invoice)
  creator_payment_verified BOOLEAN DEFAULT false,
  
  prize_pool_claimed BOOLEAN DEFAULT false,
  prize_pool_claim_hash TEXT, -- Hash der Winner-Auszahlung
  prize_pool_withdraw_link TEXT, -- LNbits Withdraw Link für Winner
  
  entry_fees_claimed BOOLEAN DEFAULT false, -- Für Option A: Creator kann Entry Fees claimen
  entry_fees_withdraw_link TEXT,
  
  -- Participants
  participants JSONB DEFAULT '[]'::jsonb, -- Array von Usernames
  current_participants INT DEFAULT 0,
  
  -- Bracket System
  bracket JSONB, -- Komplette Bracket-Struktur mit Matches
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  registration_ends_at TIMESTAMP WITH TIME ZONE, -- Optional: Auto-Start Datum
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  
  -- Winner
  winner VARCHAR(255), -- Username des Gewinners
  
  CONSTRAINT fk_creator FOREIGN KEY (creator) REFERENCES profiles(username) ON DELETE CASCADE,
  CONSTRAINT fk_winner FOREIGN KEY (winner) REFERENCES profiles(username) ON DELETE SET NULL
);

-- Indexes für Performance
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_creator ON tournaments(creator);
CREATE INDEX IF NOT EXISTS idx_tournaments_created_at ON tournaments(created_at DESC);

-- RLS Policies
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

-- Jeder kann Turniere sehen
CREATE POLICY "Tournaments are viewable by everyone"
  ON tournaments FOR SELECT
  USING (true);

-- Nur befähigte User können Turniere erstellen
CREATE POLICY "Can create tournaments"
  ON tournaments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE username = auth.uid()::text 
      AND can_create_tournaments = true
    )
  );

-- Creator kann eigene Turniere updaten, Admin alle
CREATE POLICY "Can update own tournaments or admin"
  ON tournaments FOR UPDATE
  USING (
    creator = auth.uid()::text 
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE username = auth.uid()::text 
      AND is_admin = true
    )
  );

-- Creator kann eigene löschen, Admin alle
CREATE POLICY "Can delete own tournaments or admin"
  ON tournaments FOR DELETE
  USING (
    creator = auth.uid()::text 
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE username = auth.uid()::text 
      AND is_admin = true
    )
  );

COMMIT;
