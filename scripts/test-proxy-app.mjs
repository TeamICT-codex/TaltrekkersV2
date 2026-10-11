// Elke AI-functie van de app (services/geminiService.ts, de echte browsercode) door de echte proxy
// (api/gemini.ts), in één proces. Bewijst dat de filter op het vrije pad (hotfix AI-01) niets breekt
// van wat de app zelf stuurt, en toont wat er bij Gemini aankomt.
//
// Geen netwerk, geen sleutels, geen databank: fetch('/api/gemini') roept de handler rechtstreeks op,
// Gemini en de aanmeldcontrole van Supabase (/auth/v1/user op een .invalid-adres) zijn nagebootst,
// elk ander adres is verboden. De browserkant laadt Vite zoals in `npm run dev` (zie test-client-frayer.mjs).
//
// Start: npm run test:proxy-app
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const NEP_AUTH = 'https://nepproject.invalid';

// ── Omgeving vóór het laden (bestaande variabelen winnen van .env.local) ──────
for (const naam of ['SUPABASE_SERVICE_ROLE_KEY', 'VERCEL_ENV']) delete process.env[naam];
process.env.GEMINI_API_KEY = 'nep-gemini-sleutel';
process.env.SUPABASE_URL = NEP_AUTH; // de proxy controleert de token hier (nagebootst): limiet per gebruiker
process.env.SUPABASE_ANON_KEY = 'nep-publieke-sleutel';
process.env.VITE_USE_PROXY = '1';
process.env.VITE_SUPABASE_URL = 'http://127.0.0.1:9';
process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY = 'nep-publieke-sleutel';
process.env.VITE_GEMINI_API_KEY = '';

const { createHandler } = await import('../api/gemini.ts');
const { GEMINI_TEXT_MODEL, GEMINI_TTS_MODEL, FRAYER_GENERATION_CONFIG } = await import('../shared/frayerPrompt.ts');

// ── Nep-Gemini: een geldig antwoord voor elk schema dat de app vraagt ─────────
const NEP_AUDIO = Buffer.from(new Uint8Array(480)).toString('base64'); // stukje PCM16, zoals de TTS
const frayerTekst = woord => JSON.stringify({
  definitie: `Uitleg bij ${woord}.`,
  voorbeelden: [{ zin: `Een zin met ${woord}.`, gebruiktWoord: woord }],
  synoniemen: ['a'],
  antoniemen: ['b'],
});
function nepAntwoord(p) {
  if (p.model === GEMINI_TTS_MODEL) return { candidates: [{ content: { parts: [{ inlineData: { data: NEP_AUDIO } }] } }], modelVersion: GEMINI_TTS_MODEL };
  const schema = p.config?.responseSchema;
  const tekst = typeof p.contents === 'string' ? p.contents : JSON.stringify(p.contents);
  let text = 'ok';
  if (schema?.type === 'ARRAY') {
    const m = /Genereer een vraag voor elk van de volgende woorden: (.*)\.$/s.exec(tekst);
    const woorden = m ? m[1].split(', ') : [];
    text = JSON.stringify(woorden.map(w => ({ vraag: `Wat betekent ${w}?`, opties: [w, 'b', 'c', 'd'], correctAntwoordIndex: 0, woord: w })));
  } else if (schema?.properties?.termen) text = JSON.stringify({ termen: ['begrip'] });
  else if (schema?.properties?.story) text = JSON.stringify({ title: 'Titel', story: 'Verhaal.' });
  else if (schema?.properties?.definitie) text = frayerTekst('woord');
  return { text, usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 }, modelVersion: GEMINI_TEXT_MODEL };
}

const log = { verzoeken: [], statussen: [], gemini: [] };
const handler = createHandler({
  maakGemini: () => ({ models: { generateContent: async p => { log.gemini.push(p); return nepAntwoord(p); } } }),
  maakCacheClient: () => { throw new Error('de cache hoort uit te staan in deze test'); },
});

