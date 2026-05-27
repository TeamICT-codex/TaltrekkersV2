import { prepareWithSegments, layoutWithLines, walkLineRanges } from '@chenglou/pretext'
import {
  CUSTOM_CONTENT_EVENT,
  CUSTOM_CONTENT_STORAGE_KEY,
  getResolvedContentPack,
  type ParticlePhrase,
  type ResolvedContentPack,
} from './content'

const NAV_H = 44
const canvas = document.getElementById('c') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
const dpr = Math.min(window.devicePixelRatio || 1, 2)
let W = innerWidth
let H = innerHeight - NAV_H

function resize() {
  W = innerWidth
  H = innerHeight - NAV_H
  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = `${W}px`
  canvas.style.height = `${H}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}
resize()
addEventListener('resize', resize)

function clientToScenePoint(clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect()
  const x = ((clientX - rect.left) / Math.max(1, rect.width)) * W
  const y = ((clientY - rect.top) / Math.max(1, rect.height)) * H
  return {
    x: Math.max(0, Math.min(W, x)),
    y: Math.max(0, Math.min(H, y)),
  }
}

const mouse = {
  x: W / 2,
  y: H / 2,
  down: false,
  justPressed: false,
  dragX: 0,
  dragY: 0,
}

let lastTouchPoint: { x: number; y: number } | null = null

addEventListener('mousemove', (e) => {
  const point = clientToScenePoint(e.clientX, e.clientY)
  mouse.x = point.x
  mouse.y = point.y
  if (mouse.down) {
    mouse.dragX = e.movementX
    mouse.dragY = e.movementY
  }
})

addEventListener('mousedown', (e) => {
  if ((e.target as HTMLElement).closest('#scene-tabs,.scene-btn')) return
  const point = clientToScenePoint(e.clientX, e.clientY)
  mouse.x = point.x
  mouse.y = point.y
  mouse.down = true
  mouse.justPressed = true
})

addEventListener('mouseup', () => {
  mouse.down = false
  mouse.dragX = 0
  mouse.dragY = 0
})

addEventListener('touchmove', (e) => {
  e.preventDefault()
  const touch = e.touches[0]
  if (!touch) return
  const point = clientToScenePoint(touch.clientX, touch.clientY)
  if (lastTouchPoint) {
    mouse.dragX = point.x - lastTouchPoint.x
    mouse.dragY = point.y - lastTouchPoint.y
  }
  mouse.x = point.x
  mouse.y = point.y
  lastTouchPoint = point
}, { passive: false })

addEventListener('touchstart', (e) => {
  if ((e.target as HTMLElement).closest('#scene-tabs,.scene-btn')) return
  const touch = e.touches[0]
  if (!touch) return
  const point = clientToScenePoint(touch.clientX, touch.clientY)
  mouse.x = point.x
  mouse.y = point.y
  mouse.down = true
  mouse.justPressed = true
  lastTouchPoint = point
})

addEventListener('touchend', () => {
  mouse.down = false
  mouse.dragX = 0
  mouse.dragY = 0
  lastTouchPoint = null
})

type Scene = {
  name: string
  hint: string
  init: () => void
  draw: (time: number, dt: number) => void
}

const scenes: Scene[] = []
let activeScene = 0
let sharedContent: ResolvedContentPack = getResolvedContentPack()

function buildMatrixCharSet() {
  const source = `${sharedContent.matrixTitle} TEAMICT SCHOLENGROEP DIGITALE BASIS 0123456789 <>*+`
  const chars: string[] = []
  const seen = new Set<string>()
  for (const char of source.toUpperCase()) {
    if (char === ' ') continue
    if (seen.has(char)) continue
    seen.add(char)
    chars.push(char)
  }
  return chars.join('')
}

// Scene 1: Signaalregen
let matrixShockwaves: { x: number; y: number; t: number; radius: number }[] = []

scenes.push({
  name: 'Signaalregen',
  hint: 'Beweeg met de muis om kolommen naar je toe te trekken — klik voor een schokgolf door de tekens',
  init() {
    matrixShockwaves = []
  },
  draw(time, dt) {
    ctx.fillStyle = 'rgba(10,10,10,0.12)'
    ctx.fillRect(0, 0, W, H)

    for (let i = matrixShockwaves.length - 1; i >= 0; i--) {
      matrixShockwaves[i].radius += dt * 400
      matrixShockwaves[i].t -= dt
      if (matrixShockwaves[i].t <= 0) matrixShockwaves.splice(i, 1)
    }

    if (mouse.down && Math.random() < dt * 8) {
      matrixShockwaves.push({ x: mouse.x, y: mouse.y, t: 0.8, radius: 0 })
    }

    const charSets = buildMatrixCharSet()
    const colW = 18
    const cols = Math.ceil(W / colW)

    ctx.font = '15px "Courier New",monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (let c = 0; c < cols; c++) {
      const seed = c * 7919
      const speed = 40 + (seed % 60)
      const offset = (time * speed + (seed % 500)) % (H + 300) - 100
      const len = 8 + (seed % 20)
      const colCx = c * colW + colW / 2

      const colDx = mouse.x - colCx
      const colDistX = Math.abs(colDx)
      const attract = colDistX < 200 ? (1 - colDistX / 200) * colDx * 0.3 : 0

      for (let i = 0; i < len; i++) {
        let y = offset - i * 18
        if (y < -20 || y > H + 20) continue

        let x = colCx + attract * (1 - i / len * 0.5)

        for (const sw of matrixShockwaves) {
          const sdx = x - sw.x
          const sdy = y - sw.y
          const sd = Math.sqrt(sdx * sdx + sdy * sdy)
          const ringDist = Math.abs(sd - sw.radius)
          if (ringDist < 40) {
            const push = (1 - ringDist / 40) * sw.t * 60
            if (sd > 0.1) {
              x += (sdx / sd) * push
              y += (sdy / sd) * push
            }
          }
        }

        const charIdx = (seed + i * 31 + (time * 2 | 0)) % charSets.length
        const brightness = i === 0 ? 1 : Math.max(0, 1 - i / len)

        ctx.globalAlpha = brightness * 0.82
        ctx.fillStyle = i === 0
          ? '#fff5ef'
          : `rgb(${brightness * 110 | 0},${brightness * 210 | 0},${brightness * 120 | 0})`
        ctx.fillText(charSets[charIdx], x, y)
      }
    }

    ctx.globalAlpha = 0.15 + Math.sin(time * 2) * 0.05
    ctx.font = '36px "Courier New",monospace'
    ctx.fillStyle = '#ffb783'
    ctx.fillText(sharedContent.matrixTitle, W / 2, H / 2)
    ctx.globalAlpha = 1
  },
})

// Scene 2: Tekstgolf
let waveGrabForceX = 0
let waveGrabForceY = 0

scenes.push({
  name: 'Tekstgolf',
  hint: 'Beweeg dicht bij de tekst om die te laten reageren — klik en sleep voor een windstoot door het veld',
  init() {
    waveGrabForceX = 0
    waveGrabForceY = 0
  },
  draw(time) {
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, W, H)

    if (mouse.down) {
      waveGrabForceX += mouse.dragX * 0.3
      waveGrabForceY += mouse.dragY * 0.3
    }
    waveGrabForceX *= 0.92
    waveGrabForceY *= 0.92
    mouse.dragX = 0
    mouse.dragY = 0

    const lines = sharedContent.waveLines.map((line, index) => ({
      text: line.text,
      font: `${24 - index}px "Courier New",monospace`,
      color: line.color,
      y: 0.2 + index * 0.15,
    }))

    for (const line of lines) {
      const baseY = H * line.y
      ctx.font = line.font

      const chars: { char: string; w: number }[] = []
      let totalW = 0
      for (const char of line.text) {
        const w = ctx.measureText(char).width
        chars.push({ char, w })
        totalW += w
      }

      let x = (W - totalW) / 2
      for (let i = 0; i < chars.length; i++) {
        const { char, w } = chars[i]
        const cx = x + w / 2
        const waveOffset = Math.sin(time * 3 + x * 0.015 + i * 0.1) * 25
        let cy = baseY + waveOffset

        const dx = cx - mouse.x
        const dy = cy - mouse.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        const proximity = Math.max(0, 1 - dist / 180)
        let pushX = 0
        let pushY = 0

        if (mouse.down && proximity > 0) {
          pushX = -dx * proximity * 0.15
          pushY = -dy * proximity * 0.15
        } else if (proximity > 0) {
          pushX = (dx / (dist || 1)) * proximity * 20
          pushY = (dy / (dist || 1)) * proximity * 20
        }

        if (proximity > 0.2) {
          pushX += waveGrabForceX * proximity
          pushY += waveGrabForceY * proximity
        }

        const scaleWave = 1 + Math.sin(time * 2 + i * 0.2) * 0.1 + proximity * 0.3

        ctx.save()
        ctx.translate(cx + pushX, cy + pushY)
        ctx.scale(scaleWave, scaleWave)
        ctx.rotate(Math.sin(time * 4 + i * 0.15) * 0.05 + pushX * 0.005)
        ctx.globalAlpha = 0.6 + proximity * 0.4
        ctx.font = line.font
        ctx.fillStyle = line.color
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(char, 0, 0)
        ctx.restore()

        x += w
      }
    }
  },
})

// Scene 3: Tekstmorph
let morphPausedTime = 0
let morphClickAdvance = 0

scenes.push({
  name: 'Tekstmorph',
  hint: 'Klik om door te schuiven — houd de muis ingedrukt om te bevriezen — muis Y stuurt de spreiding',
  init() {
    morphPausedTime = 0
    morphClickAdvance = 0
  },
  draw(time, dt) {
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, W, H)

    const phrases = sharedContent.morphPhrases
    const duration = 2.5
    if (mouse.justPressed) morphClickAdvance += duration
    if (mouse.down) morphPausedTime += dt
    const effectiveTime = time + morphClickAdvance - morphPausedTime

    const t = ((effectiveTime % (phrases.length * duration)) + phrases.length * duration) % (phrases.length * duration)
    const fromIdx = (t / duration) | 0
    const toIdx = (fromIdx + 1) % phrases.length
    const lerp = (t % duration) / duration
    const ease = lerp < 0.5 ? 2 * lerp * lerp : 1 - (-2 * lerp + 2) ** 2 / 2

    const fromText = phrases[fromIdx]
    const toText = phrases[toIdx]
    const maxLen = Math.max(fromText.length, toText.length)
    const font = `bold ${Math.min(74, W * 0.074)}px "Courier New",monospace`
    ctx.font = font

    const mouseScatter = (mouse.y / Math.max(1, H)) * 80

    function measurePhrase(text: string) {
      const result: { char: string; x: number; w: number }[] = []
      let totalW = 0
      for (const c of text) totalW += ctx.measureText(c).width
      let x = (W - totalW) / 2
      for (const c of text) {
        const w = ctx.measureText(c).width
        result.push({ char: c, x: x + w / 2, w })
        x += w
      }
      return result
    }

    const from = measurePhrase(fromText)
    const to = measurePhrase(toText)

    for (let i = 0; i < maxLen; i++) {
      const fc = from[Math.min(i, from.length - 1)]
      const tc = to[Math.min(i, to.length - 1)]
      const inFrom = i < from.length
      const inTo = i < to.length
      const x = fc.x + (tc.x - fc.x) * ease
      const charToShow = ease < 0.5 ? (inFrom ? fc.char : '') : (inTo ? tc.char : '')
      const charAlpha = ease < 0.5 ? (inFrom ? 1 - ease : 0) : (inTo ? ease : 0)
      if (!charToShow) continue

      const scatter = Math.sin(ease * Math.PI) * (40 + mouseScatter)
      const yOff = Math.sin(time * 5 + i * 0.8) * scatter
      const xOff = Math.cos(time * 3 + i * 1.2) * scatter * 0.5

      let pullX = 0
      let pullY = 0
      if (mouse.down) {
        const dx = mouse.x - (x + xOff)
        const dy = mouse.y - H / 2 - yOff
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 300) {
          const pull = (1 - dist / 300) * 0.4
          pullX = dx * pull
          pullY = dy * pull
        }
      }

      const hue = (i / Math.max(1, maxLen)) * 40 + 15
      ctx.save()
      ctx.translate(x + xOff + pullX, H / 2 + yOff + pullY)
      ctx.rotate(Math.sin(ease * Math.PI) * Math.sin(i * 2.5) * 0.5)
      ctx.globalAlpha = charAlpha
      ctx.font = font
      ctx.fillStyle = `hsl(${hue}, 80%, 65%)`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(charToShow, 0, 0)
      ctx.restore()
    }

    ctx.globalAlpha = 0.3
    ctx.font = '13px "Courier New",monospace'
    ctx.fillStyle = '#888'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${phrases[fromIdx]}  →  ${phrases[toIdx]}`, W / 2, H / 2 + 80)
    ctx.globalAlpha = 1
  },
})

