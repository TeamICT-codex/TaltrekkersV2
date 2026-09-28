-- =====================================================
-- Migration: frayer_cache — gedeelde cache van Frayer-modellen
-- Datum: 2026-09-18
-- =====================================================
--
-- WAAROM:
--   Twee derde van de AI-kosten zijn Frayer-modellen, en die zijn voor
--   hetzelfde woord in hetzelfde vak telkens identiek. Op 2026-09-18 waren er
--   8.398 Frayer-aanvragen voor 674 verschillende woorden: gemiddeld twaalf
--   keer hetzelfde woord. Deze tabel bewaart het antwoord van Google één keer
--   per woord+vak+niveau, zodat enkel de eerste aanvrager Gemini nodig heeft.
--
-- WIE SCHRIJFT ERIN — enkel de proxy (api/gemini.ts) met de service_role.
--   Er zijn bewust GEEN insert/update/delete-policies voor gewone gebruikers.
--   De proxy bouwt de prompt zelf op uit woord, vak en niveau, en slaat enkel
--   op wat Gemini daarop antwoordt. Zo kan een leerling er nooit eigen tekst
--   in krijgen die klasgenoten daarna te zien zouden krijgen.
--
-- WAT ERIN ZIT — géén persoonsgegevens. Enkel woordenboekinhoud (definitie,
--   voorbeeldzinnen, synoniemen, antoniemen), welk model ze schreef en hoe
--   vaak ze hergebruikt werd. Ingelogde gebruikers mogen lezen.
--
-- LEEGMAKEN — bv. na een promptwijziging of een slecht model:
--   DELETE FROM public.frayer_cache;                         -- alles
--   DELETE FROM public.frayer_cache WHERE model_version = 'gemini-2.5-flash';
--   De code hoogt bovendien FRAYER_PROMPT_VERSION op bij een promptwijziging,
--   waardoor oude regels vanzelf niet meer gevonden worden.
--
-- Voer dit uit in de Supabase SQL-editor (Vercel draait geen migraties).
-- Veilig om meerdere keren te draaien (idempotent). De tabel is inert
-- zolang de bijhorende code niet gedeployd is.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.frayer_cache (
    -- "v1|woord|vak|niveau": woord in kleine letters, vak exact, niveau canoniek
    cache_key      TEXT PRIMARY KEY,
    word           TEXT NOT NULL,
    context        TEXT NOT NULL DEFAULT '',
    difficulty     TEXT NOT NULL DEFAULT '',
    prompt_version INTEGER NOT NULL DEFAULT 1,
    -- Welk model het schreef (bv. gemini-2.5-flash) — handig om selectief te wissen
    model_version  TEXT,
    -- Het FrayerModelData-object zoals de app het gebruikt
    model_data     JSONB NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    hit_count      INTEGER NOT NULL DEFAULT 0,
    last_hit_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS frayer_cache_word_idx ON public.frayer_cache (word);

ALTER TABLE public.frayer_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read frayer cache" ON public.frayer_cache;
CREATE POLICY "Authenticated can read frayer cache"
ON public.frayer_cache FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Bewust geen INSERT/UPDATE/DELETE-policies: enkel de service_role (de proxy)
-- kan schrijven. De service_role omzeilt RLS volledig.

-- =====================================================
-- KLAAR ✅
-- =====================================================
