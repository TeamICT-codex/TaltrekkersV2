import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Finaliteit, Jaargang } from '../types';

interface OnboardingKlasProps {
    onComplete: () => void;
}

interface FinaliteitOption {
    id: Finaliteit;
    name: string;
    short: string;
    description: string;
    emoji: string;
}

const FINALITEIT_OPTIES: FinaliteitOption[] = [
    {
        id: 'AF',
        name: 'Arbeidsfinaliteit',
        short: 'AF',
        description: 'Klaar voor de arbeidsmarkt',
        emoji: '🛠️',
    },
    {
        id: 'DF',
        name: 'Dubbele finaliteit',
        short: 'DF',
        description: 'Werk of hoger onderwijs',
        emoji: '🎯',
    },
    {
        id: 'OKAN',
        name: 'OKAN',
        short: 'OKAN',
        description: 'Onthaalonderwijs anderstaligen',
        emoji: '🌍',
    },
];

const JAARGANGEN_PER_FINALITEIT: Record<Finaliteit, Jaargang[]> = {
    AF: ['3e', '4e', '5e', '5 Duaal', '6e', '6 Duaal', '7e'],
    DF: ['3e', '4e', '5e', '6e'],
    OKAN: ['Fase 1', 'Fase 2', 'Fase 3', 'Fase 4'],
};

const OnboardingKlas: React.FC<OnboardingKlasProps> = ({ onComplete }) => {
    const { selectedStudent, setKlasInfo, setNativeLanguage } = useAuth();
    const [selectedFinaliteit, setSelectedFinaliteit] = useState<Finaliteit | null>(null);
    const [selectedJaargang, setSelectedJaargang] = useState<Jaargang | null>(null);
    const [nativeLanguageInput, setNativeLanguageInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Voornaam isoleren — "Thomas Aelbrecht" → "Thomas"
    const firstName = selectedStudent?.name?.split(' ')[0] || 'leerling';

    const handleFinaliteitClick = (f: Finaliteit) => {
        setSelectedFinaliteit(f);
        // Reset jaargang bij wisselen finaliteit — anders kan een onmogelijke combinatie ontstaan
        setSelectedJaargang(null);
        setError(null);
    };

    const handleSubmit = async () => {
        if (!selectedFinaliteit || !selectedJaargang) return;
        setLoading(true);
        setError(null);

        // 1. Klas-info opslaan (verplicht)
        const klasResult = await setKlasInfo(selectedFinaliteit, selectedJaargang);
        if (!klasResult.success) {
            setLoading(false);
            setError(klasResult.error || 'Er ging iets mis bij het opslaan. Probeer opnieuw.');
            return;
        }

        // 2. Moedertaal opslaan (optioneel) — alleen als ingevuld.
        // Een fout hier mag de onboarding niet blokkeren.
        const trimmed = nativeLanguageInput.trim();
        if (trimmed) {
            const langResult = await setNativeLanguage(trimmed);
            if (!langResult.success) {
                console.warn('Kon moedertaal niet opslaan:', langResult.error);
            }
        }

        setLoading(false);
        onComplete();
    };

    const canSubmit = selectedFinaliteit !== null && selectedJaargang !== null && !loading;

    return (
        <div className="max-w-3xl mx-auto bg-tal-teal text-white rounded-3xl shadow-xl p-6 md:p-10 animate-fade-in">
            <div className="mb-8">
                <h1 className="text-3xl md:text-4xl font-bold mb-2">
                    Welkom, {firstName}! 👋
                </h1>
                <p className="text-slate-200 text-base md:text-lg">
                    Voor we beginnen: in welke richting zit je? Zo tonen we meteen
                    de juiste woordenlijsten en hoef je dit later niet meer in te stellen.
                </p>
            </div>

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
                            <div className="text-3xl mb-2">{f.emoji}</div>
                            <div className="font-bold text-base mb-0.5">{f.name}</div>
                            <div className="text-xs text-slate-200 leading-snug">{f.description}</div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Stap 2: Jaargang (afhankelijk van finaliteit) */}
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

            {/* Stap 3: Moedertaal (optioneel, alleen na finaliteit + jaargang) */}
            {selectedFinaliteit && selectedJaargang && (
                <div className="mb-6 animate-fade-in">
                    <label htmlFor="native-language" className="block font-semibold text-white mb-2 text-sm">
                        3. Wat is je moedertaal? <span className="text-slate-300 font-normal">(optioneel)</span>
                    </label>
                    <input
                        id="native-language"
                        type="text"
                        value={nativeLanguageInput}
                        onChange={e => setNativeLanguageInput(e.target.value)}
                        placeholder="bv. Frans, Arabisch, Turks, Roemeens…"
                        className="w-full px-4 py-3 rounded-xl bg-black/20 border border-white/10 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-tal-purple focus:bg-black/30 transition"
                        maxLength={50}
                    />
                    <p className="mt-1.5 text-xs text-slate-300">
                        💡 Hiermee kunnen we de AI-uitleg afstemmen op jouw taal. Je kan dit later altijd wijzigen.
                    </p>
                </div>
            )}

            {/* Foutmelding */}
            {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-400/40 text-red-100 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {/* Bevestigingsknop */}
            <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={`w-full py-4 rounded-2xl font-bold text-lg transition-all ${
                    canSubmit
                        ? 'bg-tal-gold text-tal-teal-dark hover:scale-[1.01] hover:shadow-lg'
                        : 'bg-white/10 text-slate-400 cursor-not-allowed'
                }`}
            >
                {loading
                    ? 'Bezig met opslaan…'
                    : selectedFinaliteit && selectedJaargang
                        ? `✅ Klaar — ${selectedFinaliteit} ${selectedJaargang}`
                        : 'Kies eerst finaliteit + jaargang'}
            </button>

            <p className="mt-4 text-xs text-slate-300 text-center">
                💡 Je kan dit later altijd wijzigen via je profiel.
            </p>
        </div>
    );
};

export default OnboardingKlas;