// Scene 4: Deeltjestekst
type TextParticle = {
  homeX: number
  homeY: number
  x: number
  y: number
  vx: number
  vy: number
  char: string
  color: string
  font: string
}

let textParticles: TextParticle[] = []
let particleMode: 'repel' | 'attract' = 'repel'

scenes.push({
  name: 'Deeltjestekst',
  hint: 'Beweeg erover om tekens weg te duwen — klik en houd vast om ze aan te trekken — laat los voor een uitbarsting',
  init() {
    textParticles = []
    particleMode = 'repel'
    const phrases = sharedContent.particlePhrases.map((phrase: ParticlePhrase, index) => ({
      text: phrase.text,
      font: `${28 - index * 2}px "Courier New",monospace`,
      color: phrase.color,
      y: H * (0.22 + index * 0.16),
    }))

    for (const phrase of phrases) {
      try {
        const prepared = prepareWithSegments(phrase.text, phrase.font)
        const result = layoutWithLines(prepared, W - 100, 30)
        const startY = phrase.y - result.height / 2 + 15
        for (let li = 0; li < result.lines.length; li++) {
          const line = result.lines[li]
          ctx.font = phrase.font
          let totalW = 0
          for (const c of line.text) totalW += ctx.measureText(c).width
          let x = (W - totalW) / 2
          const lineY = startY + li * 30
          for (const c of line.text) {
            const cw = ctx.measureText(c).width
            if (c === ' ') { x += cw; continue }
            textParticles.push({
              homeX: x + cw / 2,
              homeY: lineY,
              x: Math.random() * W,
              y: Math.random() * H,
              vx: 0,
              vy: 0,
              char: c,
              color: phrase.color,
              font: phrase.font,
            })
            x += cw
          }
        }
      } catch {}
    }
  },
  draw(time, dt) {
    ctx.fillStyle = 'rgba(10,10,10,0.18)'
    ctx.fillRect(0, 0, W, H)

    const wasDown = particleMode === 'attract'
    particleMode = mouse.down ? 'attract' : 'repel'
    const justReleased = wasDown && !mouse.down

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (const p of textParticles) {
      const dx = p.x - mouse.x
      const dy = p.y - mouse.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (justReleased && dist < 200) {
        const force = (1 - dist / 200) * 30
        if (dist > 1) {
          p.vx += (dx / dist) * force
          p.vy += (dy / dist) * force
        }
      } else if (mouse.down && dist < 250 && dist > 1) {
        const f = (1 - dist / 250) * 600 * dt
        p.vx -= (dx / dist) * f
        p.vy -= (dy / dist) * f
      } else if (!mouse.down && dist < 150 && dist > 1) {
        const f = (1 - dist / 150) * 800 * dt
        p.vx += (dx / dist) * f
        p.vy += (dy / dist) * f
      }

      p.vx += (p.homeX - p.x) * 1.8 * dt
      p.vy += (p.homeY - p.y) * 1.8 * dt
      p.vx *= 0.91
      p.vy *= 0.91
      p.x += p.vx
      p.y += p.vy

      const homeDist = Math.sqrt((p.x - p.homeX) ** 2 + (p.y - p.homeY) ** 2)
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)

      ctx.globalAlpha = Math.min(0.95, 0.4 + homeDist * 0.004 + speed * 0.02)
      ctx.font = p.font
      ctx.fillStyle = speed > 5 ? '#ff6644' : homeDist > 20 ? '#ff9966' : p.color
      ctx.fillText(p.char, p.x, p.y)
    }

    ctx.globalAlpha = 0.25
    ctx.font = '11px "Courier New",monospace'
    ctx.fillStyle = '#888'
    ctx.textAlign = 'center'
    ctx.fillText(mouse.down ? 'AANTREKKEN — laat los voor een explosie' : 'AFSTOTEN', W / 2, H - 30)
    ctx.globalAlpha = 1
  },
})

