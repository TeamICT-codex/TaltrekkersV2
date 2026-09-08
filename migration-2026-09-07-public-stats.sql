-- =====================================================
-- Migration: get_public_stats() RPC — "De grote taalteller"
-- Datum: 2026-09-07
-- =====================================================
--
-- Doel: één publieke teller die aan ELKE bezoeker (ook wie niet ingelogd is)
-- laat zien hoeveel er samen al geoefend werd met TALent voor Taal.
-- De cijfers verschijnen in de modal "De grote taalteller".
--
-- WAT DEZE FUNCTIE TERUGGEEFT (enkel opgetelde getallen):
--   teachers          → aantal leerkrachten + admins
--   students          → aantal leerlingen
--   classes           → aantal verschillende klassen
--   word_lists        → aantal verschillende woordenlijsten
--   sessions          → aantal oefensessies
--   words_practiced   → aantal verschillende geoefende woorden
--   questions_total   → totaal aantal beantwoorde quizvragen
--   questions_correct → daarvan juist beantwoord
--
-- WAT ZE NOOIT TERUGGEEFT:
--   GEEN namen, GEEN e-mailadressen, GEEN klaslijsten, GEEN individuele rijen.
--   Enkel count()- en sum()-resultaten. Precies daarom mag deze functie ook
--   door `anon` (niet-ingelogde bezoekers) opgeroepen worden: er valt via deze
--   weg niets over een leerling te weten te komen.
--
-- WAAROM SECURITY DEFINER:
--   RLS op profiles / practice_sessions / word_progress verbergt de rijen van
--   andere gebruikers. Een gewone query zou dus altijd 0 (of enkel de eigen
--   cijfers) tellen. SECURITY DEFINER laat de functie met de rechten van de
--   eigenaar draaien, zodat ze over álle rijen kan tellen — maar ze geeft
--   uitsluitend de totalen hierboven terug, nooit de rijen zelf.
--   `SET search_path = public` sluit search_path-manipulatie uit.
--
-- BELANGRIJK — Vercel draait GEEN migraties.
--   Voer dit bestand handmatig uit in de Supabase SQL-editor
--   (Dashboard → SQL Editor → New query → plakken → Run).
--   Zolang dit niet gebeurd is, toont de taalteller een vriendelijke melding
--   ("De teller is nog niet geactiveerd in de database.") in plaats van cijfers.
--
-- Veilig om meerdere keren te draaien (idempotent).
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
    'students',          (SELECT count(*) FROM public.profiles WHERE role = 'student'),
    'classes',           (SELECT count(DISTINCT klas) FROM public.profiles WHERE klas IS NOT NULL AND btrim(klas) <> ''),
    'word_lists',        (SELECT count(DISTINCT coalesce(nullif(file_name,''), context)) FROM public.practice_sessions),
    'sessions',          (SELECT count(*) FROM public.practice_sessions),
    'words_practiced',   (SELECT count(DISTINCT lower(word)) FROM public.word_progress),
    'questions_total',   (SELECT coalesce(sum(total_questions),0) FROM public.practice_sessions),
    'questions_correct', (SELECT coalesce(sum(score),0) FROM public.practice_sessions)
  );
$$;

-- =====================================================
-- Rechten — eerst alles intrekken, dan bewust toekennen
-- =====================================================
-- REVOKE FROM PUBLIC zet de standaard-toekenning van Postgres uit, zodat we
-- daarna expliciet kiezen wie mag uitvoeren.
REVOKE ALL ON FUNCTION public.get_public_stats() FROM PUBLIC;

-- anon          = bezoeker zonder login (ziet de teller op het welkomstscherm)
-- authenticated = ingelogde leerling/leerkracht (ziet de teller in de footer)
GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon, authenticated;

-- =====================================================
-- KLAAR ✅
-- =====================================================
