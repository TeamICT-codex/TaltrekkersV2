
import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth, isEmailDomainAllowed, formatAllowedDomains } from '../contexts/AuthContext';

// Microsoft-logo als inline SVG — 4-square grid, officiële kleuren
const MicrosoftLogo: React.FC<{ size?: number }> = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="1"  y="1"  width="9" height="9" fill="#f25022" />
        <rect x="11" y="1"  width="9" height="9" fill="#7fba00" />
        <rect x="1"  y="11" width="9" height="9" fill="#00a4ef" />
        <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
);

interface LoginProps {
    onBack?: () => void;
}

/**
 * Login-modal — identiek aan WelcomeScreen, maar in modale vorm (via "Inloggen"
 * knop rechtsboven). Enkel Microsoft OAuth + magic-link.
 *
 * Het oude "Leerkracht-code" mechanisme (sessionStorage nep-toegang) is verwijderd:
 * leerkracht worden gebeurt nu uitsluitend NA inloggen via de echte upgrade
 * (TeacherUpgradeModal → upgrade_to_teacher RPC), bereikbaar op het onboarding-
 * scherm en in de Header. Zo is er één login-pad en één echte rol-bron (Supabase).
 */
const Login: React.FC<LoginProps> = ({ onBack }) => {
    const [loading, setLoading] = useState(false);
    const [msLoading, setMsLoading] = useState(false);
    const { authError, clearAuthError, signInWithMicrosoft } = useAuth();

    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState<string | null>(null);
    const [sentTo, setSentTo] = useState<string | null>(null);

    const handleMicrosoftLogin = async () => {
        setEmailError(null);
        clearAuthError();
        setMsLoading(true);
        const result = await signInWithMicrosoft();
        // Bij succesvolle redirect loopt code hier niet meer.
        if (!result.success) {
            setMsLoading(false);
        }
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setEmailError(null);
        clearAuthError();

        const trimmed = email.trim().toLowerCase();
        if (!trimmed) {
            setEmailError('Vul je schoolmail in.');
            return;
        }
        if (!isEmailDomainAllowed(trimmed)) {
            setEmailError(`Alleen schoolaccounts (${formatAllowedDomains()}) zijn toegestaan.`);
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
            setEmailError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center animate-fade-in">
            <h1 className="text-3xl font-bold text-tal-purple-dark mb-2">Inloggen</h1>
            <p className="text-slate-600 mb-6 max-w-md">
                Log in met je schoolaccount om verder te gaan.
            </p>

            <div className="w-full max-w-sm space-y-3">
                {sentTo ? (
                    <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 text-center">
                        <div className="text-5xl mb-3">📬</div>
                        <h2 className="text-xl font-bold text-tal-purple-dark mb-2">Check je mail!</h2>
                        <p className="text-sm text-slate-600 mb-3">Login-link gestuurd naar:</p>
                        <p className="text-sm font-semibold text-tal-purple bg-tal-purple/5 border border-tal-purple/20 rounded-lg py-2 px-3 mb-4 break-all">
                            {sentTo}
                        </p>
                        <p className="text-xs text-slate-500 mb-1">Open de mail en klik op de link om in te loggen.</p>
                        <p className="text-xs text-slate-400 mb-4">Geen mail? Check <strong>Ongewenste mail / Spam</strong>.</p>
                        <button
                            onClick={() => { setSentTo(null); setEmail(''); }}
                            className="text-xs text-tal-purple hover:underline font-semibold"
                        >
                            ← Andere mail proberen
                        </button>
                    </div>
                ) : (
                    <>
                        {/* ── Primaire knop: Microsoft ── */}
                        <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-100">
                            <button
                                type="button"
                                onClick={handleMicrosoftLogin}
                                disabled={msLoading || loading}
                                className="w-full flex items-center justify-center gap-3 py-3 px-4 text-white font-bold rounded-xl transition disabled:opacity-60 text-sm shadow-sm"
                                style={{ background: msLoading ? '#005a9e' : '#0078d4' }}
                            >
                                {msLoading ? (
                                    <>
                                        <span className="animate-spin inline-block text-sm leading-none">⏳</span>
                                        <span>Doorsturen naar Microsoft…</span>
                                    </>
                                ) : (
                                    <>
                                        <MicrosoftLogo size={18} />
                                        <span>Log in met Microsoft</span>
                                    </>
                                )}
                            </button>
                            <p className="text-xs text-slate-400 mt-2 text-center">
                                Office 365-schoolaccount (@gotalok.be)
                            </p>
                        </div>

                        {/* ── Divider ── */}
                        <div className="flex items-center gap-2 px-1">
                            <div className="flex-1 h-px bg-slate-200" />
                            <span className="text-xs text-slate-400 font-medium whitespace-nowrap">of via e-maillink</span>
                            <div className="flex-1 h-px bg-slate-200" />
                        </div>

                        {/* ── Secundaire knop: magic link ── */}
                        <form onSubmit={handleEmailLogin} className="bg-white p-4 rounded-2xl shadow-xl border border-slate-100 space-y-3">
                            <div>
                                <label htmlFor="login-email" className="block text-left text-sm font-semibold text-slate-600 mb-1">
                                    Schoolmail
                                </label>
                                <input
                                    id="login-email"
                                    type="email"
                                    autoComplete="email"
                                    value={email}
                                    onChange={e => { setEmail(e.target.value); setEmailError(null); clearAuthError(); }}
                                    placeholder="voornaam.achternaam@gotalok.be"
                                    disabled={loading || msLoading}
                                    className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-tal-purple focus:border-transparent outline-none transition disabled:opacity-50 text-sm ${emailError ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading || msLoading}
                                className="w-full py-2.5 bg-tal-purple text-white font-semibold rounded-lg hover:bg-tal-purple-dark transition disabled:opacity-50 text-sm"
                            >
                                {loading ? 'Bezig met versturen…' : 'Stuur login-link →'}
                            </button>
                            {(emailError || authError) && (
                                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-left">
                                    {emailError || authError}
                                </p>
                            )}
                            <p className="text-xs text-slate-400 text-center">
                                Je krijgt een mail met een knop om in te loggen.
                            </p>
                        </form>
                    </>
                )}
            </div>

            {onBack && (
                <button
                    onClick={onBack}
                    className="mt-6 text-slate-500 hover:text-slate-700 text-sm font-medium transition"
                >
                    ← Terug
                </button>
            )}
        </div>
    );
};

export default Login;