globalThis.fetch = async (invoer, init = {}) => {
  const url = typeof invoer === 'string' ? invoer : invoer instanceof URL ? invoer.href : invoer.url;
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  if (url === `${NEP_AUTH}/auth/v1/user`) {
    return json(200, { id: '00000000-0000-4000-8000-00000000a001', aud: 'authenticated', role: 'authenticated', email: 'leerling@voorbeeld.invalid', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() });
  }
  if (url === '/api/gemini') {
    const headers = {};
    new Headers(init.headers).forEach((v, k) => { headers[k] = v; });
    const body = JSON.parse(init.body);
    const res = {
      statusCode: 0,
      body: undefined,
      status(c) { this.statusCode = c; return this; },
      json(b) { this.body = b; return this; },
      setHeader() {},
    };
    log.verzoeken.push(body);
    await handler({ method: init.method ?? 'GET', body, headers, socket: { remoteAddress: '10.9.9.9' } }, res);
    log.statussen.push(res.statusCode);
    return json(res.statusCode, res.body);
  }
  throw new Error(`Netwerk is verboden in deze test (${url})`);
};

// ── De browserkant via Vite ──────────────────────────────────────────────────
const { createServer } = await import('vite');
const vite = await createServer({
  root: ROOT,
  configFile: join(ROOT, 'vite.config.ts'),
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
  logLevel: 'error',
  cacheDir: join(tmpdir(), 'taltrekkers-test-proxy-app-vite'),
  optimizeDeps: { noDiscovery: true, include: [] },
});
after(() => vite.close());

const svc = await vite.ssrLoadModule('/services/geminiService.ts');
const { supabase } = await vite.ssrLoadModule('/services/supabase.ts');
supabase.auth.getSession = async () => ({ data: { session: { access_token: 'nep-token', user: { id: 'leerling-1' } } } });
supabase.from = () => ({ insert: async () => ({ error: null }) }); // het verbruikslog niet wegschrijven
console.error = () => {};
console.warn = () => {};

// De TTS-code speelt het geluid af: een stille AudioContext volstaat.
class NepAudioContext {
  constructor() { this.state = 'running'; this.destination = {}; }
  async resume() { this.state = 'running'; }
  createBuffer(_kanalen, frames) { const data = new Float32Array(frames); return { duration: frames / 24000, getChannelData: () => data }; }
  createBufferSource() { const s = { buffer: null, onended: null, connect() {}, start() { setTimeout(() => s.onended?.(), 0); }, stop() {} }; return s; }
}
globalThis.window = globalThis.window ?? globalThis;
globalThis.window.AudioContext = NepAudioContext;

const veertig = Array.from({ length: 40 }, (_, i) => `vakwoord${i}`);
const model = JSON.parse(frayerTekst('vakwoord'));
const SNEL = { aiModel: 'fast' };

