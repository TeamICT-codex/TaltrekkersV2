-- =====================================================
-- Migration: beveiliging rollen, leerkrachtcode en voortgang
-- Datum: 2026-09-24
-- =====================================================
--
-- Dicht de volgende lekken (allemaal lokaal nagespeeld tegen een kopie van
-- deze databankstructuur, telkens als leerling of als anonieme bezoeker):
--
--   1. KRITIEK — Een leerling kon zichzelf 'teacher' of 'admin' maken met
--      één UPDATE op profiles via de publieke API-sleutel. De update-policy
--      beperkte de kolommen niet. Daarna: alle leerlingprofielen, sessies,
--      feedback en AI-kosten zichtbaar.
--      → Trigger `profiles_guard`: via de API mag een gebruiker enkel nog
--        zijn eigen klas/voorkeuren/XP-velden aanpassen. Rol, e-mail, naam
--        en id zijn afgeschermd. Beheer via SQL Editor blijft gewoon werken.
--
--   2. KRITIEK — De leerkrachtcode stond leesbaar in een publieke repo
--      (migration-2026-05-21-teacher-upgrade-rpc.sql) en in de functie zelf.
--      → De code wordt nu enkel als bcrypt-hash bewaard in een afgeschermd
--        schema `private`. Max. 5 foute pogingen per uur per account.
--      → Een admin die de code ingaf, werd teruggezet naar 'teacher'. Opgelost.
--      ⚠️  NA DEZE MIGRATIE WERKT DE OUDE CODE NIET MEER. Stel een nieuwe in:
--          SELECT private.set_teacher_code('kies-hier-een-nieuwe-lange-code');
--
--   3. HOOG — `upsert_word_progress` controleerde niet wie de aanroeper was:
--      ook een anonieme bezoeker kon voortgang schrijven voor elke leerling.
--      → Enkel nog de eigen voortgang, enkel voor ingelogde gebruikers.
--
--   4. MIDDEL — De klaslijst (registered_students: namen + klas) was leesbaar
--      zonder in te loggen. → Enkel nog leerkrachten en admins.
--
--   5. MIDDEL — Afhankelijk van de volgorde waarin oudere migraties gedraaid
--      werden, sloot is_teacher() admins uit, of zagen leerkrachten alle
--      feedback. → is_teacher() en is_admin() worden hier definitief gezet.
--
--   6. LAAG — Feedback kon op naam van een andere gebruiker ingediend worden.
--
-- Veilig om meerdere keren te draaien (idempotent) en loopt als één transactie:
-- lukt één stap niet, dan wordt niets gewijzigd.
--
-- Uitvoeren: Supabase Dashboard → SQL Editor → New query → plak dit bestand → Run.
-- Controle vooraf en achteraf: controle-2026-09-24-beveiliging.sql
-- =====================================================

BEGIN;

-- pgcrypto (voor bcrypt). Op Supabase staat die standaard in schema `extensions`.
-- De functies hieronder zoeken in public én extensions, dus beide werken.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- =====================================================
-- STAP 1: Rol-helpers — definitieve versie
-- =====================================================
-- Admins erven alle leerkrachtrechten. search_path vastgezet (hardening).
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('teacher', 'admin')
    );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$;

-- anon moet ze kunnen uitvoeren: policies roepen ze ook op voor niet-ingelogde
-- verzoeken (ze geven dan gewoon false terug).
GRANT EXECUTE ON FUNCTION public.is_teacher() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- =====================================================
-- STAP 2: profiles — rol en identiteit afschermen
-- =====================================================
-- Veiligheidsklep: de bescherming hieronder werkt met een lijst van kolommen.
-- Heeft de live tabel een kolom die hier niet gekend is, dan stopt de migratie
-- volledig (er wordt NIETS gewijzigd) in plaats van de app te breken.
DO $$
DECLARE
    unknown TEXT;
BEGIN
    SELECT string_agg(column_name, ', ' ORDER BY column_name) INTO unknown
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name NOT IN (
        -- afgeschermd (enkel via SQL Editor / functies)
        'id', 'email', 'full_name', 'role', 'created_at', 'updated_at',
        -- zelf aan te passen door de gebruiker
        'klas', 'finaliteit', 'jaargang', 'native_language',
        'points', 'streak', 'last_practice_date',
        'snake_tokens', 'dragon_tokens', 'last_xp_reward_checkpoint',
        'avatar_id', 'welcome_bonus_granted'
      );
    IF unknown IS NOT NULL THEN
        RAISE EXCEPTION 'Gestopt, er is niets gewijzigd: profiles heeft kolommen die deze migratie niet kent: %. Laat de lijst in profiles_guard aanpassen en draai de migratie opnieuw.', unknown;
    END IF;
