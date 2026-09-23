// Ingang voor het losse prototype: het spel + een proefpaneel om scenario's te
// bekijken (woorden uit een sessie, gouden slang, thema, spaarstand, tijd).
// Dit bestand zit NIET in de app-build (sneek.html laadt entry.ts).

import { bootSneek } from './main';
import type { SneekConfig, ThemeName } from './protocol';
import { sanitizeWords, type WordInput } from './words';

const SETS: Record<string, { label: string; words: WordInput[] }> = {
  biologie: {
    label: 'Na een sessie Biologie (3 fout)',
    words: [
      { word: 'fotosynthese', definition: 'Planten maken suiker uit licht, water en koolstofdioxide.', priority: true },
      { word: 'chlorofyl', definition: 'De groene stof in bladeren die licht opvangt.', priority: true },
      { word: 'ecosysteem', definition: 'Alle planten, dieren en hun omgeving samen.', priority: true },
      { word: 'cel', definition: 'Het kleinste levende bouwsteentje van een organisme.' },
      { word: 'organisme', definition: 'Een levend wezen, zoals een plant, een dier of een mens.' },
      { word: 'voedselketen', definition: 'Wie eet wie: van plant tot roofdier.' },
      { word: 'ademhaling', definition: 'Zuurstof opnemen en koolstofdioxide afgeven.' },
      { word: 'celkern', definition: 'Het deel van de cel met het erfelijk materiaal.' },
      { word: 'orgaan', definition: 'Een deel van het lichaam met een eigen taak, zoals het hart.' },
      { word: 'bloedvat', definition: 'Een buis waardoor bloed door het lichaam stroomt.' },
      { word: 'zuurstof', definition: 'Een gas in de lucht dat we nodig hebben om te leven.' },
    ],
  },
  wiskunde: {
    label: 'Na een sessie Wiskunde (2 fout)',
    words: [
      { word: 'noemer', definition: 'Het getal onder de breukstreep.', priority: true },
      { word: 'gemiddelde', definition: 'Alle getallen optellen en delen door het aantal.', priority: true },
      { word: 'teller', definition: 'Het getal boven de breukstreep.' },
      { word: 'breuk', definition: 'Een deel van een geheel, zoals drie vierde.' },
      { word: 'procent', definition: 'Een deel van honderd.' },
      { word: 'omtrek', definition: 'De lengte rond een figuur.' },
      { word: 'oppervlakte', definition: 'Hoeveel ruimte een vlak inneemt.' },
      { word: 'vergelijking', definition: 'Een som met een onbekende en een isgelijkteken.' },
      { word: 'diagram', definition: 'Een tekening die cijfers duidelijk toont.' },
    ],
  },
  geen: { label: 'Zonder sessie (algemene schooltaal)', words: [] },
  eigen: { label: 'Eigen woorden…', words: [] },
};

const THEMES: { id: ThemeName; label: string }[] = [
  { id: 'aurora', label: 'TALent-teal' },
  { id: 'ember', label: 'Vermiljoen' },
  { id: 'forest', label: 'Mos' },
  { id: 'midnight', label: 'Indigo' },
  { id: 'sunrise', label: 'Bloesem' },
];

function parseOwn(text: string): WordInput[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const priority = line.startsWith('*');
    const clean = priority ? line.slice(1).trim() : line;
    const [word, ...rest] = clean.split(/\s[-–:]\s/);
    return { word: word.trim(), definition: rest.join(' - ').trim(), priority };
  });
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, kids: (Node | string)[] = []) {
  const n = document.createElement(tag);
  Object.assign(n, props);
  for (const k of kids) n.append(k);
  return n;
}

const api = bootSneek({ config: { words: sanitizeWords(SETS.biologie.words) } });

if (!api.embedded) {
  const toggle = h('button', { type: 'button', className: 'sn-demo-toggle', textContent: 'Proefinstellingen' });
  toggle.setAttribute('aria-expanded', 'false');
  const panel = h('div', { className: 'sn-demo', hidden: true });
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'Proefinstellingen');

  const setSel = h('select', { id: 'snDemoSet' });
  for (const [id, s] of Object.entries(SETS)) setSel.append(h('option', { value: id, textContent: s.label }));
  const own = h('textarea', { id: 'snDemoOwn', hidden: true });
  own.value = '*hypothese - Een idee dat je nog moet testen.\nconclusie - Wat je besluit aan het einde.\nanalyseren - Iets goed bekijken en uitleggen.\nbron - De plek waar informatie vandaan komt.';
  const ownHelp = h('p', { hidden: true, textContent: 'Eén woord per regel: woord - uitleg. Zet een * vooraan voor een woord dat fout was.' });
  const themeSel = h('select', { id: 'snDemoTheme' });
  for (const t of THEMES) themeSel.append(h('option', { value: t.id, textContent: t.label }));
  const rounds = h('select', { id: 'snDemoRounds' });
  for (const n of [1, 2, 3, 4, 5]) rounds.append(h('option', { value: String(n), textContent: `${n} ${n === 1 ? 'ronde' : 'rondes'}`, selected: n === 3 }));
  const secs = h('select', { id: 'snDemoSecs' });
  for (const [v, l] of [[60, '1 minuut'], [120, '2 minuten'], [180, '3 minuten'], [300, '5 minuten']] as const) {
    secs.append(h('option', { value: String(v), textContent: l, selected: v === 300 }));
  }
  const gold = h('input', { type: 'checkbox', id: 'snDemoGold' });
  const eco = h('input', { type: 'checkbox', id: 'snDemoEco', checked: document.documentElement.classList.contains('eco') });
  const apply = h('button', { type: 'button', className: 'pri', textContent: 'Toepassen' });
  const clear = h('button', { type: 'button', textContent: 'Records wissen' });

  const label = (text: string, forId: string) => { const l = h('label', { textContent: text }); l.htmlFor = forId; return l; };
  const row = (input: HTMLInputElement, text: string) => { const l = h('label', { className: 'row' }, [input, text]); l.style.textTransform = 'none'; l.style.letterSpacing = '0'; l.style.fontWeight = '500'; l.style.color = 'var(--ink)'; return l; };

  panel.append(
    h('h3', { textContent: 'Proefinstellingen' }),
    h('p', { textContent: 'Enkel in dit prototype. In de app komen de woorden en instellingen automatisch uit de oefensessie.' }),
    label('Woorden', 'snDemoSet'), setSel, own, ownHelp,
    label('Kleur', 'snDemoTheme'), themeSel,
    label('Bezoek', 'snDemoRounds'), rounds, secs,
    row(gold, 'Gouden slang (perfecte sessie)'),
    row(eco, 'Spaarstand (zwakke toestellen)'),
    h('div', { className: 'acts' }, [clear, apply]),
  );
  document.body.append(toggle, panel);

  setSel.addEventListener('change', () => {
    const isOwn = setSel.value === 'eigen';
    own.hidden = !isOwn;
    ownHelp.hidden = !isOwn;
  });
  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
  });
  apply.addEventListener('click', () => {
    const words = setSel.value === 'eigen' ? parseOwn(own.value) : SETS[setSel.value]?.words ?? [];
    const next: Partial<SneekConfig> = {
      words: sanitizeWords(words),
      theme: themeSel.value as ThemeName,
      goldSnake: gold.checked,
      rounds: Number(rounds.value),
      visitSeconds: Number(secs.value),
    };
    api.setEco(eco.checked);
    api.reset(next);
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  });
  clear.addEventListener('click', () => api.resetRecords());
}
