-- =====================================================
-- TALent voor Taal — Supabase Setup Script
-- Run dit script in Supabase SQL Editor om alles 
-- correct op te zetten vanaf nul.
-- =====================================================

-- =====================================================
-- STAP 1: Tabellen aanmaken
-- =====================================================

-- Profiles tabel (gekoppeld aan auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    role TEXT DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Practice sessions tabel (oefenresultaten)
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

-- Word progress tabel (voortgang per woord)
CREATE TABLE IF NOT EXISTS public.word_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    word TEXT,
    list_id TEXT,
    practiced_count INTEGER DEFAULT 0,
    last_practiced_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- STAP 2: Row Level Security (RLS) inschakelen
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.word_progress ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STAP 2b: Helper functie voor teacher-check
-- =====================================================
-- KRITIEK: zonder deze SECURITY DEFINER functie ontstaat infinite
-- recursion zodra een policy op profiles zelf profiles queryt.
-- Door de check te isoleren in een SECURITY DEFINER functie die
-- RLS bypasst, kunnen alle teacher-policies veilig aanroepen.
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('teacher', 'admin')
    );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated;

-- Admin-only helper. Admins erven automatisch alle teacher-privileges via
-- is_teacher() hierboven; deze is_admin() is voor strikter admin-only checks
-- (bv. feedback-overzicht raadplegen).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- =====================================================
-- STAP 3: RLS Policies - Profiles
-- =====================================================

-- Gebruikers kunnen hun eigen profiel lezen; leerkrachten kunnen alle profielen lezen
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can view all profiles" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Teachers can view all profiles"
ON public.profiles FOR SELECT
USING (public.is_teacher());

-- Gebruikers kunnen hun eigen profiel updaten (voor rol-upgrade via leerkrachtcode)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- =====================================================
-- STAP 4: RLS Policies - Practice Sessions
-- =====================================================

-- Gebruikers kunnen hun eigen sessies toevoegen
DROP POLICY IF EXISTS "Users can insert own sessions" ON public.practice_sessions;
CREATE POLICY "Users can insert own sessions" 
ON public.practice_sessions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Gebruikers kunnen hun eigen sessies bekijken
DROP POLICY IF EXISTS "Users can view own sessions" ON public.practice_sessions;
CREATE POLICY "Users can view own sessions" 
ON public.practice_sessions FOR SELECT 
USING (auth.uid() = user_id);

-- Leerkrachten kunnen ALLE sessies bekijken
DROP POLICY IF EXISTS "Teachers can view all sessions" ON public.practice_sessions;
CREATE POLICY "Teachers can view all sessions"
ON public.practice_sessions FOR SELECT
USING (public.is_teacher());

-- =====================================================
-- STAP 5: RLS Policies - Word Progress
-- =====================================================

-- Gebruikers kunnen hun eigen voortgang toevoegen
DROP POLICY IF EXISTS "Users can insert own progress" ON public.word_progress;
CREATE POLICY "Users can insert own progress" 
ON public.word_progress FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Gebruikers kunnen hun eigen voortgang bekijken
DROP POLICY IF EXISTS "Users can view own progress" ON public.word_progress;
CREATE POLICY "Users can view own progress" 
ON public.word_progress FOR SELECT 
USING (auth.uid() = user_id);

-- Gebruikers kunnen hun eigen voortgang updaten
DROP POLICY IF EXISTS "Users can update own progress" ON public.word_progress;
CREATE POLICY "Users can update own progress" 
ON public.word_progress FOR UPDATE 
USING (auth.uid() = user_id);

-- =====================================================
-- STAP 6: Trigger - Automatisch profiel aanmaken
-- =====================================================

-- Functie die een profiel aanmaakt voor nieuwe gebruikers.
-- Vult full_name automatisch in zodat leerkrachten leerlingen meteen herkennen
-- in het Teacher Dashboard (geen anonieme "thomas.aelbrecht" email-prefixes meer).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    derived_name TEXT;
BEGIN
    -- 1. Probeer naam uit Microsoft OAuth metadata
    derived_name := COALESCE(
        NULLIF(new.raw_user_meta_data->>'full_name', ''),
        NULLIF(new.raw_user_meta_data->>'name', '')
    );

    -- 2. Fallback: derive uit email-prefix.
    -- "thomas.aelbrecht@gotalok.be" → "Thomas Aelbrecht"
    -- Werkt voor de standaard schoolconventie van GO Talok.
    IF derived_name IS NULL AND new.email IS NOT NULL THEN
        derived_name := INITCAP(REPLACE(SPLIT_PART(new.email, '@', 1), '.', ' '));
    END IF;

    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (new.id, new.email, derived_name, 'student')
    ON CONFLICT (id) DO NOTHING;
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verwijder eventuele bestaande trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Maak de trigger aan
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- STAP 7: Feedback tabel voor leerkrachten
-- =====================================================

