import type { RewardOverlayOptions } from './reward-embed'

export type RewardPresetKind = 'course-complete' | 'support-milestone' | 'team-streak'

export type RewardPresetCard = {
  kind: RewardPresetKind
  label: string
  summary: string
  kicker: string
}

export type CourseCompletePresetInput = {
  courseName?: string
  learnerName?: string
  schoolName?: string
  nextUnlock?: string
}

export type SupportMilestonePresetInput = {
  teamName?: string
  solvedTickets?: number
  scopeLabel?: string
  nextGoal?: string
}

export type TeamStreakPresetInput = {
  teamName?: string
  streakDays?: number
  schoolsReached?: number
  focusLabel?: string
}

export const REWARD_PRESET_CARDS: RewardPresetCard[] = [
  {
    kind: 'course-complete',
    label: 'Course Complete',
    kicker: 'Leren',
    summary: 'Vier het afronden van een opleiding, module of onboardingpad met een lichtere, uitnodigende rewardflow.',
  },
  {
    kind: 'support-milestone',
    label: 'Support Milestone',
    kicker: 'Impact',
    summary: 'Zet een supportmijlpaal om in een grotere, dramatischere rewardlaag die stabiliteit en voortgang uitstraalt.',
  },
  {
    kind: 'team-streak',
    label: 'Team Streak',
    kicker: 'Samen',
    summary: 'Maak gezamenlijke consistentie zichtbaar met een energieke streak-reward voor teams, scholen of clusters.',
  },
]

function trimSentence(text: string) {
  return text.trim().replace(/\s+/g, ' ')
}

function joinRewardText(lines: string[]) {
  return lines.map(trimSentence).filter(Boolean).join('\n\n')
}

export function buildCourseCompleteReward(input: CourseCompletePresetInput = {}): RewardOverlayOptions {
  const courseName = input.courseName || 'Digitale basis'
  const learnerName = input.learnerName || 'Je team'
  const schoolName = input.schoolName || 'Het leercollectief'
  const nextUnlock = input.nextUnlock || 'Volgende module: slimmer accountbeheer'

  return {
    mode: 'snake',
    difficulty: 'easy',
    theme: 'sunrise',
    autoStartSnake: true,
    showPanel: false,
    showClose: true,
    hideNav: true,
    compactHud: true,
    text: joinRewardText([
      'Cursus afgerond.',
      `${learnerName} heeft ${courseName} succesvol voltooid binnen ${schoolName}. Deze reward markeert een leermoment dat meteen voelbaar mag zijn.`,
      'Kennis groeit sneller wanneer vooruitgang zichtbaar wordt. Daarom maken we het afronden van een opleiding tastbaar met een korte, speelse overlay die succes bevestigt zonder het hoofdproduct te onderbreken.',
      '- Badge vrijgespeeld: Course Complete',
      `- Nieuwe stap klaar: ${nextUnlock}`,
      '- Voortgang bijgewerkt in het leerpad',
      '- Team iCT ziet de groei terug in het dashboard',
      '- Gebruik dit na onboarding, opleiding of certificering',
    ]),
  }
}

export function buildSupportMilestoneReward(input: SupportMilestonePresetInput = {}): RewardOverlayOptions {
  const teamName = input.teamName || 'Team iCT'
  const solvedTickets = input.solvedTickets || 25
  const scopeLabel = input.scopeLabel || 'over de hele scholengroep'
  const nextGoal = input.nextGoal || 'Volgende mijlpaal: 50 opgeloste tickets'

  return {
    mode: 'dragon',
    theme: 'aurora',
    showPanel: false,
    showClose: true,
    hideNav: true,
    compactHud: true,
    text: joinRewardText([
      'Support mijlpaal bereikt.',
      `${teamName} heeft ${solvedTickets} supportvragen opgelost ${scopeLabel}. Deze reward laat voelen dat betrouwbare ondersteuning ook echte vooruitgang is.`,
      'Een supportmijlpaal is meer dan volume. Ze staat voor rust, continuiteit en vertrouwen. Daarom past hier een krachtigere reward bij die stabiliteit en impact uitstraalt.',
      `- ${solvedTickets} cases afgerond`,
      '- Betrouwbaarheid zichtbaar gemaakt',
      '- Supportdruk slim omgezet in momentum',
      `- ${nextGoal}`,
      '- Gebruik dit na supportstreaks, SLA-doelen of platformmigraties',
    ]),
  }
}

export function buildTeamStreakReward(input: TeamStreakPresetInput = {}): RewardOverlayOptions {
  const teamName = input.teamName || 'Team iCT'
  const streakDays = input.streakDays || 7
  const schoolsReached = input.schoolsReached || 5
  const focusLabel = input.focusLabel || 'digitale opvolging'

  return {
    mode: 'snake',
    difficulty: 'normal',
    theme: 'ember',
    autoStartSnake: true,
    showPanel: false,
    showClose: true,
    hideNav: true,
    compactHud: true,
    text: joinRewardText([
      'Team streak actief.',
      `${teamName} houdt al ${streakDays} dagen op rij focus op ${focusLabel}. ${schoolsReached} scholen liften mee op die gezamenlijke ritmiek.`,
      'Een streakreward maakt collectieve discipline zichtbaar. Niet als droge teller, maar als een gedeelde pulse die mensen motiveert om nog een stap verder te gaan.',
      `- ${streakDays} dagen consistente actie`,
      `- ${schoolsReached} scholen mee in beweging`,
      '- Teamritme zichtbaar gemaakt',
      '- Bonus geschikt voor dashboards en weekstarts',
      '- Gebruik dit voor gewoontes, check-ins of beleidssprints',
    ]),
  }
}

export function buildRewardPreset(kind: RewardPresetKind): RewardOverlayOptions {
  if (kind === 'support-milestone') return buildSupportMilestoneReward()
  if (kind === 'team-streak') return buildTeamStreakReward()
  return buildCourseCompleteReward()
}
