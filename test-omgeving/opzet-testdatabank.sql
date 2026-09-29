BEGIN;

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.practice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    context TEXT,
    file_name TEXT,
    score INTEGER,
    total_questions INTEGER,
    duration_seconds INTEGER,
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.word_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    word TEXT,
    list_id TEXT,
    practiced_count INTEGER DEFAULT 0,
    last_practiced_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.word_progress ENABLE ROW LEVEL SECURITY;

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

GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated;

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

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can view all profiles" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Teachers can view all profiles"
ON public.profiles FOR SELECT
USING (public.is_teacher());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own sessions" ON public.practice_sessions;
CREATE POLICY "Users can insert own sessions"
ON public.practice_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own sessions" ON public.practice_sessions;
CREATE POLICY "Users can view own sessions"
ON public.practice_sessions FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Teachers can view all sessions" ON public.practice_sessions;
CREATE POLICY "Teachers can view all sessions"
ON public.practice_sessions FOR SELECT
USING (public.is_teacher());

DROP POLICY IF EXISTS "Users can insert own progress" ON public.word_progress;
CREATE POLICY "Users can insert own progress"
ON public.word_progress FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own progress" ON public.word_progress;
CREATE POLICY "Users can view own progress"
ON public.word_progress FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own progress" ON public.word_progress;
CREATE POLICY "Users can update own progress"
ON public.word_progress FOR UPDATE
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    derived_name TEXT;
BEGIN
    derived_name := COALESCE(
        NULLIF(new.raw_user_meta_data->>'full_name', ''),
        NULLIF(new.raw_user_meta_data->>'name', '')
    );

    IF derived_name IS NULL AND new.email IS NOT NULL THEN
        derived_name := INITCAP(REPLACE(SPLIT_PART(new.email, '@', 1), '.', ' '));
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (new.id, new.email, derived_name, 'student')
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_email TEXT NOT NULL,
    user_name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert feedback" ON public.feedback;
DROP POLICY IF EXISTS "Anyone can insert feedback" ON public.feedback;
CREATE POLICY "Authenticated users can insert feedback"
ON public.feedback FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Teachers can view all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Anyone can view feedback" ON public.feedback;
CREATE POLICY "Admins can view all feedback"
ON public.feedback FOR SELECT
USING (public.is_admin());

ALTER TABLE public.word_progress
    DROP CONSTRAINT IF EXISTS word_progress_user_word_list_unique;
ALTER TABLE public.word_progress
    ADD CONSTRAINT word_progress_user_word_list_unique
    UNIQUE (user_id, word, list_id);

