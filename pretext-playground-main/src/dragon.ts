import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext'
import {
  CUSTOM_CONTENT_EVENT,
  CUSTOM_CONTENT_STORAGE_KEY,
  getDefaultContentText,
  getResolvedContentPack,
  isDefaultContentText,
  resetCustomContentText,
  saveCustomContentText,
  type ResolvedContentPack,
} from './content'
import {
  isRewardRuntimeMessage,
  mergeRewardRuntimeConfig,
  readRewardRuntimeConfigFromLocation,
  sanitizeRewardRuntimeConfig,
  type RewardRuntimeConfig,
} from './reward-runtime'

// ─── Config (mutated by UI panel) ───────────────────────────

export const cfg = {
  dragonSegments: 40,            // was 60 — minder segmenten = sneller renderen
  dragonSpeed: 0.18,
  dragonScale: 1.0,
  autoPerformance: true,
  lowPerformance: true,          // standaard AAN voor school-chromebooks
  showWings: true,
  showSpines: true,
  pushForce: 6,
  springStrength: 0.015,
  damping: 0.93,
  burnGravity: 0.8,
  fireRadius: 120,
  fireForce: 25,
  screenShake: false,            // shake uit op zwakkere devices — visuele rust
  showEmbers: true,              // embers laten staan (engine verwacht initialisatie)
  showParticles: true,           // particles laten staan (engine verwacht initialisatie)
  showRunes: true,               // runes laten staan
  showCursor: true,
  textOpacity: 1.0,
  showEnemies: true,
  enemyCount: 8,
  enemySpeed: 0.6,
}

const PRESETS: Record<string, Partial<typeof cfg>> = {
  Default: {},
  Gentle: { dragonSpeed: 0.10, pushForce: 5, fireForce: 10, fireRadius: 60, screenShake: false, burnGravity: 0.2, springStrength: 0.03 },
  Chaos: { pushForce: 25, fireForce: 50, fireRadius: 200, burnGravity: 2.5, springStrength: 0.005, damping: 0.96, screenShake: true },
  Zen: { showParticles: false, showEmbers: false, screenShake: false, showRunes: false, pushForce: 4, fireForce: 8, springStrength: 0.04, burnGravity: 0 },
  Eco: { lowPerformance: true, showParticles: false, showEmbers: false, showRunes: false, showEnemies: false, screenShake: false },
  Tiny: { dragonSegments: 20, dragonScale: 0.6, fireRadius: 50, pushForce: 6 },
  Leviathan: { dragonSegments: 80, dragonScale: 2.0, dragonSpeed: 0.08, pushForce: 20, fireRadius: 180 },
}
const DEFAULT_CFG = { ...cfg }

type RGB = readonly [number, number, number]
type ThemeName = 'ember' | 'aurora' | 'forest' | 'midnight' | 'sunrise'

type Theme = {
  label: string
  accent: string
  accentStrong: string
  accentSoft: string
  accentGlow: string
  pageBg: string
  bgTop: string
  bgBottom: string
  bgGlow: string
  surface: string
  surfaceStrong: string
  surfaceHover: string
  surfaceSoft: string
  surfaceSofter: string
  surfaceSoftest: string
  border: string
  borderSoft: string
  borderSubtle: string
  track: string
  thumb: string
  thumbHover: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  textDim: string
  textFaint: string
  navTitle: string
  hero: string
  heading: string
  body: string
  spotlight: string
  code: string
  quote: string
  list: string
  footer: string
  tunnel: string
  rune: string
  cursor: string
  cursorHot: string
  dragonGlow: string
  dragonHead: RGB
  dragonHeadHot: RGB
  dragonBodyStart: RGB
  dragonBodyEnd: RGB
  emberColors: readonly string[]
  particleStart: RGB
  particleMid: RGB
  particleEnd: RGB
  enemyColors: readonly string[]
  score: string
  scoreFlash: string
}

const THEMES: Record<ThemeName, Theme> = {
  ember: {
    label: 'Ember',
    accent: '#ff8b4a',
    accentStrong: '#ff6a2b',
    accentSoft: 'rgba(255,106,43,0.15)',
    accentGlow: 'rgba(255,139,74,0.18)',
    pageBg: '#0a0807',
    bgTop: '#1b0f0a',
    bgBottom: '#050506',
    bgGlow: 'rgba(255,142,82,0.14)',
    surface: 'rgba(22,18,16,0.85)',
    surfaceStrong: 'rgba(18,14,12,0.94)',
    surfaceHover: 'rgba(32,26,22,0.96)',
    surfaceSoft: 'rgba(255,255,255,0.04)',
    surfaceSofter: 'rgba(255,255,255,0.06)',
    surfaceSoftest: 'rgba(255,255,255,0.09)',
    border: '#3a2a22',
    borderSoft: '#2d221d',
    borderSubtle: '#1d1612',
    track: '#3b2d26',
    thumb: '#d2a17f',
    thumbHover: '#ffd2b6',
    textPrimary: '#ddd3cb',
    textSecondary: '#ab9f95',
    textMuted: '#80756f',
    textDim: '#665c56',
    textFaint: '#4c4340',
    navTitle: '#5c4a3e',
    hero: '#2b1712',
    heading: '#f2e6db',
    body: '#c2b5ad',
    spotlight: '#f0a15d',
    code: '#ffb977',
    quote: '#d7a57b',
    list: '#ffb783',
    footer: '#a58c7a',
    tunnel: '#ff9b52',
    rune: '#ff7b47',
    cursor: '#ff9d63',
    cursorHot: '#ffd29a',
    dragonGlow: 'rgba(255,120,70,0.22)',
    dragonHead: [255, 194, 110],
    dragonHeadHot: [255, 108, 60],
    dragonBodyStart: [255, 144, 70],
    dragonBodyEnd: [92, 42, 22],
    emberColors: ['#ff7b47', '#ffb56c', '#ffd39a'],
    particleStart: [255, 247, 226],
    particleMid: [255, 161, 87],
    particleEnd: [133, 54, 24],
    enemyColors: ['#ff6d5e', '#ff9a66', '#68d9d4', '#ffc26d'],
    score: '#ffd39a',
    scoreFlash: '#ffb15e',
  },
  aurora: {
    label: 'Aurora',
    accent: '#5fd8c6',
    accentStrong: '#23b8a4',
    accentSoft: 'rgba(35,184,164,0.15)',
    accentGlow: 'rgba(95,216,198,0.16)',
    pageBg: '#05090a',
    bgTop: '#0b1718',
    bgBottom: '#040607',
    bgGlow: 'rgba(95,216,198,0.12)',
    surface: 'rgba(14,20,21,0.86)',
    surfaceStrong: 'rgba(11,16,18,0.94)',
    surfaceHover: 'rgba(22,31,34,0.96)',
    surfaceSoft: 'rgba(255,255,255,0.035)',
    surfaceSofter: 'rgba(255,255,255,0.055)',
    surfaceSoftest: 'rgba(255,255,255,0.085)',
    border: '#1f3837',
    borderSoft: '#172b2a',
    borderSubtle: '#12211f',
    track: '#284544',
    thumb: '#82cec1',
    thumbHover: '#b7f5eb',
    textPrimary: '#dbf5f1',
    textSecondary: '#a7c5c1',
    textMuted: '#78938f',
    textDim: '#5b7270',
    textFaint: '#435352',
    navTitle: '#3b5350',
    hero: '#11302e',
    heading: '#edfffd',
    body: '#bfd4d2',
    spotlight: '#75ddd5',
    code: '#8ae8d8',
    quote: '#9dd9d0',
    list: '#90f0df',
    footer: '#86a6a2',
    tunnel: '#67e3d2',
    rune: '#3dd5c2',
    cursor: '#72efe0',
    cursorHot: '#d7fffb',
    dragonGlow: 'rgba(93,216,198,0.18)',
    dragonHead: [186, 253, 244],
    dragonHeadHot: [86, 223, 205],
    dragonBodyStart: [101, 222, 214],
    dragonBodyEnd: [26, 85, 84],
    emberColors: ['#45d1c0', '#89efe2', '#c3fffa'],
    particleStart: [235, 255, 252],
    particleMid: [102, 226, 214],
    particleEnd: [28, 96, 95],
    enemyColors: ['#59dcd0', '#8cc5ff', '#ffd86a', '#96f0d2'],
    score: '#cbfffa',
    scoreFlash: '#80efe2',
  },
  forest: {
    label: 'Forest',
    accent: '#a7c66b',
    accentStrong: '#76953f',
    accentSoft: 'rgba(118,149,63,0.15)',
    accentGlow: 'rgba(167,198,107,0.14)',
    pageBg: '#080906',
    bgTop: '#151a0d',
    bgBottom: '#050604',
    bgGlow: 'rgba(167,198,107,0.11)',
    surface: 'rgba(20,24,15,0.86)',
    surfaceStrong: 'rgba(16,19,12,0.94)',
    surfaceHover: 'rgba(29,34,22,0.96)',
    surfaceSoft: 'rgba(255,255,255,0.035)',
    surfaceSofter: 'rgba(255,255,255,0.055)',
    surfaceSoftest: 'rgba(255,255,255,0.085)',
    border: '#354027',
    borderSoft: '#28311d',
    borderSubtle: '#1a2114',
    track: '#404d2f',
    thumb: '#a9bc88',
    thumbHover: '#dbebc4',
    textPrimary: '#e2e8d7',
    textSecondary: '#b2b9a7',
    textMuted: '#838a79',
    textDim: '#666d5e',
    textFaint: '#4c5247',
    navTitle: '#59604f',
    hero: '#25301a',
    heading: '#f0f4e8',
    body: '#c9ceb9',
    spotlight: '#c5db7a',
    code: '#d8f09b',
    quote: '#c2b68a',
    list: '#d7e89f',
    footer: '#97907a',
    tunnel: '#b9d67e',
    rune: '#a7c66b',
    cursor: '#c8e58a',
    cursorHot: '#f1f8d7',
    dragonGlow: 'rgba(167,198,107,0.16)',
    dragonHead: [223, 238, 160],
    dragonHeadHot: [169, 202, 93],
    dragonBodyStart: [173, 201, 97],
    dragonBodyEnd: [71, 86, 36],
    emberColors: ['#aac76d', '#d4eb95', '#f0f9cf'],
    particleStart: [246, 250, 228],
    particleMid: [188, 214, 112],
    particleEnd: [82, 97, 40],
    enemyColors: ['#d49668', '#a7c66b', '#75c8b8', '#f0d779'],
    score: '#eef8d2',
    scoreFlash: '#d5e998',
  },
  midnight: {
    label: 'Midnight',
    accent: '#7ea8ff',
    accentStrong: '#4f7cff',
    accentSoft: 'rgba(79,124,255,0.16)',
    accentGlow: 'rgba(126,168,255,0.16)',
    pageBg: '#05070b',
    bgTop: '#0c1320',
    bgBottom: '#040508',
    bgGlow: 'rgba(126,168,255,0.12)',
    surface: 'rgba(15,18,26,0.86)',
    surfaceStrong: 'rgba(11,14,21,0.94)',
    surfaceHover: 'rgba(23,29,42,0.96)',
    surfaceSoft: 'rgba(255,255,255,0.035)',
    surfaceSofter: 'rgba(255,255,255,0.055)',
    surfaceSoftest: 'rgba(255,255,255,0.085)',
    border: '#2a3658',
    borderSoft: '#1f2944',
    borderSubtle: '#151c31',
    track: '#334267',
    thumb: '#8faad8',
    thumbHover: '#c6d5ff',
    textPrimary: '#e7edff',
    textSecondary: '#b4bfd8',
    textMuted: '#818ba6',
    textDim: '#646d87',
    textFaint: '#4a5165',
    navTitle: '#56607b',
    hero: '#1a2742',
    heading: '#f1f5ff',
    body: '#c7cee0',
    spotlight: '#8ab7ff',
    code: '#a7c1ff',
    quote: '#acc0f0',
    list: '#b6d6ff',
    footer: '#8f99b5',
    tunnel: '#8bb7ff',
    rune: '#6e92ff',
    cursor: '#9fc3ff',
    cursorHot: '#edf3ff',
    dragonGlow: 'rgba(107,151,255,0.18)',
    dragonHead: [214, 226, 255],
    dragonHeadHot: [103, 144, 255],
    dragonBodyStart: [121, 164, 255],
    dragonBodyEnd: [42, 61, 116],
    emberColors: ['#6f96ff', '#9fc3ff', '#d8e7ff'],
    particleStart: [240, 245, 255],
    particleMid: [120, 161, 255],
    particleEnd: [42, 63, 122],
    enemyColors: ['#8fc0ff', '#7ea8ff', '#91e1d7', '#ffcc7f'],
    score: '#dae8ff',
    scoreFlash: '#9dc0ff',
  },
  sunrise: {
    label: 'Sunrise',
    accent: '#ffb36a',
    accentStrong: '#ff8745',
    accentSoft: 'rgba(255,135,69,0.16)',
    accentGlow: 'rgba(255,179,106,0.16)',
    pageBg: '#0b0706',
    bgTop: '#22130c',
    bgBottom: '#060505',
    bgGlow: 'rgba(255,179,106,0.14)',
    surface: 'rgba(24,18,15,0.86)',
    surfaceStrong: 'rgba(19,14,12,0.94)',
    surfaceHover: 'rgba(35,26,22,0.96)',
    surfaceSoft: 'rgba(255,255,255,0.04)',
    surfaceSofter: 'rgba(255,255,255,0.06)',
    surfaceSoftest: 'rgba(255,255,255,0.09)',
    border: '#4b2f23',
    borderSoft: '#36231b',
    borderSubtle: '#231710',
    track: '#57382c',
    thumb: '#ffba8c',
    thumbHover: '#ffe0c8',
    textPrimary: '#f4e2d5',
    textSecondary: '#cfb3a3',
    textMuted: '#9f847a',
    textDim: '#7f655d',
    textFaint: '#5f4b44',
    navTitle: '#705047',
    hero: '#3a2017',
    heading: '#fff0e6',
    body: '#dbbeb1',
    spotlight: '#ffc081',
    code: '#ffd49c',
    quote: '#e4b085',
    list: '#ffcd97',
    footer: '#b89482',
    tunnel: '#ffc37e',
    rune: '#ff9c64',
    cursor: '#ffc48d',
    cursorHot: '#fff2de',
    dragonGlow: 'rgba(255,174,92,0.18)',
    dragonHead: [255, 227, 182],
    dragonHeadHot: [255, 142, 84],
    dragonBodyStart: [255, 183, 101],
    dragonBodyEnd: [125, 63, 35],
    emberColors: ['#ff9c64', '#ffc081', '#ffe2bc'],
    particleStart: [255, 248, 234],
    particleMid: [255, 184, 106],
    particleEnd: [148, 72, 38],
    enemyColors: ['#ff8f6a', '#ffb36a', '#7fd6c9', '#ffe08c'],
    score: '#ffe5c3',
    scoreFlash: '#ffc07e',
  },
}

const THEME_STORAGE_KEY = 'hlc-dragon-theme'
const SNAKE_DIFFICULTY_STORAGE_KEY = 'hlc-dragon-difficulty'
const rewardRuntimeState = readRewardRuntimeConfigFromLocation()
const isEmbeddedReward = rewardRuntimeState.embed
let activeRewardConfig: RewardRuntimeConfig = rewardRuntimeState.config

type AutoPerformanceProfile = {
  label: string
  lowPower: boolean
  reason: string
}

function detectAutoPerformanceProfile(): AutoPerformanceProfile {
  const nav = navigator as Navigator & {
    deviceMemory?: number
    userAgentData?: { platform?: string }
  }
  const userAgent = navigator.userAgent || ''
  const platform = String(nav.userAgentData?.platform || navigator.platform || '')
  const memory = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null
  const cores = typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : null
  const isChromeOs = /CrOS|Chromebook/i.test(userAgent) || /Chrome OS/i.test(platform)

  let score = 0
  const reasons: string[] = []

  if (isChromeOs) {
    score += 3
    reasons.push('ChromeOS')
  }
  if (memory !== null && memory <= 4) {
    score += 2
    reasons.push(`${memory}GB RAM`)
  }
  if (memory !== null && memory <= 2) score += 1
  if (cores !== null && cores <= 4) {
    score += 2
    reasons.push(`${cores} cores`)
  }
  if (cores !== null && cores <= 2) score += 1

  const lowPower = score >= 3
  const label = lowPower
    ? (isChromeOs ? 'auto Chromebook' : 'auto low power')
    : 'auto full'

  return {
    label,
    lowPower,
    reason: reasons.join(' · ') || 'browser heuristic',
  }
}

let autoPerformanceProfile = detectAutoPerformanceProfile()

function refreshAutoPerformanceProfile() {
  autoPerformanceProfile = detectAutoPerformanceProfile()
  return autoPerformanceProfile
}

function isLowPerformanceActive() {
  return cfg.lowPerformance || (cfg.autoPerformance && autoPerformanceProfile.lowPower)
}

function getPerformanceModeLabel() {
  if (cfg.lowPerformance) return 'manual low power'
  if (cfg.autoPerformance) return autoPerformanceProfile.label
  return 'manual full'
}

function getTargetDpr() {
  return isLowPerformanceActive() ? 1 : Math.min(window.devicePixelRatio || 1, 2)
}

function maxActiveParticles() {
  return isLowPerformanceActive() ? 56 : MAX_PARTICLES
}

function maxActiveEmbers() {
  return isLowPerformanceActive() ? 22 : MAX_EMBERS
}

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [
    clampChannel(a[0] + (b[0] - a[0]) * t),
    clampChannel(a[1] + (b[1] - a[1]) * t),
    clampChannel(a[2] + (b[2] - a[2]) * t),
  ]
}

function rgbString(color: RGB, alpha = 1) {
  return `rgba(${color[0]},${color[1]},${color[2]},${alpha})`
}

const storedTheme = (() => {
  if (activeRewardConfig.theme && Object.prototype.hasOwnProperty.call(THEMES, activeRewardConfig.theme)) {
    return activeRewardConfig.theme as ThemeName
  }
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved && Object.prototype.hasOwnProperty.call(THEMES, saved)) return saved as ThemeName
  } catch {}
  return 'ember' as ThemeName
})()

