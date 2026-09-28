import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, type GenerateContentConfig } from '@google/genai';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
// Expliciete .ts-extensie: nodig voor Node type-stripping (scripts/dev-api.mjs).
// Vercel compileert elk bestand apart; tsconfig.json → rewriteRelativeImportExtensions
// maakt er in de gecompileerde proxy '../shared/frayerPrompt.js' van.
import {
  FRAYER_GENERATION_CONFIG,
  FRAYER_PROMPT_VERSION,
  GEMINI_TEXT_MODEL,
  GEMINI_TTS_MODEL,
  LEGACY_TEXT_MODEL_ALIAS,
  buildFrayerPrompt,
  cleanJsonOutput,
  frayerCacheKey,
  isValidFrayerModel,
  normalizeFrayerRequest,
  type FrayerRequest,
} from '../shared/frayerPrompt.ts';

// Whitelist van toegestane modellen — voorkomt misbruik via willekeurige modelnamen.
// De oude rollende alias wordt vóór deze controle vertaald (zie resolveModel).
const ALLOWED_MODELS = new Set<string>([GEMINI_TEXT_MODEL, GEMINI_TTS_MODEL]);

/**
 * Browsers met een oude (gecachede) bundel vragen nog `gemini-flash-latest`.
 * Die blijven werken, maar krijgen meteen het vastgepinde model.
 */
function resolveModel(model: unknown): unknown {
  return model === LEGACY_TEXT_MODEL_ALIAS ? GEMINI_TEXT_MODEL : model;
}

// Rate limiting: in-memory map met sliding window per identiteit (user-id of IP).
// Werkt binnen één Vercel function-instance; bij grote schaal upgrade naar Upstash/Redis.
const RATE_LIMITS = {
  authenticated: { max: 60, windowMs: 60_000 }, // 60 req/min per user
  anonymous:     { max: 15, windowMs: 60_000 }, // 15 req/min per IP — enkel als tokens tijdelijk niet te controleren zijn
} as const;

const requestLog = new Map<string, number[]>();

function checkRateLimit(key: string, max: number, windowMs: number): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  const recent = (requestLog.get(key) || []).filter(t => t > cutoff);

  if (recent.length >= max) {
    return { allowed: false, retryAfter: Math.ceil((recent[0] + windowMs - now) / 1000) };
  }
  recent.push(now);
  requestLog.set(key, recent);

  // Periodieke cleanup om memory groei te beperken
  if (requestLog.size > 5000) {
    for (const [k, times] of requestLog) {
      if (times[times.length - 1] < cutoff) requestLog.delete(k);
    }
  }
  return { allowed: true };
}

function getClientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  if (Array.isArray(fwd) && fwd.length > 0) return fwd[0];
  return req.socket?.remoteAddress || 'unknown';
}

/** Haalt de rauwe Bearer-token uit de Authorization-header (null als er geen is). */
function getBearerToken(req: VercelRequest): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  return token || null;
}

/**
 * Wie roept de proxy aan?
 *   user         → geldige Supabase-sessie
 *   missing      → geen token meegestuurd
 *   invalid      → token geweigerd door Supabase (verlopen, vervalst, …)
 *   unverifiable → we KUNNEN niet controleren (servervariabelen ontbreken of
 *                  Supabase is even onbereikbaar). Dan niet iedereen buitensluiten,
 *                  maar terugvallen op de strenge limiet per IP (vroeger gedrag).
 */
type CallerAuth =
  | { kind: 'user'; userId: string }
  | { kind: 'missing' }
  | { kind: 'invalid' }
  | { kind: 'unverifiable' };

async function authenticateCaller(req: VercelRequest): Promise<CallerAuth> {
  // Zelfde Supabase-project als de app. De VITE_-variabelen staan al in Vercel
  // (de app zelf heeft ze nodig) en zijn ook in serverfuncties beschikbaar;
  // aparte server-variabelen zijn dus optioneel.
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
  if (!supabaseUrl || !supabaseKey) {
    // Zonder URL en publieke sleutel kan de proxy geen enkele token
    // verifiëren. Luid waarschuwen in de functie-logs i.p.v. stil falen.
    console.warn('Supabase-URL of -sleutel ontbreekt (SUPABASE_URL/SUPABASE_ANON_KEY of VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY): tokens kunnen niet gecontroleerd worden.');
    return { kind: 'unverifiable' };
  }

  const token = getBearerToken(req);
  if (!token) return { kind: 'missing' };

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data.user) return { kind: 'user', userId: data.user.id };
    const status = (error as { status?: number } | null)?.status;
    // 4xx = Supabase heeft de token beoordeeld en geweigerd. Al de rest
    // (netwerk, 5xx) = we weten het niet.
    if (typeof status === 'number' && status >= 400 && status < 500) return { kind: 'invalid' };
    return { kind: 'unverifiable' };
  } catch {
    return { kind: 'unverifiable' };
  }
}

