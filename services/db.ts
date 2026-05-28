
import { supabase } from './supabase';
import { QuizResult, PracticeSettings, SessionTimingData, Finaliteit, Jaargang } from '../types';

interface SaveSessionParams {
    userId: string;
    context: string;
    fileName?: string;
    courseId?: string;
    finaliteit?: string;
    jaargang?: string;
    score: number;
    quizResults: QuizResult[];
    durationSeconds: number;
    /** Totaal aantal woorden in de VOLLEDIGE opgeladen lijst (uit _listAllWords). Optioneel — voor TeacherDashboard X/Y stats. */
    totalWords?: number;
}

export const saveSessionToSupabase = async ({
    userId,
    context,
    fileName,
    courseId,
    finaliteit,
    jaargang,
    score,
    quizResults,
    durationSeconds,
    totalWords,
}: SaveSessionParams) => {
    if (!userId) return;

    try {
        const { error } = await supabase.from('practice_sessions').insert({
            user_id: userId,
            context: context,
            file_name: fileName || null,
            course_id: courseId || null,
            finaliteit: finaliteit || null,
            jaargang: jaargang || null,
            score: score,
            total_questions: quizResults.length,
            duration_seconds: Math.floor(durationSeconds),
            // Per-woord resultaten — gebruikt door TeacherDashboard voor de
            // drill-down (welke woorden goed/fout per sessie). Pre-2026-05-28
            // sessies hebben dit veld leeg → drill-down toont fallback.
            quiz_results: quizResults,
            // Totale grootte van de opgeladen lijst — voor "X/Y geoefend" stats
            // in TeacherDashboard. Optioneel: voor sessies zonder _listAllWords
            // (oude sessies of algemene niveau-modi) blijft dit NULL.
            total_words: totalWords ?? null,
        });

        if (error) {
            console.error('Error saving session to Supabase:', error);
        }
    } catch (err) {
        console.error('Unexpected error saving session:', err);
    }
};

export const updateWordProgressInSupabase = async (
    userId: string,
    listId: string,
    words: string[]
) => {
    if (!userId || words.length === 0) return;

    // Batch upsert via RPC - één DB call voor alle woorden
    const { error } = await supabase.rpc('upsert_word_progress', {
        p_user_id: userId,
        p_list_id: listId,
        p_words: words,
    });

    if (error) {
        console.error('Error updating word progress:', error);
    }
};

/**
 * Update de klas van het ingelogde profiel (zelf-service vanuit Welcome).
 * Lege string of whitespace wordt opgeslagen als NULL zodat een leerling
 * de klas ook weer kan leegmaken.
 */
export const updateProfileKlas = async (
    userId: string,
    klas: string
): Promise<{ success: boolean; error?: string }> => {
    if (!userId) return { success: false, error: 'Niet ingelogd.' };
    const value = klas.trim() || null;
    const { error } = await supabase
        .from('profiles')
        .update({ klas: value })
        .eq('id', userId);
    if (error) {
        console.error('Error updating profile klas:', error);
        return { success: false, error: error.message };
    }
    return { success: true };
};

/**
 * Sla de gestructureerde klas-info op (finaliteit + jaargang) bij de eerste-login
 * onboarding-flow. Genereert automatisch een display-string voor `klas` zodat
 * bestaande TeacherDashboard-filters blijven werken (bv. "AF 6 Duaal").
 */
export const updateProfileKlasInfo = async (
    userId: string,
    finaliteit: Finaliteit,
    jaargang: Jaargang
): Promise<{ success: boolean; error?: string }> => {
    if (!userId) return { success: false, error: 'Niet ingelogd.' };
    const klas = `${finaliteit} ${jaargang}`;
    const { error } = await supabase
        .from('profiles')
        .update({ finaliteit, jaargang, klas })
        .eq('id', userId);
    if (error) {
        console.error('Error updating profile klas info:', error);
        return { success: false, error: error.message };
    }
    return { success: true };
};

/**
 * Upgrade het ingelogde profiel naar 'teacher' rol, mits de meegegeven code
 * matched met de server-side opgeslagen leerkracht-code. De validatie zit
 * volledig in de Postgres-functie `upgrade_to_teacher` — client kan dus geen
 * code afdwingen of bypassen.
 */
export const upgradeToTeacher = async (
    code: string
): Promise<{ success: boolean; error?: string; alreadyTeacher?: boolean }> => {
    const { data, error } = await supabase.rpc('upgrade_to_teacher', {
        provided_code: code,
    });

    if (error) {
        console.error('upgradeToTeacher RPC error:', error);
        return { success: false, error: error.message };
    }

    // De RPC retourneert { success, error?, already_teacher? }
    const result = data as { success: boolean; error?: string; already_teacher?: boolean };
    if (!result.success) {
        return { success: false, error: result.error || 'Onbekende fout.' };
    }

    return { success: true, alreadyTeacher: result.already_teacher };
};

// =====================================================
// Game settings (admin-configureerbare game-content)
// =====================================================

export type GameTheme = 'ember' | 'aurora' | 'forest' | 'midnight' | 'sunrise';

export interface GameSettings {
    snake_text: string | null;
    dragon_text: string | null;
    snake_theme: GameTheme;
    dragon_theme: GameTheme;
}

/**
 * Lees de globale game-instellingen (singleton row).
 * Iedereen die ingelogd is mag lezen — game-launchers gebruiken dit.
 */
export const fetchGameSettings = async (): Promise<{
    settings: GameSettings | null;
    error?: string;
}> => {
    const { data, error } = await supabase
        .from('game_settings')
        .select('snake_text, dragon_text, snake_theme, dragon_theme')
        .eq('id', 'global')
        .single();

    if (error) {
        console.warn('fetchGameSettings:', error.message);
        return { settings: null, error: error.message };
    }
    return { settings: data as GameSettings };
};

