// Test van het rekenwerk achter het AI-verbruikpaneel (services/aiUsage.ts),
// vooral de nieuwe cachecijfers: hoeveel woordkaarten uit de cache kwamen en wat
// dat geschat bespaarde. Zonder browser en zonder netwerk: Vite laadt de module
// zoals in `npm run dev`, de Supabase-URL wijst naar een onbereikbaar lokaal adres.
//
// Start: npm run test:verbruik
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

process.env.VITE_SUPABASE_URL = 'http://127.0.0.1:9';
process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY = 'nep-publieke-sleutel';
globalThis.fetch = async url => { throw new Error(`Netwerk is verboden in deze test (${url})`); };

const { createServer } = await import('vite');
const vite = await createServer({
  root: ROOT,
  configFile: join(ROOT, 'vite.config.ts'),
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
  logLevel: 'error',
  cacheDir: join(tmpdir(), 'taltrekkers-test-verbruik-vite'),
  optimizeDeps: { noDiscovery: true, include: [] },
});
after(() => vite.close());

const { buildUsageView, costPerNewCardUsd, estimateCostUsd } = await vite.ssrLoadModule('/services/aiUsage.ts');

/** Eén opgetelde groep zoals get_ai_usage_stats() die teruggeeft. */
const groep = (velden) => ({ model: 'gemini-2.5-flash', calls: 0, input_tokens: 0, output_tokens: 0, failed: 0, ...velden });

const bijna = (a, b, tekst) => assert.ok(Math.abs(a - b) < 1e-12, `${tekst}: ${a} ≠ ${b}`);

// 10 gelukte woordkaarten op 2.5 Flash: gemiddeld 300 input- en 250 output-tokens.
// Eén nieuwe kaart kost dan 300/1M × $0.30 + 250/1M × $2.50 = $0.000715.
const PER_KAART = 0.000715;

test('zonder cache: geen cachecijfers, kosten zoals voorheen', () => {
  const view = buildUsageView({
    days: 90, total_rows: 12, anonymous_calls: 0, first_logged_at: null,
    periods: [groep({ periode: 'alles', calls: 12, input_tokens: 3000, output_tokens: 2500, failed: 2 })],
    features: [groep({ feature: 'frayer', calls: 12, input_tokens: 3000, output_tokens: 2500, failed: 2 })],
  });
  assert.equal(view.cache.hits, 0);
  assert.equal(view.cache.generated, 10, 'mislukte calls tellen niet mee als gemaakte kaart');
  assert.equal(view.cache.share, 0);
  assert.equal(view.cache.savedUsd, 0);
  const alles = view.periods.find(p => p.label === 'Alles');
  assert.equal(alles.cacheHits, 0);
  bijna(alles.costUsd, estimateCostUsd({ model: 'gemini-2.5-flash', input_tokens: 3000, output_tokens: 2500 }), 'kost');
});

test('kost van één nieuwe kaart: gemiddelde tokens van gelukte kaarten, aan het huidige tarief', () => {
  bijna(costPerNewCardUsd([groep({ feature: 'frayer', calls: 12, input_tokens: 3000, output_tokens: 2500, failed: 2 })]), PER_KAART, 'per kaart');
  // Ook oude kaarten op het duurdere 3.8 Flash tellen mee voor het GEMIDDELDE aantal tokens,
  // maar geprijsd aan het model dat de app nu gebruikt (2.5 Flash).
  bijna(costPerNewCardUsd([
    groep({ feature: 'frayer', model: 'gemini-3.8-flash', calls: 5, input_tokens: 1500, output_tokens: 1250 }),
    groep({ feature: 'frayer', model: 'gemini-2.5-flash', calls: 5, input_tokens: 1500, output_tokens: 1250 }),
  ]), PER_KAART, 'per kaart, gemengde modellen');
  // Zijn er al kaarten op het huidige model, dan telt enkel dat gemiddelde:
  // de oude 3.8 Flash-kaarten met veel denk-tokens duwen de besparing niet omhoog.
  bijna(costPerNewCardUsd([
    groep({ feature: 'frayer', model: 'gemini-3.8-flash', calls: 5, input_tokens: 5000, output_tokens: 10000 }),
    groep({ feature: 'frayer', model: 'gemini-2.5-flash', calls: 5, input_tokens: 1500, output_tokens: 1250 }),
  ]), PER_KAART, 'per kaart, enkel het huidige model');
  // Nog geen kaarten op het huidige model: dan het gemiddelde van de oudere.
  bijna(costPerNewCardUsd([
    groep({ feature: 'frayer', model: 'gemini-3.8-flash', calls: 5, input_tokens: 1500, output_tokens: 1250 }),
  ]), PER_KAART, 'per kaart, terugval op oudere kaarten');
  assert.equal(costPerNewCardUsd([]), 0, 'zonder gemaakte kaarten: 0, geen deling door nul');
  assert.equal(costPerNewCardUsd([groep({ feature: 'frayer', calls: 3, failed: 3 })]), 0, 'enkel mislukte kaarten: 0');
});

test('met cache: treffers per periode, aandeel en besparing', () => {
  const view = buildUsageView({
    days: 90, total_rows: 70, anonymous_calls: 0, first_logged_at: null,
    periods: [
      groep({ periode: 'vandaag', model: 'cache', calls: 5 }),
      groep({ periode: 'vandaag', calls: 3, input_tokens: 900, output_tokens: 750 }),
      groep({ periode: 'alles', model: 'cache', calls: 30 }),
      groep({ periode: 'alles', calls: 12, input_tokens: 3000, output_tokens: 2500, failed: 2 }),
    ],
    features: [
      groep({ feature: 'frayer', calls: 12, input_tokens: 3000, output_tokens: 2500, failed: 2 }),
      groep({ feature: 'frayer-cache', model: 'cache', calls: 30 }),
    ],
  });

  assert.equal(view.cache.hits, 30);
  assert.equal(view.cache.generated, 10);
  assert.equal(view.cache.share, 0.75);
  bijna(view.cache.costPerCardUsd, PER_KAART, 'per kaart');
  bijna(view.cache.savedUsd, 30 * PER_KAART, 'bespaard (90 dagen)');

  const vandaag = view.periods.find(p => p.label === 'Vandaag');
  assert.equal(vandaag.cacheHits, 5);
  bijna(vandaag.savedUsd, 5 * PER_KAART, 'bespaard vandaag');
  // Een cachekaart kost zelf niets: de kost van vandaag komt enkel van de 3 Gemini-calls.
  bijna(vandaag.costUsd, estimateCostUsd({ model: 'gemini-2.5-flash', input_tokens: 900, output_tokens: 750 }), 'kost vandaag');
  assert.equal(vandaag.calls, 8, 'cachetreffers tellen mee als call');

  const rij = view.perFeature.find(f => f.label === 'Frayer-model (uit cache)');
  assert.ok(rij, 'cache heeft een eigen rij in de tabel per functie');
  assert.equal(rij.costUsd, 0);
  assert.equal(rij.cacheHits, 30);
});

test('lege statistiek geeft nullen en geen fouten', () => {
  const view = buildUsageView({ days: 90, total_rows: 0, anonymous_calls: 0, first_logged_at: null, periods: [], features: [] });
  assert.equal(view.cache.hits, 0);
  assert.equal(view.cache.share, null);
  assert.equal(view.periods.length, 4);
  assert.ok(view.periods.every(p => p.cacheHits === 0 && p.savedUsd === 0 && p.costUsd === 0));
});
