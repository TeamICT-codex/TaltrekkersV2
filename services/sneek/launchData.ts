// Welke woorden, record en slang krijgt Sneek mee? Pure functie — makkelijk te testen.
//
// Na een sessie: de woorden van die sessie, de fout beantwoorde eerst.
// Via de chip bovenaan (geen sessie open): de woorden van de laatste sessie(s).
// Uitleg bij elk woord komt uit learnedWords (de Frayer-definitie die de app al bewaart).

import type { QuizResult, SessionSummaryData, UserData } from '../../types';
import type { SneekBest } from '../../constants/sneek';

export interface SneekWord {
    word: string;
    definition?: string;
    priority?: boolean;
}

export interface SneekLaunchData {
    words: SneekWord[];
    goldSnake: boolean;
    best: SneekBest;
}

const MAX_WORDS = 40;
const MIN_WORDS_FROM_HISTORY = 8;

function definitionFor(userData: UserData | undefined, word: string): string | undefined {
    const info = userData?.learnedWords?.[word.toLowerCase()];
    return info?.definitie || undefined;
}

function collect(
    userData: UserData | undefined,
    sources: { words: string[]; quizResults: QuizResult[] }[],
): SneekWord[] {
    const out: SneekWord[] = [];
    const seen = new Set<string>();
    const wrong = new Set<string>();
    for (const s of sources) for (const r of s.quizResults) if (!r.correct) wrong.add(r.word.toLowerCase());
    const push = (w: string) => {
        const word = (w || '').trim();
        const key = word.toLowerCase();
        if (!word || seen.has(key) || out.length >= MAX_WORDS) return;
        seen.add(key);
        out.push({ word, definition: definitionFor(userData, word), priority: wrong.has(key) });
    };
    for (const s of sources) {
        // Eerst de fout beantwoorde woorden van deze bron, dan de rest.
        s.quizResults.filter(r => !r.correct).forEach(r => push(r.word));
        s.words.forEach(push);
        s.quizResults.forEach(r => push(r.word));
    }
    return out;
}

function isPerfect(quizResults: QuizResult[]): boolean {
    return quizResults.length > 0 && quizResults.every(r => r.correct);
}

export function buildSneekLaunchData(
    userData: UserData | undefined,
    summary?: SessionSummaryData | null,
): SneekLaunchData {
    const best: SneekBest = {
        rustig: Math.max(0, userData?.sneekBest?.rustig ?? 0),
        uitdaging: Math.max(0, userData?.sneekBest?.uitdaging ?? 0),
    };

    if (summary) {
        return {
            words: collect(userData, [{ words: summary.words ?? [], quizResults: summary.quizResults ?? [] }]),
            goldSnake: isPerfect(summary.quizResults ?? []),
            best,
        };
    }

    // Geen open sessie: nieuwste sessies eerst, tot we genoeg woorden hebben.
    const history = [...(userData?.sessionHistory ?? [])].sort((a, b) => (a.date < b.date ? 1 : -1));
    const sources: { words: string[]; quizResults: QuizResult[] }[] = [];
    let count = 0;
    for (const s of history) {
        sources.push({ words: s.words ?? [], quizResults: s.quizResults ?? [] });
        count += (s.words ?? []).length;
        if (count >= MIN_WORDS_FROM_HISTORY) break;
    }
    return {
        words: collect(userData, sources),
        goldSnake: history.length > 0 && isPerfect(history[0].quizResults ?? []),
        best,
    };
}
