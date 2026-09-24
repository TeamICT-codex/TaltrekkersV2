-- =====================================================
-- Controle: beveiligingstoestand (ENKEL LEZEN — wijzigt niets)
-- Datum: 2026-09-24
-- =====================================================
-- Draai dit VÓÓR en NA migration-2026-09-24-beveiliging-rollen.sql in
-- Supabase → SQL Editor. Elke rij toont een controle, de huidige toestand en
-- of die in orde is. Vóór de migratie verwacht je een aantal ❌; erna overal ✅.
--
-- Het tweede resultaat (onderaan) is de lijst van alle leerkrachten en admins:
-- kijk na of daar niemand tussen staat die er niet hoort. Het lek bestond al
-- een tijd, dus iemand kan zichzelf eerder al leerkracht gemaakt hebben.
-- =====================================================

WITH fn AS (
    SELECT p.oid, p.proname, p.prosecdef, p.proconfig, pg_get_functiondef(p.oid) AS def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('is_teacher', 'is_admin', 'upgrade_to_teacher', 'upsert_word_progress')
),
checks AS (
    SELECT 1 AS nr, 'Trigger profiles_guard op profiles' AS controle,
           CASE WHEN EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'profiles_guard'
                             AND tgrelid = 'public.profiles'::regclass AND NOT tgisinternal)
                THEN 'aanwezig' ELSE 'ontbreekt' END AS toestand,
           EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'profiles_guard'
                   AND tgrelid = 'public.profiles'::regclass AND NOT tgisinternal) AS ok
    UNION ALL
    SELECT 2, 'Update-policy profiles heeft WITH CHECK',
           coalesce((SELECT 'with_check = ' || coalesce(with_check, '(leeg)') FROM pg_policies
                     WHERE schemaname = 'public' AND tablename = 'profiles'
                       AND policyname = 'Users can update own profile'), 'policy ontbreekt'),
           EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles'
                   AND policyname = 'Users can update own profile' AND with_check IS NOT NULL)
    UNION ALL
    SELECT 3, 'Andere UPDATE/INSERT/ALL-policies op profiles (onbekend = nakijken)',
           coalesce((SELECT string_agg(policyname || ' [' || cmd || ']', ', ') FROM pg_policies
                     WHERE schemaname = 'public' AND tablename = 'profiles'
                       AND cmd IN ('UPDATE', 'INSERT', 'ALL')
                       AND policyname <> 'Users can update own profile'), 'geen'),
           NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles'
                       AND cmd IN ('UPDATE', 'INSERT', 'ALL')
                       AND policyname <> 'Users can update own profile')
    UNION ALL
    SELECT 4, 'Leerkrachtcode staat niet meer in de functie',
           CASE WHEN (SELECT def FROM fn WHERE proname = 'upgrade_to_teacher') ILIKE '%valid_code%'
                THEN 'code staat nog leesbaar in upgrade_to_teacher' ELSE 'geen code in de broncode' END,
           coalesce((SELECT def NOT ILIKE '%valid_code%' FROM fn WHERE proname = 'upgrade_to_teacher'), false)
    UNION ALL
    SELECT 5, 'Nieuwe leerkrachtcode ingesteld (private.app_settings)',
           CASE WHEN to_regclass('private.app_settings') IS NULL THEN 'schema private ontbreekt nog'
                ELSE 'zie resultaat 3 hieronder' END,
           to_regclass('private.app_settings') IS NOT NULL
    UNION ALL
    SELECT 6, 'upgrade_to_teacher: niet uitvoerbaar door anon',
           CASE WHEN has_function_privilege('anon', 'public.upgrade_to_teacher(text)', 'EXECUTE')
                THEN 'anon mag uitvoeren' ELSE 'anon mag niet' END,
           NOT has_function_privilege('anon', 'public.upgrade_to_teacher(text)', 'EXECUTE')
    UNION ALL
    SELECT 7, 'upsert_word_progress: controleert auth.uid()',
           CASE WHEN (SELECT def FROM fn WHERE proname = 'upsert_word_progress') ILIKE '%auth.uid()%'
                THEN 'controle aanwezig' ELSE 'geen controle: iedereen kan voor elke leerling schrijven' END,
           coalesce((SELECT def ILIKE '%auth.uid()%' FROM fn WHERE proname = 'upsert_word_progress'), false)
    UNION ALL
    SELECT 8, 'upsert_word_progress: niet uitvoerbaar door anon',
           CASE WHEN has_function_privilege('anon', 'public.upsert_word_progress(uuid,text,text[])', 'EXECUTE')
                THEN 'anon mag uitvoeren' ELSE 'anon mag niet' END,
           NOT has_function_privilege('anon', 'public.upsert_word_progress(uuid,text,text[])', 'EXECUTE')
    UNION ALL
    SELECT 9, 'is_teacher() telt admins mee',
           CASE WHEN (SELECT def FROM fn WHERE proname = 'is_teacher') ILIKE '%''admin''%'
                THEN 'teacher + admin' ELSE 'enkel teacher: admins zien het leerkrachtoverzicht niet' END,
           coalesce((SELECT def ILIKE '%''admin''%' FROM fn WHERE proname = 'is_teacher'), false)
    UNION ALL
    SELECT 10, 'Klaslijst niet leesbaar zonder login',
           coalesce((SELECT string_agg(policyname || ': ' || coalesce(qual, '(leeg)'), '; ') FROM pg_policies
                     WHERE schemaname = 'public' AND tablename = 'registered_students' AND cmd = 'SELECT'), 'geen policy'),
           NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'registered_students'
                       AND cmd IN ('SELECT', 'ALL') AND (qual IS NULL OR qual = 'true'))
    UNION ALL
    SELECT 11, 'Feedback-overzicht enkel voor admins',
           coalesce((SELECT string_agg(policyname, ', ') FROM pg_policies
                     WHERE schemaname = 'public' AND tablename = 'feedback' AND cmd IN ('SELECT', 'ALL')), 'geen policy'),
           NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'feedback'
                       AND cmd IN ('SELECT', 'ALL') AND policyname <> 'Admins can view all feedback')
    UNION ALL
    SELECT 13, 'Onbekende kolommen in profiles (moet leeg zijn vóór de migratie)',
           coalesce((SELECT string_agg(column_name, ', ') FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'profiles'
                       AND column_name NOT IN ('id','email','full_name','role','created_at','updated_at',
                           'klas','finaliteit','jaargang','native_language','points','streak','last_practice_date',
                           'snake_tokens','dragon_tokens','last_xp_reward_checkpoint','avatar_id','welcome_bonus_granted')),
                    'geen'),
           NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_schema = 'public' AND table_name = 'profiles'
                         AND column_name NOT IN ('id','email','full_name','role','created_at','updated_at',
                             'klas','finaliteit','jaargang','native_language','points','streak','last_practice_date',
                             'snake_tokens','dragon_tokens','last_xp_reward_checkpoint','avatar_id','welcome_bonus_granted'))
    UNION ALL
    SELECT 14, 'Andere triggers op profiles (ter info)',
           coalesce((SELECT string_agg(tgname, ', ') FROM pg_trigger
                     WHERE tgrelid = 'public.profiles'::regclass AND NOT tgisinternal AND tgname <> 'profiles_guard'), 'geen'),
           true
    UNION ALL
    SELECT 12, 'RLS aan op alle app-tabellen',
           coalesce((SELECT string_agg(c.relname, ', ') FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                     WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity), 'overal aan'),
           NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                       WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity)
)
SELECT nr, CASE WHEN ok THEN '✅' ELSE '❌' END AS ok, controle, toestand
FROM checks ORDER BY nr;

-- Resultaat 2: wie heeft leerkracht- of adminrechten? (nakijken!)
SELECT role, email, full_name, created_at
FROM public.profiles
WHERE role IN ('teacher', 'admin')
ORDER BY role, created_at;

-- Resultaat 3 (enkel na de migratie): is er een nieuwe leerkrachtcode?
-- Geeft een fout zolang de migratie nog niet gedraaid is — dat is normaal.
SELECT CASE WHEN count(*) = 1 THEN '✅ nieuwe leerkrachtcode ingesteld op ' || max(updated_at)::text
            ELSE '❌ nog geen nieuwe code — SELECT private.set_teacher_code(''...'');' END AS leerkrachtcode
FROM private.app_settings WHERE key = 'teacher_code_hash';
