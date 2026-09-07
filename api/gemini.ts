import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Whitelist van toegestane modellen — voorkomt misbruik via willekeurige modelnamen
const ALLOWED_MODELS = new Set([
  'gemini-flash-latest',
  'gemini-2.5-flash-preview-tts',
]);

// Rate limiting: in-memory map met sliding window per identiteit (user-id of IP).
// Werkt binnen één Vercel function-instance; bij grote schaal upgrade naar Upstash/Redis.
const RATE_LIMITS = {
  authenticated: { max: 60, windowMs: 60_000 }, // 60 req/min per user
  anonymous:     { max: 15, windowMs: 60_000 }, // 15 req/min per IP
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

async function getAuthenticatedUserId(req: VercelRequest): Promise<string | null> {
  const token = getBearerToken(req);
  if (!token) return null;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

// =====================================================
// AI-verbruik loggen (ai_usage_log)
// =====================================================
// Enkel METADATA: hoeveel tokens, welk model, welke functie, gelukt of niet.
// NOOIT prompts, antwoorden of leerlingnamen — die verlaten deze functie niet.
// Zie migration-2026-09-07-ai-usage-log.sql voor de tabel + RLS.

/** Label voor calls van een oude client die nog geen `feature` meestuurt. */
const FEATURE_FALLBACK = 'onbekend';

/** Loggen mag de leerling nooit laten wachten: na 1,5s geven we het gewoon op. */
const LOG_TIMEOUT_MS = 1500;

interface AiUsageLogRow {
  user_id: string | null;
  feature: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  thought_tokens: number | null;
  total_tokens: number | null;
  success: boolean;
  status_code: number | null;
  error_message: string | null;
  duration_ms: number | null;
}

/**
 * Maakt van een vrij tekstveld een veilig, kort label: enkel [a-z0-9_-],
 * max 40 tekens. Alles wat daar niet aan voldoet wordt 'onbekend'.
 */
function sanitizeFeature(value: unknown): string {
  if (typeof value !== 'string') return FEATURE_FALLBACK;
  const cleaned = value.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
  return cleaned || FEATURE_FALLBACK;
}

// De service-role client cachen we op module-niveau (hergebruik tussen calls
// binnen dezelfde warme function-instance).
// LET OP: SUPABASE_SERVICE_ROLE_KEY komt uitsluitend uit process.env op de
// server. Deze sleutel mag NOOIT in client-code of in een VITE_-variabele.
let serviceRoleClient: SupabaseClient | null = null;

function getServiceRoleClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  if (!serviceRoleClient) {
    serviceRoleClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return serviceRoleClient;
}

/**
 * Schrijft één metadata-rij weg. Twee modi:
 *
 *  1. SUPABASE_SERVICE_ROLE_KEY ingesteld → schrijven met de service-role.
 *     Die omzeilt RLS, dus ook anonieme calls (user_id NULL) worden gelogd.
 *  2. Geen service-role sleutel → schrijven met de JWT van de leerling zelf.
 *     RLS eist dan user_id = auth.uid(); anonieme calls slaan we stil over.
 *
 * Deze functie gooit nooit en verandert nooit het antwoord aan de leerling.
 */
async function logAiUsage(row: AiUsageLogRow, token: string | null): Promise<void> {
  try {
    const url = process.env.SUPABASE_URL;
    if (!url) return;

    let client = getServiceRoleClient();
    if (!client) {
      const anonKey = process.env.SUPABASE_ANON_KEY;
      // Zonder service-role sleutel kan enkel een ingelogde gebruiker loggen.
      if (!anonKey || !token || !row.user_id) return;
      client = createClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }

    const insert = Promise.resolve(client.from('ai_usage_log').insert(row))
      .then(({ error }) => {
        if (error) console.warn('AI-verbruik loggen mislukt:', error.message);
      })
      .catch((err: unknown) => {
        console.warn('AI-verbruik loggen mislukt:', err instanceof Error ? err.message : err);
      });

    // Wachten vóór we het antwoord versturen (Vercel mag de functie daarna
    // bevriezen), maar nooit langer dan LOG_TIMEOUT_MS — een trage database
    // mag het antwoord van de leerling niet ophouden.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>(resolve => {
      timer = setTimeout(resolve, LOG_TIMEOUT_MS);
    });
    try {
      await Promise.race([insert, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch (err: unknown) {
    console.warn('AI-verbruik loggen mislukt:', err instanceof Error ? err.message : err);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set in server environment');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Identificeer caller: ingelogde user krijgt ruimere limiet, anonieme strenger
  const userId = await getAuthenticatedUserId(req);
  const limit = userId ? RATE_LIMITS.authenticated : RATE_LIMITS.anonymous;
  const key = userId ? `u:${userId}` : `ip:${getClientIp(req)}`;

  const { allowed, retryAfter } = checkRateLimit(key, limit.max, limit.windowMs);
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfter ?? 60));
    return res.status(429).json({
      error: `Te veel verzoeken. Probeer over ${retryAfter ?? 60} seconden opnieuw.`,
    });
  }

  // Buiten de try, zodat de catch dezelfde gegevens kan loggen.
  const token = getBearerToken(req);
  const feature = sanitizeFeature((req.body as { feature?: unknown } | null | undefined)?.feature);
  let loggedModel = FEATURE_FALLBACK;
  // 0 = Gemini is nog niet aangesproken. We loggen enkel échte Gemini-calls,
  // dus geen verzoeken die er nooit geraakt zijn (405/500/429/400).
  let geminiStartedAt = 0;

  try {
    const { model, contents, config } = req.body;

    if (!model || !contents) {
      return res.status(400).json({ error: 'Missing required fields: model, contents' });
    }

    if (!ALLOWED_MODELS.has(model)) {
      return res.status(400).json({ error: `Model "${model}" is not allowed` });
    }

    loggedModel = model;

    const ai = new GoogleGenAI({ apiKey });
    geminiStartedAt = Date.now();
    const response = await ai.models.generateContent({ model, contents, config });
    const durationMs = Date.now() - geminiStartedAt;

    const usage = response.usageMetadata;
    await logAiUsage({
      user_id: userId,
      feature,
      model,
      input_tokens: usage?.promptTokenCount ?? null,
      output_tokens: usage?.candidatesTokenCount ?? null,
      thought_tokens: usage?.thoughtsTokenCount ?? null,
      total_tokens: usage?.totalTokenCount ?? null,
      success: true,
      status_code: 200,
      error_message: null,
      duration_ms: durationMs,
    }, token);

    const audioPart = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (audioPart?.data) {
      return res.status(200).json({ audioData: audioPart.data });
    }

    return res.status(200).json({ text: response.text ?? '' });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Gemini proxy error:', message);

    // Enkel loggen als de call Gemini écht bereikt heeft. Mislukte calls hebben
    // geen gekende tokens → die blijven NULL en kosten dus $0 in het paneel.
    if (geminiStartedAt > 0) {
      await logAiUsage({
        user_id: userId,
        feature,
        model: loggedModel,
        input_tokens: null,
        output_tokens: null,
        thought_tokens: null,
        total_tokens: null,
        success: false,
        status_code: 502,
        error_message: message.slice(0, 200),
        duration_ms: Date.now() - geminiStartedAt,
      }, token);
    }

    return res.status(502).json({ error: `Gemini API error: ${message}` });
  }
}
