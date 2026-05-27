// Dragon page shell injects the canvas + panel HTML, then loads the dragon engine.

const app = document.getElementById('app')!
app.style.cursor = 'crosshair'

// Canvas
const canvas = document.createElement('canvas')
canvas.id = 'c'
app.appendChild(canvas)

// Hint
const hint = document.createElement('div')
hint.id = 'hint'
hint.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.2);font-size:12px;pointer-events:none;transition:opacity 0.8s;letter-spacing:0.04em'
hint.textContent = 'droak: muis + vuur - sneek: toetsenbord - druk op P voor het paneel'
app.appendChild(hint)

// Panel toggle
const toggle = document.createElement('button')
toggle.id = 'panel-toggle'
toggle.title = 'Instellingen (P)'
toggle.textContent = 'P'
document.body.appendChild(toggle)

// Stats
const stats = document.createElement('div')
stats.id = 'stats'
document.body.appendChild(stats)

function makeSection(title: string, children: HTMLElement[]) {
  const sec = document.createElement('div')
  sec.className = 'section'
  const label = document.createElement('div')
  label.className = 'section-title'
  label.textContent = title
  sec.appendChild(label)
  for (const child of children) sec.appendChild(child)
  return sec
}

function makeSlider(label: string, key: string, min: string, max: string, step: string) {
  const row = document.createElement('div')
  row.className = 'control-row'
  const text = document.createElement('span')
  text.className = 'control-label'
  text.textContent = label
  const input = document.createElement('input')
  input.type = 'range'
  input.dataset.key = key
  input.min = min
  input.max = max
  input.step = step
  const value = document.createElement('span')
  value.className = 'control-value'
  value.dataset.val = key
  row.append(text, input, value)
  return row
}

function makeToggle(label: string, key: string) {
  const row = document.createElement('div')
  row.className = 'toggle-row'
  const text = document.createElement('span')
  text.className = 'control-label'
  text.textContent = label
  const toggleWrap = document.createElement('label')
  toggleWrap.className = 'toggle'
  const checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.dataset.key = key
  const track = document.createElement('span')
  track.className = 'toggle-track'
  const thumb = document.createElement('span')
  thumb.className = 'toggle-thumb'
  toggleWrap.append(checkbox, track, thumb)
  row.append(text, toggleWrap)
  return row
}

function makeButton(label: string, id: string, modifier?: string) {
  const button = document.createElement('button')
  button.type = 'button'
  button.id = id
  button.className = modifier ? `action-btn ${modifier}` : 'action-btn'
  button.textContent = label
  return button
}

const panel = document.createElement('div')
panel.id = 'panel'

const header = document.createElement('div')
header.className = 'panel-header'
const title = document.createElement('h2')
title.textContent = 'Beeldregeling'
const closeBtn = document.createElement('button')
closeBtn.id = 'panel-close'
closeBtn.title = 'Sluiten'
closeBtn.textContent = 'x'
header.append(title, closeBtn)
panel.appendChild(header)

const modesDiv = document.createElement('div')
modesDiv.className = 'theme-grid'
modesDiv.id = 'modes'
panel.appendChild(makeSection('Modi', [modesDiv]))

const difficultiesDiv = document.createElement('div')
difficultiesDiv.className = 'theme-grid'
difficultiesDiv.id = 'difficulties'
panel.appendChild(makeSection('Moeilijkheid', [difficultiesDiv]))

const themesDiv = document.createElement('div')
themesDiv.className = 'theme-grid'
themesDiv.id = 'themes'
panel.appendChild(makeSection("Thema's", [themesDiv]))

const presetsDiv = document.createElement('div')
presetsDiv.className = 'presets'
presetsDiv.id = 'presets'
panel.appendChild(makeSection('Presetten', [presetsDiv]))

const contentHelp = document.createElement('div')
contentHelp.className = 'content-help'
contentHelp.textContent = 'Plak een visie, nota of bullets. We halen er automatisch een hero, kernzinnen, tunneltekst en experimentele varianten uit.'

const contentInput = document.createElement('textarea')
contentInput.id = 'content-input'
contentInput.className = 'content-input'
contentInput.rows = 10
contentInput.spellcheck = false
contentInput.placeholder = 'Plak hier je eigen tekst voor Het leercollectief, Team iCT of de scholengroep.'

const contentActions = document.createElement('div')
contentActions.className = 'content-actions'

const contentFileLabel = document.createElement('label')
contentFileLabel.className = 'action-btn action-btn-secondary'
contentFileLabel.textContent = 'Laad .txt'
contentFileLabel.htmlFor = 'content-file'

const contentFile = document.createElement('input')
contentFile.id = 'content-file'
contentFile.className = 'content-file'
contentFile.type = 'file'
contentFile.accept = '.txt,.md,.text'

const contentApply = makeButton('Toepassen', 'content-apply')
const contentReset = makeButton('Standaard', 'content-reset', 'action-btn-secondary')
contentActions.append(contentFileLabel, contentApply, contentReset)

const contentStatus = document.createElement('div')
contentStatus.id = 'content-status'
contentStatus.className = 'content-status'
contentStatus.textContent = 'Wordt gebruikt in Droak, Sneek en Experimenteel.'

panel.appendChild(makeSection('Eigen tekst', [
  contentHelp,
  contentInput,
  contentFile,
  contentActions,
  contentStatus,
]))

panel.appendChild(makeSection('Prestaties', [
  makeToggle('Automatisch', 'autoPerformance'),
  makeToggle('Lage belasting', 'lowPerformance'),
]))

panel.appendChild(makeSection('Droak', [
  makeSlider('Segmenten', 'dragonSegments', '10', '80', '1'),
  makeSlider('Snelheid', 'dragonSpeed', '0.02', '0.4', '0.01'),
  makeSlider('Grootte', 'dragonScale', '0.3', '3', '0.1'),
  makeToggle('Vleugels', 'showWings'),
  makeToggle('Stekels', 'showSpines'),
]))

panel.appendChild(makeSection('Fysica', [
  makeSlider('Duwkracht', 'pushForce', '1', '30', '0.5'),
  makeSlider('Veerkracht', 'springStrength', '0.002', '0.08', '0.001'),
  makeSlider('Demping', 'damping', '0.8', '0.99', '0.005'),
  makeSlider('Zwaartekracht', 'burnGravity', '0', '3', '0.1'),
]))

panel.appendChild(makeSection('Vuur', [
  makeSlider('Straal', 'fireRadius', '30', '250', '5'),
  makeSlider('Kracht', 'fireForce', '5', '50', '1'),
  makeToggle('Schermschok', 'screenShake'),
  makeToggle('Sintels', 'showEmbers'),
  makeToggle('Deeltjes', 'showParticles'),
]))

panel.appendChild(makeSection('Tegenstrevers', [
  makeToggle('Actief', 'showEnemies'),
  makeSlider('Aantal', 'enemyCount', '1', '20', '1'),
  makeSlider('Snelheid', 'enemySpeed', '0.1', '2', '0.1'),
]))

panel.appendChild(makeSection('Sfeer', [
  makeToggle('Runes', 'showRunes'),
  makeToggle('Eigen cursor', 'showCursor'),
  makeSlider('Tekstopaciteit', 'textOpacity', '0', '1.5', '0.05'),
]))

document.body.appendChild(panel)

import('./dragon.ts')
