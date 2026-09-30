// Test van de browserkant (services/geminiService.ts) zonder browser en zonder
// netwerk. Vite laadt de module zoals in `npm run dev` (dus mét import.meta.env);
// fetch en de Supabase-sessie zijn nagebootst. De Supabase-URL wijst naar een
// onbereikbaar lokaal adres, zodat er nooit iets naar een echte databank gaat.
//
// Controleert dat generateFrayerModel voor de aanroepers hetzelfde blijft, dat de
// browser voor Frayer enkel woord/vak/niveau stuurt, en hoe er gelogd wordt.
//
// Start: npm run test:client
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

// Omgeving vóór Vite start: bestaande variabelen winnen van .env.local.
process.env.VITE_USE_PROXY = '1';
process.env.VITE_SUPABASE_URL = 'http://127.0.0.1:9';
process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY = 'nep-publieke-sleutel';
process.env.VITE_GEMINI_API_KEY = '';

// ── fetch nabootsen: enkel /api/gemini, al de rest is verboden ───────────────
const verzoeken = [];
let antwoord = () => ({ status: 500, data: { error: 'geen antwoord ingesteld' } });
globalThis.fetch = async (url, init = {}) => {
  const adres = String(url);
  if (adres !== '/api/gemini') throw new Error(`Netwerk is verboden in deze test (${adres})`);
  const body = JSON.parse(init.body);
  verzoeken.push({ body, headers: init.headers });
  const { status, data } = antwoord(body);
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
};

const { createServer } = await import('vite');
const vite = await createServer({
  root: ROOT,
  configFile: join(ROOT, 'vite.config.ts'),
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
  logLevel: 'error',
  cacheDir: join(tmpdir(), 'taltrekkers-test-client-vite'),
  optimizeDeps: { noDiscovery: true, include: [] },
});
after(() => vite.close());

const svc = await vite.ssrLoadModule('/services/geminiService.ts');
const { supabase } = await vite.ssrLoadModule('/services/supabase.ts');
const shared = await vite.ssrLoadModule('/shared/frayerPrompt.ts');

// Ingelogde leerling nabootsen + logregels opvangen (i.p.v. naar ai_usage_log).
const logregels = [];
supabase.auth.getSession = async () => ({ data: { session: { access_token: 'nep-token', user: { id: 'leerling-1' } } } });
supabase.from = tabel => ({
  insert: async rij => {
    logregels.push({ tabel, rij });
    return { error: null };
  },
});
console.error = () => {}; // de retry-meldingen van generateFrayerModel niet tonen

const MODEL = {
  definitie: 'Een document waarop staat wat je moet betalen.',
  voorbeelden: [{ zin: 'De factuur ligt klaar.', gebruiktWoord: 'factuur' }],
  synoniemen: ['rekening'],
  antoniemen: [],
};
const USAGE = { promptTokenCount: 300, candidatesTokenCount: 200, thoughtsTokenCount: null, totalTokenCount: 500 };
const tik = () => new Promise(ok => setTimeout(ok, 20));

function reset(nieuwAntwoord) {
  verzoeken.length = 0;
  logregels.length = 0;
  antwoord = nieuwAntwoord;
}

test('Frayer via de proxy: enkel woord/vak/niveau, geen prompttekst; log als "frayer"', async () => {
  reset(() => ({ status: 200, data: { text: JSON.stringify(MODEL), usage: USAGE, modelVersion: 'gemini-2.5-flash', cached: false } }));
  const model = await svc.generateFrayerModel('factuur', { context: 'Woordenschat 2DF', difficulty: 'Beginner', aiModel: 'fast' });
  assert.deepEqual(model, MODEL);
  assert.equal(verzoeken.length, 1);
  const { body, headers } = verzoeken[0];
  assert.deepEqual(body, {
    feature: 'frayer',
    model: 'gemini-2.5-flash',
    frayer: { word: 'factuur', context: 'Woordenschat 2DF', difficulty: 'Beginner' },
  });
  assert.equal(headers.Authorization, 'Bearer nep-token');
  await tik();
  assert.equal(logregels.length, 1);
  assert.equal(logregels[0].tabel, 'ai_usage_log');
  assert.equal(logregels[0].rij.feature, 'frayer');
  assert.equal(logregels[0].rij.model, 'gemini-2.5-flash');
  assert.equal(logregels[0].rij.input_tokens, 300);
});