-- Feedback tabel (voor leerkracht feedback)
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_email TEXT NOT NULL,
    user_name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS inschakelen
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Alleen ingelogde gebruikers kunnen feedback toevoegen
DROP POLICY IF EXISTS "Authenticated users can insert feedback" ON public.feedback;
DROP POLICY IF EXISTS "Anyone can insert feedback" ON public.feedback;
CREATE POLICY "Authenticated users can insert feedback"
ON public.feedback FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Alleen admins kunnen het feedback-overzicht bekijken (leerkrachten kunnen
-- wel feedback GEVEN, INSERT-policy hierboven blijft staan).
DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Teachers can view all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Anyone can view feedback" ON public.feedback;
CREATE POLICY "Admins can view all feedback"
ON public.feedback FOR SELECT
USING (public.is_admin());

-- =====================================================
-- STAP 8: Batch word progress upsert (performance)
-- =====================================================

-- Unieke constraint voor batch upsert (ON CONFLICT)
ALTER TABLE public.word_progress
    DROP CONSTRAINT IF EXISTS word_progress_user_word_list_unique;
ALTER TABLE public.word_progress
    ADD CONSTRAINT word_progress_user_word_list_unique
    UNIQUE (user_id, word, list_id);

-- RPC functie: batch upsert van woord-voortgang in één DB call
CREATE OR REPLACE FUNCTION public.upsert_word_progress(
    p_user_id UUID,
    p_list_id TEXT,
    p_words TEXT[]
) RETURNS void AS $$
BEGIN
    INSERT INTO public.word_progress (user_id, word, list_id, practiced_count, last_practiced_at)
    SELECT p_user_id, unnest(p_words), p_list_id, 1, NOW()
    ON CONFLICT (user_id, word, list_id)
    DO UPDATE SET
        practiced_count = word_progress.practiced_count + 1,
        last_practiced_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STAP 9: Registered students (klassenlijst)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.registered_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    klas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.registered_students ENABLE ROW LEVEL SECURITY;

-- Iedereen mag de lijst van leerlingen lezen (nodig voor de Login-screen
-- waar leerlingen zichzelf selecteren vóór ze inloggen).
DROP POLICY IF EXISTS "Anyone can read registered students" ON public.registered_students;
CREATE POLICY "Anyone can read registered students"
ON public.registered_students FOR SELECT
USING (true);

-- Alleen leerkrachten mogen leerlingen toevoegen/verwijderen.
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

-- =====================================================
-- STAP 10: Structurele context op practice_sessions
-- =====================================================
-- Naast file_name (vrije upload-naam) bewaren we ook de structurele
-- context van een sessie zodat de leerkracht kan filteren/groeperen
-- op finaliteit, jaargang en cursus zonder uit filenames te raden.

ALTER TABLE public.practice_sessions
    ADD COLUMN IF NOT EXISTS course_id TEXT;

ALTER TABLE public.practice_sessions
    ADD COLUMN IF NOT EXISTS finaliteit TEXT;

ALTER TABLE public.practice_sessions
    ADD COLUMN IF NOT EXISTS jaargang TEXT;

-- =====================================================
-- STAP 11: Klas-veld op profiles
-- =====================================================
-- `klas` is een vrij TEXT-veld voor display & filtering (bv. "AF 6 Duaal").
-- Wordt automatisch gevuld door de frontend op basis van finaliteit + jaargang
-- bij de onboarding-flow, maar kan in principe door de leerkracht overschreven
-- worden met een fijnere granulariteit (bv. "6 DULOG").

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS klas TEXT;

-- =====================================================
-- STAP 12: Klas-onboarding velden (finaliteit + jaargang)
-- =====================================================
-- Leerlingen kiezen bij eerste login eenmalig hun finaliteit + jaargang.
-- Daarna pre-fillt PracticeSetup deze velden automatisch.

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

-- CHECK constraints voor geldige waarden (vangnet — frontend valideert ook).
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

-- =====================================================
-- KLAAR! ✅
-- Je database is nu correct geconfigureerd.
-- =====================================================
