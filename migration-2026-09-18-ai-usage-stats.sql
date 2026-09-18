-- =====================================================
-- Migration: get_ai_usage_stats() — AI-verbruik optellen in de database
-- Datum: 2026-09-18
-- =====================================================
--
-- WAAROM:
--   Het AI-verbruik-paneel haalde alle logregels op en telde die op in de
--   browser. Supabase levert per opvraging echter maximaal ~1.000 rijen,
--   ongeacht wat de app vraagt. Op 2026-09-18 stonden er 10.747 regels in
--   ai_usage_log terwijl het paneel er 1.000 toonde: de kosten werden dus
--   ongeveer tien keer te laag weergegeven.
--
-- OPLOSSING:
--   Deze functie telt alles op in de database en geeft één JSON-object terug
--   (één rij, dus nooit afgekapt door de rijlimiet). De TARIEVEN blijven
--   bewust in de app staan (services/aiUsage.ts), zodat er maar één plaats is
--   waar prijzen onderhouden worden.
--
-- PERIODES worden in Belgische tijd berekend (de school zit in België):
--   vandaag = sinds middernacht, week = sinds maandag, maand = sinds de 1e.
--
-- TOEGANG: enkel beheerders (public.is_admin()). De functie draait als
--   SECURITY DEFINER om RLS te kunnen overslaan bij het optellen, dus de
--   admin-check staat expliciet in de functie zelf.
--
-- Voer dit uit in de Supabase SQL-editor (Vercel draait geen migraties).
-- Veilig om meerdere keren te draaien (idempotent).
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_ai_usage_stats(p_days INT DEFAULT 90)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
    v_since       TIMESTAMPTZ := now() - make_interval(days => greatest(p_days, 1));
    v_today       TIMESTAMPTZ := date_trunc('day',   now() AT TIME ZONE 'Europe/Brussels') AT TIME ZONE 'Europe/Brussels';
    v_week        TIMESTAMPTZ := date_trunc('week',  now() AT TIME ZONE 'Europe/Brussels') AT TIME ZONE 'Europe/Brussels';
    v_month       TIMESTAMPTZ := date_trunc('month', now() AT TIME ZONE 'Europe/Brussels') AT TIME ZONE 'Europe/Brussels';
    v_result      JSON;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Enkel beheerders kunnen het AI-verbruik raadplegen.';
    END IF;

    WITH bron AS (
        SELECT
            created_at,
            coalesce(nullif(btrim(feature), ''), 'onbekend') AS feature,
            coalesce(nullif(btrim(model), ''), 'onbekend')   AS model,
            success,
            user_id,
            coalesce(input_tokens, 0)                                  AS input_tokens,
            coalesce(output_tokens, 0) + coalesce(thought_tokens, 0)   AS output_tokens
        FROM public.ai_usage_log
        WHERE created_at >= v_since
    ),
    -- Elke rij kan in meerdere periodes vallen (vandaag zit ook in deze week).
    per_periode AS (
        SELECT p.periode, b.model,
               count(*)                                AS calls,
               sum(b.input_tokens)                     AS input_tokens,
               sum(b.output_tokens)                    AS output_tokens,
               count(*) FILTER (WHERE NOT b.success)   AS failed
        FROM bron b
        CROSS JOIN LATERAL (
            VALUES
                ('vandaag', b.created_at >= v_today),
                ('week',    b.created_at >= v_week),
                ('maand',   b.created_at >= v_month),
                ('alles',   TRUE)
        ) AS p(periode, hoort_erbij)
        WHERE p.hoort_erbij
        GROUP BY p.periode, b.model
    ),
    per_functie AS (
        SELECT feature, model,
               count(*)                              AS calls,
               sum(input_tokens)                     AS input_tokens,
               sum(output_tokens)                    AS output_tokens,
               count(*) FILTER (WHERE NOT success)   AS failed
        FROM bron
        GROUP BY feature, model
    )
    SELECT json_build_object(
        'days',            greatest(p_days, 1),
        'total_rows',      (SELECT count(*) FROM bron),
        'anonymous_calls', (SELECT count(*) FROM bron WHERE user_id IS NULL),
        'first_logged_at', (SELECT min(created_at) FROM bron),
        'periods',         coalesce((SELECT json_agg(row_to_json(per_periode)) FROM per_periode), '[]'::json),
        'features',        coalesce((SELECT json_agg(row_to_json(per_functie)) FROM per_functie), '[]'::json)
    ) INTO v_result;

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_ai_usage_stats(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_usage_stats(INT) TO authenticated;

-- =====================================================
-- KLAAR ✅
-- =====================================================
