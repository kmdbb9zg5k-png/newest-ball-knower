import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const recentRequests = new Map<string, number[]>();

function allowed(ip: string) {
  const now = Date.now();
  if (recentRequests.size > 1_000) {
    for (const [key, timestamps] of recentRequests) {
      if (!timestamps.some(timestamp => now - timestamp < 60_000)) recentRequests.delete(key);
    }
  }
  const recent = (recentRequests.get(ip) ?? []).filter(timestamp => now - timestamp < 60_000);
  if (recent.length >= 4) return false;
  recent.push(now);
  recentRequests.set(ip, recent);
  return true;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  const apiKey = process.env.GEMINI_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const configured = Boolean(apiKey && supabaseUrl && supabaseKey);
  if (req.method === 'GET') return res.status(200).json({ available: configured });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!configured) return res.status(503).json({ available: false, error: 'AI player rendering is not configured yet.' });

  const authorization = String(req.headers.authorization || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Sign in before creating a player render.' });

  const authClient = createClient(supabaseUrl!, supabaseKey!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: verified, error: authError } = await authClient.auth.getUser(token);
  if (authError || !verified.user) return res.status(401).json({ error: 'Your session expired. Sign in again and retry.' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  if (!allowed(`${verified.user.id}:${ip}`)) return res.status(429).json({ error: 'Please wait before creating another player render.' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const image = String(body?.image || '');
    const edit = String(body?.prompt || '').trim().slice(0, 280);
    const bodyDescription = String(body?.bodyDescription || '').trim().slice(0, 180);
    const position = String(body?.position || 'WR').slice(0, 8);
    const number = String(body?.number || '1').replace(/\D/g, '').slice(0, 2) || '1';
    const team = String(body?.team || 'NFL team').slice(0, 60);
    const match = image.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
    if (!match || match[2].length > 2_000_000) return res.status(400).json({ error: 'Upload a clear JPG, PNG or WebP selfie under 1.5 MB.' });

    const { data: withinQuota, error: quotaError } = await authClient.rpc('consume_my_player_ai_quota', { p_limit: 4 });
    if (quotaError) {
      console.error('my-player-quota-error', quotaError.message);
      return res.status(503).json({ error: 'Player rendering is temporarily unavailable.' });
    }
    if (!withinQuota) return res.status(429).json({ error: 'You reached today’s four player renders. Try again tomorrow.' });

    const bodyProfile = bodyDescription ? ` Body profile: ${bodyDescription}.` : '';
    const prompt = `Create a polished, photorealistic full-body 3D football video-game player render using the uploaded adult person's face and preserving their recognizable facial identity. The athlete is a ${position} wearing a modern fictional pro-football uniform for ${team}, jersey number ${number}. Do not use any official league or team logos and do not add text. Stadium tunnel background, dramatic sports lighting, realistic proportions, vertical 4:5 composition.${bodyProfile} Apply this appearance request: ${edit || 'clean game-day uniform and gloves'}.`;
    const ai = new GoogleGenAI({ apiKey });
    const interaction = await ai.interactions.create({
      model: 'gemini-3.1-flash-image',
      input: [
        { type: 'text', text: prompt },
        { type: 'image', mime_type: match[1], data: match[2] },
      ],
      response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: '4:5', image_size: '1K' },
    } as any);
    const generated = (interaction as any).output_image;
    if (!generated?.data) return res.status(502).json({ error: 'The image model did not return a player render.' });
    return res.status(200).json({ available: true, image: `data:${generated.mime_type || 'image/jpeg'};base64,${generated.data}` });
  } catch (error: any) {
    console.error('my-player-art-error', error?.message || error);
    return res.status(500).json({ error: 'Unable to create the player render right now.' });
  }
}