/**
 * Tokenverbruik van Gemini, doorgegeven aan de client.
 *
 * De client schrijft hiermee zelf een metadata-rij in `ai_usage_log` (zie
 * services/aiUsage.ts). Bewust NIET hier wegschrijven: dat hing af van
 * server-variabelen die stil kunnen ontbreken, waardoor er niets gelogd werd.
 * De browser is altijd ingelogd en voldoet dus altijd aan de RLS-regel
 * `auth.uid() = user_id`.
 */
interface UsagePayload {
  promptTokenCount: number | null;
  candidatesTokenCount: number | null;
  thoughtsTokenCount: number | null;
  totalTokenCount: number | null;
}

function toUsagePayload(usage: {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
} | undefined): UsagePayload | null {
  if (!usage) return null;
  return {
    promptTokenCount: usage.promptTokenCount ?? null,
    candidatesTokenCount: usage.candidatesTokenCount ?? null,
    thoughtsTokenCount: usage.thoughtsTokenCount ?? null,
    totalTokenCount: usage.totalTokenCount ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FRAYER-CACHE (tabel frayer_cache — zie migration-2026-09-18-frayer-cache.sql)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ref van het LIVE Supabase-project. Geen geheim: de URL staat ook in de app-bundel.
 * Enkel een productie-deploy (VERCEL_ENV=production) mag in deze databank schrijven.
 */
export const LIVE_SUPABASE_REF = 'armszlatvhjyolbzasrc';

/** Een trage databank mag een leerling nooit ophouden: daarna gewoon Gemini. */
const CACHE_LOOKUP_TIMEOUT_MS = 1500;
/** Wegschrijven wacht hoogstens zo lang; mislukt het, dan enkel een waarschuwing. */
const CACHE_WRITE_TIMEOUT_MS = 2000;

export interface FrayerCacheStatus {
  aan: boolean;
  /** Waarom de cache aan of uit staat, in gewone taal (voor de logs en de dev-banner). */
  reden: string;
  /** De Supabase-URL die de cache gebruikt (geen geheim). */
  url: string | null;
  /** Wijst die URL naar de LIVE databank? */
  live: boolean;
}

/**
 * Staat de gedeelde cache aan? Lezen én schrijven hangen hiervan af.
 *
 * VEILIGHEIDSSLOT: tegen de LIVE databank staat de cache enkel aan in productie
 * (VERCEL_ENV=production). Een preview-deploy of een lokale proxy (dev:api) kan
 * dus nooit in de live databank schrijven, ook niet als er per ongeluk een
 * service-sleutel van live klaarstaat.
 *
 * Zelfde URL-volgorde als authenticateCaller: SUPABASE_URL, anders VITE_SUPABASE_URL.
 * De service-sleutel komt UITSLUITEND uit SUPABASE_SERVICE_ROLE_KEY (nooit VITE_…).
 */
export function frayerCacheStatus(env: NodeJS.ProcessEnv = process.env): FrayerCacheStatus {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL || null;
  const live = url !== null && url.includes(LIVE_SUPABASE_REF);
  if (live && env.VERCEL_ENV !== 'production') {
    return {
      aan: false,
      reden: `veiligheidsslot: LIVE databank buiten productie (VERCEL_ENV=${env.VERCEL_ENV || 'niet gezet'})`,
      url,
      live,
    };
  }
  if (!url || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return { aan: false, reden: 'SUPABASE_URL of SUPABASE_SERVICE_ROLE_KEY ontbreekt', url, live };
  }
  return { aan: true, reden: live ? 'productie, LIVE databank' : 'testdatabank', url, live };
}

/** Wat een treffer in de cache oplevert. */
interface CacheHit {
  modelData: unknown;
  modelVersion: string | null;
  hitCount: number;
}

/**
 * Laat `werk` hoogstens `ms` milliseconden lopen. Daarna wordt het HTTP-verzoek
 * afgebroken (AbortSignal) en volgt een fout, die de aanroeper als "miss" of
 * "niet bewaard" behandelt.
 */
async function metTijdslimiet<T>(werk: (signal: AbortSignal) => PromiseLike<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tijdslimiet = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`tijdslimiet van ${ms} ms overschreden`));
    }, ms);
  });
  try {
    return await Promise.race([Promise.resolve(werk(controller.signal)), tijdslimiet]);
  } finally {
    clearTimeout(timer);
  }
}