CREATE OR REPLACE FUNCTION public.upsert_word_progress(
    p_user_id UUID,
    p_list_id TEXT,
    p_words TEXT[]
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

CREATE TABLE IF NOT EXISTS public.registered_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    klas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.registered_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read registered students" ON public.registered_students;
DROP POLICY IF EXISTS "Teachers can read registered students" ON public.registered_students;
CREATE POLICY "Teachers can read registered students"
ON public.registered_students FOR SELECT
USING (public.is_teacher());

DROP POLICY IF EXISTS "Teachers can insert students" ON public.registered_students;
CREATE POLICY "Teachers can insert students"
ON public.registered_students FOR INSERT
WITH CHECK (public.is_teacher());

DROP POLICY IF EXISTS "Teachers can update students" ON public.registered_students;
CREATE POLICY "Teachers can update students"
ON public.registered_students FOR UPDATE
USING (public.is_teacher());

DROP POLICY IF EXISTS "Teachers can delete students" ON public.registered_students;
CREATE POLICY "Teachers can delete students"
ON public.registered_students FOR DELETE
USING (public.is_teacher());

ALTER TABLE public.practice_sessions
    ADD COLUMN IF NOT EXISTS course_id TEXT;

ALTER TABLE public.practice_sessions
    ADD COLUMN IF NOT EXISTS finaliteit TEXT;

ALTER TABLE public.practice_sessions
    ADD COLUMN IF NOT EXISTS jaargang TEXT;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS klas TEXT;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS finaliteit TEXT,
    ADD COLUMN IF NOT EXISTS jaargang TEXT,
    ADD COLUMN IF NOT EXISTS native_language TEXT,
    ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS streak INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_practice_date TEXT,
    ADD COLUMN IF NOT EXISTS snake_tokens INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS dragon_tokens INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_xp_reward_checkpoint INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS avatar_id TEXT NOT NULL DEFAULT 'default',
    ADD COLUMN IF NOT EXISTS welcome_bonus_granted BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'profiles_finaliteit_check'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_finaliteit_check
            CHECK (finaliteit IS NULL OR finaliteit IN ('AF', 'DF', 'OKAN'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'profiles_jaargang_check'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_jaargang_check
            CHECK (jaargang IS NULL OR jaargang IN (
                '3e', '4e', '5e', '5 Duaal', '6e', '6 Duaal', '7e',
                'Fase 1', 'Fase 2', 'Fase 3', 'Fase 4'
            ));
    END IF;
END $$;

ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('student', 'teacher', 'admin'));

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('teacher', 'admin')
    );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "Teachers can view all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.feedback;
CREATE POLICY "Admins can view all feedback"
ON public.feedback FOR SELECT
USING (public.is_admin());

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

GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated;

DROP POLICY IF EXISTS "Teachers can view all profiles" ON public.profiles;
CREATE POLICY "Teachers can view all profiles"
ON public.profiles FOR SELECT
USING (public.is_teacher());

DROP POLICY IF EXISTS "Teachers can view all sessions" ON public.practice_sessions;
CREATE POLICY "Teachers can view all sessions"
ON public.practice_sessions FOR SELECT
USING (public.is_teacher());

DROP POLICY IF EXISTS "Teachers can view all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.feedback;
CREATE POLICY "Admins can view all feedback"
ON public.feedback FOR SELECT
USING (public.is_admin());

DROP POLICY IF EXISTS "Teachers can insert students" ON public.registered_students;
CREATE POLICY "Teachers can insert students"
ON public.registered_students FOR INSERT
WITH CHECK (public.is_teacher());

DROP POLICY IF EXISTS "Teachers can update students" ON public.registered_students;
CREATE POLICY "Teachers can update students"
ON public.registered_students FOR UPDATE
USING (public.is_teacher());

DROP POLICY IF EXISTS "Teachers can delete students" ON public.registered_students;
CREATE POLICY "Teachers can delete students"
ON public.registered_students FOR DELETE
USING (public.is_teacher());

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

INSERT INTO public.game_settings (id) VALUES ('global')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.game_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read game settings" ON public.game_settings;
CREATE POLICY "Anyone authenticated can read game settings"
ON public.game_settings FOR SELECT
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Only admins can update game settings" ON public.game_settings;
CREATE POLICY "Only admins can update game settings"
ON public.game_settings FOR UPDATE
USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    derived_name TEXT;
BEGIN
    derived_name := COALESCE(
        NULLIF(new.raw_user_meta_data->>'full_name', ''),
        NULLIF(new.raw_user_meta_data->>'name', '')
    );

    IF derived_name IS NULL AND new.email IS NOT NULL THEN
        derived_name := INITCAP(REPLACE(SPLIT_PART(new.email, '@', 1), '.', ' '));
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (new.id, new.email, derived_name, 'student')
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

UPDATE public.profiles p
SET full_name = COALESCE(
    NULLIF(u.raw_user_meta_data->>'full_name', ''),
    NULLIF(u.raw_user_meta_data->>'name', ''),
    INITCAP(REPLACE(SPLIT_PART(p.email, '@', 1), '.', ' '))
)
FROM auth.users u
WHERE p.id = u.id
  AND (p.full_name IS NULL OR p.full_name = '')
  AND p.email IS NOT NULL;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS finaliteit TEXT,
    ADD COLUMN IF NOT EXISTS jaargang TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'profiles_finaliteit_check'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_finaliteit_check
            CHECK (finaliteit IS NULL OR finaliteit IN ('AF', 'DF', 'OKAN'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_name = 'profiles_jaargang_check'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_jaargang_check
            CHECK (jaargang IS NULL OR jaargang IN (
                '3e', '4e', '5e', '5 Duaal', '6e', '6 Duaal', '7e',
                'Fase 1', 'Fase 2', 'Fase 3', 'Fase 4'
            ));
    END IF;
END $$;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS native_language TEXT;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS streak INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_practice_date TEXT,
    ADD COLUMN IF NOT EXISTS snake_tokens INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS dragon_tokens INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_xp_reward_checkpoint INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS avatar_id TEXT NOT NULL DEFAULT 'default';

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

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS welcome_bonus_granted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS quiz_results JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_practice_sessions_quiz_results
  ON public.practice_sessions USING GIN (quiz_results);

COMMENT ON COLUMN public.practice_sessions.quiz_results IS
  'Array van { word: string, correct: boolean } per quiz-vraag in deze sessie. Leeg voor pre-2026-05-28 sessies (legacy).';

CREATE OR REPLACE FUNCTION public.reset_my_data()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_uid UUID := auth.uid();
BEGIN
  IF current_uid IS NULL THEN
    RAISE EXCEPTION 'Niet ingelogd — reset_my_data vereist een geauthenticeerde sessie.';
  END IF;

  DELETE FROM practice_sessions WHERE user_id = current_uid;

  DELETE FROM word_progress WHERE user_id = current_uid;

  DELETE FROM feedback WHERE user_id = current_uid;

  UPDATE profiles SET
    points = 0,
    streak = 0,
    last_practice_date = NULL,
    snake_tokens = 0,
    dragon_tokens = 0,
    last_xp_reward_checkpoint = 0,
    welcome_bonus_granted = false
  WHERE id = current_uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_my_data() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_my_data() FROM anon, public;

ALTER TABLE public.practice_sessions
  ADD COLUMN IF NOT EXISTS total_words INTEGER;

COMMENT ON COLUMN public.practice_sessions.total_words IS
  'Aantal woorden in de VOLLEDIGE opgeladen lijst — voor X/Y-progress stats in TeacherDashboard. NULL voor sessies van vóór 28 mei 2026.';

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
    id            BIGSERIAL PRIMARY KEY,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS ai_usage_log_created_at_idx
    ON public.ai_usage_log (created_at DESC);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view ai usage log" ON public.ai_usage_log;
CREATE POLICY "Admins can view ai usage log"
ON public.ai_usage_log FOR SELECT
USING (public.is_admin());

DROP POLICY IF EXISTS "Users can insert own ai usage rows" ON public.ai_usage_log;
CREATE POLICY "Users can insert own ai usage rows"
ON public.ai_usage_log FOR INSERT
WITH CHECK (auth.uid() = user_id);

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

REVOKE ALL ON FUNCTION public.get_public_stats() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT json_build_object(
    'teachers',          (SELECT count(*) FROM public.profiles WHERE role IN ('teacher','admin')),
    'students',          (SELECT count(DISTINCT user_id) FROM public.practice_sessions WHERE user_id IS NOT NULL),
    'classes',           (SELECT count(DISTINCT klas) FROM public.profiles WHERE klas IS NOT NULL AND btrim(klas) <> ''),
    'word_lists',        (SELECT count(DISTINCT coalesce(nullif(file_name,''), context)) FROM public.practice_sessions),
    'sessions',          (SELECT count(*) FROM public.practice_sessions),
    'words_practiced',   (SELECT count(DISTINCT lower(word)) FROM public.word_progress),
    'questions_total',   (SELECT coalesce(sum(total_questions),0) FROM public.practice_sessions),
    'questions_correct', (SELECT coalesce(sum(score),0) FROM public.practice_sessions)
  );
$$;

REVOKE ALL ON FUNCTION public.get_public_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon, authenticated;

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

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

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

GRANT EXECUTE ON FUNCTION public.is_teacher() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

DO $$
DECLARE
    unknown TEXT;
BEGIN
    SELECT string_agg(column_name, ', ' ORDER BY column_name) INTO unknown
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name NOT IN (
        'id', 'email', 'full_name', 'role', 'created_at', 'updated_at',
        'klas', 'finaliteit', 'jaargang', 'native_language',
        'points', 'streak', 'last_practice_date',
        'snake_tokens', 'dragon_tokens', 'last_xp_reward_checkpoint',
        'avatar_id', 'welcome_bonus_granted'
      );
    IF unknown IS NOT NULL THEN
        RAISE EXCEPTION 'Gestopt, er is niets gewijzigd: profiles heeft kolommen die deze migratie niet kent: %. Laat de lijst in profiles_guard aanpassen en draai de migratie opnieuw.', unknown;
    END IF;
END $$;

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
    IF current_user NOT IN ('authenticated', 'anon') THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.role := 'student';
        RETURN NEW;
    END IF;

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

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

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

DROP POLICY IF EXISTS "Anyone can read registered students" ON public.registered_students;
DROP POLICY IF EXISTS "Anyone can view registered students" ON public.registered_students;
DROP POLICY IF EXISTS "Teachers can read registered students" ON public.registered_students;
CREATE POLICY "Teachers can read registered students"
ON public.registered_students FOR SELECT
USING (public.is_teacher());

DROP POLICY IF EXISTS "Teachers can view all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.feedback;
CREATE POLICY "Admins can view all feedback"
ON public.feedback FOR SELECT
USING (public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can insert feedback" ON public.feedback;
CREATE POLICY "Authenticated users can insert feedback"
ON public.feedback FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.frayer_cache (
    cache_key      TEXT PRIMARY KEY,
    word           TEXT NOT NULL,
    context        TEXT NOT NULL DEFAULT '',
    difficulty     TEXT NOT NULL DEFAULT '',
    prompt_version INTEGER NOT NULL DEFAULT 1,
    model_version  TEXT,
    model_data     JSONB NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    hit_count      INTEGER NOT NULL DEFAULT 0,
    last_hit_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS frayer_cache_word_idx ON public.frayer_cache (word);

ALTER TABLE public.frayer_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read frayer cache" ON public.frayer_cache;

COMMIT;
