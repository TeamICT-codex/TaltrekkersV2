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
  if (!supabaseUrl || !supabaseKey) {
    // Zonder deze twee server-variabelen kan de proxy geen enkele token
    // verifiëren en valt IEDEREEN terug op de strengere anonieme limiet —
    // op een school met één publiek IP is dat 15 calls/minuut voor de hele
    // klas. Daarom luid waarschuwen in de functie-logs i.p.v. stil falen.
    console.warn('SUPABASE_URL of SUPABASE_ANON_KEY ontbreekt: elke call telt als anoniem.');
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return data.user.id;
  } catch {
    return null;
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

    const audioPart = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (audioPart?.data) {
      return res.status(200).json({ audioData: audioPart.data, usage });
    }

    return res.status(200).json({ text: response.text ?? '', usage });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Gemini proxy error:', message);
    return res.status(502).json({ error: `Gemini API error: ${message}` });
  }
}
