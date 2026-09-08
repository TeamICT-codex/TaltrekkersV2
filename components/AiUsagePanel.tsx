import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAiUsageRows, aggregateUsage, type AiUsageRow, type UsageBucket } from '../services/aiUsage';

/**
 * AI-verbruik-paneel (admin-only).
 *
 * Toont hoeveel Gemini-calls de app doet, hoeveel tokens die verbruiken en wat
 * dat ongeveer kost. Bewust enkel metadata: er staan geen namen, prompts of
 * resultaten in de logtabel, dus die kunnen hier ook niet getoond worden.
 *
 * Het paneel haalt zelf zijn data op (bij het mounten en bij een klik op
 * vernieuwen). De ouder mount het enkel wanneer de admin het opent, zodat de
 * query niet draait voor wie het paneel nooit opendoet.
 */

/** Verduidelijking bij de periode-kaarten, zodat "deze week" niet dubbelzinnig is. */
const PERIOD_HINTS: Record<string, string> = {
    'Deze week': 'sinds maandag',
    'Deze maand': 'sinds de 1e',
    'Alles': 'laatste 90 dagen',
};

const fmtInt = (n: number): string => n.toLocaleString('nl-BE');

/** Bedragen zijn schattingen → altijd met een ~ ervoor, en in Belgisch formaat. */
const fmtUsd = (n: number): string => {
    if (!n) return '~$0,00';
    return `~$${n.toLocaleString('nl-BE', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
};

const AiUsagePanel: React.FC = () => {
    const [rows, setRows] = useState<AiUsageRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [missingTable, setMissingTable] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        const result = await fetchAiUsageRows();
        setRows(result.rows);
        setError(result.error);
        setMissingTable(result.missingTable);
        setLoading(false);
    }, []);

    useEffect(() => { void load(); }, [load]);

    const { periods, perFeature, total, anonymousCalls } = useMemo(() => aggregateUsage(rows), [rows]);

    const renderBody = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center gap-3 py-12 text-muted">
                    <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-tal-purple" aria-hidden />
                    Cijfers ophalen…
                </div>
            );
        }

        if (missingTable) {
            return (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-4 text-sm">
                    📋 Nog geen logboek. Voer <code className="font-mono text-xs bg-amber-100 px-1 py-0.5 rounded">migration-2026-09-07-ai-usage-log.sql</code> uit
                    in de Supabase SQL-editor, daarna verschijnen de cijfers hier.
                </div>
            );
        }

        if (error) {
            return (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-4 text-sm">
                    ⛔ Ophalen mislukt: {error}
                </div>
            );
        }

        if (rows.length === 0) {
            return (
                <div className="py-10 text-center text-muted text-sm">
                    Nog geen AI-calls gelogd. Zodra leerlingen oefenen op de live app vullen deze cijfers zich.
                </div>
            );
        }

        return (
            <>
                {/* Periode-kaarten */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {periods.map((p: UsageBucket) => (
                        <div key={p.label} className="bg-surface rounded-xl p-4 border border-themed shadow-sm">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-muted">
                                {p.label}
                                {PERIOD_HINTS[p.label] && (
                                    <span className="font-medium normal-case"> ({PERIOD_HINTS[p.label]})</span>
                                )}
                            </div>
                            <div className="text-2xl font-bold text-tal-purple mt-1 mb-3">{fmtUsd(p.costUsd)}</div>
                            <dl className="space-y-1 text-sm">
                                <div className="flex justify-between gap-2">
                                    <dt className="text-muted">Calls</dt>
                                    <dd className="font-medium">{fmtInt(p.calls)}</dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                    <dt className="text-muted">Input-tokens</dt>
                                    <dd className="font-medium">{fmtInt(p.inputTokens)}</dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                    <dt className="text-muted">Output-tokens</dt>
                                    <dd className="font-medium">{fmtInt(p.outputTokens)}</dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                    <dt className="text-muted">Mislukt</dt>
                                    <dd className={`font-medium ${p.failed > 0 ? 'text-orange-500' : ''}`}>{fmtInt(p.failed)}</dd>
                                </div>
                            </dl>
                        </div>
                    ))}
                </div>

                {/* Anonieme calls: nuttig misbruik-signaal (niemand ingelogd = mogelijk scraping). */}
                {anonymousCalls > 0 && (
                    <p className="mt-3 text-xs text-muted">
                        ⚠️ {fmtInt(anonymousCalls)} calls zonder ingelogde gebruiker
                    </p>
                )}

                {/* Per functie */}
                <div className="mt-6 bg-surface rounded-xl border border-themed shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-themed">
                        <h3 className="font-bold">Per functie — laatste 90 dagen</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-surface-alt text-muted text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-2 font-semibold">Functie</th>
                                    <th className="px-4 py-2 font-semibold text-right">Calls</th>
                                    <th className="px-4 py-2 font-semibold text-right">Input-tokens</th>
                                    <th className="px-4 py-2 font-semibold text-right">Output-tokens</th>
                                    <th className="px-4 py-2 font-semibold text-right">Kosten</th>
                                    <th className="px-4 py-2 font-semibold text-right">Mislukt</th>
                                </tr>
                            </thead>
                            <tbody>
                                {perFeature.map((f: UsageBucket) => (
                                    <tr key={f.label} className="border-t border-themed">
                                        <td className="px-4 py-2">{f.label}</td>
                                        <td className="px-4 py-2 text-right">{fmtInt(f.calls)}</td>
                                        <td className="px-4 py-2 text-right">{fmtInt(f.inputTokens)}</td>
                                        <td className="px-4 py-2 text-right">{fmtInt(f.outputTokens)}</td>
                                        <td className="px-4 py-2 text-right">{fmtUsd(f.costUsd)}</td>
                                        <td className={`px-4 py-2 text-right ${f.failed > 0 ? 'text-orange-500' : 'text-muted'}`}>
                                            {fmtInt(f.failed)}
                                        </td>
                                    </tr>
                                ))}
                                <tr className="border-t-2 border-themed bg-surface-alt font-bold">
                                    <td className="px-4 py-2">{total.label}</td>
                                    <td className="px-4 py-2 text-right">{fmtInt(total.calls)}</td>
                                    <td className="px-4 py-2 text-right">{fmtInt(total.inputTokens)}</td>
                                    <td className="px-4 py-2 text-right">{fmtInt(total.outputTokens)}</td>
                                    <td className="px-4 py-2 text-right">{fmtUsd(total.costUsd)}</td>
                                    <td className="px-4 py-2 text-right">{fmtInt(total.failed)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <p className="mt-3 text-xs text-muted leading-relaxed">
                    Bedragen zijn een schatting in US-dollar, berekend uit de gelogde tokens maal het tarief per
                    model: Gemini 3.8 Flash $0.75 per 1M input en $3.75 per 1M output (introductieprijs t.e.m.
                    31 december 2026, daarna het dubbele), spraak $0.50 en $10.00. Denk-tokens rekent Google als
                    output, dus die tellen mee. De factuur van Google is de enige echte waarheid. Er wordt gekeken
                    naar de laatste 90 dagen (max. 20.000 rijen); mislukte calls hebben geen gekende tokens en
                    kosten hier dus $0.
                </p>
            </>
        );
    };

    return (
        <section className="bg-surface-alt rounded-2xl border border-themed p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                    <h2 className="text-lg font-bold">🧾 AI-verbruik</h2>
                    <p className="text-sm text-muted">
                        Enkel metadata: hoeveel calls, hoeveel tokens, hoe duur. Geen namen, geen prompts, geen resultaten.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => { void load(); }}
                    disabled={loading}
                    aria-label="Cijfers vernieuwen"
                    title="Vernieuwen"
                    className="shrink-0 p-2 rounded-lg text-muted hover:text-tal-purple hover:bg-black/5 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <span className={`inline-block text-lg leading-none ${loading ? 'animate-spin' : ''}`} aria-hidden>⟳</span>
                </button>
            </div>

            {renderBody()}
        </section>
    );
};

export default AiUsagePanel;
