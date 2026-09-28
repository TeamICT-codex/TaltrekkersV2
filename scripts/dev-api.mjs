// Lokale AI-proxy: draait api/gemini.ts zoals Vercel dat doet, op
// http://127.0.0.1:3001/api/gemini. Vite stuurt /api daarheen door (vite.config.ts)
// wanneer de app met VITE_USE_PROXY=1 draait.
//
//   npm run dev:api     → proxy starten (Ctrl+C om te stoppen)
//   npm run test:rook   → proxy starten, 1 alias-aanroep + 3 Frayer-woorden echt
//                         via Gemini laten lopen, resultaat tonen en stoppen
//
// Nodig: node --experimental-transform-types (zie package.json), want de proxy
// is TypeScript. Sleutels komen uit .env.local; de banner toont enkel OF ze er
// zijn, nooit de waarden.
//
// VEILIGHEID: een lokale proxy is nooit "productie". VERCEL_ENV wordt hier altijd
// op 'development' gezet, zodat het veiligheidsslot in api/gemini.ts de cache
// UIT houdt zolang de Supabase-URL naar de LIVE databank wijst.
import http from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { geheimeViteVariabelen, laadEnv, supabaseRef, zetServerNamen } from './load-env.mjs';

const MAX_BODY_BYTES = 5 * 1024 * 1024; // Vercel aanvaardt ± 4,5 MB
const HOST = '127.0.0.1'; // enkel deze computer

/**
 * Start de lokale proxy. `poort: 0` = een vrije poort (voor tests).
 * `zonderLogin` schakelt de aanmeldcontrole uit door de publieke Supabase-sleutel
 * weg te laten (de proxy valt dan terug op de IP-limiet) — enkel voor de rooktest.
 */
export async function startDevApi({ poort = Number(process.env.DEV_API_PORT || 3001), zonderLogin = false, stil = false } = {}) {
  const geladen = laadEnv();
  zetServerNamen();
  process.env.VERCEL_ENV = 'development';
  if (zonderLogin) {
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  }

  const proxy = await import('../api/gemini.ts');
  const handler = proxy.default;
  const status = proxy.frayerCacheStatus();

  const server = http.createServer((req, res) => {
    verwerk(handler, req, res, stil).catch(err => {
      console.error('dev-api: onverwachte fout:', err);
      if (!res.headersSent) stuurJson(res, 500, { error: 'Interne fout in dev-api' });
    });
  });
  await new Promise((ok, fout) => {
    server.once('error', fout);
    server.listen(poort, HOST, ok);
  });
  const url = `http://${HOST}:${server.address().port}/api/gemini`;

  if (!stil) toonBanner({ url, status, zonderLogin, geladen, liveRef: proxy.LIVE_SUPABASE_REF });
  return { server, url, status };
}

