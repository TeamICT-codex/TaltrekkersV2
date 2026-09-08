import React, { useEffect, useRef, useState } from 'react';
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

/** Eén pasteltegel uit het raster: emoji, groot gekleurd cijfer, klein label. */
const StatTile: React.FC<{ emoji: string; value: number; label: string; tint: string; color: string }> = ({
    emoji,
    value,
    label,
    tint,
    color,
}) => (
    <div className={`rounded-xl border border-themed p-3 text-center ${tint}`}>
        <div className="text-xl leading-none mb-1 select-none" aria-hidden="true">{emoji}</div>
        <div className={`text-xl font-extrabold leading-tight ${color}`}>{nl(value)}</div>
        <div className="text-[11px] text-muted leading-tight mt-0.5">{label}</div>
    </div>
);

/**
 * "De grote taalteller" — publieke modal met de totalen van de hele app.
 *
 * Zichtbaar voor iedereen, ook voor bezoekers die niet ingelogd zijn: de
 * cijfers komen uit een RPC die enkel opgetelde getallen teruggeeft (geen
 * namen, geen leerlinggegevens). Zie services/publicStats.ts.
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

    return (
        <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="taalteller-titel"
                className="bg-surface w-full max-w-[520px] rounded-2xl shadow-2xl border border-themed overflow-hidden max-h-[92vh] overflow-y-auto"
            >
                {/* ── Kopbalk ── */}
                <div
                    className="px-5 py-4 relative text-white"
                    style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)' }}
                >
                    <h2 id="taalteller-titel" className="text-lg font-extrabold drop-shadow-sm pr-10">
                        🧮 De grote taalteller
                    </h2>
                    <p className="text-xs text-white/90 mt-0.5 pr-10">
                        Zoveel is er al geoefend met TALent voor Taal
                    </p>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={onClose}
                        aria-label="Sluiten"
                        className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {loading && (
                        <div className="flex flex-col items-center justify-center gap-3 py-12">
                            <Spinner className="h-8 w-8 text-tal-purple" />
                            <p className="text-sm text-muted">Even tellen…</p>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
                            <p className="font-semibold mb-1">De teller is even niet beschikbaar</p>
                            <p className="leading-snug">{error}</p>
                        </div>
                    )}

                    {!loading && !error && stats && (
                        <>
                            {/* ── Hero: het grote totaal ── */}
                            <div
                                className="rounded-2xl px-5 py-6 text-center text-white shadow-md"
                                style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' }}
                            >
                                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/80">
                                    Samen al beantwoord
                                </p>
                                <p className="text-5xl font-extrabold leading-none my-2 drop-shadow-sm">
                                    {nl(stats.questionsTotal)}
                                </p>
                                <p className="text-sm font-semibold text-white/95">quizvragen 🎯</p>
                                <p className="inline-block mt-3 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold">
                                    waarvan {percentage}% juist 🎯
                                </p>
                            </div>

                            {/* ── Raster met de acht deeltellers ── */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                <StatTile emoji="👩‍🏫" value={stats.teachers}        label="leerkrachten"     tint="bg-purple-500/10"  color="text-purple-500" />
                                <StatTile emoji="🏫"   value={stats.classes}         label="klassen"          tint="bg-sky-500/10"     color="text-sky-500" />
                                <StatTile emoji="🧑‍🎓" value={stats.students}        label="leerlingen"       tint="bg-pink-500/10"    color="text-pink-500" />
                                <StatTile emoji="📚"   value={stats.wordLists}       label="woordenlijsten"   tint="bg-amber-500/10"   color="text-amber-600" />
                                <StatTile emoji="📝"   value={stats.sessions}        label="oefensessies"     tint="bg-indigo-500/10"  color="text-indigo-500" />
                                <StatTile emoji="🔤"   value={stats.wordsPracticed}  label="woorden geoefend" tint="bg-teal-500/10"    color="text-teal-600" />
                                <StatTile emoji="✅"   value={stats.questionsCorrect} label="vragen juist"    tint="bg-emerald-500/10" color="text-emerald-600" />
                                <StatTile emoji="❌"   value={wrong}                 label="vragen fout"      tint="bg-rose-500/10"    color="text-rose-500" />
                            </div>

                            {/* ── Privacy-voetnoot ── */}
                            <p className="text-[11px] text-muted italic text-center leading-snug">
                                Enkel totalen — geen namen, geen gegevens van leerlingen. 🔒
                            </p>
                        </>
                    )}

                    {/* ── Sluitknop (ook zichtbaar bij een fout) ── */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full py-3 rounded-xl font-extrabold text-white shadow-md hover:scale-[1.01] active:scale-95 transition-transform"
                        style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)' }}
                    >
                        Sluiten 🎯
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PublicStatsModal;
