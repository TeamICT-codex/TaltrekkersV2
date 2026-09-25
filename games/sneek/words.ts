// Woorden die de slang letter voor letter verzamelt.
//
// Bron (door de host-app meegegeven): de woorden uit de net afgeronde sessie,
// met de fout beantwoorde woorden eerst (priority). Zonder host-woorden valt
// het spel terug op een korte lijst algemene schooltaal.

export interface WordInput {
  word: string;
  definition?: string;
  priority?: boolean;
}

export interface WordEntry {
  id: number;
  word: string;
  definition: string;
  priority: boolean;
}

export const MAX_WORDS = 40;
const MAX_WORD_CHARS = 24;
const MAX_DEF_CHARS = 160;

const COLLECTIBLE = /[\p{L}\p{N}]/u;
/** Toegelaten tekens in een woord: letters (ook met accenten), cijfers, spatie, koppelteken, apostrof, punt. */
const ALLOWED_WORD = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N} '’.\-]*$/u;

/** Letters en cijfers worden gegeten; spaties, koppeltekens en apostrofs staan al ingevuld. */
export function isCollectible(ch: string): boolean {
  return COLLECTIBLE.test(ch);
}

function cleanText(v: unknown): string {
  return typeof v === 'string' ? v.normalize('NFC').replace(/\s+/g, ' ').trim() : '';
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.-]+$/, '') + '…';
}

/** Maakt van willekeurige invoer een veilige, ontdubbelde woordenlijst. Nooit HTML — enkel tekst. */
export function sanitizeWords(input: unknown): WordEntry[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: WordEntry[] = [];
  for (const raw of input) {
    if (out.length >= MAX_WORDS) break;
    const obj = typeof raw === 'string' ? { word: raw } : raw;
    if (!obj || typeof obj !== 'object') continue;
    const rec = obj as Record<string, unknown>;
    const word = cleanText(rec.word);
    if (word.length < 2 || word.length > MAX_WORD_CHARS) continue;
    if (!ALLOWED_WORD.test(word)) continue;
    const chars = Array.from(word);
    if (chars.filter(isCollectible).length < 2) continue;
    if (word.split(' ').length > 3) continue;
    const key = word.toLocaleLowerCase('nl');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: out.length,
      word,
      definition: clip(cleanText(rec.definition), MAX_DEF_CHARS),
      priority: rec.priority === true,
    });
  }
  return out;
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Levert woorden in leerzinvolle volgorde: eerst de moeilijke, daarna de rest, dan opnieuw gemengd. */
export class WordQueue {
  private order: WordEntry[] = [];
  private lastId = -1;
  private firstPass = true;

  constructor(private readonly entries: WordEntry[]) {
    this.refill();
  }

  get size(): number {
    return this.entries.length;
  }

  private refill(): void {
    const pri = shuffle(this.entries.filter(e => e.priority));
    const rest = shuffle(this.entries.filter(e => !e.priority));
    this.order = this.firstPass ? [...pri, ...rest] : shuffle([...this.entries]);
    this.firstPass = false;
    // Nooit twee keer na elkaar hetzelfde woord bij het opnieuw beginnen.
    if (this.order.length > 1 && this.order[0].id === this.lastId) {
      this.order.push(this.order.shift() as WordEntry);
    }
  }

  next(): WordEntry {
    if (!this.order.length) this.refill();
    const w = this.order.shift() as WordEntry;
    this.lastId = w.id;
    return w;
  }
}

/** Algemene schooltaal — terugvaloptie als de app (nog) geen sessiewoorden meestuurt. */
export const FALLBACK_WORDS: WordInput[] = [
  { word: 'analyseren', definition: 'Iets goed bekijken en in delen uitleggen.' },
  { word: 'vergelijken', definition: 'Kijken wat hetzelfde is en wat anders is.' },
  { word: 'definitie', definition: 'De precieze betekenis van een woord.' },
  { word: 'conclusie', definition: 'Wat je besluit aan het einde.' },
  { word: 'hypothese', definition: 'Een idee dat je nog moet testen.' },
  { word: 'oorzaak', definition: 'De reden waarom iets gebeurt.' },
  { word: 'gevolg', definition: 'Wat er gebeurt door iets anders.' },
  { word: 'samenvatten', definition: 'Het belangrijkste kort vertellen.' },
  { word: 'verklaren', definition: 'Uitleggen waarom iets zo is.' },
  { word: 'beschrijven', definition: 'Vertellen hoe iets is of eruitziet.' },
  { word: 'bron', definition: 'De plek waar informatie vandaan komt.' },
  { word: 'voorbeeld', definition: 'Iets dat toont hoe iets werkt.' },
  { word: 'argument', definition: 'Een reden om iets te geloven of te doen.' },
  { word: 'onderzoek', definition: 'Zoeken naar informatie om iets te weten.' },
  { word: 'tabel', definition: 'Informatie in rijen en kolommen.' },
];

/** Woordjes voor de demo-slang achter het menu. */
export const DEMO_WORDS: WordEntry[] = sanitizeWords(['sneek', 'woord', 'letter', 'tuin', 'taal']);
