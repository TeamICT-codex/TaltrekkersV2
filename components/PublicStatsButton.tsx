import React, { useState } from 'react';
import PublicStatsModal from './PublicStatsModal';

interface PublicStatsButtonProps {
    /** 'pill' = opvallende knop (welkomstscherm), 'link' = discreet in de voettekst. */
    variant?: 'pill' | 'link';
}

/**
 * Knop die "De grote taalteller" opent. Beheert zelf zijn open/dicht-status,
 * zodat je hem overal kan plaatsen zonder state door te geven — ook op
 * pagina's waar niemand ingelogd is.
 */
const PublicStatsButton: React.FC<PublicStatsButtonProps> = ({ variant = 'pill' }) => {
    const [isOpen, setIsOpen] = useState(false);

    const className =
        variant === 'link'
            ? 'text-xs text-muted underline underline-offset-2 hover:text-tal-purple transition-colors'
            : 'inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-tal-purple bg-tal-purple/10 border border-tal-purple/30 hover:bg-tal-purple/20 transition-colors';

    return (
        <>
            <button type="button" onClick={() => setIsOpen(true)} className={className}>
                {variant === 'link' ? '📊 Bekijk de grote taalteller' : '📊 De grote taalteller'}
            </button>
            <PublicStatsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </>
    );
};

export default PublicStatsButton;
