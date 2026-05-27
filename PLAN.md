# TALTREKKERS — Roadmap & Status

> Laatste update: 2026-04-30. Bijgewerkt na grote optimalisatie-sessie + auth flow naar Microsoft-only.

---

## 🟢 Voltooid (sessie 2026-04-30)

### Fase 1 — Code Cleanup
- [x] Debug logs uit `index.tsx`, `AuthContext.tsx`, `App.tsx` weggehaald
- [x] Dode code en onvoltooide imports opgeruimd
- [x] Lege regels in `types.ts` opgeruimd

### Fase 2 — Bug Fixes & Security
- [x] 2.1 Gemini API key naar server-side proxy (`/api/gemini`)
- [x] 2.2 Hardcoded teacher password (`'Leerkracht'` in `Login.tsx`) vervangen door env var
- [x] 2.3 Supabase RLS policies aangescherpt (profiles, feedback, **registered_students** toegevoegd)
- [x] 2.4 File upload validatie (max 10 MB, MIME-check) in `CustomWordExtractor.tsx`
- [x] 2.5 `catch (error: any)` → `catch (error: unknown)` overal

### Fase 3 — Architectuur
- [x] 3.1 State opgesplitst uit `App.tsx`:
  - `useUserData` — localStorage state + user mutations
  - `usePracticeSession` — sessie lifecycle
  - `useAchievements` — achievement detectie
- [x] 3.2 `PracticeSettings` type opgesplitst
- [x] 3.3 `declare const any` vervangen door proper types
- [x] 3.4 `PracticeSetup.tsx` — practice config UI gecentraliseerd

### Fase 4 — Performance (deels)
- [x] 4.1 N+1 query gefixt — batch upsert via Supabase RPC `upsert_word_progress`
- [x] 4.2 Lazy loading voor Dashboard, TeacherDashboard, StoryView, SessionSummary, PracticeSession, Login, ListCompletionCelebration. Welcome blijft eager (hoofdroute).
- [x] 4.3 `constants.ts` opgesplitst in `constants/` map (settings, frayerModels, wordLists, schoolStructure, readingStrategies, lists)
- [x] 4.4 Stale state bug in `finishPractice` — `setUserData` accepteert nu updater-functie

### 🔴 Security Hardening
- [x] Hardcoded plaintext wachtwoord `'leerkracht'` uit `Dashboard.tsx` verwijderd → vervangen door `window.confirm`
- [x] `dangerouslySetInnerHTML` op AI-output vervangen door safe React JSX rendering (`Dashboard.tsx` + `StoryView.tsx`) → XSS-mitigatie
- [x] `/api/gemini` heeft nu Supabase JWT-auth + sliding-window rate limit (60 req/min auth, 15 req/min anoniem)
- [x] Frontend stuurt JWT mee in proxy-call (`callGeminiViaProxy`)
- [x] Prompt-injection guards: `wrapUserContent` + `PROMPT_INJECTION_NOTICE` in alle prompts met user input
- [x] TeacherDashboard alleen toegankelijk via Supabase `role='teacher'` (sessionStorage-bypass weg)
- [x] `registered_students` RLS toegevoegd aan `supabase-setup.sql`

### 🟠 Bug Fixes
- [x] `selectStudent`/`clearSelectedStudent`/`signOut` in `useCallback` (AuthContext)
- [x] `recordStudyTime` muteert state niet meer inplace (PracticeSession)
- [x] `useEffect` deps in PracticeSession gefixt (`[setupSession]` ipv `[setupSession, words.length]`)
- [x] Audio context dedupe — `playTextAsSpeech` gebruikt nu `getOrCreateAudioContext`
- [x] Supabase saves nu via `Promise.allSettled` met logging
- [x] ErrorBoundary toont stack trace alleen in dev

### ⚡ Performance & Code Quality
- [x] Vite chunks: `react-vendor`, `supabase`, `date-utils`
- [x] Dode `loadEnv` import uit `vite.config.ts`
- [x] `vercel.json` rewrites opgeschoond (negative-lookahead voor SPA)
- [x] `useLocalStorage` setter in `useCallback`
- [x] `services/utils.ts` met `shuffleArray` (Fisher-Yates) — alle gebroken `sort(() => 0.5 - Math.random())` vervangen (4 plekken)
- [x] `tsconfig.json` op `strict: true` + `@types/react` + `@types/react-dom` geïnstalleerd
- [x] Type bug `existingProgress?.masteredWords` in PracticeSetup gefixt
- [x] "Originele applicatie" map uitgesloten van TS compile

