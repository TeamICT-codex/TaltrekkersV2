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

/**
 * Eén opgetelde groep uit de database: per periode + model, of per functie + model.
 * De prijsberekening gebeurt hier in de app (zie PRICING_USD_PER_1M), niet in SQL,
 * zodat de tarieven maar op één plaats onderhouden moeten worden.
 */
export interface UsageGroup {
    periode?: string;
    feature?: string;
    model: string;
    calls: number;
    input_tokens: number;
    /** Output + denk-tokens samen (zo factureert Google het ook). */
    output_tokens: number;
    failed: number;
}

/** Alles wat get_ai_usage_stats() teruggeeft. */
export interface AiUsageStats {
    days: number;
    total_rows: number;
    anonymous_calls: number;
    first_logged_at: string | null;
    periods: UsageGroup[];
    features: UsageGroup[];
}

/** Volgorde + Nederlandse naam van de vier periode-kaarten. */
const PERIOD_LABELS: { key: string; label: string }[] = [
    { key: 'vandaag', label: 'Vandaag' },
    { key: 'week', label: 'Deze week' },
    { key: 'maand', label: 'Deze maand' },
    { key: 'alles', label: 'Alles' },
];

function toGroup(raw: Record<string, unknown>): UsageGroup {
    const num = (v: unknown) => {
        const n = Number(v ?? 0);
        return Number.isFinite(n) ? n : 0;
    };
    return {
        periode: typeof raw.periode === 'string' ? raw.periode : undefined,
        feature: typeof raw.feature === 'string' ? raw.feature : undefined,
        model: typeof raw.model === 'string' ? raw.model : 'onbekend',
        calls: num(raw.calls),
        input_tokens: num(raw.input_tokens),
        output_tokens: num(raw.output_tokens),
        failed: num(raw.failed),
    };
}

/**
 * Haalt de opgetelde cijfers op via de RPC `get_ai_usage_stats`.
 *
 * Bewust NIET meer alle logregels ophalen en in de browser optellen: Supabase
 * levert maximaal ~1.000 rijen per opvraging, waardoor het paneel op
 * 2026-09-18 slechts 1.000 van de 10.747 regels zag en de kosten ongeveer tien
 * keer te laag toonde. Eén JSON-object is nooit afgekapt.
 *
 * Gooit nooit: fouten komen terug als tekst, en een ontbrekende functie
 * (migratie nog niet gedraaid) krijgt een eigen vlag.
 */
export async function fetchAiUsageStats(
    days = 90
): Promise<{ stats: AiUsageStats | null; error: string | null; missingTable: boolean }> {
    try {
        const { data, error } = await supabase.rpc('get_ai_usage_stats', { p_days: days });

        if (error) {
            // PGRST202 = functie onbekend, PGRST205 / 42P01 = tabel onbekend.
            // Alle drie betekenen: migratie nog niet uitgevoerd.
            const code = (error as { code?: string }).code ?? '';
            const message = error.message ?? '';
            const missingTable =
                code === 'PGRST202' ||
                code === 'PGRST205' ||
                code === '42P01' ||
                /does not exist/i.test(message) ||
                /could not find the (table|function)/i.test(message);

            return { stats: null, error: missingTable ? null : message || 'Onbekende fout', missingTable };
        }

        if (!data || typeof data !== 'object') {
            return { stats: null, error: 'De database gaf geen cijfers terug.', missingTable: false };
        }

        const raw = data as Record<string, unknown>;
        const lijst = (v: unknown): UsageGroup[] =>
            Array.isArray(v) ? v.map(r => toGroup(r as Record<string, unknown>)) : [];

        return {
            stats: {
                days: Number(raw.days ?? days),
                total_rows: Number(raw.total_rows ?? 0),
                anonymous_calls: Number(raw.anonymous_calls ?? 0),
                first_logged_at: typeof raw.first_logged_at === 'string' ? raw.first_logged_at : null,
                periods: lijst(raw.periods),
                features: lijst(raw.features),
            },
            error: null,
            missingTable: false,
        };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Onbekende fout';
        return { stats: null, error: message, missingTable: false };
    }
}

