/**
 * Gedeelde Frayer-logica — gebruikt door ZOWEL de browser (services/geminiService.ts)
 * ALS de serverless proxy (api/gemini.ts).
 *
 * WAAROM DEZE MODULE BESTAAT
 *   De proxy bouwt de Frayer-prompt voortaan ZELF op uit {word, context, difficulty}.
 *   De browser stuurt dus géén prompttekst meer mee voor Frayer-modellen. Dat is de
 *   kern van de beveiliging rond `frayer_cache`: wat in de gedeelde cache belandt is
 *   altijd het antwoord van Gemini op een prompt die de server schreef. Een leerling
 *   kan er nooit eigen tekst in krijgen die klasgenoten daarna te zien zouden krijgen.
 *   Omdat browser én server exact dezelfde prompt moeten produceren, staat die tekst
 *   hier — op één plaats.
 *
 * HARDE RANDVOORWAARDEN (deze module draait ook in "kale" Node)
 *   - GEEN `import.meta.env`, GEEN React, GEEN Supabase.
 *   - GEEN enum-WAARDEN uit types.ts importeren: Node draait dit bestand met
 *     `--experimental-transform-types` (type-stripping) en dat kan geen enums
 *     uitvoeren. `import type` is wél prima — dat wordt volledig weggestreept.
 *     Daarom staan de WordLevel-waarden hieronder als string-literals.
 *   - `data/curriculumVakken.ts` mag wél: dat bestand heeft zelf geen imports en
 *     bevat enkel interfaces, consts en functies.
 *   - Elke import van deze module gebruikt de expliciete `.ts`-extensie. Vite en
 *     Node type-stripping aanvaarden dat rechtstreeks. Vercel BUNDELT de proxy
 *     niet: het compileert elk .ts-bestand apart naar .js. Daarom staat
 *     `rewriteRelativeImportExtensions` aan in tsconfig.json — dan wordt
 *     '../shared/frayerPrompt.ts' in de gecompileerde proxy '../shared/frayerPrompt.js'.
 *     Zonder die optie faalt de hele proxy op Vercel met ERR_MODULE_NOT_FOUND
 *     (nagespeeld met de echte @vercel/node-builder: scripts/check-vercel-functie.mjs).
 */

import type { FrayerModelData } from '../types.ts';
import { getVakDomainMap } from '../data/curriculumVakken.ts';

// ─────────────────────────────────────────────────────────────────────────────
// MODELLEN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Het vastgepinde tekstmodel. Bewust GEEN rollende alias meer.
 *
 * `gemini-flash-latest` verschoof op 2026-09-02 stilzwijgend naar een model dat
 * 2,5x duurder is qua input. Eén constante hier betekent: één plaats om te
 * beslissen wanneer we naar een nieuwer model gaan, en geen verrassingen op de
 * factuur van Google.
 */
export const GEMINI_TEXT_MODEL = 'gemini-2.5-flash';

/** Spraakmodel (TTS). Dit is geen alias en verschuift dus niet vanzelf. */
export const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';

/**
 * De oude rollende alias. De proxy vertaalt die naar GEMINI_TEXT_MODEL, zodat
 * browsers met een oude (gecachede) bundel blijven werken én meteen het
 * vastgepinde model krijgen.
 */
export const LEGACY_TEXT_MODEL_ALIAS = 'gemini-flash-latest';

// ─────────────────────────────────────────────────────────────────────────────
// PROMPTVERSIE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hoog dit op zodra de prompttekst hieronder verandert. De cache-sleutel begint
 * met "v<nummer>", dus oude rijen in `frayer_cache` worden vanzelf niet meer
 * gevonden en er wordt opnieuw gegenereerd. Wissen van de tabel is dus optioneel.
 */
export const FRAYER_PROMPT_VERSION = 1;

// ─────────────────────────────────────────────────────────────────────────────
// WORDLEVEL-WAARDEN ALS STRING-LITERALS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * De waarden van `enum WordLevel` uit types.ts, letterlijk overgenomen. Ze
 * moeten synchroon blijven met dat enum; zie de randvoorwaarden bovenaan voor
 * waarom we het enum hier niet kunnen importeren.
 */
