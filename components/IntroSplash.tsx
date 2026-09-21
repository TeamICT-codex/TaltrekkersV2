import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Animatie-intro ("splash") bij het openen van de app: het woord "talent" wordt
 * getypt in een Frayer-model, de vier kaartjes komen op en keren terug in het
 * woord, waarna "talent" kruisvervaagt naar de merknaam "TALent voor Taal 🎯".
 *
 * Eén keer per browsersessie (sessionStorage), enkel op het welkomstscherm.
 */

const INTRO_SEEN_KEY = 'taltrekkers_intro_seen';

// Tijdlijn in ms. 1 woord · 2 kaartjes ontstaan (gespreid) · 3 kaartjes keren terug · 4 merknaam · 5 landen
const TIMELINE: ReadonlyArray<readonly [number, number]> = [[30, 1], [950, 2], [2800, 3], [3350, 4], [4200, 5]];
const END = 4700;                          // start van het landen/vervagen
const FADE = 700;                          // duur daarvan
const TYPE_START = 180;                    // eerste letter van "talent" na 180 ms...
const TYPE_STEP = 110;                     // ...daarna elke 110 ms één letter

/** Heeft deze browsersessie de intro al gehad? Storage kan geblokkeerd zijn. */
const introAlGezien = (): boolean => {
    try {
        return sessionStorage.getItem(INTRO_SEEN_KEY) === '1';
    } catch {
        return false;
    }
};

/* Alle klassen hebben een `tvt-intro-`-prefix zodat niets botst met Tailwind of
   bestaande styles. Kleuren komen uit de themavariabelen in index.html, zodat de
   intro het gekozen thema van de leerling volgt (Standaard / Hoog contrast /
   Nachtmodus / Kleurvriendelijk). */
