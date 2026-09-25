// Opent Sneek (sneek.html) in een overlay bovenop de app en praat ermee via postMessage.
//
// Belangrijk voor de beloning:
//   • het token wordt pas afgetrokken bij 'hlc-reward-started' (de leerling begint echt);
//     openen, kijken en weer sluiten kost niets; laadt het spel niet, dan ook niets;
//   • een klik naast het spel sluit NIETS (vroeger: token weg na een misklik);
//   • nooit twee overlays tegelijk;
//   • berichten enkel van/naar de eigen origin.

import type { SneekLaunchData } from './launchData';

export interface SneekResult {
    gameMode: 'rustig' | 'uitdaging';
    score: number;
    words: string[];
}

export interface OpenSneekOptions {
    launch: SneekLaunchData;
    theme?: string;
    text?: string;
    earnHint: string;
    rounds: number;
    visitSeconds: number;
    /** De leerling start het tuinbezoek → token aftrekken. Wordt maximaal één keer aangeroepen. */
    onStarted: () => void;
    onComplete?: (result: SneekResult) => void;
    onClose?: () => void;
    pageUrl?: string;
    /** Hoe lang wachten op het spel voor we een foutmelding tonen. */
    loadTimeoutMs?: number;
}

export interface SneekHandle {
    close: () => void;
    readonly started: boolean;
}

const SESSION_PREFIX = 'hlc-reward-session-';
const STYLE_ID = 'snk-host-style';
const FORWARD_KEYS = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'w', 'a', 's', 'd', 'z', 'q', 'p', 'm', 'W', 'A', 'S', 'D', 'Z', 'Q', 'P', 'M',
    ' ', 'Enter', 'Escape',
]);

let active: SneekHandle | null = null;

export function isSneekOpen(): boolean {
    return active !== null;
}

function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
.snk-root{position:fixed;inset:0;z-index:9999;
  background:radial-gradient(circle at 50% 30%,rgba(45,122,123,.55) 0%,rgba(15,23,42,.82) 100%);
  -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);animation:snk-in .25s ease-out}
/* Maten t.o.v. de overlay zelf (niet 100vw/100vh): zo past het spel ook als de
   pagina eronder breder is dan het scherm of de adresbalk van een gsm in- en uitschuift. */
