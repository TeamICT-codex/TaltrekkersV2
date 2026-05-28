-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: total_words op practice_sessions
--
-- Doel: laat TeacherDashboard zien "Liam: 30/85 geoefend in lijst X". Zonder
-- deze kolom kunnen we wel berekenen hoeveel woorden de leerling al heeft
-- geoefend (uit quiz_results), maar niet wat de TOTALE lijst-grootte is.
--
-- Wordt door PracticeSetup.handleStartCustom → saveSessionToSupabase gevuld
-- vanuit settings._listAllWords.length. Voor pre-migration sessies: NULL → UI
-- toont "X / ? geoefend" als fallback.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS total_words INTEGER;

COMMENT ON COLUMN public.practice_sessions.total_words IS
  'Aantal woorden in de VOLLEDIGE opgeladen lijst — voor X/Y-progress stats in TeacherDashboard. NULL voor sessies van vóór 28 mei 2026.';
