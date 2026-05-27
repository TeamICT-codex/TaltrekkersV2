-- =====================================================
-- Migration: Welkomstbonus flag
-- Datum: 2026-05-21
-- =====================================================
--
-- Voegt `welcome_bonus_granted` toe aan profiles zodat we maximaal ÉÉN keer
-- een welkomstbonus uitkeren (1 Sneek-token cadeau bij eerste login).
-- Cross-device veilig: zelfs als de leerling de cache wist en opnieuw inlogt
-- vanuit een ander apparaat krijgt hij de bonus niet dubbel.
--
-- Veilig om meerdere keren te draaien (idempotent).
-- =====================================================

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS welcome_bonus_granted BOOLEAN NOT NULL DEFAULT false;
