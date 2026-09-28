// Mini-lezer voor .env-bestanden, zonder extra pakket. Enkel voor de lokale
// scripts (dev-api, tests) — de app zelf laat dit aan Vite over.
//
// Toont of logt NOOIT waarden: aanroepers krijgen de waarden, maar mogen enkel
// melden OF een sleutel er is.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Leest KEY=waarde-regels. Kent: lege regels, # commentaar, `export KEY=…`,
 * waarden tussen "…" of '…', en `KEY=waarde # uitleg`. Geen ${VAR}-substitutie.
 */
export function leesEnvBestand(pad) {
  if (!existsSync(pad)) return {};
  const uit = {};
  for (const ruweRegel of readFileSync(pad, 'utf8').split(/\r?\n/)) {
    const regel = ruweRegel.trim();
    if (!regel || regel.startsWith('#')) continue;
    const m = regel.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let waarde = m[2];
    const tussenAanhalingstekens =
      waarde.length >= 2 &&
      ((waarde.startsWith('"') && waarde.endsWith('"')) || (waarde.startsWith("'") && waarde.endsWith("'")));
    if (tussenAanhalingstekens) {
      waarde = waarde.slice(1, -1);
    } else {
      const hekje = waarde.search(/\s#/);
      if (hekje >= 0) waarde = waarde.slice(0, hekje);
      waarde = waarde.trim();
    }
    uit[m[1]] = waarde;
  }
  return uit;
}

/**
 * Laadt .env.local en daarna .env in process.env. Een waarde die al in de
 * omgeving staat wordt NIET overschreven (zelfde gedrag als dotenv), en
 * .env.local wint van .env (zelfde gedrag als Vite).
 * Geeft de namen van de geladen bestanden terug.
 */
export function laadEnv(map = process.cwd()) {
  const geladen = [];
  for (const naam of ['.env.local', '.env']) {
    const pad = resolve(map, naam);
    if (!existsSync(pad)) continue;
    for (const [sleutel, waarde] of Object.entries(leesEnvBestand(pad))) {
      if (process.env[sleutel] === undefined) process.env[sleutel] = waarde;
    }
    geladen.push(naam);
  }
  return geladen;
}

/**
 * De app gebruikt VITE_-namen (die ziet de browser); de proxy op Vercel leest de
 * servernamen. Vertaal waar de servernaam nog ontbreekt. De service-sleutel komt
 * NOOIT uit een VITE_-variabele: die zou in de publieke bundel belanden.
 */
export function zetServerNamen(env = process.env) {
  if (!env.GEMINI_API_KEY && env.VITE_GEMINI_API_KEY) env.GEMINI_API_KEY = env.VITE_GEMINI_API_KEY;
  if (!env.SUPABASE_URL && env.VITE_SUPABASE_URL) env.SUPABASE_URL = env.VITE_SUPABASE_URL;
  if (!env.SUPABASE_ANON_KEY && env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY) {
    env.SUPABASE_ANON_KEY = env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  }
}

/** Rol in een (oude) Supabase-JWT-sleutel, of null. Leest enkel het middenstuk. */
function jwtRol(waarde) {
  const delen = String(waarde ?? '').split('.');
  if (delen.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(delen[1], 'base64url').toString('utf8')).role ?? null;
  } catch {
    return null;
  }
}

/**
 * Namen van VITE_-variabelen die op een GEHEIME sleutel lijken (service-rol of
 * sb_secret_…). Alles met VITE_ belandt in de browserbundel — dat mag nooit.
 */
export function geheimeViteVariabelen(env = process.env) {
  return Object.entries(env)
    .filter(([naam, waarde]) =>
      naam.startsWith('VITE_') &&
      (/SERVICE_ROLE|SECRET/i.test(naam) || /^sb_secret_/.test(waarde ?? '') || jwtRol(waarde) === 'service_role'))
    .map(([naam]) => naam);
}

/** Project-ref uit een Supabase-URL (https://<ref>.supabase.co), anders de host. Geen geheim. */
export function supabaseRef(url) {
  try {
    const host = new URL(url).hostname;
    return host.endsWith('.supabase.co') ? host.split('.')[0] : host;
  } catch {
    return '(ongeldige URL)';
  }
}
