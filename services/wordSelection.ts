/**
 * Sluitende-cyclus woord-selectie voor TALent voor Taal.
 *
 * Garandeert dat een leerling een opgeladen woordenlijst SEQUENTIEEL doorloopt
 * zonder vroege herhaling. Pas wanneer alle woorden minstens 1× geoefend zijn,
 * kan een cyclus-eindsessie consolideren met foute woorden uit eerdere sessies.
 *
 * Concreet voorbeeld — 85 woorden, sessies van 20:
 *   Sessie 1: woord 1-20 (allemaal nieuw)
 *   Sessie 2: woord 21-40
 *   Sessie 3: woord 41-60
 *   Sessie 4: woord 61-80
 *   Sessie 5: woord 81-85 (5 nieuwe) + 15 woorden die in vorige sessies fout
 *             zaten — echte consolidatie. (cycleEnd=true)
 *
 * Vorige logica gebruikte random shuffle op de "ongeoefende" lijst, wat ervoor
 * zorgde dat woorden 21-40 in sessie 2 niet noodzakelijk LATER kwamen dan
 * woorden 1-20 — herhaling was mogelijk vóór de cyclus rond was.
 */

import type { PracticeSettings, SessionRecord } from '../types';

export interface SelectionResult {
    /** De gekozen woorden voor deze sessie. */
    words: string[];
    /** True als er <N ongeoefende woorden over waren → cyclus-eindsessie. */
    isCycleEnd: boolean;
    /** Aantal woorden in `words` dat tot de nieuwe (ongeoefende) groep behoort. */
    newCount: number;
    /** Aantal woorden in `words` dat consolidatie (foute woorden uit vorige sessies) is. */
    reviewIncorrectCount: number;
    /** Aantal woorden in `words` dat random aanvulling is uit andere geoefende woorden. */
    reviewRandomCount: number;
}

export interface SelectionInput {
    /** Volledige set woorden uit de lijst, in PDF/upload-volgorde. */
    allWords: string[];
    /** Woorden die al in een vorige sessie van DEZE lijst geoefend zijn (lowercase). */
    practicedWords?: string[];
    /** Woorden die in eerdere sessies van DEZE lijst FOUT beantwoord werden (lowercase). */
    incorrectWords?: string[];
    /** Gewenste sessie-grootte (bv. 20). */
    sessionSize: number;
}

/**
 * Selecteert woorden voor de volgende sessie met **sluitende dekking**:
 *
 *   1. Zolang er ≥ sessionSize ongeoefende woorden zijn → pak de EERSTE N
 *      in originele PDF-volgorde (deterministisch).
 *   2. Bij minder dan sessionSize ongeoefende woorden → consolidatie-sessie:
 *      alle ongeoefende + woorden die in eerdere sessies fout zaten + (als nodig)
 *      random aanvulling uit overige geoefende.
 *   3. Bij 0 ongeoefende woorden → behandeling als cyclus-eind: enkel consolidatie,
 *      caller kan ervoor kiezen om practicedWords te resetten voor een nieuwe cyclus.
 *
 * Belangrijke designkeuze: de **volgorde van de woorden in `words` blijft
 * deterministisch op selectie-niveau** (ongeoefend in PDF-volgorde, daarna
 * incorrect, daarna random). De UI/quiz kan deze nog shufflen voor presentatie
 * — dat heeft geen effect op welke woorden gekozen worden.
 */
export function selectWordsForSession({
    allWords,
    practicedWords = [],
    incorrectWords = [],
    sessionSize,
}: SelectionInput): SelectionResult {
    if (allWords.length === 0) {
        return { words: [], isCycleEnd: false, newCount: 0, reviewIncorrectCount: 0, reviewRandomCount: 0 };
    }

    // Dedup allWords (case-insensitive) terwijl eerste voorkomen behouden blijft.
    // PDF-extractie kan duplicaten geven (zelfde term op verschillende pagina's),
    // wat anders de cyclus-dekking zou breken: zelfde woord 2× in 1 sessie of in
    // opeenvolgende sessies.
    const seen = new Set<string>();
    const dedupedAllWords = allWords.filter(w => {
        const k = w.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });

    const practicedSet = new Set(practicedWords.map(w => w.toLowerCase()));
    const incorrectSet = new Set(incorrectWords.map(w => w.toLowerCase()));

    // Splits in ongeoefend en geoefend. Behoud PDF-volgorde — kritiek voor
    // deterministisch sequentieel doorlopen.
    const ongeoefend = dedupedAllWords.filter(w => !practicedSet.has(w.toLowerCase()));
    const geoefend = dedupedAllWords.filter(w => practicedSet.has(w.toLowerCase()));

    // CASE 1: voldoende ongeoefende woorden → eerste N in PDF-volgorde
    if (ongeoefend.length >= sessionSize) {
        return {
            words: ongeoefend.slice(0, sessionSize),
            isCycleEnd: false,
            newCount: sessionSize,
            reviewIncorrectCount: 0,
            reviewRandomCount: 0,
        };
    }

    // CASE 2 + 3: cyclus-eind. ENKEL nog-ongeoefende woorden + woorden die in
    // eerdere sessies fout zaten. We vullen NIET meer aan met reeds-juiste
    // woorden — een leerling moet niet zinloos woorden herhalen die hij al kent.
    // Gevolg: de sessie mag korter zijn dan sessionSize (bv. 2 nieuw + 1 fout).
    // De sessionSize fungeert hier als bovengrens, niet als doel.
    const newWords = ongeoefend; // alle ongeoefende (in PDF-volgorde)
    const remainingCapacity = Math.max(0, sessionSize - newWords.length);

    // Woorden die ooit fout zaten in deze lijst — consolidatie. Beperk tot de
    // resterende capaciteit zodat de sessie niet groter wordt dan sessionSize.
    const incorrectToReview = geoefend
        .filter(w => incorrectSet.has(w.toLowerCase()))
        .slice(0, remainingCapacity);

    // Dedupe (defensief, met behoud van volgorde: nieuw eerst, dan fout).
    const seenSel = new Set<string>();
    const words = [...newWords, ...incorrectToReview].filter(w => {
        const k = w.toLowerCase();
        if (seenSel.has(k)) return false;
        seenSel.add(k);
        return true;
    });

    return {
        words,
        isCycleEnd: true,
        newCount: newWords.length,
        reviewIncorrectCount: words.length - newWords.length,
        reviewRandomCount: 0,
    };
}

