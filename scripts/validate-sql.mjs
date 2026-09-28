// Maakt en valideert de SQL voor een NIEUWE, lege Supabase-testdatabank.
//
//   npm run validate:sql               controleert (Postgres in het geheugen via PGlite)
//   npm run validate:sql -- --schrijf  maakt eerst test-omgeving/*.sql opnieuw aan
//
// test-omgeving/opzet-testdatabank.sql = supabase-setup.sql + alle migration-*.sql
// op datum (zonder de verouderde teacher-upgrade-rpc), met frayer_cache als laatste.
// Mechanisch samengevoegd, zodat de eindtoestand dezelfde is als die van live.
// ZONDER commentaar: de SQL-editor van de opdrachtgever verminkt regels die met
// "--" beginnen. Alles in één transactie: lukt één stap niet, dan verandert er niets.
//
// test-omgeving/frayer-cache-enkel.sql = enkel de frayer_cache-migratie (voor later op live).
//
// Wat hier NIET echt is: PGlite is gewone Postgres, maar zonder Supabase. Daarom
// een kleine nabootsing (SUPABASE_STUB hieronder): schema auth met auth.users en
// auth.uid() (leest de instelling request.jwt.claim.sub, zoals Supabase), de rollen
// anon/authenticated/service_role (service_role omzeilt RLS) met dezelfde standaard-
// rechten als Supabase, en schema extensions. pgcrypto komt uit PGlite zelf.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const MAP = join(ROOT, 'test-omgeving');
const OPZET = join(MAP, 'opzet-testdatabank.sql');
const FRAYER = join(MAP, 'frayer-cache-enkel.sql');
const FRAYER_MIGRATIE = 'migration-2026-09-18-frayer-cache.sql';
const VEROUDERD = ['migration-2026-05-21-teacher-upgrade-rpc.sql']; // stopt meteen met een fout

// ─────────────────────────────────────────────────────────────────────────────
// 1. SQL zonder commentaar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verwijdert -- en /* *\/ commentaar, ook binnen $$-functiecode, maar nooit
 * binnen tekst ('…'), namen ("…") of E'…'-tekst.
 */
export function zonderCommentaar(sql) {
  let uit = '';
  let i = 0;
  const n = sql.length;
  const isNaamteken = ch => ch !== undefined && /[A-Za-z0-9_$]/.test(ch);
  while (i < n) {
    const c = sql[i];
    const d = sql[i + 1];
    if (c === '-' && d === '-') {
      // Een regel met enkel commentaar verdwijnt helemaal (geen lege regel midden in een tabel).
      const regelStart = uit.lastIndexOf('\n') + 1;
      const heleRegel = /^[ \t]*$/.test(uit.slice(regelStart));
      while (i < n && sql[i] !== '\n') i++;
      if (heleRegel) {
        uit = uit.slice(0, regelStart);
        i++;
      }
      continue;
    }
    if (c === '/' && d === '*') {
      let diepte = 1;
      i += 2;
      while (i < n && diepte > 0) {
        if (sql[i] === '/' && sql[i + 1] === '*') { diepte++; i += 2; }
        else if (sql[i] === '*' && sql[i + 1] === '/') { diepte--; i += 2; }
        else i++;
      }
      continue;
    }
    if (c === "'" || c === '"') {
      const metBackslash = c === "'" && /[eE]/.test(sql[i - 1] ?? '') && !isNaamteken(sql[i - 2]);
      let j = i + 1;
      while (j < n) {
        if (metBackslash && sql[j] === '\\') { j += 2; continue; }
        if (sql[j] === c) {
          if (sql[j + 1] === c) { j += 2; continue; }
          break;
        }
        j++;
      }
      if (j >= n) throw new Error(`niet afgesloten ${c}-tekst vanaf positie ${i}`);
      uit += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === '$' && !isNaamteken(sql[i - 1])) {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i, i + 80));
      if (m) {
        const tag = m[0];
        const eind = sql.indexOf(tag, i + tag.length);
        if (eind < 0) throw new Error(`niet afgesloten ${tag}-blok vanaf positie ${i}`);
        uit += tag + zonderCommentaar(sql.slice(i + tag.length, eind)) + tag;
        i = eind + tag.length;
        continue;
      }
    }
    uit += c;
    i++;
  }
  return uit;
}

