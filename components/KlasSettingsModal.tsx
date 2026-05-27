import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Finaliteit, Jaargang } from '../types';

interface KlasSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface FinaliteitOption {
    id: Finaliteit;
    name: string;
    short: string;
    description: string;
    emoji: string;
}

const FINALITEIT_OPTIES: FinaliteitOption[] = [
    { id: 'AF', name: 'Arbeidsfinaliteit', short: 'AF', description: 'Klaar voor de arbeidsmarkt', emoji: '🛠️' },
    { id: 'DF', name: 'Dubbele finaliteit', short: 'DF', description: 'Werk of hoger onderwijs', emoji: '🎯' },
    { id: 'OKAN', name: 'OKAN', short: 'OKAN', description: 'Onthaalonderwijs anderstaligen', emoji: '🌍' },
];

const JAARGANGEN_PER_FINALITEIT: Record<Finaliteit, Jaargang[]> = {
    AF: ['3e', '4e', '5e', '5 Duaal', '6e', '6 Duaal', '7e'],
    DF: ['3e', '4e', '5e', '6e'],
    OKAN: ['Fase 1', 'Fase 2', 'Fase 3', 'Fase 4'],
};

const KlasSettingsModal: React.FC<KlasSettingsModalProps> = ({ isOpen, onClose }) => {
    const {
        finaliteit: profileFinaliteit,
        jaargang: profileJaargang,
        nativeLanguage: profileNativeLanguage,
        setKlasInfo,
        setNativeLanguage,
    } = useAuth();

    const [selectedFinaliteit, setSelectedFinaliteit] = useState<Finaliteit | null>(profileFinaliteit);
    const [selectedJaargang, setSelectedJaargang] = useState<Jaargang | null>(profileJaargang);
    const [nativeLanguageInput, setNativeLanguageInput] = useState(profileNativeLanguage ?? '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset bij heropenen — gebruik altijd de huidige profile-waarden als basis
    useEffect(() => {
        if (isOpen) {
            setSelectedFinaliteit(profileFinaliteit);
            setSelectedJaargang(profileJaargang);
            setNativeLanguageInput(profileNativeLanguage ?? '');
            setError(null);
        }
    }, [isOpen, profileFinaliteit, profileJaargang, profileNativeLanguage]);

    const handleFinaliteitClick = (f: Finaliteit) => {
        setSelectedFinaliteit(f);
        // Bij wijziging van finaliteit: reset jaargang alleen als die niet meer geldig is
        if (selectedJaargang && !JAARGANGEN_PER_FINALITEIT[f].includes(selectedJaargang)) {
            setSelectedJaargang(null);
        }
        setError(null);
    };

    const handleSubmit = async () => {
        if (!selectedFinaliteit || !selectedJaargang) return;
        setLoading(true);
        setError(null);

        // Alleen opslaan als er iets veranderd is in finaliteit/jaargang
        const klasChanged =
            selectedFinaliteit !== profileFinaliteit ||
            selectedJaargang !== profileJaargang;

        if (klasChanged) {
            const klasResult = await setKlasInfo(selectedFinaliteit, selectedJaargang);
            if (!klasResult.success) {
                setLoading(false);
                setError(klasResult.error || 'Er ging iets mis bij het opslaan.');
                return;
            }
        }

        // Moedertaal: vergelijk met huidig en sla op als veranderd (incl. leegmaken)
        const newLang = nativeLanguageInput.trim();
        const currentLang = (profileNativeLanguage ?? '').trim();
        if (newLang !== currentLang) {
            const langResult = await setNativeLanguage(newLang);
            if (!langResult.success) {
                console.warn('Kon moedertaal niet opslaan:', langResult.error);
            }
        }

        setLoading(false);
        onClose();
    };

    if (!isOpen) return null;

    const canSubmit = selectedFinaliteit !== null && selectedJaargang !== null && !loading;

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-tal-teal text-white w-full max-w-2xl rounded-3xl shadow-2xl border border-white/10 overflow-hidden max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-white/10">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        📚 Wijzig je klas
                    </h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                        aria-label="Sluiten"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-6">
                    <p className="text-slate-200 text-sm mb-6">
                        Aanpassen kan altijd — bv. wanneer je van richting verandert of je verkeerd had gekozen.
                    </p>

                    {/* Stap 1: Finaliteit */}
                    <div className="mb-6">
                        <p className="font-semibold text-white mb-3 text-sm">1. Kies je finaliteit:</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {FINALITEIT_OPTIES.map(f => (
                                <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => handleFinaliteitClick(f.id)}
                                    className={`text-left p-4 rounded-2xl transition-all duration-200 border ${
                                        selectedFinaliteit === f.id
                                            ? 'bg-tal-purple ring-2 ring-white/60 border-tal-purple shadow-lg'
                                            : 'bg-black/20 hover:bg-black/30 border-white/10'
                                    }`}
                                >
                                    <div className="text-2xl mb-1.5">{f.emoji}</div>
                                    <div className="font-bold text-sm mb-0.5">{f.name}</div>
                                    <div className="text-xs text-slate-200 leading-snug">{f.description}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Stap 2: Jaargang */}
                    {selectedFinaliteit && (
                        <div className="mb-6 animate-fade-in">
                            <p className="font-semibold text-white mb-3 text-sm">
                                2. Kies je {selectedFinaliteit === 'OKAN' ? 'fase' : 'jaargang'}:
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {JAARGANGEN_PER_FINALITEIT[selectedFinaliteit].map(j => (
                                    <button
                                        key={j}
                                        type="button"
                                        onClick={() => setSelectedJaargang(j)}
                                        className={`px-3 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                                            selectedJaargang === j
                                                ? 'bg-tal-purple ring-2 ring-white/60'
                                                : 'bg-black/20 hover:bg-black/30'
                                        }`}
                                    >
                                        {j}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Stap 3: Moedertaal */}
                    {selectedFinaliteit && selectedJaargang && (
                        <div className="mb-6 animate-fade-in">
                            <label htmlFor="settings-native-language" className="block font-semibold text-white mb-2 text-sm">
                                3. Wat is je moedertaal? <span className="text-slate-300 font-normal">(optioneel)</span>
                            </label>
                            <input
                                id="settings-native-language"
                                type="text"
                                value={nativeLanguageInput}
                                onChange={e => setNativeLanguageInput(e.target.value)}
                                placeholder="bv. Frans, Arabisch, Turks, Roemeens…"
                                className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-tal-purple focus:bg-black/30 transition"
                                maxLength={50}
                            />
                            <p className="mt-1.5 text-xs text-slate-300">
                                💡 Laat leeg om te wissen.
                            </p>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/20 border border-red-400/40 text-red-100 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 py-3 rounded-xl font-semibold bg-white/10 hover:bg-white/20 transition disabled:opacity-50"
                        >
                            Annuleer
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={!canSubmit}
                            className={`flex-[2] py-3 rounded-xl font-bold transition-all ${
                                canSubmit
                                    ? 'bg-tal-gold text-tal-teal-dark hover:scale-[1.01] hover:shadow-lg'
                                    : 'bg-white/10 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            {loading
                                ? 'Bezig met opslaan…'
                                : selectedFinaliteit && selectedJaargang
                                    ? `💾 Opslaan — ${selectedFinaliteit} ${selectedJaargang}`
                                    : 'Kies finaliteit + jaargang'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KlasSettingsModal;
