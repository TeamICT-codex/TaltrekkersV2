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

const patronen = [
  { re: /AIza[0-9A-Za-z_-]{30,}/, wat: 'een Google API-sleutel (AIza…)' },
  { re: /generativelanguage\.googleapis\.com/, wat: 'de Gemini-SDK (generativelanguage.googleapis.com)' },
];

let fouten = 0;
for (const bestand of readdirSync(dir)) {
  if (!bestand.endsWith('.js')) continue;
  const bron = readFileSync(join(dir, bestand), 'utf8');
  for (const p of patronen) {
    if (p.re.test(bron)) {
      console.error(`✗ dist/assets/${bestand} bevat ${p.wat}`);
      fouten++;
    }
  }
}

if (fouten > 0) {
  console.error('\nBuild geweigerd. De Gemini-sleutel en -SDK mogen nooit in de browserbundel zitten.');
  console.error('Controleer callGemini() in services/geminiService.ts: de dev-tak moet in een `if (import.meta.env.DEV)`-blok staan.');
  process.exit(1);
}
console.log('✓ bundle-check: geen API-sleutel en geen Gemini-SDK in dist/assets');