test('Frayer uit de cache: zelfde resultaat, gelogd als "frayer-cache" / model "cache" (kost 0)', async () => {
  reset(() => ({ status: 200, data: { text: JSON.stringify(MODEL), usage: null, modelVersion: 'gemini-2.5-flash', cached: true } }));
  const model = await svc.generateFrayerModel('factuur', { context: 'Woordenschat 2DF', difficulty: 'Beginner', aiModel: 'fast' });
  assert.deepEqual(model, MODEL);
  await tik();
  assert.equal(logregels.length, 1);
  assert.equal(logregels[0].rij.feature, 'frayer-cache');
  assert.equal(logregels[0].rij.model, 'cache');
  assert.equal(logregels[0].rij.input_tokens, null);
  const aiUsage = await vite.ssrLoadModule('/services/aiUsage.ts');
  assert.equal(aiUsage.estimateCostUsd({ model: 'cache', input_tokens: 1e6, output_tokens: 1e6 }), 0);
  assert.equal(aiUsage.FEATURE_LABELS_NL['frayer-cache'], 'Frayer-model (uit cache)');
});

test('canoniek: woord in kleine letters, vak exact, niveau canoniek; zonder vak/niveau → lege strings', async () => {
  reset(() => ({ status: 200, data: { text: JSON.stringify(MODEL), usage: USAGE, modelVersion: 'gemini-2.5-flash', cached: false } }));
  await svc.generateFrayerModel('  De   Factuur ', { aiModel: 'balanced' });
  assert.deepEqual(verzoeken[0].body.frayer, { word: 'de factuur', context: '', difficulty: '' });
  // Wat de app zelf nooit stuurt, maar wat wel canoniek moet worden:
  await svc.generateFrayerModel('factuur', { context: ' woordenschat 2df ', difficulty: 'beginner', aiModel: 'fast' });
  assert.deepEqual(verzoeken[1].body.frayer, { word: 'factuur', context: 'woordenschat 2df', difficulty: 'Beginner' });
  await svc.generateFrayerModel('factuur', { context: 'Woordenschat 2DF', difficulty: 'Expert', aiModel: 'fast' });
  assert.deepEqual(verzoeken[2].body.frayer, { word: 'factuur', context: 'Woordenschat 2DF', difficulty: '' });
});

test("woord met '|' → zoals vroeger als gewone prompt, zonder cache", async () => {
  reset(() => ({ status: 200, data: { text: JSON.stringify(MODEL), usage: USAGE, modelVersion: 'gemini-2.5-flash', cached: false } }));
  await svc.generateFrayerModel('in|uit', { context: 'Woordenschat 2DF', difficulty: 'Beginner', aiModel: 'fast' });
  assert.equal(verzoeken[0].body.frayer, undefined);
  assert.equal(verzoeken[0].body.contents, shared.buildFrayerPrompt({ word: 'in|uit', context: 'Woordenschat 2DF', difficulty: 'Beginner' }));
});

test('woord dat de controle niet haalt (> 60 tekens) → zoals vroeger als gewone prompt, zonder cache', async () => {
  reset(() => ({ status: 200, data: { text: JSON.stringify(MODEL), usage: USAGE, modelVersion: 'gemini-2.5-flash', cached: false } }));
  const lang = 'een heel lange uitdrukking die meer dan zestig tekens telt, echt waar';
  const model = await svc.generateFrayerModel(lang, { context: 'Woordenschat 2DF', difficulty: 'Gevorderd', aiModel: 'fast' });
  assert.deepEqual(model, MODEL);
  const { body } = verzoeken[0];
  assert.equal(body.frayer, undefined);
  assert.equal(body.contents, shared.buildFrayerPrompt({ word: lang, context: 'Woordenschat 2DF', difficulty: 'Gevorderd' }));
  assert.equal(body.config.responseMimeType, 'application/json');
  assert.equal(body.model, 'gemini-2.5-flash');
});

