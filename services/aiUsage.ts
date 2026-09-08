import { supabase } from './supabase';

/**
 * AI-verbruik: ophalen + rekenwerk.
 *
 * Deze module bevat géén React — enkel het ophalen van de metadata-rijen uit
 * `ai_usage_log` en pure functies die daar cijfers van maken. De tabel bevat
 * bewust alleen metadata (tokens, model, functie, gelukt/mislukt): geen
 * prompts, geen antwoorden, geen namen. Zie migration-2026-09-07-ai-usage-log.sql.
 */

/** Tokenverbruik zoals Gemini het teruggeeft (velden kunnen ontbreken). */
export interface AiUsageMetadata {
    promptTokenCount?: number | null;
    candidatesTokenCount?: number | null;
    thoughtsTokenCount?: number | null;
    totalTokenCount?: number | null;
}

/**
 * Schrijft één metadata-rij weg in `ai_usage_log`: welke functie, welk model,
 * hoeveel tokens, gelukt of niet, hoe lang. NOOIT prompts of antwoorden.
 *
 * Wordt aangeroepen vanuit services/geminiService.ts na elke Gemini-call.
 * Gooit nooit en geeft niets terug: loggen mag een oefening van een leerling
 * nooit vertragen of doen mislukken. Zonder ingelogde sessie slaan we over,
 * want de RLS-regel `auth.uid() = user_id` zou de rij toch weigeren.
 */
export async function logAiUsage(entry: {
    feature: string;
    model: string;
    usage?: AiUsageMetadata | null;
    success: boolean;
    errorMessage?: string | null;
    durationMs: number;
}): Promise<void> {
    try {
        const { data } = await supabase.auth.getSession();
        const userId = data.session?.user?.id;
        if (!userId) return;

        const { error } = await supabase.from('ai_usage_log').insert({
            user_id: userId,
            feature: entry.feature,
            model: entry.model,
            input_tokens: entry.usage?.promptTokenCount ?? null,
            output_tokens: entry.usage?.candidatesTokenCount ?? null,
            thought_tokens: entry.usage?.thoughtsTokenCount ?? null,
            total_tokens: entry.usage?.totalTokenCount ?? null,
            success: entry.success,
            status_code: entry.success ? 200 : null,
            error_message: entry.errorMessage ? entry.errorMessage.slice(0, 200) : null,
            duration_ms: Math.round(entry.durationMs),
        });

        if (error) console.warn('AI-verbruik loggen mislukt:', error.message);
    } catch (err: unknown) {
        console.warn('AI-verbruik loggen mislukt:', err instanceof Error ? err.message : err);
    }
}

/** Eén gelogde AI-call, zoals het paneel ze nodig heeft. */
export interface AiUsageRow {
    created_at: string;
    /** NULL = call zonder ingelogde gebruiker (of profiel intussen verwijderd). */
    user_id: string | null;
    feature: string;
    model: string;
    input_tokens: number | null;
    output_tokens: number | null;
    thought_tokens: number | null;
    success: boolean;
}

/**
 * Haalt de recente logregels op. Gooit nooit: fouten komen terug als tekst,
 * en een ontbrekende tabel (migratie nog niet gedraaid) krijgt een eigen vlag
 * zodat het paneel daar een vriendelijke uitleg voor kan tonen.
 */
export async function fetchAiUsageRows(
    days = 90,
    limit = 20000
): Promise<{ rows: AiUsageRow[]; error: string | null; missingTable: boolean }> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    try {
        const { data, error } = await supabase
            .from('ai_usage_log')
            .select('created_at, user_id, feature, model, input_tokens, output_tokens, thought_tokens, success')
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            // PGRST205 = PostgREST kent de tabel niet, 42P01 = Postgres "relation
            // does not exist". Beide betekenen: migratie nog niet uitgevoerd.
            const code = (error as { code?: string }).code ?? '';
            const message = error.message ?? '';
            const missingTable =
                code === 'PGRST205' ||
                code === '42P01' ||
                /does not exist/i.test(message) ||
                /could not find the table/i.test(message);

            return { rows: [], error: missingTable ? null : message || 'Onbekende fout', missingTable };
        }

        return { rows: (data ?? []) as AiUsageRow[], error: null, missingTable: false };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Onbekende fout';
        return { rows: [], error: message, missingTable: false };
    }
}

/**
 * Tarieven van Google, in US-dollar per 1 miljoen tokens (stand 2026-09).
 * Enkel een schatting: de factuur van Google blijft de echte waarheid.
 */
export const PRICING_USD_PER_1M: Record<string, { input: number; output: number }> = {
    'gemini-flash-latest': { input: 0.30, output: 2.50 },
    'gemini-2.5-flash': { input: 0.30, output: 2.50 },
    'gemini-2.5-flash-preview-tts': { input: 0.50, output: 10.00 },
};

