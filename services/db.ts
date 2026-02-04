
import { supabase } from './supabase';
import { QuizResult, PracticeSettings, SessionTimingData } from '../types';

export const saveSessionToSupabase = async (
    userId: string,
    context: string,
    fileName: string | undefined,
    score: number,
    quizResults: QuizResult[],
    durationSeconds: number
) => {
    if (!userId) return;

    try {
        const { error } = await supabase.from('practice_sessions').insert({
            user_id: userId,
            context: context,
            file_name: fileName || null,
            score: score,
            total_questions: quizResults.length,
            duration_seconds: Math.floor(durationSeconds),
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
    listId: string, // Context of bestandsnaam
    words: string[]
) => {
    if (!userId) return;

    // Voor elk woord, update of insert in de database (upsert)
    // We doen dit simpelweg door practiced_count +1 te doen als het bestaat
    // Supabase upsert is hier handig voor.

    // Omdat we 'practiced_count' willen incrementen, is upsert met conflict niet direct triviaal voor increment.
    // Maar we kunnen een stored procedure gebruiken of gewoon kijken of het bestaat.
    // Voor eenvoud nu: we proberen te inserten, als conflict (reeds geoefend), dan laten we het zo (of we zouden update query moeten doen).

    // Betere aanpak voor MVP: Selecteer bestaande, update count, of insert nieuwe.
    // Omdat we meerdere woorden in 1 keer doen, loopen we er doorheen #performantie kan beter maar ok voor now.

    for (const word of words) {
        try {
            // Check if exists
            const { data: existing } = await supabase
                .from('word_progress')
                .select('id, practiced_count')
                .eq('user_id', userId)
                .eq('word', word)
                .eq('list_id', listId)
                .single();

            if (existing) {
                await supabase.from('word_progress')
                    .update({
                        practiced_count: (existing.practiced_count || 1) + 1,
                        last_practiced_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);
            } else {
                await supabase.from('word_progress').insert({
                    user_id: userId,
                    word: word,
                    list_id: listId,
                    practiced_count: 1,
                    last_practiced_at: new Date().toISOString()
                });
            }
        } catch (err) {
            console.error(`Failed to update progress for word: ${word}`, err);
        }
    }
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
