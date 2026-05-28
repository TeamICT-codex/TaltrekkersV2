import React, { useState } from 'react';
import { createRewardOverlay } from '../services/reward/embed';
import { useGameSettings } from '../hooks/useGameSettings';
import SneekIntroModal, { hasSeenSneekIntro } from './SneekIntroModal';
import { setSneekHighscore } from '../hooks/useSneekHighscore';

interface RewardLauncherProps {
    snakeTokens: number;
    dragonTokens: number;
    /** Callback wanneer een token wordt ingewisseld voor een spel (UI-state moet bijgewerkt). */
    onSpend: (mode: 'snake' | 'dragon') => void;
    /** Optioneel: callback wanneer de speler het spel afrondt — score komt mee. */
    onComplete?: (mode: 'snake' | 'dragon', score?: number) => void;
    /** 'inline' = grote kaarten (SessionSummary), 'compact' = kleine knoppen (Header). */
    variant?: 'inline' | 'compact';
}

// TALent voor Taal-stijl op de overlay-achtergrond — overschrijft het donkere zwart
// van de SDK zodat de transitie van app naar reward minder hard aanvoelt.
function applyTaltrekkersShellStyle(element: HTMLElement) {
    // Achtergrond met tal-purple tint (dezelfde HSL als app, maar transparant)
    element.style.background = 'radial-gradient(circle at 50% 30%, rgba(78, 50, 153, 0.85) 0%, rgba(15, 23, 42, 0.92) 100%)';
}

