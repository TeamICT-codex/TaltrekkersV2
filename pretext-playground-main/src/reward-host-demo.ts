import {
  REWARD_PRESET_CARDS,
  showCourseCompleteReward,
  showSupportMilestoneReward,
  showTeamStreakReward,
  type RewardPresetKind,
  type RewardOverlayController,
} from './reward-sdk'

const app = document.getElementById('app')!
app.classList.add('reward-host-page')

const page = document.createElement('div')
page.className = 'reward-demo-page'

const hero = document.createElement('section')
hero.className = 'reward-demo-hero'

const eyebrow = document.createElement('div')
eyebrow.className = 'reward-demo-eyebrow'
eyebrow.textContent = 'Reward layer demo'

const title = document.createElement('h1')
title.className = 'reward-demo-title'
title.textContent = 'Drie concrete beloningen voor een school- en ICT-platform'

const intro = document.createElement('p')
intro.className = 'reward-demo-copy'
intro.textContent = 'Deze hostpagina toont hoe je dezelfde rewardengine als overlay boven een bestaande applicatie kunt openen. Je laadt dus niet een aparte microsite, maar een beloningslaag die reageert op echte productmomenten.'

hero.append(eyebrow, title, intro)

const layout = document.createElement('section')
layout.className = 'reward-demo-layout'

const grid = document.createElement('div')
grid.className = 'reward-demo-grid'

const side = document.createElement('aside')
side.className = 'reward-demo-side'

const statusCard = document.createElement('div')
statusCard.className = 'reward-status-card'

const statusTitle = document.createElement('div')
statusTitle.className = 'reward-status-title'
statusTitle.textContent = 'Host status'

const statusText = document.createElement('div')
statusText.className = 'reward-status-text'
statusText.textContent = 'Klaar om een rewardpreset te openen.'

const codeTitle = document.createElement('div')
codeTitle.className = 'reward-status-title'
codeTitle.textContent = 'Laatste preset'

const codeBlock = document.createElement('pre')
codeBlock.className = 'reward-code'
codeBlock.textContent = '// Kies een reward om de overlayconfig te zien.'

statusCard.append(statusTitle, statusText, codeTitle, codeBlock)
side.appendChild(statusCard)

let activeOverlay: RewardOverlayController | null = null

function setStatus(message: string) {
  statusText.textContent = message
}

function setCode(titleText: string, payload: object) {
  codeBlock.textContent = `${titleText}\n${JSON.stringify(payload, null, 2)}`
}

function closeActiveOverlay() {
  if (!activeOverlay) return
  const current = activeOverlay
  activeOverlay = null
  current.close()
}

function launchPreset(kind: RewardPresetKind) {
  closeActiveOverlay()

  const preset = kind === 'support-milestone'
    ? {
      teamName: 'Team iCT',
      solvedTickets: 48,
      scopeLabel: 'in het voorbije kwartaal',
      nextGoal: 'Volgende mijlpaal: 75 opgeloste cases',
    }
    : kind === 'team-streak'
    ? {
      teamName: 'Scholencluster Noord',
      streakDays: 12,
      schoolsReached: 7,
      focusLabel: 'veilig devicebeheer',
    }
    : {
      courseName: 'Onboarding Microsoft 365',
      learnerName: 'Nieuwe directies en ICT-ankers',
      schoolName: 'Het leercollectief',
      nextUnlock: 'Volgende module: veilige sharing en accounts',
    }

  setStatus(`Preset gestart: ${kind}`)
  setCode(`createRewardOverlay(${kind})`, preset)

  const sharedHandlers = {
    onReady: () => {
      setStatus(`Reward klaar in overlay: ${kind}`)
    },
    onComplete: ({ mode, score }: { mode: 'dragon' | 'snake'; score?: number }) => {
      setStatus(`Reward voltooid via ${mode}${typeof score === 'number' ? ` met score ${score}` : ''}.`)
    },
    onClose: () => {
      if (activeOverlay) activeOverlay = null
      setStatus(`Overlay gesloten: ${kind}`)
    },
  }

  activeOverlay = kind === 'support-milestone'
    ? showSupportMilestoneReward(preset, sharedHandlers)
    : kind === 'team-streak'
    ? showTeamStreakReward(preset, sharedHandlers)
    : showCourseCompleteReward(preset, sharedHandlers)
}

for (const preset of REWARD_PRESET_CARDS) {
  const card = document.createElement('article')
  card.className = 'reward-demo-card'

  const kicker = document.createElement('div')
  kicker.className = 'reward-demo-kicker'
  kicker.textContent = preset.kicker

  const label = document.createElement('h2')
  label.className = 'reward-demo-card-title'
  label.textContent = preset.label

  const summary = document.createElement('p')
  summary.className = 'reward-demo-card-copy'
  summary.textContent = preset.summary

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'reward-demo-button'
  button.textContent = 'Open reward'
  button.addEventListener('click', () => launchPreset(preset.kind))

  card.append(kicker, label, summary, button)
  grid.appendChild(card)
}

layout.append(grid, side)
page.append(hero, layout)
app.appendChild(page)