END $$;

-- Allowlist: enkel deze kolommen mag een gebruiker via de API zelf wijzigen.
-- Nieuwe kolommen zijn dus standaard beschermd; voeg ze hier toe als de app
-- ze zelf moet kunnen schrijven.
CREATE OR REPLACE FUNCTION public.profiles_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    self_editable CONSTANT text[] := ARRAY[
        'klas', 'finaliteit', 'jaargang', 'native_language',
        'points', 'streak', 'last_practice_date',
        'snake_tokens', 'dragon_tokens', 'last_xp_reward_checkpoint',
        'avatar_id', 'welcome_bonus_granted'
    ];
BEGIN
    -- Enkel verzoeken via de publieke API (rollen anon/authenticated) worden
    -- gecontroleerd. SQL Editor (postgres), service_role en SECURITY DEFINER-
    -- functies zoals upgrade_to_teacher() en handle_new_user() gaan vrij door.
    IF current_user NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.role := 'student';
        RETURN NEW;
    END IF;

    -- updated_at mag vrij bewegen (eventuele tijdstempel-trigger).
    IF (to_jsonb(NEW) - self_editable - 'updated_at') IS DISTINCT FROM (to_jsonb(OLD) - self_editable - 'updated_at') THEN
        RAISE EXCEPTION 'Deze profielgegevens kun je niet zelf aanpassen (rol, naam of e-mail).'
            USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.profiles_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_guard ON public.profiles;
CREATE TRIGGER profiles_guard
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.profiles_guard();

