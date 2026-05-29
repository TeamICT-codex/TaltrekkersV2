import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth, isEmailDomainAllowed, formatAllowedDomains } from '../contexts/AuthContext';

// Microsoft-logo als inline SVG — 4-square grid, officiële kleuren
const MicrosoftLogo: React.FC<{ size?: number }> = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="1"  y="1"  width="9" height="9" fill="#f25022" />
        <rect x="11" y="1"  width="9" height="9" fill="#7fba00" />
        <rect x="1"  y="11" width="9" height="9" fill="#00a4ef" />
        <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
);

const WelcomeScreen: React.FC = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [msLoading, setMsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sentTo, setSentTo] = useState<string | null>(null);
    const { authError, clearAuthError, signInWithMicrosoft } = useAuth();

    const handleMicrosoftLogin = async () => {
        setError(null);
        clearAuthError();
        setMsLoading(true);
        const result = await signInWithMicrosoft();
        // Bij succesvolle redirect loopt code hier niet meer.
        // Enkel bij fout (provider niet actief) terug naar idle.
        if (!result.success) {
            setMsLoading(false);
        }
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        clearAuthError();

        const trimmed = email.trim().toLowerCase();
        if (!trimmed) {
            setError('Vul je schoolmail in.');
            return;
        }
        // Pre-emptive domain check — voorkomt nutteloze mails én rate-limit gebruik
        if (!isEmailDomainAllowed(trimmed)) {
            setError(`Alleen schoolaccounts (${formatAllowedDomains()}) zijn toegestaan.`);
            return;
        }

        setLoading(true);
        try {
            const { error: authErr } = await supabase.auth.signInWithOtp({
                email: trimmed,
                options: {
                    emailRedirectTo: window.location.origin,
                    shouldCreateUser: true,
                },
            });
            if (authErr) throw authErr;
            setSentTo(trimmed);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Versturen van login-link mislukt.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    // Bevestigingsscherm na succesvol verzenden
    if (sentTo) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 animate-fade-in">
                <div className="w-full max-w-md text-center">
                    <div className="text-6xl mb-4">📬</div>
                    <h1 className="text-3xl md:text-4xl font-bold text-tal-purple-dark mb-3">
                        Check je mail!
                    </h1>
                    <p className="text-slate-600 mb-6">
                        We hebben een login-link gestuurd naar:
                    </p>
                    <p className="text-lg font-semibold text-tal-purple bg-white border-2 border-tal-purple/20 rounded-xl py-3 px-4 mb-6 break-all">
                        {sentTo}
                    </p>
                    <p className="text-sm text-slate-500 mb-2">
                        Open de mail en klik op de link om in te loggen.
                    </p>
                    <p className="text-xs text-slate-400 mb-8">
                        Geen mail ontvangen? Check je <strong>Ongewenste mail / Spam</strong>-map of probeer opnieuw.
                    </p>
                    <button
                        onClick={() => { setSentTo(null); setEmail(''); }}
                        className="text-sm text-tal-purple hover:underline font-semibold"
                    >
                        ← Andere mail proberen
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 animate-fade-in">
            <div className="text-center mb-8">
                <h1 className="text-4xl md:text-5xl font-bold text-tal-purple-dark mb-4">
                    Welkom bij TALent voor Taal! 🎯
                </h1>
                <p className="text-lg text-slate-600 max-w-md mx-auto">
                    Log in met je schoolaccount om je woordenschat te trainen.
                </p>
            </div>

            <div className="w-full max-w-md space-y-4">

                {/* ── Primaire knop: Microsoft ── */}
                <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200 p-5">
                    <button
                        type="button"
                        onClick={handleMicrosoftLogin}
                        disabled={msLoading || loading}
                        className="w-full flex items-center justify-center gap-3 py-3.5 px-4 text-white font-bold rounded-xl transition disabled:opacity-60 text-base shadow-sm"
                        style={{ background: msLoading ? '#005a9e' : '#0078d4' }}
                    >
                        {msLoading ? (
                            <>
                                <span className="animate-spin inline-block text-base leading-none">⏳</span>
                                <span>Doorsturen naar Microsoft…</span>
                            </>
                        ) : (
                            <>
                                <MicrosoftLogo size={20} />
                                <span>Log in met Microsoft</span>
                            </>
                        )}
                    </button>
                    <p className="text-xs text-slate-400 mt-2 text-center">
                        Gebruik je Office 365-schoolaccount (@gotalok.be)
                    </p>
                </div>

                {/* ── Divider ── */}
                <div className="flex items-center gap-3 px-1">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                        of via schoolmail (e-maillink)
                    </span>
                    <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* ── Secundaire knop: magic link ── */}
                <form onSubmit={handleEmailLogin} className="bg-white rounded-2xl shadow border border-slate-200 p-4">
                    <label htmlFor="welcome-email" className="block text-sm font-semibold text-slate-600 mb-2">
                        Schoolmail
                    </label>
                    <input
                        id="welcome-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setError(null); clearAuthError(); }}
                        placeholder="voornaam.achternaam@gotalok.be"
                        disabled={loading || msLoading}
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-tal-purple focus:border-transparent outline-none transition disabled:opacity-50 text-sm"
                    />
                    <button
                        type="submit"
                        disabled={loading || msLoading}
                        className="w-full mt-3 py-2.5 bg-tal-purple text-white font-semibold rounded-lg hover:bg-tal-purple-dark transition disabled:opacity-50 text-sm"
                    >
                        {loading ? 'Bezig met versturen…' : 'Stuur login-link →'}
                    </button>
                    <p className="text-xs text-slate-400 mt-2 text-center">
                        Je krijgt een mail met een knop om in te loggen.
                    </p>
                </form>

                {(error || authError) && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                        {error || authError}
                    </p>
                )}
            </div>
        </div>
    );
};

export default WelcomeScreen;
