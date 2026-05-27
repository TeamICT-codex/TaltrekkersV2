export const CUSTOM_CONTENT_STORAGE_KEY = 'hlc-custom-content-v1'
export const CUSTOM_CONTENT_EVENT = 'hlc-custom-content-change'

const MAX_CONTENT_CHARS = 12000
const WAVE_COLORS = ['#ff8844', '#44aaff', '#66dd66', '#ddaa44', '#ff66aa']

const DEFAULT_CONTENT_TEXT = [
  'Het leercollectief.',
  '',
  'Een sterke digitale basis voor alle scholen, met ruimte voor pedagogische eigenheid en gedragen groei.',
  '',
  'Het Leercollectief wil voor alle scholen een betrouwbare, eerlijke en toekomstgerichte digitale leer- en werkomgeving uitbouwen. We bouwen aan een sterk digitaal fundament voor de scholengroep, met duidelijke afspraken, professionele ondersteuning en een gedeelde infrastructuur. Tegelijk respecteren we de eigenheid van scholen door ruimte te laten voor lokale pedagogische keuzes binnen een gemeenschappelijk kader.',
  '',
  '- ICT mag niet afhangen van toeval, uitval of de school waar je toevallig zit; elke leerling en medewerker verdient dezelfde betrouwbare digitale basis.',
  '- De scholengroep kiest voor een gedeelde koers: centraliseren wat beter samen werkt, en autonomie laten waar de lokale onderwijscontext dat vraagt.',
  '- De prioriteit ligt bij uniforme infrastructuur, helder account- en devicebeheer, een professionele helpdesk en veilige, stabiele systemen.',
  '- Pedagogische ICT is geen extraatje, maar een kerntaak: leerkrachten moeten kunnen rekenen op sterke tools, nascholing en ondersteuning.',
  '- Het einddoel is dat elke school tegen september 2026 een gedragen en goedgekeurd ICT-beleidsplan heeft.',
].join('\n')

export type WaveLine = {
  text: string
  color: string
}

export type ParticlePhrase = {
  text: string
  color: string
}

export type ResolvedContentPack = {
  rawText: string
  title: string
  heading: string
  subheading: string
  vision: string
  spotlight: string
  quote: string
  rightBody: string
  checklist: string[]
  tunnelTexts: string[]
  waveLines: WaveLine[]
  morphPhrases: string[]
  particlePhrases: ParticlePhrase[]
  typewriterText: string
  matrixTitle: string
}

const DEFAULT_RESOLVED_CONTENT: ResolvedContentPack = {
  rawText: '',
  title: 'Het leercollectief.',
  heading: 'Eén sterke digitale basis',
  subheading: 'voor alle scholen, met ruimte voor pedagogische eigenheid en gedragen groei.',
  vision: 'Het Leercollectief wil voor alle scholen een betrouwbare, eerlijke en toekomstgerichte digitale leer- en werkomgeving uitbouwen. We bouwen aan één sterk digitaal fundament voor de scholengroep, met duidelijke afspraken, professionele ondersteuning en een gedeelde infrastructuur. Tegelijk respecteren we de eigenheid van scholen door ruimte te laten voor lokale pedagogische keuzes binnen een gemeenschappelijk kader. Zo wordt ICT geen losse technische dienst, maar een hefboom voor kwaliteitsvol onderwijs, digitale geletterdheid en duurzame schoolontwikkeling.',
  spotlight: 'ICT mag niet afhangen van toeval, uitval of de school waar je toevallig zit; elke leerling en medewerker verdient dezelfde betrouwbare digitale basis.',
  quote: '"Eén sterke digitale basis voor alle scholen, met ruimte voor pedagogische eigenheid en gedragen groei."',
  rightBody: 'De scholengroep kiest voor een gedeelde koers: centraliseren wat beter samen werkt, en autonomie laten waar de lokale onderwijscontext dat vraagt. Basisonderwijs wordt sterker centraal ondersteund; secundair onderwijs werkt binnen een gemeenschappelijk kader met ruimte voor eigenheid.',
  checklist: [
    'Uniforme infrastructuur',
    'Helder account- en devicebeheer',
    'Professionele helpdesk',
    'Veilige, stabiele systemen',
    'Sterke tools, nascholing en ondersteuning',
  ],
  tunnelTexts: [
    'Het leercollectief.',
    'Eén sterke digitale basis',
    'Ruimte voor pedagogische eigenheid',
    'Uniforme infrastructuur · helder beheer',
    'Betrouwbare digitale ondersteuning',
    'Duidelijke afspraken · gedeelde infrastructuur',
  ],
  waveLines: [
    { text: 'Het Leercollectief bouwt aan een eerlijke digitale basis', color: '#ff8844' },
    { text: 'Team iCT verbindt infrastructuur, ondersteuning en vertrouwen', color: '#44aaff' },
    { text: 'Eén scholengroep, één kader, ruimte voor lokale pedagogische keuzes', color: '#66dd66' },
    { text: 'Sterke tools en nascholing maken digitale groei voelbaar', color: '#ddaa44' },
    { text: 'Samen richting september 2026 met een gedragen ICT-beleidsplan', color: '#ff66aa' },
  ],
  morphPhrases: [
    'HET LEERCOLLECTIEF',
    'TEAM ICT',
    'GEDEELDE BASIS',
    'STERKE ONDERSTEUNING',
    'VEILIGE SYSTEMEN',
    'PEDAGOGISCHE RUIMTE',
    'SCHOLENGROEP',
    'SEPTEMBER 2026',
  ],
  particlePhrases: [
    { text: 'Het leercollectief', color: '#ff8844' },
    { text: 'Team iCT', color: '#66dd66' },
    { text: 'Scholengroep met gedeeld kader', color: '#44aaff' },
    { text: 'Betrouwbare ondersteuning voor elke school', color: '#ddaa44' },
    { text: 'Digitale basis met ruimte voor eigenheid', color: '#ff66aa' },
  ],
  typewriterText: 'Team iCT van Het Leercollectief bouwt aan een gedeelde digitale basis voor de hele scholengroep. In deze experimentele typemachine tonen we hoe tekst kan schalen, herschikken en reageren zonder de rust van het scherm te verliezen. Een sterke digitale leer- en werkomgeving vraagt betrouwbare infrastructuur, professioneel beheer, goede ondersteuning en ruimte voor pedagogische eigenheid. Zo groeit ICT van losse techniek naar een hefboom voor kwaliteitsvol onderwijs.',
  matrixTitle: 'TEAM ICT IN BEWEGING',
}

