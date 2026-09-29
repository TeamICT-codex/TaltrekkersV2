import React, { useState } from 'react';
import NieuwsModal from './NieuwsModal';
import { LAATSTE_NIEUWS_DATUM } from '../data/nieuws';

/** Datum (JJJJ-MM-DD) van het nieuwste blok dat deze gebruiker al zag. */
const GEZIEN_SLEUTEL = 'taltrekkers_nieuws_gezien';

function leesGezien(): string {
    try {
        return localStorage.getItem(GEZIEN_SLEUTEL) ?? '';
    } catch {
        return '';
    }
}

/**
 * Subtiele knop "Wat is er nieuw?" in de voettekst. Zolang de gebruiker het
 * nieuwste blok nog niet bekeek, staat er een gouden stipje bij. Beheert zelf
 * zijn open/dicht-status, dus overal te plaatsen.
 */
const NieuwsButton: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [gezien, setGezien] = useState<string>(leesGezien);
    const heeftNieuws = LAATSTE_NIEUWS_DATUM !== '' && gezien < LAATSTE_NIEUWS_DATUM;

    const openen = () => {
        setIsOpen(true);
        setGezien(LAATSTE_NIEUWS_DATUM);
        try {
            localStorage.setItem(GEZIEN_SLEUTEL, LAATSTE_NIEUWS_DATUM);
        } catch {
            // Zonder opslag (privévenster) komt het stipje de volgende keer gewoon terug.
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={openen}
                className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-themed bg-surface text-muted text-xs opacity-80 hover:opacity-100 hover:-translate-y-0.5 transition"
            >
                <span aria-hidden="true">🗞️</span>
                Wat is er nieuw?
                {heeftNieuws && (
                    <>
                        <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-tal-gold" />
                        <span className="sr-only">(er is iets nieuws)</span>
                    </>
                )}
            </button>
            <NieuwsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </>
    );
};

export default NieuwsButton;