function toonBanner({ url, status, zonderLogin, geladen, liveRef }) {
  const env = process.env;
  const jaNee = v => (v ? 'ja' : 'nee');
  const databank = status.url
    ? `${status.live ? 'LIVE' : 'testdatabank'} (${supabaseRef(status.url)})`
    : 'geen Supabase-URL';
  const cache = status.aan
    ? `AAN — testdatabank (${supabaseRef(status.url)})`
    : status.live
      ? 'LIVE — cache uit (veiligheidsslot: lokaal nooit naar de live databank)'
      : `UIT (${status.reden})`;

  const regels = [
    'TALent voor Taal — lokale AI-proxy (dev:api)',
    `Adres             ${url}`,
    `Env-bestanden     ${geladen.length ? geladen.join(', ') : 'geen gevonden'}`,
    `Gemini-sleutel    ${jaNee(env.GEMINI_API_KEY)}`,
    `Databank          ${databank}`,
    `Publieke sleutel  ${jaNee(env.SUPABASE_ANON_KEY)}`,
    `Service-sleutel   ${jaNee(env.SUPABASE_SERVICE_ROLE_KEY)}`,
    `Aanmeldcontrole   ${zonderLogin ? 'UIT (rooktest: enkel dit proces, enkel 127.0.0.1)' : 'AAN (Bearer-token van de app)'}`,
    `Frayer-cache      ${cache}`,
  ];
  const lijn = '─'.repeat(Math.max(...regels.map(r => r.length)) + 2);
  console.log(`\n┌${lijn}┐`);
  for (const r of regels) console.log(`│ ${r.padEnd(lijn.length - 2)} │`);
  console.log(`└${lijn}┘`);

  // Waarschuwingen (nooit met waarden).
  const geheim = geheimeViteVariabelen(env);
  if (geheim.length) {
    console.warn(`\n⚠  ${geheim.join(', ')} lijkt een GEHEIME sleutel te bevatten. Alles met VITE_ komt in de`);
    console.warn('   publieke browserbundel. Hernoem naar SUPABASE_SERVICE_ROLE_KEY (zonder VITE_).');
  }
  if (env.SUPABASE_SERVICE_ROLE_KEY && status.live) {
    console.warn('\n⚠  Er staat een service-sleutel klaar terwijl de URL naar de LIVE databank wijst.');
    console.warn('   De cache blijft uit (veiligheidsslot), maar hoort die sleutel hier wel thuis?');
  }
  if (env.SUPABASE_URL && env.VITE_SUPABASE_URL && env.SUPABASE_URL !== env.VITE_SUPABASE_URL) {
    console.warn('\n⚠  SUPABASE_URL en VITE_SUPABASE_URL wijzen naar een ander project: de app meldt aan bij');
    console.warn('   het ene, de proxy controleert tokens bij het andere. Aanmelden via de app zal mislukken.');
  }
  if (!env.GEMINI_API_KEY) console.warn('\n⚠  Geen Gemini-sleutel: elke aanroep geeft 500 (Server configuration error).');
  if (status.url && status.url.includes(liveRef) && status.aan) {
    // Kan niet (VERCEL_ENV is hierboven op development gezet), maar liever dubbel.
    console.error('\n✗  De cache staat AAN tegen de LIVE databank. Dat mag lokaal nooit. Gestopt.');
    process.exit(1);
  }
  console.log('');
}

async function verwerk(handler, req, res, stil) {
  const start = Date.now();
  const pad = (req.url || '/').split('?')[0];
  if (pad !== '/api/gemini') {
    stuurJson(res, 404, { error: 'Niet gevonden: deze lokale proxy kent enkel /api/gemini.' });
    return;
  }

  let ruw;
  try {
    ruw = await leesBody(req);
  } catch (err) {
    stuurJson(res, 413, { error: err.message });
    return;
  }

  // Zoals Vercel: JSON-body geparst in req.body.
  let body;
  if (ruw.length > 0) {
    if (String(req.headers['content-type'] || '').includes('application/json')) {
      try {
        body = JSON.parse(ruw);
      } catch {
        stuurJson(res, 400, { error: 'Ongeldige JSON in de aanvraag.' });
        return;
      }
    } else {
      body = ruw;
    }
  }

  // Shim voor VercelRequest/VercelResponse: enkel wat api/gemini.ts gebruikt.
  req.body = body;
  req.query = Object.fromEntries(new URL(req.url || '/', 'http://localhost').searchParams);
  req.cookies = {};
  let cached;
  res.status = code => {
    res.statusCode = code;
    return res;
  };
  res.json = data => {
    cached = data?.cached;
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
    return res;
  };
  res.send = data => {
    if (typeof data === 'object' && data !== null && !Buffer.isBuffer(data)) return res.json(data);
    res.end(data);
    return res;
  };

  await handler(req, res);
  if (!stil) {
    const extra = cached === true ? ' — uit cache' : cached === false ? ' — Gemini' : '';
    console.log(`→ ${req.method} ${pad} ${res.statusCode} (${Date.now() - start} ms)${extra}`);
  }
}

function leesBody(req) {
  return new Promise((ok, fout) => {
    const stukken = [];
    let grootte = 0;
    req.on('data', stuk => {
      grootte += stuk.length;
      if (grootte > MAX_BODY_BYTES) {
        fout(new Error('Aanvraag te groot.'));
        req.destroy();
        return;
      }
      stukken.push(stuk);
    });
    req.on('end', () => ok(Buffer.concat(stukken).toString('utf8')));
    req.on('error', fout);
  });
}

