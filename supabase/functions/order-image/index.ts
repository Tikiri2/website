import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405);
  if (Number(req.headers.get('content-length')) > 1024) return respond({ error: 'Invalid link.' }, 400);
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`image-ip:${ip}`));
    const key = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const { data: allowed, error: limitError } = await db.rpc('consume_order_limit', { p_key: key, p_limit: 120 });
    if (limitError) throw limitError;
    if (!allowed) return respond({ error: 'Too many attempts. Please try again later.' }, 429);
    // Bound streamed input too; the token travels in the body, not URL/access logs.
    const reader = req.body?.getReader();
    if (!reader) return respond({ error: 'Invalid link.' }, 400);
    const bytes = new Uint8Array(1024);
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (length + value.length > bytes.length) {
        await reader.cancel();
        return respond({ error: 'Invalid link.' }, 400);
      }
      bytes.set(value, length); length += value.length;
    }
    let token;
    try { token = JSON.parse(new TextDecoder().decode(bytes.subarray(0, length)))?.token; }
    catch { return respond({ error: 'Invalid link.' }, 400); }
    if (typeof token !== 'string' || !/^[a-f0-9]{32}$/.test(token)) return respond({ error: 'Invalid link.' }, 400);
    const { data: order, error } = await db.from('orders')
      .select('image_path, image_share_expires_at').eq('image_share_token', token).maybeSingle();
    if (error) throw error;
    const remaining = order ? Math.floor((Date.parse(order.image_share_expires_at) - Date.now()) / 1000) : 0;
    if (!order?.image_path || !Number.isFinite(remaining) || remaining <= 0) {
      return respond({ error: 'This order image link has expired or is unavailable. Please contact the shop.' }, 404);
    }
    const { data: link, error: signError } = await db.storage.from('order-images')
      .createSignedUrl(order.image_path, Math.min(300, remaining));
    if (signError) throw signError;
    // No structured customer/order data is exposed by the public endpoint.
    return respond({ image_url: link.signedUrl });
  } catch {
    return respond({ error: 'Could not load this order image. Please try again later.' }, 500);
  }
});
