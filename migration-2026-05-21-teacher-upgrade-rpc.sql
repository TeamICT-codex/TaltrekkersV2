-- =====================================================
-- Migration: RPC functie voor in-app teacher upgrade
-- Datum: 2026-05-21
-- =====================================================
--
-- Maakt het mogelijk dat een ingelogde student zichzelf kan upgraden
-- naar 'teacher' door een code in te voeren in de app. De code wordt
-- server-side gevalideerd (in deze functie) zodat de client de check
-- niet kan omzeilen.
--
-- SECURITY DEFINER: de functie draait als de owner (postgres) en
-- bypasst dus RLS bij de UPDATE op profiles. De aanroeper kan alleen
-- zijn eigen profiel upgraden (auth.uid() check).
--
-- ⚠️  PAS DE CODE HIERONDER AAN voordat je dit runt!
--    Kies een sterke, niet-raadbare string. Deel hem alleen met je
--    collega's via een veilig kanaal (1-op-1, niet in groepschat).
--
-- Veilig om meerdere keren te draaien (idempotent).
-- =====================================================

CREATE OR REPLACE FUNCTION public.upgrade_to_teacher(provided_code TEXT)
RETURNS jsonb AS $$
DECLARE
    -- ⚠️  PAS DEZE CODE AAN! Dit is wat collega-leerkrachten moeten invoeren.
    valid_code TEXT := 'Ikbenleerkracht!';

    current_user_id UUID := auth.uid();
    updated_count INT;
BEGIN
    -- 1. Moet ingelogd zijn
    IF current_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Niet ingelogd.'
        );
    END IF;

    -- 2. Code moet overeenkomen
    IF provided_code IS NULL OR provided_code != valid_code THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Onjuiste leerkracht-code.'
        );
    END IF;

    -- 3. Update naar teacher rol (alleen eigen profiel)
    UPDATE public.profiles
    SET role = 'teacher'
    WHERE id = current_user_id
      AND role <> 'teacher';  -- skip als al teacher

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'already_teacher', updated_count = 0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Geef geauthenticeerde users (niet anonymous) execute-rechten
GRANT EXECUTE ON FUNCTION public.upgrade_to_teacher(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.upgrade_to_teacher(TEXT) FROM anon;

-- =====================================================
-- Verificatie (optioneel apart uit te voeren)
-- =====================================================
-- SELECT proname, prosecdef
-- FROM pg_proc
-- WHERE proname = 'upgrade_to_teacher';
--
-- Test door als leerling (geen teacher rol) in te loggen en in
-- SQL Editor → "Run as authenticated user" te zetten:
-- SELECT public.upgrade_to_teacher('leerkracht-talok-2026');
