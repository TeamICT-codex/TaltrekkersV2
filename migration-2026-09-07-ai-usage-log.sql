-- =====================================================
-- Migration: ai_usage_log tabel (AI-verbruik + kostenraming)
-- Datum: 2026-09-07
-- =====================================================
--
-- Logboek van élke Gemini-call die via de serverless proxy (/api/gemini)
-- passeert. Doel: de beheerder kan in het leerkracht-dashboard zien hoeveel
-- AI-calls er gebeuren, hoeveel tokens die verbruiken en wat dat ongeveer
-- kost — zonder Google Cloud Console open te moeten doen.
--
-- WAT WORDT GELOGD (enkel metadata):
--   - tijdstip, gebruiker-id, functie-label ('quiz', 'frayer', 'tts', ...)
--   - modelnaam en token-aantallen (input / output / thinking / totaal)
--   - of de call lukte, welke statuscode, hoe lang ze duurde
--
-- WAT NIET WORDT GELOGD:
--   - GEEN prompts, GEEN antwoorden, GEEN leerlingnamen, GEEN woordenlijsten.
--   Enkel de user_id (UUID) staat erin, zodat misbruik opspoorbaar blijft.
--   Bij het verwijderen van een profiel wordt user_id NULL (ON DELETE SET NULL).
--
-- BELANGRIJK — Vercel draait GEEN migraties.
--   Voer dit bestand handmatig uit in de Supabase SQL-editor
--   (Dashboard → SQL Editor → New query → plakken → Run).
--   Zolang dit niet gebeurd is, toont het AI-verbruik-paneel een
--   vriendelijke melding in plaats van cijfers.
--
-- OPTIONEEL — anonieme calls ook loggen.
--   De proxy schrijft standaard mét de JWT van de ingelogde leerling; RLS
--   verplicht dan user_id = auth.uid(). Calls zónder login (niet-ingelogde
--   bezoekers) kunnen daardoor niet loggen en worden stil overgeslagen.
--   Zet je in Vercel → Settings → Environment Variables de server-side
--   variabele SUPABASE_SERVICE_ROLE_KEY (GEEN VITE_-prefix!), dan schrijft de
--   proxy met de service-role sleutel en worden óók anonieme calls gelogd
--   (met user_id NULL). Die sleutel omzeilt RLS en mag NOOIT in client-code
--   of in een VITE_-variabele terechtkomen.
--
-- Veilig om meerdere keren te draaien (idempotent).
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
    id            BIGSERIAL PRIMARY KEY,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- NULL = anonieme call (geen ingelogde gebruiker) of verwijderd profiel
    user_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    -- Functie-label uit de client: 'quiz', 'frayer', 'tts', ... ; 'onbekend'
    -- voor oude clients die het veld nog niet meesturen.
    feature       TEXT NOT NULL DEFAULT 'onbekend',
    model         TEXT NOT NULL,
    input_tokens  INTEGER,
    output_tokens INTEGER,
    thought_tokens INTEGER,
    total_tokens  INTEGER,
    success       BOOLEAN NOT NULL DEFAULT TRUE,
    status_code   SMALLINT,
    error_message TEXT,
    duration_ms   INTEGER
);

-- Het paneel vraagt altijd "laatste N dagen, nieuwste eerst" op.
CREATE INDEX IF NOT EXISTS ai_usage_log_created_at_idx
    ON public.ai_usage_log (created_at DESC);

-- =====================================================
-- RLS — alleen admin leest, ingelogde gebruiker schrijft enkel eigen rijen
-- =====================================================
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

-- Lezen: enkel admins (leerkrachten hebben hier niets te zoeken).
DROP POLICY IF EXISTS "Admins can view ai usage log" ON public.ai_usage_log;
CREATE POLICY "Admins can view ai usage log"
ON public.ai_usage_log FOR SELECT
USING (public.is_admin());

-- Schrijven: de proxy schrijft met de JWT van de leerling zelf, dus een rij
-- mag enkel op de eigen user_id staan. Zo kan niemand rijen op naam van een
-- ander verzinnen.
DROP POLICY IF EXISTS "Users can insert own ai usage rows" ON public.ai_usage_log;
CREATE POLICY "Users can insert own ai usage rows"
ON public.ai_usage_log FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Bewust GEEN update- of delete-policy: dit is een onveranderlijk logboek.
-- De service_role sleutel omzeilt RLS volledig en mag dus ook rijen met
-- user_id NULL wegschrijven (zie de opmerking over SUPABASE_SERVICE_ROLE_KEY
-- bovenaan).

-- =====================================================
-- KLAAR ✅
-- =====================================================
