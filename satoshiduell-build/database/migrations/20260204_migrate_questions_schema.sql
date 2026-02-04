-- Migration: Migrate language-specific question columns to new normalized `questions` table
-- Backup wird erstellt, neue Tabelle befüllt. Vor dem finalen Austausch prüfen (Counts, Sample rows).

BEGIN;

-- 0) Sicherstellen: Extension für UUIDs
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Backup der existierenden Tabelle
DROP TABLE IF EXISTS questions_backup;
CREATE TABLE questions_backup AS TABLE questions;

-- 2) Neue Tabelle anlegen (Zielschema)
CREATE TABLE IF NOT EXISTS questions_new (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  language varchar(8) NOT NULL DEFAULT 'de',
  question text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct integer NOT NULL DEFAULT 0,
  difficulty text,
  is_active boolean DEFAULT true,
  submitted_by text,
  is_verified boolean DEFAULT false,
  user_notified boolean DEFAULT false
);

-- 3) Konvertiere DE / EN / ES Spalten in einzelne Zeilen
-- Hinweis: `correct_index` scheint 1..4 zu sein; wir speichern 0..3 in `correct`.
INSERT INTO questions_new (created_at, language, question, options, correct, difficulty, is_active, submitted_by, is_verified, user_notified)
SELECT created_at, 'de', question_de, to_jsonb(options_de), GREATEST(COALESCE(correct_index,1) - 1, 0), difficulty, is_active, submitted_by, is_verified, user_notified
FROM questions
WHERE COALESCE(question_de, '') <> '';

INSERT INTO questions_new (created_at, language, question, options, correct, difficulty, is_active, submitted_by, is_verified, user_notified)
SELECT created_at, 'en', question_en, to_jsonb(options_en), GREATEST(COALESCE(correct_index,1) - 1, 0), difficulty, is_active, submitted_by, is_verified, user_notified
FROM questions
WHERE COALESCE(question_en, '') <> '';

INSERT INTO questions_new (created_at, language, question, options, correct, difficulty, is_active, submitted_by, is_verified, user_notified)
SELECT created_at, 'es', question_es, to_jsonb(options_es), GREATEST(COALESCE(correct_index,1) - 1, 0), difficulty, is_active, submitted_by, is_verified, user_notified
FROM questions
WHERE COALESCE(question_es, '') <> '';

-- 4) Prüfen der Counts (manuell ausführen und prüfen):
-- SELECT 'old' as which, count(*) FROM questions;
-- SELECT 'new' as which, count(*) FROM questions_new;

-- 5) Samples prüfen (manuell):
-- SELECT * FROM questions_new ORDER BY created_at DESC LIMIT 20;

-- 6) Wenn alles passt: Swap durchführen (ACHTUNG: FK/Index-Prüfung!)
-- Die folgenden Befehle benennen die alte Tabelle um und setzen die neue in Produktion.
-- Backup der Originaltabelle (`questions_backup`) wurde oben bereits angelegt.

-- Rename alte Tabelle zur Sicherheit
ALTER TABLE IF EXISTS questions RENAME TO questions_old;

-- Neue Tabelle in den Produktnamen bringen
ALTER TABLE questions_new RENAME TO questions;

-- Trigger für updated_at wiederherstellen (falls benötigt)
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS questions_touch_updated_at ON questions;
CREATE TRIGGER questions_touch_updated_at
BEFORE UPDATE ON questions
FOR EACH ROW
EXECUTE PROCEDURE touch_updated_at();
-- ALTER TABLE questions_new RENAME TO questions;

COMMIT;

-- Hinweise:
-- - `questions_backup` enthält ein vollständiges Backup der alten Struktur.
-- - `questions_new` verwendet JSONB für `options` und 0-basierten `correct`.
-- - Passe ggf. das Mapping der `correct_index` an, falls es bereits 0-basiert war.
-- - Prüfe von Hand mit den SELECT-Statements bevor Du die Swap-Kommentare ausführst.
