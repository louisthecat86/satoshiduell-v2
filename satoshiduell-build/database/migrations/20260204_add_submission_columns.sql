-- Migration: add missing columns to question_submissions

BEGIN;

ALTER TABLE IF EXISTS question_submissions
  ADD COLUMN IF NOT EXISTS language varchar(8) DEFAULT 'de',
  ADD COLUMN IF NOT EXISTS options jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS correct integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment text;

COMMIT;