/** Fallback voor een model dat we (nog) niet kennen: gewoon het Flash-tarief. */
const DEFAULT_PRICING = PRICING_USD_PER_1M['gemini-flash-latest'];

/**
 * Geschatte kost van één call in US-dollar.
 *
 * Thinking-tokens worden door Google als OUTPUT gefactureerd, dus die tellen
 * mee in het output-tarief. Mislukte calls hebben geen gekende tokens (NULL)
 * en kosten hier dus $0.
 */
export function estimateCostUsd(row: AiUsageRow): number {
    const pricing = PRICING_USD_PER_1M[row.model] ?? DEFAULT_PRICING;
    const input = row.input_tokens ?? 0;
    const output = (row.output_tokens ?? 0) + (row.thought_tokens ?? 0);
    return (input / 1_000_000) * pricing.input + (output / 1_000_000) * pricing.output;
}

/** Opgetelde cijfers voor één periode of één functie. */
export interface UsageBucket {
    label: string;
    calls: number;
    inputTokens: number;
    /** Output + thinking-tokens samen (zo factureert Google het ook). */
    outputTokens: number;
    failed: number;
    costUsd: number;
}

function emptyBucket(label: string): UsageBucket {
    return { label, calls: 0, inputTokens: 0, outputTokens: 0, failed: 0, costUsd: 0 };
}

function addRow(bucket: UsageBucket, row: AiUsageRow): void {
    bucket.calls += 1;
    bucket.inputTokens += row.input_tokens ?? 0;
    bucket.outputTokens += (row.output_tokens ?? 0) + (row.thought_tokens ?? 0);
    if (!row.success) bucket.failed += 1;
    bucket.costUsd += estimateCostUsd(row);
}

/** Nederlandse namen voor de functie-labels die de client meestuurt. */
export const FEATURE_LABELS_NL: Record<string, string> = {
    frayer: 'Frayer-model (leerling)',
    quiz: 'Quizvragen',
    feedback: 'Foutfeedback',
    vereenvoudig: 'Vraag vereenvoudigen',
    tts: 'Uitspraak (TTS)',
    vertaling: 'Vertaling Frayer-model',
    woordextractie: 'Woordextractie (upload)',
    verhaal: 'Verhaaluitdaging',
    'verhaal-thema': 'Verhaal: thema',
    'verhaal-evaluatie': 'Verhaal: evaluatie',
    'lees-evaluatie': 'Leesstrategie: evaluatie',
    'didactische-analyse': 'Didactische analyse',
    onbekend: 'Onbekend (oude client)',
};

/**
 * Telt de rijen op per periode en per functie.
 *
 * Periodes gebruiken de lokale tijd van de browser: vandaag vanaf middernacht,
 * deze week vanaf maandag 00:00, deze maand vanaf de 1e. "Alles" = alle rijen
 * die je meegaf (dat zijn er standaard 90 dagen).
 */
export function aggregateUsage(
    rows: AiUsageRow[],
    now: Date = new Date()
): { periods: UsageBucket[]; perFeature: UsageBucket[]; total: UsageBucket; anonymousCalls: number } {
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    // getDay(): 0 = zondag. Omrekenen zodat maandag dag 0 van de week is.
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - ((startOfToday.getDay() + 6) % 7));

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const today = emptyBucket('Vandaag');
    const week = emptyBucket('Deze week');
    const month = emptyBucket('Deze maand');
    const all = emptyBucket('Alles');

    const perFeatureMap = new Map<string, UsageBucket>();
    let anonymousCalls = 0;

    for (const row of rows) {
        const at = new Date(row.created_at);

        addRow(all, row);
        if (at >= startOfMonth) addRow(month, row);
        if (at >= startOfWeek) addRow(week, row);
        if (at >= startOfToday) addRow(today, row);

        if (row.user_id === null) anonymousCalls += 1;

        const key = row.feature || 'onbekend';
        let bucket = perFeatureMap.get(key);
        if (!bucket) {
            bucket = emptyBucket(FEATURE_LABELS_NL[key] ?? key);
            perFeatureMap.set(key, bucket);
        }
        addRow(bucket, row);
    }

    const perFeature = Array.from(perFeatureMap.values()).sort((a, b) => b.costUsd - a.costUsd);

    // `total` is per definitie hetzelfde als de "Alles"-periode, maar met een
    // eigen label voor de totaalrij onderaan de tabel.
    const total: UsageBucket = { ...all, label: 'Totaal' };

    return { periods: [today, week, month, all], perFeature, total, anonymousCalls };
}