let activeThemeName: ThemeName = storedTheme
let activeTheme = THEMES[activeThemeName]

type PlayMode = 'dragon' | 'snake'

type SnakeDifficultyName = 'easy' | 'normal' | 'hard'

type SnakeDifficulty = {
  label: string
  captureRadiusMul: number
  laneWidthMul: number
  rearAllowance: number
  assistBites: number
  assistRadiusMul: number
  stepEveryMul: number
  minorGrowthEvery: number
  minorGrowthCap: number
  burstCount: number
  highlightBoost: number
}

type SnakeVictoryTreat = {
  x: number
  y: number
  emoji: string
  hue: number
  wobble: number
}

const SNAKE_DIFFICULTIES: Record<SnakeDifficultyName, SnakeDifficulty> = {
  easy: {
    label: 'Easy',
    captureRadiusMul: 1.75,
    laneWidthMul: 1.7,
    rearAllowance: 0.26,
    assistBites: 3,
    assistRadiusMul: 1.55,
    stepEveryMul: 1.2,
    minorGrowthEvery: 7,
    minorGrowthCap: 2,
    burstCount: 12,
    highlightBoost: 1.55,
  },
  normal: {
    label: 'Normal',
    captureRadiusMul: 1.35,
    laneWidthMul: 1.3,
    rearAllowance: 0.16,
    assistBites: 2,
    assistRadiusMul: 1.05,
    stepEveryMul: 1.08,
    minorGrowthEvery: 8,
    minorGrowthCap: 1,
    burstCount: 9,
    highlightBoost: 1.25,
  },
  hard: {
    label: 'Hard',
    captureRadiusMul: 1,
    laneWidthMul: 1,
    rearAllowance: 0.08,
    assistBites: 1,
    assistRadiusMul: 0,
    stepEveryMul: 1,
    minorGrowthEvery: 10,
    minorGrowthCap: 1,
    burstCount: 7,
    highlightBoost: 1,
  },
}

const PLAY_MODES: { name: PlayMode; label: string }[] = [
  { name: 'dragon', label: 'Dragon' },
  { name: 'snake', label: 'Snake' },
]

function getInitialModeFromLocation(): PlayMode {
  if (activeRewardConfig.mode === 'snake' || activeRewardConfig.mode === 'dragon') return activeRewardConfig.mode
  const mode = new URL(location.href).searchParams.get('mode')
  return mode === 'snake' ? 'snake' : 'dragon'
}

let activeMode: PlayMode = getInitialModeFromLocation()
const storedSnakeDifficulty = (() => {
  if (activeRewardConfig.difficulty && Object.prototype.hasOwnProperty.call(SNAKE_DIFFICULTIES, activeRewardConfig.difficulty)) {
    return activeRewardConfig.difficulty as SnakeDifficultyName
  }
  try {
    const saved = localStorage.getItem(SNAKE_DIFFICULTY_STORAGE_KEY)
    if (saved && Object.prototype.hasOwnProperty.call(SNAKE_DIFFICULTIES, saved)) return saved as SnakeDifficultyName
  } catch {}
  return 'hard' as SnakeDifficultyName
})()
let activeSnakeDifficultyName: SnakeDifficultyName = storedSnakeDifficulty
let activeSnakeDifficulty = SNAKE_DIFFICULTIES[activeSnakeDifficultyName]

function applyPreset(name: string) {
  Object.assign(cfg, DEFAULT_CFG, PRESETS[name] || {})
  rebuildDragon()
  resize()
  updateModeHint()
  syncUI()
}

// ─── Canvas (cap DPR to limit memory) ───────────────────────

const canvas = document.getElementById('c') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const navDroakEl = document.getElementById('tab-droak') as HTMLAnchorElement | null
const navSneekEl = document.getElementById('tab-sneek') as HTMLAnchorElement | null
// Cap DPR at 2 to avoid 4x+ memory on high-res displays
let dpr = getTargetDpr()
const NAV_H = isEmbeddedReward ? 0 : 44
let W = innerWidth, H = innerHeight - NAV_H

let initialized = false
function resize() {
  refreshAutoPerformanceProfile()
  dpr = getTargetDpr()
  W = innerWidth; H = innerHeight - NAV_H
  canvas.width = W * dpr; canvas.height = H * dpr
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  if (initialized) {
    buildTunnel()
    if (activeMode === 'snake') resetSnake()
    else layoutAllText()
  }
}
resize()
addEventListener('resize', resize)

// ─── Mouse ──────────────────────────────────────────────────

const mouse = { x: W / 2, y: H / 2 }
function clientToCanvasPoint(clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect()
  const x = ((clientX - rect.left) / Math.max(1, rect.width)) * W
  const y = ((clientY - rect.top) / Math.max(1, rect.height)) * H
  return {
    x: Math.max(0, Math.min(W, x)),
    y: Math.max(0, Math.min(H, y)),
  }
}

function setMouseFromClient(clientX: number, clientY: number) {
  const point = clientToCanvasPoint(clientX, clientY)
  mouse.x = point.x
  mouse.y = point.y
  return point
}

addEventListener('mousemove', (e) => { setMouseFromClient(e.clientX, e.clientY) })
addEventListener('touchmove', (e) => {
  const target = e.target as HTMLElement | null
  if (!target?.closest('#panel')) e.preventDefault()
  if (e.touches[0]) setMouseFromClient(e.touches[0].clientX, e.touches[0].clientY)
}, { passive: false })

const SNAKE_KEYS: Record<string, { x: number; y: number }> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  // QWERTY-letters
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
  // AZERTY-letters (Belgische/Franse layout): fysieke W-positie = z, A-positie = q
  z: { x: 0, y: -1 },
  q: { x: -1, y: 0 },
}

addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement | null
  if (target?.closest('input,textarea')) return
  if (activeMode !== 'snake') return

  if (!snakeAlive && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault()
    resetSnake()
    return
  }

  // Easter egg: ~35% kans bij spatie/enter tijdens actief spel.
  // Niet altijd — zo weet speler nooit wanneer iets verschijnt.
  // BELANGRIJK: snake blijft gewoon doorlopen, niets resetten hier.
  if (snakeAlive && snakeStarted && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault()
    if (!activeEasterEgg && Math.random() < 0.35) {
      triggerEasterEgg()
    }
    return
  }

  if (!snakeStarted && (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w' || e.key.toLowerCase() === 'z')) {
    // 'w' voor QWERTY-toetsenborden, 'z' voor AZERTY (fysieke W-positie)
    e.preventDefault()
    startSnake()
    return
  }

  const dir = SNAKE_KEYS[e.key] || SNAKE_KEYS[e.key.toLowerCase()]
  if (dir && snakeStarted) {
    e.preventDefault()
    queueSnakeDirection(dir.x, dir.y)
    return
  }
})

addEventListener('mousedown', (e) => {
  if (activeMode !== 'snake' || snakeStarted || !snakeAlive) return
  if ((e.target as HTMLElement).closest('#panel, #panel-toggle')) return
  const point = clientToCanvasPoint(e.clientX, e.clientY)
  if (pointInSnakeStartButton(point.x, point.y)) startSnake()
})
addEventListener('touchstart', (e) => {
  if (activeMode !== 'snake' || snakeStarted || !snakeAlive) return
  if ((e.target as HTMLElement).closest('#panel, #panel-toggle')) return
  const touch = e.touches[0]
  if (!touch) return
  const point = setMouseFromClient(touch.clientX, touch.clientY)
  if (pointInSnakeStartButton(point.x, point.y)) startSnake()
})

// ─── Screen shake ───────────────────────────────────────────

let shakeIntensity = 0, shakeX = 0, shakeY = 0
function triggerShake(intensity: number) {
  if (!cfg.screenShake) return
  shakeIntensity = Math.max(shakeIntensity, Math.min(intensity, 8))
}
function updateShake() {
  if (shakeIntensity > 0.1) {
    shakeX = (Math.random() - 0.5) * shakeIntensity
    shakeY = (Math.random() - 0.5) * shakeIntensity
    shakeIntensity *= 0.85
  } else { shakeX = 0; shakeY = 0; shakeIntensity = 0 }
}

// ─── Letters (SoA — struct-of-arrays for cache/memory efficiency) ─

// Instead of an array of objects, use parallel typed arrays.
// This eliminates per-letter object overhead and GC pressure.
const MAX_LETTERS = 2000
let letterCount = 0

// Per-letter data in typed arrays (no object allocation per letter)
const lHomeX = new Float32Array(MAX_LETTERS)
const lHomeY = new Float32Array(MAX_LETTERS)
const lX = new Float32Array(MAX_LETTERS)
const lY = new Float32Array(MAX_LETTERS)
const lVx = new Float32Array(MAX_LETTERS)
const lVy = new Float32Array(MAX_LETTERS)
const lAngle = new Float32Array(MAX_LETTERS)
const lAngVel = new Float32Array(MAX_LETTERS)
const lCharW = new Float32Array(MAX_LETTERS)
const lBaseAlpha = new Float32Array(MAX_LETTERS)
const lFontSize = new Float32Array(MAX_LETTERS)
const lBurnTimer = new Float32Array(MAX_LETTERS)
const lScaleMul = new Float32Array(MAX_LETTERS)
const lGravity = new Float32Array(MAX_LETTERS)
const lSnakeHideTimer = new Float32Array(MAX_LETTERS)
const lRevealTimer = new Float32Array(MAX_LETTERS)
const lCollectible = new Uint8Array(MAX_LETTERS)

// These can't be typed arrays (strings) — but we intern them to avoid duplication
const lChar: string[] = []
const lFont: string[] = []     // index into fontPool
const lColor: string[] = []    // index into colorPool

// ─── Embers + Particles — pooled with fixed max ────────────

const MAX_EMBERS = 60
let emberCount = 0
const emX = new Float32Array(MAX_EMBERS)
const emY = new Float32Array(MAX_EMBERS)
const emVx = new Float32Array(MAX_EMBERS)
const emVy = new Float32Array(MAX_EMBERS)
const emLife = new Float32Array(MAX_EMBERS)
const emSize = new Float32Array(MAX_EMBERS)
const emChar: string[] = new Array(MAX_EMBERS)
const emColor: string[] = new Array(MAX_EMBERS)
const emberChars = ['·', '•', '∘', '˚']
const emberColors = ['#ff6600', '#ffaa00', '#ff4400']

function spawnEmber(x: number, y: number) {
  if (!cfg.showEmbers || emberCount >= maxActiveEmbers()) return
  const i = emberCount++
  const emberPalette = activeTheme.emberColors
  const a = Math.random() * Math.PI * 2
  emX[i] = x; emY[i] = y
  emVx[i] = Math.cos(a) * (1 + Math.random() * 3)
  emVy[i] = Math.sin(a) * (1 + Math.random() * 3) - 2
  emLife[i] = 0.3 + Math.random() * 0.6
  emSize[i] = 4 + Math.random() * 7
  emChar[i] = emberChars[Math.random() * 4 | 0]
  emColor[i] = emberPalette[Math.random() * emberPalette.length | 0]
}

const MAX_PARTICLES = 150
let particleCount = 0
const pX = new Float32Array(MAX_PARTICLES)
const pY = new Float32Array(MAX_PARTICLES)
const pVx = new Float32Array(MAX_PARTICLES)
const pVy = new Float32Array(MAX_PARTICLES)
const pLife = new Float32Array(MAX_PARTICLES)
const pMaxLife = new Float32Array(MAX_PARTICLES)
const pSize = new Float32Array(MAX_PARTICLES)
const pChar: string[] = new Array(MAX_PARTICLES)
const pColor: string[] = new Array(MAX_PARTICLES)
const fireChars = '*✦✧⁕❋✺◌•∘˚⋆·'.split('')

type ChaosBomb = {
  x: number
  y: number
  targetY: number
  vy: number
  wobble: number
  hue: number
  state: 'falling' | 'ripple'
  ripple: number
  rippleMax: number
  life: number
}

const bombs: ChaosBomb[] = []
let bombCooldown = 0

function spawnSnakeEatBurst(x: number, y: number, fontSize: number, amount = activeSnakeDifficulty.burstCount) {
  const baseHue = (fontSize * 17 + snakeTierIndex * 41) % 360
  const burstChars = ['*', '✦', '✧', '◆', '◇', '•']
  const burstAmount = isLowPerformanceActive() ? Math.max(3, Math.ceil(amount * 0.45)) : amount
  for (let n = 0; n < burstAmount; n++) {
    if (particleCount >= maxActiveParticles()) break
    const i = particleCount++
    const angle = Math.random() * Math.PI * 2
    const speed = 1.8 + Math.random() * 4.8
    const hue = (baseHue + (Math.random() - 0.5) * 95 + n * 14) % 360
    pX[i] = x
    pY[i] = y
    pVx[i] = Math.cos(angle) * speed
    pVy[i] = Math.sin(angle) * speed - 0.5
    pLife[i] = 1
    pMaxLife[i] = 0.24 + Math.random() * 0.35
    pSize[i] = 6 + Math.random() * 10
    pChar[i] = burstChars[Math.random() * burstChars.length | 0]
    pColor[i] = `hsl(${Math.round((hue + 360) % 360)} 92% ${68 + Math.random() * 12}%)`
  }
}

function spawnBombBurst(x: number, y: number, hue: number, amount = 24) {
  const burstChars = ['✦', '✧', '◆', '◇', '◌', '*']
  for (let n = 0; n < amount; n++) {
    if (particleCount >= maxActiveParticles()) break
    const i = particleCount++
    const angle = Math.random() * Math.PI * 2
    const speed = 2.5 + Math.random() * 7.5
    pX[i] = x
    pY[i] = y
    pVx[i] = Math.cos(angle) * speed
    pVy[i] = Math.sin(angle) * speed - 0.8
    pLife[i] = 1
    pMaxLife[i] = 0.35 + Math.random() * 0.45
    pSize[i] = 8 + Math.random() * 16
    pChar[i] = burstChars[Math.random() * burstChars.length | 0]
    pColor[i] = `hsl(${Math.round((hue + n * 11 + (Math.random() - 0.5) * 42 + 360) % 360)} 95% ${66 + Math.random() * 14}%)`
  }
}

// ─── Text entries ───────────────────────────────────────────

type TextEntry = {
  text: string; font: string; fontSize: number; tone: TextTone; alpha: number
  yOffset: number; maxWidth: number; lineHeight: number
  style: 'heading' | 'body' | 'quote' | 'cjk' | 'code' | 'huge'
  column: 'left' | 'right' | 'center'
}

type TextTone = 'hero' | 'heading' | 'body' | 'spotlight' | 'code' | 'quote' | 'list' | 'footer'

function buildTextEntriesFromContent(content: ResolvedContentPack): TextEntry[] {
  return [
    { text: content.title, font: '"Courier New", monospace', fontSize: 96, tone: 'hero', alpha: 0.5, yOffset: -20, maxWidth: 1400, lineHeight: 108, style: 'huge', column: 'center' },
    { text: content.heading, font: '"Courier New", monospace', fontSize: 50, tone: 'heading', alpha: 1.0, yOffset: 106, maxWidth: 920, lineHeight: 60, style: 'heading', column: 'left' },
    { text: content.subheading, font: '"Courier New", monospace', fontSize: 18, tone: 'body', alpha: 0.75, yOffset: 178, maxWidth: 720, lineHeight: 26, style: 'body', column: 'left' },
    { text: content.vision, font: '"Courier New", monospace', fontSize: 14, tone: 'body', alpha: 0.65, yOffset: 242, maxWidth: 540, lineHeight: 21, style: 'body', column: 'left' },
    { text: content.spotlight, font: '"Courier New", monospace', fontSize: 16, tone: 'spotlight', alpha: 0.8, yOffset: 520, maxWidth: 560, lineHeight: 24, style: 'cjk', column: 'left' },
    { text: content.quote, font: '"Courier New", monospace', fontSize: 14, tone: 'quote', alpha: 0.65, yOffset: 146, maxWidth: 420, lineHeight: 21, style: 'quote', column: 'right' },
    { text: content.rightBody, font: '"Courier New", monospace', fontSize: 13, tone: 'body', alpha: 0.6, yOffset: 324, maxWidth: 400, lineHeight: 19, style: 'body', column: 'right' },
    { text: content.checklist.map((item, index) => `${String(index + 1).padStart(2, '0')} ${item}`).join('\n'), font: '"Courier New", monospace', fontSize: 13, tone: 'list', alpha: 0.6, yOffset: 648, maxWidth: 760, lineHeight: 19, style: 'code', column: 'center' },
  ]
}

let sharedContent = getResolvedContentPack(activeRewardConfig.text)
let textEntries: TextEntry[] = buildTextEntriesFromContent(sharedContent)

function resolveTextColor(tone: TextTone) {
  if (tone === 'hero') return activeTheme.hero
  if (tone === 'heading') return activeTheme.heading
  if (tone === 'spotlight') return activeTheme.spotlight
  if (tone === 'code') return activeTheme.code
  if (tone === 'quote') return activeTheme.quote
  if (tone === 'list') return activeTheme.list
  if (tone === 'footer') return activeTheme.footer
  return activeTheme.body
}

