// Tests van de hotfix in versie 1 (tak fix/mira-aanmelding), zonder browser en zonder netwerk.
//
// De ECHTE broncode (contexts/AuthContext.tsx, ...) wordt met esbuild (dat Vite al meebrengt) gebundeld met:
//  - een kleine React in het geheugen: genoeg hooks om een component of een hook te laten lopen;
//  - de ECHTE auth-js van Supabase (dezelfde versie als de app), met opslag in het geheugen en een
//    nagebootste aanmeldserver op een .invalid-adres (elk verzoek wordt bijgehouden);
//  - nagebootste services/supabase (from) en services/db.
//
// Start: npm run test:hotfix
// Zelfde tests tegen de code op main (om te zien dat ze zonder de hotfix falen):
//   HOTFIX_BRON=main node scripts/test-hotfix-v1.mjs
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const requireRoot = createRequire(join(ROOT, 'package.json'));
const esbuild = createRequire(requireRoot.resolve('vite/package.json'))('esbuild');
const { GoTrueClient } = createRequire(requireRoot.resolve('@supabase/supabase-js'))('@supabase/auth-js');
const BRON = process.env.HOTFIX_BRON || null; // bv. 'main': elk bronbestand uit git show main:…

const UIT = mkdtempSync(join(tmpdir(), 'tvt-hotfix-'));
after(() => rmSync(UIT, { recursive: true, force: true }));

const wacht = ms => new Promise(ok => setTimeout(ok, ms));
console.log = () => {}; // de diagnoselog van AuthContext niet tonen
const waarschuwingen = [];
console.warn = (...delen) => waarschuwingen.push(delen.map(String).join(' '));
console.error = (...delen) => waarschuwingen.push(delen.map(String).join(' '));