const WORD_LEVEL_BEGINNER = 'Beginner';
const WORD_LEVEL_INTERMEDIATE = 'Gemiddeld';
const WORD_LEVEL_ADVANCED = 'Gevorderd';
const WORD_LEVEL_2DF = 'Woordenschat 2DF';
const WORD_LEVEL_2AF = 'Woordenschat 2AF';
const WORD_LEVEL_ACADEMISCH = 'Academisch Nederlands';
const WORD_LEVEL_PROFESSIONEEL = 'Professioneel Nederlands';
const WORD_LEVEL_CUSTOM = 'Eigen Lijst';

/** Exact `Object.values(WordLevel)` — in dezelfde volgorde als in types.ts. */
const KNOWN_WORD_LEVELS: string[] = [
  WORD_LEVEL_BEGINNER,
  WORD_LEVEL_INTERMEDIATE,
  WORD_LEVEL_ADVANCED,
  WORD_LEVEL_2DF,
  WORD_LEVEL_2AF,
  WORD_LEVEL_ACADEMISCH,
  WORD_LEVEL_PROFESSIONEEL,
  WORD_LEVEL_CUSTOM,
];

// ─────────────────────────────────────────────────────────────────────────────
// VAKCONTEXT (verhuisd uit services/geminiService.ts — tekst ongewijzigd)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mapping van richting-codes / vak-tags / niveau-tags naar mens-leesbare domein-
 * beschrijvingen voor Gemini. Wordt door zowel `getContextInstruction` (voor
 * Frayer/Quiz/Story) als `buildSubjectGuidance` (voor woord-extractie) gebruikt.
 *
 * Bronnen (in volgorde van precedence — eerste match wint):
 *   1. Hard-coded WordLevel-entries en historische richting-codes (hieronder)
 *   2. Vakken uit `data/curriculumVakken.ts` (automatisch via getVakDomainMap)
 *
 * De curriculumVakken-import dekt ALLE 70+ vakken uit de OneDrive-structuur
 * (AF/DF/OKAN). Hier hoeven we enkel de niveau-tags en de bestaande richting-
 * codes (die in oude profielen + URL's voorkomen) handmatig te bewaren.
 */
const subjectMap: Record<string, string> = {
  // ── Vak-mapping uit data/curriculumVakken.ts (70+ vakken, OKAN incl.) ──
  // Spread komt eerst. Hard-coded entries hieronder OVERSCHRIJVEN deze bij key-
  // botsing — waardoor de niveau-tags (Woordenschat2DF etc.) en de historische
  // richting-codes (APPDA, BORGA, ...) altijd hun specifieke beschrijving
  // behouden voor backwards-compat met oude SessionRecords. Op dit moment geen
  // overlap in keys met curriculumVakken (richting-codes daar hebben formaat
  // "APPDA-Informatica", niet "Applicatie- & Databeheer (APPDA)").
  ...getVakDomainMap(),

  // ── Niveau-tags (algemene woordenlijsten zonder specifiek vak) ──
  [WORD_LEVEL_2DF]: 'algemene schooltaal en vakken in de 2e graad dubbele finaliteit (secundair onderwijs)',
  [WORD_LEVEL_2AF]: 'praktische taal en vakken in de 2e graad arbeidsfinaliteit (beroepsonderwijs)',
  [WORD_LEVEL_ACADEMISCH]: 'academisch taalgebruik en wetenschappelijke teksten',
  [WORD_LEVEL_PROFESSIONEEL]: 'professioneel taalgebruik op de werkvloer, stage en sollicitaties',

  // ── Richting-codes (historische context-strings: behoud voor backwards-compat) ──
  'Applicatie- & Databeheer (APPDA)': 'programmeren, databanken, netwerken, softwareontwikkeling en IT-beheer',
  'Bedrijfsorganisatie (BORGA)': 'kantoorbeheer, administratie, boekhouding, HR-processen en zakelijke communicatie',
  'Elektromechanische technieken (EMTEC)': 'elektriciteit, mechanica, techniek, machines, onderhoud en automatisering',
  'Gezondheidszorg (GEZORG)': 'de zorgsector, verpleegkunde, het menselijk lichaam, hygiëne en de omgang met patiënten in een ziekenhuis- of woonzorgcontext',
  'Internationale Handel & Logistiek (INHAL)': 'internationale handel, import en export, logistieke processen, transportmodi, supply chain management en douane',
  'Opvoeden en Begeleiden (OPBEG)': 'pedagogisch handelen, ontwikkelingspsychologie, communicatieve vaardigheden en het begeleiden van diverse doelgroepen (zoals kinderen, jongeren en ouderen) in een opvoedkundige context',
  'Sportbegeleider (SPOBE)': 'sport, beweging, coaching, spelregels, anatomie, trainingsleer en lichamelijke opvoeding',
  'Wellness & Schoonheid (WESCH)': 'schoonheidszorg, wellness, lichaamsverzorging, gelaatsverzorging, massage, hygiëne en esthetiek',
  'Onthaal, Organisatie & Sales (ONOSA)': 'onthaal, verkoop, winkelbeheer, administratie en klantvriendelijkheid',
};

/**
 * Resolveert een context-string naar zijn vakdomein-beschrijving uit subjectMap,
 * met fallback naar een generieke "schoolvak"-zin. Geeft null terug als context
 * leeg is of een bekend WordLevel (geen specifiek vak).
 */
const resolveSubjectDomain = (context?: string): string | null => {
  if (!context) return null;
  if (typeof context === 'string' && context in subjectMap) {
    return subjectMap[context];
  }
  if (typeof context === 'string' && !KNOWN_WORD_LEVELS.includes(context)) {
    return `het schoolvak of de studierichting "${context}"`;
  }
  return null;
};

/**
 * Bouwt een vakcontext-instructie voor woord-EXTRACTIE uit ruwe tekst. Helpt
 * Gemini om:
 *   1. Termen te kiezen die binnen het vakgebied passen
 *   2. Ambigue woorden (virus = computer-virus i.p.v. ziekte, muis = computer-
 *      muis i.p.v. dier) correct te interpreteren binnen de vakcontext
 *   3. Engelse termen en afkortingen te aanvaarden als ze in het vakgebied
 *      gangbaar zijn (iOS, USB, HTML, Wi-Fi, ...)
 *
 * Gebruikt bij `extractKeyTerms`. Bij Frayer/Quiz gebruiken we `getContextInstruction`
 * die de ambiguïteits-resolutie ook meeneemt voor consistente interpretatie.
 */
export const buildSubjectGuidance = (context?: string): string => {
  const domain = resolveSubjectDomain(context);
  if (!domain) return '';

  return `

VAKCONTEXT: Deze tekst hoort bij ${domain}.

Volg deze regels strikt:
1. Geef voorrang aan termen die specifiek voor dit vakgebied gangbaar zijn.
2. Voor ambigue woorden met meerdere betekenissen (bv. "virus", "muis", "cookie", "venster", "veld", "tabel", "blok", "kop", "veld"): selecteer ze ALLEEN als ze in dit vakgebied een specifieke betekenis hebben, en interpreteer ze altijd in die vakcontext.
3. Engelse termen en afkortingen (bv. iOS, USB, HTML, Wi-Fi, AI, OS, IP, URL, app) zijn welkom als ze in dit vakgebied gangbaar zijn — zelfs als ze geen Nederlandse vertaling hebben.
4. Vermijd alledaagse woorden die niet vakspecifiek zijn.`;
};

export const getContextInstruction = (context?: string, part: 'definitions' | 'story' | 'questions' = 'definitions'): string => {
  if (!context) return '';
  const relation = part === 'definitions' ? 'gerelateerd zijn aan' : 'zich afspelen in een context die relevant is voor';

  if (typeof context === 'string' && context in subjectMap) {
    const domain = subjectMap[context];
    const baseInstr = `De voorbeelden en ${part} moeten ${relation} ${domain}.`;
    // Voor definitions + questions: extra ambiguïteits-resolutie zodat het
    // Frayer-model en de quiz-vragen consistent in vakcontext blijven, ook
    // als het woord (bv. "virus") buiten dit vak een andere betekenis heeft.
    if (part === 'definitions' || part === 'questions') {
      return `${baseInstr} BELANGRIJK: als het doelwoord meerdere betekenissen heeft (bv. virus, muis, venster, cookie, veld, tabel), kies altijd de betekenis die past binnen ${domain}.`;
    }
    return baseInstr;
  }

  if (typeof context === 'string' && !KNOWN_WORD_LEVELS.includes(context)) {
    const baseInstr = `De voorbeelden en ${part} moeten ${relation} het schoolvak of de studierichting "${context}".`;
    if (part === 'definitions' || part === 'questions') {
      return `${baseInstr} BELANGRIJK: als het doelwoord meerdere betekenissen heeft, kies altijd de betekenis die past binnen dit vakgebied.`;
    }
    return baseInstr;
  }

  return '';
};

export const getDifficultyInstruction = (difficulty?: string): string => {
  if (difficulty === WORD_LEVEL_BEGINNER) return 'Gebruik zeer eenvoudige taal (CEFR A2-niveau).';
  if (difficulty === WORD_LEVEL_INTERMEDIATE) return 'Gebruik duidelijke en correcte taal (CEFR B1-niveau).';
  if (difficulty === WORD_LEVEL_ADVANCED) return 'Gebruik rijkere en meer formele taal (CEFR B2-niveau).';
  return 'Gebruik duidelijke en correcte taal (CEFR B1-niveau).';
};

// ─────────────────────────────────────────────────────────────────────────────
// FRAYER-AANVRAAG: NORMALISATIE + CACHE-SLEUTEL
// ─────────────────────────────────────────────────────────────────────────────

/** Alles wat nodig is om een Frayer-prompt te bouwen. Meer stuurt de browser niet. */
export interface FrayerRequest {
  word: string;
  context: string;
  difficulty: string;
}

/** Stuurgetallen voor de normalisatie. */
const MAX_WORD_LENGTH = 60;
const MAX_CONTEXT_LENGTH = 80;

/** Stuurtekens (incl. \n, \r en \t) — verboden, ze breken de promptstructuur. */
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;

/** Scheidingsteken in de cache-sleutel. Mag niet in het woord (zie frayerCacheKey). */
const KEY_SEPARATOR = '|';

/** De enige niveaus waarvoor getDifficultyInstruction een eigen instructie heeft. */
const CANONICAL_DIFFICULTIES = [WORD_LEVEL_BEGINNER, WORD_LEVEL_INTERMEDIATE, WORD_LEVEL_ADVANCED];

/**
 * Maakt van ruwe invoer (uit `req.body` of uit de app) een schone FrayerRequest,
 * of null als de invoer niet deugt.
 *
 * Dit is de poortwachter van de gedeelde cache: alles wat hier doorkomt bepaalt
 * de cache-sleutel én de prompt die de server bouwt. Het resultaat is CANONIEK:
 * twee aanvragen met dezelfde cache-sleutel geven exact dezelfde prompt, zodat
 * niemand met een andere schrijfwijze een zwakkere versie kan vastleggen.
 *   - word       : string, getrimd, interne witruimte samengetrokken tot één
 *                  spatie, in kleine letters, 1..60 tekens, geen stuurtekens/
 *                  nieuwe regels en geen '|'.
 *   - context    : string of afwezig → '', getrimd, afgekapt op 80 tekens,
 *                  geen stuurtekens. Verder EXACT: een andere schrijfwijze van het
 *                  vak geeft ook een andere prompt, dus een eigen sleutel.
 *   - difficulty : 'Beginner', 'Gemiddeld' of 'Gevorderd' (hoofdletterongevoelig
 *                  herkend) → die exacte waarde; al de rest (ook leeg, onbekend of
 *                  geen tekst) → ''. getDifficultyInstruction geeft voor '' dezelfde
 *                  B1-instructie als voor elke onbekende waarde: de prompt blijft gelijk.
 *
 * Kleine letters voor het woord: zo delen "Factuur" en "factuur" één cache-rij én
 * één prompt. Alle woordbronnen van de app en van 2.0 (vaste lijsten,
 * extractKeyTerms) leveren al kleine letters, dus in de praktijk verandert er geen
 * enkele prompt.
 *
 * Afkappen (i.p.v. weigeren) voor de context is bewust: vakken uit de vaste lijsten
 * zijn kort (langste vak-id 25 tekens, langste richting-code 41), maar een eigen vak
 * of lijstnaam is vrije tekst en mag een leerling nooit blokkeren. Het woord
 * weigeren we wél: dat is de eigenlijke invoer. (De app valt dan terug op een
 * gewone prompt zonder cache, zie generateFrayerModel.)
 */
export function normalizeFrayerRequest(input: unknown): FrayerRequest | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;

  if (typeof raw.word !== 'string') return null;
  const trimmedWord = raw.word.trim();
  if (CONTROL_CHARS.test(trimmedWord) || trimmedWord.includes(KEY_SEPARATOR)) return null;
  const word = trimmedWord.replace(/\s+/g, ' ').toLowerCase();
  if (word.length < 1 || word.length > MAX_WORD_LENGTH) return null;

  const context = normalizeContext(raw.context);
  if (context === null) return null;

  return { word, context, difficulty: canonicalDifficulty(raw.difficulty) };
}