test('fouten blijven dezelfde: 3 pogingen, daarna de vertrouwde foutmelding', async () => {
  reset(() => ({ status: 400, data: { error: 'Ongeldige Frayer-aanvraag' } }));
  await assert.rejects(
    svc.generateFrayerModel('factuur', { context: '', difficulty: 'Beginner', aiModel: 'fast' }),
    err => err.message === 'Kon het Frayer model niet genereren na 3 pogingen. Fout: Ongeldige Frayer-aanvraag',
  );
  assert.equal(verzoeken.length, 3);

  const leeg = { ...MODEL, voorbeelden: [{ zin: '', gebruiktWoord: '' }] };
  reset(() => ({ status: 200, data: { text: JSON.stringify(leeg), usage: USAGE, modelVersion: 'gemini-2.5-flash', cached: false } }));
  await assert.rejects(
    svc.generateFrayerModel('factuur', { aiModel: 'fast' }),
    /^Error: Kon het Frayer model niet genereren na 3 pogingen\. Fout: Het gegenereerde model bevat lege voorbeeldzinnen/,
  );
});

test('andere functies gebruiken het vastgepinde model (geen alias meer)', async () => {
  reset(() => ({ status: 200, data: { text: 'Eenvoudige vraag?', usage: USAGE, modelVersion: 'gemini-2.5-flash', cached: false } }));
  await svc.simplifyQuestion('Wat betekent factuur?', { aiModel: 'fast' });
  assert.equal(verzoeken[0].body.model, 'gemini-2.5-flash');
  assert.equal(verzoeken[0].body.feature, 'vereenvoudig');
  assert.ok(typeof verzoeken[0].body.contents === 'string' && verzoeken[0].body.contents.length > 0);
});

test('de app merkt niets: zelfde exports, componenten en App ongewijzigd t.o.v. main', () => {
  const exporten = bron => [...bron.matchAll(/^export (?:const|async function|function) (\w+)/gm)].map(m => m[1]).sort();
  const oud = execFileSync('git', ['show', 'main:services/geminiService.ts'], { cwd: ROOT, encoding: 'utf8' });
  const nieuw = readFileSync(join(ROOT, 'services/geminiService.ts'), 'utf8');
  assert.deepEqual(exporten(nieuw), exporten(oud));

  const gewijzigd = execFileSync(
    'git',
    ['diff', '--name-only', 'main', '--', 'App.tsx', 'index.tsx', 'index.html', 'components', 'contexts', 'hooks', 'games', 'data', 'types.ts', 'constants', 'constants.ts', 'services'],
    { cwd: ROOT, encoding: 'utf8' },
  ).trim().split('\n').filter(Boolean).sort();
  const toegelaten = [
    'services/aiUsage.ts',
    'services/geminiService.ts',
    // Bewust mee aangepast (2026-09-29): de quizvragen komen op de achtergrond,
    // en het AI-verbruikpaneel toont wat de cache bespaart.
    'components/PracticeSession.tsx',
    'components/LoadingIndicator.tsx',
    'components/AiUsagePanel.tsx',
    // Contextveld begrensd op 80 tekens, zoals de proxy (2026-09-29).
    'components/CustomWordExtractor.tsx',
    // Vangnet: herladen bij een update (2026-09-30).
    'index.tsx',
    'services/herladenNaUpdate.ts',
    // "Wat is er nieuw?" in de voettekst (2026-09-29).
    'App.tsx',
    'components/NieuwsButton.tsx',
    'components/NieuwsModal.tsx',
    'data/nieuws.ts',
  ];
  const onverwacht = gewijzigd.filter(f => !toegelaten.includes(f));
  assert.deepEqual(onverwacht, [], `onverwacht gewijzigd t.o.v. main: ${onverwacht.join(', ')}`);
});
