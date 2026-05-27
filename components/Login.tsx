
import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';

// Leerkrachtcode via environment variable — alleen UI-shortcut, echte autorisatie
// gebeurt server-side via Supabase RLS op basis van profiles.role.
const TEACHER_PASSWORD = import.meta.env.VITE_TEACHER_CODE as string | undefined;
const TEACHER_SESSION_KEY = 'taltrekkers_teacher_session';
const TEACHER_ATTEMPTS_KEY = 'taltrekkers_teacher_attempts';
const MAX_ATTEMPTS = 5;

// Houd in sync met ALLOWED_EMAIL_DOMAIN in AuthContext.
const ALLOWED_EMAIL_DOMAIN = (
    (import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN as string | undefined) || 'gotalok.be'
).toLowerCase();

interface LoginProps {
    onBack?: () => void;
    onTeacherAccess?: () => void;
    initialTab?: 'email' | 'teacher';
}

const Login: React.FC<LoginProps> = ({ onBack, onTeacherAccess, initialTab = 'email' }) => {
    const [tab, setTab] = useState<'email' | 'teacher'>(initialTab);
    const [loading, setLoading] = useState(false);
    const { authError, clearAuthError } = useAuth();

    // Email magic link state
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState<string | null>(null);
    const [sentTo, setSentTo] = useState<string | null>(null);

    // Leerkracht state
    const [teacherCode, setTeacherCode] = useState('');
    const [codeError, setCodeError] = useState(false);
    const [teacherMessage, setTeacherMessage] = useState<string | null>(null);

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setEmailError(null);
        clearAuthError();

        const trimmed = email.trim().toLowerCase();
        if (!trimmed) {
            setEmailError('Vul je schoolmail in.');
            return;
        }
        if (!trimmed.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
            setEmailError(`Alleen schoolaccounts (@${ALLOWED_EMAIL_DOMAIN}) zijn toegestaan.`);
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

    const handleTeacherLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setTeacherMessage(null);
        setCodeError(false);

        const attempts = parseInt(sessionStorage.getItem(TEACHER_ATTEMPTS_KEY) || '0', 10);
        if (attempts >= MAX_ATTEMPTS) {
            setCodeError(true);
            setTeacherMessage('❌ Te veel mislukte pogingen. Ververs de pagina om opnieuw te proberen.');
            setLoading(false);
            return;
        }
        if (!TEACHER_PASSWORD) {
            setTeacherMessage('⚠️ Geen leerkrachtcode geconfigureerd. Contacteer de beheerder.');
            setLoading(false);
            return;
        }
        if (teacherCode === TEACHER_PASSWORD) {
            sessionStorage.removeItem(TEACHER_ATTEMPTS_KEY);
            sessionStorage.setItem(TEACHER_SESSION_KEY, 'true');
            setTeacherMessage('✅ Welkom! Je wordt doorgestuurd...');
            setLoading(false);
            setTimeout(() => { if (onTeacherAccess) onTeacherAccess(); }, 500);
        } else {
            sessionStorage.setItem(TEACHER_ATTEMPTS_KEY, String(attempts + 1));
            setCodeError(true);
            if (attempts + 1 >= MAX_ATTEMPTS) {
                setTeacherMessage('❌ Te veel mislukte pogingen. Ververs de pagina om opnieuw te proberen.');
            }
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center animate-fade-in">
            <h1 className="text-3xl font-bold text-tal-purple-dark mb-2">Inloggen</h1>
            <p className="text-slate-600 mb-6 max-w-md">
                {tab === 'email'
                    ? 'Log in met je schoolmail om verder te gaan.'
                    : 'Voor leerkrachten zonder schoolaccount.'}
            </p>

            {/* Tab switcher (Email / leerkracht) */}
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6 w-full max-w-sm">
                <button
                    onClick={() => setTab('email')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${tab === 'email'
                        ? 'bg-white shadow text-tal-purple'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Schoolmail
                </button>
                <button
                    onClick={() => setTab('teacher')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${tab === 'teacher'
                        ? 'bg-white shadow text-tal-purple'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    Leerkracht-code
                </button>
            </div>

            <div className="w-full max-w-sm">
                {tab === 'email' && (
                    <div className="animate-fade-in">
                        {sentTo ? (
                            <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 text-center">
                                <div className="text-5xl mb-3">📬</div>
                                <h2 className="text-xl font-bold text-tal-purple-dark mb-2">Check je mail!</h2>
                                <p className="text-sm text-slate-600 mb-3">
                                    Login-link gestuurd naar:
                                </p>
                                <p className="text-sm font-semibold text-tal-purple bg-tal-purple/5 border border-tal-purple/20 rounded-lg py-2 px-3 mb-4 break-all">
                                    {sentTo}
                                </p>
                                <p className="text-xs text-slate-500 mb-1">
                                    Open de mail en klik op de link om in te loggen.
                                </p>
                                <p className="text-xs text-slate-400 mb-4">
                                    Geen mail? Check <strong>Ongewenste mail / Spam</strong>.
                                </p>
                                <button
                                    onClick={() => { setSentTo(null); setEmail(''); }}
                                    className="text-xs text-tal-purple hover:underline font-semibold"
                                >
                                    ← Andere mail proberen
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleEmailLogin} className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 space-y-3">
                                <div>
                                    <label htmlFor="login-email" className="block text-left text-sm font-semibold text-slate-700 mb-1">
                                        Schoolmail
                                    </label>
                                    <input
                                        id="login-email"
                                        type="email"
                                        autoComplete="email"
                                        autoFocus
                                        value={email}
                                        onChange={e => { setEmail(e.target.value); setEmailError(null); clearAuthError(); }}
                                        placeholder={`voornaam.achternaam@${ALLOWED_EMAIL_DOMAIN}`}
                                        disabled={loading}
                                        className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-tal-purple focus:border-transparent outline-none transition disabled:opacity-50 ${emailError ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 bg-tal-purple text-white font-bold rounded-lg hover:bg-tal-purple-dark transition disabled:opacity-50"
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
                        )}
                    </div>
                )}

                {tab === 'teacher' && (
                    <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100 animate-fade-in">
                        {teacherMessage ? (
                            <div className={`p-4 rounded-lg border ${teacherMessage.includes('✅')
                                ? 'bg-green-50 text-green-800 border-green-200'
                                : 'bg-red-50 text-red-800 border-red-200'
                            }`}>
                                {teacherMessage}
                            </div>
                        ) : (
                            <form onSubmit={handleTeacherLogin} className="space-y-4">
                                <div>
                                    <label className="block text-left text-sm font-semibold text-slate-700 mb-1">Leerkracht-code</label>
                                    <input
                                        type="password"
                                        required
                                        value={teacherCode}
                                        onChange={e => { setTeacherCode(e.target.value); setCodeError(false); }}
                                        placeholder="Voer de code in"
                                        className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-tal-purple focus:border-transparent outline-none transition ${codeError ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                                    />
                                    {codeError && (
                                        <p className="text-red-500 text-xs mt-1 text-left">❌ Onjuiste code. Vraag het aan een collega.</p>
                                    )}
                                </div>
                                <p className="text-xs text-slate-400 text-left">
                                    💡 Voor leerkrachten zonder schoolaccount. Echte rollen worden gevalideerd via Supabase.
                                </p>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 bg-tal-purple text-white font-bold rounded-lg hover:bg-tal-purple-dark transition disabled:opacity-50"
                                >
                                    {loading ? 'Laden...' : 'Ga naar Dashboard 📊'}
                                </button>
                            </form>
                        )}
                    </div>
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

// Helper functies (blijven beschikbaar voor App.tsx)
export const isTeacherLoggedIn = (): boolean => {
    return sessionStorage.getItem('taltrekkers_teacher_session') === 'true';
};

export const logoutTeacher = (): void => {
    sessionStorage.removeItem('taltrekkers_teacher_session');
};

export default Login;