function foutTekst(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Opzoeken. Elke fout, tijdslimiet of ongeldige rij telt als "niet gevonden". */
async function zoekInCache(client: SupabaseClient, key: string): Promise<CacheHit | null> {
  try {
    const { data, error } = await metTijdslimiet(
      signal => client
        .from('frayer_cache')
        .select('model_data, model_version, hit_count')
        .eq('cache_key', key)
        .abortSignal(signal)
        .maybeSingle(),
      CACHE_LOOKUP_TIMEOUT_MS,
    );
    if (error) {
      console.warn('Frayer-cache opzoeken mislukt (behandeld als miss):', error.message);
      return null;
    }
    if (!data) return null;
    if (!isValidFrayerModel(data.model_data)) {
      console.warn('Frayer-cache: ongeldige rij genegeerd (wordt opnieuw gegenereerd):', key);
      return null;
    }
    return {
      modelData: data.model_data,
      modelVersion: typeof data.model_version === 'string' ? data.model_version : null,
      hitCount: typeof data.hit_count === 'number' ? data.hit_count : 0,
    };
  } catch (err: unknown) {
    console.warn('Frayer-cache opzoeken mislukt (behandeld als miss):', foutTekst(err));
    return null;
  }
}

/**
 * hit_count + 1 en last_hit_at, fire-and-forget: het antwoord aan de leerling
 * wacht hier niet op. Enkel statistiek — bij gelijktijdige treffers kan er een
 * optelling verloren gaan (lezen-dan-schrijven), dat is aanvaard.
 */
function registreerTreffer(client: SupabaseClient, key: string, vorigAantal: number): void {
  Promise.resolve(
    client
      .from('frayer_cache')
      .update({ hit_count: vorigAantal + 1, last_hit_at: new Date().toISOString() })
      .eq('cache_key', key)
      .abortSignal(AbortSignal.timeout(CACHE_WRITE_TIMEOUT_MS)),
  ).then(
    ({ error }) => { if (error) console.warn('Frayer-cache: teller bijwerken mislukt:', error.message); },
    (err: unknown) => { console.warn('Frayer-cache: teller bijwerken mislukt:', foutTekst(err)); },
  );
}

/** Wegschrijven na een miss. Mislukt het, dan enkel een waarschuwing. */
async function bewaarInCache(
  client: SupabaseClient,
  frayer: FrayerRequest,
  key: string,
  modelData: unknown,
  modelVersion: string,
): Promise<void> {
  try {
    const { error } = await metTijdslimiet(
      signal => client
        .from('frayer_cache')
        .upsert({
          cache_key: key,
          word: frayer.word,
          context: frayer.context,
          difficulty: frayer.difficulty,
          prompt_version: FRAYER_PROMPT_VERSION,
          model_version: modelVersion,
          model_data: modelData,
        }, { onConflict: 'cache_key' })
        .abortSignal(signal),
      CACHE_WRITE_TIMEOUT_MS,
    );
    if (error) console.warn('Frayer-cache bewaren mislukt:', error.message);
  } catch (err: unknown) {
    console.warn('Frayer-cache bewaren mislukt:', foutTekst(err));
  }
}

/** Het antwoord van Gemini als Frayer-model, of null als het er niet uitziet als een geldig model. */
function leesFrayerModel(text: string): unknown | null {
  try {
    const parsed: unknown = JSON.parse(cleanJsonOutput(text));
    return isValidFrayerModel(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Alles wat de proxy naar buiten toe nodig heeft. In productie de echte SDK's;
 * scripts/test-proxy-logica.mjs geeft nepversies in het geheugen mee.
 */
export interface ProxyAfhankelijkheden {
  maakGemini: (apiKey: string) => Pick<GoogleGenAI, 'models'>;
  maakCacheClient: (url: string, serviceKey: string) => SupabaseClient;
}

const echteAfhankelijkheden: ProxyAfhankelijkheden = {
  maakGemini: apiKey => new GoogleGenAI({ apiKey }),
  maakCacheClient: (url, serviceKey) => createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }),
};

export function createHandler(deps: ProxyAfhankelijkheden = echteAfhankelijkheden) {
  // Service-role-client, één keer per serverinstantie bepaald.
  // undefined = nog niet bepaald, null = cache uit (reden 1× gelogd).
  let cacheClient: SupabaseClient | null | undefined;

  function getCacheClient(): SupabaseClient | null {
    if (cacheClient !== undefined) return cacheClient;
    const status = frayerCacheStatus();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!status.aan || !status.url || !serviceKey) {
      console.warn(`Frayer-cache staat UIT (${status.reden}). Frayer-modellen komen gewoon rechtstreeks van Gemini.`);
      cacheClient = null;
    } else {
      cacheClient = deps.maakCacheClient(status.url, serviceKey);
    }
    return cacheClient;
  }

  /**
   * Frayer-pad. De browser levert enkel woord, vak en niveau — nooit prompttekst.
   * De proxy bouwt de prompt zelf, dus wat in de gedeelde cache belandt is altijd
   * Gemini's antwoord op een prompt van de server.
   */
  async function handleFrayer(rawFrayer: unknown, apiKey: string, res: VercelResponse) {
    const frayer = normalizeFrayerRequest(rawFrayer);
    if (!frayer) {
      return res.status(400).json({
        error: 'Ongeldige Frayer-aanvraag: geef een woord van 1 tot 60 tekens, zonder nieuwe regels.',
      });
    }

    const key = frayerCacheKey(frayer);
    const client = getCacheClient();

    if (client) {
      const hit = await zoekInCache(client, key);
      if (hit) {
        registreerTreffer(client, key, hit.hitCount);
        return res.status(200).json({
          text: JSON.stringify(hit.modelData),
          usage: null,
          modelVersion: hit.modelVersion,
          cached: true,
        });
      }
    }

    const ai = deps.maakGemini(apiKey);
    const response = await ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: buildFrayerPrompt(frayer),
      config: FRAYER_GENERATION_CONFIG as GenerateContentConfig,
    });
    const usage = toUsagePayload(response.usageMetadata);
    const modelVersion = (response as { modelVersion?: string }).modelVersion ?? null;
    const text = response.text ?? '';

    if (client) {
      // Enkel een antwoord dat er écht uitziet als een Frayer-model wordt bewaard;
      // de rest gaat wel naar de leerling (de client probeert zelf opnieuw).
      const modelData = leesFrayerModel(text);
      if (modelData) await bewaarInCache(client, frayer, key, modelData, modelVersion ?? GEMINI_TEXT_MODEL);
    }

    return res.status(200).json({ text, usage, modelVersion, cached: false });
  }

  return async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not set in server environment');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Enkel ingelogde gebruikers. De app zelf werkt enkel na login, dus een oproep
    // zonder (geldige) sessie komt niet van een leerling of leerkracht — en zou
    // anders op kosten van de school met de Gemini-sleutel kunnen werken.
    const caller = await authenticateCaller(req);
    if (caller.kind === 'missing' || caller.kind === 'invalid') {
      return res.status(401).json({
        error: 'Je sessie is verlopen. Log opnieuw in om de AI-functies te gebruiken.',
      });
    }
    const userId = caller.kind === 'user' ? caller.userId : null;
    const limit = userId ? RATE_LIMITS.authenticated : RATE_LIMITS.anonymous;
    const key = userId ? `u:${userId}` : `ip:${getClientIp(req)}`;

    const { allowed, retryAfter } = checkRateLimit(key, limit.max, limit.windowMs);
    if (!allowed) {
      res.setHeader('Retry-After', String(retryAfter ?? 60));
      return res.status(429).json({
        error: `Te veel verzoeken. Probeer over ${retryAfter ?? 60} seconden opnieuw.`,
      });
    }

    try {
      const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};

      // Nieuw pad: Frayer-model op basis van woord/vak/niveau, met gedeelde cache.
      if (body.frayer !== undefined) {
        return await handleFrayer(body.frayer, apiKey, res);
      }

      // Bestaand pad (quiz, feedback, TTS, …): vrije prompt, nooit gecachet.
      const { contents, config } = body;
      const model = resolveModel(body.model);

      if (!model || !contents) {
        return res.status(400).json({ error: 'Missing required fields: model, contents' });
      }

      if (typeof model !== 'string' || !ALLOWED_MODELS.has(model)) {
        return res.status(400).json({ error: `Model "${String(model)}" is not allowed` });
      }

      const ai = deps.maakGemini(apiKey);
      const response = await ai.models.generateContent({ model, contents, config });
      const usage = toUsagePayload(response.usageMetadata);

      // Welk model Google ECHT gebruikte. Sinds het vastpinnen op GEMINI_TEXT_MODEL
      // is dat normaal een vaste versie, maar we loggen nog steeds wat Google
      // teruggeeft: zo klopt de kostenraming altijd.
      const modelVersion = (response as { modelVersion?: string }).modelVersion ?? null;

      const audioPart = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (audioPart?.data) {
        return res.status(200).json({ audioData: audioPart.data, usage, modelVersion, cached: false });
      }

      return res.status(200).json({ text: response.text ?? '', usage, modelVersion, cached: false });

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Gemini proxy error:', message);
      return res.status(502).json({ error: `Gemini API error: ${message}` });
    }
  };
}

export default createHandler();