/** Context: afwezig → '', trimmen, afkappen, stuurtekens weigeren. Verder exact. */
function normalizeContext(value: unknown): string | null {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (CONTROL_CHARS.test(trimmed)) return null;
  return trimmed.slice(0, MAX_CONTEXT_LENGTH);
}

/** Niveau: één van de drie canonieke waarden, of '' voor al de rest. */
function canonicalDifficulty(value: unknown): string {
  if (typeof value !== 'string') return '';
  const gezocht = value.trim().toLowerCase();
  return CANONICAL_DIFFICULTIES.find(niveau => niveau.toLowerCase() === gezocht) ?? '';
}

/**
 * De primaire sleutel in `frayer_cache`, voor een GENORMALISEERDE aanvraag.
 *
 * Enkel het woord staat in kleine letters (normalizeFrayerRequest deed dat al);
 * vak en niveau staan er exact in, zoals ze in de prompt terechtkomen. Zo hoort bij
 * elke sleutel precies één prompt. Omdat het woord geen '|' mag bevatten en het
 * niveau er nooit een heeft, valt de sleutel eenduidig terug te splitsen: woord tot
 * de eerste '|', niveau na de laatste, vak ertussen (dat mag zelf '|' bevatten).
 * De "v<nummer>"-prefix zorgt dat een promptwijziging (FRAYER_PROMPT_VERSION++)
 * oude rijen automatisch links laat liggen.
 */