function normalizeInlineSpacing(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function stripListMarker(text: string) {
  return text.replace(/^[-*+•]\s+/, '').replace(/^\d+[\.\)]\s+/, '').trim()
}

function isListLine(text: string) {
  return /^[-*+•]\s+/.test(text) || /^\d+[\.\)]\s+/.test(text)
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []
  for (const value of values) {
    const clean = normalizeInlineSpacing(value)
    if (!clean) continue
    const key = clean.toLocaleLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(clean)
  }
  return result
}

function clipText(text: string, maxChars: number) {
  const clean = normalizeInlineSpacing(text)
  if (clean.length <= maxChars) return clean
  const slice = clean.slice(0, maxChars + 1)
  const lastSpace = slice.lastIndexOf(' ')
  const clipped = lastSpace > maxChars * 0.6 ? slice.slice(0, lastSpace) : slice.slice(0, maxChars)
  return `${clipped.trim()}...`
}

function shortenUpper(text: string, maxChars: number) {
  const clean = normalizeInlineSpacing(stripListMarker(text).replace(/^["']+|["']+$/g, ''))
  if (!clean) return ''
  if (clean.length <= maxChars) return clean.toUpperCase()
  const words = clean.split(' ')
  let result = ''
  for (const word of words) {
    const next = result ? `${result} ${word}` : word
    if (next.length > maxChars) break
    result = next
  }
  return (result || clean.slice(0, maxChars)).trim().toUpperCase()
}

function splitSentences(text: string) {
  const normalized = normalizeInlineSpacing(text)
    .replace(/[!?]+/g, '.')
    .replace(/\s*;\s*/g, '. ')
  return normalized
    .split('.')
    .map(part => normalizeInlineSpacing(part))
    .filter(Boolean)
}

function sanitizeRawText(rawText: string | null | undefined) {
  const base = (rawText || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, ' ')
    .slice(0, MAX_CONTENT_CHARS)
  const lines = base
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trimEnd())
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function getFallbackText() {
  return sanitizeRawText(DEFAULT_CONTENT_TEXT)
}

function cloneResolvedContent(pack: ResolvedContentPack, rawText: string): ResolvedContentPack {
  return {
    ...pack,
    rawText,
    checklist: [...pack.checklist],
    tunnelTexts: [...pack.tunnelTexts],
    waveLines: pack.waveLines.map(line => ({ ...line })),
    morphPhrases: [...pack.morphPhrases],
    particlePhrases: pack.particlePhrases.map(phrase => ({ ...phrase })),
  }
}

function getStoredRawText() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(CUSTOM_CONTENT_STORAGE_KEY)
  } catch {
    return null
  }
}

function dispatchContentChange(rawText: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CUSTOM_CONTENT_EVENT, {
    detail: { rawText },
  }))
}

function buildChecklist(listLines: string[], sentencePool: string[]) {
  const candidates = uniqueStrings([
    ...listLines.map(stripListMarker),
    ...sentencePool.filter(sentence => sentence.length >= 28 && sentence.length <= 120),
  ])
  return candidates.slice(0, 5).map(item => clipText(item, 92))
}

function buildRightBody(candidates: string[]) {
  const picked = uniqueStrings(candidates).slice(0, 2)
  if (picked.length === 0) return 'Team iCT verbindt infrastructuur, ondersteuning en vertrouwen in een gedeeld kader.'
  return clipText(picked.join(' '), 280)
}

export function getDefaultContentText() {
  return getFallbackText()
}

export function isDefaultContentText(rawText?: string | null) {
  return getActiveContentText(rawText) === getFallbackText()
}

