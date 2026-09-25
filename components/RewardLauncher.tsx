import React, { useState } from 'react';
import { useGameSettings } from '../hooks/useGameSettings';
import { openSneek, isSneekOpen, type SneekResult } from '../services/sneek/host';
import type { SneekLaunchData } from '../services/sneek/launchData';
import { SNEEK_RULES, sneekEarnHint, sneekShortHint } from '../constants/sneek';

interface RewardLauncherProps {
    snakeTokens: number;
    /** Compatibiliteit met bestaande aanroepers; Droak wordt niet meer getoond. */
    dragonTokens?: number;
    /** Token aftrekken. Wordt pas aangeroepen wanneer de leerling in het spel echt start. */
    onSpend: (mode: 'snake' | 'dragon') => void;
    /** Woorden, record en slang voor dit bezoek (zie services/sneek/launchData). */
    launch: SneekLaunchData;
    /** Resultaat van het bezoek (beste ronde) — om het record per leerling te bewaren. */
    onResult?: (result: SneekResult) => void;
    /** 'inline' = kaart (SessionSummary), 'compact' = chip (Header). */
    variant?: 'inline' | 'compact';
    /** Tijdelijk niet speelbaar (bv. midden in een oefening) — met uitleg. */
    disabledReason?: string;
}

/**
 * Opent Sneek — de woordentuin. Het token wordt NIET bij de klik afgetrokken,
 * maar pas wanneer de leerling in het spel op "Begin" drukt. Openen, rondkijken
 * en sluiten kost dus niets; een laadfout ook niet.
 */
// De vroegere standaardtekst noemde een verkeerde drempel (≥ 80%). Staat die nog
// ongewijzigd in de game-instellingen, dan tonen we hem niet in het spel.
const OUTDATED_DEFAULT_TEXT = 'Een korte ontspanning na goed werk! Je verdient een Sneek-token bij elke sessie waar je ≥ 80% goed scoort. Wissel het in voor een rondje slangetje vangen — even het hoofd leegmaken voor je verder oefent.';
const normalize = (t: string) => t.replace(/\s+/g, ' ').trim();

function adminTextForGame(text: string | null | undefined): string | undefined {
    if (!text || !normalize(text)) return undefined;
    return normalize(text) === OUTDATED_DEFAULT_TEXT ? undefined : text;
}

const RewardLauncher: React.FC<RewardLauncherProps> = ({
    snakeTokens,
    onSpend,
    launch,
    onResult,
    variant = 'inline',
    disabledReason,
}) => {
    const gameSettings = useGameSettings();
    const [opening, setOpening] = useState(false);

    const canPlay = snakeTokens > 0 && !disabledReason;

    const open = () => {
        if (!canPlay || isSneekOpen()) return;
        setOpening(true);
        openSneek({
            launch,
            theme: gameSettings?.snake_theme ?? 'aurora',
            text: adminTextForGame(gameSettings?.snake_text),
            earnHint: sneekEarnHint(),
            rounds: SNEEK_RULES.rounds,
            visitSeconds: SNEEK_RULES.visitSeconds,
            onStarted: () => onSpend('snake'),
            onComplete: result => onResult?.(result),
            onClose: () => setOpening(false),
        });
    };

    const tokenLabel = `${snakeTokens} ${snakeTokens === 1 ? 'token' : 'tokens'}`;
    const title = disabledReason
        ? disabledReason
        : snakeTokens > 0
            ? `Speel Sneek, de woordentuin — je hebt ${tokenLabel}`
            : `Nog geen Sneek-token — verdien er één met ${sneekShortHint()}`;

    if (variant === 'compact') {
        return (
            <button
                type="button"
                onClick={open}
                disabled={!canPlay || opening}
                title={title}
                aria-label={title}
                style={canPlay ? { background: 'linear-gradient(135deg, #2D7A7B 0%, #1f5f60 100%)' } : undefined}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-teal-300/40 text-white text-xs font-extrabold shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-500/30 enabled:hover:scale-105 enabled:active:scale-95 transition-transform"
            >
                <span className="text-sm" aria-hidden="true">🐍</span>
                <span>{snakeTokens}</span>
            </button>
        );
    }

    const wordCount = launch.words.length;
    const hardCount = launch.words.filter(w => w.priority).length;
    const minutes = Math.round(SNEEK_RULES.visitSeconds / 60);

    return (
        <button
            type="button"
            onClick={open}
            disabled={!canPlay || opening}
            className="group relative overflow-hidden rounded-2xl p-5 w-full text-left border transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed enabled:hover:-translate-y-0.5 enabled:hover:shadow-xl shadow-md"
            style={{ background: '#eee7da', borderColor: 'rgba(33,29,26,0.18)', color: '#211d1a' }}
        >
            <div className="flex items-start gap-4">
                <div
                    className="flex-shrink-0 w-14 h-14 rounded-full grid place-items-center text-3xl"
                    style={{ background: '#2D7A7B', boxShadow: 'inset 0 0 0 3px rgba(255,255,255,0.25)' }}
                    aria-hidden="true"
                >
                    🐍
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-2xl font-bold leading-tight" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: 'italic' }}>
                        Sneek — de woordentuin
                    </div>
                    <p className="text-sm mt-1 leading-snug" style={{ color: '#4c443b' }}>
                        {wordCount > 0
                            ? `Bouw de ${wordCount} woorden van deze les, letter voor letter${hardCount > 0 ? ` — de ${hardCount} moeilijke eerst` : ''}.`
                            : 'Bouw schoolwoorden, letter voor letter.'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-3 text-xs font-semibold">
                        <span className="px-3 py-1 rounded-full text-white" style={{ background: canPlay ? '#2D7A7B' : '#6b6156' }}>
                            {disabledReason ? disabledReason : snakeTokens > 0 ? `${tokenLabel} klaar` : 'Nog geen token'}
                        </span>
                        <span className="px-3 py-1 rounded-full" style={{ background: 'rgba(255,253,248,0.7)', border: '1px solid rgba(33,29,26,0.16)' }}>
                            {SNEEK_RULES.rounds} rondes · {minutes} min
                        </span>
                        {launch.goldSnake && (
                            <span className="px-3 py-1 rounded-full" style={{ background: '#fbf3dc', border: '1px solid rgba(180,139,59,0.5)' }}>
                                ✨ gouden slang
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </button>
    );
};

export default RewardLauncher;
