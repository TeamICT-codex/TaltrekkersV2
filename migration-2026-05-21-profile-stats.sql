-- =====================================================
-- Migration: Profielstats (XP, streak, tokens, avatar) naar DB
-- Datum: 2026-05-21
-- =====================================================
--
-- Voorheen zaten deze velden alleen in browser-localStorage waardoor
-- een leerling progress kwijt was bij device-wissel of cache-clear.
-- Vanaf nu: cloud sync zodat XP/streak/tokens/avatar overal beschikbaar zijn.
--
-- Velden:
--   points              — Totale XP
--   streak              — Aantal dagen op rij geoefend
--   last_practice_date  — ISO-datum van laatste sessie (voor streak-berekening)
--   snake_tokens        — Sneek-spel tokens
--   dragon_tokens       — Droak-spel tokens
--   last_xp_reward_checkpoint — Laatste XP-veelvoud waarop dragon-tokens uitgekeerd zijn
--   avatar_id           — Welke avatar de leerling gekozen heeft
--
-- Veilig om meerdere keren te draaien (idempotent).
-- =====================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS streak INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_practice_date TEXT,
    ADD COLUMN IF NOT EXISTS snake_tokens INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS dragon_tokens INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_xp_reward_checkpoint INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS avatar_id TEXT NOT NULL DEFAULT 'default';

-- CHECK constraints — voorkom rare waarden
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'profiles_points_nonneg_check'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_points_nonneg_check CHECK (points >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'profiles_tokens_nonneg_check'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_tokens_nonneg_check
            CHECK (snake_tokens >= 0 AND dragon_tokens >= 0);
    END IF;
END $$;

-- =====================================================
-- KLAAR ✅
-- Nieuwe leerlingen krijgen automatisch alle 0-defaults.
-- Bestaande leerlingen: client hydrateert hun localStorage bij volgende login.
-- =====================================================
