import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

interface WelcomeScreenProps {
    onTeacherShortcut: () => void;
}

// Houd deze in sync met ALLOWED_EMAIL_DOMAIN in AuthContext.
// Wordt gebruikt voor pre-emptive validatie zodat we geen nutteloze mails sturen.
const ALLOWED_EMAIL_DOMAIN = (
    (import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN as string | undefined) || 'gotalok.be'
).toLowerCase();

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onTeacherShortcut }) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sentTo, setSentTo] = useState<string | null>(null);
    const { authError, clearAuthError } = useAuth();

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
        if (!trimmed.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
            setError(`Alleen schoolaccounts (@${ALLOWED_EMAIL_DOMAIN}) zijn toegestaan.`);
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
            <div className="text-center mb-10">
                <h1 className="text-4xl md:text-5xl font-bold text-tal-purple-dark mb-4">
                    Welkom bij TALent voor Taal! 🎯
                </h1>
                <p className="text-lg text-slate-600 max-w-md mx-auto">
                    Log in met je schoolmail om je woordenschat te trainen.
                </p>
            </div>

            <form onSubmit={handleEmailLogin} className="w-full max-w-md space-y-4">
                <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200 p-5">
                    <label htmlFor="welcome-email" className="block text-sm font-semibold text-slate-700 mb-2">
                        Schoolmail
                    </label>
                    <input
                        id="welcome-email"
                        type="email"
                        autoComplete="email"
                        autoFocus
                        value={email}
                        onChange={e => { setEmail(e.target.value); setError(null); clearAuthError(); }}
                        placeholder={`voornaam.achternaam@${ALLOWED_EMAIL_DOMAIN}`}
                        disabled={loading}
                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-tal-purple focus:border-transparent outline-none transition disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-3 py-3 bg-tal-purple text-white font-bold rounded-lg hover:bg-tal-purple-dark transition disabled:opacity-50"
                    >
                        {loading ? 'Bezig met versturen…' : 'Stuur login-link →'}
                    </button>
                    <p className="text-xs text-slate-400 mt-3 text-center">
                        Je krijgt een mail met een knop om in te loggen.
                    </p>
                </div>

                {(error || authError) && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                        {error || authError}
                    </p>
                )}
            </form>

            <button
                onClick={onTeacherShortcut}
                className="mt-8 text-xs text-slate-400 hover:text-tal-purple underline"
            >
                Leerkracht zonder schoolaccount?
            </button>

            <p className="mt-3 text-xs text-slate-400 text-center max-w-sm">
                💡 Geen schoolaccount? Vraag het aan je leerkracht.
            </p>
        </div>
    );
};

export default WelcomeScreen;
