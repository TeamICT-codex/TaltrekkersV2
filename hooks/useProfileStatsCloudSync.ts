import { useEffect, useRef, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { UserData } from '../types';
import { fetchProfileStats, upsertProfileStats } from '../services/db';

const WELCOME_BONUS_TOKENS = 1;

type SetUserData = (
    userName: string,
    input: UserData | ((prev: UserData | undefined) => UserData),
) => void;

const DEFAULT_USERDATA: UserData = {
    masteredWords: 0,
    totalScore: 0,
    sessionHistory: [],
    learnedWords: {},
    streak: 0,
    lastPracticeDate: null,
    points: 0,
    avatarId: 'default',
};

const DEBOUNCE_MS = 1200;

/** De velden die we syncen, altijd in dezelfde volgorde (zodat JSON-vergelijken klopt). */
export interface SyncedStats {
    points: number;
    streak: number;
    last_practice_date: string | null;
    snake_tokens: number;
    dragon_tokens: number;
    last_xp_reward_checkpoint: number;
    avatar_id: string;
}

export function toSynced(s: Partial<SyncedStats>): SyncedStats {
    return {
        points: s.points ?? 0,
        streak: s.streak ?? 0,
        last_practice_date: s.last_practice_date ?? null,
        snake_tokens: s.snake_tokens ?? 0,
        dragon_tokens: s.dragon_tokens ?? 0,
        last_xp_reward_checkpoint: s.last_xp_reward_checkpoint ?? 0,
        avatar_id: s.avatar_id ?? 'default',
    };
}

function fromUserData(u: UserData): SyncedStats {
    return toSynced({
        points: u.points,
        streak: u.streak,
        last_practice_date: u.lastPracticeDate,
        snake_tokens: u.snakeTokens,
        dragon_tokens: u.dragonTokens,
        last_xp_reward_checkpoint: u.lastXpRewardCheckpoint,
        avatar_id: u.avatarId,
    });
}

// "Nog te versturen": lokale wijzigingen die de DB nog niet bevestigde.
// Overleeft herladen en sluiten; bij de volgende login wint dit van de DB.
const PENDING_PREFIX = 'taltrekkers_stats_pending_';

function readPending(userId: string): SyncedStats | null {
    try {
        const raw = localStorage.getItem(PENDING_PREFIX + userId);
        return raw ? toSynced(JSON.parse(raw) as Partial<SyncedStats>) : null;
    } catch {
        return null;
    }
}

function writePending(userId: string, serialized: string): void {
    try {
        localStorage.setItem(PENDING_PREFIX + userId, serialized);
    } catch {
        /* geen opslag beschikbaar — dan enkel de gewone sync */
    }
}

function clearPending(userId: string, serialized: string): void {
    try {
        // Enkel wissen als er intussen niets nieuwers klaarstaat.
        if (localStorage.getItem(PENDING_PREFIX + userId) === serialized) {
            localStorage.removeItem(PENDING_PREFIX + userId);
        }
    } catch {
        /* */
    }
}

/**
 * Wat gebruiken we bij het inloggen: de DB of de lokale, nog niet verstuurde waarden?
 *   - Staat er iets "nog te versturen", dan is dat nieuwer dan de DB (bv. token
 *     verdiend of uitgegeven en meteen herladen) → lokaal wint en gaat naar de DB.
 *   - Anders wint de DB (bv. inloggen op een ander toestel).
 * Welkomstbonus (eenmalig, server-vlag) komt er in beide gevallen bovenop.
 */
export function resolveHydration(
    db: SyncedStats & { welcome_bonus_granted?: boolean },
    pending: SyncedStats | null,
): { use: SyncedStats; pushToDb: boolean; grantBonus: boolean } {
    const grantBonus = !db.welcome_bonus_granted;
    const base = pending ?? toSynced(db);
    const use = grantBonus ? { ...base, snake_tokens: base.snake_tokens + WELCOME_BONUS_TOKENS } : base;
    return { use, pushToDb: !!pending || grantBonus, grantBonus };
}

/**
 * Cloud-sync van de gamification stats (XP, streak, tokens, avatar)
 * tussen browser-localStorage en de `profiles`-tabel in Supabase.
 *
 * Workflow:
 *   1. Bij login: fetch stats uit DB. De DB wint (ander toestel), BEHALVE als
 *      er lokaal nog wijzigingen "nog te versturen" staan — die zijn nieuwer
 *      (token verdiend/uitgegeven en meteen herladen) en gaan alsnog naar de DB.
 *   2. Bij elke setUserData mutatie: meteen lokaal markeren als "nog te
 *      versturen", dan debounced naar DB. Bij verlaten/verbergen van de pagina
 *      wordt meteen verstuurd. Pas na een geslaagde write verdwijnt de markering.
 *
 * Hydrate-flag voorkomt dat een write VÓÓR de eerste read de DB
 * overschrijft met stale localStorage-data.
 */
export function useProfileStatsCloudSync(
    user: User | null,
    activeUserName: string | undefined,
    activeUserData: UserData | undefined,
    setUserData: SetUserData,
): { welcomeBonusJustGranted: boolean; dismissWelcomeBonus: () => void } {
    const hydratedRef = useRef(false);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Bewaar wat we het laatst naar DB schreven; zo voorkomen we identical writes.
    const lastWrittenRef = useRef<string>('');
    // UI-trigger: true gedurende ~enkele seconden nadat we de welkomstbonus
    // hebben toegekend, zodat App.tsx een toast kan tonen.
    const [welcomeBonusJustGranted, setWelcomeBonusJustGranted] = useState(false);

    // ────────── HYDRATE ──────────
    useEffect(() => {
        hydratedRef.current = false;
        if (!user || !activeUserName) return;

        let cancelled = false;

        fetchProfileStats(user.id).then(({ stats, error }) => {
            if (cancelled) return;
            if (error || !stats) {
                // DB-stats niet beschikbaar (bv. migration nog niet gerund).
                // We laten de lokale state staan en activeren write-modus.
                hydratedRef.current = true;
                return;
            }

            // Welkomstbonus: éénmalig 1 Sneek-token cadeau bij eerste login.
            // Server-side flag voorkomt dat een leerling 'm op meerdere
            // devices opnieuw krijgt. Vooral motiverend bij de eerste sessie.
            const plan = resolveHydration(stats, readPending(user.id));
            const use = plan.use;

            setUserData(activeUserName, prev => {
                const base: UserData = prev ?? DEFAULT_USERDATA;
                return {
                    ...base,
                    points: use.points,
                    streak: use.streak,
                    lastPracticeDate: use.last_practice_date,
                    snakeTokens: use.snake_tokens,
                    dragonTokens: use.dragon_tokens,
                    lastXpRewardCheckpoint: use.last_xp_reward_checkpoint,
                    avatarId: use.avatar_id,
                };
            });

            const serialized = JSON.stringify(use);
            if (plan.pushToDb) {
                // Meteen naar de DB — buiten de debounce om. Bij de welkomstbonus
                // zodat de vlag écht éénmalig is; bij "nog te versturen" zodat
                // een verdiend of uitgegeven token niet verloren gaat.
                writePending(user.id, serialized);
                upsertProfileStats(user.id, plan.grantBonus ? { ...use, welcome_bonus_granted: true } : use)
                    .then(({ success }) => { if (success) clearPending(user.id, serialized); });
            }
            if (plan.grantBonus) setWelcomeBonusJustGranted(true);
            lastWrittenRef.current = serialized;
            hydratedRef.current = true;
        });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, activeUserName]);

    // ────────── DEBOUNCED WRITE ──────────
    const pendingWriteRef = useRef<{ userId: string; stats: SyncedStats; serialized: string } | null>(null);

    const flush = () => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        const job = pendingWriteRef.current;
        if (!job) return;
        pendingWriteRef.current = null;
        upsertProfileStats(job.userId, job.stats).then(({ success }) => {
            if (success) clearPending(job.userId, job.serialized);
        });
    };

    useEffect(() => {
        if (!user || !activeUserName || !activeUserData || !hydratedRef.current) return;

        const stats = fromUserData(activeUserData);
        const serialized = JSON.stringify(stats);
        if (serialized === lastWrittenRef.current) return; // niets veranderd

        // Meteen lokaal markeren als "nog te versturen": zo overleeft een
        // verdiend/uitgegeven token een snelle herlaad of een gesloten tab.
        writePending(user.id, serialized);
        lastWrittenRef.current = serialized;
        pendingWriteRef.current = { userId: user.id, stats, serialized };

        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(flush, DEBOUNCE_MS);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, activeUserName, activeUserData]);

    // Pagina verlaten/verbergen: niet wachten op de debounce.
    useEffect(() => {
        const onHide = () => { if (pendingWriteRef.current) flush(); };
        const onVisibility = () => { if (document.visibilityState === 'hidden') onHide(); };
        window.addEventListener('pagehide', onHide);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            window.removeEventListener('pagehide', onHide);
            document.removeEventListener('visibilitychange', onVisibility);
            onHide(); // uitloggen/unmount: wat nog klaarstaat meteen versturen
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        welcomeBonusJustGranted,
        dismissWelcomeBonus: () => setWelcomeBonusJustGranted(false),
    };
}
