import React, { useState } from 'react';
import PublicStatsModal from './PublicStatsModal';

interface PublicStatsButtonProps {
    /** De emoji die in de tekst staat en stiekem de teller opent. */
    emoji: string;
    className?: string;
}

/**
 * Verborgen trigger voor "De grote taalteller": een emoji in een kop die er
 * uitziet als gewone tekst, maar bij hover licht opveert en bij een klik de
 * teller opent. Beheert zelf zijn open/dicht-status, dus overal te plaatsen —
 * ook op pagina's waar niemand ingelogd is.
 */
const PublicStatsButton: React.FC<PublicStatsButtonProps> = ({ emoji, className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => setIsOpen(true)}
                title="Psst… de grote taalteller"
                aria-label="Open de grote taalteller"
                className={`inline-block align-baseline bg-transparent border-0 p-0 m-0 leading-none cursor-pointer select-none transition-transform duration-200 hover:scale-125 hover:-rotate-12 focus-visible:scale-125 focus:outline-none ${className}`}
            >
                <span aria-hidden="true">{emoji}</span>
            </button>
            <PublicStatsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </>
    );
};

export default PublicStatsButton;