export function frayerCacheKey(r: FrayerRequest): string {
  return `v${FRAYER_PROMPT_VERSION}|${r.word.toLowerCase()}|${r.context}|${r.difficulty}`;
}

/**
 * DE Frayer-prompt. Letterlijk dezelfde tekst als die vroeger in
 * `generateFrayerModel` stond; enkel de plaats is veranderd. Wie deze tekst
 * aanpast, hoogt FRAYER_PROMPT_VERSION op.
 */
export function buildFrayerPrompt(r: FrayerRequest): string {
  const difficultyInstruction = getDifficultyInstruction(r.difficulty);
  const contextInstruction = getContextInstruction(r.context);
  const word = r.word;

  return `Genereer een Frayer Model voor het Nederlandse woord "${word}". De doelgroep zijn NT2-leerders. ${difficultyInstruction} ${contextInstruction} Geef de definitie, 3 synoniemen, 3 antoniemen, en 3 voorbeeldobjecten. Elk voorbeeldobject moet een 'zin' bevatten (een complete, informatieve zin waarin het woord wordt gebruikt) en een 'gebruiktWoord' (de exacte, vervoegde of verbogen vorm van "${word}" die in die zin voorkomt). BELANGRIJKE REGEL: Als "${word}" een scheidbaar werkwoord is (bv. 'opbellen') en het in de zin gesplitst wordt gebruikt (bv. 'ik bel mijn oma op'), moet 'gebruiktWoord' BEIDE delen bevatten, gescheiden door een spatie (bv. 'bel op'). Dit is cruciaal voor de highlighting.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA + VALIDATIE
// ─────────────────────────────────────────────────────────────────────────────

/** JSON-schema voor het Frayer-antwoord (plain object, geen SDK-import nodig). */
export const frayerModelSchema = {
  type: 'OBJECT',
  properties: {
    definitie: { type: 'STRING', description: 'Een eenvoudige definitie van het woord.' },
    voorbeelden: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          zin: { type: 'STRING', description: 'De volledige voorbeeldzin.' },
          gebruiktWoord: { type: 'STRING', description: 'De exacte vorm (vervoeging/verbuiging) van het basiswoord zoals het in de zin wordt gebruikt.' },
        },
        required: ['zin', 'gebruiktWoord'],
      },
      description: 'Drie objecten, elk met een complete, informatieve zin en de exacte vorm van het woord dat in die zin wordt gebruikt.',
    },
    synoniemen: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Drie woorden met een vergelijkbare betekenis.' },
    antoniemen: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Drie woorden met een tegenovergestelde betekenis.' },
  },
  required: ['definitie', 'voorbeelden', 'synoniemen', 'antoniemen'],
};

/**
 * Config voor élke Frayer-call, in de browser én in de proxy.
 *
 * `thinkingBudget: 0` staat er bewust: de app draait in productie op de stand
 * 'fast', die precies dit deed. Denken aanzetten zou de kost per Frayer-model
 * fors verhogen zonder dat de leerling er iets van merkt.
 */
export const FRAYER_GENERATION_CONFIG = {
  responseMimeType: 'application/json',
  responseSchema: frayerModelSchema,
  thinkingConfig: { thinkingBudget: 0 },
};

/** Verwijdert een eventuele ```json-omhulling rond het antwoord van Gemini. */
export const cleanJsonOutput = (text: string): string => {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return cleaned;
};

/**
 * Structurele controle vóór het wegschrijven naar de gedeelde cache.
 *
 * Dit is de tweede poortwachter: enkel een antwoord dat er écht uitziet als een
 * Frayer-model belandt in de tabel. Half afgekapte of lege antwoorden gaan wél
 * naar de leerling terug (de client heeft zijn eigen retry-logica), maar worden
 * niet bewaard — anders zou één slecht antwoord twaalf leerlingen treffen.
 */
export function isValidFrayerModel(x: unknown): x is FrayerModelData {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const m = x as Record<string, unknown>;

  if (typeof m.definitie !== 'string') return false;
  if (m.definitie.trim() === '' || m.definitie.length > 600) return false;

  if (!Array.isArray(m.voorbeelden)) return false;
  if (m.voorbeelden.length < 1 || m.voorbeelden.length > 5) return false;
  for (const v of m.voorbeelden) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    const ex = v as Record<string, unknown>;
    if (typeof ex.zin !== 'string' || ex.zin.trim() === '') return false;
    if (typeof ex.gebruiktWoord !== 'string' || ex.gebruiktWoord.trim() === '') return false;
  }

  if (!isStringList(m.synoniemen)) return false;
  if (!isStringList(m.antoniemen)) return false;

  return true;
}

/** Array van 0 tot 6 strings. */
function isStringList(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  if (value.length > 6) return false;
  return value.every(item => typeof item === 'string');
}
