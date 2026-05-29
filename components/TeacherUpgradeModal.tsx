import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface TeacherUpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const TeacherUpgradeModal: React.FC<TeacherUpgradeModalProps> = ({ isOpen, onClose }) => {
    const { upgradeToTeacher } = useAuth();
    const [code, setCode] = useState('');
    const [showCode, setShowCode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Reset bij heropenen
    useEffect(() => {
        if (isOpen) {
            setCode('');
            setShowCode(false);
            setError(null);
            setSuccess(false);
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code.trim()) {
            setError('Vul een code in.');
            return;
        }
        setLoading(true);
        setError(null);

        const result = await upgradeToTeacher(code.trim());
        setLoading(false);

        if (result.success) {
            setSuccess(true);
            // 2 sec succes-melding tonen, dan modal sluiten zodat Header refresh
            setTimeout(() => { onClose(); }, 2000);
        } else {
            setError(result.error || 'Er ging iets mis.');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-surface w-full max-w-md rounded-2xl shadow-2xl border border-themed overflow-hidden">
                {/* Header */}
                <div className="bg-tal-purple px-6 py-4 flex items-center justify-between select-none">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2 drop-shadow-sm">
                        <span aria-hidden="true">👨‍🏫</span>
                        <span>Word leerkracht</span>
                    </h2>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors disabled:opacity-50"
                        aria-label="Sluiten"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-6">
                    {success ? (
                        // Success state
                        <div className="text-center py-6">
                            <div className="text-6xl mb-4">🎉</div>
                            <h3 className="text-xl font-bold text-green-600 mb-2">
                                Je bent nu leerkracht!
                            </h3>
                            <p className="text-muted text-sm">
                                Je krijgt nu toegang tot het Dashboard om leerlingen te volgen.
                                De pagina wordt zo bijgewerkt.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <p className="text-secondary text-sm">
                                Voer de leerkracht-code in die je via je collega's of de coördinator hebt gekregen.
                                Daarna heb je toegang tot het Dashboard met sessies van alle leerlingen.
                            </p>

                            <div>
                                <label htmlFor="upgrade-code" className="block text-sm font-medium mb-2">
                                    Leerkracht-code
                                </label>
                                <div className="relative">
                                    <input
                                        id="upgrade-code"
                                        type={showCode ? 'text' : 'password'}
                                        value={code}
                                        onChange={(e) => { setCode(e.target.value); setError(null); }}
                                        placeholder="Voer de code in…"
                                        disabled={loading}
                                        autoFocus
                                        className={`w-full px-4 py-3 pr-12 border rounded-xl focus:outline-none focus:ring-2 focus:ring-tal-purple bg-white text-slate-900 placeholder:text-slate-400 transition disabled:opacity-50 ${error ? 'border-red-400 bg-red-50' : 'border-slate-300'}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCode(v => !v)}
                                        disabled={loading}
                                        title={showCode ? 'Verberg code' : 'Toon code'}
                                        aria-label={showCode ? 'Verberg code' : 'Toon code'}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-black/5 text-slate-500 text-lg transition disabled:opacity-50"
                                    >
                                        {showCode ? '🙈' : '👁️'}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                    {error}
                                </p>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={loading}
                                    className="flex-1 py-3 rounded-xl font-semibold bg-black/5 hover:bg-black/10 transition disabled:opacity-50"
                                >
                                    Annuleer
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || !code.trim()}
                                    className="flex-[2] py-3 bg-tal-purple text-white font-bold rounded-xl hover:bg-tal-purple-dark transition disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <><span className="animate-spin">⏳</span> Bezig met upgraden…</>
                                    ) : (
                                        <>👨‍🏫 Upgrade naar leerkracht</>
                                    )}
                                </button>
                            </div>

                            <p className="text-xs text-muted text-center pt-1">
                                💡 Geen code? Vraag het aan een collega-leerkracht.
                            </p>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TeacherUpgradeModal;