// Scene 5: Typemachine
let typeSpeed = 30
let typeMaxWidth = 600
let typeDragging = false
let typeSpeedButtons: { x: number; y: number; w: number; h: number; val: number }[] = []

scenes.push({
  name: 'Typemachine',
  hint: 'Klik om de typesnelheid te wisselen — sleep links of rechts om de tekstbreedte aan te passen',
  init() {
    typeSpeed = 30
    typeMaxWidth = Math.min(600, W - 100)
    typeDragging = false
    typeSpeedButtons = []
  },
  draw(time) {
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, W, H)

    if (mouse.down) {
      if (!typeDragging) typeDragging = true
      typeMaxWidth = Math.max(150, Math.min(W - 60, typeMaxWidth + mouse.dragX * 1.5))
      mouse.dragX = 0
      mouse.dragY = 0
    } else if (typeDragging) {
      typeDragging = false
    }

    const fullText = sharedContent.typewriterText
    const visibleChars = ((time * typeSpeed) % (fullText.length + 60)) | 0
    const text = fullText.slice(0, Math.min(visibleChars, fullText.length))
    const font = '16px "Courier New",monospace'
    const maxWidth = typeMaxWidth
    const lineHeight = 24
    const startX = (W - maxWidth) / 2
    const startY = H * 0.12

    try {
      const prepared = prepareWithSegments(text, font)
      const result = layoutWithLines(prepared, maxWidth, lineHeight)

      ctx.font = font
      ctx.textBaseline = 'top'

      ctx.globalAlpha = 0.08
      ctx.strokeStyle = '#ff8844'
      ctx.lineWidth = 1
      ctx.strokeRect(startX, startY, maxWidth, Math.max(lineHeight, result.height))
      ctx.globalAlpha = 1

      ctx.globalAlpha = typeDragging ? 0.5 : 0.2
      ctx.fillStyle = '#ff8844'
      ctx.fillRect(startX - 3, startY, 3, result.height || lineHeight)
      ctx.fillRect(startX + maxWidth, startY, 3, result.height || lineHeight)
      ctx.globalAlpha = 1

      for (let li = 0; li < result.lines.length; li++) {
        const line = result.lines[li]
        const y = startY + li * lineHeight

        let x = startX
        let prevCharCount = 0
        for (let pli = 0; pli < li; pli++) prevCharCount += result.lines[pli].text.length

        for (let ci = 0; ci < line.text.length; ci++) {
          const char = line.text[ci]
          const cw = ctx.measureText(char).width
          const charAge = visibleChars - prevCharCount - ci
          const isNew = charAge >= 0 && charAge < 3
          const bounce = isNew ? Math.sin(time * 20) * 2 : 0

          const dx = (x + cw / 2) - mouse.x
          const dy = (y + lineHeight / 2) - mouse.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const near = dist < 80 ? (1 - dist / 80) : 0

          ctx.globalAlpha = 0.75 + near * 0.25
          ctx.fillStyle = isNew ? '#ffffff' : near > 0.3 ? '#ff8844' : '#cccccc'
          ctx.fillText(char, x, y + bounce)
          x += cw
        }

        ctx.globalAlpha = 0.04
        ctx.fillStyle = '#ff8844'
        ctx.fillRect(startX, y, line.width, lineHeight)
      }

      if (text.length < fullText.length) {
        const lastLine = result.lines[result.lines.length - 1]
        const cursorX = startX + (lastLine?.width ?? 0)
        const cursorY = startY + (result.lines.length - 1) * lineHeight
        if (Math.sin(time * 6) > 0) {
          ctx.globalAlpha = 1
          ctx.fillStyle = '#ff8844'
          ctx.fillRect(cursorX + 2, cursorY, 2, lineHeight - 4)
        }
      }

      ctx.globalAlpha = 0.4
      ctx.font = '11px "Courier New",monospace'
      ctx.fillStyle = '#888'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(
        `${text.length} tekens | ${result.lineCount} regels | hoogte: ${result.height}px | breedte: ${Math.round(maxWidth)}px | snelheid: ${typeSpeed} t/s`,
        startX,
        startY + result.height + 16,
      )

      let widest = 0
      walkLineRanges(prepared, maxWidth, (line) => { if (line.width > widest) widest = line.width })
      ctx.globalAlpha = 0.12
      ctx.strokeStyle = '#ff8844'
      ctx.setLineDash([4, 4])
      ctx.strokeRect(startX - 1, startY - 1, widest + 2, result.height + 2)
      ctx.setLineDash([])

      ctx.globalAlpha = 0.2
      ctx.font = '10px "Courier New",monospace'
      ctx.fillStyle = '#ff8844'
      ctx.fillText(`strakke breedte: ${Math.round(widest)}px`, startX, startY + result.height + 36)

      const speeds = [
        { label: 'TRAAG', val: 10 },
        { label: 'MIDDEL', val: 30 },
        { label: 'SNEL', val: 80 },
        { label: 'TURBO', val: 200 },
      ]
      typeSpeedButtons = []
      ctx.globalAlpha = 1
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (let si = 0; si < speeds.length; si++) {
        const bx = startX + si * 90
        const by = startY + result.height + 60
        const active = typeSpeed === speeds[si].val
        typeSpeedButtons.push({ x: bx, y: by - 12, w: 70, h: 24, val: speeds[si].val })
        ctx.globalAlpha = active ? 0.15 : 0.06
        ctx.fillStyle = '#ff8844'
        ctx.fillRect(bx, by - 12, 70, 24)
        ctx.globalAlpha = active ? 0.7 : 0.25
        ctx.font = '11px "Courier New",monospace'
        ctx.fillStyle = active ? '#ff8844' : '#666'
        ctx.fillText(speeds[si].label, bx + 35, by)
      }
    } catch {}

    ctx.globalAlpha = 1
  },
})