function layoutAllText() {
  letterCount = 0
  lChar.length = 0; lFont.length = 0; lColor.length = 0

  const mx = Math.max(50, W * 0.06), my = Math.max(60, H * 0.06)
  const cw = W - mx * 2
  const twoCol = cw > 700
  const col2X = twoCol ? mx + cw * 0.56 : mx

  for (const entry of textEntries) {
    const fontStr = `${entry.fontSize}px ${entry.font}`
    let baseX: number, maxW: number
    if (entry.column === 'right') { baseX = twoCol ? col2X : mx; maxW = Math.min(entry.maxWidth, twoCol ? cw * 0.4 : cw) }
    else if (entry.column === 'center') { maxW = Math.min(entry.maxWidth, cw); baseX = mx + (cw - maxW) / 2 }
    else { baseX = mx; maxW = Math.min(entry.maxWidth, twoCol ? cw * 0.5 : cw) }
    const baseY = my + entry.yOffset

    try {
      const prepared = prepareWithSegments(entry.text, fontStr, entry.style === 'code' ? { whiteSpace: 'pre-wrap' } : undefined)
      const { lines } = layoutWithLines(prepared, maxW, entry.lineHeight)
      for (let li = 0; li < lines.length; li++) {
        let xc = baseX
        const y = baseY + li * entry.lineHeight
        ctx.font = fontStr
        for (const char of lines[li].text) {
          if (char === '\n' || letterCount >= MAX_LETTERS) continue
          const cw2 = ctx.measureText(char).width
          const i = letterCount++
          lHomeX[i] = xc + cw2 / 2; lHomeY[i] = y + entry.lineHeight / 2
          lX[i] = lHomeX[i]; lY[i] = lHomeY[i]
          lVx[i] = 0; lVy[i] = 0; lAngle[i] = 0; lAngVel[i] = 0
          lCharW[i] = cw2; lBaseAlpha[i] = entry.alpha
          lFontSize[i] = entry.fontSize; lBurnTimer[i] = 0
          lScaleMul[i] = 1; lGravity[i] = 0
          lSnakeHideTimer[i] = 0; lRevealTimer[i] = 0
          lCollectible[i] = /\S/.test(char) ? 1 : 0
          lChar[i] = char; lFont[i] = fontStr; lColor[i] = resolveTextColor(entry.tone)
          xc += cw2
        }
      }
    } catch { /* skip */ }
  }
  if (activeMode === 'snake' && snakeCols > 0 && snakeRows > 0) fitCollectibleLettersToSnakeBoard()
  rebuildSnakeTiers()
}

// ─── Dragon chain ───────────────────────────────────────────

const SEG_SPACING = 10
// SoA for chain too
let chainN = 0
let chX = new Float32Array(80), chY = new Float32Array(80)
let chPx = new Float32Array(80), chPy = new Float32Array(80)

function rebuildDragon() {
  chainN = cfg.dragonSegments
  if (chX.length < chainN) {
    chX = new Float32Array(chainN); chY = new Float32Array(chainN)
    chPx = new Float32Array(chainN); chPy = new Float32Array(chainN)
  }
  for (let i = 0; i < chainN; i++) {
    chX[i] = W / 2; chY[i] = H / 2 + i * SEG_SPACING
    chPx[i] = chX[i]; chPy[i] = chY[i]
  }
}
rebuildDragon()

const SNAKE_BASE_LENGTH = 10
let snakeBody: { x: number; y: number }[] = []
let snakeX = new Float32Array(24), snakeY = new Float32Array(24)
let snakePx = new Float32Array(24), snakePy = new Float32Array(24)
let snakeDir = { x: 1, y: 0 }
let snakeNextDir = { x: 1, y: 0 }
let snakeCols = 0, snakeRows = 0, snakeCell = 24
let snakeOffsetX = 0, snakeOffsetY = 0
let snakeFood = { x: 0, y: 0 }
let snakeAlive = true, snakeMoveTimer = 0, snakeScore = 0, snakeFlash = 0
let snakeBoostTimer = 0, snakePulse = 0, snakeBonusCount = 0
let snakeGrowthCharge = 0, snakeTierMinorGrowths = 0
let snakeTierIndex = 0, snakeTierFlash = 0
let snakeTierBurst = 0, snakeTierBurstHue = 0, snakeTierBurstX = 0, snakeTierBurstY = 0
let snakeVictory = false, snakeVictoryPulse = 0, snakeVictoryEaten = 0
let snakeTierLabel = ''
let snakeStarted = false
const snakeFontTiers: number[] = []
const snakeTierCounts = new Map<number, number>()
const snakeVictoryTreats: SnakeVictoryTreat[] = []
const snakeStartButton = { x: 0, y: 0, w: 0, h: 0 }
const SNAKE_TIER_BURST_TIME = 1.25
const SNAKE_VICTORY_EMOJIS = ['✨', '🎉', '🌟', '💫', '🎈', '🪄']

function ensureSnakeCapacity(size: number) {
  if (snakeX.length >= size) return
  const nextX = new Float32Array(size)
  const nextY = new Float32Array(size)
  const nextPx = new Float32Array(size)
  const nextPy = new Float32Array(size)
  nextX.set(snakeX)
  nextY.set(snakeY)
  nextPx.set(snakePx)
  nextPy.set(snakePy)
  snakeX = nextX
  snakeY = nextY
  snakePx = nextPx
  snakePy = nextPy
}

function updateSnakeGrid() {
  snakeCell = Math.max(18, Math.min(30, Math.floor(Math.min(W, H) / 22)))
  snakeCols = Math.max(14, Math.floor((W - 120) / snakeCell))
  snakeRows = Math.max(10, Math.floor((H - 150) / snakeCell))
  snakeOffsetX = Math.floor((W - snakeCols * snakeCell) / 2)
  snakeOffsetY = Math.floor((H - snakeRows * snakeCell) / 2)
}

function gridCenterX(x: number) { return snakeOffsetX + x * snakeCell + snakeCell / 2 }
function gridCenterY(y: number) { return snakeOffsetY + y * snakeCell + snakeCell / 2 }

function getSnakeBoardBounds() {
  const left = snakeOffsetX + snakeCell * 1.15
  const right = snakeOffsetX + snakeCols * snakeCell - snakeCell * 1.15
  const top = snakeOffsetY + snakeCell * 1.1
  const bottom = snakeOffsetY + snakeRows * snakeCell - snakeCell * 1.2
  return { left, right, top, bottom, width: right - left, height: bottom - top }
}

function fitCollectibleLettersToSnakeBoard() {
  const bounds = getSnakeBoardBounds()
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  let count = 0

  for (let i = 0; i < letterCount; i++) {
    if (!lCollectible[i]) continue
    const halfW = Math.max(3, lCharW[i] * 0.5)
    const halfH = Math.max(6, lFontSize[i] * 0.52)
    minX = Math.min(minX, lHomeX[i] - halfW)
    maxX = Math.max(maxX, lHomeX[i] + halfW)
    minY = Math.min(minY, lHomeY[i] - halfH)
    maxY = Math.max(maxY, lHomeY[i] + halfH)
    count++
  }
  if (count === 0) return

  const srcWidth = Math.max(1, maxX - minX)
  const srcHeight = Math.max(1, maxY - minY)
  const scale = Math.min(1, bounds.width / srcWidth, bounds.height / srcHeight)
  const srcCenterX = (minX + maxX) * 0.5
  const srcCenterY = (minY + maxY) * 0.5
  const dstCenterX = (bounds.left + bounds.right) * 0.5
  const dstCenterY = (bounds.top + bounds.bottom) * 0.5

  for (let i = 0; i < letterCount; i++) {
    const nextX = (lHomeX[i] - srcCenterX) * scale + dstCenterX
    const nextY = (lHomeY[i] - srcCenterY) * scale + dstCenterY
    lHomeX[i] = nextX
    lHomeY[i] = nextY
    lX[i] = nextX
    lY[i] = nextY
    lVx[i] = 0
    lVy[i] = 0
    lAngle[i] = 0
    lAngVel[i] = 0
  }
}

function rebuildSnakeTiers() {
  snakeFontTiers.length = 0
  snakeTierCounts.clear()
  for (let i = 0; i < letterCount; i++) {
    if (!lCollectible[i]) continue
    const size = lFontSize[i]
    snakeTierCounts.set(size, (snakeTierCounts.get(size) ?? 0) + 1)
  }
  snakeFontTiers.push(...Array.from(snakeTierCounts.keys()).sort((a, b) => a - b))
  if (snakeTierIndex > snakeFontTiers.length) snakeTierIndex = snakeFontTiers.length
}

function getSnakeCurrentTierSize() {
  return snakeFontTiers[snakeTierIndex] ?? null
}

function getSnakeTierCount(size: number | null) {
  return size == null ? 0 : (snakeTierCounts.get(size) ?? 0)
}

function getSnakeCurrentTierRemaining() {
  const size = getSnakeCurrentTierSize()
  if (size == null) return 0
  let remaining = 0
  for (let i = 0; i < letterCount; i++) {
    if (lCollectible[i] && lSnakeHideTimer[i] === 0 && lFontSize[i] === size) remaining++
  }
  return remaining
}

function snakeBodyScale() {
  return 0.84 + Math.min(0.96, snakeTierIndex * 0.17)
}

function snakeInteractiveSegments(bodyCount: number) {
  const base = isLowPerformanceActive() ? 3 : 4
  const diffBonus = activeSnakeDifficultyName === 'easy' ? 2 : activeSnakeDifficultyName === 'normal' ? 1 : 0
  return Math.min(bodyCount, Math.max(2, base + diffBonus))
}

function snakeWakeSegments(bodyCount: number) {
  const base = isLowPerformanceActive() ? 2 : 3
  const diffBonus = activeSnakeDifficultyName === 'easy' ? 1 : 0
  return Math.min(bodyCount, Math.max(1, base + diffBonus))
}

function snakeMaxLength() {
  return Math.max(SNAKE_BASE_LENGTH, Math.floor(snakeCols * snakeRows * 0.62))
}

function getSnakeHeading() {
  if (!snakeStarted) return { x: 0, y: -1 }
  return { x: snakeDir.x, y: snakeDir.y }
}

function getSnakeHeadingAngle() {
  const dir = getSnakeHeading()
  return Math.atan2(dir.y, dir.x)
}

function pointInSnakeStartButton(x: number, y: number) {
  return x >= snakeStartButton.x
    && x <= snakeStartButton.x + snakeStartButton.w
    && y >= snakeStartButton.y
    && y <= snakeStartButton.y + snakeStartButton.h
}

function startSnake() {
  if (!snakeAlive || snakeStarted) return
  snakeStarted = true
  snakeDir = { x: 0, y: -1 }
  snakeNextDir = { x: 0, y: -1 }
  snakeMoveTimer = 0
  snakeFlash = 1
  snakeTierFlash = Math.max(snakeTierFlash, 0.8)
}

function addSnakeTailSegments(count: number) {
  if (count <= 0 || snakeBody.length === 0) return 0
  const tail = snakeBody[snakeBody.length - 1]
  const room = Math.max(0, snakeMaxLength() - snakeBody.length)
  const amount = Math.min(count, room)
  for (let i = 0; i < amount; i++) snakeBody.push({ x: tail.x, y: tail.y })
  return amount
}

function trySnakeMinorGrowth() {
  if (snakeTierMinorGrowths >= activeSnakeDifficulty.minorGrowthCap) return false
  snakeGrowthCharge++
  if (snakeGrowthCharge < activeSnakeDifficulty.minorGrowthEvery) return false
  snakeGrowthCharge = 0
  const grownBy = addSnakeTailSegments(1)
  if (grownBy <= 0) return false
  snakeTierMinorGrowths += grownBy
  snakePulse = Math.max(snakePulse, 0.35)
  snakeFlash = 1
  snakeTierFlash = Math.max(snakeTierFlash, 0.42)
  return true
}

function restoreSnakeLetters() {
  for (let i = 0; i < letterCount; i++) {
    lSnakeHideTimer[i] = 0
    lRevealTimer[i] = 0
    lBurnTimer[i] = 0
    lScaleMul[i] = 1
    lGravity[i] = 0
    lX[i] = lHomeX[i]
    lY[i] = lHomeY[i]
    lVx[i] = 0
    lVy[i] = 0
    lAngle[i] = 0
    lAngVel[i] = 0
  }
}

function blastSnakeLetters(originX: number, originY: number, radius: number) {
  const radiusSq = radius * radius
  let hits = 0
  for (let i = 0; i < letterCount; i++) {
    if (lSnakeHideTimer[i] > 0) continue
    const dx = lX[i] - originX
    const dy = lY[i] - originY
    const dSq = dx * dx + dy * dy
    if (dSq > radiusSq) continue
    const d = Math.sqrt(Math.max(1, dSq))
    const strength = (1 - d / radius) * (5 + snakeCell * 0.12)
    const nx = dx / d
    const ny = dy / d
    lVx[i] += nx * strength + (Math.random() - 0.5) * 1.6
    lVy[i] += ny * strength + (Math.random() - 0.5) * 1.2 - 0.4
    lAngVel[i] += (Math.random() - 0.5) * 0.5
    lRevealTimer[i] = Math.max(lRevealTimer[i], 0.18)
    if (hits < 10 && Math.random() < 0.35) spawnEmber(lX[i], lY[i])
    hits++
  }
  return hits
}

function findSnakeLetterTarget(headX: number, headY: number, dirX: number, dirY: number) {
  const currentSize = getSnakeCurrentTierSize()
  if (currentSize == null) return -1
  let best = -1
  let bestSq = Number.POSITIVE_INFINITY
  const mouthX = headX + dirX * snakeCell * 0.48
  const mouthY = headY + dirY * snakeCell * 0.48
  const captureRadius = snakeCell * (0.48 + snakeBodyScale() * 0.16) * activeSnakeDifficulty.captureRadiusMul
  for (let i = 0; i < letterCount; i++) {
    if (!lCollectible[i] || lSnakeHideTimer[i] > 0 || lFontSize[i] !== currentSize) continue
    const headDx = lX[i] - headX
    const headDy = lY[i] - headY
    const forward = headDx * dirX + headDy * dirY
    if (forward < -snakeCell * activeSnakeDifficulty.rearAllowance) continue
    const dx = lX[i] - mouthX
    const dy = lY[i] - mouthY
    const sideways = Math.abs(headDx * -dirY + headDy * dirX)
    const reach = captureRadius + Math.max(4, lCharW[i] * 0.2)
    const dSq = dx * dx + dy * dy
    if (sideways < snakeCell * 0.78 * activeSnakeDifficulty.laneWidthMul && dSq < reach * reach && dSq < bestSq) {
      bestSq = dSq
      best = i
    }
  }
  return best
}

function collectSnakeAssistTargets(primaryIndex: number, headX: number, headY: number) {
  const extra = activeSnakeDifficulty.assistBites - 1
  const currentSize = getSnakeCurrentTierSize()
  if (extra <= 0 || currentSize == null) return []
  const radius = snakeCell * activeSnakeDifficulty.assistRadiusMul
  const radiusSq = radius * radius
  const nearby: { index: number; dSq: number }[] = []
  for (let i = 0; i < letterCount; i++) {
    if (i === primaryIndex || !lCollectible[i] || lSnakeHideTimer[i] > 0 || lFontSize[i] !== currentSize) continue
    const dx = lX[i] - headX
    const dy = lY[i] - headY
    const dSq = dx * dx + dy * dy
    if (dSq <= radiusSq) nearby.push({ index: i, dSq })
  }
  nearby.sort((a, b) => a.dSq - b.dSq)
  return nearby.slice(0, extra).map(item => item.index)
}

function advanceSnakeTier(originX: number, originY: number) {
  const clearedSize = getSnakeCurrentTierSize()
  if (clearedSize == null) return false
  const clearedIndex = snakeTierIndex
  snakeTierIndex = Math.min(snakeTierIndex + 1, snakeFontTiers.length)
  const nextSize = getSnakeCurrentTierSize()
  const tailBonus = Math.min(36, 2 ** Math.min(5, clearedIndex + 1))
  const grownBy = addSnakeTailSegments(tailBonus)
  const burstHue = (clearedSize * 17 + clearedIndex * 41) % 360
  snakeGrowthCharge = 0
  snakeTierMinorGrowths = 0
  snakePulse = 1
  snakeFlash = 1
  snakeTierFlash = 2.1
  snakeTierBurst = SNAKE_TIER_BURST_TIME
  snakeTierBurstHue = burstHue
  snakeTierBurstX = originX
  snakeTierBurstY = originY
  snakeBoostTimer = Math.max(snakeBoostTimer, 2.4)
  snakeTierLabel = nextSize == null
    ? `${clearedSize}px cleared - all tiers unlocked`
    : `${clearedSize}px cleared - ${nextSize}px unlocked`
  spawnBombBurst(originX, originY, burstHue, isLowPerformanceActive() ? 10 : 22)
  triggerShake(Math.min(4.4, 1.8 + grownBy * 0.06))
  for (let i = 0; i < (isLowPerformanceActive() ? 8 : 16); i++) {
    spawnEmber(originX + (Math.random() - 0.5) * snakeCell * 1.6, originY + (Math.random() - 0.5) * snakeCell * 1.6)
  }
  if (nextSize == null) startSnakeVictory(originX, originY)
  return true
}

function consumeSingleSnakeLetter(index: number, headX: number, headY: number) {
  snakeScore++
  snakeFlash = 1
  lSnakeHideTimer[index] = Number.POSITIVE_INFINITY
  lRevealTimer[index] = 0
  lBurnTimer[index] = 0
  lScaleMul[index] = 1
  lGravity[index] = 0
  lX[index] = headX
  lY[index] = headY
  lVx[index] = 0
  lVy[index] = 0
  lAngle[index] = 0
  lAngVel[index] = 0
  triggerShake(0.7)
  for (let i = 0; i < 2; i++) spawnEmber(headX + (Math.random() - 0.5) * 10, headY + (Math.random() - 0.5) * 10)
  spawnSnakeEatBurst(headX, headY, lFontSize[index])
  return trySnakeMinorGrowth()
}

function consumeSnakeLetters(index: number, headX: number, headY: number) {
  const targets = [index, ...collectSnakeAssistTargets(index, headX, headY)]
  let grew = false
  for (const target of targets) grew = consumeSingleSnakeLetter(target, headX, headY) || grew
  if (getSnakeCurrentTierRemaining() === 0) grew = advanceSnakeTier(headX, headY) || grew
  return { count: targets.length, grew }
}