test('de echte app: elke AI-functie gaat door de proxy, en Gemini krijgt de config van de server', async () => {
  const lang = 'een heel lange uitdrukking die meer dan zestig tekens telt, echt waar';
  assert.equal((await svc.generateFrayerModel('factuur', { context: 'Woordenschat 2DF', difficulty: 'Beginner', aiModel: 'fast' })).definitie, 'Uitleg bij woord.');
  assert.equal((await svc.generateFrayerModel(lang, { context: 'Woordenschat 2DF', difficulty: 'Gevorderd', aiModel: 'fast' })).definitie, 'Uitleg bij woord.');
  assert.equal((await svc.translateFrayerModel(model, 'Arabisch', SNEL)).definitie, 'Uitleg bij woord.');
  const quiz = await svc.generateQuizQuestions(veertig.map(() => model), veertig, { ...SNEL, context: 'O&L-Informatica' });
  assert.equal(quiz.length, 40);
  assert.equal(await svc.generateFeedbackForError('vraag', 'fout', 'juist', SNEL), 'ok');
  assert.equal(await svc.simplifyQuestion('vraag', SNEL), 'ok');
  assert.equal((await svc.generateStory(veertig.slice(0, 20), 'thema', { ...SNEL, context: 'O&L-Informatica' })).title, 'Titel');
  assert.equal(await svc.generateFunnyTheme(veertig.slice(0, 20), { ...SNEL, context: 'Biologie' }), 'ok');
  assert.equal(await svc.generateFunnyTheme(veertig.slice(0, 20), { ...SNEL, context: '' }), 'ok');
  assert.equal(await svc.evaluateComprehension('verhaal '.repeat(300), 'samenvatting '.repeat(100), SNEL), 'ok');
  assert.equal(await svc.evaluateReadingAnswer('verhaal '.repeat(300), 'vraag', 'antwoord '.repeat(100), SNEL), 'ok');
  assert.equal(await svc.generateDidacticAnalysis({ settings: { aiModel: 'fast' }, timingData: {}, quizResults: veertig.map(w => ({ word: w, correct: true })) }, 'leerling'), 'ok');
  assert.deepEqual(await svc.extractKeyTerms('tekst '.repeat(6000), { ...SNEL, context: 'O&L-Informatica' }), ['begrip']);
  // Een ander aiModel dan 'fast' stuurt geen thinkingConfig mee: de proxy zet het denken toch uit.
  assert.equal(await svc.simplifyQuestion('vraag', { aiModel: 'balanced' }), 'ok');
  await svc.playCachedOrGenerateTTS('k1', 'Een lange uitleg van een woord die voorgelezen wordt. '.repeat(4));
  await svc.playTextAsSpeech('Tekst');
  const geladen = await svc.preloadTTSBatch([{ key: 'w1', text: 'woord' }, { key: 'w1:definitie', text: 'Uitleg bij woord.' }]);
  assert.equal(geladen.size, 2);

  assert.equal(log.statussen.length, 18, '14 tekstaanvragen (2 Frayer) en 4 spraakaanvragen');
  assert.deepEqual(log.statussen.filter(s => s !== 200), [], 'een aanvraag van de app werd geweigerd');
  assert.equal(log.gemini.length, log.verzoeken.length, 'elke aanvraag ging naar Gemini (de cache staat uit)');

  const features = new Set();
  let maxTekst = 0;
  let maxSpraak = 0;
  log.verzoeken.forEach((b, i) => {
    const g = log.gemini[i];
    features.add(b.feature);
    if (b.frayer !== undefined) {
      assert.deepEqual(g.config, FRAYER_GENERATION_CONFIG, 'Frayer-pad: vaste config van de server');
      return;
    }
    assert.deepEqual(g.contents, b.contents, `${b.feature}: contents gewijzigd`);
    const n = typeof b.contents === 'string' ? b.contents.length : b.contents.flatMap(c => c.parts).reduce((s, p) => s + p.text.length, 0);
    if (b.model === GEMINI_TTS_MODEL) {
      maxSpraak = Math.max(maxSpraak, n);
      assert.deepEqual(g.config, { responseModalities: ['AUDIO'], speechConfig: b.config.speechConfig }, `${b.feature}: spraakconfig`);
    } else {
      maxTekst = Math.max(maxTekst, n);
      const { thinkingConfig: _weg, ...rest } = b.config ?? {};
      assert.deepEqual(g.config, { ...rest, thinkingConfig: { thinkingBudget: 0 }, candidateCount: 1, maxOutputTokens: 8192 }, `${b.feature}: config`);
    }
  });
  assert.deepEqual([...features].sort(), [
    'didactische-analyse', 'feedback', 'frayer', 'lees-evaluatie', 'quiz', 'tts', 'vereenvoudig',
    'verhaal', 'verhaal-evaluatie', 'verhaal-thema', 'vertaling', 'woordextractie',
  ]);
  assert.ok(maxTekst < 60_000 && maxSpraak < 2_000, `grootste tekst ${maxTekst}, spraak ${maxSpraak}`);
  console.log(`# ${log.verzoeken.length} aanvragen, alle 200; grootste tekst ${maxTekst} tekens (grens 60 000), grootste spraak ${maxSpraak} (grens 2 000)`);
});

test('de echte app: een aanvraag die de proxy weigert, komt bij de leerling als gewone fout (geen crash)', async () => {
  // Tools meesturen doet de app nooit; hier rechtstreeks via fetch, zoals een eigen script dat zou doen.
  const r = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer nep-token' },
    body: JSON.stringify({ feature: 'quiz', model: GEMINI_TEXT_MODEL, contents: 'x', config: { tools: [{ googleSearch: {} }] } }),
  });
  assert.equal(r.status, 400);
  const body = await r.json();
  assert.equal(body.code, 'config_niet_toegelaten');
  assert.match(body.error, /^Ongeldige AI-aanvraag/);
});