// MVP-keuze: enkel Sneek tonen. Droak blijft als concept aanwezig in DB en
// game-settings maar verdient pas een echte launch wanneer er een gameplay-loop
// rond gebouwd is (zie roadmap). dragonTokens-prop blijft voor API-stabiliteit.
const RewardLauncher: React.FC<RewardLauncherProps> = ({
    snakeTokens,
    // dragonTokens — bewust niet meer gerenderd; prop blijft compatibel
    onSpend,
    onComplete,
    variant = 'inline',
}) => {
    const gameSettings = useGameSettings();
    const [showIntro, setShowIntro] = useState(false);

    const openGame = (mode: 'snake' | 'dragon') => {
        const theme = mode === 'snake'
            ? (gameSettings?.snake_theme ?? 'aurora')
            : (gameSettings?.dragon_theme ?? 'ember');
        const text = mode === 'snake'
            ? gameSettings?.snake_text || undefined
            : gameSettings?.dragon_text || undefined;

        // Tijdslot: voorkomt dat 1 token leidt tot oneindig spelen via in-game
        // restart (spatie/enter na crash). Na MAX_SESSION_MS sluit de overlay
        // automatisch — speler moet een nieuwe token verdienen om verder te
        // spelen. 5 min = ruim genoeg voor één goede sessie maar grenst de
        // 'tokens als consumptie-artikel'-misbruik af.
        const MAX_SESSION_MS = 5 * 60 * 1000;
        let closed = false;
        let sessionTimer: number | undefined;
        let controllerRef: ReturnType<typeof createRewardOverlay> | null = null;

        const closeOverlay = (delayMs: number = 0) => {
            if (closed) return;
            closed = true;
            if (sessionTimer !== undefined) {
                window.clearTimeout(sessionTimer);
                sessionTimer = undefined;
            }
            window.setTimeout(() => controllerRef?.close(), delayMs);
        };

        controllerRef = createRewardOverlay({
            mode,
            theme,
            text,
            difficulty: 'easy',
            pageUrl: '/reward/reward.html',
            showPanel: false,
            showClose: true,
            hideNav: true,
            compactHud: true,
            autoStartSnake: false,
            onComplete: ({ score }) => {
                // Sla nieuwe highscore op (alleen Sneek heeft een score-tracking)
                if (mode === 'snake' && typeof score === 'number') {
                    setSneekHighscore(score);
                }
                onComplete?.(mode, score);
                // Sluit overlay na korte delay zodat speler de victory-animatie
                // nog ziet. Dwingt af dat een nieuwe token vereist is voor de
                // volgende game (geen "Play again" zonder kost).
                closeOverlay(2000);
            },
        });

        // Safety net: ook bij CRASH + in-game restart (spatie/enter) sluit de
        // overlay automatisch na 5 min. Anders zou speler met 1 token oneindig
        // kunnen blijven hangen.
        sessionTimer = window.setTimeout(() => closeOverlay(0), MAX_SESSION_MS);

        applyTaltrekkersShellStyle(controllerRef.element);
    };

    const launch = (mode: 'snake' | 'dragon') => {
        const tokens = mode === 'snake' ? snakeTokens : 0;
        if (tokens <= 0) return;

        // Eerste keer Sneek geopend? Toon intro met besturing-uitleg.
        // Token wordt PAS afgetrokken bij echte game-start (in handleIntroStart),
        // anders zou "Later" klikken het token verspillen.
        if (mode === 'snake' && !hasSeenSneekIntro()) {
            setShowIntro(true);
            return;
        }
        onSpend(mode);
        openGame(mode);
    };

    const handleIntroStart = () => {
        setShowIntro(false);
        onSpend('snake');
        openGame('snake');
    };

    const introModal = (
        <SneekIntroModal
            isOpen={showIntro}
            onStart={handleIntroStart}
            onClose={() => setShowIntro(false)}
        />
    );

    if (variant === 'compact') {
        return (
            <>
                <button
                    type="button"
                    onClick={() => launch('snake')}
                    disabled={snakeTokens <= 0}
                    title={
                        snakeTokens > 0
                            ? `Speel Sneek — je hebt ${snakeTokens} ${snakeTokens === 1 ? 'token' : 'tokens'}`
                            : 'Geen Sneek-tokens — verdien er één met een sessie van ≥ 90% (min. 10 vragen)'
                    }
                    style={
                        snakeTokens > 0
                            ? { background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }
                            : undefined
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-400/40 text-white text-xs font-extrabold shadow-md disabled:opacity-40 disabled:cursor-not-allowed disabled:bg-emerald-900/20 hover:scale-105 active:scale-95 transition-transform"
                >
                    <span className="text-sm">🐍</span>
                    <span>{snakeTokens}</span>
                </button>
                {introModal}
            </>
        );
    }

    // Inline variant — één centraal-uitnodigende Sneek-kaart (geen 2-kolom grid meer)
    // Vol-opaque gradient i.p.v. transparant: op witte SessionSummary scherm was de
    // tekst onleesbaar door doorprikkende achtergrond.
    return (
        <>
            <button
                type="button"
                onClick={() => launch('snake')}
                disabled={snakeTokens <= 0}
                className="group relative overflow-hidden rounded-2xl p-5 w-full border-2 border-emerald-500/40 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:scale-[1.01] enabled:hover:border-emerald-300 enabled:hover:shadow-xl enabled:hover:shadow-emerald-500/30 text-left shadow-md"
                style={{ background: 'linear-gradient(135deg, #065f46 0%, #047857 50%, #0f766e 100%)' }}
            >
                <div className="absolute -top-6 -right-6 text-[6rem] opacity-25 group-enabled:group-hover:opacity-45 group-enabled:group-hover:rotate-12 transition-all">🐍</div>
                <div className="relative z-10">
                    <div
                        className="text-2xl font-extrabold text-white mb-1"
                        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
                    >
                        🐍 Sneek
                    </div>
                    <p
                        className="text-sm text-emerald-50 mb-3 leading-snug font-medium"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}
                    >
                        Een korte ontspanning als beloning voor een sterke sessie.
                    </p>
                    <div className="inline-flex items-center gap-2 bg-emerald-950/60 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold text-white border border-emerald-300/30">
                        {snakeTokens > 0
                            ? `${snakeTokens} ${snakeTokens === 1 ? 'token klaar om te spelen' : 'tokens klaar om te spelen'}`
                            : 'Verdien een token: ≥ 90% in een sessie van min. 10 vragen'}
                    </div>
                </div>
            </button>
            {introModal}
        </>
    );
};

export default RewardLauncher;
