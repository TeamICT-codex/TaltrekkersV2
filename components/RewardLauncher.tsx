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

        const controller = createRewardOverlay({
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
            },
        });
        applyTaltrekkersShellStyle(controller.element);
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
    return (
        <>
            <button
                type="button"
                onClick={() => launch('snake')}
                disabled={snakeTokens <= 0}
                className="group relative overflow-hidden rounded-2xl p-5 w-full border border-emerald-400/30 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:scale-[1.01] enabled:hover:border-emerald-300 enabled:hover:shadow-xl enabled:hover:shadow-emerald-500/20 text-left"
                style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.25) 0%, rgba(13,148,136,0.30) 100%)' }}
            >
                <div className="absolute -top-6 -right-6 text-[6rem] opacity-20 group-enabled:group-hover:opacity-40 group-enabled:group-hover:rotate-12 transition-all">🐍</div>
                <div className="relative z-10">
                    <div className="text-2xl font-extrabold text-white mb-1">🐍 Sneek</div>
                    <p className="text-sm text-emerald-100 mb-3 leading-snug">
                        Een korte ontspanning als beloning voor een sterke sessie.
                    </p>
                    <div className="inline-flex items-center gap-2 bg-black/30 backdrop-blur px-3 py-1.5 rounded-full text-xs font-bold text-emerald-100">
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
