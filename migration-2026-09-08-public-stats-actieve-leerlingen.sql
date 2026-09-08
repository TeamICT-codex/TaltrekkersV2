-- =====================================================
-- Migration: get_public_stats() — leerlingen = wie écht oefende
-- Datum: 2026-09-08
-- =====================================================
--
-- Vervangt de functie uit migration-2026-09-07-public-stats.sql.
--
-- WAAROM:
--   De tegel "leerlingen" telde elk profiel met rol 'student'. Omdat elke
--   Microsoft-login automatisch een profiel aanmaakt, telde ook iedereen mee
--   die één keer inlogde en nooit een oefening afwerkte. Dat gaf 211
--   "leerlingen" tegenover amper 85 afgeronde sessies.
--
-- WAT VERANDERT:
--   students = aantal VERSCHILLENDE leerlingen met minstens één afgeronde
--   sessie in practice_sessions. Alle andere velden blijven identiek.
--
-- Voer dit uit in de Supabase SQL-editor (Vercel draait geen migraties).
-- Veilig om meerdere keren te draaien (idempotent, CREATE OR REPLACE).
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT json_build_object(
    'teachers',          (SELECT count(*) FROM public.profiles WHERE role IN ('teacher','admin')),
    -- Enkel leerlingen die minstens één oefening afrondden (niet: iedereen die ooit inlogde).
    'students',          (SELECT count(DISTINCT user_id) FROM public.practice_sessions WHERE user_id IS NOT NULL),
    'classes',           (SELECT count(DISTINCT klas) FROM public.profiles WHERE klas IS NOT NULL AND btrim(klas) <> ''),
    'word_lists',        (SELECT count(DISTINCT coalesce(nullif(file_name,''), context)) FROM public.practice_sessions),
    'sessions',          (SELECT count(*) FROM public.practice_sessions),
    'words_practiced',   (SELECT count(DISTINCT lower(word)) FROM public.word_progress),
    'questions_total',   (SELECT coalesce(sum(total_questions),0) FROM public.practice_sessions),
    'questions_correct', (SELECT coalesce(sum(score),0) FROM public.practice_sessions)
  );
$$;

-- Rechten opnieuw zetten (CREATE OR REPLACE behoudt ze, maar zo is dit bestand
-- ook op zichzelf volledig).
REVOKE ALL ON FUNCTION public.get_public_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon, authenticated;

-- =====================================================
-- KLAAR ✅
-- =====================================================
