-- =====================================================
-- Migration: game_settings tabel (admin-configureerbare game-content)
-- Datum: 2026-05-21
-- =====================================================
--
-- Singleton-tabel (één rij met id='global') waar admin de Sneek/Droak
-- game-tekst en kleuren kan aanpassen zonder code-deploy.
--
-- Iedereen (ingelogd) leest → game kan tekst tonen
-- Alleen admin schrijft → voorkomt vandalisme
--
-- Veilig om meerdere keren te draaien (idempotent).
-- =====================================================

CREATE TABLE IF NOT EXISTS public.game_settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    snake_text TEXT,
    dragon_text TEXT,
    snake_theme TEXT NOT NULL DEFAULT 'aurora',
    dragon_theme TEXT NOT NULL DEFAULT 'ember',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT game_settings_singleton CHECK (id = 'global')
);

-- Insert de singleton-rij als die nog niet bestaat
INSERT INTO public.game_settings (id) VALUES ('global')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- RLS — iedereen leest, alleen admin schrijft
-- =====================================================
ALTER TABLE public.game_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read game settings" ON public.game_settings;
CREATE POLICY "Anyone authenticated can read game settings"
ON public.game_settings FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Only admins can update game settings" ON public.game_settings;
CREATE POLICY "Only admins can update game settings"
ON public.game_settings FOR UPDATE
USING (public.is_admin());

-- =====================================================
-- KLAAR ✅
-- =====================================================
