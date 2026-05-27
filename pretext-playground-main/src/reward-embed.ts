import {
  getRewardSessionStorageKey,
  isRewardRuntimeMessage,
  mergeRewardRuntimeConfig,
  sanitizeRewardRuntimeConfig,
  type RewardRuntimeConfig,
} from './reward-runtime'

export type RewardOverlayOptions = RewardRuntimeConfig & {
  mountTo?: HTMLElement
  pageUrl?: string
  zIndex?: number
  closeOnBackdrop?: boolean
  width?: string
  height?: string
  onReady?: () => void
  onComplete?: (payload: { mode: 'dragon' | 'snake'; score?: number }) => void
  onClose?: () => void
}

export type RewardOverlayController = {
  element: HTMLDivElement
  iframe: HTMLIFrameElement
  update: (next: RewardRuntimeConfig) => void
  close: () => void
}

function createSessionId() {
  return `reward-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function getDefaultRewardPageUrl() {
  return new URL('/reward.html', window.location.origin).toString()
}

function writeSessionConfig(sessionId: string, config: RewardRuntimeConfig) {
  sessionStorage.setItem(
    getRewardSessionStorageKey(sessionId),
    JSON.stringify(sanitizeRewardRuntimeConfig(config)),
  )
}

export function createRewardOverlay(options: RewardOverlayOptions = {}): RewardOverlayController {
  const mountTo = options.mountTo || document.body
  const sessionId = createSessionId()
  let activeConfig = sanitizeRewardRuntimeConfig({
    mode: 'snake',
    difficulty: 'easy',
    showPanel: false,
    showClose: true,
    hideNav: true,
    compactHud: true,
    ...options,
  })

  writeSessionConfig(sessionId, activeConfig)

  const root = document.createElement('div')
  root.dataset.rewardOverlay = 'true'
  root.style.position = 'fixed'
  root.style.inset = '0'
  root.style.zIndex = String(options.zIndex || 9999)
  root.style.display = 'grid'
  root.style.placeItems = 'center'
  root.style.background = 'rgba(5, 5, 7, 0.72)'
  root.style.backdropFilter = 'blur(10px)'

  const shell = document.createElement('div')
  shell.style.position = 'relative'
  shell.style.width = options.width || 'min(1200px, calc(100vw - 32px))'
  shell.style.height = options.height || 'min(760px, calc(100vh - 32px))'
  shell.style.borderRadius = '24px'
  shell.style.overflow = 'hidden'
  shell.style.background = '#050506'
  shell.style.boxShadow = '0 30px 100px rgba(0,0,0,0.45)'
  shell.style.border = '1px solid rgba(255,255,255,0.08)'

  const iframe = document.createElement('iframe')
  const pageUrl = new URL(options.pageUrl || getDefaultRewardPageUrl(), window.location.href)
  pageUrl.searchParams.set('embed', '1')
  pageUrl.searchParams.set('rewardSession', sessionId)
  if (activeConfig.mode) pageUrl.searchParams.set('mode', activeConfig.mode)
  iframe.src = pageUrl.toString()
  iframe.title = 'Reward overlay'
  iframe.style.display = 'block'
  iframe.style.width = '100%'
  iframe.style.height = '100%'
  iframe.style.border = '0'
  iframe.allow = 'fullscreen'

  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.textContent = 'Sluiten'
  closeButton.style.position = 'absolute'
  closeButton.style.top = '16px'
  closeButton.style.right = '16px'
  closeButton.style.zIndex = '2'
  closeButton.style.border = '1px solid rgba(255,255,255,0.14)'
  closeButton.style.background = 'rgba(10,10,12,0.68)'
  closeButton.style.color = '#f5dfcf'
  closeButton.style.padding = '8px 12px'
  closeButton.style.borderRadius = '999px'
  closeButton.style.cursor = 'pointer'
  closeButton.style.font = '600 12px/1 Inter, system-ui, sans-serif'
  closeButton.style.display = activeConfig.showClose === false ? 'none' : 'inline-flex'

  shell.append(iframe, closeButton)
  root.appendChild(shell)
  mountTo.appendChild(root)

  const cleanup = () => {
    window.removeEventListener('message', onMessage)
    try {
      sessionStorage.removeItem(getRewardSessionStorageKey(sessionId))
    } catch {}
    root.remove()
  }

  const close = () => {
    cleanup()
    options.onClose?.()
  }

  const update = (next: RewardRuntimeConfig) => {
    activeConfig = mergeRewardRuntimeConfig(activeConfig, sanitizeRewardRuntimeConfig(next))
    writeSessionConfig(sessionId, activeConfig)
    closeButton.style.display = activeConfig.showClose === false ? 'none' : 'inline-flex'
    iframe.contentWindow?.postMessage({ type: 'hlc-reward-config', payload: activeConfig }, '*')
  }

  const onMessage = (event: MessageEvent) => {
    if (event.source !== iframe.contentWindow || !isRewardRuntimeMessage(event.data)) return
    if (event.data.type === 'hlc-reward-ready') {
      iframe.contentWindow?.postMessage({ type: 'hlc-reward-config', payload: activeConfig }, '*')
      options.onReady?.()
      return
    }
    if (event.data.type === 'hlc-reward-complete') {
      options.onComplete?.({ mode: event.data.mode, score: event.data.score })
    }
  }

  window.addEventListener('message', onMessage)

  closeButton.addEventListener('click', close)
  if (options.closeOnBackdrop !== false) {
    root.addEventListener('click', (event) => {
      if (event.target === root) close()
    })
  }

  return {
    element: root,
    iframe,
    update,
    close,
  }
}

export function showRewardOverlay(options: RewardOverlayOptions = {}) {
  return createRewardOverlay(options)
}
