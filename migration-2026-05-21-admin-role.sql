-- =====================================================
-- Migration: Admin rol toevoegen
-- Datum: 2026-05-21
-- =====================================================
--
-- Splitst de oude "teacher kan alles" benadering op in twee niveaus:
--   - teacher: kan TeacherDashboard zien, leerlingen-data raadplegen
--   - admin: alles van teacher + feedback-overzicht bekijken
--
-- Een admin is in feite een super-teacher. De is_teacher() helper
-- wordt aangepast om OOK true te returnen voor admins, zodat admins
-- automatisch alle teacher-privileges erven zonder dubbele checks.
--
-- Voor "deze week" wordt admin handmatig in DB toegekend (geen
-- in-app upgrade-flow nodig — admins zijn ~1 persoon per school).
--
-- Veilig om meerdere keren te draaien (idempotent).
-- =====================================================

-- =====================================================
-- STAP 1: CHECK constraint uitbreiden met 'admin'
-- =====================================================
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('student', 'teacher', 'admin'));

-- =====================================================
-- STAP 2: is_admin() helper
-- =====================================================
-- Aparte functie omdat 'admin' meer privileges heeft dan 'teacher'.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- =====================================================
-- STAP 3: is_teacher() uitbreiden zodat admins ook teacher zijn
-- =====================================================
-- Hiermee erven admins automatisch alle teacher-RLS-policies
-- (kan leerling-sessies bekijken, klaslijst zien, etc.).
CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role IN ('teacher', 'admin')
    );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- =====================================================
-- STAP 4: feedback policy: alleen admins zien overzicht
-- =====================================================
-- Leerkrachten kunnen wel feedback GEVEN (INSERT policy blijft staan),
-- maar zien niet meer het overzicht van álle feedback — dat is voor admin.
DROP POLICY IF EXISTS "Teachers can view all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.feedback;
CREATE POLICY "Admins can view all feedback"
ON public.feedback FOR SELECT
USING (public.is_admin());

-- =====================================================
-- KLAAR! ✅
--
-- Maak één persoon admin via:
--   UPDATE profiles SET role = 'admin' WHERE email = 'jouw-mail@gotalok.be';
-- =====================================================
