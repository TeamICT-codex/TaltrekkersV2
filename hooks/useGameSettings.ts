import { useEffect, useState } from 'react';
import { fetchGameSettings, GameSettings } from '../services/db';

// Module-level cache zodat we niet bij elke RewardLauncher-render opnieuw
// fetchen. Wordt 1x gevuld bij eerste hook-call en gerefresht zodra
// `refreshGameSettings()` extern wordt aangeroepen (bv. na save in
// GameSettingsModal).
let cachedSettings: GameSettings | null = null;
let cachePromise: Promise<GameSettings | null> | null = null;
const subscribers = new Set<(s: GameSettings | null) => void>();

function loadSettings(force = false): Promise<GameSettings | null> {
    if (!force && cachedSettings) return Promise.resolve(cachedSettings);
    if (cachePromise && !force) return cachePromise;

    cachePromise = fetchGameSettings().then(({ settings }) => {
        cachedSettings = settings;
        subscribers.forEach(cb => cb(settings));
        cachePromise = null;
        return settings;
    });
    return cachePromise;
}

/** Forceer een fresh fetch — aanroepen na save in GameSettingsModal. */
export function refreshGameSettings(): Promise<GameSettings | null> {
    return loadSettings(true);
}

/**
 * Hook die de globale game-instellingen levert. Cached na eerste fetch
 * voor de hele app-lifecycle (refresh via refreshGameSettings).
 */
export function useGameSettings(): GameSettings | null {
    const [settings, setSettings] = useState<GameSettings | null>(cachedSettings);

    useEffect(() => {
        subscribers.add(setSettings);
        loadSettings();
        return () => {
            subscribers.delete(setSettings);
        };
    }, []);

    return settings;
}
