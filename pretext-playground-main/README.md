# Reward Library

Een embeddable beloningsbibliotheek voor stand-alone apps, gebouwd rond de bestaande Droak/Sneek engine. De library is bedoeld als rewardlaag bovenop een bestaande webapp: een overlay die je opent na een opleiding, supportmijlpaal, streak of andere productmijlpaal.

## Wat zit erin

- Een herbruikbare host API via `src/reward-sdk.ts`
- Een reward runtime met een aparte overlaypagina via `reward.html`
- Presets voor:
  - `Course Complete`
  - `Support Milestone`
  - `Team Streak`
- Een demo-hostpagina op `rewards.html` die toont hoe een bestaande app de overlay zou openen

## Snel starten

```bash
npm install
npm run dev
```

Open daarna:

- `http://localhost:5173/` voor Droak en Sneek
- `http://localhost:5173/ascii.html` voor Experimenteel
- `http://localhost:5173/rewards.html` voor de reward-hostdemo

## Library build

Voor de demo:

```bash
npm run build
```

Voor de bibliotheek:

```bash
npm run build:lib
```

Voor beide:

```bash
npm run build:all
```

De library-output komt in `dist-lib/`.

## Publieke API

De centrale entry zit in `src/reward-sdk.ts`.

```ts
import {
  createRewardOverlay,
  showCourseCompleteReward,
  showSupportMilestoneReward,
  showTeamStreakReward,
} from './src/reward-sdk'

const reward = showCourseCompleteReward({
  courseName: 'Onboarding Microsoft 365',
  learnerName: 'Nieuwe directies',
})

reward.update({
  theme: 'sunrise',
  text: 'Nieuwe badge vrijgespeeld.',
})

reward.close()
```

## Hoe andere apps dit gebruiken

De host-app importeert de SDK en opent een overlay bovenop zijn eigen interface. De reward-engine zelf draait in de overlaypagina `reward.html`.

Belangrijk:

- De host-app moet de library kunnen importeren
- De rewardpagina moet bereikbaar zijn op de host, standaard via `/reward.html`
- Je kunt dat pad overschrijven via `pageUrl` in `createRewardOverlay(...)`

## Structuur

- `src/reward-sdk.ts`: publieke bibliotheek-entry
- `src/reward-embed.ts`: overlay-controller voor host-apps
- `src/reward-presets.ts`: herbruikbare rewardtypes
- `src/reward-runtime.ts`: runtime-config en messaging tussen host en rewardpagina
- `src/dragon.ts`: rewardengine
- `reward.html`: iframe/overlay runtime
- `rewards.html`: demo-host die de library gebruikt

## Volgende logische stappen

- Badge- en unlockdata persistent maken
- Extra presets toevoegen voor beleid, schoolmijlpalen en onboarding
- Framework wrappers maken voor React, Vue of plain TypeScript apps
