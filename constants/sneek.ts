// Spelregels van Sneek — de ENIGE plek waar drempels en limieten staan.
// Teksten in de app (knoppen, samenvatting, game-instellingen, het spel zelf)
// worden hieruit opgebouwd, zodat ze nooit meer uit elkaar lopen.

export const SNEEK_RULES = {
    /** Gewone oefensessie. */
    standaard: { minAccuracy: 0.75, minQuestions: 10 },
    /** "Oefen je zwakke woorden": kortere lijsten, moeilijkere woorden. */
    zwakkeWoorden: { minAccuracy: 0.65, minQuestions: 5 },
    /** Meer tokens sparen kan niet (bestaande hogere saldo's blijven staan). */
    maxTokens: 5,
    /** Eén token = één tuinbezoek. */
    rounds: 3,
    visitSeconds: 300,
} as const;

export type SneekBest = { rustig: number; uitdaging: number };

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Levert deze sessie een token op? (zonder rekening te houden met de spaarlimiet) */
export function sneekTokenEarned(correct: number, total: number, isWeakWords: boolean): boolean {
    const rule = isWeakWords ? SNEEK_RULES.zwakkeWoorden : SNEEK_RULES.standaard;
    return total >= rule.minQuestions && total > 0 && correct / total >= rule.minAccuracy;
}

/** Korte regel voor knoppen en tooltips. */
export function sneekShortHint(): string {
    const r = SNEEK_RULES.standaard;
    return `${pct(r.minAccuracy)} juist in een sessie van min. ${r.minQuestions} vragen`;
}

/** Volledige zin: "Verdien een nieuw Sneek-token met …". */
export function sneekEarnHint(): string {
    const r = SNEEK_RULES.standaard;
    const z = SNEEK_RULES.zwakkeWoorden;
    return `Verdien een nieuw Sneek-token met ${pct(r.minAccuracy)} juist in een oefensessie van minstens ${r.minQuestions} vragen `
        + `(zwakke woorden: ${pct(z.minAccuracy)}, minstens ${z.minQuestions} vragen).`;
}

/**
 * Hoe ver zat de leerling van een token? Voor de "bijna"-boodschap in de samenvatting.
 * missingCorrect: hoeveel antwoorden méér juist hadden moeten zijn (bij dezelfde lengte).
 */
export function sneekProgress(correct: number, total: number, isWeakWords: boolean): {
    earned: boolean;
    tooShort: boolean;
    minQuestions: number;
    missingCorrect: number;
} {
    const rule = isWeakWords ? SNEEK_RULES.zwakkeWoorden : SNEEK_RULES.standaard;
    const earned = sneekTokenEarned(correct, total, isWeakWords);
    const tooShort = total < rule.minQuestions;
    const needed = Math.ceil(rule.minAccuracy * total - 1e-9);
    return { earned, tooShort, minQuestions: rule.minQuestions, missingCorrect: Math.max(0, needed - correct) };
}

/** Standaardtekst voor de game-instellingen (admin). */
export function sneekDefaultAdminText(): string {
    return `Een korte, rustige pauze na goed werk. Bouw de woorden van je les, letter voor letter. ${sneekEarnHint()}`;
}
