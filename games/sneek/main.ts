// Sneek — de woordentuin. UI-laag: bezoek & rondes, HUD, woordbalk, invoer en
// het berichtenprotocol met de host-app.
//
// Eén bezoek = één Sneek-token = `rounds` rondes binnen `visitSeconds` speeltijd.
// De speeltijd telt enkel tijdens actief spelen (pauze en tussenschermen niet).

import { MARKUP } from './markup';
import { drawEnso } from './enso';
import * as E from './engine';
import { Sound } from './sound';
import {
  ACCENTS, DEFAULT_CONFIG, listenForConfig, postToHost, readEmbedInfo,
  type Best, type CompletePayload, type GameMode, type RoundSummary, type SneekConfig,
} from './protocol';
import { FALLBACK_WORDS, WordQueue, sanitizeWords, type WordEntry } from './words';
import { TAU, clamp, ctx2d, el, fmtTime, mk, mq, pick, rand, store } from './util';

export interface BootOptions {
  root?: HTMLElement;
  config?: Partial<SneekConfig>;
  eco?: boolean;
}

export interface SneekApi {
  readonly embedded: boolean;
  config(): SneekConfig;
  /** Nieuwe instellingen toepassen en terug naar het menu met een vers bezoek. */
  reset(next: Partial<SneekConfig>): void;
  resetRecords(): void;
  setEco(on: boolean): void;
}

type Overlay = 'menu' | 'pause' | 'round' | 'done' | null;

interface Visit {
  started: boolean;
  ended: boolean;
  round: number;
  playedMs: number;
  rounds: RoundSummary[];
  words: Map<string, WordEntry>;
  letters: number;
  total: number;
  bestRound: number;
  warned: boolean;
  recordBefore: number;
}

const freshVisit = (recordBefore: number): Visit => ({
  started: false, ended: false, round: 0, playedMs: 0, rounds: [], words: new Map(),
  letters: 0, total: 0, bestRound: 0, warned: false, recordBefore,
});

const TITLES: Record<string, string[]> = {
  wall: ['Tegen de rand', 'De rand is hard'],
  stone: ['Tegen een steen', 'Die steen gaat niet opzij'],
  self: ['Tegen je eigen staart', 'De cirkel is rond'],
  time: ['De tijd is om'],
  full: ['De tuin is vol!'],
  stopped: ['Gestopt'],
};

