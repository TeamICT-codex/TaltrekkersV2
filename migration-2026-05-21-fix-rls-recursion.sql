-- =====================================================
-- Migration: Fix RLS infinite recursion in profiles policies
-- Datum: 2026-05-21
-- =====================================================
--
-- Probleem: "Teachers can view all profiles" policy queryt zelf
-- public.profiles om de role te checken → Postgres detecteert
-- infinite recursion → ALLE SELECTs en UPDATEs op profiles crashen
-- met de error "infinite recursion detected in policy for relation
-- 'profiles'".
--
-- Symptomen die door deze bug ontstaan:
--   - Onboarding kan finaliteit/jaargang niet opslaan
--   - Welkomtekst toont email i.p.v. naam (profile select faalt)
--   - TeacherDashboard kan profielen niet ophalen
--
-- Oplossing: een SECURITY DEFINER helper-functie `is_teacher()`.
-- Die draait als de superuser (postgres) en bypasst daardoor RLS
-- bij zijn interne SELECT — geen recursion meer.
--
-- Bonus: we updaten meteen alle andere teacher-check policies
-- (practice_sessions, feedback, registered_students) zodat ze
-- dezelfde helper gebruiken. Consistenter en sneller.
--
-- Veilig om meerdere keren te draaien (idempotent).
-- Run in Supabase Dashboard → SQL Editor → New query.
-- =====================================================

-- =====================================================
-- STAP 1: Helper functie aanmaken
-- =====================================================
-- SECURITY DEFINER + owner = postgres → de SELECT inside deze
-- functie bypasst RLS, dus geen recursion wanneer policies
-- hem aanroepen.
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'teacher'
    );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated;

-- =====================================================
-- STAP 2: profiles policies (de échte fix tegen recursion)
-- =====================================================
DROP POLICY IF EXISTS "Teachers can view all profiles" ON public.profiles;
CREATE POLICY "Teachers can view all profiles"
ON public.profiles FOR SELECT
USING (public.is_teacher());

-- =====================================================
-- STAP 3: practice_sessions teacher policy
-- =====================================================
DROP POLICY IF EXISTS "Teachers can view all sessions" ON public.practice_sessions;
CREATE POLICY "Teachers can view all sessions"
ON public.practice_sessions FOR SELECT
USING (public.is_teacher());

-- =====================================================
-- STAP 4: feedback teacher policy
-- =====================================================
DROP POLICY IF EXISTS "Teachers can view all feedback" ON public.feedback;
CREATE POLICY "Teachers can view all feedback"
ON public.feedback FOR SELECT
USING (public.is_teacher());

-- =====================================================
-- STAP 5: registered_students teacher policies
-- =====================================================
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
-- KLAAR! ✅
-- Test in app: opnieuw inloggen + onboarding moet nu werken.
-- =====================================================
