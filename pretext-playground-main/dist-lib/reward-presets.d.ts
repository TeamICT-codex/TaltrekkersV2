import type { RewardOverlayOptions } from './reward-embed';
export type RewardPresetKind = 'course-complete' | 'support-milestone' | 'team-streak';
export type RewardPresetCard = {
    kind: RewardPresetKind;
    label: string;
    summary: string;
    kicker: string;
};
export type CourseCompletePresetInput = {
    courseName?: string;
    learnerName?: string;
    schoolName?: string;
    nextUnlock?: string;
};
export type SupportMilestonePresetInput = {
    teamName?: string;
    solvedTickets?: number;
    scopeLabel?: string;
    nextGoal?: string;
};
export type TeamStreakPresetInput = {
    teamName?: string;
    streakDays?: number;
    schoolsReached?: number;
    focusLabel?: string;
};
export declare const REWARD_PRESET_CARDS: RewardPresetCard[];
export declare function buildCourseCompleteReward(input?: CourseCompletePresetInput): RewardOverlayOptions;
export declare function buildSupportMilestoneReward(input?: SupportMilestonePresetInput): RewardOverlayOptions;
export declare function buildTeamStreakReward(input?: TeamStreakPresetInput): RewardOverlayOptions;
export declare function buildRewardPreset(kind: RewardPresetKind): RewardOverlayOptions;
