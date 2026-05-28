-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: reset_my_data() RPC voor herhaalbare tests
--
-- Doel: laat een ingelogde user zijn EIGEN data wissen om vanaf nul te kunnen
-- testen (sessie-historie, voortgang, tokens, streak, welkomstbonus-vlag).
-- Behoudt: id, email, full_name, role, klas, finaliteit, jaargang,
-- native_language, avatar_id, created_at.
--
-- Waarom een RPC i.p.v. directe DELETE/UPDATE via SDK: er bestaan geen DELETE
-- policies op practice_sessions, word_progress, feedback voor normale users.
-- Een SECURITY DEFINER functie draait met owner-rechten en kan de cleanup doen.
-- ─────────────────────────────────────────────────────────────────────────────

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

  -- Sessie-historie wissen (CASCADE-safe via user_id)
  DELETE FROM practice_sessions WHERE user_id = current_uid;

  -- Woord-voortgang wissen (per-woord trackers)
  DELETE FROM word_progress WHERE user_id = current_uid;

  -- Feedback wissen (optioneel: comment uit als je je feedback wil behouden)
  DELETE FROM feedback WHERE user_id = current_uid;

  -- Profile stats resetten — behoud identiteit + voorkeuren (klas, finaliteit, ...)
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

-- Toegang: elke geauthenticeerde user mag zijn eigen data resetten
GRANT EXECUTE ON FUNCTION public.reset_my_data() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.reset_my_data() FROM anon, public;
