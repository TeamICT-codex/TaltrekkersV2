import React from 'react';
import { getSneekHighscore } from '../hooks/useSneekHighscore';

interface SneekIntroModalProps {
    isOpen: boolean;
    onStart: () => void;
    onClose: () => void;
}

const SNEEK_INTRO_KEY = 'taltrekkers_sneek_intro_seen';

export const hasSeenSneekIntro = (): boolean => {
    try {
        return localStorage.getItem(SNEEK_INTRO_KEY) === 'true';
    } catch {
        return false;
    }
};

export const markSneekIntroSeen = (): void => {
    try {
        localStorage.setItem(SNEEK_INTRO_KEY, 'true');
    } catch {
        /* ignore */
    }
};

/**
 * Eerste-keer welkomstmodal voor Sneek. Toont de besturing en motiveert
 * de leerling om te starten. Verdwijnt na "Start spel" + zet localStorage
 * flag zodat het maar één keer per device verschijnt.
 */
const SneekIntroModal: React.FC<SneekIntroModalProps> = ({ isOpen, onStart, onClose }) => {
    // Lees alleen wanneer modal opent — geen reactief abonnement nodig hier.
    const highscore = isOpen ? getSneekHighscore() : 0;
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div
                className="w-full max-w-md rounded-3xl shadow-2xl border-2 border-emerald-400/40 overflow-hidden text-white"
                style={{ background: 'linear-gradient(155deg, #064e3b 0%, #022c22 100%)' }}
            >
                {/* Hero */}
                <div
                    className="px-6 py-6 text-center border-b border-emerald-400/20 relative"
                    style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                >
                    <div className="text-6xl mb-2 select-none">🐍</div>
                    <h2 className="text-2xl font-extrabold drop-shadow-md">Welkom bij Sneek!</h2>
                    <p className="text-sm text-white/90 mt-1">
                        Een korte ontspanning als beloning voor je werk.
                    </p>
                    {highscore > 0 && (
                        <div className="absolute top-3 right-3 inline-flex items-center gap-1 bg-black/30 backdrop-blur px-2.5 py-1 rounded-full text-[11px] font-bold text-yellow-100 border border-yellow-400/30">
                            🏆 record {highscore}
                        </div>
                    )}
                </div>

                <div className="p-6 space-y-5">
                    {/* Besturing */}
                    <div>
                        <h3 className="font-bold text-xs uppercase tracking-wider text-emerald-300 mb-3">
                            Hoe werkt het?
                        </h3>
                        <ul className="space-y-2.5 text-sm">
                            <li className="flex items-center gap-3">
                                <span className="flex-shrink-0 inline-flex items-center gap-1 bg-emerald-500/20 border border-emerald-400/40 rounded-lg px-2.5 py-1 font-bold text-emerald-100 min-w-[90px] justify-center">
                                    ↑ of Z
                                </span>
                                <span>Start het spel</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <span className="flex-shrink-0 inline-flex items-center gap-0.5 bg-emerald-500/20 border border-emerald-400/40 rounded-lg px-2.5 py-1 font-bold text-emerald-100 min-w-[90px] justify-center text-base">
                                    ← ↑ ↓ →
                                </span>
                                <span>Stuur de slang</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <span className="flex-shrink-0 inline-flex items-center bg-emerald-500/20 border border-emerald-400/40 rounded-lg px-2.5 py-1 font-bold text-emerald-100 min-w-[90px] justify-center">
                                    Z Q S D
                                </span>
                                <span>Of stuur met letters</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <span className="flex-shrink-0 inline-flex items-center bg-emerald-500/20 border border-emerald-400/40 rounded-lg px-2.5 py-1 font-bold text-emerald-100 min-w-[90px] justify-center">
                                    Spatie
                                </span>
                                <span>Opnieuw na game over</span>
                            </li>
                        </ul>
                    </div>

                    {/* Doel */}
                    <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-xl p-3 text-sm leading-snug">
                        <strong className="text-emerald-200">Doel:</strong>{' '}
                        eet stippen om langer te worden. Vermijd jezelf. Hoe hoger je score, hoe trotser je mag zijn.
                    </div>

                    {/* Acties */}
                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 rounded-xl font-semibold bg-white/10 hover:bg-white/20 transition"
                        >
                            Later
                        </button>
                        <button
                            type="button"
                            onClick={() => { markSneekIntroSeen(); onStart(); }}
                            className="flex-[2] py-3 rounded-xl font-extrabold shadow-lg hover:scale-[1.02] active:scale-95 transition-transform text-white"
                            style={{ background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)', color: '#064e3b' }}
                        >
                            🚀 Start spel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SneekIntroModal;