.snk-shell{position:absolute;inset:0;margin:auto;width:min(1180px,calc(100% - 32px));height:min(820px,calc(100% - 32px));
  border-radius:22px;overflow:hidden;background:#eee7da;box-shadow:0 30px 90px rgba(0,0,0,.45)}
.snk-shell iframe{display:block;width:100%;height:100%;border:0;background:#eee7da}
.snk-layer{position:absolute;inset:0;display:grid;place-items:center;align-content:center;gap:14px;padding:24px;text-align:center;
  background:#eee7da;color:#211d1a;font:500 16px/1.5 Poppins,'Segoe UI',system-ui,sans-serif}
.snk-layer[hidden]{display:none}
.snk-layer b{font:italic 600 30px/1.1 'Cormorant Garamond',Georgia,serif}
.snk-spin{width:34px;height:34px;border-radius:50%;border:3px solid rgba(33,29,26,.15);border-top-color:#2d7a7b;animation:snk-rot 1s linear infinite}
.snk-close{position:absolute;top:12px;right:12px;z-index:3;border:1px solid rgba(33,29,26,.2);background:rgba(248,244,236,.95);color:#211d1a;
  padding:8px 14px;border-radius:999px;cursor:pointer;font:600 14px/1 Poppins,'Segoe UI',system-ui,sans-serif}
.snk-close:focus-visible,.snk-btn:focus-visible{outline:3px solid #2d7a7b;outline-offset:2px}
.snk-close[hidden]{display:none}
.snk-btn{border:0;background:#211d1a;color:#f8f4ec;padding:11px 22px;border-radius:999px;cursor:pointer;font:600 15px/1 Poppins,'Segoe UI',system-ui,sans-serif}
@media (max-width:700px),(max-height:520px){.snk-shell{width:100%;height:100%;border-radius:0;box-shadow:none}}
@media (prefers-reduced-motion:reduce){.snk-root{animation:none}.snk-spin{animation-duration:3s}}
@keyframes snk-in{from{opacity:0}to{opacity:1}}
@keyframes snk-rot{to{transform:rotate(360deg)}}`;
    document.head.appendChild(st);
}

export function openSneek(opts: OpenSneekOptions): SneekHandle | null {
    if (active) return active;
    ensureStyle();

    const sessionId = `snk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const config = {
        theme: opts.theme,
        text: opts.text,
        words: opts.launch.words,
        goldSnake: opts.launch.goldSnake,
        best: opts.launch.best,
        rounds: opts.rounds,
        visitSeconds: opts.visitSeconds,
        earnHint: opts.earnHint,
    };
    try {
        sessionStorage.setItem(SESSION_PREFIX + sessionId, JSON.stringify(config));
    } catch {
        /* geen sessionStorage: het spel krijgt de config ook via postMessage */
    }

    const root = document.createElement('div');
    root.className = 'snk-root';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Sneek, de woordentuin');

    const shell = document.createElement('div');
    shell.className = 'snk-shell';

    const iframe = document.createElement('iframe');
    const url = new URL(opts.pageUrl ?? '/sneek.html', window.location.origin);
    url.searchParams.set('embed', '1');
    url.searchParams.set('rewardSession', sessionId);
    iframe.src = url.toString();
    iframe.title = 'Sneek, de woordentuin';
    iframe.allow = 'fullscreen';
    iframe.tabIndex = 0;

    const loading = document.createElement('div');
    loading.className = 'snk-layer';
    const spin = document.createElement('div');
    spin.className = 'snk-spin';
    const loadingTxt = document.createElement('div');
    loadingTxt.textContent = 'De woordentuin wordt geladen…';
    loading.append(spin, loadingTxt);

    const failed = document.createElement('div');
    failed.className = 'snk-layer';
    failed.hidden = true;
    const failTitle = document.createElement('b');
    failTitle.textContent = 'Sneek kon niet laden';
    const failTxt = document.createElement('div');
    failTxt.textContent = 'Controleer je internetverbinding en probeer het later opnieuw. Je token is niet gebruikt.';
    const failBtn = document.createElement('button');
    failBtn.type = 'button';
    failBtn.className = 'snk-btn';
    failBtn.textContent = 'Sluiten';
    failed.append(failTitle, failTxt, failBtn);

    // Vangnet tot het spel zijn eigen sluitknop toont.
    const hostClose = document.createElement('button');
    hostClose.type = 'button';
    hostClose.className = 'snk-close';
    hostClose.textContent = 'Sluiten';

    shell.append(iframe, loading, failed, hostClose);
    root.appendChild(shell);
    document.body.appendChild(root);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // position:fixed volgt de layout-viewport. Is de pagina eronder breder dan het
    // scherm (of heeft de leerling ingezoomd), dan valt die groter uit dan wat je
    // ziet en schuift het spel deels buiten beeld. Daarom leggen we de overlay
    // precies over het zichtbare deel (visualViewport).
    const vv = window.visualViewport;
    const fitToVisible = () => {
        if (!vv) return;
        root.style.inset = 'auto';
        root.style.left = `${vv.offsetLeft}px`;
        root.style.top = `${vv.offsetTop}px`;
        root.style.width = `${vv.width}px`;
        root.style.height = `${vv.height}px`;
    };
    fitToVisible();
    vv?.addEventListener('resize', fitToVisible);
    vv?.addEventListener('scroll', fitToVisible);

    let started = false;
    let ready = false;
    let closed = false;
    let hardCapTimer = 0;

    const focusGame = () => {
        try {
            iframe.focus();
            iframe.contentWindow?.focus();
        } catch {
            /* niet kritisch */
        }
    };

    const post = (msg: unknown) => {
        try {
            iframe.contentWindow?.postMessage(msg, window.location.origin);
        } catch {
            /* iframe weg */
        }
    };

    const showFailure = () => {
        if (ready || closed) return;
        loading.hidden = true;
        failed.hidden = false;
        failBtn.focus();
    };
    const loadTimer = window.setTimeout(showFailure, opts.loadTimeoutMs ?? 15000);

    const onMessage = (e: MessageEvent) => {
        if (e.source !== iframe.contentWindow || e.origin !== window.location.origin) return;
        const data = e.data as { type?: unknown } & Record<string, unknown>;
        if (!data || typeof data.type !== 'string') return;
        switch (data.type) {
            case 'hlc-reward-ready':
                if (ready) return;
                ready = true;
                window.clearTimeout(loadTimer);
                loading.hidden = true;
                failed.hidden = true;
                hostClose.hidden = true; // het spel toont nu zelf een sluitknop
                post({ type: 'hlc-reward-config', payload: config });
                focusGame();
                break;
            case 'hlc-reward-started':
                if (started) return;
                started = true;
                opts.onStarted();
                // Vangnet: het spel stopt zelf na de speeltijd; deze grens vangt enkel
                // een vastgelopen of weggeklikt venster op.
                hardCapTimer = window.setTimeout(close, (opts.visitSeconds + 15 * 60) * 1000);
                break;
            case 'hlc-reward-complete': {
                const gameMode = data.gameMode === 'uitdaging' ? 'uitdaging' : 'rustig';
                const score = typeof data.score === 'number' && Number.isFinite(data.score) ? Math.max(0, Math.round(data.score)) : 0;
                const words = Array.isArray(data.words) ? data.words.filter((w): w is string => typeof w === 'string').slice(0, 60) : [];
                opts.onComplete?.({ gameMode, score, words });
                break;
            }
            case 'hlc-reward-close':
                close();
                break;
        }
    };

    // Heeft de app (niet de iframe) de focus, stuur dan stuurtoetsen door naar het spel.
    const forwardKey = (e: KeyboardEvent) => {
        if (closed || !ready || !FORWARD_KEYS.has(e.key)) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const t = e.target as HTMLElement | null;
        if (t && t !== document.body && t.closest && t.closest('input, textarea, select, [contenteditable="true"]')) return;
        const inner = iframe.contentWindow as (Window & typeof globalThis) | null;
        if (!inner) return;
        e.preventDefault();
        try {
            inner.dispatchEvent(new inner.KeyboardEvent('keydown', { key: e.key, code: e.code, bubbles: true }));
        } catch {
            /* niet kritisch */
        }
        focusGame();
    };

    const onFailKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && (!ready || !failed.hidden)) close();
    };

    function close() {
        if (closed) return;
        closed = true;
        window.clearTimeout(loadTimer);
        window.clearTimeout(hardCapTimer);
        window.removeEventListener('message', onMessage);
        window.removeEventListener('keydown', forwardKey);
        window.removeEventListener('keydown', onFailKey);
        vv?.removeEventListener('resize', fitToVisible);
        vv?.removeEventListener('scroll', fitToVisible);
        try {
            sessionStorage.removeItem(SESSION_PREFIX + sessionId);
        } catch {
            /* */
        }
        root.remove();
        document.body.style.overflow = prevOverflow;
        active = null;
        opts.onClose?.();
    }

    window.addEventListener('message', onMessage);
    window.addEventListener('keydown', forwardKey);
    window.addEventListener('keydown', onFailKey);
    hostClose.addEventListener('click', close);
    failBtn.addEventListener('click', close);
    shell.addEventListener('mousedown', e => {
        if (e.target === hostClose || failed.contains(e.target as Node)) return;
        if (ready) focusGame();
    });
    // Bewust GEEN sluiten bij klikken naast het spel.

    const handle: SneekHandle = {
        close,
        get started() {
            return started;
        },
    };
    active = handle;
    return handle;
}