function triggerSnakeBonus(originX: number, originY: number) {
  snakeBonusCount++
  snakeFlash = 1
  snakePulse = 1
  snakeBoostTimer = Math.max(snakeBoostTimer, 3.4)
  const blasted = blastSnakeLetters(originX, originY, snakeCell * 7.5)
  const activeTier = getSnakeCurrentTierSize()
  if (activeTier != null) {
    for (let i = 0; i < letterCount; i++) {
      if (lCollectible[i] && lSnakeHideTimer[i] === 0 && lFontSize[i] === activeTier) {
        lRevealTimer[i] = Math.max(lRevealTimer[i], 0.35 + Math.random() * 0.25)
      }
    }
  }
  if (blasted > 0) triggerShake(Math.min(3.6, 1.4 + blasted * 0.03))
  for (let i = 0; i < 8; i++) spawnEmber(originX + (Math.random() - 0.5) * snakeCell, originY + (Math.random() - 0.5) * snakeCell)
}

function syncSnakeBodyToRender(updatePrev = false) {
  ensureSnakeCapacity(Math.max(snakeBody.length, 1))
  for (let i = 0; i < snakeBody.length; i++) {
    const x = gridCenterX(snakeBody[i].x)
    const y = gridCenterY(snakeBody[i].y)
    if (updatePrev) { snakePx[i] = x; snakePy[i] = y }
    snakeX[i] = x; snakeY[i] = y
  }
}

function snapshotSnakePrev() {
  for (let i = 0; i < snakeBody.length; i++) {
    snakePx[i] = snakeX[i]
    snakePy[i] = snakeY[i]
  }
}

function snakeSegScale(i: number) {
  const max = Math.max(1, snakeBody.length - 1)
  const t = i / max
  return (1.18 - t * 0.42) * snakeBodyScale()
}

function isSnakeCellTaken(x: number, y: number) {
  return snakeBody.some(seg => seg.x === x && seg.y === y)
}

function isSnakeVictoryTreatTaken(x: number, y: number, skipIndex = -1) {
  return snakeVictoryTreats.some((treat, index) => index !== skipIndex && treat.x === x && treat.y === y)
}

function spawnSnakeVictoryTreat(index: number) {
  const hue = Math.random() * 360
  const emoji = SNAKE_VICTORY_EMOJIS[(snakeVictoryEaten + index + Math.floor(Math.random() * SNAKE_VICTORY_EMOJIS.length)) % SNAKE_VICTORY_EMOJIS.length]
  for (let tries = 0; tries < 220; tries++) {
    const x = Math.floor(Math.random() * snakeCols)
    const y = Math.floor(Math.random() * snakeRows)
    if (isSnakeCellTaken(x, y) || isSnakeVictoryTreatTaken(x, y, index)) continue
    snakeVictoryTreats[index] = { x, y, emoji, hue, wobble: Math.random() * Math.PI * 2 }
    return
  }
  snakeVictoryTreats[index] = {
    x: Math.max(0, Math.floor(snakeCols / 2)),
    y: Math.max(0, Math.floor(snakeRows / 2)),
    emoji,
    hue,
    wobble: Math.random() * Math.PI * 2,
  }
}

function fillSnakeVictoryTreats() {
  const count = isLowPerformanceActive() ? 3 : 4
  snakeVictoryTreats.length = count
  for (let i = 0; i < count; i++) spawnSnakeVictoryTreat(i)
}

function startSnakeVictory(originX: number, originY: number) {
  snakeVictory = true
  snakeVictoryPulse = 1.8
  snakeVictoryEaten = 0
  snakeTierLabel = 'ALLE TEKST WEG - OVERWINNINGSFEEST'
  snakeTierBurst = Math.max(snakeTierBurst, 0.95)
  snakeTierBurstX = originX
  snakeTierBurstY = originY
  snakeBoostTimer = Math.max(snakeBoostTimer, 4.2)
  fillSnakeVictoryTreats()
  emitRewardMessage('hlc-reward-complete', snakeScore)
}

function triggerSnakeVictoryTreat(index: number, originX: number, originY: number) {
  const treat = snakeVictoryTreats[index]
  if (!treat) return false
  snakeVictoryEaten++
  snakeFlash = 1
  snakePulse = Math.max(snakePulse, 0.9)
  snakeVictoryPulse = Math.max(snakeVictoryPulse, 1.15)
  snakeTierBurst = Math.max(snakeTierBurst, 0.62)
  snakeTierBurstHue = treat.hue
  snakeTierBurstX = originX
  snakeTierBurstY = originY
  snakeBoostTimer = Math.max(snakeBoostTimer, 2.1)
  snakeTierFlash = Math.max(snakeTierFlash, 0.7)
  snakeTierLabel = `Victory feast x${snakeVictoryEaten}`
  triggerShake(Math.min(4.6, 1.6 + snakeVictoryEaten * 0.08))
  spawnBombBurst(originX, originY, treat.hue, isLowPerformanceActive() ? 8 : 16)
  for (let i = 0; i < (isLowPerformanceActive() ? 5 : 10); i++) {
    spawnEmber(originX + (Math.random() - 0.5) * snakeCell * 1.4, originY + (Math.random() - 0.5) * snakeCell * 1.4)
  }
  if (snakeVictoryEaten % 2 === 1) addSnakeTailSegments(1)
  spawnSnakeVictoryTreat(index)
  return true
}

function spawnSnakeFood() {
  for (let tries = 0; tries < 200; tries++) {
    const x = Math.floor(Math.random() * snakeCols)
    const y = Math.floor(Math.random() * snakeRows)
    if (!isSnakeCellTaken(x, y)) {
      snakeFood = { x, y }
      return
    }
  }
  snakeFood = { x: Math.floor(snakeCols / 2), y: Math.floor(snakeRows / 2) }
}

function resetSnake() {
  updateSnakeGrid()
  layoutAllText()
  fitCollectibleLettersToSnakeBoard()
  const length = Math.min(SNAKE_BASE_LENGTH, Math.max(6, snakeCols - 4))
  const headX = Math.max(length + 1, Math.floor(snakeCols * 0.38))
  const headY = Math.floor(snakeRows * 0.5)
  snakeBody = []
  for (let i = 0; i < length; i++) snakeBody.push({ x: headX - i, y: headY })
  snakeDir = { x: 0, y: -1 }
  snakeNextDir = { x: 0, y: -1 }
  snakeAlive = true
  snakeStarted = false
  snakeMoveTimer = 0
  snakeScore = 0
  snakeFlash = 0
  snakeBoostTimer = 0
  snakePulse = 0
  snakeBonusCount = 0
  snakeGrowthCharge = 0
  snakeTierMinorGrowths = 0
  snakeTierIndex = 0
  snakeTierFlash = 0
  snakeTierBurst = 0
  snakeTierBurstHue = 0
  snakeTierBurstX = 0
  snakeTierBurstY = 0
  snakeVictory = false
  snakeVictoryPulse = 0
  snakeVictoryEaten = 0
  snakeVictoryTreats.length = 0
  snakeTierLabel = ''
  syncSnakeBodyToRender(true)
  restoreSnakeLetters()
  rebuildSnakeTiers()
  const firstTier = getSnakeCurrentTierSize()
  if (firstTier != null) snakeTierLabel = `${firstTier}px active`
  spawnSnakeFood()
}

function queueSnakeDirection(x: number, y: number) {
  if ((x === snakeNextDir.x && y === snakeNextDir.y) || (x === snakeDir.x && y === snakeDir.y)) return
  if (x === -snakeDir.x && y === -snakeDir.y) return
  snakeNextDir = { x, y }
}

function stepSnake() {
  if (!snakeAlive || snakeBody.length === 0) return

  snapshotSnakePrev()
  snakeDir = { ...snakeNextDir }
  const next = { x: snakeBody[0].x + snakeDir.x, y: snakeBody[0].y + snakeDir.y }

  const hitWall = next.x < 0 || next.y < 0 || next.x >= snakeCols || next.y >= snakeRows
  const hitSelf = snakeBody.some((seg, index) => index < snakeBody.length - 1 && seg.x === next.x && seg.y === next.y)
  if (hitWall || hitSelf) {
    snakeAlive = false
    snakeFlash = 1
    triggerShake(3.5)
    return
  }

  snakeBody.unshift(next)
  const headX = gridCenterX(next.x)
  const headY = gridCenterY(next.y)
  const ateLetter = findSnakeLetterTarget(headX, headY, snakeDir.x, snakeDir.y)
  const hitVictoryTreat = snakeVictory
    ? snakeVictoryTreats.findIndex(treat => treat.x === next.x && treat.y === next.y)
    : -1
  const hitBonus = !snakeVictory && next.x === snakeFood.x && next.y === snakeFood.y
  let ateResult = { count: 0, grew: false }

  if (hitVictoryTreat >= 0) {
    ateResult = { count: 1, grew: triggerSnakeVictoryTreat(hitVictoryTreat, headX, headY) }
  }

  if (hitBonus) {
    triggerSnakeBonus(headX, headY)
    spawnSnakeFood()
  }

  if (ateLetter >= 0) {
    ateResult = consumeSnakeLetters(ateLetter, headX, headY)
  }

  if (!ateResult.grew) {
    snakeBody.pop()
  }

  syncSnakeBodyToRender()
}

function updateSnake(dt: number) {
  if (snakeFlash > 0) snakeFlash = Math.max(0, snakeFlash - dt * 2.2)
  if (snakePulse > 0) snakePulse = Math.max(0, snakePulse - dt * 1.8)
  if (snakeVictoryPulse > 0) snakeVictoryPulse = Math.max(0, snakeVictoryPulse - dt * 0.72)
  if (snakeBoostTimer > 0) snakeBoostTimer = Math.max(0, snakeBoostTimer - dt)
  if (snakeTierFlash > 0) snakeTierFlash = Math.max(0, snakeTierFlash - dt)
  if (snakeTierBurst > 0) snakeTierBurst = Math.max(0, snakeTierBurst - dt)
  if (!snakeAlive || !snakeStarted) return

  snakeMoveTimer += dt
  const scoreSpeed = Math.min(0.045, Math.log2(snakeScore + 1) * 0.008)
  const boostSpeed = snakeBoostTimer > 0 ? 0.038 : 0
  const stepEvery = Math.max(0.06, (0.155 - scoreSpeed - boostSpeed) * activeSnakeDifficulty.stepEveryMul)
  while (snakeMoveTimer >= stepEvery) {
    snakeMoveTimer -= stepEvery
    stepSnake()
    if (!snakeAlive) {
      snakeMoveTimer = 0
      break
    }
  }
}

const dragonChars = '◆◆◇▼█▓▓▒╬╬╬╬╬╬╬╬╬╬╫╫╫╪╪╪╧╧╤╤╥╥║║││┃┃╎╎╏╏::····..'.split('')

function segScale(i: number): number {
  if (i < 3) return (2.5 - i * 0.15) * cfg.dragonScale
  const t = (i - 3) / (chainN - 3)
  return (2.0 * (1 - t * t) + 0.2) * cfg.dragonScale
}

function updateChain(dt: number) {
  if (activeMode === 'snake') {
    updateSnake(dt)
    return
  }
  for (let i = 0; i < chainN; i++) { chPx[i] = chX[i]; chPy[i] = chY[i] }
  chX[0] += (mouse.x - chX[0]) * cfg.dragonSpeed
  chY[0] += (mouse.y - chY[0]) * cfg.dragonSpeed
  for (let i = 1; i < chainN; i++) {
    const dx = chX[i] - chX[i - 1], dy = chY[i] - chY[i - 1]
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d > SEG_SPACING) { const r = SEG_SPACING / d; chX[i] = chX[i - 1] + dx * r; chY[i] = chY[i - 1] + dy * r }
  }
}

// ─── Physics — operates on SoA arrays ───────────────────────

function interactLetters(dt: number) {
  const bodyCount = activeMode === 'snake' ? snakeBody.length : chainN
  const bodyX = activeMode === 'snake' ? snakeX : chX
  const bodyY = activeMode === 'snake' ? snakeY : chY
  const bodyPx = activeMode === 'snake' ? snakePx : chPx
  const bodyPy = activeMode === 'snake' ? snakePy : chPy
  const snakeBounds = activeMode === 'snake' ? getSnakeBoardBounds() : null
  const checkSegs = activeMode === 'snake'
    ? snakeInteractiveSegments(bodyCount)
    : Math.min(Math.round(chainN * 0.4), chainN)
  const wakeSegs = activeMode === 'snake'
    ? snakeWakeSegments(bodyCount)
    : bodyCount
  const damp = cfg.damping, spring = cfg.springStrength, push = cfg.pushForce, bGrav = cfg.burnGravity

  for (let li = 0; li < letterCount; li++) {
    if (lSnakeHideTimer[li] > 0) {
      if (Number.isFinite(lSnakeHideTimer[li])) {
        lSnakeHideTimer[li] = Math.max(0, lSnakeHideTimer[li] - dt)
        lX[li] += (lHomeX[li] - lX[li]) * 0.25
        lY[li] += (lHomeY[li] - lY[li]) * 0.25
        lVx[li] *= 0.75
        lVy[li] *= 0.75
        lAngle[li] *= 0.84
        lAngVel[li] *= 0.75
      }
      continue
    }
    if (lRevealTimer[li] > 0) lRevealTimer[li] = Math.max(0, lRevealTimer[li] - dt)

    let vx = lVx[li], vy = lVy[li], av = lAngVel[li]
    const x = lX[li], y = lY[li], cw = lCharW[li]

    // Dragon body collision
    for (let si = 0; si < checkSegs; si++) {
      const sc = activeMode === 'snake' ? snakeSegScale(si) : segScale(si)
      const rad = activeMode === 'snake' ? snakeCell * (0.18 + sc * 0.22) : 14 * sc * 0.45
      const dx = x - bodyX[si], dy = y - bodyY[si]
      const dSq = dx * dx + dy * dy
      const minD = rad + cw * 0.4 + 4
      if (dSq < minD * minD && dSq > 0.01) {
        const d = Math.sqrt(dSq)
        const f = push * ((minD - d) / minD) * sc
        const nx = dx / d, ny = dy / d
        vx += nx * f + (bodyX[si] - bodyPx[si]) * 0.4
        vy += ny * f + (bodyY[si] - bodyPy[si]) * 0.4
        if (activeMode === 'snake') {
          const swirl = (1 - d / minD) * (0.45 + sc * 0.18)
          vx += -ny * swirl
          vy += nx * swirl
        }
        av += (nx * 0.3 - ny * 0.2) * f * 0.12
      }
    }

    // Wake (every 5th segment)
    const wakeStep = activeMode === 'snake' ? 1 : 5
    const wakeRadius = activeMode === 'snake' ? snakeCell * (isLowPerformanceActive() ? 2.1 : 2.5) : 40
    for (let si = 1; si < wakeSegs; si += wakeStep) {
      const dx = x - bodyX[si], dy = y - bodyY[si]
      const dSq = dx * dx + dy * dy
      if (dSq < wakeRadius * wakeRadius && dSq > 100) {
        const frontBias = activeMode === 'snake' ? (1 - si / Math.max(1, wakeSegs)) : 1
        const w = (1 - Math.sqrt(dSq) / wakeRadius) * (activeMode === 'snake' ? (0.09 + frontBias * 0.14) : 0.12)
        vx += (bodyX[si] - bodyPx[si]) * w
        vy += (bodyY[si] - bodyPy[si]) * w
        if (activeMode === 'snake') {
          vx += -(dy / wakeRadius) * 0.35 * w * snakeCell
          vy += (dx / wakeRadius) * 0.35 * w * snakeCell
        }
      }
    }

    // Burn
    if (lBurnTimer[li] > 0) {
      lBurnTimer[li] -= dt
      lScaleMul[li] = 1 + lBurnTimer[li] * 0.4
      lGravity[li] = bGrav
      if (Math.random() < dt * 2) spawnEmber(x, y)
      if (lBurnTimer[li] <= 0) { lBurnTimer[li] = 0; lScaleMul[li] = 1; lGravity[li] = 0 }
    }

    // Spring home
    const hdx = lHomeX[li] - x, hdy = lHomeY[li] - y
    const hd = Math.sqrt(hdx * hdx + hdy * hdy)
    if (hd > 0.5) {
      const sf = spring * (1 + hd * 0.001)
      vx += hdx * sf; vy += hdy * sf
      av -= lAngle[li] * 0.05
    } else { lAngle[li] *= 0.9 }

    vy += lGravity[li]
    lVx[li] = vx * damp; lVy[li] = vy * damp
    lAngVel[li] = av * 0.91
    lX[li] = x + lVx[li]; lY[li] = y + lVy[li]
    if (snakeBounds) {
      const halfW = Math.max(4, lCharW[li] * 0.5)
      const halfH = Math.max(7, lFontSize[li] * 0.54)
      const minX = snakeBounds.left + halfW
      const maxX = snakeBounds.right - halfW
      const minY = snakeBounds.top + halfH
      const maxY = snakeBounds.bottom - halfH
      if (lX[li] < minX) { lX[li] = minX; lVx[li] *= -0.18 }
      else if (lX[li] > maxX) { lX[li] = maxX; lVx[li] *= -0.18 }
      if (lY[li] < minY) { lY[li] = minY; lVy[li] *= -0.18 }
      else if (lY[li] > maxY) { lY[li] = maxY; lVy[li] *= -0.18 }
    }
    lAngle[li] += lAngVel[li]
  }
}

function fireBlastAt(bx: number, by: number, dx: number, dy: number) {
  let hits = 0
  const rSq = cfg.fireRadius * cfg.fireRadius, ff = cfg.fireForce, fr = cfg.fireRadius
  for (let li = 0; li < letterCount; li++) {
    const ldx = lX[li] - bx, ldy = lY[li] - by
    const dSq = ldx * ldx + ldy * ldy
    if (dSq < rSq && dSq > 0.01) {
      const d = Math.sqrt(dSq), f = ff * ((1 - d / fr) ** 2)
      lVx[li] += (ldx / d * 0.4 + dx * 0.6) * f
      lVy[li] += (ldy / d * 0.4 + dy * 0.6) * f - f * 0.2
      lAngVel[li] += (Math.random() - 0.5) * f * 0.3
      lBurnTimer[li] = Math.max(lBurnTimer[li], 0.5 + Math.random() * 1.2)
      hits++
    }
  }
  if (hits > 3) { triggerShake(Math.min(hits * 0.4, 6)); for (let i = 0; i < Math.min(hits, 4); i++) spawnEmber(bx, by) }
}

