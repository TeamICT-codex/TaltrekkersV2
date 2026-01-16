
import React, { useState } from 'react';
import { supabase } from '../services/supabase';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            // Magic Link Login (eenvoudigst voor gebruikers)
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    // Zorgt dat ze terugkomen op de app na klikken link
                    emailRedirectTo: window.location.origin
                }
            });

            if (error) throw error;
            setMessage("Check je email! We hebben een magische inloglink gestuurd.");
        } catch (error: any) {
            setMessage(error.error_description || error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center animate-fade-in">
            <h1 className="text-3xl font-bold text-tal-purple-dark mb-2">Inloggen</h1>
            <p className="text-slate-600 mb-8 max-w-md">
                Log in om je voortgang op te slaan en zichtbaar te maken voor je leerkracht.
            </p>

            <div className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
                {message ? (
                    <div className="p-4 bg-green-50 text-green-800 rounded-lg border border-green-200 mb-4 animate-fade-in">
                        📩 {message}
                    </div>
                ) : (
                    <form onSubmit={handleLogin} className="space-y-4">
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
        </div>
    );
};

export default Login;
