import {
  createRewardOverlay,
  getDefaultRewardPageUrl,
  showRewardOverlay,
  type RewardOverlayController,
  type RewardOverlayOptions,
} from './reward-embed'
import {
  REWARD_PRESET_CARDS,
  buildCourseCompleteReward,
  buildRewardPreset,
  buildSupportMilestoneReward,
  buildTeamStreakReward,
  type CourseCompletePresetInput,
  type RewardPresetCard,
  type RewardPresetKind,
  type SupportMilestonePresetInput,
  type TeamStreakPresetInput,
} from './reward-presets'
import type {
  RewardDifficultyName,
  RewardModeName,
  RewardRuntimeConfig,
  RewardThemeName,
} from './reward-runtime'

export type {
  CourseCompletePresetInput,
  RewardOverlayController,
  RewardOverlayOptions,
  RewardPresetCard,
  RewardPresetKind,
  RewardRuntimeConfig,
  RewardDifficultyName,
  RewardModeName,
  RewardThemeName,
  SupportMilestonePresetInput,
  TeamStreakPresetInput,
}

export {
  REWARD_PRESET_CARDS,
  buildCourseCompleteReward,
  buildRewardPreset,
  buildSupportMilestoneReward,
  buildTeamStreakReward,
  createRewardOverlay,
  getDefaultRewardPageUrl,
  showRewardOverlay,
}

export function showCourseCompleteReward(
  input: CourseCompletePresetInput = {},
  overrides: RewardOverlayOptions = {},
): RewardOverlayController {
  return createRewardOverlay({
    ...buildCourseCompleteReward(input),
    ...overrides,
  })
}

export function showSupportMilestoneReward(
  input: SupportMilestonePresetInput = {},
  overrides: RewardOverlayOptions = {},
): RewardOverlayController {
  return createRewardOverlay({
    ...buildSupportMilestoneReward(input),
    ...overrides,
  })
}

export function showTeamStreakReward(
  input: TeamStreakPresetInput = {},
  overrides: RewardOverlayOptions = {},
): RewardOverlayController {
  return createRewardOverlay({
    ...buildTeamStreakReward(input),
    ...overrides,
  })
}