/** Witruimte opruimen: geen spaties achteraan, hoogstens één lege regel na elkaar. */
function netjes(sql) {
  const regels = sql.replace(/\r\n?/g, '\n').split('\n').map(r => r.replace(/\s+$/, ''));
  const uit = [];
  for (const r of regels) {
    if (r === '' && (uit.length === 0 || uit[uit.length - 1] === '')) continue;
    uit.push(r);
  }
  while (uit.length && uit[uit.length - 1] === '') uit.pop();
  return uit.join('\n');
}

/** Losse BEGIN;/COMMIT; weg: het geheel draait in één eigen transactie. */
const zonderTransactie = sql => sql.split('\n').filter(r => !/^\s*(BEGIN|COMMIT)\s*;\s*$/i.test(r)).join('\n');

const bron = naam => readFileSync(join(ROOT, naam), 'utf8');
const inTransactie = delen => `BEGIN;\n\n${delen.join('\n\n')}\n\nCOMMIT;\n`;

export function bronvolgorde() {
  const migraties = readdirSync(ROOT)
    .filter(f => /^migration-\d{4}-\d{2}-\d{2}-.+\.sql$/.test(f))
    .filter(f => !VEROUDERD.includes(f) && f !== FRAYER_MIGRATIE)
    .sort();
  return ['supabase-setup.sql', ...migraties, FRAYER_MIGRATIE];
}

export function maakOpzetSql() {
  return inTransactie(bronvolgorde().map(f => netjes(zonderTransactie(zonderCommentaar(bron(f))))));
}

