
import React, { useState } from 'react';
import { supabase } from '../services/supabase';

const TEACHER_CODE = import.meta.env.VITE_TEACHER_CODE || '';
const TEACHER_PENDING_KEY = 'taltrekkers_teacher_pending';
const NAME_PENDING_KEY = 'taltrekkers_pending_name';

interface LoginProps {
    onBack?: () => void;
}

const Login: React.FC<LoginProps> = ({ onBack }) => {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [isTeacher, setIsTeacher] = useState(false);
    const [teacherCode, setTeacherCode] = useState('');
    const [codeError, setCodeError] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        setCodeError(false);

        // Valideer leerkrachtcode indien nodig
        if (isTeacher && teacherCode !== TEACHER_CODE) {
            setCodeError(true);
            setLoading(false);
            return;
        }

        // Als de code klopt, sla dit op in localStorage
        if (isTeacher && teacherCode === TEACHER_CODE) {
            localStorage.setItem(TEACHER_PENDING_KEY, email.toLowerCase());
            console.log('📝 Teacher code verified, saved to localStorage');
        }

        // Sla de naam op voor later (wordt opgeslagen na magic link bevestiging)
        if (name.trim()) {
            localStorage.setItem(NAME_PENDING_KEY, name.trim());
            console.log('📝 Name saved to localStorage:', name.trim());
        }

        try {
            // Magic Link Login
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: window.location.origin
                }
            });

            if (error) throw error;

            if (isTeacher) {
                setMessage("✅ Leerkrachtcode geaccepteerd! Check je email voor de inloglink.");
            } else {
                setMessage("📩 Check je email! We hebben een magische inloglink gestuurd.");
            }
        } catch (error: any) {
            localStorage.removeItem(TEACHER_PENDING_KEY);
            setMessage(error.error_description || error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center animate-fade-in">
            <h1 className="text-3xl font-bold text-tal-purple-dark mb-2">Inloggen</h1>
            <p className="text-slate-600 mb-8 max-w-md">
                Log in met je email om je voortgang op te slaan.
            </p>

            <div className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
                {message ? (
                    <div className={`p-4 rounded-lg border mb-4 animate-fade-in ${message.includes('✅') || message.includes('📩')
                        ? 'bg-green-50 text-green-800 border-green-200'
                        : 'bg-red-50 text-red-800 border-red-200'
                        }`}>
                        {message}
                    </div>
                ) : (
                    <form onSubmit={handleLogin} className="space-y-4">
                        {/* Naam veld */}
                        <div>
                            <label className="block text-left text-sm font-semibold text-slate-700 mb-1">Je naam</label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Voornaam Achternaam"
                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-tal-purple focus:border-transparent outline-none transition"
                            />
                        </div>

                        {/* Email veld */}
                        <div>
                            <label className="block text-left text-sm font-semibold text-slate-700 mb-1">Emailadres</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="naam@school.be"
                                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-tal-purple focus:border-transparent outline-none transition"
                            />
                        </div>

                        {/* Leerkracht Toggle */}
                        <div
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${isTeacher
                                ? 'border-tal-purple bg-tal-purple/5'
                                : 'border-slate-200 hover:border-slate-300'
                                }`}
                            onClick={() => setIsTeacher(!isTeacher)}
                        >
                            <label className="flex items-center gap-3 cursor-pointer">
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isTeacher
                                    ? 'bg-tal-purple border-tal-purple'
                                    : 'border-slate-300'
                                    }`}>
                                    {isTeacher && (
                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                                <span className="text-sm font-medium text-slate-700">
                                    👨‍🏫 Ik ben leerkracht
                                </span>
                            </label>
                        </div>

                        {/* Leerkrachtcode Input */}
                        {isTeacher && (
                            <div className="animate-fade-in">
                                <label className="block text-left text-sm font-semibold text-slate-700 mb-1">
                                    Leerkrachtcode
                                </label>
                                <input
                                    type="password"
                                    required
                                    value={teacherCode}
                                    onChange={(e) => {
                                        setTeacherCode(e.target.value);
                                        setCodeError(false);
                                    }}
                                    placeholder="Voer de geheime code in"
                                    className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-tal-purple focus:border-transparent outline-none transition ${codeError ? 'border-red-400 bg-red-50' : 'border-slate-300'
                                        }`}
                                />
                                {codeError && (
                                    <p className="text-red-500 text-xs mt-1 text-left">
                                        ❌ Ongeldige code. Vraag de code aan je collega's.
                                    </p>
                                )}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-tal-purple text-white font-bold rounded-lg hover:bg-tal-purple-dark transition disabled:opacity-50"
                        >
                            {loading ? 'Laden...' : 'Stuur Inlog Link ✨'}
                        </button>
                        <p className="text-xs text-slate-400 mt-4">
                            We gebruiken een "Magic Link". Je hoeft geen wachtwoord te onthouden!
                        </p>
                    </form>
                )}
            </div>

            {/* Terug knop */}
            {onBack && (
                <button
                    onClick={onBack}
                    className="mt-6 text-slate-500 hover:text-slate-700 text-sm font-medium transition"
                >
                    ← Terug naar keuzemenu
                </button>
            )}
        </div>
    );
};

export default Login;
