import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Spinner from './Spinner';
import {
    fetchPublicStats,
    correctPercentage,
    questionsWrong,
    PublicStats,
} from '../services/publicStats';

interface PublicStatsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/** Belgisch-Nederlandse notatie: 2.625 in plaats van 2,625. */
const nl = (value: number): string => value.toLocaleString('nl-BE');

/**
 * Eén tegel uit het raster — dezelfde opbouw als de statistiek-kaarten in het
 * Leerkracht Dashboard (groot paars cijfer, gedempt label), zodat de teller
 * aanvoelt als een stuk van de app en niet als een vreemde eend.
 */
const StatTile: React.FC<{ emoji: string; value: number; label: string }> = ({ emoji, value, label }) => (
    <div className="bg-surface-alt border border-themed rounded-xl p-3 text-center">
        <div className="text-xl leading-none mb-1 select-none" aria-hidden="true">{emoji}</div>
        <div className="text-2xl font-bold text-tal-purple leading-tight">{nl(value)}</div>
        <div className="text-xs text-muted leading-tight mt-0.5">{label}</div>
    </div>
);

/**
 * "De grote taalteller" — publieke modal met de totalen van de hele app.
 *
 * Zichtbaar voor iedereen, ook zonder login: de cijfers komen uit een RPC die
 * enkel opgetelde getallen teruggeeft (geen namen, geen leerlinggegevens).
 * Zie services/publicStats.ts.
 *
 * Stijl = de huisstijl van de app: teal kop met gouden label zoals de
 * welkomstkaart en de quizkaart, tegels zoals het dashboard, paarse knop
 * zoals "Start Oefening".
 */
const PublicStatsModal: React.FC<PublicStatsModalProps> = ({ isOpen, onClose }) => {
    const [stats, setStats] = useState<PublicStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    // Cijfers ophalen zodra de modal opengaat (de service cacht 5 minuten,
    // dus heropenen kost geen extra query).
    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;

        setLoading(true);
        setError(null);
        fetchPublicStats().then(({ stats: fetched, error: fetchErr }) => {
            if (cancelled) return;
            setLoading(false);
            setStats(fetched);
            setError(fetchErr);
        });

        return () => { cancelled = true; };
    }, [isOpen]);

    // Escape sluit de modal.
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    // Focus naar de sluitknop, zodat toetsenbordgebruikers meteen in de modal zitten.
    useEffect(() => {
        if (isOpen) closeButtonRef.current?.focus();
    }, [isOpen]);

    if (!isOpen) return null;

    const percentage = stats ? correctPercentage(stats) : 0;
    const wrong = stats ? questionsWrong(stats) : 0;
    const hasData = !loading && !error && stats !== null;

    // Via een portal op <body>, niet in de eigen boom: de trigger staat in
    // koppen binnen containers met een (afgewerkte) fade-in-transform, en een
    // transform maakt van een ouder het referentiekader voor `position: fixed`.
    // Zonder portal zou de overlay enkel dat blok bedekken en zou de sticky
    // header (z-40) erbovenop blijven staan.
    return createPortal(
        <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="taalteller-titel"
                className="bg-surface w-full max-w-lg rounded-2xl shadow-2xl border border-themed overflow-hidden max-h-[92vh] overflow-y-auto"
            >
                {/* ── Teal kop, zoals de welkomstkaart ── */}
                <div className="bg-tal-teal text-white px-6 pt-5 pb-6 relative">
                    <p className="text-xs font-bold uppercase tracking-wider text-tal-gold">Samen geoefend</p>
                    <h2 id="taalteller-titel" className="text-2xl font-bold mt-1 pr-10">
                        🎯 De grote taalteller
                    </h2>
                    <p className="text-sm text-white/80 mt-1 pr-10">
                        Zoveel deed de hele school al met TALent voor Taal.
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

                    {hasData && stats && (
                        <div className="bg-black/20 rounded-xl px-4 py-5 text-center mt-4">
                            <p className="text-5xl font-extrabold leading-none">{nl(stats.questionsTotal)}</p>
                            <p className="text-sm text-white/85 mt-2">quizvragen beantwoord</p>
                            <p className="inline-flex items-center gap-1 mt-3 px-3 py-1 rounded-full bg-tal-gold text-slate-900 text-xs font-bold">
                                ✅ {percentage}% juist
                            </p>
                        </div>
                    )}
                </div>

                <div className="p-5 space-y-4">
                    {loading && (
                        <div className="flex flex-col items-center justify-center gap-3 py-10">
                            <Spinner className="h-8 w-8 text-tal-purple" />
                            <p className="text-sm text-muted">Even tellen…</p>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="bg-pro-tip text-pro-tip border-l-4 border-tal-gold rounded-lg p-3 text-sm leading-snug">
                            <strong>De teller is even niet beschikbaar.</strong> {error}
                        </div>
                    )}

                    {hasData && stats && (
                        <>
                            {/* ── Raster met de acht deeltellers ── */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <StatTile emoji="👩‍🏫" value={stats.teachers} label="leerkrachten" />
                                <StatTile emoji="🏫" value={stats.classes} label="klassen" />
                                <StatTile emoji="🧑‍🎓" value={stats.students} label="leerlingen" />
                                <StatTile emoji="📚" value={stats.wordLists} label="woordenlijsten" />
                                <StatTile emoji="📝" value={stats.sessions} label="oefensessies" />
                                <StatTile emoji="🔤" value={stats.wordsPracticed} label="woorden geoefend" />
                                <StatTile emoji="✅" value={stats.questionsCorrect} label="vragen juist" />
                                <StatTile emoji="❌" value={wrong} label="vragen fout" />
                            </div>

                            <p className="text-xs text-muted text-center">
                                Enkel totalen. Geen namen, geen gegevens van leerlingen. 🔒
                            </p>
                        </>
                    )}

                    {/* ── Sluitknop in de stijl van "Start Oefening" (ook zichtbaar bij een fout) ── */}
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

export default PublicStatsModal;
