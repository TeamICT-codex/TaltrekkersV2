-- =====================================================
-- Migration: native_language kolom op profiles
-- Datum: 2026-05-21
-- =====================================================
--
-- Voegt een optionele moedertaal toe aan profiles zodat:
--   1. Leerlingen het eenmalig invullen bij onboarding
--      (of helemaal niet, blijft optioneel)
--   2. AI-prompts deze info kunnen gebruiken voor betere
--      uitleg (bv. cognaten Frans-Nederlands voor Franstaligen)
--   3. Leerkrachten zien welke moedertaal hun klas heeft
--
-- Vrije TEXT zodat we ook iets als "Roemeens" of "Pools"
-- kunnen accepteren zonder hardcoded lijst van talen.
--
-- Veilig om meerdere keren te draaien (idempotent).
-- Run in Supabase Dashboard → SQL Editor → New query.
-- =====================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS native_language TEXT;

-- =====================================================
-- Verificatie (optioneel apart uit te voeren)
-- =====================================================
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'profiles'
-- ORDER BY ordinal_position;
