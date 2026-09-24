// Berichtenprotocol tussen de host-app (TALent voor Taal) en de Sneek-iframe.
//
// Compatibel met services/reward/embed.ts:
//   host → game : sessionStorage['hlc-reward-session-<id>'] + postMessage 'hlc-reward-config'
//   game → host : 'hlc-reward-ready' | 'hlc-reward-started' | 'hlc-reward-complete' | 'hlc-reward-close'
//
// 'hlc-reward-started' is nieuw: de host trekt pas een token af wanneer de
// leerling echt begint te spelen (niet bij openen, niet als laden mislukt).

import { sanitizeWords, type WordEntry } from './words';

export type ThemeName = 'aurora' | 'ember' | 'forest' | 'midnight' | 'sunrise';
export type GameMode = 'rustig' | 'uitdaging';

export const ACCENTS: Record<ThemeName, string> = {
  aurora: '#2d7a7b', // TALent-teal (merkkleur van de app)
  ember: '#b5402c',
  forest: '#4f6b3a',
  midnight: '#3f4a8a',
  sunrise: '#b8506f',
};

export interface Best {
  rustig: number;
  uitdaging: number;
}

export interface SneekConfig {
  theme: ThemeName;
  text: string;
  words: WordEntry[];
  goldSnake: boolean;
  rounds: number;
  visitSeconds: number;
  best: Best | null;
  mode: GameMode | null;
  /** Hoe verdien je een nieuw token — komt van de host (één bron voor de drempel). */
  earnHint: string;
  /** false = geluid volledig uit (bv. instelling van de leerkracht); de knop verdwijnt. */
  soundAllowed: boolean;
}

export const DEFAULT_CONFIG: SneekConfig = {
  theme: 'aurora',
  text: '',
  words: [],
  goldSnake: false,
  rounds: 3,
  visitSeconds: 300,
  best: null,
  mode: null,
  earnHint: 'Verdien een nieuw Sneek-token met een sterke oefensessie.',
  soundAllowed: true,
};

export interface RoundSummary {
  score: number;
  words: string[];
  reason: string;
}

export interface CompletePayload {
  mode: 'snake';
  gameMode: GameMode;
  /** Beste ronde van dit bezoek — dit is de "score" die de host als record bewaart. */
  score: number;
  total: number;
  rounds: RoundSummary[];
  words: string[];
  durationMs: number;
}

type OutMessage =
  | { type: 'hlc-reward-ready' }
  | { type: 'hlc-reward-started' }
  | ({ type: 'hlc-reward-complete' } & CompletePayload)
  | { type: 'hlc-reward-close' };

const SESSION_PREFIX = 'hlc-reward-session-';

const isTheme = (v: unknown): v is ThemeName =>
  v === 'aurora' || v === 'ember' || v === 'forest' || v === 'midnight' || v === 'sunrise';

const intIn = (v: unknown, lo: number, hi: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(hi, Math.max(lo, v))) : undefined;

/** Enkel gekende velden, enkel geldige waarden. Alles wat van buiten komt is data, geen code. */
export function sanitizeConfig(raw: unknown): Partial<SneekConfig> {
  if (!raw || typeof raw !== 'object') return {};
  const r = raw as Record<string, unknown>;
  const out: Partial<SneekConfig> = {};
  if (isTheme(r.theme)) out.theme = r.theme;
  if (typeof r.text === 'string') out.text = r.text.replace(/\s+/g, ' ').trim().slice(0, 280);
  if (Array.isArray(r.words)) out.words = sanitizeWords(r.words);
  if (typeof r.goldSnake === 'boolean') out.goldSnake = r.goldSnake;
  if (typeof r.soundAllowed === 'boolean') out.soundAllowed = r.soundAllowed;
  const rounds = intIn(r.rounds, 1, 5);
  if (rounds !== undefined) out.rounds = rounds;
  const secs = intIn(r.visitSeconds, 30, 900);
  if (secs !== undefined) out.visitSeconds = secs;
  if (r.best && typeof r.best === 'object') {
    const b = r.best as Record<string, unknown>;
    out.best = { rustig: intIn(b.rustig, 0, 1e7) ?? 0, uitdaging: intIn(b.uitdaging, 0, 1e7) ?? 0 };
  }
  if (r.gameMode === 'rustig' || r.gameMode === 'uitdaging') out.mode = r.gameMode;
  if (typeof r.earnHint === 'string') {
    const hint = r.earnHint.replace(/\s+/g, ' ').trim().slice(0, 160);
    if (hint) out.earnHint = hint;
  }
  return out;
}

export interface EmbedInfo {
  embedded: boolean;
  sessionId: string;
  initial: Partial<SneekConfig>;
}

export function readEmbedInfo(): EmbedInfo {
  const url = new URL(location.href);
  const inFrame = (() => {
    try {
      return window.parent !== window;
    } catch {
      return true;
    }
  })();
  const embedded = url.searchParams.get('embed') === '1' && inFrame;
  const sessionId = (url.searchParams.get('rewardSession') || '').slice(0, 80);
  let initial: Partial<SneekConfig> = {};
  if (embedded && sessionId) {
    try {
      const rawJson = sessionStorage.getItem(SESSION_PREFIX + sessionId);
      if (rawJson) initial = sanitizeConfig(JSON.parse(rawJson));
    } catch {
      /* ongeldige of ontbrekende sessieconfig — defaults gebruiken */
    }
  }
  return { embedded, sessionId, initial };
}

export function postToHost(embedded: boolean, msg: OutMessage): void {
  if (!embedded) return;
  try {
    // Zelfde origin als de app: nooit '*' gebruiken.
    window.parent.postMessage(msg, location.origin);
  } catch {
    /* host niet bereikbaar */
  }
}

/** Luistert naar config-updates van de host (bv. woorden die later binnenkomen). */
export function listenForConfig(embedded: boolean, cb: (c: Partial<SneekConfig>) => void): void {
  if (!embedded) return;
  window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window.parent || e.origin !== location.origin) return;
    const d = e.data as { type?: unknown; payload?: unknown } | null;
    if (!d || d.type !== 'hlc-reward-config') return;
    cb(sanitizeConfig(d.payload));
  });
}