export function getActiveContentText(rawText?: string | null) {
  if (typeof rawText === 'string') {
    const clean = sanitizeRawText(rawText)
    return clean || getFallbackText()
  }
  const stored = sanitizeRawText(getStoredRawText())
  return stored || getFallbackText()
}

export function saveCustomContentText(rawText: string) {
  const clean = sanitizeRawText(rawText)
  const nextText = clean || getFallbackText()
  if (typeof window !== 'undefined') {
    try {
      if (!clean || nextText === getFallbackText()) window.localStorage.removeItem(CUSTOM_CONTENT_STORAGE_KEY)
      else window.localStorage.setItem(CUSTOM_CONTENT_STORAGE_KEY, nextText)
    } catch {}
  }
  dispatchContentChange(nextText)
  return nextText
}

export function resetCustomContentText() {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(CUSTOM_CONTENT_STORAGE_KEY)
    } catch {}
  }
  const nextText = getFallbackText()
  dispatchContentChange(nextText)
  return nextText
}

export function getResolvedContentPack(rawText?: string | null): ResolvedContentPack {
  const source = getActiveContentText(rawText)
  if (source === getFallbackText()) return cloneResolvedContent(DEFAULT_RESOLVED_CONTENT, source)
  const rawLines = source.split('\n').map(line => line.trim()).filter(Boolean)
  const cleanLines = uniqueStrings(rawLines.map(stripListMarker))
  const listLines = uniqueStrings(rawLines.filter(isListLine).map(stripListMarker))
  const blocks = source
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)
  const proseBlocks = uniqueStrings(
    blocks
      .filter(block => !block.split('\n').every(line => isListLine(line.trim())))
      .map(block => normalizeInlineSpacing(block)),
  )
  const sentencePool = uniqueStrings([
    ...proseBlocks.flatMap(splitSentences),
    ...listLines.flatMap(splitSentences),
  ])

  const title = cleanLines.find(line => line.length <= 52 && line.split(/\s+/).length <= 6)
    || 'Het leercollectief.'

  const shortCandidates = uniqueStrings([
    ...listLines,
    ...sentencePool,
    ...cleanLines,
  ])

  const heading = shortCandidates.find(line =>
    line !== title && line.length >= 24 && line.length <= 90,
  ) || 'Een sterke digitale basis voor alle scholen'

  const subheading = shortCandidates.find(line =>
    line !== title
    && line !== heading
    && line.length >= 32
    && line.length <= 120,
  ) || 'Met ruimte voor pedagogische eigenheid en gedragen digitale groei.'

  const vision = clipText(
    proseBlocks.find(block => block.length > 140)
      || uniqueStrings([heading, subheading, ...sentencePool]).slice(0, 3).join(' '),
    520,
  )

  const spotlight = clipText(
    listLines[0]
      || sentencePool.find(sentence => sentence !== heading && sentence !== subheading)
      || heading,
    150,
  )

  const quote = `"${clipText(subheading || heading, 92)}"`
  const checklist = buildChecklist(listLines, sentencePool)
  const rightBody = buildRightBody([
    ...listLines.slice(1),
    ...sentencePool.filter(sentence => sentence !== heading && sentence !== subheading),
    ...proseBlocks.slice(1),
  ])

  const tunnelTexts = uniqueStrings([
    title,
    heading,
    clipText(subheading, 48),
    ...checklist.map(item => clipText(item, 46)),
  ]).slice(0, 6)

  const waveLines = uniqueStrings([
    heading,
    subheading,
    ...checklist,
    ...sentencePool,
  ]).slice(0, 5).map((text, index) => ({
    text: clipText(text, 82),
    color: WAVE_COLORS[index % WAVE_COLORS.length],
  }))

  const morphPhrases = uniqueStrings([
    shortenUpper(title, 24),
    shortenUpper(heading, 24),
    shortenUpper(subheading, 24),
    ...checklist.map(item => shortenUpper(item, 24)),
    'TEAM ICT',
    'SCHOLENGROEP',
  ]).slice(0, 8)

  const particlePhrases = uniqueStrings([
    title,
    'Team iCT',
    heading,
    subheading,
    ...checklist,
  ]).slice(0, 5).map((text, index) => ({
    text: clipText(text, 58),
    color: WAVE_COLORS[index % WAVE_COLORS.length],
  }))

  const typewriterText = clipText(
    uniqueStrings([
      ...proseBlocks,
      ...listLines,
      ...sentencePool,
    ]).join(' '),
    1100,
  )

  return {
    rawText: source,
    title,
    heading: clipText(heading, 88),
    subheading: clipText(subheading, 118),
    vision,
    spotlight,
    quote,
    rightBody,
    checklist,
    tunnelTexts: tunnelTexts.length > 0 ? tunnelTexts : ['Het leercollectief.'],
    waveLines,
    morphPhrases: morphPhrases.length > 1 ? morphPhrases : ['TEAM ICT', 'HET LEERCOLLECTIEF'],
    particlePhrases,
    typewriterText,
    matrixTitle: shortenUpper(title, 26) || 'TEAM ICT',
  }
}
