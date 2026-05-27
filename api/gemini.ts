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

async function getAuthenticatedUserId(req: VercelRequest): Promise<string | null> {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
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

    const audioPart = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (audioPart?.data) {
      return res.status(200).json({ audioData: audioPart.data });
    }

    return res.status(200).json({ text: response.text ?? '' });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Gemini proxy error:', message);
    return res.status(502).json({ error: `Gemini API error: ${message}` });
  }
}
