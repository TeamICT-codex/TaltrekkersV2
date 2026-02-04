-- =====================================================
-- TALtrekkers Supabase Setup Script
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
    role TEXT DEFAULT 'student' CHECK (role IN ('student', 'teacher')),
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
-- STAP 3: RLS Policies - Profiles
-- =====================================================

-- Iedereen kan profielen lezen (email/naam is niet gevoelig)
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Anyone can view profiles" 
ON public.profiles FOR SELECT 
USING (true);

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
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'teacher'
    )
);

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

-- Functie die een profiel aanmaakt voor nieuwe gebruikers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role)
    VALUES (new.id, new.email, 'student')
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

-- Authenticated users kunnen feedback toevoegen
DROP POLICY IF EXISTS "Authenticated users can insert feedback" ON public.feedback;
CREATE POLICY "Anyone can insert feedback" 
ON public.feedback FOR INSERT 
WITH CHECK (true);

-- Iedereen kan feedback bekijken (geen geheimen)
DROP POLICY IF EXISTS "Users can view own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Teachers can view all feedback" ON public.feedback;
CREATE POLICY "Anyone can view feedback" 
ON public.feedback FOR SELECT 
USING (true);

-- =====================================================
-- KLAAR! ✅
-- Je database is nu correct geconfigureerd.
-- =====================================================
