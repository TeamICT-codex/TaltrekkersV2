import { supabase } from './supabase';

/**
 * "De grote taalteller" — publieke totalen ophalen.
 *
 * Deze module praat met de RPC `get_public_stats()` (zie
 * migration-2026-09-07-public-stats.sql). Die functie geeft uitsluitend
 * opgetelde getallen terug — geen namen, geen rijen, geen leerlinggegevens —
 * en mag daarom ook door niet-ingelogde bezoekers opgeroepen worden.
 */

/** De acht totalen zoals de teller ze toont (camelCase voor de React-kant). */
export interface PublicStats {
    teachers: number;
    students: number;
    classes: number;
    wordLists: number;
    sessions: number;
    wordsPracticed: number;
    questionsTotal: number;
    questionsCorrect: number;
}

/** Ruwe vorm zoals Postgres ze teruggeeft (snake_case). */
interface RawPublicStats {
    teachers?: number | string | null;
    students?: number | string | null;
    classes?: number | string | null;
    word_lists?: number | string | null;
    sessions?: number | string | null;
    words_practiced?: number | string | null;
    questions_total?: number | string | null;
    questions_correct?: number | string | null;
}

/** Vriendelijke melding wanneer de migratie nog niet gedraaid is. */
const NOT_ACTIVATED_MESSAGE = 'De teller is nog niet geactiveerd in de database.';

/**
 * Cache op module-niveau: de cijfers veranderen traag, dus 5 minuten volstaat
 * ruim. Zo kost het heropenen van de modal geen extra query.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedStats: PublicStats | null = null;
let cachedAt = 0;

/** Alles wat binnenkomt veilig naar een getal omzetten (bigint komt als string). */
function toNumber(value: unknown): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Haalt de publieke totalen op. Gooit nooit: fouten komen terug als
 * Nederlandse tekst in `error`, zodat de modal die gewoon kan tonen.
 *
 * Bij succes worden de cijfers 5 minuten gecacht; bij een fout wordt er niets
 * gecacht, zodat een volgende poging het opnieuw probeert.
 */
export async function fetchPublicStats(): Promise<{ stats: PublicStats | null; error: string | null }> {
    // Nog geldige cache? Meteen teruggeven.
    if (cachedStats && Date.now() - cachedAt < CACHE_TTL_MS) {
        return { stats: cachedStats, error: null };
    }

    try {
        const { data, error } = await supabase.rpc('get_public_stats');

        if (error) {
            // PGRST202 = PostgREST kent de functie niet → migratie nog niet
            // uitgevoerd in de Supabase SQL-editor.
            const code = (error as { code?: string }).code ?? '';
            const message = error.message ?? '';
            const missingFunction =
                code === 'PGRST202' || /could not find the function/i.test(message);

            return {
                stats: null,
                error: missingFunction ? NOT_ACTIVATED_MESSAGE : message || 'De teller kon niet geladen worden.',
            };
        }

        if (!data || typeof data !== 'object') {
            return { stats: null, error: 'De teller gaf geen cijfers terug.' };
        }

        const raw = data as RawPublicStats;
        const stats: PublicStats = {
            teachers: toNumber(raw.teachers),
            students: toNumber(raw.students),
            classes: toNumber(raw.classes),
            wordLists: toNumber(raw.word_lists),
            sessions: toNumber(raw.sessions),
            wordsPracticed: toNumber(raw.words_practiced),
            questionsTotal: toNumber(raw.questions_total),
            questionsCorrect: toNumber(raw.questions_correct),
        };

        cachedStats = stats;
        cachedAt = Date.now();
        return { stats, error: null };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Onbekende fout';
        return { stats: null, error: message };
    }
}

/** Percentage juist beantwoorde vragen, afgerond. 0 wanneer er nog niets is. */
export function correctPercentage(stats: PublicStats): number {
    if (stats.questionsTotal <= 0) return 0;
    return Math.round((stats.questionsCorrect / stats.questionsTotal) * 100);
}

/** Aantal fout beantwoorde vragen — client-side berekend, nooit negatief. */
export function questionsWrong(stats: PublicStats): number {
    return Math.max(0, stats.questionsTotal - stats.questionsCorrect);
}