function pulseBlastAt(bx: number, by: number, dx: number, dy: number) {
  let hits = 0
  const pulseRadius = cfg.fireRadius * 0.72
  const rSq = pulseRadius * pulseRadius
  const pulseForce = cfg.fireForce * 0.66
  for (let li = 0; li < letterCount; li++) {
    const ldx = lX[li] - bx
    const ldy = lY[li] - by
    const dSq = ldx * ldx + ldy * ldy
    if (dSq < rSq && dSq > 0.01) {
      const d = Math.sqrt(dSq)
      const f = pulseForce * ((1 - d / pulseRadius) ** 2)
      lVx[li] += (ldx / d * 0.2 + dx * 0.8) * f
      lVy[li] += (ldy / d * 0.2 + dy * 0.8) * f - f * 0.08
      lAngVel[li] += (Math.random() - 0.5) * f * 0.2
      lRevealTimer[li] = Math.max(lRevealTimer[li], 0.22 + Math.random() * 0.18)
      hits++
    }
  }
  if (hits > 1) triggerShake(Math.min(1.8, hits * 0.12))
}

function canDropChaosBomb() {
  return activeMode === 'dragon' && !isLowPerformanceActive()
}

function chaosBlastAt(bx: number, by: number, radius: number) {
  const rSq = radius * radius
  let hits = 0
  for (let li = 0; li < letterCount; li++) {
    const dx = lX[li] - bx
    const dy = lY[li] - by
    const dSq = dx * dx + dy * dy
    if (dSq < rSq && dSq > 0.01) {
      const d = Math.sqrt(dSq)
      const t = 1 - d / radius
      const force = cfg.fireForce * 1.35 * (t * t + 0.15)
      const nx = dx / d
      const ny = dy / d
      lVx[li] += nx * force + (-ny) * force * 0.16
      lVy[li] += ny * force + nx * force * 0.16 - force * 0.08
      lAngVel[li] += (Math.random() - 0.5) * force * 0.24
      lRevealTimer[li] = Math.max(lRevealTimer[li], 0.4 + Math.random() * 0.25)
      hits++
    }
  }
  if (hits > 3) triggerShake(Math.min(5.5, 2.2 + hits * 0.05))
}

function detonateBomb(bomb: ChaosBomb) {
  bomb.state = 'ripple'
  bomb.ripple = 0
  bomb.life = 0.8
  bomb.rippleMax = 180 + Math.random() * 70
  chaosBlastAt(bomb.x, bomb.y, bomb.rippleMax * 0.92)
  hitEnemiesWithFire(bomb.x, bomb.y)
  spawnBombBurst(bomb.x, bomb.y, bomb.hue)
}

function dropChaosBomb() {
  if (!canDropChaosBomb() || bombCooldown > 0 || bombs.length >= 3) return
  const x = Math.min(Math.max(mouse.x, 48), W - 48)
  const y = -36
  const targetY = Math.min(Math.max(mouse.y, 84), H - 72)
  bombs.push({
    x,
    y,
    targetY,
    vy: 0,
    wobble: Math.random() * Math.PI * 2,
    hue: Math.random() * 360,
    state: 'falling',
    ripple: 0,
    rippleMax: 0,
    life: 0,
  })
  bombCooldown = 0.55
}

function updateChaosBombs(dt: number, time: number) {
  if (bombCooldown > 0) bombCooldown = Math.max(0, bombCooldown - dt)
  if (!canDropChaosBomb()) {
    bombs.length = 0
    bombCooldown = 0
    return
  }
  for (let i = bombs.length - 1; i >= 0; i--) {
    const bomb = bombs[i]
    if (bomb.state === 'falling') {
      bomb.vy += 920 * dt
      bomb.y += bomb.vy * dt
      bomb.x += Math.sin(time * 6 + bomb.wobble) * dt * 14
      if (bomb.y >= bomb.targetY) {
        bomb.y = bomb.targetY
        detonateBomb(bomb)
      }
    } else {
      bomb.ripple += dt * 360
      bomb.life -= dt
      if (bomb.life <= 0 || bomb.ripple >= bomb.rippleMax) bombs.splice(i, 1)
    }
  }
}

function drawChaosBombs(time: number) {
  if (!bombs.length) return

  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  for (const bomb of bombs) {
    if (bomb.state === 'falling') {
      const pulse = 0.5 + Math.sin(time * 7 + bomb.wobble) * 0.5
      const radius = 16 + pulse * 5

      ctx.globalAlpha = 0.16
      ctx.strokeStyle = `hsla(${Math.round((bomb.hue + 24) % 360)}, 100%, 72%, 1)`
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(bomb.x, Math.max(0, bomb.y - 88))
      ctx.lineTo(bomb.x, bomb.y - radius * 0.55)
      ctx.stroke()

      ctx.globalAlpha = 0.12 + pulse * 0.1
      ctx.fillStyle = `hsla(${Math.round((bomb.hue + 12) % 360)}, 100%, 60%, 1)`
      ctx.beginPath()
      ctx.arc(bomb.x, bomb.y, radius * 1.6, 0, Math.PI * 2)
      ctx.fill()

      ctx.globalAlpha = 1
      ctx.shadowColor = `hsla(${Math.round(bomb.hue)}, 100%, 68%, 1)`
      ctx.shadowBlur = 18 + pulse * 14
      ctx.fillStyle = `hsla(${Math.round(bomb.hue)}, 100%, 74%, 1)`
      ctx.font = `bold ${18 + pulse * 6}px "Courier New",monospace`
      ctx.fillText('◉', bomb.x, bomb.y)

      ctx.shadowBlur = 0
      ctx.globalAlpha = 0.9
      ctx.fillStyle = '#fff'
      ctx.font = `${8 + pulse * 2}px "Courier New",monospace`
      ctx.fillText('•', bomb.x + 1, bomb.y - 1)
    } else {
      const lifeAlpha = Math.max(0, bomb.life / 0.8)
      const glowRadius = 28 + Math.sin(time * 8 + bomb.wobble) * 3

      ctx.globalAlpha = lifeAlpha * 0.2
      ctx.fillStyle = `hsla(${Math.round((bomb.hue + 18) % 360)}, 100%, 60%, 1)`
      ctx.beginPath()
      ctx.arc(bomb.x, bomb.y, glowRadius, 0, Math.PI * 2)
      ctx.fill()

      for (let ring = 0; ring < 3; ring++) {
        const radius = bomb.ripple - ring * 22
        if (radius <= 8) continue
        ctx.globalAlpha = Math.max(0, lifeAlpha * (0.34 - ring * 0.08))
        ctx.strokeStyle = `hsla(${Math.round((bomb.hue + ring * 26) % 360)}, 100%, ${78 - ring * 8}%, 1)`
        ctx.lineWidth = Math.max(1.1, 4 - ring)
        ctx.beginPath()
        ctx.arc(bomb.x, bomb.y, radius, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }

  ctx.restore()
}

// ─── Draw letters — minimal ctx state changes ───────────────

function drawLetters() {
  const opMul = cfg.textOpacity
  const targetTier = activeMode === 'snake' ? getSnakeCurrentTierSize() : null
  const tierPulse = activeMode === 'snake' ? (0.5 + Math.sin(time * 4.5) * 0.5) : 0
  const highlightBoost = activeMode === 'snake' ? activeSnakeDifficulty.highlightBoost : 1
  let prevFont = ''

  for (let i = 0; i < letterCount; i++) {
    if (lSnakeHideTimer[i] > 0) continue
    const burning = lBurnTimer[i] > 0
    const reveal = lRevealTimer[i] > 0 ? lRevealTimer[i] / 0.65 : 0
    const tierTarget = targetTier != null && lCollectible[i] && lFontSize[i] === targetTier
    let alpha = lBaseAlpha[i] * opMul
    let color = lColor[i]

    if (burning) {
      const h = Math.min(1, lBurnTimer[i])
      color = rgbString(mixRgb(activeTheme.particleMid, activeTheme.particleStart, h))
      alpha = Math.min(1, alpha + 0.5)
    }
    if (reveal > 0) alpha = Math.min(1, alpha + reveal * 0.25)
    if (activeMode === 'snake' && lCollectible[i]) {
      alpha *= tierTarget ? 1 : 0.42
      if (tierTarget) {
        alpha = Math.min(1, alpha + (0.3 + tierPulse * 0.26) * highlightBoost)
        color = activeTheme.textPrimary
      }
    }

    const font = lFont[i]
    if (font !== prevFont) { ctx.font = font; prevFont = font }

    ctx.save()
    ctx.translate(lX[i], lY[i])
    if (lAngle[i] !== 0) ctx.rotate(lAngle[i])
    const tierScale = tierTarget ? 1.04 + (0.08 + tierPulse * 0.16) * highlightBoost : 1
    const sm = lScaleMul[i] * (reveal > 0 ? 1 + reveal * 0.28 : 1) * tierScale
    if (sm !== 1) ctx.scale(sm, sm)
    if (tierTarget && !isLowPerformanceActive()) {
      ctx.shadowColor = activeTheme.accentStrong
      ctx.shadowBlur = 10 + tierPulse * 14
    }
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(lChar[i], 0, 0)
    if (tierTarget) {
      ctx.globalAlpha = Math.min(0.85, 0.14 + (0.14 + tierPulse * 0.22 + reveal * 0.12) * highlightBoost)
      ctx.fillStyle = activeTheme.accentStrong
      ctx.fillText(lChar[i], 0, 0)
    }
    if (reveal > 0.02) {
      ctx.globalAlpha = reveal * 0.22
      ctx.fillStyle = activeTheme.accentStrong
      ctx.fillText(lChar[i], 0, 0)
    }
    if (burning && lBurnTimer[i] > 0.3) {
      ctx.globalAlpha = lBurnTimer[i] * 0.2
      ctx.fillStyle = activeTheme.accent
      ctx.fillText(lChar[i], 0, 0)
    }
    ctx.restore()
  }
}

// ─── Fire emission + particle update ────────────────────────

let isBreathingFire = false, fireAccum = 0, totalFireTime = 0

addEventListener('mousedown', (e) => {
  if (activeMode !== 'dragon') return
  if (!(e.target as HTMLElement).closest('#panel, #panel-toggle')) isBreathingFire = true
})
addEventListener('mouseup', () => { isBreathingFire = false })
addEventListener('touchstart', (e) => {
  if (activeMode !== 'dragon') return
  const touch = e.touches[0]
  if (touch) setMouseFromClient(touch.clientX, touch.clientY)
  if (!(e.target as HTMLElement).closest('#panel, #panel-toggle')) isBreathingFire = true
})
addEventListener('touchend', () => { isBreathingFire = false })

function getDragonBreathVector() {
  const hx = chX[0], hy = chY[0]
  const ni = Math.min(3, chainN - 1)
  const fdx = hx - chX[ni], fdy = hy - chY[ni]
  const len = Math.sqrt(fdx * fdx + fdy * fdy) || 1
  const dx = fdx / len, dy = fdy / len
  return {
    hx,
    hy,
    dx,
    dy,
    angle: Math.atan2(fdy, fdx),
    bx: hx + dx * 50,
    by: hy + dy * 50,
  }
}

function emitFire(dt: number) {
  if (activeMode !== 'dragon') { totalFireTime = 0; return }
  if (!isBreathingFire) { totalFireTime = 0; return }
  fireAccum += dt; totalFireTime += dt
  const { hx, hy, dx, dy, angle, bx, by } = getDragonBreathVector()

  if (isLowPerformanceActive()) {
    const pulseStep = 0.085
    while (fireAccum > pulseStep) {
      fireAccum -= pulseStep
      pulseBlastAt(bx, by, dx, dy)
      hitEnemiesWithFire(bx, by)
    }
    triggerShake(Math.min(0.8 + totalFireTime * 0.08, 1.4))
    return
  }

  if (cfg.showParticles) {
    const fireStep = isLowPerformanceActive() ? 0.05 : 0.025
    const particlesPerStep = isLowPerformanceActive() ? 1 : 2
    while (fireAccum > fireStep) {
      fireAccum -= fireStep
      if (particleCount >= maxActiveParticles()) break
      for (let j = 0; j < particlesPerStep; j++) {
        if (particleCount >= maxActiveParticles()) break
        const i = particleCount++
        const sp = (Math.random() - 0.5), spd = 5 + Math.random() * 7
        pX[i] = hx + dx * 15; pY[i] = hy + dy * 15
        pVx[i] = Math.cos(angle + sp) * spd; pVy[i] = Math.sin(angle + sp) * spd - Math.random()
        pLife[i] = 1; pMaxLife[i] = 0.3 + Math.random() * 0.4
        pSize[i] = 6 + Math.random() * 12
        pChar[i] = fireChars[Math.random() * fireChars.length | 0]
        pColor[i] = ''
      }
    }
  } else { fireAccum = 0 }

  fireBlastAt(bx, by, dx, dy)
  hitEnemiesWithFire(bx, by)
  triggerShake(Math.min(1 + totalFireTime * 0.2, 3))
}

function updateParticlesAndEmbers(dt: number) {
  particleCount = Math.min(particleCount, maxActiveParticles())
  emberCount = Math.min(emberCount, maxActiveEmbers())
  // Particles — swap-remove
  for (let i = particleCount - 1; i >= 0; i--) {
    pX[i] += pVx[i]; pY[i] += pVy[i]; pVy[i] -= 0.25; pVx[i] *= 0.97
    pLife[i] -= dt / pMaxLife[i]
    if (pLife[i] <= 0) {
      particleCount--
      pX[i] = pX[particleCount]; pY[i] = pY[particleCount]
      pVx[i] = pVx[particleCount]; pVy[i] = pVy[particleCount]
      pLife[i] = pLife[particleCount]; pMaxLife[i] = pMaxLife[particleCount]
      pSize[i] = pSize[particleCount]; pChar[i] = pChar[particleCount]; pColor[i] = pColor[particleCount]
    }
  }
  // Embers — swap-remove
  for (let i = emberCount - 1; i >= 0; i--) {
    emX[i] += emVx[i]; emY[i] += emVy[i]; emVy[i] += 0.15; emVx[i] *= 0.97
    emLife[i] -= dt
    if (emLife[i] <= 0) {
      emberCount--
      emX[i] = emX[emberCount]; emY[i] = emY[emberCount]
      emVx[i] = emVx[emberCount]; emVy[i] = emVy[emberCount]
      emLife[i] = emLife[emberCount]; emSize[i] = emSize[emberCount]
      emChar[i] = emChar[emberCount]; emColor[i] = emColor[emberCount]
    }
  }
}

function drawParticles(time: number) {
  if (cfg.showEmbers) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const emberLimit = Math.min(emberCount, maxActiveEmbers())
    for (let i = 0; i < emberLimit; i++) {
      ctx.globalAlpha = Math.min(1, emLife[i] * 2)
      ctx.font = `${emSize[i]}px "Courier New",monospace`
      ctx.fillStyle = emColor[i]
      ctx.fillText(emChar[i], emX[i], emY[i])
    }
  }
  if (cfg.showParticles) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const particleLimit = Math.min(particleCount, maxActiveParticles())
    for (let i = 0; i < particleLimit; i++) {
      const t = 1 - pLife[i]
      const color = t < 0.25
        ? mixRgb(activeTheme.particleStart, activeTheme.particleMid, t / 0.25)
        : mixRgb(activeTheme.particleMid, activeTheme.particleEnd, (t - 0.25) / 0.75)
      const sz = pSize[i] * (0.4 + pLife[i] * 0.6)
      ctx.globalAlpha = pLife[i] * 0.85
      ctx.font = `${sz}px "Courier New",monospace`
      ctx.fillStyle = pColor[i] || rgbString(color)
      ctx.fillText(pChar[i], pX[i], pY[i])
    }
  }
  ctx.globalAlpha = 1
}

// ─── 3D Text Tunnel (simplified — fewer rings) ──────────────

let tunnelTexts = [...sharedContent.tunnelTexts]
const tunnelFont = '13px "Courier New",monospace'
const TUNNEL_RINGS = 12
const TUNNEL_DEPTH = 1200

const tunnelZ = new Float32Array(TUNNEL_RINGS)
const tunnelSide = new Uint8Array(TUNNEL_RINGS)
const tunnelTextIdx = new Uint8Array(TUNNEL_RINGS)

function buildTunnel() {
  for (let i = 0; i < TUNNEL_RINGS; i++) {
    tunnelZ[i] = (i / TUNNEL_RINGS) * TUNNEL_DEPTH
    tunnelSide[i] = i % 4
    tunnelTextIdx[i] = i % tunnelTexts.length
  }
}
buildTunnel()

function applySharedContent(rawText?: string | null) {
  sharedContent = getResolvedContentPack(rawText)
  textEntries = buildTextEntriesFromContent(sharedContent)
  tunnelTexts = [...sharedContent.tunnelTexts]
  buildTunnel()
  if (!initialized) return
  if (activeMode === 'snake') resetSnake()
  else layoutAllText()
}

function emitRewardMessage(type: 'hlc-reward-ready' | 'hlc-reward-complete' | 'hlc-reward-close', score?: number) {
  if (!isEmbeddedReward || window.parent === window) return
  window.parent.postMessage(
    type === 'hlc-reward-complete'
      ? { type, mode: activeMode, score }
      : { type },
    '*',
  )
}

function drawBackdrop() {
  const base = ctx.createLinearGradient(0, -10, 0, H + 10)
  base.addColorStop(0, activeTheme.bgTop)
  base.addColorStop(1, activeTheme.bgBottom)
  ctx.fillStyle = base
  ctx.fillRect(-10, -10, W + 20, H + 20)
  if (isLowPerformanceActive()) return

  const glow = ctx.createRadialGradient(W * 0.48, H * 0.3, 40, W * 0.48, H * 0.3, Math.max(W, H) * 0.72)
  glow.addColorStop(0, activeTheme.bgGlow)
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(-10, -10, W + 20, H + 20)
}

function drawTunnel() {
  if (isLowPerformanceActive()) return
  const cx = W * 0.5, cy = H * 0.5
  ctx.font = tunnelFont; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = activeTheme.tunnel

  for (let i = 0; i < TUNNEL_RINGS; i++) {
    tunnelZ[i] -= 0.67
    if (tunnelZ[i] < 10) {
      tunnelZ[i] += TUNNEL_DEPTH
      tunnelSide[i] = (tunnelSide[i] + 1) % 4
      tunnelTextIdx[i] = Math.random() * tunnelTexts.length | 0
    }
    const scale = 400 / (400 + tunnelZ[i])
    const alpha = Math.max(0, Math.min(0.06, 0.08 * scale - 0.01))
    if (alpha < 0.003) continue
    const spread = 350 * scale
    let x: number, y: number
    const s = tunnelSide[i]
    if (s === 0) { x = cx; y = cy - spread }
    else if (s === 1) { x = cx + spread; y = cy }
    else if (s === 2) { x = cx; y = cy + spread }
    else { x = cx - spread; y = cy }
    ctx.globalAlpha = alpha
    ctx.fillText(tunnelTexts[tunnelTextIdx[i]], x, y)
  }
  ctx.globalAlpha = 1
}

// ─── Enemies (reduced to simple arrays, fewer allocations) ──

type Enemy = {
  x: number; y: number; vx: number; vy: number
  hp: number; maxHp: number; char: string; size: number; color: string
  phase: number; dying: boolean; deathTimer: number; kind: number // 0=grunt,1=tank,2=fast,3=ghost
}

const enemies: Enemy[] = []
let score = 0, scoreFlash = 0

const EK = [
  { char: '◈', color: '#ff4466', hp: 1, size: 22, speed: 1.0 },
  { char: '⬢', color: '#ff6688', hp: 3, size: 28, speed: 0.5 },
  { char: '◇', color: '#44ddff', hp: 1, size: 16, speed: 2.2 },
  { char: '◌', color: '#aa88ff', hp: 2, size: 20, speed: 0.8 },
]

function spawnEnemy() {
  const k = EK[Math.random() * EK.length | 0], ki = EK.indexOf(k)
  const edge = Math.random() * 4 | 0
  let x = 0, y = 0
  if (edge === 0) { x = -30; y = Math.random() * H }
  else if (edge === 1) { x = W + 30; y = Math.random() * H }
  else if (edge === 2) { x = Math.random() * W; y = -30 }
  else { x = Math.random() * W; y = H + 30 }
  enemies.push({ x, y, vx: (Math.random() - 0.5) * k.speed * 2, vy: (Math.random() - 0.5) * k.speed * 2,
    hp: k.hp, maxHp: k.hp, char: k.char, size: k.size, color: activeTheme.enemyColors[ki] || k.color,
    phase: Math.random() * Math.PI * 2, dying: false, deathTimer: 0, kind: ki })
}

function updateEnemies(dt: number, time: number) {
  if (!cfg.showEnemies || activeMode === 'snake') return
  // Count alive
  let alive = 0
  for (let i = 0; i < enemies.length; i++) if (!enemies[i].dying) alive++
  const desiredEnemyCount = isLowPerformanceActive() ? Math.min(cfg.enemyCount, 4) : cfg.enemyCount
  while (alive < desiredEnemyCount) { spawnEnemy(); alive++ }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i]
    if (e.dying) {
      e.deathTimer -= dt; e.x += e.vx; e.y += e.vy; e.vx *= 0.95; e.vy *= 0.95
      if (e.deathTimer <= 0) { enemies[i] = enemies[enemies.length - 1]; enemies.pop() }
      continue
    }
    const spd = cfg.enemySpeed
    if (e.kind === 3) { e.x += Math.sin(time * 1.5 + e.phase) * spd * 1.2; e.y += Math.cos(time * 1.2 + e.phase * 1.3) * spd * 0.8 }
    else if (e.kind === 2) { e.x += e.vx * spd; e.y += e.vy * spd; if (Math.random() < dt * 0.5) { e.vx += (Math.random() - 0.5) * 3; e.vy += (Math.random() - 0.5) * 3 }; e.vx *= 0.99; e.vy *= 0.99 }
    else { e.vx += (W / 2 - e.x) * 0.0001 + (Math.random() - 0.5) * 0.1; e.vy += (H / 2 - e.y) * 0.0001 + (Math.random() - 0.5) * 0.1; e.vx *= 0.995; e.vy *= 0.995; e.x += e.vx * spd; e.y += e.vy * spd }
    if (e.x < -50) e.x = W + 40; if (e.x > W + 50) e.x = -40
    if (e.y < -50) e.y = H + 40; if (e.y > H + 50) e.y = -40
    const dx = e.x - chX[0], dy = e.y - chY[0], dSq = dx * dx + dy * dy
    if (dSq < 15000) { const d = Math.sqrt(dSq) || 1; const fl = 1.5 * (1 - d / 122); e.vx += (dx / d) * fl; e.vy += (dy / d) * fl }
  }
  if (scoreFlash > 0) scoreFlash -= dt * 3
}