### 🔐 Auth Flow — Microsoft-only
- [x] `WelcomeScreen` → enkel Microsoft-login + leerkracht-shortcut. Anonymous-flow weg.
- [x] `Login.tsx` vereenvoudigd: alleen Microsoft-tab + leerkracht-code-tab. Google/Magic Link/Selecteer-jezelf weggehaald.
- [x] `App.tsx` heeft auth-gate: niet-ingelogde users worden teruggestuurd naar LandingChoice
- [x] `Login` component accepteert nu `initialTab` prop voor directe teacher-tab toegang

---

## 🟡 In voorbereiding (volgende sessie)

### Fase A — OneDrive-links centraliseren ⭐ HIGHEST PRIORITY
**Probleem**: 600+ potentiële combinaties (3 finaliteiten × 4-7 jaargangen × 10+ richtingen × 5 vakken). Links zitten verspreid op 2 plaatsen:
- [`components/PracticeSetup.tsx:45-50`](components/PracticeSetup.tsx) — basisvorming/specifiek deeplinks
- [`constants/schoolStructure.ts`](constants/schoolStructure.ts) — per-vak shared links

**Twee URL-patronen waargenomen**:
1. `tal-trekkers_gotalok_be/.../onedrive.aspx?id=...&viewid=fdf20b93-...` — deeplinks naar mappen, voorspelbaar uit pad
2. `info_gotalok_be/:f:/g/.../IgX...?e=Y` — gedeelde links met unieke hashes (niet voorspelbaar)

**Aanpak (akkoord vragen voor implementatie)**:
1. Maak `data/onedrive-links.csv` met kolommen `id, finaliteit, jaargang, categorie, naam, url`
2. Maak `scripts/build-onedrive-links.mjs` (Node script, geen extra deps)
3. Genereer `constants/onedriveLinks.generated.ts` met platte map
4. Voeg `npm run build:links` toe + hook in `predev`/`prebuild`
5. Refactor PracticeSetup + schoolStructure om uit dat ene bestand te lezen
6. Patroon-fallback functie `buildDeeplink(finaliteit, jaargang, type, vak)` voor lege URL-cellen waar het patroon werkt
7. UI placeholder "📝 link wordt nog toegevoegd" voor entries zonder URL

**Alternatief overwogen**: Supabase tabel + teacher admin UI. Niet gekozen want meer infra (~4u extra) en deploy-onafhankelijke wijzigingen zijn nu niet kritiek.

### Fase B — Microsoft tenant lock 🔒 (5 min)
[`components/WelcomeScreen.tsx:18-25`](components/WelcomeScreen.tsx) en [`components/Login.tsx:32-44`](components/Login.tsx) gebruiken `signInWithOAuth({provider: 'azure'})` zonder tenant-restrictie. **Élke Microsoft-account werkt** (ook persoonlijke `@outlook.com`).

```ts
options: {
  scopes: 'email profile',
  redirectTo: window.location.origin,
  queryParams: { tenant: 'gotalok.be' },  // toevoegen
}
```

### Fase C — Tailwind van CDN naar build-time (1u)
Console toont actief: `cdn.tailwindcss.com should not be used in production`. Genereert overbodige CSS bij elke pageload.
1. `npm install -D tailwindcss postcss autoprefixer`
2. `npx tailwindcss init -p`
3. `tailwind.config.js` content paths: `['./index.html', './**/*.{ts,tsx}']`
4. Custom theme tokens (tal-purple, tal-teal, etc.) verhuizen uit huidige `<script>` in index.html
5. `index.css` met `@tailwind base/components/utilities`
6. CDN script tag verwijderen uit `index.html`

### Fase D — CDN libs naar npm (2u)
[`components/CustomWordExtractor.tsx:75-108`](components/CustomWordExtractor.tsx) gebruikt `pdfjsLib`, `mammoth`, `XLSX` als globals via CDN-script-tags.
1. `npm install pdfjs-dist mammoth xlsx`
2. Dynamic `import()` waar gebruikt (zware libs, lazy loaden)
3. CDN script tags verwijderen uit `index.html`
4. `types/cdn-libs.d.ts` cleanup

---

## 🟠 Middelgrote features

### Fase E — Cloud sync van userData (4-6u, was PLAN 5.1)
Nu Microsoft-login verplicht is, kan `localStorage`-only data verhuizen naar Supabase.
1. Tabel `user_progress` (jsonb met UserData) of relationeel uitsplitsen
2. Bij login: hydrate `allUsersData[email]` uit Supabase
3. Na elke setUserData: debounced upsert
4. Conflict-resolution: laatste-wint of merge per veld
5. Offline queue (IndexedDB) voor netwerkproblemen