/**
 * Update de globale game-instellingen. RLS staat dit alleen toe voor admin.
 */
export const updateGameSettings = async (
    userId: string,
    settings: Partial<GameSettings>,
): Promise<{ success: boolean; error?: string }> => {
    const { error } = await supabase
        .from('game_settings')
        .update({ ...settings, updated_at: new Date().toISOString(), updated_by: userId })
        .eq('id', 'global');
    if (error) {
        console.error('updateGameSettings:', error);
        return { success: false, error: error.message };
    }
    return { success: true };
};

/**
 * Stats die we cloud-syncen tussen browser/device en Supabase.
 * Komt overeen met de relevante velden uit `UserData` (lokaal) maar
 * dan in snake_case zoals in de DB.
 */
export interface ProfileStats {
    points: number;
    streak: number;
    last_practice_date: string | null;
    snake_tokens: number;
    dragon_tokens: number;
    last_xp_reward_checkpoint: number;
    avatar_id: string;
    welcome_bonus_granted: boolean;
}

/**
 * Lees de cloud-stats van het ingelogde profiel. Wordt aangeroepen bij login
 * zodat de UI gehydrateerd kan worden met de meest recente waarden uit de DB
 * (in plaats van wat toevallig in deze browser's localStorage zit).
 */
export const fetchProfileStats = async (
    userId: string
): Promise<{ stats: ProfileStats | null; error?: string }> => {
    if (!userId) return { stats: null, error: 'Niet ingelogd.' };
    const { data, error } = await supabase
        .from('profiles')
        .select('points, streak, last_practice_date, snake_tokens, dragon_tokens, last_xp_reward_checkpoint, avatar_id, welcome_bonus_granted')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('Error fetching profile stats:', error);
        return { stats: null, error: error.message };
    }
    return { stats: data as ProfileStats };
};

/**
 * Push de huidige lokale stats naar de DB. Debounced aanroepen vanuit
 * useUserData (of een wrapper) zodat we niet bij elke kleine setUserData
 * een netwerkcall maken.
 */
export const upsertProfileStats = async (
    userId: string,
    stats: Partial<ProfileStats>
): Promise<{ success: boolean; error?: string }> => {
    if (!userId) return { success: false, error: 'Niet ingelogd.' };
    const { error } = await supabase
        .from('profiles')
        .update(stats)
        .eq('id', userId);
    if (error) {
        console.error('Error upserting profile stats:', error);
        return { success: false, error: error.message };
    }
    return { success: true };
};

/**
 * Update de moedertaal van het ingelogde profiel. Lege string wordt als NULL
 * opgeslagen zodat de leerling het ook kan leegmaken. Optioneel veld — AI
 * gebruikt het voor betere uitleg, maar werkt ook zonder.
 */
export const updateProfileNativeLanguage = async (
    userId: string,
    nativeLanguage: string
): Promise<{ success: boolean; error?: string }> => {
    if (!userId) return { success: false, error: 'Niet ingelogd.' };
    const value = nativeLanguage.trim() || null;
    const { error } = await supabase
        .from('profiles')
        .update({ native_language: value })
        .eq('id', userId);
    if (error) {
        console.error('Error updating native language:', error);
        return { success: false, error: error.message };
    }
    return { success: true };
};

/**
 * Submit feedback from a teacher or authorized user
 */
export const submitFeedback = async (
    userId: string | null,
    userEmail: string,
    userName: string,
    message: string
): Promise<{ success: boolean; error?: string }> => {
    try {
        const { error } = await supabase.from('feedback').insert({
            user_id: userId,
            user_email: userEmail,
            user_name: userName,
            message: message,
        });

        if (error) {
            console.error('Error saving feedback:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (err) {
        console.error('Unexpected error saving feedback:', err);
        return { success: false, error: 'Er ging iets mis bij het opslaan.' };
    }
};

/**
 * Get all feedback (for teachers/admins)
 */
export const getFeedback = async (): Promise<{
    data: Array<{
        id: string;
        user_name: string;
        user_email: string;
        message: string;
        created_at: string;
    }> | null;
    error?: string;
}> => {
    try {
        const { data, error } = await supabase
            .from('feedback')
            .select('id, user_name, user_email, message, created_at')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching feedback:', error);
            return { data: null, error: error.message };
        }

        return { data };
    } catch (err) {
        console.error('Unexpected error fetching feedback:', err);
        return { data: null, error: 'Er ging iets mis.' };
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// RESET MY DATA — herhaalbare-test helper (dev/admin gebruik)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wist sessiehistorie, woord-voortgang, feedback EN reset profile-stats voor de
 * huidige ingelogde user. Behoudt identiteit + voorkeuren (klas, finaliteit,
 * native_language, avatar_id).
 *
 * Implementatie: roept de Postgres RPC `reset_my_data()` aan (zie migration
 * 2026-05-28). De RPC draait met SECURITY DEFINER omdat normale users geen
 * DELETE-policies hebben op practice_sessions / word_progress / feedback.
 *
 * Caller-verantwoordelijkheid: localStorage `taltrekkers_*` keys wissen +
 * pagina re-laden, zodat in-memory state (useUserData hook) opnieuw vanuit
 * de schone DB-state hydrateert.
 */
export async function resetCurrentUserData(): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.rpc('reset_my_data');
        if (error) {
            console.error('reset_my_data RPC error:', error);
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (err) {
        console.error('Unexpected error in resetCurrentUserData:', err);
        return { success: false, error: 'Er ging iets mis bij het resetten.' };
    }
}
