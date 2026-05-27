import { WordLevel } from '../types';

/**
 * Metadata over de woordenlijsten (zonder de woorden zelf in de main bundle te trekken).
 * Dit wordt gebruikt voor snelle UI-checks (bv. voortgangsberekening).
 */
export const WORD_LISTS_METADATA: Record<string, { length: number; label: string }> = {
    [WordLevel.Woordenschat2DF]: { length: 159, label: 'Woordenschat 2e graad DF' },
    [WordLevel.Woordenschat2AF]: { length: 113, label: 'Woordenschat 2e graad AF' },
    [WordLevel.AcademischNederlands]: { length: 136, label: 'Academisch Nederlands' },
    [WordLevel.ProfessioneelNederlands]: { length: 102, label: 'Professioneel Nederlands' },
};

/**
 * Laadt een woordenlijst dynamisch in (on-demand).
 * Dit zorgt ervoor dat de initiële download van de app klein blijft.
 */
export async function loadWordList(level: string): Promise<string[]> {
    switch (level) {
        case WordLevel.Woordenschat2DF:
            return (await import('./lists/woordenschat2df')).default;
        case WordLevel.Woordenschat2AF:
            return (await import('./lists/woordenschat2af')).default;
        case WordLevel.AcademischNederlands:
            return (await import('./lists/academisch_nederlands')).default;
        case WordLevel.ProfessioneelNederlands:
            return (await import('./lists/professioneel_nederlands')).default;
        default:
            return [];
    }
}

export const LEVEL_DIFFICULTY_MAP: Record<string, WordLevel.Beginner | WordLevel.Intermediate | WordLevel.Advanced> = {
    [WordLevel.Beginner]: WordLevel.Beginner,
    [WordLevel.Intermediate]: WordLevel.Intermediate,
    [WordLevel.Advanced]: WordLevel.Advanced,
    [WordLevel.Woordenschat2DF]: WordLevel.Intermediate,
    [WordLevel.Woordenschat2AF]: WordLevel.Beginner,
    [WordLevel.AcademischNederlands]: WordLevel.Advanced,
    [WordLevel.ProfessioneelNederlands]: WordLevel.Intermediate,
};
