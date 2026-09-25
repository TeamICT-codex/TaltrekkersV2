import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

// Whitelist van toegestane modellen — voorkomt misbruik via willekeurige modelnamen
const ALLOWED_MODELS = new Set([
  'gemini-flash-latest',
  'gemini-2.5-flash-preview-tts',
]);

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    const { model, contents, config } = req.body;

    if (!model || !contents) {
      return res.status(400).json({ error: 'Missing required fields: model, contents' });
    }

    if (!ALLOWED_MODELS.has(model)) {
      return res.status(400).json({ error: `Model "${model}" is not allowed` });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({ model, contents, config });
    const usage = toUsagePayload(response.usageMetadata);

    // Welk model Google ECHT gebruikte. `gemini-flash-latest` is een rollende
    // alias: Google verlegt die naar het nieuwste Flash-model, en dat kan een
    // ander tarief hebben (op 2026-09-02 verschoof ze naar gemini-3.8-flash).
    // Door de opgeloste versie te loggen blijft de kostenraming ook daarna kloppen.
    const modelVersion = (response as { modelVersion?: string }).modelVersion ?? null;

    const audioPart = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (audioPart?.data) {
      return res.status(200).json({ audioData: audioPart.data, usage, modelVersion });
    }

    return res.status(200).json({ text: response.text ?? '', usage, modelVersion });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Gemini proxy error:', message);
    return res.status(502).json({ error: `Gemini API error: ${message}` });
  }
}