export function maakFrayerSql() {
  return inTransactie([netjes(zonderTransactie(zonderCommentaar(bron(FRAYER_MIGRATIE))))]);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Nabootsing van wat Supabase standaard heeft (enkel voor PGlite)
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_STUB = `
CREATE ROLE anon NOLOGIN NOINHERIT;
CREATE ROLE authenticated NOLOGIN NOINHERIT;
CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY,
  email text,
  raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
CREATE SCHEMA extensions;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
`;

async function nieuweDb() {
  const { PGlite } = await import('@electric-sql/pglite');
  const { pgcrypto } = await import('@electric-sql/pglite/contrib/pgcrypto');
  const db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STUB);
  return db;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Controles
// ─────────────────────────────────────────────────────────────────────────────

let fouten = 0;
function meld(ok, tekst) {
  if (!ok) fouten++;
  console.log(`${ok ? '✓' : '✗'} ${tekst}`);
}
async function lukt(werk, tekst) {
  try {
    await werk();
    meld(true, tekst);
  } catch (err) {
    meld(false, `${tekst}: ${err.message}`);
  }
}
async function faalt(werk, patroon, tekst) {
  try {
    await werk();
    meld(false, `${tekst}: GEEN fout (verwacht: ${patroon})`);
  } catch (err) {
    meld(patroon.test(err.message), `${tekst} (${err.message.split('\n')[0]})`);
  }
}

/** Voert `werk` uit als Supabase-rol, met `sub` als ingelogde gebruiker (of niemand). */
async function alsRol(db, rol, sub, werk) {
  await db.query(`SELECT set_config('request.jwt.claim.sub', $1, false)`, [sub ?? '']);
  await db.exec(`SET ROLE ${rol}`);
  try {
    return await werk();
  } finally {
    await db.exec('RESET ROLE');
    await db.query(`SELECT set_config('request.jwt.claim.sub', '', false)`);
  }
}

const RIJ = `('v1|toets|testrun-sql|Beginner', 'toets', 'testrun-sql', 'Beginner', 1, 'gemini-2.5-flash',
  '{"definitie":"d","voorbeelden":[{"zin":"z","gebruiktWoord":"toets"}],"synoniemen":[],"antoniemen":[]}'::jsonb)`;
const KOLOMMEN = '(cache_key, word, context, difficulty, prompt_version, model_version, model_data)';

async function controleerFrayerRls(db, label) {
  const leerling = '11111111-1111-1111-1111-111111111111';
  const tel = async () => Number((await db.query(`SELECT count(*)::int AS n FROM public.frayer_cache`)).rows[0].n);
  const hits = async () => Number((await db.query(`SELECT hit_count FROM public.frayer_cache WHERE cache_key = 'v1|toets|testrun-sql|Beginner'`)).rows[0]?.hit_count ?? -1);

  await lukt(() => alsRol(db, 'service_role', null, () => db.exec(`INSERT INTO public.frayer_cache ${KOLOMMEN} VALUES ${RIJ}`)),
    `${label}: service_role mag schrijven (insert)`);
  await lukt(() => alsRol(db, 'service_role', null, async () => {
    const r = await db.query(`UPDATE public.frayer_cache SET hit_count = hit_count + 1, last_hit_at = now() WHERE context = 'testrun-sql'`);
    if (r.affectedRows !== 1) throw new Error(`${r.affectedRows} rijen bijgewerkt`);
  }), `${label}: service_role mag bijwerken (update)`);

  const gezien = await alsRol(db, 'authenticated', leerling, async () =>
    (await db.query(`SELECT cache_key FROM public.frayer_cache`)).rows.length);
  meld(gezien === 1, `${label}: ingelogde gebruiker mag lezen (${gezien} rij)`);

  await faalt(() => alsRol(db, 'authenticated', leerling, () => db.exec(
    `INSERT INTO public.frayer_cache ${KOLOMMEN} VALUES ('v1|gif|x|', 'gif', 'x', '', 1, 'x', '{}'::jsonb)`)),
  /row-level security/i, `${label}: ingelogde gebruiker mag NIET toevoegen`);
  const voorHits = await hits();
  const bijgewerkt = await alsRol(db, 'authenticated', leerling, async () =>
    (await db.query(`UPDATE public.frayer_cache SET hit_count = 999, model_data = '{"vergif":true}'::jsonb`)).affectedRows);
  meld(bijgewerkt === 0 && (await hits()) === voorHits, `${label}: ingelogde gebruiker mag NIET wijzigen (${bijgewerkt} rijen)`);
  const gewist = await alsRol(db, 'authenticated', leerling, async () =>
    (await db.query(`DELETE FROM public.frayer_cache`)).affectedRows);
  meld(gewist === 0 && (await tel()) === 1, `${label}: ingelogde gebruiker mag NIET wissen (${gewist} rijen)`);

  const anonZiet = await alsRol(db, 'anon', null, async () =>
    (await db.query(`SELECT cache_key FROM public.frayer_cache`)).rows.length);
  meld(anonZiet === 0, `${label}: anon ziet niets (${anonZiet} rijen)`);
  await faalt(() => alsRol(db, 'anon', null, () => db.exec(
    `INSERT INTO public.frayer_cache ${KOLOMMEN} VALUES ('v1|anon|x|', 'anon', 'x', '', 1, 'x', '{}'::jsonb)`)),
  /row-level security/i, `${label}: anon mag NIET toevoegen`);
  const anonGewijzigd = await alsRol(db, 'anon', null, async () =>
    (await db.query(`UPDATE public.frayer_cache SET hit_count = 5`)).affectedRows +
    (await db.query(`DELETE FROM public.frayer_cache`)).affectedRows);
  meld(anonGewijzigd === 0 && (await tel()) === 1, `${label}: anon mag NIET wijzigen of wissen`);

  await lukt(() => alsRol(db, 'service_role', null, async () => {
    const r = await db.query(`DELETE FROM public.frayer_cache WHERE context LIKE 'testrun-%'`);
    if (r.affectedRows !== 1) throw new Error(`${r.affectedRows} rijen gewist`);
  }), `${label}: service_role mag opruimen (delete)`);
}

async function valideer(opzet, frayer) {
  // ── A. Volledige opzet op een lege "Supabase" ─────────────────────────────
  console.log('\nA. opzet-testdatabank.sql op een lege databank');
  const db = await nieuweDb();
  await lukt(() => db.exec(opzet), 'voert foutloos uit');
  await lukt(() => db.exec(opzet), 'tweede keer ook foutloos (idempotent)');
  await lukt(() => db.exec(frayer), 'frayer-cache-enkel.sql erbovenop: foutloos (idempotent)');

  const verwacht = ['public.profiles', 'public.practice_sessions', 'public.word_progress', 'public.feedback',
    'public.registered_students', 'public.game_settings', 'public.ai_usage_log', 'public.frayer_cache',
    'private.app_settings', 'private.teacher_code_attempts'];
  const tabellen = (await db.query(
    `SELECT table_schema || '.' || table_name AS t FROM information_schema.tables
     WHERE table_schema IN ('public', 'private') AND table_type = 'BASE TABLE'`)).rows.map(r => r.t);
  const ontbreekt = verwacht.filter(t => !tabellen.includes(t));
  meld(ontbreekt.length === 0, `alle tabellen aanwezig (${tabellen.length})${ontbreekt.length ? ' — ontbreekt: ' + ontbreekt.join(', ') : ''}`);

  const functies = (await db.query(
    `SELECT n.nspname || '.' || p.proname AS f FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname IN ('public', 'private')`)).rows.map(r => r.f);
  const nodigeFuncties = ['public.is_teacher', 'public.is_admin', 'public.handle_new_user', 'public.upsert_word_progress',
    'public.reset_my_data', 'public.get_public_stats', 'public.get_ai_usage_stats', 'public.profiles_guard',
    'public.upgrade_to_teacher', 'private.set_teacher_code'];
  const functieOntbreekt = nodigeFuncties.filter(f => !functies.includes(f));
  meld(functieOntbreekt.length === 0, `alle functies aanwezig${functieOntbreekt.length ? ' — ontbreekt: ' + functieOntbreekt.join(', ') : ''}`);

  // De controle die ook op live gedraaid werd (controle-2026-09-24-beveiliging.sql).
  const resultaten = await db.exec(readFileSync(join(ROOT, 'controle-2026-09-24-beveiliging.sql'), 'utf8'));
  const checks = resultaten[0].rows;
  const nietOk = checks.filter(r => r.ok !== '✅');
  meld(checks.length >= 13 && nietOk.length === 0,
    `beveiligingscontrole: ${checks.length - nietOk.length}/${checks.length} ✅${nietOk.map(r => ` — ✗ ${r.nr} ${r.controle}: ${r.toestand}`).join('')}`);
  const code = resultaten[resultaten.length - 1].rows[0]?.leerkrachtcode ?? '';
  meld(code.startsWith('❌'), 'geen leerkrachtcode ingesteld (hoort zo: stel ze zelf in, zie LEESMIJ)');

  await controleerFrayerRls(db, 'frayer_cache');

  // Enkele kernpunten van de app zelf.
  const leerling = '22222222-2222-2222-2222-222222222222';
  await lukt(() => db.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'jan.peeters@voorbeeld.test')`, [leerling]),
    'nieuwe gebruiker aanmaken (trigger maakt profiel)');
  const profiel = (await db.query(`SELECT role, full_name FROM public.profiles WHERE id = $1`, [leerling])).rows[0];
  meld(profiel?.role === 'student' && profiel?.full_name === 'Jan Peeters', `profiel automatisch: ${JSON.stringify(profiel)}`);
  await lukt(() => alsRol(db, 'authenticated', leerling, () =>
    db.query(`UPDATE public.profiles SET klas = 'AF 6e' WHERE id = $1`, [leerling])), 'leerling mag eigen klas wijzigen');
  await faalt(() => alsRol(db, 'authenticated', leerling, () =>
    db.query(`UPDATE public.profiles SET role = 'admin' WHERE id = $1`, [leerling])),
  /niet zelf aanpassen/, 'leerling kan zichzelf GEEN admin maken (profiles_guard)');
  const upgrade = await alsRol(db, 'authenticated', leerling, async () =>
    (await db.query(`SELECT public.upgrade_to_teacher('eender-welke-code') AS r`)).rows[0].r);
  meld(upgrade?.success === false && /nog niet ingesteld/.test(upgrade?.error ?? ''),
    `upgrade_to_teacher zonder ingestelde code: ${JSON.stringify(upgrade)}`);
  await lukt(() => alsRol(db, 'authenticated', leerling, () => db.query(
    `INSERT INTO public.ai_usage_log (user_id, feature, model, success) VALUES ($1, 'frayer-cache', 'cache', true)`, [leerling])),
  'leerling mag eigen AI-verbruik loggen (ai_usage_log, zoals services/aiUsage.ts)');
  await faalt(() => alsRol(db, 'authenticated', leerling, () => db.query(`SELECT public.get_ai_usage_stats(7)`)),
    /Enkel beheerders/, 'leerling kan het AI-verbruik NIET opvragen');
  await db.query(`UPDATE public.profiles SET role = 'admin' WHERE id = $1`, [leerling]);
  const verbruik = await alsRol(db, 'authenticated', leerling, async () =>
    (await db.query(`SELECT public.get_ai_usage_stats(7) AS s`)).rows[0].s);
  meld(verbruik?.total_rows === 1 && verbruik.features?.[0]?.feature === 'frayer-cache',
    `get_ai_usage_stats() voor een admin (incl. Europe/Brussels): ${verbruik?.total_rows} rij, functie ${verbruik?.features?.[0]?.feature}`);
  const teller = await alsRol(db, 'anon', null, async () => (await db.query(`SELECT public.get_public_stats() AS s`)).rows[0].s);
  meld(teller && typeof teller.sessions === 'number', `get_public_stats() voor anon: ${JSON.stringify(teller)}`);
  const spel = (await db.query(`SELECT id FROM public.game_settings`)).rows;
  meld(spel.length === 1 && spel[0].id === 'global', 'game_settings: enkel de standaardrij "global"');
  await db.close();

  // ── B. Enkel de frayer_cache-migratie (zoals later op live) ──────────────
  console.log('\nB. frayer-cache-enkel.sql op een lege databank');
  const db2 = await nieuweDb();
  await lukt(() => db2.exec(frayer), 'voert foutloos uit');
  await lukt(() => db2.exec(frayer), 'tweede keer ook foutloos (idempotent)');
  await controleerFrayerRls(db2, 'enkel frayer_cache');
  await db2.close();
}

// ─────────────────────────────────────────────────────────────────────────────

const schrijf = process.argv.includes('--schrijf');
const opzet = maakOpzetSql();
const frayer = maakFrayerSql();

console.log(`Bronnen (in deze volgorde): ${bronvolgorde().join(', ')}`);
console.log(`Weggelaten: ${VEROUDERD.join(', ')} (verouderd, stopt met een fout)`);

if (schrijf) {
  mkdirSync(MAP, { recursive: true });
  writeFileSync(OPZET, opzet);
  writeFileSync(FRAYER, frayer);
  console.log('✓ test-omgeving/opzet-testdatabank.sql en frayer-cache-enkel.sql (opnieuw) gemaakt');
}

const opSchijf = pad => {
  try {
    return readFileSync(pad, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    return null;
  }
};
for (const [pad, verwacht] of [[OPZET, opzet], [FRAYER, frayer]]) {
  const naam = pad.slice(ROOT.length).replaceAll('\\', '/');
  const tekst = opSchijf(pad);
  meld(tekst === verwacht, `${naam} is up-to-date met de bronbestanden${tekst === verwacht ? '' : ' — draai: npm run validate:sql -- --schrijf'}`);
  if (tekst === null) continue;
  const commentaar = tekst.split('\n').map((r, i) => [i + 1, r]).filter(([, r]) => r.includes('--') || r.includes('/*'));
  meld(commentaar.length === 0, `${naam}: geen commentaar (-- of /*)${commentaar.length ? ' — regels ' + commentaar.map(([n]) => n).join(', ') : ''}`);
  meld(!/set_teacher_code\s*\(\s*'/i.test(tekst) && !/valid_code/i.test(tekst), `${naam}: geen leerkrachtcode in klare tekst`);
}

await valideer(opzet, frayer);

console.log(fouten === 0 ? '\nAlle SQL-controles geslaagd.' : `\n${fouten} controle(s) mislukt.`);
process.exit(fouten === 0 ? 0 : 1);