addEventListener('keydown', (e) => {
  if (activeScene === 4 && (e.key === ' ' || e.key.toLowerCase() === 's')) {
    const speeds = [10, 30, 80, 200]
    const idx = speeds.indexOf(typeSpeed)
    typeSpeed = speeds[(idx + 1) % speeds.length]
  }
})

addEventListener('click', (e) => {
  if (activeScene !== 4) return
  const point = clientToScenePoint(e.clientX, e.clientY)
  for (const button of typeSpeedButtons) {
    if (
      point.x >= button.x
      && point.x <= button.x + button.w
      && point.y >= button.y
      && point.y <= button.y + button.h
    ) {
      typeSpeed = button.val
      return
    }
  }
})

const sceneTabsEl = document.getElementById('scene-tabs')!
const sceneHintEl = document.getElementById('scene-hint')!

function activateScene(idx: number) {
  activeScene = idx
  scenes[idx].init()
  sceneTabsEl.querySelectorAll('.scene-btn').forEach((button, i) => button.classList.toggle('active', i === idx))
  sceneHintEl.textContent = scenes[idx].hint
}

for (let i = 0; i < scenes.length; i++) {
  const btn = document.createElement('button')
  btn.className = 'scene-btn'
  btn.textContent = scenes[i].name
  btn.addEventListener('click', () => activateScene(i))
  sceneTabsEl.appendChild(btn)
}
activateScene(0)

