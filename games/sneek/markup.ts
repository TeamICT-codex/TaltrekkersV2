// Statische opmaak van het spel. Bevat GEEN gebruikersinhoud — alles wat van
// buiten komt (woorden, definities, teksten) wordt later via textContent gezet.

const ICON = {
  pause: '<svg viewBox="0 0 24 24"><g class="i-pause"><path d="M9 6.5v11M15 6.5v11"/></g><g class="i-play"><path d="M8.5 6v12l9.5-6z"/></g></svg>',
  sfx: '<svg viewBox="0 0 24 24"><path d="M4.5 9.5h3l4.5-3.5v12l-4.5-3.5h-3z"/><g class="on"><path d="M15.5 9.3a3.8 3.8 0 0 1 0 5.4"/><path d="M18 7a7 7 0 0 1 0 10"/></g><g class="off"><path d="M16 9.5l4.5 5M20.5 9.5l-4.5 5"/></g></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>',
  calm: '<svg viewBox="0 0 24 24"><path d="M3 9c3-2.5 6-2.5 9 0s6 2.5 9 0"/><path d="M3 15c3-2.5 6-2.5 9 0s6 2.5 9 0"/></svg>',
  stones: '<svg viewBox="0 0 24 24"><path d="M5.2 15.5c-.4-2.6 1.6-4.8 4.3-4.8s4.4 1.9 4.1 4.4c-.3 2.1-2 3.3-4.2 3.3s-3.9-1-4.2-2.9z"/><path d="M14.2 9.4c-.2-1.8 1.1-3.2 2.9-3.2s3 1.3 2.8 3c-.2 1.5-1.4 2.3-2.9 2.3s-2.6-.7-2.8-2.1z"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M6 14.5l6-6 6 6"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="M14.5 6l-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="M9.5 6l6 6-6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M6 9.5l6 6 6-6"/></svg>',
};

const CRACK = '<svg class="sn-crack" viewBox="0 0 170 12" aria-hidden="true"><path d="M2 6 L26 5 L37 8 L54 4 L70 7 L86 5 L99 9 L114 4 L131 7 L146 5 L168 6 M99 9 L104 12 M54 4 L57 1"/></svg>';

