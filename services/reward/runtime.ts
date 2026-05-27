export type RewardModeName = 'dragon' | 'snake'
export type RewardThemeName = 'ember' | 'aurora' | 'forest' | 'midnight' | 'sunrise'
export type RewardDifficultyName = 'easy' | 'normal' | 'hard'

export type RewardRuntimeConfig = {
  mode?: RewardModeName
  theme?: RewardThemeName
  difficulty?: RewardDifficultyName
  text?: string
  showPanel?: boolean
  showClose?: boolean
  autoStartSnake?: boolean
  hideNav?: boolean
  compactHud?: boolean
}

export type RewardRuntimeMessage =
  | { type: 'hlc-reward-ready' }
  | { type: 'hlc-reward-complete'; mode: RewardModeName; score?: number }
  | { type: 'hlc-reward-close' }
  | { type: 'hlc-reward-config'; payload: RewardRuntimeConfig }

const SESSION_PREFIX = 'hlc-reward-session-'
const REWARD_MESSAGE_TYPES = new Set<RewardRuntimeMessage['type']>([
  'hlc-reward-ready',
  'hlc-reward-complete',
  'hlc-reward-close',
  'hlc-reward-config',
])

function sanitizeBool(value: unknown) {
  return typeof value === 'boolean' ? value : undefined
}

function sanitizeString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function sanitizeMode(value: unknown) {
  return value === 'dragon' || value === 'snake' ? value : undefined
}

function sanitizeTheme(value: unknown) {
  return value === 'ember'
    || value === 'aurora'
    || value === 'forest'
    || value === 'midnight'
    || value === 'sunrise'
    ? value
    : undefined
}

function sanitizeDifficulty(value: unknown) {
  return value === 'easy' || value === 'normal' || value === 'hard' ? value : undefined
}

export function getRewardSessionStorageKey(id: string) {
  return `${SESSION_PREFIX}${id}`
}

export function sanitizeRewardRuntimeConfig(value: unknown): RewardRuntimeConfig {
  if (!value || typeof value !== 'object') return {}
  const input = value as Record<string, unknown>
  const text = sanitizeString(input.text)
  return {
    mode: sanitizeMode(input.mode),
    theme: sanitizeTheme(input.theme),
    difficulty: sanitizeDifficulty(input.difficulty),
    text: text ? text.slice(0, 12000) : undefined,
    showPanel: sanitizeBool(input.showPanel),
    showClose: sanitizeBool(input.showClose),
    autoStartSnake: sanitizeBool(input.autoStartSnake),
    hideNav: sanitizeBool(input.hideNav),
    compactHud: sanitizeBool(input.compactHud),
  }
}

export function mergeRewardRuntimeConfig(
  base: RewardRuntimeConfig | undefined,
  incoming: RewardRuntimeConfig | undefined,
) {
  return sanitizeRewardRuntimeConfig({
    ...(base || {}),
    ...(incoming || {}),
  })
}

export function readRewardRuntimeConfigFromLocation(loc: Location = location) {
  const url = new URL(loc.href)
  const embed = url.searchParams.get('embed') === '1'
  const sessionId = url.searchParams.get('rewardSession') || ''
  let sessionConfig: RewardRuntimeConfig = {}

  if (embed && sessionId) {
    try {
      const raw = sessionStorage.getItem(getRewardSessionStorageKey(sessionId))
      if (raw) sessionConfig = sanitizeRewardRuntimeConfig(JSON.parse(raw))
    } catch {}
  }

  return {
    embed,
    sessionId,
    config: mergeRewardRuntimeConfig(sessionConfig, {
      mode: sanitizeMode(url.searchParams.get('mode')),
    }),
  }
}

export function isRewardRuntimeMessage(value: unknown): value is RewardRuntimeMessage {
  if (!value || typeof value !== 'object') return false
  const type = (value as { type?: unknown }).type
  return typeof type === 'string' && REWARD_MESSAGE_TYPES.has(type as RewardRuntimeMessage['type'])
}
