import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { NIEUWS, NieuwsSoort } from '../data/nieuws';

interface NieuwsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/** Label + kleur per soort wijziging, in de kleuren van de app. */
const SOORTEN: Record<NieuwsSoort, { label: string; className: string }> = {
    nieuw: { label: 'Nieuw', className: 'bg-tal-teal text-white' },
    verbeterd: { label: 'Verbeterd', className: 'bg-tal-purple text-white' },
    opgelost: { label: 'Opgelost', className: 'bg-tal-gold text-slate-900' },
};

/** '2026-09-29' → '29 september 2026', zonder tijdzone-verschuiving. */
const datumLabel = (iso: string): string => {
    const [jaar, maand, dag] = iso.split('-').map(Number);
    if (!jaar || !maand || !dag) return iso;
    return new Date(jaar, maand - 1, dag).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * "Wat is er nieuw?" — de recente wijzigingen, nieuwste bovenaan.
 *
 * Zelfde opbouw als De grote taalteller: teal kop met gouden label, witte
 * inhoud die meekleurt met het gekozen thema, paarse sluitknop. Via een portal
 * op <body>, omdat een ouder met een fade-in-transform anders het
 * referentiekader voor `position: fixed` wordt.
 */
const NieuwsModal: React.FC<NieuwsModalProps> = ({ isOpen, onClose }) => {
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    // Escape sluit het venster.
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    // Focus naar de sluitknop, zodat toetsenbordgebruikers meteen in het venster zitten.
    useEffect(() => {
        if (isOpen) closeButtonRef.current?.focus();
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="nieuws-titel"
                // text-primary: de <body> heeft een vaste donkere tekstkleur, en dit venster
                // hangt via de portal rechtstreeks onder <body>; zo volgt de tekst het thema.
                className="bg-surface text-primary w-full max-w-lg rounded-2xl shadow-2xl border border-themed overflow-hidden max-h-[92vh] flex flex-col"
            >
                {/* ── Teal kop, zoals de welkomstkaart ── */}
                <div className="bg-tal-teal text-white px-6 pt-5 pb-5 relative shrink-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-tal-gold">Wat is er nieuw?</p>
                    <h2 id="nieuws-titel" className="text-2xl font-bold mt-1 pr-10">
                        🗞️ Vers van de pers
                    </h2>
                    <p className="text-sm text-white/80 mt-1 pr-10">
                        Wat er veranderde in TALent voor Taal, en waarom. Vaak op vraag van leerkrachten en leerlingen.
                    </p>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={onClose}
                        aria-label="Sluiten"
                        className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition"
                    >
                        ✕
                    </button>
                </div>

                {/* ── Tijdlijn, nieuwste bovenaan ── */}
                <div className="px-5 py-5 overflow-y-auto">
                    <ol className="relative border-l-2 border-themed ml-2 space-y-6">
                        {NIEUWS.map((blok, index) => (
                            <li key={blok.datum + blok.titel} className="pl-5 relative">
                                <span
                                    aria-hidden="true"
                                    className={`absolute -left-[7px] top-1 w-3 h-3 rounded-full ${index === 0 ? 'bg-tal-purple' : 'bg-surface-alt border-2 border-themed'}`}
                                />
                                <time dateTime={blok.datum} className="block text-xs font-bold uppercase tracking-wider text-muted">
                                    {datumLabel(blok.datum)}
                                </time>
                                <h3 className="text-lg font-bold mt-0.5 mb-2">{blok.titel}</h3>
                                <ul className="space-y-2">
                                    {blok.items.map((item, i) => (
                                        <li key={i} className="text-sm leading-relaxed">
                                            <span className={`inline-block align-middle mr-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${SOORTEN[item.soort].className}`}>
                                                {SOORTEN[item.soort].label}
                                            </span>
                                            {item.uitDeKlas && (
                                                <span className="inline-block align-middle mr-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-themed text-muted">
                                                    🏫 uit de klas
                                                </span>
                                            )}
                                            {item.tekst}
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        ))}
                    </ol>
                </div>

                {/* ── Voet: waar je zelf iets kan melden + sluitknop ── */}
                <div className="px-5 pb-5 pt-3 border-t border-themed shrink-0 space-y-3">
                    <p className="text-xs text-muted leading-snug">
                        Iets gezien dat beter kan? Leerkrachten laten het weten via de knop Feedback bovenaan.
                        Leerlingen zeggen het tegen hun leerkracht.
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full py-3 bg-tal-purple text-white font-bold rounded-xl shadow-lg hover:bg-tal-purple-dark transition"
                    >
                        Sluiten
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default NieuwsModal;