const INTRO_CSS = `
.tvt-intro-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

.tvt-intro-splash {
    --tvt-intro-ease-out: cubic-bezier(.22, 1, .36, 1);
    --tvt-intro-ease-in-out: cubic-bezier(.65, 0, .35, 1);
    position: fixed; inset: 0; z-index: 50; background: var(--color-background); overflow: hidden;
    display: grid; place-items: center; padding-inline: 16px; cursor: pointer;
    font-size: 16px; line-height: 1.5; color: var(--color-text-primary);
    transition: opacity .45s ease .25s;
}
/* zachte gloed in de twee huiskleuren, drijft heel traag */
.tvt-intro-splash::before {
    content: ''; position: absolute; inset: -10%;
    background: transparent;
    background:
        radial-gradient(55% 45% at 48% 44%, color-mix(in srgb, var(--color-primary) 16%, transparent), transparent 70%),
        radial-gradient(40% 35% at 60% 58%, color-mix(in srgb, var(--color-brand) 9%, transparent), transparent 70%);
    animation: tvt-intro-glow 7s ease-in-out infinite alternate;
    transition: opacity .4s ease;
}
@keyframes tvt-intro-glow { from { transform: scale(1) translateY(0); } to { transform: scale(1.06) translateY(-1.5%); } }
.tvt-intro-splash.tvt-intro-out { opacity: 0; pointer-events: none; }
.tvt-intro-splash.tvt-intro-out::before { opacity: 0; }

.tvt-intro-frayer {
    position: relative; display: grid; grid-template-columns: repeat(2, minmax(0, 250px)); grid-template-rows: auto auto auto;
    gap: 14px 18px; justify-content: center; align-items: center; width: 100%; max-width: 640px;
}
/* kaartjes: ontstaan vanuit het woord, drijven zacht, keren erin terug */
.tvt-intro-fc {
    opacity: 0; transform: translate(var(--tvt-intro-tx), var(--tvt-intro-ty)) scale(.5); filter: blur(10px);
    transition:
        transform .8s var(--tvt-intro-ease-out),
        opacity .6s ease,
        filter .6s ease;
    transition-delay: calc(var(--tvt-intro-i) * .17s);
}
.tvt-intro-fc.tvt-intro-c1 { grid-area: 1 / 1; --tvt-intro-i: 0; --tvt-intro-tx: 45%;  --tvt-intro-ty: 75%; }
.tvt-intro-fc.tvt-intro-c2 { grid-area: 1 / 2; --tvt-intro-i: 1; --tvt-intro-tx: -45%; --tvt-intro-ty: 75%; }
.tvt-intro-fc.tvt-intro-c3 { grid-area: 3 / 1; --tvt-intro-i: 2; --tvt-intro-tx: 45%;  --tvt-intro-ty: -75%; }
.tvt-intro-fc.tvt-intro-c4 { grid-area: 3 / 2; --tvt-intro-i: 3; --tvt-intro-tx: -45%; --tvt-intro-ty: -75%; }
.tvt-intro-fc-in {
    background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; padding: 12px 14px; min-height: 64px; text-align: left;
    box-shadow: 0 10px 24px rgba(51, 65, 85, .07);
    animation: tvt-intro-float 3.4s ease-in-out infinite alternate; animation-delay: calc(var(--tvt-intro-i) * -.9s);
}
@keyframes tvt-intro-float { from { transform: translateY(2px); } to { transform: translateY(-3px); } }
.tvt-intro-fc .tvt-intro-lbl { display: flex; align-items: center; gap: 6px; font-size: 10.5px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--color-text-secondary); margin-bottom: 4px; }
.tvt-intro-fc .tvt-intro-lbl::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--tvt-intro-dot); }
.tvt-intro-fc.tvt-intro-c1 { --tvt-intro-dot: var(--color-brand); }
.tvt-intro-fc.tvt-intro-c2 { --tvt-intro-dot: var(--color-primary); }
.tvt-intro-fc.tvt-intro-c3 { --tvt-intro-dot: var(--color-secondary); }
.tvt-intro-fc.tvt-intro-c4 { --tvt-intro-dot: var(--color-border); }
.tvt-intro-fc .tvt-intro-val { font-size: clamp(13px, 1.5vw, 15px); font-weight: 500; color: var(--color-text-primary); line-height: 1.35; }

.tvt-intro-word-wrap { grid-area: 2 / 1 / 3 / 3; text-align: center; padding-block: 6px; transition: transform .7s var(--tvt-intro-ease-in-out), opacity .5s ease .2s; }
.tvt-intro-word {
    font-weight: 800; font-size: clamp(2.3rem, 7vw, 5rem); line-height: 1.05; letter-spacing: -.02em; color: var(--color-text-primary); white-space: nowrap;
    opacity: 0; transition: opacity .25s ease;
}
/* "talent" wordt letter voor letter getypt: elke letter wacht onzichtbaar op zijn plek (zo blijft het
   woord gecentreerd) en wordt door het script vrijgegeven; een cursor in de huiskleur loopt mee. */
.tvt-intro-lo i { font-style: normal; clip-path: inset(0 100% 0 0); }
.tvt-intro-lo i.tvt-intro-on { clip-path: inset(0); }
.tvt-intro-caret { position: absolute; left: 0; top: .1em; width: .06em; height: .88em; border-radius: 2px; background: var(--color-brand); opacity: 0; transition: opacity .3s ease; }
.tvt-intro-splash.tvt-intro-s1 .tvt-intro-caret { opacity: 1; animation: tvt-intro-blink .9s steps(2, start) infinite; }
.tvt-intro-splash.tvt-intro-s2 .tvt-intro-caret { opacity: 0; animation: none; }
@keyframes tvt-intro-blink { to { opacity: 0; } }
/* "talent" staat als één woord in de tekststroom. "TALent" ligt er onzichtbaar bovenop en
   kruisvervaagt bij de overgang; het script animeert dan de breedte van .core mee, zodat het
   woord nooit uit elkaar staat. TAL komt bij die overgang heel even los van "ent". */
.tvt-intro-core { display: inline-block; position: relative; white-space: nowrap; transition: width 1s var(--tvt-intro-ease-out); }
.tvt-intro-core .tvt-intro-lo { transition: opacity 1s ease; }
.tvt-intro-core .tvt-intro-up { position: absolute; left: 0; top: 0; opacity: 0; white-space: nowrap; transition: opacity 1s ease; }
.tvt-intro-core .tvt-intro-cap { display: inline-block; color: var(--color-brand); transition: color 1.1s ease, margin-right .7s var(--tvt-intro-ease-out); }
/* "voor Taal": groeit zacht open; clip-path knipt zonder de basislijn te verstoren */
.tvt-intro-rest { display: inline-block; max-width: 0; clip-path: inset(0); opacity: 0; white-space: nowrap; transition: max-width 1s var(--tvt-intro-ease-out), opacity .7s ease .2s; }
.tvt-intro-mark { display: inline-block; transform: scale(0); margin-left: .18em; }
.tvt-intro-tagline { margin: 10px 0 0; color: var(--color-text-secondary); font-size: clamp(14px, 1.7vw, 17px); font-weight: 500; opacity: 0; transform: translateY(8px); transition: opacity .6s ease .45s, transform .6s var(--tvt-intro-ease-out) .45s; }

/* fases: s1 woord · s2 kaartjes ontstaan · s3 kaartjes keren terug · s4 merknaam · s5 landen */
.tvt-intro-splash.tvt-intro-s1 .tvt-intro-word { opacity: 1; }
.tvt-intro-splash.tvt-intro-s2 .tvt-intro-fc { opacity: 1; transform: none; filter: none; }
.tvt-intro-splash.tvt-intro-s3 .tvt-intro-fc { opacity: 0; transform: translate(var(--tvt-intro-tx), var(--tvt-intro-ty)) scale(.55); filter: blur(8px); transition-duration: .62s; transition-timing-function: var(--tvt-intro-ease-in-out); transition-delay: calc((3 - var(--tvt-intro-i)) * .06s); }
.tvt-intro-splash.tvt-intro-s3 .tvt-intro-word { animation: tvt-intro-pulse .7s var(--tvt-intro-ease-out) .45s 1; }
@keyframes tvt-intro-pulse { 0% { transform: scale(1); } 40% { transform: scale(1.045); } 100% { transform: scale(1); } }
.tvt-intro-splash.tvt-intro-s4 .tvt-intro-core .tvt-intro-lo { opacity: 0; }
.tvt-intro-splash.tvt-intro-s4 .tvt-intro-core .tvt-intro-up { opacity: 1; }
.tvt-intro-splash.tvt-intro-s4 .tvt-intro-core .tvt-intro-cap { margin-right: .07em; }   /* TAL komt heel even los van "ent" */
.tvt-intro-splash.tvt-intro-s4 .tvt-intro-rest { max-width: 9em; opacity: 1; }
.tvt-intro-splash.tvt-intro-s4 .tvt-intro-tagline { opacity: 1; transform: none; }
.tvt-intro-splash.tvt-intro-s5 .tvt-intro-core .tvt-intro-cap { color: var(--color-text-primary); margin-right: 0; }   /* ...en sluit weer aan bij het landen */
.tvt-intro-splash.tvt-intro-s5 .tvt-intro-mark { animation: tvt-intro-spring .6s cubic-bezier(.34, 1.3, .64, 1) forwards; }
@keyframes tvt-intro-spring { from { transform: scale(0) rotate(-10deg); } to { transform: scale(1) rotate(0); } }
/* het landen: het woord krimpt en schuift omhoog naar waar de welkomstkop staat */
.tvt-intro-splash.tvt-intro-out .tvt-intro-word-wrap { transform: translateY(-21vh) scale(.58); opacity: 0; }

.tvt-intro-no-anim, .tvt-intro-no-anim * { transition: none !important; animation: none !important; }
.tvt-intro-no-anim .tvt-intro-mark { transform: none; }
.tvt-intro-no-anim .tvt-intro-lo i { clip-path: inset(0); }
.tvt-intro-no-anim .tvt-intro-caret { display: none; }

@media (max-width: 440px) {
    .tvt-intro-word { white-space: normal; }
    .tvt-intro-frayer { gap: 10px; }
    .tvt-intro-fc-in { padding: 10px 11px; min-height: 58px; }
}
`;

