import React, { useEffect, useMemo } from 'react';

interface TokenEarnedCelebrationProps {
    show: boolean;
    onDismiss: () => void;
    /**
     * Aanleiding van de viering — bepaalt welke tekst getoond wordt.
     *   - 'session': leerling verdiende de token door een sterke sessie (default)
     *   - 'welcome': leerling logt voor het eerst in en krijgt een welkomstbonus
     * Het visuele effect (confetti, glow, kaart) blijft identiek; alleen de
     * heading en body-tekst verschillen.
     */
    reason?: 'session' | 'welcome';
}

const CONFETTI_COLORS = ['#10b981', '#fbbf24', '#f97316', '#f43f5e', '#a855f7', '#22d3ee'];

/**
 * Vol-scherm celebratie bij het verdienen van een Sneek-token.
 * Auto-dismiss na 4.5 sec — leerling kan ook klikken om eerder weg te gaan.
 * Gebruikt CSS-keyframes inline want Tailwind CDN heeft geen aangepaste animaties.
 */
const TokenEarnedCelebration: React.FC<TokenEarnedCelebrationProps> = ({ show, onDismiss, reason = 'session' }) => {
    useEffect(() => {
        if (!show) return;
        const t = setTimeout(onDismiss, 4500);
        return () => clearTimeout(t);
    }, [show, onDismiss]);

    // Random posities + delays per confetti-stuk — useMemo zodat re-render niet
    // alle particles herstart.
    const confetti = useMemo(
        () =>
            Array.from({ length: 48 }).map((_, i) => ({
                left: Math.random() * 100,
                delay: Math.random() * 0.6,
                duration: 2.2 + Math.random() * 1.8,
                color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                size: 6 + Math.random() * 8,
                rotation: Math.random() * 360,
                drift: (Math.random() - 0.5) * 40,
            })),
        [],
    );

    if (!show) return null;

    return (
        <>
            {/* Keyframes — eenmalig in DOM-tree gerenderd */}
            <style>{`
                @keyframes confetti-fall {
                    0% { transform: translate3d(0,-20vh,0) rotate(0deg); opacity: 1; }
                    100% { transform: translate3d(var(--drift, 0), 110vh, 0) rotate(720deg); opacity: 0.85; }
                }
                @keyframes token-pop {
                    0% { transform: scale(0.3) rotate(-12deg); opacity: 0; }
                    55% { transform: scale(1.15) rotate(4deg); opacity: 1; }
                    100% { transform: scale(1) rotate(0deg); opacity: 1; }
                }
                @keyframes token-glow {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.55), 0 0 0 0 rgba(16,185,129,0.40); }
                    50% { box-shadow: 0 0 0 28px rgba(16,185,129,0), 0 0 0 64px rgba(16,185,129,0); }
                }
            `}</style>
            <button
                type="button"
                onClick={onDismiss}
                aria-label="Sluit celebration"
                className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer overflow-hidden"
                style={{
                    // Veel opaquer dan vroeger — op een wit SessionSummary scherm was 65/75%
                    // niet donker genoeg, waardoor de witte tekst onleesbaar werd.
                    background: 'radial-gradient(circle at 50% 40%, rgba(4,47,46,0.94) 0%, rgba(2,6,23,0.97) 70%)',
                    backdropFilter: 'blur(8px)',
                }}
            >
                {/* Confetti regen */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {confetti.map((c, i) => (
                        <span
                            key={i}
                            className="absolute block rounded-sm"
                            style={{
                                left: `${c.left}%`,
                                top: 0,
                                width: c.size,
                                height: c.size * 0.45,
                                background: c.color,
                                transform: `rotate(${c.rotation}deg)`,
                                animation: `confetti-fall ${c.duration}s linear ${c.delay}s forwards`,
                                ['--drift' as never]: `${c.drift}vw`,
                            } as React.CSSProperties}
                        />
                    ))}
                </div>

                {/* Centrale boodschap — in een eigen kaart-paneel zodat tekst altijd
                    leesbaar is ongeacht wat eronder ligt. */}
                <div
                    className="relative text-center px-8 py-10 mx-4 pointer-events-none rounded-3xl border border-emerald-400/30 max-w-lg"
                    style={{
                        animation: 'token-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                        background: 'linear-gradient(135deg, rgba(6,78,59,0.85) 0%, rgba(2,44,34,0.9) 100%)',
                        boxShadow: '0 30px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
                    }}
                >
                    <div
                        className="inline-flex items-center justify-center w-28 h-28 rounded-full text-7xl mb-5 select-none"
                        style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            animation: 'token-glow 1.6s ease-in-out infinite',
                            boxShadow: '0 20px 60px rgba(16,185,129,0.35)',
                        }}
                    >
                        🐍
                    </div>
                    <h2
                        className="text-4xl md:text-5xl font-extrabold text-white mb-3"
                        style={{ textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}
                    >
                        {reason === 'welcome'
                            ? 'Welkom! 🎉'
                            : 'Sneek-token verdiend!'
                        }
                    </h2>
                    <p
                        className="text-white text-lg max-w-md mx-auto font-medium"
                        style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}
                    >
                        {reason === 'welcome' ? (
                            <>
                                Leuk dat je TALent voor Taal komt ontdekken!
                                Je krijgt <span className="font-bold">1 Sneek-token</span> cadeau —
                                klik op de <span className="font-bold">🐍 chip</span> bovenaan om de mini-game uit te proberen.
                            </>
                        ) : (
                            <>
                                Sterke sessie! Klik op de <span className="font-bold">🐍 chip</span> in de header
                                om je beloning op te eten.
                            </>
                        )}
                    </p>
                    <p
                        className="text-emerald-100 text-xs mt-6 font-medium"
                        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                    >
                        Klik ergens om te sluiten
                    </p>
                </div>
            </button>
        </>
    );
};

export default TokenEarnedCelebration;
