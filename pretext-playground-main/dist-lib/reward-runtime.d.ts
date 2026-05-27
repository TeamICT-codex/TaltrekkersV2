export type RewardModeName = 'dragon' | 'snake';
export type RewardThemeName = 'ember' | 'aurora' | 'forest' | 'midnight' | 'sunrise';
export type RewardDifficultyName = 'easy' | 'normal' | 'hard';
export type RewardRuntimeConfig = {
    mode?: RewardModeName;
    theme?: RewardThemeName;
    difficulty?: RewardDifficultyName;
    text?: string;
    showPanel?: boolean;
    showClose?: boolean;
    autoStartSnake?: boolean;
    hideNav?: boolean;
    compactHud?: boolean;
};
export type RewardRuntimeMessage = {
    type: 'hlc-reward-ready';
} | {
    type: 'hlc-reward-complete';
    mode: RewardModeName;
    score?: number;
} | {
    type: 'hlc-reward-close';
} | {
    type: 'hlc-reward-config';
    payload: RewardRuntimeConfig;
};
export declare function getRewardSessionStorageKey(id: string): string;
export declare function sanitizeRewardRuntimeConfig(value: unknown): RewardRuntimeConfig;
export declare function mergeRewardRuntimeConfig(base: RewardRuntimeConfig | undefined, incoming: RewardRuntimeConfig | undefined): RewardRuntimeConfig;
export declare function readRewardRuntimeConfigFromLocation(loc?: Location): {
    embed: boolean;
    sessionId: string;
    config: RewardRuntimeConfig;
};
export declare function isRewardRuntimeMessage(value: unknown): value is RewardRuntimeMessage;
