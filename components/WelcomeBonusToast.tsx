import React, { useEffect } from 'react';

interface WelcomeBonusToastProps {
    show: boolean;
    onDismiss: () => void;
}

/**
 * Korte celebratie-toast die verschijnt nadat de leerling bij eerste login
 * automatisch 1 Sneek-token cadeau krijgt. Auto-dismiss na 8 sec of bij klik.
 */
const WelcomeBonusToast: React.FC<WelcomeBonusToastProps> = ({ show, onDismiss }) => {
    useEffect(() => {
        if (!show) return;
        const t = setTimeout(onDismiss, 8000);
        return () => clearTimeout(t);
    }, [show, onDismiss]);

    if (!show) return null;

    return (
        <div
            role="status"
            className="fixed bottom-6 right-6 z-50 max-w-sm animate-fade-in"
        >
            <div
                className="rounded-2xl shadow-2xl border-2 border-emerald-400/50 p-4 text-white"
                style={{ background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)' }}
            >
                <div className="flex items-start gap-3">
                    <div className="text-3xl select-none flex-shrink-0">🎉</div>
                    <div className="flex-1 min-w-0">
                        <div className="font-extrabold text-base mb-1">Welkom-cadeau!</div>
                        <p className="text-sm text-emerald-100 leading-snug">
                            Je krijgt <strong>1 gratis 🐍 Sneek-token</strong> om de game te ontdekken.
                            Klik op de <span className="font-bold">🐍 chip</span> in de header om te spelen.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onDismiss}
                        aria-label="Sluiten"
                        className="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-sm transition flex-shrink-0"
                    >
                        ✕
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WelcomeBonusToast;