### Fase F — `practice_sessions.quiz_results` toevoegen
Nu wordt alleen `score` + `total_questions` opgeslagen, geen woord-niveau resultaten. Voor de leerkracht-analyse heb je per sessie nodig welke woorden fout gingen.
1. ALTER TABLE practice_sessions ADD COLUMN quiz_results jsonb
2. `db.ts` `saveSessionToSupabase` uitbreiden
3. TeacherDashboard kan dan heatmap per moeilijk woord tonen

### Fase G — Header logout dropdown
De `👤` knop in de Header heeft nu geen duidelijke functie. Maak er een dropdown van met:
- Profielnaam + avatar
- "Uitloggen" knop (callt `signOut()` uit AuthContext)
- "Mijn voortgang" → Dashboard

### Fase H — Bundle splitsen Welcome ↔ PracticeSetup
`index-*.js` is nu 267 KB (83 KB gzip) — Welcome trekt PracticeSetup en zijn deps mee. Lazy-load PracticeSetup binnen Welcome.

### Fase I — Database-fallback in AuthContext
`handle_new_user` Postgres-trigger maakt het profiel aan, maar bij silent failure heb je geen fallback. Voeg `upsert` op profiles toe in AuthContext na login.

---

## 🔵 Groot werk

### Fase J — Tests (was PLAN 6)
1. Vitest + React Testing Library + MSW
2. Hooks first: `useUserData`, `usePracticeSession`, `useAchievements`, `useLocalStorage`
3. `services/geminiService.cleanJsonOutput`, `services/utils.shuffleArray`, `services/errorHandling.categorizeError`
4. Component tests: PracticeSession flow, CustomWordExtractor (file upload validatie)
5. E2E: volledige practice sessie flow

### Fase K — Teacher dashboard uitbreiden (was PLAN 5.2)
- Per-student woordenlijst-progress
- Heatmap moeilijke woorden (vereist Fase F: quiz_results jsonb)
- Exporteerbaar rapport (CSV/PDF)
- Klassen-overzicht met aggregates

### Fase L — Offline modus + queue
- Service Worker registreren
- IndexedDB queue voor mislukte Supabase saves
- Retry on reconnect
- "Offline modus" banner in UI

---

## 📌 Belangrijke deploy-checks (NIET vergeten bij volgende deploy)

1. **Vercel env vars** toevoegen (server-side, géén `VITE_` prefix):
   - `GEMINI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   Zonder deze faalt JWT-verificatie in `/api/gemini` voor ingelogde users → ze vallen terug op anonieme rate limit.

2. **Supabase**: nieuwe `supabase-setup.sql` draaien voor `registered_students` RLS-policies.

3. **Microsoft Azure App Registration**: redirect URLs whitelisten in Azure portal.

---

## Architectuur referenties (mental model)

### Datastromen
- **Auth**: Supabase OAuth (Microsoft Azure) → AuthContext → useAuth() hook
- **User progress**: localStorage (`taaltrekkers-data-v2`) ↔ Supabase (deels gesynced via `db.ts`)
- **Practice flow**: PracticeSetup → App startPractice → usePracticeSession → PracticeSession → finishPractice → useAchievements
- **AI calls**: geminiService → callGemini() → IS_DEV ? callGeminiDirect (SDK) : callGeminiViaProxy (`/api/gemini`)

### Kritieke bestanden
| Bestand | Rol |
|---------|-----|
| [App.tsx](App.tsx) | State machine, navigation, auth gate |
| [hooks/usePracticeSession.ts](hooks/usePracticeSession.ts) | Sessie lifecycle, achievement detection, Supabase sync |
| [hooks/useUserData.ts](hooks/useUserData.ts) | localStorage CRUD + updater functions |
| [services/geminiService.ts](services/geminiService.ts) | AI generaties, TTS, prompt injection guards |
| [services/db.ts](services/db.ts) | Supabase data access (sessions, progress, feedback) |
| [api/gemini.ts](api/gemini.ts) | Server-side Gemini proxy met JWT auth + rate limit |
| [contexts/AuthContext.tsx](contexts/AuthContext.tsx) | Supabase auth state, role detection |
| [components/PracticeSetup.tsx](components/PracticeSetup.tsx) | Vakspecifieke configuratie (waar Fase A komt) |
| [constants/schoolStructure.ts](constants/schoolStructure.ts) | Hiërarchie finaliteit/jaargang/richting/vak (refactor target Fase A) |

---

## Volgorde voor volgende sessie

```
A (OneDrive links)  ← starten hier; geeft directe waarde voor leerkracht-onboarding
B (Tenant lock)     ← 5 min, security-positief
C (Tailwind native) ← prod-ready
D (CDN libs npm)    ← stabiliteit
E (Cloud sync)      ← grote feature, transformeert UX
F + K               ← teacher dashboard waardevol
G + I + H           ← polishing
J + L               ← long-term hardening
```
