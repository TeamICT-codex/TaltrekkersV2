import { createRewardOverlay, getDefaultRewardPageUrl, showRewardOverlay, type RewardOverlayController, type RewardOverlayOptions } from './reward-embed';
import { REWARD_PRESET_CARDS, buildCourseCompleteReward, buildRewardPreset, buildSupportMilestoneReward, buildTeamStreakReward, type CourseCompletePresetInput, type RewardPresetCard, type RewardPresetKind, type SupportMilestonePresetInput, type TeamStreakPresetInput } from './reward-presets';
import type { RewardDifficultyName, RewardModeName, RewardRuntimeConfig, RewardThemeName } from './reward-runtime';
export type { CourseCompletePresetInput, RewardOverlayController, RewardOverlayOptions, RewardPresetCard, RewardPresetKind, RewardRuntimeConfig, RewardDifficultyName, RewardModeName, RewardThemeName, SupportMilestonePresetInput, TeamStreakPresetInput, };
export { REWARD_PRESET_CARDS, buildCourseCompleteReward, buildRewardPreset, buildSupportMilestoneReward, buildTeamStreakReward, createRewardOverlay, getDefaultRewardPageUrl, showRewardOverlay, };
export declare function showCourseCompleteReward(input?: CourseCompletePresetInput, overrides?: RewardOverlayOptions): RewardOverlayController;
export declare function showSupportMilestoneReward(input?: SupportMilestonePresetInput, overrides?: RewardOverlayOptions): RewardOverlayController;
export declare function showTeamStreakReward(input?: TeamStreakPresetInput, overrides?: RewardOverlayOptions): RewardOverlayController;
