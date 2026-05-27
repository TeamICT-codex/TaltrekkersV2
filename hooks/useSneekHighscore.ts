import { useEffect, useState } from 'react';

const HIGHSCORE_KEY = 'taltrekkers_sneek_highscore';

/** Lees de huidige highscore. Returnt 0 als nog niet gezet of bij localStorage-fout. */
export function getSneekHighscore(): number {
    try {
        const raw = localStorage.getItem(HIGHSCORE_KEY);
        const num = raw ? parseInt(raw, 10) : 0;
        return Number.isFinite(num) ? num : 0;
    } catch {
        return 0;
    }
}

/**
 * Update de highscore als de meegegeven score hoger is.
 * Returnt true als er een nieuw record is gezet, anders false.
 */
export function setSneekHighscore(score: number): boolean {
    if (!Number.isFinite(score) || score <= 0) return false;
    const current = getSneekHighscore();
    if (score <= current) return false;
    try {
        localStorage.setItem(HIGHSCORE_KEY, String(score));
        window.dispatchEvent(new CustomEvent('taltrekkers-sneek-highscore', { detail: score }));
        return true;
    } catch {
        return false;
    }
}

/** Hook die de actuele highscore reactief leest. Updatet bij setSneekHighscore. */
export function useSneekHighscore(): number {
    const [score, setScore] = useState<number>(() => getSneekHighscore());

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<number>).detail;
            if (typeof detail === 'number') setScore(detail);
            else setScore(getSneekHighscore());
        };
        window.addEventListener('taltrekkers-sneek-highscore', handler);
        // Ook luisteren naar storage-events (andere tab/window)
        window.addEventListener('storage', handler);
        return () => {
            window.removeEventListener('taltrekkers-sneek-highscore', handler);
            window.removeEventListener('storage', handler);
        };
    }, []);

    return score;
}