interface IntroSplashProps {
    /** Wordt aangeroepen zodra de intro volledig weg is (na de fade). */
    onDone?: () => void;
}

const IntroSplash: React.FC<IntroSplashProps> = ({ onDone }) => {
    // Al gezien deze sessie? Dan meteen null renderen — geen flits.
    const [gone, setGone] = useState<boolean>(() => introAlGezien());

    const rootRef = useRef<HTMLDivElement>(null);
    const coreRef = useRef<HTMLSpanElement>(null);
    const loRef = useRef<HTMLSpanElement>(null);
    const upRef = useRef<HTMLSpanElement>(null);
    const caretRef = useRef<HTMLSpanElement>(null);

    // onDone via een ref: het animatie-effect draait maar één keer en mag niet
    // herstarten wanneer de ouder een nieuwe functie doorgeeft.
    const onDoneRef = useRef<(() => void) | undefined>(onDone);
    useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

    // Dit is animatiecode: bewust imperatief via refs (klassen en breedtes direct
    // op de DOM zetten), net als in het goedgekeurde prototype. React rendert de
    // splash maar één keer, dus er is geen conflict met de virtuele DOM.
    useEffect(() => {
        const root = rootRef.current;
        const core = coreRef.current;
        const lo = loRef.current;
        const up = upRef.current;
        const caret = caretRef.current;
        // Geen DOM = intro deze sessie al gezien; niets te doen.
        if (!root || !core || !lo || !up || !caret) return;

        // Vanaf hier loopt de intro echt: markeer de sessie.
        try { sessionStorage.setItem(INTRO_SEEN_KEY, '1'); } catch { /* storage geblokkeerd */ }

        const letters: HTMLElement[] = Array.from(lo.querySelectorAll<HTMLElement>('i'));

        let reduceMotion = false;
        try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* geen matchMedia */ }

        let timers: number[] = [];
        let finished = false;

        const clearTimers = (): void => { timers.forEach(t => window.clearTimeout(t)); timers = []; };
        const at = (ms: number, fn: () => void): void => { timers.push(window.setTimeout(fn, ms)); };

        const typeLetter = (i: number): void => {
            const letter = letters[i];
            if (!letter) return;
            letter.classList.add('tvt-intro-on');
            // cursor achter de zojuist getypte letter zetten
            caret.style.left = `${letter.getBoundingClientRect().right - core.getBoundingClientRect().left}px`;
        };
        const showAllLetters = (): void => { letters.forEach(l => l.classList.add('tvt-intro-on')); };

        const stage = (n: number): void => {
            let cls = 'tvt-intro-splash';
            for (let i = 1; i <= n; i++) cls += ` tvt-intro-s${i}`;
            if (reduceMotion) cls += ' tvt-intro-no-anim';
            // Breedte van "talent" -> "TALent" mee-animeren. Van een px-waarde naar een px-waarde,
            // want vanaf "auto" animeert een browser niet.
            if (n >= 4) {
                if (!core.style.width) {
                    core.style.width = `${lo.getBoundingClientRect().width}px`;
                    void core.offsetWidth; // reflow forceren zodat de overgang hiervandaan vertrekt
                    core.style.width = `${up.getBoundingClientRect().width}px`;
                }
            } else {
                core.style.width = '';
            }
            root.className = cls;
        };

        const finish = (): void => {
            if (finished) return;
            finished = true;
            clearTimers();
            showAllLetters();   // ook bij overslaan midden in het typen staat het woord er volledig
            stage(5);
            root.classList.add('tvt-intro-out');
            at(FADE, () => { setGone(true); onDoneRef.current?.(); });
        };

        // ── Vangnetten: de intro mag de loginpagina nooit blijven blokkeren ──
        const onVisibility = (): void => { if (document.hidden) finish(); };
        const onKeyDown = (e: KeyboardEvent): void => { if (e.key !== 'Tab') finish(); };
        document.addEventListener('visibilitychange', onVisibility);
        document.addEventListener('keydown', onKeyDown);
        root.addEventListener('click', finish);

        const play = (): void => {
            // Tabblad niet in beeld? Dan heeft een intro geen zin.
            if (document.hidden) { finish(); return; }
            // Minder beweging gevraagd? Toon meteen het eindbeeld.
            if (reduceMotion) { showAllLetters(); stage(5); at(1100, finish); return; }
            stage(0);
            // Bewust géén requestAnimationFrame: in een verborgen tabblad vuurt dat nooit en bleef de intro eeuwig staan.
            TIMELINE.forEach(([ms, n]) => at(ms, () => stage(n)));
            letters.forEach((_, i) => at(TYPE_START + i * TYPE_STEP, () => typeLetter(i)));
            at(END, finish);
            at(END + 1500, finish); // hard vangnet
        };
        play();

        return () => {
            clearTimers();
            document.removeEventListener('visibilitychange', onVisibility);
            document.removeEventListener('keydown', onKeyDown);
            root.removeEventListener('click', finish);
        };
    }, []);

    if (gone) return null;

    // Via een portal naar document.body: de wrapper van WelcomeScreen houdt na zijn
    // fade-in-animatie een transform, en die zou van `position: fixed` een box binnen
    // die ouder maken — dan blijft de sticky header (z-40) boven de overlay staan.
    return createPortal(
        <>
            <style>{INTRO_CSS}</style>
            <div className="tvt-intro-splash" ref={rootRef} role="status" aria-live="polite" title="Klik om over te slaan">
                <span className="tvt-intro-sr-only">TALent voor Taal. Schooltaal leren, woord voor woord.</span>
                <div className="tvt-intro-frayer" aria-hidden="true">
                    <div className="tvt-intro-fc tvt-intro-c1"><div className="tvt-intro-fc-in"><span className="tvt-intro-lbl">Definitie</span><div className="tvt-intro-val">een natuurlijke aanleg om iets goed te kunnen</div></div></div>
                    <div className="tvt-intro-fc tvt-intro-c2"><div className="tvt-intro-fc-in"><span className="tvt-intro-lbl">Voorbeeld</span><div className="tvt-intro-val">Ze heeft talent voor talen.</div></div></div>
                    <div className="tvt-intro-word-wrap">
                        <div className="tvt-intro-word">
                            <span className="tvt-intro-core" ref={coreRef}>
                                <span className="tvt-intro-lo" ref={loRef}><i>t</i><i>a</i><i>l</i><i>e</i><i>n</i><i>t</i></span>
                                <span className="tvt-intro-up" ref={upRef} aria-hidden="true"><span className="tvt-intro-cap">TAL</span>ent</span>
                                <span className="tvt-intro-caret" ref={caretRef} aria-hidden="true" />
                            </span>
                            <span className="tvt-intro-rest">&nbsp;voor Taal</span>
                            <span className="tvt-intro-mark">🎯</span>
                        </div>
                        <p className="tvt-intro-tagline">schooltaal leren, woord voor woord</p>
                    </div>
                    <div className="tvt-intro-fc tvt-intro-c3"><div className="tvt-intro-fc-in"><span className="tvt-intro-lbl">Synoniem</span><div className="tvt-intro-val">aanleg, gave</div></div></div>
                    <div className="tvt-intro-fc tvt-intro-c4"><div className="tvt-intro-fc-in"><span className="tvt-intro-lbl">Tegenstelling</span><div className="tvt-intro-val">onvermogen</div></div></div>
                </div>
            </div>
        </>,
        document.body,
    );
};

export default IntroSplash;
