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

/**
 * Cloud-sync van de gamification stats (XP, streak, tokens, avatar)
 * tussen browser-localStorage en de `profiles`-tabel in Supabase.
 *
 * Workflow:
 *   1. Bij login: fetch stats uit DB en merge in lokale state.
 *      DB wint voor de gesyncte velden zodat een leerling die vanaf
 *      een ander apparaat inlogt zijn meest recente voortgang ziet.
 *   2. Bij elke setUserData mutatie: debounced upsert naar DB.
 *      Voorkomt netwerkstorm bij rapid updates (bv. tijdens een sessie).
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
            const grantBonus = !stats.welcome_bonus_granted;
            const bonusSnakeTokens = grantBonus ? WELCOME_BONUS_TOKENS : 0;

            setUserData(activeUserName, prev => {
                const base: UserData = prev ?? DEFAULT_USERDATA;
                return {
                    ...base,
                    points: stats.points,
                    streak: stats.streak,
                    lastPracticeDate: stats.last_practice_date,
                    snakeTokens: stats.snake_tokens + bonusSnakeTokens,
                    dragonTokens: stats.dragon_tokens,
                    lastXpRewardCheckpoint: stats.last_xp_reward_checkpoint,
                    avatarId: stats.avatar_id,
                };
            });

            if (grantBonus) {
                // Direct naar DB pushen — buiten de debounced write om — zodat
                // de flag écht éénmalig is. Anders zou de leerling op een ander
                // device de bonus opnieuw kunnen krijgen voor we klaar zijn.
                upsertProfileStats(user.id, {
                    welcome_bonus_granted: true,
                    snake_tokens: stats.snake_tokens + bonusSnakeTokens,
                });
                setWelcomeBonusJustGranted(true);
                lastWrittenRef.current = JSON.stringify({
                    ...stats,
                    snake_tokens: stats.snake_tokens + bonusSnakeTokens,
                    welcome_bonus_granted: true,
                });
            } else {
                lastWrittenRef.current = JSON.stringify(stats);
            }
            hydratedRef.current = true;
        });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, activeUserName]);

    // ────────── DEBOUNCED WRITE ──────────
    useEffect(() => {
        if (!user || !activeUserName || !activeUserData || !hydratedRef.current) return;

        const stats = {
            points: activeUserData.points ?? 0,
            streak: activeUserData.streak ?? 0,
            last_practice_date: activeUserData.lastPracticeDate ?? null,
            snake_tokens: activeUserData.snakeTokens ?? 0,
            dragon_tokens: activeUserData.dragonTokens ?? 0,
            last_xp_reward_checkpoint: activeUserData.lastXpRewardCheckpoint ?? 0,
            avatar_id: activeUserData.avatarId ?? 'default',
        };

        const serialized = JSON.stringify(stats);
        if (serialized === lastWrittenRef.current) return; // niets veranderd

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            upsertProfileStats(user.id, stats).then(({ success }) => {
                if (success) lastWrittenRef.current = serialized;
            });
        }, DEBOUNCE_MS);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, activeUserName, activeUserData]);

    return {
        welcomeBonusJustGranted,
        dismissWelcomeBonus: () => setWelcomeBonusJustGranted(false),
    };
}