/**
 * Tarieven van Google, in US-dollar per 1 miljoen tokens.
 * Gecontroleerd op ai.google.dev/gemini-api/docs/pricing op 2026-09-08.
 * Enkel een schatting: de factuur van Google blijft de echte waarheid.
 *
 * LET OP — twee dingen om in het oog te houden:
 *  1. De app vraagt `gemini-flash-latest`, een rollende alias. Google verlegde
 *     die op 2026-09-02 naar gemini-3.8-flash, dat 2,5x duurder is qua input
 *     dan het oude 2.5 Flash. Daarom loggen we de ECHT gebruikte modelversie
 *     (zie geminiService.ts) en niet de aliasnaam.
 *  2. De introductieprijs van 3.8 Flash ($0.75/$3.75) loopt tot en met
 *     2026-12-31. Vanaf 2027-01-01 wordt dat $1.50/$7.50 — dan moeten deze
 *     cijfers hier verdubbeld worden.
 */
export const PRICING_USD_PER_1M: Record<string, { input: number; output: number }> = {
    // Nieuwste Flash — introductieprijs t.e.m. 2026-12-31, daarna 1.50 / 7.50
    'gemini-3.8-flash': { input: 0.75, output: 3.75 },
    'gemini-3.7-flash': { input: 0.75, output: 3.75 },
    // Alias-fallback voor het geval de modelversie niet meegegeven werd
    'gemini-flash-latest': { input: 0.75, output: 3.75 },
    // Vorige generatie, nog gelogd in oudere rijen
    'gemini-2.5-flash': { input: 0.30, output: 2.50 },
    // Spraak: output zijn audio-tokens (~25 per seconde geluid) — veruit het duurst
    'gemini-2.5-flash-preview-tts': { input: 0.50, output: 10.00 },
};

/**
 * Fallback voor een model dat we (nog) niet kennen. Bewust het tarief van het
 * nieuwste Flash-model: liever iets te hoog schatten dan de kosten verbergen.
 */
const DEFAULT_PRICING = PRICING_USD_PER_1M['gemini-3.8-flash'];

/**
 * Geschatte kost in US-dollar van een opgetelde groep.
 *
 * Denk-tokens zitten al mee in `output_tokens` (de database telt ze daar bij op),
 * omdat Google ze als output factureert. Mislukte calls hebben geen gekende
 * tokens en kosten hier dus niets.
 */
export function estimateCostUsd(group: Pick<UsageGroup, 'model' | 'input_tokens' | 'output_tokens'>): number {
    const pricing = PRICING_USD_PER_1M[group.model] ?? DEFAULT_PRICING;
    return (group.input_tokens / 1_000_000) * pricing.input
        + (group.output_tokens / 1_000_000) * pricing.output;
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
 * Zet de opgetelde groepen uit de database om in wat het paneel toont:
 * vier periode-kaarten, een tabel per functie en één totaalrij.
 *
 * Per groep wordt apart geprijsd, want spraak (TTS) heeft een heel ander
 * tarief dan tekst. Daarom telt de database per model apart op.
 */
export function buildUsageView(stats: AiUsageStats): {
    periods: UsageBucket[];
    perFeature: UsageBucket[];
    total: UsageBucket;
    anonymousCalls: number;
} {
    const voegToe = (bucket: UsageBucket, g: UsageGroup): UsageBucket => ({
        ...bucket,
        calls: bucket.calls + g.calls,
        inputTokens: bucket.inputTokens + g.input_tokens,
        outputTokens: bucket.outputTokens + g.output_tokens,
        failed: bucket.failed + g.failed,
        costUsd: bucket.costUsd + estimateCostUsd(g),
    });

    const periods = PERIOD_LABELS.map(({ key, label }) =>
        stats.periods
            .filter(g => g.periode === key)
            .reduce(voegToe, emptyBucket(label)),
    );

    const perFunctie = new Map<string, UsageBucket>();
    for (const g of stats.features) {
        const key = g.feature || 'onbekend';
        const bestaand = perFunctie.get(key) ?? emptyBucket(FEATURE_LABELS_NL[key] ?? key);
        perFunctie.set(key, voegToe(bestaand, g));
    }
    const perFeature = Array.from(perFunctie.values()).sort((a, b) => b.costUsd - a.costUsd);

    // Totaalrij = dezelfde cijfers als de "Alles"-periode, met een eigen label.
    const alles = periods[periods.length - 1] ?? emptyBucket('Totaal');
    const total: UsageBucket = { ...alles, label: 'Totaal' };

    return { periods, perFeature, total, anonymousCalls: stats.anonymous_calls };
}
