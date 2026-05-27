import React, { useEffect, useMemo } from 'react';

interface TokenEarnedCelebrationProps {
    show: boolean;
    onDismiss: () => void;
}

const CONFETTI_COLORS = ['#10b981', '#fbbf24', '#f97316', '#f43f5e', '#a855f7', '#22d3ee'];

/**
 * Vol-scherm celebratie bij het verdienen van een Sneek-token.
 * Auto-dismiss na 4.5 sec — leerling kan ook klikken om eerder weg te gaan.
 * Gebruikt CSS-keyframes inline want Tailwind CDN heeft geen aangepaste animaties.
 */
const TokenEarnedCelebration: React.FC<TokenEarnedCelebrationProps> = ({ show, onDismiss }) => {
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
                    background: 'radial-gradient(circle at 50% 40%, rgba(6,78,59,0.65) 0%, rgba(0,0,0,0.75) 70%)',
                    backdropFilter: 'blur(4px)',
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

                {/* Centrale boodschap */}
                <div
                    className="relative text-center px-8 pointer-events-none"
                    style={{ animation: 'token-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
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
                    <h2 className="text-4xl md:text-5xl font-extrabold text-white drop-shadow-lg mb-2">
                        Sneek-token verdiend!
                    </h2>
                    <p className="text-emerald-100 text-lg max-w-md mx-auto drop-shadow-md">
                        Sterke sessie! Klik op de <span className="font-bold">🐍 chip</span> in de header
                        om je beloning op te eten.
                    </p>
                    <p className="text-emerald-200/80 text-xs mt-6">Klik ergens om te sluiten</p>
                </div>
            </button>
        </>
    );
};

export default TokenEarnedCelebration;
