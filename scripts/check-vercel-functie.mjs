// Bouwt api/gemini.ts met de ECHTE Vercel-builder (@vercel/node), exact zoals een
// deploy dat doet, en laadt daarna de gebouwde functie. Zo zie je vóór een deploy
// of de proxy op Vercel kan starten.
//
// Waarom: Vercel bundelt de proxy niet, maar compileert elk .ts-bestand apart naar
// .js. Een import '../shared/frayerPrompt.ts' blijft dan staan en de hele proxy
// faalt met ERR_MODULE_NOT_FOUND. tsconfig.json → rewriteRelativeImportExtensions
// lost dat op; dit script bewaakt het.
//
// Schrijft niets in de werkmap (dev-modus: geen npm install); de gebouwde functie
// komt in een tijdelijke map die achteraf verdwijnt. Duurt enkele minuten (de
// builder controleert alle types, net als op Vercel).
//
// Start: npm run check:vercel
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(join(ROOT, 'package.json'));
const { build } = require('@vercel/node');
const { FileFsRef } = require('@vercel/build-utils');

const start = Date.now();
console.log('Vercel-builder draait (dit duurt even)…');
const { output } = await build({
  files: { 'api/gemini.ts': new FileFsRef({ fsPath: join(ROOT, 'api', 'gemini.ts') }) },
  entrypoint: 'api/gemini.ts',
  workPath: ROOT,
  repoRootPath: ROOT,
  config: {},
  meta: { isDev: true, skipDownload: true },
});

const doel = mkdtempSync(join(tmpdir(), 'vercel-functie-'));
let fouten = 0;
try {
  const eigen = [];
  for (const [pad, bestand] of Object.entries(output.files)) {
    const bestemming = join(doel, pad);
    mkdirSync(dirname(bestemming), { recursive: true });
    if (bestand.type === 'FileFsRef') copyFileSync(bestand.fsPath, bestemming);
    else writeFileSync(bestemming, bestand.data);
    if (!pad.startsWith('node_modules') && !pad.endsWith('.map')) eigen.push(pad.replaceAll('\\', '/'));
  }
  console.log(`Gebouwd in ${Math.round((Date.now() - start) / 1000)} s. Eigen bestanden in de functie: ${eigen.sort().join(', ')}`);

  const controleer = (ok, tekst) => {
    if (!ok) fouten++;
    console.log(`${ok ? '✓' : '✗'} ${tekst}`);
  };
  const lees = pad => readFileSync(join(doel, pad), 'utf8');
  const relatieveImports = code => [...code.matchAll(/from\s+["'](\.[^"']+)["']/g)].map(m => m[1]);

  const proxyImports = relatieveImports(lees('api/gemini.js'));
  controleer(
    proxyImports.length > 0 && proxyImports.every(p => p.endsWith('.js')),
    `api/gemini.js importeert ${proxyImports.join(', ') || '(niets)'}`,
  );
  const sharedImports = relatieveImports(lees('shared/frayerPrompt.js'));
  controleer(
    sharedImports.every(p => p.endsWith('.js')),
    `shared/frayerPrompt.js importeert ${sharedImports.join(', ') || '(niets)'}`,
  );

  // De gebouwde functie echt laden en aanroepen (GET → 405: er gebeurt niets extern).
  try {
    const mod = await import(pathToFileURL(join(doel, 'api', 'gemini.js')).href);
    let status = 0;
    const res = { status(c) { status = c; return res; }, json() { return res; }, setHeader() {} };
    await mod.default({ method: 'GET', headers: {} }, res);
    controleer(status === 405, `gebouwde functie laadt en antwoordt (GET → ${status})`);
  } catch (err) {
    controleer(false, `gebouwde functie laadt NIET: ${err.code ?? ''} ${String(err.message).split('\n')[0]}`);
  }
} finally {
  rmSync(doel, { recursive: true, force: true });
}

if (fouten > 0) {
  console.error('\nDe proxy zou op Vercel NIET starten. Niet deployen.');
  process.exit(1);
}
console.log('\nDe proxy start op Vercel.');
