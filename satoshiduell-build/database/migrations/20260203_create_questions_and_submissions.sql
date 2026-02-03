-- Migration: Fragen-Katalog & Einreichungen + Admin-Flag

BEGIN;

-- 1) Add is_admin to profiles (default false)
ALTER TABLE IF EXISTS profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- 2) Create questions table
CREATE TABLE IF NOT EXISTS questions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  language VARCHAR(8) DEFAULT 'de' NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct INTEGER NOT NULL DEFAULT 0,
  tags TEXT[] DEFAULT ARRAY[]::text[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3) Create question_submissions table
CREATE TABLE IF NOT EXISTS question_submissions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  submitter VARCHAR(64) NOT NULL,
  language VARCHAR(8) DEFAULT 'de' NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct INTEGER NOT NULL DEFAULT 0,
  comment TEXT,
  status VARCHAR(16) DEFAULT 'pending', -- pending | accepted | rejected
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- 4) Trigger to update updated_at on questions
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER questions_touch_updated_at
BEFORE UPDATE ON questions
FOR EACH ROW
EXECUTE PROCEDURE touch_updated_at();

COMMIT;
