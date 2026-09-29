// Integratietest van de Frayer-cache: echte proxy (in dit proces), echte Gemini,
// echte TESTdatabank. Weigert te draaien zolang .env.local naar de LIVE databank wijst.
//
// Start: npm run test:api
//
// Wat het doet:
//   - maakt een tijdelijke testgebruiker aan in de testdatabank (willekeurig
//     wachtwoord, nergens bewaard) en meldt die aan voor een echte sessie-token;
//   - start de lokale proxy (scripts/dev-api.mjs) op een vrije poort;
//   - T0–T9 (zie hieronder), 1 mini- en 4 Frayer-aanroepen naar Gemini;
//   - ruimt altijd op: frayer_cache-rijen met context 'testrun-%' en de testgebruiker.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { laadEnv, supabaseRef, zetServerNamen } from './load-env.mjs';
import { LIVE_SUPABASE_REF } from '../api/gemini.ts';

laadEnv();
zetServerNamen();

// ── 0. Veiligheidsslot: nooit tegen live ────────────────────────────────────
const urls = [process.env.SUPABASE_URL, process.env.VITE_SUPABASE_URL].filter(Boolean);
if (urls.some(u => u.includes(LIVE_SUPABASE_REF))) {
  console.error('\n✗ GEWEIGERD: .env.local (of je omgeving) wijst naar de LIVE databank.');
  console.error('  Deze test schrijft in frayer_cache en maakt een testgebruiker aan. Zet eerst de');
  console.error('  gegevens van het TEST-project in .env.local (zie test-omgeving/LEESMIJ.md).\n');
  process.exit(1);
}
const nodig = ['GEMINI_API_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const ontbreekt = nodig.filter(n => !process.env[n]);
if (ontbreekt.length) {
  console.error(`\n✗ Ontbreekt in .env.local: ${ontbreekt.join(', ')} (zie test-omgeving/LEESMIJ.md).\n`);
  process.exit(1);
}

const URL_DB = process.env.SUPABASE_URL;
const RUN = randomBytes(4).toString('hex');
const CONTEXT = `testrun-${RUN}`;
const zonderSessie = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(URL_DB, process.env.SUPABASE_SERVICE_ROLE_KEY, zonderSessie);
// Twee aparte publieke clients: na signInWithPassword stuurt een client de sessie van de
// testgebruiker mee, dus voor de anon-controle (T9) is een client nodig die nooit aanmeldt.
const aanmelden = createClient(URL_DB, process.env.SUPABASE_ANON_KEY, zonderSessie);
const anoniem = createClient(URL_DB, process.env.SUPABASE_ANON_KEY, zonderSessie);

console.log(`Testdatabank: ${supabaseRef(URL_DB)} — testrun ${RUN}`);

let fouten = 0;
async function stap(naam, werk) {
  try {
    await werk();
    console.log(`✓ ${naam}`);
  } catch (err) {
    fouten++;
    console.log(`✗ ${naam}: ${err.message.split('\n')[0]}`);
  }
}

let gebruikerId = null;
let api = null;
try {
  // ── Tijdelijke testgebruiker + echte sessie-token ─────────────────────────
  const email = `testrun-${RUN}@voorbeeld.test`;
  const wachtwoord = randomBytes(24).toString('base64url');
  const aangemaakt = await admin.auth.admin.createUser({ email, password: wachtwoord, email_confirm: true });
  if (aangemaakt.error) throw new Error(`testgebruiker aanmaken mislukt: ${aangemaakt.error.message}`);
  gebruikerId = aangemaakt.data.user.id;
  const sessie = await aanmelden.auth.signInWithPassword({ email, password: wachtwoord });
  if (sessie.error) throw new Error(`aanmelden mislukt: ${sessie.error.message} (staat "Email" aan bij Authentication → Providers?)`);
  const token = sessie.data.session.access_token;

  // ── Proxy starten (in dit proces, vrije poort) ────────────────────────────
  const { startDevApi } = await import('./dev-api.mjs');
  api = await startDevApi({ poort: 0, stil: true });
  if (!api.status.aan) throw new Error(`de Frayer-cache staat niet aan: ${api.status.reden}`);

  async function post(body, { metToken = true } = {}) {
    const start = Date.now();
    const headers = { 'Content-Type': 'application/json' };
    if (metToken) headers.Authorization = `Bearer ${token}`;
    const r = await fetch(api.url, { method: 'POST', headers, body: JSON.stringify(body) });
    return { status: r.status, data: await r.json(), ms: Date.now() - start };
  }
  const rij = async sleutel => {
    const { data, error } = await admin.from('frayer_cache').select('*').eq('cache_key', sleutel).maybeSingle();
    if (error) throw new Error(`frayer_cache lezen: ${error.message}`);
    return data;
  };
  const isVast = versie => typeof versie === 'string' && versie.startsWith('gemini-2.5-flash');
  const FACTUUR = { word: 'factuur', context: CONTEXT, difficulty: 'Beginner' };
  // Woord in kleine letters, vak exact, niveau canoniek (zie frayerCacheKey).
  const SLEUTEL = `v1|factuur|${CONTEXT}|Beginner`;
  let eersteModel = null;

  await stap('T0 zonder sessie-token → 401 (aanmeldcontrole staat aan)', async () => {
    const r = await post({ frayer: FACTUUR }, { metToken: false });
    assert.equal(r.status, 401);
  });

  await stap('T1 oude alias gemini-flash-latest → modelVersion gemini-2.5-flash', async () => {
    const r = await post({ model: 'gemini-flash-latest', feature: 'test', contents: 'Antwoord met exact één woord: ok', config: { thinkingConfig: { thinkingBudget: 0 } } });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.ok(isVast(r.data.modelVersion), `modelVersion ${r.data.modelVersion}`);
    assert.equal(r.data.cached, false);
  });

  await stap('T2 model buiten de whitelist → 400', async () => {
    for (const model of ['gemini-2.5-pro', 'gemini-3.8-flash']) {
      const r = await post({ model, contents: 'x' });
      assert.equal(r.status, 400, model);
    }
  });

  await stap('T3 eerste aanvraag → miss: Gemini, geldig model, rij bewaard', async () => {
    const r = await post({ feature: 'frayer', model: 'gemini-2.5-flash', frayer: FACTUUR });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.cached, false);
    assert.ok(isVast(r.data.modelVersion), `modelVersion ${r.data.modelVersion}`);
    eersteModel = JSON.parse(r.data.text);
    const bewaard = await rij(SLEUTEL);
    assert.ok(bewaard, 'geen rij in frayer_cache');
    assert.equal(bewaard.word, 'factuur');
    assert.equal(bewaard.context, CONTEXT);
    assert.equal(bewaard.difficulty, 'Beginner');
    assert.equal(bewaard.prompt_version, 1);
    assert.ok(isVast(bewaard.model_version));
    assert.deepEqual(bewaard.model_data, eersteModel);
  });

  await stap('T4 zelfde aanvraag → hit, < 1,5 s, identiek model, teller +1', async () => {
    const r = await post({ feature: 'frayer', model: 'gemini-2.5-flash', frayer: FACTUUR });
    assert.equal(r.status, 200);
    assert.equal(r.data.cached, true);
    assert.equal(r.data.usage, null);
    assert.ok(r.ms < 1500, `duurde ${r.ms} ms`);
    assert.deepEqual(JSON.parse(r.data.text), eersteModel);
    await new Promise(ok => setTimeout(ok, 1000));
    const bewaard = await rij(SLEUTEL);
    assert.ok(bewaard.hit_count >= 1 && bewaard.last_hit_at, `hit_count ${bewaard.hit_count}`);
    console.log(`    (hit in ${r.ms} ms)`);
  });

  await stap('T5 ander niveau → eigen sleutel (miss)', async () => {
    const r = await post({ frayer: { ...FACTUUR, difficulty: 'Gevorderd' } });
    assert.equal(r.status, 200);
    assert.equal(r.data.cached, false);
    assert.ok(await rij(`v1|factuur|${CONTEXT}|Gevorderd`));
  });

  await stap('T6 woord: hoofdletters/witruimte → zelfde sleutel (hit); "beginner" = "Beginner"', async () => {
    const r = await post({ frayer: { word: '  FACTUUR ', context: CONTEXT, difficulty: 'beginner' } });
    assert.equal(r.status, 200);
    assert.equal(r.data.cached, true);
  });

  await stap('T6b vak: andere schrijfwijze → aparte sleutel (miss)', async () => {
    const r = await post({ frayer: { word: 'factuur', context: CONTEXT.toUpperCase(), difficulty: '' } });
    assert.equal(r.status, 200);
    assert.equal(r.data.cached, false);
    assert.ok(await rij(`v1|factuur|${CONTEXT.toUpperCase()}|`), 'eigen rij voor het vak in hoofdletters');
  });

  await stap('T6c onbekend niveau → zelfde sleutel en prompt als leeg (hit)', async () => {
    const r = await post({ frayer: { word: 'Factuur', context: CONTEXT.toUpperCase(), difficulty: 'onzin' } });
    assert.equal(r.status, 200);
    assert.equal(r.data.cached, true);
  });

  await stap('T7 ongeldige woorden → 400', async () => {
    const ongeldig = [{ word: '' }, { word: '   ' }, { word: 'a'.repeat(61) }, { word: 'fac\ntuur' }, { word: 42 }, null, 'factuur'];
    for (const frayer of ongeldig) {
      const r = await post({ frayer });
      assert.equal(r.status, 400, JSON.stringify(frayer));
    }
  });

  await stap('T8 zonder contents en zonder frayer → 400', async () => {
    for (const body of [{}, { model: 'gemini-2.5-flash' }, { feature: 'quiz' }]) {
      const r = await post(body);
      assert.equal(r.status, 400, JSON.stringify(body));
    }
  });

  await stap('T9 RLS via de echte API: leerling en anon zien niets en kunnen niets wijzigen', async () => {
    const leerling = createClient(URL_DB, process.env.SUPABASE_ANON_KEY, {
      ...zonderSessie,
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    // Enkel de proxy (service_role) leest de cache; de rijen van T3-T6 bestaan wel.
    assert.ok((await rij(SLEUTEL)), 'de testrij ontbreekt (T3 mislukt?)');
    const gelezen = await leerling.from('frayer_cache').select('cache_key').eq('context', CONTEXT);
    assert.equal((gelezen.data ?? []).length, 0, `leerling ziet ${(gelezen.data ?? []).length} rijen`);
    const toegevoegd = await leerling.from('frayer_cache').insert({ cache_key: `v1|gif|${CONTEXT}|`, word: 'gif', context: CONTEXT, model_data: {} });
    assert.ok(toegevoegd.error, 'leerling kon toevoegen!');
    const voor = await rij(SLEUTEL);
    await leerling.from('frayer_cache').update({ model_data: { vergif: true } }).eq('cache_key', SLEUTEL);
    await leerling.from('frayer_cache').delete().eq('cache_key', SLEUTEL);
    const na = await rij(SLEUTEL);
    assert.ok(na, 'leerling kon wissen!');
    assert.deepEqual(na.model_data, voor.model_data, 'leerling kon wijzigen!');
    const anon = await anoniem.from('frayer_cache').select('cache_key').eq('context', CONTEXT);
    assert.equal((anon.data ?? []).length, 0, 'anon ziet rijen!');
  });
} catch (err) {
  fouten++;
  console.log(`✗ ${err.message}`);
} finally {
  // ── Altijd opruimen ───────────────────────────────────────────────────────
  const gewist = await admin.from('frayer_cache').delete().ilike('context', 'testrun-%').select('cache_key');
  console.log(gewist.error
    ? `✗ opruimen frayer_cache mislukt: ${gewist.error.message}`
    : `  opgeruimd: ${gewist.data.length} testrij(en) in frayer_cache`);
  if (gebruikerId) {
    const weg = await admin.auth.admin.deleteUser(gebruikerId);
    console.log(weg.error ? `✗ testgebruiker verwijderen mislukt: ${weg.error.message}` : '  opgeruimd: testgebruiker');
  }
  api?.server.close();
}

console.log(fouten === 0 ? '\nAlle cachetests geslaagd.' : `\n${fouten} test(s) mislukt.`);
process.exit(fouten === 0 ? 0 : 1);
