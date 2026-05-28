-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: per-sessie quiz-resultaten op practice_sessions
--
-- Doel: voeg `quiz_results` JSONB kolom toe zodat we per sessie KUNNEN ophalen
-- welke woorden correct/fout zijn beantwoord. Nodig voor:
--   - TeacherDashboard drill-down (klik op sessie → toon woorden goed/fout)
--   - Toekomstige aggregaties (klaswide "moeilijke woorden" top-10)
--
-- Schema: array van { word, correct } objecten. Identiek aan QuizResult[] type
-- in TypeScript (types.ts).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS quiz_results JSONB DEFAULT '[]'::jsonb;

-- Index voor potentiële toekomstige aggregatie-queries (bv. WHERE correct = false).
-- GIN-index is geschikt voor JSONB lookup.
CREATE INDEX IF NOT EXISTS idx_practice_sessions_quiz_results
  ON public.practice_sessions USING GIN (quiz_results);

-- Comment voor schema-discoverability
COMMENT ON COLUMN public.practice_sessions.quiz_results IS
  'Array van { word: string, correct: boolean } per quiz-vraag in deze sessie. Leeg voor pre-2026-05-28 sessies (legacy).';