function hitEnemiesWithFire(fx: number, fy: number) {
  if (!cfg.showEnemies || activeMode === 'snake') return
  const hr = cfg.fireRadius * 0.6, hrSq = hr * hr
  for (const e of enemies) {
    if (e.dying) continue
    const dx = e.x - fx, dy = e.y - fy, dSq = dx * dx + dy * dy
    if (dSq < hrSq) {
      const d = Math.sqrt(dSq) || 1; e.hp--; e.vx += (dx / d) * 5; e.vy += (dy / d) * 5
      if (e.hp <= 0) {
        e.dying = true; e.deathTimer = 0.5; e.vx = (dx / d) * 8; e.vy = (dy / d) * 8 - 3
        score += e.kind === 1 ? 30 : e.kind === 2 ? 20 : e.kind === 3 ? 25 : 10
        scoreFlash = 1; for (let j = 0; j < 3; j++) spawnEmber(e.x, e.y)
      }
    }
  }
}

function drawEnemies(time: number) {
  if (!cfg.showEnemies || activeMode === 'snake') return
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  for (const e of enemies) {
    if (e.dying) {
      const t = e.deathTimer / 0.5
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(time * 15); ctx.scale(t, t)
      ctx.globalAlpha = t * 0.8; ctx.font = `${e.size}px "Courier New",monospace`
      ctx.fillStyle = activeTheme.scoreFlash; ctx.fillText(e.char, 0, 0); ctx.restore()
    } else {
      const bob = Math.sin(time * 2.5 + e.phase) * 4
      ctx.globalAlpha = e.kind === 3 ? 0.4 + Math.sin(time * 3 + e.phase) * 0.2 : 0.75
      ctx.font = `${e.size}px "Courier New",monospace`; ctx.fillStyle = e.color
      ctx.fillText(e.char, e.x, e.y + bob)
    }
  }
  if (score > 0) {
    ctx.globalAlpha = 0.3 + scoreFlash * 0.4
    ctx.font = '600 14px Inter,system-ui,sans-serif'; ctx.fillStyle = scoreFlash > 0 ? activeTheme.scoreFlash : activeTheme.score
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(`SCORE ${score}`, 20, 20)
  }
  ctx.globalAlpha = 1
}

// ─── Runes (reduced count) ──────────────────────────────────

const RUNE_N = 8
const runeChars = '龍火竜鱗焔ᚱᚦᛏ'.split('')
const runeX = new Float32Array(RUNE_N), runeY = new Float32Array(RUNE_N)
const runeSpd = new Float32Array(RUNE_N), runePhase = new Float32Array(RUNE_N)
const runeSz = new Float32Array(RUNE_N), runeOp = new Float32Array(RUNE_N)
const runeC: string[] = []
for (let i = 0; i < RUNE_N; i++) {
  runeX[i] = Math.random() * W; runeY[i] = Math.random() * H
  runeSpd[i] = 0.1 + Math.random() * 0.4; runePhase[i] = Math.random() * Math.PI * 2
  runeSz[i] = 14 + Math.random() * 14; runeOp[i] = 0.02 + Math.random() * 0.04
  runeC[i] = runeChars[Math.random() * runeChars.length | 0]
}

function drawRunes(time: number) {
  if (!cfg.showRunes || isLowPerformanceActive()) return
  ctx.fillStyle = activeTheme.rune; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  for (let i = 0; i < RUNE_N; i++) {
    runeY[i] -= runeSpd[i]
    if (runeY[i] < -30) { runeY[i] = H + 30; runeX[i] = Math.random() * W }
    ctx.globalAlpha = runeOp[i] * (0.5 + Math.sin(time * 0.4 + runePhase[i]) * 0.5)
    ctx.font = `${runeSz[i]}px "Courier New",monospace`
    ctx.fillText(runeC[i], runeX[i] + Math.sin(time * 0.7 + runePhase[i]) * 12, runeY[i])
  }
  ctx.globalAlpha = 1
}

// ─── Draw dragon ────────────────────────────────────────────

