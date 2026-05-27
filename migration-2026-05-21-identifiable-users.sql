-- =====================================================
-- Migration: Leerlingen identificeerbaar maken
-- Datum: 2026-05-21
-- =====================================================
--
-- Probleem: bij nieuwe inschrijvingen werd `profiles.full_name` niet ingevuld,
-- waardoor het Teacher Dashboard "thomas.aelbrecht" (email-prefix) toonde in
-- plaats van "Thomas Aelbrecht".
--
-- Oplossing:
--   1. Update `handle_new_user` trigger om full_name auto in te vullen.
--   2. Backfill bestaande profielen met derived name uit auth.users metadata
--      of email-pattern.
--
-- Veilig om meerdere keren te draaien (idempotent).
-- Run dit in Supabase Dashboard → SQL Editor → New query.
-- =====================================================

-- =====================================================
-- STAP 1: Trigger updaten voor toekomstige inschrijvingen
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    derived_name TEXT;
BEGIN
    -- 1. Probeer naam uit Microsoft OAuth metadata
    derived_name := COALESCE(
        NULLIF(new.raw_user_meta_data->>'full_name', ''),
        NULLIF(new.raw_user_meta_data->>'name', '')
    );

    -- 2. Fallback: derive uit email-prefix.
    -- "thomas.aelbrecht@gotalok.be" → "Thomas Aelbrecht"
    IF derived_name IS NULL AND new.email IS NOT NULL THEN
        derived_name := INITCAP(REPLACE(SPLIT_PART(new.email, '@', 1), '.', ' '));
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (new.id, new.email, derived_name, 'student')
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STAP 2: Backfill bestaande profielen zonder full_name
-- =====================================================
--
-- Update profielen waar full_name leeg/NULL is.
-- Probeert in deze volgorde:
--   1. auth.users.raw_user_meta_data->>'full_name'
--   2. auth.users.raw_user_meta_data->>'name'
--   3. INITCAP van email-prefix (voornaam.achternaam → Voornaam Achternaam)
-- =====================================================

UPDATE public.profiles p
SET full_name = COALESCE(
    NULLIF(u.raw_user_meta_data->>'full_name', ''),
    NULLIF(u.raw_user_meta_data->>'name', ''),
    INITCAP(REPLACE(SPLIT_PART(p.email, '@', 1), '.', ' '))
)
FROM auth.users u
WHERE p.id = u.id
  AND (p.full_name IS NULL OR p.full_name = '')
  AND p.email IS NOT NULL;

-- =====================================================
-- STAP 3 (verificatie): toon resultaat
-- =====================================================
-- Optioneel — voer apart uit om te zien wat er gebeurd is:
--
-- SELECT id, email, full_name, klas, role, created_at
-- FROM public.profiles
-- ORDER BY created_at DESC
-- LIMIT 20;
