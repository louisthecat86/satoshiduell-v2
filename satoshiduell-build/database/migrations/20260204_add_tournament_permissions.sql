-- Add tournament creator permission to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS can_create_tournaments BOOLEAN DEFAULT FALSE;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_can_create_tournaments ON profiles(can_create_tournaments);

-- Optional: Grant one admin account tournament creator permission
-- UPDATE profiles SET can_create_tournaments = TRUE WHERE username = 'admin';