/**
 * Verzamelt woorden die in eerdere sessies van een specifieke lijst fout
 * beantwoord werden. Wordt gebruikt voor consolidatie-sessies aan het einde
 * van een cyclus.
 *
 * @param sessions  Alle SessionRecords van de leerling.
 * @param listId    Identifier van de woordenlijst (customFileName, of context).
 *                  Wordt gematcht tegen `session.settings.customFileName`.
 * @returns Unieke lijst van woorden (lowercase) die ooit fout waren in deze lijst.
 */
export function getIncorrectWordsForList(
    sessions: SessionRecord[] | undefined,
    listId: string,
): string[] {
    if (!sessions || sessions.length === 0) return [];

    const incorrect = new Set<string>();
    for (const session of sessions) {
        // Match op customFileName (primaire identifier voor opgeladen lijsten)
        // of context (algemene woordenlijsten zoals "Woordenschat2DF")
        const sessionListId = session.settings.customFileName || session.settings.context;
        if (sessionListId !== listId) continue;

        for (const result of session.quizResults) {
            if (!result.correct) incorrect.add(result.word.toLowerCase());
        }
    }
    return Array.from(incorrect);
}

/** Fisher-Yates shuffle, in-place. */
function shuffleInPlace<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Bouwt de PracticeSettings + geselecteerde woorden om een eerder opgeladen
 * woordenlijst te hervatten — gebruikt door BOTH "Mijn lijsten" tab in
 * PracticeSetup als de "Volgende sessie" knop in SessionSummary.
 *
 * Returnt null als er onvoldoende data is om de sessie te starten (lijst niet
 * gevonden, geen allWords, etc.).
 */
export interface ResumeListInput {
    listId: string;
    progress: { allWords: string[]; practicedWords: string[] } | undefined;
    sessions: SessionRecord[] | undefined;
    /** Override voor sessie-grootte; standaard de wordsPerSession van de laatste sessie van deze lijst (of 20). */
    sessionSizeOverride?: number;
}

export interface ResumeListResult {
    /** Geselecteerde woorden voor deze sessie (al geshuffeld voor presentatie). */
    words: string[];
    /** Settings van de laatste sessie van deze lijst — pas .wordsPerSession aan voor de nieuwe sessie. */
    lastSettings: PracticeSettings | null;
    /** True als alle woorden al ≥1× geoefend zijn — consolidatie-sessie. */
    isFullyPracticed: boolean;
}

export function prepareResumeList({
    listId,
    progress,
    sessions,
    sessionSizeOverride,
}: ResumeListInput): ResumeListResult | null {
    if (!progress || progress.allWords.length === 0) return null;

    // Vind de meest recente sessie van deze lijst om settings over te nemen
    const sessionsForList = (sessions ?? [])
        .filter(s => (s.settings.customFileName || s.settings.context) === listId)
        .sort((a, b) => b.date.localeCompare(a.date));
    const lastSettings: PracticeSettings | null = sessionsForList[0]?.settings ?? null;

    const sessionSize = sessionSizeOverride ?? lastSettings?.wordsPerSession ?? 20;

    const incorrectWords = getIncorrectWordsForList(sessions, listId);
    const selection = selectWordsForSession({
        allWords: progress.allWords,
        practicedWords: progress.practicedWords,
        incorrectWords,
        sessionSize,
    });

    // Shuffle ENKEL voor presentatie — helper-selectie was deterministisch.
    const presented = shuffleInPlace([...selection.words]);

    return {
        words: presented,
        lastSettings,
        isFullyPracticed: progress.practicedWords.length >= progress.allWords.length,
    };
}