function stuurJson(res, code, data) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOKTEST: bewijst dat het vastgepinde model echt antwoordt, via deze proxy.
// Schrijft niets in een databank zolang de URL naar LIVE wijst (cache uit).
// ─────────────────────────────────────────────────────────────────────────────

async function rooktest(url) {
  const { GEMINI_TEXT_MODEL, isValidFrayerModel, cleanJsonOutput } = await import('../shared/frayerPrompt.ts');
  const verwacht = versie => typeof versie === 'string' && versie.startsWith(GEMINI_TEXT_MODEL);
  let fouten = 0;

  async function post(body) {
    const start = Date.now();
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '127.0.0.1' },
      body: JSON.stringify(body),
    });
    return { status: r.status, data: await r.json(), ms: Date.now() - start };
  }
  function meld(ok, tekst) {
    if (!ok) fouten++;
    console.log(`${ok ? '✓' : '✗'} ${tekst}`);
  }

  // 1. Oude alias op het gewone pad → moet op het vastgepinde model uitkomen.
  const alias = await post({
    model: 'gemini-flash-latest',
    feature: 'rooktest',
    contents: 'Antwoord met exact één woord: ok',
    config: { thinkingConfig: { thinkingBudget: 0 } },
  });
  meld(
    alias.status === 200 && verwacht(alias.data.modelVersion) && alias.data.cached === false,
    `alias gemini-flash-latest → status ${alias.status}, modelVersion ${alias.data.modelVersion ?? alias.data.error}, cached ${alias.data.cached} (${alias.ms} ms)`,
  );

  // 2. Drie Frayer-woorden via het nieuwe pad (prompt door de server gebouwd).
  const woorden = [
    { word: 'factuur', context: 'Woordenschat 2DF', difficulty: 'Beginner' },
    { word: 'opbellen', context: '', difficulty: 'Gemiddeld' },
    { word: 'virus', context: 'Applicatie- & Databeheer (APPDA)', difficulty: 'Gevorderd' },
  ];
  for (const frayer of woorden) {
    const r = await post({ feature: 'frayer', model: GEMINI_TEXT_MODEL, frayer });
    let model = null;
    try {
      model = JSON.parse(cleanJsonOutput(r.data.text ?? ''));
    } catch {
      model = null;
    }
    const geldig = isValidFrayerModel(model);
    const ok = r.status === 200 && geldig && (r.data.cached === true || verwacht(r.data.modelVersion));
    const tokens = r.data.usage
      ? `${r.data.usage.promptTokenCount} in / ${r.data.usage.candidatesTokenCount} uit / ${r.data.usage.thoughtsTokenCount ?? 0} denk`
      : 'geen (cache)';
    meld(ok, `Frayer "${frayer.word}" (${frayer.context || 'geen vak'}, ${frayer.difficulty}) → status ${r.status}, modelVersion ${r.data.modelVersion ?? r.data.error}, cached ${r.data.cached}, tokens ${tokens} (${r.ms} ms)`);
    if (geldig) console.log(`    definitie: ${String(model.definitie).slice(0, 110)}`);
  }

  console.log(fouten === 0 ? '\nRooktest geslaagd.' : `\nRooktest: ${fouten} fout(en).`);
  return fouten === 0;
}

// ─────────────────────────────────────────────────────────────────────────────

const isHoofdscript =
  process.argv[1] &&
  resolve(fileURLToPath(import.meta.url)).toLowerCase() === resolve(process.argv[1]).toLowerCase();

if (isHoofdscript) {
  const isRooktest = process.argv.includes('--rooktest');
  const api = await startDevApi({ zonderLogin: isRooktest, poort: isRooktest ? 0 : undefined });
  if (isRooktest) {
    let ok = false;
    try {
      ok = await rooktest(api.url);
    } finally {
      api.server.close();
    }
    process.exit(ok ? 0 : 1);
  } else {
    console.log('Klaar. Start de app met VITE_USE_PROXY=1 om via deze proxy te werken. Ctrl+C stopt.');
    process.on('SIGINT', () => {
      api.server.close();
      process.exit(0);
    });
  }
}
