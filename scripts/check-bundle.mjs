// Bundle-bewaker: laat `npm run build` (en dus de Vercel-deploy) MISLUKKEN
// wanneer er een Google API-sleutel of de Gemini-SDK in de browserbundel zit.
//
// Waarom: de Gemini-sleutel hoort uitsluitend server-side (api/gemini.ts).
// Op 2026-09-07 én opnieuw op 2026-09-08 belandde de VITE_GEMINI_API_KEY toch
// in dist/ omdat de bundler de dev-tak in services/geminiService.ts niet
// wegvouwde. Een menselijke controle vergeet dat; deze check niet.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'dist', 'assets');
if (!existsSync(dir)) {
  console.error('✗ bundle-check: dist/assets bestaat niet — is de build gelukt?');
  process.exit(1);
}

/** Oude Supabase-sleutels zijn JWT's: de publieke heeft rol "anon", de geheime "service_role". */
function bevatServiceRolJwt(bron) {
  for (const m of bron.matchAll(/eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g)) {
    try {
      if (JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')).role === 'service_role') return true;
    } catch {
      // geen geldige JWT — negeren
    }
  }
  return false;
}

const patronen = [
  { test: b => /AIza[0-9A-Za-z_-]{30,}/.test(b), wat: 'een Google API-sleutel (AIza…)' },
  { test: b => /generativelanguage\.googleapis\.com/.test(b), wat: 'de Gemini-SDK (generativelanguage.googleapis.com)' },
  // Sinds de Frayer-cache staat er een Supabase-service-sleutel in .env.local (SUPABASE_SERVICE_ROLE_KEY).
  // Met een VITE_-naam zou die in de bundel belanden en elke RLS-regel omzeilen.
  { test: b => /sb_secret_[0-9A-Za-z_-]{16,}/.test(b), wat: 'een geheime Supabase-sleutel (sb_secret_…)' },
  { test: bevatServiceRolJwt, wat: 'een Supabase service_role-sleutel (JWT)' },
];

let fouten = 0;
for (const bestand of readdirSync(dir)) {
  if (!bestand.endsWith('.js')) continue;
  const bron = readFileSync(join(dir, bestand), 'utf8');
  for (const p of patronen) {
    if (p.test(bron)) {
      console.error(`✗ dist/assets/${bestand} bevat ${p.wat}`);
      fouten++;
    }
  }
}

if (fouten > 0) {
  console.error('\nBuild geweigerd. Geheime sleutels en de Gemini-SDK mogen nooit in de browserbundel zitten.');
  console.error('Gemini: controleer callGemini() in services/geminiService.ts: de dev-tak moet in een `if (import.meta.env.DEV …)`-blok staan.');
  console.error('Supabase: een service-sleutel hoort in SUPABASE_SERVICE_ROLE_KEY, nooit in een VITE_-variabele.');
  process.exit(1);
}
console.log('✓ bundle-check: geen API-sleutel, geen Supabase-service-sleutel en geen Gemini-SDK in dist/assets');
