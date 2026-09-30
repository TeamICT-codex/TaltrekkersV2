// Bewijst dat shared/frayerPrompt.ts byte-voor-byte dezelfde prompts maakt als
// de code op `main` in services/geminiService.ts. De referentie komt telkens
// vers uit git (git show main:…), niet uit een kopie die kan verouderen.
//
// Start: npm run test:prompt        (vergelijkt met 2aab094; andere referentie: PROMPT_REF=<commit> npm run test:prompt)
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after } from 'node:test';
import { pathToFileURL } from 'node:url';

// 2aab094 = de laatste versie met de oude promptopbouw in de browser (vóór de cache op main kwam).
const REF = process.env.PROMPT_REF || '2aab094';
const gitShow = pad => execFileSync('git', ['show', `${REF}:${pad}`], { encoding: 'utf8', maxBuffer: 50e6 });

/** Stuk tekst tussen twee unieke markeringen (begin inbegrepen, eind niet). */
function knip(tekst, begin, eind) {
  const a = tekst.indexOf(begin);
  assert.ok(
    a >= 0 && tekst.indexOf(begin, a + 1) < 0,
    `markering niet (uniek) gevonden op ${REF}: ${begin}\n` +
    '  Staat de oude promptopbouw daar niet meer (al samengevoegd)? Vergelijk dan met de commit ervoor:\n' +
    '  PROMPT_REF=2aab094 npm run test:prompt',
  );
  const b = tekst.indexOf(eind, a);
  assert.ok(b > a, `eindmarkering niet gevonden: ${eind}`);
  return tekst.slice(a, b);
}

// ── 1. Referentie-implementatie bouwen uit de broncode op main ────────────────
const oudeBron = gitShow('services/geminiService.ts');

const helpers = knip(oudeBron, 'const subjectMap: Record<string, string> = {', '// --- GENERATIE FUNCTIES ---');
const oudSchema = knip(oudeBron, 'const frayerModelSchema = {', 'const storySchema = {');
const oudCleanJson = knip(oudeBron, 'const cleanJsonOutput = (text: string): string => {', '/**\n * Wrap user-supplied content');
const promptRegel = knip(oudeBron, 'contents: `Genereer een Frayer Model', '\n');
const template = promptRegel.slice('contents: '.length, promptRegel.lastIndexOf('`') + 1);
// generateFrayerModel op main bouwt de instructies exact zo op:
assert.ok(
  oudeBron.includes(
    '  const contextInstruction = getContextInstruction(settings.context);\n' +
    '  const difficultyInstruction = getDifficultyInstruction(settings.difficulty);',
  ),
  'generateFrayerModel op main bouwt de instructies anders op dan verwacht',
);

const werkmap = mkdtempSync(join(tmpdir(), 'prompt-ref-'));
after(() => rmSync(werkmap, { recursive: true, force: true }));
mkdirSync(join(werkmap, 'data'));
writeFileSync(join(werkmap, 'package.json'), '{ "type": "module" }');
writeFileSync(join(werkmap, 'types.ts'), gitShow('types.ts'));
writeFileSync(join(werkmap, 'data', 'curriculumVakken.ts'), gitShow('data/curriculumVakken.ts'));
writeFileSync(
  join(werkmap, 'referentie.ts'),
  [
    "import { WordLevel } from './types.ts';",
    "import { getVakDomainMap } from './data/curriculumVakken.ts';",
    oudCleanJson,
    oudSchema,
    helpers,
    'export const oudeFrayerPrompt = (word, settings) => {',
    '  const contextInstruction = getContextInstruction(settings.context);',
    '  const difficultyInstruction = getDifficultyInstruction(settings.difficulty);',
    `  return ${template};`,
    '};',
    'export { subjectMap, getContextInstruction, getDifficultyInstruction, buildSubjectGuidance, frayerModelSchema, cleanJsonOutput, WordLevel };',
  ].join('\n'),
);

const oud = await import(pathToFileURL(join(werkmap, 'referentie.ts')).href);
const nieuw = await import(new URL('../shared/frayerPrompt.ts', import.meta.url).href);

// ── 2. Invoer ────────────────────────────────────────────────────────────────
// Woorden zoals de app en 2.0 ze sturen: kleine letters (vaste lijsten en
// extractKeyTerms leveren niets anders).
const appWoorden = [
  'factuur', 'opbellen', 'virus', 'muis', 'de "slimme" meter', "a'b`c${x}",
  'ë-woord', 'zich aanmelden', 'co2-uitstoot', 'één', 'e-mail', 'het perspectief',
];
// Andere schrijfwijzen: kan de server krijgen, maar niet van de app zelf.
const andereWoorden = ['CO2-uitstoot', 'Brussel', '  Factuur ', 'ZICH   AANMELDEN'];
const contexten = [
  undefined, '',
  ...Object.values(oud.WordLevel),
  ...Object.keys(oud.subjectMap),
  'een onbekend vak', 'AF-3e-ELEK', 'Zwakke woorden', 'Algemeen', 'toString', 'constructor',
];
// Wat de app als niveau stuurt (WordLevel-waarde of niets) + een onbekende waarde.
const niveaus = [undefined, '', 'Beginner', 'Gemiddeld', 'Gevorderd', 'onzin'];
// Andere schrijfwijzen van een niveau: niet van de app zelf.
const andereNiveaus = ['beginner', 'GEVORDERD', ' Gemiddeld ', 'gemiddeld', 'Expert', 42, null, {}];

/** Het canonieke niveau volgens de nieuwe regel, als verwachte waarde voor main. */
const canoniek = d => (typeof d === 'string'
  ? ['Beginner', 'Gemiddeld', 'Gevorderd'].find(n => n.toLowerCase() === d.trim().toLowerCase())
  : undefined);

