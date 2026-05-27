import { type RewardRuntimeConfig } from './reward-runtime';
export type RewardOverlayOptions = RewardRuntimeConfig & {
    mountTo?: HTMLElement;
    pageUrl?: string;
    zIndex?: number;
    closeOnBackdrop?: boolean;
    width?: string;
    height?: string;
    onReady?: () => void;
    onComplete?: (payload: {
        mode: 'dragon' | 'snake';
        score?: number;
    }) => void;
    onClose?: () => void;
};
export type RewardOverlayController = {
    element: HTMLDivElement;
    iframe: HTMLIFrameElement;
    update: (next: RewardRuntimeConfig) => void;
    close: () => void;
};
export declare function getDefaultRewardPageUrl(): string;
export declare function createRewardOverlay(options?: RewardOverlayOptions): RewardOverlayController;
export declare function showRewardOverlay(options?: RewardOverlayOptions): RewardOverlayController;
