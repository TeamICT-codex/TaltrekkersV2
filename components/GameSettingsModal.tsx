import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
    fetchGameSettings,
    updateGameSettings,
    GameTheme,
} from '../services/db';
import { refreshGameSettings } from '../hooks/useGameSettings';

interface GameSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const THEME_OPTIONS: Array<{ id: GameTheme; label: string; emoji: string }> = [
    { id: 'aurora',   label: 'Aurora — koel groen/blauw',   emoji: '🌌' },
    { id: 'ember',    label: 'Ember — warm oranje/rood',    emoji: '🔥' },
    { id: 'forest',   label: 'Forest — diep groen',         emoji: '🌲' },
    { id: 'midnight', label: 'Midnight — donkere paars',    emoji: '🌃' },
    { id: 'sunrise',  label: 'Sunrise — zacht roze/geel',   emoji: '🌅' },
];

const DEFAULT_SNAKE_TEXT =
    'Een korte ontspanning na goed werk!\n\nJe verdient een Sneek-token bij elke sessie waar je ≥ 80% goed scoort. Wissel het in voor een rondje slangetje vangen — even het hoofd leegmaken voor je verder oefent.';

const DEFAULT_DRAGON_TEXT =
    'Een grotere mijlpaal-beloning.\n\nElke 100 XP die je verdient levert een Droak-token op. Speel ermee om de woordendraak los te laten — een visuele beloning voor je werk.';

const GameSettingsModal: React.FC<GameSettingsModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [snakeText, setSnakeText] = useState('');
    const [dragonText, setDragonText] = useState('');
    const [snakeTheme, setSnakeTheme] = useState<GameTheme>('aurora');
    const [dragonTheme, setDragonTheme] = useState<GameTheme>('ember');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');

    // Laad bij open
    useEffect(() => {
        if (!isOpen) return;
        setError(null);
        setSaveStatus('idle');
        setLoading(true);
        fetchGameSettings().then(({ settings, error: fetchErr }) => {
            setLoading(false);
            if (fetchErr || !settings) {
                setError(fetchErr || 'Geen instellingen gevonden.');
                return;
            }
            setSnakeText(settings.snake_text ?? '');
            setDragonText(settings.dragon_text ?? '');
            setSnakeTheme(settings.snake_theme);
            setDragonTheme(settings.dragon_theme);
        });
    }, [isOpen]);

    const handleSave = async () => {
        if (!user) {
            setError('Niet ingelogd.');
            return;
        }
        setLoading(true);
        setError(null);
        const result = await updateGameSettings(user.id, {
            snake_text: snakeText.trim() || null,
            dragon_text: dragonText.trim() || null,
            snake_theme: snakeTheme,
            dragon_theme: dragonTheme,
        });
        setLoading(false);
        if (!result.success) {
            setError(result.error || 'Opslaan mislukt — heb je admin-rechten?');
            return;
        }
        // Forceer cache-refresh zodat RewardLauncher de nieuwe waarden ophaalt
        await refreshGameSettings();
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
    };

    const handleResetSnake = () => setSnakeText(DEFAULT_SNAKE_TEXT);
    const handleResetDragon = () => setDragonText(DEFAULT_DRAGON_TEXT);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-surface w-full max-w-2xl rounded-2xl shadow-2xl border border-themed overflow-hidden max-h-[92vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-tal-purple px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2 drop-shadow-sm">
                        <span>🎮</span>
                        <span>Game-instellingen</span>
                    </h2>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        aria-label="Sluiten"
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition disabled:opacity-50"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <p className="text-sm text-muted">
                        Pas de tekst en het kleurthema aan voor de Sneek en Droak beloningsgames.
                        Wijzigingen zijn meteen actief — geen rebuild nodig.
                    </p>

                    {/* SNEEK sectie */}
                    <section className="border border-themed rounded-2xl p-4 bg-tal-purple/5">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold text-base flex items-center gap-2">
                                <span>🐍</span> Sneek
                            </h3>
                            <button
                                type="button"
                                onClick={handleResetSnake}
                                disabled={loading}
                                className="text-[11px] text-tal-purple hover:underline"
                            >
                                ↺ Reset naar voorbeeld
                            </button>
                        </div>

                        <label className="block text-xs font-semibold mb-1 uppercase tracking-wider">Tekst in game</label>
                        <textarea
                            value={snakeText}
                            onChange={(e) => setSnakeText(e.target.value)}
                            disabled={loading}
                            rows={4}
                            placeholder={DEFAULT_SNAKE_TEXT}
                            maxLength={2000}
                            className="w-full px-3 py-2 border border-themed rounded-lg focus:outline-none focus:ring-2 focus:ring-tal-purple bg-surface text-sm resize-y"
                        />
                        <p className="text-[10px] text-muted mt-0.5">{snakeText.length} / 2000 tekens</p>

                        <label className="block text-xs font-semibold mt-3 mb-1 uppercase tracking-wider">Kleurthema</label>
                        <select
                            value={snakeTheme}
                            onChange={(e) => setSnakeTheme(e.target.value as GameTheme)}
                            disabled={loading}
                            className="w-full px-3 py-2 border border-themed rounded-lg focus:outline-none focus:ring-2 focus:ring-tal-purple bg-surface text-sm"
                        >
                            {THEME_OPTIONS.map(t => (
                                <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>
                            ))}
                        </select>
                    </section>

                    {/* DROAK sectie */}
                    <section className="border border-themed rounded-2xl p-4 bg-amber-500/5">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold text-base flex items-center gap-2">
                                <span>🐉</span> Droak
                            </h3>
                            <button
                                type="button"
                                onClick={handleResetDragon}
                                disabled={loading}
                                className="text-[11px] text-tal-purple hover:underline"
                            >
                                ↺ Reset naar voorbeeld
                            </button>
                        </div>

                        <label className="block text-xs font-semibold mb-1 uppercase tracking-wider">Tekst in game</label>
                        <textarea
                            value={dragonText}
                            onChange={(e) => setDragonText(e.target.value)}
                            disabled={loading}
                            rows={4}
                            placeholder={DEFAULT_DRAGON_TEXT}
                            maxLength={2000}
                            className="w-full px-3 py-2 border border-themed rounded-lg focus:outline-none focus:ring-2 focus:ring-tal-purple bg-surface text-sm resize-y"
                        />
                        <p className="text-[10px] text-muted mt-0.5">{dragonText.length} / 2000 tekens</p>

                        <label className="block text-xs font-semibold mt-3 mb-1 uppercase tracking-wider">Kleurthema</label>
                        <select
                            value={dragonTheme}
                            onChange={(e) => setDragonTheme(e.target.value as GameTheme)}
                            disabled={loading}
                            className="w-full px-3 py-2 border border-themed rounded-lg focus:outline-none focus:ring-2 focus:ring-tal-purple bg-surface text-sm"
                        >
                            {THEME_OPTIONS.map(t => (
                                <option key={t.id} value={t.id}>{t.emoji} {t.label}</option>
                            ))}
                        </select>
                    </section>

                    {error && (
                        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {error}
                        </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 py-3 rounded-xl font-semibold bg-black/5 hover:bg-black/10 transition disabled:opacity-50"
                        >
                            Sluiten
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={loading}
                            className="flex-[2] py-3 bg-tal-purple text-white font-bold rounded-xl hover:bg-tal-purple-dark transition disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <><span className="animate-spin">⏳</span> Opslaan…</>
                            ) : saveStatus === 'saved' ? (
                                <>✅ Opgeslagen!</>
                            ) : (
                                <>💾 Opslaan</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GameSettingsModal;