/** Toont de eerste plaats waar twee teksten verschillen. */
function verschil(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) return `positie ${i}: ${JSON.stringify(a.slice(i - 30, i + 30))} ≠ ${JSON.stringify(b.slice(i - 30, i + 30))}`;
  }
  return '';
}

// ── 3. Vergelijkingen ────────────────────────────────────────────────────────
test(`Frayer-prompt van de proxy identiek aan ${REF} voor alles wat de app stuurt (woord × vak × niveau)`, t => {
  let n = 0;
  for (const word of appWoorden) {
    for (const context of contexten) {
      for (const difficulty of niveaus) {
        const verwacht = oud.oudeFrayerPrompt(word, { context, difficulty });
        const raw = { word, context: context ?? '', difficulty: difficulty ?? '' };
        const genormaliseerd = nieuw.normalizeFrayerRequest(raw);
        assert.ok(genormaliseerd, `normalisatie weigerde ${JSON.stringify(raw)}`);
        const kandidaat = nieuw.buildFrayerPrompt(genormaliseerd);
        assert.equal(kandidaat, verwacht, `verschil bij ${JSON.stringify(raw)} — ${verschil(verwacht, kandidaat)}`);
        n++;
      }
    }
  }
  assert.ok(n >= 1000, `slechts ${n} combinaties`);
  t.diagnostic(`${n} combinaties vergeleken (${appWoorden.length} woorden × ${contexten.length} contexten × ${niveaus.length} niveaus), 0 verschillen`);
});

test(`Prompt-sjabloon identiek aan ${REF} voor elke invoer (terugvalpad van de client, zonder normalisatie)`, t => {
  let n = 0;
  for (const word of [...appWoorden, ...andereWoorden]) {
    for (const context of contexten) {
      for (const difficulty of [...niveaus, ...andereNiveaus.filter(d => typeof d === 'string')]) {
        const verwacht = oud.oudeFrayerPrompt(word, { context, difficulty });
        const kandidaat = nieuw.buildFrayerPrompt({ word, context: context ?? '', difficulty: difficulty ?? '' });
        assert.equal(kandidaat, verwacht, `verschil bij ${JSON.stringify([word, context, difficulty])} — ${verschil(verwacht, kandidaat)}`);
        n++;
      }
    }
  }
  t.diagnostic(`${n} combinaties vergeleken, 0 verschillen`);
});

test(`Andere schrijfwijzen → de prompt van ${REF} voor de canonieke vorm (bewuste keuze)`, t => {
  let n = 0;
  for (const word of [...appWoorden, ...andereWoorden]) {
    for (const context of ['', 'Woordenschat 2DF', 'Applicatie- & Databeheer (APPDA)', 'een onbekend vak']) {
      for (const difficulty of [...niveaus, ...andereNiveaus]) {
        const r = nieuw.normalizeFrayerRequest({ word, context, difficulty });
        assert.ok(r, `normalisatie weigerde ${JSON.stringify([word, context, difficulty])}`);
        const canoniekWoord = word.trim().replace(/\s+/g, ' ').toLowerCase();
        const verwacht = oud.oudeFrayerPrompt(canoniekWoord, { context, difficulty: canoniek(difficulty) });
        const kandidaat = nieuw.buildFrayerPrompt(r);
        assert.equal(kandidaat, verwacht, `verschil bij ${JSON.stringify([word, context, String(difficulty)])} — ${verschil(verwacht, kandidaat)}`);
        n++;
      }
    }
  }
  // Gedocumenteerd verschil met main: 'beginner' (kleine letter) gaf daar de B1-instructie
  // (onbekende waarde); nu geldt het als 'Beginner' (A2). De app stuurt altijd 'Beginner'.
  const klein = nieuw.buildFrayerPrompt(nieuw.normalizeFrayerRequest({ word: 'factuur', difficulty: 'beginner' }));
  assert.equal(klein, oud.oudeFrayerPrompt('factuur', { difficulty: 'Beginner' }));
  assert.notEqual(klein, oud.oudeFrayerPrompt('factuur', { difficulty: 'beginner' }));
  t.diagnostic(`${n} combinaties: elke schrijfwijze geeft de prompt van zijn canonieke vorm`);
});

test(`Andere prompts (verhaal, quiz, woordextractie) identiek aan ${REF}`, t => {
  let n = 0;
  for (const context of contexten) {
    for (const deel of ['definitions', 'story', 'questions']) {
      assert.equal(nieuw.getContextInstruction(context, deel), oud.getContextInstruction(context, deel), `getContextInstruction(${JSON.stringify(context)}, ${deel})`);
      n++;
    }
    assert.equal(nieuw.buildSubjectGuidance(context), oud.buildSubjectGuidance(context), `buildSubjectGuidance(${JSON.stringify(context)})`);
    n++;
  }
  for (const d of niveaus) {
    assert.equal(nieuw.getDifficultyInstruction(d), oud.getDifficultyInstruction(d));
    n++;
  }
  t.diagnostic(`${n} vergelijkingen, 0 verschillen`);
});

test(`frayerModelSchema en cleanJsonOutput identiek aan ${REF}`, () => {
  assert.deepEqual(nieuw.frayerModelSchema, oud.frayerModelSchema);
  const monsters = ['{"a":1}', '  ```json\n{"a":1}\n```  ', '```\n[1]\n```', '```json{"b":2}```', 'geen json', ''];
  for (const m of monsters) assert.equal(nieuw.cleanJsonOutput(m), oud.cleanJsonOutput(m), JSON.stringify(m));
});