export function bootSneek(opts: BootOptions = {}): SneekApi {
  const root = opts.root ?? document.getElementById('sneek-root') ?? document.body;
  root.innerHTML = MARKUP; // statische opmaak — nooit gebruikersinhoud

  const info = readEmbedInfo();
  const embedded = info.embedded;
  let cfg: SneekConfig = { ...DEFAULT_CONFIG, ...opts.config, ...info.initial };
  Sound.setAllowed(cfg.soundAllowed);

  const REDUCED = mq('(prefers-reduced-motion: reduce)');
  const TOUCH = mq('(pointer: coarse)') || ('ontouchstart' in window && navigator.maxTouchPoints > 0 && mq('(hover: none)'));
  const nav = navigator as Navigator & { deviceMemory?: number };
  const lowEnd = (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 2) || (nav.deviceMemory !== undefined && nav.deviceMemory <= 2);
  const urlEco = new URL(location.href).searchParams.get('eco');
  let ecoForced = urlEco === '1' || opts.eco === true;
  // Eerder automatisch in spaarstand gezet op dit toestel? Dan meteen zo starten.
  let eco = ecoForced || (urlEco !== '0' && (lowEnd || store.get<boolean>('eco-auto', false)));

  const $ = {
    app: el('snApp'), hud: el('snHud'), wordbar: el('snWordbar'), foot: el('snFoot'), stage: el('snStage'), board: el('snBoard'),
    garden: el<HTMLCanvasElement>('snGarden'), ring: el<HTMLCanvasElement>('snRing'), fx: el<HTMLCanvasElement>('snFx'),
    modeTag: el('snModeTag'), time: el('snTime'), score: el('snScore'), best: el('snBest'), bestWrap: el('snBestWrap'),
    pips: el('snPips'), seal: el('snSeal'), sealTxt: el('snSealTxt'),
    btnPause: el('snBtnPause'), btnSfx: el('snBtnSfx'), btnClose: el('snBtnClose'),
    tiles: el('snTiles'), count: el('snCount'), countN: el('snCountN'),
    hint: el('snHint'), hintTxt: el('snHintTxt'), banner: el('snBanner'), bannerK: el('snBannerK'), bannerL: el('snBannerL'),
    card: el('snWordcard'), cardWord: el('snWcWord'), cardDef: el('snWcDef'), live: el('snLive'), pad: el('snPad'),
    menu: el('snMenu'), ensoBig: el<HTMLCanvasElement>('snEnsoBig'), modes: el('snModes'), source: el('snSource'),
    goldNote: el('snGoldNote'), adminText: el('snAdminText'), visitTxt: el('snVisitTxt'), start: el('snStart'),
    pauseOv: el('snPauseOv'), resume: el('snResume'), stop: el('snStopBtn'), tglSfx: el('snTglSfx'), soundRow: el('snSoundRow'),
    roundOv: el('snRoundOv'), roundBest: el('snRoundBest'), roundBadge: el('snRoundBadge'), roundTitle: el('snRoundTitle'), roundSub: el('snRoundSub'),
    rScore: el('snRScore'), rBest: el('snRBest'), rWords: el('snRWords'), rTime: el('snRTime'), rList: el('snRList'), rWordsH: el('snRWordsH'), rEmpty: el('snREmpty'),
    next: el('snNext'), endVisit: el('snEndVisit'),
    doneOv: el('snDoneOv'), doneBest: el('snDoneBest'), ensoDone: el<HTMLCanvasElement>('snEnsoDone'), doneSub: el('snDoneSub'),
    dBest: el('snDBest'), dRecord: el('snDRecord'), dWords: el('snDWords'), dLetters: el('snDLetters'), dList: el('snDList'), dWordsH: el('snDWordsH'), dEmpty: el('snDEmpty'),
    doneBtn: el('snDoneBtn'), earnHint: el('snEarnHint'), menuClose: el('snMenuClose'),
    tools: document.querySelector<HTMLElement>('#snHud .sn-tools') ?? el('snHud'),
  };

  if (TOUCH) document.documentElement.classList.add('touch');
  if (embedded) { $.btnClose.hidden = false; $.menuClose.hidden = false; }

  // ─── Records & modus ──────────────────────────────────────
  const readBest = (): Best => {
    if (cfg.best) return { ...cfg.best };
    const b = store.get<Partial<Best>>('best', {});
    const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);
    return { rustig: n(b.rustig), uitdaging: n(b.uitdaging) };
  };
  let best = readBest();
  let mode: GameMode = cfg.mode ?? (store.get<string>('mode', 'rustig') === 'uitdaging' ? 'uitdaging' : 'rustig');

  const fallbackWords = sanitizeWords(FALLBACK_WORDS);
  const effectiveWords = () => (cfg.words.length ? cfg.words : fallbackWords);
  let queue = new WordQueue(effectiveWords());
  let visit = freshVisit(best[mode]);
  let roundWords: WordEntry[] = [];
  let overlay: Overlay = 'menu';
  let hudScore = 0, hudShown = -1, lastLevel = 0;
  let cardTimer = 0, liveTimer = 0;

  // ─── Thema ────────────────────────────────────────────────
  function applyTheme() {
    const accent = ACCENTS[cfg.theme] ?? ACCENTS.aurora;
    document.documentElement.style.setProperty('--accent', accent);
    E.setAccent(accent);
    E.setGold(cfg.goldSnake);
  }

  function applyEcoClass() {
    document.documentElement.classList.toggle('eco', eco);
    E.setEco(eco);
  }

  // ─── Motor ────────────────────────────────────────────────
  E.initEngine($.garden, {
    nextWord: () => queue.next(),
    onWordStart: w => renderWord(w, -1),
    onLetter: (w, slot) => renderWord(w, slot),
    onWordComplete: w => onWordComplete(w),
    onScore: () => { /* HUD volgt via tick */ },
    onLevel: lvl => onLevel(lvl),
    onRoundEnd: r => window.setTimeout(() => onRoundEnd(r), r.reason === 'time' ? 350 : 0),
    onStateChange: s => onEngineState(s),
  }, { touch: TOUCH, reduced: REDUCED, eco, board: $.board });
  applyTheme();
  applyEcoClass();

  // ─── Woordbalk ────────────────────────────────────────────
  function tileSize(n: number): number {
    const bar = $.wordbar.clientWidth || 300;
    const wideMode = $.app.classList.contains('wide');
    const avail = wideMode ? bar : bar - ($.count.offsetWidth || 56) - 12;
    return clamp(Math.floor((avail - (n - 1) * 4) / Math.max(1, n)), wideMode ? 17 : 20, 36);
  }

  function renderWord(w: E.ActiveWord, popSlot: number) {
    $.tiles.classList.remove('idle', 'done');
    $.tiles.textContent = '';
    $.wordbar.style.setProperty('--tile', tileSize(w.slots.length) + 'px');
    const frag = document.createDocumentFragment();
    w.slots.forEach((s, i) => {
      const t = document.createElement('span');
      t.className = 'sn-tile';
      if (!s.collectible) {
        t.classList.add('gap');
        t.textContent = s.ch === ' ' ? '' : s.ch;
      } else {
        t.textContent = s.ch;
        if (s.got) t.classList.add('got');
        else if (i === w.next) t.classList.add('next');
        if (i === popSlot) t.classList.add('pop');
      }
      frag.appendChild(t);
    });
    $.tiles.appendChild(frag);
    $.tiles.setAttribute('aria-label', `Woord: ${w.entry.word}`);
  }

  function idleWordbar(text: string) {
    $.tiles.className = 'sn-tiles idle';
    $.tiles.textContent = text;
  }

  function onWordComplete(w: E.ActiveWord) {
    $.tiles.classList.add('done');
    roundWords.push(w.entry);
    $.countN.textContent = String(roundWords.length);
    $.count.classList.remove('bump'); void $.count.offsetWidth; $.count.classList.add('bump');
    showWordCard(w.entry);
  }

  function showWordCard(entry: WordEntry) {
    window.clearTimeout(cardTimer);
    $.cardWord.textContent = entry.word;
    $.cardDef.textContent = entry.definition;
    const hp = E.headPos();
    $.card.classList.toggle('bottom', hp.y < hp.H * 0.45);
    $.card.classList.add('show');
    announce(entry.definition ? `${entry.word}: ${entry.definition}` : `Woord klaar: ${entry.word}`);
    cardTimer = window.setTimeout(() => $.card.classList.remove('show'), entry.definition ? 2600 : 1600);
  }

  function announce(text: string) {
    window.clearTimeout(liveTimer);
    $.live.textContent = '';
    liveTimer = window.setTimeout(() => { $.live.textContent = text; }, 60);
  }

  // ─── HUD ──────────────────────────────────────────────────
  function renderPips() {
    $.pips.textContent = '';
    for (let i = 1; i <= cfg.rounds; i++) {
      const p = document.createElement('span');
      p.className = 'sn-pip';
      if (visit.started && i < visit.round) p.classList.add('used');
      else if (visit.started && i === visit.round) p.classList.add('now');
      $.pips.appendChild(p);
    }
    const left = Math.max(0, cfg.rounds - (visit.started ? visit.round : 0));
    $.pips.setAttribute('aria-label', visit.started ? `Ronde ${visit.round} van ${cfg.rounds}` : `${left} rondes`);
  }

  function updateHUD() {
    const inRound = E.roundActive() || E.getState() === 'over';
    const cur = inRound ? E.getScore() : 0;
    const stored = best[mode];
    $.best.textContent = String(Math.max(stored, cur));
    $.bestWrap.classList.toggle('rec', inRound && cur > stored && stored > 0);
    $.modeTag.textContent = mode === 'rustig' ? 'Rustig' : 'Uitdaging';
    const lvl = inRound ? E.getLevel() : 1;
    if (lvl !== lastLevel) {
      $.sealTxt.textContent = String(lvl);
      $.seal.title = 'Niveau ' + lvl;
      if (lastLevel && lvl > lastLevel) { $.seal.classList.remove('stamp'); void $.seal.offsetWidth; $.seal.classList.add('stamp'); }
      lastLevel = lvl;
    }
    $.btnPause.classList.toggle('is-paused', E.getState() === 'paused');
    renderPips();
  }

  let ringFrac = -1, ringWarn = false;
  function updateTimer() {
    const total = cfg.visitSeconds * 1000;
    const left = Math.max(0, total - visit.playedMs);
    $.time.textContent = fmtTime(left);
    const warn = visit.started && left <= 30000;
    $.time.classList.toggle('warn', warn);
    const frac = left / total;
    if (Math.abs(frac - ringFrac) > 0.004 || warn !== ringWarn) {
      ringFrac = frac; ringWarn = warn;
      drawEnso($.ring, Math.max(0.02, frac), warn ? [163, 54, 31] : [24, 20, 17]);
    }
    if (warn && !visit.warned && E.getState() === 'playing') { visit.warned = true; announce('Nog 30 seconden'); }
  }

  function tickHUD(dt: number) {
    const target = E.roundActive() || E.getState() === 'over' ? E.getScore() : 0;
    if (hudScore !== target) {
      hudScore += (target - hudScore) * Math.min(1, dt * 11);
      if (Math.abs(target - hudScore) < 0.5) hudScore = target;
    }
    const v = Math.round(hudScore);
    if (v !== hudShown) { hudShown = v; $.score.textContent = String(v); updateHUD(); }
  }

  function onLevel(level: number) {
    $.bannerK.textContent = String(level);
    $.bannerL.textContent = 'Niveau ' + level;
    $.banner.classList.remove('show'); void $.banner.offsetWidth; $.banner.classList.add('show');
    updateHUD();
  }

  function showHint(on: boolean) {
    $.hintTxt.textContent = '';
    if (TOUCH) {
      $.hintTxt.textContent = 'Veeg of tik op een steen om te beginnen';
    } else {
      $.hintTxt.append('Druk op ');
      for (const k of ['←', '↑', '↓', '→']) { const kb = document.createElement('kbd'); kb.textContent = k; $.hintTxt.append(kb); }
      $.hintTxt.append(' om te beginnen');
    }
    $.hint.classList.toggle('show', on);
  }

  function onEngineState(s: E.EngineState) {
    if (s === 'playing') showHint(false);
    $.btnPause.classList.toggle('is-paused', s === 'paused');
  }

  // ─── Overlays ─────────────────────────────────────────────
  const OV: Record<Exclude<Overlay, null>, HTMLElement> = { menu: $.menu, pause: $.pauseOv, round: $.roundOv, done: $.doneOv };
  function openOverlay(o: Exclude<Overlay, null>, focus: HTMLElement) {
    for (const k of Object.keys(OV) as Exclude<Overlay, null>[]) OV[k].classList.toggle('show', k === o);
    overlay = o;
    window.setTimeout(() => { if (overlay === o) focus.focus({ preventScroll: true }); }, 80);
  }
  function closeOverlays() {
    for (const k of Object.keys(OV) as Exclude<Overlay, null>[]) OV[k].classList.remove('show');
    overlay = null;
    const a = document.activeElement as HTMLElement | null;
    if (a && a.blur) a.blur();
  }

  function sourceText(): string {
    const words = cfg.words;
    if (!words.length) return 'Oefenwoorden: algemene schooltaal. Na een oefensessie speel je met je eigen woorden.';
    const pri = words.filter(w => w.priority).length;
    const n = words.length;
    const base = `${n} ${n === 1 ? 'woord' : 'woorden'} uit je oefensessie.`;
    if (!pri) return base;
    return `${base} ${pri === 1 ? 'Het woord dat je fout had, komt eerst.' : `De ${pri} woorden die je fout had, komen eerst.`}`;
  }

  function visitText(): string {
    const s = cfg.visitSeconds;
    const t = s < 60 ? `${s} seconden` : s % 60 === 0 ? `${s / 60} ${s === 60 ? 'minuut' : 'minuten'}` : `${fmtTime(s * 1000)} minuten`;
    return `${cfg.rounds} ${cfg.rounds === 1 ? 'ronde' : 'rondes'} · ${t} speeltijd`;
  }

  function refreshMenu() {
    $.modes.querySelectorAll<HTMLElement>('.sn-mode').forEach(b => {
      const on = b.dataset.mode === mode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    $.modes.querySelectorAll<HTMLElement>('[data-best]').forEach(s => {
      const m = s.dataset.best === 'uitdaging' ? 'uitdaging' : 'rustig';
      s.textContent = 'Record ' + best[m];
    });
    $.source.textContent = sourceText();
    $.goldNote.hidden = !cfg.goldSnake;
    $.adminText.hidden = !cfg.text;
    $.adminText.textContent = cfg.text;
    $.visitTxt.textContent = visitText();
  }

  function setMode(m: GameMode, sound: boolean) {
    if (m === mode) return;
    mode = m;
    if (!embedded) store.set('mode', m);
    refreshMenu(); updateHUD();
    if (E.getState() === 'demo') E.startDemo(mode);
  }

  let ensoAnim: { t0: number; dur: number; cv: HTMLCanvasElement } | null = null;

  function showMenu() {
    closeOverlays();
    showHint(false);
    visit = freshVisit(best[mode]);
    queue = new WordQueue(effectiveWords());
    roundWords = [];
    $.countN.textContent = '0';
    idleWordbar('Bouw woorden, letter voor letter');
    E.startDemo(mode);
    refreshMenu();
    updateHUD();
    ringFrac = -1;
    updateTimer();
    openOverlay('menu', $.start);
    ensoAnim = { t0: performance.now(), dur: 1500, cv: $.ensoBig };
    drawEnso($.ensoBig, 0);
  }

  function beginVisit() {
    if (overlay !== 'menu' || visit.ended) return; // enkel vanuit het menu, nooit dubbel
    if (!visit.started) {
      visit = freshVisit(best[mode]);
      visit.started = true;
      queue = new WordQueue(effectiveWords());
      postToHost(embedded, { type: 'hlc-reward-started' });
    }
    startRound();
  }

  function startRound() {
    visit.round++;
    roundWords = [];
    $.countN.textContent = '0';
    closeOverlays();
    E.startRound(mode);
    hudScore = 0; hudShown = -1;
    showHint(true);
    updateHUD();
  }

  function nextRound() {
    if (overlay !== 'round' || visit.ended) return;
    startRound();
  }

  function onRoundEnd(r: E.RoundResult) {
    if (!visit.started || visit.ended) return;
    Sound.end();
    visit.rounds.push({ score: r.score, words: r.words.map(w => w.word), reason: r.reason });
    for (const w of r.words) visit.words.set(w.word.toLocaleLowerCase('nl'), w);
    visit.letters += r.letters;
    visit.total += r.score;
    visit.bestRound = Math.max(visit.bestRound, r.score);
    const prevBest = best[mode];
    const isRecord = r.score > prevBest && r.score > 0;
    if (isRecord) {
      best[mode] = r.score;
      if (!embedded) store.set('best', best);
    }
    const timeUp = visit.playedMs >= cfg.visitSeconds * 1000;
    const last = visit.round >= cfg.rounds || r.reason === 'time' || r.reason === 'stopped' || timeUp;
    if (last) endVisit();
    else showRoundOver(r, isRecord, prevBest);
  }

  function fillWordList(list: HTMLElement, words: WordEntry[]) {
    list.textContent = '';
    for (const w of words) {
      const li = document.createElement('li');
      const b = document.createElement('b');
      b.textContent = w.word;
      li.appendChild(b);
      const d = document.createElement('span');
      d.textContent = w.definition || '—';
      li.appendChild(d);
      list.appendChild(li);
    }
  }

  function stampRecord(node: HTMLElement, show: boolean, ov: Overlay) {
    node.classList.remove('show');
    if (!show) return;
    window.setTimeout(() => {
      if (overlay !== ov) return;
      node.classList.add('show');
    }, 650);
  }

  function showRoundOver(r: E.RoundResult, isRecord: boolean, prevBest: number) {
    const leftRounds = cfg.rounds - visit.round;
    $.roundBadge.textContent = `Ronde ${visit.round} van ${cfg.rounds}`;
    $.roundTitle.textContent = pick(TITLES[r.reason] ?? TITLES.self);
    const letters = `${r.letters} ${r.letters === 1 ? 'letter' : 'letters'}`;
    $.roundSub.textContent = `${mode === 'rustig' ? 'Rustig' : 'Uitdaging'} · niveau ${r.level} · ${letters}`;
    $.rScore.textContent = String(r.score);
    $.rBest.textContent = String(Math.max(best[mode], prevBest));
    $.rWords.textContent = String(r.words.length);
    $.rTime.textContent = fmtTime(r.timeMs);
    fillWordList($.rList, r.words);
    $.rList.hidden = r.words.length === 0;
    $.rWordsH.hidden = r.words.length === 0;
    $.rEmpty.hidden = r.words.length > 0;
    const leftTime = fmtTime(cfg.visitSeconds * 1000 - visit.playedMs);
    $.next.firstChild!.textContent = leftRounds === 1 ? 'Laatste ronde ' : 'Volgende ronde ';
    $.next.setAttribute('aria-label', `${leftRounds === 1 ? 'Laatste ronde' : 'Volgende ronde'} — nog ${leftTime} speeltijd`);
    openOverlay('round', $.next);
    stampRecord($.roundBest, isRecord, 'round');
    updateHUD();
    announce(`${$.roundTitle.textContent}. Score ${r.score}. ${r.words.length} woorden.`);
  }

  function endVisit() {
    if (!visit.started || visit.ended) return;
    visit.ended = true;
    const words = Array.from(visit.words.values());
    const payload: CompletePayload = {
      mode: 'snake',
      gameMode: mode,
      score: visit.bestRound,
      total: visit.total,
      rounds: visit.rounds,
      words: words.map(w => w.word),
      durationMs: Math.round(Math.min(visit.playedMs, cfg.visitSeconds * 1000)),
    };
    postToHost(embedded, { type: 'hlc-reward-complete', ...payload });

    const n = visit.rounds.length;
    $.doneSub.textContent = `${n} ${n === 1 ? 'ronde' : 'rondes'} · ${fmtTime(Math.min(visit.playedMs, cfg.visitSeconds * 1000))} gespeeld`;
    $.dBest.textContent = String(visit.bestRound);
    $.dRecord.textContent = String(best[mode]);
    $.dWords.textContent = String(words.length);
    $.dLetters.textContent = String(visit.letters);
    fillWordList($.dList, words);
    $.dList.hidden = words.length === 0;
    $.dWordsH.hidden = words.length === 0;
    $.dEmpty.hidden = words.length > 0;
    $.doneBtn.firstChild!.textContent = embedded ? 'Terug naar de les ' : 'Nieuw bezoek ';
    $.earnHint.textContent = embedded ? cfg.earnHint : `In de app kost elk bezoek één Sneek-token. ${cfg.earnHint}`;
    openOverlay('done', $.doneBtn);
    ensoAnim = { t0: performance.now(), dur: 1400, cv: $.ensoDone };
    drawEnso($.ensoDone, 0);
    stampRecord($.doneBest, visit.bestRound > visit.recordBefore && visit.bestRound > 0, 'done');
    updateHUD();
    announce(`Tuinbezoek klaar. ${words.length} woorden gebouwd.`);
  }

  function closeGame() {
    if (embedded) postToHost(embedded, { type: 'hlc-reward-close' });
    else showMenu();
  }

  function onDone() {
    if (overlay !== 'done') return;
    closeGame();
  }

  // ─── Pauze & stoppen ──────────────────────────────────────
  function togglePause() {
    const s = E.getState();
    if (s === 'playing') {
      E.pause();
      openOverlay('pause', $.resume);
    } else if (s === 'paused' || overlay === 'pause') {
      E.resume();
      closeOverlays();
    }
    updateHUD();
  }

  function stopVisit() {
    if (E.roundActive()) {
      if (E.getState() === 'paused') E.resume();
      closeOverlays();
      E.endRound('stopped');
    } else {
      endVisit();
    }
  }

  function onCloseButton() {
    if (!visit.started || visit.ended) { closeGame(); return; }
    const s = E.getState();
    if (s === 'playing') togglePause();
    else if (s === 'ready') openOverlay('pause', $.resume);
  }

  // ─── Invoer ───────────────────────────────────────────────
  const KEYMAP: Record<string, E.DirName> = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', W: 'up', z: 'up', Z: 'up', s: 'down', S: 'down', a: 'left', A: 'left', q: 'left', Q: 'left', d: 'right', D: 'right',
  };

  function toggleSound() {
    if (!Sound.allowed) return;
    Sound.setOn(!Sound.on);
    syncToggles();
    if (Sound.on) Sound.letter(0); // één zacht bevestigingstoontje
  }
  function syncToggles() {
    const s = Sound.on ? 'true' : 'false';
    $.btnSfx.setAttribute('aria-pressed', s);
    $.tglSfx.setAttribute('aria-pressed', s);
    $.btnSfx.hidden = !Sound.allowed;
    $.soundRow.hidden = !Sound.allowed;
  }

  window.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Doorgestuurde toetsen van de app hebben het venster als doel, geen element.
    const t = e.target instanceof Element ? (e.target as HTMLElement) : null;
    if (t && t.closest('input, textarea, select, .sn-demo')) return;
    const k = e.key;
    if (k === 'm' || k === 'M') { toggleSound(); return; }

    if (overlay === 'menu') {
      if (k === 'Escape' && embedded) { e.preventDefault(); closeGame(); return; }
      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'a' || k === 'A' || k === 'q' || k === 'Q' || k === 'd' || k === 'D') {
        e.preventDefault();
        setMode(mode === 'rustig' ? 'uitdaging' : 'rustig', true);
      } else if (k === 'Enter' || k === ' ') {
        // Spatie op een modusknop kiest die modus; Enter start altijd (zoals de knop belooft).
        if (k === ' ' && t && t.closest('.sn-mode')) return;
        e.preventDefault();
        if (!e.repeat) beginVisit();
      }
      return;
    }
    if (overlay === 'round') {
      if ((k === 'Enter' || k === ' ') && !e.repeat) {
        if (t && t.tagName === 'BUTTON') return;
        e.preventDefault(); nextRound();
      }
      return;
    }
    if (overlay === 'done') {
      if ((k === 'Enter' || k === ' ') && !e.repeat) {
        if (t && t.tagName === 'BUTTON') return;
        e.preventDefault(); onDone();
      }
      return;
    }
    if (overlay === 'pause') {
      if ((k === ' ' || k === 'Enter' || k === 'Escape' || k === 'p' || k === 'P') && !e.repeat) {
        if (t && t.tagName === 'BUTTON' && k !== 'Escape') return;
        e.preventDefault(); togglePause();
      }
      return;
    }
    const dn = KEYMAP[k];
    if (dn) { e.preventDefault(); E.pushDir(E.DIRS[dn]); return; }
    if (k === ' ' || k === 'p' || k === 'P' || k === 'Escape' || k === 'Enter') {
      e.preventDefault();
      if (e.repeat) return;
      if (E.getState() === 'dying') E.skipDeath();
      else if (k !== 'Enter') togglePause();
    }
  });


  let touch0: { x: number; y: number } | null = null;
  document.addEventListener('touchstart', e => {
    const t = e.target instanceof Element ? (e.target as HTMLElement) : null;
    if (overlay || (t && t.closest('button, .sn-demo'))) { touch0 = null; return; }
    const p = e.changedTouches[0];
    touch0 = { x: p.clientX, y: p.clientY };
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!touch0) return;
    e.preventDefault();
    const p = e.changedTouches[0], dx = p.clientX - touch0.x, dy = p.clientY - touch0.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 22) {
      E.pushDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? E.DIRS.right : E.DIRS.left) : (dy > 0 ? E.DIRS.down : E.DIRS.up));
      touch0 = { x: p.clientX, y: p.clientY };
    }
  }, { passive: false });
  document.addEventListener('touchend', () => { touch0 = null; }, { passive: true });

  $.pad.querySelectorAll<HTMLButtonElement>('button').forEach(b => {
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      const d = b.dataset.dir as E.DirName | undefined;
      if (d && E.DIRS[d]) E.pushDir(E.DIRS[d]);
      b.classList.add('hit');
      window.setTimeout(() => b.classList.remove('hit'), 110);
    });
  });

  $.modes.querySelectorAll<HTMLElement>('.sn-mode').forEach(b => b.addEventListener('click', () => {
    setMode(b.dataset.mode === 'uitdaging' ? 'uitdaging' : 'rustig', true);
  }));
  $.start.addEventListener('click', () => beginVisit());
  $.menuClose.addEventListener('click', () => { if (overlay === 'menu') closeGame(); });
  $.next.addEventListener('click', () => nextRound());
  $.endVisit.addEventListener('click', () => { if (overlay === 'round') endVisit(); });
  $.resume.addEventListener('click', () => togglePause());
  $.stop.addEventListener('click', () => stopVisit());
  $.doneBtn.addEventListener('click', () => onDone());
  $.btnPause.addEventListener('click', () => { const s = E.getState(); if (s === 'playing' || s === 'paused') togglePause(); });
  $.btnSfx.addEventListener('click', toggleSound);
  $.tglSfx.addEventListener('click', toggleSound);
  $.btnClose.addEventListener('click', onCloseButton);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (E.getState() === 'playing') togglePause(); Sound.suspend(); }
    else Sound.resume();
  });

  // ─── Layout ───────────────────────────────────────────────
  function layout() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const cs = getComputedStyle($.app);
    const padT = parseFloat(cs.paddingTop) || 10, padB = parseFloat(cs.paddingBottom) || 10;
    $.app.classList.remove('wide');
    document.documentElement.style.setProperty('--board', Math.max(260, vw - 20) + 'px');
    const stackedFixed = $.hud.offsetHeight + $.wordbar.offsetHeight + $.foot.offsetHeight + 10 * 3;
    const stacked = Math.min(vw - 20, vh - padT - padB - stackedFixed);
    const side = clamp(Math.round(vw * 0.3), 240, 330);
    const wide = Math.min(vw - side - 20 - 24, vh - padT - padB);
    // Liggende gsm: altijd naast elkaar. Laptop: enkel als het gestapelde bord echt te klein wordt.
    const useWide = vw > vh && wide > stacked * 1.12 && (TOUCH || stacked < 520);
    let av = stacked;
    if (useWide) {
      $.app.classList.add('wide');
      document.documentElement.style.setProperty('--side', side + 'px');
      av = wide;
      if ($.count.parentElement !== $.tools) $.tools.appendChild($.count);
    } else if ($.count.parentElement !== $.wordbar) {
      $.wordbar.appendChild($.count);
    }
    const r = E.layoutBoard(av, av, !E.roundActive());
    document.documentElement.style.setProperty('--board', r.W + 'px');
    if (r.gridChanged && E.getState() === 'demo') E.startDemo(mode);
  }

  let rsT = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(rsT);
    rsT = window.setTimeout(() => { layout(); fxResize(); }, 120);
  });

  // ─── Pagina-sfeer: washi-papier & vallende bloesems ───────
  function makeWashi(): string {
    const S = 440, c = mk(S, S), x = ctx2d(c);
    x.fillStyle = '#eee7da'; x.fillRect(0, 0, S, S);
    const img = x.getImageData(0, 0, S, S), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 9; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.8; }
    x.putImageData(img, 0, 0);
    const tiles = [-S, 0, S];
    for (let i = 0; i < 34; i++) {
      const px = Math.random() * S, py = Math.random() * S, r = rand(30, 95), light = Math.random() < 0.55, a = rand(0.025, 0.05);
      for (const ox of tiles) for (const oy of tiles) {
        const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r);
        g.addColorStop(0, light ? `rgba(255,255,250,${a})` : `rgba(150,125,90,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.fillRect(px + ox - r, py + oy - r, r * 2, r * 2);
      }
    }
    for (let i = 0; i < 320; i++) {
      const x0 = Math.random() * S, y0 = Math.random() * S, len = rand(8, 48), a = rand(0, TAU), bend = rand(-0.8, 0.8);
      x.strokeStyle = Math.random() < 0.62 ? `rgba(255,255,255,${rand(0.25, 0.5)})` : `rgba(140,118,88,${rand(0.06, 0.14)})`;
      x.lineWidth = rand(0.3, 1.1);
      for (const ox of tiles) for (const oy of tiles) {
        x.beginPath(); x.moveTo(x0 + ox, y0 + oy);
        x.quadraticCurveTo(x0 + ox + Math.cos(a + bend) * len * 0.5, y0 + oy + Math.sin(a + bend) * len * 0.5, x0 + ox + Math.cos(a) * len, y0 + oy + Math.sin(a) * len);
        x.stroke();
      }
    }
    return c.toDataURL('image/jpeg', 0.86);
  }

  const fxx = ctx2d($.fx);
  let FW = 0, FH = 0;
  interface Petal { x: number; y: number; vx: number; vy: number; rot: number; vr: number; flip: number; fs: number; size: number; sway: number; color: string; a: number }
  const petals: Petal[] = [];
  function fxResize() {
    const dd = Math.min(eco ? 1 : 2, window.devicePixelRatio || 1);
    FW = window.innerWidth; FH = window.innerHeight;
    $.fx.width = Math.round(FW * dd); $.fx.height = Math.round(FH * dd);
    fxx.setTransform(dd, 0, 0, dd, 0, 0);
  }
  function newPetal(init: boolean): Petal {
    const fromTop = Math.random() < 0.45;
    return {
      x: init ? rand(0, FW) : fromTop ? rand(-40, FW * 0.8) : rand(-60, -20),
      y: init ? rand(0, FH) : fromTop ? rand(-60, -20) : rand(-20, FH * 0.8),
      vx: rand(16, 36), vy: rand(9, 22), rot: rand(0, TAU), vr: rand(-1.3, 1.3), flip: rand(0, TAU), fs: rand(0.8, 2),
      size: rand(4, 8), sway: rand(0, TAU), color: pick(E.PETAL_COLORS), a: rand(0.45, 0.85),
    };
  }
  function setPetalCount() {
    const n = REDUCED ? 0 : eco ? 4 : TOUCH ? 7 : 12;
    while (petals.length > n) petals.pop();
    while (petals.length < n) petals.push(newPetal(true));
  }
  function fxTick(dt: number, t: number) {
    fxx.clearRect(0, 0, FW, FH);
    if (!petals.length) return;
    const wind = 1 + 0.6 * Math.sin(t * 0.00025);
    for (let i = 0; i < petals.length; i++) {
      const p = petals[i];
      p.x += (p.vx * wind + Math.sin(t * 0.001 + p.sway) * 10) * dt;
      p.y += (p.vy + Math.cos(t * 0.0013 + p.sway) * 6) * dt;
      p.rot += p.vr * dt;
      if (p.x > FW + 40 || p.y > FH + 40) { petals[i] = newPetal(false); continue; }
      fxx.save(); fxx.globalAlpha = p.a; fxx.translate(p.x, p.y); fxx.rotate(p.rot);
      fxx.scale(p.size, p.size * Math.cos(p.flip + t * 0.002 * p.fs)); fxx.fillStyle = p.color; fxx.fill(E.PETAL); fxx.restore();
    }
  }

  // ─── Spaarstand: automatisch bij haperende beeldjes ───────
  let slowFor = 0, watchFor = 0, ecoLocked = urlEco === '0';
  function watchPerformance(dt: number) {
    if (eco || ecoLocked) return;
    const s = E.getState();
    if (document.hidden || dt > 0.25 || (s !== 'playing' && s !== 'demo')) return;
    watchFor += dt;
    if (watchFor < 2) return; // opwarmen
    slowFor = dt > 1 / 38 ? slowFor + dt : Math.max(0, slowFor - dt * 0.5);
    if (slowFor > 2.2) { setEcoInternal(true); store.set('eco-auto', true); }
  }
  function setEcoInternal(on: boolean) {
    if (eco === on) return;
    eco = on;
    applyEcoClass();
    layout();
    fxResize();
    setPetalCount();
  }

  // ─── Config van de host ───────────────────────────────────
  listenForConfig(embedded, c => {
    cfg = { ...cfg, ...c };
    Sound.setAllowed(cfg.soundAllowed);
    syncToggles();
    if (c.best) best = { ...c.best };
    if (c.mode && !visit.started) mode = c.mode;
    applyTheme();
    if (!visit.started) { queue = new WordQueue(effectiveWords()); refreshMenu(); updateHUD(); updateTimer(); }
  });

  // ─── Opstart ──────────────────────────────────────────────
  document.documentElement.style.setProperty('--washi', `url(${makeWashi()})`);
  fxResize();
  setPetalCount();
  syncToggles();
  layout();
  showMenu();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { layout(); }).catch(() => {});

  let lastT = performance.now(), loopErr = false;
  function frame(now: number) {
    requestAnimationFrame(frame);
    try {
      const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000));
      lastT = now;
      if (visit.started && !visit.ended && E.getState() === 'playing') {
        visit.playedMs += dt * 1000;
        if (visit.playedMs >= cfg.visitSeconds * 1000) E.endRound('time');
      }
      E.frame(dt);
      tickHUD(dt);
      updateTimer();
      fxTick(dt, now);
      watchPerformance(dt);
      if (ensoAnim) {
        const p = clamp((now - ensoAnim.t0) / ensoAnim.dur, 0, 1);
        drawEnso(ensoAnim.cv, 1 - Math.pow(1 - p, 2.2));
        if (p >= 1) ensoAnim = null;
      }
    } catch (err) {
      if (!loopErr) { loopErr = true; console.error(err); }
    }
  }
  requestAnimationFrame(frame);
  postToHost(embedded, { type: 'hlc-reward-ready' });

  const api: SneekApi = {
    embedded,
    config: () => ({ ...cfg }),
    reset(next) {
      cfg = { ...cfg, ...next };
      Sound.setAllowed(cfg.soundAllowed);
      syncToggles();
      if (next.best !== undefined) best = readBest();
      if (next.mode) mode = next.mode;
      applyTheme();
      showMenu();
    },
    resetRecords() {
      best = { rustig: 0, uitdaging: 0 };
      if (!embedded) store.set('best', best);
      refreshMenu(); updateHUD();
    },
    setEco(on) { ecoForced = on; ecoLocked = true; setEcoInternal(on); },
  };

  if (!embedded || new URL(location.href).searchParams.get('test') === '1') {
    (window as unknown as { __sneek: unknown }).__sneek = {
      api,
      snapshot: () => ({ ...E.debugSnapshot(), overlay, visit: { ...visit, words: Array.from(visit.words.keys()) }, best: { ...best } }),
      push: (d: E.DirName) => E.pushDir(E.DIRS[d]),
      begin: () => beginVisit(),
      addPlayTime: (ms: number) => { visit.playedMs += ms; },
    };
  }

  return api;
}