function drawSnake(time: number) {
  if (activeMode !== 'snake') return

  const boardW = snakeCols * snakeCell
  const boardH = snakeRows * snakeCell
  const targetTier = getSnakeCurrentTierSize()
  const tierRemaining = getSnakeCurrentTierRemaining()
  const tierTotal = getSnakeTierCount(targetTier)
  const bodyScale = snakeBodyScale()
  const heading = getSnakeHeading()
  const headingAngle = getSnakeHeadingAngle()
  const boostGlow = snakeBoostTimer > 0 ? Math.min(1, snakeBoostTimer / 3.4) : 0
  const tierBurst = snakeTierBurst > 0 ? snakeTierBurst / SNAKE_TIER_BURST_TIME : 0

  ctx.save()
  if (tierBurst > 0) {
    const progress = 1 - tierBurst
    ctx.globalAlpha = 0.06 + tierBurst * 0.12
    ctx.fillStyle = `hsla(${Math.round((snakeTierBurstHue + 18) % 360)}, 100%, 62%, 1)`
    ctx.fillRect(snakeOffsetX, snakeOffsetY, boardW, boardH)

    ctx.globalAlpha = 0.2 + tierBurst * 0.2
    ctx.strokeStyle = `hsla(${Math.round(snakeTierBurstHue)}, 100%, 76%, 1)`
    ctx.lineWidth = 1.8 + tierBurst * 2.2
    ctx.strokeRect(snakeOffsetX - 3, snakeOffsetY - 3, boardW + 6, boardH + 6)

    for (let ring = 0; ring < 3; ring++) {
      const radius = snakeCell * (2.4 + progress * 7.5 + ring * 1.35)
      ctx.globalAlpha = Math.max(0, tierBurst * (0.32 - ring * 0.07))
      ctx.strokeStyle = `hsla(${Math.round((snakeTierBurstHue + ring * 24) % 360)}, 100%, ${78 - ring * 8}%, 1)`
      ctx.lineWidth = Math.max(1.2, 4 - ring)
      ctx.beginPath()
      ctx.arc(snakeTierBurstX, snakeTierBurstY, radius, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  ctx.globalAlpha = 0.09
  ctx.strokeStyle = activeTheme.accent
  ctx.lineWidth = 1
  ctx.setLineDash([5, 7])
  ctx.strokeRect(snakeOffsetX - 2, snakeOffsetY - 2, boardW + 4, boardH + 4)
  ctx.setLineDash([])

  ctx.globalAlpha = 0.05
  ctx.fillStyle = activeTheme.accent
  for (let y = 0; y < snakeRows; y += 2) {
    for (let x = (y % 4 === 0 ? 0 : 1); x < snakeCols; x += 2) {
      ctx.fillRect(snakeOffsetX + x * snakeCell, snakeOffsetY + y * snakeCell, 1, 1)
    }
  }

  const foodX = gridCenterX(snakeFood.x)
  const foodY = gridCenterY(snakeFood.y)
  const foodPulse = 0.55 + Math.sin(time * 6) * 0.18 + snakeFlash * 0.16
  const pulseBoost = snakePulse > 0 ? snakePulse : 0
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (snakeVictory) {
    for (let i = 0; i < snakeVictoryTreats.length; i++) {
      const treat = snakeVictoryTreats[i]
      const tx = gridCenterX(treat.x)
      const ty = gridCenterY(treat.y)
      const pulse = 0.58 + Math.sin(time * 5 + treat.wobble) * 0.18 + snakeVictoryPulse * 0.06
      ctx.globalAlpha = 0.14 + pulse * 0.12
      ctx.fillStyle = `hsla(${Math.round((treat.hue + 18) % 360)}, 100%, 64%, 1)`
      ctx.beginPath()
      ctx.arc(tx, ty, snakeCell * (0.46 + pulse * 0.18), 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 0.22 + pulse * 0.16
      ctx.strokeStyle = `hsla(${Math.round(treat.hue)}, 100%, 76%, 1)`
      ctx.lineWidth = 1.1
      ctx.beginPath()
      ctx.arc(tx, ty, snakeCell * (0.66 + pulse * 0.18), 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.font = `${snakeCell * 0.78}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji","Courier New",monospace`
      ctx.fillText(treat.emoji, tx, ty + Math.sin(time * 4 + treat.wobble) * 1.4)
    }
  } else {
    ctx.globalAlpha = foodPulse
    ctx.fillStyle = activeTheme.accent
    ctx.font = `${snakeCell * 0.82}px "Courier New",monospace`
    ctx.fillText('◎', foodX, foodY)
    ctx.globalAlpha = 0.16 + pulseBoost * 0.22
    ctx.strokeStyle = activeTheme.accentStrong
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(foodX, foodY, snakeCell * (0.34 + Math.sin(time * 3.5) * 0.03 + pulseBoost * 0.2), 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(foodX, foodY, snakeCell * (0.58 + Math.sin(time * 2.4 + 1.4) * 0.05), 0, Math.PI * 2)
    ctx.stroke()
  }

  if (snakeBody.length > 1) {
    ctx.beginPath()
    ctx.moveTo(snakeX[0], snakeY[0])
    for (let i = 1; i < snakeBody.length; i++) ctx.lineTo(snakeX[i], snakeY[i])
    ctx.globalAlpha = 0.12 + boostGlow * 0.08
    ctx.strokeStyle = activeTheme.accentStrong
    ctx.lineWidth = snakeCell * bodyScale * 0.42
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(snakeX[0], snakeY[0])
    for (let i = 1; i < snakeBody.length; i++) ctx.lineTo(snakeX[i], snakeY[i])
    ctx.globalAlpha = 0.16 + boostGlow * 0.14
    ctx.strokeStyle = activeTheme.cursorHot
    ctx.lineWidth = snakeCell * bodyScale * 0.14
    ctx.stroke()

    if (tierBurst > 0) {
      ctx.beginPath()
      ctx.moveTo(snakeX[0], snakeY[0])
      for (let i = 1; i < snakeBody.length; i++) ctx.lineTo(snakeX[i], snakeY[i])
      ctx.globalAlpha = 0.12 + tierBurst * 0.24
      ctx.strokeStyle = `hsla(${Math.round(snakeTierBurstHue)}, 100%, 74%, 1)`
      ctx.lineWidth = snakeCell * bodyScale * (0.2 + tierBurst * 0.16)
      ctx.stroke()
    }
  }

  for (let i = snakeBody.length - 1; i >= 0; i--) {
    const t = i / Math.max(1, snakeBody.length - 1)
    const color = i === 0
      ? activeTheme.cursorHot
      : rgbString(mixRgb(activeTheme.dragonBodyStart, activeTheme.dragonBodyEnd, Math.min(1, t * 1.2)))
    const size = snakeCell * bodyScale * (i === 0 ? 0.9 : 0.75 - Math.min(0.18, t * 0.12))
    const char = i === 0 ? '◉' : i < snakeBody.length * 0.35 ? '◆' : i < snakeBody.length * 0.7 ? '◇' : '·'
    ctx.globalAlpha = snakeAlive ? (0.95 - t * 0.3) : Math.max(0.2, 0.55 - t * 0.15)
    ctx.fillStyle = color
    if (i === 0 && !isLowPerformanceActive()) {
      ctx.shadowColor = tierBurst > 0
        ? `hsla(${Math.round(snakeTierBurstHue)}, 100%, 72%, 1)`
        : activeTheme.accentStrong
      ctx.shadowBlur = 18 + boostGlow * 14 + snakeFlash * 8 + tierBurst * 18
    } else {
      ctx.shadowBlur = 0
    }
    ctx.font = `bold ${size}px "Courier New",monospace`
    ctx.fillText(char, snakeX[i], snakeY[i] + Math.sin(time * 5 + i * 0.35) * 0.6)
    if (tierBurst > 0 && i < snakeBody.length * 0.55) {
      ctx.globalAlpha = Math.max(0.08, tierBurst * (0.34 - t * 0.18))
      ctx.fillStyle = `hsla(${Math.round((snakeTierBurstHue + i * 12) % 360)}, 100%, 74%, 1)`
      ctx.fillText(char, snakeX[i], snakeY[i] + Math.sin(time * 5 + i * 0.35) * 0.6)
    }

    if (i > 0 && i < snakeBody.length * 0.65) {
      ctx.save()
      ctx.translate(snakeX[i], snakeY[i])
      const prevX = snakeX[Math.max(0, i - 1)]
      const prevY = snakeY[Math.max(0, i - 1)]
      ctx.rotate(Math.atan2(prevY - snakeY[i], prevX - snakeX[i]) + Math.PI / 2)
      ctx.globalAlpha = 0.18 + (1 - t) * 0.12
      ctx.fillStyle = activeTheme.accentStrong
      ctx.font = `${size * 0.45}px "Courier New",monospace`
      ctx.fillText('^', 0, -size * 0.62)
      ctx.restore()
    }
  }

  ctx.shadowBlur = 0
  ctx.save()
  ctx.translate(snakeX[0], snakeY[0])
  ctx.rotate(headingAngle)
  ctx.globalAlpha = 0.22 + snakeFlash * 0.12
  ctx.fillStyle = activeTheme.accentStrong
  ctx.font = `${snakeCell * bodyScale * 0.8}px "Courier New",monospace`
  ctx.fillText('>', snakeCell * bodyScale * 0.52, 0)
  ctx.fillText('<', snakeCell * bodyScale * 0.1, 0)
  ctx.globalAlpha = 0.9
  ctx.fillStyle = '#fff'
  ctx.font = `${snakeCell * bodyScale * 0.22}px "Courier New",monospace`
  ctx.fillText('•', snakeCell * bodyScale * 0.16, -snakeCell * bodyScale * 0.14)
  ctx.fillText('•', snakeCell * bodyScale * 0.16, snakeCell * bodyScale * 0.14)
  ctx.restore()

  ctx.globalAlpha = 0.55
  ctx.fillStyle = activeTheme.textSecondary
  ctx.font = '11px "Courier New",monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(`SNEEK-MODUS  |  ${activeSnakeDifficulty.label.toUpperCase()}  |  LETTERS ${snakeScore}  |  LENGTE ${snakeBody.length}  |  BOLLEN ${snakeBonusCount}`, snakeOffsetX, snakeOffsetY - 28)
  ctx.fillText(
    snakeVictory
      ? `Overwinningsfeest  |  bonus gegeten ${snakeVictoryEaten}  |  schaal x${bodyScale.toFixed(2)}`
      : targetTier == null
      ? `Alle lettergroottes zijn op  |  schaal x${bodyScale.toFixed(2)}`
      : `Doel ${targetTier}px  |  nog ${tierRemaining}/${tierTotal}  |  trage groei tijdens eten  |  surge bij clear`,
    snakeOffsetX,
    snakeOffsetY - 12,
  )
  ctx.fillText(
    snakeVictory
      ? 'Na de winst: eet bonus-emoji voor bursts, snelheid en extra lengte'
      : snakeBoostTimer > 0
      ? `Boost actief ${snakeBoostTimer.toFixed(1)}s  |  bol = extra snelheid`
      : 'Eet alleen de opgelichte lettergrootte  |  bol = extra snelheid',
    snakeOffsetX,
    snakeOffsetY + boardH + 12,
  )

  if (snakeTierFlash > 0 && snakeTierLabel) {
    ctx.globalAlpha = Math.min(0.9, snakeTierFlash * 0.7)
    ctx.fillStyle = activeTheme.textPrimary
    ctx.font = 'bold 16px "Courier New",monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(snakeTierLabel, W / 2, snakeOffsetY - 42)
  }

  if (snakeVictory) {
    const victoryAlpha = Math.min(0.92, 0.34 + snakeVictoryPulse * 0.22 + Math.sin(time * 5.2) * 0.04)
    ctx.globalAlpha = victoryAlpha
    ctx.fillStyle = activeTheme.textPrimary
    ctx.font = 'bold 28px "Courier New",monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('OVERWINNINGSFEEST', W / 2, H / 2 - 22)
    ctx.globalAlpha = Math.min(0.84, 0.22 + snakeVictoryPulse * 0.18)
    ctx.fillStyle = activeTheme.accentStrong
    ctx.font = '13px "Courier New",monospace'
    ctx.fillText('Alle letters zijn op - blijf de bonus-emoji eten', W / 2, H / 2 + 12)
  }

  if (!snakeAlive) {
    ctx.globalAlpha = 0.9
    ctx.fillStyle = activeTheme.textPrimary
    ctx.font = 'bold 26px "Courier New",monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('SNEEK GECRASHT', W / 2, H / 2 - 14)
    ctx.globalAlpha = 0.55
    ctx.font = '13px "Courier New",monospace'
    ctx.fillStyle = activeTheme.textSecondary
    ctx.fillText('Druk op spatie of Enter om opnieuw te starten', W / 2, H / 2 + 18)
  }

  if (snakeAlive && !snakeStarted) {
    snakeStartButton.w = Math.max(180, snakeCell * 8.6)
    snakeStartButton.h = 42
    snakeStartButton.x = W / 2 - snakeStartButton.w / 2
    snakeStartButton.y = H / 2 + 18

    ctx.globalAlpha = 0.88
    ctx.fillStyle = activeTheme.surfaceStrong
    ctx.fillRect(snakeStartButton.x, snakeStartButton.y, snakeStartButton.w, snakeStartButton.h)
    ctx.globalAlpha = 1
    ctx.strokeStyle = activeTheme.accentStrong
    ctx.lineWidth = 1.5
    ctx.strokeRect(snakeStartButton.x, snakeStartButton.y, snakeStartButton.w, snakeStartButton.h)

    ctx.globalAlpha = 0.9
    ctx.fillStyle = activeTheme.textPrimary
    ctx.font = 'bold 24px "Courier New",monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('SNEEK KLAAR', W / 2, H / 2 - 16)
    ctx.globalAlpha = 0.72
    ctx.font = '13px "Courier New",monospace'
    ctx.fillStyle = activeTheme.textSecondary
    ctx.fillText(`Druk op pijl omhoog of klik START voor ${activeSnakeDifficulty.label.toLowerCase()}`, W / 2, H / 2 + 6)
    ctx.globalAlpha = 1
    ctx.fillStyle = activeTheme.accentStrong
    ctx.font = 'bold 14px "Courier New",monospace'
    ctx.fillText('START', W / 2, snakeStartButton.y + snakeStartButton.h / 2)
  } else {
    snakeStartButton.w = 0
    snakeStartButton.h = 0
  }

  ctx.restore()
}

function drawDragon(time: number) {
  if (activeMode !== 'dragon') return
  const breath = getDragonBreathVector()
  for (let i = chainN - 1; i >= 0; i--) {
    const sc = segScale(i), ci = Math.min(i, dragonChars.length - 1), size = 14 * sc
    const t = i / chainN, p = Math.sin(time * 3 + i * 0.3) * 0.12
    let color: string
    if (i < 3) {
      color = rgbString(mixRgb(activeTheme.dragonHead, activeTheme.dragonHeadHot, 0.45 + p * 0.8))
    }
    else {
      const w = Math.sin(time * 2 - i * 0.15) * 0.15
      const body = mixRgb(activeTheme.dragonBodyStart, activeTheme.dragonBodyEnd, Math.min(1, t * 1.1))
      color = `rgba(${clampChannel(body[0] + p * 24)},${clampChannel(body[1] + w * 48)},${clampChannel(body[2] + w * 28)},${1 - t * 0.45})`
    }
    let angle = i === 0
      ? Math.atan2(mouse.y - chY[0], mouse.x - chX[0])
      : Math.atan2(chY[i - 1] - chY[i], chX[i - 1] - chX[i])

    if (i < 4) {
      ctx.globalAlpha = 0.06 * (isBreathingFire ? 2 : 1)
      ctx.fillStyle = activeTheme.dragonGlow; ctx.beginPath()
      ctx.arc(chX[i], chY[i], size * 1.1, 0, Math.PI * 2); ctx.fill()
    }

    if (cfg.showSpines && i >= 4 && i <= 30 && i % 3 === 0) {
      const sa = angle + Math.PI / 2
      ctx.globalAlpha = 0.35
      ctx.font = `${size * (0.6 + Math.sin(time * 3 + i) * 0.15)}px "Courier New",monospace`
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('▴', chX[i] + Math.cos(sa) * size * 0.35, chY[i] + Math.sin(sa) * size * 0.35)
    }

    if (cfg.showWings && i >= 7 && i <= 16 && i % 2 === 0) {
      const wp = Math.sin(time * 3.5 + i * 0.4) * 0.5
      const ws = size * (1.8 - Math.abs(i - 11.5) * 0.12), wd = size * 1.4
      const w1 = angle + Math.PI / 2 + wp, w2 = angle - Math.PI / 2 - wp
      ctx.globalAlpha = 0.4; ctx.font = `${ws}px "Courier New",monospace`
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('≺', chX[i] + Math.cos(w1) * wd, chY[i] + Math.sin(w1) * wd)
      ctx.fillText('≻', chX[i] + Math.cos(w2) * wd, chY[i] + Math.sin(w2) * wd)
    }

    ctx.save(); ctx.translate(chX[i], chY[i]); ctx.rotate(angle)
    ctx.globalAlpha = 1; ctx.font = `bold ${size}px "Courier New",monospace`; ctx.fillStyle = color
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(dragonChars[ci], 0, Math.sin(time * 5 + i * 0.35) * 1.5)
    if (isBreathingFire && i < 3) { ctx.globalAlpha = 0.3; ctx.fillStyle = activeTheme.cursorHot; ctx.fillText(dragonChars[ci], 0, Math.sin(time * 5 + i * 0.35) * 1.5) }
    ctx.restore()
  }

  if (isBreathingFire && isLowPerformanceActive()) {
    const pulse = 0.55 + Math.sin(time * 11) * 0.18
    const reach = 42 + Math.min(110, totalFireTime * 85)
    const spread = 12 + Math.min(36, totalFireTime * 18)
    ctx.save()
    ctx.translate(breath.hx, breath.hy)
    ctx.rotate(breath.angle)
    ctx.globalAlpha = 0.14 + pulse * 0.1
    ctx.fillStyle = activeTheme.accentStrong
    ctx.beginPath()
    ctx.moveTo(10, 0)
    ctx.lineTo(reach, -spread)
    ctx.lineTo(reach + 16, 0)
    ctx.lineTo(reach, spread)
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = 0.38 + pulse * 0.18
    ctx.strokeStyle = activeTheme.cursorHot
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(12, 0)
    ctx.lineTo(reach + 8, 0)
    ctx.stroke()
    ctx.font = `${10 + pulse * 6}px "Courier New",monospace`
    ctx.fillStyle = activeTheme.cursorHot
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('✦', reach * 0.55, 0)
    ctx.restore()
  }

  // Eyes
  const ha = Math.atan2(mouse.y - chY[0], mouse.x - chX[0])
  const ex = chX[0] + Math.cos(ha + 0.5) * 10, ey = chY[0] + Math.sin(ha + 0.5) * 10
  ctx.globalAlpha = isBreathingFire ? 0.2 : 0.1; ctx.fillStyle = activeTheme.accent
  ctx.beginPath(); ctx.arc(ex, ey, isBreathingFire ? 18 : 12, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 1; ctx.fillStyle = isBreathingFire ? '#fff' : activeTheme.cursorHot
  ctx.font = '16px "Courier New"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(time % 5 > 4.7 ? '—' : isBreathingFire ? '◉' : '⊙', ex, ey)
}

// ─── Cursor ─────────────────────────────────────────────────

function drawCursor(time: number) {
  if (!cfg.showCursor || activeMode !== 'dragon') return
  const mx = mouse.x, my = mouse.y
  ctx.save()
  ctx.translate(mx, my); ctx.rotate(time * 0.4)
  ctx.globalAlpha = 0.25; ctx.strokeStyle = activeTheme.cursor; ctx.lineWidth = 1
  ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 0.5); ctx.stroke()
  ctx.beginPath(); ctx.arc(0, 0, 16, Math.PI, Math.PI * 1.5); ctx.stroke()
  ctx.restore()
  ctx.globalAlpha = isBreathingFire ? 0.8 : 0.5; ctx.fillStyle = isBreathingFire ? activeTheme.cursorHot : activeTheme.cursor
  ctx.beginPath(); ctx.arc(mx, my, isBreathingFire ? 3 : 2, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 0.15; ctx.strokeStyle = activeTheme.cursor; ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(mx - 24, my); ctx.lineTo(mx - 8, my); ctx.moveTo(mx + 8, my); ctx.lineTo(mx + 24, my)
  ctx.moveTo(mx, my - 24); ctx.lineTo(mx, my - 8); ctx.moveTo(mx, my + 8); ctx.lineTo(mx, my + 24)
  ctx.stroke(); ctx.globalAlpha = 1
}

// ─── UI Panel binding ───────────────────────────────────────

const panel = document.getElementById('panel')!
const toggle = document.getElementById('panel-toggle')!
const closeBtn = document.getElementById('panel-close')!
const modesEl = document.getElementById('modes')!
const difficultiesEl = document.getElementById('difficulties')!
const themesEl = document.getElementById('themes')!
const presetsEl = document.getElementById('presets')!
const statsEl = document.getElementById('stats')!
const hintEl = document.getElementById('hint') as HTMLDivElement | null
const contentInputEl = document.getElementById('content-input') as HTMLTextAreaElement | null
const contentFileEl = document.getElementById('content-file') as HTMLInputElement | null
const contentApplyEl = document.getElementById('content-apply') as HTMLButtonElement | null
const contentResetEl = document.getElementById('content-reset') as HTMLButtonElement | null
const contentStatusEl = document.getElementById('content-status') as HTMLDivElement | null

const modeButtons = new Map<PlayMode, HTMLButtonElement>()
const difficultyButtons = new Map<SnakeDifficultyName, HTMLButtonElement>()
const themeButtons = new Map<ThemeName, HTMLButtonElement>()
let hintVisibleUntil = performance.now() + 6000

function applyEmbeddedUiState() {
  if (!isEmbeddedReward) return
  const allowPanel = activeRewardConfig.showPanel === true
  panel.style.display = allowPanel ? 'block' : 'none'
  toggle.style.display = allowPanel ? 'flex' : 'none'
  if (!allowPanel) panel.classList.remove('open')
  if (activeRewardConfig.compactHud) {
    statsEl.style.bottom = '8px'
    statsEl.style.right = '10px'
    statsEl.style.fontSize = '9px'
  }
}

function syncEnemyThemeColors() {
  for (const enemy of enemies) enemy.color = activeTheme.enemyColors[enemy.kind] || enemy.color
}

function setRootThemeVars(theme: Theme) {
  const root = document.documentElement
  root.style.setProperty('--page-bg', theme.pageBg)
  root.style.setProperty('--page-text', theme.textPrimary)
  root.style.setProperty('--surface', theme.surface)
  root.style.setProperty('--surface-strong', theme.surfaceStrong)
  root.style.setProperty('--surface-hover', theme.surfaceHover)
  root.style.setProperty('--surface-soft', theme.surfaceSoft)
  root.style.setProperty('--surface-softer', theme.surfaceSofter)
  root.style.setProperty('--surface-softest', theme.surfaceSoftest)
  root.style.setProperty('--border', theme.border)
  root.style.setProperty('--border-soft', theme.borderSoft)
  root.style.setProperty('--border-subtle', theme.borderSubtle)
  root.style.setProperty('--track', theme.track)
  root.style.setProperty('--thumb', theme.thumb)
  root.style.setProperty('--thumb-hover', theme.thumbHover)
  root.style.setProperty('--text-primary', theme.textPrimary)
  root.style.setProperty('--text-secondary', theme.textSecondary)
  root.style.setProperty('--text-muted', theme.textMuted)
  root.style.setProperty('--text-dim', theme.textDim)
  root.style.setProperty('--text-faint', theme.textFaint)
  root.style.setProperty('--nav-title', theme.navTitle)
  root.style.setProperty('--accent', theme.accent)
  root.style.setProperty('--accent-strong', theme.accentStrong)
  root.style.setProperty('--accent-soft', theme.accentSoft)
  root.style.setProperty('--accent-softer', theme.accentGlow)
}

function syncThemeButtons() {
  for (const [name, button] of themeButtons) button.classList.toggle('active', name === activeThemeName)
}

function syncModeButtons() {
  for (const [name, button] of modeButtons) button.classList.toggle('active', name === activeMode)
}

function syncDifficultyButtons() {
  for (const [name, button] of difficultyButtons) button.classList.toggle('active', name === activeSnakeDifficultyName)
}

function syncModeNav() {
  navDroakEl?.classList.toggle('active', activeMode === 'dragon')
  navSneekEl?.classList.toggle('active', activeMode === 'snake')
}

function syncModeUrl() {
  const url = new URL(location.href)
  if (activeMode === 'snake') url.searchParams.set('mode', 'snake')
  else url.searchParams.delete('mode')
  history.replaceState({}, '', url)
}

function updateModeHint() {
  canvas.style.cursor = activeMode === 'dragon' ? 'crosshair' : 'default'
  hintVisibleUntil = performance.now() + 6000
  if (!hintEl) return
  const baseHint = activeMode === 'dragon'
    ? (isLowPerformanceActive()
      ? 'droak: muis + puls — trek door de tekst — druk op P voor het paneel'
      : 'droak: muis + vuur — Enter = chaosbom — druk op P voor het paneel')
    : `sneek: ${activeSnakeDifficulty.label.toLowerCase()} — druk op pijl omhoog of START — eet de opgelichte lettergrootte — bol = snelheidsboost`
  hintEl.textContent = `${baseHint} — ${getPerformanceModeLabel()}`
  hintEl.style.opacity = '1'
}

function setContentStatus(message: string) {
  if (!contentStatusEl) return
  contentStatusEl.textContent = message
}

function syncContentEditor(rawText?: string | null) {
  const nextText = typeof rawText === 'string' ? rawText : sharedContent.rawText
  if (contentInputEl && contentInputEl.value !== nextText) contentInputEl.value = nextText
}

function syncContentStatus(rawText?: string | null) {
  if (isDefaultContentText(rawText)) setContentStatus('Standaardtekst actief - vaste compositie voor Droak, Sneek en Experimenteel.')
  else {
    const nextText = typeof rawText === 'string' ? rawText : sharedContent.rawText
    setContentStatus(`Eigen tekst actief - ${nextText.length} tekens - slimme omzetting actief.`)
  }
}

function applyRewardRuntimeConfig(nextConfig: RewardRuntimeConfig) {
  activeRewardConfig = mergeRewardRuntimeConfig(activeRewardConfig, nextConfig)
  if (activeRewardConfig.text !== undefined) {
    applySharedContent(activeRewardConfig.text)
    syncContentEditor(activeRewardConfig.text)
    syncContentStatus(activeRewardConfig.text)
  }
  if (activeRewardConfig.theme && Object.prototype.hasOwnProperty.call(THEMES, activeRewardConfig.theme)) {
    applyTheme(activeRewardConfig.theme as ThemeName)
  }
  if (activeRewardConfig.difficulty && Object.prototype.hasOwnProperty.call(SNAKE_DIFFICULTIES, activeRewardConfig.difficulty)) {
    applySnakeDifficulty(activeRewardConfig.difficulty as SnakeDifficultyName)
  }
  if (activeRewardConfig.mode === 'dragon' || activeRewardConfig.mode === 'snake') {
    applyMode(activeRewardConfig.mode)
  }
  applyEmbeddedUiState()
  if (activeRewardConfig.autoStartSnake && activeMode === 'snake') startSnake()
}

function applyTheme(name: ThemeName) {
  activeThemeName = name
  activeTheme = THEMES[name]
  setRootThemeVars(activeTheme)
  syncThemeButtons()
  syncEnemyThemeColors()
  if (hintEl) hintEl.style.color = `${activeTheme.textSecondary}55`
  try { localStorage.setItem(THEME_STORAGE_KEY, name) } catch {}
  if (initialized) layoutAllText()
}

function applySnakeDifficulty(name: SnakeDifficultyName) {
  activeSnakeDifficultyName = name
  activeSnakeDifficulty = SNAKE_DIFFICULTIES[name]
  syncDifficultyButtons()
  updateModeHint()
  try { localStorage.setItem(SNAKE_DIFFICULTY_STORAGE_KEY, name) } catch {}
}

function applyMode(mode: PlayMode) {
  activeMode = mode
  isBreathingFire = false
  bombs.length = 0
  bombCooldown = 0
  if (mode === 'dragon') { rebuildDragon(); restoreSnakeLetters() }
  else resetSnake()
  syncModeButtons()
  syncModeNav()
  syncModeUrl()
  updateModeHint()
}

let panelOpen = false
function setPanelOpen(open: boolean) {
  panelOpen = open; panel.classList.toggle('open', open)
  toggle.style.display = open ? 'none' : 'flex'
}
toggle.addEventListener('click', (e) => { e.stopPropagation(); setPanelOpen(true) })
closeBtn.addEventListener('click', (e) => { e.stopPropagation(); setPanelOpen(false) })
addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement | null
  if ((e.key === 'p' || e.key === 'P') && !target?.closest('input,textarea')) setPanelOpen(!panelOpen)
  if (e.key === 'Escape' && panelOpen) setPanelOpen(false)
  if ((e.key === 'Enter' || e.code === 'NumpadEnter')
    && activeMode === 'dragon'
    && !panelOpen
    && !target?.closest('input,textarea,button,select,a,#panel,#panel-toggle')
    && canDropChaosBomb()) {
    e.preventDefault()
    dropChaosBomb()
  }
})
panel.addEventListener('mousedown', (e) => e.stopPropagation())
panel.addEventListener('touchstart', (e) => e.stopPropagation())

for (const mode of PLAY_MODES) {
  const btn = document.createElement('button')
  btn.className = 'theme-btn mode-btn'
  btn.type = 'button'
  btn.textContent = mode.label
  btn.addEventListener('click', () => applyMode(mode.name))
  modesEl.appendChild(btn)
  modeButtons.set(mode.name, btn)
}

for (const [name, difficulty] of Object.entries(SNAKE_DIFFICULTIES) as [SnakeDifficultyName, SnakeDifficulty][]) {
  const btn = document.createElement('button')
  btn.className = 'theme-btn mode-btn'
  btn.type = 'button'
  btn.textContent = difficulty.label
  btn.addEventListener('click', () => applySnakeDifficulty(name))
  difficultiesEl.appendChild(btn)
  difficultyButtons.set(name, btn)
}

for (const [name, theme] of Object.entries(THEMES) as [ThemeName, Theme][]) {
  const btn = document.createElement('button')
  btn.className = 'theme-btn'
  btn.type = 'button'

  const swatch = document.createElement('span')
  swatch.className = 'theme-swatch'
  swatch.style.background = `linear-gradient(135deg, ${theme.accent}, ${theme.accentStrong})`

  const label = document.createElement('span')
  label.className = 'theme-label'
  label.textContent = theme.label

  btn.append(swatch, label)
  btn.addEventListener('click', () => applyTheme(name))
  themesEl.appendChild(btn)
  themeButtons.set(name, btn)
}

for (const name of Object.keys(PRESETS)) {
  const btn = document.createElement('button')
  btn.className = 'preset-btn'; btn.textContent = name
  btn.addEventListener('click', () => {
    applyPreset(name)
    presetsEl.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
  })
  presetsEl.appendChild(btn)
}

syncContentEditor(sharedContent.rawText)
syncContentStatus(sharedContent.rawText)

function commitEditorContent(rawText: string) {
  const nextText = saveCustomContentText(rawText)
  syncContentEditor(nextText)
  syncContentStatus(nextText)
}

contentApplyEl?.addEventListener('click', () => {
  commitEditorContent(contentInputEl?.value || getDefaultContentText())
})

contentResetEl?.addEventListener('click', () => {
  const nextText = resetCustomContentText()
  syncContentEditor(nextText)
  syncContentStatus(nextText)
})

contentFileEl?.addEventListener('change', async () => {
  const file = contentFileEl.files?.[0]
  if (!file) return
  const fileText = await file.text()
  commitEditorContent(fileText)
  if (contentFileEl) contentFileEl.value = ''
  setContentStatus(`Bestand geladen: ${file.name} - slimme omzetting actief.`)
})

window.addEventListener(CUSTOM_CONTENT_EVENT, (event) => {
  const detail = (event as CustomEvent<{ rawText?: string }>).detail
  const rawText = detail?.rawText || getDefaultContentText()
  applySharedContent(rawText)
  syncContentEditor(rawText)
  syncContentStatus(rawText)
})

window.addEventListener('storage', (event) => {
  if (event.key !== CUSTOM_CONTENT_STORAGE_KEY) return
  applySharedContent(event.newValue)
  syncContentEditor(event.newValue || getDefaultContentText())
  syncContentStatus(event.newValue)
})

window.addEventListener('message', (event) => {
  if (!isEmbeddedReward || !isRewardRuntimeMessage(event.data)) return
  if (event.data.type !== 'hlc-reward-config') return
  applyRewardRuntimeConfig(sanitizeRewardRuntimeConfig(event.data.payload))
})

function syncUI() {
  panel.querySelectorAll<HTMLInputElement>('input[data-key]').forEach(input => {
    const key = input.dataset.key as keyof typeof cfg
    if (input.type === 'checkbox') input.checked = cfg[key] as boolean
    else input.value = String(cfg[key])
    const v = panel.querySelector(`[data-val="${key}"]`)
    if (v) v.textContent = String(cfg[key])
  })
}

panel.querySelectorAll<HTMLInputElement>('input[data-key]').forEach(input => {
  const key = input.dataset.key as keyof typeof cfg
  const handler = () => {
    (cfg as any)[key] = input.type === 'checkbox' ? input.checked : parseFloat(input.value)
    const v = panel.querySelector(`[data-val="${key}"]`)
    if (v) v.textContent = input.type === 'checkbox' ? String(input.checked) : parseFloat(input.value).toFixed(input.step?.includes('.') ? 3 : 0)
    if (key === 'dragonSegments') rebuildDragon()
    if (key === 'lowPerformance' || key === 'autoPerformance') { resize(); updateModeHint() }
    presetsEl.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'))
  }
  input.addEventListener('input', handler); input.addEventListener('change', handler)
})
syncUI()
applyTheme(activeThemeName)
applySnakeDifficulty(activeSnakeDifficultyName)
applyMode(activeMode)
applyEmbeddedUiState()

// ─── Main loop ──────────────────────────────────────────────

let lastTime = performance.now(), time = 0, frameCount = 0, fpsTime = 0, fps = 0

initialized = true; layoutAllText()
if (isEmbeddedReward) applyRewardRuntimeConfig(activeRewardConfig)
document.fonts.ready.then(layoutAllText)
emitRewardMessage('hlc-reward-ready')

// ─── Easter eggs (verborgen Sneek-surprises) ────────────────
// Twee triggers:
//   1) Auto: elke 60-180 sec random, terwijl snake actief speelt
//   2) Spatie/Enter tijdens spel: 25% kans op directe egg
//      Reset-on-gameover blijft prioriteit als snake dood is.
// Doel: speler een glimlach geven zonder dat ze het kunnen voorspellen.

type EasterEggType = 'golalok' | 'confetti' | 'rainbow' | 'bombs'

interface EasterEggParticle {
  x: number; y: number; vx: number; vy: number
  size: number; rotation: number; rotSpeed: number
  color: string; emoji?: string
}

let activeEasterEgg: { type: EasterEggType; startTime: number; duration: number } | null = null
let easterEggParticles: EasterEggParticle[] = []
// Eerste auto-trigger: 30-75 sec — speler ontdekt dat het systeem bestaat,
// daarna zakt cadans naar 60-180 sec zodat het niet voorspelbaar wordt.
let nextAutoEasterEggTime = 30 + Math.random() * 45

const EASTER_EGG_TYPES: EasterEggType[] = ['golalok', 'confetti', 'rainbow', 'bombs']
const EASTER_EGG_COLORS = ['#fbbf24', '#10b981', '#f43f5e', '#a855f7', '#22d3ee', '#f97316', '#ec4899']
let lastEasterEggType: EasterEggType | null = null

function pickEasterEggType(): EasterEggType {
  // Vermijd zelfde type 2x na elkaar — meer variatie voelt speler aan.
  const pool = lastEasterEggType
    ? EASTER_EGG_TYPES.filter(t => t !== lastEasterEggType)
    : EASTER_EGG_TYPES
  return pool[Math.floor(Math.random() * pool.length)]
}

function triggerEasterEgg(type?: EasterEggType) {
  const chosen = type ?? pickEasterEggType()
  lastEasterEggType = chosen
  // Korte effecten zodat gameplay nauwelijks gestoord wordt.
  const duration = chosen === 'rainbow' ? 1.2 : chosen === 'golalok' ? 1.8 : 2.6
  activeEasterEgg = { type: chosen, startTime: time, duration }
  easterEggParticles = []

  if (chosen === 'confetti') {
    for (let i = 0; i < 90; i++) {
      easterEggParticles.push({
        x: Math.random() * W,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 80,
        vy: 150 + Math.random() * 260,
        size: 6 + Math.random() * 9,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 9,
        color: EASTER_EGG_COLORS[Math.floor(Math.random() * EASTER_EGG_COLORS.length)],
      })
    }
  } else if (chosen === 'bombs') {
    for (let i = 0; i < 18; i++) {
      easterEggParticles.push({
        x: Math.random() * W,
        y: -40 - Math.random() * 300,
        vx: (Math.random() - 0.5) * 50,
        vy: 200 + Math.random() * 160,
        size: 36 + Math.random() * 22,
        rotation: 0,
        rotSpeed: (Math.random() - 0.5) * 4,
        color: '',
        emoji: Math.random() < 0.7 ? '💣' : '💥',
      })
    }
  } else if (chosen === 'golalok') {
    // Sterren-burst rond de centrale tekst — extra visuele punch
    for (let i = 0; i < 28; i++) {
      const angle = (i / 28) * Math.PI * 2
      const speed = 120 + Math.random() * 180
      easterEggParticles.push({
        x: W / 2,
        y: H / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 8 + Math.random() * 6,
        rotation: angle,
        rotSpeed: (Math.random() - 0.5) * 6,
        color: EASTER_EGG_COLORS[Math.floor(Math.random() * EASTER_EGG_COLORS.length)],
      })
    }
  }
}

function updateEasterEgg(dt: number) {
  if (!activeEasterEgg) return
  if (time - activeEasterEgg.startTime > activeEasterEgg.duration) {
    activeEasterEgg = null
    easterEggParticles = []
    return
  }
  const gravity = activeEasterEgg.type === 'golalok' ? 40 : 250
  for (const p of easterEggParticles) {
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.vy += gravity * dt
    p.rotation += p.rotSpeed * dt
  }
}

function drawEasterEgg() {
  if (!activeEasterEgg) return
  const elapsed = time - activeEasterEgg.startTime
  const dur = activeEasterEgg.duration

  if (activeEasterEgg.type === 'rainbow') {
    const t = Math.min(1, elapsed / dur)
    const flash = Math.sin(t * Math.PI) // pulse: peak in midden
    ctx.save()
    ctx.globalAlpha = 0.5 * flash
    const hue = (elapsed * 240) % 360
    const grad = ctx.createLinearGradient(0, 0, W, H)
    for (let i = 0; i <= 6; i++) {
      grad.addColorStop(i / 6, `hsl(${(hue + i * 60) % 360}, 95%, 55%)`)
    }
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)
    // Tekst over de regenboog
    ctx.globalAlpha = flash
    ctx.font = 'bold 64px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 6
    ctx.strokeStyle = '#000'
    ctx.fillStyle = '#fff'
    ctx.strokeText('🌈 TALOK-FLASH 🌈', W / 2, H / 2)
    ctx.fillText('🌈 TALOK-FLASH 🌈', W / 2, H / 2)
    ctx.restore()
    return
  }

  if (activeEasterEgg.type === 'golalok') {
    // Sterren-burst eerst (achter de tekst)
    ctx.save()
    for (const p of easterEggParticles) {
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)
      ctx.fillStyle = p.color
      ctx.shadowColor = p.color
      ctx.shadowBlur = 12
      // Ster-vorm benadering met rotaterende balk
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      ctx.rotate(Math.PI / 2)
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      ctx.restore()
    }
    ctx.restore()

    // "GO TA LOK!" pulsend in het midden
    // Pop-in 0-0.3s, settle 0.3-1.4s, fade-out 1.4-1.8s
    const scale = elapsed < 0.3
      ? (elapsed / 0.3) * 1.25
      : 1.05 + Math.sin(elapsed * 7) * 0.07
    const rot = Math.sin(elapsed * 5) * 0.09
    const alpha = elapsed < 1.4 ? 1 : Math.max(0, 1 - (elapsed - 1.4) / 0.4)

    ctx.save()
    ctx.translate(W / 2, H / 2)
    ctx.rotate(rot)
    ctx.scale(scale, scale)
    ctx.globalAlpha = alpha

    // Glow-halo
    const halo = ctx.createRadialGradient(0, 0, 30, 0, 0, 380)
    halo.addColorStop(0, 'rgba(251,191,36,0.55)')
    halo.addColorStop(0.6, 'rgba(251,191,36,0.15)')
    halo.addColorStop(1, 'rgba(251,191,36,0)')
    ctx.fillStyle = halo
    ctx.fillRect(-W, -H, W * 2, H * 2)

    // Tekst
    const fontSize = Math.min(120, W * 0.14)
    ctx.font = `900 ${fontSize}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 10
    ctx.strokeStyle = '#7c2d12'
    ctx.strokeText('GO TA LOK!', 0, 0)
    const textGrad = ctx.createLinearGradient(0, -fontSize / 2, 0, fontSize / 2)
    textGrad.addColorStop(0, '#fde68a')
    textGrad.addColorStop(0.5, '#fbbf24')
    textGrad.addColorStop(1, '#f59e0b')
    ctx.fillStyle = textGrad
    ctx.fillText('GO TA LOK!', 0, 0)
    ctx.restore()
    return
  }

  // confetti + bombs: gewone particle-rendering
  ctx.save()
  const fadeOut = elapsed > dur - 0.5
    ? Math.max(0, (dur - elapsed) / 0.5)
    : 1
  ctx.globalAlpha = fadeOut
  for (const p of easterEggParticles) {
    if (p.y > H + 80) continue // buiten scherm — skip
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rotation)
    if (p.emoji) {
      ctx.font = `${p.size}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(p.emoji, 0, 0)
    } else {
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size * 0.2, p.size, p.size * 0.4)
    }
    ctx.restore()
  }
  ctx.restore()
}

function maybeAutoTriggerEasterEgg() {
  if (activeMode !== 'snake' || !snakeAlive || !snakeStarted) return
  if (activeEasterEgg) return
  if (time >= nextAutoEasterEggTime) {
    triggerEasterEgg()
    // Plan volgende auto-trigger over 60-180 sec
    nextAutoEasterEggTime = time + 60 + Math.random() * 120
  }
}

function frame(now: number) {
  const dt = Math.min((now - lastTime) / 1000, 0.05)
  lastTime = now; time += dt
  frameCount++; fpsTime += dt
  if (fpsTime >= 0.5) { fps = Math.round(frameCount / fpsTime); frameCount = 0; fpsTime = 0 }
  const snakeTier = getSnakeCurrentTierSize()
  const perfTag = ` | ${getPerformanceModeLabel()}`
  const chaosTag = canDropChaosBomb()
    ? ` | chaos ${bombCooldown > 0 ? `${bombCooldown.toFixed(1)}s` : bombs.length >= 3 ? 'full' : 'ready'}`
    : ''
  const snakeTargetLabel = snakeVictory
    ? `feest ${snakeVictoryEaten}`
    : snakeTier == null
    ? 'klaar'
    : `${snakeTier}px`
  statsEl.textContent = activeMode === 'dragon'
    ? `${fps} fps | ${letterCount} letters | ${particleCount + emberCount} particles${perfTag}${chaosTag}`
    : `${fps} fps | sneek ${activeSnakeDifficulty.label.toLowerCase()} ${snakeStarted ? 'actief' : 'klaar'} | doel ${snakeTargetLabel} | lengte ${snakeBody.length}${snakeBoostTimer > 0 ? ' | boost' : ''}${perfTag}`

  updateShake()
  ctx.save(); ctx.translate(shakeX, shakeY)
  drawBackdrop()
  drawTunnel()
  drawRunes(time)
  updateChain(dt); updateChaosBombs(dt, time); interactLetters(dt); emitFire(dt); updateParticlesAndEmbers(dt)
  updateEnemies(dt, time)
  drawLetters(); drawChaosBombs(time); drawEnemies(time); drawDragon(time); drawSnake(time); drawParticles(time); drawCursor(time)
  ctx.restore()

  // Easter eggs op vaste positie tekenen (buiten shake-translate)
  // zodat de overlay leesbaar blijft terwijl het spel schudt.
  maybeAutoTriggerEasterEgg()
  updateEasterEgg(dt)
  drawEasterEgg()

  if (hintEl) hintEl.style.opacity = now > hintVisibleUntil ? '0' : '1'

  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)
