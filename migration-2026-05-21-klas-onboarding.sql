-- =====================================================
-- Migration: Klas-onboarding velden
-- Datum: 2026-05-21
-- =====================================================
--
-- Voegt `finaliteit` en `jaargang` toe aan profiles zodat leerlingen
-- bij eerste login eenmalig hun klas selecteren en dat niet bij elke
-- sessie opnieuw moeten doen.
--
-- Het bestaande `klas` veld blijft bestaan en wordt voortaan
-- automatisch gevuld vanuit de frontend (bv. "AF 6 Duaal") zodat
-- TeacherDashboard-filters blijven werken zonder aanpassingen.
--
-- Veilig om meerdere keren te draaien (idempotent).
-- Run dit in Supabase Dashboard → SQL Editor → New query.
-- =====================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS finaliteit TEXT,
    ADD COLUMN IF NOT EXISTS jaargang TEXT;

-- Optioneel: CHECK constraints om enkel geldige waarden toe te laten.
-- Aangenomen dat we deze waarden willen forceren op DB-niveau.
-- (Frontend valideert sowieso, maar dit is een vangnet.)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'profiles_finaliteit_check'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_finaliteit_check
            CHECK (finaliteit IS NULL OR finaliteit IN ('AF', 'DF', 'OKAN'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'profiles_jaargang_check'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_jaargang_check
            CHECK (jaargang IS NULL OR jaargang IN (
                '3e', '4e', '5e', '5 Duaal', '6e', '6 Duaal', '7e',
                'Fase 1', 'Fase 2', 'Fase 3', 'Fase 4'
            ));
    END IF;
END $$;

-- =====================================================
-- Verificatie (optioneel apart uit te voeren)
-- =====================================================
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'profiles'
-- ORDER BY ordinal_position;