export const MARKUP = `
<canvas id="snFx" aria-hidden="true"></canvas>
<div class="sn-side l" aria-hidden="true"><span class="v">woordentuin</span><span class="h">letter voor letter</span></div>
<div class="sn-side r" aria-hidden="true"><span class="dot"></span><span class="v">rust &amp; taal</span><span class="h">tal-ent voor taal</span></div>

<div class="sn-app" id="snApp">
  <header class="sn-hud" id="snHud">
    <div class="sn-brand">
      <canvas id="snRing" width="96" height="96" aria-hidden="true"></canvas>
      <div>
        <div class="sn-name">Sneek</div>
        <div class="sn-tag"><span id="snModeTag">Rustig</span><span class="sn-tag-dot" aria-hidden="true">·</span><span class="sn-time" id="snTime" aria-label="Resterende speeltijd">5:00</span></div>
      </div>
    </div>
    <div class="sn-stats">
      <div class="sn-stat"><span class="sn-lbl">Score</span><span class="sn-val" id="snScore">0</span></div>
      <div class="sn-stat sn-best" id="snBestWrap"><span class="sn-lbl">Record</span><span class="sn-val" id="snBest">0</span></div>
    </div>
    <div class="sn-tools">
      <div class="sn-rounds" id="snPips" role="img" aria-label="Rondes"></div>
      <div class="sn-seal" id="snSeal" title="Niveau 1" aria-hidden="true"><span id="snSealTxt">1</span></div>
      <div class="sn-btns">
        <button class="sn-icon" id="snBtnPause" type="button" aria-label="Pauze (spatie)" title="Pauze (spatie)">${ICON.pause}</button>
        <button class="sn-icon sn-desk" id="snBtnSfx" type="button" aria-label="Geluid aan of uit (M)" title="Geluid aan/uit (M)" aria-pressed="false">${ICON.sfx}</button>
        <button class="sn-icon" id="snBtnClose" type="button" aria-label="Sneek sluiten" title="Sluiten" hidden>${ICON.close}</button>
      </div>
    </div>
  </header>

  <div class="sn-wordbar" id="snWordbar">
    <div class="sn-tiles idle" id="snTiles" aria-hidden="true">Bouw woorden, letter voor letter</div>
    <div class="sn-count" id="snCount" title="Woorden in deze ronde">${ICON.check}<span id="snCountN">0</span></div>
  </div>

  <main class="sn-stage" id="snStage">
    <div class="sn-board" id="snBoard">
      <canvas id="snGarden" aria-label="De zandtuin — speelveld"></canvas>
      <div class="sn-hint" id="snHint"><div class="sn-hint-t" id="snHintTxt"></div></div>
      <div class="sn-banner" id="snBanner" aria-hidden="true"><div class="sn-banner-k" id="snBannerK">2</div><div class="sn-banner-l" id="snBannerL">Niveau 2</div></div>
      <div class="sn-wordcard" id="snWordcard" aria-hidden="true"><div class="sn-wc-word" id="snWcWord"></div><div class="sn-wc-def" id="snWcDef"></div></div>
    </div>
  </main>

  <footer class="sn-foot" id="snFoot">
    <div class="sn-hints sn-kb"><span><kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd>&nbsp;sturen</span><span><kbd>Spatie</kbd>&nbsp;pauze</span></div>
    <div class="sn-hints sn-th">Veeg over het scherm of tik op de stenen</div>
    <div class="sn-pad" id="snPad">
      <button type="button" data-dir="up" aria-label="Omhoog">${ICON.up}</button>
      <button type="button" data-dir="left" aria-label="Links">${ICON.left}</button>
      <button type="button" data-dir="right" aria-label="Rechts">${ICON.right}</button>
      <button type="button" data-dir="down" aria-label="Omlaag">${ICON.down}</button>
    </div>
  </footer>
</div>

<div class="sn-sr" id="snLive" aria-live="polite"></div>

<!-- ============ MENU ============ -->
<div class="sn-overlay show" id="snMenu" role="dialog" aria-modal="true" aria-labelledby="snMenuTitle">
  <div class="sn-card">
    <button type="button" class="sn-menu-close" id="snMenuClose" aria-label="Terug naar de les" hidden>${ICON.close}<span aria-hidden="true">Terug</span></button>
    <div class="sn-hero">
      <canvas id="snEnsoBig" width="400" height="400" aria-hidden="true"></canvas>
      <h1 id="snMenuTitle">Sneek</h1>
    </div>
    <p class="sn-tagline">De woordentuin<small>letters · woorden · rust</small></p>
    <p class="sn-intro">Stuur de slang naar de juiste letter. Zo bouw je woorden uit je les.</p>
    <p class="sn-note" id="snSource"></p>
    <p class="sn-note" id="snGoldNote" hidden>Perfecte sessie! Je speelt deze keer met de <b>gouden slang</b>.</p>
    <p class="sn-note" id="snAdminText" hidden></p>
    <div class="sn-modes" id="snModes" role="radiogroup" aria-label="Kies een tuin">
      <button type="button" class="sn-mode" data-mode="rustig" role="radio" aria-checked="true">
        <span class="sn-mode-i">${ICON.calm}</span><span class="sn-mode-n">Rustig</span>
        <span class="sn-mode-d">Door de randen heen. <br>Geen stenen, rustig tempo.</span>
        <span class="sn-mode-b" data-best="rustig">Record 0</span>
      </button>
      <button type="button" class="sn-mode" data-mode="uitdaging" role="radio" aria-checked="false">
        <span class="sn-mode-i">${ICON.stones}</span><span class="sn-mode-n">Uitdaging</span>
        <span class="sn-mode-d">De rand is hard. <br>Elk niveau komt er een steen bij.</span>
        <span class="sn-mode-b" data-best="uitdaging">Record 0</span>
      </button>
    </div>
    <div class="sn-visit"><span id="snVisitTxt">3 rondes · 5 minuten speeltijd</span></div>
    <div class="sn-actions"><button type="button" class="sn-btn" id="snStart">Begin <kbd>Enter</kbd></button></div>
    <div class="sn-keys sn-kb"><span><kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd> of <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / <kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> sturen</span><span><kbd>Spatie</kbd> pauze</span></div>
    <div class="sn-keys sn-th"><span>Veeg over het scherm om te sturen, of tik op de stenen onder de tuin.</span></div>
  </div>
</div>

<!-- ============ PAUZE ============ -->
<div class="sn-overlay" id="snPauseOv" role="dialog" aria-modal="true" aria-labelledby="snPauseTitle">
  <div class="sn-card small">
    <div class="sn-over-k">Pauze</div>
    <h2 id="snPauseTitle">Even rust</h2>
    <p class="sn-sub">De tuin wacht op jou · je speeltijd staat stil</p>
    ${CRACK}
    <div class="sn-toggles" id="snSoundRow">
      <button type="button" class="sn-toggle" id="snTglSfx" aria-pressed="false"><i aria-hidden="true"></i>Zachte geluidjes</button>
    </div>
    <div class="sn-actions" style="margin-top:20px">
      <button type="button" class="sn-btn" id="snResume">Verder <kbd>Spatie</kbd></button>
      <button type="button" class="sn-btn ghost" id="snStopBtn">Stoppen</button>
    </div>
  </div>
</div>

<!-- ============ EINDE RONDE ============ -->
<div class="sn-overlay" id="snRoundOv" role="dialog" aria-modal="true" aria-labelledby="snRoundTitle">
  <div class="sn-card">
    <div class="sn-newbest" id="snRoundBest" aria-hidden="true"><b>Nieuw</b><small>record</small></div>
    <span class="sn-badge" id="snRoundBadge">Ronde 1 van 3</span>
    <h2 id="snRoundTitle">Tegen de rand</h2>
    <p class="sn-sub" id="snRoundSub"></p>
    ${CRACK}
    <div class="sn-statgrid">
      <div><span>Score</span><b id="snRScore">0</b></div>
      <div><span>Record</span><b id="snRBest">0</b></div>
      <div><span>Woorden</span><b id="snRWords">0</b></div>
      <div><span>Tijd</span><b id="snRTime">0:00</b></div>
    </div>
    <p class="sn-words-h" id="snRWordsH">Jouw woorden</p>
    <ul class="sn-words" id="snRList"></ul>
    <p class="sn-empty" id="snREmpty" hidden>Nog geen volledig woord. Probeer het in de volgende ronde!</p>
    <div class="sn-actions">
      <button type="button" class="sn-btn" id="snNext">Volgende ronde <kbd>Enter</kbd></button>
      <button type="button" class="sn-btn ghost" id="snEndVisit">Stoppen</button>
    </div>
  </div>
</div>

<!-- ============ EINDE BEZOEK ============ -->
<div class="sn-overlay" id="snDoneOv" role="dialog" aria-modal="true" aria-labelledby="snDoneTitle">
  <div class="sn-card">
    <div class="sn-newbest" id="snDoneBest" aria-hidden="true"><b>Nieuw</b><small>record</small></div>
    <div class="sn-hero" style="width:120px;height:120px;margin-bottom:-6px"><canvas id="snEnsoDone" width="260" height="260" aria-hidden="true"></canvas></div>
    <h2 id="snDoneTitle">Tuinbezoek klaar</h2>
    <p class="sn-sub" id="snDoneSub"></p>
    <div class="sn-statgrid">
      <div><span>Beste ronde</span><b id="snDBest">0</b></div>
      <div><span>Record</span><b id="snDRecord">0</b></div>
      <div><span>Woorden</span><b id="snDWords">0</b></div>
      <div><span>Letters</span><b id="snDLetters">0</b></div>
    </div>
    <p class="sn-words-h" id="snDWordsH">Woorden die je bouwde</p>
    <ul class="sn-words" id="snDList"></ul>
    <p class="sn-empty" id="snDEmpty" hidden>Deze keer geen volledig woord. Volgende keer beter!</p>
    <div class="sn-actions">
      <button type="button" class="sn-btn" id="snDoneBtn">Terug naar de les <kbd>Enter</kbd></button>
    </div>
    <p class="sn-foot-note" id="snEarnHint"></p>
  </div>
</div>

<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
  <filter id="snRough" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" xChannelSelector="R" yChannelSelector="G"/></filter>
  <filter id="snDeckle" x="-4%" y="-4%" width="108%" height="108%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="12" xChannelSelector="R" yChannelSelector="G"/></filter>
  <filter id="snBrush" x="-8%" y="-25%" width="116%" height="150%"><feTurbulence type="fractalNoise" baseFrequency="0.035 0.22" numOctaves="3" seed="2" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G"/></filter>
</svg>
`;