function refreshSharedContent(rawText?: string | null) {
  sharedContent = getResolvedContentPack(rawText)
  scenes[activeScene].init()
}

window.addEventListener(CUSTOM_CONTENT_EVENT, (event) => {
  const detail = (event as CustomEvent<{ rawText?: string }>).detail
  refreshSharedContent(detail?.rawText)
})

window.addEventListener('storage', (event) => {
  if (event.key !== CUSTOM_CONTENT_STORAGE_KEY) return
  refreshSharedContent(event.newValue)
})

let lastTime = performance.now()
let time = 0
let frameCount = 0
let fpsTime = 0
let fps = 0
const statsEl = document.getElementById('stats')!

function frame(now: number) {
  const dt = Math.min((now - lastTime) / 1000, 0.05)
  lastTime = now
  time += dt
  frameCount++
  fpsTime += dt
  if (fpsTime >= 0.5) {
    fps = Math.round(frameCount / fpsTime)
    frameCount = 0
    fpsTime = 0
  }
  statsEl.textContent = `${fps} fps`
  scenes[activeScene].draw(time, dt)
  mouse.justPressed = false
  requestAnimationFrame(frame)
}

document.fonts.ready.then(() => {
  scenes[activeScene].init()
  requestAnimationFrame(frame)
})
