// --- APP SETTINGS ---

export const DEFAULT_WORDS_PER_SESSION = 20;
export const MIN_WORDS_PER_SESSION = 20;
export const MAX_WORDS_PER_SESSION = 40;
export const STORY_MODE_UNLOCK_THRESHOLD = 1000;

// Session length options for UI (used in both Algemeen and Vakspecifiek modes)
export const SESSION_LENGTH_OPTIONS = [
    { name: 'Basis', words: 20, emoji: '📚' },
    { name: 'Standaard', words: 30, emoji: '💪' },
    { name: 'Intensief', words: 40, emoji: '🧠' },
];