// ── localStorage in het geheugen (de app en supabase-js delen hem, zoals in de browser) ──
class Opslag {
  #kaart = new Map();
  get length() { return this.#kaart.size; }
  key(i) { return [...this.#kaart.keys()][i] ?? null; }
  getItem(k) { return this.#kaart.has(k) ? this.#kaart.get(k) : null; }
  setItem(k, v) { this.#kaart.set(String(k), String(v)); }
  removeItem(k) { this.#kaart.delete(k); }
  clear() { this.#kaart.clear(); }
  sleutels() { return [...this.#kaart.keys()]; }
}
globalThis.localStorage = new Opslag();

// ── Een kleine React ─────────────────────────────────────────────────────────
// useState plant een nieuwe render (microtask, gebundeld zoals React), useEffect loopt na de render als
// de afhankelijkheden veranderden, useMemo/useCallback onthouden per afhankelijkheden.
function nieuweMiniReact() {
  let comp = null;
  let props = null;
  let slots = [];
  let idx = 0;
  let laatste = null;
  let gepland = false;
  let effecten = [];
  let fout = null;
  const zelfde = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const plan = () => {
    if (gepland || !comp) return;
    gepland = true;
    // Een fout tijdens een latere render (zoals in React) komt bij de volgende huidig() boven.
    queueMicrotask(() => { gepland = false; if (comp) { try { render(); } catch (e) { fout = e; } } });
  };
  function render() {
    idx = 0;
    laatste = comp(props);
    const nu = effecten;
    effecten = [];
    for (const e of nu) e();
  }
  const R = {
    createContext(standaard) { const ctx = { _standaard: standaard }; ctx.Provider = { _context: ctx }; return ctx; },
    useContext: ctx => ctx._standaard,
    useState(begin) {
      const i = idx++;
      if (!(i in slots)) {
        const slot = { waarde: typeof begin === 'function' ? begin() : begin };
        slot.zet = nieuw => {
          const v = typeof nieuw === 'function' ? nieuw(slot.waarde) : nieuw;
          if (Object.is(v, slot.waarde)) return;
          slot.waarde = v;
          plan();
        };
        slots[i] = slot;
      }
      return [slots[i].waarde, slots[i].zet];
    },
    useRef(begin) { const i = idx++; if (!(i in slots)) slots[i] = { current: begin }; return slots[i]; },
    useMemo(fn, deps) {
      const i = idx++;
      if (!(i in slots) || !zelfde(slots[i].deps, deps)) slots[i] = { waarde: fn(), deps };
      return slots[i].waarde;
    },
    useCallback(fn, deps) { return R.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const i = idx++;
      const oud = slots[i];
      if (oud && zelfde(oud.deps, deps)) return;
      slots[i] = { deps, opruimen: oud?.opruimen };
      effecten.push(() => {
        if (typeof slots[i].opruimen === 'function') slots[i].opruimen();
        slots[i].opruimen = fn();
      });
    },
    mount(c, p) { comp = c; props = p; slots = []; render(); },
    huidig() { if (fout) throw fout; return laatste; },
    ontkoppel() {
      for (const s of slots) if (s && typeof s.opruimen === 'function') s.opruimen();
      comp = null;
    },
  };
  return R;
}

const REACT_MODULE = `
const R = () => globalThis.__miniReact;
// createContext loopt al bij het laden van de module, vóór een render: zonder toestand.
export const createContext = standaard => { const ctx = { _standaard: standaard }; ctx.Provider = { _context: ctx }; return ctx; };
export const useContext = (...a) => R().useContext(...a);
export const useState = (...a) => R().useState(...a);
export const useRef = (...a) => R().useRef(...a);
export const useMemo = (...a) => R().useMemo(...a);
export const useCallback = (...a) => R().useCallback(...a);
export const useEffect = (...a) => R().useEffect(...a);
export const Fragment = 'Fragment';
export const Suspense = 'Suspense';
export const lazy = laad => ({ __lazy: laad });
export default { createContext, useContext, useState, useRef, useMemo, useCallback, useEffect, Fragment, Suspense, lazy };`;
const JSX_MODULE = `
export const jsx = (type, props, key) => ({ type, props, key });
export const jsxs = jsx;
export const jsxDEV = jsx;
export const Fragment = 'Fragment';`;

// ── Bundelen ─────────────────────────────────────────────────────────────────
/**
 * Bundelt een bronbestand van de app met de kleine React en de gegeven vervangers
 * ({ regex op het importpad: broncode }) en import.meta.env (DEV false + env). Geeft de geladen module terug.
 */
async function bundel(naam, bronPad, vervangers = {}, env = {}, metStandaard = false) {
  const ingang = join(ROOT, bronPad).replace(/\\/g, '/');
  const uit = join(UIT, `${naam}.mjs`);
  const virtueel = [
    [/^react$/, REACT_MODULE],
    [/^react\/jsx-(dev-)?runtime$/, JSX_MODULE],
    ...Object.entries(vervangers).map(([bron, code]) => [new RegExp(bron), code]),
  ];
  await esbuild.build({
    stdin: { contents: `export * from ${JSON.stringify(ingang)};${metStandaard ? ` export { default } from ${JSON.stringify(ingang)};` : ''}`, resolveDir: ROOT, loader: 'js' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: uit,
    logLevel: 'silent',
    jsx: 'automatic',
    define: { 'import.meta.env': JSON.stringify({ DEV: false, PROD: true, ...env }) },
    plugins: [{
      name: 'hotfix-test',
      setup(b) {
        b.onResolve({ filter: /.*/ }, args => {
          const i = virtueel.findIndex(([re]) => re.test(args.path));
          return i >= 0 ? { path: `v${i}`, namespace: 'virtueel' } : undefined;
        });
        b.onLoad({ filter: /.*/, namespace: 'virtueel' }, args => ({ contents: virtueel[Number(args.path.slice(1))][1], loader: 'js', resolveDir: ROOT }));
        if (BRON) {
          // Elk bronbestand van de app zoals het op BRON staat (bv. main).
          b.onLoad({ filter: /\.(tsx?|jsx?)$/ }, args => {
            const rel = relative(ROOT, args.path).replace(/\\/g, '/');
            if (rel.startsWith('..') || rel.startsWith('node_modules/')) return undefined;
            const inhoud = execFileSync('git', ['show', `${BRON}:${rel}`], { cwd: ROOT, encoding: 'utf8' });
            return { contents: inhoud, loader: args.path.endsWith('x') ? 'tsx' : 'ts', resolveDir: dirname(args.path) };
          });
        }
      },
    }],
  });
  return import(pathToFileURL(uit).href);
}

// ── Supabase nagebootst: de ECHTE auth-js, opslag = localStorage, server op .invalid ──
const OPSLAGSLEUTEL = 'sb-nepproject-auth-token';
const nu = () => Math.floor(Date.now() / 1000);

/** Slot zoals navigator.locks: exclusief per naam, toekenning pas in een volgende taak (volgorde van een echte browser). */
function browserSlot() {
  const rijen = new Map();
  return async (naam, _timeout, fn) => {
    const vorige = rijen.get(naam) || Promise.resolve();
    let vrij;
    const mijn = new Promise(ok => { vrij = ok; });
    rijen.set(naam, vorige.then(() => mijn));
    await vorige;
    await new Promise(ok => setTimeout(ok, 0));
    try { return await fn(); } finally { vrij(); }
  };
}

/**
 * Zet een scenario klaar: een bewaarde sessie voor `adres` (of geen), en hoe de server op /logout
 * antwoordt ('ok', '500', 'netwerk' of 'hangt').
 */
function nepSupabase({ adres = null, verlopen = false, slot = 'browser', logout = 'ok' } = {}) {
  localStorage.clear();
  const gebruiker = adres && {
    id: '00000000-0000-4000-8000-00000000b001', aud: 'authenticated', role: 'authenticated', email: adres,
    app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString(),
  };
  if (gebruiker) {
    localStorage.setItem(OPSLAGSLEUTEL, JSON.stringify({
      access_token: 'nep-toegang', refresh_token: 'nep-vernieuw', token_type: 'bearer', expires_in: 3600,
      expires_at: verlopen ? nu() - 30 : nu() + 3600, user: gebruiker,
    }));
  }
  const log = { fetch: [], from: [] };
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const nepFetch = async (url, init = {}) => {
    const pad = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0];
    log.fetch.push(`${(init.method || 'GET').toUpperCase()} ${pad}`);
    if (pad.endsWith('/logout')) {
      if (logout === '500') return json(500, { code: 500, error_code: 'unexpected_failure', msg: 'serverfout' });
      if (logout === 'netwerk') throw new TypeError('fetch failed');
      if (logout === 'hangt') return new Promise(() => {});
      return new Response(null, { status: 204 });
    }
    if (pad.endsWith('/token')) {
      return json(200, { access_token: 'nep-toegang-2', refresh_token: 'nep-vernieuw-2', token_type: 'bearer', expires_in: 3600, expires_at: nu() + 3600, user: gebruiker });
    }
    if (pad.endsWith('/user')) return json(200, gebruiker ?? {});
    return json(404, { msg: 'niet nagebootst' });
  };
  const auth = new GoTrueClient({
    url: 'https://nepproject.invalid/auth/v1',
    storageKey: OPSLAGSLEUTEL,
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    fetch: nepFetch,
    ...(slot === 'browser' ? { lock: browserSlot() } : {}),
  });
  const from = tabel => {
    const vraag = { tabel, ops: [] };
    log.from.push(vraag);
    const keten = {
      select(k) { vraag.ops.push(`select ${k}`); return keten; },
      eq(k) { vraag.ops.push(`eq ${k}`); return keten; },
      single: async () => ({ data: { role: 'student', full_name: 'Test Leerling', klas: 'AF 5e', finaliteit: 'AF', jaargang: '5e', native_language: null }, error: null }),
    };
    return keten;
  };
  return { supabase: { auth, from }, log, sessieInOpslag: () => localStorage.getItem(OPSLAGSLEUTEL) !== null };
}

const SUPABASE_MODULE = `export const supabase = new Proxy({}, { get: (_, k) => globalThis.__nepSupabase[k] });`;
const DB_MODULE = `
const db = () => globalThis.__nepDb ?? {};
const lukt = async () => ({ success: true });
export const updateProfileKlas = (...a) => (db().updateProfileKlas ?? lukt)(...a);
export const updateProfileKlasInfo = (...a) => (db().updateProfileKlasInfo ?? lukt)(...a);
export const updateProfileNativeLanguage = (...a) => (db().updateProfileNativeLanguage ?? lukt)(...a);
export const upgradeToTeacher = (...a) => (db().upgradeToTeacher ?? lukt)(...a);
export const saveSessionToSupabase = (...a) => (db().saveSessionToSupabase ?? lukt)(...a);
export const updateWordProgressInSupabase = (...a) => (db().updateWordProgressInSupabase ?? lukt)(...a);`;

let authModule = null;
async function laadAuth() {
  authModule ??= await bundel('auth', 'contexts/AuthContext.tsx', {
    '(^|/)services/supabase$': SUPABASE_MODULE,
    '(^|/)services/db$': DB_MODULE,
  });
  return authModule;
}

/** AuthProvider opstarten in een scenario en wachten tot alles rustig is. Geeft de waarde van de context. */
async function startAanmelding(scenario, wachtMs = 400) {
  const m = await laadAuth();
  const omgeving = nepSupabase(scenario);
  globalThis.__nepSupabase = omgeving.supabase;
  const R = nieuweMiniReact();
  globalThis.__miniReact = R;
  R.mount(m.AuthProvider, { children: 'APP' });
  await wacht(wachtMs);
  return { m, R, omgeving, waarde: () => R.huidig().props.value };
}

function stop({ R, omgeving }) {
  R.ontkoppel();
  omgeving.supabase.auth.stopAutoRefresh?.();
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. Geen leeg scherm meer voor een adres buiten de toegelaten domeinen
// ═════════════════════════════════════════════════════════════════════════════
const ANDER_ADRES = 'iemand@andere-school.invalid';
const TALOK_ADRES = 'f0.hotfix.leerling@gotalok.be';

for (const slot of ['browser', 'node']) {
  for (const verlopen of [false, true]) {
    test(`leeg scherm: ander domein, ${verlopen ? 'verlopen' : 'geldige'} bewaarde sessie (${slot}) → aanmeldscherm met de zin, afgemeld, niets gelezen`, async () => {
      const s = await startAanmelding({ adres: ANDER_ADRES, verlopen, slot });
      const v = s.waarde();
      assert.equal(v.loading, false, 'loading blijft true: de pagina blijft leeg');
      assert.equal(v.user, null);
      assert.equal(v.session, null);
      assert.equal(v.authError, 'Dit adres hoort niet bij een school die meedoet. Meld je aan met het e-mailadres van je school.');
      assert.equal(v.authError, s.m.MELDING_ANDER_DOMEIN);
      assert.ok(s.omgeving.log.fetch.includes('POST /auth/v1/logout'), `geen afmelding: ${s.omgeving.log.fetch.join(', ')}`);
      assert.equal(s.omgeving.sessieInOpslag(), false, 'de sessie blijft op het toestel');
      assert.equal(s.omgeving.log.from.length, 0, 'het profiel van een geweigerd account werd gelezen');
      assert.equal(localStorage.getItem('taltrekkers_selected_student'), null, 'de naam van een geweigerd account werd bewaard');
      stop(s);

      // Het toestel blijft niet leeg voor de volgende: opnieuw laden geeft gewoon het aanmeldscherm.
      const opnieuw = await startAanmelding({ adres: null, slot });
      assert.equal(opnieuw.waarde().loading, false);
      assert.equal(opnieuw.waarde().user, null);
      stop(opnieuw);
    });
  }
}

for (const adres of [TALOK_ADRES, 'f0.hotfix.leerkracht@hetleercollectief.be', 'f0.hotfix.leerling@gomira.be']) {
  test(`leeg scherm: een toegelaten adres (${adres.split('@')[1]}) merkt niets`, async () => {
    const s = await startAanmelding({ adres });
    const v = s.waarde();
    assert.equal(v.loading, false);
    assert.equal(v.user?.email, adres);
    assert.equal(v.authError, null);
    assert.ok(!s.omgeving.log.fetch.includes('POST /auth/v1/logout'), 'een toegelaten account werd afgemeld');
    assert.equal(s.omgeving.sessieInOpslag(), true);
    stop(s);
  });
}

test('leeg scherm: zonder sessie gewoon het aanmeldscherm', async () => {
  const s = await startAanmelding({ adres: null });
  assert.equal(s.waarde().loading, false);
  assert.equal(s.waarde().user, null);
  assert.equal(s.waarde().authError, null);
  assert.deepEqual(s.omgeving.log.fetch, []);
  stop(s);
});

test('toegelaten domeinen: standaard gotalok.be, hetleercollectief.be en gomira.be; de env-override blijft werken', async () => {
  const m = await laadAuth();
  assert.deepEqual(m.ALLOWED_EMAIL_DOMAINS, ['gotalok.be', 'hetleercollectief.be', 'gomira.be']);
  for (const adres of ['a@gotalok.be', 'B@GoMira.be', 'c@hetleercollectief.be']) assert.equal(m.isEmailDomainAllowed(adres), true, adres);
  for (const adres of ['a@gomira.be.invalid', 'a@xgomira.be', 'gomira.be', '', null]) assert.equal(m.isEmailDomainAllowed(adres), false, String(adres));
  const metEnv = await bundel('auth-env', 'contexts/AuthContext.tsx', {
    '(^|/)services/supabase$': SUPABASE_MODULE,
    '(^|/)services/db$': DB_MODULE,
  }, { VITE_ALLOWED_EMAIL_DOMAINS: ' GoTalok.be , hetleercollectief.be ' });
  assert.deepEqual(metEnv.ALLOWED_EMAIL_DOMAINS, ['gotalok.be', 'hetleercollectief.be']);
  assert.equal(metEnv.isEmailDomainAllowed('a@gomira.be'), false, 'de env-lijst wint van de standaardlijst');
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. Afmelden mislukt nooit meer stil (EIGEN-E1)
// ═════════════════════════════════════════════════════════════════════════════
test('afmelden, de beslissing: wanneer wissen en welke sleutels', async () => {
  const m = await laadAuth();
  assert.equal(m.AFMELD_TIJDSLIMIET_MS, 5000);
  const sleutels = [
    'sb-abcdef-auth-token', 'sb-abcdef-auth-token-code-verifier', 'sb-abcdef-auth-token-user',
    'taaltrekkers-data-v2', 'taltrekkers_selected_student', 'tvt2-weergave', 'sb-abcdef-auth-tokenx',
    'xsb-abcdef-auth-token', 'sb--auth-token', 'sb-abcdef-auth-token-andere',
  ];
  assert.deepEqual(m.afmeldBeslissing('gelukt', sleutels), { wissen: [], melding: null });
  for (const uitkomst of ['fout', 'tijdslimiet']) {
    assert.deepEqual(m.afmeldBeslissing(uitkomst, sleutels), {
      wissen: ['sb-abcdef-auth-token', 'sb-abcdef-auth-token-code-verifier', 'sb-abcdef-auth-token-user'],
      melding: 'Afmelden bij de server lukte niet. Op dit toestel ben je wel afgemeld.',
    }, uitkomst);
  }
  // Niets meer te wissen (bv. geen localStorage): toch de zin, nooit doen alsof het lukte.
  assert.deepEqual(m.afmeldBeslissing('fout', []), { wissen: [], melding: m.MELDING_AFMELDEN_MISLUKT });
});

for (const [logout, uitleg] of [['500', 'serverfout'], ['netwerk', 'geen netwerk'], ['hangt', 'geen antwoord']]) {
  test(`afmelden: ${uitleg} → de aanmelding op dit toestel gewist, afgemeld, met de zin`, async () => {
    const s = await startAanmelding({ adres: TALOK_ADRES, logout });
    assert.equal(s.waarde().user?.email, TALOK_ADRES);
    localStorage.setItem(`${OPSLAGSLEUTEL}-code-verifier`, 'x');
    localStorage.setItem('taaltrekkers-data-v2', '{}'); // lokale voortgang blijft (zoals vroeger)
    const start = Date.now();
    await s.waarde().signOut();
    const duur = Date.now() - start;
    await wacht(50);
    const v = s.waarde();
    assert.ok(s.omgeving.log.fetch.includes('POST /auth/v1/logout'), 'geen afmeldverzoek');
    assert.deepEqual(localStorage.sleutels().filter(k => k.startsWith('sb-')), [], 'de aanmelding blijft op het toestel staan');
    assert.equal(localStorage.getItem('taaltrekkers-data-v2'), '{}');
    assert.equal(v.user, null, 'de app doet alsof de leerling nog aangemeld is');
    assert.equal(v.session, null);
    assert.equal(v.authError, 'Afmelden bij de server lukte niet. Op dit toestel ben je wel afgemeld.');
    if (logout === 'hangt') assert.ok(duur >= 4900 && duur < 7000, `duurde ${duur} ms`);
    else assert.ok(duur < 2000, `duurde ${duur} ms`);
    stop(s);

    // Opnieuw laden op hetzelfde toestel: niemand meer aangemeld.
    const opnieuw = await startAanmelding({ adres: null });
    assert.equal(opnieuw.waarde().user, null);
    stop(opnieuw);
  });
}

test('afmelden: het verzoek lukt → afgemeld, geen zin (zoals vroeger)', async () => {
  const s = await startAanmelding({ adres: TALOK_ADRES, logout: 'ok' });
  await s.waarde().signOut();
  await wacht(50);
  const v = s.waarde();
  assert.ok(s.omgeving.log.fetch.includes('POST /auth/v1/logout'));
  assert.deepEqual(localStorage.sleutels().filter(k => k.startsWith('sb-')), []);
  assert.equal(v.user, null);
  assert.equal(v.authError, null);
  stop(s);
});

test('leeg scherm: lukt de afmelding van een geweigerd account niet, dan toch gewist (zin blijft die van het domein)', async () => {
  const s = await startAanmelding({ adres: ANDER_ADRES, logout: '500' });
  const v = s.waarde();
  assert.equal(v.loading, false);
  assert.equal(v.user, null);
  assert.equal(v.authError, s.m.MELDING_ANDER_DOMEIN);
  assert.equal(s.omgeving.sessieInOpslag(), false, 'de sessie van het geweigerde account blijft op het toestel');
  stop(s);
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. "Oefen zwakke woorden" bewaart de oefening weer (BV1-01)
// ═════════════════════════════════════════════════════════════════════════════
let sessieModule = null;
async function laadSessie() {
  sessieModule ??= await bundel('sessie', 'hooks/usePracticeSession.ts', {
    '(^|/)contexts/AuthContext$': 'export const useAuth = () => globalThis.__nepAuthWaarde ?? { user: null };',
    '(^|/)services/db$': DB_MODULE,
  });
  return sessieModule;
}

const MODEL = woord => ({ definitie: `Uitleg bij ${woord}.`, voorbeelden: [{ zin: `Een zin met ${woord}.`, gebruiktWoord: woord }], synoniemen: [], antoniemen: [] });

test('zwakke woorden: de oefening wordt bewaard voor de aangemelde leerling, met dubbele XP, ook in de databank', async () => {
  const m = await laadSessie();
  const lokaal = [];
  const naarDb = [];
  const woordVoortgang = [];
  globalThis.__nepAuthWaarde = { user: { id: '00000000-0000-4000-8000-00000000c001' } };
  globalThis.__nepDb = {
    saveSessionToSupabase: async rij => { naarDb.push(rij); return { success: true }; },
    updateWordProgressInSupabase: async (...a) => { woordVoortgang.push(a); return { success: true }; },
  };
  const R = nieuweMiniReact();
  globalThis.__miniReact = R;
  const opties = { allUsersData: {}, setUserData: (naam, data) => lokaal.push([naam, data]), onAchievementCheck: async () => null };
  R.mount(() => m.usePracticeSession(opties), null);

  // Zoals App.handlePracticeWeakWordsNav: de naam van de aangemelde leerling en de woorden.
  R.huidig().handlePracticeWeakWords(' Test Leerling ', ['woord1', 'woord2']);
  await wacht(0);
  const h = R.huidig();
  assert.equal(h.currentUser, 'test leerling', 'currentUser is niet gezet: finishPractice stopt dan stil');
  assert.deepEqual(h.practiceWords, ['woord1', 'woord2']);
  assert.equal(h.practiceSettings.customFileName, 'weak-words');

  await h.finishPractice(2, [{ word: 'woord1', correct: true }, { word: 'woord2', correct: true }], [MODEL('woord1'), MODEL('woord2')], 'frayer', { studyPhaseSeconds: 10, quizPhaseSeconds: 20 });
  await wacht(0);
  assert.equal(lokaal.length, 1, 'niets lokaal bewaard');
  assert.equal(lokaal[0][0], 'test leerling');
  assert.equal(lokaal[0][1].points, 4, '2 juist x 2 (dubbele XP)');
  assert.equal(lokaal[0][1].sessionHistory.length, 1);
  const samenvatting = R.huidig().sessionSummaryData;
  assert.ok(samenvatting, 'geen uitslag: de app springt naar het startscherm');
  assert.equal(samenvatting.weakWordsBonus, true);
  assert.equal(samenvatting.earnedXP, 4);
  assert.equal(naarDb.length, 1, 'geen rij in practice_sessions');
  assert.equal(naarDb[0].userId, '00000000-0000-4000-8000-00000000c001');
  assert.equal(naarDb[0].context, 'weak-words');
  assert.equal(naarDb[0].score, 2);
  assert.equal(woordVoortgang.length, 1);
  R.ontkoppel();
});

test('zwakke woorden: zonder woorden gebeurt er niets', async () => {
  const m = await laadSessie();
  const R = nieuweMiniReact();
  globalThis.__miniReact = R;
  R.mount(() => m.usePracticeSession({ allUsersData: {}, setUserData: () => {}, onAchievementCheck: async () => null }), null);
  R.huidig().handlePracticeWeakWords('test leerling', []);
  await wacht(0);
  assert.equal(R.huidig().currentUser, null);
  assert.equal(R.huidig().practiceSettings, null);
  R.ontkoppel();
});

// Gedeeld toestel zonder herladen (nalezing 11/10, M1): de leerling meldt af (of een ander meldt aan in een
// tweede tabblad, en supabase-js meldt dat aan dit tabblad). Bleef currentUser staan, dan toonde Mijn voortgang
// nog de gegevens van de vorige leerling (App: activeUserName = currentUser ?? ...).
const LEERLING_EEN = '00000000-0000-4000-8000-0000000000a1';
const LEERLING_TWEE = '00000000-0000-4000-8000-0000000000b2';

/** De hook in een component die opnieuw kan tekenen, zoals App bij een nieuwe waarde van useAuth. */
async function sessieMetAanmelding(id) {
  const m = await laadSessie();
  globalThis.__nepAuthWaarde = { user: { id } };
  globalThis.__nepDb = { saveSessionToSupabase: async () => ({ success: true }), updateWordProgressInSupabase: async () => ({ success: true }) };
  const R = nieuweMiniReact();
  globalThis.__miniReact = R;
  let herteken;
  R.mount(() => {
    const [, zet] = R.useState(0);
    herteken = () => zet(x => x + 1);
    return m.usePracticeSession({ allUsersData: {}, setUserData: () => {}, onAchievementCheck: async () => null });
  }, null);
  const meldAan = async gebruiker => { globalThis.__nepAuthWaarde = { user: gebruiker }; herteken(); await wacht(0); };
  return { R, meldAan };
}

test('gedeeld toestel: meldt de leerling af midden in een oefening en meldt een ander aan zonder herladen, dan vergeet de hook de vorige leerling', async () => {
  const { R, meldAan } = await sessieMetAanmelding(LEERLING_EEN);
  R.huidig().handlePracticeWeakWords('Test Leerling Een', ['woord1']);
  await wacht(0);
  assert.equal(R.huidig().currentUser, 'test leerling een');

  // Een vernieuwd token (TOKEN_REFRESHED): zelfde leerling, nieuw object. De oefening loopt door.
  await meldAan({ id: LEERLING_EEN });
  assert.equal(R.huidig().currentUser, 'test leerling een', 'een vernieuwd token stopt een lopende oefening');
  assert.deepEqual(R.huidig().practiceWords, ['woord1']);

  await meldAan(null); // afgemeld midden in de oefening
  await meldAan({ id: LEERLING_TWEE }); // aangemeld in een ander tabblad
  const h = R.huidig();
  assert.equal(h.currentUser, null, 'de naam van de vorige leerling blijft hangen: Mijn voortgang toont haar gegevens');
  assert.deepEqual(h.practiceWords, []);
  assert.equal(h.practiceSettings, null);
  R.ontkoppel();
});

test('gedeeld toestel: staat de vorige leerling op de uitslag en meldt een ander meteen aan, dan verdwijnen ook haar naam en uitslag', async () => {
  const { R, meldAan } = await sessieMetAanmelding(LEERLING_EEN);
  R.huidig().handlePracticeWeakWords('Test Leerling Een', ['woord1']);
  await wacht(0);
  await R.huidig().finishPractice(1, [{ word: 'woord1', correct: true }], [MODEL('woord1')], 'frayer', { studyPhaseSeconds: 5, quizPhaseSeconds: 5 });
  await wacht(0);
  assert.ok(R.huidig().sessionSummaryData, 'geen uitslag');

  await meldAan({ id: LEERLING_TWEE }); // de sessie in een ander tabblad vervangen, zonder afmelden ertussen
  const h = R.huidig();
  assert.equal(h.currentUser, null, 'de naam van de vorige leerling blijft hangen');
  assert.equal(h.sessionSummaryData, null, 'de uitslag van de vorige leerling blijft staan');
  assert.deepEqual(h.practiceWords, []);
  assert.equal(h.practiceSettings, null);
  R.ontkoppel();
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. Gedeeld toestel: "Mijn voortgang" krijgt enkel de gegevens van de aangemelde leerling (BV1-02),
//    en App geeft de aangemelde leerling mee aan "Oefen zwakke woorden" (BV1-01)
// ═════════════════════════════════════════════════════════════════════════════
// De echte App.tsx; elke relatieve import (behalve ./types) is een vervanger waarvan elke export
// globalThis.__appStubs aanroept. Componenten zijn lege functies met hun eigen naam.
const bronVan = rel => (BRON
  ? execFileSync('git', ['show', `${BRON}:${rel}`], { cwd: ROOT, encoding: 'utf8' })
  : readFileSync(join(ROOT, rel), 'utf8'));

function appVervangers() {
  const bron = bronVan('App.tsx');
  const perPad = new Map();
  const voegToe = (pad, naam) => { if (!perPad.has(pad)) perPad.set(pad, new Set()); perPad.get(pad).add(naam); };
  for (const m of bron.matchAll(/^import\s+(type\s+)?([^;]*?)\s+from\s+'([^']+)';/gm)) {
    const [, enkelType, deel, pad] = m;
    if (enkelType || !pad.startsWith('.') || pad === './types') continue;
    if (/^\w+/.test(deel.trim())) voegToe(pad, 'default');
    for (const n of (/\{([^}]*)\}/.exec(deel)?.[1] ?? '').split(',').map(s => s.trim()).filter(Boolean)) {
      if (!n.startsWith('type ')) voegToe(pad, n.split(/\s+as\s+/)[0]);
    }
  }
  for (const m of bron.matchAll(/import\('(\.[^']+)'\)/g)) voegToe(m[1], 'default');
  const vervangers = {};
  for (const [pad, namen] of perPad) {
    const naam = pad.split('/').pop().replace(/\W/g, '');
    const code = [...namen].map(n => (n === 'default'
      ? `export default function ${naam}() { return null; }`
      : `export const ${n} = (...a) => (globalThis.__appStubs[${JSON.stringify(n)}] ?? (() => null))(...a);`)).join('\n');
    vervangers[`^${pad.replace(/[.*+?^${}()|[\]\/]/g, '\$&')}$`] = code;
  }
  return vervangers;
}

let appModule = null;
const laadApp = async () => (appModule ??= await bundel('app', 'App.tsx', appVervangers(), {}, true));

function vindAlle(knoop, past, uit = []) {
  if (Array.isArray(knoop)) { for (const k of knoop) vindAlle(k, past, uit); return uit; }
  if (!knoop || typeof knoop !== 'object') return uit;
  if (past(knoop)) uit.push(knoop);
  if (knoop.props) vindAlle(knoop.props.children, past, uit);
  return uit;
}

const LEEG = { masteredWords: 0, totalScore: 0, sessionHistory: [], learnedWords: {}, streak: 0, lastPracticeDate: null, points: 0, avatarId: 'default', wordListProgress: {} };

/** App opstarten als aangemelde leerling op een toestel waar ook een klasgenoot oefende, en "Mijn voortgang" openen. */
async function openMijnVoortgang(naamAangemeld) {
  const m = await laadApp();
  const oproepen = { zwakkeWoorden: [] };
  const allUsersData = { 'test leerling een': { ...LEEG, points: 11 }, 'test leerling twee': { ...LEEG, points: 22 } };
  const auth = { user: { id: '00000000-0000-4000-8000-00000000d002' }, selectedStudent: { name: naamAangemeld }, role: 'student', finaliteit: 'AF', jaargang: '5e' };
  const sessie = {
    currentUser: null, practiceWords: [], practiceSettings: null, sessionSummaryData: null,
    startPractice() {}, finishPractice() {}, startStoryChallenge() {}, finishStoryChallenge() {}, handleCloseSummary() {},
    handlePracticeWeakWords: (...a) => oproepen.zwakkeWoorden.push(a),
  };
  const gegevens = { allUsersData, setUserData() {}, updateUser() {}, deleteSession() {}, deleteUserData() {}, updateAvatar() {} };
  globalThis.__appStubs = {
    useUserData: () => gegevens,
    usePracticeSession: () => sessie,
    useAuth: () => auth,
    useAchievements: () => ({ celebration: null, checkAchievements: async () => null, dismissCelebration() {} }),
    useProfileStatsCloudSync: () => ({ welcomeBonusJustGranted: false, dismissWelcomeBonus() {} }),
    buildSneekLaunchData: () => ({}),
    getAvatarById: () => ({ emoji: '*', name: 'Avatar' }),
    prepareResumeList: () => null,
  };
  const R = nieuweMiniReact();
  globalThis.__miniReact = R;
  R.mount(m.default, {});
  await wacht(0);
  const welkom = vindAlle(R.huidig(), k => k.type?.name === 'Welcome');
  assert.equal(welkom.length, 1, 'het startscherm verschijnt niet');
  welkom[0].props.onShowDashboard();
  await wacht(0);
  const lazy = vindAlle(R.huidig(), k => typeof k.type?.__lazy === 'function');
  const namen = await Promise.all(lazy.map(async k => (await k.type.__lazy()).default.name));
  const dashboard = lazy[namen.indexOf('Dashboard')];
  assert.ok(dashboard, `Mijn voortgang verschijnt niet (${namen.join(', ')})`);
  return { R, dashboard, allUsersData, oproepen };
}

test('gedeeld toestel: Mijn voortgang krijgt enkel de gegevens van de aangemelde leerling', async () => {
  const { R, dashboard, allUsersData } = await openMijnVoortgang('Test Leerling Twee');
  assert.deepEqual(Object.keys(dashboard.props.allUsersData), ['test leerling twee'], 'de rij van een klasgenoot is te zien (en te wissen)');
  assert.equal(dashboard.props.allUsersData['test leerling twee'], allUsersData['test leerling twee']);
  R.ontkoppel();
});

test('gedeeld toestel: zonder eigen gegevens op dit toestel een leeg overzicht, niet dat van een ander', async () => {
  const { R, dashboard } = await openMijnVoortgang('Test Leerling Drie');
  assert.deepEqual(dashboard.props.allUsersData, {});
  R.ontkoppel();
});

test('zwakke woorden vanuit Mijn voortgang: App geeft de aangemelde leerling mee', async () => {
  const { R, dashboard, oproepen } = await openMijnVoortgang('Test Leerling Twee');
  dashboard.props.onPracticeWeakWords(['woord1', 'woord2']);
  await wacht(0);
  assert.deepEqual(oproepen.zwakkeWoorden, [['test leerling twee', ['woord1', 'woord2']]]);
  R.ontkoppel();
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. Leerkrachtdashboard: een leeg e-mailadres voegt niets samen en crasht niets (SQL-3)
// ═════════════════════════════════════════════════════════════════════════════
// De echte TeacherDashboard.tsx met de kleine React; Supabase, useAuth en het AI-paneel zijn nagebootst.
// Klas: leerling A en B (Microsoft, adres enkel in de metadata: profiles.email leeg) en C oefenden; D
// (ook zonder adres) nog niet.
let dashboardModule = null;
const laadDashboard = async () => (dashboardModule ??= await bundel('leerkracht', 'components/TeacherDashboard.tsx', {
  '(^|/)services/supabase$': SUPABASE_MODULE,
  '(^|/)contexts/AuthContext$': 'export const useAuth = () => globalThis.__nepAuthWaarde;',
  '(^|/)AiUsagePanel$': 'export default function AiUsagePanel() { return null; }',
}, {}, true));

const ID = n => `00000000-0000-4000-8000-0000000000${n}`;
const profiel = (id, naam, email) => ({ id, email, full_name: naam, klas: 'AF 5e', finaliteit: 'AF', jaargang: '5e', points: 10, created_at: '2026-10-01T08:00:00Z' });
const KLAS = [profiel(ID('a1'), 'Test Leerling A', null), profiel(ID('b1'), 'Test Leerling B', null), profiel(ID('c1'), 'Test Leerling C', 'f0.hotfix.c@gotalok.be'), profiel(ID('d1'), 'Test Leerling D', null)];
let sessieNr = 0;
const sessie = p => ({
  id: `sessie-${++sessieNr}`, user_id: p.id, score: 8, total_questions: 10, duration_seconds: 60,
  completed_at: new Date(Date.now() - sessieNr * 60_000).toISOString(), context: 'Woordenschat 2DF', file_name: null,
  course_id: null, finaliteit: 'AF', jaargang: '5e', quiz_results: [{ word: 'factuur', correct: true }], total_words: 148,
  profiles: { full_name: p.full_name, email: p.email, klas: p.klas, points: p.points },
});
const SESSIES = [sessie(KLAS[0]), sessie(KLAS[1]), sessie(KLAS[1]), sessie(KLAS[2])];

function tekst(k) {
  if (k == null || typeof k === 'boolean') return '';
  if (typeof k === 'string' || typeof k === 'number') return String(k);
  if (Array.isArray(k)) return k.map(tekst).join('');
  return tekst(k.props?.children);
}

async function startDashboard() {
  const m = await laadDashboard();
  const vragen = [];
  globalThis.__nepAuthWaarde = { role: 'teacher' };
  globalThis.__nepSupabase = {
    from(tabel) {
      const vraag = { tabel, select: null };
      vragen.push(vraag);
      const data = tabel === 'practice_sessions' ? SESSIES : tabel === 'profiles' ? KLAS : [];
      const keten = {
        select(k) { vraag.select = k; return keten; },
        eq() { return keten; },
        order() { return keten; },
        then(ok, nok) { return Promise.resolve({ data: structuredClone(data), error: null }).then(ok, nok); },
      };
      return keten;
    },
  };
  const R = nieuweMiniReact();
  globalThis.__miniReact = R;
  R.mount(m.default, { onBack() {} });
  await wacht(20);
  return { m, R, vragen };
}

const knop = (boom, woord) => vindAlle(boom, k => k.type === 'button' && tekst(k).includes(woord))[0];

test('leerkrachtdashboard: de zuivere hulpjes (sleutel, naam, "(geen e-mailadres)")', async () => {
  const m = await laadDashboard();
  assert.equal(m.GEEN_EMAIL, '(geen e-mailadres)');
  assert.equal(m.leerlingSleutel({ id: 's1', user_id: ID('a1') }), ID('a1'));
  assert.notEqual(m.leerlingSleutel({ id: 's1', user_id: null }), m.leerlingSleutel({ id: 's2', user_id: null }), 'twee sessies zonder id worden geen leerling');
  assert.equal(m.leerlingNaam('Test Leerling A', null), 'Test Leerling A');
  assert.equal(m.leerlingNaam(null, 'f0.hotfix.c@gotalok.be'), 'f0.hotfix.c');
  assert.equal(m.leerlingNaam(null, null), 'Onbekend');
});

test('leerkrachtdashboard: leerlingen zonder adres worden niet samengevoegd en tellen mee', async () => {
  const { R, vragen } = await startDashboard();
  assert.match(vragen.find(v => v.tabel === 'practice_sessions').select, /\buser_id\b/, 'user_id wordt niet opgehaald');
  // Sessies: elke rij met de naam, en "(geen e-mailadres)" waar het adres leeg is.
  const sessiesTekst = tekst(R.huidig());
  for (const naam of ['Test Leerling A', 'Test Leerling B', 'Test Leerling C']) assert.ok(sessiesTekst.includes(naam), naam);
  assert.equal(sessiesTekst.split('(geen e-mailadres)').length - 1, 3, 'A 1x en B 2x zonder adres');

  knop(R.huidig(), 'Leerlingen').props.onClick();
  await wacht(0);
  const boom = R.huidig();
  const kaarten = vindAlle(boom, k => k.type === 'div' && [ID('a1'), ID('b1'), ID('c1')].includes(k.key));
  assert.equal(kaarten.length, 3, 'A en B samengevoegd tot één leerling');
  const perLeerling = Object.fromEntries(kaarten.map(k => [k.key, tekst(k)]));
  assert.match(perLeerling[ID('a1')], /Test Leerling A.*\(geen e-mailadres\).*1 sessies/);
  assert.match(perLeerling[ID('b1')], /Test Leerling B.*\(geen e-mailadres\).*2 sessies/);
  assert.match(perLeerling[ID('c1')], /Test Leerling C.*f0\.hotfix\.c@gotalok\.be.*1 sessies/);
  const overzicht = vindAlle(boom, k => k.type === 'div' && /leerlingen actief/.test(tekst(k)) && !/Nog geen activiteit/.test(tekst(k))).at(-1);
  assert.equal(tekst(overzicht).replace(/\s+/g, ' ').trim(), '3 van 4 leerlingen actief · 1 nog niet gestart');
  const zonderActiviteit = tekst(vindAlle(boom, k => k.type === 'div' && /^Nog geen activiteit/.test(tekst(k)))[0]);
  assert.match(zonderActiviteit, /Test Leerling D/);
  assert.doesNotMatch(zonderActiviteit, /Test Leerling A|Test Leerling B/, 'wie oefende, staat bij "nog niet gestart"');
  R.ontkoppel();
});

test('leerkrachtdashboard: zoeken met leerlingen zonder adres crasht niet', async () => {
  const { R } = await startDashboard();
  for (const zoekterm of ['leerling a', 'x', 'gotalok']) {
    const zoek = vindAlle(R.huidig(), k => k.type === 'input' && String(k.props.placeholder).includes('Zoek leerling'))[0];
    zoek.props.onChange({ target: { value: zoekterm } });
    await wacht(0);
    const boom = R.huidig(); // gooit als het renderen faalde (vroeger: Cannot read properties of null)
    if (zoekterm === 'leerling a') assert.ok(tekst(boom).includes('Test Leerling A') && !tekst(boom).includes('Test Leerling B'));
    if (zoekterm === 'gotalok') assert.ok(tekst(boom).includes('Test Leerling C') && !tekst(boom).includes('Test Leerling A'));
  }
  R.ontkoppel();
});