-- Eigen profiel bijwerken blijft mogen — maar het id kan niet "verhuizen".
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- =====================================================
-- STAP 3: Afgeschermd schema voor geheimen
-- =====================================================
-- `private` wordt niet via de API aangeboden en anon/authenticated hebben er
-- geen toegang toe. Enkel SECURITY DEFINER-functies en de SQL Editor.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS private.app_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS private.teacher_code_attempts (
    id           BIGSERIAL PRIMARY KEY,
    user_id      UUID NOT NULL,
    success      BOOLEAN NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS teacher_code_attempts_user_time_idx
    ON private.teacher_code_attempts (user_id, attempted_at DESC);

ALTER TABLE private.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.teacher_code_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA private FROM PUBLIC, anon, authenticated;

-- Leerkrachtcode instellen of wijzigen (enkel vanuit de SQL Editor):
--   SELECT private.set_teacher_code('kies-hier-een-nieuwe-lange-code');
CREATE OR REPLACE FUNCTION private.set_teacher_code(new_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
    IF new_code IS NULL OR length(btrim(new_code)) < 10 THEN
        RAISE EXCEPTION 'Kies een leerkrachtcode van minstens 10 tekens.';
    END IF;
    INSERT INTO private.app_settings (key, value, updated_at)
    VALUES ('teacher_code_hash', crypt(btrim(new_code), gen_salt('bf', 10)), now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
    RETURN 'Leerkrachtcode ingesteld. De vorige code werkt niet meer.';
END;
$$;

REVOKE ALL ON FUNCTION private.set_teacher_code(TEXT) FROM PUBLIC, anon, authenticated;

-- =====================================================
-- STAP 4: upgrade_to_teacher — zonder code in de broncode
-- =====================================================
-- Zelfde handtekening en antwoordvorm als voorheen, dus de app hoeft niet te
-- veranderen: { success, error?, already_teacher? }.
CREATE OR REPLACE FUNCTION public.upgrade_to_teacher(provided_code TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    current_user_id UUID := auth.uid();
    v_role          TEXT;
    stored_hash     TEXT;
    recent_failures INT;
BEGIN
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Niet ingelogd.');
    END IF;

    SELECT role INTO v_role FROM public.profiles WHERE id = current_user_id;
    IF v_role IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Profiel niet gevonden. Log opnieuw in.');
    END IF;

    -- Leerkrachten en admins: niets doen (vroeger werd een admin teruggezet naar teacher).
    IF v_role IN ('teacher', 'admin') THEN
        RETURN jsonb_build_object('success', true, 'already_teacher', true);
    END IF;

    SELECT count(*) INTO recent_failures
    FROM private.teacher_code_attempts
    WHERE user_id = current_user_id
      AND NOT success
      AND attempted_at > now() - interval '1 hour';

    IF recent_failures >= 5 THEN
        RETURN jsonb_build_object('success', false,
            'error', 'Te veel foute pogingen. Probeer het over een uur opnieuw.');
    END IF;

    SELECT value INTO stored_hash FROM private.app_settings WHERE key = 'teacher_code_hash';
    IF stored_hash IS NULL THEN
        RETURN jsonb_build_object('success', false,
            'error', 'De leerkrachtcode is nog niet ingesteld. Vraag het aan de beheerder.');
    END IF;

    IF provided_code IS NULL OR crypt(btrim(provided_code), stored_hash) <> stored_hash THEN
        INSERT INTO private.teacher_code_attempts (user_id, success) VALUES (current_user_id, false);
        RETURN jsonb_build_object('success', false, 'error', 'Onjuiste leerkracht-code.');
    END IF;

    UPDATE public.profiles SET role = 'teacher'
    WHERE id = current_user_id AND role = 'student';

    INSERT INTO private.teacher_code_attempts (user_id, success) VALUES (current_user_id, true);

    RETURN jsonb_build_object('success', true, 'already_teacher', false);
END;
$$;

REVOKE ALL ON FUNCTION public.upgrade_to_teacher(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upgrade_to_teacher(TEXT) TO authenticated;

-- =====================================================
-- STAP 5: upsert_word_progress — enkel eigen voortgang
-- =====================================================
-- Zelfde handtekening (de app geeft p_user_id al mee), maar p_user_id MOET nu
-- de ingelogde gebruiker zijn. Dubbele woorden in één oproep worden samengevoegd
-- (vroeger gaf dat een fout "cannot affect row a second time").
CREATE OR REPLACE FUNCTION public.upsert_word_progress(
    p_user_id UUID,
    p_list_id TEXT,
    p_words   TEXT[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Je kunt enkel je eigen voortgang bijwerken.' USING ERRCODE = '42501';
    END IF;
    IF p_words IS NULL OR cardinality(p_words) = 0 THEN
        RETURN;
    END IF;
    IF cardinality(p_words) > 500 THEN
        RAISE EXCEPTION 'Te veel woorden in één keer (max. 500).';
    END IF;

    INSERT INTO public.word_progress (user_id, word, list_id, practiced_count, last_practiced_at)
    SELECT p_user_id, w, p_list_id, 1, now()
    FROM (SELECT DISTINCT unnest(p_words) AS w) AS s
    WHERE w IS NOT NULL AND length(w) BETWEEN 1 AND 200
    ON CONFLICT (user_id, word, list_id)
    DO UPDATE SET
        practiced_count = word_progress.practiced_count + 1,
        last_practiced_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_word_progress(UUID, TEXT, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_word_progress(UUID, TEXT, TEXT[]) TO authenticated;

-- =====================================================
-- STAP 6: Klaslijst enkel voor leerkrachten
-- =====================================================
DROP POLICY IF EXISTS "Anyone can read registered students" ON public.registered_students;
-- In productie bestond dezelfde open regel onder een andere naam.
DROP POLICY IF EXISTS "Anyone can view registered students" ON public.registered_students;
DROP POLICY IF EXISTS "Teachers can read registered students" ON public.registered_students;
CREATE POLICY "Teachers can read registered students"
ON public.registered_students FOR SELECT
USING (public.is_teacher());

-- =====================================================
-- STAP 7: Feedback
-- =====================================================
-- Overzicht enkel voor admins (een oudere migratie kon dit terugzetten naar alle leerkrachten).
DROP POLICY IF EXISTS "Teachers can view all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.feedback;
CREATE POLICY "Admins can view all feedback"
ON public.feedback FOR SELECT
USING (public.is_admin());

-- Indienen: ingelogd, en niet op naam van iemand anders.
DROP POLICY IF EXISTS "Authenticated users can insert feedback" ON public.feedback;
CREATE POLICY "Authenticated users can insert feedback"
ON public.feedback FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));

COMMIT;

-- =====================================================
-- KLAAR ✅  Volgende stappen:
--   1. Nieuwe leerkrachtcode instellen (de oude werkt niet meer):
--        SELECT private.set_teacher_code('kies-hier-een-nieuwe-lange-code');
--   2. controle-2026-09-24-beveiliging.sql draaien en de lijst met
--      leerkrachten/admins nakijken: staat daar iemand die er niet hoort?
--        UPDATE public.profiles SET role = 'student' WHERE email = '...';
-- =====================================================
